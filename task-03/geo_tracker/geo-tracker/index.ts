/**
 * index.ts
 *
 * Entry point for the GEO Prompt Visibility Tracker.
 * Runs analysis on the provided dataset and prints a formatted JSON report.
 */

import { analyse, formatReport } from "./src/analyzer";
import data from "./data/task_03_geo_responses.json";

function main() {
  try {
    // Validate input
    if (!data?.ai_responses || !data?._meta?.tracked_entities) {
      throw new Error("Invalid dataset structure");
    }

    console.log("🔍 Running GEO visibility analysis...\n");

    const result = analyse(
      data.ai_responses,
      data._meta.tracked_entities
    );

    const report = formatReport(result);

    // Wrap output with metadata (professional touch)
    const output = {
      generated_at: new Date().toISOString(),
      total_entities: report.length,
      total_responses: result.totalResponses,
      total_queries: result.totalQueries,
      report,
    };

    console.log("✅ Analysis complete.\n");
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    console.error("❌ Error running analysis:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Execute
main();