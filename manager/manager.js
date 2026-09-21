const db = window.SCHOOL_SUPABASE;
const bucket = window.SCHOOL_APP_CONFIG?.STORAGE_BUCKET || 'site-media';
let settings = {};
let achievements = [];
let currentStaffKind = 'teachers';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clone = v => JSON.parse(JSON.stringify(v));
const esc = (value='') => String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const getPath = (obj,path) => path.split('.').reduce((o,k)=>o?.[k],obj);
function setPath(obj,path,value){const keys=path.split('.');let o=obj;keys.slice(0,-1).forEach((k,i)=>{if(o[k]==null)o[k]=/^\d+$/.test(keys[i+1])?[]:{};o=o[k]});o[keys.at(-1)]=value}
function toast(msg,bad=false){const el=$('#toast');el.textContent=msg;el.className=`fixed right-4 bottom-4 z-[120] max-w-sm px-5 py-3 rounded-2xl shadow-2xl text-sm ${bad?'bg-red-600':'bg-slate-900'} text-white`;el.classList.remove('hidden');setTimeout(()=>el.classList.add('hidden'),2800)}
function markDirty(){if($('#save-status'))$('#save-status').textContent='มีการแก้ไข — กด “บันทึกเว็บไซต์” เพื่อเผยแพร่'}
async function loadDefault(){const r=await fetch('../assets/default-data.json');return r.json()}

