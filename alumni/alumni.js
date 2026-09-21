const db = window.SCHOOL_SUPABASE;
const $ = (s) => document.querySelector(s);
const esc = (v='') => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const collator = new Intl.Collator('th', {numeric:true, sensitivity:'base'});
let schoolSettings = {};
let alumniRows = [];
let staffAlumni = [];
let combined = [];

function normalize(v=''){ return String(v).trim().toLowerCase().replace(/\s+/g,' '); }
function batchLabel(v=''){ return String(v).trim() || 'ไม่ระบุรุ่น'; }
function placeholderAvatar(name='ศิษย์เก่า'){
  const initials = String(name).trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" rx="60" fill="#fff7ed"/><circle cx="200" cy="150" r="72" fill="#fdba74"/><rect x="82" y="238" width="236" height="116" rx="58" fill="#fb923c"/><text x="200" y="385" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#9a3412">${esc(initials||'ศ')}</text></svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

async function loadData(){
  if(!db){
    renderError('ยังไม่ได้เชื่อมต่อ Supabase');
    return;
  }
  const [{data:settingsRow,error:settingsError},{data:rows,error:alumniError},{data:personnelRows,error:personnelError}] = await Promise.all([
    db.from('site_settings').select('data').eq('id',1).maybeSingle(),
    db.from('alumni').select('*').eq('published',true).order('sort_order',{ascending:true}).order('full_name',{ascending:true}),
    db.from('personnel').select('*').eq('published',true).eq('is_alumni',true).order('sort_order',{ascending:true}).order('full_name',{ascending:true})
  ]);
  if(settingsError) console.warn(settingsError);
  if(alumniError){
    renderError('ยังไม่พบตาราง alumni กรุณารัน ALUMNI-SUPABASE-UPGRADE.sql ก่อน');
    return;
  }
  schoolSettings = settingsRow?.data || {};
  alumniRows = (rows||[]).map(r=>({
    id:r.id, source:'alumni', fullName:r.full_name, photo:r.photo_url, batch:r.batch,
    graduationYear:r.graduation_year, graduationLevel:r.graduation_level,
    currentPosition:r.current_position, occupation:r.occupation, organization:r.organization,
    education:r.education, phone:r.phone, email:r.email, facebookUrl:r.facebook_url, bio:r.bio,
    showContact:!!r.show_contact, featured:!!r.featured
  }));
  if(personnelError){
    console.warn('personnel table unavailable; using legacy staff arrays from site_settings', personnelError);
    staffAlumni = extractStaffAlumni(schoolSettings);
  }else{
    staffAlumni = extractPersonnelAlumni(personnelRows||[]);
  }
  combined = mergeAlumni(alumniRows, staffAlumni);
  applyBranding();
  populateBatches();
  render();
}

function extractPersonnelAlumni(rows){
  const labels={executives:'คณะผู้บริหาร',teachers:'ครูและบุคลากร',specialTeachers:'ครูพิเศษ'};
  return (rows||[]).filter(p=>p?.is_alumni).map((p,i)=>({
    id:`staff-${p.id||i}`, source:'staff', staffKind:p.staff_type||'teachers', fullName:p.full_name||'', photo:p.image_url||'',
    batch:p.alumni_batch||'', graduationYear:'', graduationLevel:'', currentPosition:p.position||'',
    occupation:p.position||'', organization:p.department||labels[p.staff_type]||'บุคลากร', education:p.education||'', phone:p.phone||'',
    email:p.email||'', facebookUrl:'', bio:`ปัจจุบันเป็น${p.position||labels[p.staff_type]||'บุคลากร'}${p.department?' • '+p.department:''}`,
    showContact:true, featured:false, staffLabel:labels[p.staff_type]||'บุคลากร'
  }));
}

function extractStaffAlumni(s){
  const groups = [
    ['executives','คณะผู้บริหาร'],['teachers','ครูและบุคลากร'],['specialTeachers','ครูพิเศษ']
  ];
  const out=[];
  groups.forEach(([key,label])=>{
    (Array.isArray(s?.[key])?s[key]:[]).forEach((p,i)=>{
      if(!p?.isAlumni) return;
      out.push({
        id:`staff-${key}-${i}`, source:'staff', staffKind:key, fullName:p.name||'', photo:p.img||'',
        batch:p.alumniBatch||'', graduationYear:'', graduationLevel:'', currentPosition:p.position||'',
        occupation:p.position||'', organization:p.department||label, education:p.education||'', phone:p.phone||'',
        email:p.email||'', facebookUrl:'', bio:`ปัจจุบันเป็น${p.position||label}${p.department?' • '+p.department:''}`,
        showContact:true, featured:false, staffLabel:label
      });
    });
  });
  return out;
}

function mergeAlumni(dbRows, staffRows){
  const map=new Map();
  dbRows.forEach(x=>map.set(`${normalize(x.fullName)}|${normalize(x.batch)}`,x));
  staffRows.forEach(x=>{
    const k=`${normalize(x.fullName)}|${normalize(x.batch)}`;
    if(!map.has(k)) map.set(k,x);
  });
  return [...map.values()].sort((a,b)=>{
    const batchCmp=collator.compare(batchLabel(b.batch),batchLabel(a.batch));
    return batchCmp || collator.compare(a.fullName,b.fullName);
  });
}

function applyBranding(){
  const name = schoolSettings?.info?.nameTh || 'โรงเรียนวัดหนองแวงวิทยา';
  $('#school-name').textContent=name; $('#hero-school-name').textContent=name; document.title=`ทำเนียบศิษย์เก่า - ${name}`;
  const logo=schoolSettings?.branding?.logoUrl;
  if(logo){ $('#school-logo').src=logo; $('#school-logo').classList.remove('hidden'); $('#logo-fallback').classList.add('hidden'); }
}

function populateBatches(){
  const batches=[...new Set(combined.map(x=>batchLabel(x.batch)))].sort((a,b)=>collator.compare(b,a));
  const select=$('#batch-filter');
  select.innerHTML='<option value="">ทุกรุ่น</option>'+batches.map(b=>`<option value="${esc(b)}">${esc(b)}</option>`).join('');
  $('#stat-total').textContent=combined.length.toLocaleString('th-TH');
  $('#stat-batches').textContent=batches.length.toLocaleString('th-TH');
  $('#stat-staff').textContent=staffAlumni.length.toLocaleString('th-TH');
}

function getFiltered(){
  const q=normalize($('#search-input').value);
  const batch=$('#batch-filter').value;
  return combined.filter(x=>{
    const searchable=normalize([x.fullName,x.batch,x.currentPosition,x.occupation,x.organization,x.education,x.graduationYear,x.graduationLevel].join(' '));
    return (!q || searchable.includes(q)) && (!batch || batchLabel(x.batch)===batch);
  });
}

function render(){
  const list=getFiltered();
  $('#stat-visible').textContent=list.length.toLocaleString('th-TH');
  const dir=$('#directory'), empty=$('#empty-state');
  if(!list.length){ dir.innerHTML=''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  const selected=$('#batch-filter').value;
  const groups=new Map();
  list.forEach(x=>{const b=batchLabel(x.batch); if(!groups.has(b))groups.set(b,[]); groups.get(b).push(x)});
  const keys=[...groups.keys()].sort((a,b)=>collator.compare(b,a));
  dir.innerHTML=keys.map(batch=>{
    const members=groups.get(batch);
    return `<section data-batch="${esc(batch)}">
      <div class="flex items-end justify-between gap-3 mb-4">
        <div><p class="text-xs font-bold text-orange-600 uppercase tracking-wider">Class Directory</p><h2 class="text-2xl font-black text-slate-900 mt-1">${esc(batch)}</h2></div>
        <span class="text-xs font-bold bg-orange-50 text-orange-700 border border-orange-100 px-3 py-1.5 rounded-full">${members.length.toLocaleString('th-TH')} คน</span>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">${members.map(cardHtml).join('')}</div>
    </section>`;
  }).join('');
  dir.querySelectorAll('[data-profile-id]').forEach(btn=>btn.addEventListener('click',()=>openProfile(btn.dataset.profileId)));
  $('#print-filter-label').textContent=selected?`รุ่น: ${selected}`:'ทุกรุ่น';
  lucide.createIcons();
}

function cardHtml(x){
  const photo=x.photo||placeholderAvatar(x.fullName);
  const career=x.currentPosition||x.occupation||'';
  const org=x.organization||'';
  return `<button type="button" data-profile-id="${esc(x.id)}" class="alumni-card glass rounded-[2rem] p-5 text-left w-full group">
    <div class="relative"><img src="${esc(photo)}" onerror="this.src='${placeholderAvatar(x.fullName)}'" class="w-full aspect-square rounded-[1.5rem] object-cover bg-slate-100" alt="${esc(x.fullName)}" loading="lazy">${x.source==='staff'?'<span class="absolute top-3 left-3 bg-slate-950/80 text-white text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur">บุคลากร</span>':''}${x.featured?'<span class="absolute top-3 right-3 bg-amber-400 text-amber-950 text-[10px] font-black px-2.5 py-1 rounded-full">โดดเด่น</span>':''}</div>
    <div class="mt-4"><span class="inline-flex text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-full">${esc(batchLabel(x.batch))}</span><h3 class="font-bold text-slate-900 mt-2 group-hover:text-orange-600 transition-colors line-clamp-2">${esc(x.fullName||'-')}</h3>${career?`<p class="text-xs text-slate-600 mt-1 line-clamp-1">${esc(career)}</p>`:''}${org?`<p class="text-[11px] text-slate-400 mt-1 line-clamp-1">${esc(org)}</p>`:''}</div>
  </button>`;
}

function openProfile(id){
  const x=combined.find(r=>String(r.id)===String(id)); if(!x)return;
  $('#profile-photo').src=x.photo||placeholderAvatar(x.fullName); $('#profile-photo').onerror=()=>{$('#profile-photo').src=placeholderAvatar(x.fullName)};
  $('#profile-name').textContent=x.fullName||'-';
  $('#profile-career').textContent=x.currentPosition||x.occupation||'';
  $('#profile-org').textContent=x.organization||'';
  const badges=[`<span class="text-xs font-bold bg-orange-50 text-orange-700 border border-orange-100 px-3 py-1 rounded-full">${esc(batchLabel(x.batch))}</span>`];
  if(x.graduationYear)badges.push(`<span class="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">จบปี ${esc(x.graduationYear)}</span>`);
  if(x.graduationLevel)badges.push(`<span class="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">${esc(x.graduationLevel)}</span>`);
  if(x.source==='staff')badges.push('<span class="text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100 px-3 py-1 rounded-full">บุคลากรปัจจุบัน</span>');
  $('#profile-badges').innerHTML=badges.join('');
  setBlock('#profile-bio-wrap','#profile-bio',x.bio);
  setBlock('#profile-education-wrap','#profile-education',x.education);
  const contact=$('#profile-contact-wrap'); contact.innerHTML='';
  if(x.showContact){
    if(x.phone) contact.innerHTML+=`<a href="tel:${esc(String(x.phone).replace(/[^0-9+]/g,''))}" class="inline-flex items-center gap-2 bg-orange-50 text-orange-700 border border-orange-100 px-4 py-2.5 rounded-xl text-xs font-bold"><i data-lucide="phone" class="w-4 h-4"></i>${esc(x.phone)}</a>`;
    if(x.email) contact.innerHTML+=`<a href="mailto:${esc(x.email)}" class="inline-flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-100 px-4 py-2.5 rounded-xl text-xs font-bold"><i data-lucide="mail" class="w-4 h-4"></i>${esc(x.email)}</a>`;
    if(x.facebookUrl) contact.innerHTML+=`<a href="${esc(x.facebookUrl)}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-100 px-4 py-2.5 rounded-xl text-xs font-bold"><i data-lucide="external-link" class="w-4 h-4"></i>Facebook</a>`;
  }
  contact.classList.toggle('hidden',!contact.children.length);
  const modal=$('#profile-modal'); modal.classList.remove('hidden'); modal.classList.add('flex');
  lucide.createIcons();
}
function setBlock(wrapSel,textSel,value){const wrap=$(wrapSel),el=$(textSel); if(String(value||'').trim()){el.textContent=value;wrap.classList.remove('hidden')}else wrap.classList.add('hidden')}
function closeProfile(){const m=$('#profile-modal');m.classList.add('hidden');m.classList.remove('flex')}
function renderError(msg){ $('#directory').innerHTML=`<div class="glass rounded-[2rem] p-10 text-center text-red-600 font-bold">${esc(msg)}</div>`; }

$('#search-input').addEventListener('input',render);
$('#batch-filter').addEventListener('change',render);
$('#print-btn').addEventListener('click',()=>window.print());
document.querySelectorAll('[data-close-profile]').forEach(x=>x.addEventListener('click',closeProfile));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeProfile()});
lucide.createIcons();
loadData();
