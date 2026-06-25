// P4 — report.html.ts: render ReportModel -> self-contained HTML matching CyberRiskAdvisoryService.pdf.
// Data sections (01/03/04/05/06/07) render straight from the live Vision One pull (model.live).
// Form text is only used where there is no API source: prior-period trend columns, sessions,
// optional commentary, and optional manual recommendation overrides.

import { REPORT_CSS } from './styles';
import type { ReportModel, Finding, LiveData } from '../types';

// ---------- formatting ----------
const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DASH = '—';
const fmt = (v: number | null | undefined): string =>
  v === null || v === undefined || Number.isNaN(v) ? DASH : Number.isInteger(v) ? v.toLocaleString('en-US') : String(v);
const pct = (v: number | null | undefined): string => (v === null || v === undefined || Number.isNaN(v) ? DASH : `${Math.round(v)}%`);
const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

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

const card = (value: string, label: string, accent = false): string =>
  `<div class="card"><div class="v ${accent ? 'accent' : ''}">${esc(value)}</div><div class="l">${esc(label)}</div></div>`;

// ---------- derived recommendations (only when no manual override) ----------
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
      detail: [`${fmt(l.cve.count)} highly-exploitable CVEs detected`, `Average unpatched time ${l.cve.averageUnpatchedDays} days; density ${l.cve.density}`],
      recommendation: ['Apply virtual patching or network isolation as interim mitigation.', 'Prioritise patching of internet-facing assets.'],
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
  if (l.exposure && l.exposure.weakAuthenticationCount > 0)
    out.push({
      riskLevel: 'Medium',
      category: 'Exposure',
      title: 'Accounts with Weak Authentication',
      detail: [`${fmt(l.exposure.weakAuthenticationCount)} accounts with weak authentication`, `${fmt(l.exposure.excessivePrivilegeCount)} with excessive privilege`],
      recommendation: ['Enable password expiration / MFA on listed accounts.', 'Review excessive-privilege grants.'],
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
const footer = (pageNum: number, total: number): string =>
  `<div class="pfoot"><span><b>TrendAI</b> Vision One™ · Cyber Risk Advisory</span><span>Page <b>${pageNum}</b> / ${total}</span></div>`;
const shead = (num: string, name: string, headline: string): string =>
  `<div class="shead"><div class="label">${num ? `<span class="num">${num}</span>` : ''}<span class="name">${esc(name)}</span></div><h1>${esc(headline)}</h1></div><div class="rule"></div>`;
const dataNotice = (model: ReportModel, key: string): string =>
  model.live.errors[key] ? `<div class="notice">⚠ Live data unavailable — ${esc(model.live.errors[key])}</div>` : '';

// ---------- §03 current risk level ----------
function levelTag(level: string): string {
  const l = (level || '').toLowerCase();
  const cls = l === 'high' || l === 'medium' || l === 'low' ? l : 'na';
  return `<span class="lvl ${cls}">${l === 'na' ? DASH : esc(cap(level))}</span>`;
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
      <div class="powered"><span class="eyebrow">Powered by</span>${logo(true)}<div class="v1">Vision One</div></div>
    </div>
    <div class="cover-meta">
      <div><div class="k">Prepared for</div><div class="v">${esc(c.customerName)}</div></div>
      <div><div class="k">Engagement</div><div class="v">${esc(c.engagement.cycleLabel || '90-Day Cycle · 4 Sessions')}</div></div>
      <div><div class="k">Document</div><div class="v">${esc(c.engagement.docId || 'CRA-2026 · v1.0')}</div></div>
    </div>
  </div>`;
}

// Overall Cyber Risk Index → level band (matches the Vision One dashboard label).
function indexLevel(n: number | null): { key: string; label: string } {
  if (n === null || Number.isNaN(n)) return { key: 'na', label: 'No data' };
  if (n < 30) return { key: 'low', label: 'Low risk' };
  if (n < 70) return { key: 'medium', label: 'Medium risk' };
  return { key: 'high', label: 'High risk' };
}

function execSummary(model: ReportModel, pg: number, total: number): string {
  const l = model.live;
  const lvl = indexLevel(l.riskIndex);
  const catRow = (name: string, level: string) =>
    `<div class="catrow"><span>${name}</span>${levelTag(level)}</div>`;
  const hero = `<div class="riskhero">
    <div class="idxbox">
      <div class="eyebrow gray" style="margin-bottom:10px">Cyber Risk Index</div>
      <div class="idxnum ${lvl.key}">${fmt(l.riskIndex)}<span class="of">/100</span></div>
      <div class="idxlabel ${lvl.key}">${esc(lvl.label)}</div>
      <div class="cats">
        <div class="eyebrow gray" style="margin-bottom:6px">Contributing categories</div>
        ${catRow('Exposure', l.categoryLevels.exposure)}
        ${catRow('Attack', l.categoryLevels.attack)}
        ${catRow('Security Configuration', l.categoryLevels.securityConfiguration)}
      </div>
    </div>
    <div class="cards two">
      ${card(fmt(l.cve?.count ?? null), 'Highly-Exploitable CVEs', true)}
      ${card(fmt(l.alerts.length || null), 'XDR Detections')}
      ${card(pct(l.coverageRate), 'VA Coverage')}
      ${card(fmt(l.staleAccountCount), 'Stale Accounts', true)}
    </div>
  </div>`;
  const intro = model.config.executiveSummary?.trim()
    ? paras(model.config.executiveSummary)
    : `<p>This advisory reflects the latest Trend Vision One™ pull${l.createdDateTime ? ` captured ${esc(l.createdDateTime.slice(0, 10))}` : ''}. The Cyber Risk Index and contributing categories below are read live from Attack Surface Risk Management.</p>`;
  return `<div class="page">${HEADER}
    ${shead('01', 'Executive Summary', 'Risk posture, in one read.')}
    ${dataNotice(model, 'securityPosture')}
    ${intro}
    ${hero}
    ${model.config.whatChanged?.length ? `<h3>What changed this cycle</h3>${blist(model.config.whatChanged)}` : ''}
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
    ${shead('', 'Contents', 'What this report covers.')}
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
  const lv = model.live.categoryLevels;
  const ri = model.live.riskIndex;
  const note = model.config.riskIndexNote ?? 'Scores reflect the current Vision One snapshot. The overall Cyber Risk Index is reported as a 0–100 number (lower is better); each category is reported as a risk level (low / medium / high).';
  return `<div class="page">${HEADER}
    ${shead('03', 'Risk Index Overview', 'A single number for the boardroom.')}
    ${dataNotice(model, 'securityPosture')}
    <p class="lead">The Cyber Risk Index measures organisational risk based on multiple cyber risk factors across users, devices, applications, internet-facing domains, and cloud resources. The values below are read live from the API and reflect the current snapshot.</p>
    <table class="trend">
      <thead><tr><th>Category</th><th>Current</th></tr></thead>
      <tbody>
        <tr class="rowhi"><td>Risk Index</td><td class="${ri != null && ri >= 70 ? 'worse' : ''}">${fmt(ri)}</td></tr>
        <tr><td>Exposure</td><td>${levelTag(lv.exposure)}</td></tr>
        <tr><td>Attack</td><td>${levelTag(lv.attack)}</td></tr>
        <tr><td>Security Configuration</td><td>${levelTag(lv.securityConfiguration)}</td></tr>
      </tbody>
    </table>
    <p class="muted">${esc(note)}</p>
    ${footer(pg, total)}
  </div>`;
}

function exposure(model: ReportModel, pg: number, total: number): string {
  const l = model.live;
  const e = l.exposure;
  const cveRows =
    l.internetFacingCves.length === 0
      ? `<tr><td colspan="5" class="muted">${l.errors.internetFacingCves ? 'Data unavailable.' : 'No internet-facing CVEs returned.'}</td></tr>`
      : l.internetFacingCves
          .slice(0, 8)
          .map((v) => `<tr><td>${esc(v.cveId)}</td><td class="ar">${fmt(v.cveRiskScore)}</td><td class="ar">${fmt(v.cvssScore)}</td><td class="ar">${fmt(v.affectedAssetCount)}</td><td>${esc(cap(v.globalExploitActivityLevel))}</td></tr>`)
          .join('');
  return `<div class="page">${HEADER}
    ${shead('04', 'Exposure Overview', 'Internet-facing assets, vulnerabilities, and accounts.')}
    ${dataNotice(model, 'securityPosture')}
    <div class="cards">
      ${card(pct(l.coverageRate), 'VA Coverage')}
      ${card(fmt(l.cve?.count ?? null), 'Highly-Exploitable CVEs')}
      ${card(fmt(l.cve?.density ?? null), 'CVE Density')}
      ${card(l.cve ? `${l.cve.averageUnpatchedDays}d` : DASH, 'Avg Unpatched Time')}
    </div>
    <h3>Account misconfiguration</h3>
    <table class="kv"><thead><tr><th>Weak authentication</th><th>Excessive privilege</th><th>Increases attack surface</th><th>Stale (&gt;180d)</th></tr></thead>
      <tbody><tr><td class="ar">${fmt(e?.weakAuthenticationCount ?? null)}</td><td class="ar">${fmt(e?.excessivePrivilegeCount ?? null)}</td><td class="ar">${fmt(e?.increaseAttackSurfaceRiskCount ?? null)}</td><td class="ar">${fmt(l.staleAccountCount)}</td></tr></tbody>
    </table>
    <h3>Insecure hosts &amp; internet-facing interfaces</h3>
    <table class="kv"><thead><tr><th>Insecure hosts</th><th>Connection issues</th><th>Exposed ports</th><th>Public IPs</th></tr></thead>
      <tbody><tr><td class="ar">${fmt(e?.insecureHostCount ?? null)}</td><td class="ar">${fmt(e?.connectionIssueCount ?? null)}</td><td class="ar">${fmt(e?.servicePortCount ?? null)}</td><td class="ar">${fmt(e?.publicIpCount ?? null)}</td></tr></tbody>
    </table>
    <h3>Top internet-facing CVEs</h3>
    <table class="kv"><thead><tr><th>CVE</th><th class="ar">Risk score</th><th class="ar">CVSS</th><th class="ar">Affected</th><th>Global exploit activity</th></tr></thead>
      <tbody>${cveRows}</tbody>
    </table>
    ${footer(pg, total)}
  </div>`;
}

function securityConfig(model: ReportModel, pg: number, total: number): string {
  const s = model.live.securityConfig;
  return `<div class="page">${HEADER}
    ${shead('05', 'Security Configuration Overview', 'Endpoint protection, sensors, and feature adoption.')}
    ${dataNotice(model, 'securityPosture')}
    <div class="cards">
      ${card(fmt(s?.agentAdoptionCount ?? null), 'Agent Adoption')}
      ${card(fmt(s?.edrFeatureAdoptionCount ?? null), 'EDR / XDR Adoption')}
      ${card(fmt(s?.latestCount ?? null), 'Agents on Latest')}
      ${card(fmt(s?.virtualPatched ?? null), 'CVEs Virtually Patched')}
    </div>
    <h3>Agent version status</h3>
    <table class="kv"><thead><tr><th class="ar">Latest</th><th class="ar">Outdated</th><th class="ar">Other</th></tr></thead>
      <tbody><tr><td class="ar">${fmt(s?.latestCount ?? null)}</td><td class="ar">${fmt(s?.outdatedCount ?? null)}</td><td class="ar">${fmt(s?.otherCount ?? null)}</td></tr></tbody>
    </table>
    <h3>Virtual patching coverage</h3>
    <table class="kv"><thead><tr><th class="ar">Fully patched</th><th class="ar">Partially patched</th><th class="ar">Not patched</th></tr></thead>
      <tbody><tr><td class="ar">${fmt(s?.virtualPatched ?? null)}</td><td class="ar">${fmt(s?.virtualPartial ?? null)}</td><td class="ar">${fmt(s?.virtualNot ?? null)}</td></tr></tbody>
    </table>
    ${footer(pg, total)}
  </div>`;
}

function attack(model: ReportModel, pg: number, total: number): string {
  const l = model.live;
  const alertRows =
    l.alerts.length === 0
      ? `<tr><td colspan="4" class="muted">${l.errors.alerts ? 'Data unavailable.' : 'No Workbench alerts returned for the selected window.'}</td></tr>`
      : l.alerts
          .slice(0, 12)
          .map((a) => `<tr><td>${esc(a.name)}</td><td>${esc(cap(a.severity))}${a.score != null ? ` <span class="muted">(${fmt(a.score)})</span>` : ''}</td><td>${esc(a.entity)}</td><td>${esc(a.time ? a.time.slice(0, 16).replace('T', ' ') : DASH)}</td></tr>`)
          .join('');
  const devRows =
    l.highRiskDevices.length === 0
      ? `<tr><td colspan="3" class="muted">No high-risk devices returned.</td></tr>`
      : l.highRiskDevices.slice(0, 8).map((d) => `<tr><td>${esc(d.deviceName)}</td><td class="ar">${fmt(d.riskScore)}</td><td>${esc(d.os)}</td></tr>`).join('');
  return `<div class="page">${HEADER}
    ${shead('06', 'Attack Overview', 'Detections, prioritized.')}
    <p class="lead">XDR detections and high-risk assets read live from Vision One Workbench and Attack Surface Risk Management for the reporting window.</p>
    <h3>XDR detection summary</h3>
    ${dataNotice(model, 'alerts')}
    <table class="kv"><thead><tr><th>Detection</th><th>Severity</th><th>Entity</th><th>Time (UTC)</th></tr></thead><tbody>${alertRows}</tbody></table>
    <h3>High-risk assets</h3>
    <table class="kv"><thead><tr><th>Device</th><th class="ar">Risk score</th><th>OS</th></tr></thead><tbody>${devRows}</tbody></table>
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
    const body =
      idx === 0
        ? `${shead('07', 'Recommendations & Continued Actions', 'A prioritized roadmap to lower the index.')}
           <p class="lead">Each row pairs a finding with a recommendation and a status. High-impact items should be closed before the Day 90 review; medium and low items roll into the next 90-day cycle. Findings are derived from the live pull unless overridden.</p>
           <table class="recs"><thead><tr><th>Risk</th><th>Category</th><th>Finding</th><th>Recommendation</th></tr></thead>
           <tbody>${chunk.length ? chunk.map(recRow).join('') : '<tr><td colspan="4" class="muted">No findings derived from the current data.</td></tr>'}</tbody></table>`
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
  const recPageCount = Math.max(1, Math.ceil(recommendations(model).length / 3));
  const pages = { exec: 2, contents: 3, method: 4, risk: 5, exposure: 6, secconfig: 7, attack: 8, recs: 9, cadence: 9 + recPageCount };
  const total = 9 + recPageCount;

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
