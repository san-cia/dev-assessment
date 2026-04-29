// ─── Raw JSON shape ───────────────────────────────────────────────────────────

export interface AIResponse {
  id: string;
  query: string;
  model: string;
  response: string;
}

export interface GeoDataFile {
  _meta: {
    task: string;
    title: string;
    description: string;
    tracked_entities: string[];
    notes: string[];
  };
  competitors: string[];
  ai_responses: AIResponse[];
}

// ─── Per-response analysis ────────────────────────────────────────────────────

/** Where the FIRST mention of an entity falls within a response */
export type MentionPosition = "early" | "mid" | "late" | "none";

export interface ResponseMentionDetail {
  responseId: string;
  query: string;
  mentionCount: number;          // total occurrences of this entity in this response
  firstMentionPosition: MentionPosition;
  firstMentionRatio: number | null; // 0–1; null when entity not present
  context?: string;           
}

// ─── Per-entity aggregate stats ───────────────────────────────────────────────

export interface EntityStats {
  entity: string;

  // Raw counts
  totalMentions: number;            // all occurrences across all responses
  responsesWithMention: number;     // how many responses contain at least one mention
  earlyMentionCount: number;        // responses where first mention is "early"
  midMentionCount: number;
  lateMentionCount: number;
  uniqueQueriesWithMention: number; // distinct query strings that yielded a mention

  // Intermediate scores (0–100)
  mentionFrequencyScore: number;
  earlyPositionScore: number;
  queryBreadthScore: number;

  // Final weighted score (0–100)
  visibilityScore: number;

  // Per-response breakdown (useful for the UI)
  breakdown: ResponseMentionDetail[];
}

// ─── Full analysis result ─────────────────────────────────────────────────────

export interface AnalysisResult {
  totalResponses: number;
  totalQueries: number;   // unique query strings
  entities: EntityStats[];
}