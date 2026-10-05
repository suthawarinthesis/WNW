/**
 * WNW Donation Certificate Generator — V27 PHOTO + STATUS SYNC
 * Google Slides tags:
 *   {{donor_name}}
 *   {{donation_amount}}
 *   {{certificate_no}}
 *   {{verify_qr}}  <-- put this tag in its own Text Box where the QR should appear
 *
 * Deploy as Web App: Execute as Me / Who has access: Anyone
 */
const SUPABASE_URL = 'https://pcapjltgscofrgfcvdkm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NTJJiE0r1hojS-8DTRzWFA_3BPADfEH';
const DEFAULT_TEMPLATE_ID = '1N0OEEhnCdfqn5ohtZa47pUfenVYizdePtXo9vGsVGy4';
const DEFAULT_FOLDER_ID = '1JUTSXLLdR7X5KiV6KINe6Nk85DS-YdYk';
const DEFAULT_PROMO_TEMPLATE_ID = '1aj3h3pMB-Ulz1SuldI-ckBlddfralVwF7sfx0x65cNE';
const DEFAULT_PROMO_FOLDER_ID = '1H_PEfawTOnn7LM4Pi6CSWJ6CYVnTo-iF';
const DEFAULT_PROMO_FALLBACK_PHOTO_URL = 'https://i.postimg.cc/Kz6vK8gM/Screenshot-2026-10-04-181000.png';
const BUILTIN_PROMO_FALLBACK_PNG_BASE64 = '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';
const TAGS = {
  donor_name: '{{donor_name}}',
  donation_amount: '{{donation_amount}}',
  certificate_no: '{{certificate_no}}',
  verify_qr: '{{verify_qr}}',
  photo: '{{photo}}'
};

function doGet() {
  return HtmlService.createHtmlOutput('<h3>WNW Donation V27 PHOTO + STATUS SYNC</h3><p>Auto Certificate + Auto Nikorn + Drive resource-key photo support</p>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function requestParams_(e) {
  const p = Object.assign({}, (e && e.parameter) || {});
  try {
    const raw = e && e.postData && e.postData.contents ? String(e.postData.contents) : '';
    const type = e && e.postData && e.postData.type ? String(e.postData.type).toLowerCase() : '';
    if (raw && type.indexOf('application/json') !== -1) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) Object.assign(p, obj);
    }
  } catch (err) {
    throw new Error('อ่านข้อมูลคำสั่งอัตโนมัติไม่สำเร็จ: ' + (err && err.message ? err.message : String(err)));
  }
  return p;
}

function doPost(e) {
  const p = requestParams_(e);
  const requestId = String(p.request_id || '');
  const targetOrigin = /^https?:\/\/[^\s]+$/i.test(String(p.callback_origin || '')) ? String(p.callback_origin) : '*';
  const action = String(p.action || '');
  const isPublicAutoAction = action === 'auto_process_submission';
  try {
    let data;
    if (isPublicAutoAction) {
      data = autoProcessSubmission_(p);
      return simpleHtmlResponse_(true, data, 'ระบบกำลังดำเนินการอัตโนมัติเรียบร้อยแล้ว');
    }

    verifySupabaseManager_(String(p.access_token || ''));
    const templateId = safeId_(p.template_id) || DEFAULT_TEMPLATE_ID;
    const folderId = safeId_(p.folder_id) || DEFAULT_FOLDER_ID;
    if (action === 'validate') data = validateTemplate_(templateId, folderId);
    else if (action === 'generate') data = generateCertificate_(templateId, folderId, p);
    else if (action === 'validate_promo') data = validatePromoTemplate_(safeId_(p.template_id) || DEFAULT_PROMO_TEMPLATE_ID, safeId_(p.folder_id) || DEFAULT_PROMO_FOLDER_ID);
    else if (action === 'generate_promo') data = generatePromoImage_(safeId_(p.template_id) || DEFAULT_PROMO_TEMPLATE_ID, safeId_(p.folder_id) || DEFAULT_PROMO_FOLDER_ID, p);
    else if (action === 'delete_certificate') data = deleteCertificate_(folderId, p);
    else throw new Error('action ไม่ถูกต้อง');
    return callbackHtml_(targetOrigin, requestId, true, data, '');
  } catch (err) {
    if (isPublicAutoAction) return simpleHtmlResponse_(false, null, err && err.message ? err.message : String(err));
    return callbackHtml_(targetOrigin, requestId, false, null, err && err.message ? err.message : String(err));
  }
}

