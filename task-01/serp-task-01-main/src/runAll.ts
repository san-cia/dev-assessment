import { scoreSERP } from './serpScorer'
import * as fs from 'fs'

const data = JSON.parse(fs.readFileSync('./data/task_01_serp_data.json', 'utf-8'))

let allPassed = true

data.serps.forEach((serp: any) => {
  const result = scoreSERP({
    keyword: serp.keyword,
    serp_features: serp.serp_features
  })

  const expectedScore = serp.expected_output.competition_score
  const expectedFeatures = serp.expected_output.detected_features
  const scorePassed = result.competition_score === expectedScore
  const featuresPassed = JSON.stringify(result.detected_features) === JSON.stringify(expectedFeatures)
  const passed = scorePassed && featuresPassed

  if (!passed) allPassed = false

  console.log(`${passed ? '✅' : '❌'} ${serp.id} | "${serp.keyword}"`)
  console.log(`   Score: got ${result.competition_score}, expected ${expectedScore} ${scorePassed ? '✅' : '❌'}`)
  console.log(`   Features: ${passed ? 'match ✅' : 'mismatch ❌'}`)
})

console.log('\n---')
console.log(allPassed ? '✅ ALL 30 SERPs PASSED!' : '❌ Some SERPs failed — check above')