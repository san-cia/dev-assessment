import data from "./data.json";

export type LogEntry = {
  ip: string;
  ua: string;
  path: string;
  query: string;
  status: number;
  ts: string | number;
};

export function analyzeLogs(
  logs: LogEntry[],
  disallowedPaths: string[],
  paginationThreshold: number,
  repeated4xxThreshold: number
) {
  // ✅ 1. Filter Googlebot
  const googlebotLogs = logs.filter(log =>
    log.ua.toLowerCase().includes("googlebot")
  );

  // ✅ 2. URL Parameter Duplication
  const paramMap: Record<string, Set<string>> = {};

  googlebotLogs.forEach(log => {
    if (!paramMap[log.path]) {
      paramMap[log.path] = new Set();
    }
    paramMap[log.path].add(log.query);
  });

  const duplicateParams: any[] = [];

  for (const path in paramMap) {
    if (paramMap[path].size > 1) {
      duplicateParams.push({
        path,
        queries: Array.from(paramMap[path]),
        frequency: paramMap[path].size
      });
    }
  }

  // ✅ 3. Pagination
  const paginationIssues: any[] = [];

  googlebotLogs.forEach(log => {
    const match = log.path.match(/\/page\/(\d+)/);

    if (match) {
      const pageNumber = parseInt(match[1]);

      if (pageNumber > paginationThreshold) {
        paginationIssues.push({
          url: log.path,
          page: pageNumber
        });
      }
    }
  });

  // ✅ 4. Repeated 4xx
  const errorMap: Record<string, number> = {};

  googlebotLogs.forEach(log => {
    if (log.status === 404 || log.status === 410) {
      if (!errorMap[log.path]) {
        errorMap[log.path] = 0;
      }
      errorMap[log.path]++;
    }
  });

  const repeatedErrors: any[] = [];

  for (const path in errorMap) {
    if (errorMap[path] > repeated4xxThreshold) {
      repeatedErrors.push({
        url: path,
        frequency: errorMap[path]
      });
    }
  }

  // ✅ 5. Robots.txt blocked
  const blockedCrawls: any[] = [];

  googlebotLogs.forEach(log => {
    for (const blockedPath of disallowedPaths) {
      if (log.path.startsWith(blockedPath)) {
        blockedCrawls.push({
          url: log.path,
          blockedRule: blockedPath
        });
      }
    }
  });

  // ✅ 6. Report
  const report: any[] = [];

  if (duplicateParams.length > 0) {
    report.push({
      issue: "URL Parameter Duplication",
      urls: duplicateParams.slice(0, 10).map(d => d.path),
      frequency: duplicateParams.reduce((sum, d) => sum + d.frequency, 0),
      severity: "Medium"
    });
  }

  if (paginationIssues.length > 0) {
    report.push({
      issue: "Excessive Pagination",
      urls: paginationIssues.slice(0, 10).map(p => p.url),
      frequency: paginationIssues.length,
      severity: "Low"
    });
  }

  if (repeatedErrors.length > 0) {
    report.push({
      issue: "Repeated 4xx Errors",
      urls: repeatedErrors.slice(0, 10).map(e => e.url),
      frequency: repeatedErrors.reduce((sum, e) => sum + e.frequency, 0),
      severity: "High"
    });
  }

  if (blockedCrawls.length > 0) {
    report.push({
      issue: "Robots.txt Blocked URLs Crawled",
      urls: blockedCrawls.slice(0, 10).map(b => b.url),
      frequency: blockedCrawls.length,
      severity: "High"
    });
  }

  // ✅ 7. Sort
  report.sort((a, b) => b.frequency - a.frequency);

  return report;
}

// ✅ RUN using dataset
const result = analyzeLogs(
  data.log_entries,
  data._meta.disallowed_paths,
  data._meta.pagination_depth_threshold,
  data._meta.repeated_4xx_threshold
);

console.log(JSON.stringify(result, null, 2));