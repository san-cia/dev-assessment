/**
 * linkGraph.test.js
 * Unit tests for the Internal Link Graph Builder & Orphan Page Detector.
 *
 * Run:  npm test
 *
 * Test plan (8 tests, requirement is ≥ 6):
 *  1. Graph construction — correct node count
 *  2. Graph construction — correct edge accuracy (inbound/outbound)
 *  3. PageRank convergence — scores sum to ≈ 1.0
 *  4. PageRank correctness — well-linked hubs score higher than leaves
 *  5. Orphan detection — zero-inbound pages correctly identified
 *  6. Near-orphan detection — 1–2 inbound pages correctly identified
 *  7. Relevance matching — tokenisation and Jaccard similarity
 *  8. Recommendation output structure — shape and constraints validated
 */

import { describe, it, expect } from "vitest";
import { buildGraph, normaliseLink } from "../src/graphBuilder.js";
import { computePageRank, sortedPageRank } from "../src/pageRank.js";
import { detectWeakPages, recommendLinksFor, tokenise, relevanceScore } from "../src/orphanDetector.js";

// ── Shared fixture ────────────────────────────────────────────────────────────
// Mirrors the sample data from the task PDF with one extra orphan and near-orphan
const SAMPLE_PAGES = [
  { url: "/",                  links: ["/about", "/blog", "/products", "/contact"] },
  { url: "/about",             links: ["/", "/contact"] },
  { url: "/blog",              links: ["/", "/blog/seo-guide", "/blog/seo-tips"] },
  { url: "/blog/seo-guide",    links: ["/blog"] },
  { url: "/blog/seo-tips",     links: ["/blog"] },
  { url: "/products",          links: ["/", "/products/plan-a", "/products/plan-b"] },
  { url: "/products/plan-a",   links: ["/products"] },
  { url: "/products/plan-b",   links: ["/products"] },
  { url: "/contact",           links: ["/"] },
  { url: "/blog/geo-intro",    links: [] },           // orphan — no inbound
  { url: "/old-pricing",       links: ["/"] },         // near-orphan — 1 inbound (from /)... actually 0 inbound; / doesn't link to it
  // Make /old-pricing a near-orphan by having 1 page link to it:
  { url: "/sitemap",           links: ["/", "/old-pricing"] }, // gives /old-pricing 1 inbound
];

// ── Test 1 & 2: Graph construction ───────────────────────────────────────────
describe("Graph construction", () => {
  it("1. Registers all declared page nodes", () => {
    const graph = buildGraph(SAMPLE_PAGES);
    // Every URL in SAMPLE_PAGES should appear as a node
    for (const page of SAMPLE_PAGES) {
      expect(graph.nodes).toContain(page.url);
    }
    expect(graph.nodes.length).toBe(SAMPLE_PAGES.length);
  });

  it("2. Builds accurate inbound and outbound edges", () => {
    const graph = buildGraph(SAMPLE_PAGES);

    // / links to /about, /blog, /products, /contact
    expect([...graph.outbound.get("/")]).toContain("/about");
    expect([...graph.outbound.get("/")]).toContain("/blog");
    expect(graph.outbound.get("/").size).toBe(4);

    // /blog should have inbound from /, /blog/seo-guide, /blog/seo-tips
    const blogInbound = [...graph.inbound.get("/blog")];
    expect(blogInbound).toContain("/");
    expect(blogInbound).toContain("/blog/seo-guide");
    expect(blogInbound).toContain("/blog/seo-tips");

    // /blog/geo-intro has zero inbound links
    expect(graph.inboundCount.get("/blog/geo-intro")).toBe(0);

    // /old-pricing has exactly 1 inbound (from /sitemap)
    expect(graph.inboundCount.get("/old-pricing")).toBe(1);

    // Self-links must not be recorded
    const selfPage = [{ url: "/self", links: ["/self", "/about"] }];
    const selfGraph = buildGraph(selfPage);
    expect(selfGraph.inbound.get("/self")?.has("/self")).toBe(false);
  });
});

