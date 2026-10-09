(() => {
  const C = window.DonationCommon, db = C.db;
  const form = document.getElementById('donation-form');
  const status = document.getElementById('form-status');
  const btn = document.getElementById('submit-btn');
  let selectedSlip = null, previewUrl = '';

  function showStatus(message, ok=false){ status.className=`rounded-2xl p-4 text-sm border ${ok?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-rose-50 text-rose-700 border-rose-200'}`; status.textContent=message; status.classList.remove('hidden'); }
  function clearStatus(){ status.classList.add('hidden'); }

  function donorType(){ return form.elements.donor_type.value; }
  function syncType(){
    const monastic=donorType()==='monastic';
    document.getElementById('layperson-fields').classList.toggle('hidden',monastic);
    document.getElementById('monastic-fields').classList.toggle('hidden',!monastic);
    form.elements.lay_first_name.required=!monastic; form.elements.lay_last_name.required=!monastic;
    form.elements.monastic_first_name.required=monastic; form.elements.temple_name.required=monastic;
    form.elements.monastic_subdistrict.required=monastic; form.elements.monastic_district.required=monastic; form.elements.monastic_province.required=monastic;
  }
  form.querySelectorAll('[name=donor_type]').forEach(x=>x.addEventListener('change',syncType)); syncType();

  const now=new Date();
  const localDate=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
  form.elements.transfer_date.value=localDate;
  form.elements.transfer_time.value=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

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
    lucide.createIcons();
  });

  async function init(){
    try{
      C.applyBranding(await C.loadBranding());
      const settings=await C.loadDonationSettings();
      if(settings && !settings.is_open){document.getElementById('closed-alert').classList.remove('hidden');btn.disabled=true;}
    }catch(err){console.warn(err)}
    lucide.createIcons();
  }

  form.addEventListener('submit',async e=>{
    e.preventDefault(); clearStatus();
    if(!db) return showStatus('ยังไม่ได้ตั้งค่า Supabase');
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
      form.classList.add('hidden'); document.getElementById('success-card').classList.remove('hidden');
      document.getElementById('success-request').textContent=saved.request_no||row.request_no;
      document.getElementById('success-history').textContent=saved.history_code||row.history_code;
      window.scrollTo({top:0,behavior:'smooth'}); lucide.createIcons();
    }catch(err){console.error(err);showStatus('ส่งข้อมูลไม่สำเร็จ: '+(err.message||err));btn.disabled=false;btn.innerHTML='<span class="inline-flex items-center gap-2"><i data-lucide="send" class="w-5 h-5"></i> ส่งข้อมูลการร่วมบุญ</span>';lucide.createIcons();}
  });
  init();
})();
