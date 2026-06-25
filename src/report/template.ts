// P4 — report.html.ts: render ReportModel -> self-contained HTML.
// Structure: Cover · Contents · §1 Executive Risk Scorecard · §2 Risk Index by Asset Group ·
// §3 High-Impact Risk Events · §4 High-Risk Devices · §5 High-Risk Users · §6 Critical CVEs ·
// §7 Most Vulnerable Devices · §8 Attack Surface Exposure · §9 Account Compromise & Anomaly ·
// §10 Security Configuration & Coverage · Meeting Schedule & Cadence.
// All data reads live from Trend Vision One (model.live).

import { REPORT_CSS } from './styles';
import type { ReportModel, InternetFacingCve } from '../types';

// ---------- formatting ----------
const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DASH = '—';
const fmt = (v: number | null | undefined): string =>
  v === null || v === undefined || Number.isNaN(v) ? DASH : Number.isInteger(v) ? v.toLocaleString('en-US') : String(v);
const pct = (v: number | null | undefined): string => (v === null || v === undefined || Number.isNaN(v) ? DASH : `${Math.round(v)}%`);
const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const day = (s?: string): string => (s ? esc(s.slice(0, 10)) : DASH);

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
const levelTag = (level?: string): string => {
  const l = (level || '').toLowerCase();
  const cls = l === 'high' || l === 'critical' ? 'high' : l === 'medium' ? 'medium' : l === 'low' ? 'low' : 'na';
  return `<span class="lvl ${cls}">${cls === 'na' ? DASH : esc(cap(level || ''))}</span>`;
};

function indexLevel(n: number | null): { key: string; label: string } {
  if (n === null || Number.isNaN(n)) return { key: 'na', label: 'No data' };
  if (n < 30) return { key: 'low', label: 'Low risk' };
  if (n < 70) return { key: 'medium', label: 'Medium risk' };
  return { key: 'high', label: 'High risk' };
}

// ---------- page chrome ----------
const HEADER = `<div class="phead">${logo()}<div class="right"><div>Cyber Risk Advisory ·</div><div>Service Overview</div></div></div>`;
const footer = (pageNum: number, total: number): string =>
  `<div class="pfoot"><span><b>TrendAI</b> Vision One™ · Cyber Risk Advisory</span><span>Page <b>${pageNum}</b> / ${total}</span></div>`;
const shead = (num: string, name: string, headline: string): string =>
  `<div class="shead"><div class="label">${num ? `<span class="num">${num}</span>` : ''}<span class="name">${esc(name)}</span></div><h1>${esc(headline)}</h1></div><div class="rule"></div>`;
const dataNotice = (model: ReportModel, key: string): string =>
  model.live.errors[key] ? `<div class="notice">⚠ Live data unavailable — ${esc(model.live.errors[key])}</div>` : '';
const page = (inner: string, pg: number, total: number): string => `<div class="page">${HEADER}${inner}${footer(pg, total)}</div>`;
const emptyRow = (cols: number, msg: string): string => `<tr><td colspan="${cols}" class="muted">${esc(msg)}</td></tr>`;
const rank = (i: number): string => `<td class="rk">${i + 1}</td>`;

// ---------- cover ----------
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

// ---------- contents ----------
const TOC: Array<[string, string, string]> = [
  ['01', 'Executive Risk Scorecard', 'Cyber Risk Index · category gauges · headline KPIs'],
  ['02', 'Risk Index by Asset Group', 'Top 10 asset groups by risk index'],
  ['03', 'High-Impact Risk Events', 'Top risk factors by events & affected assets'],
  ['04', 'High-Risk Devices', 'Top 10 devices by risk score'],
  ['05', 'High-Risk Users', 'Top 10 users by risk score'],
  ['06', 'Critical Vulnerabilities', 'Top 10 CVEs by risk / exploit activity'],
  ['07', 'Most Vulnerable Devices', 'Top 10 devices by CVE count'],
  ['08', 'Attack Surface Exposure', 'Internet-facing assets · misconfigurations'],
  ['09', 'Account Compromise & Anomaly', 'Top indicator events'],
  ['10', 'Security Configuration & Coverage', 'Adoption gaps · sensors · patching'],
];
function contents(startPage: number, pg: number, total: number): string {
  const toc = TOC.map(([n, t, d], i) => `<div class="toc-row"><span class="n">${n}</span><div><div class="t">${esc(t)}</div><div class="d">${esc(d)}</div></div><span class="pg">${String(startPage + i).padStart(2, '0')}</span></div>`).join('');
  return page(
    `${shead('', 'Contents', 'What this report covers.')}
     <p class="lead">A live Cyber Risk Advisory scorecard built from a single Trend Vision One™ pull. Each section ranks the current top contributors so remediation effort follows real risk.</p>
     <div class="toc">${toc}</div>`,
    pg,
    total,
  );
}

