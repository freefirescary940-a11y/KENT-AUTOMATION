const $=s=>document.querySelector(s),esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0'),today=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const R=n=>'₹'+(Math.round(n)||0).toLocaleString('en-IN'),num=v=>parseFloat(v)||0;
const CASES=['Service','Installation'];
let db=true,role='',token='',adminOn=false,sess='',tab='stock',date=today(),items=[],techs=[],alloc=[],reps=[],ests=[],att=[],usage=null,saveErr='',loaded=15,D={};
let LM={adminOtp:false};fetch('/api/login-mode').then(r=>r.json()).then(j=>{LM=j||LM;if(!token)render(1)}).catch(()=>{});
try{['kentToken','kentSess','kentRole'].forEach(k=>localStorage.removeItem(k));const R0=JSON.parse(localStorage.getItem('kentRemember')||sessionStorage.getItem('kentRemember')||'null');if(R0&&R0.token){token=R0.token;sess=R0.sess||'';role=R0.role||'';adminOn=role==='admin'}}catch(e){}
function ntoast(id,t){const e=$('#toast');e.innerHTML=esc(t)+` <button class="btn sm" data-act="prev" data-v="${id}" style="margin-left:8px">Preview</button>`;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',20000)}
const srNorm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const serialInfo=r=>r.serial?`<div style="background:#eef6ff;border-radius:8px;padding:10px;margin:8px 0"><b>${r.serial.mode==='warranty'?'📄 Warranty card':'🔢 Serial number'}</b><p style="margin:4px 0">Serial number: <b>${esc(r.serial.no)}</b>${r.serial.mode==='warranty'?`<br>Installation date: <b>${esc(r.serial.inst)}</b><br>Purchase date: <b>${esc(r.serial.pur)}</b><br>Product code: <b>${esc(r.serial.code)}</b>`:''}</p>${r.serial.file?`<img src="${fl(r.serial.file)}" style="max-width:100%;border-radius:8px">`:'<span class="mu">no photo</span>'}</div>`:'';
const srCard=r=>`<div class="il"><div><b>${esc(r.customer)}</b> · Case ${esc(r.caseId||'-')} · ${esc(r.techName)} · ${esc(r.date)}<div class="mu">${r.serial?(r.serial.mode==='warranty'?'📄 Warranty card':'🔢 Serial')+': '+esc(r.serial.no):'Not a draft case (no serial number)'}</div></div><button class="btn sm" data-act="prev" data-v="${r.id}">Preview</button></div>`;
const searchHtml=()=>{const Q=srNorm(D.sq);if(!Q)return '<p class="mu">Type a serial number or Case ID (with or without -).</p>';const hits=reps.filter(r=>srNorm(r.caseId).includes(Q)||(r.serial&&srNorm(r.serial.no).includes(Q))).sort((a,b)=>b.ts-a.ts);return `<p class="mu">${hits.length} found${hits.length>30?' (showing 30)':''}</p>`+(hits.slice(0,30).map(srCard).join('')||'<p class="mu">Nothing found.</p>')};
const updSearch=()=>{const e=$('#sres');if(e)e.innerHTML=searchHtml()};
function preview(id){const r=reps.find(x=>x.id===id);if(!r)return toast('Report not found');$('#toast').style.display='none';
 const rows=(r.lines||[]).map(l=>`<tr><td>${esc(l.name)}${l.foc?' (FOC)':''}</td><td class="n">${l.foc?'FOC':R(l.price)}</td><td class="n">${l.qty}</td><td class="n">${l.foc?'FOC':R(l.qty*l.price)}</td></tr>`).join('')+(r.other?`<tr><td colspan="3">Other / service charge</td><td class="n">${R(r.other)}</td></tr>`:'');
 $('#mod').innerHTML=`<div><h2>Report preview</h2><p style="margin:0 0 8px"><b>${esc(r.techName)}</b> (${esc(r.techId)}) · ${esc(r.date)}</p><p style="margin:0 0 8px">Customer: <b>${esc(r.customer)}</b><br>Phone: ${esc(r.phone||'-')}<br>Case ID: <b>${esc(r.caseId||'-')}</b> · ${esc(r.type)}<br>Address: ${esc(r.address||'-')}</p>
 <table class="inv" style="width:100%"><tr><th>Item</th><th class="n">Rate</th><th class="n">Qty</th><th class="n">Amount</th></tr>${rows||'<tr><td colspan="4" class="mu">No items</td></tr>'}<tr class="s"><td colspan="3">Subtotal</td><td class="n">${R(r.subtotal)}</td></tr><tr class="s"><td colspan="3">Discount asked (${esc(r.dstatus||'none')})</td><td class="n">- ${R(r.discount)}</td></tr><tr class="g"><td colspan="3">TOTAL</td><td class="n">${R(pay(r))}</td></tr></table>
 ${r.dstatus==='pending'?`<p class="mu">If you approve, total becomes ${R(r.subtotal-r.discount)}.</p>`:''}${r.notes?`<p>Notes: ${esc(r.notes)}</p>`:''}<p>Payment: <b>${esc(r.payMode||'-')}</b></p>${serialInfo(r)}${r.billFile?`<p>Bill:<br><img src="${fl(r.billFile)}" style="max-width:100%;border-radius:8px"></p>`:''}${r.payFile?`<p>PhonePe photo:<br><img src="${fl(r.payFile)}" style="max-width:100%;border-radius:8px"></p>`:''}
 <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${r.dstatus==='pending'?`<button class="btn sm ok" data-act="ap" data-v="${r.id}">Approve discount</button><button class="btn sm no" data-act="rj" data-v="${r.id}">Reject</button>`:''}<button class="btn sm" data-act="cm">Close</button></div></div>`;$('#mod').style.display='flex';
if(!r.seen)api('POST','/api/reports/'+id+'/seen').catch(()=>{})}
let IMG={bill:'',pay:''},fileTarget='bill',WS=null;
const COL={};try{Object.assign(COL,JSON.parse(localStorage.getItem('kentCol')||'{}'))}catch(e){}
const colH=(k,t)=>`<h2 class="ch" data-act="col" data-v="${k}"><span>${t}</span><span class="mu">${COL[k]?'▸ Show':'▾ Hide'}</span></h2>`;
const colB=(k,b)=>COL[k]?'':b;
let cfg=null,bk=null,bkOk=false;
const due=()=>bkOk&&(!bk||!bk.date||Date.now()-new Date(bk.date+'T00:00:00').getTime()>=7*864e5);
const banner=()=>`<div class="card new"><b>💾 Weekly backup due</b> <span class="mu">${bk&&bk.date?'Last backup: '+esc(bk.date):'No backup taken yet'}</span><br><button class="btn sm" style="margin-top:8px" data-act="wk">Download backup now</button></div>`;let ADMIN_ID='';
const D$=k=>esc(D[k]==null?'':D[k]);
const me=()=>techs.find(t=>t.id===sess);
function toast(t){const e=$('#toast');e.textContent=t;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',6000)}
function waText(r){const ls=(r.lines||[]).map(l=>`${l.name} x${l.qty} = ${l.foc?'FOC':R(l.qty*l.price)}`).join('\n');
 return `Case ID: ${r.caseId} (${r.type})\n\n*Customer*\nName: ${r.customer}\nPhone: ${r.phone||'-'}\nAddress: ${r.address||'-'}\n\n*Items*\n${ls||'-'}${r.other?`\nService charge: ${R(r.other)}`:''}\n*Total: ${R(pay(r))}*\nPayment: ${r.payMode||'Cash'}`+(r.dstatus==='pending'?`\nDiscount asked: ${R(r.discount)} (waiting for admin approval)`:'')+(r.notes?`\nNotes: ${r.notes}`:'')}
async function toFile(u,name){if(!u)return null;const b=await(await fetch(u)).blob();return new File([b],name,{type:b.type||'image/jpeg'})}
async function openShare(r,srcs,banner){const files=[],names=['bill-'+r.caseId+'.jpg','phonepe-'+r.caseId+'.jpg'];
 try{for(let i=0;i<srcs.length;i++){const f=await toFile(srcs[i],names[i]);if(f)files.push(f)}}catch(e){}
 const can=!!(files.length&&navigator.canShare&&navigator.canShare({files}));WS={text:waText(r),files,can};
 $('#mod').innerHTML=`<div>${banner||''}<h2>📲 Share to WhatsApp group</h2><p class="mu">Tap the green button, choose your WhatsApp group and press send.</p><p style="font-weight:600;margin:6px 0;color:${can?'var(--ok)':'var(--wa)'}">${!files.length?'⚠ No photos found for this case.':can?'✅ '+files.length+' photo(s) will be attached.':'⚠ This browser cannot attach photos to WhatsApp. Tap “Save photos”, then attach them in the group from your gallery.'}</p><pre style="white-space:pre-wrap;font:inherit;font-size:13px;background:var(--bg);border:1px solid var(--bd);border-radius:8px;padding:10px;max-height:230px;overflow:auto">${esc(WS.text)}</pre><div style="display:flex;gap:8px;flex-wrap:wrap">${files.map(f=>`<img src="${URL.createObjectURL(f)}" style="height:70px;border-radius:6px">`).join('')}</div><div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn sm ok" data-act="wsend">📲 Share to WhatsApp</button>${can?'<button class="btn sm" data-act="wsendp">🖼 Photos only</button>':''}${files.length?'<button class="btn sm" data-act="wsave">💾 Save photos</button>':''}<button class="btn sm" data-act="cm">Close</button></div></div>`;$('#mod').style.display='flex'}

// ---------- Sending-approval progress screen (shown before the WhatsApp share) ----------
let PG=null;
function pgStop(){if(PG){clearInterval(PG.t);clearTimeout(PG.w);PG=null}}
function pgShow(ks){
 const sp='<style>@keyframes pgs{to{transform:rotate(360deg)}}</style><div style="width:44px;height:44px;border:5px solid var(--bd);border-top-color:var(--ok);border-radius:50%;margin:10px auto;animation:pgs 1s linear infinite"></div>';
 const msg=ks==='discount'?'⏸ Waiting for admin to approve the discount…':ks==='sending'?'⏳ Sending approval… please wait':'⏳ Waiting – sending approval… please wait';
 $('#mod').innerHTML=`<div id="pg" style="text-align:center"><h2>📤 Sending for approval</h2>${sp}<p style="font-weight:600">${msg}</p><p class="mu">You can tap Back at any time. The WhatsApp share opens automatically when this finishes, or you can use “Share to WhatsApp” on the case later.</p><button class="btn sm" data-act="pgback">← Back</button></div>`;
 $('#mod').style.display='flex'}
function openProgress(r,shots){
 pgStop();
 const OFF='<p style="font-weight:700;color:var(--wa);margin:0 0 6px">📨 Sent to admin – the approval will follow</p>';
 const DB='<p style="font-weight:700;color:var(--wa);margin:0 0 6px">📨 Discount sent to admin – the admin will send the approval from Salesforce</p>';
 if(r.ks==='discount')return openShare(r,shots,DB);
 if(r.ks==='offline')return openShare(r,shots,OFF);
 if(!r.ks||r.ks==='sent'||r.ks==='manual')return openShare(r,shots,r.ks?'<p style="font-weight:700;color:var(--ok);margin:0 0 6px">✅ Approval sent</p>':'');
 PG={id:r.id,t:null,w:null,done:false};pgShow(r.ks);
 const me_=PG;
 const step=async()=>{
  if(PG!==me_||me_.done)return;
  if(!$('#pg')){pgStop();return}                       // technician went back / closed the screen
  let ks;try{ks=(await api('GET','/api/reports/'+r.id+'/ks')).ks}catch(e){return}
  if(PG!==me_||me_.done||!$('#pg'))return;
  if(ks==='sent'||ks==='manual'){me_.done=true;pgStop();toast('✅ Approval sent');openShare(r,shots,'<p style="font-weight:700;color:var(--ok);margin:0 0 6px">✅ Approval sent</p>');load();return}
  if(ks==='discount'){me_.done=true;pgStop();openShare(r,shots,DB);return}
  if(ks==='offline'||ks===''){me_.done=true;pgStop();openShare(r,shots,OFF);load();return}
  if(ks==='failed'){me_.done=true;clearInterval(me_.t);
   $('#mod').innerHTML='<div id="pg" style="text-align:center"><h2>❌ Failed</h2><p style="font-weight:700;color:var(--bad)">Transferred to admin</p><p class="mu">The admin will finish this case. Opening WhatsApp share in 3 seconds…</p></div>';
   me_.w=setTimeout(()=>{if(PG!==me_)return;PG=null;openShare(r,shots,'<p style="font-weight:700;color:var(--bad);margin:0 0 6px">❌ Failed – transferred to admin</p>');load()},3000);return}
  pgShow(ks)};
 me_.t=setInterval(step,2000);step()}
const enc=c=>{let q=0.7,u=c.toDataURL('image/jpeg',q);while(u.length>120000&&q>0.41){q-=0.1;u=c.toDataURL('image/jpeg',q)}return u};
function shrink(file){return new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const s=Math.min(1,900/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);let u=enc(c);if(u.length>120000){const c2=document.createElement('canvas');c2.width=Math.round(c.width*0.75);c2.height=Math.round(c.height*0.75);c2.getContext('2d').drawImage(c,0,0,c2.width,c2.height);u=enc(c2)}ok(u)};im.onerror=()=>no(new Error('Please choose a photo'));im.src=r.result};r.onerror=()=>no(new Error('Cannot read file'));r.readAsDataURL(file)})}
const fl=n=>'/api/files/'+n+'?t='+encodeURIComponent(token);
const pics=r=>(r.billFile?`<a href="${fl(r.billFile)}" target="_blank">📄 Bill</a> `:'')+(r.payFile?`<a href="${fl(r.payFile)}" target="_blank">📱 PhonePe photo</a>`:'')+(!r.billFile&&!r.payFile&&r.archived?'<span class="mu">📁 photos saved on the PC backup</span>':'');
async function api(m,u,b){const r=await fetch(u,{method:m,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:b?JSON.stringify(b):undefined});const j=await r.json().catch(()=>({}));if(r.status===401&&token){doLogout();render(1)}if(!r.ok)throw new Error(j.error||'Request failed');return j}
function doLogout(){token='';sess='';role='';adminOn=false;load.sig='';try{['kentToken','kentSess','kentRole','kentRemember'].forEach(k=>{localStorage.removeItem(k);sessionStorage.removeItem(k)})}catch(e){}D={}}
// Keep the login after a page refresh: "Remember me" keeps it for 30 days on this device; otherwise it lasts until the tab is closed.
function keepLogin(){try{const v=JSON.stringify({token,sess,role});localStorage.removeItem('kentRemember');sessionStorage.removeItem('kentRemember');(D.rem?localStorage:sessionStorage).setItem('kentRemember',v)}catch(e){}}
async function load(){try{const s=await api('GET','/api/state');const sig=JSON.stringify(s);if(sig===load.sig)return;
 if(load.sig&&adminOn){const old=new Set(reps.map(r=>r.id));s.reports.filter(r=>!old.has(r.id)).forEach(r=>ntoast(r.id,'🔔 New report: '+r.techName+' – '+r.customer))}
 load.sig=sig;items=s.items;techs=s.technicians;alloc=s.allocations;reps=s.reports;ests=s.estimates||[];att=s.attendance||[];usage=s.storage||null;saveErr=s.saveError||'';bk=s.backupDate?{date:s.backupDate}:null;bkOk=true;cfg=s.adminDefault?null:{hash:1};ADMIN_ID=s.adminId||'';RB.since=s.robotSince||0;RB.seen=s.robotSeen||0;render()}catch(e){}}
const clr=p=>Object.keys(D).forEach(k=>{if(k.startsWith(p))delete D[k]});
const pay=r=>r.dstatus==='approved'?r.subtotal-r.discount:r.subtotal;
function ledger(d,t,full){const m={};const g=(a,i,n,tn)=>{const k=a+'|'+i;return m[k]||(m[k]={t:a,tn,i,n,open:0,given:0,sold:0})};
 alloc.forEach(a=>{if(t&&a.techId!==t)return;const r=g(a.techId,a.itemId,a.itemName,a.techName);if(a.date<d)r.open+=a.qty;else if(a.date===d)r.given+=a.qty});
 reps.forEach(x=>{if(t&&x.techId!==t)return;(x.lines||[]).forEach(l=>{const r=g(x.techId,l.itemId,l.name,x.techName);if(x.date<d)r.open-=l.qty;else if(x.date===d)r.sold+=l.qty})});
 if(full)(t?techs.filter(x=>x.id===t):techs).forEach(x=>items.forEach(i=>g(x.id,i.id,i.name,x.name)));
 return Object.values(m).filter(r=>full||r.open||r.given||r.sold).sort((a,b)=>String(a.tn).localeCompare(String(b.tn))||String(a.n).localeCompare(String(b.n)))}
