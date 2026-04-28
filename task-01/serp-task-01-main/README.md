# SERP Feature Extraction & Structured Scoring

A TypeScript utility that analyzes **Google SERP (Search Engine Results Page) features** for a given keyword and returns a **competition score** (0–100). The higher the score, the harder it is to earn organic clicks from Google.

---

## Table of Contents

- [What This Project Does](#what-this-project-does)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [How to Run](#how-to-run)
- [How It Works](#how-it-works)
- [Feature Weights](#feature-weights)
- [Running Tests](#running-tests)
- [Example Output](#example-output)

---

## What This Project Does

When you search for something on Google, the results page may include special features like a **Featured Snippet**, a **Local Pack**, **Shopping Ads**, etc. Each of these features pushes organic (non-paid) results further down, making it harder to get clicks.

This tool:

1. Takes a keyword and its detected SERP features as input.
2. Assigns a weight (points) to each detected feature.
3. Sums up those weights into a **competition score** (capped at 100).
4. Returns the score along with the list of detected features and their individual weights.

---

## Prerequisites

Before running this project, make sure the following are installed on your machine:

| Tool        | Version            | Download           |
| ----------- | ------------------ | ------------------ |
| **Node.js** | v18 or higher      | https://nodejs.org |
| **npm**     | Comes with Node.js | —                  |

To verify your installation, open a terminal and run:

```bash
node -v
npm -v
```

Both commands should print a version number without errors.

---

## Getting Started

### 1. Clone or Download the Project

If you have Git installed:

```bash
git clone <repository-url>
cd serp-task-01
```

Or simply download and extract the ZIP from GitHub, then open the folder in your terminal.

### 2. Install Dependencies

Run the following command inside the project folder:

```bash
npm install
```

This installs all the required packages listed in `package.json` (TypeScript, Jest, ts-node, etc.).

---

## Project Structure

```
serp-task-01/
│
├── src/
│   ├── serpScorer.ts       # Core scoring logic — the main function lives here
│   └── runAll.ts           # Script that runs the scorer against all 30 sample SERPs
│
├── tests/
│   └── serpScorer.test.ts  # Unit tests for the scorer
│
├── data/
│   └── task_01_serp_data.json  # 30 sample SERP inputs with expected outputs
│
├── index.html              # Visual UI to try the scorer in a browser
├── package.json            # Project config and scripts
├── tsconfig.json           # TypeScript compiler config
└── jest.config.js          # Jest test runner config
```

---

## How to Run

### Option 1 — Run Against All 30 SERP Samples (Command Line)

This runs the scorer against every sample in `data/task_01_serp_data.json` and prints a pass/fail result for each.

```bash
npx ts-node src/runAll.ts
```

### Option 2 — Open the Visual UI (Browser)

Simply open the `index.html` file in any modern web browser (Chrome, Firefox, Edge):

- Double-click `index.html`, **or**
- Right-click → _Open with_ → your browser

No server is required — it runs entirely in the browser.

---

## How It Works

The core function is `scoreSERP` inside `src/serpScorer.ts`:

```typescript
scoreSERP(input: SerpInput): SerpResult
```

**Input:**

```typescript
{
  keyword: "best running shoes",
  serp_features: {
    featured_snippet: true,
    people_also_ask: true,
    shopping_ads: true,
    local_pack: false
  }
}
```

**Output:**

```typescript
{
  keyword: "best running shoes",
  detected_features: ["featured_snippet", "people_also_ask", "shopping_ads"],
  feature_weights: {
    featured_snippet: 25,
    people_also_ask: 10,
    shopping_ads: 20
  },
  competition_score: 55   // capped at 100
}
```

The function:

1. Loops through all features in the input.
2. Keeps only the ones set to `true`.
3. Looks up each feature's weight from the `FEATURE_WEIGHTS` table.
4. Sums the weights → raw score → capped at **100** to get the final `competition_score`.

---

## Feature Weights

| SERP Feature       | Points |
| ------------------ | ------ |
| `local_pack`       | 30     |
| `featured_snippet` | 25     |
| `knowledge_panel`  | 20     |
| `shopping_ads`     | 20     |
| `video_results`    | 15     |
| `people_also_ask`  | 10     |
| `image_carousel`   | 10     |
| `sitelinks`        | 10     |

> **Score interpretation:**
>
> - **0–30** → Low competition, organic clicks are achievable.
> - **31–60** → Moderate competition, SERP is partially crowded.
> - **61–100** → High competition, organic results are heavily suppressed.

---

## Running Tests

The project uses **Jest** for unit testing. To run all tests:

```bash
npm test
```

This runs the test file at `tests/serpScorer.test.ts`, which covers edge cases like:

- All features present
- No features present
- Score capping at 100
- Unknown/unsupported features being ignored

---

## Example Output

Running `npx ts-node src/runAll.ts` will print something like:

```
✅ serp_001 | "best running shoes"
   Score: got 55, expected 55 ✅
   Features: match ✅

✅ serp_002 | "pizza near me"
   Score: got 60, expected 60 ✅
   Features: match ✅

...

---
✅ ALL 30 SERPs PASSED!
```

If any test fails, it will show `❌` next to that entry with the actual vs. expected values.

---

## Troubleshooting

| Problem                             | Fix                                                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| `command not found: npx`            | Make sure Node.js is installed correctly and added to PATH.                                        |
| `Cannot find module './serpScorer'` | Make sure you're running commands from the project root (`serp-task-01/`), not from inside `src/`. |
| `SyntaxError` or TypeScript errors  | Make sure `npm install` completed successfully so `ts-node` and `typescript` are present.          |
| Tests fail unexpectedly             | Check that `data/task_01_serp_data.json` is not missing or corrupted.                              |
