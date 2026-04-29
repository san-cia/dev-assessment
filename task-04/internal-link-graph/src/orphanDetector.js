/**
 * orphanDetector.js
 * Identifies orphan / near-orphan pages and recommends high-authority,
 * topically-relevant source pages that should link TO each weak page.
 *
 * Relevance heuristic (path/slug similarity):
 *   We split each URL path into segments and keywords (splitting on "-"),
 *   build the union set for each URL, then compute Jaccard similarity:
 *
 *     sim(A, B) = |A ∩ B| / |A ∪ B|
 *
 *   This is a lightweight stand-in for semantic similarity and is O(1)
 *   per pair after tokenisation — well-suited to 500k-page graphs.
 *
 *   A page with a shared sub-path prefix (e.g. /blog/*) is weighted extra
 *   via a bonus multiplier so that sibling pages rank above unrelated hubs.
 */

/**
 * @typedef {import('./graphBuilder.js').LinkGraph} LinkGraph
 */

/**
 * @typedef {Object} Recommendation
 * @property {string} sourceUrl       - The authoritative page that should add a link
 * @property {number} pageRankScore   - Its PageRank score
 * @property {number} relevanceScore  - Jaccard + bonus similarity (0..1+)
 * @property {string} reason          - Human-readable explanation
 */

/**
 * @typedef {Object} WeakPage
 * @property {string}           url
 * @property {number}           inboundCount
 * @property {'orphan'|'near-orphan'} status
 * @property {Recommendation[]} recommendations
 */

// ── Tokenisation ─────────────────────────────────────────────────────────────

/**
 * Tokenises a URL path into a Set of meaningful tokens.
 * "/blog/seo-fundamentals" → Set { "blog", "seo", "fundamentals" }
 *
 * @param {string} url
 * @returns {Set<string>}
 */
export function tokenise(url) {
  return new Set(
    url
      .toLowerCase()
      .split(/[\/\-_]+/)
      .filter((t) => t.length > 1) // drop single-char noise
  );
}

/**
 * Returns the first path segment of a URL, used as a namespace for the
 * prefix-bonus heuristic.
 * "/blog/geo-introduction" → "blog"
 *
 * @param {string} url
 * @returns {string}
 */
function topSegment(url) {
  const parts = url.split("/").filter(Boolean);
  return parts[0] ?? "";
}

// ── Similarity ────────────────────────────────────────────────────────────────

/**
 * Jaccard similarity between two token sets, with an optional shared-prefix bonus.
 *
 * @param {string} urlA
 * @param {string} urlB
 * @returns {number}  value in [0, ~1.3]
 */
export function relevanceScore(urlA, urlB) {
  const tokA = tokenise(urlA);
  const tokB = tokenise(urlB);

  const intersection = new Set([...tokA].filter((t) => tokB.has(t)));
  const union = new Set([...tokA, ...tokB]);

  const jaccard = union.size === 0 ? 0 : intersection.size / union.size;

  // Bonus: same top-level section (e.g. both under /blog/)
  const prefixBonus = topSegment(urlA) === topSegment(urlB) && topSegment(urlA) !== "" ? 0.15 : 0;

  return jaccard + prefixBonus;
}

// ── Orphan / near-orphan detection ────────────────────────────────────────────

/**
 * @param {LinkGraph}          graph
 * @param {Object}             opts
 * @param {number}             [opts.nearOrphanThreshold=2]
 * @returns {{ orphans: string[]; nearOrphans: string[] }}
 */
export function detectWeakPages(graph, opts = {}) {
  const threshold = opts.nearOrphanThreshold ?? 2;
  const orphans = [];
  const nearOrphans = [];

  for (const node of graph.nodes) {
    const count = graph.inboundCount.get(node) ?? 0;
    if (count === 0) orphans.push(node);
    else if (count <= threshold) nearOrphans.push(node);
  }

  return { orphans, nearOrphans };
}

// ── Recommendation engine ─────────────────────────────────────────────────────

/**
 * For a single weak page, find the top-K authoritative pages that:
 *  1. Do NOT already link to the weak page
 *  2. Are NOT the weak page itself
 *  3. Have the highest combined (relevance × pagerank-weight) score
 *
 * Scoring formula:
 *   combined = relevance * 0.6 + normalisedPR * 0.4
 *
 * The 60/40 split prioritises topical fit while still rewarding authority,
 * matching the task requirement: "most authoritative pages that contain
 * relevant content". Assumption documented here — adjustable via opts.
 *
 * @param {string}              weakUrl
 * @param {LinkGraph}           graph
 * @param {Map<string,number>}  rankMap
 * @param {number}              [topK=3]
 * @returns {Recommendation[]}
 */
