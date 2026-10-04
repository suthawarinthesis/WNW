(() => {
  const C = window.DonationCommon, db = C.db;
  const form = document.getElementById('donation-form');
  const status = document.getElementById('form-status');
  const btn = document.getElementById('submit-btn');
  const donorStage = document.getElementById('donor-stage');
  const paymentStage = document.getElementById('payment-stage');
  const proofSection = document.getElementById('proof-section');
  const confirmSection = document.getElementById('confirm-section');
  const reminder = document.getElementById('return-reminder');
  let selectedSlip = null, previewUrl = '', donationSettings = null, paymentStageEntered = false, campaigns = [];
  const DRAFT_KEY = 'wnw-donation-form-draft-v15';

  function showStatus(message, ok=false){ status.className=`rounded-2xl p-4 text-sm border ${ok?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-rose-50 text-rose-700 border-rose-200'}`; status.textContent=message; status.classList.remove('hidden'); }
  function clearStatus(){ status.classList.add('hidden'); }
  function donorType(){ return form.elements.donor_type.value; }
  function givingAsType(){ return form.elements.giving_as_type?.value || 'person'; }
  function isPerson(){ return givingAsType()==='person'; }
  function normalizePhotoUrl(value=''){
    const raw=String(value||'').trim();
    if(!raw)return '';
    try{
      const u=new URL(raw);
      if(!['http:','https:'].includes(u.protocol))return '';
      if(/(^|\.)drive\.google\.com$/i.test(u.hostname)){
        const m=raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)||raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if(m?.[1])return `https://drive.google.com/thumbnail?id=${encodeURIComponent(m[1])}&sz=w1200`;
      }
      return raw;
    }catch(_){return ''}
  }
  function syncAlumni(){
    const checked=!!form.elements.is_alumni?.checked;
    const wrap=document.getElementById('alumni-batch-wrap'), select=form.elements.alumni_batch;
    wrap?.classList.toggle('hidden',!checked);
    if(select){select.required=checked;if(!checked)select.value='';}
  }
  function previewPhoto(){
    const raw=form.elements.photo_url?.value.trim()||'';
    const box=document.getElementById('donor-photo-preview-box'),img=document.getElementById('donor-photo-preview'),err=document.getElementById('donor-photo-preview-error');
    if(!raw){box?.classList.add('hidden');if(img)img.removeAttribute('src');return}
    const url=normalizePhotoUrl(raw);
    box?.classList.remove('hidden');err?.classList.add('hidden');img?.classList.remove('hidden');
    if(!url){img?.classList.add('hidden');err?.classList.remove('hidden');return}
    img.src=url;
    img.onload=()=>{img.classList.remove('hidden');err.classList.add('hidden')};
    img.onerror=()=>{img.classList.add('hidden');err.classList.remove('hidden')};
  }
  function showDonorStatus(message){ const el=document.getElementById('donor-status'); el.textContent=message; el.classList.remove('hidden'); }
  function clearDonorStatus(){ document.getElementById('donor-status').classList.add('hidden'); }

  function syncGivingAs(){
    const type=givingAsType();
    const person=type==='person';
    const wrap=document.getElementById('giving-name-wrap');
    const personTypes=document.getElementById('person-type-section');
    wrap?.classList.toggle('hidden',person);
    personTypes?.classList.toggle('hidden',!person);
    if(form.elements.giving_name) form.elements.giving_name.required=!person;
    if(!person){
      const lay=[...form.querySelectorAll('[name=donor_type]')].find(x=>x.value==='layperson');
      if(lay) lay.checked=true;
      const labels={family:'ชื่อครอบครัวที่ใช้ร่วมบุญ / ออกใบ',shop:'ชื่อร้านค้าที่ใช้ร่วมบุญ / ออกใบ',company:'ชื่อบริษัท / องค์กรที่ใช้ร่วมบุญ / ออกใบ',alumni_group:'ชื่อคณะศิษย์เก่าที่ใช้ร่วมบุญ / ออกใบ',host_group:'ชื่อคณะเจ้าภาพที่ใช้ร่วมบุญ / ออกใบ'};
      document.getElementById('giving-name-label').innerHTML=(labels[type]||'ชื่อที่ใช้ร่วมบุญ / ออกใบ')+' <b class="text-rose-500">*</b>';
      document.getElementById('detail-kicker').textContent='ผู้ประสานงาน';
      document.getElementById('detail-title').textContent='ข้อมูลผู้ประสานงานและช่องทางติดต่อ';
    }else{
      document.getElementById('detail-kicker').textContent='รายละเอียด';
      document.getElementById('detail-title').textContent='ข้อมูลสำหรับออกใบอนุโมทนาบัตร';
    }
    syncType();
  }

  function syncType(){
    const monastic=isPerson() && donorType()==='monastic';
    document.getElementById('layperson-fields').classList.toggle('hidden',monastic);
    document.getElementById('monastic-fields').classList.toggle('hidden',!monastic);
    form.elements.lay_first_name.required=!monastic; form.elements.lay_last_name.required=!monastic;
    form.elements.monastic_first_name.required=monastic; form.elements.temple_name.required=monastic;
    form.elements.monastic_subdistrict.required=monastic; form.elements.monastic_district.required=monastic; form.elements.monastic_province.required=monastic;
  }

  function renderCampaigns(){
    const select=document.getElementById('campaign-select');
    if(!select)return;
    if(!campaigns.length){
      select.innerHTML='<option value="">ยังไม่มีโครงการ/งานที่เปิดรับ</option>';
      select.disabled=true;
      return;
    }
    select.disabled=false;
    const current=select.value;
    select.innerHTML=campaigns.map(c=>`<option value="${C.escapeHtml(c.id)}" data-prefix="${C.escapeHtml(c.prefix||'')}">${C.escapeHtml(c.name)} · ${C.escapeHtml(c.prefix||'')}</option>`).join('');
    const preferred=campaigns.find(c=>c.is_default)||campaigns[0];
    select.value=campaigns.some(c=>c.id===current)?current:preferred.id;
    updateCampaignHelp();
  }
  function updateCampaignHelp(){
    const select=document.getElementById('campaign-select');
    const c=campaigns.find(x=>x.id===select?.value);
    const el=document.getElementById('campaign-prefix-help');
    if(el)el.textContent=c?`เลขใบของงานนี้จะขึ้นต้นด้วย ${c.prefix}-ปีพ.ศ.-เลขลำดับ`:'กรุณาเลือกโครงการ/งานก่อนดำเนินการ';
  }

  function setStep(step){
    const d1=document.getElementById('step-dot-1'), d2=document.getElementById('step-dot-2');
    const l1=document.getElementById('step-label-1'), l2=document.getElementById('step-label-2');
    d1.className='step-dot '+(step===1?'step-active':'step-done');
    d2.className='step-dot '+(step===2?'step-active':'step-idle');
    l1.className=step===1?'font-bold text-orange-700':'font-semibold text-emerald-700';
    l2.className=step===2?'font-bold text-orange-700':'font-semibold text-slate-400';
  }

  function setNow(){
    const now=new Date();
    const localDate=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
    form.elements.transfer_date.value=localDate;
    form.elements.transfer_time.value=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  }

  function saveDraft(){
    try{
      const data={};
      new FormData(form).forEach((v,k)=>{ if(!(v instanceof File)) data[k]=v; });
      data.donor_type=donorType(); data.giving_as_type=givingAsType();
      data.is_alumni=form.elements.is_alumni?.checked ?? false;
      data.show_public_name=form.elements.show_public_name?.checked ?? true;
      data.show_public_amount=form.elements.show_public_amount?.checked ?? true;
      data.savedAt=Date.now(); sessionStorage.setItem(DRAFT_KEY,JSON.stringify(data));
    }catch(_){ }
  }

  function restoreDraft(){
    try{
      const data=JSON.parse(sessionStorage.getItem(DRAFT_KEY)||'null');
      if(!data || Date.now()-Number(data.savedAt||0)>6*60*60*1000) return;
      Object.entries(data).forEach(([k,v])=>{
        const el=form.elements[k]; if(!el || k==='savedAt') return;
        if(el instanceof RadioNodeList){ const target=[...el].find(x=>x.value===v); if(target)target.checked=true; }
        else if(el.type==='checkbox') el.checked=!!v;
        else if(el.type!=='file') el.value=v ?? '';
      });
    }catch(_){ }
  }

  function validateDonorStage(){
    syncGivingAs(); clearDonorStatus();
    if(!form.elements.campaign_id?.value){showDonorStatus('กรุณาเลือกโครงการ / งานที่ต้องการร่วมบุญ');form.elements.campaign_id?.focus();return false;}
    if(!isPerson() && !form.elements.giving_name.value.trim()){showDonorStatus('กรุณาระบุชื่อที่ใช้ร่วมบุญ / ออกใบอนุโมทนาบัตร');form.elements.giving_name.focus();return false;}
    const monastic=isPerson() && donorType()==='monastic';
    const required = monastic
      ? [form.elements.monastic_first_name,form.elements.temple_name,form.elements.monastic_subdistrict,form.elements.monastic_district,form.elements.monastic_province]
      : [form.elements.lay_first_name,form.elements.lay_last_name];
    for(const el of required){ if(!el.checkValidity()){ el.reportValidity(); return false; } }
    if(form.elements.is_alumni?.checked && !form.elements.alumni_batch.value){showDonorStatus('กรุณาเลือกรุ่นศิษย์เก่า');form.elements.alumni_batch.focus();return false;}
    const photoRaw=form.elements.photo_url?.value.trim()||'';
    if(photoRaw && !normalizePhotoUrl(photoRaw)){showDonorStatus('ลิงก์รูปภาพไม่ถูกต้อง กรุณาใช้ลิงก์ http/https หรือ Google Drive');form.elements.photo_url.focus();return false;}
    if(!form.elements.phone.value.trim() && !form.elements.email.value.trim()){showDonorStatus('กรุณาระบุเบอร์โทรศัพท์หรือ Email อย่างน้อย 1 ช่อง เพื่อใช้ดูประวัติย้อนหลัง');form.elements.phone.focus();return false;}
    return true;
  }

  function enterPaymentStage(){if(!validateDonorStage())return;clearStatus();saveDraft();paymentStageEntered=true;donorStage.classList.add('hidden');paymentStage.classList.remove('hidden');setStep(2);window.scrollTo({top:0,behavior:'smooth'});lucide.createIcons();}
  function leavePaymentStage(){paymentStageEntered=false;reminder.classList.add('hidden');paymentStage.classList.add('hidden');donorStage.classList.remove('hidden');setStep(1);window.scrollTo({top:0,behavior:'smooth'});lucide.createIcons();}
  function showProof(){setNow();proofSection.classList.remove('hidden');confirmSection.classList.remove('hidden');btn.classList.remove('hidden');reminder.classList.add('hidden');saveDraft();setTimeout(()=>proofSection.scrollIntoView({behavior:'smooth',block:'start'}),80);lucide.createIcons();}

  form.querySelectorAll('[name=giving_as_type]').forEach(x=>x.addEventListener('change',()=>{syncGivingAs();saveDraft()}));
  form.querySelectorAll('[name=donor_type]').forEach(x=>x.addEventListener('change',()=>{syncType();saveDraft()}));
  document.getElementById('campaign-select')?.addEventListener('change',()=>{updateCampaignHelp();saveDraft()});
  const batchSelect=form.elements.alumni_batch;
  if(batchSelect && batchSelect.options.length<=1){for(let i=1;i<=50;i++){const o=document.createElement('option');o.value=String(i);o.textContent=`รุ่นที่ ${i}`;batchSelect.appendChild(o)}}
  form.elements.is_alumni?.addEventListener('change',()=>{syncAlumni();saveDraft()});
  form.elements.photo_url?.addEventListener('input',()=>{previewPhoto();saveDraft()});
  form.addEventListener('input',e=>{if(e.target?.type!=='file')saveDraft()});
  document.getElementById('go-payment-btn').addEventListener('click',enterPaymentStage);
  document.getElementById('back-donor-btn').addEventListener('click',leavePaymentStage);
  document.getElementById('transfer-done-btn').addEventListener('click',showProof);
  document.getElementById('return-done-btn').addEventListener('click',showProof);

  document.getElementById('copy-account-btn').addEventListener('click',async()=>{const value=donationSettings?.bank_account_no||'';if(!value)return;try{await navigator.clipboard.writeText(value);showStatus('คัดลอกเลขบัญชีแล้ว',true)}catch(_){showStatus('ไม่สามารถคัดลอกอัตโนมัติได้ กรุณากดค้างที่เลขบัญชีเพื่อคัดลอก')}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&paymentStageEntered&&proofSection.classList.contains('hidden')){reminder.classList.remove('hidden');lucide.createIcons()}});

  const fileInput=document.getElementById('slip-file');
  fileInput.addEventListener('change',()=>{
    selectedSlip=fileInput.files?.[0]||null;if(previewUrl)URL.revokeObjectURL(previewUrl);
    const wrap=document.getElementById('slip-preview-wrap'),img=document.getElementById('slip-preview'),pdf=document.getElementById('pdf-preview');img.classList.add('hidden');pdf.classList.add('hidden');wrap.classList.add('hidden');
    if(!selectedSlip)return;
    if(selectedSlip.size>10*1024*1024){selectedSlip=null;fileInput.value='';showStatus('ไฟล์สลิปต้องมีขนาดไม่เกิน 10 MB');return}
    if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(selectedSlip.type)){selectedSlip=null;fileInput.value='';showStatus('รองรับเฉพาะ JPG, PNG, WebP หรือ PDF');return}
    document.getElementById('slip-label').textContent=`${selectedSlip.name} • ${(selectedSlip.size/1024/1024).toFixed(2)} MB`;wrap.classList.remove('hidden');
    if(selectedSlip.type==='application/pdf'){pdf.querySelector('span').textContent=selectedSlip.name;pdf.classList.remove('hidden')}else{previewUrl=URL.createObjectURL(selectedSlip);img.src=previewUrl;img.classList.remove('hidden')}
    saveDraft();lucide.createIcons();
  });

  function applyPaymentSettings(settings){
    donationSettings=settings||{};document.getElementById('payment-bank-name').textContent=settings?.bank_name||'—';document.getElementById('payment-account-name').textContent=settings?.bank_account_name||'—';document.getElementById('payment-account-no').textContent=settings?.bank_account_no||'—';
    if(settings?.promptpay){document.getElementById('payment-promptpay').textContent=settings.promptpay;document.getElementById('payment-promptpay-row').classList.remove('hidden')}
    if(settings?.donation_note){const note=document.getElementById('payment-note');note.textContent=settings.donation_note;note.classList.remove('hidden')}
    if(settings?.qr_image_url){const img=document.getElementById('payment-qr-image'),empty=document.getElementById('payment-qr-empty'),actions=document.getElementById('qr-actions'),link=document.getElementById('open-qr-link');img.src=settings.qr_image_url;img.classList.remove('hidden');empty.classList.add('hidden');actions.classList.remove('hidden');link.href=settings.qr_image_url;img.onerror=()=>{img.classList.add('hidden');empty.classList.remove('hidden');actions.classList.add('hidden')}}
  }

  async function loadCampaigns(){
    const {data,error}=await db.from('donation_campaigns').select('id,name,prefix,description,is_default,is_active,sort_order').eq('is_active',true).order('is_default',{ascending:false}).order('sort_order',{ascending:true}).order('name',{ascending:true});
    if(error)throw error;campaigns=data||[];renderCampaigns();
  }

  async function init(){
    if(!form.elements.transfer_date.value||!form.elements.transfer_time.value)setNow();
    try{
      const [branding,settings]=await Promise.all([C.loadBranding(),C.loadDonationSettings()]);C.applyBranding(branding);applyPaymentSettings(settings);
      await loadCampaigns();restoreDraft();renderCampaigns();syncGivingAs();syncAlumni();previewPhoto();
      if(settings&&!settings.is_open){document.getElementById('closed-alert').classList.remove('hidden');document.getElementById('go-payment-btn').disabled=true;btn.disabled=true}
    }catch(err){console.warn(err);showStatus('โหลดข้อมูลโครงการไม่สำเร็จ กรุณาตรวจว่าได้รัน Donation V15 SQL แล้ว: '+(err.message||err))}
    lucide.createIcons();
  }

  form.addEventListener('submit',async e=>{
    e.preventDefault();clearStatus();if(!db)return showStatus('ยังไม่ได้ตั้งค่า Supabase');if(!validateDonorStage())return;
    if(proofSection.classList.contains('hidden'))return showStatus('กรุณากด “โอนเรียบร้อยแล้ว” และแนบสลิปก่อนส่งข้อมูล');if(!selectedSlip)return showStatus('กรุณาแนบหลักฐานการโอนเงิน');
    const person=isPerson(),monastic=person&&donorType()==='monastic';
    const effectiveDonorType=monastic?'monastic':'layperson';
    const historyCode=localStorage.getItem('wnw-donation-history-code')||'';
    const contactDisplay=monastic
      ? [form.elements.monastic_prefix.value,form.elements.monastic_first_name.value.trim(),form.elements.dhamma_name.value.trim(),form.elements.monastic_last_name.value.trim()].filter(Boolean).join(' ')
      : [form.elements.lay_prefix.value,form.elements.lay_first_name.value.trim(),form.elements.lay_last_name.value.trim()].filter(Boolean).join(' ');
    const payload={
      donorType:effectiveDonorType,
      donorPrefix:monastic?form.elements.monastic_prefix.value:form.elements.lay_prefix.value,
      firstName:monastic?form.elements.monastic_first_name.value.trim():form.elements.lay_first_name.value.trim(),
      dhammaName:monastic?form.elements.dhamma_name.value.trim():'',
      lastName:monastic?form.elements.monastic_last_name.value.trim():form.elements.lay_last_name.value.trim(),
      organization:monastic?'':form.elements.organization.value.trim(),templeName:monastic?form.elements.temple_name.value.trim():'',addressLine:monastic?'':form.elements.lay_address.value.trim(),
      subdistrict:monastic?form.elements.monastic_subdistrict.value.trim():form.elements.lay_subdistrict.value.trim(),district:monastic?form.elements.monastic_district.value.trim():form.elements.lay_district.value.trim(),province:monastic?form.elements.monastic_province.value.trim():form.elements.lay_province.value.trim(),postalCode:monastic?'':form.elements.postal_code.value.trim(),
      phone:form.elements.phone.value.trim(),email:form.elements.email.value.trim(),isAlumni:!!form.elements.is_alumni?.checked,alumniBatch:form.elements.is_alumni?.checked?form.elements.alumni_batch.value:'',photoUrl:form.elements.photo_url?.value.trim()||'',
      givingAsType:givingAsType(),givingName:person?'':form.elements.giving_name.value.trim(),contactName:form.elements.contact_name?.value.trim()||contactDisplay,campaignId:form.elements.campaign_id.value,
      amount:form.elements.amount.value,transferDate:form.elements.transfer_date.value,transferTime:form.elements.transfer_time.value,donorNote:form.elements.donor_note.value.trim(),showPublicName:form.elements.show_public_name.checked,showPublicAmount:form.elements.show_public_amount.checked,consentAccepted:form.elements.consent.checked,historyCode
    };
    btn.disabled=true;btn.innerHTML='<span class="inline-flex items-center gap-2"><span class="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin"></span> กำลังส่งข้อมูล...</span>';
    try{
      const {data:start,error:startErr}=await db.rpc('create_donation_submission',{p_payload:payload});if(startErr)throw startErr;const row=Array.isArray(start)?start[0]:start;if(!row?.id||!row?.upload_token)throw new Error('สร้างรายการไม่สำเร็จ');
      const {data:extraOk,error:extraErr}=await db.rpc('set_donation_profile_extras',{p_id:row.id,p_upload_token:row.upload_token,p_is_alumni:payload.isAlumni,p_alumni_batch:payload.alumniBatch,p_photo_url:payload.photoUrl});if(extraErr)throw extraErr;if(extraOk!==true)throw new Error('บันทึกข้อมูลรูปภาพ/ศิษย์เก่าไม่สำเร็จ');
      const {data:v15Ok,error:v15Err}=await db.rpc('set_donation_v15_extras',{p_id:row.id,p_upload_token:row.upload_token,p_giving_as_type:payload.givingAsType,p_giving_name:payload.givingName,p_contact_name:payload.contactName,p_campaign_id:payload.campaignId});if(v15Err)throw v15Err;if(v15Ok!==true)throw new Error('บันทึกข้อมูลรูปแบบการร่วมบุญ/โครงการไม่สำเร็จ');
      const ext=(selectedSlip.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';const path=`${row.id}/${row.upload_token}/${crypto.randomUUID()}.${ext}`;const bucket=window.SCHOOL_APP_CONFIG?.DONATION_SLIP_BUCKET||'donation-slips';const {error:uploadErr}=await db.storage.from(bucket).upload(path,selectedSlip,{upsert:false,contentType:selectedSlip.type});if(uploadErr)throw uploadErr;
      const {data:final,error:finalErr}=await db.rpc('finalize_donation_submission',{p_id:row.id,p_upload_token:row.upload_token,p_slip_path:path});if(finalErr)throw finalErr;const saved=Array.isArray(final)?final[0]:final;
      localStorage.setItem('wnw-donation-history-code',saved.history_code||row.history_code);localStorage.setItem('wnw-donation-last-request',saved.request_no||row.request_no);sessionStorage.removeItem(DRAFT_KEY);form.classList.add('hidden');reminder.classList.add('hidden');document.getElementById('success-card').classList.remove('hidden');document.getElementById('success-request').textContent=saved.request_no||row.request_no;document.getElementById('success-history').textContent=saved.history_code||row.history_code;window.scrollTo({top:0,behavior:'smooth'});lucide.createIcons();
    }catch(err){console.error(err);showStatus('ส่งข้อมูลไม่สำเร็จ: '+(err.message||err));btn.disabled=false;btn.innerHTML='<span class="inline-flex items-center gap-2"><i data-lucide="send" class="w-5 h-5"></i> ส่งสลิปและข้อมูลการร่วมบุญ</span>';lucide.createIcons()}
  });
  init();
})();
