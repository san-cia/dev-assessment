/**
 * generateHtml.js
 * Produces a self-contained report.html. Uses React.createElement (no JSX/Babel)
 * and a hand-rolled SVG bar chart (no Recharts) so there are zero fragile
 * runtime-compilation or CDN-naming dependencies.
 *
 * @param {Object} report - The AnalysisReport object from buildReport()
 * @returns {string}      - Full HTML string ready to write to disk
 */
export function generateHtml(report) {
  const reportJson = JSON.stringify(report);

  const appScript = `
const { useState } = React;
const REPORT = window.__REPORT__;
const e = React.createElement;

const maxScore = Math.max(...REPORT.pageRankDistribution.map(d => d.score));

function ScoreBar({ score, color }) {
  const pct = (score / maxScore) * 100;
  return e("div", { style: { display:"flex", alignItems:"center", gap:8 } },
    e("div", { style: { flex:1, height:6, background:"#1e1e2e", borderRadius:3, overflow:"hidden" } },
      e("div", { style: { width:pct+"%", height:"100%", background:color||"#f97316", borderRadius:3 } })
    ),
    e("span", { style: {fontSize:11, color:"#9ca3af", minWidth:58 } },
      score.toFixed(6)
    )
  );
}

function PageRow({ page, rank, isExpanded, onToggle, type }) {
  const accent = type === "orphan" ? "#ef4444" : "#f59e0b";
  const bgAccent = type === "orphan" ? "rgba(239,68,68,0.06)" : "rgba(245,158,11,0.06)";
  return e("div", {
    style: { borderRadius:8, border:"1px solid "+(isExpanded ? accent : "#2a2a3d"),
             background:isExpanded ? bgAccent : "transparent", marginBottom:6, overflow:"hidden" }
  },
    e("button", {
      onClick: onToggle,
      style: { width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 14px",
               background:"transparent", border:"none", cursor:"pointer" }
    },
      e("span", { style: { width:8, height:8, borderRadius:"50%", background:accent,
                           flexShrink:0, boxShadow:"0 0 6px "+accent } }),
      e("span", { style: { fontFamily:"monospace", fontSize:12, color:"#e2e8f0", flex:1, textAlign:"left" } }, page.url),
      e("span", { style: { fontFamily:"monospace", fontSize:10, color:"#6b7280", marginRight:8 } },
        rank !== undefined ? "PR "+rank.toFixed(6) : page.inboundCount+" inbound"
      ),
      e("span", { style: { color:"#6b7280", fontSize:12, display:"inline-block",
                           transform:isExpanded ? "rotate(180deg)" : "none" } }, "\\u25be")
    ),
    isExpanded && e("div", { style: { padding:"0 14px 12px 32px" } },
      e("p", { style: { fontSize:11, color:"#6b7280", margin:"0 0 8px", fontFamily:"monospace" } },
        "\\u2014 RECOMMENDED LINK SOURCES \\u2014"
      ),
      ...page.recommendations.map((rec, i) =>
        e("div", { key:i, style: { display:"flex", alignItems:"flex-start", gap:10, padding:"8px 10px",
                                   background:"#0f0f1a", borderRadius:6, marginBottom:4,
                                   border:"1px solid #1e1e2e" } },
          e("span", { style: { fontSize:10, color:accent, fontFamily:"monospace", minWidth:14, marginTop:2 } }, (i+1)+"."),
          e("div", { style: { flex:1 } },
            e("div", { style: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 } },
              e("span", { style: { fontFamily:"monospace", fontSize:12, color:"#60a5fa" } }, rec.sourceUrl),
              e("div", { style: { display:"flex", gap:8 } },
                e("span", { style: { fontSize:10, color:"#34d399", fontFamily:"monospace" } }, "PR "+rec.pageRankScore.toFixed(5)),
                e("span", { style: { fontSize:10, color:"#a78bfa", fontFamily:"monospace" } }, "REL "+rec.relevanceScore.toFixed(3))
              )
            ),
            e("p", { style: { margin:0, fontSize:10, color:"#6b7280", lineHeight:1.5 } }, rec.reason)
          )
        )
      )
    )
  );
}

function SvgBarChart({ data }) {
  const [hovered, setHovered] = useState(null);
  const W = 680, H = 200, pad = { top:10, right:10, bottom:58, left:48 };
  const cW = W - pad.left - pad.right;
  const cH = H - pad.top - pad.bottom;
  const bW = Math.max(2, Math.floor(cW / data.length) - 2);
  const yMax = data[0].score;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => yMax * f);
  const barColor = i => i < 3 ? "#f97316" : i < 8 ? "#fb923c" : "#7c3aed";
  const barOp   = i => i < 3 ? 1 : i < 8 ? 0.8 : 0.5;

  return e("div", { style:{ position:"relative" } },
    e("svg", { width:"100%", viewBox:"0 0 "+W+" "+H, style:{ overflow:"visible" } },
      ...ticks.map((t, i) => {
        const y = pad.top + cH - (t / yMax) * cH;
        return e("g", { key:i },
          e("line", { x1:pad.left, x2:pad.left+cW, y1:y, y2:y, stroke:"#1e1e2e", strokeWidth:1 }),
          e("text", { x:pad.left-6, y:y+4, fill:"#6b7280", fontSize:9,
                      textAnchor:"end", fontFamily:"monospace" }, t.toFixed(3))
        );
      }),
      ...data.map((d, i) => {
        const bH = Math.max(1, (d.score / yMax) * cH);
        const x  = pad.left + i * (cW / data.length) + 1;
        const y  = pad.top + cH - bH;
        const lx = x + bW / 2;
        const ly = H - pad.bottom + 8;
        return e("g", { key:i, onMouseEnter:()=>setHovered(i), onMouseLeave:()=>setHovered(null) },
          e("rect", { x, y, width:bW, height:bH, fill:barColor(i),
                      opacity:hovered===i ? 1 : barOp(i), rx:3 }),
          e("text", { x:lx, y:ly, fill:hovered===i ? "#e2e8f0" : "#6b7280",
                      fontSize:8, textAnchor:"end", fontFamily:"monospace",
                      transform:"rotate(-45 "+lx+" "+ly+")" }, d.label)
        );
      }),
      e("line", { x1:pad.left, x2:pad.left, y1:pad.top, y2:pad.top+cH, stroke:"#2a2a3d", strokeWidth:1 })
    ),
    hovered !== null && e("div", {
      style: { position:"absolute", top:8, left:56, background:"#0f0f1a",
               border:"1px solid #2a2a3d", borderRadius:6, padding:"8px 12px", pointerEvents:"none" }
    },
      e("p", { style:{ margin:0, fontSize:11, color:"#f97316", fontFamily:"monospace" } }, data[hovered].fullUrl),
      e("p", { style:{ margin:"4px 0 0", fontSize:12, color:"#e2e8f0", fontFamily:"monospace" } },
        "PR "+data[hovered].score.toFixed(6))
    )
  );
}

function Dashboard() {
  const [tab, setTab]       = useState("overview");
  const [expanded, setExpanded] = useState({});
  const toggle = k => setExpanded(p => ({ ...p, [k]: !p[k] }));

  const rankLookup = Object.fromEntries(REPORT.pageRankDistribution.map(d => [d.url, d.score]));
  const healthPct  = Math.round(REPORT.summary.healthyCount / REPORT.totalPages * 100);
  const orphanPct  = Math.round(REPORT.summary.orphanCount  / REPORT.totalPages * 100);

  const top20 = REPORT.pageRankDistribution.slice(0, 20).map(d => ({
    label:   d.url.length > 22 ? "\\u2026"+d.url.slice(-20) : d.url,
    fullUrl: d.url,
    score:   d.score,
  }));

  const tabs = [
    { id:"overview", label:"Overview" },
    { id:"pagerank", label:"PageRank" },
    { id:"orphans",  label:"Orphans ("+REPORT.summary.orphanCount+")" },
    { id:"near",     label:"Near-Orphans ("+REPORT.summary.nearOrphanCount+")" },
  ];

  const tabBtn = t => e("button", { key:t.id, onClick:()=>setTab(t.id), style:{
    padding:"8px 16px", fontSize:11, letterSpacing:"0.06em", border:"none",
    cursor:"pointer", borderRadius:"6px 6px 0 0", fontFamily:"monospace", textTransform:"uppercase",
    background:tab===t.id ? "#1e1e2e" : "transparent",
    color:      tab===t.id ? "#f97316" : "#6b7280",
    borderBottom:tab===t.id ? "2px solid #f97316" : "2px solid transparent",
  } }, t.label);

  const card = { background:"#0f0f1a", border:"1px solid #1e1e2e", borderRadius:10,
                 padding:"18px 20px", marginBottom:16 };

  const sectionLabel = txt => e("div", {
    style:{ fontSize:10, color:"#6b7280", letterSpacing:"0.12em", textTransform:"uppercase",
            marginBottom:12, display:"flex", alignItems:"center", gap:8 }
  }, txt, e("div", { style:{ flex:1, height:1, background:"#1e1e2e" } }));

  const statCard = ({ v, label, accent }) => e("div", { key:label, style:{
    background:"#0f0f1a", border:"1px solid "+accent+"22", borderRadius:10,
    padding:"16px 18px", position:"relative", overflow:"hidden"
  } },
    e("div", { style:{ position:"absolute", top:0, left:0, right:0, height:2,
                       background:"linear-gradient(90deg,"+accent+",transparent)" } }),
    e("p", { style:{ fontSize:32, fontWeight:700, color:accent, lineHeight:1, margin:0 } }, v),
    e("p", { style:{ fontSize:10, color:"#6b7280", letterSpacing:"0.1em", textTransform:"uppercase", marginTop:6 } }, label)
  );

  // ── Tabs ──

  const overviewTab = e("div", null,
    e("div", { style:{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 } },
      statCard({ v:REPORT.totalPages,              label:"Total Pages",  accent:"#60a5fa" }),
      statCard({ v:REPORT.summary.healthyCount,    label:"Healthy",      accent:"#34d399" }),
      statCard({ v:REPORT.summary.orphanCount,     label:"Orphans",      accent:"#ef4444" }),
      statCard({ v:REPORT.summary.nearOrphanCount, label:"Near-Orphans", accent:"#f59e0b" })
    ),
    e("div", { style:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 } },
      e("div", { style:card },
        sectionLabel("Site Health"),
        e("div", { style:{ display:"flex", alignItems:"center", gap:20 } },
          e("div", { style:{
            width:80, height:80, borderRadius:"50%", flexShrink:0,
            background:"conic-gradient(#34d399 0% "+healthPct+"%, #ef4444 "+healthPct+"% "+(healthPct+orphanPct)+"%, #f59e0b "+(healthPct+orphanPct)+"% 100%)",
            display:"flex", alignItems:"center", justifyContent:"center"
          } },
            e("div", { style:{ width:54, height:54, borderRadius:"50%", background:"#0f0f1a",
                               display:"flex", alignItems:"center", justifyContent:"center",
                               fontSize:14, fontWeight:700, color:"#34d399" } }, healthPct+"%")
          ),
          e("div", { style:{ flex:1 } },
            ...[["Healthy",REPORT.summary.healthyCount,"#34d399"],
                ["Orphans",REPORT.summary.orphanCount,"#ef4444"],
                ["Near-Orphans",REPORT.summary.nearOrphanCount,"#f59e0b"]
            ].map(([lbl,cnt,col]) =>
              e("div", { key:lbl, style:{ display:"flex", justifyContent:"space-between", marginBottom:6 } },
                e("div", { style:{ display:"flex", alignItems:"center", gap:6 } },
                  e("span", { style:{ width:8, height:8, borderRadius:2, background:col, display:"inline-block" } }),
                  e("span", { style:{ fontSize:11, color:"#9ca3af" } }, lbl)
                ),
                e("span", { style:{ fontSize:11, color:col, fontFamily:"monospace" } }, cnt)
              )
            )
          )
        )
      ),
      e("div", { style:card },
        sectionLabel("Top Pages by PageRank"),
        ...REPORT.summary.topPagesByRank.map((url, i) =>
          e("div", { key:url, style:{ display:"flex", alignItems:"center", gap:8, marginBottom:8 } },
            e("span", { style:{ fontSize:10, color:"#f97316", fontFamily:"monospace", minWidth:16 } }, "#"+(i+1)),
            e("span", { style:{ fontFamily:"monospace", fontSize:11, color:"#e2e8f0", flex:1 } }, url),
            e("span", { style:{ fontSize:10, color:"#6b7280" } }, (rankLookup[url]||0).toFixed(5))
          )
        )
      )
    )
  );

  const pagerankTab = e("div", null,
    e("div", { style:card },
      sectionLabel("Score Distribution \\u2014 Top 20"),
      e(SvgBarChart, { data:top20 })
    ),
    e("div", { style:card },
      sectionLabel("All Pages \\u2014 Full Ranking"),
      ...REPORT.pageRankDistribution.map((d, i) =>
        e("div", { key:d.url, style:{
          display:"grid", gridTemplateColumns:"28px 1fr", gap:10, alignItems:"center",
          padding:"5px 0", borderBottom:i < REPORT.pageRankDistribution.length-1 ? "1px solid #12121f" : "none"
        } },
          e("span", { style:{ fontSize:10, color:"#374151", fontFamily:"monospace", textAlign:"right" } },
            String(i+1).padStart(2,"0")
          ),
          e("div", null,
            e("span", { style:{ fontFamily:"monospace", fontSize:11, color:i<5?"#f97316":"#9ca3af",
                                display:"block", marginBottom:3 } }, d.url),
            e(ScoreBar, { score:d.score, color:i<5?"#f97316":i<15?"#7c3aed":"#374151" })
          )
        )
      )
    )
  );

  const orphansTab = e("div", null,
    e("div", { style:{ background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.2)",
                       borderRadius:8, padding:"12px 16px", marginBottom:20,
                       display:"flex", alignItems:"center", gap:10 } },
      e("span", { style:{ fontSize:18 } }, "\\uD83D\\uDEA8"),
      e("p", { style:{ margin:0, fontSize:11, color:"#fca5a5" } },
        e("strong",null, REPORT.summary.orphanCount+" pages"),
        " have zero inbound links. Expand each to view recommended link sources."
      )
    ),
    ...REPORT.orphans.map(page =>
      e(PageRow, { key:page.url, page, rank:rankLookup[page.url],
                   isExpanded:!!expanded[page.url], onToggle:()=>toggle(page.url), type:"orphan" })
    )
  );

  const nearTab = e("div", null,
    e("div", { style:{ background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.2)",
                       borderRadius:8, padding:"12px 16px", marginBottom:20,
                       display:"flex", alignItems:"center", gap:10 } },
      e("span", { style:{ fontSize:18 } }, "\\u26A0\\uFE0F"),
      e("p", { style:{ margin:0, fontSize:11, color:"#fcd34d" } },
        e("strong",null, REPORT.summary.nearOrphanCount+" pages"),
        " have \\u2264 2 inbound links. Expand each to view recommended link sources."
      )
    ),
    ...REPORT.nearOrphans.map(page =>
      e(PageRow, { key:page.url, page, rank:rankLookup[page.url],
                   isExpanded:!!expanded[page.url], onToggle:()=>toggle(page.url), type:"near-orphan" })
    )
  );

  return e("div", { style:{ fontFamily:"monospace", background:"#070710", minHeight:"100vh",
                             color:"#e2e8f0", paddingBottom:40 } },
    e("div", { style:{ borderBottom:"1px solid #1e1e2e", padding:"20px 28px 16px",
                       background:"linear-gradient(180deg,#0d0d1a 0%,#070710 100%)" } },
      e("div", { style:{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" } },
        e("div", null,
          e("h1", { style:{ margin:0, fontSize:20, fontWeight:700, color:"#f8fafc" } },
            e("span",{ style:{ color:"#f97316" } }, "\\u25c8"), " Link Graph Analyser"
          ),
          e("p", { style:{ margin:"4px 0 0", fontSize:11, color:"#6b7280",
                           letterSpacing:"0.08em", textTransform:"uppercase" } },
            "Internal link health \\u00b7 PageRank distribution \\u00b7 Orphan detection"
          )
        ),
        e("span", { style:{ fontSize:12, color:"#34d399", background:"rgba(52,211,153,0.08)",
                            border:"1px solid rgba(52,211,153,0.2)", borderRadius:4, padding:"3px 8px" } },
          "PR sum \\u2248 "+REPORT.pageRankSum
        )
      )
    ),
    e("div", { style:{ display:"flex", gap:2, padding:"12px 28px 0", borderBottom:"1px solid #1e1e2e" } },
      ...tabs.map(tabBtn)
    ),
    e("div", { style:{ padding:"24px 28px" } },
      tab==="overview" && overviewTab,
      tab==="pagerank" && pagerankTab,
      tab==="orphans"  && orphansTab,
      tab==="near"     && nearTab
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(e(Dashboard, null));
`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Link Graph Report</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet" />
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { height: 100%; }
    body { background: #070710; color: #e2e8f0; font-family: 'JetBrains Mono', monospace; }
    button { font-family: inherit; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: #0f0f1a; }
    ::-webkit-scrollbar-thumb { background: #2a2a3d; border-radius: 3px; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>window.__REPORT__ = ${reportJson};</script>
  <script>${appScript}</script>
</body>
</html>`;
}