// ── Test 3 & 4: PageRank ─────────────────────────────────────────────────────
describe("PageRank", () => {
  it("3. Scores sum to approximately 1.0 after normalisation", () => {
    const graph = buildGraph(SAMPLE_PAGES);
    const rankMap = computePageRank(graph, { dampingFactor: 0.85, iterations: 10 });
    const sum = [...rankMap.values()].reduce((a, b) => a + b, 0);
    // Should sum to within floating-point tolerance of 1.0
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it("4. High-connectivity hubs rank above leaf pages", () => {
    const graph = buildGraph(SAMPLE_PAGES);
    const rankMap = computePageRank(graph, { dampingFactor: 0.85, iterations: 10 });

    // / is linked from many pages; /blog/geo-intro (orphan) should have minimal rank
    const homeRank = rankMap.get("/");
    const orphanRank = rankMap.get("/blog/geo-intro");
    expect(homeRank).toBeGreaterThan(orphanRank);

    // /blog should outrank /blog/seo-guide (leaf)
    expect(rankMap.get("/blog")).toBeGreaterThan(rankMap.get("/blog/seo-guide"));
  });
});

// ── Test 5: Orphan detection ──────────────────────────────────────────────────
describe("Orphan detection", () => {
  it("5. Correctly identifies zero-inbound pages as orphans", () => {
    const graph = buildGraph(SAMPLE_PAGES);
    const { orphans } = detectWeakPages(graph, { nearOrphanThreshold: 2 });

    expect(orphans).toContain("/blog/geo-intro");
    // Pages that ARE linked to should NOT appear in orphans
    expect(orphans).not.toContain("/");
    expect(orphans).not.toContain("/blog");
    expect(orphans).not.toContain("/blog/seo-guide");
  });
});

// ── Test 6: Near-orphan detection ─────────────────────────────────────────────
describe("Near-orphan detection", () => {
  it("6. Correctly identifies 1–2 inbound pages as near-orphans", () => {
    const graph = buildGraph(SAMPLE_PAGES);
    const { nearOrphans } = detectWeakPages(graph, { nearOrphanThreshold: 2 });

    // /old-pricing has 1 inbound link (from /sitemap)
    expect(nearOrphans).toContain("/old-pricing");

    // /blog/geo-intro is an orphan (0), not near-orphan
    expect(nearOrphans).not.toContain("/blog/geo-intro");

    // Well-linked pages should not appear
    expect(nearOrphans).not.toContain("/blog");
    expect(nearOrphans).not.toContain("/");
  });
});

// ── Test 7: Relevance matching ────────────────────────────────────────────────
describe("Relevance matching", () => {
  it("7. Tokenisation and Jaccard similarity work correctly", () => {
    // Tokenisation
    const tokens = tokenise("/blog/seo-fundamentals");
    expect(tokens.has("blog")).toBe(true);
    expect(tokens.has("seo")).toBe(true);
    expect(tokens.has("fundamentals")).toBe(true);

    // Same-section siblings should score higher than unrelated pages
    const siblingScore = relevanceScore("/blog/seo-guide", "/blog/seo-tips");
    const unrelatedScore = relevanceScore("/contact", "/blog/seo-tips");
    expect(siblingScore).toBeGreaterThan(unrelatedScore);

    // Identical URLs → maximum similarity
    const selfScore = relevanceScore("/blog/geo-intro", "/blog/geo-intro");
    expect(selfScore).toBeGreaterThan(0.5);

    // Completely disjoint tokens → low score
    const disjointScore = relevanceScore("/contact", "/products/plan-a");
    expect(disjointScore).toBeLessThan(0.3);
  });
});

// ── Test 8: Recommendation output structure ───────────────────────────────────
describe("Recommendation output", () => {
  it("8. Returns correctly shaped and constrained recommendations", () => {
    const graph = buildGraph(SAMPLE_PAGES);
    const rankMap = computePageRank(graph, { dampingFactor: 0.85, iterations: 10 });
    const recs = recommendLinksFor("/blog/geo-intro", graph, rankMap, 3);

    // Must return at most 3 recommendations
    expect(recs.length).toBeLessThanOrEqual(3);
    expect(recs.length).toBeGreaterThan(0);

    for (const rec of recs) {
      // Shape check
      expect(rec).toHaveProperty("sourceUrl");
      expect(rec).toHaveProperty("pageRankScore");
      expect(rec).toHaveProperty("relevanceScore");
      expect(rec).toHaveProperty("reason");

      // Must NOT recommend a page that already links to the orphan
      const alreadyLinksToOrphan = [...(graph.inbound.get("/blog/geo-intro") ?? [])];
      expect(alreadyLinksToOrphan).not.toContain(rec.sourceUrl);

      // Must NOT recommend the page itself
      expect(rec.sourceUrl).not.toBe("/blog/geo-intro");

      // Scores should be non-negative numbers
      expect(typeof rec.pageRankScore).toBe("number");
      expect(rec.pageRankScore).toBeGreaterThanOrEqual(0);
      expect(typeof rec.relevanceScore).toBe("number");
      expect(rec.relevanceScore).toBeGreaterThanOrEqual(0);
    }
  });
});

// ── Bonus: normaliseLink utility ──────────────────────────────────────────────
describe("normaliseLink utility", () => {
  it("Accepts internal paths and rejects external/invalid hrefs", () => {
    expect(normaliseLink("/blog/seo-tips").valid).toBe(true);
    expect(normaliseLink("/page?q=1").normalised).toBe("/page");
    expect(normaliseLink("https://example.com").valid).toBe(false);
    expect(normaliseLink("mailto:hi@example.com").valid).toBe(false);
    expect(normaliseLink("#anchor").valid).toBe(false);
    expect(normaliseLink("").valid).toBe(false);
  });
});