const iconOptions=[['users','ผู้คน'],['book-open','หนังสือ'],['calendar','ปฏิทิน'],['bell','ระฆัง'],['sun','ดวงอาทิตย์'],['moon','พระจันทร์'],['clock','นาฬิกา'],['graduation-cap','การศึกษา'],['monitor-play','สื่อการเรียน'],['book','ตำรา'],['scroll-text','คัมภีร์ / เอกสาร'],['file-text','ไฟล์เอกสาร'],['school','โรงเรียน'],['heart','หัวใจ'],['award','รางวัล'],['star','ดาว'],['link','ลิงก์'],['globe','เว็บไซต์'],['map','แผนที่'],['phone','โทรศัพท์'],['mail','อีเมล'],['languages','ภาษา']];
const colorOptions=[
  ['orange','ส้ม','bg-orange-100','text-orange-600'],['blue','น้ำเงิน','bg-blue-100','text-blue-600'],['green','เขียว','bg-green-100','text-green-600'],['red','แดง','bg-red-100','text-red-600'],['amber','เหลือง','bg-amber-100','text-amber-600'],['purple','ม่วง','bg-purple-100','text-purple-600']
];
const badgeColors={red:'bg-red-100 text-red-600',green:'bg-green-100 text-green-600',blue:'bg-blue-100 text-blue-600',orange:'bg-orange-100 text-orange-600',purple:'bg-purple-100 text-purple-600',amber:'bg-amber-100 text-amber-600'};
const collectionSchemas={
  news:{title:'ข่าวประชาสัมพันธ์',empty:'ยังไม่มีข่าวประชาสัมพันธ์',summary:x=>`${x.date||''} ${x.monthYear||''} • ${x.type||'ข่าว'} • ${x.title||''}`,defaults:{date:'',monthYear:'',type:'ข่าว',typeColor:'bg-orange-100 text-orange-600',title:'',url:'',published:true},fields:[
    {name:'date',label:'วันที่',placeholder:'เช่น 5',required:true},{name:'monthYear',label:'เดือน / ปี',placeholder:'เช่น มี.ค. 69',required:true},{name:'type',label:'หมวดข่าว',placeholder:'เช่น รับสมัคร / กิจกรรม',required:true},{name:'typeColor',label:'สีป้ายหมวด',type:'badgeColor'},{name:'title',label:'หัวข้อข่าว',type:'textarea',required:true},{name:'url',label:'ลิงก์รายละเอียด (ถ้ามี)',placeholder:'https://...'},{name:'published',label:'แสดงข่าวนี้บนเว็บไซต์',type:'checkbox'}]},
  events:{title:'กิจกรรม',empty:'ยังไม่มีกิจกรรม',summary:x=>`${x.date||''} • ${x.title||''} • ${x.time||''}`,defaults:{date:'',title:'',time:'',url:'',published:true},fields:[{name:'date',label:'วันที่ / ช่วงวันที่',placeholder:'เช่น 15 มีนาคม',required:true},{name:'title',label:'ชื่อกิจกรรม',required:true},{name:'time',label:'เวลา',placeholder:'เช่น 08:00 - 12:00'},{name:'url',label:'ลิงก์รายละเอียด (ถ้ามี)'},{name:'published',label:'แสดงกิจกรรมนี้บนเว็บไซต์',type:'checkbox'}]},
  'examStats.naktham':{title:'สถิติแผนกธรรม',empty:'ยังไม่มีสถิติ',summary:x=>`${x.name||''} — ผ่าน ${x.passRate??0}%`,defaults:{name:'',passRate:0,published:true},fields:[{name:'name',label:'ชื่อระดับ',required:true},{name:'passRate',label:'อัตราสอบผ่าน (%)',type:'number',min:0,max:100,required:true},{name:'published',label:'แสดงบนเว็บไซต์',type:'checkbox'}]},
  'examStats.pali':{title:'สถิติแผนกบาลี',empty:'ยังไม่มีสถิติ',summary:x=>`${x.name||''} — ผ่าน ${x.passRate??0}%`,defaults:{name:'',passRate:0,published:true},fields:[{name:'name',label:'ชื่อระดับ',required:true},{name:'passRate',label:'อัตราสอบผ่าน (%)',type:'number',min:0,max:100,required:true},{name:'published',label:'แสดงบนเว็บไซต์',type:'checkbox'}]},
  routines:{title:'กิจวัตรประจำวัน',empty:'ยังไม่มีกิจวัตร',summary:x=>`${x.time||''} • ${x.task||''}`,defaults:{time:'',task:'',icon:'clock',published:true},fields:[{name:'time',label:'เวลา',placeholder:'เช่น 04:30 น.',required:true},{name:'task',label:'กิจวัตร',required:true},{name:'icon',label:'ไอคอน',type:'icon'},{name:'published',label:'แสดงบนเว็บไซต์',type:'checkbox'}]},
  curriculums:{title:'แผนการเรียน',empty:'ยังไม่มีแผนการเรียน',summary:x=>`${x.title||''} • ${x.subtitle||''}`,defaults:{title:'',subtitle:'',desc:'',icon:'book',color:'bg-orange-100 text-orange-600',published:true},fields:[{name:'title',label:'ชื่อแผนการเรียน',required:true},{name:'subtitle',label:'คำอธิบายสั้น'},{name:'desc',label:'รายละเอียด',type:'textarea'},{name:'icon',label:'ไอคอน',type:'icon'},{name:'color',label:'สีประจำกล่อง',type:'boxColor'},{name:'published',label:'แสดงบนเว็บไซต์',type:'checkbox'}]},
  quickLinks:{title:'E-Services / เมนูลัด',empty:'ยังไม่มีเมนูลัด',summary:x=>`${x.label||''} • ${x.url||'#'}`,defaults:{icon:'link',label:'',bg:'bg-orange-100',text:'text-orange-600',url:'#',published:true},fields:[{name:'label',label:'ชื่อเมนู',required:true},{name:'url',label:'ลิงก์ปลายทาง',placeholder:'https://... หรือ #'},{name:'icon',label:'ไอคอน',type:'icon'},{name:'colorPicker',label:'สีเมนู',type:'quickColor'},{name:'published',label:'แสดงบนเว็บไซต์',type:'checkbox'}]},
  documents:{title:'เอกสารดาวน์โหลด',empty:'ยังไม่มีเอกสาร',summary:x=>`${x.title||''} • ${x.type||''} ${x.size?`• ${x.size}`:''}`,defaults:{title:'',size:'',type:'PDF',url:'',published:true},fields:[{name:'title',label:'ชื่อเอกสาร',required:true},{name:'type',label:'ประเภทไฟล์',placeholder:'PDF / DOCX / XLSX'},{name:'size',label:'ขนาดไฟล์',placeholder:'เช่น 1.2 MB'},{name:'url',label:'ไฟล์ / ลิงก์ดาวน์โหลด',type:'fileUpload',placeholder:'https://...'},{name:'published',label:'แสดงบนเว็บไซต์',type:'checkbox'}]}
};

