(() => {
  const C=window.DonationCommon, db=C.db; let rows=[];
  const input=document.getElementById('history-code'), status=document.getElementById('history-status'), list=document.getElementById('history-list');
  const contactForm=document.getElementById('contact-history-form'),codeForm=document.getElementById('history-form');
  const nameInput=document.getElementById('history-full-name'),phoneInput=document.getElementById('history-phone'),emailInput=document.getElementById('history-email');
  function message(text,ok=false){status.className=`mt-4 rounded-2xl p-4 text-sm border ${ok?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-rose-50 text-rose-700 border-rose-200'}`;status.textContent=text;status.classList.remove('hidden')}
  function normalizePhotoUrl(value=''){
    const raw=String(value||'').trim();if(!raw)return '';
    try{const u=new URL(raw);if(!['http:','https:'].includes(u.protocol))return '';if(/(^|\.)drive\.google\.com$/i.test(u.hostname)){const m=raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)||raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);if(m?.[1])return `https://drive.google.com/thumbnail?id=${encodeURIComponent(m[1])}&sz=w1200`;}return raw}catch(_){return ''}
  }
  function render(){
    document.getElementById('history-summary').classList.toggle('hidden',!rows.length);
    if(!rows.length){list.innerHTML='';return}
    const verified=rows.filter(x=>x.status==='verified');
    document.getElementById('sum-count').textContent=`${rows.length.toLocaleString('th-TH')} รายการ`;
    document.getElementById('sum-amount').textContent=C.formatTHB(verified.reduce((s,x)=>s+Number(x.amount||0),0));
    document.getElementById('sum-certs').textContent=`${verified.filter(x=>x.certificate_no).length.toLocaleString('th-TH')} ใบ`;
    list.innerHTML=rows.map((x)=>{
      const st=C.normalizeStatus(x.status),src=normalizePhotoUrl(x.photo_url);
      const avatar=src?`<img src="${C.escapeHtml(src)}" class="w-20 h-20 rounded-2xl object-cover bg-slate-100 shrink-0" alt="${C.escapeHtml(x.display_name)}" onerror="this.style.display='none'">`:'';
      const alumni=x.is_alumni?`<span class="text-[10px] px-2 py-0.5 rounded-full bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-100 font-bold">ศิษย์เก่า${x.alumni_batch?' รุ่น '+C.escapeHtml(x.alumni_batch):''}</span>`:'';
      const pdf=x.certificate_pdf_url?`<a href="${C.escapeHtml(x.certificate_pdf_url)}" target="_blank" rel="noopener" class="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold inline-flex gap-2 items-center"><i data-lucide="file-down" class="w-4 h-4"></i> ดาวน์โหลด PDF</a>`:'';
      const image=x.certificate_image_url?`<a href="${C.escapeHtml(x.certificate_image_url)}" target="_blank" rel="noopener" class="px-4 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-bold inline-flex gap-2 items-center"><i data-lucide="image" class="w-4 h-4"></i> ดาวน์โหลดภาพ</a>`:'';
      const certAction=(pdf||image)?pdf+image:`<span class="px-4 py-2.5 rounded-xl bg-white border border-amber-200 text-amber-700 text-sm font-bold">${x.certificate_generation_status==='error'?'ใบยังสร้างไม่สำเร็จ กรุณาติดต่อโรงเรียน':'กำลังจัดทำใบอนุโมทนาบัตร'}</span>`;
      return `<article class="glass rounded-[1.8rem] p-5 sm:p-6"><div class="flex gap-4 items-start">${avatar}<div class="min-w-0 flex-1"><div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4"><div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><span class="text-xs border px-2.5 py-1 rounded-full font-bold ${st.classes}">${st.label}</span>${alumni}<span class="text-xs text-slate-400">${C.escapeHtml(x.request_no)}</span></div><h3 class="mt-3 text-lg font-extrabold">${C.escapeHtml(x.display_name)}</h3><p class="mt-1 text-sm text-slate-500">โอนเมื่อ ${C.formatDateTH(x.transfer_date)} เวลา ${String(x.transfer_time||'').slice(0,5)} น.</p></div><p class="text-2xl font-extrabold text-orange-700">${C.formatTHB(x.amount)}</p></div>${x.status==='verified'?`<div class="mt-5 rounded-2xl bg-emerald-50 border border-emerald-100 p-4"><p class="text-xs text-emerald-700">เลขใบอนุโมทนาบัตร</p><p class="font-extrabold text-emerald-900 mt-1 break-all">${C.escapeHtml(x.certificate_no||'-')}</p>${x.certificate_no?`<div class="mt-3 flex flex-wrap gap-2">${certAction}<a href="../verify/?no=${encodeURIComponent(x.certificate_no)}" class="px-4 py-2.5 rounded-xl bg-white border border-emerald-200 text-emerald-700 text-sm font-bold">ตรวจสอบใบ</a></div>`:''}</div>`:''}${x.status==='rejected'?`<div class="mt-4 rounded-2xl bg-rose-50 border border-rose-100 p-4 text-sm text-rose-700"><b>หมายเหตุจากโรงเรียน:</b> ${C.escapeHtml(x.admin_note||'กรุณาติดต่อโรงเรียนเพื่อสอบถามรายละเอียด')}</div>`:''}</div></div></article>`
    }).join('');
    lucide.createIcons();
  }
  function clearResults(){
    rows=[];list.innerHTML='';document.getElementById('history-summary').classList.add('hidden');
  }
  function startLoading(){status.classList.add('hidden');list.innerHTML='<div class="glass rounded-2xl p-7 text-center text-slate-500">กำลังค้นหาประวัติ...</div>';}
  function handleResults(data,successText){
    rows=Array.isArray(data)?data:[];
    if(!rows.length){clearResults();return message('ไม่พบประวัติที่ตรงกับข้อมูล กรุณาตรวจสอบข้อมูลอีกครั้ง');}
    message(successText||`พบประวัติ ${rows.length} รายการ`,true);render();
  }
  async function search(code){
    code=(code||'').trim().toUpperCase();if(!code)return message('กรุณากรอกรหัสประวัติผู้บริจาค');
    if(!db)return message('ยังไม่ได้เชื่อมต่อ Supabase');
    startLoading();
    try{
      let res=await db.rpc('get_donation_history_v2',{p_history_code:code});
      if(res.error && /get_donation_history_v2/i.test(String(res.error.message||'')))res=await db.rpc('get_donation_history',{p_history_code:code});
      if(res.error)throw res.error;
      localStorage.setItem('wnw-donation-history-code',code);
      handleResults(res.data,`พบประวัติ ${Array.isArray(res.data)?res.data.length:0} รายการ`);
    }catch(err){clearResults();message('ค้นหาไม่สำเร็จ: '+(err.message||err))}
  }
  async function searchByContact(){
    const fullName=(nameInput.value||'').trim();
    const phone=(phoneInput.value||'').trim();
    const email=(emailInput.value||'').trim().toLowerCase();
    if(!fullName)return message('กรุณากรอกชื่อ–นามสกุล');
    if(!phone&&!email)return message('กรุณากรอกเบอร์โทรศัพท์หรือ Email อย่างน้อย 1 อย่าง');
    if(phone && phone.replace(/\D/g,'').length<9)return message('กรุณาตรวจสอบเบอร์โทรศัพท์');
    if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return message('รูปแบบ Email ไม่ถูกต้อง');
    if(!db)return message('ยังไม่ได้เชื่อมต่อ Supabase');
    startLoading();
    try{
      const {data,error}=await db.rpc('get_donation_history_by_contact',{p_full_name:fullName,p_phone:phone,p_email:email});
      if(error)throw error;
      handleResults(data,`พบประวัติ ${Array.isArray(data)?data.length:0} รายการจากข้อมูลผู้บริจาค`);
    }catch(err){clearResults();message('ค้นหาไม่สำเร็จ: '+(err.message||err)+(String(err.message||'').includes('get_donation_history_by_contact')?' — กรุณารัน SQL Upgrade V18 ก่อน':''))}
  }
  function setMode(mode){
    const contact=mode==='contact';
    codeForm.classList.toggle('hidden',contact);contactForm.classList.toggle('hidden',!contact);
    document.getElementById('search-tab-code').className=`history-search-tab px-4 py-2.5 rounded-xl text-sm font-extrabold ${contact?'text-orange-700':'bg-orange-500 text-white'}`;
    document.getElementById('search-tab-contact').className=`history-search-tab px-4 py-2.5 rounded-xl text-sm font-extrabold ${contact?'bg-orange-500 text-white':'text-orange-700'}`;
    status.classList.add('hidden');clearResults();
    setTimeout(()=>{(contact?nameInput:input).focus()},50);
  }
  codeForm.addEventListener('submit',e=>{e.preventDefault();search(input.value)});
  contactForm.addEventListener('submit',e=>{e.preventDefault();searchByContact()});
  document.getElementById('search-tab-code').onclick=()=>setMode('code');
  document.getElementById('search-tab-contact').onclick=()=>setMode('contact');
  const saved=localStorage.getItem('wnw-donation-history-code')||'';if(saved){input.value=saved;search(saved)}
  lucide.createIcons();
})();