/**
 * analyzer.ts
 *
 * Core logic for the GEO Prompt Visibility Tracker.
 *
 * ASSUMPTIONS (documented):
 *  A. "total_mentions" in the frequency score counts every occurrence of the
 *     entity across every response, not just responses that contain it.
 *     This matches the formula: total_mentions / total_responses.
 *
 *  B. "total_queries" in the breadth score = number of UNIQUE query strings in
 *     the dataset (17 here), not total responses (20).  Two responses can share
 *     the same query — we de-duplicate.
 *
 *  C. Position ratio is computed over the full response string (character-level).
 *     The first match of ANY variant of the entity name is used (e.g. searching
 *     for "Veloxa" also catches "veloxa.io" and "Veloxa Pro", so we search for
 *     each variant of the entity separately and take the earliest hit).
 *
 *  D. The three tracked entities are treated INDEPENDENTLY:
 *       "Veloxa"     – matches "veloxa" but NOT "veloxa.io" or "veloxa pro"
 *                      (we strip trailing matches to avoid double-counting)
 *       "veloxa.io"  – matches the domain form
 *       "Veloxa Pro" – matches the product name
 *     Concretely: we match the entity string as a whole word / phrase using a
 *     regex that requires a word-boundary (or non-word char) on each side.
 *     This prevents "Veloxa" from matching inside "Veloxa Pro" or "veloxa.io".
 */

import type {
  AIResponse,
  AnalysisResult,
  EntityStats,
  MentionPosition,
  ResponseMentionDetail,
} from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a regex that matches `entity` as a standalone phrase (case-insensitive).
 * For "veloxa.io" we escape the dot; for multi-word phrases word boundaries work
 * naturally; for single words we add \b boundaries.
 */
function buildEntityRegex(entity: string): RegExp {
  const escaped = entity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Use word-boundary anchors.  "veloxa\.io" already has a dot which acts as a
  // delimiter, but \b is still correct at the start.
  return new RegExp(`\\b${escaped}\\b`, "gi");
}

/**
 * Count all non-overlapping case-insensitive occurrences of `entity` in `text`.
 */
function countOccurrences(text: string, regex: RegExp): number {
  // Reset lastIndex because we reuse regexes across calls (global flag).
  regex.lastIndex = 0;
  return (text.match(regex) ?? []).length;
}

/**
 * Find the character index of the FIRST occurrence of `entity` in `text`.
 * Returns -1 if not found.
 */
function firstOccurrenceIndex(text: string, regex: RegExp): number {
  regex.lastIndex = 0;
  const match = regex.exec(text);
  return match ? match.index : -1;
}

/**
 * Classify a position ratio (0–1) into early / mid / late.
 * Thresholds from the spec: <20 % = early, 20–60 % = mid, ≥60 % = late.
 */
function classifyPosition(ratio: number): MentionPosition {
  if (ratio < 0.2) return "early";
  if (ratio < 0.6) return "mid";
  return "late";
}
/**
 * Extract a simple sentence-level context around the first mention.
 * Splits text into sentences and returns the one containing the match.
 */
function extractContext(text: string, index: number): string {
  if (index < 0) return "";

  const sentences = text.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    if (sentence.includes(text.slice(index, index + 10))) {
      return sentence.trim();
    }
  }

  return text.slice(Math.max(0, index - 30), index + 30).trim();
}

// ─── Main analyser ────────────────────────────────────────────────────────────

/**
 * Analyse all AI responses for a single tracked entity.
 */
