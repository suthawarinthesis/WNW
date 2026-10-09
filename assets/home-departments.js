(() => {
  const db = window.SCHOOL_SUPABASE;
  const $ = s => document.querySelector(s);
  const esc = (v='') => String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const thDate = v => v ? new Date(v+'T00:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}) : '-';

  function youtubeEmbed(url='') {
    const s=String(url||'').trim(); if(!s) return '';
    try {
      const u=new URL(s);
      let id='';
      if(u.hostname.includes('youtu.be')) id=u.pathname.replace(/^\//,'').split('/')[0];
      else if(u.hostname.includes('youtube.com')) id=u.searchParams.get('v') || (u.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)||[])[1] || '';
      return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0` : '';
    } catch(_) { return ''; }
  }

  function renderVideo(settings={}) {
    const section=$('#school-video-section'), frame=$('#school-video-frame'), fallback=$('#school-video-fallback'), open=$('#school-video-open');
    if(!section||!frame) return;
    const raw=settings?.media?.videoPromo||''; const embed=youtubeEmbed(raw);
    section.classList.remove('hidden');
    if(embed){frame.src=embed;frame.classList.remove('hidden');fallback?.classList.add('hidden');}
    else {frame.removeAttribute('src');frame.classList.add('hidden');fallback?.classList.remove('hidden');}
    if(open){open.href=raw||'#';open.classList.toggle('pointer-events-none',!raw);open.classList.toggle('opacity-50',!raw);}
  }

  function renderAcademic(posts=[],files=[]) {
    const box=$('#home-academic-content'); if(!box)return;
    const post=posts[0], file=files[0];
    if(!post&&!file){box.innerHTML='<div class="rounded-2xl bg-white/70 border border-white p-5 text-sm text-slate-400">ยังไม่มีประกาศหรือเอกสารที่เผยแพร่</div>';return;}
    let html='';
    if(post) html+=`<a href="./academic/" class="block rounded-2xl bg-white/80 border border-white p-5 hover:shadow-md transition-all"><div class="flex items-center justify-between gap-3"><span class="text-[10px] font-bold text-orange-600">ประกาศล่าสุด • ${esc(thDate(post.publish_date))}</span>${post.pinned?'<span class="text-[10px] rounded-full bg-orange-100 text-orange-700 px-2 py-1 font-bold">ปักหมุด</span>':''}</div><h4 class="font-bold text-slate-900 mt-2 line-clamp-2">${esc(post.title)}</h4><p class="text-xs text-slate-500 mt-2 line-clamp-2">${esc(post.summary||post.body||'')}</p></a>`;
    if(file) html+=`<a href="${esc(file.file_url)}" target="_blank" rel="noopener" class="flex items-center gap-3 mt-3 rounded-2xl bg-white/70 border border-white p-4 hover:bg-white transition-all"><div class="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><i data-lucide="file-text" class="w-4 h-4"></i></div><div class="min-w-0"><p class="text-[10px] font-bold text-blue-600">เอกสารล่าสุด</p><p class="text-sm font-bold text-slate-800 truncate">${esc(file.title)}</p></div><i data-lucide="arrow-up-right" class="w-4 h-4 text-slate-400 ml-auto"></i></a>`;
    box.innerHTML=html;
  }

  function renderActivities(posts=[],images=[]) {
    const grid=$('#home-activity-grid'); if(!grid)return;
    if(!posts.length){grid.innerHTML='<div class="sm:col-span-3 rounded-2xl bg-white/70 border border-white p-8 text-center text-sm text-slate-400">ยังไม่มีกิจกรรมที่เผยแพร่</div>';return;}
    grid.innerHTML=posts.slice(0,3).map(p=>{const img=images.find(x=>x.activity_id===p.id)?.image_url||'';return `<a href="./activities/" class="group overflow-hidden rounded-[1.6rem] bg-white/85 border border-white shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all">${img?`<div class="aspect-[4/3] overflow-hidden bg-slate-100"><img src="${esc(img)}" alt="${esc(p.title)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy"></div>`:`<div class="aspect-[4/3] bg-gradient-to-br from-orange-100 to-rose-50 flex items-center justify-center text-orange-300"><i data-lucide="images" class="w-9 h-9"></i></div>`}<div class="p-4"><p class="text-[10px] font-bold text-orange-600">${esc(thDate(p.event_date))}</p><h4 class="text-sm font-bold text-slate-900 mt-1 line-clamp-2">${esc(p.title)}</h4></div></a>`}).join('');
  }

  async function init(){
    let settings={};
    if(!db){renderVideo(settings);return;}
    try {
      const settled=await Promise.allSettled([
        db.from('site_settings').select('data').eq('id',1).maybeSingle(),
        db.from('academic_posts').select('id,title,summary,body,publish_date,pinned').eq('published',true).order('pinned',{ascending:false}).order('publish_date',{ascending:false}).limit(1),
        db.from('academic_files').select('id,title,file_url,publish_date,category').eq('published',true).order('publish_date',{ascending:false}).limit(1),
        db.from('student_activity_posts').select('id,title,event_date,featured').eq('published',true).order('featured',{ascending:false}).order('event_date',{ascending:false}).limit(3)
      ]);
      const s=settled[0].status==='fulfilled'?settled[0].value:null; if(s?.data?.data)settings=s.data.data; renderVideo(settings);
      const posts=settled[1].status==='fulfilled'&&!settled[1].value.error?(settled[1].value.data||[]):[];
      const files=settled[2].status==='fulfilled'&&!settled[2].value.error?(settled[2].value.data||[]):[];
      renderAcademic(posts,files);
      const acts=settled[3].status==='fulfilled'&&!settled[3].value.error?(settled[3].value.data||[]):[];
      let imgs=[]; if(acts.length){const r=await db.from('student_activity_images').select('activity_id,image_url,sort_order').in('activity_id',acts.map(x=>x.id)).order('sort_order',{ascending:true}); if(!r.error)imgs=r.data||[];}
      renderActivities(acts,imgs);
    } catch(e){console.warn('home departments:',e);renderVideo(settings);}
    try{lucide.createIcons()}catch(_){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
