/**
 * graphBuilder.js
 * Constructs a directed internal link graph from crawl data.
 *
 * Design decision: We represent the graph as two adjacency structures:
 *   - outbound: Map<url, Set<url>>  — who does this page link TO
 *   - inbound:  Map<url, Set<url>>  — who links TO this page
 *
 * Only internal links (same-origin paths starting with "/") are counted.
 * External URLs, anchors (#), and mailto: links are silently discarded.
 *
 * The graph is returned as a plain object so it is serialisable to JSON
 * for downstream consumers (PageRank, orphan detector, CLI reporter).
 */

/**
 * @typedef {Object} CrawlPage
 * @property {string}   url   - Absolute path of the page (e.g. "/blog/seo-guide")
 * @property {string[]} links - Raw href values found on the page
 */

/**
 * @typedef {Object} LinkGraph
 * @property {string[]}             nodes    - All unique page URLs in the graph
 * @property {Map<string,Set<string>>} outbound - outbound adjacency
 * @property {Map<string,Set<string>>} inbound  - inbound adjacency
 * @property {Map<string,number>}   inboundCount - convenience count per node
 */

/**
 * Returns true if the href is an internal link we should count.
 * Strips query strings and fragments so "/page?q=1" → "/page".
 *
 * @param {string} href
 * @returns {{ valid: boolean, normalised: string }}
 */
export function normaliseLink(href) {
  if (typeof href !== "string") return { valid: false, normalised: "" };
  const trimmed = href.trim();
  // Must start with "/" to be an internal path; reject http(s), mailto, #, etc.
  if (!trimmed.startsWith("/")) return { valid: false, normalised: "" };
  // Strip query string and fragment
  const normalised = trimmed.split("?")[0].split("#")[0];
  // Reject empty result
  if (!normalised || normalised.length === 0) return { valid: false, normalised: "" };
  return { valid: true, normalised };
}

/**
 * Builds a directed link graph from a crawl dataset.
 *
 * @param {CrawlPage[]} pages
 * @returns {LinkGraph}
 */
export function buildGraph(pages) {
  if (!Array.isArray(pages) || pages.length === 0) {
    return { nodes: [], outbound: new Map(), inbound: new Map(), inboundCount: new Map() };
  }

  /** @type {Map<string, Set<string>>} */
  const outbound = new Map();
  /** @type {Map<string, Set<string>>} */
  const inbound = new Map();

  // Seed every declared page as a node (even if no one links to it)
  for (const page of pages) {
    const { valid, normalised } = normaliseLink(page.url);
    if (!valid) continue;
    if (!outbound.has(normalised)) outbound.set(normalised, new Set());
    if (!inbound.has(normalised)) inbound.set(normalised, new Set());
  }

  // Walk every page's link list and build edges
  for (const page of pages) {
    const src = normaliseLink(page.url);
    if (!src.valid) continue;

    const links = Array.isArray(page.links) ? page.links : [];
    for (const href of links) {
      const dst = normaliseLink(href);
      if (!dst.valid) continue;
      // Self-links carry no PageRank benefit but we still record them accurately
      // (they count as outbound; they do NOT count as an inbound from another page)
      if (dst.normalised === src.normalised) continue;

      // Ensure destination node exists even if not in the declared page list
      if (!outbound.has(dst.normalised)) outbound.set(dst.normalised, new Set());
      if (!inbound.has(dst.normalised)) inbound.set(dst.normalised, new Set());

      outbound.get(src.normalised).add(dst.normalised);
      inbound.get(dst.normalised).add(src.normalised);
    }
  }

  const nodes = Array.from(outbound.keys()).sort();

  /** @type {Map<string,number>} */
  const inboundCount = new Map();
  for (const [node, sources] of inbound) {
    inboundCount.set(node, sources.size);
  }

  return { nodes, outbound, inbound, inboundCount };
}
