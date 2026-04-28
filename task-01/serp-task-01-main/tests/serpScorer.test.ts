import { scoreSERP } from '../src/serpScorer'

// ✅ Test 1: Correct feature detection
test('detects correct features', () => {
  const result = scoreSERP({
    keyword: 'best running shoes',
    serp_features: {
      featured_snippet: true,
      people_also_ask: true,
      local_pack: false,
      image_carousel: true,
      video_results: false,
      knowledge_panel: false,
      shopping_ads: true,
      sitelinks: false
    }
  })
  expect(result.detected_features).toEqual(
    ['featured_snippet', 'people_also_ask', 'image_carousel', 'shopping_ads']
  )
})

// ✅ Test 2: Correct score calculation
test('calculates score correctly', () => {
  const result = scoreSERP({
    keyword: 'best running shoes',
    serp_features: {
      featured_snippet: true,  // 25
      people_also_ask: true,   // 10
      local_pack: false,
      image_carousel: true,    // 10
      video_results: false,
      knowledge_panel: false,
      shopping_ads: true,      // 20
      sitelinks: false
    }
  })
  expect(result.competition_score).toBe(65) // 25+10+10+20
})

// ✅ Test 3: Score is capped at 100
test('score never goes above 100', () => {
  const result = scoreSERP({
    keyword: 'all features on',
    serp_features: {
      featured_snippet: true,   // 25
      people_also_ask: true,    // 10
      local_pack: true,         // 30
      image_carousel: true,     // 10
      video_results: true,      // 15
      knowledge_panel: true,    // 20
      shopping_ads: true,       // 20
      sitelinks: true           // 10  → total = 140, capped at 100
    }
  })
  expect(result.competition_score).toBe(100)
})

// ✅ Test 4: Empty SERP → score is 0
test('returns 0 when no features are present', () => {
  const result = scoreSERP({
    keyword: 'empty serp',
    serp_features: {
      featured_snippet: false,
      people_also_ask: false,
      local_pack: false,
      image_carousel: false,
      video_results: false,
      knowledge_panel: false,
      shopping_ads: false,
      sitelinks: false
    }
  })
  expect(result.competition_score).toBe(0)
  expect(result.detected_features).toEqual([])
})

// ✅ Test 5: Only some features present
test('handles partial features correctly', () => {
  const result = scoreSERP({
    keyword: 'partial test',
    serp_features: {
      featured_snippet: false,
      people_also_ask: false,
      local_pack: true,   // 30
      image_carousel: false,
      video_results: false,
      knowledge_panel: false,
      shopping_ads: false,
      sitelinks: true     // 10 → total = 40
    }
  })
  expect(result.competition_score).toBe(40)
})

// ✅ Test 6: Output has correct structure
test('output has correct structure', () => {
  const result = scoreSERP({
    keyword: 'structure test',
    serp_features: {
      featured_snippet: true,
      people_also_ask: false,
      local_pack: false,
      image_carousel: false,
      video_results: false,
      knowledge_panel: false,
      shopping_ads: false,
      sitelinks: false
    }
  })
  expect(result).toHaveProperty('keyword')
  expect(result).toHaveProperty('detected_features')
  expect(result).toHaveProperty('feature_weights')
  expect(result).toHaveProperty('competition_score')
  expect(Array.isArray(result.detected_features)).toBe(true)
})