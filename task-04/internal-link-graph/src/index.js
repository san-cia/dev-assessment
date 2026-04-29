/**
 * index.js
 * CLI entry point — runs the full analysis pipeline on the provided dataset
 * and writes the report to output/report.json.
 *
 * Usage:  node src/index.js [path-to-crawl-data.json]
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { buildGraph } from "./graphBuilder.js";
import { computePageRank } from "./pageRank.js";
import { buildReport } from "./orphanDetector.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load data ─────────────────────────────────────────────────────────────────
const dataPath = process.argv[2] ?? resolve(__dirname, "C:\\devtest\\task-04\\task-04\\task_04_link_graph.json");
let raw;
try {
  raw = JSON.parse(readFileSync(dataPath, "utf8"));
} catch (e) {
  console.error(`Failed to load data from ${dataPath}:`, e.message);
  process.exit(1);
}

const pages = raw.pages ?? raw; // Support both wrapped and bare arrays

// ── Run pipeline ──────────────────────────────────────────────────────────────
const meta = raw._meta ?? {};
const dampingFactor = meta.damping_factor ?? 0.85;
const iterations = meta.pagerank_iterations ?? 10;
const nearOrphanThreshold = meta.near_orphan_threshold ?? 2;

console.log(`\n🔍  Internal Link Graph Analyser`);
console.log(`    Dataset : ${meta.title ?? "custom"}`);
console.log(`    Pages   : ${pages.length}`);
console.log(`    PR opts : d=${dampingFactor}, iter=${iterations}\n`);

const graph = buildGraph(pages);
const rankMap = computePageRank(graph, { dampingFactor, iterations });
const report = buildReport(graph, rankMap, { nearOrphanThreshold });

// ── Print summary ─────────────────────────────────────────────────────────────
console.log(`📊  Summary`);
console.log(`    Total pages    : ${report.totalPages}`);
console.log(`    Orphans        : ${report.summary.orphanCount}`);
console.log(`    Near-orphans   : ${report.summary.nearOrphanCount}`);
console.log(`    Healthy pages  : ${report.summary.healthyCount}`);
console.log(`    PR sum         : ${report.pageRankSum} (should be ≈ 1.0)\n`);

console.log(`🏆  Top 5 pages by PageRank:`);
report.pageRankDistribution.slice(0, 5).forEach(({ url, score }, i) => {
  console.log(`    ${i + 1}. ${url.padEnd(45)} ${score.toFixed(6)}`);
});

console.log(`\n🚨  Orphan pages (${report.orphans.length}):`);
report.orphans.forEach(({ url, recommendations }) => {
  console.log(`    • ${url}`);
  recommendations.forEach((r) => console.log(`        ↳ link from: ${r.sourceUrl}`));
});

console.log(`\n⚠️   Near-orphan pages (${report.nearOrphans.length}):`);
report.nearOrphans.forEach(({ url, inboundCount, recommendations }) => {
  console.log(`    • ${url}  (${inboundCount} inbound link${inboundCount !== 1 ? "s" : ""})`);
  recommendations.slice(0, 2).forEach((r) => console.log(`        ↳ link from: ${r.sourceUrl}`));
});

// ── Write JSON report ─────────────────────────────────────────────────────────
const outDir = resolve(__dirname, "../output");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "report.json");
writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
console.log(`\n✅  Full report written to ${outPath}\n`);

// ── Write HTML report ─────────────────────────────────────────────────────────
import { generateHtml } from "./generateHtml.js";

const htmlPath = resolve(outDir, "report.html");
writeFileSync(htmlPath, generateHtml(report), "utf8");
console.log(`✅  Visual report written to ${htmlPath}\n`);