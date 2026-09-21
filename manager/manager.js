const db = window.SCHOOL_SUPABASE;
const bucket = window.SCHOOL_APP_CONFIG?.STORAGE_BUCKET || 'site-media';
let settings = {};
let achievements = [];
let currentStaffKind = 'teachers';
let modalContext = null;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clone = v => JSON.parse(JSON.stringify(v));

function esc(value='') { return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function getPath(obj,path){return path.split('.').reduce((o,k)=>o?.[k],obj)}
function setPath(obj,path,value){const keys=path.split('.');let o=obj;keys.slice(0,-1).forEach(k=>{if(o[k]==null)o[k]=/^\d+$/.test(keys[keys.indexOf(k)+1])?[]:{};o=o[k]});o[keys.at(-1)]=value}
function toast(msg,bad=false){const el=$('#toast');el.textContent=msg;el.className=`fixed right-4 bottom-4 z-[120] max-w-sm px-5 py-3 rounded-2xl shadow-2xl text-sm ${bad?'bg-red-600':'bg-slate-900'} text-white`;el.classList.remove('hidden');setTimeout(()=>el.classList.add('hidden'),2600)}

async function loadDefault(){const r=await fetch('../assets/default-data.json');return r.json()}

async function start(){
  lucide.createIcons();
  if(!db){$('#config-warning').classList.remove('hidden');$('#login-form button').disabled=true;$('#login-form button').classList.add('opacity-50');return}
  const {data:{session}}=await db.auth.getSession();
  if(session) await enterApp(session); else $('#login-screen').classList.remove('hidden');
}

$('#login-form').addEventListener('submit',async e=>{
  e.preventDefault(); const err=$('#login-error');err.classList.add('hidden');
  const {data,error}=await db.auth.signInWithPassword({email:$('#login-email').value.trim(),password:$('#login-password').value});
  if(error){err.textContent=error.message;err.classList.remove('hidden');return}
  await enterApp(data.session);
});

async function enterApp(session){
  const {data:allowed,error}=await db.rpc('is_site_admin');
  if(error||!allowed){await db.auth.signOut();$('#login-error').textContent='บัญชีนี้ไม่มีสิทธิ์ Website Manager';$('#login-error').classList.remove('hidden');return}
  $('#login-screen').classList.add('hidden');$('#app').classList.remove('hidden');
  await loadAll(); bindUI(); renderAll(); lucide.createIcons();
}

async function loadAll(){
  const fallback=await loadDefault(); settings=clone(fallback);
  const [s,a]=await Promise.all([
    db.from('site_settings').select('data,updated_at').eq('id',1).maybeSingle(),
    db.from('achievements').select('*').order('created_at',{ascending:false})
  ]);
  if(s.data?.data) settings=clone(s.data.data);
  achievements=a.data||[];
}

function bindUI(){
  if(document.body.dataset.bound)return; document.body.dataset.bound='1';
  $$('#sidebar-nav [data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  $$('[data-jump]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.jump)));
  $('#save-btn').addEventListener('click',saveSettings);
  $('#logout-btn').addEventListener('click',async()=>{await db.auth.signOut();location.reload()});
  $$('[data-path]').forEach(el=>{
    const event=el.type==='checkbox'?'change':'input';
    el.addEventListener(event,()=>{setPath(settings,el.dataset.path,el.type==='checkbox'?el.checked:el.value);refreshDerived()});
  });
  $$('[data-upload-target]').forEach(el=>el.addEventListener('change',async()=>{if(!el.files?.[0])return;const url=await uploadImage(el.files[0],el.dataset.uploadTarget.replaceAll('.','-'));if(url){setPath(settings,el.dataset.uploadTarget,url);const input=document.querySelector(`[data-path="${el.dataset.uploadTarget}"]`);if(input)input.value=url;toast('อัปโหลดรูปแล้ว — กดบันทึกเว็บไซต์เพื่อเผยแพร่')}}));
  $('#add-banner').addEventListener('click',()=>{settings.promoBanners=settings.promoBanners||[];settings.promoBanners.unshift('');renderBanners()});
  $('#add-staff').addEventListener('click',()=>openStaffEditor());
  $$('.staff-tab').forEach(b=>b.addEventListener('click',()=>{currentStaffKind=b.dataset.staffKind;$$('.staff-tab').forEach(x=>{x.classList.remove('bg-orange-500','text-white');x.classList.add('bg-white/70','text-slate-600')});b.classList.add('bg-orange-500','text-white');b.classList.remove('bg-white/70','text-slate-600');renderStaff()}));
  $('#add-achievement').addEventListener('click',()=>openAchievementEditor());
  $$('[data-close-modal]').forEach(x=>x.addEventListener('click',closeModal));
  $('#apply-json').addEventListener('click',()=>{try{settings=JSON.parse($('#raw-json').value);renderAll();toast('นำ JSON มาใช้แล้ว — อย่าลืมกดบันทึกเว็บไซต์')}catch(e){toast('JSON ไม่ถูกต้อง: '+e.message,true)}});
  $('#copy-json').addEventListener('click',async()=>{await navigator.clipboard.writeText(JSON.stringify(settings,null,2));toast('คัดลอก JSON แล้ว')});
}

