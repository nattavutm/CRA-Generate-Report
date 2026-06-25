// P4 — report.html.ts: render ReportModel -> self-contained HTML matching CyberRiskAdvisoryService.pdf.
// 13-page layout: cover, exec summary, contents, methodology, risk index, exposure,
// security config, attack, recommendations (paginated), cadence. TrendAI chrome on every page.

import { REPORT_CSS } from './styles';
import type { ReportModel, Finding, TrendPoint, HeroMetric, LiveData } from '../types';

// ---------- formatting ----------
const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DASH = '—';
const fmt = (v: number | null | undefined): string =>
  v === null || v === undefined || Number.isNaN(v) ? DASH : Number.isInteger(v) ? v.toLocaleString('en-US') : String(v);

const blist = (items: string[]): string =>
  items.length ? `<ul class="blist">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '';
const paras = (text: string | undefined, fallback = ''): string => {
  const t = (text ?? '').trim() || fallback;
  if (!t) return '';
  return t.split(/\n{2,}/).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
};

const logo = (light = false): string => {
  const color = light ? '#fff' : '#E11C24';
  return `<span class="logo">
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0c1.1 6 4.9 9.7 12 12-7.1 2.3-10.9 6-12 12-1.1-6-4.9-9.7-12-12C7.1 9.7 10.9 6 12 0z" fill="${color}"/></svg>
    <span class="word">TrendAI<span class="tm">™</span></span>
  </span>`;
};

// ---------- live-derived editorial defaults (cra.md §2.3) ----------
function heroMetrics(model: ReportModel): HeroMetric[] {
  if (model.config.hero?.length) return model.config.hero.slice(0, 4);
  const l = model.live;
  return [
    { value: fmt(l.riskIndex), label: 'Risk Index — Latest', accent: true },
    { value: l.cve?.mttpDays != null ? `${l.cve.mttpDays}d` : DASH, label: 'Mean Time to Patch' },
    { value: l.coverageRate != null ? `${Math.round(l.coverageRate)}%` : DASH, label: 'VA Coverage' },
    { value: fmt(l.staleAccountCount), label: 'Stale Accounts', accent: true },
  ];
}

function attackDetections(model: ReportModel): string[] {
  if (model.config.attack?.detections?.length) return model.config.attack.detections;
  return model.live.alerts.slice(0, 6).map((a) => `${a.name} — ${a.entity} (${a.severity}${a.score != null ? `, score ${a.score}` : ''})`);
}

function recommendations(model: ReportModel): Finding[] {
  if (model.config.recommendations?.length) return model.config.recommendations;
  return deriveRecommendations(model.live);
}

function deriveRecommendations(l: LiveData): Finding[] {
  const out: Finding[] = [];
  if (l.cve && l.cve.count > 0)
    out.push({
      riskLevel: l.cve.count > 100 ? 'High' : 'Medium',
      category: 'Exposure',
      title: 'Highly Exploitable Unique CVEs',
      detail: [`${fmt(l.cve.count)} highly-exploitable CVEs across the environment`, `Average unpatched time ${l.cve.averageUnpatchedDays} days`],
      recommendation: ['Apply virtual patching or network isolation as interim mitigation.', 'Plan migration of legacy applications to supported platforms.'],
      status: 'Recommended',
    });
  if (l.staleAccountCount && l.staleAccountCount > 0)
    out.push({
      riskLevel: 'High',
      category: 'Exposure',
      title: 'Stale Accounts',
      detail: [`${fmt(l.staleAccountCount)} accounts inactive > 180 days`],
      recommendation: ['Investigate and disable / delete inactive accounts.', 'Configure auto-deactivation at 90 or 180 days.'],
      status: 'Recommended',
    });
  if (l.alerts.length > 0)
    out.push({
      riskLevel: 'Medium',
      category: 'Attack',
      title: 'XDR Detections',
      detail: [`${l.alerts.length} Workbench detections in the reporting window`, `Top: ${l.alerts[0].name}`],
      recommendation: ['Triage and close out high-severity Workbench alerts.'],
      status: 'Recommended',
    });
  return out;
}

// ---------- page chrome ----------
const HEADER = `<div class="phead">${logo()}<div class="right"><div>Cyber Risk Advisory ·</div><div>Service Overview</div></div></div>`;
function footer(pageNum: number, total: number): string {
  return `<div class="pfoot"><span><b>TrendAI</b> Vision One™ · Cyber Risk Advisory</span><span>Page <b>${pageNum}</b> / ${total}</span></div>`;
}
function shead(num: string, name: string, headline: string): string {
  return `<div class="shead"><div class="label"><span class="num">${num}</span><span class="name">${esc(name)}</span></div><h1>${esc(headline)}</h1></div><div class="rule"></div>`;
}

// ---------- §03 trend table ----------
function trendCells(tp: TrendPoint | undefined, liveDay90?: number | null): string {
  const p = tp ?? {};
  const day90 = p.day90 ?? liveDay90 ?? undefined;
  const cell = (v: number | undefined) => (v === undefined || v === null ? `<td><span class="dash">${DASH}</span></td>` : `<td>${fmt(v)}</td>`);
  const worse = day90 !== undefined && (p.day60 === undefined || day90 > p.day60);
  const d90 = day90 === undefined ? `<td class="d90"><span class="dash">${DASH}</span></td>` : `<td class="d90 ${worse ? 'worse' : ''}">${fmt(day90)}</td>`;
  return `${cell(p.day1)}${cell(p.day30)}${cell(p.day60)}${d90}`;
}

// ---------- pages ----------
function cover(model: ReportModel): string {
  const c = model.config;
  return `<div class="page cover">
    <div class="cover-top">
      ${logo(true)}
      <div style="margin-top:18mm" class="eyebrow red">Cyber Risk Advisory</div>
      <h1>${esc(c.coverTitle ?? 'Service Overview &\nReporting').replace(/\n/g, '<br>')}</h1>
      <div class="sub">${esc(c.coverSubtitle ?? 'A continuous, AI-driven engagement that turns telemetry into prioritized action — measuring exposure, attack activity, and security configuration across your environment every 30 days.')}</div>
      <div class="powered">
        <span class="eyebrow">Powered by</span>
        ${logo(true)}
        <div class="v1">Vision One</div>
      </div>
    </div>
    <div class="cover-meta">
      <div><div class="k">Prepared for</div><div class="v">${esc(c.customerName)}</div></div>
      <div><div class="k">Engagement</div><div class="v">${esc(c.engagement.cycleLabel || '90-Day Cycle · 4 Sessions')}</div></div>
      <div><div class="k">Document</div><div class="v">${esc(c.engagement.docId || 'CRA-2026 · v1.0')}</div></div>
    </div>
  </div>`;
}

function execSummary(model: ReportModel, pg: number, total: number): string {
  const cards = heroMetrics(model)
    .map((m) => `<div class="card"><div class="v ${m.accent ? 'accent' : ''}">${esc(m.value)}</div><div class="l">${esc(m.label)}</div></div>`)
    .join('');
  return `<div class="page">${HEADER}
    ${shead('01', 'Executive Summary', 'Risk posture, in one read.')}
    ${model.live.errors.securityPosture ? `<div class="notice">⚠ Live posture data unavailable (${esc(model.live.errors.securityPosture)}). Metrics below reflect manual input only.</div>` : ''}
    ${paras(model.config.executiveSummary, 'Summary pending.')}
    <div class="cards">${cards}</div>
    <h3>What changed this cycle</h3>
    ${blist(model.config.whatChanged)}
    ${footer(pg, total)}
  </div>`;
}

function contents(pages: Record<string, number>, pg: number, total: number): string {
  const rows: Array<[string, string, string, number]> = [
    ['01', 'Executive Summary', 'Risk posture at a glance · trend across 90 days', pages.exec],
    ['02', 'Methodology', 'Discover · assess · prioritize · advise', pages.method],
    ['03', 'Risk Index Overview', 'Composite Cyber Risk Index and category scoring', pages.risk],
    ['04', 'Exposure Overview', 'Internet-facing assets · vulnerabilities · accounts', pages.exposure],
    ['05', 'Security Configuration Overview', 'Endpoint protection · sensors · feature adoption', pages.secconfig],
    ['06', 'Attack Overview', 'XDR detections and prioritization', pages.attack],
    ['07', 'Recommendations & Continued Actions', 'Prioritized remediation roadmap by risk impact', pages.recs],
    ['08', 'Meeting Schedule & Cadence', 'Day 1 · Day 30 · Day 60 · Day 90 reviews', pages.cadence],
  ];
  const toc = rows
    .map(([n, t, d, p]) => `<div class="toc-row"><span class="n">${n}</span><div><div class="t">${esc(t)}</div><div class="d">${esc(d)}</div></div><span class="pg">${String(p).padStart(2, '0')}</span></div>`)
    .join('');
  return `<div class="page">${HEADER}
    ${shead('', 'Contents', 'What this report covers.').replace('<span class="num"></span>', '')}
    <p class="lead">A Cyber Risk Advisory engagement is structured around four sessions over 90 days. Each session reviews the same eight sections so progress is directly comparable cycle-over-cycle.</p>
    <div class="toc">${toc}</div>
    ${footer(pg, total)}
  </div>`;
}

function methodology(pg: number, total: number): string {
  const steps = [
    ['01', 'Discover', 'Connect Vision One telemetry across endpoints, identity, cloud, and internet-facing assets.'],
    ['02', 'Assess', 'Quantify exposure, attack activity, and configuration drift into a single Cyber Risk Index.'],
    ['03', 'Prioritize', 'Rank findings by impact and exploitability so remediation effort follows business risk.'],
    ['04', 'Advise', 'Deliver session-based guidance with continued actions tracked across the 90-day cycle.'],
  ];
  const feats = [
    ['Exposure', 'Know what is reachable', 'Internet-facing assets, vulnerable accounts, and unpatched systems are inventoried, scored, and trended.'],
    ['Attack', 'See what is happening', 'XDR detections from endpoints, identity, network, and cloud are clustered into the workbenches that matter.'],
    ['Configuration', 'Verify what is enforcing', 'Endpoint protection, sensors, and feature adoption are checked against best practice and your own baseline.'],
  ];
  return `<div class="page">${HEADER}
    ${shead('02', 'Methodology', 'Discover, assess, prioritize, advise.')}
    <p class="lead">The Cyber Risk Advisory service is delivered as a guided 90-day engagement on top of TrendAI Vision One™. Telemetry is unified, scored, and translated into a session-based action plan with explicit owners and follow-through tracking.</p>
    <div class="steps">${steps.map(([n, t, d]) => `<div class="step"><div class="n">${n}</div><div class="t">${esc(t)}</div><div class="d">${esc(d)}</div></div>`).join('')}</div>
    <div class="feats">${feats.map(([e, t, d]) => `<div class="feat"><div class="e">✓ ${esc(e)}</div><div class="t">${esc(t)}</div><div class="d">${esc(d)}</div></div>`).join('')}</div>
    ${footer(pg, total)}
  </div>`;
}

function riskIndex(model: ReportModel, pg: number, total: number): string {
  const t = model.config.trend ?? {};
  const note = model.config.riskIndexNote ?? 'Reading the index — scores are on a 0–100 scale where lower is better. Day-over-day movement is more informative than the absolute number; a category that flatlines usually signals an unresolved structural issue, not stability.';
  return `<div class="page">${HEADER}
    ${shead('03', 'Risk Index Overview', 'A single number for the boardroom.')}
    <p class="lead">The Cyber Risk Index measures organisational risk based on multiple cyber risk factors. It provides a high-level view of potential impacts on assets such as users, devices, applications, internet-facing domains, and cloud resources. The table below shows current risk levels across the engagement timeline.</p>
    <table class="trend">
      <thead><tr><th>Category</th><th>Day 1</th><th>Day 30</th><th>Day 60</th><th>Day 90</th></tr></thead>
      <tbody>
        <tr class="rowhi"><td>Risk Index</td>${trendCells(t.riskIndex, model.live.riskIndex)}</tr>
        <tr><td>Exposure Overview</td>${trendCells(t.exposure)}</tr>
        <tr><td>Attack Overview</td>${trendCells(t.attack)}</tr>
        <tr><td>Security Configuration</td>${trendCells(t.securityConfiguration)}</tr>
      </tbody>
    </table>
    <p class="muted">${esc(note)}</p>
    ${footer(pg, total)}
  </div>`;
}

function exposure(model: ReportModel, pg: number, total: number): string {
  const ex = model.config.exposure ?? {};
  return `<div class="page">${HEADER}
    ${shead('04', 'Exposure Overview', 'Internet-facing assets, vulnerabilities, and accounts.')}
    <p class="lead">${esc(ex.narrative ?? 'Internet-facing surfaces, vulnerability coverage, and account hygiene for this cycle.')}</p>
    <h3>Internal asset vulnerabilities</h3>
    ${paras(ex.subNarrative, 'Vulnerability detail pending review.')}
    <h3>System configuration vulnerabilities</h3>
    ${blist(ex.findings ?? [])}
    ${footer(pg, total)}
  </div>`;
}

function securityConfig(model: ReportModel, pg: number, total: number): string {
  const s = model.config.securityConfig ?? {};
  return `<div class="page">${HEADER}
    ${shead('05', 'Security Configuration Overview', 'Endpoint protection, sensors, and feature adoption.')}
    <p class="lead">${esc(s.narrative ?? 'Endpoint protection coverage, sensor adoption, and feature configuration for this cycle.')}</p>
    <h3>Endpoint protection</h3>
    ${paras(s.endpointProtection, 'Endpoint protection summary pending.')}
    <h3>Key feature adoption &amp; pattern update status</h3>
    ${blist(s.featureAdoption ?? [])}
    <h3>Endpoint sensor</h3>
    ${paras(s.endpointSensor, 'Endpoint sensor summary pending.')}
    ${footer(pg, total)}
  </div>`;
}

function attack(model: ReportModel, pg: number, total: number): string {
  const a = model.config.attack ?? {};
  return `<div class="page">${HEADER}
    ${shead('06', 'Attack Overview', 'Detections, prioritized.')}
    <p class="lead">${esc(a.narrative ?? 'XDR detections across endpoints, identity, network, and cloud for this cycle.')}</p>
    <h3>XDR detection summary</h3>
    ${model.live.errors.alerts ? '<div class="notice">⚠ Live Workbench data unavailable.</div>' : ''}
    ${blist(attackDetections(model))}
    ${footer(pg, total)}
  </div>`;
}

function recRow(f: Finding): string {
  return `<tr>
    <td class="risk ${esc(f.riskLevel)}">${esc(f.riskLevel).toUpperCase()}</td>
    <td class="cat">${esc(f.category)}</td>
    <td class="find"><span class="t">${esc(f.title)}</span><ul class="mini">${f.detail.map((d) => `<li>${esc(d)}</li>`).join('')}</ul></td>
    <td class="rec">${f.recommendation.map((r) => `<p>${esc(r)}</p>`).join('')}<p class="status">Status: ${esc(f.status)}</p></td>
  </tr>`;
}

function recPages(model: ReportModel, startPg: number, total: number): string[] {
  const findings = recommendations(model);
  const perPage = 3;
  const chunks: Finding[][] = [];
  for (let i = 0; i < Math.max(findings.length, 1); i += perPage) chunks.push(findings.slice(i, i + perPage));

  return chunks.map((chunk, idx) => {
    const head = idx === 0;
    const body = head
      ? `${shead('07', 'Recommendations & Continued Actions', 'A prioritized roadmap to lower the index.')}
         <p class="lead">Each row pairs a finding with a recommendation, a status, and the Vision One path to find supporting evidence. High-impact items should be closed before the Day 90 review; medium and low items roll into the next 90-day cycle.</p>
         <table class="recs"><thead><tr><th>Risk</th><th>Category</th><th>Finding</th><th>Recommendation</th></tr></thead>
         <tbody>${chunk.length ? chunk.map(recRow).join('') : '<tr><td colspan="4" class="muted">No recommendations recorded.</td></tr>'}</tbody></table>`
      : `<table class="recs"><tbody>${chunk.map(recRow).join('')}</tbody></table>`;
    return `<div class="page">${HEADER}${body}${footer(startPg + idx, total)}</div>`;
  });
}

function cadence(model: ReportModel, pg: number, total: number): string {
  const rows =
    model.config.sessions.length === 0
      ? '<tr><td colspan="4" class="muted">No sessions scheduled.</td></tr>'
      : model.config.sessions
          .map((s, i) => {
            const last = i === model.config.sessions.length - 1 && s.status === 'Upcoming';
            return `<tr class="${last ? 'rowhi' : ''}"><td>${esc(s.label)}</td><td class="date">${esc(s.date || DASH)}</td><td>${esc(s.time || DASH)}</td><td class="st-${esc(s.status)}">${esc(s.status)}</td></tr>`;
          })
          .join('');
  return `<div class="page">${HEADER}
    ${shead('08', 'Meeting Schedule & Cadence', 'Day 1, 30, 60, 90.')}
    <p class="lead">Each session reviews the same eight sections so progress is directly comparable cycle-over-cycle. Continued actions are tracked between sessions and reported back at the next review.</p>
    <table class="cad"><thead><tr><th>Session</th><th>Date</th><th>Time</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="callout"><div class="e">AI Fearlessly</div><div class="t">Continuous risk advisory — telemetry to action, every 30 days.</div></div>
    <div class="copyright">© 2026 TrendAI™. All rights reserved. TrendAI Vision One™ and the Trend Spark are trademarks of TrendAI.</div>
    ${footer(pg, total)}
  </div>`;
}

export function renderReport(model: ReportModel): string {
  // Pre-compute page numbers (cover=1). Recommendations may span multiple pages.
  const findings = recommendations(model);
  const recPageCount = Math.max(1, Math.ceil(findings.length / 3));
  const pages = {
    exec: 2,
    contents: 3,
    method: 4,
    risk: 5,
    exposure: 6,
    secconfig: 7,
    attack: 8,
    recs: 9,
    cadence: 9 + recPageCount,
  };
  const total = 9 + recPageCount; // cover + 8 content slots, recs offset already in cadence

  const body = [
    cover(model),
    execSummary(model, pages.exec, total),
    contents(pages, pages.contents, total),
    methodology(pages.method, total),
    riskIndex(model, pages.risk, total),
    exposure(model, pages.exposure, total),
    securityConfig(model, pages.secconfig, total),
    attack(model, pages.attack, total),
    ...recPages(model, pages.recs, total),
    cadence(model, pages.cadence, total),
  ].join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cyber Risk Advisory — ${esc(model.config.customerName)}</title>
<style>${REPORT_CSS}</style></head>
<body>${body}</body></html>`;
}