// ---------- §1 Executive Risk Scorecard ----------
function scorecard(model: ReportModel, pg: number, total: number): string {
  const l = model.live;
  const lvl = indexLevel(l.riskIndex);
  const catRow = (name: string, level: string) => `<div class="catrow"><span>${name}</span>${levelTag(level)}</div>`;
  const kpi = (label: string, value: string) => `<tr><td>${esc(label)}</td><td class="ar">${esc(value)}</td></tr>`;
  return page(
    `${shead('01', 'Executive Risk Scorecard', 'Risk posture, in one read.')}
     ${dataNotice(model, 'securityPosture')}
     ${model.config.executiveSummary?.trim() ? paras(model.config.executiveSummary) : ''}
     <div class="riskhero">
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
       <div>
         <h3 style="margin-top:0">Headline KPIs</h3>
         <table class="kv"><tbody>
           ${kpi('Mean Time To Patch', l.cve?.mttpDays != null ? `${l.cve.mttpDays} days` : DASH)}
           ${kpi('Average Unpatched Time', l.cve ? `${l.cve.averageUnpatchedDays} days` : DASH)}
           ${kpi('Vulnerability Assessment Coverage', pct(l.coverageRate))}
           ${kpi('Vulnerable Endpoint Rate', l.cve ? pct(l.cve.vulnerableEndpointRate) : DASH)}
           ${kpi('Legacy OS Endpoints', fmt(l.cve?.legacyOsEndpointCount ?? null))}
         </tbody></table>
       </div>
     </div>
     ${model.config.whatChanged?.length ? `<h3>What changed this cycle</h3>${blist(model.config.whatChanged)}` : ''}`,
    pg,
    total,
  );
}

// ---------- §2 Risk Index by Asset Group ----------
function assetGroups(model: ReportModel, pg: number, total: number): string {
  const rows = model.live.assetGroups.slice(0, 10);
  const body = rows.length === 0 ? emptyRow(5, 'No asset groups returned.') : rows.map((g, i) => `<tr>${rank(i)}<td>${esc(g.name)}</td><td class="ar">${fmt(g.assetCount ?? null)}</td><td class="ar">${fmt(g.riskIndex ?? null)}</td><td>${levelTag(g.riskLevel)}</td></tr>`).join('');
  return page(
    `${shead('02', 'Risk Index by Asset Group', 'Where the risk concentrates.')}
     <table class="kv"><thead><tr><th class="rk">#</th><th>Asset group</th><th class="ar">Assets</th><th class="ar">Risk index</th><th>Risk level</th></tr></thead><tbody>${body}</tbody></table>`,
    pg,
    total,
  );
}

// ---------- §3 High-Impact Risk Events ----------
function riskEvents(model: ReportModel, pg: number, total: number): string {
  const rows = model.live.riskEvents.slice().sort((a, b) => b.affectedAssetCount - a.affectedAssetCount).slice(0, 10);
  const body = rows.length === 0 ? emptyRow(4, 'No high-impact risk events returned.') : rows.map((e, i) => `<tr>${rank(i)}<td>${esc(e.factor)}</td><td class="ar">${fmt(e.eventCount)}</td><td class="ar">${fmt(e.affectedAssetCount)}</td></tr>`).join('');
  return page(
    `${shead('03', 'High-Impact Risk Events', 'What is driving the index.')}
     <table class="kv"><thead><tr><th class="rk">#</th><th>Risk factor</th><th class="ar">Events</th><th class="ar">Affected assets</th></tr></thead><tbody>${body}</tbody></table>`,
    pg,
    total,
  );
}

