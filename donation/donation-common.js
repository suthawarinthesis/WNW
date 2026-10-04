(() => {
  const db = window.SCHOOL_SUPABASE;
  const TH_LOCALE = 'th-TH';

  const escapeHtml = (value='') => String(value)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');

  const formatTHB = (value) => {
    const n = Number(value || 0);
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0) + ' บาท';
  };

  const formatDateTH = (value, opts={}) => {
    if (!value) return '-';
    const d = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T12:00:00`) : new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('th-TH', { day:'numeric', month:'long', year:'numeric', ...opts }).format(d);
  };

  const normalizeStatus = (status) => ({
    pending: { label:'รอตรวจสอบ', classes:'bg-amber-50 text-amber-700 border-amber-200' },
    verified: { label:'ยืนยันแล้ว', classes:'bg-emerald-50 text-emerald-700 border-emerald-200' },
    rejected: { label:'ไม่อนุมัติ', classes:'bg-rose-50 text-rose-700 border-rose-200' }
  }[status] || { label:status || '-', classes:'bg-slate-50 text-slate-600 border-slate-200' });

  async function loadBranding() {
    if (!db) return {};
    try {
      const { data, error } = await db.from('site_settings').select('data').eq('id',1).maybeSingle();
      if (error) throw error;
      return data?.data || {};
    } catch (err) {
      console.warn('Donation branding load failed:', err?.message || err);
      return {};
    }
  }

  async function loadDonationSettings() {
    if (!db) return null;
    const { data, error } = await db.from('donation_settings').select('*').eq('id',1).maybeSingle();
    if (error) throw error;
    return data;
  }

  function applyBranding(settings={}) {
    const branding = settings.branding || {};
    const info = settings.info || {};
    document.querySelectorAll('[data-school-name]').forEach(el => el.textContent = info.nameTh || 'โรงเรียนวัดหนองแวงวิทยา');
    document.querySelectorAll('[data-school-name-en]').forEach(el => el.textContent = info.nameEn || 'Wat Nongwang Wittaya School');
    document.querySelectorAll('[data-school-logo]').forEach(img => {
      if (branding.logoUrl) {
        img.src = branding.logoUrl;
        img.classList.remove('hidden');
        img.closest('[data-logo-frame]')?.classList.add('has-logo');
      }
    });
  }

  function templateTypeFromUrl(url='', fallback='image') {
    return /\.pdf(?:$|\?)/i.test(url) ? 'pdf' : fallback;
  }

  async function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('ไม่สามารถโหลดภาพ Template ได้'));
      img.src = url;
    });
  }

  async function renderTemplateBase(templateUrl, templateType='image', opts={}) {
    const maxWidth = opts.maxWidth || 2400;
    if (!templateUrl) {
      const canvas = document.createElement('canvas');
      canvas.width = 1400; canvas.height = 1980;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fffdf8'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.strokeStyle = '#fed7aa'; ctx.lineWidth = 4; ctx.strokeRect(35,35,canvas.width-70,canvas.height-70);
      ctx.fillStyle = '#9a3412'; ctx.textAlign = 'center'; ctx.font = '700 46px Sarabun, sans-serif';
      ctx.fillText('ตัวอย่างพื้นที่ใบอนุโมทนาบัตร', canvas.width/2, 170);
      ctx.fillStyle = '#94a3b8'; ctx.font = '400 28px Sarabun, sans-serif';
      ctx.fillText('อัปโหลด Template จริงใน Donation Manager ภายหลังได้', canvas.width/2, 225);
      return canvas;
    }

    const type = templateTypeFromUrl(templateUrl, templateType);
    if (type === 'pdf') {
      if (!window.pdfjsLib) throw new Error('ไม่พบ PDF renderer');
      const doc = await window.pdfjsLib.getDocument({ url: templateUrl }).promise;
      const page = await doc.getPage(1);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(3, Math.max(1.5, maxWidth / baseViewport.width));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      return canvas;
    }

    const img = await loadImage(templateUrl);
    const scale = img.naturalWidth > maxWidth ? maxWidth / img.naturalWidth : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function getFieldValue(key, certData) {
    if (key === 'name') return certData.display_name || certData.name || '';
    if (key === 'amount') return formatTHB(certData.amount);
    if (key === 'certificate_no') return certData.certificate_no || '';
    return '';
  }

  function drawFittedText(ctx, text, x, y, style, canvasWidth) {
    const baseSize = Math.max(12, canvasWidth * (Number(style.fontSize || 2.6) / 100));
    const maxWidth = canvasWidth * (Number(style.maxWidth || 80) / 100);
    let fontSize = baseSize;
    const weight = style.weight || (style.bold ? '700' : '600');
    ctx.textAlign = style.align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = style.color || '#1f2937';
    do {
      ctx.font = `${weight} ${fontSize}px Sarabun, sans-serif`;
      if (ctx.measureText(text).width <= maxWidth || fontSize <= 12) break;
      fontSize -= 1;
    } while (fontSize > 12);
    ctx.fillText(text, x, y);
  }

  async function renderCertificateCanvas(certData, donationSettings, opts={}) {
    if (!donationSettings?.certificate_template_url && opts.requireTemplate !== false) {
      throw new Error('ยังไม่ได้ตั้งค่า Template ใบอนุโมทนาบัตรใน Donation Manager');
    }
    try { await document.fonts?.load('600 32px Sarabun'); } catch (_) {}
    const canvas = await renderTemplateBase(
      donationSettings?.certificate_template_url || '',
      donationSettings?.certificate_template_type || 'image',
      { maxWidth: opts.maxWidth || 2600 }
    );
    const ctx = canvas.getContext('2d');
    const layout = donationSettings?.certificate_layout || {};
    ['name','amount','certificate_no'].forEach(key => {
      const style = layout[key] || {};
      const x = canvas.width * (Number(style.x ?? 50) / 100);
      const y = canvas.height * (Number(style.y ?? 50) / 100);
      drawFittedText(ctx, getFieldValue(key, certData), x, y, style, canvas.width);
    });
    return canvas;
  }

  async function downloadCertificatePng(certData, donationSettings) {
    const canvas = await renderCertificateCanvas(certData, donationSettings);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1));
    if (!blob) throw new Error('สร้างไฟล์ PNG ไม่สำเร็จ');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${certData.certificate_no || 'anumodana'}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function downloadCertificatePdf(certData, donationSettings) {
    if (!window.jspdf?.jsPDF) throw new Error('ไม่พบระบบสร้าง PDF');
    const canvas = await renderCertificateCanvas(certData, donationSettings);
    const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation, unit:'px', format:[canvas.width, canvas.height], hotfixes:['px_scaling'] });
    pdf.addImage(canvas.toDataURL('image/png',1), 'PNG', 0, 0, canvas.width, canvas.height, undefined, 'FAST');
    pdf.save(`${certData.certificate_no || 'anumodana'}.pdf`);
  }

  window.DonationCommon = {
    db,
    escapeHtml,
    formatTHB,
    formatDateTH,
    normalizeStatus,
    loadBranding,
    loadDonationSettings,
    applyBranding,
    renderTemplateBase,
    renderCertificateCanvas,
    downloadCertificatePng,
    downloadCertificatePdf
  };
})();
