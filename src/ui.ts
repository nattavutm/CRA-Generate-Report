// §10 — single-page generate form served at GET /. No localStorage.
// Pre-filled with the reference sample so output matches CyberRiskAdvisoryService.pdf out of the box.
// Builds a ReportConfig client-side and POSTs to /api/report (PDF) or /api/preview (HTML).

export function renderForm(regions: string[], defaultRegion: string): string {
  const regionOptions = regions
    .map((r) => `<option value="${r}"${r === defaultRegion ? ' selected' : ''}>${r.toUpperCase()}</option>`)
    .join('');

  // Client script. NOTE: backticks and ${ } are escaped (\` , \${) so they survive server-side interpolation.
  const script = `
const D = {
  customerName: '', region: '${defaultRegion}',
  cycleLabel: '90-Day Cycle · 4 Sessions', docId: 'CRA-2026 · v1.0',
  coverTitle: 'Service Overview &\\nReporting',
  coverSubtitle: 'A continuous, AI-driven engagement that turns telemetry into prioritized action — measuring exposure, attack activity, and security configuration across your environment every 30 days.',
  executiveSummary: 'Customer faces a medium overall risk and is currently trending above the industry average. Exposure on internet-facing surfaces and weak account hygiene are the largest contributors; recent data-source cleanup has produced a much sharper view of what actually needs attention.',
  hero: [
    { value: '64', label: 'Risk Index — Day 60', accent: true },
    { value: '−83%', label: 'Vulnerabilities Reduced', accent: false },
    { value: '12d', label: 'Mean Time to Patch', accent: false },
    { value: '4,507', label: 'Stale Accounts', accent: true }
  ],
  whatChanged: [
    'Detected vulnerabilities dropped from 24,000+ to 4,600 after removing Qualys from the data sources, giving a more accurate picture of remediable risk.',
    'Mean Time To Patch improved from 30 days at Day 1 to roughly 12 days at Day 60 — a structural improvement, not a one-off.',
    'Three extra administrative accounts have been removed (12 → 9); two highly-authorised disabled accounts still need review.',
    'SSL/TLS certificate hygiene and weak/deprecated protocols on internet-facing domains remain the top exposure to address.'
  ].join('\\n'),
  trend: {
    riskIndex: { day1: 56, day60: 57, day90: 64 },
    exposure: { day1: 68, day60: 63, day90: 69 },
    attack: { day1: 67, day60: 65, day90: 73 },
    securityConfiguration: { day1: 61, day60: 63, day90: 63 }
  },
  exposure: {
    narrative: 'The score for Exposure Overview has been consistent for the past months, ranging between 62 and 69. Vulnerability assessment coverage is now more accurate after disabling Qualys; as of January, 39% of assets have Trend Micro vulnerability assessment coverage.',
    subNarrative: 'After disabling Qualys and purging backend data, detected vulnerabilities dropped from 24K+ to just over 4K. This improvement provides a more accurate view of the environment — only vulnerable devices within Trend Micro coverage are now identified. Improvement in MTTP has been observed over the past three months, starting at 30 days in the first session and improving to around 12 days. Legacy operating systems (Windows 2008, 2012, 2016, 2019; CentOS 7; RHEL 8 4.18; Cisco IOS 11–15) have reached end-of-life and no longer receive security updates from the vendor.',
    findings: [
      'Accounts with weak authentication — started with 9; 6 accounts still have password expiration disabled.',
      'Hosts with insecure connection issues — most show SSL/TLS Certificate Expired or use weak/deprecated protocols.',
      'Extra administrative accounts — 3 removed; 12 → 9 remaining.',
      'Stale accounts — over 4,000 remain unused for 180+ days. Cleanup blocked by per-region HR ownership; will require coordination with the Office 365 team.',
      'Highly authorised disabled accounts — 2 still detected as of January 27, 2025.'
    ].join('\\n')
  },
  securityConfig: {
    narrative: 'The score for Security Configuration Overview has remained constant, flatlining at 63. This category is dominated by feature-adoption gaps that can be closed without new procurement.',
    endpointProtection: 'Over 50% of EPP agents have been installed; however, most of the deployed EPP versions, while supported, are not the latest release, and around 70% of these agents have outdated components.',
    featureAdoption: [
      '"Active Action" is disabled in Behavior Monitoring for Endpoint & Workload Security (EWP) and Server & Workload Security (SWP).',
      '"File Quarantine or Delete" needs to be enabled for Predictive Machine Learning under EWP — currently disabled on 54 machines.',
      '"Agent Self Protection" is disabled on roughly 28% of servers under EWP.',
      'Component patterns are outdated on a large share of the agent fleet and require an update to the latest version.'
    ].join('\\n'),
    endpointSensor: 'Approximately 48% of sensors have not yet been enabled. Both sensor versions and component versions include supported legacy releases — these should be updated to the latest version to ensure best protection.'
  },
  attack: {
    narrative: 'Attack overview score has ranged from 65–73, particularly due to high frequency of XDR detections. We recommend using the Operations Dashboard to quickly assess and prioritize XDR workbenches requiring urgent action — it provides real-time score impact and 30-day statistical insights for informed decision-making.',
    detections: [
      'Execution of Renamed Plink — c:\\\\users\\\\username_1\\\\desktop\\\\atlas container.exe (PuTTY). Confirm whether PuTTY is expected; if so, mark benign.',
      '[Heuristic Attribute] System Binary Proxy Execution — hostname_1 (event from 2024-11-13); verify presence of c:\\\\windows\\\\apppatch\\\\apppatch64\\\\aclayers.dll.',
      'Behavior Monitoring Detection for Built-in Windows Tools — Trend Micro services being disabled; investigate as potential tampering.',
      'Creation of Suspicious File with Double Extensions — username_2 appears to be performing administrative file extraction; confirm with the user.',
      'Disable or Stop Security Service in Linux — review and confirm whether intentional administrative activity.'
    ].join('\\n')
  },
  recommendations: [
    { riskLevel:'High', category:'Exposure', title:'Internet-Facing Assets', detail:['SSL/TLS certificates expired (e.g. ip_address_1 expired 2024-10-06)','Weak / deprecated protocols (TLSv1.1) detected','Application vulnerabilities on internet-facing assets','Affected: domain_3.com, domain_4.com.br, domain_5.com'], recommendation:['Verify why unfamiliar IPs remain associated with these domains.','Update expired certificates and deprecated protocols.','Vision One → ASRM → Internet Facing Assets, sort by Asset Risk Score.'], status:'Recommended' },
    { riskLevel:'Medium', category:'Exposure', title:'Unexpected Internet-Facing Services / Ports', detail:['ip_address_2, ip_address_3, ip_address_4 → port 10443 open','ip_address_5 → port 123 open'], recommendation:['Review each open port — confirm whether it is required.','Close ports that are not explicitly justified.'], status:'Recommended' },
    { riskLevel:'Medium', category:'Exposure', title:'Accounts with Weak Authentication', detail:['Password expiration disabled on 9 accounts (6 still remaining)','username_3 through username_11'], recommendation:['Enable password expiration policy on listed accounts.','Create a dismiss rule if expiration is intentionally disabled.'], status:'Recommended' },
    { riskLevel:'Medium', category:'Exposure', title:'Extra Admin Accounts', detail:['12 admin accounts identified, 9 remain after cleanup','Best practice: ≤ 5 global / company admins'], recommendation:['Remove unused admin accounts; justify any retained.','Cloud-only admins (e.g. username_12, username_13) need separate review.'], status:'Recommended' },
    { riskLevel:'Medium', category:'Exposure', title:'Account with Excessive Privilege', detail:['username_23 — disabled high-privilege account still detected'], recommendation:['Delete or reduce privileges if the account is no longer required.','Avoid leaving high-privilege accounts in a disabled-only state.'], status:'Recommended' },
    { riskLevel:'High', category:'Exposure', title:'Stale Accounts', detail:['4,507 accounts inactive > 180 days','Likely includes guest accounts that were never deleted'], recommendation:['Investigate and disable / delete inactive accounts.','Configure Microsoft Entra ID auto-deactivation at 90 or 180 days.','Coordinate with Office 365 / regional HR teams.'], status:'Recommended' },
    { riskLevel:'Medium', category:'Exposure', title:'Highly Exploitable Unique CVEs', detail:['24,522 highly exploitable CVEs across the environment','Concentrated on legacy OS: Win 2008/2012/2016/2019, RHEL 8, CentOS 7, Cisco IOS 11–15'], recommendation:['Apply virtual patching or network isolation as interim mitigation.','Plan migration of legacy applications to supported platforms.','Mark accepted risks in Vision One where remediation is not feasible.'], status:'Recommended' },
    { riskLevel:'High', category:'Exposure', title:'Average Unpatched Time', detail:['Critical patches missing on multiple machines','Longest unpatched duration: 583.2 days (Windows 10)'], recommendation:['Vision One → ASRM → Exposure Overview → Avg. Unpatched Time → View Details.','Sort AUT (day) high→low and prioritize remediation.'], status:'Recommended' },
    { riskLevel:'Low', category:'Attack', title:'Multiple File Rename Activity Over Network Share', detail:['Consistent contributor to Attack Risk Score (Cloud One Workload Security)','hostname_3, hostname_4, hostname_5'], recommendation:['Validate whether bulk rename / move activity is expected behavior.','Add legitimate hosts to detection model exceptions.'], status:'Recommended' },
    { riskLevel:'Low', category:'Configuration', title:'Key Feature Adoption & Pattern Update Status', detail:['Anti-malware, web reputation, behavior monitoring, predictive ML disabled on multiple endpoints','Component patterns outdated on ~70% of agents'], recommendation:['Enable anti-malware, web reputation, and behavior monitoring on all desktops.','Update component patterns to latest versions.'], status:'Recommended' }
  ],
  sessions: [
    { label:'Day 1 — Kickoff & Baseline', date:'October 28, 2024', time:'06:00 PM (GMT+8)', status:'Completed' },
    { label:'Day 30 — First Review', date:'November 25, 2024', time:'06:00 PM (GMT+8)', status:'Completed' },
    { label:'Day 60 — Mid-Cycle Review', date:'December 27, 2024', time:'04:00 PM (GMT+8)', status:'Completed' },
    { label:'Day 90 — Outcome Review', date:'January 27, 2025', time:'05:00 PM (GMT+8)', status:'Upcoming' }
  ]
};

const $ = s => document.querySelector(s);
const val = n => { const el = document.querySelector('[name="'+n+'"]'); return el ? el.value : ''; };
const numU = v => v===''||v==null ? undefined : Number(v);
const lines = s => s.split('\\n').map(x=>x.trim()).filter(Boolean);
function tp(prefix){ const o={day1:numU(val(prefix+'_d1')),day30:numU(val(prefix+'_d30')),day60:numU(val(prefix+'_d60')),day90:numU(val(prefix+'_d90'))};
  return (o.day1===undefined&&o.day30===undefined&&o.day60===undefined&&o.day90===undefined)?undefined:o; }

// ---- text fields ----
$('[name=customerName]').value = D.customerName;
$('[name=cycleLabel]').value = D.cycleLabel;
$('[name=docId]').value = D.docId;
$('[name=coverSubtitle]').value = D.coverSubtitle;
$('[name=executiveSummary]').value = D.executiveSummary;
$('[name=whatChanged]').value = D.whatChanged;
$('[name=exp_narrative]').value = D.exposure.narrative;
$('[name=exp_sub]').value = D.exposure.subNarrative;
$('[name=exp_findings]').value = D.exposure.findings;
$('[name=sc_narrative]').value = D.securityConfig.narrative;
$('[name=sc_epp]').value = D.securityConfig.endpointProtection;
$('[name=sc_feat]').value = D.securityConfig.featureAdoption;
$('[name=sc_sensor]').value = D.securityConfig.endpointSensor;
$('[name=at_narrative]').value = D.attack.narrative;
$('[name=at_detections]').value = D.attack.detections;

// ---- hero cards ----
$('#hero').innerHTML = D.hero.map((h,i)=>
  '<div class="row3"><input name="hero_v_'+i+'" value="'+h.value.replace(/"/g,'&quot;')+'" placeholder="Value">'+
  '<input name="hero_l_'+i+'" value="'+h.label.replace(/"/g,'&quot;')+'" placeholder="Label">'+
  '<label class="chk"><input type="checkbox" name="hero_a_'+i+'" '+(h.accent?'checked':'')+'> red</label></div>').join('');

// ---- trend table ----
const TR = [['ri','Risk Index'],['exposure','Exposure'],['attack','Attack'],['securityConfiguration','Security Config']];
$('#trend').innerHTML = TR.map(([k,lbl])=>{
  const d = k==='ri'?D.trend.riskIndex:D.trend[k];
  const g = x => d&&d[x]!=null ? d[x] : '';
  return '<div class="row5"><input value="'+lbl+'" disabled>'+
    ['d1','d30','d60','d90'].map((c,j)=>'<input type="number" step="any" name="'+k+'_'+c+'" value="'+g(['day1','day30','day60','day90'][j])+'">').join('')+'</div>';
}).join('');

// ---- sessions ----
$('#sessions').innerHTML = D.sessions.map((s,i)=>
  '<div class="row4"><input name="s_label_'+i+'" value="'+s.label.replace(/"/g,'&quot;')+'">'+
  '<input name="s_date_'+i+'" value="'+s.date+'"><input name="s_time_'+i+'" value="'+s.time+'">'+
  '<select name="s_status_'+i+'"><option'+(s.status==='Completed'?' selected':'')+'>Completed</option><option'+(s.status==='Upcoming'?' selected':'')+'>Upcoming</option></select></div>').join('');

// ---- recommendations (dynamic) ----
let RECS = JSON.parse(JSON.stringify(D.recommendations));
function renderRecs(){
  $('#recs').innerHTML = RECS.map((r,i)=>
    '<div class="reccard"><div class="row3">'+
    '<select data-i="'+i+'" data-f="riskLevel"><option'+(r.riskLevel==='High'?' selected':'')+'>High</option><option'+(r.riskLevel==='Medium'?' selected':'')+'>Medium</option><option'+(r.riskLevel==='Low'?' selected':'')+'>Low</option></select>'+
    '<select data-i="'+i+'" data-f="category"><option'+(r.category==='Exposure'?' selected':'')+'>Exposure</option><option'+(r.category==='Attack'?' selected':'')+'>Attack</option><option'+(r.category==='Configuration'?' selected':'')+'>Configuration</option></select>'+
    '<button type="button" class="ghost del" data-i="'+i+'">Remove</button></div>'+
    '<input data-i="'+i+'" data-f="title" value="'+(r.title||'').replace(/"/g,'&quot;')+'" placeholder="Finding title">'+
    '<textarea data-i="'+i+'" data-f="detail" placeholder="Finding bullets (one per line)">'+r.detail.join('\\n')+'</textarea>'+
    '<textarea data-i="'+i+'" data-f="recommendation" placeholder="Recommendation lines (one per line)">'+r.recommendation.join('\\n')+'</textarea>'+
    '<input data-i="'+i+'" data-f="status" value="'+(r.status||'').replace(/"/g,'&quot;')+'" placeholder="Status">'+
    '</div>').join('');
}
function syncRecs(){
  document.querySelectorAll('#recs [data-f]').forEach(el=>{
    const i=+el.dataset.i, f=el.dataset.f;
    if(f==='detail'||f==='recommendation') RECS[i][f]=lines(el.value); else RECS[i][f]=el.value;
  });
}
$('#recs').addEventListener('input', e=>{ if(e.target.dataset.f){ const i=+e.target.dataset.i,f=e.target.dataset.f; if(f!=='detail'&&f!=='recommendation') RECS[i][f]=e.target.value; }});
$('#recs').addEventListener('click', e=>{ if(e.target.classList.contains('del')){ syncRecs(); RECS.splice(+e.target.dataset.i,1); renderRecs(); }});
$('#addRec').onclick = ()=>{ syncRecs(); RECS.push({riskLevel:'Medium',category:'Exposure',title:'',detail:[],recommendation:[],status:'Recommended'}); renderRecs(); };
renderRecs();

// ---- build config ----
function buildConfig(){
  if(!$('#f').reportValidity()) return null;
  syncRecs();
  const hero = D.hero.map((_,i)=>({ value:val('hero_v_'+i), label:val('hero_l_'+i), accent:!!document.querySelector('[name=hero_a_'+i+']').checked }))
    .filter(h=>h.value||h.label);
  return {
    customerName: val('customerName'), region: val('region'),
    engagement: { docId: val('docId'), cycleLabel: val('cycleLabel') },
    coverSubtitle: val('coverSubtitle')||undefined,
    executiveSummary: val('executiveSummary'),
    hero: hero.length?hero:undefined,
    whatChanged: lines(val('whatChanged')),
    trend: { riskIndex: tp('ri'), exposure: tp('exposure'), attack: tp('attack'), securityConfiguration: tp('securityConfiguration') },
    exposure: { narrative: val('exp_narrative'), subNarrative: val('exp_sub'), findings: lines(val('exp_findings')) },
    securityConfig: { narrative: val('sc_narrative'), endpointProtection: val('sc_epp'), featureAdoption: lines(val('sc_feat')), endpointSensor: val('sc_sensor') },
    attack: { narrative: val('at_narrative'), detections: lines(val('at_detections')) },
    recommendations: RECS,
    sessions: D.sessions.map((_,i)=>({ label:val('s_label_'+i), date:val('s_date_'+i), time:val('s_time_'+i), status:val('s_status_'+i) })),
    workbench: { startDateTime: val('wbStart')||undefined, endDateTime: val('wbEnd')||undefined }
  };
}
function status(msg,kind){ const s=$('#status'); s.textContent=msg; s.className='show '+kind; }
async function post(path,cfg){ return fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(cfg)}); }

$('#pdfBtn').onclick = async ()=>{ const c=buildConfig(); if(!c) return; status('Pulling live Vision One data and rendering PDF…','work');
  try{ const r=await post('/api/report',c); if(!r.ok){ status('Failed: '+(await r.text()),'err'); return; }
    const b=await r.blob(), u=URL.createObjectURL(b), a=document.createElement('a'); a.href=u; a.download=(c.customerName||'cra')+'-report.pdf'; a.click(); URL.revokeObjectURL(u); status('PDF generated.','ok');
  }catch(e){ status('Error: '+e.message,'err'); } };

$('#previewBtn').onclick = async ()=>{ const c=buildConfig(); if(!c) return; status('Building HTML preview…','work');
  try{ const r=await post('/api/preview',c); if(!r.ok){ status('Failed: '+(await r.text()),'err'); return; }
    const h=await r.text(), w=window.open('','_blank'); w.document.open(); w.document.write(h); w.document.close(); status('Preview opened in new tab.','ok');
  }catch(e){ status('Error: '+e.message,'err'); } };

$('#draftBtn').onclick = async ()=>{ const c=buildConfig(); if(!c) return; status('Asking AI to draft "What changed" (review before use)…','work');
  try{ const r=await post('/api/draft',c); if(!r.ok){ status('Draft failed: '+(await r.text()),'err'); return; }
    const j=await r.json(); $('[name=whatChanged]').value=(j.bullets||[]).join('\\n'); status('AI draft inserted — review and edit before generating.','ok');
  }catch(e){ status('Error: '+e.message,'err'); } };
`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>CRA Report Generator</title>
<style>
  :root{--accent:#E11C24;--ink:#14151a;--muted:#6b7280;--line:#e4e6ea;}
  *{box-sizing:border-box;} body{margin:0;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;color:var(--ink);background:#f4f5f7;}
  header{background:#050608;color:#fff;padding:16px 28px;display:flex;align-items:center;gap:10px;}
  header .dot{width:12px;height:12px;border-radius:3px;background:var(--accent);} header h1{font-size:15px;margin:0;font-weight:800;letter-spacing:.3px;}
  main{max-width:940px;margin:22px auto;padding:0 20px 80px;}
  fieldset{border:1px solid var(--line);border-radius:10px;background:#fff;margin:0 0 16px;padding:14px 18px;}
  legend{font-weight:800;padding:0 6px;color:var(--accent);font-size:13px;letter-spacing:.04em;text-transform:uppercase;}
  label{display:block;font-size:11px;color:var(--muted);margin:9px 0 3px;font-weight:600;}
  input,select,textarea{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font:inherit;font-size:13px;}
  textarea{min-height:64px;resize:vertical;line-height:1.5;}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 16px;}
  .row3{display:grid;grid-template-columns:1fr 2fr auto;gap:8px;align-items:center;margin-bottom:8px;}
  .row4{display:grid;grid-template-columns:1.6fr 1fr 1fr .8fr;gap:8px;margin-bottom:8px;}
  .row5{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr 1fr;gap:8px;margin-bottom:8px;}
  .chk{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);margin:0;white-space:nowrap;}
  .chk input{width:auto;}
  .reccard{border:1px solid var(--line);border-radius:8px;padding:12px;margin-bottom:10px;background:#fafbfc;}
  .reccard input,.reccard textarea{margin-bottom:6px;}
  .hint{font-size:11px;color:var(--muted);margin:4px 0 0;}
  .actions{display:flex;gap:12px;flex-wrap:wrap;position:sticky;bottom:0;background:#f4f5f7;padding:14px 0;border-top:1px solid var(--line);}
  button{font:inherit;font-weight:700;border:none;border-radius:8px;padding:11px 18px;cursor:pointer;font-size:13px;}
  button.primary{background:var(--accent);color:#fff;} button.ghost{background:#fff;color:var(--ink);border:1px solid var(--line);}
  button.del{padding:7px 12px;}
  #status{font-size:13px;padding:10px 14px;border-radius:8px;margin:0 0 14px;display:none;} #status.show{display:block;}
  #status.err{background:#fcdedf;color:#9a1015;} #status.ok{background:#e6f4ea;color:#176c33;} #status.work{background:#fef3c7;color:#92520a;}
  .colhdr{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr 1fr;gap:8px;font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;}
</style></head>
<body>
<header><span class="dot"></span><h1>Cyber Risk Advisory — Report Generator</h1></header>
<main>
  <div id="status"></div>
  <form id="f">
    <fieldset><legend>Engagement</legend>
      <div class="grid2">
        <div><label>Customer name *</label><input name="customerName" required placeholder="Acme Corp"></div>
        <div><label>Region</label><select name="region">${regionOptions}</select></div>
        <div><label>Engagement label</label><input name="cycleLabel" required></div>
        <div><label>Document</label><input name="docId"></div>
      </div>
      <label>Cover subtitle</label><textarea name="coverSubtitle"></textarea>
    </fieldset>

    <fieldset><legend>01 · Executive Summary</legend>
      <label>Summary narrative *</label><textarea name="executiveSummary" required></textarea>
      <label>Hero metric cards (value · label · red)</label><div id="hero"></div>
      <p class="hint">Leave a card blank to omit it; clear all to auto-fill from live API data.</p>
      <label>What changed this cycle (one bullet per line)</label><textarea name="whatChanged"></textarea>
      <button type="button" class="ghost" id="draftBtn" style="margin-top:8px">✨ Draft with AI (review before use)</button>
    </fieldset>

    <fieldset><legend>03 · Risk Index Trend</legend>
      <div class="colhdr"><span>Category</span><span>Day 1</span><span>Day 30</span><span>Day 60</span><span>Day 90</span></div>
      <div id="trend"></div>
      <p class="hint">Blank cells render "—". Risk Index Day 90 auto-fills from the live API if left blank.</p>
    </fieldset>

    <fieldset><legend>04 · Exposure Overview</legend>
      <label>Lead narrative</label><textarea name="exp_narrative"></textarea>
      <label>Internal asset vulnerabilities</label><textarea name="exp_sub"></textarea>
      <label>System configuration vulnerabilities (one bullet per line)</label><textarea name="exp_findings"></textarea>
    </fieldset>

    <fieldset><legend>05 · Security Configuration</legend>
      <label>Lead narrative</label><textarea name="sc_narrative"></textarea>
      <label>Endpoint protection</label><textarea name="sc_epp"></textarea>
      <label>Key feature adoption &amp; pattern update (one bullet per line)</label><textarea name="sc_feat"></textarea>
      <label>Endpoint sensor</label><textarea name="sc_sensor"></textarea>
    </fieldset>

    <fieldset><legend>06 · Attack Overview</legend>
      <label>Lead narrative</label><textarea name="at_narrative"></textarea>
      <label>XDR detection summary (one bullet per line)</label><textarea name="at_detections"></textarea>
      <p class="hint">Leave blank to auto-fill from live Workbench alerts.</p>
    </fieldset>

    <fieldset><legend>07 · Recommendations</legend>
      <div id="recs"></div>
      <button type="button" class="ghost" id="addRec">+ Add finding</button>
    </fieldset>

    <fieldset><legend>08 · Sessions &amp; Cadence</legend>
      <div class="colhdr" style="grid-template-columns:1.6fr 1fr 1fr .8fr"><span>Session</span><span>Date</span><span>Time</span><span>Status</span></div>
      <div id="sessions"></div>
    </fieldset>

    <fieldset><legend>Workbench alert window</legend>
      <div class="grid2">
        <div><label>Start (ISO)</label><input name="wbStart" placeholder="2024-10-28T00:00:00Z"></div>
        <div><label>End (ISO)</label><input name="wbEnd" placeholder="2025-01-27T00:00:00Z"></div>
      </div>
    </fieldset>

    <div class="actions">
      <button type="button" class="primary" id="pdfBtn">Generate PDF</button>
      <button type="button" class="ghost" id="previewBtn">Preview HTML</button>
    </div>
  </form>
</main>
<script>${script}</script>
</body></html>`;
}
