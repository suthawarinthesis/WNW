(() => {
  const C=window.DonationCommon,db=C.db;
  const input=document.getElementById('certificate-no'),result=document.getElementById('result');
  function invalid(msg='ไม่พบเลขใบอนุโมทนาบัตรนี้ในระบบ'){
    result.innerHTML=`<div class="glass rounded-[2rem] p-8 text-center border border-rose-100"><div class="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto"><i data-lucide="circle-x" class="w-7 h-7"></i></div><h2 class="mt-4 text-xl font-extrabold text-rose-700">ไม่สามารถยืนยันเอกสาร</h2><p class="mt-2 text-slate-500">${C.escapeHtml(msg)}</p></div>`;lucide.createIcons();
  }
  function valid(x){
    const pdf=x.certificate_pdf_url
      ? `<a href="${C.escapeHtml(x.certificate_pdf_url)}" target="_blank" rel="noopener" class="px-5 py-3 rounded-2xl bg-orange-500 text-white font-bold inline-flex items-center gap-2"><i data-lucide="file-down" class="w-5 h-5"></i> ดาวน์โหลดใบ PDF</a>`
      : ``;
    const image=x.certificate_image_url
      ? `<a href="${C.escapeHtml(x.certificate_image_url)}" target="_blank" rel="noopener" class="px-5 py-3 rounded-2xl bg-sky-600 text-white font-bold inline-flex items-center gap-2"><i data-lucide="image" class="w-5 h-5"></i> ดาวน์โหลดภาพใบ</a>`
      : ``;
    const certAction=(pdf||image)?pdf+image:`<span class="px-5 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 font-bold">ใบอนุโมทนาบัตรกำลังจัดทำ</span>`;
    result.innerHTML=`<div class="glass rounded-[2rem] overflow-hidden border border-emerald-100"><div class="bg-emerald-50 p-6 text-center border-b border-emerald-100"><div class="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-200"><i data-lucide="badge-check" class="w-7 h-7"></i></div><h2 class="mt-3 text-2xl font-extrabold text-emerald-800">ใบอนุโมทนาบัตรถูกต้อง</h2><p class="text-sm text-emerald-700 mt-1">พบข้อมูลการออกใบในระบบของโรงเรียน</p></div><div class="p-6 sm:p-8 grid sm:grid-cols-2 gap-5"><div><p class="text-xs text-slate-400">เลขใบอนุโมทนาบัตร</p><p class="mt-1 font-extrabold text-lg break-all">${C.escapeHtml(x.certificate_no)}</p></div><div><p class="text-xs text-slate-400">ผู้บริจาค</p><p class="mt-1 font-extrabold text-lg">${C.escapeHtml(x.display_name)}</p></div><div><p class="text-xs text-slate-400">จำนวนเงิน</p><p class="mt-1 font-extrabold text-lg text-orange-700">${C.formatTHB(x.amount)}</p></div><div><p class="text-xs text-slate-400">วันที่ร่วมบุญ</p><p class="mt-1 font-extrabold text-lg">${C.formatDateTH(x.transfer_date)}</p></div><div class="sm:col-span-2"><p class="text-xs text-slate-400">วันที่ออกใบ</p><p class="mt-1 font-semibold">${C.formatDateTH(x.certificate_issued_at)}</p></div></div><div class="px-6 sm:px-8 pb-7 flex flex-wrap gap-3">${certAction}</div></div>`;
    lucide.createIcons();
  }
  async function verify(no){
    no=(no||'').trim().toUpperCase();if(!no){result.innerHTML='';return}
    result.innerHTML='<div class="glass rounded-2xl p-7 text-center text-slate-500">กำลังตรวจสอบ...</div>';
    if(!db)return invalid('ยังไม่ได้เชื่อมต่อ Supabase');
    try{const {data,error}=await db.rpc('verify_donation_certificate',{p_certificate_no:no});if(error)throw error;const x=Array.isArray(data)?data[0]:data;if(!x)return invalid();valid(x)}catch(err){console.error(err);invalid('ตรวจสอบไม่สำเร็จ: '+(err.message||err))}
  }
  document.getElementById('verify-form').addEventListener('submit',e=>{e.preventDefault();verify(input.value)});
  const q=new URLSearchParams(location.search).get('no');if(q){input.value=q;verify(q)}
  lucide.createIcons();
})();