const remOf=(d,t,i)=>ledger(d,t).filter(r=>r.i===i).reduce((s,r)=>s+r.open+r.given-r.sold,0);
const stockTbl=(rows,st)=>rows.length?`<div class="sc"><table><tr>${st?'<th>Technician</th>':''}<th>Item</th><th class="n">Opening</th><th class="n">Given</th><th class="n">Sold</th><th class="n">Remaining</th></tr>${rows.map(r=>{const m=r.open+r.given-r.sold;return`<tr>${st?`<td>${esc(r.tn)} <span class="mu">(${esc(r.t)})</span></td>`:''}<td>${esc(r.n)}</td><td class="n">${r.open}</td><td class="n">${r.given}</td><td class="n">${r.sold}</td><td class="n ${m<0?'low':''}"><b>${m}</b></td></tr>`}).join('')}</table></div><p class="mu">Remaining stock becomes next day’s opening automatically.</p>`:'<p class="mu">No stock for this date.</p>';
const linesTxt=r=>(r.lines||[]).map(l=>`${esc(l.name)} ×${l.qty} ${l.foc?'<b>FOC</b>':'@'+R(l.price)}`).concat(r.other?['Other '+R(r.other)]:[]).join(', ')||'-';
const KS={working:'Robot is working on this case now',manual:'Finished by hand',filled:'Filled in Kent portal',approval_sent:'Approval sent to customer',failed:'Robot FAILED - finish this case by hand',pending:'Pending - waiting (serial number / Case ID not found / Allocated)',skipped:'Not sent to robot (offline call / installation)',cancelled:'Removed from queue by admin'};
const kst=r=>r.kent?`<div class="mu">🤖 ${esc(KS[r.kent.status]||r.kent.status)} ${esc(r.kent.note||'')}</div>`:'';
const dstat=r=>r.dstatus&&r.dstatus!=='none'?`<span class="st ${r.dstatus}">Discount ${R(r.discount)} · ${r.dstatus}</span>`:'';