// ---------- §4 High-Risk Devices ----------
function highRiskDevices(model: ReportModel, pg: number, total: number): string {
  const rows = model.live.highRiskDevices.slice(0, 10);
  const body = rows.length === 0 ? emptyRow(6, 'No high-risk devices returned.') : rows.map((d, i) => `<tr>${rank(i)}<td>${esc(d.deviceName)}</td><td>${esc(d.os)}</td><td class="ar">${fmt(d.riskScore)}</td><td>${esc(d.lastLogonUser || DASH)}</td><td>${esc(Array.isArray(d.ip) ? d.ip.join(', ') : DASH)}</td></tr>`).join('');
  return page(
    `${shead('04', 'High-Risk Devices', 'Top 10 devices by risk score.')}
     <table class="kv"><thead><tr><th class="rk">#</th><th>Device</th><th>OS</th><th class="ar">Risk</th><th>Last logon user</th><th>IP</th></tr></thead><tbody>${body}</tbody></table>`,
    pg,
    total,
  );
}

// ---------- §5 High-Risk Users ----------
function highRiskUsers(model: ReportModel, pg: number, total: number): string {
  const rows = model.live.highRiskUsers.slice(0, 10);
  const body = rows.length === 0 ? emptyRow(4, 'No high-risk users returned.') : rows.map((u, i) => `<tr>${rank(i)}<td>${esc(u.userName)}</td><td>${esc(u.userPrincipalName || DASH)}</td><td class="ar">${fmt(u.riskScore)}</td></tr>`).join('');
  return page(
    `${shead('05', 'High-Risk Users', 'Top 10 users by risk score.')}
     <table class="kv"><thead><tr><th class="rk">#</th><th>User</th><th>UPN</th><th class="ar">Risk score</th></tr></thead><tbody>${body}</tbody></table>`,
    pg,
    total,
  );
}

// ---------- §6 Critical Vulnerabilities (CVE) ----------
function criticalCves(model: ReportModel, pg: number, total: number): string {
  const merged = new Map<string, InternetFacingCve>();
  for (const v of [...model.live.internalCves, ...model.live.internetFacingCves]) {
    const prev = merged.get(v.cveId);
    if (!prev || (v.cveRiskScore ?? 0) > (prev.cveRiskScore ?? 0)) merged.set(v.cveId, v);
  }
  const rows = [...merged.values()].sort((a, b) => (b.cveRiskScore ?? 0) - (a.cveRiskScore ?? 0)).slice(0, 10);
  const body = rows.length === 0 ? emptyRow(6, model.live.errors.internalCves ? 'Data unavailable.' : 'No CVEs returned.') : rows.map((v, i) => `<tr>${rank(i)}<td>${esc(v.cveId)}</td><td class="ar">${fmt(v.cvssScore)}</td><td>${esc(cap(v.globalExploitActivityLevel))}</td><td class="ar">${fmt(v.affectedAssetCount)}</td><td class="ar">${fmt(v.cveRiskScore)}</td></tr>`).join('');
  return page(
    `${shead('06', 'Critical Vulnerabilities', 'Top 10 CVEs by risk.')}
     <table class="kv"><thead><tr><th class="rk">#</th><th>CVE</th><th class="ar">CVSS</th><th>Exploit activity</th><th class="ar">Affected</th><th class="ar">Risk score</th></tr></thead><tbody>${body}</tbody></table>`,
    pg,
    total,
  );
}

// ---------- §7 Most Vulnerable Devices ----------
function vulnerableDevices(model: ReportModel, pg: number, total: number): string {
  const rows = model.live.vulnerableDevices.slice(0, 10);
  const body = rows.length === 0 ? emptyRow(5, 'No vulnerable devices returned.') : rows.map((d, i) => `<tr>${rank(i)}<td>${esc(d.deviceName)}</td><td>${levelTag(d.criticality)}</td><td class="ar">${fmt(d.cveCount)}</td><td>${day(d.lastScannedDateTime)}</td></tr>`).join('');
  return page(
    `${shead('07', 'Most Vulnerable Devices', 'Top 10 devices by CVE count.')}
     <table class="kv"><thead><tr><th class="rk">#</th><th>Device</th><th>Criticality</th><th class="ar">CVE count</th><th>Last scanned</th></tr></thead><tbody>${body}</tbody></table>`,
    pg,
    total,
  );
}

