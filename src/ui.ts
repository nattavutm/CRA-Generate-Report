// §10 — single-page generate form served at GET /. No localStorage.
// The report's DATA comes from the live Vision One API. This form only collects what the API
// cannot provide: the token, engagement labels, prior-period trend numbers, optional commentary,
// optional manual recommendation overrides, and the session schedule.

export function renderForm(regions: string[], defaultRegion: string): string {
  const regionOptions = regions
    .map((r) => `<option value="${r}"${r === defaultRegion ? ' selected' : ''}>${r.toUpperCase()}</option>`)
    .join('');

  // Client script. Backticks and ${ } are escaped (\` , \${) so they survive server interpolation.
  const script = `
const SESSIONS = ['Day 1 — Kickoff & Baseline','Day 30 — First Review','Day 60 — Mid-Cycle Review','Day 90 — Outcome Review'];
const TREND = [['riskIndex','Risk Index'],['exposure','Exposure'],['attack','Attack'],['securityConfiguration','Security Configuration']];

const $ = s => document.querySelector(s);
const val = n => { const el = document.querySelector('[name="'+n+'"]'); return el ? el.value : ''; };
const numU = v => v===''||v==null ? undefined : Number(v);
const lines = s => s.split('\\n').map(x=>x.trim()).filter(Boolean);
function tp(prefix){ const o={day1:numU(val(prefix+'_d1')),day30:numU(val(prefix+'_d30')),day60:numU(val(prefix+'_d60'))};
  return (o.day1===undefined&&o.day30===undefined&&o.day60===undefined)?undefined:o; }

// ---- trend (prior periods only; Day 90 comes from the API) ----
$('#trend').innerHTML = TREND.map(([k,lbl])=>
  '<div class="row4"><input value="'+lbl+'" disabled>'+
  ['d1','d30','d60'].map(c=>'<input type="number" step="any" name="'+k+'_'+c+'" placeholder="—">').join('')+'</div>').join('');

// ---- sessions ----
$('#sessions').innerHTML = SESSIONS.map((s,i)=>
  '<div class="row4"><input name="s_label_'+i+'" value="'+s.replace(/"/g,'&quot;')+'">'+
  '<input name="s_date_'+i+'" placeholder="October 28, 2024"><input name="s_time_'+i+'" placeholder="06:00 PM (GMT+8)">'+
  '<select name="s_status_'+i+'"><option>Completed</option><option'+(i===3?' selected':'')+'>Upcoming</option></select></div>').join('');

// ---- recommendations (optional override; empty = derived from live data) ----
let RECS = [];
function renderRecs(){
  $('#recs').innerHTML = RECS.map((r,i)=>
    '<div class="reccard"><div class="row3">'+
    '<select data-i="'+i+'" data-f="riskLevel"><option'+(r.riskLevel==='High'?' selected':'')+'>High</option><option'+(r.riskLevel==='Medium'?' selected':'')+'>Medium</option><option'+(r.riskLevel==='Low'?' selected':'')+'>Low</option></select>'+
    '<select data-i="'+i+'" data-f="category"><option'+(r.category==='Exposure'?' selected':'')+'>Exposure</option><option'+(r.category==='Attack'?' selected':'')+'>Attack</option><option'+(r.category==='Configuration'?' selected':'')+'>Configuration</option></select>'+
    '<button type="button" class="ghost del" data-i="'+i+'">Remove</button></div>'+
    '<input data-i="'+i+'" data-f="title" value="'+(r.title||'').replace(/"/g,'&quot;')+'" placeholder="Finding title">'+
    '<textarea data-i="'+i+'" data-f="detail" placeholder="Finding bullets (one per line)">'+r.detail.join('\\n')+'</textarea>'+
    '<textarea data-i="'+i+'" data-f="recommendation" placeholder="Recommendation lines (one per line)">'+r.recommendation.join('\\n')+'</textarea>'+
    '<input data-i="'+i+'" data-f="status" value="'+(r.status||'Recommended').replace(/"/g,'&quot;')+'" placeholder="Status">'+
    '</div>').join('');
}
function syncRecs(){ document.querySelectorAll('#recs [data-f]').forEach(el=>{ const i=+el.dataset.i,f=el.dataset.f;
  if(f==='detail'||f==='recommendation') RECS[i][f]=lines(el.value); else RECS[i][f]=el.value; }); }
$('#recs').addEventListener('input', e=>{ if(e.target.dataset.f){ const i=+e.target.dataset.i,f=e.target.dataset.f; if(f!=='detail'&&f!=='recommendation') RECS[i][f]=e.target.value; }});
$('#recs').addEventListener('click', e=>{ if(e.target.classList.contains('del')){ syncRecs(); RECS.splice(+e.target.dataset.i,1); renderRecs(); }});
$('#addRec').onclick = ()=>{ syncRecs(); RECS.push({riskLevel:'Medium',category:'Exposure',title:'',detail:[],recommendation:[],status:'Recommended'}); renderRecs(); };

function buildConfig(){
  if(!$('#f').reportValidity()) return null;
  syncRecs();
  const trend = {}; TREND.forEach(([k])=>{ const v=tp(k); if(v) trend[k]=v; });
  return {
    customerName: val('customerName'), region: val('region'),
    engagement: { docId: val('docId'), cycleLabel: val('cycleLabel') },
    coverSubtitle: val('coverSubtitle')||undefined,
    executiveSummary: val('executiveSummary')||undefined,
    whatChanged: lines(val('whatChanged')),
    trend: Object.keys(trend).length?trend:undefined,
    recommendations: RECS.length?RECS:undefined,
    sessions: SESSIONS.map((_,i)=>({ label:val('s_label_'+i), date:val('s_date_'+i), time:val('s_time_'+i), status:val('s_status_'+i) })),
    dataSourceNotes: val('dataSourceNotes')||undefined,
    workbench: { startDateTime: val('wbStart')||undefined, endDateTime: val('wbEnd')||undefined }
  };
}
function status(msg,kind){ const s=$('#status'); s.textContent=msg; s.className='show '+kind; }
async function post(path,cfg){
  const h={'content-type':'application/json'};
  const tok=val('v1token').trim(); if(tok) h['X-V1-Token']=tok; // sent once; never stored/logged
  return fetch(path,{method:'POST',headers:h,body:JSON.stringify(cfg)});
}

$('#pdfBtn').onclick = async ()=>{ const c=buildConfig(); if(!c) return; status('Pulling live Vision One data and rendering PDF…','work');
  try{ const r=await post('/api/report',c); if(!r.ok){ status('Failed: '+(await r.text()),'err'); return; }
    const b=await r.blob(), u=URL.createObjectURL(b), a=document.createElement('a'); a.href=u; a.download=(c.customerName||'cra')+'-report.pdf'; a.click(); URL.revokeObjectURL(u); status('PDF generated.','ok');
  }catch(e){ status('Error: '+e.message,'err'); } };

$('#previewBtn').onclick = async ()=>{ const c=buildConfig(); if(!c) return; status('Pulling live data and building HTML preview…','work');
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
  .intro{background:#fff;border:1px solid var(--line);border-radius:10px;padding:12px 16px;font-size:12.5px;color:var(--muted);margin:0 0 16px;}
  fieldset{border:1px solid var(--line);border-radius:10px;background:#fff;margin:0 0 16px;padding:14px 18px;}
  legend{font-weight:800;padding:0 6px;color:var(--accent);font-size:13px;letter-spacing:.04em;text-transform:uppercase;}
  label{display:block;font-size:11px;color:var(--muted);margin:9px 0 3px;font-weight:600;}
  input,select,textarea{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font:inherit;font-size:13px;}
  textarea{min-height:60px;resize:vertical;line-height:1.5;}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 16px;}
  .row3{display:grid;grid-template-columns:1fr 2fr auto;gap:8px;align-items:center;margin-bottom:8px;}
  .row4{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:8px;margin-bottom:8px;}
  .reccard{border:1px solid var(--line);border-radius:8px;padding:12px;margin-bottom:10px;background:#fafbfc;}
  .reccard input,.reccard textarea{margin-bottom:6px;}
  .hint{font-size:11px;color:var(--muted);margin:4px 0 0;}
  .actions{display:flex;gap:12px;flex-wrap:wrap;position:sticky;bottom:0;background:#f4f5f7;padding:14px 0;border-top:1px solid var(--line);}
  button{font:inherit;font-weight:700;border:none;border-radius:8px;padding:11px 18px;cursor:pointer;font-size:13px;}
  button.primary{background:var(--accent);color:#fff;} button.ghost{background:#fff;color:var(--ink);border:1px solid var(--line);}
  button.del{padding:7px 12px;}
  #status{font-size:13px;padding:10px 14px;border-radius:8px;margin:0 0 14px;display:none;} #status.show{display:block;}
  #status.err{background:#fcdedf;color:#9a1015;} #status.ok{background:#e6f4ea;color:#176c33;} #status.work{background:#fef3c7;color:#92520a;}
  .colhdr{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:8px;font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;}
</style></head>
<body>
<header><span class="dot"></span><h1>Cyber Risk Advisory — Report Generator</h1></header>
<main>
  <div id="status"></div>
  <div class="intro">All metrics, tables, and findings in the report are pulled <b>live from the Trend Vision One API</b>. The fields below only cover what the API can't provide — engagement labels, prior-period trend numbers, the session schedule, and optional commentary.</div>
  <form id="f" autocomplete="off">
    <fieldset><legend>Vision One access</legend>
      <label>API token (Bearer) — used once for this report, not saved</label>
      <input name="v1token" type="password" autocomplete="off" placeholder="Paste your Vision One API token">
      <p class="hint">Held in the browser only while this page is open; sent once with the request, never stored or logged. Leave blank to use the server's V1_API_TOKEN secret instead. Pick the Region matching your Vision One tenant's data center.</p>
    </fieldset>

    <fieldset><legend>Engagement</legend>
      <div class="grid2">
        <div><label>Customer name *</label><input name="customerName" required placeholder="Acme Corp"></div>
        <div><label>Region *</label><select name="region">${regionOptions}</select></div>
        <div><label>Engagement label</label><input name="cycleLabel" value="90-Day Cycle · 4 Sessions"></div>
        <div><label>Document</label><input name="docId" value="CRA-2026 · v1.0"></div>
      </div>
      <label>Cover subtitle</label><textarea name="coverSubtitle" placeholder="Leave blank for the default subtitle"></textarea>
    </fieldset>

    <fieldset><legend>Workbench alert window</legend>
      <div class="grid2">
        <div><label>Start (ISO)</label><input name="wbStart" placeholder="2024-10-28T00:00:00Z"></div>
        <div><label>End (ISO)</label><input name="wbEnd" placeholder="2025-01-27T00:00:00Z"></div>
      </div>
      <p class="hint">Bounds the live XDR detection pull for the Attack Overview section.</p>
    </fieldset>

    <fieldset><legend>Risk Index — prior periods (manual)</legend>
      <div class="colhdr"><span>Category</span><span>Day 1</span><span>Day 30</span><span>Day 60</span></div>
      <div id="trend"></div>
      <p class="hint">The API returns only the current snapshot, so earlier columns are entered by hand if you have them. Day 90 is filled live (overall index as a number, categories as risk levels). Blank → "—".</p>
    </fieldset>

    <fieldset><legend>Commentary (optional)</legend>
      <label>Executive summary intro — leave blank to auto-describe the live pull</label>
      <textarea name="executiveSummary"></textarea>
      <label>What changed this cycle (one bullet per line)</label>
      <textarea name="whatChanged"></textarea>
      <button type="button" class="ghost" id="draftBtn" style="margin-top:8px">✨ Draft with AI from live data (review before use)</button>
      <label style="margin-top:12px">Data-source notes</label>
      <textarea name="dataSourceNotes" placeholder="e.g. Qualys disabled this cycle"></textarea>
    </fieldset>

    <fieldset><legend>Recommendations (optional override)</legend>
      <p class="hint" style="margin:0 0 8px">Leave empty to auto-derive findings from the live data. Add rows only to override.</p>
      <div id="recs"></div>
      <button type="button" class="ghost" id="addRec">+ Add finding</button>
    </fieldset>

    <fieldset><legend>Sessions &amp; Cadence</legend>
      <div class="colhdr"><span>Session</span><span>Date</span><span>Time</span><span>Status</span></div>
      <div id="sessions"></div>
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
