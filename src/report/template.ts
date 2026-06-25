// P4 — report.html.ts: render ReportModel -> self-contained HTML string matching report-reference.pdf.
// 8 numbered sections, trend table, recommendations table, A4 page breaks, footer page numbers.

import { REPORT_CSS } from './styles';
import type { ReportModel, Finding, PriorPeriod } from '../types';

// ---------- formatting helpers ----------
const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const dash = '—';
const num = (v: number | null | undefined, digits = 0): string =>
  v === null || v === undefined || Number.isNaN(v) ? dash : v.toFixed(digits).replace(/\.0+$/, '');
const pct = (v: number | null | undefined): string =>
  v === null || v === undefined || Number.isNaN(v) ? dash : `${num(v, 1)}%`;

const pill = (level: string): string => {
  const l = level.toLowerCase();
  const cls = ['high', 'medium', 'low'].includes(l) ? l : 'unknown';
  return `<span class="pill ${cls}">${esc(level)}</span>`;
};

const bullets = (items: string[]): string =>
  items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '';

const paras = (text: string): string =>
  esc(text)
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('') || `<p class="muted">No content provided.</p>`;

const unavailable = (key: string, errors: Record<string, string>): string =>
  errors[key]
    ? `<div class="notice">⚠ Data unavailable for this section — the live API call failed (${esc(errors[key])}).</div>`
    : '';

// Day 1 / 30 / 60 / 90 trend row. Prior periods are manual; latest is live.
function trendRow(label: string, prior: PriorPeriod | undefined, latest: string): string {
  return `<tr>
    <td>${esc(label)}</td>
    <td>${prior?.day1 != null ? num(prior.day1) : dash}</td>
    <td>${prior?.day30 != null ? num(prior.day30) : dash}</td>
    <td>${prior?.day60 != null ? num(prior.day60) : dash}</td>
    <td><strong>${latest}</strong></td>
  </tr>`;
}

function footer(pageLabel: string, model: ReportModel): string {
  return `<div class="footer">
    <span>Cyber Risk Advisory · ${esc(model.config.customerName)} · ${esc(model.config.engagement.cycleLabel)}</span>
    <span>${esc(pageLabel)} · Generated ${esc(model.generatedAt.slice(0, 10))}</span>
  </div>`;
}

// ---------- cover ----------
function cover(model: ReportModel): string {
  const c = model.config;
  return `<div class="page cover">
    <div class="cover-accent"></div>
    <div class="cover-body">
      <div class="brand"><span class="dot"></span> TrendAI</div>
      <h1>Cyber Risk<br>Advisory</h1>
      <div class="subtitle">${esc(c.engagement.cycleLabel)}</div>
      <div class="cover-meta">
        <div><div class="k">Prepared for</div><div class="v">${esc(c.customerName)}</div></div>
        <div><div class="k">Document ID</div><div class="v">${esc(c.engagement.docId || dash)}</div></div>
        <div><div class="k">Region</div><div class="v">${esc(c.region.toUpperCase())}</div></div>
        <div><div class="k">Generated</div><div class="v">${esc(model.generatedAt.slice(0, 10))}</div></div>
      </div>
    </div>
  </div>`;
}

// ---------- 01 Executive Summary ----------
function execSummary(model: ReportModel): string {
  const l = model.live;
  const cards = `<div class="cards">
    <div class="card"><div class="label">Risk Index</div><div class="value accent">${num(l.riskIndex)}</div><div class="sub">overall, latest pull</div></div>
    <div class="card"><div class="label">Mean Time to Patch</div><div class="value">${num(l.cve?.mttpDays ?? null, 1)}</div><div class="sub">days (MTTP)</div></div>
    <div class="card"><div class="label">VA Coverage</div><div class="value">${pct(l.coverageRate)}</div><div class="sub">assessed endpoints</div></div>
    <div class="card"><div class="label">Highly-Exploitable CVEs</div><div class="value">${num(l.cve?.count ?? null)}</div><div class="sub">unique detections</div></div>
  </div>`;
  return `<div class="page">
    <div class="section-head"><span class="section-num">01</span><span class="section-title">Executive Summary</span></div>
    ${unavailable('securityPosture', model.errors)}
    ${cards}
    ${paras(model.config.executiveSummary)}
    <h3>What changed this cycle</h3>
    ${bullets(model.config.whatChanged)}
    ${footer('Section 01', model)}
  </div>`;
}