async function start(){
  lucide.createIcons();
  if(!db){$('#config-warning').classList.remove('hidden');$('#login-form button').disabled=true;$('#login-form button').classList.add('opacity-50');return}
  const {data:{session}}=await db.auth.getSession();
  if(session)await enterApp(session); else $('#login-screen').classList.remove('hidden');
}

$('#login-form').addEventListener('submit',async e=>{
  e.preventDefault();const err=$('#login-error');err.classList.add('hidden');
  const {data,error}=await db.auth.signInWithPassword({email:$('#login-email').value.trim(),password:$('#login-password').value});
  if(error){err.textContent=error.message;err.classList.remove('hidden');return}await enterApp(data.session);
});

async function enterApp(session){
  if(!session?.user||session.user.is_anonymous){await db.auth.signOut();showLoginError('กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลที่สร้างใน Supabase Authentication');return}
  const {data:allowed,error}=await db.rpc('is_site_admin');
  if(error||!allowed){await db.auth.signOut();showLoginError('Supabase ยังไม่ได้เปิดโหมด Authentication Admin กรุณารันไฟล์ supabase/authentication-admin-mode.sql');return}
  $('#login-screen').classList.add('hidden');$('#app').classList.remove('hidden');
  $('#manager-email').textContent=session.user.email||'-';$('#manager-user-id').textContent=session.user.id||'-';
  const ref=(window.SCHOOL_APP_CONFIG?.SUPABASE_URL||'').match(/^https:\/\/([^.]+)\.supabase\.co/i)?.[1];if(ref)$('#supabase-auth-link').href=`https://supabase.com/dashboard/project/${ref}/auth/users`;
  await loadAll();bindUI();renderAll();lucide.createIcons();
}
function showLoginError(msg){$('#login-error').textContent=msg;$('#login-error').classList.remove('hidden')}

async function loadAll(){
  const fallback=await loadDefault();settings=clone(fallback);
  const [s,a]=await Promise.all([db.from('site_settings').select('data,updated_at').eq('id',1).maybeSingle(),db.from('achievements').select('*').order('created_at',{ascending:false})]);
  if(s.data?.data)settings=mergeDefaults(fallback,s.data.data);if(settings.introPage?.subtitle)settings.introPage.subtitle=String(settings.introPage.subtitle).replace(/<br\s*\/?>/gi,'\n');achievements=a.data||[];
}
function mergeDefaults(base,incoming){
  if(Array.isArray(base))return Array.isArray(incoming)?clone(incoming):clone(base);
  if(base&&typeof base==='object'){const out=clone(base);if(incoming&&typeof incoming==='object')Object.keys(incoming).forEach(k=>{out[k]=(k in base)?mergeDefaults(base[k],incoming[k]):clone(incoming[k])});return out}
  return incoming===undefined?base:incoming;
}

function bindUI(){
  if(document.body.dataset.bound)return;document.body.dataset.bound='1';
  $$('#sidebar-nav [data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));$$('[data-jump]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.jump)));
  $('#save-btn').addEventListener('click',saveSettings);$('#logout-btn').addEventListener('click',async()=>{await db.auth.signOut();location.reload()});
  bindPathInputs();
  $('#add-banner').addEventListener('click',()=>{settings.promoBanners=settings.promoBanners||[];settings.promoBanners.push('');renderBanners();markDirty()});
  $('#add-staff').addEventListener('click',()=>openStaffEditor());$$('.staff-tab').forEach(b=>b.addEventListener('click',()=>{currentStaffKind=b.dataset.staffKind;$$('.staff-tab').forEach(x=>{x.classList.remove('bg-orange-500','text-white');x.classList.add('bg-white/70','text-slate-600')});b.classList.add('bg-orange-500','text-white');b.classList.remove('bg-white/70','text-slate-600');renderStaff()}));
  $('#add-achievement').addEventListener('click',()=>openAchievementEditor());$$('[data-add-collection]').forEach(b=>b.addEventListener('click',()=>openCollectionEditor(b.dataset.addCollection)));
  $$('[data-close-modal]').forEach(x=>x.addEventListener('click',closeModal));
}
function bindPathInputs(){
  $$('[data-path]').forEach(el=>{const event=el.type==='checkbox'?'change':'input';el.addEventListener(event,()=>{let v=el.type==='checkbox'?el.checked:el.value;if(el.type==='number'&&v!=='')v=Number(v);setPath(settings,el.dataset.path,v);refreshDerived();markDirty()})});
  $$('[data-upload-target]').forEach(el=>el.addEventListener('change',async()=>{if(!el.files?.[0])return;const url=await uploadFile(el.files[0],el.dataset.uploadTarget.replaceAll('.','-'));if(url){setPath(settings,el.dataset.uploadTarget,url);const input=document.querySelector(`[data-path="${el.dataset.uploadTarget}"]`);if(input)input.value=url;markDirty()}}));
}