// ---------- Sending for approval (robot queue) ----------
const RB={since:0,seen:0};
const rbOk=r=>!r.kent&&r.ts>=RB.since&&r.dstatus!=='pending'&&r.type!=='Installation'&&!/offline/i.test(r.caseId||'');
const rbQ=()=>reps.filter(rbOk).sort((a,b)=>(b.kentPrio||0)-(a.kentPrio||0)||a.ts-b.ts);
const rbSt=s=>reps.filter(r=>r.kent&&r.kent.status===s).sort((a,b)=>b.kent.ts-a.kent.ts);
const rbIn=ts=>{const m=Math.max(0,Math.ceil(((ts||0)-Date.now())/60000));return m<1?'any moment':'in '+m+' min'};
const rbCount=()=>rbQ().length+rbSt('working').length+rbSt('failed').length+rbSt('pending').length;
const rbAgo=ts=>{const m=Math.max(0,Math.round((Date.now()-ts)/60000));return m<1?'just now':m<60?m+' min ago':Math.round(m/60)+' h ago'};
function viewSend(){
 const q=rbQ(),w=rbSt('working'),f=rbSt('failed'),pd=rbSt('pending'),fl=rbSt('filled'),held=reps.filter(r=>!r.kent&&r.ts>=RB.since&&r.dstatus==='pending'&&r.type!=='Installation'&&!/offline/i.test(r.caseId||''));
 const who=r=>`<b>${esc(r.techName)}</b> → ${esc(r.customer)} · Case <b>${esc(r.caseId||'-')}</b> · ${esc(r.type)}`;
 const pv=r=>`<button class="btn sm" data-act="prev" data-v="${r.id}">Preview</button>`;
 const row=(r,extra,btns)=>`<div class="il" style="align-items:flex-start"><div>${who(r)}${extra||''}<div>${pv(r)}${btns||''}</div></div><b>${R(pay(r))}</b></div>`;
 const hand=t=>r=>` <button class="btn sm ok" data-act="hand" data-v="${r.id}">${t}</button>`;
 const sent=reps.filter(r=>r.kent&&(r.kent.status==='approval_sent'||r.kent.status==='manual'||r.kent.status==='cancelled')&&Date.now()-r.kent.ts<48*3600e3).sort((a,b)=>b.kent.ts-a.kent.ts);
 const retry=r=>` <button class="btn sm" data-act="retry" data-v="${r.id}">↻ Retry</button>`;
 const stuck=r=>Date.now()-r.kent.ts>20*60000;
 const seen=RB.seen?(Date.now()-RB.seen>3*60000?`⚠ Robot last checked ${rbAgo(RB.seen)} – is the robot PC switched on?`:`🤖 Robot is online (checked ${rbAgo(RB.seen)})`):'⚠ Robot has not connected since the app started – check the robot PC.';
 $('#app').innerHTML=`<div class="card"><h2>📤 Sending for approval</h2><p class="mu">${seen}</p><p class="mu">The robot fills each case in Kent and sends the approval to the customer. Cases with approval sent stay in the Sent list for 48 hours.</p></div>
 <div class="card"><h2>⚙️ Working now${w.length?` <span class="badge">${w.length}</span>`:''}</h2>${w.length?w.map(r=>row(r,`<div class="mu">🤖 started ${rbAgo(r.kent.ts)}${stuck(r)?' · ⚠ taking very long – check the robot window. If you finished it yourself, tap “Done by hand”.':''}</div>${r.kent.cancel?'<div class="mu" style="font-weight:600">⏹ Cancel requested – robot is stopping…</div>':''}`,(r.kent.cancel?'':` <button class="btn sm no" data-act="cancelw" data-v="${r.id}">✖ Cancel</button>`)+(stuck(r)?hand('✓ Done by hand')(r):''))).join(''):'<p class="mu">Robot is idle.</p>'}</div>
 <div class="card"><h2>⏳ In queue${q.length?` <span class="badge">${q.length}</span>`:''}</h2>${q.length?`<p class="mu">Order the robot will follow. “Make priority 1” puts a case next – it starts right after the case being worked on now finishes (a running case is never interrupted).</p>`+q.map((r,i)=>row(r,`<div class="mu">#${i+1}${r.kentPrio?' · <span class="badge">Priority</span>':''} · submitted ${rbAgo(r.ts)}</div>`,(i>0?` <button class="btn sm" data-act="prio" data-v="${r.id}">⭐ Make priority 1</button>`:'')+(r.kentPrio?` <button class="btn sm no" data-act="unprio" data-v="${r.id}">Remove priority</button>`:'')+` <button class="btn sm no" data-act="dq" data-v="${r.id}">✖ Cancel</button>`)).join(''):'<p class="mu">Nothing waiting ✓</p>'}</div>
 ${held.length?`<div class="card"><h2>⏸ Held – discount waiting <span class="badge">${held.length}</span></h2><p class="mu">The robot will not take these until you approve or reject the discount in Sales.</p>${held.map(r=>row(r,dstat(r))).join('')}</div>`:''}
${pd.length?`<div class="card"><h2>⏸ Pending <span class="badge">${pd.length}</span></h2><p class="mu">The robot looks at these again every 15 minutes: when the Case ID is found and Kent shows <b>Assigned</b>, it does the work by itself. “Allocated” cases wait until they are Assigned. Urgent? Tap “Go next” – the robot does it right after the case it is working on now. Finished it yourself? Tap “Done by hand”.</p>${pd.map(r=>row(r,`<div class="mu">${r.kent.kind==='allocated'?'📌 Kent status: Allocated – waiting for Assigned':r.kent.kind==='warranty'?'📄 Serial not found in Kent – waiting for the WARRANTY CARD from technician':r.kent.kind==='serial'?'📷 Draft machine – waiting for the technician to send the serial number + photo':'🔎 Case ID not found in Kent'} · checked ${rbAgo(r.kent.ts)}${(r.kent.checks||0)>=48?' · stopped checking (12 h) – use Go next or Done by hand':` · next check ${rbIn(r.kent.next)} · check #${r.kent.checks||1}`}</div>`,hand('✓ Done by hand')(r)+` <button class="btn sm" data-act="gonext" data-v="${r.id}">⏭ Go next</button>`)).join('')}</div>`:''}
  <div class="card"><h2>❌ Failed${f.length?` <span class="badge">${f.length}</span>`:''}</h2>${f.length?`<p class="mu">Finish these in Kent by hand, then tap “Done by hand”. “Retry” starts the case again from the beginning – first check in Kent that nothing was already added.</p>`+f.map(r=>row(r,`<div class="mu">🤖 ${esc(r.kent.note||'')} · ${rbAgo(r.kent.ts)}</div>`,hand('✓ Done by hand')(r)+retry(r))).join(''):'<p class="mu">No failed cases ✓</p>'}</div>
 <div class="card"><h2>✅ Sent – last 48 hours${sent.length?` <span class="badge">${sent.length}</span>`:''}</h2>${sent.length?sent.map(r=>row(r,`<div class="mu">${r.kent.status==='manual'?'✍ Finished by hand':r.kent.status==='cancelled'?'🚫 Removed from queue':'✅ Approval sent'} · ${rbAgo(r.kent.ts)}</div>`)).join(''):'<p class="mu">No approvals sent in the last 48 hours.</p>'}</div>
 ${fl.length?`<div class="card"><h2>📝 Filled – approval not sent</h2>${fl.map(r=>row(r,`<div class="mu">🤖 ${esc(r.kent.note||'')}</div>`,hand('Hide')(r))).join('')}</div>`:''}`}

function head(){const t=$('#tabs');t.innerHTML='';document.body.dataset.role=adminOn?'admin':(me()?'tech':'out');
 if(adminOn){const p=reps.filter(r=>!r.seen||r.dstatus==='pending').length;
  t.innerHTML=[['stock','Stock'],['sales','Sales'+(p?`<span class="badge">${p}</span>`:'')],['send','Sending'+(rbCount()?`<span class="badge">${rbCount()}</span>`:'')],['est','Estimate'],['stk','Stickers'],['setup','Setup']].map(([k,l])=>`<button data-act="tab" data-v="${k}" class="${tab===k?'on':''}">${l}</button>`).join('')+'<button data-act="out">Logout</button>';document.title=(p?`(${p}) `:'')+'Kent Service'}
 else if(me())t.innerHTML=`<span class="mu" style="align-self:center">${esc(me().name)} (${esc(me().id)})</span><button data-act="out">Logout</button>`}

function loginForm(){const adm=D.lmode==='admin';
const seg=`<div class="seg"><button type="button" data-act="lmode" data-v="tech" class="${adm?'':'on'}">🛠 Technician</button><button type="button" data-act="lmode" data-v="admin" class="${adm?'on':''}">🛡 Admin</button></div>`;
const rem=`<label class="rem"><input type="checkbox" data-d="rem" ${D.rem?'checked':''} style="width:auto;margin:0"> Remember me on this device</label>`;
if(adm&&LM.adminOtp){
 if(D.ostep==='code')return seg+`<p class="sub" style="margin:0 0 4px">We sent a 6-digit code to <b>${esc(D.aem||'')}</b>. It is valid for 10 minutes.</p><label>Enter code</label><div class="fld"><span>🔑</span><input class="otp" data-d="otp" value="${D$('otp')}" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="● ● ● ● ● ●"></div>${rem}<button class="btn" data-act="otpver">Verify &amp; Login <b>→</b></button><div class="lgn-alt"><button type="button" data-act="otpreq">↻ Resend code</button><button type="button" data-act="otpback">✎ Change email</button></div>`;
 return seg+`<label>Admin email</label><div class="fld"><span>✉️</span><input type="email" data-d="aem" value="${D$('aem')}" autocomplete="email" autocapitalize="none" placeholder="Enter admin email"></div><button class="btn" data-act="otpreq">Send OTP <b>→</b></button>`}
return seg+`<label>ID</label><div class="fld"><span>👤</span><input data-d="lid" value="${D$('lid')}" autocapitalize="none" autocomplete="username" placeholder="Enter your ID"></div><label>Password</label><div class="fld"><span>🔒</span><input type="password" data-d="lpw" value="${D$('lpw')}" autocomplete="current-password" placeholder="Enter your password"><button type="button" class="eye" title="Show / hide password" onclick="var i=this.previousElementSibling;i.type=i.type==='password'?'text':'password'">👁</button></div>${rem}<button class="btn" data-act="login">Login <b>→</b></button>`}
function viewLogin(){$('#app').innerHTML=`<div class="lgn"><div class="lgn-bg"><span class="o o1"></span><span class="o o2"></span><span class="o o3"></span><i></i><i></i><i></i><i></i><b></b><b></b><b></b><b></b><b></b><b></b><div class="lgn-waves"><svg viewBox="0 0 1440 140" preserveAspectRatio="none"><path fill="rgba(34,211,238,.22)" d="M0 70 C120 20 240 20 360 70 S600 120 720 70 S960 20 1080 70 S1320 120 1440 70 V140 H0Z"/></svg><svg viewBox="0 0 1440 140" preserveAspectRatio="none"><path fill="rgba(34,211,238,.14)" d="M0 70 C120 20 240 20 360 70 S600 120 720 70 S960 20 1080 70 S1320 120 1440 70 V140 H0Z"/></svg></div></div>
<div class="lgn-card"><aside class="lgn-brand"><div class="lgn-ico"><div class="lgn-drop">💧</div></div><h1>Sri Rajammathalli Services</h1><span class="lgn-pill">KENT AUTHORIZED SERVICE CENTER</span><p>Technician stock, sales and discount approval — all in one place.</p><div class="lgn-feat"><span>🛠 Sales &amp; Service</span><span>✅ Genuine spares</span><span>⚡ Fast support</span></div><div class="lgn-meta"><span>📍 Medicover Hospital Back Side, Bhyrivani Peta, Srikakulam – 532410</span><span>📞 9440756347</span><span>✉️ rajammathalliservices@gmail.com</span></div><div class="lgn-tag">Pure • Safe • Healthy</div></aside>
<section class="lgn-form"><div class="lgn-av">👋</div><h2>Welcome back</h2><p class="sub">Sign in to manage stock, sales and approvals</p>${loginForm()}<div class="lgn-sec">🔐 Secure login · your data stays private</div><p class="note">Technicians: ID and password are given by your admin. Admin: use the admin ID.</p></section></div>
<div class="lgn-foot">Water Purifier Sales &amp; Service</div></div>`}

const resHtml=p=>{const q=(D['s'+p]||'').toLowerCase().trim();if(!q)return'';const tk=q.split(/\s+/),r=items.filter(i=>{const hay=(i.name+' '+(i.partCode||'')).toLowerCase();return tk.every(t=>hay.includes(t))&&!(num(D[p+i.id])>0)}).slice(0,8);return r.map(i=>`<button class="chip" data-act="add" data-v="${p}${i.id}">+ ${esc(i.name)}${i.partCode?' <span class="mu">'+esc(i.partCode)+'</span>':''} <span class="mu">${R(i.price)}</span></button>`).join('')||'<span class="mu">No match</span>'};
const updRes=p=>{const e=$('#res-'+p[0]);if(e)e.innerHTML=resHtml(p)};
function gres(){const q=(D.sgq||'').toLowerCase().trim();if(!q)return'';const tk=q.split(/\s+/),r=items.filter(i=>{const hay=(i.name+' '+(i.partCode||'')).toLowerCase();return tk.every(t=>hay.includes(t))&&!(num(D['g.'+i.id])>0)}).slice(0,8);return r.map(i=>`<button class="chip" data-act="gsel" data-v="${i.id}">${esc(i.name)}${i.partCode?' <span class="mu">'+esc(i.partCode)+'</span>':''} <span class="mu">${R(i.price)}</span></button>`).join('')||'<span class="mu">No match</span>'}
function gpick(){const chosen=items.filter(i=>num(D['g.'+i.id])>0),left=items.filter(i=>!(num(D['g.'+i.id])>0));
 return `<input data-d="sgq" placeholder="🔍 Search name or part code…" autocomplete="off" value="${D$('sgq')}"><div class="res" id="res-gq">${gres()}</div><div class="gadd"><select data-gi="1"><option value="">Select item…</option>${left.map(i=>`<option value="${i.id}" ${D.gi===i.id?'selected':''}>${esc(i.name)}${i.partCode?' ('+esc(i.partCode)+')':''} – ${R(i.price)}</option>`).join('')}</select><input type="number" min="1" placeholder="Qty" data-d="gq" value="${D$('gq')}"><button class="btn sm" data-act="gadd">+ Add</button></div>`
 +(chosen.map(i=>`<div class="il"><div>${esc(i.name)}<div class="mu">${i.partCode?'Part '+esc(i.partCode)+' · ':''}${R(i.price)} · has ${remOf(date,D.gt,i.id)} now</div></div><div style="display:flex;gap:6px"><input type="number" min="1" data-d="g.${i.id}" value="${D$('g.'+i.id)}"><button class="btn sm no" data-act="rm" data-v="g.${i.id}">✕</button></div></div>`).join('')||'<p class="mu">Select an item, enter quantity, then tap + Add.</p>')}
function pick(p){if(p==='g.')return gpick();const tid=p==='q.'?(me()||{}).id:D.gt,chosen=items.filter(i=>num(D[p+i.id])>0),left=items.filter(i=>!(num(D[p+i.id])>0));
 return `<div class="row"><div><input data-d="s${p}" placeholder="🔍 Search name or part code…" autocomplete="off" value="${D$('s'+p)}"></div><div><select data-s="${p}"><option value="">Select item…</option>${left.map(i=>`<option value="${i.id}">${esc(i.name)}${i.partCode?' ('+esc(i.partCode)+')':''} – ${R(i.price)}</option>`).join('')}</select></div></div><div class="res" id="res-${p[0]}">${resHtml(p)}</div>`
 +(chosen.map(i=>`<div class="il"><div>${esc(i.name)}<div class="mu">${i.partCode?'Part '+esc(i.partCode)+' · ':''}${R(i.price)} · in stock ${remOf(date,tid,i.id)}</div></div><div style="display:flex;gap:6px">${p==='q.'?`<label style="display:flex;align-items:center;gap:4px;margin:0;font-weight:600;white-space:nowrap"><input type="checkbox" data-d="f.${i.id}" ${D['f.'+i.id]?'checked':''} style="width:auto;margin:0"> FOC</label>`:''}<input type="number" min="1" data-d="${p}${i.id}" value="${D$(p+i.id)}"><button class="btn sm no" data-act="rm" data-v="${p}${i.id}">✕</button></div></div>`).join('')||'<p class="mu">Search or select an item to add it.</p>')}
const upl=(k,t)=>`<label>${t}</label><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" data-act="pickfile" data-v="${k}:cam">📷 Take photo</button><button type="button" class="btn sm" data-act="pickfile" data-v="${k}:gal">🖼 Gallery</button></div>${IMG[k]?`<img src="${IMG[k]}" style="max-width:160px;border-radius:8px;display:block;margin-top:6px"><span class="mu">✓ Photo added</span>`:''}`;
function viewTech(){const m=me(),rows=ledger(date,m.id,true);
 $('#app').innerHTML=`<div class="card"><div class="row"><div><label>Date</label><input type="date" id="dt" value="${date}"></div></div></div>
 <div class="card">${colH('mine','My stock')}${colB('mine',stockTbl(rows,false))}</div>
 <div class="card"><h2>New case / sale</h2><div class="row"><div><label>Customer *</label><input data-d="cn" value="${D$('cn')}"></div><div><label>Phone</label><input type="tel" data-d="cp" value="${D$('cp')}"></div></div>
 <label>Case ID * <span class="mu" style="font-weight:400">(type "offline call" if there is no Kent case)</span></label><input data-d="cid" value="${D$('cid')}"><label>Address / area</label><input data-d="ca" value="${D$('ca')}"><label>Case type</label><select data-d="ct">${CASES.map(c=>`<option ${D.ct===c?'selected':''}>${c}</option>`).join('')}</select>
 <label style="display:flex;align-items:center;gap:8px;margin-top:14px;font-weight:600"><input type="checkbox" data-d="svc" ${D.svc?'checked':''} style="width:auto;margin:0"> Service only (no spares used)</label>
 ${D.svc?'<p class="mu">Service only – no spares. Enter the service charge below.</p>':`<label style="margin-top:14px">Items</label>${items.length?pick('q.'):'<p class="mu">Admin has not added items yet.</p>'}`}
 <div class="row"><div><label>Other / service charge (₹)</label><input type="number" min="0" data-d="other" value="${D$('other')}"></div><div><label>Discount (₹) – needs admin approval</label><input type="number" min="0" data-d="disc" value="${D$('disc')}"></div></div>
 <div id="sum"></div><label>Remarks (optional – goes into Kent Solution Remark)</label><textarea rows="2" data-d="notes" placeholder="e.g. Filter changed, customer informed">${D$('notes')}</textarea><label>Payment *</label><select data-d="pm"><option ${D.pm!=='PhonePe'?'selected':''}>Cash</option><option ${D.pm==='PhonePe'?'selected':''}>PhonePe</option></select>
 <div id="billbox"></div>
 <div id="err" class="low" style="margin-top:10px;font-weight:600"></div><button class="btn" data-act="sale">Submit to admin</button></div>
 ${waitBoxes(m)}<div class="card"><h2>My cases on ${esc(date)}</h2>${mine(m)}</div>`;upd()}
const ksTech=r=>({serial:'📷 Waiting – send the serial number + photo',waiting:'⏳ Waiting – sending approval…',sending:'⏳ Sending approval…',sent:'✅ Approval sent',failed:'❌ Failed – transferred to admin',manual:'✅ Completed by admin',discount:'⏸ Waiting for admin to approve the discount',offline:'📨 Sent to admin – approval will follow'}[r.ks]||'');
const ksCol=r=>({sent:'var(--ok)',manual:'var(--ok)',failed:'var(--bad)'}[r.ks]||'inherit');
const serialWaitBox=r=>{const id=r.id,w=r.serialWait||{},sent=w.sent>w.ts,W=w.need==='warranty',ph=k=>IMG[k]?`<img src="${IMG[k]}" style="max-width:160px;border-radius:8px;display:block;margin-top:6px"><span class="mu">✓ Photo added</span>`:'';
 const head=`<b>${esc(r.customer)} · Case ${esc(r.caseId)}</b>`;
 if(sent)return `<div class="card" style="margin-top:8px">${head}<p class="mu">✓ Sent to the robot. It is checking Kent now.</p></div>`;
 const serialPart=W?'':`<div style="border-top:1px solid #ddd;margin-top:12px;padding-top:10px"><b>Option 1 – Serial number</b><p class="mu">The robot searches this serial number in Kent.</p></div>
 <label>Serial number *</label><input data-d="sn.${id}" value="${D$('sn.'+id)}" placeholder="e.g. KR2309313014">
 <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" data-act="pickfile" data-v="sphoto.${id}:cam">📷 Take photo</button><button type="button" class="btn sm" data-act="pickfile" data-v="sphoto.${id}:gal">🖼 Gallery</button></div>${ph('sphoto.'+id)}
 <div style="margin-top:8px"><button class="btn sm ok" data-act="sendserial" data-v="${id}:serial">Send serial number</button></div>`;
 const cardHead=W?`<div style="background:#fff7e0;border-radius:8px;padding:10px;margin-top:8px"><b>📄 Kent search did not find this serial number.</b><p class="mu" style="margin:4px 0 0">Send the WARRANTY CARD now: serial number, installation date, purchase date, product code and a photo of the card.</p></div>`:`<div style="border-top:1px solid #ddd;margin-top:12px;padding-top:10px"><b>Option 2 – Warranty card</b><p class="mu">Use this if Kent does not find the serial number. Fill all of these; the serial number above is used too.</p></div>`;
 return `<div class="card" style="margin-top:8px">${head}${w.note?`<p class="mu">Robot: ${esc(w.note)}</p>`:''}
 ${serialPart}
 ${cardHead}
 <div class="row"><div><label>Installation date (dd/mm/yyyy) *</label><input data-d="si.${id}" value="${D$('si.'+id)}" placeholder="dd/mm/yyyy" inputmode="numeric" maxlength="10"></div><div><label>Purchase date (dd/mm/yyyy) *</label><input data-d="sp.${id}" value="${D$('sp.'+id)}" placeholder="dd/mm/yyyy" inputmode="numeric" maxlength="10"></div></div>
 <label>Product code *</label><input data-d="sc.${id}" value="${D$('sc.'+id)}" placeholder="e.g. 111199B">
 <label>Serial number (from warranty card) *</label><input data-d="sn.${id}" value="${D$('sn.'+id)}" placeholder="e.g. KR2309313014">
 <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" data-act="pickfile" data-v="wphoto.${id}:cam">📷 Take photo of card</button><button type="button" class="btn sm" data-act="pickfile" data-v="wphoto.${id}:gal">🖼 Gallery</button></div>${ph('wphoto.'+id)}
 <div style="margin-top:8px"><button class="btn sm ok" data-act="sendserial" data-v="${id}:warranty">Send warranty card</button></div></div>`};
const waitBoxes=m=>{const w=reps.filter(r=>r.techId===m.id&&r.serialWait);return w.length?`<div class="card"><h2>📷 Draft machine – serial number needed <span class="badge">${w.length}</span></h2><p class="mu">Kent shows IP Warranty Status = Draft. Send the serial number with its photo. If Kent does not find the serial, send the warranty card instead.</p>${w.map(serialWaitBox).join('')}</div>`:''};
function mine(m){const l=reps.filter(r=>r.techId===m.id&&r.date===date).sort((a,b)=>b.ts-a.ts);return l.length?l.map(r=>`<div class="il"><div><b>${esc(r.customer)}</b> · ${esc(r.type)}${r.caseId?' · Case '+esc(r.caseId):''}<div class="mu">${linesTxt(r)} · ${esc(r.payMode||'')}</div>${dstat(r)}${ksTech(r)?`<div style="font-weight:600;color:${ksCol(r)}">${ksTech(r)}</div>`:''}<div><button class="btn sm" data-act="wcase" data-v="${r.id}">📲 Share to WhatsApp</button></div></div><b>${R(pay(r))}</b></div>`).join(''):'<p class="mu">Nothing uploaded yet.</p>'}
function calc(){const lines=D.svc?[]:items.filter(i=>num(D['q.'+i.id])>0).map(i=>{const foc=!!D['f.'+i.id];return{itemId:i.id,name:i.name,price:foc?0:i.price,foc,qty:Math.floor(num(D['q.'+i.id]))}});const other=num(D.other),sub=lines.reduce((s,l)=>s+l.qty*l.price,0)+other,disc=Math.min(num(D.disc),sub);return{lines,other,sub,disc,tot:sub-disc}}
const isFree=c=>c.sub===0&&(c.lines.length>0||!!D.svc);   // nothing to pay: every spare is FOC, or Service only with no charge   // every spare is FOC and there is no other charge -> nothing to pay, no bill needed
function upd(){const e=$('#sum');if(!e)return;const c=calc();
 const bb=$('#billbox');if(bb)bb.innerHTML=isFree(c)?'<p style="font-weight:600;color:var(--ok);margin-top:12px">✅ '+(D.svc?'Service only, no charge':'All spares are FOC')+' – no bill and no payment photo needed.</p>':upl('bill','Upload bill (photo) *')+(D.pm==='PhonePe'?upl('pay','PhonePe payment photo / screenshot *'):'');
 const rw=l=>`<tr><td>${esc(l.name)}${l.foc?' <b>(FOC)</b>':''}</td><td class="n">${l.foc?'FOC':R(l.price)}</td><td class="n">${l.qty}</td><td class="n">${l.foc?'FOC':R(l.qty*l.price)}</td></tr>`;
 e.innerHTML=`<table class="inv"><tr><th>Item</th><th class="n">Rate</th><th class="n">Qty</th><th class="n">Amount</th></tr>${c.lines.map(rw).join('')||'<tr><td colspan="4" class="mu">No items selected</td></tr>'}${c.other?`<tr><td colspan="3">Other / service charge</td><td class="n">${R(c.other)}</td></tr>`:''}<tr class="s"><td colspan="3">Subtotal</td><td class="n">${R(c.sub)}</td></tr><tr class="s"><td colspan="3">Discount ${c.disc?'(pending admin approval)':''}</td><td class="n">- ${R(c.disc)}</td></tr><tr class="g"><td colspan="3">TOTAL TO COLLECT</td><td class="n">${R(c.tot)}</td></tr></table>`}
function ask(text,withInput){return new Promise(res=>{const m=$('#mod');m.innerHTML=`<div><p style="white-space:pre-line">${esc(text)}</p>${withInput?'<input id="askin" type="text" style="margin:8px 0">':''}<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button class="btn sm" id="askno" style="background:var(--mu)">Cancel</button><button class="btn sm" id="askyes">OK</button></div></div>`;m.style.display='flex';const done=v=>{m.style.display='none';res(v)};$('#askyes').onclick=()=>done(withInput?($('#askin').value||''):true);$('#askno').onclick=()=>done(withInput?null:false);if(withInput)$('#askin').focus()})}
const fail=m=>{toast(m);const e=$('#err');if(e){e.textContent='⚠ '+m;e.scrollIntoView({block:'center',behavior:'smooth'})}};
async function sale(){const er=$('#err');if(er)er.textContent='';const c=calc(),m=me();if(!D.cn||!D.cn.trim())return fail('Enter customer name');if(!D.cid||!D.cid.trim())return fail('Enter Case ID');const free=isFree(c);if(!free&&!IMG.bill)return fail('Upload the bill photo');if(!free&&D.pm==='PhonePe'&&!IMG.pay)return fail('Upload the PhonePe payment photo');if(!c.lines.length&&!c.other&&!D.svc)return fail('Add at least one item or charge');
 const low=c.lines.filter(l=>l.qty>remOf(date,m.id,l.itemId)).map(l=>l.name),bt=document.querySelector('[data-act="sale"]'),shots=[IMG.bill,(!free&&D.pm==='PhonePe')?IMG.pay:''];if(bt){bt.disabled=true;bt.textContent='Sending… please wait'}
 try{await api('POST','/api/reports',{date,customer:D.cn.trim(),phone:(D.cp||'').trim(),address:(D.ca||'').trim(),type:D.ct||'Service',caseId:D.cid.trim(),lines:c.lines.map(l=>({itemId:l.itemId,qty:l.qty,foc:!!l.foc})),other:c.other,discount:c.disc,serviceOnly:!!D.svc,notes:(D.notes||'').trim(),payMode:(!free&&D.pm==='PhonePe')?'PhonePe':'Cash',billPhoto:IMG.bill,payPhoto:(!free&&D.pm==='PhonePe')?IMG.pay:''});IMG={bill:'',pay:''};delete D.pm;clr('q.');clr('f.');['cn','cp','cid','ca','other','disc','notes','svc'].forEach(k=>delete D[k]);toast('Sent to admin ✓'+(low.length?' (stock was low for '+low.join(', ')+')':''));await load();render(1);const rec=reps.filter(x=>x.techId===m.id).sort((a,b)=>b.ts-a.ts)[0];if(rec)openProgress(rec,shots)}catch(e){fail(e.message);if(bt){bt.disabled=false;bt.textContent='Submit to admin'}}}

function attCard(g){const mine=att.filter(a=>a.techId===g.id),on=mine.find(a=>a.date===date),mo=date.slice(0,7),cnt=(arr,s)=>arr.filter(a=>a.status===s).length,mm=mine.filter(a=>a.date.startsWith(mo));
 const[Y,M]=mo.split('-').map(Number),days=new Date(Y,M,0).getDate(),first=new Date(Y,M-1,1).getDay(),map={};mine.forEach(a=>map[a.date]=a.status);
 let cells='<span></span>'.repeat(first);for(let d=1;d<=days;d++){const ds=mo+'-'+String(d).padStart(2,'0'),s=map[ds];cells+=`<button class="${s==='working'?'w':s==='leave'?'l':''} ${ds===date?'sel':''}" data-act="adate" data-v="${ds}">${d}</button>`}
 const body=`<p class="mu">Marking date: <b>${esc(date)}</b> – ${on?(on.status==='working'?'✅ Working':'🏖 Leave'):'not marked'}</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm ok" data-act="att" data-v="working">✅ Working</button><button class="btn sm no" data-act="att" data-v="leave">🏖 Leave</button><button class="btn sm" data-act="att" data-v="">Clear</button></div><table class="inv" style="width:100%;margin-top:12px"><tr><th></th><th class="n">Days worked</th><th class="n">Days leave</th></tr><tr><td>${esc(mo)}</td><td class="n">${cnt(mm,'working')}</td><td class="n">${cnt(mm,'leave')}</td></tr><tr class="s"><td>All time</td><td class="n">${cnt(mine,'working')}</td><td class="n">${cnt(mine,'leave')}</td></tr></table><div class="cal" style="margin-top:12px">${['S','M','T','W','T','F','S'].map(x=>`<b class="mu" style="text-align:center">${x}</b>`).join('')}${cells}</div><p class="mu">Green = working, red = leave. Tap a day to select it, then mark it.</p>`;
 return `<div class="card">${colH('att','🗓 Attendance – '+esc(g.name))}${COL.att?'':body}</div>`}
function viewStock(){const g=techs.find(t=>t.id===D.gt),tot=t=>ledger(date,t.id,true).reduce((s,r)=>s+r.open+r.given-r.sold,0);
 $('#app').innerHTML=`<div class="card"><label>Date</label><input type="date" id="dt" value="${date}" style="max-width:200px"></div>
 <div class="card"><h2>Technicians</h2>${techs.length?`<div style="display:flex;gap:6px;flex-wrap:wrap">${techs.map(t=>`<button class="chip ${D.gt===t.id?'on':''}" data-act="pick" data-v="${esc(t.id)}">${esc(t.name)} <span class="badge" style="background:var(--mu)">${tot(t)}</span></button>`).join('')}</div><p class="mu">Tap a name to see that technician’s full stock. Number = pieces remaining.</p>`:'<p class="mu">Create technicians in Setup first.</p>'}</div>
 ${g?`<div class="card">${colH('astock',esc(g.name)+' (ID '+esc(g.id)+') – stock on '+esc(date))}${colB('astock',stockTbl(ledger(date,g.id,true),false)+`<button class="btn" data-act="dpdf" data-v="${esc(g.id)}">⬇ Day-end report (PDF) – ${esc(date)}</button>`)}</div>
 ${attCard(g)}
 <div class="card">${colH('give','Give stock to '+esc(g.name))}${colB('give',`${items.length?pick('g.'):'<p class="mu">Add items in Setup.</p>'}<button class="btn" data-act="give">Give stock</button>`)}</div>`:''}`}
async function give(){const g=techs.find(t=>t.id===D.gt),l=items.filter(i=>num(D['g.'+i.id])>0);if(!l.length)return toast('Enter quantity');
 try{for(const i of l)await api('POST','/api/allocations',{techId:g.id,itemId:i.id,qty:Math.floor(num(D['g.'+i.id])),date});clr('g.');toast('Stock given ✓');await load();render(1)}catch(e){toast(e.message)}}

function viewSales(){const T=D.st||'',sel=r=>!T||r.techId===T,need=r=>!r.seen||r.dstatus==='pending',tn=(techs.find(t=>t.id===T)||{}).name||'';
 const day=reps.filter(r=>r.date===date&&sel(r)).sort((a,b)=>b.ts-a.ts),nd=reps.filter(r=>need(r)&&sel(r)).sort((a,b)=>b.ts-a.ts),cnt=t=>reps.filter(r=>need(r)&&(!t||r.techId===t)).length;
 const card=r=>`<div class="il" style="align-items:flex-start"><div><b>${esc(r.techName)}</b> → ${esc(r.customer)} · ${esc(r.type)}${r.caseId?' · Case '+esc(r.caseId):''} ${r.seen?'':'<span class="badge">new</span>'}<div class="mu">${esc(r.date)} ${esc(r.phone)} ${esc(r.address)}</div><div>${linesTxt(r)}</div><div class="mu">Subtotal ${R(r.subtotal)} ${esc(r.notes)}</div><div>${r.payMode?'💳 '+esc(r.payMode):''} ${pics(r)}</div>${dstat(r)}${kst(r)}<button class="btn sm" data-act="prev" data-v="${r.id}">Preview</button>${r.dstatus==='pending'?` <button class="btn sm ok" data-act="ap" data-v="${r.id}">Approve</button> <button class="btn sm no" data-act="rj" data-v="${r.id}">Reject</button>`:''}${r.seen?'':` <button class="btn sm" data-act="seen" data-v="${r.id}">Mark seen</button>`}</div><b>${R(pay(r))}</b></div>`;

 const bd=n=>n?` <span class="badge">${n}</span>`:'';
 const trepCard=()=>{if(!T)return '<div class="card"><h2>📄 Technician report</h2><p class="mu">Tap a technician’s name above to see and download that technician’s report (items sold, PhonePe and cash).</p></div>';
  const f=D.rf||date,t=D.rt||date,d=repData(T,f,t);
  return `<div class="card">${colH('trep','📄 '+esc(tn)+' – sales report')}${COL.trep?'':`<div class="row"><div><label>From</label><input type="date" data-d="rf" value="${f}"></div><div><label>To</label><input type="date" data-d="rt" value="${t}"></div></div><div class="sc"><table class="inv" style="width:100%"><tr><th>Item / spare</th><th class="n">Qty</th><th class="n">Amount</th></tr>${d.items.map(b=>`<tr><td>${esc(b.n)}</td><td class="n">${b.q}</td><td class="n">${R(b.a)}</td></tr>`).join('')||'<tr><td colspan="3" class="mu">No sales in this period</td></tr>'}${d.other?`<tr><td colspan="2">Service / other charges</td><td class="n">${R(d.other)}</td></tr>`:''}${d.disc?`<tr><td colspan="2">Discount (approved)</td><td class="n">- ${R(d.disc)}</td></tr>`:''}<tr class="s"><td colspan="2">TOTAL SOLD (${d.rows.length} cases)</td><td class="n">${R(d.total)}</td></tr></table></div>${d.foc.length?`<div class="sc"><table class="inv" style="width:100%"><tr><th>FOC spares (free of cost)</th><th class="n">Qty</th></tr>${d.foc.map(b=>`<tr><td>${esc(b.n)}</td><td class="n">${b.q}</td></tr>`).join('')}</table></div>`:''}<table class="inv" style="width:100%"><tr class="s"><td>💵 Cash (${d.cc} cases)</td><td class="n">${R(d.cash)}</td></tr><tr class="s"><td>📱 PhonePe (${d.pc} cases)</td><td class="n">${R(d.pp)}</td></tr><tr class="g"><td>FINAL TOTAL</td><td class="n">${R(d.total)}</td></tr></table><button class="btn" data-act="rpdf">⬇ Download PDF</button> <button class="btn" style="background:var(--ok);color:#fff" data-act="dpdfr" data-v="${esc(T)}">⬇ Day-end report – ${esc(f)} to ${esc(t)}</button>`}</div>`};
 const dsum=(()=>{const rows=reps.filter(r=>r.date===date&&sel(r)),by={};rows.forEach(r=>{const b=by[r.techId]||(by[r.techId]={n:r.techName,c:0,cash:0,pp:0});b.c++;if(r.payMode==='PhonePe')b.pp+=pay(r);else b.cash+=pay(r)});
  const L=Object.values(by),cash=L.reduce((s,b)=>s+b.cash,0),pp=L.reduce((s,b)=>s+b.pp,0),ok=rows.filter(r=>r.dstatus==='approved').reduce((s,r)=>s+r.discount,0),pen=rows.filter(r=>r.dstatus==='pending').reduce((s,r)=>s+r.discount,0);
  return `<div class="card">${colH('dtot','📊 Day total – '+esc(date)+(T?' – '+esc(tn):''))}${COL.dtot?'':`<div class="sc"><table class="inv" style="width:100%"><tr><th>Technician</th><th class="n">Cash</th><th class="n">PhonePe</th><th class="n">Total</th></tr>${L.map(b=>`<tr><td>${esc(b.n)} <span class="mu">(${b.c})</span></td><td class="n">${R(b.cash)}</td><td class="n">${R(b.pp)}</td><td class="n">${R(b.cash+b.pp)}</td></tr>`).join('')||'<tr><td colspan="4" class="mu">No sales yet</td></tr>'}</table></div>
  <table class="inv" style="width:100%"><tr class="s"><td>💵 Cash received</td><td class="n">${R(cash)}</td></tr><tr class="s"><td>📱 PhonePe received</td><td class="n">${R(pp)}</td></tr><tr class="g"><td>FINAL TOTAL (${rows.length} cases)</td><td class="n">${R(cash+pp)}</td></tr></table>
  <p class="mu">Discount given: ${R(ok)}${pen?` · Discount waiting for approval: ${R(pen)} (not counted)`:''}</p>`}</div>`})();
 $('#app').innerHTML=`<div class="card"><label>Date</label><input type="date" id="dt" value="${date}" style="max-width:200px"></div>
 <div class="card"><h2>Technicians</h2><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="chip ${!T?'on':''}" data-act="spick" data-v="">All${bd(cnt(''))}</button>${techs.map(t=>`<button class="chip ${T===t.id?'on':''}" data-act="spick" data-v="${esc(t.id)}">${esc(t.name)}${bd(cnt(t.id))}</button>`).join('')}</div><p class="mu">Number = new reports or discounts waiting for you. Tap a name to see only that technician.</p><button class="btn sm no" data-act="rst">🧹 Reset notifications & photos</button><p class="mu">Clears the 🔔 list and deletes bill / PhonePe photos. Stock and sales totals do not change.</p></div>
 <div class="card"><h2>🔎 Search serial number or Case ID</h2><input data-d="sq" value="${esc(D.sq||'')}" placeholder="e.g. KR2309313014 or 261124-09608"><div id="sres">${searchHtml()}</div></div>
 ${dsum}
 ${trepCard()}
 ${nd.length?`<div class="card new"><h2>🔔 New / waiting${T?' – '+esc(tn):''} (${nd.length})</h2>${nd.map(card).join('')}</div>`:''}
 <div class="card"><h2>Sales on ${esc(date)}${T?' – '+esc(tn):''} – ${R(day.reduce((s,r)=>s+pay(r),0))}</h2>${day.length?day.map(card).join(''):'<p class="mu">No cases uploaded.</p>'}</div>`}
function epick(){const chosen=items.filter(i=>num(D['e.'+i.id])>0),left=items.filter(i=>!(num(D['e.'+i.id])>0));
 return `<div class="gadd"><select data-ei="1"><option value="">Select item…</option>${left.map(i=>`<option value="${i.id}" ${D.ei===i.id?'selected':''}>${esc(i.name)} – ${R(i.price)}</option>`).join('')}</select><input type="number" min="1" placeholder="Qty" data-d="eq" value="${D$('eq')}"><button class="btn sm" data-act="eadd">+ Add</button></div>`
 +(chosen.map(i=>`<div class="il"><div>${esc(i.name)}<div class="mu">${R(i.price)} each</div></div><div style="display:flex;gap:6px"><input type="number" min="1" data-d="e.${i.id}" value="${D$('e.'+i.id)}"><button class="btn sm no" data-act="rm" data-v="e.${i.id}">✕</button></div></div>`).join('')||'<p class="mu">Select an item, enter quantity, then tap + Add.</p>')}
function ecalc(){const lines=items.filter(i=>num(D['e.'+i.id])>0).map(i=>({itemId:i.id,name:i.name,hsn:i.hsn,partCode:i.partCode,price:i.price,qty:Math.floor(num(D['e.'+i.id]))}));const other=num(D.eother),sub=lines.reduce((s,l)=>s+l.qty*l.price,0)+other,disc=Math.min(num(D.edisc),sub);return{lines,other,sub,disc,tot:sub-disc}}
const r2=n=>Math.round((n+Number.EPSILON)*100)/100,N2=n=>r2(n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}),R2=n=>'₹'+N2(n);
function gst(lines,other,disc){const gross=lines.reduce((s,l)=>s+l.qty*l.price,0)+(other||0),tot=Math.max(0,gross-(disc||0)),taxable=r2(tot/1.18),g=r2(tot-taxable),cgst=r2(g/2);
 return{rows:lines.map(l=>({...l,rate:r2(l.price/1.18),amt:r2(l.qty*l.price/1.18)})),otherB:r2((other||0)/1.18),subB:r2(gross/1.18),discB:r2((disc||0)/1.18),taxable,cgst,sgst:r2(g-cgst),tot}}
