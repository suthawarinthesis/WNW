(() => {
  const C=window.DonationCommon, db=C.db;
  const $=s=>document.querySelector(s);
  const PAGE_SIZE=50;
  let page=1,total=0,search='',timer=null;

  function normalizePhotoUrl(value=''){
    const raw=String(value||'').trim(); if(!raw)return '';
    try{const u=new URL(raw); if(!['http:','https:'].includes(u.protocol))return '';
      if(/(^|\.)drive\.google\.com$/i.test(u.hostname)){const m=raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)||raw.match(/[?&]id=([a-zA-Z0-9_-]+)/); if(m?.[1])return `https://drive.google.com/thumbnail?id=${encodeURIComponent(m[1])}&sz=w600`;}
      return raw;
    }catch(_){return ''}
  }
  function formatTime(v=''){const s=String(v||'');return s?s.slice(0,5)+' น.':'—'}
  function esc(v=''){return C.escapeHtml(v)}
  function donorCell(x){
    const src=normalizePhotoUrl(x.photo_url);
    const avatar=src?`<img src="${esc(src)}" class="w-12 h-12 rounded-2xl object-cover bg-slate-100 border border-slate-100 shrink-0" alt="${esc(x.display_name||'ผู้บริจาค')}" onerror="this.style.display='none';this.nextElementSibling.classList.remove('hidden')">`:'';
    const fallback=`<div class="${src?'hidden ':''}w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0"><i data-lucide="user-round" class="w-5 h-5"></i></div>`;
    const alumni=x.is_alumni?`<span class="inline-flex mt-1 text-[10px] px-2 py-0.5 rounded-full bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-100 font-bold">ศิษย์เก่า${x.alumni_batch?' รุ่น '+esc(x.alumni_batch):''}</span>`:'';
    return `<div class="flex items-center gap-3">${avatar}${fallback}<div class="min-w-0"><p class="font-extrabold text-slate-800">${esc(x.display_name||'ผู้ไม่ประสงค์ออกนาม')}</p>${alumni}</div></div>`;
  }
  function certificateCell(x){
    const no=x.certificate_no?`<p class="font-extrabold text-emerald-800 break-all">${esc(x.certificate_no)}</p>`:'<p class="font-bold text-slate-400">ยังไม่มีเลขใบ</p>';
    const actions=[];
    if(x.certificate_pdf_url) actions.push(`<a href="${esc(x.certificate_pdf_url)}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"><i data-lucide="file-text" class="w-3.5 h-3.5"></i> ดูใบอนุโมทนาบัตร</a>`);
    else if(x.certificate_no) actions.push(`<span class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 text-xs font-bold"><i data-lucide="clock-3" class="w-3.5 h-3.5"></i> กำลังจัดทำ PDF</span>`);
    if(x.certificate_no) actions.push(`<a href="../verify/?no=${encodeURIComponent(x.certificate_no)}" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-slate-700 border border-slate-200 text-xs font-bold hover:bg-slate-50"><i data-lucide="badge-check" class="w-3.5 h-3.5"></i> ตรวจสอบใบ</a>`);
    return `${no}<div class="mt-2 flex flex-wrap gap-2">${actions.join('')}</div>`;
  }
  function render(rows){
    const body=$('#donor-tbody');
    $('#table-loading').classList.add('hidden');$('#table-error').classList.add('hidden');
    $('#table-wrap').classList.toggle('hidden',!rows.length);$('#empty-state').classList.toggle('hidden',!!rows.length);$('#pager').classList.toggle('hidden',!total);
    body.innerHTML=rows.map((x,i)=>`<tr><td class="px-5 py-4 text-center text-slate-400 font-semibold">${((page-1)*PAGE_SIZE+i+1).toLocaleString('th-TH')}</td><td class="px-5 py-4"><p class="font-bold text-slate-700">${C.formatDateTH(x.transfer_date)}</p><p class="text-xs text-slate-400 mt-1">${formatTime(x.transfer_time)}</p></td><td class="px-5 py-4">${donorCell(x)}</td><td class="px-5 py-4 text-right"><p class="font-extrabold text-orange-700 text-base">${x.amount==null?'ไม่เปิดเผย':C.formatTHB(x.amount)}</p></td><td class="px-5 py-4">${certificateCell(x)}</td></tr>`).join('');
    $('#total-count').textContent=total.toLocaleString('th-TH')+' รายการ';
    const pages=Math.max(1,Math.ceil(total/PAGE_SIZE)); $('#page-indicator').textContent=`${page}/${pages}`;$('#page-text').textContent=`หน้า ${page} จาก ${pages}`;
    const start=total?((page-1)*PAGE_SIZE+1):0,end=Math.min(page*PAGE_SIZE,total);$('#range-text').textContent=total?`แสดง ${start.toLocaleString('th-TH')}–${end.toLocaleString('th-TH')} จาก ${total.toLocaleString('th-TH')} รายการ`:'';
    $('#prev-btn').disabled=page<=1;$('#next-btn').disabled=page>=pages;lucide.createIcons();
  }
  async function load(){
    if(!db){$('#table-loading').classList.add('hidden');$('#table-error').textContent='ยังไม่ได้เชื่อมต่อ Supabase';$('#table-error').classList.remove('hidden');return}
    $('#table-loading').classList.remove('hidden');$('#table-wrap').classList.add('hidden');$('#empty-state').classList.add('hidden');$('#table-error').classList.add('hidden');
    try{
      const {data,error}=await db.rpc('get_public_donor_directory',{p_search:search,p_limit:PAGE_SIZE,p_offset:(page-1)*PAGE_SIZE}); if(error)throw error;
      const rows=Array.isArray(data)?data:[]; total=Number(rows[0]?.total_count||0);
      const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));if(page>pages){page=pages;return load()}
      render(rows);
    }catch(err){console.error(err);$('#table-loading').classList.add('hidden');$('#table-error').innerHTML=`โหลดรายนามผู้บริจาคไม่สำเร็จ<br><span class="text-xs">${esc(err.message||err)}</span><br><b class="text-xs">หากเพิ่งอัปเดตเว็บไซต์ กรุณารัน DONATION-V12-PUBLIC-DONOR-DIRECTORY.sql ก่อน</b>`;$('#table-error').classList.remove('hidden')}
  }
  $('#donor-search').addEventListener('input',e=>{clearTimeout(timer);timer=setTimeout(()=>{search=e.target.value.trim();page=1;load()},300)});
  $('#prev-btn').onclick=()=>{if(page>1){page--;load();window.scrollTo({top:180,behavior:'smooth'})}};
  $('#next-btn').onclick=()=>{if(page*PAGE_SIZE<total){page++;load();window.scrollTo({top:180,behavior:'smooth'})}};
  (async()=>{try{C.applyBranding(await C.loadBranding())}catch(_){} lucide.createIcons();load()})();
})();