function showView(name){
  $$('.panel').forEach(p=>p.classList.toggle('hidden',p.dataset.panel!==name));
  $$('.sidebar-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  const titles={dashboard:'ภาพรวม',general:'ข้อมูลโรงเรียน / โลโก้',visual:'ภาพ / แบนเนอร์',staff:'บุคลากร',content:'เนื้อหาเว็บไซต์',achievements:'ผลงานแห่งความภาคภูมิใจ',advanced:'ขั้นสูง'};
  $('#page-title').textContent=titles[name]||'Website Manager'; if(name==='advanced')$('#raw-json').value=JSON.stringify(settings,null,2);
}

function renderAll(){
  $$('[data-path]').forEach(el=>{const v=getPath(settings,el.dataset.path);if(el.type==='checkbox')el.checked=!!v;else el.value=v??''});
  $('#news-json').value=JSON.stringify(settings.news||[],null,2);$('#events-json').value=JSON.stringify(settings.events||[],null,2);
  $('#news-json').oninput=()=>{try{settings.news=JSON.parse($('#news-json').value)}catch{}};$('#events-json').oninput=()=>{try{settings.events=JSON.parse($('#events-json').value)}catch{}};
  renderBanners();renderStaff();renderAchievements();refreshDerived();$('#raw-json').value=JSON.stringify(settings,null,2);
}

function refreshDerived(){
  $('#dash-students').textContent=getPath(settings,'info.stats.0.value')||'-';$('#dash-staff').textContent=getPath(settings,'info.stats.1.value')||'-';
  $('#dash-teachers').textContent=(settings.teachers?.length||0)+(settings.executives?.length||0)+(settings.specialTeachers?.length||0);$('#dash-achievements').textContent=achievements.length;
  $('#save-status').textContent='มีการแก้ไข — กดบันทึกเพื่อเผยแพร่';
}

async function saveSettings(){
  try{
    // Parse quick JSON editors before save.
    settings.news=JSON.parse($('#news-json').value||'[]');settings.events=JSON.parse($('#events-json').value||'[]');
    const btn=$('#save-btn');btn.disabled=true;$('#save-status').textContent='กำลังบันทึก...';
    const {error}=await db.from('site_settings').upsert({id:1,data:settings,updated_at:new Date().toISOString()},{onConflict:'id'});
    if(error)throw error;$('#save-status').textContent='บันทึกแล้ว '+new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});toast('บันทึกเว็บไซต์เรียบร้อย');$('#raw-json').value=JSON.stringify(settings,null,2);btn.disabled=false;
  }catch(e){$('#save-status').textContent='บันทึกไม่สำเร็จ';$('#save-btn').disabled=false;toast(e.message,true)}
}

function renderBanners(){
  const list=$('#banner-list');const arr=settings.promoBanners||[];
  list.innerHTML=arr.map((url,i)=>`<div class="flex items-center gap-3 p-3 rounded-2xl bg-white/60 border border-white"><div class="w-24 aspect-video bg-slate-100 rounded-xl overflow-hidden flex-shrink-0">${url?`<img src="${esc(url)}" class="w-full h-full object-cover">`:''}</div><input class="field" value="${esc(url)}" data-banner-index="${i}" placeholder="URL รูปแบนเนอร์"><label class="cursor-pointer p-3 rounded-xl bg-slate-100"><input type="file" accept="image/*" class="hidden" data-banner-upload="${i}"><i data-lucide="upload" class="w-4 h-4"></i></label><button class="p-3 rounded-xl bg-red-50 text-red-500" data-banner-delete="${i}"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>`).join('')||'<p class="text-sm text-slate-400">ยังไม่มีแบนเนอร์</p>';
  $$('[data-banner-index]').forEach(el=>el.addEventListener('input',()=>{settings.promoBanners[+el.dataset.bannerIndex]=el.value}));
  $$('[data-banner-delete]').forEach(b=>b.addEventListener('click',()=>{settings.promoBanners.splice(+b.dataset.bannerDelete,1);renderBanners()}));
  $$('[data-banner-upload]').forEach(el=>el.addEventListener('change',async()=>{if(!el.files?.[0])return;const i=+el.dataset.bannerUpload;const url=await uploadImage(el.files[0],'banner');if(url){settings.promoBanners[i]=url;renderBanners()}}));lucide.createIcons();
}

