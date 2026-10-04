/**
 * WNW Donation Certificate Generator — Google Apps Script
 * Deploy as Web App: Execute as Me / Who has access: Anyone
 * Every POST is verified against Supabase Auth before Drive/Slides access.
 */
const SUPABASE_URL = 'https://pcapjltgscofrgfcvdkm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NTJJiE0r1hojS-8DTRzWFA_3BPADfEH';
const DEFAULT_TEMPLATE_ID = '1N0OEEhnCdfqn5ohtZa47pUfenVYizdePtXo9vGsVGy4';
const DEFAULT_FOLDER_ID = '1JUTSXLLdR7X5KiV6KINe6Nk85DS-YdYk';
const TAGS = { donor_name: '{{donor_name}}', donation_amount: '{{donation_amount}}', certificate_no: '{{certificate_no}}' };

function doGet() {
  return HtmlService.createHtmlOutput('<h3>WNW Donation Certificate Generator</h3><p>Web App พร้อมทำงาน</p>')
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
    certificate_no: countText_(allText, TAGS.certificate_no)
  };
  return { template_name: file.getName(), tags: tags, ready: tags.donor_name > 0 && tags.donation_amount > 0 && tags.certificate_no > 0 };
}

function generateCertificate_(templateId, folderId, p) {
  const donorName = String(p.donor_name || '').trim();
  const amount = String(p.donation_amount || '').trim();
  const certificateNo = String(p.certificate_no || '').trim().toUpperCase();
  if (!donorName) throw new Error('ชื่อผู้บริจาคว่าง');
  if (!amount) throw new Error('จำนวนเงินว่าง');
  if (!/^[A-Z0-9-]{6,80}$/.test(certificateNo)) throw new Error('เลขใบอนุโมทนาบัตรไม่ถูกต้อง');

  const check = validateTemplate_(templateId, folderId);
  if (!check.ready) throw new Error('Google Slides Template มี Tag ไม่ครบ 3 รายการ');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let workingCopy = null;
  try {
    const folder = DriveApp.getFolderById(folderId);
    const pdfName = certificateNo + '.pdf';
    const oldFiles = folder.getFilesByName(pdfName);
    while (oldFiles.hasNext()) oldFiles.next().setTrashed(true);

    workingCopy = DriveApp.getFileById(templateId).makeCopy('_working_' + certificateNo + '_' + Date.now(), folder);
    const pres = SlidesApp.openById(workingCopy.getId());
    const n1 = pres.replaceAllText(TAGS.donor_name, donorName);
    const n2 = pres.replaceAllText(TAGS.donation_amount, amount);
    const n3 = pres.replaceAllText(TAGS.certificate_no, certificateNo);
    pres.saveAndClose();
    if (n1 < 1 || n2 < 1 || n3 < 1) throw new Error('Replace Tag ไม่ครบ กรุณาตรวจ Template');

    Utilities.sleep(700);
    const blob = workingCopy.getAs(MimeType.PDF).setName(pdfName);
    const pdf = folder.createFile(blob);
    let publicSharing = true;
    try { pdf.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (shareErr) { publicSharing = false; }

    return {
      file_id: pdf.getId(),
      pdf_url: 'https://drive.google.com/file/d/' + pdf.getId() + '/view',
      download_url: 'https://drive.google.com/uc?export=download&id=' + pdf.getId(),
      file_name: pdf.getName(),
      public_sharing: publicSharing,
      replaced: { donor_name:n1, donation_amount:n2, certificate_no:n3 }
    };
  } finally {
    try { if (workingCopy) workingCopy.setTrashed(true); } catch (_) {}
    lock.releaseLock();
  }
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
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
