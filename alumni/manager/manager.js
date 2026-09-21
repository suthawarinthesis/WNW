const db=window.SCHOOL_SUPABASE;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=(v='')=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const collator=new Intl.Collator('th',{numeric:true,sensitivity:'base'});
let rows=[], settings={}, staffAlumni=[], editingId=null, pendingFile=null;

function toast(msg,ok=true){const t=$('#toast');t.textContent=msg;t.className=`fixed bottom-5 right-5 z-[200] px-5 py-3 rounded-2xl shadow-2xl text-sm font-bold ${ok?'bg-slate-950 text-white':'bg-red-600 text-white'}`;t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),2800)}
function normalize(v=''){return String(v).trim().toLowerCase().replace(/\s+/g,' ')}
function photoFallback(){return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="#f1f5f9"/><circle cx="200" cy="150" r="70" fill="#cbd5e1"/><rect x="85" y="235" width="230" height="120" rx="60" fill="#94a3b8"/></svg>`)}

async function init(){
  lucide.createIcons();
  if(!db){showLoginError('ยังไม่ได้ตั้งค่า Supabase');return}
  const {data:{session}}=await db.auth.getSession();
  if(session) enterApp(session); else $('#login-screen').classList.remove('hidden');
  db.auth.onAuthStateChange((_e,s)=>{if(s)enterApp(s)});
}
async function enterApp(session){
  $('#login-screen').classList.add('hidden');$('#app').classList.remove('hidden');
  await Promise.all([loadSettings(),loadRows()]);
  renderAll();
}
function showLoginError(msg){const el=$('#login-error');el.textContent=msg;el.classList.remove('hidden')}
$('#login-form').addEventListener('submit',async e=>{e.preventDefault();showLoginError('');const {error}=await db.auth.signInWithPassword({email:$('#login-email').value.trim(),password:$('#login-password').value});if(error)showLoginError(error.message)});
$('#logout-btn').addEventListener('click',async()=>{await db.auth.signOut();location.reload()});

async function loadSettings(){const {data,error}=await db.from('site_settings').select('data').eq('id',1).maybeSingle();if(error)console.warn(error);settings=data?.data||{};staffAlumni=extractStaff(settings)}
async function loadRows(){const {data,error}=await db.from('alumni').select('*').order('sort_order',{ascending:true}).order('full_name',{ascending:true});if(error){toast('ยังไม่พบตาราง alumni กรุณารัน SQL อัปเกรดก่อน',false);rows=[];return}rows=data||[]}
function extractStaff(s){const out=[];[['executives','คณะผู้บริหาร'],['teachers','ครูและบุคลากร'],['specialTeachers','ครูพิเศษ']].forEach(([key,label])=>(s?.[key]||[]).forEach((p,i)=>{if(p?.isAlumni)out.push({...p,_key:key,_index:i,_label:label})}));return out}

function renderAll(){renderStats();renderFilters();renderRows();renderStaff();lucide.createIcons()}
function renderStats(){
  $('#stat-total').textContent=rows.length.toLocaleString('th-TH');
  $('#stat-published').textContent=rows.filter(x=>x.published).length.toLocaleString('th-TH');
  $('#stat-batches').textContent=new Set(rows.map(x=>String(x.batch||'').trim()).filter(Boolean)).size.toLocaleString('th-TH');
  $('#stat-featured').textContent=rows.filter(x=>x.featured).length.toLocaleString('th-TH');
}
function renderFilters(){const current=$('#batch-filter').value;const batches=[...new Set(rows.map(x=>x.batch).filter(Boolean))].sort((a,b)=>collator.compare(b,a));$('#batch-filter').innerHTML='<option value="">ทุกรุ่น</option>'+batches.map(b=>`<option value="${esc(b)}">${esc(b)}</option>`).join('');$('#batch-filter').value=batches.includes(current)?current:''}
function getFiltered(){const q=normalize($('#search').value),batch=$('#batch-filter').value,status=$('#status-filter').value;return rows.filter(x=>{const hay=normalize([x.full_name,x.batch,x.graduation_year,x.current_position,x.occupation,x.organization,x.education].join(' '));return(!q||hay.includes(q))&&(!batch||x.batch===batch)&&(!status||(status==='published'?x.published:!x.published))})}
function renderRows(){const arr=getFiltered(),box=$('#alumni-list');if(!arr.length){box.innerHTML='<div class="md:col-span-2 xl:col-span-3 glass rounded-[2rem] p-10 text-center text-slate-400">ยังไม่มีข้อมูลที่ตรงกับตัวกรอง</div>';return}box.innerHTML=arr.map(x=>`<article class="glass rounded-[2rem] p-5 flex gap-4 items-start">
  <img src="${esc(x.photo_url||photoFallback())}" onerror="this.src='${photoFallback()}'" class="w-24 h-24 rounded-2xl object-cover bg-slate-100 shrink-0" alt="">
  <div class="min-w-0 flex-1"><div class="flex flex-wrap gap-2 mb-1"><span class="text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-100 px-2 py-1 rounded-full">${esc(x.batch||'ไม่ระบุรุ่น')}</span>${x.featured?'<span class="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-1 rounded-full">ศิษย์เก่าเด่น</span>':''}<span class="text-[10px] font-bold ${x.published?'bg-green-50 text-green-700':'bg-slate-100 text-slate-500'} px-2 py-1 rounded-full">${x.published?'เผยแพร่':'ซ่อน'}</span></div><h3 class="font-bold text-slate-900 line-clamp-2">${esc(x.full_name)}</h3><p class="text-xs text-orange-600 font-semibold mt-1 line-clamp-1">${esc(x.current_position||x.occupation||'')}</p><p class="text-[11px] text-slate-400 mt-1 line-clamp-1">${esc(x.organization||'')}</p></div>
  <div class="flex flex-col gap-2"><button data-edit="${x.id}" class="p-2.5 rounded-xl bg-orange-50 text-orange-600" title="แก้ไข"><i data-lucide="pencil" class="w-4 h-4"></i></button><button data-toggle="${x.id}" class="p-2.5 rounded-xl ${x.published?'bg-slate-100 text-slate-500':'bg-green-50 text-green-600'}" title="${x.published?'ซ่อน':'เผยแพร่'}"><i data-lucide="${x.published?'eye-off':'eye'}" class="w-4 h-4"></i></button><button data-delete="${x.id}" class="p-2.5 rounded-xl bg-red-50 text-red-500" title="ลบ"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>
</article>`).join('');
  $$('[data-edit]').forEach(b=>b.onclick=()=>openEditor(b.dataset.edit));$$('[data-toggle]').forEach(b=>b.onclick=()=>togglePublish(b.dataset.toggle));$$('[data-delete]').forEach(b=>b.onclick=()=>deleteRow(b.dataset.delete));lucide.createIcons();
}
function renderStaff(){const box=$('#staff-alumni-list');box.innerHTML=staffAlumni.map(p=>`<article class="glass rounded-[2rem] p-5 flex gap-4 items-center"><img src="${esc(p.img||photoFallback())}" onerror="this.src='${photoFallback()}'" class="w-20 h-20 rounded-2xl object-cover bg-slate-100"><div class="min-w-0"><span class="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-1 rounded-full">${esc(p.alumniBatch||'ไม่ระบุรุ่น')}</span><h3 class="font-bold mt-2">${esc(p.name||'-')}</h3><p class="text-xs text-slate-500 mt-1">${esc(p.position||p.department||p._label)}</p></div></article>`).join('')||'<div class="md:col-span-2 xl:col-span-3 glass rounded-[2rem] p-10 text-center text-slate-400">ยังไม่มีบุคลากรที่ถูกติ๊กว่าเป็นศิษย์เก่า</div>'}

function openEditor(id=null){
  editingId=id;pendingFile=null;const x=id?rows.find(r=>r.id===id):null;$('#editor-title').textContent=x?'แก้ไขศิษย์เก่า':'เพิ่มศิษย์เก่า';const f=$('#editor-form');f.reset();
  f.elements.id.value=x?.id||'';f.elements.full_name.value=x?.full_name||'';f.elements.photo_url.value=x?.photo_url||'';f.elements.batch.value=x?.batch||'';f.elements.graduation_year.value=x?.graduation_year||'';f.elements.graduation_level.value=x?.graduation_level||'';f.elements.current_position.value=x?.current_position||'';f.elements.occupation.value=x?.occupation||'';f.elements.organization.value=x?.organization||'';f.elements.education.value=x?.education||'';f.elements.bio.value=x?.bio||'';f.elements.phone.value=x?.phone||'';f.elements.email.value=x?.email||'';f.elements.facebook_url.value=x?.facebook_url||'';f.elements.show_contact.checked=!!x?.show_contact;f.elements.featured.checked=!!x?.featured;f.elements.published.checked=x?!!x.published:true;f.elements.sort_order.value=x?.sort_order??0;
  setPreview(x?.photo_url||'');$('#form-status').classList.add('hidden');const m=$('#editor-modal');m.classList.remove('hidden');m.classList.add('flex');lucide.createIcons();
}
function closeEditor(){const m=$('#editor-modal');m.classList.add('hidden');m.classList.remove('flex');pendingFile=null}
$$('[data-close]').forEach(b=>b.addEventListener('click',closeEditor));$('#add-btn').addEventListener('click',()=>openEditor());
function setPreview(url){const img=$('#photo-preview'),ph=$('#photo-placeholder');if(url){img.src=url;img.classList.remove('hidden');ph.classList.add('hidden')}else{img.src='';img.classList.add('hidden');ph.classList.remove('hidden')}}
$('#photo-file').addEventListener('change',e=>{pendingFile=e.target.files?.[0]||null;if(pendingFile)setPreview(URL.createObjectURL(pendingFile))});
async function uploadPhoto(file){if(!file)return $('#editor-form').elements.photo_url.value||'';const ext=(file.name.split('.').pop()||'jpg').toLowerCase();const path=`alumni/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.${ext}`;const bucket=window.SCHOOL_APP_CONFIG?.STORAGE_BUCKET||'site-media';const {error}=await db.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type||undefined});if(error)throw error;return db.storage.from(bucket).getPublicUrl(path).data.publicUrl}
$('#editor-form').addEventListener('submit',async e=>{e.preventDefault();const status=$('#form-status');status.className='text-xs rounded-xl p-3 bg-orange-50 text-orange-700';status.textContent='กำลังบันทึก...';status.classList.remove('hidden');try{const f=e.currentTarget;const photo=await uploadPhoto(pendingFile);const payload={full_name:f.elements.full_name.value.trim(),photo_url:photo,batch:f.elements.batch.value.trim(),graduation_year:f.elements.graduation_year.value.trim(),graduation_level:f.elements.graduation_level.value.trim(),current_position:f.elements.current_position.value.trim(),occupation:f.elements.occupation.value.trim(),organization:f.elements.organization.value.trim(),education:f.elements.education.value.trim(),phone:f.elements.phone.value.trim(),email:f.elements.email.value.trim(),facebook_url:f.elements.facebook_url.value.trim(),bio:f.elements.bio.value.trim(),show_contact:f.elements.show_contact.checked,featured:f.elements.featured.checked,published:f.elements.published.checked,sort_order:Number(f.elements.sort_order.value||0)};let error;if(editingId){({error}=await db.from('alumni').update(payload).eq('id',editingId))}else{({error}=await db.from('alumni').insert(payload))}if(error)throw error;await loadRows();renderAll();closeEditor();toast('บันทึกข้อมูลศิษย์เก่าแล้ว')}catch(err){console.error(err);status.className='text-xs rounded-xl p-3 bg-red-50 text-red-600';status.textContent='บันทึกไม่สำเร็จ: '+(err.message||err)}});

async function togglePublish(id){const x=rows.find(r=>r.id===id);if(!x)return;const {error}=await db.from('alumni').update({published:!x.published}).eq('id',id);if(error)return toast(error.message,false);await loadRows();renderAll();toast(x.published?'ซ่อนจากทำเนียบแล้ว':'เผยแพร่แล้ว')}
async function deleteRow(id){const x=rows.find(r=>r.id===id);if(!x||!confirm(`ลบ ${x.full_name} ออกจากฐานข้อมูลศิษย์เก่าหรือไม่?`))return;const {error}=await db.from('alumni').delete().eq('id',id);if(error)return toast(error.message,false);await loadRows();renderAll();toast('ลบข้อมูลแล้ว')}

$('#search').addEventListener('input',renderRows);$('#batch-filter').addEventListener('change',renderRows);$('#status-filter').addEventListener('change',renderRows);
$('#export-btn').addEventListener('click',()=>{const data=getFiltered();const cols=[['full_name','ชื่อ-นามสกุล'],['batch','รุ่น'],['graduation_year','ปีจบ'],['graduation_level','ระดับที่จบ'],['current_position','ตำแหน่ง'],['occupation','อาชีพ'],['organization','หน่วยงาน'],['phone','โทรศัพท์'],['email','อีเมล'],['published','เผยแพร่']];const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;const csv='\ufeff'+cols.map(c=>q(c[1])).join(',')+'\n'+data.map(r=>cols.map(c=>q(r[c[0]])).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=`alumni-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href)});

$$('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>{const view=btn.dataset.view;$$('.nav-btn').forEach(x=>{x.classList.remove('bg-orange-500','text-white');x.classList.add('hover:bg-white/5')});btn.classList.add('bg-orange-500','text-white');btn.classList.remove('hover:bg-white/5');$('#panel-directory').classList.toggle('hidden',view!=='directory');$('#panel-staff-alumni').classList.toggle('hidden',view!=='staff-alumni');$('#add-btn').classList.toggle('hidden',view!=='directory');$('#page-title').textContent=view==='directory'?'รายชื่อศิษย์เก่า':'บุคลากรที่เป็นศิษย์เก่า';$('#page-subtitle').textContent=view==='directory'?'เพิ่ม แก้ไข ลบ และจัดการการเผยแพร่':'ข้อมูลนี้เชื่อมจาก Website Manager อัตโนมัติ'}));

document.addEventListener('keydown',e=>{if(e.key==='Escape')closeEditor()});
init();
