/**
 * WNW Donation Certificate Generator — V21
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
const TAGS = {
  donor_name: '{{donor_name}}',
  donation_amount: '{{donation_amount}}',
  certificate_no: '{{certificate_no}}',
  verify_qr: '{{verify_qr}}',
  photo: '{{photo}}'
};

function doGet() {
  return HtmlService.createHtmlOutput('<h3>WNW Donation Certificate Generator V19</h3><p>Web App พร้อมทำงาน</p>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  const p = (e && e.parameter) || {};
  const requestId = String(p.request_id || '');
  const targetOrigin = /^https?:\/\/[^\s]+$/i.test(String(p.callback_origin || '')) ? String(p.callback_origin) : '*';
  try {
    verifySupabaseManager_(String(p.access_token || ''));
    const action = String(p.action || '');
    const templateId = safeId_(p.template_id) || DEFAULT_TEMPLATE_ID;
    const folderId = safeId_(p.folder_id) || DEFAULT_FOLDER_ID;
    let data;
    if (action === 'validate') data = validateTemplate_(templateId, folderId);
    else if (action === 'generate') data = generateCertificate_(templateId, folderId, p);
    else if (action === 'validate_promo') data = validatePromoTemplate_(safeId_(p.template_id) || DEFAULT_PROMO_TEMPLATE_ID, safeId_(p.folder_id) || DEFAULT_PROMO_FOLDER_ID);
    else if (action === 'generate_promo') data = generatePromoImage_(safeId_(p.template_id) || DEFAULT_PROMO_TEMPLATE_ID, safeId_(p.folder_id) || DEFAULT_PROMO_FOLDER_ID, p);
    else if (action === 'delete_certificate') data = deleteCertificate_(folderId, p);
    else throw new Error('action ไม่ถูกต้อง');
    return callbackHtml_(targetOrigin, requestId, true, data, '');
  } catch (err) {
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
      image_url: image ? ('https://drive.google.com/uc?export=view&id=' + image.getId()) : '',
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
  const sourcePhotoUrl = normalizePublicImageUrl_(String(p.photo_url || '').trim()) || normalizePublicImageUrl_(String(p.fallback_photo_url || '').trim()) || DEFAULT_PROMO_FALLBACK_PHOTO_URL;
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
    const photoBlob = fetchRemoteImageBlob_(sourcePhotoUrl);
    const n3 = replaceImagePlaceholders_(pres, TAGS.photo, photoBlob);
    const slideId = pres.getSlides()[0].getObjectId();
    pres.saveAndClose();
    if (n1 < 1 || n2 < 1 || n3 < 1) throw new Error('Replace ข้อมูลภาพประชาสัมพันธ์ไม่ครบ กรุณาตรวจ Template');

    Utilities.sleep(700);
    const pngBlob = fetchSlideThumbnailBlob_(workingCopy.getId(), slideId).setName(imageName);
    const image = folder.createFile(pngBlob);
    let publicSharing = true;
    try { image.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (shareErr) { publicSharing = false; }

    return {
      image_file_id: image.getId(),
      image_url: 'https://drive.google.com/uc?export=view&id=' + image.getId(),
      image_download_url: 'https://drive.google.com/uc?export=download&id=' + image.getId(),
      image_file_name: image.getName(),
      public_sharing: publicSharing,
      source_photo_url: sourcePhotoUrl,
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
  const endpoint = 'https://slides.googleapis.com/v1/presentations/' + encodeURIComponent(presentationId) + '/pages/' + encodeURIComponent(slideObjectId) + '/thumbnail?thumbnailProperties.mimeType=PNG&thumbnailProperties.thumbnailSize=LARGE';
  const res = UrlFetchApp.fetch(endpoint, {
    method: 'get',
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  });
  if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) {
    throw new Error('ดึงภาพจาก Google Slides ไม่สำเร็จ: HTTP ' + res.getResponseCode());
  }
  const payload = JSON.parse(res.getContentText() || '{}');
  if (!payload.contentUrl) throw new Error('Google Slides ไม่ได้ส่ง contentUrl ของภาพกลับมา');
  const imgRes = UrlFetchApp.fetch(payload.contentUrl, { muteHttpExceptions: true, followRedirects: true });
  if (imgRes.getResponseCode() < 200 || imgRes.getResponseCode() >= 300) {
    throw new Error('ดาวน์โหลดภาพใบอนุโมทนาบัตรไม่สำเร็จ: HTTP ' + imgRes.getResponseCode());
  }
  return imgRes.getBlob().setName('certificate-image.png');
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

function normalizePublicImageUrl_(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const driveMatch = value.match(/\/file\/d\/([A-Za-z0-9_-]+)/) || value.match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) return 'https://drive.google.com/uc?export=download&id=' + driveMatch[1];
  return value;
}

function fetchRemoteImageBlob_(url) {
  const target = normalizePublicImageUrl_(url);
  if (!/^https?:\/\//i.test(target)) throw new Error('ลิงก์รูปภาพไม่ถูกต้อง');
  const res = UrlFetchApp.fetch(target, { muteHttpExceptions:true, followRedirects:true, headers:{'User-Agent':'Mozilla/5.0'} });
  if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) throw new Error('ดาวน์โหลดรูปภาพไม่สำเร็จ: HTTP ' + res.getResponseCode());
  return res.getBlob().setName('donor-photo');
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
