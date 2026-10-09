(() => {
  const C = window.DonationCommon;
  const db = C.db;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  let rows = [];
  let settings = null;
  let currentReviewId = null;
  let selectedLayoutField = 'name';
  let layout = {};
  let baseTemplateCanvas = null;

  const defaultLayout = () => ({
    name:{x:50,y:43,fontSize:3.0,align:'center',maxWidth:82},
    amount:{x:50,y:52,fontSize:2.7,align:'center',maxWidth:75},
    certificate_no:{x:82,y:13,fontSize:1.55,align:'center',maxWidth:30}
  });
  const fieldLabels = {name:'ชื่อผู้บริจาค',amount:'จำนวนเงิน',certificate_no:'เลขใบอนุโมทนาบัตร'};

  function esc(v){return C.escapeHtml(v)}
  function normalize(v){return String(v||'').toLowerCase().replace(/\s+/g,' ').trim()}
  function modalStatus(msg, ok=false){const el=$('#review-status');el.className=`rounded-xl p-3 text-sm border ${ok?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-rose-50 text-rose-700 border-rose-200'}`;el.textContent=msg;el.classList.remove('hidden')}
  function certStatus(msg,ok=false){const el=$('#cert-status');el.className=`rounded-xl p-3 text-sm border ${ok?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-rose-50 text-rose-700 border-rose-200'}`;el.textContent=msg;el.classList.remove('hidden')}
  function settingsStatus(msg,ok=false){const el=$('#settings-status');el.className=`rounded-xl p-3 text-sm border ${ok?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-rose-50 text-rose-700 border-rose-200'}`;el.textContent=msg;el.classList.remove('hidden')}
  function nikornSettingsStatus(msg,ok=false){const el=$('#nikorn-settings-status');if(!el)return;el.className=`rounded-xl p-3 text-sm border ${ok?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-rose-50 text-rose-700 border-rose-200'}`;el.textContent=msg;el.classList.remove('hidden')}

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
    const [setRes,donRes]=await Promise.all([
      db.from('donation_settings').select('*').eq('id',1).maybeSingle(),
      db.from('donations').select('*').eq('submission_state','submitted').order('submitted_at',{ascending:false}).limit(1000)
    ]);
    if(setRes.error) throw setRes.error;if(donRes.error)throw donRes.error;
    settings=setRes.data||{};rows=donRes.data||[];
    layout=structuredClone(settings.certificate_layout||defaultLayout());
    renderDashboard();renderDonationList();fillSettingsForm();renderNikornPanel();await renderTemplateEditor();
  }

  function renderDashboard(){
    const pending=rows.filter(x=>x.status==='pending'),verified=rows.filter(x=>x.status==='verified');
    $('#d-pending').textContent=pending.length.toLocaleString('th-TH');$('#d-verified').textContent=verified.length.toLocaleString('th-TH');
    $('#d-amount').textContent=C.formatTHB(verified.reduce((s,x)=>s+Number(x.amount||0),0));$('#d-certs').textContent=verified.filter(x=>x.certificate_no).length.toLocaleString('th-TH');
    $('#d-open').textContent=settings?.is_open?'เปิด':'ปิด';$('#d-open').className=settings?.is_open?'text-emerald-600':'text-rose-600';
    $('#d-banner').textContent=settings?.banner_url?'ตั้งค่าแล้ว':'ยังไม่มี';$('#d-template').textContent=settings?.certificate_template_url?'ตั้งค่าแล้ว':'รอ Template';$('#d-prefix').textContent=settings?.certificate_prefix||'WNW-DN';
    const latest=rows.slice(0,6),box=$('#dashboard-latest');
    box.innerHTML=latest.length?latest.map(x=>{const st=C.normalizeStatus(x.status);return `<button data-review="${x.id}" class="w-full text-left flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 hover:border-orange-200"><div class="w-10 h-10 rounded-xl ${x.donor_type==='monastic'?'bg-amber-50 text-amber-700':'bg-orange-50 text-orange-600'} flex items-center justify-center"><i data-lucide="${x.donor_type==='monastic'?'landmark':'user'}" class="w-4 h-4"></i></div><div class="min-w-0 flex-1"><p class="font-bold truncate">${esc(x.display_name)}</p><p class="text-xs text-slate-400 mt-0.5">${esc(x.request_no)} • ${C.formatDateTH(x.transfer_date)}</p></div><div class="text-right"><p class="font-extrabold text-orange-700">${C.formatTHB(x.amount)}</p><span class="text-[10px] border px-2 py-0.5 rounded-full ${st.classes}">${st.label}</span></div></button>`}).join(''):'<div class="rounded-2xl bg-slate-50 p-7 text-center text-slate-400">ยังไม่มีรายการ</div>';
    bindReviewButtons();lucide.createIcons();
  }

  function renderDonationList(){
    const q=normalize($('#donation-search')?.value),filter=$('#status-filter')?.value||'';
    const arr=rows.filter(x=>(!filter||x.status===filter)&&(!q||normalize([x.display_name,x.request_no,x.certificate_no,x.temple_name,x.organization,x.phone,x.email].join(' ')).includes(q)));
    const box=$('#donation-list');
    if(!arr.length){box.innerHTML='<div class="glass rounded-2xl p-10 text-center text-slate-400">ไม่พบรายการที่ตรงกับตัวกรอง</div>';return}
    box.innerHTML=arr.map(x=>{const st=C.normalizeStatus(x.status);return `<article class="glass rounded-2xl p-4 sm:p-5"><div class="flex flex-col lg:flex-row lg:items-center gap-4"><div class="flex items-start gap-3 min-w-0 flex-1"><div class="w-11 h-11 rounded-xl ${x.donor_type==='monastic'?'bg-amber-50 text-amber-700':'bg-orange-50 text-orange-600'} flex items-center justify-center shrink-0"><i data-lucide="${x.donor_type==='monastic'?'landmark':'user'}" class="w-5 h-5"></i></div><div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><h3 class="font-extrabold truncate">${esc(x.display_name)}</h3><span class="text-[10px] border px-2 py-0.5 rounded-full ${st.classes}">${st.label}</span></div><p class="text-xs text-slate-400 mt-1">${esc(x.request_no)} • ${C.formatDateTH(x.transfer_date)} ${String(x.transfer_time||'').slice(0,5)} น.${x.temple_name?' • '+esc(x.temple_name):''}</p>${x.certificate_no?`<p class="text-xs text-emerald-700 font-bold mt-1">${esc(x.certificate_no)}</p>`:''}${x.nikorn_generation_status?`<p class="text-[11px] mt-1 ${x.nikorn_generation_status==='ready'?'text-amber-700':x.nikorn_generation_status==='error'?'text-rose-600':'text-slate-400'}">พม. นิกร: ${x.nikorn_generation_status==='ready'?'พร้อม':x.nikorn_generation_status==='generating'?'กำลังสร้าง':x.nikorn_generation_status==='error'?'ผิดพลาด':'รอสร้าง'}</p>`:''}</div></div><div class="flex items-center justify-between lg:justify-end gap-3"><p class="text-xl font-extrabold text-orange-700">${C.formatTHB(x.amount)}</p><button data-review="${x.id}" class="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold">ตรวจสอบ</button></div></div></article>`}).join('');
    bindReviewButtons();lucide.createIcons();
  }
  function bindReviewButtons(){$$('[data-review]').forEach(b=>b.onclick=()=>openReview(b.dataset.review))}
  $('#donation-search').addEventListener('input',renderDonationList);$('#status-filter').addEventListener('change',renderDonationList);

  async function openReview(id){
    currentReviewId=id;const x=rows.find(r=>r.id===id);if(!x)return;
    $('#review-title').textContent=x.request_no;$('#review-cert-name').value=x.certificate_name_override||'';$('#review-amount').value=x.amount;$('#review-date').value=x.transfer_date||'';$('#review-time').value=String(x.transfer_time||'').slice(0,5);$('#review-note').value=x.admin_note||'';$('#review-status').classList.add('hidden');
    const address=[x.address_line,x.subdistrict&&`ต.${x.subdistrict}`,x.district&&`อ.${x.district}`,x.province&&`จ.${x.province}`,x.postal_code].filter(Boolean).join(' ');
    $('#review-donor').innerHTML=`<div class="grid sm:grid-cols-2 gap-x-5 gap-y-3"><div><span class="text-slate-400 text-xs">ชื่อผู้บริจาค</span><p class="font-bold mt-0.5">${esc(x.display_name)}</p></div><div><span class="text-slate-400 text-xs">ประเภท</span><p class="font-bold mt-0.5">${x.donor_type==='monastic'?'พระสงฆ์ / สามเณร':'ฆราวาส'}</p></div>${x.temple_name?`<div><span class="text-slate-400 text-xs">วัด</span><p class="font-bold mt-0.5">${esc(x.temple_name)}</p></div>`:''}${x.organization?`<div><span class="text-slate-400 text-xs">หน่วยงาน</span><p class="font-bold mt-0.5">${esc(x.organization)}</p></div>`:''}<div><span class="text-slate-400 text-xs">ติดต่อ</span><p class="font-bold mt-0.5">${esc(x.phone||x.email||'-')}</p></div><div><span class="text-slate-400 text-xs">ที่อยู่</span><p class="font-bold mt-0.5">${esc(address||'-')}</p></div>${x.donor_note?`<div class="sm:col-span-2"><span class="text-slate-400 text-xs">หมายเหตุผู้บริจาค</span><p class="font-bold mt-0.5">${esc(x.donor_note)}</p></div>`:''}</div>`;
    $('#review-cert-box').classList.toggle('hidden',!x.certificate_no);$('#review-cert-no').textContent=x.certificate_no||'';
    const nb=$('#review-nikorn-box'),ns=$('#review-nikorn-status'),no=$('#review-nikorn-open'),ne=$('#review-nikorn-error'); if(nb){nb.classList.remove('hidden');const st=x.nikorn_generation_status||'not_generated';ns.textContent=st==='ready'?'สร้างภาพเรียบร้อยแล้ว':st==='generating'?'กำลังสร้างภาพ':st==='error'?'สร้างภาพไม่สำเร็จ':'รอระบบสร้างภาพ';if(x.nikorn_image_url){no.href=x.nikorn_image_url;no.classList.remove('hidden')}else{no.removeAttribute('href');no.classList.add('hidden')}if(x.nikorn_generation_error){ne.textContent=x.nikorn_generation_error;ne.classList.remove('hidden')}else ne.classList.add('hidden')}
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
    const payload={certificate_name_override:$('#review-cert-name').value.trim(),amount:Number($('#review-amount').value),transfer_date:$('#review-date').value,transfer_time:$('#review-time').value,admin_note:$('#review-note').value.trim()};
    if(!payload.amount||payload.amount<=0)throw new Error('จำนวนเงินไม่ถูกต้อง');
    const {data,error}=await db.from('donations').update(payload).eq('id',x.id).select('*').single();if(error)throw error;
    const idx=rows.findIndex(r=>r.id===x.id);if(idx>=0)rows[idx]=data;if(showMessage)modalStatus('บันทึกข้อมูลแล้ว',true);renderDashboard();renderDonationList();return data;
  }
  $('#review-save').onclick=async()=>{try{await saveReview(true)}catch(err){modalStatus('บันทึกไม่สำเร็จ: '+(err.message||err))}};
  $('#review-approve').onclick=async()=>{
    if(!currentReviewId||!confirm('ยืนยันว่าตรวจสอบสลิปถูกต้อง และออกเลขใบอนุโมทนาบัตรให้รายการนี้?'))return;
    const btn=$('#review-approve');btn.disabled=true;btn.textContent='กำลังออกเลขใบ...';
    try{await saveReview(false);const {data,error}=await db.rpc('approve_donation',{p_id:currentReviewId});if(error)throw error;await loadAll();const x=rows.find(r=>r.id===currentReviewId);if(x){modalStatus('ยืนยันรายการและออกเลขใบอนุโมทนาบัตรแล้ว',true);$('#review-cert-box').classList.remove('hidden');$('#review-cert-no').textContent=x.certificate_no;$('#review-approve').classList.add('hidden');$('#review-reject').classList.add('hidden')}}catch(err){modalStatus('อนุมัติไม่สำเร็จ: '+(err.message||err))}finally{btn.disabled=false;btn.textContent='ยืนยันและออกเลขใบ'}
  };
  $('#review-reject').onclick=async()=>{
    if(!currentReviewId||!confirm('ยืนยันว่าไม่อนุมัติรายการนี้?'))return;
    try{const {error}=await db.rpc('reject_donation',{p_id:currentReviewId,p_note:$('#review-note').value.trim()});if(error)throw error;await loadAll();modalStatus('เปลี่ยนสถานะเป็นไม่อนุมัติแล้ว',true);setTimeout(closeReview,700)}catch(err){modalStatus('ดำเนินการไม่สำเร็จ: '+(err.message||err))}
  };
  async function downloadReviewCert(type){const x=rows.find(r=>r.id===currentReviewId);if(!x?.certificate_no)return;try{if(!settings?.certificate_template_url)throw new Error('ยังไม่ได้อัปโหลด Template ใบอนุโมทนาบัตร');const data={display_name:x.certificate_name_override||x.display_name,amount:x.amount,certificate_no:x.certificate_no};if(type==='pdf')await C.downloadCertificatePdf(data,settings);else await C.downloadCertificatePng(data,settings)}catch(err){modalStatus(err.message||err)}}
  $('#review-download-pdf').onclick=()=>downloadReviewCert('pdf');$('#review-download-png').onclick=()=>downloadReviewCert('png');

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

  function renderNikornPanel(){
    const f=$('#nikorn-settings-form'); if(!f)return;
    f.elements.nikorn_enabled.checked=settings?.nikorn_enabled !== false;
    f.elements.auto_process_on_submit.checked=settings?.auto_process_on_submit !== false;
    ['nikorn_google_slides_template_id','nikorn_google_drive_folder_id','nikorn_fallback_photo_url'].forEach(k=>{if(f.elements[k])f.elements[k].value=settings?.[k]||''});
    previewNikornFallback();
    const ready=rows.filter(x=>x.nikorn_generation_status==='ready').length, generating=rows.filter(x=>x.nikorn_generation_status==='generating').length, errors=rows.filter(x=>x.nikorn_generation_status==='error').length;
    $('#nikorn-ready-count').textContent=ready.toLocaleString('th-TH');$('#nikorn-generating-count').textContent=generating.toLocaleString('th-TH');$('#nikorn-error-count').textContent=errors.toLocaleString('th-TH');
    const box=$('#nikorn-manager-list');const arr=rows.filter(x=>x.nikorn_generation_status||x.nikorn_image_url).slice(0,10);
    box.innerHTML=arr.length?arr.map(x=>{const st=x.nikorn_generation_status||'not_generated';const label=st==='ready'?'พร้อม':st==='generating'?'กำลังสร้าง':st==='error'?'ผิดพลาด':'รอสร้าง';const cls=st==='ready'?'bg-emerald-50 text-emerald-700':st==='generating'?'bg-amber-50 text-amber-700':st==='error'?'bg-rose-50 text-rose-700':'bg-slate-50 text-slate-600';return `<div class="rounded-2xl border border-slate-100 bg-white p-3 flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center"><i data-lucide="image" class="w-4 h-4"></i></div><div class="min-w-0 flex-1"><p class="font-bold text-sm truncate">${esc(x.display_name)}</p><p class="text-[11px] text-slate-400 mt-0.5">${esc(x.request_no)}</p></div><span class="text-[10px] px-2 py-1 rounded-full font-bold ${cls}">${label}</span>${x.nikorn_image_url?`<a href="${esc(x.nikorn_image_url)}" target="_blank" rel="noopener" class="text-xs font-bold text-orange-600">เปิด ↗</a>`:''}</div>`}).join(''):'<div class="rounded-2xl bg-slate-50 p-7 text-center text-sm text-slate-400">ยังไม่มีสถานะการสร้างภาพ</div>';
    try{lucide.createIcons()}catch(_){}
  }
  function previewNikornFallback(){const f=$('#nikorn-settings-form');if(!f)return;const url=f.elements.nikorn_fallback_photo_url.value.trim(),img=$('#nikorn-fallback-preview'),empty=$('#nikorn-fallback-empty');if(url){img.src=url;img.classList.remove('hidden');empty.classList.add('hidden');img.onerror=()=>{img.classList.add('hidden');empty.classList.remove('hidden')}}else{img.classList.add('hidden');empty.classList.remove('hidden')}}
  $('#nikorn-settings-form')?.elements.nikorn_fallback_photo_url.addEventListener('input',previewNikornFallback);
  $('#nikorn-settings-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;try{const payload={nikorn_enabled:f.elements.nikorn_enabled.checked,auto_process_on_submit:f.elements.auto_process_on_submit.checked,nikorn_google_slides_template_id:f.elements.nikorn_google_slides_template_id.value.trim(),nikorn_google_drive_folder_id:f.elements.nikorn_google_drive_folder_id.value.trim(),nikorn_fallback_photo_url:f.elements.nikorn_fallback_photo_url.value.trim(),updated_at:new Date().toISOString()};const {data,error}=await db.from('donation_settings').update(payload).eq('id',1).select('*').single();if(error)throw error;settings={...settings,...data};renderNikornPanel();nikornSettingsStatus('บันทึกการตั้งค่าระบบภาพ พม. นิกรแล้ว',true)}catch(err){nikornSettingsStatus('บันทึกไม่สำเร็จ: '+(err.message||err))}});
  $('#nikorn-refresh-btn')?.addEventListener('click',()=>loadAll());

  function cloneLayout(){const d=defaultLayout();for(const k of Object.keys(d))d[k]={...d[k],...(layout?.[k]||{})};return d}
  async function renderTemplateEditor(){
    layout=cloneLayout();const canvas=$('#template-canvas'),info=$('#template-info');
    try{baseTemplateCanvas=await C.renderTemplateBase(settings?.certificate_template_url||'',settings?.certificate_template_type||'image',{maxWidth:1800});canvas.width=baseTemplateCanvas.width;canvas.height=baseTemplateCanvas.height;canvas.getContext('2d').drawImage(baseTemplateCanvas,0,0);info.textContent=settings?.certificate_template_url?`Template ปัจจุบัน: ${settings.certificate_template_type?.toUpperCase()||'IMAGE'} • ${canvas.width} × ${canvas.height}px`:'ยังไม่ได้อัปโหลด Template จริง — พื้นหลังนี้เป็นตัวอย่างสำหรับจัดตำแหน่งเบื้องต้น';updateOverlays();selectLayoutField(selectedLayoutField)}catch(err){info.textContent='โหลด Template ไม่สำเร็จ: '+(err.message||err);certStatus(info.textContent)}
  }
  function updateOverlays(){for(const k of Object.keys(defaultLayout())){const el=document.querySelector(`[data-layout-field="${k}"]`),s=layout[k]||{};el.style.left=`${s.x??50}%`;el.style.top=`${s.y??50}%`;el.style.fontSize=`clamp(10px, ${(s.fontSize||2.5)*0.45}vw, 20px)`;el.style.transform=`translate(${s.align==='left'?'0':s.align==='right'?'-100%':'-50%'},-50%)`}}
  function selectLayoutField(key){selectedLayoutField=key;$$('[data-layout-field]').forEach(x=>x.classList.toggle('selected',x.dataset.layoutField===key));const s=layout[key];$('#selected-field-label').textContent=fieldLabels[key];$('#layout-x').value=s.x;$('#layout-y').value=s.y;$('#layout-font').value=s.fontSize;$('#layout-width').value=s.maxWidth;$('#layout-align').value=s.align||'center'}
  $$('[data-layout-field]').forEach(el=>{
    el.addEventListener('pointerdown',e=>{e.preventDefault();selectLayoutField(el.dataset.layoutField);el.setPointerCapture?.(e.pointerId);const move=ev=>{const rect=$('#template-stage').getBoundingClientRect();layout[selectedLayoutField].x=Math.max(0,Math.min(100,(ev.clientX-rect.left)/rect.width*100));layout[selectedLayoutField].y=Math.max(0,Math.min(100,(ev.clientY-rect.top)/rect.height*100));updateOverlays();selectLayoutField(selectedLayoutField)};const up=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up)};el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up)});
    el.addEventListener('click',()=>selectLayoutField(el.dataset.layoutField));
  });
  function controlUpdate(){const s=layout[selectedLayoutField];s.x=Math.max(0,Math.min(100,Number($('#layout-x').value)||0));s.y=Math.max(0,Math.min(100,Number($('#layout-y').value)||0));s.fontSize=Math.max(.5,Math.min(8,Number($('#layout-font').value)||2));s.maxWidth=Math.max(10,Math.min(100,Number($('#layout-width').value)||80));s.align=$('#layout-align').value;updateOverlays()}
  ['#layout-x','#layout-y','#layout-font','#layout-width','#layout-align'].forEach(id=>$(id).addEventListener('input',controlUpdate));
  $('#template-file').addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;try{if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type))throw new Error('รองรับเฉพาะ PNG, JPG, WebP หรือ PDF');certStatus('กำลังอัปโหลด Template...',true);const url=await uploadAsset(file,'certificate-templates');const type=file.type==='application/pdf'?'pdf':'image';const {data,error}=await db.from('donation_settings').update({certificate_template_url:url,certificate_template_type:type,updated_at:new Date().toISOString()}).eq('id',1).select('*').single();if(error)throw error;settings={...settings,...data};await renderTemplateEditor();certStatus('อัปโหลด Template แล้ว ลากตำแหน่ง 3 ฟิลด์และกดบันทึก',true);renderDashboard()}catch(err){certStatus('อัปโหลดไม่สำเร็จ: '+(err.message||err))}finally{e.target.value=''}
  });
  $('#save-layout-btn').onclick=async()=>{try{const prefix=$('#cert-prefix').value.trim()||'WNW-DN';const {data,error}=await db.from('donation_settings').update({certificate_prefix:prefix,certificate_layout:layout,updated_at:new Date().toISOString()}).eq('id',1).select('*').single();if(error)throw error;settings={...settings,...data};certStatus('บันทึกตำแหน่งชื่อ จำนวนเงิน และเลขใบแล้ว',true);renderDashboard()}catch(err){certStatus('บันทึกไม่สำเร็จ: '+(err.message||err))}};
  $('#test-certificate-btn').onclick=async()=>{try{if(!settings?.certificate_template_url)throw new Error('กรุณาอัปโหลด Template จริงก่อนทดสอบ');const test={display_name:'นายสมชาย ใจดี',amount:1500,certificate_no:`${$('#cert-prefix').value.trim()||'WNW-DN'}-${new Date().getFullYear()+543}-000001`};const testSettings={...settings,certificate_layout:layout,certificate_prefix:$('#cert-prefix').value.trim()||'WNW-DN'};await C.downloadCertificatePdf(test,testSettings);certStatus('สร้าง PDF ตัวอย่างแล้ว',true)}catch(err){certStatus(err.message||err)}};

  const views={dashboard:'ภาพรวม',donations:'รายการบริจาค',settings:'ตั้งค่าหน้าบริจาค',certificate:'ใบอนุโมทนาบัตร',nikorn:'ภาพ พม. นิกร'};
  function goView(view){$$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===view));Object.keys(views).forEach(v=>$(`#panel-${v}`).classList.toggle('hidden',v!==view));$('#page-title').textContent=views[view];if(view==='certificate')renderTemplateEditor();lucide.createIcons()}
  $$('.nav-btn').forEach(b=>b.onclick=()=>goView(b.dataset.view));$$('[data-go]').forEach(b=>b.onclick=()=>goView(b.dataset.go));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeReview()});

  ensureAuth();lucide.createIcons();
})();
