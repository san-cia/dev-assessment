# Crawl Budget Analyser & Wasted Crawl Detector

## Overview
Search engines allocate a limited crawl budget for each website. If bots spend time crawling low-value or problematic URLs, important pages may not be discovered or updated efficiently.
This module analyzes Googlebot server logs and identifies patterns that waste crawl budget. The output is a structured report listing detected issues, affected URLs, frequency of wasted crawls, and a severity level.
The implementation is written in TypeScript (Node.js) with Jest tests.

## How It Works
### 1. Googlebot Filtering
The first step is filtering log entries to include only Googlebot traffic.  
This is done by checking whether the user-agent string contains googlebot (case-insensitive).
Non-bot traffic (e.g., browsers like Mozilla) is ignored because it does not affect crawl budget.

## Wasted Crawl Patterns Detected
### 1. URL Parameter Duplication
Occurs when the same path is crawled with different query parameters.
Example:
/products?sort=price&page=1  
/products?sort=name&page=1
Search engines may crawl each variation separately even though the content is similar.
Detection logic:
Group logs by path  
Track unique query strings  
If more than one query variant exists → duplication detected
Severity: Medium
### 2. Excessive Pagination
Deep paginated pages are often low-value.
Example:
/blog/page/12  
/blog/page/15
If the page number exceeds a configured pagination depth threshold, it is flagged.
Detection logic:
Match paths with pattern /page/{number}  
Extract page number  
If number > threshold → pagination issue
Severity: Low
### 3. Repeated 4xx Errors
Pages returning 404 or 410 errors multiple times waste crawl budget.
Example:
/old-page → 404  
/old-page → 404
Detection logic:
Track 404 / 410 responses  
Count occurrences per path  
If count exceeds threshold → repeated error detected
Severity: High
### 4. Robots.txt Blocked URLs Crawled
Bots sometimes attempt to crawl URLs blocked in robots.txt.
Example robots rule:
Disallow: /private/
Example log:
/private/internal
Detection logic:
Compare log paths with provided disallowed paths  
If a path starts with a blocked rule → flag it
Severity: High

## Report Structure
The analyzer returns a report containing:
{
  issue: string,
  urls: string[],
  frequency: number,
  severity: "High" | "Medium" | "Low"
}
Report characteristics:
Maximum 10 sample URLs per issue  
Frequency = number of wasted crawl events  
Sorted by highest frequency first
Example output:
[
  {
    "issue": "Repeated 4xx Errors",
    "urls": ["/old-page"],
    "frequency": 12,
    "severity": "High"
  },
  {
    "issue": "URL Parameter Duplication",
    "urls": ["/products"],
    "frequency": 8,
    "severity": "Medium"
  }
]

## Tests
Unit tests are implemented using Jest.
Test coverage includes:
Googlebot filtering  
Parameter duplication detection  
Pagination detection  
Repeated 4xx detection  
Report sorting by frequency

## How to Run
`npm install
Run tests
npm test
Run analyzer
npx ts-node index.ts`

## Additional Data That Could Improve Accuracy
The analysis could be improved with additional SEO signals such as:
### 1. XML Sitemap Data
Helps determine whether crawled URLs are important or unexpected.
### 2. Canonical Tags
Can identify whether parameter URLs already have canonical references.
### 3. Server Response Time
Slow pages may also waste crawl budget.
### 4. Internal Link Structure
Pages heavily linked internally are higher priority for crawling.
### 5. Google Search Console Crawl Stats
Provides real Google crawl behavior including crawl rate and response codes.
Combining log analysis with these sources would allow more accurate crawl-budget optimisation recommendations.