function analyseEntity(
  entity: string,
  responses: AIResponse[],
  totalResponses: number,
  totalQueries: number
): EntityStats {
  const regex = buildEntityRegex(entity);

  let totalMentions = 0;
  let responsesWithMention = 0;
  let earlyMentionCount = 0;
  let midMentionCount = 0;
  let lateMentionCount = 0;
  const queriesWithMention = new Set<string>();

  const breakdown: ResponseMentionDetail[] = [];

  for (const r of responses) {
    const text = r.response;
    const count = countOccurrences(text, regex);
    totalMentions += count;

    if (count === 0) {
      breakdown.push({
        responseId: r.id,
        query: r.query,
        mentionCount: 0,
        firstMentionPosition: "none",
        firstMentionRatio: null,
      });
      continue;
    }

    // Entity is present in this response.
    responsesWithMention++;
    queriesWithMention.add(r.query);

    const firstIdx = firstOccurrenceIndex(text, regex);
    if (firstIdx === -1) {
        throw new Error("Expected to find entity but none found");
    }
    const ratio = text.length > 0 ? firstIdx / text.length : 0;
    const position = classifyPosition(ratio);

    if (position === "early") earlyMentionCount++;
    else if (position === "mid") midMentionCount++;
    else lateMentionCount++;

    breakdown.push({
        responseId: r.id,
        query: r.query,
        mentionCount: count,
        firstMentionPosition: position,
        firstMentionRatio: parseFloat(ratio.toFixed(4)),
        context: extractContext(text, firstIdx),
    });
  }

  // ── Score calculation ──────────────────────────────────────────────────────

  // mention_frequency_score = min((total_mentions / total_responses) * 100, 100)
  const mentionFrequencyScore = Math.min(
    (totalMentions / totalResponses) * 100,
    100
  );

  // early_position_score = (early_mention_count / responses_with_mention) * 100
  // Guard against division-by-zero when entity never appears.
  const earlyPositionScore =
    responsesWithMention > 0
      ? (earlyMentionCount / responsesWithMention) * 100
      : 0;

  // query_breadth_score = (unique_queries_with_mention / total_queries) * 100
  const queryBreadthScore =
    (queriesWithMention.size / totalQueries) * 100;

  // visibility_score = (freq * 0.5) + (early * 0.3) + (breadth * 0.2)
  const visibilityScore =
    mentionFrequencyScore * 0.5 +
    earlyPositionScore * 0.3 +
    queryBreadthScore * 0.2;

  return {
    entity,
    totalMentions,
    responsesWithMention,
    earlyMentionCount,
    midMentionCount,
    lateMentionCount,
    uniqueQueriesWithMention: queriesWithMention.size,
    mentionFrequencyScore: parseFloat(mentionFrequencyScore.toFixed(2)),
    earlyPositionScore: parseFloat(earlyPositionScore.toFixed(2)),
    queryBreadthScore: parseFloat(queryBreadthScore.toFixed(2)),
    visibilityScore: parseFloat(visibilityScore.toFixed(2)),
    breakdown,
  };
}

/**
 * Run the full analysis over the dataset.
 *
 * @param responses   The `ai_responses` array from the JSON file.
 * @param entities    The `tracked_entities` array from `_meta`.
 */
export function analyse(
  responses: AIResponse[],
  entities: string[]
): AnalysisResult {
  const totalResponses = responses.length;

  // Unique queries (assumption B above).
    const uniqueQueries = new Set(responses.map((r) => r.query));
    const totalQueries = uniqueQueries.size;

  const entityStats = entities.map((entity) =>
    analyseEntity(entity, responses, totalResponses, totalQueries)
  );

  return {
    totalResponses,
    totalQueries,
    entities: entityStats,
  };
}

// ─── Exported helpers (useful in tests) ───────────────────────────────────────
export { buildEntityRegex, classifyPosition, countOccurrences, firstOccurrenceIndex };
export function formatReport(result: AnalysisResult) {
  return result.entities
    .map((e) => ({
      entity: e.entity,
      total_mentions: e.totalMentions,
      responses_with_mentions: e.responsesWithMention,

      queries_with_mention: [
        ...new Set(
          e.breakdown
            .filter((b) => b.mentionCount > 0)
            .map((b) => b.query)
        ),
      ],

      position_breakdown: {
        early: e.earlyMentionCount,
        mid: e.midMentionCount,
        late: e.lateMentionCount,
      },

      sample_contexts: e.breakdown
        .filter((b) => b.mentionCount > 0)
        .slice(0, 3)
        .map((b) => b.context || ""),

      visibility_score: Number(e.visibilityScore.toFixed(2)),
    }))
    .sort((a, b) => b.visibility_score - a.visibility_score);
}