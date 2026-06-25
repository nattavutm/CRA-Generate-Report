// Print stylesheet for the CRA report. A4, dark cover, red accent (#E11C24).
// Kept as a string so the template is one self-contained HTML document for Browser Rendering.

export const REPORT_CSS = `
:root {
  --accent: #E11C24;
  --accent-soft: #fbe3e4;
  --ink: #1a1a1f;
  --muted: #6b7280;
  --line: #e5e7eb;
  --cover-bg: #14151a;
  --high: #E11C24;
  --high-bg: #fcdedf;
  --med: #d97706;
  --med-bg: #fdecd2;
  --low: #2563eb;
  --low-bg: #e2ebfd;
}

* { box-sizing: border-box; }

@page {
  size: A4;
  margin: 0;
}

html, body {
  margin: 0;
  padding: 0;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: var(--ink);
  font-size: 12px;
  line-height: 1.5;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.page {
  position: relative;
  width: 210mm;
  min-height: 297mm;
  padding: 22mm 18mm 24mm;
  page-break-after: always;
  background: #fff;
}
.page:last-child { page-break-after: auto; }

/* ---------- Cover ---------- */
.cover {
  background: var(--cover-bg);
  color: #fff;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.cover-accent { height: 8mm; background: var(--accent); }
.cover-body { flex: 1; padding: 34mm 22mm; display: flex; flex-direction: column; }
.brand { display: flex; align-items: center; gap: 10px; font-weight: 700; letter-spacing: .5px; font-size: 16px; }
.brand .dot { width: 12px; height: 12px; border-radius: 3px; background: var(--accent); }
.cover h1 { font-size: 40px; line-height: 1.1; margin: 28mm 0 6px; font-weight: 800; }
.cover .subtitle { font-size: 16px; color: #c7c9d1; font-weight: 400; }
.cover-meta { margin-top: auto; border-top: 1px solid #2c2e36; padding-top: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; }
.cover-meta .k { color: #8b8e99; font-size: 10px; text-transform: uppercase; letter-spacing: .6px; }
.cover-meta .v { font-size: 14px; font-weight: 600; }

/* ---------- Section chrome ---------- */
.section-head { display: flex; align-items: baseline; gap: 12px; border-bottom: 2px solid var(--accent); padding-bottom: 8px; margin-bottom: 16px; }
.section-num { color: var(--accent); font-weight: 800; font-size: 22px; }
.section-title { font-size: 20px; font-weight: 700; }
h3 { font-size: 14px; margin: 18px 0 8px; }
p { margin: 0 0 10px; }
.muted { color: var(--muted); }
.lead { font-size: 13px; }

ul { margin: 0 0 10px; padding-left: 18px; }
li { margin-bottom: 4px; }

/* ---------- Metric cards ---------- */
.cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 6px 0 16px; }
.card { border: 1px solid var(--line); border-radius: 8px; padding: 12px; }
.card .label { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); }
.card .value { font-size: 24px; font-weight: 800; margin-top: 4px; }
.card .value.accent { color: var(--accent); }
.card .sub { font-size: 10px; color: var(--muted); margin-top: 2px; }

/* ---------- Tables ---------- */
table { width: 100%; border-collapse: collapse; margin: 6px 0 16px; font-size: 11px; }
th, td { text-align: left; padding: 7px 9px; border-bottom: 1px solid var(--line); vertical-align: top; }
thead th { background: #f6f7f9; font-size: 10px; text-transform: uppercase; letter-spacing: .4px; color: #4b5563; }
.trend th, .trend td { text-align: center; }
.trend td:first-child, .trend th:first-child { text-align: left; }
.num { text-align: right; font-variant-numeric: tabular-nums; }

/* ---------- Risk pills ---------- */
.pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; text-transform: capitalize; }
.pill.high { background: var(--high-bg); color: var(--high); }
.pill.medium { background: var(--med-bg); color: var(--med); }
.pill.low { background: var(--low-bg); color: var(--low); }
.pill.unknown { background: #eee; color: #555; }

.rec-risk.High { background: var(--high-bg); }
.rec-risk.Medium { background: var(--med-bg); }
.rec-risk.Low { background: var(--low-bg); }

/* ---------- Notices ---------- */
.notice { background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; padding: 8px 12px; border-radius: 6px; font-size: 11px; margin: 8px 0 14px; }

/* ---------- Footer ---------- */
.footer { position: absolute; left: 18mm; right: 18mm; bottom: 12mm; display: flex; justify-content: space-between; font-size: 9px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 6px; }
`;
