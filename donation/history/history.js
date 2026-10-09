(() => {
  const C=window.DonationCommon, db=C.db; let rows=[], settings=null;
  const input=document.getElementById('history-code'), status=document.getElementById('history-status'), list=document.getElementById('history-list');
  function message(text,ok=false){status.className=`mt-4 rounded-2xl p-4 text-sm border ${ok?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-rose-50 text-rose-700 border-rose-200'}`;status.textContent=text;status.classList.remove('hidden')}
  function render(){
    document.getElementById('history-summary').classList.toggle('hidden',!rows.length);
    if(!rows.length){list.innerHTML='';return}
    const verified=rows.filter(x=>x.status==='verified');
    document.getElementById('sum-count').textContent=`${rows.length.toLocaleString('th-TH')} รายการ`;
    document.getElementById('sum-amount').textContent=C.formatTHB(verified.reduce((s,x)=>s+Number(x.amount||0),0));
    document.getElementById('sum-certs').textContent=`${verified.filter(x=>x.certificate_no).length.toLocaleString('th-TH')} ใบ`;
    list.innerHTML=rows.map((x,i)=>{const st=C.normalizeStatus(x.status);return `<article class="glass rounded-[1.8rem] p-5 sm:p-6"><div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4"><div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><span class="text-xs border px-2.5 py-1 rounded-full font-bold ${st.classes}">${st.label}</span><span class="text-xs text-slate-400">${C.escapeHtml(x.request_no)}</span></div><h3 class="mt-3 text-lg font-extrabold">${C.escapeHtml(x.display_name)}</h3><p class="mt-1 text-sm text-slate-500">โอนเมื่อ ${C.formatDateTH(x.transfer_date)} เวลา ${String(x.transfer_time||'').slice(0,5)} น.</p></div><p class="text-2xl font-extrabold text-orange-700">${C.formatTHB(x.amount)}</p></div>${x.status==='verified'?`<div class="mt-5 rounded-2xl bg-emerald-50 border border-emerald-100 p-4"><p class="text-xs text-emerald-700">เลขใบอนุโมทนาบัตร</p><p class="font-extrabold text-emerald-900 mt-1 break-all">${C.escapeHtml(x.certificate_no||'-')}</p>${x.certificate_no?`<div class="mt-3 flex flex-wrap gap-2"><button data-pdf="${i}" class="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold inline-flex gap-2 items-center"><i data-lucide="file-down" class="w-4 h-4"></i> PDF</button><button data-png="${i}" class="px-4 py-2.5 rounded-xl bg-white border border-emerald-200 text-emerald-700 text-sm font-bold inline-flex gap-2 items-center"><i data-lucide="image-down" class="w-4 h-4"></i> PNG</button><a href="../verify/?no=${encodeURIComponent(x.certificate_no)}" class="px-4 py-2.5 rounded-xl bg-white border border-emerald-200 text-emerald-700 text-sm font-bold">ตรวจสอบใบ</a></div>`:''}</div>`:''}${x.status==='rejected'?`<div class="mt-4 rounded-2xl bg-rose-50 border border-rose-100 p-4 text-sm text-rose-700"><b>หมายเหตุจากโรงเรียน:</b> ${C.escapeHtml(x.admin_note||'กรุณาติดต่อโรงเรียนเพื่อสอบถามรายละเอียด')}</div>`:''}</article>`}).join('');
    document.querySelectorAll('[data-pdf]').forEach(b=>b.onclick=()=>download(rows[Number(b.dataset.pdf)],'pdf'));
    document.querySelectorAll('[data-png]').forEach(b=>b.onclick=()=>download(rows[Number(b.dataset.png)],'png'));
    lucide.createIcons();
  }
  async function download(row,type){
    try{settings=settings||await C.loadDonationSettings();if(!settings?.certificate_template_url)throw new Error('โรงเรียนยังไม่ได้อัปโหลด Template ใบอนุโมทนาบัตร');if(type==='pdf')await C.downloadCertificatePdf({display_name:row.display_name,amount:row.amount,certificate_no:row.certificate_no},settings);else await C.downloadCertificatePng({display_name:row.display_name,amount:row.amount,certificate_no:row.certificate_no},settings);}catch(err){alert(err.message||err)}
  }
  async function search(code){
    code=(code||'').trim().toUpperCase();if(!code)return message('กรุณากรอกรหัสประวัติผู้บริจาค');
    if(!db)return message('ยังไม่ได้เชื่อมต่อ Supabase');
    status.classList.add('hidden');list.innerHTML='<div class="glass rounded-2xl p-7 text-center text-slate-500">กำลังค้นหาประวัติ...</div>';
    try{const {data,error}=await db.rpc('get_donation_history',{p_history_code:code});if(error)throw error;rows=data||[];if(!rows.length){list.innerHTML='';document.getElementById('history-summary').classList.add('hidden');return message('ไม่พบประวัติจากรหัสนี้ กรุณาตรวจสอบรหัสอีกครั้ง');}localStorage.setItem('wnw-donation-history-code',code);message(`พบประวัติ ${rows.length} รายการ`,true);render()}catch(err){rows=[];list.innerHTML='';message('ค้นหาไม่สำเร็จ: '+(err.message||err))}
  }
  document.getElementById('history-form').addEventListener('submit',e=>{e.preventDefault();search(input.value)});
  const saved=localStorage.getItem('wnw-donation-history-code')||'';if(saved){input.value=saved;search(saved)}
  lucide.createIcons();
})();