const ebill=(lines,other,disc)=>{const g=gst(lines,other,disc);return `<div class="sc"><table class="inv" style="width:100%"><tr><th>Item</th><th class="n">Rate</th><th class="n">Qty</th><th class="n">Amount</th></tr>${g.rows.map(l=>`<tr><td>${esc(l.name)}<div class="mu">HSN ${esc(l.hsn||'-')} · Part ${esc(l.partCode||'-')}</div></td><td class="n">${R2(l.rate)}</td><td class="n">${l.qty}</td><td class="n">${R2(l.amt)}</td></tr>`).join('')||'<tr><td colspan="4" class="mu">No items selected</td></tr>'}${other?`<tr><td colspan="3">Service / other charge</td><td class="n">${R2(g.otherB)}</td></tr>`:''}<tr class="s"><td colspan="3">Subtotal</td><td class="n">${R2(g.subB)}</td></tr>${disc?`<tr class="s"><td colspan="3">Discount</td><td class="n">- ${R2(g.discB)}</td></tr>`:''}<tr><td colspan="3">CGST 9%</td><td class="n">${R2(g.cgst)}</td></tr><tr><td colspan="3">SGST 9%</td><td class="n">${R2(g.sgst)}</td></tr><tr class="g"><td colspan="3">ESTIMATE TOTAL</td><td class="n">${R2(g.tot)}</td></tr></table></div><p class="mu">Prices include GST @18% (CGST 9% + SGST 9%).</p>`};
function updE(){const e=$('#esum');if(!e)return;const c=ecalc();e.innerHTML=ebill(c.lines,c.other,c.disc)}
let LH=null;
function jpgSize(b){let i=2;while(i<b.length){if(b[i]!==255){i++;continue}const m=b[i+1];if(m>=0xC0&&m<=0xCF&&![0xC4,0xC8,0xCC].includes(m))return{h:(b[i+5]<<8)|b[i+6],w:(b[i+7]<<8)|b[i+8]};i+=2+((b[i+2]<<8)|b[i+3])}return{w:1024,h:1536}}
async function letterhead(){if(LH)return LH;let b;if(window.__LH){const s=atob(window.__LH);b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i)}else{const r=await fetch('/letterhead.jpg');if(!r.ok)throw new Error('Letterhead image not found');b=new Uint8Array(await r.arrayBuffer())}LH={bytes:b,...jpgSize(b)};return LH}
function assemble(pages,lh){const PW=595,PH=lh?Math.round(PW*lh.h/lh.w*10)/10:842;
 const enc=new TextEncoder(),chunks=[],off=[];let len=0;const put=u=>{chunks.push(u);len+=u.length},ps=s=>put(enc.encode(s));
 const obj=(i,s)=>{off[i]=len;ps(`${i} 0 obj\n${s}\nendobj\n`)},total=6+pages.length*2,kids=[];
 ps('%PDF-1.4\n');
 obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
 pages.forEach((c,i)=>kids.push((6+i*2)+' 0 R'));
 obj(2,`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`);
 obj(3,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
 obj(4,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
 if(lh){off[5]=len;ps(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${lh.w} /Height ${lh.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${lh.bytes.length} >>\nstream\n`);put(lh.bytes);ps('\nendstream\nendobj\n')}else obj(5,'<< >>');
 pages.forEach((c,i)=>{const st=(lh?`q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q\n`:'')+c.join('\n');obj(6+i*2,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${lh?' /XObject << /Im0 5 0 R >>':''} >> /Contents ${7+i*2} 0 R >>`);obj(7+i*2,`<< /Length ${st.length} >>\nstream\n${st}\nendstream`)});
 const xr=len;ps(`xref\n0 ${total}\n0000000000 65535 f \n`+off.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`);
 return new Blob(chunks,{type:'application/pdf'})}
function inWords(n){n=Math.round(n);if(!n)return'Zero';const a=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'],b=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
 const two=x=>x<20?a[x]:b[Math.floor(x/10)]+(x%10?' '+a[x%10]:''),three=x=>(x>99?a[Math.floor(x/100)]+' Hundred'+(x%100?' ':''):'')+(x%100?two(x%100):'');
 let s='';const cr=Math.floor(n/1e7),lk=Math.floor(n%1e7/1e5),th=Math.floor(n%1e5/1e3),re=n%1e3;if(cr)s+=three(cr)+' Crore ';if(lk)s+=two(lk)+' Lakh ';if(th)s+=two(th)+' Thousand ';if(re)s+=three(re);return s.trim()}
async function pdfEstimate(x){
 const A=s=>String(s==null?'':s).replace(/₹/g,'Rs.').replace(/[–—]/g,'-').replace(/[•·]/g,'\u00B7').replace(/[^\x20-\x7E\u00B7]/g,'?'),E=s=>A(s).replace(/([\\()])/g,'\\$1').replace(/\u00B7/g,'\\267');
 const Rs=n=>'Rs. '+N2(n),W={' ':.278,',':.278,'.':.278,'-':.333,'R':.722,'s':.5,'\u00B7':.278};
 const tw=(s,z,sp)=>[...s].reduce((q,c)=>q+(W[c]||.556),0)*z+(sp||0)*s.length;
 const NAVY='0 0.235 0.45',TEAL='0 0.59 0.675',DEEP='0 0.36 0.46',LIGHT='0.90 0.96 0.97',ZEBRA='0.94 0.975 0.98',WHITE='1 1 1',GREY='0.35 0.4 0.43',LINE='0.72 0.84 0.87';
 const pages=[];let y=0,segTop=0;const out=c=>pages[pages.length-1].push(c);
 const T=(px,py,z,b,s,al,col,sp)=>{const w=al==='r'?tw(A(s),z,sp):al==='c'?tw(A(s),z,sp)/2:0;out(`${col||'0 0 0'} rg BT /F${b?2:1} ${z} Tf ${sp||0} Tc ${(px-w).toFixed(1)} ${py} Td (${E(s)}) Tj ET`)};
 const L=(x1,y1,x2,y2,w,col)=>out(`${w||0.5} w ${col||LINE} RG ${x1} ${y1} m ${x2} ${y2} l S`);
 const R=(x0,y0,w,h2,fill,stroke,lw)=>out(`${fill?fill+' rg ':''}${stroke?stroke+' RG '+(lw||0.9)+' w ':''}${x0} ${y0} ${w} ${h2} re ${fill&&stroke?'B':fill?'f':'S'}`);
 const grad=(x0,y0,w,h2)=>{const N=28;for(let i=0;i<N;i++){const t=i/(N-1);R(x0+i*w/N,y0,w/N+0.7,h2,`0 ${(0.235+0.33*t).toFixed(3)} ${(0.45+0.22*t).toFixed(3)}`)}};
 const chrome=()=>{R(0,0,6,842,TEAL);R(0,0,595,38,DEEP);T(40,23,9,1,'Phone: 9440756347',0,WHITE);T(40,10,8.5,0,'Email: rajammathalliservices@gmail.com',0,WHITE);L(325,8,325,30,0.8,WHITE);T(340,23,9.5,1,'WATER PURIFIER',0,WHITE,0.8);T(340,10,9.5,1,'SALES & SERVICE',0,WHITE,0.8)};
 const newPage=()=>{pages.push([]);chrome()};
 const g=gst(x.lines,x.other,x.discount),gross=x.lines.reduce((s,l)=>s+l.qty*l.price,0)+(x.other||0),disc=x.discount||0;
 const dt=(()=>{try{return new Date(x.date+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}catch(e){return x.date}})();
 // ================= page 1 header (all drawn with code) =================
 newPage();
 T(40,812,7.5,1,'PURE WATER. RELIABLE SERVICE.',0,TEAL,1.4);
 T(40,782,26,1,'SRI RAJAMMATHALLI',0,NAVY);T(40,754,26,1,'SERVICES',0,NAVY);
 R(40,716,214,20,LIGHT);R(40,716,3,20,TEAL);T(50,723,8,1,'KENT AUTHORIZED SERVICE CENTER',0,DEEP,0.5);
 out(`${TEAL} rg 44 704 m 47.5 707.5 l 51 704 l 47.5 700.5 l h f`);
 T(58,702,8.5,0,'Medicover Hospital Back Side, Bhyrivani Peta,',0,GREY);T(58,690,8.5,0,'Srikakulam, Andhra Pradesh - 532410',0,GREY);
 R(432,688,123,128,WHITE,LINE,0.9);grad(440,764,107,44);T(493.5,776,32,1,'KENT','c',WHITE);
 R(440,742,107,20,LIGHT);T(491,749,10,1,'Mineral RO','c',NAVY);T(491+tw('Mineral RO',10)/2+2,754,5,1,'TM',0,NAVY);
 T(493.5,729,6.5,0,'WATER PURIFIERS','c',GREY,1);T(493.5,714,7.5,0,'Pure \u00B7 Safe \u00B7 Healthy','c',TEAL);
 L(40,680,400,680,2.4,NAVY);L(400,680,555,680,2.4,TEAL);
 R(40,636,515,30,LIGHT);R(40,636,4,30,TEAL);T(56,647,14,1,'ESTIMATE / QUOTATION',0,NAVY,1.2);
 T(545,647,13,1,x.no,'r',NAVY);T(545-tw(A(x.no),13)*1.12-12,647,10.5,0,'ESTIMATE #','r',TEAL);
 R(40,612,285,14,LIGHT);R(40,560,285,66,null,LINE,1);R(335,612,220,14,LIGHT);R(335,560,220,66,null,LINE,1);
 T(48,616,7.5,1,'CUSTOMER DETAILS',0,TEAL,1);T(343,616,7.5,1,'ESTIMATE INFORMATION',0,TEAL,1);
 T(48,598,10.5,1,(x.customer||'').slice(0,38),0,NAVY);T(48,584,9.5,0,'Phone:  '+(x.phone||'-'));T(48,570,9.5,0,'Address:  '+(x.address||'-').slice(0,46));
 [['Estimate No.',x.no],['Date',dt],['GST','18% included']].forEach((r,i)=>{T(343,598-i*14,9.5,0,r[0],0,GREY);T(547,598-i*14,9.5,1,r[1],'r',NAVY)});
 T(40,544,8.5,1,'SPARE-WISE GST & SERVICE DETAILS',0,NAVY,0.4);T(555,544,7.5,0,'GST is calculated separately for each spare','r',GREY);
 // ================= items table =================
 const C=[40,56,190,244,320,372,400,449,498,555];
 const head=()=>{segTop=y;R(40,y-20,515,20,NAVY,NAVY);const hy=y-13;T(45,hy,7.5,1,'#',0,WHITE);T(60,hy,7.5,1,'SPARE / DESCRIPTION',0,WHITE);T(194,hy,7.5,1,'HSN',0,WHITE);T(248,hy,7.5,1,'PART CODE',0,WHITE);T(368,hy,7.5,1,'RATE','r',WHITE);T(396,hy,7.5,1,'QTY','r',WHITE);T(445,hy,7.5,1,'CGST 9%','r',WHITE);T(494,hy,7.5,1,'SGST 9%','r',WHITE);T(551,hy,7.5,1,'LINE TOTAL','r',WHITE);y-=20};
 const closeSeg=()=>{for(let i=1;i<C.length-1;i++)L(C[i],y,C[i],segTop-20,0.4);R(40,y,515,segTop-y,null,NAVY,1.2)};
 const next=()=>{closeSeg();newPage();T(40,805,12,1,'SRI RAJAMMATHALLI SERVICES',0,NAVY);T(545,805,9,1,'ESTIMATE '+x.no+' (continued)','r',TEAL);L(40,796,555,796,1.6,NAVY);y=778;head()};
 const split=(gr)=>{const b=r2(gr/1.18),tx=r2(gr-b),c=r2(tx/2);return{b,c,s:r2(tx-c)}};
 const rows=x.lines.map((l,i)=>{const p=split(l.qty*l.price);return[String(i+1),l.name.slice(0,27),l.hsn||'-',l.partCode||'-',N2(r2(l.price/1.18)),String(l.qty),N2(p.c),N2(p.s),N2(l.qty*l.price)]});
 if(x.other){const p=split(x.other);rows.push([String(rows.length+1),'Service / other charge','-','-',N2(p.b),'1',N2(p.c),N2(p.s),N2(x.other)])}
 y=536;head();
 rows.forEach((r,i)=>{if(y-22<250)next();if(i%2)R(40,y-22,515,22,ZEBRA);const by=y-15;
  T(45,by,8.5,0,r[0],0,GREY);T(60,by,9,1,r[1],0,NAVY);T(194,by,8.5,0,r[2].slice(0,11));T(248,by,8.5,0,r[3].slice(0,14));
  T(368,by,8.5,0,r[4],'r');T(396,by,8.5,0,r[5],'r');T(445,by,8.5,0,r[6],'r');T(494,by,8.5,0,r[7],'r');T(551,by,9,1,r[8],'r');L(40,y-22,555,y-22,0.4);y-=22});
 if(y-14-195<125)next();
 closeSeg();const bt=y-14;
 // ---- left: amount in words, terms, notes ----
 const rup=Math.floor(g.tot+0.0001),pai=Math.round((g.tot-rup)*100),words='Rupees '+inWords(rup)+(pai?' and '+inWords(pai)+' Paise':'')+' Only';
 R(40,bt-46,285,46,LIGHT,LINE,0.9);T(48,bt-12,7.5,1,'TOTAL AMOUNT IN WORDS',0,TEAL,1);
 (words.match(/.{1,46}(\s|$)/g)||[]).slice(0,2).forEach((t,i)=>T(48,bt-27-i*12,9.5,1,t.trim(),0,NAVY));
 let ly=bt-64;T(40,ly,7.5,1,'TERMS & CONDITIONS',0,TEAL,1);ly-=12;
 ['1. GST is calculated separately for each spare at the rate entered.','2. CGST 9% and SGST 9% are shown for each spare (prices include GST).','3. This is an estimate, not a tax invoice.'].forEach(t=>{T(40,ly,8,0,t,0,GREY);ly-=11});
 if(x.notes){ly-=5;T(40,ly,7.5,1,'NOTES',0,TEAL,1);ly-=12;String(x.notes).match(/.{1,70}(\s|$)/g).slice(0,4).forEach(t=>{T(40,ly,8.5,0,t.trim());ly-=11})}
 // ---- right: sub-total, discount, grand total ----
 R(335,bt-40,220,40,null,LINE,1);L(335,bt-20,555,bt-20,0.5);
 T(343,bt-14,9.5,0,'Sub-total (incl. GST)',0,GREY);T(547,bt-14,9.5,1,N2(gross),'r',NAVY);T(343,bt-34,9.5,0,'Discount (Rs.)',0,GREY);T(547,bt-34,9.5,1,disc?'- '+N2(disc):'0.00','r',NAVY);
 grad(335,bt-72,220,32);T(345,bt-60,11,1,'GRAND TOTAL',0,WHITE,0.6);T(547,bt-61,15,1,Rs(g.tot),'r',WHITE);
 T(555,bt-84,7.5,0,'Includes CGST 9%: '+Rs(g.cgst)+'  +  SGST 9%: '+Rs(g.sgst),'r',GREY);
 // ---- signatures (above the footer band) ----
 L(40,112,215,112,0.8,'0 0 0');T(40,101,8,0,'Customer signature',0,GREY);
 L(360,112,555,112,0.8,'0 0 0');T(457.5,101,8,0,'Authorised signatory','c',GREY);T(457.5,118,8.5,1,'For Sri Rajammathalli Services','c',NAVY);
 return assemble(pages,null)}
function repData(tid,from,to){const rows=reps.filter(r=>r.techId===tid&&r.date>=from&&r.date<=to),by={},fby={};let other=0,disc=0,cash=0,pp=0,cc=0,pc=0;
 rows.forEach(r=>{(r.lines||[]).forEach(l=>{if(l.foc){const f=fby[l.name]||(fby[l.name]={n:l.name,q:0});f.q+=l.qty;return}const b=by[l.name]||(by[l.name]={n:l.name,q:0,a:0});b.q+=l.qty;b.a+=l.qty*l.price});other+=r.other||0;if(r.dstatus==='approved')disc+=r.discount;const p=pay(r);if(r.payMode==='PhonePe'){pp+=p;pc++}else{cash+=p;cc++}});
 return{rows,items:Object.values(by).sort((a,b)=>b.a-a.a),foc:Object.values(fby).sort((a,b)=>a.n.localeCompare(b.n)),other,disc,cash,pp,cc,pc,total:cash+pp}}
async function pdfReport(tc,f,t){
 const d=repData(tc.id,f,t);
 const A=s=>String(s==null?'':s).replace(/₹/g,'Rs.').replace(/[–—]/g,'-').replace(/[^\x20-\x7E]/g,'?'),E=s=>A(s).replace(/([\\()])/g,'\\$1');
 const Rs=n=>'Rs. '+(Math.round(n)||0).toLocaleString('en-IN'),W={' ':.278,',':.278,'.':.278,'-':.333,'R':.722,'s':.5};
 const tw=(s,z)=>[...s].reduce((q,c)=>q+(W[c]||.556),0)*z;
 const pages=[[]];let y=790;const out=c=>pages[pages.length-1].push(c);
 const T=(px,py,z,b,s,al)=>{const w=al==='r'?tw(A(s),z):0;out(`BT /F${b?2:1} ${z} Tf ${(px-w).toFixed(1)} ${py} Td (${E(s)}) Tj ET`)};
 let cols=[40,360,438,555];const L=(x1,y1,x2,y2)=>out(`0.8 w 0.15 G ${x1} ${y1} m ${x2} ${y2} l S`),np=()=>{if(y<90){pages.push([]);y=790}},V=()=>cols.forEach(x=>L(x,y+14,x,y-6));
 const row=(a,b,c,bold)=>{np();T(46,y,10,bold,a);if(b!=='')T(430,y,10,bold,b,'r');T(551,y,10,bold,c,'r');V();L(40,y-6,555,y-6);y-=20};
 const head=(a,b,c)=>{np();out(`0.92 g 40 ${y-6} 515 20 re f 0 g`);T(46,y,10,1,a);T(430,y,10,1,b,'r');T(551,y,10,1,c,'r');L(40,y+14,555,y+14);V();L(40,y-6,555,y-6);y-=20};
 T(40,790,16,1,'Sri Rajammathalli Services');T(40,774,10,0,'Kent Authorized Service Center');T(555,790,13,1,'TECHNICIAN SALES REPORT','r');L(40,764,555,764);y=744;
 [['Technician: '+tc.name+' ('+tc.id+')',1],['Period: '+f+' to '+t,0],['Cases: '+d.rows.length,0]].forEach(r=>{T(40,y,11,r[1],r[0]);y-=16});y-=10;
 head('Item / spare sold','Qty','Amount');
 if(!d.items.length)row('No sales in this period','','',0);
 d.items.forEach(b=>row(b.n.slice(0,50),String(b.q),Rs(b.a),0));
 if(d.other)row('Service / other charges','',Rs(d.other),0);
 if(d.disc)row('Discount (approved)','','- '+Rs(d.disc),0);
 row('TOTAL SOLD','',Rs(d.total),1);y-=14;
 head('Payment received','Cases','Amount');
 row('Cash',String(d.cc),Rs(d.cash),0);row('PhonePe',String(d.pc),Rs(d.pp),0);
 np();out(`0.92 g 0.15 G 0.8 w 40 ${y-12} 515 26 re B 0 g`);T(46,y-4,13,1,'FINAL TOTAL');T(551,y-4,13,1,Rs(d.total),'r');L(cols[cols.length-2],y+14,cols[cols.length-2],y-12);y-=40;
 if(d.foc.length){np();y-=4;head('FOC spares (free of cost)','','Qty');d.foc.forEach(b=>row(b.n.slice(0,50),'',String(b.q),0));row('TOTAL FOC spares','',String(d.foc.reduce((s,b)=>s+b.q,0)),1);y-=10}
 np();T(40,y,8,0,'Amounts include GST. Discounts are counted only after admin approval. FOC spares are free of cost and not in the totals. Generated on '+today()+'.');
 return assemble(pages,null)}
async function pdfDayEnd(tc,from,to){
 to=to||from;if(to<from){const q=from;from=to;to=q}
 const days=[];for(let t=Date.parse(from+'T00:00:00Z'),e=Date.parse(to+'T00:00:00Z');t<=e&&days.length<92;t+=864e5)days.push(new Date(t).toISOString().slice(0,10));
 const A=s=>String(s==null?'':s).replace(/₹/g,'Rs.').replace(/[–—]/g,'-').replace(/[^\x20-\x7E]/g,'?'),E=s=>A(s).replace(/([\\()])/g,'\\$1');
 const Rs=n=>'Rs. '+(Math.round(n)||0).toLocaleString('en-IN'),W={' ':.278,',':.278,'.':.278,'-':.333,'R':.722,'s':.5};
 const tw=(s,z)=>[...s].reduce((q,c)=>q+(W[c]||.556),0)*z;
 const pages=[[]];let y=790;const out=c=>pages[pages.length-1].push(c);
 const T=(px,py,z,b,s,al)=>{const w=al==='r'?tw(A(s),z):0;out(`BT /F${b?2:1} ${z} Tf ${(px-w).toFixed(1)} ${py} Td (${E(s)}) Tj ET`)};
 let cols=[40,555];const L=(x1,y1,x2,y2)=>out(`0.8 w 0.15 G ${x1} ${y1} m ${x2} ${y2} l S`),np=()=>{if(y<90){pages.push([]);y=790}},V=()=>cols.forEach(x=>L(x,y+14,x,y-6));
 const RX=[298,350,402,458,551];
 const grid=(a,c,bold)=>{np();T(46,y,10,bold,a);RX.forEach((x,i)=>{if(c[i]!=null&&c[i]!=='')T(x,y,10,bold,String(c[i]),'r')});V();L(40,y-6,555,y-6);y-=20};
 const gh=(a,c)=>{np();out(`0.92 g 40 ${y-6} 515 20 re f 0 g`);T(46,y,10,1,a);RX.forEach((x,i)=>T(x,y,9,1,c[i],'r'));L(40,y+14,555,y+14);V();L(40,y-6,555,y-6);y-=20};
 const newPage=()=>{if(pages[pages.length-1].length)pages.push([]);y=790};
 const hdr=(title,lines)=>{T(40,790,16,1,'Sri Rajammathalli Services');T(40,774,10,0,'Kent Authorized Service Center');T(555,790,13,1,title,'r');L(40,764,555,764);y=744;lines.forEach(r=>{T(40,y,11,r[1],r[0]);y-=16});y-=10};
 const stock=(rows,amt)=>{cols=[40,252,303,355,407,463,555];gh('Item / spare',['Opening','Given','Sold','Remaining','Sale amt']);
  if(!rows.length)grid('No stock activity',[],0);
  let so=0,sg=0,ss=0,sr=0;rows.forEach(r=>{const left=r.open+r.given-r.sold;so+=r.open;sg+=r.given;ss+=r.sold;sr+=left;grid(r.n.slice(0,34),[r.open,r.given,r.sold,left,Rs(amt[r.n]||0)],0)});
  grid('TOTAL (pieces)',[so,sg,ss,sr,''],1);y-=14};
 const pay=d=>{cols=[40,355,407,555];gh('Mode',['','','Cases','','Amount']);
  np();T(46,y,10,0,'Cash');T(402,y,10,0,String(d.cc),'r');T(551,y,10,0,Rs(d.cash),'r');V();L(40,y-6,555,y-6);y-=20;
  np();T(46,y,10,0,'PhonePe');T(402,y,10,0,String(d.pc),'r');T(551,y,10,0,Rs(d.pp),'r');V();L(40,y-6,555,y-6);y-=20;
  np();out(`0.92 g 0.15 G 0.8 w 40 ${y-12} 515 26 re B 0 g`);T(46,y-4,13,1,'FINAL TOTAL');T(551,y-4,13,1,Rs(d.total),'r');L(407,y+14,407,y-12);y-=40};
 const note=(pend,extra)=>{if(pend){np();T(40,y,9,0,'Discount waiting for approval: '+Rs(pend)+' (not counted above).');y-=14}
  np();T(40,y,8,0,'Amounts include GST. Discounts are counted only after admin approval.'+(extra||'')+' Generated on '+today()+'.')};
 const per=days.map(day=>({day,rows:ledger(day,tc.id,true),d:repData(tc.id,day,day),at:att.find(q=>q.techId===tc.id&&q.date===day)}));
 const active=per.filter(p=>p.rows.some(r=>r.given||r.sold)||p.d.rows.length);
 // ---------- page 1: totals for all selected days ----------
 if(days.length>1){
  const m={};per.forEach(p=>p.rows.forEach(r=>{const o=m[r.i]||(m[r.i]={n:r.n,open:r.open,given:0,sold:0});o.given+=r.given;o.sold+=r.sold}));
  const rows=Object.values(m).filter(r=>r.open||r.given||r.sold).sort((a,b)=>a.n.localeCompare(b.n)),tot=repData(tc.id,from,to),amt={};tot.items.forEach(b=>amt[b.n]=b.a);
  const pend=reps.filter(r=>r.techId===tc.id&&r.date>=from&&r.date<=to&&r.dstatus==='pending').reduce((q,r)=>q+r.discount,0);
  hdr('DAY-END REPORT - TOTAL',[['Technician: '+tc.name+' ('+tc.id+')',1],['Period: '+from+' to '+to+' ('+days.length+' days)',0],['Days with activity: '+active.length+'   Cases: '+tot.rows.length,0]]);
  T(40,y,11,1,'1. Total spares (all selected days)');y-=18;stock(rows,amt);
  T(40,y,11,1,'2. Payment received (all selected days)');y-=18;pay(tot);
  note(pend,' Day-wise sales are on the next pages.');
 }
 // ---------- next pages: one page (or more) per day ----------
 const list=days.length>1?active:per;
 list.forEach((p,i)=>{newPage();const amt={};p.d.items.forEach(b=>amt[b.n]=b.a);
  const pend=reps.filter(r=>r.techId===tc.id&&r.date===p.day&&r.dstatus==='pending').reduce((q,r)=>q+r.discount,0);
  hdr('DAY-END REPORT',[['Technician: '+tc.name+' ('+tc.id+')',1],['Date: '+p.day+(days.length>1?'   (day '+(i+1)+' of '+list.length+')':''),0],['Attendance: '+(p.at?(p.at.status==='working'?'Working':'Leave'):'not marked'),0]]);
  T(40,y,11,1,'1. Stock');y-=18;stock(p.rows.filter(r=>r.open||r.given||r.sold),amt);
  T(40,y,11,1,'2. Payment received');y-=18;pay(p.d);note(pend)});
 return assemble(pages,null)}
async function dlDayEnd(tc,day,to){try{await saveBlob('DayEnd-'+tc.id+'-'+day+(to&&to!==day?'-to-'+to:'')+'.pdf',await pdfDayEnd(tc,day,to))}catch(e){toast('PDF failed: '+e.message)}}
async function dlReport(tc,f,t){try{await saveBlob('Report-'+tc.id+'-'+f+'-to-'+t+'.pdf',await pdfReport(tc,f,t))}catch(e){toast('PDF failed: '+e.message)}}
async function saveBlob(name,blob){
 try{if(window.claude&&claude.use){const dl=await claude.use('downloads');if(dl){await dl.save({filename:name,data:blob});return}}}catch(e){if(e&&e.code==='declined')return}
 const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
 const t=$('#toast');t.innerHTML='PDF ready. If it did not download, <a href="'+u+'" download="'+esc(name)+'" target="_blank" style="color:inherit;font-weight:700;text-decoration:underline">tap here</a>';t.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>{t.style.display='none';URL.revokeObjectURL(u)},60000)}
async function dlPdf(x){try{await saveBlob('Estimate-'+x.no+'.pdf',await pdfEstimate(x))}catch(e){toast('PDF failed: '+e.message)}}
function viewEstimate(){const list=ests.slice().sort((a,b)=>b.ts-a.ts).slice(0,30);
 $('#app').innerHTML=`<div class="card"><h2>New estimate</h2><div class="row"><div><label>Customer *</label><input data-d="ecn" value="${D$('ecn')}"></div><div><label>Phone</label><input type="tel" data-d="ecp" value="${D$('ecp')}"></div></div><label>Address</label><input data-d="eca" value="${D$('eca')}"><label style="margin-top:14px">Items</label>${items.length?epick():'<p class="mu">Add items in Setup first.</p>'}
 <div class="row"><div><label>Service / other charge (₹)</label><input type="number" min="0" data-d="eother" value="${D$('eother')}"></div><div><label>Discount (₹)</label><input type="number" min="0" data-d="edisc" value="${D$('edisc')}"></div></div>
 <div id="esum" style="margin-top:10px"></div><label>Notes / validity</label><textarea rows="2" data-d="enotes">${D$('enotes')}</textarea><div id="err" class="low" style="margin-top:10px;font-weight:600"></div><button class="btn" data-act="esave">Save estimate</button></div>
 <div class="card"><h2>Saved estimates (${ests.length})</h2>${list.length?list.map(x=>`<div class="il"><div><b>${esc(x.no)}</b> · ${esc(x.customer)}<div class="mu">${esc(x.date)} ${esc(x.phone||'')}</div></div><div style="display:flex;gap:8px;align-items:center"><b>${R(x.total)}</b><button class="btn sm" data-act="eview" data-v="${x.id}">View</button></div></div>`).join(''):'<p class="mu">No estimates yet.</p>'}</div>`;updE()}
function eview(id){const x=ests.find(q=>q.id===id);if(!x)return;
 $('#mod').innerHTML=`<div><h2>Estimate ${esc(x.no)}</h2><p style="margin:0 0 8px">Sri Rajammathalli Services<br>Date: ${esc(x.date)}<br>Customer: <b>${esc(x.customer)}</b><br>Phone: ${esc(x.phone||'-')}<br>Address: ${esc(x.address||'-')}</p>${ebill(x.lines,x.other,x.discount)}${x.notes?`<p>Notes: ${esc(x.notes)}</p>`:''}<div class="noprint" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn sm ok" data-act="epdf" data-v="${x.id}">⬇ Download PDF</button><button class="btn sm" data-act="eprint">🖨 Print</button><button class="btn sm ok" data-act="ewa" data-v="${x.id}">WhatsApp</button><button class="btn sm no" data-act="edel" data-v="${x.id}">Delete</button><button class="btn sm" data-act="cm">Close</button></div></div>`;$('#mod').style.display='flex'}
function stoCard(){if(!usage&&!saveErr)return'';const p=usage?usage.percent:0,col=p>=90?'var(--bad)':p>=70?'var(--wa)':'var(--ok)';
 return `<div class="card"><h2>💾 Database storage</h2>${usage?`<div style="background:var(--bg);border:1px solid var(--bd);border-radius:8px;height:16px;overflow:hidden"><div style="width:${Math.min(100,p)}%;height:100%;background:${col}"></div></div><p><b>${p}% used</b> – ${usage.usedMB} MB of ${usage.limitMB} MB</p><p class="mu">Photos: ${usage.photoCount} (${usage.photosMB} MB). ${p>=70?'Running low: use “Reset notifications & photos” in Sales to delete old photos, and download a backup.':'Plenty of space left.'} The Neon website shows the official number.</p>`:''}${saveErr?`<p class="low"><b>⚠ Problem saving to the database: ${esc(saveErr)}</b></p>`:''}</div>`}
const stoBanner=()=>`<div class="card new"><b>⚠ ${saveErr?'The database is NOT saving: '+esc(saveErr):'Database storage is '+usage.percent+'% full'}</b><div class="mu">${saveErr?'New entries may be lost. Free space or upgrade the database, then check Setup.':'Delete old photos with “Reset notifications & photos” in Sales and download a backup.'}</div></div>`;
function viewSetup(){$('#app').innerHTML=`${stoCard()}<div class="card"><h2>Backup – keep your own copy</h2><p class="mu">Download your records to your phone or computer so they are never lost. Do this weekly.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="bk" data-v="sales">Sales (Excel/CSV)</button><button class="btn sm" data-act="bk" data-v="stock">Stock given (Excel/CSV)</button><button class="btn sm" data-act="bk" data-v="all">Full backup (JSON)</button></div></div><div class="card"><h2>Admin login</h2><p>Admin ID: <b>${ADMIN_ID}</b></p>${cfg&&cfg.hash?'':'<p class="low">Still using the default password (9032). Please change it.</p>'}<button class="btn sm" data-act="cpw">Change admin password</button></div><div class="card"><h2>Items & default prices</h2>${items.map(i=>`<div class="il" style="align-items:flex-start;flex-wrap:wrap"><div style="min-width:110px"><b>${esc(i.name)}</b>${(!i.hsn||!i.partCode)?'<div class="low" style="font-size:12px">⚠ HSN / Part code missing</div>':''}</div><div class="row" style="flex:1;min-width:230px"><div><label>Price incl. 18% GST (₹)</label><input type="number" id="p.${i.id}" value="${i.price}"></div><div><label>HSN code *</label><input id="h.${i.id}" value="${esc(i.hsn||'')}"></div><div><label>Part code *</label><input id="c.${i.id}" value="${esc(i.partCode||'')}"></div></div><div style="display:flex;gap:6px"><button class="btn sm" data-act="sp" data-v="${i.id}">Save</button><button class="btn sm no" data-act="di" data-v="${i.id}">✕</button></div></div>`).join('')||'<p class="mu">No items yet.</p>'}
 <h2 style="margin-top:16px">Add new item</h2><div class="row"><div><label>Item name *</label><input data-d="in" value="${D$('in')}"></div><div><label>Price incl. 18% GST (₹) *</label><input type="number" data-d="ip" value="${D$('ip')}"></div><div><label>HSN code *</label><input data-d="ih" value="${D$('ih')}"></div><div><label>Part code *</label><input data-d="ic" value="${D$('ic')}"></div></div><button class="btn" data-act="ai">Add item</button></div>
 <div class="card"><h2>Technicians</h2>${techs.map(t=>`<div class="il"><div>${esc(t.name)} <span class="mu">ID: ${esc(t.id)}</span></div><div style="display:flex;gap:6px"><button class="btn sm" data-act="rp" data-v="${esc(t.id)}">Reset password</button><button class="btn sm no" data-act="dt" data-v="${esc(t.id)}">✕</button></div></div>`).join('')||'<p class="mu">No technicians yet.</p>'}
 <div class="row"><div><label>Login ID</label><input data-d="ti" value="${D$('ti')}" autocapitalize="none"></div><div><label>Name</label><input data-d="tn" value="${D$('tn')}"></div><div><label>Password</label><input data-d="tp" value="${D$('tp')}"></div></div><button class="btn" data-act="at">Create technician</button></div>`}

const sid=s=>s.trim().toLowerCase().replace(/[^a-z0-9_-]/g,'');
const csv=rows=>'\ufeff'+rows.map(r=>r.map(c=>'"'+String(c==null?'':c).replace(/"/g,'""')+'"').join(',')).join('\r\n');
async function backup(k){try{const r=await fetch(k==='sales'?'/api/export/sales.csv':k==='stock'?'/api/export/stock.csv':'/api/export/backup.json',{headers:{Authorization:'Bearer '+token}});if(!r.ok)throw new Error('Download failed');const bl=await r.blob(),x=document.createElement('a');x.href=URL.createObjectURL(bl);x.download='kent-'+k+'-'+today()+(k==='all'?'.json':'.csv');document.body.appendChild(x);x.click();x.remove();toast('Saved ✓');if(k==='all')await load()}catch(e){toast(e.message)}}
async function act(a,v){try{
 if(a==='wsendp'){navigator.share({files:WS.files}).catch(e=>{if(e&&e.name!=='AbortError')toast('Share failed: '+e.message)});return}
 if(a==='wsave'){WS.files.forEach(f=>{const u=URL.createObjectURL(f),x=document.createElement('a');x.href=u;x.download=f.name;document.body.appendChild(x);x.click();x.remove();setTimeout(()=>URL.revokeObjectURL(u),8000)});toast('Photos saved to your downloads / gallery');return}
 if(a==='wsend'){const f=WS.files;if(WS.can){navigator.share({text:WS.text,files:f}).catch(e=>{if(e&&e.name!=='AbortError')toast('Share failed: '+e.message)})}else{try{navigator.clipboard&&navigator.clipboard.writeText(WS.text).catch(()=>{})}catch(e){}window.open('https://wa.me/?text='+encodeURIComponent(WS.text),'_blank');toast('This browser cannot attach photos. The details opened in WhatsApp. Use “Save photos” and attach them from your gallery.')}return}
 if(a==='wcase'){const r=reps.find(q=>q.id===v);if(!r)return;return openShare(r,[r.billFile?fl(r.billFile):'',r.payFile?fl(r.payFile):''].filter(Boolean))}
 if(a==='sendserial'){const[id,mode]=v.split(':');const k=(mode==='warranty'?'wphoto.':'sphoto.')+id;const g=p=>(D[p+id]||'').trim();const sn=g('sn.'),inst=g('si.'),pur=g('sp.'),code=g('sc.');
 if(!sn)return toast('Type the serial number');if(mode==='warranty'&&(!inst||!pur||!code))return toast('Warranty card: type installation date, purchase date and product code');if(!IMG[k])return toast(mode==='warranty'?'Add the warranty card photo':'Add the serial number photo');
 try{await api('POST','/api/reports/'+id+'/serial',{mode,serialNo:sn,inst,pur,code,photo:IMG[k]});IMG['sphoto.'+id]='';IMG['wphoto.'+id]='';['sn.','si.','sp.','sc.'].forEach(p=>delete D[p+id]);toast('Sent to the robot ✓');await load()}catch(x){toast(x.message)}return}
if(a==='pickfile'){const[k,m]=v.split(':');fileTarget=k;const el=$('#f-'+m);el.value='';el.click();return}
 if(a==='bk')return backup(v);if(a==='wk'){await backup('sales');return backup('all')}
 if(a==='pgback'){pgStop();$('#mod').style.display='none';return}if(a==='prev')return preview(v);if(a==='cm'){pgStop();$('#mod').style.display='none';return}
 if(a==='tab'){tab=v;return render(1)}
if(a==='out'){doLogout();return render(1)}
 if(a==='cpw'){const p=await ask('New admin password (minimum 4 characters)',true);if(!p)return;if(p.length<4)return toast('Too short');await api('POST','/api/admin/password',{password:p});await load();return toast('Admin password changed ✓')}
 if(a==='lmode'){D.lmode=v;D.ostep='';D.otp='';return render(1)}
 if(a==='otpback'){D.ostep='';D.otp='';return render(1)}
 if(a==='otpreq'){const em=String(D.aem||'').trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(em))return toast('Enter a valid email');try{await api('POST','/api/admin/otp/request',{email:em})}catch(e){return toast(e.message)}D.aem=em;D.ostep='code';D.otp='';toast('If this is the admin email, a code was sent');return render(1)}
 if(a==='otpver'){let j;try{j=await api('POST','/api/admin/otp/verify',{email:D.aem||'',code:String(D.otp||'').trim()})}catch(e){return toast(e.message)}token=j.token;role=j.role;sess=j.id;adminOn=role==='admin';keepLogin();D={};tab=adminOn?'stock':'tech';await load();return render(1)}
 if(a==='login'){let j;try{j=await api('POST','/api/login',{id:sid(D.lid||''),password:D.lpw||''})}catch(e){return toast(e.message)}token=j.token;role=j.role;sess=j.id;adminOn=role==='admin';keepLogin();D={};tab=adminOn?'stock':'tech';await load();return render(1)}
 if(a==='sale')return sale();if(a==='give')return give();
 if(a==='rst'){const t=techs.find(x=>x.id===D.st),w=t?t.name+'’s':'ALL technicians’';if(!await ask('Delete '+w+' bill / PhonePe photos and clear the notifications?\n\nStock and sales totals will NOT change.\nDiscounts waiting for approval stay.\nPhotos cannot be brought back.'))return;const j=await api('POST','/api/notifications/reset',{techId:D.st||''});await load();return toast('Cleared '+j.count+' report(s)')}
 if(a==='col'){COL[v]=!COL[v];try{localStorage.setItem('kentCol',JSON.stringify(COL))}catch(e){}return render(1)}
 if(a==='add'){const p=v.slice(0,2);D[v]=1;D['s'+p]='';render(1);const e=document.querySelector('[data-d="s'+p+'"]');if(e)e.focus();return}
 if(a==='eadd'){const q=Math.floor(num(D.eq));if(!D.ei)return toast('Select an item first');if(q<1)return toast('Enter quantity');const it=items.find(i=>i.id===D.ei);if(!it.hsn||!it.partCode)return toast('Add HSN code and Part code for '+it.name+' in Setup first');D['e.'+D.ei]=q;D.ei='';D.eq='';return render(1)}
 if(a==='esave'){const c=ecalc();if(!D.ecn||!D.ecn.trim())return fail('Enter customer name');if(!c.lines.length&&!c.other)return fail('Add at least one item or charge');const j=await api('POST','/api/estimates',{date:today(),customer:D.ecn.trim(),phone:(D.ecp||'').trim(),address:(D.eca||'').trim(),lines:c.lines.map(l=>({itemId:l.itemId,qty:l.qty})),other:c.other,discount:c.disc,notes:(D.enotes||'').trim()});clr('e');await load();render(1);toast('Estimate saved ✓');return eview(j.id)}
 if(a==='eview')return eview(v);
 if(a==='dpdfr'){const tc=techs.find(q=>q.id===v);if(!tc)return toast('Select a technician');dlDayEnd(tc,D.rf||date,D.rt||date);return}
 if(a==='dpdf'){const tc=techs.find(q=>q.id===v);if(!tc)return toast('Select a technician');dlDayEnd(tc,date);return}
 if(a==='rpdf'){const tc=techs.find(q=>q.id===D.st);if(!tc)return toast('Tap a technician name first');dlReport(tc,D.rf||date,D.rt||date);return}
 if(a==='epdf'){const x=ests.find(q=>q.id===v);if(x)dlPdf(x);return}
 if(a==='eprint'){window.print();return}
 if(a==='ewa'){const x=ests.find(q=>q.id===v);if(!x)return;const tx=`*Kent Service – Estimate ${x.no}*\nCustomer: ${x.customer}\n`+x.lines.map(l=>`${l.name} x${l.qty} = ${R(l.qty*l.price)}`).join('\n')+(x.other?`\nService charge: ${R(x.other)}`:'')+(x.discount?`\nDiscount: -${R(x.discount)}`:'')+`\n*Total: ${R(x.total)}*`;let ph=String(x.phone||'').replace(/\D/g,'');if(ph.length===10)ph='91'+ph;window.open('https://wa.me/'+ph+'?text='+encodeURIComponent(tx),'_blank');return}
 if(a==='edel'){const x=ests.find(q=>q.id===v);if(!x)return;if(await ask('Delete estimate '+x.no+'?')){await api('DELETE','/api/estimates/'+v);$('#mod').style.display='none';await load()}return}
 if(a==='gsel'){D.gi=v;D.sgq='';render(1);const e=document.querySelector('[data-d="gq"]');if(e)e.focus();return}
 if(a==='att'){if(!D.gt)return;await api('POST','/api/attendance',{techId:D.gt,date,status:v});await load();return toast(v==='working'?'Marked WORKING for '+date:v==='leave'?'Marked LEAVE for '+date:'Cleared '+date)}
 if(a==='adate'){date=v;return render(1)}
 if(a==='gadd'){const q=Math.floor(num(D.gq));if(!D.gi)return toast('Select an item first');if(q<1)return toast('Enter quantity');D['g.'+D.gi]=q;D.gi='';D.gq='';return render(1)}
 if(a==='rm'){delete D[v];if(v.startsWith('q.'))delete D['f.'+v.slice(2)];return render(1)}
 if(a==='pick'){D.gt=v;return render(1)}
 if(a==='spick'){D.st=v;return render(1)}
 if(a==='ap'||a==='rj'){$('#mod').style.display='none';await api('POST','/api/reports/'+v+'/discount',{approve:a==='ap'});await load();return}
 if(a==='seen'){await api('POST','/api/reports/'+v+'/seen');await load();return}
 if(a==='prio'||a==='unprio'){await api('POST','/api/reports/'+v+'/priority',{on:a==='prio'});toast(a==='prio'?'Priority 1 ✓ – starts after the current case':'Priority removed');await load();return}
 if(a==='dq'){if(await ask('Remove this case from the queue? The robot will not do it – finish it in Kent by hand if needed.')){await api('POST','/api/reports/'+v+'/dequeue');toast('Removed from queue ✓');await load()}return}
 if(a==='cancelw'){if(await ask('Cancel this case? The robot stops immediately, moves to the next case, and this case goes to Failed – finish it in Kent by hand.')){await api('POST','/api/reports/'+v+'/cancel');toast('Cancel sent ✓');await load();for(let i=0;i<10;i++)setTimeout(load,(i+1)*1000)}return}
if(a==='gonext'){if(await ask('Go next? The robot will work this case right after the case it is working on now finishes – even if Kent still shows it as Allocated.')){await api('POST','/api/reports/'+v+'/gonext');toast('Will be done next ✓');await load()}return}
 if(a==='retry'){if(await ask('Retry this case? It goes next in the queue and the robot starts it again from the beginning. First check in Kent that nothing was already added to this case.')){await api('POST','/api/reports/'+v+'/retry');toast('Back in the queue as priority 1 ✓');await load()}return}
 if(a==='hand'){if(await ask('Mark this case as finished by hand? It will be removed from this list.')){await api('POST','/api/reports/'+v+'/hand');await load()}return}
 if(a==='ai'){if(!D.in||!num(D.ip))return toast('Enter name and price');if(!(D.ih||'').trim()||!(D.ic||'').trim())return toast('HSN code and Part code are required');await api('POST','/api/items',{name:D.in.trim(),price:num(D.ip),hsn:D.ih.trim(),partCode:D.ic.trim()});clr('i');await load();return render(1)}
 if(a==='sp'){await api('PUT','/api/items/'+v,{price:num($('[id="p.'+v+'"]').value),hsn:$('[id="h.'+v+'"]').value,partCode:$('[id="c.'+v+'"]').value});await load();return toast('Item saved ✓')}
 if(a==='di'){if(await ask('Delete this item?')){await api('DELETE','/api/items/'+v);await load()}return}
 if(a==='at'){const id=sid(D.ti||'');if(!id||!D.tn||!D.tp)return toast('Enter ID, name and password');await api('POST','/api/technicians',{id,name:D.tn.trim(),password:D.tp});clr('t');await load();return render(1)}
 if(a==='rp'){const p=await ask('New password for '+v,true);if(p){await api('POST','/api/technicians/'+v+'/password',{password:p});toast('Password changed ✓')}return}
 if(a==='dt'){if(await ask('Delete technician '+v+'?')){await api('DELETE','/api/technicians/'+v);await load()}return}
}catch(e){console.error(e);toast('Error: '+((e&&(e.message||e.code))||e))}}

document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b)act(b.dataset.act,b.dataset.v)});
document.addEventListener('click',e=>{if(e.target.id==='mod'){pgStop();e.target.style.display='none'}});
// Warranty-card dates: type 01012025 and the screen shows 01/01/2025 (the / is added automatically)
const fmtDate=s=>{const d=String(s||'').replace(/\D/g,'').slice(0,8);let o=d.slice(0,2);if(d.length>2)o+='/'+d.slice(2,4);if(d.length>4)o+='/'+d.slice(4);return o};
document.addEventListener('input',e=>{const k=e.target.dataset&&e.target.dataset.d;if(!k)return;if(/^s[ip]\./.test(k)){const f=fmtDate(e.target.value);if(f!==e.target.value)e.target.value=f;}if(/^sn\./.test(k))document.querySelectorAll('[data-d="'+k+'"]').forEach(x=>{if(x!==e.target)x.value=e.target.value});if(k==='otp')e.target.value=e.target.value.replace(/\D/g,'').slice(0,6);D[k]=e.target.type==='checkbox'?e.target.checked:e.target.value;if(k==='sq')updSearch();if(/^(q\.|f\.|other|disc)/.test(k))upd();if(/^(e\.|eother|edisc)/.test(k))updE();if(k==='sq.'||k==='sg.')updRes(k.slice(1));if(k==='sgq'){const e=$('#res-gq');if(e)e.innerHTML=gres()}});
document.addEventListener('change',async e=>{const t=e.target;if(t.id==='dt'){date=t.value||today();render(1)}
 else if(t.dataset&&(t.dataset.d==='rf'||t.dataset.d==='rt')){render(1)}
 else if(t.dataset&&t.dataset.gi){D.gi=t.value}
 else if(t.dataset&&t.dataset.ei){D.ei=t.value}
 else if(t.dataset&&t.dataset.s){const p=t.dataset.s;if(t.value){D[p+t.value]=1;D['s'+p]='';render(1)}}
 else if(t.dataset&&t.dataset.d==='pm'){D.pm=t.value;render(1)}
 else if(t.dataset&&t.dataset.d==='svc'){D.svc=t.checked;render(1)}
 else if((t.id==='f-cam'||t.id==='f-gal')&&t.files[0]){try{IMG[fileTarget]=await shrink(t.files[0]);t.value='';render(1)}catch(x){toast(x.message)}}});
let down=false;document.addEventListener('pointerdown',()=>{down=true},true);document.addEventListener('pointerup',()=>setTimeout(()=>{down=false},150),true);
let pend=0;document.addEventListener('focusout',()=>setTimeout(()=>{if(pend&&!down&&!typing()){pend=0;render()}},400));
const typing=()=>{const a=document.activeElement;return a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)};
function render(force){if(!db||(loaded&15)!==15)return;if(!force&&typing()){pend=1;return}pend=0;try{head();
 if(adminOn)({stock:viewStock,sales:viewSales,send:viewSend,est:viewEstimate,stk:viewStk,setup:viewSetup})[tab]();else if(me())viewTech();else viewLogin();if(adminOn&&(saveErr||(usage&&usage.percent>=80)))$('#app').insertAdjacentHTML('afterbegin',stoBanner());if(adminOn&&due())$('#app').insertAdjacentHTML('afterbegin',banner());document.body.classList.add('rd')}catch(e){console.error(e);$('#app').innerHTML='<div class="card">Display error: '+esc(e.message)+'</div>'}}

// ================= STICKERS: Kent Part Replacement Extractor (admin tab) =================
// Same rules as the stand-alone extractor: one sticker per FOC spare part, 7 fields, 3 stickers per row in Word.
const STK=(()=>{
const FIELDS=[{k:'Distributor'},{k:'Case ID'},{k:'Name of Customer'},{k:'Machine No'},{k:'Date Machine Installed'},{k:'Date Part Changed'},{k:'Reason of Changed'}];
const DIST='SRI RAJAMMATALLI SERVICES';
const DATE=/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b|\b\d{1,2}[\- ][A-Za-z]{3,9}[\- ]\d{2,4}\b/;
const S={records:[],status:'',bar:0,barShow:false,raw:''};          // kept here so the 8-second screen refresh never loses anything
const okRow=r=>{const v=(r.d['Reason of Changed']||'').trim();return !!v&&!/\(\s*\)/.test(v)};
const isMiss=v=>!String(v).trim()||/\(\s*\)/.test(v);
const G=id=>document.getElementById(id);
const setSt=t=>{S.status=t;const e=G('stk-status');if(e)e.textContent=t};
const setBar=(p,show)=>{S.bar=p;S.barShow=show;const b=G('stk-bar');if(b){b.style.display=show?'block':'none';b.firstChild.style.width=p+'%'}};

// libraries (pdf.js to read PDFs, docx to write Word) are loaded from the internet the first time they are needed
const PDFJS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',PDFW='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',DOCX='https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js';
const loadJs=src=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error('Could not load a library - check the internet'));document.head.appendChild(s)});
let libP=null;const libs=()=>libP||(libP=Promise.all([loadJs(PDFJS),loadJs(DOCX)]).catch(e=>{libP=null;throw e}));

async function readPdf(file){
  pdfjsLib.GlobalWorkerOptions.workerSrc=PDFW;
  const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
  const lines=[];lines.pages=[];
  for(let p=1;p<=pdf.numPages;p++){
    const c=await (await pdf.getPage(p)).getTextContent();
    lines.pages.push(c.items.filter(i=>i.str.trim()).map(i=>({s:i.str,x:i.transform[4],y:i.transform[5]})));
    const rows=[];
    c.items.filter(i=>i.str.trim()).forEach(i=>{
      const y=i.transform[5],x=i.transform[4];
      let r=rows.find(r=>Math.abs(r.y-y)<3);
      if(!r){r={y,t:[]};rows.push(r)}
      r.t.push({x,s:i.str});
    });
    rows.sort((a,b)=>b.y-a.y).forEach(r=>{r.t.sort((a,b)=>a.x-b.x);lines.push(r.t.map(t=>t.s.trim()).join(' | '))});
  }
  return lines;
}
const clean=v=>v.replace(/^[\s:|\-–=]+/,'').trim();
const cells=s=>s.split('|').map(x=>x.trim()).filter(Boolean);
// Printed page headers/footers (e.g. "...| Salesforce", "https://...") can sit between a label and its value when a page breaks there: skip them.
const junk=l=>/Salesforce|https?:\/\//i.test(l);
const nextLines=(lines,i,n)=>{const out=[];for(let j=i+1;j<lines.length&&out.length<n;j++)if(!junk(lines[j]))out.push(lines[j]);return out};
function after(lines,re){
  for(let i=0;i<lines.length;i++){
    const m=lines[i].match(re);if(!m)continue;
    const rest=cells(clean(lines[i].slice(m.index+m[0].length)));
    if(rest.length)return rest[0];
    for(const l of nextLines(lines,i,2)){const c=cells(l);if(c.length)return c[0]}
  }
  return '';
}
function dateAfter(lines,re){
  for(let i=0;i<lines.length;i++){
    const m=lines[i].match(re);if(!m)continue;
    let d=lines[i].slice(m.index+m[0].length).match(DATE);if(d)return d[0];
    const nx=nextLines(lines,i,1)[0];
    if(nx){d=nx.match(DATE);if(d)return d[0]}
  }
  return '';
}
function caseId(lines){
  const h=lines.join('\n').match(/\b\d{6}-\d{5}\b/);if(h)return h[0];
  const P=/\b\d{10}\b|\b\d{6}-\d{4,6}\b/;
  for(let i=0;i<lines.length;i++){
    if(/\bcase\b/i.test(lines[i])){
      for(let j=0;j<4&&lines[i+j];j++){const m=lines[i+j].match(P);if(m)return m[0]}
    }
  }
  for(const l of lines.slice(0,25)){const m=l.match(/\b\d{10}\b/);if(m)return m[0]}
  return '';
}
function spares(lines){
  const names=[];let xr=null,done=false,total=0;
  for(const it of (lines.pages||[])){
    if(done)break;
    let yTop=1e9,h=null,r=null;
    const iss=it.filter(t=>/^Issued/i.test(t.s.trim()));
    for(const t of iss){
      const same=iss.filter(u=>Math.abs(u.y-t.y)<4&&u.x>t.x).sort((a,b)=>a.x-b.x)[0];
      if(same){h=t;r=same;break}
    }
    if(h){
      const sp=it.find(t=>/^Spare\s*Part/i.test(t.s.trim())&&Math.abs(t.y-h.y)<4&&t.x<h.x);
      xr={x0:h.x-6,x1:r.x-2,tx0:sp?sp.x-6:null,tx1:h.x-6};yTop=h.y-2;
    }else if(!xr)continue;
    const end=it.filter(t=>t.y<yTop&&/^View(\s+All\b|$)/.test(t.s.trim())).sort((a,b)=>b.y-a.y)[0];
    if(end)done=true;
    const yEnd=end?end.y:-1e9;
    const inb=t=>t.y<yTop&&t.y>yEnd&&!/Salesforce|https?:\/\//i.test(t.s);
    const col=it.filter(t=>inb(t)&&t.x>=xr.x0&&t.x<xr.x1)
      .sort((a,b)=>(Math.abs(b.y-a.y)<2?a.x-b.x:b.y-a.y));
    const rows=[];
    col.forEach(t=>{
      const s=t.s.trim();
      if(/^[A-Za-z0-9][A-Za-z0-9\-]{3,11}\s*\|/.test(s))rows.push({y:t.y,txt:s,type:''});
      else if(rows.length)rows[rows.length-1].txt+=' '+s;
    });
    if(xr.tx0!=null&&rows.length){
      it.filter(t=>inb(t)&&t.x>=xr.tx0&&t.x<xr.tx1).forEach(t=>{
        let b=rows[0];
        for(const q of rows)if(Math.abs(q.y-t.y)<Math.abs(b.y-t.y))b=q;
        b.type+=(b.type?' ':'')+t.s.trim();
      });
    }
    rows.forEach(q=>{
      const txt=q.txt.replace(/\(\/lightning[^)\u2026]*[)\u2026]?/g,' ');
      const n=txt.replace(/^\S+\s*\|\s*/,'').replace(/\s+/g,' ').trim();
      if(!n||!/[A-Za-z]/.test(n))return;
      total++;
      if(!q.type||/^FOC\b/i.test(q.type))names.push(n);
    });
  }
  names.total=total;
  return names;
}
function shortName(n){
  const u=n.toUpperCase().replace(/\s+/g,' ').trim();
  if(/MEMBRANE/.test(u)){
    if(/COMPACT/.test(u))return 'MEMBRANE COMPACT';
    if(/HIGH/.test(u))return 'MEMBRANE HIGH';
    return 'MEMBRANE';
  }
  if(/\bFRT\b/.test(u)){const m=u.match(/FRT\s*(\d+)/);return 'FRT'+(m?' '+m[1]:'')}
  if(/BLST|BALLAST/.test(u))return 'NEW BALLAST';
  return u.replace(/^(POWP-|SP\s+|ELEC\s+)/,'').trim();
}
function extract(lines){
  const text=lines.join('\n');
  const km=text.match(/\bKR\d{8,12}\b/i);
  const base={
    'Distributor':DIST,
    'Case ID':caseId(lines),
    'Name of Customer':after(lines,/(name\s*of\s*(the\s*)?customer|customer\s*name)/i).replace(/[\(\[].*$/,'').replace(/[\)\]]/g,'').trim(),
    'Machine No':km?km[0]:after(lines,/machine\s*(no|number|sl\w*)|serial\s*(no|number)/i),
    'Date Machine Installed':dateAfter(lines,/install(ation|ed)?\s*date|date\s*of\s*install(ation)?|machine\s*installed/i),
    'Date Part Changed':dateAfter(lines,/first\s*clos(ure|ed)?(\s*date)?/i),
    'Reason of Changed':'DEAD'
  };
  const parts=spares(lines);
  const em=text.match(/(\d+)\s*items?\s*\u2022\s*Sorted by SPC ID/i);
  const expected=em?+em[1]:0,found=parts.total||0;
  for(let i=found;i<expected;i++)parts.push('');
  const out=parts.map(c=>({...base,'Reason of Changed':'DEAD ('+(c?shortName(c):'')+')'}));
  out.found=found;out.expected=expected;
  return out;
}

