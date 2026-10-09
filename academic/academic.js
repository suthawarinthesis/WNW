const db = window.SCHOOL_SUPABASE;
let posts = [], files = [], activeCategory = 'all', query = '';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = (v='') => String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const thDate = v => v ? new Date(v+'T00:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'}) : '-';
const catLabel = c => ({academic:'วิชาการ',finance:'การเงิน',quality:'ประกัน/ประเมินคุณภาพ',other:'อื่น ๆ'}[c]||'เอกสาร');
const catTone = c => ({academic:'bg-blue-50 text-blue-700 border-blue-100',finance:'bg-emerald-50 text-emerald-700 border-emerald-100',quality:'bg-violet-50 text-violet-700 border-violet-100',other:'bg-slate-100 text-slate-700 border-slate-200'}[c]||'bg-slate-100 text-slate-700 border-slate-200');
const catIcon = c => ({academic:'book-open',finance:'wallet-cards',quality:'badge-check',other:'files'}[c]||'file-text');
function directImageUrl(url=''){const v=String(url||'').trim();const m=v.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([A-Za-z0-9_-]+)/i)||v.match(/[?&]id=([A-Za-z0-9_-]+)/i);return m?`https://drive.google.com/thumbnail?id=${m[1]}&sz=w800`:v}
function fileExt(x){const n=(x.file_name||x.file_url||'').split('?')[0].split('#')[0];const ext=n.includes('.')?n.split('.').pop().toLowerCase():'';return ext||String(x.file_type||'').toLowerCase().replace('application/','').replace('vnd.openxmlformats-officedocument.','')}
function fileBadge(ext){if(/pdf/.test(ext))return ['PDF','bg-red-50 text-red-700'];if(/xls|sheet/.test(ext))return ['Excel','bg-emerald-50 text-emerald-700'];if(/doc|word/.test(ext))return ['Word','bg-blue-50 text-blue-700'];if(/ppt|presentation/.test(ext))return ['PowerPoint','bg-orange-50 text-orange-700'];if(/csv/.test(ext))return ['CSV','bg-teal-50 text-teal-700'];return [ext?ext.toUpperCase():'FILE','bg-slate-100 text-slate-600']}
async function loadBranding(){try{if(!db)return;const {data}=await db.from('site_settings').select('data').eq('id',1).maybeSingle();const s=data?.data;if(s?.info?.nameTh){$('#school-name').textContent=s.info.nameTh;$('#footer-school').textContent=s.info.nameTh;document.title=`ฝ่ายวิชาการ | ${s.info.nameTh}`;}const logo=directImageUrl(s?.branding?.logoUrl||'');if(logo){$('#site-logo').src=logo;$('#site-logo').classList.remove('hidden');$('#site-logo-icon').classList.add('hidden')}}catch(e){console.warn(e)}}
async function loadData(){
  if(!db){showTableError('ยังไม่ได้เชื่อมต่อ Supabase');return;}
  try{
    const [p,f]=await Promise.all([
      db.from('academic_posts').select('*').eq('published',true).order('pinned',{ascending:false}).order('publish_date',{ascending:false}).order('sort_order',{ascending:true}),
      db.from('academic_files').select('*').eq('published',true).order('publish_date',{ascending:false}).order('sort_order',{ascending:true})
    ]);
    if(p.error) throw p.error;if(f.error) throw f.error;posts=p.data||[];files=f.data||[];updateStats();renderPosts();renderFiles();
  }catch(e){console.error(e);showTableError('ไม่สามารถโหลดข้อมูลฝ่ายวิชาการได้ กรุณาตรวจสอบการติดตั้งฐานข้อมูล')}
}
function updateStats(){
  $('#stat-posts').textContent=posts.length.toLocaleString('th-TH');$('#stat-files').textContent=files.length.toLocaleString('th-TH');
  ['academic','finance','quality','other'].forEach(c=>$$(`[data-count="${c}"]`).forEach(el=>el.textContent=files.filter(x=>x.category===c).length.toLocaleString('th-TH')));
}
function showTableError(msg){$('#announcement-status').textContent=msg;$('#file-status').textContent=msg;$('#announcement-result').textContent='ไม่สามารถโหลดข้อมูล';$('#file-result').textContent='ไม่สามารถโหลดข้อมูล'}
function matchPost(x){if(!query)return true;const q=query.toLowerCase();return `${x.title||''} ${x.summary||''} ${x.body||''}`.toLowerCase().includes(q)}
function matchFile(x){if(activeCategory!=='all'&&x.category!==activeCategory)return false;if(!query)return true;const q=query.toLowerCase();return `${x.title||''} ${x.description||''} ${x.file_name||''} ${catLabel(x.category)}`.toLowerCase().includes(q)}
function renderPosts(){
  const filtered=posts.filter(matchPost), s=$('#announcement-status'),g=$('#announcement-grid'),pinned=$('#pinned-wrap');
  $('#announcement-result').textContent=`พบ ${filtered.length.toLocaleString('th-TH')} ประกาศ${query?` สำหรับ “${query}”`:''}`;
  const pin=filtered.find(x=>x.pinned);
  if(pin){pinned.classList.remove('hidden');pinned.innerHTML=`<button type="button" data-post-id="${pin.id}" class="w-full panel rounded-[2rem] p-6 sm:p-8 text-left bg-gradient-to-br from-blue-600 to-indigo-700 text-white overflow-hidden relative group"><div class="absolute -right-16 -top-16 w-52 h-52 bg-white/10 rounded-full"></div><div class="relative max-w-4xl"><div class="flex flex-wrap items-center gap-2"><span class="rounded-full bg-white/15 px-3 py-1 text-[10px] font-black">ประกาศสำคัญ</span><span class="text-[11px] font-bold text-blue-100">${esc(thDate(pin.publish_date))}</span></div><h3 class="mt-4 text-2xl sm:text-3xl font-black leading-tight">${esc(pin.title)}</h3><p class="mt-3 max-w-3xl text-sm leading-7 text-blue-50/90 line-clamp-3">${esc(pin.summary||pin.body||'')}</p><span class="mt-5 inline-flex items-center gap-2 text-xs font-black">อ่านรายละเอียด <i data-lucide="arrow-right" class="w-4 h-4"></i></span></div></button>`;}else{pinned.classList.add('hidden');pinned.innerHTML=''}
  const regular=filtered.filter(x=>!pin||x.id!==pin.id);
  if(!regular.length && !pin){s.textContent=query?'ไม่พบประกาศที่ตรงกับคำค้น':'ยังไม่มีประกาศที่เผยแพร่';s.classList.remove('hidden');g.classList.add('hidden')}else if(!regular.length){s.classList.add('hidden');g.classList.add('hidden')}else{
    s.classList.add('hidden');g.classList.remove('hidden');g.innerHTML=regular.map(x=>`<button type="button" data-post-id="${x.id}" class="text-left panel rounded-[1.7rem] p-5 sm:p-6 hover:-translate-y-1 hover:border-blue-200 transition-all group"><div class="flex items-start justify-between gap-3"><span class="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><i data-lucide="megaphone" class="w-4 h-4"></i></span><span class="text-[10px] font-bold text-slate-400">${esc(thDate(x.publish_date))}</span></div><h3 class="mt-4 text-lg font-black text-slate-950 group-hover:text-blue-600 transition-colors line-clamp-2">${esc(x.title)}</h3><p class="mt-2.5 text-sm leading-6 text-slate-500 line-clamp-3">${esc(x.summary||x.body||'')}</p><div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between"><span class="text-xs font-black text-blue-600">อ่านประกาศ</span><i data-lucide="arrow-up-right" class="w-4 h-4 text-slate-400 group-hover:text-blue-600"></i></div></button>`).join('');
  }
  $$('[data-post-id]').forEach(b=>b.onclick=()=>openPost(b.dataset.postId));lucide.createIcons();
}
function renderFiles(){
  const filtered=files.filter(matchFile),s=$('#file-status'),l=$('#file-list');
  $('#file-result').textContent=`พบ ${filtered.length.toLocaleString('th-TH')} เอกสาร${activeCategory!=='all'?` • ${catLabel(activeCategory)}`:''}${query?` • ค้นหา “${query}”`:''}`;
  if(!filtered.length){s.textContent=query?'ไม่พบเอกสารที่ตรงกับการค้นหา':'ยังไม่มีเอกสารในหมวดนี้';s.classList.remove('hidden');l.classList.add('hidden');return}s.classList.add('hidden');l.classList.remove('hidden');
  l.innerHTML=filtered.map(x=>{const [badge,badgeClass]=fileBadge(fileExt(x));return `<a href="${esc(x.file_url)}" target="_blank" rel="noopener" class="doc-row panel rounded-[1.35rem] p-4 sm:p-5 flex items-center gap-4 group"><div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${catTone(x.category)} border flex items-center justify-center shrink-0"><i data-lucide="${catIcon(x.category)}" class="w-5 h-5"></i></div><div class="min-w-0 flex-1"><div class="flex flex-wrap gap-2 items-center"><h3 class="font-black text-slate-950 line-clamp-2">${esc(x.title)}</h3><span class="text-[9px] px-2 py-1 rounded-full font-black ${badgeClass}">${esc(badge)}</span><span class="text-[9px] px-2 py-1 rounded-full border font-black ${catTone(x.category)}">${esc(catLabel(x.category))}</span></div><p class="text-[11px] text-slate-400 mt-1.5">${esc(thDate(x.publish_date))}${x.file_name?' • '+esc(x.file_name):''}${x.file_size?' • '+esc(x.file_size):''}</p>${x.description?`<p class="text-sm text-slate-500 mt-2 line-clamp-2">${esc(x.description)}</p>`:''}</div><span class="doc-action w-10 h-10 rounded-full border border-slate-200 bg-white text-slate-500 flex items-center justify-center shrink-0 transition"><i data-lucide="download" class="w-4 h-4"></i></span></a>`}).join('');lucide.createIcons();
}
function openPost(id){
  const x=posts.find(p=>String(p.id)===String(id));if(!x)return;$('#modal-date').textContent=thDate(x.publish_date);$('#modal-title').textContent=x.title;$('#modal-body').textContent=x.body||x.summary||'-';$('#announcement-modal').classList.remove('hidden');$('#announcement-modal').classList.add('flex');document.body.style.overflow='hidden';history.replaceState({},'',`${location.pathname}?post=${encodeURIComponent(x.id)}`);$('#share-announcement').onclick=async()=>{try{if(navigator.share)await navigator.share({title:x.title,text:x.summary||'',url:location.href});else{await navigator.clipboard.writeText(location.href);alert('คัดลอกลิงก์ประกาศแล้ว')}}catch(_){}};lucide.createIcons()
}
function closeModal(){$('#announcement-modal').classList.add('hidden');$('#announcement-modal').classList.remove('flex');document.body.style.overflow='';history.replaceState({},'',location.pathname)}
function applySearch(){renderPosts();renderFiles()}
$$('[data-close-modal]').forEach(x=>x.addEventListener('click',closeModal));
$$('#category-tabs [data-cat]').forEach(b=>b.addEventListener('click',()=>{activeCategory=b.dataset.cat;$$('#category-tabs .cat-btn').forEach(x=>x.classList.toggle('active',x===b));renderFiles()}));
$$('[data-quick-cat]').forEach(b=>b.addEventListener('click',()=>{activeCategory=b.dataset.quickCat;const target=$(`#category-tabs [data-cat="${activeCategory}"]`);if(target){$$('#category-tabs .cat-btn').forEach(x=>x.classList.toggle('active',x===target))}renderFiles();document.querySelector('#documents').scrollIntoView({behavior:'smooth',block:'start'})}));
$('#academic-search').addEventListener('input',e=>{query=e.target.value.trim();$('#clear-search').classList.toggle('hidden',!query);applySearch()});
$('#clear-search').onclick=()=>{$('#academic-search').value='';query='';$('#clear-search').classList.add('hidden');applySearch();$('#academic-search').focus()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#announcement-modal').classList.contains('hidden'))closeModal()});
Promise.allSettled([loadBranding(),loadData()]).finally(()=>{const id=new URLSearchParams(location.search).get('post');if(id)openPost(id);lucide.createIcons()});
