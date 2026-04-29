/**
 * pageRank.js
 * Implements the simplified PageRank algorithm via power iteration.
 *
 * ── Mathematical background ──────────────────────────────────────────────────
 * PageRank is fundamentally an eigenvector problem.  Given the column-stochastic
 * transition matrix M (where M[i][j] = 1/out_degree(j) if j→i else 0), the
 * PageRank vector π satisfies:
 *
 *   π = d·M·π + (1-d)·(1/N)·𝟙
 *
 * This is identical to finding the dominant (largest) eigenvector of the
 * Google matrix G = d·M + (1-d)·(1/N)·𝟙𝟙ᵀ, which by the Perron–Frobenius
 * theorem is unique, positive, and corresponds to eigenvalue λ = 1.
 *
 * Power iteration (repeated multiplication by G) converges to that eigenvector
 * because all other eigenvalues satisfy |λᵢ| ≤ d < 1 — they are damped away.
 * In practice 10 iterations is more than sufficient for well-connected graphs.
 *
 * We do NOT build the full dense N×N matrix (which would be O(N²) memory).
 * Instead we work with the sparse adjacency maps from graphBuilder, giving
 * O(N + E) memory and O(iter·(N + E)) time — essential for large graphs.
 *
 * PCA connection: If you were to run PCA on a PageRank-like matrix the first
 * principal component would align with the dominant eigenvector (i.e. the PR
 * vector itself), confirming that PR extracts the single most "important"
 * dimension of the link structure.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * @typedef {import('./graphBuilder.js').LinkGraph} LinkGraph
 */

/**
 * @typedef {Object} PageRankOptions
 * @property {number} [dampingFactor=0.85]  - Damping factor d (0 < d < 1)
 * @property {number} [iterations=10]       - Number of power-iteration steps
 */

/**
 * Runs simplified PageRank on a pre-built link graph.
 *
 * Dangling nodes (pages with zero outbound links) are handled with the
 * standard "dangling-node teleportation": their rank is redistributed
 * uniformly across all nodes, preserving the row-stochastic invariant.
 *
 * @param {LinkGraph}       graph
 * @param {PageRankOptions} [opts]
 * @returns {Map<string, number>}  URL → normalised PageRank score (sums to 1)
 */
export function computePageRank(graph, opts = {}) {
  const { nodes, outbound, inbound } = graph;
  const N = nodes.length;
  if (N === 0) return new Map();

  const d = opts.dampingFactor ?? 0.85;
  const iterations = opts.iterations ?? 10;

  // ── Initialise rank vector uniformly (eigenvector seed) ──────────────────
  /** @type {Map<string, number>} */
  let rank = new Map(nodes.map((n) => [n, 1 / N]));

  // Pre-compute out-degree for each node (constant across iterations)
  const outDegree = new Map(nodes.map((n) => [n, outbound.get(n)?.size ?? 0]));

  for (let iter = 0; iter < iterations; iter++) {
    // Sum rank from dangling nodes (zero out-degree) to redistribute
    let danglingSum = 0;
    for (const node of nodes) {
      if (outDegree.get(node) === 0) {
        danglingSum += rank.get(node);
      }
    }
    const danglingShare = (d * danglingSum) / N;
    const teleportShare = (1 - d) / N;
    const baseShare = danglingShare + teleportShare;

    /** @type {Map<string, number>} */
    const newRank = new Map();

    for (const node of nodes) {
      // Collect rank flowing IN from all pages that link to this node
      let inFlow = 0;
      const sources = inbound.get(node) ?? new Set();
      for (const src of sources) {
        inFlow += rank.get(src) / outDegree.get(src);
      }
      newRank.set(node, baseShare + d * inFlow);
    }

    rank = newRank;
  }

  // ── Normalise so scores sum exactly to 1.0 ───────────────────────────────
  let total = 0;
  for (const v of rank.values()) total += v;
  if (total > 0) {
    for (const [k, v] of rank) rank.set(k, v / total);
  }

  return rank;
}

/**
 * Returns PageRank entries sorted descending by score.
 *
 * @param {Map<string, number>} rankMap
 * @returns {{ url: string; score: number }[]}
 */
export function sortedPageRank(rankMap) {
  return Array.from(rankMap.entries())
    .map(([url, score]) => ({ url, score }))
    .sort((a, b) => b.score - a.score);
}
