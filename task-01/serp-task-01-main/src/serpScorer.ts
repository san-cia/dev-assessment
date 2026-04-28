const FEATURE_WEIGHTS = {
  featured_snippet: 25,
  people_also_ask: 10,
  local_pack: 30,
  image_carousel: 10,
  video_results: 15,
  knowledge_panel: 20,
  shopping_ads: 20,
  sitelinks: 10
}

type SerpFeatures = { [key: string]: boolean }
type SerpInput = { keyword: string; serp_features: SerpFeatures }
type SerpResult = {
  keyword: string
  detected_features: string[]
  feature_weights: { [key: string]: number }
  competition_score: number
}

export function scoreSERP(input: SerpInput): SerpResult {
  const detected_features: string[] = []
  const feature_weights: { [key: string]: number } = {}

  for (const feature in input.serp_features) {
    if (input.serp_features[feature] === true) {
      if (FEATURE_WEIGHTS[feature as keyof typeof FEATURE_WEIGHTS] !== undefined) {
        detected_features.push(feature)
        feature_weights[feature] = FEATURE_WEIGHTS[feature as keyof typeof FEATURE_WEIGHTS]
      }
    }
  }

  const raw_score = detected_features.reduce((total, f) => {
    return total + (FEATURE_WEIGHTS[f as keyof typeof FEATURE_WEIGHTS] || 0)
  }, 0)

  const competition_score = Math.min(raw_score, 100)

  return { keyword: input.keyword, detected_features, feature_weights, competition_score }
}