// ---------- §8 Attack Surface Exposure ----------
function attackSurface(model: ReportModel, pg: number, total: number): string {
  const l = model.live;
  // 8a internet-facing assets: FQDNs + public IPs
  const ifaces = [
    ...l.globalFqdns.map((f) => ({ name: f.fqdn, svc: Array.isArray(f.services) ? f.services.length : 0, risk: f.latestRiskScore, crit: f.criticality })),
    ...l.publicIps.map((p) => ({ name: p.ipAddress, svc: Array.isArray(p.services) ? p.services.length : 0, risk: p.latestRiskScore, crit: p.criticality })),
  ]
    .sort((a, b) => (b.risk ?? 0) - (a.risk ?? 0))
    .slice(0, 10);
  const ifaceBody = ifaces.length === 0 ? emptyRow(5, 'No internet-facing assets returned.') : ifaces.map((a, i) => `<tr>${rank(i)}<td>${esc(a.name)}</td><td class="ar">${fmt(a.svc)}</td><td class="ar">${fmt(a.risk ?? null)}</td><td>${levelTag(a.crit)}</td></tr>`).join('');

  // 8b misconfigurations: cloud assets + synthesized account/port issues
  const e = l.exposure;
  const misc: Array<{ asset: string; issue: string; level: string }> = [
    ...l.cloudAssets.slice(0, 6).map((c) => ({ asset: c.assetName, issue: 'Cloud misconfiguration', level: c.criticality || 'medium' })),
  ];
  if (e) {
    if (e.weakAuthenticationCount > 0) misc.push({ asset: `${fmt(e.weakAuthenticationCount)} account(s)`, issue: 'Weak authentication', level: 'medium' });
    if (e.excessivePrivilegeCount > 0) misc.push({ asset: `${fmt(e.excessivePrivilegeCount)} account(s)`, issue: 'Excessive privilege', level: 'high' });
    if (e.servicePortCount > 0) misc.push({ asset: `${fmt(e.servicePortCount)} port(s)`, issue: 'Unexpected internet-facing ports', level: 'medium' });
  }
  const miscBody = misc.length === 0 ? emptyRow(4, 'No misconfigurations returned.') : misc.slice(0, 10).map((m, i) => `<tr>${rank(i)}<td>${esc(m.asset)}</td><td>${esc(m.issue)}</td><td>${levelTag(m.level)}</td></tr>`).join('');

  return page(
    `${shead('08', 'Attack Surface Exposure', 'Reachable assets & misconfigurations.')}
     <h3>Internet-facing assets</h3>
     <table class="kv"><thead><tr><th class="rk">#</th><th>FQDN / public IP</th><th class="ar">Open services</th><th class="ar">Risk score</th><th>Criticality</th></tr></thead><tbody>${ifaceBody}</tbody></table>
     <h3>Misconfigurations</h3>
     <table class="kv"><thead><tr><th class="rk">#</th><th>Asset / account</th><th>Issue type</th><th>Risk level</th></tr></thead><tbody>${miscBody}</tbody></table>`,
    pg,
    total,
  );
}

// ---------- §9 Account Compromise & Anomaly ----------
function indicatorEvents(model: ReportModel, pg: number, total: number): string {
  const rows = model.live.riskIndicatorEvents.slice(0, 10);
  const body = rows.length === 0 ? emptyRow(6, 'No account-compromise or anomaly events returned.') : rows.map((e, i) => `<tr>${rank(i)}<td>${esc(e.name)}</td><td>${esc(e.kind)}</td><td>${levelTag(e.riskLevel)}</td><td>${esc(e.assetName || DASH)}</td><td>${day(e.detectedDateTime)}</td></tr>`).join('');
  return page(
    `${shead('09', 'Account Compromise & Anomaly', 'Identity & behavioural indicators.')}
     <table class="kv"><thead><tr><th class="rk">#</th><th>Indicator</th><th>Type</th><th>Risk level</th><th>Affected asset</th><th>Detected</th></tr></thead><tbody>${body}</tbody></table>`,
    pg,
    total,
  );
}

