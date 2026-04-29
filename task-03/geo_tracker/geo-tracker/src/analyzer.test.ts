/**
 * analyzer.test.ts
 *
 * Unit tests for the GEO Visibility Analyser.
 * Run with:  npx vitest run
 *
 * Tests are grouped by concern:
 *  1. Helper utilities (regex building, position classification, counting)
 *  2. Entity isolation (Veloxa ≠ Veloxa Pro, etc.)
 *  3. Score formulas on small synthetic datasets
 *  4. Full integration test against the real task_03 dataset
 */

import { describe, it, expect } from "vitest";
import {
  analyse,
  buildEntityRegex,
  classifyPosition,
  countOccurrences,
  firstOccurrenceIndex,
} from "./analyzer.js";
import type { AIResponse } from "./types";
import rawData from "../data/task_03_geo_responses.json";

// ─── 1. Helper utilities ──────────────────────────────────────────────────────

describe("buildEntityRegex", () => {
  it("matches the entity case-insensitively", () => {
    const re = buildEntityRegex("Veloxa");
    expect("veloxa".match(re)).toBeTruthy();
    expect("VELOXA".match(re)).toBeTruthy();
    expect("Veloxa".match(re)).toBeTruthy();
  });
  it("matches 'Veloxa' inside 'Veloxa Pro' (overlap allowed)", () => {
  // Build regexes for both entities
  const reVeloxa = buildEntityRegex("Veloxa");
  const reVeloxaPro = buildEntityRegex("Veloxa Pro");

  // Sample text containing the product name
  const text = "Check out Veloxa Pro for more features.";

  // IMPORTANT:
  // We intentionally allow overlap between entities.
  // "Veloxa" will match inside "Veloxa Pro" and "veloxa.io"
  // and product-level mentions are both counted independently.
  //
  // This means:
  // - "Veloxa" should match (brand-level mention)
  // - "Veloxa Pro" should also match (product-level mention)

  expect(text.match(reVeloxa)).toBeTruthy();    // Brand match inside product name
  expect(text.match(reVeloxaPro)).toBeTruthy(); // Full product name match
  });
  it("does NOT match partial words", () => {
  const re = buildEntityRegex("Veloxa");

  expect("Veloxaa is different".match(re)).toBeNull();
  expect("SuperVeloxaTool".match(re)).toBeNull();
  });
  it("uses first occurrence when multiple mentions exist", () => {
  const re = buildEntityRegex("Veloxa");
  const text = "Veloxa early... something... Veloxa later";

  expect(countOccurrences(text, re)).toBe(2);
  expect(firstOccurrenceIndex(text, re)).toBe(0);
  });

  it("escapes special regex characters in veloxa.io", () => {
    const re = buildEntityRegex("veloxa.io");
    // Should NOT match "veloxaXio" (dot escaped)
    expect("veloxaXio is not the same".match(re)).toBeNull();
    // SHOULD match the real domain
    expect("go to veloxa.io now".match(re)).toBeTruthy();
  });
});

describe("classifyPosition", () => {
  it("returns 'early' for ratio < 0.2", () => {
    expect(classifyPosition(0)).toBe("early");
    expect(classifyPosition(0.19)).toBe("early");
  });
  it("returns 'mid' for 0.2 ≤ ratio < 0.6", () => {
    expect(classifyPosition(0.2)).toBe("mid");
    expect(classifyPosition(0.5)).toBe("mid");
    expect(classifyPosition(0.599)).toBe("mid");
  });
  it("returns 'late' for ratio ≥ 0.6", () => {
    expect(classifyPosition(0.6)).toBe("late");
    expect(classifyPosition(1.0)).toBe("late");
  });
  it("handles boundary values precisely", () => {
  expect(classifyPosition(0.1999)).toBe("early");
  expect(classifyPosition(0.2)).toBe("mid");
  expect(classifyPosition(0.5999)).toBe("mid");
  expect(classifyPosition(0.6)).toBe("late");
  });
});

describe("countOccurrences", () => {
  it("counts multiple occurrences", () => {
    const re = buildEntityRegex("Veloxa");
    expect(countOccurrences("Veloxa is great. VELOXA is fast.", re)).toBe(2);
  });
  it("returns 0 when entity absent", () => {
    const re = buildEntityRegex("Veloxa");
    expect(countOccurrences("No brand mentioned here.", re)).toBe(0);
  });
});

describe("firstOccurrenceIndex", () => {
  it("returns correct index of first match", () => {
    const re = buildEntityRegex("Veloxa");
    // "Hello Veloxa" → index 6
    expect(firstOccurrenceIndex("Hello Veloxa world", re)).toBe(6);
  });
  it("returns -1 when not found", () => {
    const re = buildEntityRegex("Veloxa");
    expect(firstOccurrenceIndex("Nothing here", re)).toBe(-1);
  });
});

// ─── 2. Score formula correctness on synthetic data ───────────────────────────

