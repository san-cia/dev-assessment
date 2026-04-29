# Internal Link Graph Builder & Orphan Page Detector

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

By the **Perron–Frobenius theorem**, this eigenvector is unique and positive, corresponding to eigenvalue λ = 1. All other eigenvalues satisfy |λᵢ| ≤ d = 0.85, so power iteration damps them out — this is why convergence is guaranteed and fast (~10 iterations).

**Implementation:** We avoid building the full N×N matrix. Instead, each iteration walks the sparse adjacency maps:
- Dangling nodes (zero outbound) have their rank redistributed uniformly to maintain the row-stochastic invariant
- Scores are normalised to sum to 1.0 after all iterations

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

At 500k+ pages the current in-memory approach becomes impractical. Here's how our approach would change:

### Memory
- Replace `Map<string, Set<string>>` with a **compressed sparse row (CSR)** representation — integer node IDs and typed arrays for edges. A 500k-node, 5M-edge graph fits in ~80 MB instead of ~600 MB.
- Stream the crawl JSON rather than loading it entirely (use `stream/consumers` or a SAX-style parser).

### PageRank computation
- Use **blocked power iteration** — process nodes in chunks that fit in L3 cache to minimise cache misses.
- For very large graphs, switch to **Apache Spark GraphX** or **NetworkX** with distributed execution, or a dedicated graph DB (Neo4j) with built-in PageRank.
- The power iteration is already parallelisable: the rank update for each node is independent given the previous iteration's scores, so it maps naturally to worker threads or WASM SIMD.

### Orphan detection
- Maintain a real-time inbound-count index during crawling rather than computing it post-hoc — every crawled link updates a counter, making orphan detection O(1) per page lookup.

### Relevance matching
- At scale, Jaccard on URL tokens becomes a bottleneck for the O(N) candidate scan per weak page.
- Replace with **MinHash LSH** (Locality-Sensitive Hashing) to find approximate nearest neighbours in O(1) average case.
- Alternatively, embed page URLs + metadata with a lightweight embedding model and use ANN search (FAISS, Pinecone).

### Storage
- Results go into a time-series database (ClickHouse / BigQuery) so historical PageRank trends and orphan regressions can be tracked across crawls.

---

## Dependencies

| Package | Version | Why |
|---------|---------|-----|
| `vitest` | ^1.0 | Fast, ESM-native test runner — zero config with `type: module` projects |

No runtime dependencies. The core algorithms are implemented from scratch.