function renderStaff(){
  const list=$('#staff-list');const arr=settings[currentStaffKind]||[];const isExec=currentStaffKind==='executives';
  list.innerHTML=arr.map((p,i)=>`<article class="glass rounded-3xl p-5 flex gap-4 items-center"><img src="${esc(p.img||'')}" class="w-20 h-20 rounded-2xl object-cover bg-slate-100"><div class="min-w-0 flex-1"><h4 class="font-bold truncate">${esc(p.name||'-')}</h4><p class="text-xs text-slate-500 mt-1 line-clamp-2">${esc(isExec?(p.position||''):(p.position||p.department||''))}</p></div><div class="flex flex-col gap-2"><button class="p-2.5 rounded-xl bg-orange-50 text-orange-600" data-edit-staff="${i}"><i data-lucide="pencil" class="w-4 h-4"></i></button><button class="p-2.5 rounded-xl bg-red-50 text-red-500" data-delete-staff="${i}"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></article>`).join('')||'<div class="sm:col-span-2 xl:col-span-3 glass rounded-3xl p-10 text-center text-slate-400">ยังไม่มีบุคลากรในหมวดนี้</div>';
  $$('[data-edit-staff]').forEach(b=>b.addEventListener('click',()=>openStaffEditor(+b.dataset.editStaff)));
  $$('[data-delete-staff]').forEach(b=>b.addEventListener('click',()=>{if(confirm('ลบบุคลากรรายการนี้?')){settings[currentStaffKind].splice(+b.dataset.deleteStaff,1);renderStaff();refreshDerived()}}));lucide.createIcons();
}