function showView(name){
  $$('.panel').forEach(p=>p.classList.toggle('hidden',p.dataset.panel!==name));$$('.sidebar-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  const titles={dashboard:'ภาพรวม',general:'ข้อมูลโรงเรียน',visual:'หน้าแรก / แบนเนอร์',staff:'บุคลากร',news:'ข่าวประชาสัมพันธ์ / กิจกรรม',academic:'ข้อมูลวิชาการ',services:'บริการ / ลิงก์ / เอกสาร',achievements:'ผลงานแห่งความภาคภูมิใจ',admins:'บัญชีผู้ดูแลระบบ'};$('#page-title').textContent=titles[name]||'Website Manager';
}

function renderAll(){
  $$('[data-path]').forEach(el=>{let v=getPath(settings,el.dataset.path);if(el.type==='checkbox')el.checked=!!v;else if(el.type==='datetime-local')el.value=String(v||'').slice(0,16);else el.value=v??''});
  renderBanners();renderStaff();Object.keys(collectionSchemas).forEach(renderCollection);renderAchievements();refreshDerived(false);
}
function refreshDerived(dirty=true){
  $('#dash-students').textContent=getPath(settings,'info.stats.0.value')||'-';$('#dash-staff').textContent=getPath(settings,'info.stats.1.value')||'-';$('#dash-teachers').textContent=(settings.teachers?.length||0)+(settings.executives?.length||0)+(settings.specialTeachers?.length||0);$('#dash-achievements').textContent=achievements.length;if(dirty)markDirty();
}

async function saveSettings(){
  const btn=$('#save-btn');try{btn.disabled=true;$('#save-status').textContent='กำลังบันทึก...';const {error}=await db.from('site_settings').upsert({id:1,data:settings,updated_at:new Date().toISOString()},{onConflict:'id'});if(error)throw error;$('#save-status').textContent='บันทึกแล้ว '+new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});toast('บันทึกและเผยแพร่ข้อมูลเรียบร้อย')}
  catch(e){$('#save-status').textContent='บันทึกไม่สำเร็จ';toast(e.message,true)}finally{btn.disabled=false}
}

function renderBanners(){
  const list=$('#banner-list'),arr=settings.promoBanners||[];
  list.innerHTML=arr.map((url,i)=>`<div class="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-2xl bg-white/60 border border-white"><div class="w-full sm:w-28 aspect-video bg-slate-100 rounded-xl overflow-hidden shrink-0">${url?`<img src="${esc(url)}" class="w-full h-full object-cover">`:''}</div><input class="field flex-1" value="${esc(url)}" data-banner-index="${i}" placeholder="URL รูป หรือกดอัปโหลด"><label class="cursor-pointer px-3 py-3 rounded-xl bg-slate-100 text-xs font-bold text-center"><input type="file" accept="image/*" class="hidden" data-banner-upload="${i}">อัปโหลด</label><div class="flex gap-2"><button class="btn-secondary" data-banner-up="${i}" ${i===0?'disabled':''}>↑</button><button class="btn-secondary" data-banner-down="${i}" ${i===arr.length-1?'disabled':''}>↓</button><button class="px-3 py-2 rounded-xl bg-red-50 text-red-500" data-banner-delete="${i}"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div>`).join('')||'<div class="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-400">ยังไม่มีแบนเนอร์</div>';
  $$('[data-banner-index]').forEach(el=>el.addEventListener('input',()=>{settings.promoBanners[+el.dataset.bannerIndex]=el.value;markDirty()}));$$('[data-banner-delete]').forEach(b=>b.addEventListener('click',()=>{if(confirm('ลบแบนเนอร์นี้?')){settings.promoBanners.splice(+b.dataset.bannerDelete,1);renderBanners();markDirty()}}));
  $$('[data-banner-up]').forEach(b=>b.addEventListener('click',()=>moveArrayItem(settings.promoBanners,+b.dataset.bannerUp,-1,renderBanners)));$$('[data-banner-down]').forEach(b=>b.addEventListener('click',()=>moveArrayItem(settings.promoBanners,+b.dataset.bannerDown,1,renderBanners)));
  $$('[data-banner-upload]').forEach(el=>el.addEventListener('change',async()=>{if(!el.files?.[0])return;const i=+el.dataset.bannerUpload,url=await uploadFile(el.files[0],'banner');if(url){settings.promoBanners[i]=url;renderBanners();markDirty()}}));lucide.createIcons();
}
function moveArrayItem(arr,index,dir,rerender){const to=index+dir;if(to<0||to>=arr.length)return;[arr[index],arr[to]]=[arr[to],arr[index]];rerender();markDirty()}