function drawTable(){
  const tbl=G('stk-tbl');if(!tbl)return;
  const tb=tbl.tBodies[0];tb.innerHTML='';
  S.records.forEach((r,i)=>{
    const tr=document.createElement('tr');
    const x=document.createElement('td');x.className='x';
    const b=document.createElement('button');b.type='button';b.textContent='✕';b.title='Remove';
    b.onclick=()=>{S.records.splice(i,1);drawTable()};x.appendChild(b);tr.appendChild(x);
    const n=document.createElement('td');n.className='n';n.textContent=r.file;n.title=r.file;tr.appendChild(n);
    FIELDS.forEach(f=>{
      const td=document.createElement('td'),inp=document.createElement('input');
      inp.value=r.d[f.k]||'';inp.spellcheck=false;
      inp.className=isMiss(inp.value)?'miss':'';
      inp.oninput=()=>{r.d[f.k]=inp.value;inp.className=isMiss(inp.value)?'miss':''};
      td.appendChild(inp);tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
  G('stk-tw').hidden=!S.records.length;
  G('stk-word').disabled=G('stk-csv').disabled=!S.records.length;
}

async function handle(files){
  files=[...files].filter(f=>/pdf$/i.test(f.type)||/\.pdf$/i.test(f.name));
  if(!files.length){setSt('Please choose PDF files.');return}
  try{setSt('Loading PDF reader…');await libs()}catch(e){setSt(e.message);return}
  setBar(0,true);
  let bad=[],scanned=[],short=[],nosp=[];
  for(let i=0;i<files.length;i++){
    setSt('Reading '+(i+1)+' of '+files.length+': '+files[i].name);
    setBar(i/files.length*100,true);
    try{
      const lines=await readPdf(files[i]);
      S.raw=files[i].name+'\n\n'+lines.join('\n');const rw=G('stk-raw');if(rw)rw.textContent=S.raw;
      if(!lines.length){scanned.push(files[i].name);continue}
      const rs=extract(lines);if(!rs.length)nosp.push(files[i].name);rs.forEach(d=>S.records.push({file:files[i].name,d}));if(rs.expected&&rs.found<rs.expected)short.push(files[i].name+' ('+rs.found+' of '+rs.expected+' part codes found)');
    }catch(e){console.error(e);bad.push(files[i].name)}
    if(i%5===4)drawTable();
  }
  setBar(100,true);
  drawTable();
  let m='Done — '+S.records.length+' stickers total (one per spare part).';
  if(scanned.length)m+=' Scanned/no-text PDFs skipped: '+scanned.join(', ')+'.';
  if(nosp.length)m+=' No FOC spare parts found, no sticker made: '+nosp.join(', ')+'.';
  if(short.length)m+=' CHECK yellow rows with empty () part code (left out of downloads until filled): '+short.join(', ')+'.';
  if(bad.length)m+=' Could not read: '+bad.join(', ')+'.';
  setSt(m);
  setTimeout(()=>setBar(0,false),800);
}

function save(blob,name){
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;
  document.body.appendChild(a);a.click();a.remove();
  setSt('Saved '+name);
}
function csvOut(){
  const q=s=>'"'+String(s||'').replace(/"/g,'""')+'"';
  const csv=[['PDF file',...FIELDS.map(f=>f.k)].map(q).join(',')]
    .concat(S.records.filter(okRow).map(r=>[r.file,...FIELDS.map(f=>r.d[f.k])].map(q).join(','))).join('\r\n');
  save(new Blob(['\ufeff'+csv],{type:'text/csv'}),'kent-part-replacement.csv');
}
async function wordOut(){
  try{
    await libs();
    const D=window.docx;
    if(!D)throw new Error('Word library failed to load');
    const none={style:D.BorderStyle.NONE,size:0,color:'FFFFFF'};
    const noB={top:none,bottom:none,left:none,right:none};
    const one={style:D.BorderStyle.SINGLE,size:4,color:'000000'};
    const bd={top:one,bottom:one,left:one,right:one};
    const W1=1450,W2=2100;
    const cell=(t,w,o={})=>new D.TableCell({
      width:{size:w,type:D.WidthType.DXA},borders:bd,columnSpan:o.span,
      verticalAlign:D.VerticalAlign.CENTER,
      margins:{top:50,bottom:50,left:80,right:80},
      children:[new D.Paragraph({alignment:o.center?D.AlignmentType.CENTER:D.AlignmentType.LEFT,
        children:[new D.TextRun({text:String(t||'').toUpperCase(),bold:!!o.bold,size:o.size||14,font:'Cambria'})]})]
    });
    const inner=r=>new D.Table({
      width:{size:W1+W2,type:D.WidthType.DXA},columnWidths:[W1,W2],
      rows:[new D.TableRow({children:[cell('Kent Part Replacement',W1+W2,{span:2,bold:true,center:true,size:17})]})]
        .concat(FIELDS.map(f=>new D.TableRow({cantSplit:true,children:[cell(f.k,W1),cell(r.d[f.k],W2)]})))
    });
    const empty=()=>new D.Paragraph('');
    const oc=kids=>new D.TableCell({width:{size:3700,type:D.WidthType.DXA},borders:noB,
      margins:{top:60,bottom:120,left:60,right:60},children:kids});
    const recs=S.records.filter(okRow);
    if(!recs.length)throw new Error('no rows with a part code');
    const orows=[];
    for(let i=0;i<recs.length;i+=3){
      const cs=[0,1,2].map(j=>{const r=recs[i+j];return oc(r?[inner(r),empty()]:[empty()])});
      orows.push(new D.TableRow({cantSplit:true,children:cs}));
    }
    const doc=new D.Document({sections:[{
      properties:{page:{size:{width:11906,height:16838,orientation:D.PageOrientation.PORTRAIT},
        margin:{top:500,bottom:500,left:400,right:400}}},
      children:[new D.Table({width:{size:11100,type:D.WidthType.DXA},columnWidths:[3700,3700,3700],
        borders:{top:none,bottom:none,left:none,right:none,insideHorizontal:none,insideVertical:none},rows:orows})]
    }]});
    save(await D.Packer.toBlob(doc),'kent-part-replacement.docx');
    if(S.records.length>recs.length)setSt('Saved. '+(S.records.length-recs.length)+' row(s) without a part code were left out.');
  }catch(e){console.error(e);setSt('Word export failed: '+e.message)}
}

const CSS=`
#stk{--warn:#fff1d6}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) #stk{--warn:#4a3b14}}
:root[data-theme="dark"] #stk{--warn:#4a3b14}
#stk-drop{border:2px dashed var(--mu);border-radius:12px;padding:28px 16px;text-align:center;cursor:pointer;background:var(--card)}
#stk-drop.over{border-color:var(--pr)}#stk-drop b{color:var(--pr)}
#stk-status{font-size:13px;color:var(--mu);margin:10px 0;min-height:18px}
#stk-bar{height:6px;background:var(--bd);border-radius:3px;overflow:hidden;display:none}
#stk-bar i{display:block;height:100%;width:0;background:var(--pr)}
#stk .tw{overflow:auto;max-height:70vh;margin-top:8px;border:1px solid var(--bd);border-radius:8px;background:var(--card)}
#stk .tw[hidden]{display:none}
#stk table{border-collapse:collapse;width:100%;font-size:13px}
#stk th,#stk td{border:1px solid var(--bd);padding:0;white-space:nowrap;background:transparent}
#stk tr:nth-child(even) td{background:transparent}
#stk th{position:sticky;top:0;background:var(--card);padding:8px;text-align:left;z-index:1;color:var(--tx)}
#stk td.n{padding:6px 8px;color:var(--mu);max-width:160px;overflow:hidden;text-overflow:ellipsis}
#stk td input{width:100%;min-width:130px;border:0;border-radius:0;background:transparent;color:var(--tx);font:inherit;padding:8px;text-transform:uppercase;box-shadow:none}
#stk td input.miss{background:var(--warn)}
#stk td input:focus{outline:2px solid var(--pr);outline-offset:-2px}
#stk td.x{text-align:center;width:32px}
#stk td.x button{background:none;border:0;color:var(--mu);padding:4px 8px;cursor:pointer}
#stk .stk-row{display:flex;gap:8px;flex-wrap:wrap}
#stk .btn.g{background:transparent;color:var(--pr);border:1px solid var(--pr);box-shadow:none}
#stk .btn:disabled{opacity:.4;cursor:default}
#stk details{margin-top:16px;font-size:13px;color:var(--mu)}
#stk pre{white-space:pre-wrap;max-height:240px;overflow:auto}`;

function view(){
  if(!G('stk-css')){const s=document.createElement('style');s.id='stk-css';s.textContent=CSS;document.head.appendChild(s)}
  $('#app').innerHTML=`<div class="card" id="stk"><h2>Part Replacement stickers</h2>
<p class="mu" style="margin:0 0 12px">Upload many PDFs at once. Each spare part becomes one sticker/row below — check the highlighted blanks, then download a Word file with 3 tables per row.</p>
<div id="stk-drop"><b>Choose PDFs</b> or drag them here (30, 50, more…)<input id="stk-file" type="file" accept="application/pdf" multiple hidden></div>
<div id="stk-status"></div><div id="stk-bar"><i></i></div>
<div class="tw" id="stk-tw" hidden><table id="stk-tbl"><thead><tr><th></th><th>PDF file</th>${FIELDS.map(f=>'<th>'+f.k+'</th>').join('')}</tr></thead><tbody></tbody></table></div>
<div class="stk-row"><button type="button" class="btn" id="stk-word" disabled>Download Word (3 per row)</button><button type="button" class="btn g" id="stk-csv" disabled>Download CSV</button><button type="button" class="btn g" id="stk-clear">Clear all</button></div>
<details><summary>Raw text of the last PDF read (for checking)</summary><pre id="stk-raw"></pre></details></div>`;
  const drop=G('stk-drop'),file=G('stk-file');
  drop.onclick=()=>file.click();
  file.onchange=()=>{handle(file.files);file.value=''};
  drop.ondragover=e=>{e.preventDefault();drop.classList.add('over')};
  drop.ondragleave=()=>drop.classList.remove('over');
  drop.ondrop=e=>{e.preventDefault();drop.classList.remove('over');handle(e.dataTransfer.files)};
  G('stk-clear').onclick=()=>{S.records.length=0;drawTable();setSt('')};
  G('stk-csv').onclick=csvOut;
  G('stk-word').onclick=wordOut;
  G('stk-raw').textContent=S.raw;
  setSt(S.status);setBar(S.bar,S.barShow);drawTable();
}
return {view};
})();
const viewStk=STK.view;

if(token)load();else render(1);setInterval(()=>{if(token)load()},8000);
// Live updates: the server pushes a signal the moment anything changes (e.g. the robot moves a case to Pending), so the screen refreshes at once. A quick 2-second check is the backup if the host buffers the live connection.
let REVSEEN=-1;setInterval(async()=>{if(!token||document.hidden)return;try{const j=await api('GET','/api/rev');if(j.rev!==REVSEEN){REVSEEN=j.rev;load()}}catch(e){}},2000);
(async function live(){for(;;){try{if(token){const r=await fetch('/api/stream',{headers:{Authorization:'Bearer '+token}});if(r.ok&&r.body){const rd=r.body.getReader(),dec=new TextDecoder();for(;;){const{done,value}=await rd.read();if(done)break;if(/data:/.test(dec.decode(value)))load()}}}}catch(e){}await new Promise(k=>setTimeout(k,3000))}})();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&token)load()});