// ---------- 02 Engagement Overview ----------
function engagementOverview(model: ReportModel): string {
  const c = model.config;
  return `<div class="page">
    <div class="section-head"><span class="section-num">02</span><span class="section-title">Engagement Overview &amp; Scope</span></div>
    <table>
      <tbody>
        <tr><th style="width:30%">Customer</th><td>${esc(c.customerName)}</td></tr>
        <tr><th>Reporting cycle</th><td>${esc(c.engagement.cycleLabel)}</td></tr>
        <tr><th>Document ID</th><td>${esc(c.engagement.docId || dash)}</td></tr>
        <tr><th>Vision One region</th><td>${esc(c.region.toUpperCase())}</td></tr>
        <tr><th>Data captured</th><td>${esc(model.live.createdDateTime || model.generatedAt)}</td></tr>
      </tbody>
    </table>
    <h3>Data sources &amp; notes</h3>
    ${c.dataSourceNotes ? paras(c.dataSourceNotes) : '<p class="muted">Trend Vision One — Attack Surface Risk Management, Workbench, and Endpoint Inventory. No data-source exclusions noted this cycle.</p>'}
    <p class="muted">This advisory is generated on demand from a single live Vision One pull. Prior-period values in the trend table are entered manually; no historical snapshots are stored.</p>
    ${footer('Section 02', model)}
  </div>`;
}

// ---------- 03 Risk Index Overview ----------
function riskIndexOverview(model: ReportModel): string {
  const c = model.config;
  const l = model.live;
  const pc = c.priorCategory ?? {};
  return `<div class="page">
    <div class="section-head"><span class="section-num">03</span><span class="section-title">Risk Index Overview</span></div>
    ${unavailable('securityPosture', model.errors)}
    <p class="lead">Overall Risk Index is reported as a number; category risk is reported by Vision One as a level (low / medium / high). Prior-period columns are manual inputs.</p>
    <table class="trend">
      <thead><tr><th>Metric</th><th>Day 1</th><th>Day 30</th><th>Day 60</th><th>Day 90 (latest)</th></tr></thead>
      <tbody>
        ${trendRow('Risk Index (overall)', c.priorRiskIndex, num(l.riskIndex))}
        ${trendRow('Exposure', pc.exposure, pill(l.categoryLevels.exposure))}
        ${trendRow('Attack', pc.attack, pill(l.categoryLevels.attack))}
        ${trendRow('Security Configuration', pc.securityConfiguration, pill(l.categoryLevels.securityConfiguration))}
      </tbody>
    </table>
    ${footer('Section 03', model)}
  </div>`;
}

// ---------- 04 Exposure Overview ----------
function exposureOverview(model: ReportModel): string {
  const l = model.live;
  const ex = l.exposure;
  const da = ex?.domainAccountMisconfigurationStatus;
  const ih = ex?.insecureHostConnectionStatus;
  const ufi = ex?.unexpectedInternetFacingInterfaceStatus;

  const cveRows =
    l.internetFacingCves.length === 0
      ? `<tr><td colspan="5" class="muted">No internet-facing CVEs returned.</td></tr>`
      : l.internetFacingCves
          .slice(0, 12)
          .map(
            (v) => `<tr>
              <td>${esc(v.cveId)}</td>
              <td class="num">${num(v.cveRiskScore)}</td>
              <td class="num">${num(v.cvssScore, 1)}</td>
              <td class="num">${num(v.affectedAssetCount)}</td>
              <td>${pill(v.globalExploitActivityLevel)}</td>
            </tr>`,
          )
          .join('');

  return `<div class="page">
    <div class="section-head"><span class="section-num">04</span><span class="section-title">Exposure Overview</span></div>
    ${unavailable('securityPosture', model.errors)}
    <div class="cards">
      <div class="card"><div class="label">VA Coverage</div><div class="value">${pct(l.coverageRate)}</div></div>
      <div class="card"><div class="label">CVE Density</div><div class="value">${num(l.cve?.density ?? null, 1)}</div></div>
      <div class="card"><div class="label">Avg Unpatched</div><div class="value">${num(l.cve?.averageUnpatchedDays ?? null, 1)}</div><div class="sub">days</div></div>
      <div class="card"><div class="label">Legacy OS Endpoints</div><div class="value">${num(l.cve?.legacyOsEndpointCount ?? null)}</div></div>
    </div>

    <h3>Domain account misconfiguration</h3>
    <table>
      <thead><tr><th>Weak authentication</th><th>Excessive privilege</th><th>Increases attack surface</th><th>Stale accounts (&gt;180d)</th></tr></thead>
      <tbody><tr>
        <td class="num">${num(da?.weakAuthenticationCount ?? null)}</td>
        <td class="num">${num(da?.excessivePrivilegeCount ?? null)}</td>
        <td class="num">${num(da?.increaseAttackSurfaceRiskCount ?? null)}</td>
        <td class="num">${num(l.staleAccountCount)}${model.errors.domainAccounts ? ' *' : ''}</td>
      </tr></tbody>
    </table>
    ${model.errors.domainAccounts ? '<div class="notice">⚠ Stale-account count unavailable — domain accounts call failed.</div>' : ''}

    <h3>Insecure hosts &amp; internet-facing interfaces</h3>
    <table>
      <thead><tr><th>Insecure hosts</th><th>Connection issues</th><th>Exposed service ports</th><th>Public IPs</th></tr></thead>
      <tbody><tr>
        <td class="num">${num(ih?.insecureHostCount ?? null)}</td>
        <td class="num">${num(ih?.connectionIssueCount ?? null)}</td>
        <td class="num">${num(ufi?.servicePortCount ?? null)}</td>
        <td class="num">${num(ufi?.publicIpCount ?? null)}</td>
      </tr></tbody>
    </table>

    <h3>Top internet-facing CVEs</h3>
    ${unavailable('internetFacingCves', model.errors)}
    <table>
      <thead><tr><th>CVE</th><th class="num">Risk score</th><th class="num">CVSS</th><th class="num">Affected assets</th><th>Global exploit activity</th></tr></thead>
      <tbody>${cveRows}</tbody>
    </table>
    ${footer('Section 04', model)}
  </div>`;
}

