# Internal Link Graph Builder & Orphan Page Detector
Author: Sancia 
## Overview

A Node.js module that:
1. Constructs a directed link graph from crawl data
2. Runs a simplified **PageRank** via power iteration (eigenvalue method)
3. Identifies **orphan** (0 inbound) and **near-orphan** (1–2 inbound) pages
4. Recommends the top-3 authoritative, topically-relevant linking opportunities per weak page
5. Produces a structured JSON report

---

## Setup & Run

```bash
cd task-04
npm install

# Run analysis on the provided dataset (default: ../task_04_link_graph.json)
npm start

# Or point to a custom crawl file:
node src/index.js path/to/crawl.json

# Run the 9 unit tests
npm test
```

---

## File Structure

```
task-04/
├── src/
│   ├── generateHtml.js      # Dashboard generator
│   ├── graphBuilder.js      # Graph construction (nodes, inbound/outbound adjacency)
│   ├── pageRank.js          # PageRank via power iteration (eigenvalue method)
│   ├── orphanDetector.js    # Orphan detection, relevance scoring, recommendations
│   └── index.js             # CLI entry point
├── tests/
│   └── linkGraph.test.js    # 9 unit tests (Vitest)
├── output/
│   ├── report.html          # Dashboard
│   └── report.json          # Generated after npm start
└── README.md
```

---

## Algorithm Details

### Graph Construction (`graphBuilder.js`)

- Each page URL becomes a **node**; each internal link becomes a **directed edge**
- Only paths starting with `/` are accepted as internal links (external URLs, `mailto:`, `#anchors` are discarded)
- Query strings and fragments are stripped for normalisation: `/page?q=1` → `/page`
- Self-links are discarded (they provide no PageRank benefit and distort inbound counts)
- The graph is represented as two sparse `Map<url, Set<url>>` structures (outbound + inbound) — O(N + E) memory, not O(N²)

### PageRank (`pageRank.js`)

**Mathematical basis:**  
PageRank is an **eigenvector problem**. Given the column-stochastic transition matrix M, the PageRank vector π satisfies:

```
π = d·M·π + (1 − d)·(1/N)·𝟙
```

This is equivalent to finding the **dominant eigenvector** of the Google matrix:

```
G = d·M + (1 − d)·(1/N)·𝟙𝟙ᵀ
```
By the Perron–Frobenius theorem, the steady-state eigenvector is unique and strictly positive, with eigenvalue λ = 1. The remaining eigenvalues satisfy |λᵢ| ≤ d = 0.85, so their impact diminishes with each iteration. This is why power iteration converges reliably and typically within ~10 iterations.

Implementation: Instead of constructing the full N×N matrix, I operate directly on sparse adjacency maps in each iteration.
- Dangling nodes (with no outgoing links) have their rank redistributed uniformly to maintain stochasticity
- After each iteration, scores are normalized so they sum to 1.0

### Orphan & Near-Orphan Detection (`orphanDetector.js`)

- **Orphan**: `inboundCount === 0`
- **Near-orphan**: `1 ≤ inboundCount ≤ nearOrphanThreshold` (default 2, matching dataset metadata)

### Relevance Matching

Relevance uses **Jaccard similarity** on URL token sets:

```
tokens("/blog/seo-fundamentals") → { "blog", "seo", "fundamentals" }
jaccard(A, B) = |A ∩ B| / |A ∪ B|
```

A **prefix bonus** of +0.15 is added when both pages share the same top-level section (e.g. both under `/blog/`), ensuring sibling pages are preferred over unrelated hubs.

### Recommendation Scoring

```
combined_score = relevance × 0.6 + normalisedPageRank × 0.4
```

The 60/40 split prioritises topical fit while still rewarding authority — a deliberate design choice. Pages that already link to the orphan are excluded.

---

## Results on Provided Dataset (42 pages)

| Metric | Value |
|--------|-------|
| Total pages | 42 |
| Orphans (0 inbound) | 13 |
| Near-orphans (1–2 inbound) | 8 |
| Healthy pages | 21 |
| PageRank sum | ≈ 1.0 |
| Top PageRank page | `/blog` (0.1045) |

---

## Scalability at 500,000+ Pages

Once you get to ~500k pages, the current in-memory approach starts to break down. Here’s how I’d tweak my approach:

### Memory
- Swap out `Map<string, Set<string>>` for a **compressed sparse row (CSR)** structure using integer node IDs and typed arrays. That brings memory down from ~600 MB to ~80 MB for a 500k-node, 5M-edge graph.
- Stream the crawl data instead of loading the whole JSON at once.

### PageRank Computation
- Use **blocked power iteration** — process nodes in chunks that fit in cache to reduce cache misses.
- For larger graphs, move to something like **Spark GraphX**, or a graph database (e.g., Neo4j) with built-in PageRank.
- The algorithm is naturally parallel: each node’s update only depends on the previous iteration, so it can be split across worker threads or SIMD.

### Orphan Detection
- Track inbound link counts during crawling itself instead of computing them later. Each link just increments a counter, making orphan detection essentially O(1).

### Relevance Matching
- Jaccard similarity on URL tokens doesn’t scale well since it requires scanning all candidates.
- Replace it with **MinHash + LSH** for approximate nearest neighbours in near O(1).
- Alternatively, generate embeddings for URLs/metadata and use ANN search (FAISS, Pinecone).

### Storage
- Store results in something like **ClickHouse** or **BigQuery** to track PageRank changes and orphan trends over time.

### Storage
- Results go into a time-series database (ClickHouse / BigQuery) so historical PageRank trends and orphan regressions can be tracked across crawls.

---

## Dependencies

| Package | Version | Why |
|---------|---------|-----|
| `vitest` | ^1.0 | Fast, ESM-native test runner — zero config with `type: module` projects |

No runtime dependencies. The core algorithms are implemented from scratch.
