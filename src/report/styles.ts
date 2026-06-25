// Print stylesheet for the Cyber Risk Advisory report.
// Matches CyberRiskAdvisoryService.pdf: black cover, red accent (#E11C24), TrendAI chrome,
// letter-spaced eyebrows, bold headlines + red rule, black-header tables, A4 page breaks.

export const REPORT_CSS = `
:root {
  --accent: #E11C24;
  --accent-pink: #fbe1e3;
  --ink: #14151a;
  --body: #3f434b;
  --muted: #8a8f98;
  --line: #e4e6ea;
  --line-soft: #eef0f3;
  --black: #050608;
  --green: #157a3a;
  --high: #E11C24;
  --med-bg: #f6c9cd;
  --low-bg: #eceef1;
}

* { box-sizing: border-box; }
@page { size: A4; margin: 0; }

html, body {
  margin: 0; padding: 0;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: var(--body);
  font-size: 11.5px; line-height: 1.62;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}

.page {
  position: relative;
  width: 210mm; height: 297mm;
  padding: 20mm 20mm 22mm;
  page-break-after: always;
  background: #fff; overflow: hidden;
}
.page:last-child { page-break-after: auto; }

/* ---------- eyebrows / letter-spaced labels ---------- */
.eyebrow { font-size: 10px; font-weight: 700; letter-spacing: .34em; text-transform: uppercase; }
.eyebrow.red { color: var(--accent); }
.eyebrow.gray { color: var(--muted); }

/* ---------- page chrome (header + footer) ---------- */
.phead { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; }
.phead .right { text-align: right; line-height: 1.7; color: var(--muted); font-size: 9px; letter-spacing: .28em; font-weight: 700; }
.logo { display: inline-flex; align-items: center; gap: 8px; }
.logo svg { display: block; }
.logo .word { font-size: 17px; font-weight: 800; letter-spacing: -.2px; color: var(--ink); }
.logo .tm { font-size: 8px; vertical-align: super; color: var(--muted); }

.pfoot { position: absolute; left: 20mm; right: 20mm; bottom: 12mm; padding-top: 8px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; font-size: 9px; color: var(--muted); }
.pfoot b { color: var(--ink); font-weight: 800; }

/* ---------- section header ---------- */
.shead { margin-top: 6px; }
.shead .label { display: flex; gap: 14px; align-items: baseline; }
.shead .num { color: var(--accent); font-weight: 800; font-size: 12px; letter-spacing: .3em; }
.shead .name { color: var(--ink); font-weight: 700; font-size: 10px; letter-spacing: .3em; text-transform: uppercase; }
.shead h1 { font-size: 30px; line-height: 1.12; font-weight: 800; color: var(--ink); margin: 12px 0 0; letter-spacing: -.5px; }
.rule { height: 3px; background: var(--accent); margin: 18px 0 18px; }
.lead { font-size: 13.5px; line-height: 1.7; color: var(--body); margin: 0 0 18px; }
h3 { font-size: 14px; color: var(--ink); font-weight: 800; margin: 20px 0 8px; }
p { margin: 0 0 11px; }

/* ---------- red-square bullet list ---------- */
.blist { list-style: none; margin: 4px 0 14px; padding: 0; }
.blist li { position: relative; padding-left: 20px; margin-bottom: 9px; line-height: 1.6; }
.blist li::before { content: ''; position: absolute; left: 0; top: 5px; width: 7px; height: 7px; background: var(--accent); }

/* ---------- cover ---------- */
.cover { background: var(--black); color: #fff; padding: 0; height: 297mm; display: flex; flex-direction: column; }
.cover-top { flex: 1; padding: 24mm 24mm 0; }
.cover .logo .word { color: #fff; }
.cover .logo .tm { color: #c9ccd2; }
.cover h1 { font-size: 52px; line-height: 1.04; font-weight: 800; color: #fff; margin: 26mm 0 0; letter-spacing: -1px; }
.cover .sub { font-size: 14.5px; color: #c3c6cd; max-width: 78%; margin-top: 18px; line-height: 1.6; }
.cover .powered { margin-top: 22mm; }
.cover .powered .eyebrow { color: #8d909a; margin-bottom: 12px; display: block; }
.cover .powered .v1 { font-size: 10px; color: #c3c6cd; letter-spacing: .5px; margin-top: 2px; }
.cover-meta { background: #fff; color: var(--ink); padding: 16mm 24mm; display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 28px; }
.cover-meta .k { color: var(--muted); font-size: 9px; font-weight: 700; letter-spacing: .3em; text-transform: uppercase; }
.cover-meta .v { font-size: 17px; font-weight: 800; margin-top: 10px; color: var(--ink); }

/* ---------- metric cards (exec summary) ---------- */
.cards { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid var(--line); border-radius: 4px; overflow: hidden; margin: 6px 0 22px; }
.card { padding: 18px 18px 20px; border-left: 1px solid var(--line); background: #fafbfc; }
.card:first-child { border-left: none; }
.card .v { font-size: 34px; font-weight: 800; color: var(--ink); line-height: 1; letter-spacing: -1px; }
.card .v.accent { color: var(--accent); }
.card .l { margin-top: 12px; font-size: 9px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; color: var(--muted); line-height: 1.5; }

/* ---------- contents ---------- */
.toc { margin-top: 6px; }
.toc-row { display: grid; grid-template-columns: 42px 1fr auto; gap: 0 16px; align-items: baseline; padding: 14px 0; border-bottom: 1px solid var(--line-soft); }
.toc-row .n { color: var(--accent); font-weight: 800; font-size: 11px; letter-spacing: .25em; }
.toc-row .t { font-weight: 800; color: var(--ink); font-size: 14px; }
.toc-row .d { color: var(--muted); font-size: 11px; margin-top: 3px; }
.toc-row .pg { color: var(--ink); font-weight: 800; font-size: 12px; }

/* ---------- methodology ---------- */
.steps { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 3px solid var(--black); }
.step { padding: 20px 16px 8px; border-left: 1px solid var(--line); }
.step:first-child { border-left: none; }
.step .n { color: var(--accent); font-size: 30px; font-weight: 800; letter-spacing: -1px; }
.step .t { color: var(--ink); font-weight: 800; font-size: 13px; margin: 14px 0 8px; }
.step .d { color: var(--body); font-size: 11px; line-height: 1.55; }
.feats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; margin-top: 22px; background: #fafbfc; border: 1px solid var(--line); border-radius: 4px; }
.feat { padding: 18px 18px 20px; border-left: 1px solid var(--line); }
.feat:first-child { border-left: none; }
.feat .e { color: var(--accent); font-size: 9px; font-weight: 700; letter-spacing: .26em; text-transform: uppercase; }
.feat .t { color: var(--ink); font-weight: 800; font-size: 14px; margin: 10px 0 8px; }
.feat .d { color: var(--body); font-size: 11px; line-height: 1.55; }

/* ---------- tables ---------- */
table { width: 100%; border-collapse: collapse; margin: 4px 0 16px; }
thead th { background: var(--black); color: #fff; text-align: left; font-size: 9.5px; font-weight: 700; letter-spacing: .24em; text-transform: uppercase; padding: 14px 16px; }
tbody td { padding: 16px; border-bottom: 1px solid var(--line); vertical-align: top; font-size: 11.5px; color: var(--body); }

/* data tables (live values) */
.kv td { font-size: 12px; color: var(--ink); }
.ar { text-align: right; font-variant-numeric: tabular-nums; }
th.ar { text-align: right; }

/* trend table */
.trend td { text-align: center; font-weight: 700; color: var(--ink); font-size: 14px; }
.trend td:first-child, .trend th:first-child { text-align: left; }
.trend td:first-child { font-weight: 700; color: var(--ink); font-size: 12.5px; }
.trend .rowhi td { background: #f6f7f9; }
.trend .rowhi td:first-child { font-weight: 800; }
.trend .d90.worse { color: var(--accent); }
.trend .d90.pink { background: var(--accent-pink); }
.trend .dash { color: var(--muted); font-weight: 400; }

/* recommendations table */
.recs td { vertical-align: top; }
.recs .risk { width: 96px; text-align: center; font-size: 9.5px; font-weight: 700; letter-spacing: .2em; color: var(--ink); }
.recs .risk.High { background: var(--high); color: #fff; }
.recs .risk.Medium { background: var(--med-bg); color: #7a1015; }
.recs .risk.Low { background: var(--low-bg); color: var(--body); }
.recs .cat { width: 120px; font-size: 9.5px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; color: var(--body); }
.recs .find .t { font-weight: 800; color: var(--ink); font-size: 12.5px; display: block; margin-bottom: 8px; }
.recs .mini { list-style: none; margin: 0; padding: 0; }
.recs .mini li { position: relative; padding-left: 12px; margin-bottom: 5px; line-height: 1.45; font-size: 11px; }
.recs .mini li::before { content: '•'; position: absolute; left: 0; color: var(--muted); }
.recs .rec p { margin: 0 0 7px; font-size: 11px; line-height: 1.45; }
.recs .rec .status { color: var(--muted); font-size: 10.5px; }

/* cadence table */
.cad td { font-size: 12px; }
.cad td:first-child { font-weight: 800; color: var(--ink); }
.cad .st-Completed { color: var(--green); font-weight: 800; }
.cad .st-Upcoming { color: var(--accent); font-weight: 800; }
.cad .rowhi td { background: var(--accent-pink); }
.cad .rowhi td:first-child, .cad .rowhi .date { color: var(--ink); }

/* ---------- callout ---------- */
.callout { background: var(--black); color: #fff; border-radius: 4px; padding: 30px 32px; margin: 24px 0 16px; }
.callout .e { color: var(--accent); font-size: 9px; font-weight: 700; letter-spacing: .3em; text-transform: uppercase; }
.callout .t { font-size: 24px; font-weight: 800; margin-top: 12px; line-height: 1.2; letter-spacing: -.3px; }
.copyright { text-align: center; color: var(--muted); font-size: 9.5px; margin-top: 4px; }

.notice { background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; padding: 8px 12px; border-radius: 4px; font-size: 10.5px; margin: 0 0 14px; }
.muted { color: var(--muted); }
`;
