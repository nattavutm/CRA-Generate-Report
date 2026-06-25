// §10 — single-page form served at GET /. No localStorage. Builds a ReportConfig
// client-side and POSTs it to /api/report (PDF) or /api/preview (HTML).

export function renderForm(regions: string[], defaultRegion: string): string {
  const regionOptions = regions
    .map((r) => `<option value="${r}"${r === defaultRegion ? ' selected' : ''}>${r.toUpperCase()}</option>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CRA Report Generator</title>
<style>
  :root { --accent:#E11C24; --ink:#1a1a1f; --muted:#6b7280; --line:#e5e7eb; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; color:var(--ink); background:#f4f5f7; }
  header { background:#14151a; color:#fff; padding:18px 28px; display:flex; align-items:center; gap:10px; }
  header .dot { width:12px;height:12px;border-radius:3px;background:var(--accent); }
  header h1 { font-size:16px; margin:0; font-weight:700; letter-spacing:.4px; }
  main { max-width:920px; margin:24px auto; padding:0 20px 60px; }
  fieldset { border:1px solid var(--line); border-radius:10px; background:#fff; margin:0 0 18px; padding:16px 18px; }
  legend { font-weight:700; padding:0 6px; color:var(--accent); }
  label { display:block; font-size:12px; color:var(--muted); margin:10px 0 4px; }
  input, select, textarea { width:100%; padding:8px 10px; border:1px solid var(--line); border-radius:6px; font:inherit; }
  textarea { min-height:80px; resize:vertical; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:0 16px; }
  .grid-3 { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:0 12px; align-items:end; }
  .grid-4 { display:grid; grid-template-columns:1.4fr 1fr 1fr 1fr; gap:0 12px; }
  .hint { font-size:11px; color:var(--muted); margin:4px 0 0; }
  .actions { display:flex; gap:12px; flex-wrap:wrap; position:sticky; bottom:0; background:#f4f5f7; padding:14px 0; }
  button { font:inherit; font-weight:600; border:none; border-radius:8px; padding:11px 18px; cursor:pointer; }
  button.primary { background:var(--accent); color:#fff; }
  button.ghost { background:#fff; color:var(--ink); border:1px solid var(--line); }
  button:disabled { opacity:.5; cursor:default; }
  #status { font-size:13px; padding:10px 14px; border-radius:8px; margin:0 0 14px; display:none; }
  #status.show { display:block; }
  #status.err { background:#fcdedf; color:#9a1015; }
  #status.ok { background:#e6f4ea; color:#176c33; }
  #status.work { background:#fef3c7; color:#92520a; }
</style>
</head>
<body>
<header><span class="dot"></span><h1>Cyber Risk Advisory — Report Generator</h1></header>
<main>
  <div id="status"></div>
  <form id="f">
    <fieldset>
      <legend>Engagement</legend>
      <div class="grid">
        <div><label>Customer name *</label><input name="customerName" required placeholder="Acme Corp"></div>
        <div><label>Region</label><select name="region">${regionOptions}</select></div>
        <div><label>Cycle label *</label><input name="cycleLabel" required placeholder="Q3 2026 — Cycle 3"></div>
        <div><label>Document ID</label><input name="docId" placeholder="CRA-2026-003"></div>
      </div>
    </fieldset>

    <fieldset>
      <legend>Sessions (Engagement Cadence)</legend>
      <div id="sessions"></div>
      <p class="hint">Status: Completed or Upcoming.</p>
    </fieldset>

    <fieldset>
      <legend>Prior-period values (manual, optional)</legend>
      <p class="hint">Fill the trend table's Day 1 / 30 / 60 columns. Leave blank to render "—". The latest (Day 90) column is filled live from the API.</p>
      <div class="grid-4">
        <div><label>Metric</label><input value="Risk Index" disabled></div>
        <div><label>Day 1</label><input type="number" step="any" name="ri_day1"></div>
        <div><label>Day 30</label><input type="number" step="any" name="ri_day30"></div>
        <div><label>Day 60</label><input type="number" step="any" name="ri_day60"></div>
      </div>
      <p class="hint" style="margin-top:12px">Category levels are reported live as low/medium/high strings; numeric prior values below are optional.</p>
      <div id="catPrior"></div>
    </fieldset>

    <fieldset>
      <legend>Editorial (human-authored)</legend>
      <label>Executive summary *</label>
      <textarea name="executiveSummary" required placeholder="Narrative summary for this cycle..."></textarea>
      <label>What changed this cycle (one bullet per line)</label>
      <textarea name="whatChanged" placeholder="Risk Index improved from ... to ...
Patched N internet-facing CVEs"></textarea>
      <button type="button" class="ghost" id="draftBtn" style="margin-top:8px">✨ Draft with AI (review before use)</button>
      <label style="margin-top:12px">Data-source notes</label>
      <textarea name="dataSourceNotes" placeholder="e.g. Qualys disabled this cycle"></textarea>
    </fieldset>

    <fieldset>
      <legend>Workbench alert window</legend>
      <div class="grid">
        <div><label>Start date/time (ISO)</label><input name="wbStart" placeholder="2026-03-25T00:00:00Z"></div>
        <div><label>End date/time (ISO)</label><input name="wbEnd" placeholder="2026-06-25T00:00:00Z"></div>
      </div>
    </fieldset>

    <div class="actions">
      <button type="button" class="primary" id="pdfBtn">Generate PDF</button>
      <button type="button" class="ghost" id="previewBtn">Preview HTML</button>
    </div>
  </form>
</main>

<script>
const SESSIONS = ['Kickoff','Review 1','Review 2','Wrap-up'];
const CATS = [['exposure','Exposure'],['attack','Attack'],['securityConfiguration','Security Configuration']];

const sessEl = document.getElementById('sessions');
sessEl.innerHTML = SESSIONS.map((s,i)=>\`
  <div class="grid-3">
    <div><label>\${i===0?'Session':''}</label><input name="s_label_\${i}" value="\${s}"></div>
    <div><label>\${i===0?'Date':''}</label><input type="date" name="s_date_\${i}"></div>
    <div><label>\${i===0?'Time':''}</label><input type="time" name="s_time_\${i}"></div>
    <div><label>\${i===0?'Status':''}</label><select name="s_status_\${i}"><option>Completed</option><option selected>Upcoming</option></select></div>
  </div>\`).join('');

const catEl = document.getElementById('catPrior');
catEl.innerHTML = CATS.map(([k,lbl])=>\`
  <div class="grid-4">
    <div><label></label><input value="\${lbl}" disabled></div>
    <div><label></label><input type="number" step="any" name="\${k}_day1" placeholder="Day 1"></div>
    <div><label></label><input type="number" step="any" name="\${k}_day30" placeholder="Day 30"></div>
    <div><label></label><input type="number" step="any" name="\${k}_day60" placeholder="Day 60"></div>
  </div>\`).join('');

function status(msg, kind){ const s=document.getElementById('status'); s.textContent=msg; s.className='show '+kind; }
function clearStatus(){ document.getElementById('status').className=''; }

const numOrUndef = v => v===''||v==null ? undefined : Number(v);
function priorOf(prefix){
  const o = { day1:numOrUndef(get(prefix+'_day1')), day30:numOrUndef(get(prefix+'_day30')), day60:numOrUndef(get(prefix+'_day60')) };
  return (o.day1===undefined&&o.day30===undefined&&o.day60===undefined) ? undefined : o;
}
const get = n => { const el=document.querySelector('[name="'+n+'"]'); return el?el.value:''; };

function buildConfig(){
  const f = document.getElementById('f');
  if(!f.reportValidity()) return null;
  const sessions = SESSIONS.map((_,i)=>({
    label:get('s_label_'+i), date:get('s_date_'+i), time:get('s_time_'+i), status:get('s_status_'+i)
  }));
  const priorCategory = {};
  for(const [k] of CATS){ const p=priorOf(k); if(p) priorCategory[k]=p; }
  return {
    customerName:get('customerName'),
    region:get('region'),
    engagement:{ docId:get('docId'), cycleLabel:get('cycleLabel') },
    sessions,
    priorRiskIndex: priorOf('ri'),
    priorCategory: Object.keys(priorCategory).length?priorCategory:undefined,
    executiveSummary:get('executiveSummary'),
    whatChanged:get('whatChanged').split('\\n').map(s=>s.trim()).filter(Boolean),
    dataSourceNotes:get('dataSourceNotes')||undefined,
    workbench:{ startDateTime:get('wbStart')||undefined, endDateTime:get('wbEnd')||undefined }
  };
}

async function post(path, cfg){
  return fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(cfg)});
}

document.getElementById('pdfBtn').onclick = async () => {
  const cfg = buildConfig(); if(!cfg) return;
  status('Pulling live Vision One data and rendering PDF…','work');
  try {
    const res = await post('/api/report', cfg);
    if(!res.ok){ status('Failed: '+(await res.text()),'err'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=(cfg.customerName||'cra')+'-report.pdf'; a.click();
    URL.revokeObjectURL(url);
    status('PDF generated.','ok');
  } catch(e){ status('Error: '+e.message,'err'); }
};

document.getElementById('previewBtn').onclick = async () => {
  const cfg = buildConfig(); if(!cfg) return;
  status('Building HTML preview…','work');
  try {
    const res = await post('/api/preview', cfg);
    if(!res.ok){ status('Failed: '+(await res.text()),'err'); return; }
    const html = await res.text();
    const w = window.open('','_blank');
    w.document.open(); w.document.write(html); w.document.close();
    clearStatus();
  } catch(e){ status('Error: '+e.message,'err'); }
};

document.getElementById('draftBtn').onclick = async () => {
  const cfg = buildConfig(); if(!cfg) return;
  status('Asking AI to draft "What changed" (you must review)…','work');
  try {
    const res = await post('/api/draft', cfg);
    if(!res.ok){ status('Draft failed: '+(await res.text()),'err'); return; }
    const { bullets } = await res.json();
    document.querySelector('[name="whatChanged"]').value = (bullets||[]).join('\\n');
    status('AI draft inserted — review and edit before generating.','ok');
  } catch(e){ status('Error: '+e.message,'err'); }
};
</script>
</body>
</html>`;
}
