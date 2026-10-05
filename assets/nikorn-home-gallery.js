(async()=>{
  const cfg=window.SCHOOL_APP_CONFIG||{};
  if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const section=document.getElementById('nikorn-main-section'),track=document.getElementById('nikorn-main-track'),dots=document.getElementById('nikorn-main-dots');
  if(!section||!track||!dots)return;
  try{
    const db=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
    const {data,error}=await db.rpc('get_donation_nikorn_gallery',{p_limit:8});
    if(error||!Array.isArray(data)||!data.length)return;
    const formatTHB=v=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',minimumFractionDigits:2}).format(Number(v||0));
    const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    const dth=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric'});};
    section.classList.remove('hidden');
    track.innerHTML=data.map(x=>`<article class="nikorn-main-card rounded-[1.7rem] bg-white border border-slate-100 p-3 shadow-sm"><img src="${esc(x.image_url)}" alt="${esc(x.donor_name||'ผู้ร่วมบุญ')}" loading="lazy"><div class="pt-3"><p class="font-extrabold text-slate-800 truncate">${esc(x.donor_name||'ผู้ไม่ประสงค์ออกนาม')}</p><p class="text-xs text-slate-500 mt-1">${x.campaign_name?esc(x.campaign_name)+' • ':''}${dth(x.generated_at)}</p><p class="mt-2 text-sm font-extrabold text-orange-700">${x.amount==null?'ร่วมอนุโมทนา':formatTHB(x.amount)}</p></div></article>`).join('');
    dots.innerHTML=data.map((_,i)=>`<button class="w-2.5 h-2.5 rounded-full ${i===0?'bg-orange-500':'bg-orange-100'}" data-index="${i}"></button>`).join('');
    let current=0; let timer=null;
    const apply=()=>{const step=track.children[0]?.getBoundingClientRect().width||320;track.style.transform=`translateX(-${current*(step+16)}px)`;[...dots.children].forEach((d,idx)=>d.className=`w-2.5 h-2.5 rounded-full ${idx===current?'bg-orange-500':'bg-orange-100'}`);};
    const restart=()=>{if(timer)clearInterval(timer);timer=setInterval(()=>{current=(current+1)%data.length;apply();},3300)};
    [...dots.children].forEach(btn=>btn.onclick=()=>{current=Number(btn.dataset.index||0);apply();restart();});
    apply();restart();if(window.lucide)lucide.createIcons();
  }catch(err){console.warn('nikorn gallery',err)}
})();
