(() => {
  const C = window.DonationCommon;
  const db = C.db;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  let rows = [];
  let settings = null;
  let currentReviewId = null;
  let campaigns = [];
  let managerPeriod = 'all';

  function esc(v){return C.escapeHtml(v)}
  function normalize(v){return String(v||'').toLowerCase().replace(/\s+/g,' ').trim()}
  function driveFileId(value=''){
    const raw=String(value||'').trim();
    if(!raw)return '';
    const m=raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)||raw.match(/[?&]id=([a-zA-Z0-9_-]+)/)||raw.match(/\/thumbnail\?id=([a-zA-Z0-9_-]+)/);
    return m?.[1]||'';
  }
  function nikornDisplayUrl(x){
    const id=String(x?.nikorn_image_drive_file_id||'').trim()||driveFileId(x?.nikorn_image_url||'');
    if(id)return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1600`;
    return String(x?.nikorn_image_url||'').trim();
  }
  function nikornOpenUrl(x){
    const id=String(x?.nikorn_image_drive_file_id||'').trim()||driveFileId(x?.nikorn_image_url||'');
    if(id)return `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
    return String(x?.nikorn_image_url||'').trim();
  }
  function nikornDownloadUrl(x){
    const id=String(x?.nikorn_image_drive_file_id||'').trim()||driveFileId(x?.nikorn_image_url||'');
    if(id)return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
    return String(x?.nikorn_image_url||'').trim();
  }

  function normalizePhotoUrl(value=''){
    const raw=String(value||'').trim();if(!raw)return '';
    try{
      const u=new URL(raw);if(!['http:','https:'].includes(u.protocol))return '';
      if(/(^|\.)drive\.google\.com$/i.test(u.hostname)){
        const m=raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)||raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if(m?.[1])return `https://drive.google.com/thumbnail?id=${encodeURIComponent(m[1])}&sz=w1200`;
      }
      return raw;
    }catch(_){return ''}
  }
  function avatarHtml(x,size='w-11 h-11'){
    const src=normalizePhotoUrl(x?.photo_url);
    if(src)return `<img src="${esc(src)}" alt="${esc(x?.display_name||'ผู้บริจาค')}" class="${size} rounded-xl object-cover bg-slate-100 shrink-0" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div style="display:none" class="${size} rounded-xl ${x?.donor_type==='monastic'?'bg-amber-50 text-amber-700':'bg-orange-50 text-orange-600'} items-center justify-center shrink-0"><i data-lucide="${x?.donor_type==='monastic'?'landmark':'user'}" class="w-5 h-5"></i></div>`;
    return `<div class="${size} rounded-xl ${x?.donor_type==='monastic'?'bg-amber-50 text-amber-700':'bg-orange-50 text-orange-600'} flex items-center justify-center shrink-0"><i data-lucide="${x?.donor_type==='monastic'?'landmark':'user'}" class="w-5 h-5"></i></div>`;
  }
  function alumniBadge(x){return x?.is_alumni?`<span class="text-[10px] px-2 py-0.5 rounded-full bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-100 font-bold">ศิษย์เก่า${x.alumni_batch?' รุ่น '+esc(x.alumni_batch):''}</span>`:''}
  function modalStatus(msg, ok=false){const el=$('#review-status');el.className=`rounded-xl p-3 text-sm border ${ok?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-rose-50 text-rose-700 border-rose-200'}`;el.textContent=msg;el.classList.remove('hidden')}
  function certStatus(msg,ok=false){const el=$('#cert-status');el.className=`rounded-xl p-3 text-sm border ${ok?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-rose-50 text-rose-700 border-rose-200'}`;el.textContent=msg;el.classList.remove('hidden')}
  function nikornStatus(msg,ok=false){const el=$('#nikorn-status');if(!el)return;el.className=`mt-5 rounded-xl p-3 text-sm border ${ok?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-rose-50 text-rose-700 border-rose-200'}`;el.textContent=msg;el.classList.remove('hidden')}
  function settingsStatus(msg,ok=false){const el=$('#settings-status');el.className=`rounded-xl p-3 text-sm border ${ok?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-rose-50 text-rose-700 border-rose-200'}`;el.textContent=msg;el.classList.remove('hidden')}

  function reviewPhotoStatus(msg,ok=false){const el=$('#review-photo-upload-status');if(!el)return;el.className=`mt-2 text-xs ${ok?'text-emerald-700':'text-slate-500'}`;el.textContent=msg}
  function updateReviewPhotoPreview(url=''){const box=$('#review-photo-preview');if(!box)return;const src=normalizePhotoUrl(url);if(src){box.innerHTML=`<img src="${esc(src)}" alt="รูปผู้บริจาค" class="w-full h-full object-cover">`; }else{box.innerHTML='<div class="px-3 text-center text-slate-400 text-xs leading-5">ยังไม่มีรูป</div>'}}

  async function ensureAuth(){
    if(!db){$('#login-status').textContent='ยังไม่ได้ตั้งค่า Supabase';$('#login-status').classList.remove('hidden');return}
    const {data:{user}}=await db.auth.getUser();
    if(user) return showApp(user);
    $('#login-view').classList.remove('hidden'); $('#app-view').classList.add('hidden');
  }

  async function showApp(user){
    $('#login-view').classList.add('hidden');$('#app-view').classList.remove('hidden');$('#manager-email').textContent=user.email||'';
    await loadAll(); lucide.createIcons();
  }

  $('#login-form').addEventListener('submit',async e=>{
    e.preventDefault();const f=e.currentTarget,st=$('#login-status');st.classList.add('hidden');
    try{const {data,error}=await db.auth.signInWithPassword({email:f.elements.email.value.trim(),password:f.elements.password.value});if(error)throw error;await showApp(data.user)}catch(err){st.textContent='เข้าสู่ระบบไม่สำเร็จ: '+(err.message||err);st.classList.remove('hidden')}
  });
  $('#logout-btn').onclick=async()=>{await db.auth.signOut();location.reload()};
  $('#refresh-btn').onclick=()=>loadAll();

  async function loadAll(){
    const [setRes,donRes,campRes]=await Promise.all([
      db.from('donation_settings').select('*').eq('id',1).maybeSingle(),
      db.from('donations').select('*').eq('submission_state','submitted').order('submitted_at',{ascending:false}).limit(1000),
      db.from('donation_campaigns').select('*').order('is_default',{ascending:false}).order('sort_order',{ascending:true}).order('created_at',{ascending:true})
    ]);
    if(setRes.error) throw setRes.error;if(donRes.error)throw donRes.error;if(campRes.error)throw campRes.error;
    settings=setRes.data||{};rows=donRes.data||[];campaigns=campRes.data||[];
    renderDashboard();renderDonationList();renderHistoryAll();fillSettingsForm();renderGoogleCertificateSettings();renderNikornSettings();renderCampaigns();
  }

  function donorIdentityName(x){
    return normalize(x?.certificate_name_override || x?.display_name || '');
  }

  function uniqueDonorCount(list){
    return new Set((list||[]).map(donorIdentityName).filter(Boolean)).size;
  }

  function periodRows(period){
    const verified=rows.filter(x=>x.status==='verified');
    if(period==='all')return verified;
    const now=new Date();
    return verified.filter(x=>{
      const d=new Date(`${x.transfer_date}T12:00:00`);
      if(Number.isNaN(d.getTime()))return false;
      if(period==='today')return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()&&d.getDate()===now.getDate();
      if(period==='month')return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();
      if(period==='year')return d.getFullYear()===now.getFullYear();
      return true;
    });
  }
  function renderManagerPeriod(){
    const arr=periodRows(managerPeriod);
    $('#d-period-amount').textContent=C.formatTHB(arr.reduce((s,x)=>s+Number(x.amount||0),0));
    $('#d-period-donors').textContent=uniqueDonorCount(arr).toLocaleString('th-TH')+' คน';
    $('#d-period-count').textContent=arr.length.toLocaleString('th-TH')+' รายการ';
    $$('.manager-period-btn').forEach(b=>{const on=b.dataset.managerPeriod===managerPeriod;b.className=`manager-period-btn px-4 py-2 rounded-xl text-sm font-bold ${on?'bg-slate-900 text-white':'text-slate-600 hover:bg-white'}`});
  }

  function renderDashboard(){
    const pending=rows.filter(x=>x.status==='pending'),verified=rows.filter(x=>x.status==='verified');
    $('#d-pending').textContent=pending.length.toLocaleString('th-TH');$('#d-verified').textContent=verified.length.toLocaleString('th-TH');
    $('#d-amount').textContent=C.formatTHB(verified.reduce((s,x)=>s+Number(x.amount||0),0));$('#d-certs').textContent=verified.filter(x=>x.certificate_no).length.toLocaleString('th-TH');
    $('#d-open').textContent=settings?.is_open?'เปิด':'ปิด';$('#d-open').className=settings?.is_open?'text-emerald-600':'text-rose-600';
    $('#d-banner').textContent=settings?.banner_url?'ตั้งค่าแล้ว':'ยังไม่มี';$('#d-template').textContent=settings?.google_slides_template_id?'Google Slides':'รอ Template';
    const activeCampaigns=campaigns.filter(c=>c.is_active);$('#d-prefix').textContent=activeCampaigns.length?activeCampaigns.map(c=>c.prefix).join(', '):(settings?.certificate_prefix||'WNW');
    renderManagerPeriod();
    const latest=rows.slice(0,6),box=$('#dashboard-latest');
    box.innerHTML=latest.length?latest.map(x=>{const st=C.normalizeStatus(x.status);return `<button data-review="${x.id}" class="w-full text-left flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 hover:border-orange-200">${avatarHtml(x,'w-10 h-10')}<div class="min-w-0 flex-1"><p class="font-bold truncate">${esc(x.display_name)}</p><p class="text-xs text-slate-400 mt-0.5">${esc(x.request_no)} • ${C.formatDateTH(x.transfer_date)}${x.campaign_name?' • '+esc(x.campaign_name):''}</p></div><div class="text-right"><p class="font-extrabold text-orange-700">${C.formatTHB(x.amount)}</p><span class="text-[10px] border px-2 py-0.5 rounded-full ${st.classes}">${st.label}</span></div></button>`}).join(''):'<div class="rounded-2xl bg-slate-50 p-7 text-center text-slate-400">ยังไม่มีรายการ</div>';
    bindReviewButtons();lucide.createIcons();
  }

  function renderDonationList(){
    const q=normalize($('#donation-search')?.value),filter=$('#status-filter')?.value||'';
    const arr=rows.filter(x=>(!filter||x.status===filter)&&(!q||normalize([x.display_name,x.request_no,x.certificate_no,x.temple_name,x.organization,x.phone,x.email].join(' ')).includes(q)));
    const box=$('#donation-list');
    if(!arr.length){box.innerHTML='<div class="glass rounded-2xl p-10 text-center text-slate-400">ไม่พบรายการที่ตรงกับตัวกรอง</div>';return}
    box.innerHTML=arr.map(x=>{const st=C.normalizeStatus(x.status);return `<article class="glass rounded-2xl p-4 sm:p-5"><div class="flex flex-col lg:flex-row lg:items-center gap-4"><div class="flex items-start gap-3 min-w-0 flex-1">${avatarHtml(x)}<div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><h3 class="font-extrabold truncate">${esc(x.display_name)}</h3>${alumniBadge(x)}<span class="text-[10px] border px-2 py-0.5 rounded-full ${st.classes}">${st.label}</span></div><p class="text-xs text-slate-400 mt-1">${esc(x.request_no)} • ${C.formatDateTH(x.transfer_date)} ${String(x.transfer_time||'').slice(0,5)} น.${x.temple_name?' • '+esc(x.temple_name):''}</p>${x.certificate_no?`<p class="text-xs text-emerald-700 font-bold mt-1">${esc(x.certificate_no)}</p>`:''}</div></div><div class="flex items-center justify-between lg:justify-end gap-3"><p class="text-xl font-extrabold text-orange-700">${C.formatTHB(x.amount)}</p><button data-review="${x.id}" class="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold">ตรวจสอบ / ออกใบ</button></div></div></article>`}).join('');
    bindReviewButtons();lucide.createIcons();
  }
  function bindReviewButtons(){$$('[data-review]').forEach(b=>b.onclick=()=>openReview(b.dataset.review))}
  $('#donation-search').addEventListener('input',renderDonationList);$('#status-filter').addEventListener('change',renderDonationList);

  function renderHistoryAll(){
    const verified=rows.filter(x=>x.status==='verified');
    if($('#h-total'))$('#h-total').textContent=rows.length.toLocaleString('th-TH');
    if($('#h-donors'))$('#h-donors').textContent=uniqueDonorCount(rows).toLocaleString('th-TH');
    if($('#h-alumni'))$('#h-alumni').textContent=uniqueDonorCount(rows.filter(x=>x.is_alumni)).toLocaleString('th-TH');
    if($('#h-amount'))$('#h-amount').textContent=C.formatTHB(verified.reduce((sum,x)=>sum+Number(x.amount||0),0));
    const q=normalize($('#history-all-search')?.value),stf=$('#history-status-filter')?.value||'',tf=$('#history-type-filter')?.value||'',af=$('#history-alumni-filter')?.value||'';
    const arr=rows.filter(x=>
      (!stf||x.status===stf)&&(!tf||x.donor_type===tf)&&
      (!af||(af==='yes'?!!x.is_alumni:!x.is_alumni))&&
      (!q||normalize([x.display_name,x.request_no,x.certificate_no,x.temple_name,x.organization,x.phone,x.email,x.alumni_batch].join(' ')).includes(q))
    );
    const box=$('#history-all-list');if(!box)return;
    if(!arr.length){box.innerHTML='<div class="glass rounded-2xl p-10 text-center text-slate-400">ไม่พบประวัติที่ตรงกับตัวกรอง</div>';return}
    box.innerHTML=arr.map(x=>{const st=C.normalizeStatus(x.status);return `<article class="glass rounded-2xl p-4 sm:p-5"><div class="flex flex-col lg:flex-row lg:items-center gap-4"><div class="flex items-start gap-3 min-w-0 flex-1">${avatarHtml(x,'w-14 h-14')}<div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><h3 class="font-extrabold">${esc(x.display_name)}</h3>${alumniBadge(x)}<span class="text-[10px] border px-2 py-0.5 rounded-full ${st.classes}">${st.label}</span></div><p class="text-xs text-slate-400 mt-1">${esc(x.request_no)} • ${C.formatDateTH(x.transfer_date)} ${String(x.transfer_time||'').slice(0,5)} น.</p><p class="text-xs text-slate-500 mt-1">${x.donor_type==='monastic'?'พระสงฆ์ / สามเณร':'ฆราวาส'}${x.temple_name?' • '+esc(x.temple_name):''}${x.organization?' • '+esc(x.organization):''}</p>${x.certificate_no?`<p class="text-xs text-emerald-700 font-bold mt-1">${esc(x.certificate_no)}</p>`:''}</div></div><div class="flex items-center justify-between lg:justify-end gap-3"><p class="text-xl font-extrabold text-orange-700">${C.formatTHB(x.amount)}</p><button data-review="${x.id}" class="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-sm font-bold hover:border-orange-200">ดูรายละเอียด</button></div></div></article>`}).join('');
    bindReviewButtons();lucide.createIcons();
  }
  ['history-all-search','history-status-filter','history-type-filter','history-alumni-filter'].forEach(id=>{const el=$('#'+id);if(el)el.addEventListener(el.tagName==='INPUT'?'input':'change',renderHistoryAll)});
  $$('.manager-period-btn').forEach(b=>b.addEventListener('click',()=>{managerPeriod=b.dataset.managerPeriod||'all';renderManagerPeriod()}));

  function parseGoogleId(value='', kind='file'){
    const v=String(value||'').trim(); if(!v) return '';
    if(kind==='presentation'){const m=v.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/); if(m)return m[1];}
    if(kind==='folder'){const m=v.match(/\/folders\/([a-zA-Z0-9_-]+)/); if(m)return m[1];}
    return /^[a-zA-Z0-9_-]{15,}$/.test(v)?v:'';
  }
  function slidesUrl(id){return id?`https://docs.google.com/presentation/d/${id}/edit`:''}
  function folderUrl(id){return id?`https://drive.google.com/drive/folders/${id}`:''}
  function formatTagAmount(value){return new Intl.NumberFormat('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value||0))}
  function defaultGoogleScriptUrl(){return String(window.SCHOOL_APP_CONFIG?.DONATION_GOOGLE_APPS_SCRIPT_URL||'').trim()}
  function googleScriptUrl(){return String(settings?.google_apps_script_url||defaultGoogleScriptUrl()||'').trim()}
  function nikornTemplateId(){return String(settings?.nikorn_google_slides_template_id||'1aj3h3pMB-Ulz1SuldI-ckBlddfralVwF7sfx0x65cNE').trim()}
  function nikornFolderId(){return String(settings?.nikorn_google_drive_folder_id||'1H_PEfawTOnn7LM4Pi6CSWJ6CYVnTo-iF').trim()}
  function nikornFallbackPhoto(){return String(settings?.nikorn_fallback_photo_url||'https://i.postimg.cc/Kz6vK8gM/Screenshot-2026-10-04-181000.png').trim()}
  function refreshReviewCertificateUI(x){
    if(!x)return;
    const hasNo=!!x.certificate_no, hasPdf=!!x.certificate_pdf_url, hasImage=!!x.certificate_image_url, hasNikorn=!!x.nikorn_image_url;
    $('#review-cert-box').classList.toggle('hidden',!hasNo);
    $('#review-cert-no').textContent=x.certificate_no||'';
    const link=$('#review-open-pdf'); link.classList.toggle('hidden',!hasPdf); if(hasPdf)link.href=x.certificate_pdf_url; else link.removeAttribute('href');
    const imageLink=$('#review-open-image'); if(imageLink){ imageLink.classList.toggle('hidden',!hasImage); if(hasImage) imageLink.href=x.certificate_image_url; else imageLink.removeAttribute('href'); }
    const nikornLink=$('#review-open-nikorn-image'); if(nikornLink){ nikornLink.classList.toggle('hidden',!hasNikorn); if(hasNikorn) nikornLink.href=nikornOpenUrl(x); else nikornLink.removeAttribute('href'); }
    const gen=$('#review-generate-pdf');
    const genNikorn=$('#review-generate-nikorn');
    const generationStatus=String(x.certificate_generation_status||'');
    const nikornStatusText=String(x.nikorn_generation_status||'');
    const showRetry=hasNo && (!hasPdf || !hasImage) && generationStatus!=='generating';
    gen.classList.toggle('hidden',!showRetry);
    if(genNikorn) genNikorn.classList.toggle('hidden',!hasNo || nikornStatusText==='generating');
    const certText=generationStatus==='ready'?(hasPdf&&hasImage?'สร้าง PDF และภาพใบอนุโมทนาบัตรแล้ว':hasPdf?'สร้าง PDF แล้ว และกำลังรอภาพใบอนุโมทนาบัตร':'สร้างข้อมูลใบแล้ว'):(generationStatus==='generating'?'กำลังสร้างใบอนุโมทนาบัตรอัตโนมัติ...':generationStatus==='error'?'สร้างใบอัตโนมัติไม่สำเร็จ — สามารถลองสร้างอีกครั้งได้':hasNo?'กำลังเตรียมสร้างไฟล์ใบอนุโมทนาบัตรอัตโนมัติ':'');
    const nikornText=nikornStatusText==='ready'?(hasNikorn?'สร้างภาพ พม.นิกรแล้ว':'สร้างข้อมูลภาพแล้ว'):nikornStatusText==='generating'?'กำลังสร้างภาพ พม.นิกรอัตโนมัติ...':nikornStatusText==='error'?'ภาพ พม.นิกรยังไม่สำเร็จ — สามารถลองใหม่ได้':hasNo?'ยังไม่ได้สร้างภาพ พม.นิกร':'';
    $('#review-cert-generation').textContent=[certText,nikornText].filter(Boolean).join(' • ');
    gen.textContent=(hasPdf||hasImage)?'สร้างใบใหม่จาก Google Slides':'สร้างใบจาก Google Slides';
    if(genNikorn) genNikorn.textContent=hasNikorn?'สร้างภาพ พม.นิกรใหม่':'สร้างภาพ พม.นิกร';
  }
  async function callGoogleSlidesBridge(action,payload={}){
    const url=googleScriptUrl(); if(!url)throw new Error('ยังไม่ได้ตั้งค่า Google Apps Script Web App URL');
    const {data:{session}}=await db.auth.getSession(); const token=session?.access_token; if(!token)throw new Error('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
    const requestId=crypto.randomUUID();
    return await new Promise((resolve,reject)=>{
      const iframe=document.createElement('iframe'); iframe.name='gas_'+requestId.replaceAll('-',''); iframe.style.display='none'; document.body.appendChild(iframe);
      const form=document.createElement('form'); form.method='POST'; form.action=url; form.target=iframe.name; form.style.display='none'; document.body.appendChild(form);
      const fields={action,request_id:requestId,access_token:token,callback_origin:location.origin,template_id:settings?.google_slides_template_id||'',folder_id:settings?.google_drive_folder_id||'',...payload};
      Object.entries(fields).forEach(([k,v])=>{const i=document.createElement('input');i.type='hidden';i.name=k;i.value=String(v??'');form.appendChild(i)});
      let timer;
      const cleanup=()=>{clearTimeout(timer);window.removeEventListener('message',onMessage);form.remove();setTimeout(()=>iframe.remove(),100)};
      const trustedGoogleOrigin=(origin)=>{try{const u=new URL(origin);return u.protocol==='https:'&&(u.hostname==='script.google.com'||u.hostname==='script.googleusercontent.com'||u.hostname.endsWith('.googleusercontent.com'));}catch(_){return false}};
      const onMessage=(ev)=>{if(!trustedGoogleOrigin(ev.origin))return;const m=ev.data;if(!m||m.source!=='wnw-donation-google-slides'||m.request_id!==requestId)return;cleanup();m.ok?resolve(m.data||{}):reject(new Error(m.error||'Google Slides ทำงานไม่สำเร็จ'))};
      window.addEventListener('message',onMessage);
      timer=setTimeout(()=>{cleanup();reject(new Error('Google Apps Script ใช้เวลานานเกินไป กรุณาลองอีกครั้ง'))},120000);
      form.submit();
    });
  }
  async function generateNikornImage(x){
    if(!x?.certificate_no)throw new Error('รายการนี้ยังไม่มีเลขใบอนุโมทนาบัตร');
    try{await db.from('donations').update({nikorn_generation_status:'generating',nikorn_generation_error:''}).eq('id',x.id)}catch(_){ }
    try{
      const result=await callGoogleSlidesBridge('generate_promo',{
        template_id:nikornTemplateId(),
        folder_id:nikornFolderId(),
        donor_name:x.certificate_name_override||x.display_name,
        donation_amount:formatTagAmount(x.amount),
        certificate_no:x.certificate_no,
        request_no:x.request_no,
        photo_url:x.photo_url||'',
        fallback_photo_url:nikornFallbackPhoto()
      });
      if(!result.image_url)throw new Error('Google Apps Script ไม่ได้ส่งลิงก์ภาพกลับมา');
      if(result.public_sharing===false)throw new Error('สร้างภาพแล้ว แต่ Google Drive ไม่อนุญาตให้แชร์แบบทุกคนที่มีลิงก์');
      const patch={nikorn_image_url:result.image_url||'',nikorn_image_drive_file_id:result.image_file_id||'',nikorn_generated_at:new Date().toISOString(),nikorn_generation_status:'ready',nikorn_generation_error:''};
      const {data,error}=await db.from('donations').update(patch).eq('id',x.id).select('*').single(); if(error)throw error;
      const idx=rows.findIndex(r=>r.id===x.id);if(idx>=0)rows[idx]=data;
      return data;
    }catch(err){
      try{await db.from('donations').update({nikorn_generation_status:'error',nikorn_generation_error:String(err.message||err).slice(0,1000)}).eq('id',x.id)}catch(_){ }
      throw err;
    }
  }


  async function deleteOldGeneratedFiles(oldFiles, newRow){
    const warnings=[];
    const tasks=[];

    const tryDelete=(fileId, folderId, label)=>{
      if(!fileId)return;
      const newIds=new Set([
        String(newRow?.certificate_drive_file_id||''),
        String(newRow?.certificate_image_drive_file_id||''),
        String(newRow?.nikorn_image_drive_file_id||'')
      ].filter(Boolean));
      if(newIds.has(String(fileId)))return;

      tasks.push((async()=>{
        try{
          await callGoogleSlidesBridge('delete_certificate',{file_id:fileId,folder_id:folderId});
        }catch(err){
          warnings.push(`${label}: ${err.message||err}`);
        }
      })());
    };

    tryDelete(oldFiles.certificate_drive_file_id, settings?.google_drive_folder_id||'', 'ลบ PDF เก่าไม่สำเร็จ');
    tryDelete(oldFiles.certificate_image_drive_file_id, settings?.google_drive_folder_id||'', 'ลบภาพใบเก่าไม่สำเร็จ');
    tryDelete(oldFiles.nikorn_image_drive_file_id, nikornFolderId(), 'ลบภาพ พม.นิกรเก่าไม่สำเร็จ');

    if(tasks.length)await Promise.allSettled(tasks);
    return warnings;
  }

  function reviewEditPayload(){
    const displayName=$('#review-display-name').value.trim();
    const isAlumni=$('#review-is-alumni').value==='true';
    const alumniBatch=$('#review-alumni-batch').value.trim();
    if(!displayName)throw new Error('กรุณาระบุชื่อผู้บริจาค');

    return {
      display_name:displayName,
      certificate_name_override:$('#review-cert-name').value.trim(),
      is_alumni:isAlumni,
      alumni_batch:isAlumni?alumniBatch:'',
      amount:Number($('#review-amount').value),
      transfer_date:$('#review-date').value,
      transfer_time:$('#review-time').value,
      photo_url:$('#review-photo-url').value.trim(),
      admin_note:$('#review-note').value.trim()
    };
  }

  async function regenerateAfterEdit(oldRow, savedRow){
    if(savedRow.status!=='verified' || !savedRow.certificate_no)return {row:savedRow,warnings:[]};

    const oldFiles={
      certificate_drive_file_id:oldRow.certificate_drive_file_id||'',
      certificate_image_drive_file_id:oldRow.certificate_image_drive_file_id||'',
      nikorn_image_drive_file_id:oldRow.nikorn_image_drive_file_id||''
    };

    modalStatus('บันทึกข้อมูลแล้ว กำลังสร้างใบอนุโมทนาบัตรชุดใหม่...',true);

    let latest=await generateGoogleCertificate(savedRow);
    modalStatus('สร้างใบอนุโมทนาบัตรใหม่แล้ว กำลังสร้างภาพ พม.นิกรใหม่...',true);
    latest=await generateNikornImage(latest);

    const warnings=await deleteOldGeneratedFiles(oldFiles,latest);
    return {row:latest,warnings};
  }

  async function generateGoogleCertificate(x){
    if(!x?.certificate_no)throw new Error('รายการนี้ยังไม่มีเลขใบอนุโมทนาบัตร');
    try{await db.from('donations').update({certificate_generation_status:'generating',certificate_generation_error:''}).eq('id',x.id)}catch(_){ }
    try{
      const verifyBase=String(settings?.verify_base_url||`${location.origin}/donation/verify/?no=`);const verifyUrl=verifyBase+encodeURIComponent(x.certificate_no);const result=await callGoogleSlidesBridge('generate',{donation_id:x.id,donor_name:x.certificate_name_override||x.display_name,donation_amount:formatTagAmount(x.amount),certificate_no:x.certificate_no,verify_url:verifyUrl});
      if(!result.pdf_url)throw new Error('Google Apps Script ไม่ได้ส่งลิงก์ PDF กลับมา');
      if(result.public_sharing===false)throw new Error('สร้าง PDF แล้ว แต่ Google Drive ไม่อนุญาตให้แชร์แบบทุกคนที่มีลิงก์ กรุณาตรวจนโยบายการแชร์ของโฟลเดอร์');
      const patch={certificate_pdf_url:result.pdf_url,certificate_drive_file_id:result.file_id||'',certificate_image_url:result.image_url||'',certificate_image_drive_file_id:result.image_file_id||'',certificate_generated_at:new Date().toISOString(),certificate_generation_status:'ready',certificate_generation_error:result.image_error?String(result.image_error).slice(0,1000):''};
      const {data,error}=await db.from('donations').update(patch).eq('id',x.id).select('*').single(); if(error)throw error;
      const idx=rows.findIndex(r=>r.id===x.id);if(idx>=0)rows[idx]=data;
      return data;
    }catch(err){
      try{await db.from('donations').update({certificate_generation_status:'error',certificate_generation_error:String(err.message||err).slice(0,1000)}).eq('id',x.id)}catch(_){ }
      throw err;
    }
  }
  async function openReview(id){
    currentReviewId=id;const x=rows.find(r=>r.id===id);if(!x)return;
    $('#review-title').textContent=x.request_no;$('#review-display-name').value=x.display_name||'';$('#review-is-alumni').value=x.is_alumni?'true':'false';$('#review-alumni-batch').value=x.alumni_batch||'';$('#review-alumni-batch').disabled=!x.is_alumni;$('#review-cert-name').value=x.certificate_name_override||'';$('#review-amount').value=x.amount;$('#review-date').value=x.transfer_date||'';$('#review-time').value=String(x.transfer_time||'').slice(0,5);$('#review-note').value=x.admin_note||'';$('#review-photo-url').value=x.photo_url||'';$('#review-status').classList.add('hidden');reviewPhotoStatus(x.photo_url?'พบรูปผู้บริจาคแล้ว สามารถสร้างภาพ พม.นิกรได้':'ยังไม่มีรูปผู้บริจาค — ผู้ดูแลสามารถวางลิงก์หรืออัปโหลดรูปแทนได้');updateReviewPhotoPreview(x.photo_url||'');const f=$('#review-photo-file');if(f)f.value='';const saveBtn=$('#review-save');if(saveBtn)saveBtn.textContent=(x.status==='verified'&&x.certificate_no)?'บันทึก • สร้างใบและภาพใหม่':'บันทึกข้อมูลที่แก้ไข';
    const address=[x.address_line,x.subdistrict&&`ต.${x.subdistrict}`,x.district&&`อ.${x.district}`,x.province&&`จ.${x.province}`,x.postal_code].filter(Boolean).join(' ');
    $('#review-donor').innerHTML=`<div class="flex flex-col sm:flex-row gap-4"><div>${avatarHtml(x,'w-24 h-24')}</div><div class="grid sm:grid-cols-2 gap-x-5 gap-y-3 flex-1"><div><span class="text-slate-400 text-xs">ชื่อผู้บริจาค</span><p class="font-bold mt-0.5">${esc(x.display_name)}</p>${x.is_alumni?`<p class="mt-1 text-xs font-bold text-fuchsia-700">ศิษย์เก่า${x.alumni_batch?' รุ่น '+esc(x.alumni_batch):''}</p>`:''}</div><div><span class="text-slate-400 text-xs">ร่วมบุญในนาม</span><p class="font-bold mt-0.5">${esc(({person:'บุคคล',family:'ครอบครัว',shop:'ร้านค้า',company:'บริษัท',alumni_group:'คณะศิษย์เก่า',host_group:'คณะเจ้าภาพ'})[x.giving_as_type]||'บุคคล')}</p></div><div><span class="text-slate-400 text-xs">โครงการ / งาน</span><p class="font-bold mt-0.5">${esc(x.campaign_name||'-')} ${x.campaign_prefix?`<span class="text-orange-600">(${esc(x.campaign_prefix)})</span>`:''}</p></div>${x.temple_name?`<div><span class="text-slate-400 text-xs">วัด</span><p class="font-bold mt-0.5">${esc(x.temple_name)}</p></div>`:''}${x.organization?`<div><span class="text-slate-400 text-xs">หน่วยงาน</span><p class="font-bold mt-0.5">${esc(x.organization)}</p></div>`:''}<div><span class="text-slate-400 text-xs">ติดต่อ</span><p class="font-bold mt-0.5">${esc(x.phone||x.email||'-')}</p></div><div><span class="text-slate-400 text-xs">ที่อยู่</span><p class="font-bold mt-0.5">${esc(address||'-')}</p></div>${x.photo_url?`<div class="sm:col-span-2"><span class="text-slate-400 text-xs">ลิงก์รูปภาพ</span><p class="mt-0.5"><a href="${esc(x.photo_url)}" target="_blank" rel="noopener" class="font-bold text-orange-600 break-all">เปิดรูปต้นฉบับ ↗</a></p></div>`:''}${x.donor_note?`<div class="sm:col-span-2"><span class="text-slate-400 text-xs">หมายเหตุผู้บริจาค</span><p class="font-bold mt-0.5">${esc(x.donor_note)}</p></div>`:''}</div></div>`;
    refreshReviewCertificateUI(x);
    $('#review-approve').classList.toggle('hidden',x.status==='verified');
    $('#review-reject').classList.toggle('hidden',x.status==='verified');
    $('#review-modal').classList.remove('hidden');document.body.style.overflow='hidden';
    const view=$('#slip-view');view.innerHTML='<span class="text-slate-400">กำลังโหลดสลิป...</span>';$('#slip-open').removeAttribute('href');
    try{const bucket=window.SCHOOL_APP_CONFIG?.DONATION_SLIP_BUCKET||'donation-slips';const {data,error}=await db.storage.from(bucket).createSignedUrl(x.slip_path,600);if(error)throw error;const url=data.signedUrl;$('#slip-open').href=url;if(/\.pdf(?:$|\?)/i.test(x.slip_path))view.innerHTML=`<iframe src="${url}" class="w-full h-[620px] border-0"></iframe>`;else view.innerHTML=`<img src="${url}" class="max-w-full max-h-[720px] object-contain" alt="สลิป">`;}catch(err){view.innerHTML=`<div class="p-5 text-rose-600">โหลดสลิปไม่สำเร็จ: ${esc(err.message||err)}</div>`}
    lucide.createIcons();
  }
  function closeReview(){currentReviewId=null;$('#review-modal').classList.add('hidden');document.body.style.overflow=''}
  $('#review-close').onclick=closeReview;$('#review-modal').addEventListener('click',e=>{if(e.target===$('#review-modal'))closeReview()});

  async function saveReview(showMessage=true){
    const x=rows.find(r=>r.id===currentReviewId);if(!x)return null;
    const oldRow={...x};
    const payload=reviewEditPayload();
    if(!payload.amount||payload.amount<=0)throw new Error('จำนวนเงินไม่ถูกต้อง');

    const {data,error}=await db.from('donations').update(payload).eq('id',x.id).select('*').single();
    if(error)throw error;

    const idx=rows.findIndex(r=>r.id===x.id);if(idx>=0)rows[idx]=data;
    if(showMessage)modalStatus('บันทึกข้อมูลแล้ว',true);
    renderDashboard();renderDonationList();renderHistoryAll();
    return {oldRow,savedRow:data};
  }

  $('#review-save').onclick=async()=>{
    const btn=$('#review-save');const original=btn.textContent;btn.disabled=true;btn.textContent='กำลังบันทึก...';
    try{
      const result=await saveReview(false);if(!result)return;
      let latest=result.savedRow;

      if(latest.status==='verified'&&latest.certificate_no){
        btn.textContent='กำลังสร้างไฟล์ใหม่...';
        const regen=await regenerateAfterEdit(result.oldRow,latest);
        latest=regen.row;
        refreshReviewCertificateUI(latest);
        renderDashboard();renderDonationList();renderHistoryAll();renderNikornList();

        const warn=regen.warnings.length?` แต่มีไฟล์เก่าบางรายการลบไม่สำเร็จ: ${regen.warnings.join(' | ')}`:'';
        modalStatus('บันทึกข้อมูล สร้างใบอนุโมทนาบัตรใหม่ และสร้างภาพ พม.นิกรใหม่เรียบร้อยแล้ว'+warn,true);
      }else{
        modalStatus('บันทึกข้อมูลที่แก้ไขแล้ว',true);
        openReview(latest.id);
      }
    }catch(err){
      modalStatus('บันทึก/สร้างไฟล์ใหม่ไม่สำเร็จ: '+(err.message||err));
    }finally{
      btn.disabled=false;
      const now=rows.find(r=>r.id===currentReviewId);
      btn.textContent=(now?.status==='verified'&&now?.certificate_no)?'บันทึก • สร้างใบและภาพใหม่':'บันทึกข้อมูลที่แก้ไข';
    }
  };
  $('#review-is-alumni')?.addEventListener('change',e=>{const on=e.target.value==='true';$('#review-alumni-batch').disabled=!on;if(!on)$('#review-alumni-batch').value=''});
  $('#review-photo-url')?.addEventListener('input',e=>{updateReviewPhotoPreview(e.target.value.trim())});
  $('#review-photo-remove')?.addEventListener('click',()=>{$('#review-photo-url').value='';updateReviewPhotoPreview('');reviewPhotoStatus('ลบลิงก์รูปออกแล้ว กรุณากดบันทึก หรือกดยืนยันรายการเพื่อบันทึก',true)});
  $('#review-photo-file')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{reviewPhotoStatus('กำลังอัปโหลดรูปผู้บริจาค...');const url=await uploadAsset(file,'donor-photos');$('#review-photo-url').value=url;updateReviewPhotoPreview(url);reviewPhotoStatus('อัปโหลดรูปแล้ว กรุณากดบันทึก หรือกดยืนยันรายการเพื่อใช้รูปนี้',true)}catch(err){reviewPhotoStatus('อัปโหลดรูปไม่สำเร็จ: '+(err.message||err))}finally{e.target.value=''}});
  $('#review-approve').onclick=async()=>{
    if(!currentReviewId||!confirm('ยืนยันว่าตรวจสอบสลิปถูกต้อง? ระบบจะยืนยันรายการ ออกเลขใบ และสร้าง PDF จาก Google Slides ให้อัตโนมัติทันที'))return;
    const btn=$('#review-approve');btn.disabled=true;btn.textContent='กำลังยืนยันและสร้างใบ...';
    try{
      await saveReview(false);
      const {error}=await db.rpc('approve_donation_v2',{p_id:currentReviewId});if(error)throw error;
      await loadAll(); let x=rows.find(r=>r.id===currentReviewId);
      if(x){
        refreshReviewCertificateUI(x);$('#review-approve').classList.add('hidden');$('#review-reject').classList.add('hidden');
        modalStatus('ตรวจสอบผ่านแล้ว กำลังสร้าง PDF และภาพใบอนุโมทนาบัตรจาก Google Slides อัตโนมัติ...',true);
        try{x=await generateGoogleCertificate(x);try{x=await generateNikornImage(x)}catch(nikErr){console.warn(nikErr)}refreshReviewCertificateUI(x);renderDashboard();renderDonationList();renderNikornList();modalStatus('ตรวจสอบ สร้างใบอนุโมทนาบัตร และสร้างภาพ พม.นิกรเรียบร้อยแล้ว',true)}
        catch(genErr){refreshReviewCertificateUI(rows.find(r=>r.id===currentReviewId)||x);modalStatus('ออกเลขใบเรียบร้อยแล้ว แต่การสร้างไฟล์อัตโนมัติบางส่วนไม่สำเร็จ: '+(genErr.message||genErr))}
      }
    }catch(err){modalStatus('อนุมัติไม่สำเร็จ: '+(err.message||err))}finally{btn.disabled=false;btn.textContent='ตรวจสอบแล้ว • ยืนยันและสร้างใบ'}
  };
  $('#review-reject').onclick=async()=>{
    if(!currentReviewId||!confirm('ยืนยันว่าไม่อนุมัติรายการนี้?'))return;
    try{const {error}=await db.rpc('reject_donation',{p_id:currentReviewId,p_note:$('#review-note').value.trim()});if(error)throw error;await loadAll();modalStatus('เปลี่ยนสถานะเป็นไม่อนุมัติแล้ว',true);setTimeout(closeReview,700)}catch(err){modalStatus('ดำเนินการไม่สำเร็จ: '+(err.message||err))}
  };
  $('#review-generate-pdf').onclick=async()=>{
    const x=rows.find(r=>r.id===currentReviewId);if(!x?.certificate_no)return;
    const btn=$('#review-generate-pdf');btn.disabled=true;btn.textContent='กำลังสร้างใบ...';
    try{const updated=await generateGoogleCertificate(x);refreshReviewCertificateUI(updated);renderDashboard();renderDonationList();modalStatus('สร้าง PDF และภาพใบอนุโมทนาบัตรจาก Google Slides แล้ว',true)}catch(err){modalStatus('สร้างใบไม่สำเร็จ: '+(err.message||err))}finally{btn.disabled=false;const now=rows.find(r=>r.id===currentReviewId);btn.textContent=(now?.certificate_pdf_url||now?.certificate_image_url)?'สร้างใบใหม่จาก Google Slides':'สร้างใบจาก Google Slides'}
  };

  $('#review-generate-nikorn').onclick=async()=>{const x=rows.find(r=>r.id===currentReviewId);if(!x?.certificate_no)return;const btn=$('#review-generate-nikorn');btn.disabled=true;btn.textContent='กำลังสร้างภาพ...';try{const updated=await generateNikornImage(x);refreshReviewCertificateUI(updated);renderNikornList();modalStatus('สร้างภาพ พม.นิกรแล้ว',true)}catch(err){modalStatus('สร้างภาพ พม.นิกรไม่สำเร็จ: '+(err.message||err))}finally{btn.disabled=false;const now=rows.find(r=>r.id===currentReviewId);btn.textContent=(now?.nikorn_image_url)?'สร้างภาพ พม.นิกรใหม่':'สร้างภาพ พม.นิกร'}};

  async function deleteDonationRecord(x){
    if(!x)throw new Error('ไม่พบรายการบริจาค');
    const warnings=[];

    // ลบไฟล์ใบอนุโมทนาบัตรที่ระบบสร้างไว้ใน Google Drive แบบ best-effort
    if(x.certificate_drive_file_id){
      try{await callGoogleSlidesBridge('delete_certificate',{file_id:x.certificate_drive_file_id})}
      catch(err){warnings.push('ลบ PDF ใน Google Drive ไม่สำเร็จ: '+(err.message||err))}
    }
    if(x.certificate_image_drive_file_id){
      try{await callGoogleSlidesBridge('delete_certificate',{file_id:x.certificate_image_drive_file_id})}
      catch(err){warnings.push('ลบไฟล์ภาพใน Google Drive ไม่สำเร็จ: '+(err.message||err))}
    }
    if(x.nikorn_image_drive_file_id){
      try{await callGoogleSlidesBridge('delete_certificate',{file_id:x.nikorn_image_drive_file_id})}
      catch(err){warnings.push('ลบไฟล์ภาพ พม.นิกรใน Google Drive ไม่สำเร็จ: '+(err.message||err))}
    }

    // ลบสลิปออกจาก Supabase Storage แบบ best-effort
    if(x.slip_path){
      try{
        const bucket=window.SCHOOL_APP_CONFIG?.DONATION_SLIP_BUCKET||'donation-slips';
        const {error}=await db.storage.from(bucket).remove([x.slip_path]);
        if(error)throw error;
      }catch(err){warnings.push('ลบสลิปไม่สำเร็จ: '+(err.message||err))}
    }

    // ลบรูปผู้บริจาคที่แอดมินอัปโหลดเข้า donation-assets แบบ best-effort
    if(x.photo_url){
      try{
        const u=new URL(x.photo_url);
        const bucket=window.SCHOOL_APP_CONFIG?.DONATION_ASSETS_BUCKET||'donation-assets';
        const marker=`/storage/v1/object/public/${bucket}/`;
        const idx=u.pathname.indexOf(marker);
        if(idx>=0){
          const path=decodeURIComponent(u.pathname.slice(idx+marker.length));
          const {error}=await db.storage.from(bucket).remove([path]);
          if(error)throw error;
        }
      }catch(err){warnings.push('ลบรูปผู้บริจาคไม่สำเร็จ: '+(err.message||err))}
    }

    // ลบ record เป็นขั้นสุดท้าย
    const {error}=await db.from('donations').delete().eq('id',x.id);
    if(error)throw error;
    rows=rows.filter(r=>r.id!==x.id);
    return warnings;
  }

  $('#review-delete').onclick=async()=>{
    const x=rows.find(r=>r.id===currentReviewId);if(!x)return;
    const label=[x.display_name,x.request_no,x.certificate_no].filter(Boolean).join(' • ');
    if(!confirm(`ต้องการลบรายการนี้จริงหรือไม่?\n\n${label}\n\nการลบจะนำรายการออกจากระบบและไม่สามารถกู้คืนจากหน้าเว็บได้`))return;
    const typed=prompt(`ยืนยันอีกครั้ง โดยพิมพ์เลขคำขอ\n${x.request_no}`);
    if(typed===null)return;
    if(String(typed).trim()!==String(x.request_no).trim()){modalStatus('ยกเลิกการลบ: เลขคำขอที่พิมพ์ไม่ตรง');return}
    const btn=$('#review-delete');btn.disabled=true;const old=btn.innerHTML;btn.textContent='กำลังลบ...';
    try{
      const warnings=await deleteDonationRecord(x);
      renderDashboard();renderDonationList();renderHistoryAll();
      closeReview();
      if(warnings.length)alert('ลบรายการออกจากฐานข้อมูลแล้ว แต่มีไฟล์บางส่วนที่ลบไม่สำเร็จ:\n- '+warnings.join('\n- '));
      else alert('ลบรายการบริจาค สลิป และไฟล์ใบอนุโมทนาบัตรที่เกี่ยวข้องแล้ว');
    }catch(err){modalStatus('ลบรายการไม่สำเร็จ: '+(err.message||err))}
    finally{btn.disabled=false;btn.innerHTML=old;lucide.createIcons()}
  };

  function campaignStatus(msg,ok=false){const el=$('#campaign-status');if(!el)return;el.className=`mt-3 rounded-xl p-3 text-sm border ${ok?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-rose-50 text-rose-700 border-rose-200'}`;el.textContent=msg;el.classList.remove('hidden')}
  function renderCampaigns(){
    const box=$('#campaign-list');if(!box)return;
    if(!campaigns.length){box.innerHTML='<div class="rounded-2xl bg-slate-50 p-6 text-center text-slate-400 lg:col-span-2">ยังไม่มีโครงการ / งาน</div>';return}
    box.innerHTML=campaigns.map(c=>`<div class="rounded-2xl border ${c.is_default?'border-orange-200 bg-orange-50/50':'border-slate-200 bg-white'} p-4"><div class="flex items-start justify-between gap-3"><div><div class="flex flex-wrap items-center gap-2"><p class="font-extrabold">${esc(c.name)}</p>${c.is_default?'<span class="text-[10px] px-2 py-0.5 rounded-full bg-orange-500 text-white font-bold">งานหลัก</span>':''}${c.is_active?'<span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold">เปิดรับ</span>':'<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold">ปิดรับ</span>'}</div><p class="text-sm text-slate-500 mt-1">Prefix: <b class="text-slate-900">${esc(c.prefix)}</b> • ตัวอย่าง ${esc(c.prefix)}-2569-000001</p></div><div class="flex flex-wrap justify-end gap-1"><button data-campaign-default="${c.id}" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-50 text-orange-700">${c.is_default?'งานหลัก':'ตั้งเป็นงานหลัก'}</button><button data-campaign-toggle="${c.id}" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">${c.is_active?'ปิดรับ':'เปิดรับ'}</button><button data-campaign-delete="${c.id}" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700">ลบ</button></div></div></div>`).join('');
    $$('[data-campaign-default]').forEach(b=>b.onclick=()=>setDefaultCampaign(b.dataset.campaignDefault));
    $$('[data-campaign-toggle]').forEach(b=>b.onclick=()=>toggleCampaign(b.dataset.campaignToggle));
    $$('[data-campaign-delete]').forEach(b=>b.onclick=()=>deleteCampaign(b.dataset.campaignDelete));
  }
  async function refreshCampaigns(){const {data,error}=await db.from('donation_campaigns').select('*').order('is_default',{ascending:false}).order('sort_order',{ascending:true}).order('created_at',{ascending:true});if(error)throw error;campaigns=data||[];renderCampaigns();renderDashboard()}
  async function setDefaultCampaign(id){try{const {error:e1}=await db.from('donation_campaigns').update({is_default:false,updated_at:new Date().toISOString()}).neq('id','00000000-0000-0000-0000-000000000000');if(e1)throw e1;const {error:e2}=await db.from('donation_campaigns').update({is_default:true,is_active:true,updated_at:new Date().toISOString()}).eq('id',id);if(e2)throw e2;await refreshCampaigns();campaignStatus('ตั้งเป็นงานหลักแล้ว',true)}catch(err){campaignStatus('ตั้งงานหลักไม่สำเร็จ: '+(err.message||err))}}
  async function toggleCampaign(id){const c=campaigns.find(x=>x.id===id);if(!c)return;try{const {error}=await db.from('donation_campaigns').update({is_active:!c.is_active,updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error;await refreshCampaigns();campaignStatus('อัปเดตสถานะงานแล้ว',true)}catch(err){campaignStatus('อัปเดตไม่สำเร็จ: '+(err.message||err))}}
  async function deleteCampaign(id){const c=campaigns.find(x=>x.id===id);if(!c||!confirm(`ลบงาน “${c.name}” หรือไม่? รายการบริจาคเก่าจะยังเก็บชื่อ/Prefix เดิมไว้`))return;try{const {error}=await db.from('donation_campaigns').delete().eq('id',id);if(error)throw error;await refreshCampaigns();campaignStatus('ลบงานแล้ว',true)}catch(err){campaignStatus('ลบงานไม่สำเร็จ: '+(err.message||err))}}
  $('#campaign-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;const name=f.elements.name.value.trim();const prefix=f.elements.prefix.value.trim().toUpperCase().replace(/[^A-Z0-9-]/g,'');if(!name||prefix.length<2)return campaignStatus('กรุณาระบุชื่อโครงการและ Prefix อย่างน้อย 2 ตัวอักษร');try{const {error}=await db.from('donation_campaigns').insert({name,prefix,is_active:true,is_default:campaigns.length===0,sort_order:campaigns.length});if(error)throw error;f.reset();await refreshCampaigns();campaignStatus('เพิ่มโครงการ / งานแล้ว',true)}catch(err){campaignStatus('เพิ่มงานไม่สำเร็จ: '+(err.message||err))}});

  function fillSettingsForm(){
    const f=$('#settings-form');['campaign_title','campaign_description','bank_name','bank_account_name','bank_account_no','promptpay','donation_note','banner_url','qr_image_url'].forEach(k=>{if(f.elements[k])f.elements[k].value=settings?.[k]||''});f.elements.is_open.checked=!!settings?.is_open;previewSettingImages();$('#cert-prefix').value=settings?.certificate_prefix||'WNW-DN';
  }
  function previewSettingImages(){const b=$('#banner-preview'),q=$('#qr-preview');const bu=$('#settings-form').elements.banner_url.value.trim(),qu=$('#settings-form').elements.qr_image_url.value.trim();if(bu){b.src=bu;b.classList.remove('hidden');b.onerror=()=>b.classList.add('hidden')}else b.classList.add('hidden');if(qu){q.src=qu;q.classList.remove('hidden');q.onerror=()=>q.classList.add('hidden')}else q.classList.add('hidden')}
  $('#settings-form').elements.banner_url.addEventListener('input',previewSettingImages);$('#settings-form').elements.qr_image_url.addEventListener('input',previewSettingImages);
  $('#banner-clear').onclick=()=>{$('#settings-form').elements.banner_url.value='';previewSettingImages()};
  async function uploadAsset(file,folder){
    if(!file)return '';if(file.size>20*1024*1024)throw new Error('ไฟล์ต้องมีขนาดไม่เกิน 20 MB');const ext=(file.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'');const path=`${folder}/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.${ext}`;const bucket=window.SCHOOL_APP_CONFIG?.DONATION_ASSETS_BUCKET||'donation-assets';const {error}=await db.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type||undefined});if(error)throw error;return db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }
  $('#banner-file').addEventListener('change',async e=>{try{const url=await uploadAsset(e.target.files?.[0],'banners');if(url){$('#settings-form').elements.banner_url.value=url;previewSettingImages();settingsStatus('อัปโหลด Banner แล้ว กรุณากดบันทึกการตั้งค่า',true)}}catch(err){settingsStatus(err.message||err)}e.target.value=''});
  $('#qr-file').addEventListener('change',async e=>{try{const url=await uploadAsset(e.target.files?.[0],'qr');if(url){$('#settings-form').elements.qr_image_url.value=url;previewSettingImages();settingsStatus('อัปโหลด QR Code แล้ว กรุณากดบันทึกการตั้งค่า',true)}}catch(err){settingsStatus(err.message||err)}e.target.value=''});
  $('#settings-form').addEventListener('submit',async e=>{
    e.preventDefault();const f=e.currentTarget;try{const {data:{user}}=await db.auth.getUser();const payload={id:1,campaign_title:f.elements.campaign_title.value.trim(),campaign_description:f.elements.campaign_description.value.trim(),banner_url:f.elements.banner_url.value.trim(),bank_name:f.elements.bank_name.value.trim(),bank_account_name:f.elements.bank_account_name.value.trim(),bank_account_no:f.elements.bank_account_no.value.trim(),promptpay:f.elements.promptpay.value.trim(),qr_image_url:f.elements.qr_image_url.value.trim(),donation_note:f.elements.donation_note.value.trim(),is_open:f.elements.is_open.checked,updated_at:new Date().toISOString(),updated_by:user?.id||null};const {data,error}=await db.from('donation_settings').update(payload).eq('id',1).select('*').single();if(error)throw error;settings={...settings,...data};settingsStatus('บันทึกการตั้งค่าหน้าบริจาคแล้ว',true);renderDashboard()}catch(err){settingsStatus('บันทึกไม่สำเร็จ: '+(err.message||err))}
  });

  function renderGoogleCertificateSettings(){
    $('#cert-prefix').value=settings?.certificate_prefix||'WNW-DN';
    $('#google-template-url').value=slidesUrl(settings?.google_slides_template_id||'1N0OEEhnCdfqn5ohtZa47pUfenVYizdePtXo9vGsVGy4');
    $('#google-folder-url').value=folderUrl(settings?.google_drive_folder_id||'1JUTSXLLdR7X5KiV6KINe6Nk85DS-YdYk');
    $('#google-script-url').value=googleScriptUrl();
    const tid=parseGoogleId($('#google-template-url').value,'presentation'),fid=parseGoogleId($('#google-folder-url').value,'folder');
    $('#open-google-template').href=slidesUrl(tid)||'#';$('#open-google-folder').href=folderUrl(fid)||'#';
  }
  function setTagResult(id,count){const box=$(id),txt=box.querySelector('.tag-result');const ok=Number(count)>0;box.className=`rounded-2xl border p-4 ${ok?'border-emerald-200 bg-emerald-50':'border-rose-200 bg-rose-50'}`;txt.className=`tag-result mt-2 text-xs font-bold ${ok?'text-emerald-700':'text-rose-700'}`;txt.textContent=ok?`พบ ${count} จุด`:'ไม่พบ Tag';}
  async function saveGoogleCertificateSettings(showSuccess=true){
    const templateId=parseGoogleId($('#google-template-url').value,'presentation'),folderId=parseGoogleId($('#google-folder-url').value,'folder'),scriptUrl=$('#google-script-url').value.trim(),prefix=$('#cert-prefix').value.trim()||'WNW-DN';
    if(!templateId)throw new Error('ลิงก์ Google Slides Template ไม่ถูกต้อง');if(!folderId)throw new Error('ลิงก์โฟลเดอร์ Google Drive ไม่ถูกต้อง');
    if(scriptUrl&&!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/.test(scriptUrl))throw new Error('Google Apps Script URL ต้องเป็นลิงก์ Web App ที่ลงท้าย /exec');
    const payload={certificate_provider:'google_slides',certificate_prefix:prefix,google_slides_template_id:templateId,google_drive_folder_id:folderId,google_apps_script_url:scriptUrl,updated_at:new Date().toISOString()};
    const {data,error}=await db.from('donation_settings').update(payload).eq('id',1).select('*').single();if(error)throw error;settings={...settings,...data};renderGoogleCertificateSettings();renderDashboard();if(showSuccess)certStatus('บันทึก Google Slides Template และโฟลเดอร์แล้ว',true);return data;
  }
  $('#save-google-cert-settings').onclick=async()=>{try{await saveGoogleCertificateSettings(true)}catch(err){certStatus('บันทึกไม่สำเร็จ: '+(err.message||err))}};
  $('#validate-google-template').onclick=async()=>{
    const btn=$('#validate-google-template');btn.disabled=true;btn.textContent='กำลังตรวจ Template...';
    try{
      await saveGoogleCertificateSettings(false);
      if(!googleScriptUrl())throw new Error('ยังไม่มี Google Apps Script Web App URL');
      const r=await callGoogleSlidesBridge('validate');const c=r.tags||{};setTagResult('#tag-donor-status',c.donor_name||0);setTagResult('#tag-amount-status',c.donation_amount||0);setTagResult('#tag-number-status',c.certificate_no||0);setTagResult('#tag-qr-status',c.verify_qr||0);
      if((c.donor_name||0)<1||(c.donation_amount||0)<1||(c.certificate_no||0)<1||(c.verify_qr||0)<1)throw new Error('Template ยังมี Tag ไม่ครบ 4 รายการ');
      certStatus('ตรวจสอบแล้ว: พบ Tag ครบทั้งชื่อ จำนวนเงิน เลขใบ และ QR ตรวจสอบ พร้อมสร้าง PDF',true);
    }catch(err){certStatus('ตรวจ Template ไม่สำเร็จ: '+(err.message||err))}finally{btn.disabled=false;btn.textContent='ตรวจ 4 Tag ใน Slides'}
  };

  function renderNikornSettings(){
    const inputTemplate=$('#nikorn-template-url'),inputFolder=$('#nikorn-folder-url'),inputFallback=$('#nikorn-fallback-photo');
    if(!inputTemplate)return;
    inputTemplate.value=slidesUrl(nikornTemplateId());
    inputFolder.value=folderUrl(nikornFolderId());
    inputFallback.value=nikornFallbackPhoto();
    const tid=parseGoogleId(inputTemplate.value,'presentation'),fid=parseGoogleId(inputFolder.value,'folder');
    $('#open-nikorn-template').href=slidesUrl(tid)||'#'; $('#open-nikorn-folder').href=folderUrl(fid)||'#';
    renderNikornList();
  }
  async function saveNikornSettings(showSuccess=true){
    const templateId=parseGoogleId($('#nikorn-template-url').value,'presentation'),folderId=parseGoogleId($('#nikorn-folder-url').value,'folder'),fallbackPhoto=$('#nikorn-fallback-photo').value.trim();
    if(!templateId)throw new Error('ลิงก์ Google Slides Template ภาพไม่ถูกต้อง');
    if(!folderId)throw new Error('ลิงก์โฟลเดอร์ Google Drive สำหรับภาพไม่ถูกต้อง');
    if(fallbackPhoto && !/^https?:\/\//i.test(fallbackPhoto)) throw new Error('ลิงก์รูปสำรองต้องขึ้นต้นด้วย http หรือ https');
    const payload={nikorn_enabled:true,nikorn_google_slides_template_id:templateId,nikorn_google_drive_folder_id:folderId,nikorn_fallback_photo_url:fallbackPhoto,updated_at:new Date().toISOString()};
    const {data,error}=await db.from('donation_settings').update(payload).eq('id',1).select('*').single();if(error)throw error;settings={...settings,...data};renderNikornSettings();if(showSuccess)nikornStatus('บันทึกการเชื่อมต่อระบบของพม.นิกรแล้ว',true);return data;
  }
  function nikornCard(x){
    const image=x.nikorn_image_url?`<img src="${esc(nikornDisplayUrl(x))}" class="w-full aspect-[5/7] object-contain rounded-2xl border border-slate-100 bg-slate-50" alt="${esc(x.display_name)}" loading="lazy">`:`<div class="w-full h-44 rounded-2xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 text-sm">ยังไม่มีภาพ</div>`;
    const st=String(x.nikorn_generation_status||'not_generated');
    const label=st==='ready'?'พร้อมใช้':st==='generating'?'กำลังสร้าง':st==='error'?'ผิดพลาด':'ยังไม่สร้าง';
    const badge=st==='ready'?'bg-emerald-50 text-emerald-700 border-emerald-200':st==='generating'?'bg-amber-50 text-amber-700 border-amber-200':st==='error'?'bg-rose-50 text-rose-700 border-rose-200':'bg-slate-50 text-slate-600 border-slate-200';
    return `<article class="rounded-[1.4rem] border border-slate-200 bg-white p-4"><div class="flex items-start justify-between gap-3"><label class="inline-flex items-center gap-2 text-sm font-bold"><input type="checkbox" class="nikorn-check rounded" value="${x.id}"> เลือก</label><span class="text-[11px] px-2 py-0.5 rounded-full border ${badge}">${label}</span></div><div class="mt-3">${image}</div><div class="mt-3"><p class="font-extrabold text-slate-800 line-clamp-2">${esc(x.certificate_name_override||x.display_name||'-')}</p><p class="text-sm text-orange-700 font-bold mt-1">${C.formatTHB(x.amount)}</p><p class="text-xs text-slate-400 mt-1">${esc(x.certificate_no||x.request_no||'-')}</p></div><div class="mt-4 flex flex-wrap gap-2"><button type="button" class="nikorn-generate-one px-3 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold" data-id="${x.id}">สร้างภาพ</button>${x.nikorn_image_url?`<a href="${esc(nikornOpenUrl(x))}" target="_blank" rel="noopener" class="px-3 py-2 rounded-xl bg-fuchsia-600 text-white text-xs font-bold">เปิดภาพ</a><a href="${esc(nikornDownloadUrl(x))}" target="_blank" rel="noopener" class="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold">ดาวน์โหลด</a>`:''}</div>${x.nikorn_generation_error?`<p class="mt-2 text-xs text-rose-600">${esc(x.nikorn_generation_error)}</p>`:''}</article>`;
  }
  function renderNikornList(){
    const box=$('#nikorn-list'); if(!box) return;
    const verified=rows.filter(x=>x.status==='verified').sort((a,b)=>new Date(b.verified_at||b.updated_at)-new Date(a.verified_at||a.updated_at));
    if(!verified.length){box.innerHTML='<div class="rounded-2xl bg-slate-50 p-8 text-center text-slate-400">ยังไม่มีรายการที่ยืนยันแล้ว</div>'; return;}
    box.innerHTML=verified.map(nikornCard).join('');
    $$('.nikorn-generate-one').forEach(btn=>btn.onclick=async()=>{const x=rows.find(r=>r.id===btn.dataset.id); if(!x)return; const old=btn.textContent; btn.disabled=true; btn.textContent='กำลังสร้าง...'; try{await generateNikornImage(x); renderNikornList(); renderDashboard(); const current=rows.find(r=>r.id===currentReviewId); if(current) refreshReviewCertificateUI(current); nikornStatus('สร้างภาพผู้บริจาคแล้ว',true)}catch(err){nikornStatus('สร้างภาพไม่สำเร็จ: '+(err.message||err))} finally{btn.disabled=false; btn.textContent=old}});
  }
  function selectedNikornRows(){ const ids=$$('.nikorn-check:checked').map(i=>i.value); return rows.filter(r=>ids.includes(r.id) && r.status==='verified'); }
  $('#save-nikorn-settings').onclick=async()=>{try{await saveNikornSettings(true)}catch(err){nikornStatus('บันทึกไม่สำเร็จ: '+(err.message||err))}};
  $('#validate-nikorn-template').onclick=async()=>{
    const btn=$('#validate-nikorn-template');btn.disabled=true;btn.textContent='กำลังตรวจ Template...';
    try{await saveNikornSettings(false);const r=await callGoogleSlidesBridge('validate_promo',{template_id:nikornTemplateId(),folder_id:nikornFolderId()});const c=r.tags||{};setTagResult('#nikorn-tag-donor-status',c.donor_name||0);setTagResult('#nikorn-tag-amount-status',c.donation_amount||0);setTagResult('#nikorn-tag-photo-status',c.photo||0);if((c.donor_name||0)<1||(c.donation_amount||0)<1||(c.photo||0)<1)throw new Error('Template ยังมี Tag ไม่ครบ 3 รายการ');nikornStatus('ตรวจเทมเพลตภาพเรียบร้อยแล้ว พร้อมสร้างภาพผู้บริจาค',true)}catch(err){nikornStatus('ตรวจ Template ไม่สำเร็จ: '+(err.message||err))}finally{btn.disabled=false;btn.textContent='ตรวจ Tag ของเทมเพลต'}
  };
  $('#nikorn-select-all').onclick=()=>{$$('.nikorn-check').forEach(i=>i.checked=true)};
  $('#nikorn-refresh-list').onclick=()=>renderNikornList();
  $('#nikorn-generate-selected').onclick=async()=>{const list=selectedNikornRows();if(!list.length){nikornStatus('กรุณาเลือกรายการก่อน');return;}let done=0,fail=0;for(const item of list){try{await generateNikornImage(item);done++;}catch(_){fail++;}}renderNikornList();renderDashboard();nikornStatus(`สร้างภาพเสร็จ ${done} รายการ${fail?` / ไม่สำเร็จ ${fail} รายการ`:''}`,done>0&&fail===0)};
  $('#nikorn-download-selected').onclick=()=>{const list=selectedNikornRows().filter(x=>x.nikorn_image_url);if(!list.length){nikornStatus('ยังไม่มีภาพในรายการที่เลือก');return;}list.forEach((item,idx)=>setTimeout(()=>{const a=document.createElement('a');a.href=nikornDownloadUrl(item);a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();},idx*250));nikornStatus(`กำลังเปิดลิงก์ดาวน์โหลด ${list.length} ภาพ`,true)};

  const views={dashboard:'ภาพรวม',donations:'รายการบริจาค',history:'ประวัติรายการย้อนหลัง',settings:'ตั้งค่าหน้าบริจาค',certificate:'ใบอนุโมทนาบัตร',nikorn:'ระบบของพม.นิกร'};
  function goView(view){$$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===view));Object.keys(views).forEach(v=>$(`#panel-${v}`).classList.toggle('hidden',v!==view));$('#page-title').textContent=views[view];if(view==='certificate')renderGoogleCertificateSettings();if(view==='nikorn')renderNikornSettings();lucide.createIcons()}
  $$('.nav-btn').forEach(b=>b.onclick=()=>goView(b.dataset.view));$$('[data-go]').forEach(b=>b.onclick=()=>goView(b.dataset.go));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeReview()});

  ensureAuth();lucide.createIcons();
})();