export function recommendLinksFor(weakUrl, graph, rankMap, topK = 3) {
  const alreadyLinksToWeak = graph.inbound.get(weakUrl) ?? new Set();

  // Normalise PR scores to [0,1] range for fair weighting
  const maxPR = Math.max(...rankMap.values());

  const candidates = [];

  for (const [url, pr] of rankMap) {
    if (url === weakUrl) continue;
    if (alreadyLinksToWeak.has(url)) continue;

    const rel = relevanceScore(url, weakUrl);
    const normPR = maxPR > 0 ? pr / maxPR : 0;
    const combined = rel * 0.6 + normPR * 0.4;

    candidates.push({ url, pr, rel, combined });
  }

  // Sort by combined score descending, take top K
  candidates.sort((a, b) => b.combined - a.combined);
  const top = candidates.slice(0, topK);

  return top.map(({ url, pr, rel }) => ({
    sourceUrl: url,
    pageRankScore: parseFloat(pr.toFixed(6)),
    relevanceScore: parseFloat(rel.toFixed(4)),
    reason: buildReason(url, weakUrl, rel, pr),
  }));
}

/**
 * Builds a human-readable reason string for a recommendation.
 *
 * @param {string} sourceUrl
 * @param {string} targetUrl
 * @param {number} rel
 * @param {number} pr
 * @returns {string}
 */
function buildReason(sourceUrl, targetUrl, rel, pr) {
  const srcSeg = topSegment(sourceUrl);
  const dstSeg = topSegment(targetUrl);
  const shared = [...tokenise(sourceUrl)].filter((t) => tokenise(targetUrl).has(t));

  if (srcSeg === dstSeg && srcSeg !== "") {
    return `Same section ("/${srcSeg}/") with shared keywords [${shared.join(", ")}]; PageRank ${pr.toFixed(5)}.`;
  }
  if (shared.length > 0) {
    return `Shares topic keywords [${shared.join(", ")}] with the target; PageRank ${pr.toFixed(5)}.`;
  }
  return `High-authority hub (PageRank ${pr.toFixed(5)}) — add contextual link to surface this page.`;
}

// ── Main report assembly ──────────────────────────────────────────────────────

/**
 * @typedef {Object} AnalysisReport
 * @property {number}                       totalPages
 * @property {{ url: string; score: number }[]} pageRankDistribution
 * @property {WeakPage[]}                   orphans
 * @property {WeakPage[]}                   nearOrphans
 * @property {Object}                       summary
 */

/**
 * Assembles the full analysis report.
 *
 * @param {LinkGraph}           graph
 * @param {Map<string,number>}  rankMap
 * @param {Object}              [opts]
 * @param {number}              [opts.nearOrphanThreshold=2]
 * @param {number}              [opts.recommendationsPerPage=3]
 * @returns {AnalysisReport}
 */
export function buildReport(graph, rankMap, opts = {}) {
  const threshold = opts.nearOrphanThreshold ?? 2;
  const topK = opts.recommendationsPerPage ?? 3;

  const { orphans: orphanUrls, nearOrphans: nearOrphanUrls } = detectWeakPages(graph, {
    nearOrphanThreshold: threshold,
  });

  const toWeakPage = (url, status) => ({
    url,
    inboundCount: graph.inboundCount.get(url) ?? 0,
    status,
    recommendations: recommendLinksFor(url, graph, rankMap, topK),
  });

  const prDistribution = Array.from(rankMap.entries())
    .map(([url, score]) => ({ url, score: parseFloat(score.toFixed(6)) }))
    .sort((a, b) => b.score - a.score);

  const prSum = prDistribution.reduce((s, e) => s + e.score, 0);

  return {
    totalPages: graph.nodes.length,
    pageRankDistribution: prDistribution,
    pageRankSum: parseFloat(prSum.toFixed(6)),
    orphans: orphanUrls.map((u) => toWeakPage(u, "orphan")),
    nearOrphans: nearOrphanUrls.map((u) => toWeakPage(u, "near-orphan")),
    summary: {
      orphanCount: orphanUrls.length,
      nearOrphanCount: nearOrphanUrls.length,
      healthyCount: graph.nodes.length - orphanUrls.length - nearOrphanUrls.length,
      topPagesByRank: prDistribution.slice(0, 5).map((e) => e.url),
    },
  };
}