function renderStaff(){
  const list=$('#staff-list'),arr=settings[currentStaffKind]||[],isExec=currentStaffKind==='executives';
  list.innerHTML=arr.map((p,i)=>`<article class="glass rounded-3xl p-5 flex gap-4 items-center"><img src="${esc(p.img||'')}" class="w-20 h-20 rounded-2xl object-cover bg-slate-100"><div class="min-w-0 flex-1"><h4 class="font-bold truncate">${esc(p.name||'-')}</h4><p class="text-xs text-slate-500 mt-1 line-clamp-2">${esc(isExec?(p.position||''):(p.position||p.department||''))}</p></div><div class="flex flex-col gap-2"><button class="p-2.5 rounded-xl bg-orange-50 text-orange-600" data-edit-staff="${i}"><i data-lucide="pencil" class="w-4 h-4"></i></button><button class="p-2.5 rounded-xl bg-red-50 text-red-500" data-delete-staff="${i}"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></article>`).join('')||'<div class="md:col-span-2 xl:col-span-3 glass rounded-3xl p-10 text-center text-slate-400">ยังไม่มีบุคลากรในหมวดนี้</div>';
  $$('[data-edit-staff]').forEach(b=>b.addEventListener('click',()=>openStaffEditor(+b.dataset.editStaff)));$$('[data-delete-staff]').forEach(b=>b.addEventListener('click',()=>{if(confirm('ลบบุคลากรรายการนี้?')){settings[currentStaffKind].splice(+b.dataset.deleteStaff,1);renderStaff();refreshDerived();markDirty()}}));lucide.createIcons();
}
function openStaffEditor(index=null){
  const editing=index!==null,item=editing?clone(settings[currentStaffKind][index]):{name:'',department:'',position:'',img:''};$('#modal-title').textContent=editing?'แก้ไขบุคลากร':'เพิ่มบุคลากร';$('#modal-help').textContent='กรอกข้อมูลแล้วกดบันทึกรายการ จากนั้นกด “บันทึกเว็บไซต์” ด้านบนอีกครั้งเพื่อเผยแพร่';
  $('#editor-form').innerHTML=`<div><label class="label">ชื่อ-นามสกุล</label><input name="name" class="field" value="${esc(item.name)}" required></div><div><label class="label">ตำแหน่ง</label><input name="position" class="field" value="${esc(item.position||'')}"></div><div><label class="label">กลุ่มสาระ / หน้าที่</label><input name="department" class="field" value="${esc(item.department||'')}"></div><div><label class="label">รูปภาพ</label><div class="flex gap-2"><input name="img" class="field" value="${esc(item.img||'')}" placeholder="URL รูป หรือกดอัปโหลด"><label class="cursor-pointer px-4 py-3 rounded-2xl bg-slate-100 text-xs font-bold"><input id="modal-staff-upload" type="file" accept="image/*" class="hidden">อัปโหลด</label></div></div><button class="w-full bg-orange-500 text-white rounded-2xl py-3 font-bold">บันทึกรายการ</button>`;
  $('#editor-form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget),value={name:f.get('name'),position:f.get('position'),department:f.get('department'),img:f.get('img')};settings[currentStaffKind]=settings[currentStaffKind]||[];if(editing)settings[currentStaffKind][index]=value;else settings[currentStaffKind].push(value);closeModal();renderStaff();refreshDerived();markDirty()};
  $('#modal-staff-upload').onchange=async e=>{if(!e.target.files?.[0])return;const url=await uploadFile(e.target.files[0],'staff');if(url)$('#editor-form [name="img"]').value=url};openModal();
}

function collectionContainerId(path){return 'collection-'+path.replaceAll('.','-')}
function renderCollection(path){
  const schema=collectionSchemas[path],container=$('#'+collectionContainerId(path));if(!schema||!container)return;const arr=getPath(settings,path)||[];
  container.innerHTML=arr.map((item,i)=>`<div class="flex items-center gap-3 rounded-2xl border border-white bg-white/60 p-4"><div class="w-9 h-9 rounded-xl ${item.published===false?'bg-slate-100 text-slate-400':'bg-orange-50 text-orange-600'} flex items-center justify-center shrink-0"><i data-lucide="${item.published===false?'eye-off':'check-circle-2'}" class="w-4 h-4"></i></div><div class="min-w-0 flex-1"><p class="text-sm font-bold text-slate-800 line-clamp-2">${esc(schema.summary(item))}</p><p class="text-[10px] mt-1 ${item.published===false?'text-slate-400':'text-green-600'}">${item.published===false?'ซ่อนจากเว็บไซต์':'แสดงบนเว็บไซต์'}</p></div><div class="flex gap-1 shrink-0"><button class="btn-secondary !px-2" data-col-up="${path}|${i}" title="เลื่อนขึ้น">↑</button><button class="btn-secondary !px-2" data-col-down="${path}|${i}" title="เลื่อนลง">↓</button><button class="p-2.5 rounded-xl bg-orange-50 text-orange-600" data-col-edit="${path}|${i}"><i data-lucide="pencil" class="w-4 h-4"></i></button><button class="p-2.5 rounded-xl bg-red-50 text-red-500" data-col-delete="${path}|${i}"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div>`).join('')||`<div class="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-400">${esc(schema.empty)}</div>`;
  $$(`[data-col-edit^="${path}|"]`).forEach(b=>b.addEventListener('click',()=>openCollectionEditor(path,Number(b.dataset.colEdit.split('|')[1]))));
  $$(`[data-col-delete^="${path}|"]`).forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.colDelete.split('|')[1]);if(confirm('ลบรายการนี้?')){arr.splice(i,1);renderCollection(path);markDirty()}}));
  $$(`[data-col-up^="${path}|"]`).forEach(b=>b.addEventListener('click',()=>moveCollection(path,Number(b.dataset.colUp.split('|')[1]),-1)));$$(`[data-col-down^="${path}|"]`).forEach(b=>b.addEventListener('click',()=>moveCollection(path,Number(b.dataset.colDown.split('|')[1]),1)));lucide.createIcons();
}
function moveCollection(path,index,dir){const arr=getPath(settings,path)||[],to=index+dir;if(to<0||to>=arr.length)return;[arr[index],arr[to]]=[arr[to],arr[index]];renderCollection(path);markDirty()}
function openCollectionEditor(path,index=null){
  const schema=collectionSchemas[path];if(!schema)return;const arr=getPath(settings,path)||[];const editing=index!==null,item=editing?clone(arr[index]):clone(schema.defaults);$('#modal-title').textContent=(editing?'แก้ไข':'เพิ่ม')+schema.title;$('#modal-help').textContent='กรอกข้อมูลตามช่อง ไม่ต้องแก้โค้ดหรือ JSON';
  $('#editor-form').innerHTML=schema.fields.map(f=>fieldHtml(f,item,path)).join('')+`<button class="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-2xl py-3 font-bold">${editing?'บันทึกการแก้ไข':'เพิ่มรายการ'}</button>`;
  hydrateSpecialFields(item);$$('[data-modal-file-upload]').forEach(inp=>inp.addEventListener('change',async()=>{if(!inp.files?.[0])return;const url=await uploadFile(inp.files[0],inp.dataset.modalFileUpload||'document');if(url){const target=$('#editor-form').elements[inp.dataset.targetName];if(target)target.value=url}}));$('#editor-form').onsubmit=e=>{e.preventDefault();const form=e.currentTarget,next=clone(item);schema.fields.forEach(f=>{if(f.type==='quickColor')return;const el=form.elements[f.name];if(!el)return;let v=f.type==='checkbox'?el.checked:el.value;if(f.type==='number'&&v!=='')v=Number(v);next[f.name]=v});if(path==='quickLinks'){const color=form.elements.colorPicker.value;const found=colorOptions.find(x=>x[0]===color)||colorOptions[0];next.bg=found[2];next.text=found[3]};if(!getPath(settings,path))setPath(settings,path,[]);const target=getPath(settings,path);if(editing)target[index]=next;else target.push(next);closeModal();renderCollection(path);markDirty()};openModal();
}
function fieldHtml(f,item,path){
  const val=item[f.name]??'';if(f.type==='textarea')return `<div><label class="label">${f.label}</label><textarea name="${f.name}" class="field min-h-24" ${f.required?'required':''}>${esc(val)}</textarea></div>`;
  if(f.type==='checkbox')return `<label class="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100"><input name="${f.name}" type="checkbox" class="w-5 h-5 accent-orange-500" ${val!==false?'checked':''}><span class="text-sm font-bold">${f.label}</span></label>`;
  if(f.type==='icon')return `<div><label class="label">${f.label}</label><select name="${f.name}" class="field">${iconOptions.map(([value,label])=>`<option value="${value}" ${val===value?'selected':''}>${label}</option>`).join('')}</select></div>`;
  if(f.type==='badgeColor'){const key=Object.entries(badgeColors).find(([,cls])=>cls===val)?.[0]||'orange';return `<div><label class="label">${f.label}</label><select name="${f.name}" class="field">${Object.entries({orange:'ส้ม',red:'แดง',green:'เขียว',blue:'น้ำเงิน',purple:'ม่วง',amber:'เหลือง'}).map(([k,n])=>`<option value="${badgeColors[k]}" ${key===k?'selected':''}>${n}</option>`).join('')}</select></div>`}
  if(f.type==='boxColor'){return `<div><label class="label">${f.label}</label><select name="${f.name}" class="field">${colorOptions.map(x=>`<option value="${x[2]} ${x[3]}" ${val===`${x[2]} ${x[3]}`?'selected':''}>${x[1]}</option>`).join('')}</select></div>`}
  if(f.type==='quickColor'){const current=colorOptions.find(x=>x[2]===item.bg&&x[3]===item.text)?.[0]||'orange';return `<div><label class="label">${f.label}</label><select name="colorPicker" class="field">${colorOptions.map(x=>`<option value="${x[0]}" ${current===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></div>`}
  return `<div><label class="label">${f.label}</label><input name="${f.name}" type="${f.type||'text'}" class="field" value="${esc(val)}" placeholder="${esc(f.placeholder||'')}" ${f.required?'required':''} ${f.min!==undefined?`min="${f.min}"`:''} ${f.max!==undefined?`max="${f.max}"`:''}></div>`;
}
function hydrateSpecialFields(){lucide.createIcons()}

function renderAchievements(){
  const list=$('#achievement-list');list.innerHTML=achievements.map((x,i)=>`<article class="glass rounded-[2rem] overflow-hidden"><div class="aspect-video bg-slate-100">${x.image_url?`<img src="${esc(x.image_url)}" class="w-full h-full object-cover">`:''}</div><div class="p-5"><div class="flex gap-2 items-start justify-between"><div><span class="text-[10px] font-bold text-orange-600">ปี ${esc(x.year||'-')}</span><h4 class="font-bold mt-1 leading-relaxed">${esc(x.title||'')}</h4></div><span class="text-[10px] ${x.published?'bg-green-50 text-green-600':'bg-slate-100 text-slate-500'} px-2 py-1 rounded-full">${x.published?'เผยแพร่':'ซ่อน'}</span></div><div class="flex gap-2 mt-4"><button class="flex-1 py-2 rounded-xl bg-orange-50 text-orange-600 text-xs font-bold" data-edit-ach="${i}">แก้ไข</button><button class="px-3 py-2 rounded-xl bg-red-50 text-red-500" data-delete-ach="${i}"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div></article>`).join('')||'<div class="sm:col-span-2 xl:col-span-3 glass rounded-3xl p-10 text-center text-slate-400">ยังไม่มีผลงาน</div>';
  $$('[data-edit-ach]').forEach(b=>b.addEventListener('click',()=>openAchievementEditor(+b.dataset.editAch)));$$('[data-delete-ach]').forEach(b=>b.addEventListener('click',()=>deleteAchievement(+b.dataset.deleteAch)));$('#dash-achievements').textContent=achievements.length;lucide.createIcons();
}
function openAchievementEditor(index=null){
  const editing=index!==null,item=editing?clone(achievements[index]):{title:'',year:String(new Date().getFullYear()+543),image_url:'',description:'',published:true};$('#modal-title').textContent=editing?'แก้ไขผลงาน':'เพิ่มผลงาน';$('#modal-help').textContent='ผลงานที่เผยแพร่ล่าสุดจะถูกนำไปแสดงหน้าแรก 3 รายการ';
  $('#editor-form').innerHTML=`<div><label class="label">ชื่อผลงาน</label><input name="title" class="field" value="${esc(item.title)}" required></div><div><label class="label">ปี</label><input name="year" class="field" value="${esc(item.year||'')}"></div><div><label class="label">รายละเอียด</label><textarea name="description" class="field min-h-24">${esc(item.description||'')}</textarea></div><div><label class="label">รูปภาพ</label><div class="flex gap-2"><input name="image_url" class="field" value="${esc(item.image_url||'')}" placeholder="URL รูป หรือกดอัปโหลด"><label class="cursor-pointer px-4 py-3 rounded-2xl bg-slate-100 text-xs font-bold"><input id="modal-ach-upload" type="file" accept="image/*" class="hidden">อัปโหลด</label></div></div><label class="flex items-center gap-3 p-4 rounded-2xl bg-slate-50"><input name="published" type="checkbox" class="w-5 h-5 accent-orange-500" ${item.published!==false?'checked':''}><span class="text-sm font-bold">เผยแพร่บนเว็บไซต์</span></label><button class="w-full bg-orange-500 text-white rounded-2xl py-3 font-bold">บันทึกผลงาน</button>`;
  $('#editor-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),row={title:f.get('title'),year:f.get('year'),description:f.get('description'),image_url:f.get('image_url'),published:f.get('published')==='on'};try{let r;if(editing)r=await db.from('achievements').update(row).eq('id',item.id).select().single();else r=await db.from('achievements').insert(row).select().single();if(r.error)throw r.error;if(editing)achievements[index]=r.data;else achievements.unshift(r.data);closeModal();renderAchievements();toast('บันทึกผลงานแล้ว')}catch(err){toast(err.message,true)}};
  $('#modal-ach-upload').onchange=async e=>{if(!e.target.files?.[0])return;const url=await uploadFile(e.target.files[0],'achievement');if(url)$('#editor-form [name="image_url"]').value=url};openModal();
}
async function deleteAchievement(index){if(!confirm('ลบผลงานรายการนี้ถาวร?'))return;const item=achievements[index],{error}=await db.from('achievements').delete().eq('id',item.id);if(error)return toast(error.message,true);achievements.splice(index,1);renderAchievements();toast('ลบผลงานแล้ว')}

function openModal(){const m=$('#editor-modal');m.classList.remove('hidden');m.classList.add('flex');lucide.createIcons()}
function closeModal(){const m=$('#editor-modal');m.classList.add('hidden');m.classList.remove('flex');$('#editor-form').onsubmit=null}
async function uploadFile(file,prefix='media'){
  try{const ext=(file.name.split('.').pop()||'bin').toLowerCase(),name=`${prefix}/${Date.now()}-${crypto.randomUUID()}.${ext}`;toast('กำลังอัปโหลดไฟล์...');const {error}=await db.storage.from(bucket).upload(name,file,{cacheControl:'3600',upsert:false});if(error)throw error;const {data}=db.storage.from(bucket).getPublicUrl(name);toast('อัปโหลดเรียบร้อย');return data.publicUrl}catch(e){toast('อัปโหลดไม่สำเร็จ: '+e.message,true);return null}
}

start();