function verifySupabaseManager_(token) {
  if (!token) throw new Error('ไม่พบ Supabase access token');
  const res = UrlFetchApp.fetch(SUPABASE_URL + '/auth/v1/user', {
    method: 'get', muteHttpExceptions: true,
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
  });
  if (res.getResponseCode() !== 200) throw new Error('Supabase session ไม่ถูกต้องหรือหมดอายุ');
  const user = JSON.parse(res.getContentText() || '{}');
  if (!user.id || user.is_anonymous === true) throw new Error('บัญชีนี้ไม่มีสิทธิ์ Website Manager');
  return user;
}

function safeId_(value) {
  const v = String(value || '').trim();
  return /^[A-Za-z0-9_-]{15,}$/.test(v) ? v : '';
}


function safeUuid_(value) {
  const v = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v) ? v : '';
}

function callSupabaseRpc_(fnName, payload) {
  const res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent(fnName), {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Prefer: 'return=representation'
    },
    payload: JSON.stringify(payload || {})
  });
  const code = res.getResponseCode();
  const body = res.getContentText() || '';
  if (code < 200 || code >= 300) throw new Error('Supabase RPC ' + fnName + ' ไม่สำเร็จ: HTTP ' + code + ' ' + body.slice(0, 400));
  return body ? JSON.parse(body) : null;
}

function firstRow_(data) {
  return Array.isArray(data) ? (data[0] || null) : data;
}