describe("score formulas — synthetic dataset", () => {
  /**
   * Synthetic dataset: 4 responses, 4 unique queries.
   * Entity "BrandX" appears in responses 1, 2, 3 (not 4).
   *  - resp1: "BrandX is great"        → early (ratio ≈ 0)
   *  - resp2: "We love BrandX midway"  → early-ish; depends on text length
   *  - resp3: ends with "BrandX"       → late
   *  - resp4: no mention
   */
  const syntheticResponses: AIResponse[] = [
    {
      id: "s1",
      query: "query alpha",
      model: "test",
      response: "BrandX is leading the market in innovation.",
    },
    {
      id: "s2",
      query: "query beta",
      model: "test",
      // ~50 chars before the mention → ratio depends on full length
      response: "There are many options. We often recommend BrandX.",
    },
    {
      id: "s3",
      query: "query gamma",
      model: "test",
      // mention is at the very end → late
      response:
        "Many tools exist in the market. For analytics needs you should use BrandX.",
    },
    {
      id: "s4",
      query: "query delta",
      model: "test",
      response: "No brand is mentioned in this response at all.",
    },
  ];

  const result = analyse(syntheticResponses, ["BrandX"]);
  const stats = result.entities[0];

  it("counts total responses correctly", () => {
    expect(result.totalResponses).toBe(4);
  });

  it("counts total unique queries correctly", () => {
    expect(result.totalQueries).toBe(4);
  });

  it("counts responsesWithMention correctly", () => {
    expect(stats.responsesWithMention).toBe(3);
  });

  it("counts totalMentions correctly", () => {
    // Each of the 3 matching responses has exactly 1 mention
    expect(stats.totalMentions).toBe(3);
  });

  it("computes mentionFrequencyScore correctly", () => {
    // min((3 / 4) * 100, 100) = 75
    expect(stats.mentionFrequencyScore).toBeCloseTo(75, 1);
  });

  it("computes queryBreadthScore correctly", () => {
    // 3 unique queries with mention / 4 total unique queries * 100 = 75
    expect(stats.queryBreadthScore).toBeCloseTo(75, 1);
  });

  it("computes visibilityScore using the correct weights", () => {
    // visibility = (freq * 0.5) + (early * 0.3) + (breadth * 0.2)
    const expected =
      stats.mentionFrequencyScore * 0.5 +
      stats.earlyPositionScore * 0.3 +
      stats.queryBreadthScore * 0.2;
    expect(stats.visibilityScore).toBeCloseTo(expected, 1);
  });

  it("marks response s4 with position 'none'", () => {
    const s4 = stats.breakdown.find((b) => b.responseId === "s4")!;
    expect(s4.firstMentionPosition).toBe("none");
    expect(s4.mentionCount).toBe(0);
  });
});

// ─── 3. Edge cases ────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("handles an entity that never appears — scores all zero", () => {
    const responses: AIResponse[] = [
      { id: "e1", query: "q1", model: "test", response: "Nothing relevant." },
    ];
    const result = analyse(responses, ["GhostBrand"]);
    const stats = result.entities[0];
    expect(stats.totalMentions).toBe(0);
    expect(stats.responsesWithMention).toBe(0);
    expect(stats.mentionFrequencyScore).toBe(0);
    expect(stats.earlyPositionScore).toBe(0);
    expect(stats.queryBreadthScore).toBe(0);
    expect(stats.visibilityScore).toBe(0);
  });

  it("caps mentionFrequencyScore at 100", () => {
    // 5 responses, entity appears 6 times in each → total = 30 > total_responses
    const responses: AIResponse[] = Array.from({ length: 5 }, (_, i) => ({
      id: `cap${i}`,
      query: `q${i}`,
      model: "test",
      response: "BrandY BrandY BrandY BrandY BrandY BrandY",
    }));
    const result = analyse(responses, ["BrandY"]);
    expect(result.entities[0].mentionFrequencyScore).toBe(100);
  });

  it("de-duplicates queries with the same string", () => {
    // Two responses share the same query string → totalQueries = 1
    const responses: AIResponse[] = [
      { id: "dup1", query: "same query", model: "test", response: "BrandZ is here." },
      { id: "dup2", query: "same query", model: "test", response: "No mention." },
    ];
    const result = analyse(responses, ["BrandZ"]);
    expect(result.totalQueries).toBe(1);
  });
  it("handles empty response safely", () => {
  const responses: AIResponse[] = [
    { id: "e1", query: "q1", model: "test", response: "" },
  ];

  const result = analyse(responses, ["Veloxa"]);
  expect(result.entities[0].totalMentions).toBe(0);
  });
});

// ─── 4. Integration test — real task_03 dataset ───────────────────────────────

describe("integration — task_03_geo_responses.json", () => {
  const data = rawData as {
    _meta: { tracked_entities: string[] };
    ai_responses: AIResponse[];
  };

  const result = analyse(data.ai_responses, data._meta.tracked_entities);

  it("processes all 20 responses", () => {
    expect(result.totalResponses).toBe(20);
  });

  it("produces an EntityStats object for each tracked entity", () => {
    expect(result.entities).toHaveLength(3);
    const names = result.entities.map((e) => e.entity);
    expect(names).toContain("Veloxa");
    expect(names).toContain("veloxa.io");
    expect(names).toContain("Veloxa Pro");
  });

  it("Veloxa appears in more than half the responses", () => {
    const veloxa = result.entities.find((e) => e.entity === "Veloxa")!;
    expect(veloxa.responsesWithMention).toBeGreaterThan(10);
  });

  it("all visibility scores are between 0 and 100", () => {
    for (const e of result.entities) {
      expect(e.visibilityScore).toBeGreaterThanOrEqual(0);
      expect(e.visibilityScore).toBeLessThanOrEqual(100);
    }
  });

  it("breakdown length equals totalResponses for each entity", () => {
    for (const e of result.entities) {
      expect(e.breakdown).toHaveLength(result.totalResponses);
    }
  });

  it("sum of early+mid+late+none equals totalResponses for each entity", () => {
    for (const e of result.entities) {
      const noneCount = e.breakdown.filter(
        (b) => b.firstMentionPosition === "none"
      ).length;
      expect(
        e.earlyMentionCount + e.midMentionCount + e.lateMentionCount + noneCount
      ).toBe(result.totalResponses);
    }
  });
});