// ---------- §10 Security Configuration & Coverage ----------
function securityConfig(model: ReportModel, pg: number, total: number): string {
  const s = model.live.securityConfig;
  const featRows = (s?.featureAdoption ?? []).slice(0, 10);
  const featBody = featRows.length === 0 ? emptyRow(3, 'No feature-adoption data.') : featRows.map((f, i) => `<tr>${rank(i)}<td>${esc(f.feature)}</td><td class="ar">${pct(f.adoptionRate)}</td></tr>`).join('');
  return page(
    `${shead('10', 'Security Configuration & Coverage', 'Adoption gaps that lower risk fast.')}
     ${dataNotice(model, 'securityPosture')}
     <div class="cards">
       ${card(fmt(s?.agentAdoptionCount ?? null), 'Agent Adoption')}
       ${card(fmt(s?.edrFeatureAdoptionCount ?? null), 'EDR / XDR Adoption')}
       ${card(`${fmt(s?.latestCount ?? null)} / ${fmt(s?.outdatedCount ?? null)}`, 'Agents Latest / Outdated')}
       ${card(`${fmt(s?.virtualPatched ?? null)} / ${fmt(s?.virtualNot ?? null)}`, 'Virtual Patch: Full / None')}
     </div>
     <h3>Top 10 lowest feature adoption</h3>
     <table class="kv"><thead><tr><th class="rk">#</th><th>Security feature</th><th class="ar">Adoption</th></tr></thead><tbody>${featBody}</tbody></table>
     <h3>Sensor &amp; app coverage</h3>
     <table class="kv"><thead><tr><th>Channel / app</th><th class="ar">Enabled / sanctioned</th><th class="ar">Total / unsanctioned</th></tr></thead><tbody>
       <tr><td>Exchange Online mailboxes</td><td class="ar">${fmt(s?.emailExchangeEnabled ?? null)}</td><td class="ar">${fmt(s?.emailExchangeTotal ?? null)}</td></tr>
       <tr><td>Gmail mailboxes</td><td class="ar">${fmt(s?.emailGmailEnabled ?? null)}</td><td class="ar">${fmt(s?.emailGmailTotal ?? null)}</td></tr>
       <tr><td>Cloud apps (sanctioned / unsanctioned)</td><td class="ar">${fmt(s?.sanctionedAppCount ?? null)}</td><td class="ar">${fmt(s?.unsanctionedAppCount ?? null)}</td></tr>
     </tbody></table>`,
    pg,
    total,
  );
}

// ---------- Meeting schedule & cadence ----------
function cadence(model: ReportModel, pg: number, total: number): string {
  const rows =
    model.config.sessions.length === 0
      ? emptyRow(4, 'No sessions scheduled.')
      : model.config.sessions
          .map((s, i) => {
            const last = i === model.config.sessions.length - 1 && s.status === 'Upcoming';
            return `<tr class="${last ? 'rowhi' : ''}"><td>${esc(s.label)}</td><td class="date">${esc(s.date || DASH)}</td><td>${esc(s.time || DASH)}</td><td class="st-${esc(s.status)}">${esc(s.status)}</td></tr>`;
          })
          .join('');
  return page(
    `${shead('', 'Meeting Schedule & Cadence', 'Day 1, 30, 60, 90.')}
     <p class="lead">Each session reviews the same scorecard so progress is directly comparable cycle-over-cycle. Continued actions are tracked between sessions and reported back at the next review.</p>
     <table class="cad"><thead><tr><th>Session</th><th>Date</th><th>Time</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
     <div class="callout"><div class="e">AI Fearlessly</div><div class="t">Continuous risk advisory — telemetry to action, every 30 days.</div></div>
     <div class="copyright">© 2026 TrendAI™. All rights reserved. TrendAI Vision One™ and the Trend Spark are trademarks of TrendAI.</div>`,
    pg,
    total,
  );
}

export function renderReport(model: ReportModel): string {
  // cover(1) + contents(2) + 10 sections (3..12) + cadence(13)
  const SECTION_START = 3;
  const total = 13;
  const sections = [scorecard, assetGroups, riskEvents, highRiskDevices, highRiskUsers, criticalCves, vulnerableDevices, attackSurface, indicatorEvents, securityConfig];
  const body = [
    cover(model),
    contents(SECTION_START, 2, total),
    ...sections.map((fn, i) => fn(model, SECTION_START + i, total)),
    cadence(model, total, total),
  ].join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cyber Risk Advisory — ${esc(model.config.customerName)}</title>
<style>${REPORT_CSS}</style></head>
<body>${body}</body></html>`;
}
