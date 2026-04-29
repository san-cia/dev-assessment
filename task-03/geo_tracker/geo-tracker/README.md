GEO Prompt Visibility Tracker – Implementation Notes
✅ What I Implemented
1. Entity Detection

I implemented a case-insensitive regex-based matcher for each tracked entity. While doing this, I made sure:

Partial matches are avoided (e.g., Veloxa does not match Veloxaa)
Special characters are handled correctly (e.g., veloxa.io)

For each response, I compute:

Total number of mentions
The index of the first occurrence
2. Position Classification

To understand visibility within a response, I calculate the first mention ratio:

first_index / response_length

Based on this, each mention is classified as:

Early (< 20%)
Mid (20–60%)
Late (≥ 60%)

I chose to use the first occurrence as a proxy for visibility, since earlier mentions are more likely to influence user perception than later ones.

3. Per-Response Breakdown

For every entity–response pair, I store:

mentionCount
firstMentionPosition
firstMentionRatio
A short context snippet (sentence around the first mention)

This makes the output more interpretable instead of just numerical.

4. Aggregate Metrics

For each entity, I compute:

Total mentions across all responses
Number of responses containing the entity
Early / Mid / Late mention counts
Number of unique queries where the entity appears (using Set-based deduplication)
5. Scoring System

I implemented the three required scoring components:

Mention Frequency Score
Early Position Score
Query Breadth Score

Final visibility score is calculated as:

visibility_score =
  (0.5 × frequency) +
  (0.3 × early_position) +
  (0.2 × query_breadth)
6. Query De-duplication

To correctly compute query breadth, I deduplicated queries using a Set.

I also normalized query strings (trim + lowercase) to avoid treating formatting differences as separate queries.

7. Report Formatting

The final output is a structured JSON that includes:

Entity-level metrics
Position breakdown
Queries where the entity appears
Up to 3 sample context snippets

Entities are sorted in descending order of visibility_score for easier comparison.

8. Testing

I validated the implementation using unit tests, edge-case tests, and an integration test on the full dataset.

The tests cover:

Regex correctness
Position classification boundaries
Occurrence counting
Edge cases (e.g., empty responses, no mentions)
Synthetic dataset validation
End-to-end dataset verification
⚠️ Limitations of Text-Match-Based Visibility

This approach works well for structured evaluation, but it has some limitations:

It relies on exact string matching (no semantic understanding)
It cannot detect synonyms or indirect references
Overlapping entity names can still introduce edge cases
It does not capture sentiment or intent
It treats all mentions equally, without considering contextual importance (e.g., headline vs passing reference)
🚀 Possible Improvements

Given more time, I would improve this by:

Using embeddings or semantic search instead of regex
Applying Named Entity Recognition (NER)
Incorporating sentiment and intent analysis
Weighting mentions based on their importance in the response
Using LLM-based evaluation to better assess relevance and visibility