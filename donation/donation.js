(async () => {
  const C = window.DonationCommon;
  const db = C.db;
  let dashboard = { periods:{}, latest:[] };
  let activePeriod = 'all';

  const periodLabels={today:'วันนี้',month:'เดือนนี้',year:'ปีนี้',all:'ทั้งหมด'};
  function renderPeriod(){
    const stats=dashboard?.periods?.[activePeriod]||{};
    const label=periodLabels[activePeriod]||'ทั้งหมด';
    document.getElementById('stat-amount').textContent=C.formatTHB(stats.totalAmount||0);
    document.getElementById('stat-donors').textContent=Number(stats.donorCount||0).toLocaleString('th-TH')+' คน';
    document.getElementById('stat-count').textContent=Number(stats.donationCount||0).toLocaleString('th-TH')+' รายการ';
    document.getElementById('stat-amount-label').textContent='ยอดร่วมบุญ'+label;
    document.getElementById('stat-donors-label').textContent='ผู้บริจาค'+label;
    document.getElementById('stat-count-label').textContent='รายการ'+label;
    document.querySelectorAll('.period-btn').forEach(b=>{
      const on=b.dataset.period===activePeriod;
      b.className=`period-btn px-4 py-2 rounded-xl text-sm font-bold ${on?'bg-orange-500 text-white shadow-sm':'text-slate-600 hover:bg-orange-50'}`;
    });
  }

  document.querySelectorAll('.period-btn').forEach(b=>b.addEventListener('click',()=>{activePeriod=b.dataset.period||'all';renderPeriod()}));

  try { C.applyBranding(await C.loadBranding()); } catch (_) {}
  if (!db) {
    document.getElementById('latest-list').innerHTML = '<div class="p-5 rounded-2xl bg-rose-50 text-rose-700">ยังไม่ได้เชื่อมต่อ Supabase</div>';
    lucide.createIcons(); return;
  }

  try {
    const [settings, dashboardRes] = await Promise.all([
      C.loadDonationSettings(),
      db.rpc('get_donation_dashboard_v2')
    ]);
    if (dashboardRes.error) throw dashboardRes.error;
    dashboard = dashboardRes.data || {periods:{},latest:[]};

    if (settings) {
      document.getElementById('campaign-title').textContent = settings.campaign_title || 'ร่วมทำบุญเพื่อการศึกษา';
      document.getElementById('campaign-description').textContent = settings.campaign_description || '';
      if (settings.banner_url) { const img=document.getElementById('banner-image'); img.src=settings.banner_url; img.classList.remove('hidden'); img.onerror=()=>img.classList.add('hidden'); }
      document.getElementById('bank-name').textContent = settings.bank_name || '—';
      document.getElementById('bank-account-name').textContent = settings.bank_account_name || '—';
      document.getElementById('bank-account-no').textContent = settings.bank_account_no || '—';
      if (settings.promptpay) { document.getElementById('promptpay').textContent=settings.promptpay; document.getElementById('promptpay-row').classList.remove('hidden'); }
      if (settings.qr_image_url) { const img=document.getElementById('qr-image'); if(img){img.src=settings.qr_image_url; img.classList.remove('hidden');} document.getElementById('qr-empty')?.classList.add('hidden'); }
      if (settings.donation_note) { const note=document.getElementById('donation-note'); note.textContent=settings.donation_note; note.classList.remove('hidden'); }
    }

    renderPeriod();
    const latest = Array.isArray(dashboard.latest) ? dashboard.latest : [];
    const box = document.getElementById('latest-list');
    if (!latest.length) box.innerHTML = '<div class="rounded-2xl bg-slate-50 p-7 text-center text-slate-400">ยังไม่มีรายนามผู้ร่วมบุญที่ยืนยันแล้ว</div>';
    else box.innerHTML = latest.map((x,i) => `<div class="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5"><div class="w-11 h-11 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center font-extrabold">${i+1}</div><div class="min-w-0 flex-1"><p class="font-bold truncate">${C.escapeHtml(x.name || 'ผู้ไม่ประสงค์ออกนาม')}</p><p class="text-xs text-slate-500 mt-0.5">${C.formatDateTH(x.date)}${x.campaignName?' • '+C.escapeHtml(x.campaignName):''}</p></div><p class="text-sm font-extrabold text-orange-700">${x.amount == null ? 'ร่วมอนุโมทนา' : C.formatTHB(x.amount)}</p></div>`).join('');
  } catch (err) {
    console.error(err);
    document.getElementById('latest-list').innerHTML = `<div class="p-5 rounded-2xl bg-rose-50 text-rose-700">โหลดระบบบริจาคไม่สำเร็จ: ${C.escapeHtml(err.message || err)}<br><span class="text-xs">กรุณาตรวจว่าได้รัน Donation V15 SQL แล้ว</span></div>`;
  }
  lucide.createIcons();
})();
