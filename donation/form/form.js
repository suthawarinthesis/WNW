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
  let selectedSlip = null, previewUrl = '', donationSettings = null, paymentStageEntered = false;
  const DRAFT_KEY = 'wnw-donation-form-draft-v9';

  function showStatus(message, ok=false){ status.className=`rounded-2xl p-4 text-sm border ${ok?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-rose-50 text-rose-700 border-rose-200'}`; status.textContent=message; status.classList.remove('hidden'); }
  function clearStatus(){ status.classList.add('hidden'); }
  function donorType(){ return form.elements.donor_type.value; }
  function showDonorStatus(message){ const el=document.getElementById('donor-status'); el.textContent=message; el.classList.remove('hidden'); }
  function clearDonorStatus(){ document.getElementById('donor-status').classList.add('hidden'); }
  function syncType(){
    const monastic=donorType()==='monastic';
    document.getElementById('layperson-fields').classList.toggle('hidden',monastic);
    document.getElementById('monastic-fields').classList.toggle('hidden',!monastic);
    form.elements.lay_first_name.required=!monastic; form.elements.lay_last_name.required=!monastic;
    form.elements.monastic_first_name.required=monastic; form.elements.temple_name.required=monastic;
    form.elements.monastic_subdistrict.required=monastic; form.elements.monastic_district.required=monastic; form.elements.monastic_province.required=monastic;
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
      data.donor_type=donorType();
      data.show_public_name=form.elements.show_public_name?.checked ?? true;
      data.show_public_amount=form.elements.show_public_amount?.checked ?? true;
      data.savedAt=Date.now();
      sessionStorage.setItem(DRAFT_KEY,JSON.stringify(data));
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
      syncType();
    }catch(_){ }
  }

  function validateDonorStage(){
    syncType(); clearDonorStatus();
    const monastic=donorType()==='monastic';
    const required = monastic
      ? [form.elements.monastic_first_name,form.elements.temple_name,form.elements.monastic_subdistrict,form.elements.monastic_district,form.elements.monastic_province]
      : [form.elements.lay_first_name,form.elements.lay_last_name];
    for(const el of required){ if(!el.checkValidity()){ el.reportValidity(); return false; } }
    if(!form.elements.phone.value.trim() && !form.elements.email.value.trim()){
      showDonorStatus('กรุณาระบุเบอร์โทรศัพท์หรือ Email อย่างน้อย 1 ช่อง เพื่อใช้ดูประวัติย้อนหลัง');
      form.elements.phone.focus(); return false;
    }
    return true;
  }

  function enterPaymentStage(){
    if(!validateDonorStage()) return;
    clearStatus(); saveDraft(); paymentStageEntered=true;
    donorStage.classList.add('hidden'); paymentStage.classList.remove('hidden'); setStep(2);
    window.scrollTo({top:0,behavior:'smooth'}); lucide.createIcons();
  }

  function leavePaymentStage(){
    paymentStageEntered=false; reminder.classList.add('hidden');
    paymentStage.classList.add('hidden'); donorStage.classList.remove('hidden'); setStep(1);
    window.scrollTo({top:0,behavior:'smooth'}); lucide.createIcons();
  }

  function showProof(){
    setNow(); proofSection.classList.remove('hidden'); confirmSection.classList.remove('hidden'); btn.classList.remove('hidden'); reminder.classList.add('hidden');
    saveDraft(); setTimeout(()=>proofSection.scrollIntoView({behavior:'smooth',block:'start'}),80); lucide.createIcons();
  }

  form.querySelectorAll('[name=donor_type]').forEach(x=>x.addEventListener('change',()=>{syncType();saveDraft()}));
  form.addEventListener('input',e=>{ if(e.target?.type!=='file') saveDraft(); });
  document.getElementById('go-payment-btn').addEventListener('click',enterPaymentStage);
  document.getElementById('back-donor-btn').addEventListener('click',leavePaymentStage);
  document.getElementById('transfer-done-btn').addEventListener('click',showProof);
  document.getElementById('return-done-btn').addEventListener('click',showProof);

  document.getElementById('copy-account-btn').addEventListener('click',async()=>{
    const value=donationSettings?.bank_account_no||''; if(!value)return;
    try{await navigator.clipboard.writeText(value); showStatus('คัดลอกเลขบัญชีแล้ว',true);}catch(_){showStatus('ไม่สามารถคัดลอกอัตโนมัติได้ กรุณากดค้างที่เลขบัญชีเพื่อคัดลอก');}
  });

  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden && paymentStageEntered && proofSection.classList.contains('hidden')){
      reminder.classList.remove('hidden'); lucide.createIcons();
    }
  });

  const fileInput=document.getElementById('slip-file');
  fileInput.addEventListener('change',()=>{
    selectedSlip=fileInput.files?.[0]||null;
    if(previewUrl) URL.revokeObjectURL(previewUrl);
    const wrap=document.getElementById('slip-preview-wrap'), img=document.getElementById('slip-preview'), pdf=document.getElementById('pdf-preview');
    img.classList.add('hidden'); pdf.classList.add('hidden'); wrap.classList.add('hidden');
    if(!selectedSlip) return;
    if(selectedSlip.size>10*1024*1024){ selectedSlip=null; fileInput.value=''; showStatus('ไฟล์สลิปต้องมีขนาดไม่เกิน 10 MB'); return; }
    if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(selectedSlip.type)){selectedSlip=null;fileInput.value='';showStatus('รองรับเฉพาะ JPG, PNG, WebP หรือ PDF');return;}
    document.getElementById('slip-label').textContent=`${selectedSlip.name} • ${(selectedSlip.size/1024/1024).toFixed(2)} MB`;
    wrap.classList.remove('hidden');
    if(selectedSlip.type==='application/pdf'){pdf.querySelector('span').textContent=selectedSlip.name;pdf.classList.remove('hidden');}
    else {previewUrl=URL.createObjectURL(selectedSlip);img.src=previewUrl;img.classList.remove('hidden');}
    saveDraft(); lucide.createIcons();
  });

  function applyPaymentSettings(settings){
    donationSettings=settings||{};
    document.getElementById('payment-bank-name').textContent=settings?.bank_name||'—';
    document.getElementById('payment-account-name').textContent=settings?.bank_account_name||'—';
    document.getElementById('payment-account-no').textContent=settings?.bank_account_no||'—';
    if(settings?.promptpay){document.getElementById('payment-promptpay').textContent=settings.promptpay;document.getElementById('payment-promptpay-row').classList.remove('hidden');}
    if(settings?.donation_note){const note=document.getElementById('payment-note');note.textContent=settings.donation_note;note.classList.remove('hidden');}
    if(settings?.qr_image_url){
      const img=document.getElementById('payment-qr-image'), empty=document.getElementById('payment-qr-empty'), actions=document.getElementById('qr-actions'), link=document.getElementById('open-qr-link');
      img.src=settings.qr_image_url; img.classList.remove('hidden'); empty.classList.add('hidden'); actions.classList.remove('hidden'); link.href=settings.qr_image_url;
      img.onerror=()=>{img.classList.add('hidden');empty.classList.remove('hidden');actions.classList.add('hidden');};
    }
  }

  async function init(){
    restoreDraft(); syncType();
    if(!form.elements.transfer_date.value || !form.elements.transfer_time.value) setNow();
    try{
      C.applyBranding(await C.loadBranding());
      const settings=await C.loadDonationSettings(); applyPaymentSettings(settings);
      if(settings && !settings.is_open){document.getElementById('closed-alert').classList.remove('hidden');document.getElementById('go-payment-btn').disabled=true;btn.disabled=true;}
    }catch(err){console.warn(err)}
    lucide.createIcons();
  }

  form.addEventListener('submit',async e=>{
    e.preventDefault(); clearStatus();
    if(!db) return showStatus('ยังไม่ได้ตั้งค่า Supabase');
    if(proofSection.classList.contains('hidden')) return showStatus('กรุณากด “โอนเรียบร้อยแล้ว” และแนบสลิปก่อนส่งข้อมูล');
    if(!selectedSlip) return showStatus('กรุณาแนบหลักฐานการโอนเงิน');
    if(!form.elements.phone.value.trim() && !form.elements.email.value.trim()) return showStatus('กรุณาระบุเบอร์โทรศัพท์หรือ Email อย่างน้อย 1 ช่อง เพื่อใช้ดูประวัติย้อนหลัง');
    const monastic=donorType()==='monastic';
    const historyCode=localStorage.getItem('wnw-donation-history-code')||'';
    const payload={
      donorType: donorType(),
      donorPrefix: monastic?form.elements.monastic_prefix.value:form.elements.lay_prefix.value,
      firstName: monastic?form.elements.monastic_first_name.value.trim():form.elements.lay_first_name.value.trim(),
      dhammaName: monastic?form.elements.dhamma_name.value.trim():'',
      lastName: monastic?form.elements.monastic_last_name.value.trim():form.elements.lay_last_name.value.trim(),
      organization: monastic?'':form.elements.organization.value.trim(),
      templeName: monastic?form.elements.temple_name.value.trim():'',
      addressLine: monastic?'':form.elements.lay_address.value.trim(),
      subdistrict: monastic?form.elements.monastic_subdistrict.value.trim():form.elements.lay_subdistrict.value.trim(),
      district: monastic?form.elements.monastic_district.value.trim():form.elements.lay_district.value.trim(),
      province: monastic?form.elements.monastic_province.value.trim():form.elements.lay_province.value.trim(),
      postalCode: monastic?'':form.elements.postal_code.value.trim(),
      phone: form.elements.phone.value.trim(), email: form.elements.email.value.trim(),
      amount: form.elements.amount.value, transferDate: form.elements.transfer_date.value, transferTime: form.elements.transfer_time.value,
      donorNote: form.elements.donor_note.value.trim(), showPublicName: form.elements.show_public_name.checked, showPublicAmount: form.elements.show_public_amount.checked,
      consentAccepted: form.elements.consent.checked, historyCode
    };
    btn.disabled=true; btn.innerHTML='<span class="inline-flex items-center gap-2"><span class="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin"></span> กำลังส่งข้อมูล...</span>';
    try{
      const {data:start,error:startErr}=await db.rpc('create_donation_submission',{p_payload:payload}); if(startErr)throw startErr;
      const row=Array.isArray(start)?start[0]:start; if(!row?.id||!row?.upload_token)throw new Error('สร้างรายการไม่สำเร็จ');
      const ext=(selectedSlip.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
      const path=`${row.id}/${row.upload_token}/${crypto.randomUUID()}.${ext}`;
      const bucket=window.SCHOOL_APP_CONFIG?.DONATION_SLIP_BUCKET||'donation-slips';
      const {error:uploadErr}=await db.storage.from(bucket).upload(path,selectedSlip,{upsert:false,contentType:selectedSlip.type}); if(uploadErr)throw uploadErr;
      const {data:final,error:finalErr}=await db.rpc('finalize_donation_submission',{p_id:row.id,p_upload_token:row.upload_token,p_slip_path:path}); if(finalErr)throw finalErr;
      const saved=Array.isArray(final)?final[0]:final;
      localStorage.setItem('wnw-donation-history-code',saved.history_code||row.history_code);
      localStorage.setItem('wnw-donation-last-request',saved.request_no||row.request_no);
      sessionStorage.removeItem(DRAFT_KEY);
      form.classList.add('hidden'); reminder.classList.add('hidden'); document.getElementById('success-card').classList.remove('hidden');
      document.getElementById('success-request').textContent=saved.request_no||row.request_no;
      document.getElementById('success-history').textContent=saved.history_code||row.history_code;
      window.scrollTo({top:0,behavior:'smooth'}); lucide.createIcons();
    }catch(err){console.error(err);showStatus('ส่งข้อมูลไม่สำเร็จ: '+(err.message||err));btn.disabled=false;btn.innerHTML='<span class="inline-flex items-center gap-2"><i data-lucide="send" class="w-5 h-5"></i> ส่งสลิปและข้อมูลการร่วมบุญ</span>';lucide.createIcons();}
  });
  init();
})();
