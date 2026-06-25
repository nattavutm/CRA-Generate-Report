// §10 — single-page generate form served at GET /. No localStorage.
// The report's DATA comes from the live Vision One API. This form only collects what the API
// cannot provide: the token, engagement labels, optional commentary,
// optional manual recommendation overrides, and the session schedule.

export function renderForm(regions: string[], defaultRegion: string): string {
  const regionOptions = regions
    .map((r) => `<option value="${r}"${r === defaultRegion ? ' selected' : ''}>${r.toUpperCase()}</option>`)
    .join('');

  // TrendAI spark mark (white, for the dark bar) and a small lock glyph.
  const SPARK =
    '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0c1.1 6 4.9 9.7 12 12-7.1 2.3-10.9 6-12 12-1.1-6-4.9-9.7-12-12C7.1 9.7 10.9 6 12 0z" fill="#E11C24"/></svg>';
  const LOCK =
    '<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10V8a6 6 0 0112 0v2h1a1 1 0 011 1v9a1 1 0 01-1 1H5a1 1 0 01-1-1v-9a1 1 0 011-1h1zm2 0h8V8a4 4 0 00-8 0v2z" fill="#136a31"/></svg>';

  // Client script. Backticks and ${ } are escaped (\` , \${) so they survive server interpolation.
  const script = `
const SESSIONS = ['Day 1 — Kickoff & Baseline','Day 30 — First Review','Day 60 — Mid-Cycle Review','Day 90 — Outcome Review'];

const $ = s => document.querySelector(s);
const val = n => { const el = document.querySelector('[name="'+n+'"]'); return el ? el.value : ''; };
const lines = s => s.split('\\n').map(x=>x.trim()).filter(Boolean);

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

function workbenchRange(){
  const days = Number(val('wbDays')||30);
  const end = new Date();
  const start = new Date(end.getTime() - days*86400000);
  return { startDateTime: start.toISOString(), endDateTime: end.toISOString() };
}
function buildConfig(){
  if(!$('#f').reportValidity()) return null;
  syncRecs();
  return {
    customerName: val('customerName'), region: val('region'),
    engagement: { docId: val('docId'), cycleLabel: val('cycleLabel') },
    coverSubtitle: val('coverSubtitle')||undefined,
    executiveSummary: val('executiveSummary')||undefined,
    whatChanged: lines(val('whatChanged')),
    recommendations: RECS.length?RECS:undefined,
    sessions: SESSIONS.map((_,i)=>({ label:val('s_label_'+i), date:val('s_date_'+i), time:val('s_time_'+i), status:val('s_status_'+i) })),
    dataSourceNotes: val('dataSourceNotes')||undefined,
    workbench: workbenchRange()
  };
}
function status(msg,kind){ const s=$('#status'); s.className='show '+kind; s.innerHTML=(kind==='work'?'<span class="spin"></span>':'')+String(msg).replace(/</g,'&lt;'); }
let _busyBtn=null,_busyHtml='';
function busy(on,sel,label){
  ['#pdfBtn','#previewBtn','#draftBtn','#addRec'].forEach(s=>{ const b=$(s); if(b) b.disabled=on; });
  if(on){ _busyBtn=$(sel); if(_busyBtn){ _busyHtml=_busyBtn.innerHTML; _busyBtn.innerHTML='<span class="spin"></span>'+(label||'Working…'); } }
  else if(_busyBtn){ _busyBtn.innerHTML=_busyHtml; _busyBtn=null; }
}
async function post(path,cfg){
  const h={'content-type':'application/json'};
  const tok=val('v1token').trim(); if(tok) h['X-V1-Token']=tok; // sent once; never stored/logged
  return fetch(path,{method:'POST',headers:h,body:JSON.stringify(cfg)});
}

$('#pdfBtn').onclick = async ()=>{ const c=buildConfig(); if(!c) return; busy(true,'#pdfBtn','Generating…'); status('Pulling live Vision One data and rendering PDF…','work');
  try{ const r=await post('/api/report',c); if(!r.ok){ status('Failed: '+(await r.text()),'err'); return; }
    const b=await r.blob(), u=URL.createObjectURL(b), a=document.createElement('a'); a.href=u; a.download=(c.customerName||'cra')+'-report.pdf'; a.click(); URL.revokeObjectURL(u); status('PDF generated.','ok');
  }catch(e){ status('Error: '+e.message,'err'); } finally{ busy(false); } };

$('#previewBtn').onclick = async ()=>{ const c=buildConfig(); if(!c) return;
  const w=window.open('','_blank'); // open synchronously within the click gesture (avoids popup block)
  busy(true,'#previewBtn','Building…'); status('Pulling live data and building HTML preview…','work');
  try{ const r=await post('/api/preview',c); if(!r.ok){ if(w)w.close(); status('Failed: '+(await r.text()),'err'); return; }
    const h=await r.text();
    if(w){ w.document.open(); w.document.write(h); w.document.close(); status('Preview opened in new tab.','ok'); }
    else { const u=URL.createObjectURL(new Blob([h],{type:'text/html'})); const a=document.createElement('a'); a.href=u; a.target='_blank'; a.rel='noopener'; a.click(); status('Preview opened (allow pop-ups if it did not).','ok'); }
  }catch(e){ if(w)w.close(); status('Error: '+e.message,'err'); } finally{ busy(false); } };

$('#draftBtn').onclick = async ()=>{ const c=buildConfig(); if(!c) return; busy(true,'#draftBtn','Drafting…'); status('Asking AI to draft "What changed" (review before use)…','work');
  try{ const r=await post('/api/draft',c); if(!r.ok){ status('Draft failed: '+(await r.text()),'err'); return; }
    const j=await r.json(); $('[name=whatChanged]').value=(j.bullets||[]).join('\\n'); status('AI draft inserted — review and edit before generating.','ok');
  }catch(e){ status('Error: '+e.message,'err'); } finally{ busy(false); } };
`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>CRA Report Generator</title>
<style>
  :root{
    --accent:#E11C24; --accent-700:#b3151c;
    --ink:#15161b; --body:#41454d; --muted:#7a7f88;
    --line:#e6e8ec; --line-soft:#eef0f3; --panel:#ffffff;
    --bg:#f2f3f6; --dark:#0a0b0f; --dark-2:#15171d;
    --ring:rgba(225,28,36,.14);
  }
  *{box-sizing:border-box;}
  html,body{margin:0;}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",Arial,sans-serif;color:var(--body);background:var(--bg);-webkit-font-smoothing:antialiased;}
  ::selection{background:rgba(225,28,36,.16);}

  /* ---- top brand bar ---- */
  .topbar{background:var(--dark);color:#fff;}
  .topbar-in{max-width:1000px;margin:0 auto;padding:18px 24px;display:flex;align-items:center;justify-content:space-between;}
  .brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:18px;letter-spacing:-.2px;}
  .brand .tm{font-size:9px;vertical-align:super;color:#9aa0ab;font-weight:600;}
  .topbar .eyebrow{font-size:10px;letter-spacing:.34em;text-transform:uppercase;color:#8c919c;font-weight:700;}

  /* ---- hero ---- */
  .hero{background:var(--dark);color:#fff;border-bottom:3px solid var(--accent);}
  .hero-in{max-width:1000px;margin:0 auto;padding:8px 24px 40px;}
  .hero h1{font-size:34px;line-height:1.08;font-weight:800;letter-spacing:-.6px;margin:0;}
  .hero p{margin:12px 0 0;color:#b9bdc6;font-size:14px;max-width:60ch;line-height:1.6;}

  /* ---- layout ---- */
  main{max-width:1000px;margin:0 auto;padding:0 24px 140px;}
  .stack{margin-top:-22px;}
  #status{font-size:13px;padding:12px 16px;border-radius:10px;margin:0 0 16px;display:none;font-weight:500;}
  #status.show{display:block;}
  #status.err{background:#fce4e5;color:#9a1015;border:1px solid #f3c2c5;}
  #status.ok{background:#e7f5ec;color:#136a31;border:1px solid #c2e6cf;}
  #status.work{background:#fdf3d6;color:#8a5a06;border:1px solid #f1dca0;}

  /* ---- panels ---- */
  .panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:22px 24px;margin:0 0 14px;box-shadow:0 1px 2px rgba(16,18,22,.03);}
  .phead{display:flex;align-items:center;gap:12px;padding-bottom:14px;margin-bottom:16px;border-bottom:1px solid var(--line-soft);}
  .pnum{font-size:12px;font-weight:800;letter-spacing:.2em;color:var(--accent);font-variant-numeric:tabular-nums;}
  .phead h2{font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--ink);margin:0;}
  .phead .tag{margin-left:auto;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);background:var(--line-soft);padding:4px 9px;border-radius:999px;}

  label{display:block;font-size:11px;color:var(--muted);margin:12px 0 5px;font-weight:700;letter-spacing:.02em;}
  label:first-child{margin-top:0;}
  input,select,textarea{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:9px;font:inherit;font-size:13.5px;color:var(--ink);background:#fff;transition:border-color .12s,box-shadow .12s;}
  input::placeholder,textarea::placeholder{color:#aeb3bc;}
  input:focus,select:focus,textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--ring);}
  input:disabled{background:#f6f7f9;color:var(--muted);}
  textarea{min-height:66px;resize:vertical;line-height:1.55;}
  select{appearance:none;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path d='M2 4l4 4 4-4' stroke='%237a7f88' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>");background-repeat:no-repeat;background-position:right 12px center;padding-right:34px;}

  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 18px;}
  .row3{display:grid;grid-template-columns:1fr 2fr auto;gap:10px;align-items:center;margin-bottom:10px;}
  .row4{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:10px;margin-bottom:10px;}
  .reccard{border:1px solid var(--line);border-radius:11px;padding:14px;margin-bottom:12px;background:#fbfbfc;}
  .reccard input,.reccard textarea{margin-bottom:8px;background:#fff;}
  .colhdr{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:10px;font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.12em;margin-bottom:7px;}
  .hint{font-size:11.5px;color:var(--muted);margin:7px 0 0;line-height:1.5;}

  /* ---- token field accent ---- */
  .tokenwrap{display:flex;gap:10px;align-items:flex-start;}
  .tokenwrap input{flex:1;}
  .secure{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:#136a31;background:#e7f5ec;border:1px solid #c2e6cf;padding:0 10px;border-radius:9px;height:40px;white-space:nowrap;}

  /* ---- buttons ---- */
  button{font:inherit;font-weight:700;border:none;border-radius:10px;padding:12px 20px;cursor:pointer;font-size:13.5px;transition:background .12s,border-color .12s,transform .04s;}
  button:active{transform:translateY(1px);}
  button.primary{background:var(--accent);color:#fff;box-shadow:0 1px 2px rgba(225,28,36,.3);}
  button.primary:hover{background:var(--accent-700);}
  button.ghost{background:#fff;color:var(--ink);border:1px solid var(--line);}
  button.ghost:hover{border-color:#cbd0d8;background:#fbfbfc;}
  button.link{background:none;border:none;color:var(--accent);padding:8px 0;font-size:12.5px;}
  button.link:hover{text-decoration:underline;}
  button.del{padding:8px 12px;font-size:12px;color:var(--accent-700);}
  button:disabled{opacity:.6;cursor:default;}
  button:disabled:active{transform:none;}

  /* ---- spinner ---- */
  @keyframes spin{to{transform:rotate(360deg);}}
  .spin{display:inline-block;width:13px;height:13px;border:2px solid rgba(0,0,0,.18);border-top-color:var(--accent);border-radius:50%;vertical-align:-2px;margin-right:8px;animation:spin .7s linear infinite;}
  button.primary .spin{border-color:rgba(255,255,255,.45);border-top-color:#fff;}
  #status.work .spin{border-color:rgba(138,90,6,.28);border-top-color:#8a5a06;}

  /* ---- sticky action bar ---- */
  .actionbar{position:fixed;left:0;right:0;bottom:0;background:rgba(255,255,255,.92);backdrop-filter:blur(8px);border-top:1px solid var(--line);}
  .actionbar-in{max-width:1000px;margin:0 auto;padding:14px 24px;display:flex;gap:12px;align-items:center;}
  .actionbar .note{font-size:11.5px;color:var(--muted);margin-left:auto;max-width:42ch;text-align:right;line-height:1.4;}
</style></head>
<body>
<header class="topbar"><div class="topbar-in">
  <span class="brand">${SPARK}TrendAI<span class="tm">™</span></span>
  <span class="eyebrow">Cyber Risk Advisory</span>
</div></header>
<div class="hero"><div class="hero-in">
  <h1>Report Generator</h1>
  <p>Pull a live Trend Vision One™ snapshot and assemble the eight-section Cyber Risk Advisory PDF. Fields below cover only what the API can't provide — engagement labels, the session schedule, and optional commentary.</p>
</div></div>

<main>
  <form id="f" autocomplete="off" class="stack">
    <div id="status"></div>

    <section class="panel"><div class="phead"><span class="pnum">01</span><h2>Vision One Access</h2><span class="tag">Used once · not saved</span></div>
      <label>API token (Bearer)</label>
      <div class="tokenwrap">
        <input name="v1token" type="password" autocomplete="off" placeholder="Paste your Vision One API token">
        <span class="secure">${LOCK} In-browser only</span>
      </div>
      <p class="hint">Held in the browser only while this page is open; sent once with the request, never stored or logged. Leave blank to use the server's V1_API_TOKEN secret. Choose the Region matching your Vision One tenant's data center.</p>
    </section>

    <section class="panel"><div class="phead"><span class="pnum">02</span><h2>Engagement</h2></div>
      <div class="grid2">
        <div><label>Customer name *</label><input name="customerName" required placeholder="Acme Corp"></div>
        <div><label>Region *</label><select name="region">${regionOptions}</select></div>
        <div><label>Engagement label</label><input name="cycleLabel" value="90-Day Cycle · 4 Sessions"></div>
        <div><label>Document</label><input name="docId" value="CRA-2026 · v1.0"></div>
      </div>
      <label>Cover subtitle</label><textarea name="coverSubtitle" placeholder="Leave blank for the default subtitle"></textarea>
    </section>

    <section class="panel"><div class="phead"><span class="pnum">03</span><h2>Workbench Alert Window</h2></div>
      <label>Pull XDR detections from the last</label>
      <select name="wbDays">
        <option value="1">1 day</option>
        <option value="7">7 days</option>
        <option value="14">14 days</option>
        <option value="30" selected>30 days</option>
      </select>
      <p class="hint">Bounds the live XDR detection pull for the Attack Overview section.</p>
    </section>

    <section class="panel"><div class="phead"><span class="pnum">04</span><h2>Commentary</h2><span class="tag">Optional</span></div>
      <label>Executive summary intro — leave blank to auto-describe the live pull</label>
      <textarea name="executiveSummary"></textarea>
      <label>What changed this cycle (one bullet per line)</label>
      <textarea name="whatChanged"></textarea>
      <button type="button" class="link" id="draftBtn">Draft with AI from live data → review before use</button>
      <label>Data-source notes</label>
      <textarea name="dataSourceNotes" placeholder="e.g. Qualys disabled this cycle"></textarea>
    </section>

    <section class="panel"><div class="phead"><span class="pnum">05</span><h2>Recommendations</h2><span class="tag">Optional override</span></div>
      <p class="hint" style="margin:0 0 12px">Leave empty to auto-derive findings from the live data. Add rows only to override.</p>
      <div id="recs"></div>
      <button type="button" class="ghost" id="addRec">+ Add finding</button>
    </section>

    <section class="panel"><div class="phead"><span class="pnum">06</span><h2>Sessions &amp; Cadence</h2></div>
      <div class="colhdr"><span>Session</span><span>Date</span><span>Time</span><span>Status</span></div>
      <div id="sessions"></div>
    </section>
  </form>
</main>

<div class="actionbar"><div class="actionbar-in">
  <button type="button" class="primary" id="pdfBtn">Generate PDF</button>
  <button type="button" class="ghost" id="previewBtn">Preview HTML</button>
  <span class="note">All metrics, tables and findings are pulled live from Trend Vision One.</span>
</div></div>
<script>${script}</script>
</body></html>`;
}
