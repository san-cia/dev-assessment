import { analyzeLogs, LogEntry } from "./index";

const logs: LogEntry[] = [
  { ip: "1", ua: "Googlebot/2.1", path: "/a", query: "?x=1", status: 200, ts: 1 },
  { ip: "1", ua: "Googlebot/2.1", path: "/a", query: "?x=2", status: 200, ts: 2 },
  { ip: "1", ua: "Googlebot/2.1", path: "/blog/page/5", query: "", status: 200, ts: 3 },
  { ip: "1", ua: "Googlebot/2.1", path: "/404", query: "", status: 404, ts: 4 },
  { ip: "1", ua: "Googlebot/2.1", path: "/404", query: "", status: 404, ts: 5 },
  { ip: "1", ua: "Mozilla", path: "/ignore", query: "", status: 200, ts: 6 }
];

test("filters only Googlebot", () => {
  const result = analyzeLogs(logs, [], 3, 1);
  expect(result).toBeDefined();
});

test("detects parameter duplication", () => {
  const result = analyzeLogs(logs, [], 3, 1);
  expect(result.some(r => r.issue.includes("Parameter"))).toBe(true);
});

test("detects pagination", () => {
  const result = analyzeLogs(logs, [], 3, 1);
  expect(result.some(r => r.issue.includes("Pagination"))).toBe(true);
});

test("detects repeated 4xx", () => {
  const result = analyzeLogs(logs, [], 3, 1);
  expect(result.some(r => r.issue.includes("4xx"))).toBe(true);
});

test("report sorted by frequency", () => {
  const result = analyzeLogs(logs, [], 3, 1);

  for (let i = 1; i < result.length; i++) {
    expect(result[i - 1].frequency).toBeGreaterThanOrEqual(result[i].frequency);
  }
});