function openStaffEditor(index=null){
  const editing=index!==null;const item=editing?clone(settings[currentStaffKind][index]):{name:'',department:'',position:'',img:''};modalContext={type:'staff',index,item};
  $('#modal-title').textContent=editing?'แก้ไขบุคลากร':'เพิ่มบุคลากร';
  $('#editor-form').innerHTML=`<div><label class="label">ชื่อ-นามสกุล</label><input name="name" class="field" value="${esc(item.name)}" required></div><div><label class="label">ตำแหน่ง</label><input name="position" class="field" value="${esc(item.position||'')}"></div><div><label class="label">กลุ่มสาระ/หน้าที่</label><input name="department" class="field" value="${esc(item.department||'')}"></div><div><label class="label">รูปภาพ</label><div class="flex gap-2"><input name="img" class="field" value="${esc(item.img||'')}"><label class="cursor-pointer px-4 py-3 rounded-2xl bg-slate-100 text-xs font-bold"><input id="modal-staff-upload" type="file" accept="image/*" class="hidden">อัปโหลด</label></div></div><button class="w-full bg-orange-500 text-white rounded-2xl py-3 font-bold">บันทึกรายการ</button>`;
  $('#editor-form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);const value={name:f.get('name'),position:f.get('position'),department:f.get('department'),img:f.get('img')};settings[currentStaffKind]=settings[currentStaffKind]||[];if(editing)settings[currentStaffKind][index]=value;else settings[currentStaffKind].unshift(value);closeModal();renderStaff();refreshDerived()};
  $('#modal-staff-upload').onchange=async e=>{if(!e.target.files?.[0])return;const url=await uploadImage(e.target.files[0],'staff');if(url)$('#editor-form [name="img"]').value=url};openModal();
}

function renderAchievements(){
  const list=$('#achievement-list');
  list.innerHTML=achievements.map((x,i)=>`<article class="glass rounded-[2rem] overflow-hidden"><div class="aspect-video bg-slate-100"><img src="${esc(x.image_url||'')}" class="w-full h-full object-cover"></div><div class="p-5"><div class="flex gap-2 items-start justify-between"><div><span class="text-[10px] font-bold text-orange-600">ปี ${esc(x.year||'-')}</span><h4 class="font-bold mt-1 leading-relaxed">${esc(x.title||'')}</h4></div><span class="text-[10px] ${x.published?'bg-green-50 text-green-600':'bg-slate-100 text-slate-500'} px-2 py-1 rounded-full">${x.published?'เผยแพร่':'ซ่อน'}</span></div><div class="flex gap-2 mt-4"><button class="flex-1 py-2 rounded-xl bg-orange-50 text-orange-600 text-xs font-bold" data-edit-ach="${i}">แก้ไข</button><button class="px-3 py-2 rounded-xl bg-red-50 text-red-500" data-delete-ach="${i}"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div></article>`).join('')||'<div class="sm:col-span-2 xl:col-span-3 glass rounded-3xl p-10 text-center text-slate-400">ยังไม่มีผลงาน</div>';
  $$('[data-edit-ach]').forEach(b=>b.addEventListener('click',()=>openAchievementEditor(+b.dataset.editAch)));$$('[data-delete-ach]').forEach(b=>b.addEventListener('click',()=>deleteAchievement(+b.dataset.deleteAch)));$('#dash-achievements').textContent=achievements.length;lucide.createIcons();
}

function openAchievementEditor(index=null){
  const editing=index!==null;const item=editing?clone(achievements[index]):{title:'',year:new Date().toLocaleDateString('th-TH',{year:'numeric'}),image_url:'',description:'',published:true};modalContext={type:'achievement',index,item};$('#modal-title').textContent=editing?'แก้ไขผลงาน':'เพิ่มผลงาน';
  $('#editor-form').innerHTML=`<div><label class="label">ชื่อผลงาน</label><input name="title" class="field" value="${esc(item.title)}" required></div><div><label class="label">ปี</label><input name="year" class="field" value="${esc(item.year||'')}"></div><div><label class="label">รายละเอียด</label><textarea name="description" class="field min-h-24">${esc(item.description||'')}</textarea></div><div><label class="label">รูปภาพ</label><div class="flex gap-2"><input name="image_url" class="field" value="${esc(item.image_url||'')}"><label class="cursor-pointer px-4 py-3 rounded-2xl bg-slate-100 text-xs font-bold"><input id="modal-ach-upload" type="file" accept="image/*" class="hidden">อัปโหลด</label></div></div><label class="flex items-center gap-3 p-3 rounded-2xl bg-slate-50"><input name="published" type="checkbox" class="w-5 h-5 accent-orange-500" ${item.published!==false?'checked':''}><span class="text-sm font-bold">เผยแพร่บนเว็บไซต์</span></label><button class="w-full bg-orange-500 text-white rounded-2xl py-3 font-bold">บันทึกผลงาน</button>`;
  $('#editor-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const row={title:f.get('title'),year:f.get('year'),description:f.get('description'),image_url:f.get('image_url'),published:f.get('published')==='on'};try{let r;if(editing)r=await db.from('achievements').update(row).eq('id',item.id).select().single();else r=await db.from('achievements').insert(row).select().single();if(r.error)throw r.error;if(editing)achievements[index]=r.data;else achievements.unshift(r.data);closeModal();renderAchievements();toast('บันทึกผลงานแล้ว — หน้าแรกจะแสดง 3 รายการล่าสุด')}catch(err){toast(err.message,true)}};
  $('#modal-ach-upload').onchange=async e=>{if(!e.target.files?.[0])return;const url=await uploadImage(e.target.files[0],'achievement');if(url)$('#editor-form [name="image_url"]').value=url};openModal();
}

async function deleteAchievement(index){if(!confirm('ลบผลงานรายการนี้ถาวร?'))return;const item=achievements[index];const {error}=await db.from('achievements').delete().eq('id',item.id);if(error)return toast(error.message,true);achievements.splice(index,1);renderAchievements();toast('ลบผลงานแล้ว')}

function openModal(){const m=$('#editor-modal');m.classList.remove('hidden');m.classList.add('flex');lucide.createIcons()}
function closeModal(){const m=$('#editor-modal');m.classList.add('hidden');m.classList.remove('flex');modalContext=null}

async function uploadImage(file,prefix='media'){
  try{const ext=(file.name.split('.').pop()||'jpg').toLowerCase();const name=`${prefix}/${Date.now()}-${crypto.randomUUID()}.${ext}`;toast('กำลังอัปโหลดรูป...');const {error}=await db.storage.from(bucket).upload(name,file,{cacheControl:'3600',upsert:false});if(error)throw error;const {data}=db.storage.from(bucket).getPublicUrl(name);toast('อัปโหลดรูปเรียบร้อย');return data.publicUrl}catch(e){toast('อัปโหลดไม่สำเร็จ: '+e.message,true);return null}
}

start();