// ---------- 05 Security Configuration ----------
function securityConfiguration(model: ReportModel): string {
  const sc = model.live.securityConfig;
  const agent = sc?.endpointAgentStatus;
  const ver = agent?.agentVersionStatus;
  const vp = sc?.virtualPatchingStatus;
  const email = sc?.emailSensorStatus;
  const cloud = sc?.cloudAppsStatus;

  return `<div class="page">
    <div class="section-head"><span class="section-num">05</span><span class="section-title">Security Configuration</span></div>
    ${unavailable('securityPosture', model.errors)}
    <div class="cards">
      <div class="card"><div class="label">Agent Adoption</div><div class="value">${num(agent?.agentAdoptionCount ?? null)}</div></div>
      <div class="card"><div class="label">EDR Feature Adoption</div><div class="value">${num(agent?.edrFeatureAdoptionCount ?? null)}</div></div>
      <div class="card"><div class="label">Agents Latest</div><div class="value">${num(ver?.latestCount ?? null)}</div><div class="sub">${num(ver?.outdatedCount ?? null)} outdated</div></div>
      <div class="card"><div class="label">Virtual Patching</div><div class="value">${num(vp?.patchedCount ?? null)}</div><div class="sub">CVEs fully patched</div></div>
    </div>

    <h3>Email sensor coverage</h3>
    <table>
      <thead><tr><th>Channel</th><th class="num">Enabled mailboxes</th><th class="num">Total mailboxes</th></tr></thead>
      <tbody>
        <tr><td>Exchange Online</td><td class="num">${num(email?.exchange.enabledMailboxCount ?? null)}</td><td class="num">${num(email?.exchange.totalMailboxCount ?? null)}</td></tr>
        <tr><td>Gmail</td><td class="num">${num(email?.gmail.enabledMailboxCount ?? null)}</td><td class="num">${num(email?.gmail.totalMailboxCount ?? null)}</td></tr>
      </tbody>
    </table>

    <h3>Cloud apps</h3>
    <table>
      <thead><tr><th class="num">Sanctioned apps</th><th class="num">Unsanctioned apps</th><th class="num">Virtual patching (partial / none)</th></tr></thead>
      <tbody><tr>
        <td class="num">${num(cloud?.sanctionedAppCount ?? null)}</td>
        <td class="num">${num(cloud?.unsanctionedAppCount ?? null)}</td>
        <td class="num">${num(vp?.partialPatchedCount ?? null)} / ${num(vp?.notPatchedCount ?? null)}</td>
      </tr></tbody>
    </table>
    ${footer('Section 05', model)}
  </div>`;
}

// ---------- 06 Attack Overview ----------
function attackOverview(model: ReportModel): string {
  const l = model.live;
  const alertRows =
    l.alerts.length === 0
      ? `<tr><td colspan="4" class="muted">No Workbench alerts returned for the selected range.</td></tr>`
      : l.alerts
          .slice(0, 15)
          .map(
            (a) => `<tr>
              <td>${esc(a.name)}</td>
              <td>${pill(a.severity)}${a.score != null ? ` <span class="muted">(${num(a.score)})</span>` : ''}</td>
              <td>${esc(a.entity)}</td>
              <td>${esc(a.time ? a.time.slice(0, 16).replace('T', ' ') : dash)}</td>
            </tr>`,
          )
          .join('');

  const deviceRows =
    l.highRiskDevices.length === 0
      ? `<tr><td colspan="3" class="muted">No high-risk devices returned.</td></tr>`
      : l.highRiskDevices
          .slice(0, 10)
          .map(
            (d) => `<tr><td>${esc(d.deviceName)}</td><td class="num">${num(d.riskScore)}</td><td>${esc(d.os)}</td></tr>`,
          )
          .join('');

  return `<div class="page">
    <div class="section-head"><span class="section-num">06</span><span class="section-title">Attack Overview</span></div>
    <h3>Top Workbench detections</h3>
    ${unavailable('alerts', model.errors)}
    <table>
      <thead><tr><th>Detection</th><th>Severity</th><th>Entity</th><th>Time (UTC)</th></tr></thead>
      <tbody>${alertRows}</tbody>
    </table>
    <h3>High-risk assets</h3>
    ${unavailable('highRiskDevices', model.errors)}
    <table>
      <thead><tr><th>Device</th><th class="num">Risk score</th><th>OS</th></tr></thead>
      <tbody>${deviceRows}</tbody>
    </table>
    ${footer('Section 06', model)}
  </div>`;
}

