(() => {
  const C = window.DonationCommon;
  const db = C.db;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  let rows = [];
  let settings = null;
  let currentReviewId = null;

  function esc(v){return C.escapeHtml(v)}
  function normalize(v){return String(v||'').toLowerCase().replace(/\s+/g,' ').trim()}
  function modalStatus(msg, ok=false){const el=$('#review-status');el.className=`rounded-xl p-3 text-sm border ${ok?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-rose-50 text-rose-700 border-rose-200'}`;el.textContent=msg;el.classList.remove('hidden')}
  function certStatus(msg,ok=false){const el=$('#cert-status');el.className=`rounded-xl p-3 text-sm border ${ok?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-rose-50 text-rose-700 border-rose-200'}`;el.textContent=msg;el.classList.remove('hidden')}
  function settingsStatus(msg,ok=false){const el=$('#settings-status');el.className=`rounded-xl p-3 text-sm border ${ok?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-rose-50 text-rose-700 border-rose-200'}`;el.textContent=msg;el.classList.remove('hidden')}

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
    renderDashboard();renderDonationList();fillSettingsForm();renderGoogleCertificateSettings();
  }

  function renderDashboard(){
    const pending=rows.filter(x=>x.status==='pending'),verified=rows.filter(x=>x.status==='verified');
    $('#d-pending').textContent=pending.length.toLocaleString('th-TH');$('#d-verified').textContent=verified.length.toLocaleString('th-TH');
    $('#d-amount').textContent=C.formatTHB(verified.reduce((s,x)=>s+Number(x.amount||0),0));$('#d-certs').textContent=verified.filter(x=>x.certificate_no).length.toLocaleString('th-TH');
    $('#d-open').textContent=settings?.is_open?'เปิด':'ปิด';$('#d-open').className=settings?.is_open?'text-emerald-600':'text-rose-600';
    $('#d-banner').textContent=settings?.banner_url?'ตั้งค่าแล้ว':'ยังไม่มี';$('#d-template').textContent=settings?.google_slides_template_id?'Google Slides':'รอ Template';$('#d-prefix').textContent=settings?.certificate_prefix||'WNW-DN';
    const latest=rows.slice(0,6),box=$('#dashboard-latest');
    box.innerHTML=latest.length?latest.map(x=>{const st=C.normalizeStatus(x.status);return `<button data-review="${x.id}" class="w-full text-left flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 hover:border-orange-200"><div class="w-10 h-10 rounded-xl ${x.donor_type==='monastic'?'bg-amber-50 text-amber-700':'bg-orange-50 text-orange-600'} flex items-center justify-center"><i data-lucide="${x.donor_type==='monastic'?'landmark':'user'}" class="w-4 h-4"></i></div><div class="min-w-0 flex-1"><p class="font-bold truncate">${esc(x.display_name)}</p><p class="text-xs text-slate-400 mt-0.5">${esc(x.request_no)} • ${C.formatDateTH(x.transfer_date)}</p></div><div class="text-right"><p class="font-extrabold text-orange-700">${C.formatTHB(x.amount)}</p><span class="text-[10px] border px-2 py-0.5 rounded-full ${st.classes}">${st.label}</span></div></button>`}).join(''):'<div class="rounded-2xl bg-slate-50 p-7 text-center text-slate-400">ยังไม่มีรายการ</div>';
    bindReviewButtons();lucide.createIcons();
  }

  function renderDonationList(){
    const q=normalize($('#donation-search')?.value),filter=$('#status-filter')?.value||'';
    const arr=rows.filter(x=>(!filter||x.status===filter)&&(!q||normalize([x.display_name,x.request_no,x.certificate_no,x.temple_name,x.organization,x.phone,x.email].join(' ')).includes(q)));
    const box=$('#donation-list');
    if(!arr.length){box.innerHTML='<div class="glass rounded-2xl p-10 text-center text-slate-400">ไม่พบรายการที่ตรงกับตัวกรอง</div>';return}
    box.innerHTML=arr.map(x=>{const st=C.normalizeStatus(x.status);return `<article class="glass rounded-2xl p-4 sm:p-5"><div class="flex flex-col lg:flex-row lg:items-center gap-4"><div class="flex items-start gap-3 min-w-0 flex-1"><div class="w-11 h-11 rounded-xl ${x.donor_type==='monastic'?'bg-amber-50 text-amber-700':'bg-orange-50 text-orange-600'} flex items-center justify-center shrink-0"><i data-lucide="${x.donor_type==='monastic'?'landmark':'user'}" class="w-5 h-5"></i></div><div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><h3 class="font-extrabold truncate">${esc(x.display_name)}</h3><span class="text-[10px] border px-2 py-0.5 rounded-full ${st.classes}">${st.label}</span></div><p class="text-xs text-slate-400 mt-1">${esc(x.request_no)} • ${C.formatDateTH(x.transfer_date)} ${String(x.transfer_time||'').slice(0,5)} น.${x.temple_name?' • '+esc(x.temple_name):''}</p>${x.certificate_no?`<p class="text-xs text-emerald-700 font-bold mt-1">${esc(x.certificate_no)}</p>`:''}</div></div><div class="flex items-center justify-between lg:justify-end gap-3"><p class="text-xl font-extrabold text-orange-700">${C.formatTHB(x.amount)}</p><button data-review="${x.id}" class="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold">ตรวจสอบ</button></div></div></article>`}).join('');
    bindReviewButtons();lucide.createIcons();
  }
  function bindReviewButtons(){$$('[data-review]').forEach(b=>b.onclick=()=>openReview(b.dataset.review))}
  $('#donation-search').addEventListener('input',renderDonationList);$('#status-filter').addEventListener('change',renderDonationList);

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
  function refreshReviewCertificateUI(x){
    if(!x)return;
    const hasNo=!!x.certificate_no, hasPdf=!!x.certificate_pdf_url;
    $('#review-cert-box').classList.toggle('hidden',!hasNo);
    $('#review-cert-no').textContent=x.certificate_no||'';
    const link=$('#review-open-pdf'); link.classList.toggle('hidden',!hasPdf); if(hasPdf)link.href=x.certificate_pdf_url; else link.removeAttribute('href');
    const gen=$('#review-generate-pdf'); gen.classList.toggle('hidden',!hasNo);
    const text=x.certificate_generation_status==='ready'?'สร้าง PDF จาก Google Slides แล้ว':x.certificate_generation_status==='generating'?'กำลังสร้าง PDF...':x.certificate_generation_status==='error'?'สร้าง PDF ไม่สำเร็จ — กดสร้างใบอีกครั้งได้':hasNo?'ยังไม่ได้สร้างไฟล์ PDF':'';
    $('#review-cert-generation').textContent=text;
    gen.textContent=hasPdf?'สร้างใบใหม่จาก Google Slides':'สร้างใบจาก Google Slides';
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
      const onMessage=(ev)=>{if(ev.origin&&!/^https:\/\/(?:script\.google\.com|script\.googleusercontent\.com)$/i.test(ev.origin))return;const m=ev.data;if(!m||m.source!=='wnw-donation-google-slides'||m.request_id!==requestId)return;cleanup();m.ok?resolve(m.data||{}):reject(new Error(m.error||'Google Slides ทำงานไม่สำเร็จ'))};
      window.addEventListener('message',onMessage);
      timer=setTimeout(()=>{cleanup();reject(new Error('Google Apps Script ใช้เวลานานเกินไป กรุณาลองอีกครั้ง'))},90000);
      form.submit();
    });
  }
  async function generateGoogleCertificate(x){
    if(!x?.certificate_no)throw new Error('รายการนี้ยังไม่มีเลขใบอนุโมทนาบัตร');
    try{await db.from('donations').update({certificate_generation_status:'generating',certificate_generation_error:''}).eq('id',x.id)}catch(_){ }
    try{
      const result=await callGoogleSlidesBridge('generate',{donation_id:x.id,donor_name:x.certificate_name_override||x.display_name,donation_amount:formatTagAmount(x.amount),certificate_no:x.certificate_no});
      if(!result.pdf_url)throw new Error('Google Apps Script ไม่ได้ส่งลิงก์ PDF กลับมา');
      if(result.public_sharing===false)throw new Error('สร้าง PDF แล้ว แต่ Google Drive ไม่อนุญาตให้แชร์แบบทุกคนที่มีลิงก์ กรุณาตรวจนโยบายการแชร์ของโฟลเดอร์');
      const patch={certificate_pdf_url:result.pdf_url,certificate_drive_file_id:result.file_id||'',certificate_generated_at:new Date().toISOString(),certificate_generation_status:'ready',certificate_generation_error:''};
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
    $('#review-title').textContent=x.request_no;$('#review-cert-name').value=x.certificate_name_override||'';$('#review-amount').value=x.amount;$('#review-date').value=x.transfer_date||'';$('#review-time').value=String(x.transfer_time||'').slice(0,5);$('#review-note').value=x.admin_note||'';$('#review-status').classList.add('hidden');
    const address=[x.address_line,x.subdistrict&&`ต.${x.subdistrict}`,x.district&&`อ.${x.district}`,x.province&&`จ.${x.province}`,x.postal_code].filter(Boolean).join(' ');
    $('#review-donor').innerHTML=`<div class="grid sm:grid-cols-2 gap-x-5 gap-y-3"><div><span class="text-slate-400 text-xs">ชื่อผู้บริจาค</span><p class="font-bold mt-0.5">${esc(x.display_name)}</p></div><div><span class="text-slate-400 text-xs">ประเภท</span><p class="font-bold mt-0.5">${x.donor_type==='monastic'?'พระสงฆ์ / สามเณร':'ฆราวาส'}</p></div>${x.temple_name?`<div><span class="text-slate-400 text-xs">วัด</span><p class="font-bold mt-0.5">${esc(x.temple_name)}</p></div>`:''}${x.organization?`<div><span class="text-slate-400 text-xs">หน่วยงาน</span><p class="font-bold mt-0.5">${esc(x.organization)}</p></div>`:''}<div><span class="text-slate-400 text-xs">ติดต่อ</span><p class="font-bold mt-0.5">${esc(x.phone||x.email||'-')}</p></div><div><span class="text-slate-400 text-xs">ที่อยู่</span><p class="font-bold mt-0.5">${esc(address||'-')}</p></div>${x.donor_note?`<div class="sm:col-span-2"><span class="text-slate-400 text-xs">หมายเหตุผู้บริจาค</span><p class="font-bold mt-0.5">${esc(x.donor_note)}</p></div>`:''}</div>`;
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
    const payload={certificate_name_override:$('#review-cert-name').value.trim(),amount:Number($('#review-amount').value),transfer_date:$('#review-date').value,transfer_time:$('#review-time').value,admin_note:$('#review-note').value.trim()};
    if(!payload.amount||payload.amount<=0)throw new Error('จำนวนเงินไม่ถูกต้อง');
    const {data,error}=await db.from('donations').update(payload).eq('id',x.id).select('*').single();if(error)throw error;
    const idx=rows.findIndex(r=>r.id===x.id);if(idx>=0)rows[idx]=data;if(showMessage)modalStatus('บันทึกข้อมูลแล้ว',true);renderDashboard();renderDonationList();return data;
  }
  $('#review-save').onclick=async()=>{try{await saveReview(true)}catch(err){modalStatus('บันทึกไม่สำเร็จ: '+(err.message||err))}};
  $('#review-approve').onclick=async()=>{
    if(!currentReviewId||!confirm('ยืนยันว่าตรวจสอบสลิปถูกต้อง และออกเลขใบอนุโมทนาบัตรให้รายการนี้?'))return;
    const btn=$('#review-approve');btn.disabled=true;btn.textContent='กำลังออกเลขใบ...';
    try{
      await saveReview(false);
      const {error}=await db.rpc('approve_donation',{p_id:currentReviewId});if(error)throw error;
      await loadAll(); let x=rows.find(r=>r.id===currentReviewId);
      if(x){
        refreshReviewCertificateUI(x);$('#review-approve').classList.add('hidden');$('#review-reject').classList.add('hidden');
        modalStatus('ออกเลขใบแล้ว กำลังสร้าง PDF จาก Google Slides...',true);
        try{x=await generateGoogleCertificate(x);refreshReviewCertificateUI(x);renderDashboard();renderDonationList();modalStatus('ยืนยันรายการ ออกเลขใบ และสร้าง PDF เรียบร้อยแล้ว',true)}
        catch(genErr){refreshReviewCertificateUI(rows.find(r=>r.id===currentReviewId)||x);modalStatus('ออกเลขใบเรียบร้อยแล้ว แต่ยังสร้าง PDF ไม่สำเร็จ: '+(genErr.message||genErr))}
      }
    }catch(err){modalStatus('อนุมัติไม่สำเร็จ: '+(err.message||err))}finally{btn.disabled=false;btn.textContent='ยืนยันและออกเลขใบ'}
  };
  $('#review-reject').onclick=async()=>{
    if(!currentReviewId||!confirm('ยืนยันว่าไม่อนุมัติรายการนี้?'))return;
    try{const {error}=await db.rpc('reject_donation',{p_id:currentReviewId,p_note:$('#review-note').value.trim()});if(error)throw error;await loadAll();modalStatus('เปลี่ยนสถานะเป็นไม่อนุมัติแล้ว',true);setTimeout(closeReview,700)}catch(err){modalStatus('ดำเนินการไม่สำเร็จ: '+(err.message||err))}
  };
  $('#review-generate-pdf').onclick=async()=>{
    const x=rows.find(r=>r.id===currentReviewId);if(!x?.certificate_no)return;
    const btn=$('#review-generate-pdf');btn.disabled=true;btn.textContent='กำลังสร้าง PDF...';
    try{const updated=await generateGoogleCertificate(x);refreshReviewCertificateUI(updated);renderDashboard();renderDonationList();modalStatus('สร้างใบอนุโมทนาบัตรจาก Google Slides แล้ว',true)}catch(err){modalStatus('สร้างใบไม่สำเร็จ: '+(err.message||err))}finally{btn.disabled=false;const now=rows.find(r=>r.id===currentReviewId);btn.textContent=now?.certificate_pdf_url?'สร้างใบใหม่จาก Google Slides':'สร้างใบจาก Google Slides'}
  };

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
      const r=await callGoogleSlidesBridge('validate');const c=r.tags||{};setTagResult('#tag-donor-status',c.donor_name||0);setTagResult('#tag-amount-status',c.donation_amount||0);setTagResult('#tag-number-status',c.certificate_no||0);
      if((c.donor_name||0)<1||(c.donation_amount||0)<1||(c.certificate_no||0)<1)throw new Error('Template ยังมี Tag ไม่ครบ 3 รายการ');
      certStatus('ตรวจสอบแล้ว: พบ Tag ครบทั้งชื่อ จำนวนเงิน และเลขใบ พร้อมสร้าง PDF',true);
    }catch(err){certStatus('ตรวจ Template ไม่สำเร็จ: '+(err.message||err))}finally{btn.disabled=false;btn.textContent='ตรวจ 3 Tag ใน Slides'}
  };

  const views={dashboard:'ภาพรวม',donations:'รายการบริจาค',settings:'ตั้งค่าหน้าบริจาค',certificate:'ใบอนุโมทนาบัตร'};
  function goView(view){$$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===view));Object.keys(views).forEach(v=>$(`#panel-${v}`).classList.toggle('hidden',v!==view));$('#page-title').textContent=views[view];if(view==='certificate')renderGoogleCertificateSettings();lucide.createIcons()}
  $$('.nav-btn').forEach(b=>b.onclick=()=>goView(b.dataset.view));$$('[data-go]').forEach(b=>b.onclick=()=>goView(b.dataset.go));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeReview()});

  ensureAuth();lucide.createIcons();
})();
