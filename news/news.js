const db = window.SCHOOL_SUPABASE;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = (v='') => String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let allNews = [], activeCategory = 'ทั้งหมด', query = '', visibleCount = 9;

function directImageUrl(url=''){
  const v = String(url||'').trim();
  if(!v) return '';
  const m = v.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([A-Za-z0-9_-]+)/i) || v.match(/[?&]id=([A-Za-z0-9_-]+)/i);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1600` : v;
}
function displayDate(x){
  if(x?.date_text || x?.month_year) return [x.date_text,x.month_year].filter(Boolean).join(' ');
  const d = x?.published_at || x?.created_at; if(!d) return '';
  try{return new Date(d).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'});}catch{return ''}
}
function safeUrl(url=''){const v=String(url||'').trim();return /^https?:\/\//i.test(v)?v:''}
function categoryClass(category=''){
  const c=String(category).toLowerCase();
  if(c.includes('ประกาศ')) return 'bg-red-50 text-red-700 border-red-100';
  if(c.includes('รับสมัคร')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if(c.includes('กิจกรรม')) return 'bg-violet-50 text-violet-700 border-violet-100';
  if(c.includes('วิชาการ')) return 'bg-blue-50 text-blue-700 border-blue-100';
  return 'bg-orange-50 text-orange-700 border-orange-100';
}
async function loadBranding(){
  try{if(!db)return;const {data}=await db.from('site_settings').select('data').eq('id',1).maybeSingle();const s=data?.data;if(s?.info?.nameTh){$('#school-name').textContent=s.info.nameTh;$('#footer-school').textContent=s.info.nameTh;document.title=`ข่าวสาร | ${s.info.nameTh}`;}const logo=directImageUrl(s?.branding?.logoUrl||'');if(logo){$('#site-logo').src=logo;$('#site-logo').classList.remove('hidden');$('#site-logo-icon').classList.add('hidden')}}catch(e){console.warn('branding',e)}
}
async function loadNews(){
  if(!db){showLoadError('ยังไม่ได้เชื่อมต่อ Supabase');return;}
  try{
    const {data,error}=await db.from('news').select('*').eq('published',true).order('sort_order',{ascending:true}).order('published_at',{ascending:false}).order('created_at',{ascending:false});
    if(error) throw error; allNews=data||[]; renderCategories(); renderFeatured(); renderGrid(); openFromQuery();
  }catch(e){console.error(e);showLoadError('ไม่สามารถโหลดข่าวสารได้ในขณะนี้')}
}
function showLoadError(msg){$('#loading-grid').classList.add('hidden');$('#empty-state').classList.remove('hidden');$('#empty-state h3').textContent=msg;$('#empty-state p').textContent='กรุณาลองใหม่อีกครั้งภายหลัง';lucide.createIcons()}
function getFiltered(){
  return allNews.filter(x=>{
    const cat=activeCategory==='ทั้งหมด'||(x.category||'ข่าวสาร')===activeCategory;
    const hay=`${x.title||''} ${x.summary||''} ${x.category||''}`.toLowerCase();
    return cat && (!query || hay.includes(query.toLowerCase()));
  });
}
function renderCategories(){
  const cats=['ทั้งหมด',...new Set(allNews.map(x=>x.category||'ข่าวสาร'))];
  $('#category-chips').innerHTML=cats.map(c=>`<button type="button" data-cat="${esc(c)}" class="chip shrink-0 rounded-full border border-orange-100 bg-white px-4 py-2 text-xs font-extrabold text-slate-600 hover:border-orange-300 hover:text-orange-700 transition ${c===activeCategory?'active':''}">${esc(c)}</button>`).join('');
  $$('#category-chips [data-cat]').forEach(b=>b.onclick=()=>{activeCategory=b.dataset.cat;visibleCount=9;renderCategories();renderGrid()});
}
function imageOrFallback(x, cls='w-full h-full object-cover'){
  const src=directImageUrl(x.image_url||'');
  return src?`<img src="${esc(src)}" alt="${esc(x.title||'ข่าวสาร')}" class="${cls}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=&quot;w-full h-full bg-gradient-to-br from-orange-100 via-white to-amber-50 flex items-center justify-center text-orange-300&quot;><svg viewBox=&quot;0 0 24 24&quot; class=&quot;w-12 h-12&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;1.6&quot;><path d=&quot;M4 19.5A2.5 2.5 0 0 1 6.5 17H20&quot;/><path d=&quot;M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z&quot;/></svg></div>'">`:`<div class="w-full h-full bg-gradient-to-br from-orange-100 via-white to-amber-50 flex items-center justify-center text-orange-300"><i data-lucide="newspaper" class="w-12 h-12"></i></div>`;
}
function renderFeatured(){
  const wrap=$('#featured-wrap'); if(!allNews.length){wrap.classList.add('hidden');return;} wrap.classList.remove('hidden');
  const [main,...rest]=allNews.slice(0,4); $('#news-count-top').textContent=`${allNews.length.toLocaleString('th-TH')} ข่าว`;
  $('#featured-main').innerHTML=`<button type="button" data-open-news="${main.id}" class="block w-full h-full text-left group"><div class="grid sm:grid-cols-[1.1fr_.9fr] h-full"><div class="min-h-[220px] sm:min-h-[360px] overflow-hidden bg-orange-50">${imageOrFallback(main,'w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]')}</div><div class="p-6 sm:p-7 flex flex-col justify-center"><div class="flex flex-wrap gap-2 items-center"><span class="rounded-full border px-3 py-1 text-[10px] font-black ${categoryClass(main.category)}">${esc(main.category||'ข่าวสาร')}</span><span class="text-[11px] font-bold text-slate-400">${esc(displayDate(main))}</span></div><h3 class="mt-4 text-2xl sm:text-3xl font-black leading-tight text-slate-950 group-hover:text-orange-600 transition-colors">${esc(main.title)}</h3><p class="mt-4 text-sm leading-7 text-slate-500 line-clamp-3">${esc(main.summary||'')}</p><span class="mt-6 inline-flex items-center gap-2 text-xs font-black text-orange-600">อ่านข่าว <i data-lucide="arrow-up-right" class="w-4 h-4"></i></span></div></div></button>`;
  $('#featured-side').innerHTML=rest.map(x=>`<button type="button" data-open-news="${x.id}" class="w-full soft-card rounded-[1.5rem] p-3.5 text-left group flex gap-3 hover:-translate-y-0.5 transition"><div class="w-24 h-20 rounded-2xl overflow-hidden shrink-0 bg-orange-50">${imageOrFallback(x)}</div><div class="min-w-0 py-1"><p class="text-[10px] font-black text-orange-600">${esc(x.category||'ข่าวสาร')} • ${esc(displayDate(x))}</p><h3 class="mt-1.5 font-extrabold text-sm leading-5 text-slate-900 line-clamp-2 group-hover:text-orange-600">${esc(x.title)}</h3></div></button>`).join('') || `<div class="soft-card rounded-[1.5rem] p-6 text-sm text-slate-400">ข่าวอื่น ๆ จะแสดงตรงนี้เมื่อมีการเผยแพร่เพิ่ม</div>`;
  bindOpeners(); lucide.createIcons();
}
function renderGrid(){
  const filtered=getFiltered(), showing=filtered.slice(0,visibleCount);
  $('#loading-grid').classList.add('hidden');
  $('#result-summary').textContent=`พบ ${filtered.length.toLocaleString('th-TH')} รายการ${activeCategory!=='ทั้งหมด'?` ในหมวด “${activeCategory}”`:''}${query?` สำหรับ “${query}”`:''}`;
  const grid=$('#news-grid'), empty=$('#empty-state'), more=$('#load-more');
  if(!filtered.length){grid.classList.add('hidden');empty.classList.remove('hidden');more.classList.add('hidden');lucide.createIcons();return;}
  empty.classList.add('hidden');grid.classList.remove('hidden');
  grid.innerHTML=showing.map(x=>`<article class="news-card soft-card rounded-[1.8rem] overflow-hidden group"><button type="button" data-open-news="${x.id}" class="w-full text-left"><div class="h-48 sm:h-52 overflow-hidden bg-orange-50">${imageOrFallback(x)}</div><div class="p-5"><div class="flex flex-wrap items-center gap-2"><span class="rounded-full border px-2.5 py-1 text-[10px] font-black ${categoryClass(x.category)}">${esc(x.category||'ข่าวสาร')}</span><span class="text-[10px] font-bold text-slate-400">${esc(displayDate(x))}</span></div><h3 class="mt-3 text-lg font-black leading-6 text-slate-900 line-clamp-2 group-hover:text-orange-600 transition-colors">${esc(x.title)}</h3><p class="mt-2.5 text-sm leading-6 text-slate-500 line-clamp-3">${esc(x.summary||'')}</p><div class="mt-4 pt-3 border-t border-orange-50 flex items-center justify-between"><span class="text-xs font-extrabold text-orange-600">อ่านรายละเอียด</span><span class="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition"><i data-lucide="arrow-right" class="w-4 h-4"></i></span></div></div></button></article>`).join('');
  more.classList.toggle('hidden',filtered.length<=visibleCount); bindOpeners(); lucide.createIcons();
}
function bindOpeners(){$$('[data-open-news]').forEach(b=>b.onclick=()=>openReader(b.dataset.openNews))}
function openReader(id,push=true){
  const x=allNews.find(n=>String(n.id)===String(id)); if(!x)return;
  const img=directImageUrl(x.image_url||''); $('#reader-image-wrap').classList.toggle('hidden',!img); if(img){$('#reader-image').src=img;$('#reader-image').alt=x.title||'ข่าวสาร'}
  $('#reader-category').textContent=x.category||'ข่าวสาร';$('#reader-date').textContent=displayDate(x);$('#reader-title').textContent=x.title||'';$('#reader-body').textContent=x.summary||'ไม่มีรายละเอียดเพิ่มเติม';
  const url=safeUrl(x.url); $('#reader-actions').innerHTML=`<button type="button" id="share-news" class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><i data-lucide="share-2" class="w-4 h-4"></i> แชร์ข่าว</button>${url?`<a href="${esc(url)}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600"><i data-lucide="external-link" class="w-4 h-4"></i> เปิดลิงก์ต้นฉบับ</a>`:''}`;
  $('#reader-modal').classList.remove('hidden');$('#reader-modal').classList.add('flex');document.body.style.overflow='hidden';
  if(push) history.replaceState({},'',`${location.pathname}?id=${encodeURIComponent(x.id)}`);
  $('#share-news').onclick=async()=>{const shareUrl=location.href;try{if(navigator.share)await navigator.share({title:x.title,text:x.summary||'',url:shareUrl});else{await navigator.clipboard.writeText(shareUrl);alert('คัดลอกลิงก์ข่าวแล้ว')}}catch(_){}};
  lucide.createIcons();
}
function closeReader(){
  $('#reader-modal').classList.add('hidden');$('#reader-modal').classList.remove('flex');document.body.style.overflow='';
  history.replaceState({},'',location.pathname);
}
function openFromQuery(){const id=new URLSearchParams(location.search).get('id');if(id) openReader(id,false)}
$$('[data-close-reader]').forEach(b=>b.onclick=closeReader);
$('#news-search').addEventListener('input',e=>{query=e.target.value.trim();visibleCount=9;$('#clear-search').classList.toggle('hidden',!query);renderGrid()});
$('#clear-search').onclick=()=>{$('#news-search').value='';query='';visibleCount=9;$('#clear-search').classList.add('hidden');renderGrid();$('#news-search').focus()};
$('#load-more').onclick=()=>{visibleCount+=9;renderGrid()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#reader-modal').classList.contains('hidden'))closeReader()});
Promise.allSettled([loadBranding(),loadNews()]).finally(()=>lucide.createIcons());