// ---------- 07 Recommendations ----------
function recommendations(model: ReportModel): string {
  const findings: Finding[] = model.config.recommendationsOverride?.length
    ? model.config.recommendationsOverride
    : deriveRecommendations(model);

  const rows =
    findings.length === 0
      ? `<tr><td colspan="5" class="muted">No recommendations recorded.</td></tr>`
      : findings
          .map(
            (f) => `<tr>
              <td class="rec-risk ${esc(f.riskLevel)}"><strong>${esc(f.riskLevel)}</strong></td>
              <td>${esc(f.category)}</td>
              <td><strong>${esc(f.title)}</strong>${bullets(f.detail)}</td>
              <td>${bullets(f.recommendation)}</td>
              <td>${esc(f.status)}</td>
            </tr>`,
          )
          .join('');

  return `<div class="page">
    <div class="section-head"><span class="section-num">07</span><span class="section-title">Recommendations</span></div>
    <table>
      <thead><tr><th style="width:9%">Risk</th><th style="width:14%">Category</th><th style="width:34%">Finding</th><th style="width:33%">Recommendation</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${footer('Section 07', model)}
  </div>`;
}

// Lightweight, transparent derivation from live data — only used when the user
// supplies no recommendationsOverride. Never asserts narrative as fact (cra.md §2.3).
function deriveRecommendations(model: ReportModel): Finding[] {
  const out: Finding[] = [];
  const l = model.live;
  if (l.cve && l.cve.count > 0) {
    out.push({
      riskLevel: l.cve.count > 100 ? 'High' : 'Medium',
      category: 'Exposure',
      title: `${l.cve.count} highly-exploitable CVEs detected`,
      detail: [`Average unpatched time ${num(l.cve.averageUnpatchedDays, 1)} days`, `CVE density ${num(l.cve.density, 1)}`],
      recommendation: ['Prioritise patching of internet-facing assets', 'Enable virtual patching where patches are unavailable'],
      status: 'Open',
    });
  }
  if (l.staleAccountCount && l.staleAccountCount > 0) {
    out.push({
      riskLevel: 'Medium',
      category: 'Exposure',
      title: `${l.staleAccountCount} stale domain accounts (>180 days)`,
      detail: ['Inactive accounts widen the attack surface'],
      recommendation: ['Review and disable inactive accounts', 'Enforce account lifecycle policy'],
      status: 'Open',
    });
  }
  if (l.alerts.length > 0) {
    out.push({
      riskLevel: 'High',
      category: 'Attack',
      title: `${l.alerts.length} Workbench detections in the reporting window`,
      detail: [`Top: ${esc(l.alerts[0].name)}`],
      recommendation: ['Investigate and close out high-severity Workbench alerts'],
      status: 'In progress',
    });
  }
  return out;
}

// ---------- 08 Engagement Cadence ----------
function cadence(model: ReportModel): string {
  const rows =
    model.config.sessions.length === 0
      ? `<tr><td colspan="4" class="muted">No sessions scheduled.</td></tr>`
      : model.config.sessions
          .map(
            (s) => `<tr>
              <td>${esc(s.label)}</td>
              <td>${esc(s.date || dash)}</td>
              <td>${esc(s.time || dash)}</td>
              <td>${pill(s.status === 'Completed' ? 'low' : 'medium')} ${esc(s.status)}</td>
            </tr>`,
          )
          .join('');
  return `<div class="page">
    <div class="section-head"><span class="section-num">08</span><span class="section-title">Engagement Cadence</span></div>
    <table>
      <thead><tr><th>Session</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${footer('Section 08', model)}
  </div>`;
}

export function renderReport(model: ReportModel): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cyber Risk Advisory — ${esc(model.config.customerName)}</title>
<style>${REPORT_CSS}</style>
</head>
<body>
${cover(model)}
${execSummary(model)}
${engagementOverview(model)}
${riskIndexOverview(model)}
${exposureOverview(model)}
${securityConfiguration(model)}
${attackOverview(model)}
${recommendations(model)}
${cadence(model)}
</body>
</html>`;
}