function formatAmountTag_(value) {
  const n = Number(value || 0);
  if (!isFinite(n)) return '0.00';
  const parts = n.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

function autoProcessSubmission_(p) {
  const donationId = safeUuid_(p.donation_id);
  const autoToken = safeUuid_(p.auto_process_token);
  if (!donationId || !autoToken) throw new Error('ข้อมูล auto process token ไม่ถูกต้อง');

  const prepared = firstRow_(callSupabaseRpc_('auto_prepare_donation_processing', {
    p_id: donationId,
    p_auto_process_token: autoToken
  }));
  if (!prepared || !prepared.certificate_no) throw new Error('ไม่พบข้อมูลรายการบริจาคสำหรับสร้างอัตโนมัติ');

  const donorName = String(prepared.certificate_name || prepared.display_name || '').trim();
  const amountText = formatAmountTag_(prepared.amount);
  const verifyBase = String(prepared.verify_base_url || p.verify_base_url || 'https://wnw-vit.site/donation/verify/?no=').trim();
  const verifyUrl = verifyBase + encodeURIComponent(prepared.certificate_no);
  const certificateTemplateId = safeId_(prepared.google_slides_template_id) || safeId_(p.template_id) || DEFAULT_TEMPLATE_ID;
  const certificateFolderId = safeId_(prepared.google_drive_folder_id) || safeId_(p.folder_id) || DEFAULT_FOLDER_ID;
  const promoTemplateId = safeId_(prepared.nikorn_google_slides_template_id) || safeId_(p.promo_template_id) || DEFAULT_PROMO_TEMPLATE_ID;
  const promoFolderId = safeId_(prepared.nikorn_google_drive_folder_id) || safeId_(p.promo_folder_id) || DEFAULT_PROMO_FOLDER_ID;
  const fallbackPhotoUrl = String(prepared.nikorn_fallback_photo_url || p.fallback_photo_url || DEFAULT_PROMO_FALLBACK_PHOTO_URL).trim();

  let certResult = null, certStatus = 'not_generated', certError = '';
  try {
    certResult = generateCertificate_(certificateTemplateId, certificateFolderId, {
      donor_name: donorName,
      donation_amount: amountText,
      certificate_no: prepared.certificate_no,
      verify_url: verifyUrl
    });
    certStatus = certResult && certResult.pdf_url ? 'ready' : 'error';
    if (certStatus === 'error') certError = 'Google Apps Script ไม่ได้ส่งลิงก์ PDF กลับมา';
  } catch (err) {
    certStatus = 'error';
    certError = err && err.message ? err.message : String(err);
  }

  let promoResult = null, promoStatus = 'not_generated', promoError = '';
  try {
    promoResult = generatePromoImage_(promoTemplateId, promoFolderId, {
      donor_name: donorName,
      donation_amount: amountText,
      certificate_no: prepared.certificate_no,
      request_no: prepared.request_no,
      photo_url: prepared.photo_url || '',
      fallback_photo_url: fallbackPhotoUrl
    });
    promoStatus = promoResult && promoResult.image_url ? 'ready' : 'error';
    if (promoStatus === 'error') promoError = 'Google Apps Script ไม่ได้ส่งลิงก์ภาพผู้บริจาคกลับมา';
  } catch (err) {
    promoStatus = 'error';
    promoError = err && err.message ? err.message : String(err);
  }

  const saved = firstRow_(callSupabaseRpc_('auto_complete_donation_processing', {
    p_id: donationId,
    p_auto_process_token: autoToken,
    p_certificate_pdf_url: certResult ? certResult.pdf_url || '' : '',
    p_certificate_drive_file_id: certResult ? certResult.file_id || '' : '',
    p_certificate_image_url: certResult ? certResult.image_url || '' : '',
    p_certificate_image_drive_file_id: certResult ? certResult.image_file_id || '' : '',
    p_certificate_generation_status: certStatus,
    p_certificate_generation_error: certError,
    p_nikorn_image_url: promoResult ? promoResult.image_url || '' : '',
    p_nikorn_image_drive_file_id: promoResult ? promoResult.image_file_id || '' : '',
    p_nikorn_generation_status: promoStatus,
    p_nikorn_generation_error: promoError
  })) || {};

  return {
    donation_id: donationId,
    certificate_no: prepared.certificate_no,
    certificate_generation_status: certStatus,
    nikorn_generation_status: promoStatus,
    certificate_pdf_url: saved.certificate_pdf_url || (certResult ? certResult.pdf_url || '' : ''),
    certificate_image_url: saved.certificate_image_url || (certResult ? certResult.image_url || '' : ''),
    nikorn_image_url: saved.nikorn_image_url || (promoResult ? promoResult.image_url || '' : ''),
    certificate_error: certError,
    nikorn_error: promoError
  };
}

function simpleHtmlResponse_(ok, data, message) {
  const payload = JSON.stringify({ ok: ok, data: data || null, message: message || '' }).replace(/</g, '\u003c');
  const html = '<!doctype html><meta charset="utf-8">' +
    '<script>window.__wnwAutoResult=' + payload + ';<\/script>' +
    '<div style="font-family:Arial,sans-serif;font-size:14px;padding:16px;color:' + (ok ? '#166534' : '#b91c1c') + '">' +
    (ok ? 'ระบบดำเนินการอัตโนมัติเรียบร้อยแล้ว' : ('ดำเนินการอัตโนมัติไม่สำเร็จ: ' + String(message || 'ไม่ทราบสาเหตุ').replace(/</g, '&lt;'))) +
    '</div>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function validateTemplate_(templateId, folderId) {
  const file = DriveApp.getFileById(templateId);
  if (file.getMimeType() !== MimeType.GOOGLE_SLIDES) throw new Error('Template ต้องเป็น Google Slides');
  DriveApp.getFolderById(folderId).getName();
  const pres = SlidesApp.openById(templateId);
  const allText = collectPresentationText_(pres);
  const tags = {
    donor_name: countText_(allText, TAGS.donor_name),
    donation_amount: countText_(allText, TAGS.donation_amount),
    certificate_no: countText_(allText, TAGS.certificate_no),
    verify_qr: countText_(allText, TAGS.verify_qr)
  };
  return {
    template_name: file.getName(),
    tags: tags,
    ready: tags.donor_name > 0 && tags.donation_amount > 0 && tags.certificate_no > 0 && tags.verify_qr > 0
  };
}

function validatePromoTemplate_(templateId, folderId) {
  const file = DriveApp.getFileById(templateId);
  if (file.getMimeType() !== MimeType.GOOGLE_SLIDES) throw new Error('Template ต้องเป็น Google Slides');
  DriveApp.getFolderById(folderId).getName();
  const pres = SlidesApp.openById(templateId);
  const allText = collectPresentationText_(pres);
  const tags = {
    donor_name: countText_(allText, TAGS.donor_name),
    donation_amount: countText_(allText, TAGS.donation_amount),
    photo: countText_(allText, TAGS.photo)
  };
  return {
    template_name: file.getName(),
    tags: tags,
    ready: tags.donor_name > 0 && tags.donation_amount > 0 && tags.photo > 0
  };
}

function generateCertificate_(templateId, folderId, p) {
  const donorName = String(p.donor_name || '').trim();
  const amount = String(p.donation_amount || '').trim();
  const certificateNo = String(p.certificate_no || '').trim().toUpperCase();
  const verifyUrl = String(p.verify_url || '').trim();
  if (!donorName) throw new Error('ชื่อผู้บริจาคว่าง');
  if (!amount) throw new Error('จำนวนเงินว่าง');
  if (!/^[A-Z0-9-]{6,80}$/.test(certificateNo)) throw new Error('เลขใบอนุโมทนาบัตรไม่ถูกต้อง');
  if (!/^https?:\/\//i.test(verifyUrl)) throw new Error('ลิงก์ตรวจสอบใบไม่ถูกต้อง');

  const check = validateTemplate_(templateId, folderId);
  if (!check.ready) throw new Error('Google Slides Template มี Tag ไม่ครบ 4 รายการ กรุณาตรวจ {{verify_qr}}');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let workingCopy = null;
  try {
    const folder = DriveApp.getFolderById(folderId);
    const pdfName = certificateNo + '.pdf';
    const imageName = certificateNo + '.png';
    trashFilesByName_(folder, pdfName);
    trashFilesByName_(folder, imageName);

    workingCopy = DriveApp.getFileById(templateId).makeCopy('_working_' + certificateNo + '_' + Date.now(), folder);
    const pres = SlidesApp.openById(workingCopy.getId());
    const n1 = pres.replaceAllText(TAGS.donor_name, donorName);
    const n2 = pres.replaceAllText(TAGS.donation_amount, amount);
    const n3 = pres.replaceAllText(TAGS.certificate_no, certificateNo);
    const n4 = replaceQrPlaceholders_(pres, verifyUrl);
    const slideId = pres.getSlides()[0].getObjectId();
    pres.saveAndClose();
    if (n1 < 1 || n2 < 1 || n3 < 1 || n4 < 1) throw new Error('Replace Tag/QR ไม่ครบ กรุณาตรวจ Template');

    Utilities.sleep(900);
    const pdfBlob = workingCopy.getAs(MimeType.PDF).setName(pdfName);
    const pdf = folder.createFile(pdfBlob);
    let publicSharing = true;
    try { pdf.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (shareErr) { publicSharing = false; }

    let image = null;
    let imagePublicSharing = true;
    let imageError = '';
    try {
      Utilities.sleep(700);
      const pngBlob = fetchSlideThumbnailBlob_(workingCopy.getId(), slideId).setName(imageName);
      image = folder.createFile(pngBlob);
      try { image.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (shareErr2) { imagePublicSharing = false; }
    } catch (imgErr) {
      imageError = imgErr && imgErr.message ? imgErr.message : String(imgErr);
    }

    return {
      file_id: pdf.getId(),
      pdf_url: 'https://drive.google.com/file/d/' + pdf.getId() + '/view',
      download_url: 'https://drive.google.com/uc?export=download&id=' + pdf.getId(),
      file_name: pdf.getName(),
      public_sharing: publicSharing,
      image_file_id: image ? image.getId() : '',
      image_url: image ? ('https://drive.google.com/thumbnail?id=' + image.getId() + '&sz=w1600') : '',
      image_download_url: image ? ('https://drive.google.com/uc?export=download&id=' + image.getId()) : '',
      image_file_name: image ? image.getName() : '',
      image_public_sharing: image ? imagePublicSharing : false,
      image_error: imageError,
      verify_url: verifyUrl,
      replaced: { donor_name:n1, donation_amount:n2, certificate_no:n3, verify_qr:n4 }
    };
  } finally {
    try { if (workingCopy) workingCopy.setTrashed(true); } catch (_) {}
    lock.releaseLock();
  }
}


function generatePromoImage_(templateId, folderId, p) {
  const donorName = String(p.donor_name || '').trim();
  const amount = String(p.donation_amount || '').trim();
  const certificateNo = String(p.certificate_no || p.request_no || ('DONATION-' + Date.now())).trim().toUpperCase();
  const primaryPhotoUrl = String(p.photo_url || '').trim();
  const fallbackPhotoUrl = String(p.fallback_photo_url || '').trim() || DEFAULT_PROMO_FALLBACK_PHOTO_URL;
  if (!donorName) throw new Error('ชื่อผู้บริจาคว่าง');
  if (!amount) throw new Error('จำนวนเงินว่าง');

  const check = validatePromoTemplate_(templateId, folderId);
  if (!check.ready) throw new Error('Template ภาพประชาสัมพันธ์มี Tag ไม่ครบ กรุณาตรวจ {{donor_name}}, {{donation_amount}}, {{photo}}');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let workingCopy = null;
  try {
    const folder = DriveApp.getFolderById(folderId);
    const imageName = 'nikorn-' + certificateNo + '.png';
    trashFilesByName_(folder, imageName);

    workingCopy = DriveApp.getFileById(templateId).makeCopy('_promo_' + certificateNo + '_' + Date.now(), folder);
    const pres = SlidesApp.openById(workingCopy.getId());
    const n1 = pres.replaceAllText(TAGS.donor_name, donorName);
    const n2 = pres.replaceAllText(TAGS.donation_amount, amount);

    // รูปผู้บริจาค: Drive จะดึงด้วย DriveApp/OAuth ก่อน เพื่อไม่ติด 403 จาก uc?export=download
    // ถ้ารูปผู้บริจาคเปิดไม่ได้ จะลองรูป fallback และถ้ายังไม่ได้อีกจะสร้างโปสเตอร์ต่อโดยเว้นช่องรูปไว้
    const photoResult = fetchPromoPhotoBlob_(primaryPhotoUrl, fallbackPhotoUrl);
    const n3 = replaceImagePlaceholders_(pres, TAGS.photo, photoResult.blob);

    const slideId = pres.getSlides()[0].getObjectId();
    pres.saveAndClose();
    if (n1 < 1 || n2 < 1 || n3 < 1) throw new Error('Replace ข้อมูลภาพประชาสัมพันธ์ไม่ครบ กรุณาตรวจ Template');

    Utilities.sleep(900);
    const pngBlob = fetchSlideThumbnailBlob_(workingCopy.getId(), slideId).setName(imageName);
    const image = folder.createFile(pngBlob);
    let publicSharing = true;
    try { image.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (shareErr) { publicSharing = false; }

    return {
      image_file_id: image.getId(),
      image_url: 'https://drive.google.com/thumbnail?id=' + image.getId() + '&sz=w1600',
      image_download_url: 'https://drive.google.com/uc?export=download&id=' + image.getId(),
      image_file_name: image.getName(),
      public_sharing: publicSharing,
      source_photo_url: photoResult.used_url || '',
      photo_fallback_used: photoResult.fallback_used === true,
      photo_builtin_fallback_used: photoResult.builtin_fallback_used === true,
      photo_warning: photoResult.warning || '',
      replaced: { donor_name:n1, donation_amount:n2, photo:n3 }
    };
  } finally {
    try { if (workingCopy) workingCopy.setTrashed(true); } catch (_) {}
    lock.releaseLock();
  }
}

function trashFilesByName_(folder, fileName) {
  const files = folder.getFilesByName(fileName);
  while (files.hasNext()) files.next().setTrashed(true);
}

function fetchSlideThumbnailBlob_(presentationId, slideObjectId) {
  const token = ScriptApp.getOAuthToken();

  // วิธีหลัก: ใช้ Google Slides export URL โดยตรง
  // วิธีนี้ไม่ต้องพึ่ง presentations.pages.getThumbnail ของ Slides REST API
  // จึงช่วยแก้กรณี HTTP 403 จาก slides.googleapis.com
  const exportUrl =
    'https://docs.google.com/presentation/d/' +
    encodeURIComponent(presentationId) +
    '/export/png?pageid=' +
    encodeURIComponent(slideObjectId);

  const exportRes = UrlFetchApp.fetch(exportUrl, {
    method: 'get',
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { Authorization: 'Bearer ' + token }
  });

  const exportCode = exportRes.getResponseCode();
  const exportType = String(exportRes.getHeaders()['Content-Type'] || exportRes.getBlob().getContentType() || '');

  if (exportCode >= 200 && exportCode < 300 && exportType.toLowerCase().indexOf('image/') === 0) {
    return exportRes.getBlob().setName('slide-image.png');
  }

  // Fallback: Slides REST API แบบเดิม
  const endpoint =
    'https://slides.googleapis.com/v1/presentations/' +
    encodeURIComponent(presentationId) +
    '/pages/' +
    encodeURIComponent(slideObjectId) +
    '/thumbnail?thumbnailProperties.mimeType=PNG&thumbnailProperties.thumbnailSize=LARGE';

  const res = UrlFetchApp.fetch(endpoint, {
    method: 'get',
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token }
  });

  if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
    const payload = JSON.parse(res.getContentText() || '{}');
    if (payload.contentUrl) {
      const imgRes = UrlFetchApp.fetch(payload.contentUrl, {
        muteHttpExceptions: true,
        followRedirects: true
      });
      if (imgRes.getResponseCode() >= 200 && imgRes.getResponseCode() < 300) {
        return imgRes.getBlob().setName('slide-image.png');
      }
    }
  }

  const exportBody = String(exportRes.getContentText() || '').slice(0, 300).replace(/\s+/g, ' ');
  const apiBody = String(res.getContentText() || '').slice(0, 300).replace(/\s+/g, ' ');
  throw new Error(
    'สร้างภาพจาก Google Slides ไม่สำเร็จ ' +
    '(export HTTP ' + exportCode +
    ', Slides API HTTP ' + res.getResponseCode() + '). ' +
    'export=' + exportBody + ' api=' + apiBody
  );
}



function replaceImagePlaceholders_(pres, tag, imageBlob) {
  const targets = [];
  pres.getSlides().forEach(function(slide) {
    slide.getPageElements().forEach(function(el) { collectTagTargets_(slide, el, tag, targets); });
  });
  if (!targets.length) return 0;
  targets.forEach(function(t) {
    const el = t.element;
    t.slide.insertImage(imageBlob.copyBlob(), el.getLeft(), el.getTop(), Math.max(28, el.getWidth()), Math.max(28, el.getHeight()));
    el.remove();
  });
  return targets.length;
}

function collectTagTargets_(slide, el, tag, targets) {
  try {
    const t = el.getPageElementType();
    if (t === SlidesApp.PageElementType.SHAPE) {
      const text = el.asShape().getText().asString();
      if (text.indexOf(tag) !== -1) targets.push({ slide:slide, element:el });
    } else if (t === SlidesApp.PageElementType.GROUP) {
      el.asGroup().getChildren().forEach(function(child) { collectTagTargets_(slide, child, tag, targets); });
    }
  } catch (_) {}
}

function extractDriveFileId_(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const m = value.match(/\/file\/d\/([A-Za-z0-9_-]+)/) ||
            value.match(/[?&]id=([A-Za-z0-9_-]+)/) ||
            value.match(/\/thumbnail\?id=([A-Za-z0-9_-]+)/) ||
            value.match(/\/d\/([A-Za-z0-9_-]+)(?:[=/]|$)/);
  return m && m[1] ? m[1] : '';
}

function extractDriveResourceKey_(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const m = value.match(/[?&]resourcekey=([^&#]+)/i);
  if (!m || !m[1]) return '';
  try { return decodeURIComponent(m[1]); } catch (_) { return m[1]; }
}

function normalizePublicImageUrl_(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const id = extractDriveFileId_(value);
  if (id) {
    const rk = extractDriveResourceKey_(value);
    return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) +
      '&sz=w1600' + (rk ? '&resourcekey=' + encodeURIComponent(rk) : '');
  }
  return value;
}

function ensureImageBlob_(blob, name) {
  if (!blob) throw new Error('ไม่พบข้อมูลรูปภาพ');
  const type = String(blob.getContentType() || '').toLowerCase();
  if (type && type.indexOf('image/') !== 0) throw new Error('ไฟล์ที่ดึงมาไม่ใช่รูปภาพ (' + type + ')');
  return blob.setName(name || 'donor-photo');
}

function fetchDriveImageBlob_(fileId, resourceKey) {
  let lastError = '';
  try {
    let file;
    if (resourceKey && typeof DriveApp.getFileByIdAndResourceKey === 'function') {
      file = DriveApp.getFileByIdAndResourceKey(fileId, resourceKey);
    } else {
      file = DriveApp.getFileById(fileId);
    }
    return ensureImageBlob_(file.getBlob(), 'donor-photo');
  } catch (err) {
    lastError = err && err.message ? err.message : String(err);
  }

  try {
    const apiUrl = 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '?alt=media&supportsAllDrives=true';
    const headers = {Authorization:'Bearer ' + ScriptApp.getOAuthToken()};
    if (resourceKey) headers['X-Goog-Drive-Resource-Keys'] = fileId + '/' + resourceKey;
    const res = UrlFetchApp.fetch(apiUrl, {
      method:'get', muteHttpExceptions:true, followRedirects:true, headers:headers
    });
    if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
      return ensureImageBlob_(res.getBlob(), 'donor-photo');
    }
    lastError = 'Google Drive API HTTP ' + res.getResponseCode();
  } catch (err2) {
    lastError = err2 && err2.message ? err2.message : String(err2);
  }

  const suffix = resourceKey ? '&resourcekey=' + encodeURIComponent(resourceKey) : '';
  const publicUrls = [
    'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId) + '&sz=w1600' + suffix,
    'https://drive.usercontent.google.com/download?id=' + encodeURIComponent(fileId) + '&export=download&confirm=t' + suffix,
    'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(fileId) + suffix,
    'https://lh3.googleusercontent.com/d/' + encodeURIComponent(fileId) + '=w1600'
  ];
  for (let i=0;i<publicUrls.length;i++) {
    try {
      const res = UrlFetchApp.fetch(publicUrls[i], {
        muteHttpExceptions:true,
        followRedirects:true,
        headers:{'User-Agent':'Mozilla/5.0','Accept':'image/*,*/*;q=0.8'}
      });
      if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
        return ensureImageBlob_(res.getBlob(), 'donor-photo');
      }
      lastError = 'Google Drive public HTTP ' + res.getResponseCode();
    } catch (err3) {
      lastError = err3 && err3.message ? err3.message : String(err3);
    }
  }

  throw new Error('ดึงรูปจาก Google Drive ไม่สำเร็จ: ' + lastError);
}

function fetchRemoteImageBlob_(url) {
  const raw = String(url || '').trim();
  if (!raw) throw new Error('ลิงก์รูปภาพว่าง');

  const driveId = extractDriveFileId_(raw);
  if (driveId) return fetchDriveImageBlob_(driveId, extractDriveResourceKey_(raw));

  if (!/^https?:\/\//i.test(raw)) throw new Error('ลิงก์รูปภาพไม่ถูกต้อง');
  let referer = '';
  try { const u = new URL(raw); referer = u.protocol + '//' + u.host + '/'; } catch (_) {}
  const attempts = [
    { 'User-Agent':'Mozilla/5.0', 'Accept':'image/avif,image/webp,image/apng,image/*,*/*;q=0.8', ...(referer?{'Referer':referer}:{}) },
    { 'User-Agent':'Mozilla/5.0', 'Accept':'image/*,*/*;q=0.8' },
    { 'Accept':'image/*,*/*;q=0.8' },
    {}
  ];
  let lastCode = 0;
  for (let i=0;i<attempts.length;i++) {
    try {
      const res = UrlFetchApp.fetch(raw, { muteHttpExceptions:true, followRedirects:true, headers:attempts[i] });
      lastCode = res.getResponseCode();
      if (lastCode >= 200 && lastCode < 300) return ensureImageBlob_(res.getBlob(), 'donor-photo');
    } catch (_) {}
  }
  throw new Error('ดาวน์โหลดรูปภาพไม่สำเร็จ: HTTP ' + lastCode);
}

function builtinPromoFallbackBlob_() {
  return Utilities.newBlob(
    Utilities.base64Decode(BUILTIN_PROMO_FALLBACK_PNG_BASE64),
    'image/png',
    'nikorn-built-in-fallback.png'
  );
}

function fetchPromoPhotoBlob_(primaryUrl, fallbackUrl) {
  const candidates = [];
  [primaryUrl, fallbackUrl, DEFAULT_PROMO_FALLBACK_PHOTO_URL].forEach(function(u) {
    const v = String(u || '').trim();
    if (v && candidates.indexOf(v) === -1) candidates.push(v);
  });

  const errors = [];
  for (let i=0;i<candidates.length;i++) {
    try {
      return {
        blob: fetchRemoteImageBlob_(candidates[i]),
        used_url: candidates[i],
        fallback_used: i > 0,
        builtin_fallback_used: false,
        warning: errors.length ? errors.join(' | ') : ''
      };
    } catch (err) {
      errors.push((i===0?'รูปผู้บริจาค':'รูปสำรอง') + ': ' + (err && err.message ? err.message : String(err)));
    }
  }

  // ขั้นสุดท้าย: ใช้ PNG ที่ฝังอยู่ใน Code.gs เอง
  // จึงไม่ทำให้ภาพ พม.นิกรล้มเพราะ URL รูปภายนอกตอบ 403
  return {
    blob: builtinPromoFallbackBlob_(),
    used_url: 'builtin://nikorn-fallback',
    fallback_used: true,
    builtin_fallback_used: true,
    warning: errors.join(' | ')
  };
}

function replaceQrPlaceholders_(pres, verifyUrl) {
  const targets = [];
  pres.getSlides().forEach(function(slide) {
    slide.getPageElements().forEach(function(el) { collectQrTargets_(slide, el, targets); });
  });
  if (!targets.length) return 0;

  const qrBlob = fetchQrBlob_(verifyUrl);
  targets.forEach(function(t) {
    const el = t.element;
    const left = el.getLeft();
    const top = el.getTop();
    const width = Math.max(28, el.getWidth());
    const height = Math.max(28, el.getHeight());
    const size = Math.min(width, height);
    const x = left + (width - size) / 2;
    const y = top + (height - size) / 2;
    t.slide.insertImage(qrBlob.copyBlob(), x, y, size, size);
    el.remove();
  });
  return targets.length;
}

function collectQrTargets_(slide, el, targets) {
  try {
    const t = el.getPageElementType();
    if (t === SlidesApp.PageElementType.SHAPE) {
      const text = el.asShape().getText().asString();
      if (text.indexOf(TAGS.verify_qr) !== -1) targets.push({ slide:slide, element:el });
    } else if (t === SlidesApp.PageElementType.GROUP) {
      el.asGroup().getChildren().forEach(function(child) { collectQrTargets_(slide, child, targets); });
    }
  } catch (_) {}
}

function fetchQrBlob_(verifyUrl) {
  const endpoints = [
    'https://quickchart.io/qr?size=700&margin=1&format=png&text=' + encodeURIComponent(verifyUrl),
    'https://api.qrserver.com/v1/create-qr-code/?size=700x700&margin=10&format=png&data=' + encodeURIComponent(verifyUrl)
  ];
  let lastError = '';
  for (let i=0;i<endpoints.length;i++) {
    try {
      const res = UrlFetchApp.fetch(endpoints[i], { muteHttpExceptions:true, followRedirects:true });
      if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) return res.getBlob().setName('verify-qr.png');
      lastError = 'HTTP ' + res.getResponseCode();
    } catch (err) { lastError = err && err.message ? err.message : String(err); }
  }
  throw new Error('สร้าง QR ไม่สำเร็จ: ' + lastError);
}

function deleteCertificate_(folderId, p) {
  const fileId = safeId_(p.file_id);
  if (!fileId) return { deleted:false, reason:'no_file_id' };
  const folder = DriveApp.getFolderById(folderId);
  const file = DriveApp.getFileById(fileId);
  let belongsToFolder = false;
  const parents = file.getParents();
  while (parents.hasNext()) { if (parents.next().getId() === folder.getId()) { belongsToFolder = true; break; } }
  if (!belongsToFolder) throw new Error('ไฟล์ไม่ได้อยู่ในโฟลเดอร์ใบอนุโมทนาบัตรที่กำหนด');
  file.setTrashed(true);
  return { deleted:true, file_id:fileId };
}

function collectPresentationText_(pres) {
  const parts = [];
  pres.getSlides().forEach(function(slide) { slide.getPageElements().forEach(function(el) { collectElementText_(el, parts); }); });
  return parts.join('\n');
}

function collectElementText_(el, parts) {
  try {
    const t = el.getPageElementType();
    if (t === SlidesApp.PageElementType.SHAPE) parts.push(el.asShape().getText().asString());
    else if (t === SlidesApp.PageElementType.TABLE) {
      const table = el.asTable();
      for (let r=0;r<table.getNumRows();r++) for (let c=0;c<table.getNumColumns();c++) parts.push(table.getCell(r,c).getText().asString());
    } else if (t === SlidesApp.PageElementType.GROUP) {
      el.asGroup().getChildren().forEach(function(child) { collectElementText_(child, parts); });
    }
  } catch (_) {}
}

function countText_(text, needle) { return needle ? String(text).split(needle).length - 1 : 0; }

function callbackHtml_(origin, requestId, ok, data, error) {
  const payload = JSON.stringify({ source:'wnw-donation-google-slides', request_id:requestId, ok:ok, data:data, error:error }).replace(/</g, '\\u003c');
  const safeOrigin = JSON.stringify(origin);
  const html = '<!doctype html><meta charset="utf-8">' +
    '<script>(function(){' +
    'var message=' + payload + ';' +
    'var target=' + safeOrigin + ';' +
    'var receiver=(window.top&&window.top!==window)?window.top:window.parent;' +
    'receiver.postMessage(message,target);' +
    '})();<\/script>' +
    '<p style="font-family:sans-serif">ดำเนินการเสร็จแล้ว</p>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
