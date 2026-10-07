(() => {
  const STORAGE_KEY = 'wnw-cookie-consent-v1';
  const COOKIE_NAME = 'wnw_cookie_consent';
  const currentScript = document.currentScript?.src || '';
  const privacyUrl = currentScript
    ? new URL('../privacy/', currentScript).href
    : '/privacy/';

  function readCookie(name) {
    const prefix = encodeURIComponent(name) + '=';
    return document.cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith(prefix))?.slice(prefix.length) || '';
  }
  function getConsent() {
    try {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local === 'all' || local === 'essential') return local;
    } catch (_) {}
    const cookie = decodeURIComponent(readCookie(COOKIE_NAME) || '');
    return (cookie === 'all' || cookie === 'essential') ? cookie : '';
  }
  function persist(mode) {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch (_) {}
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(mode)}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
  }
  function canUseThirdParty() { return getConsent() === 'all'; }

  function ensureStyles() {
    if (document.getElementById('wnw-cookie-style')) return;
    const style = document.createElement('style');
    style.id = 'wnw-cookie-style';
    style.textContent = `
      #wnw-cookie-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:10050;max-width:980px;margin:auto;background:rgba(15,23,42,.97);color:#e2e8f0;border:1px solid rgba(251,146,60,.28);border-radius:22px;box-shadow:0 24px 70px rgba(15,23,42,.35);padding:18px;font-family:"Noto Sans Thai",system-ui,sans-serif}
      #wnw-cookie-banner[hidden]{display:none!important}
      .wnw-cookie-grid{display:flex;gap:16px;align-items:flex-start}.wnw-cookie-icon{width:42px;height:42px;border-radius:14px;background:#f97316;color:white;display:flex;align-items:center;justify-content:center;font-size:21px;flex:0 0 auto}
      .wnw-cookie-content{flex:1;min-width:0}.wnw-cookie-title{font-size:15px;font-weight:800;color:#fff}.wnw-cookie-text{font-size:12px;line-height:1.7;color:#cbd5e1;margin-top:5px}.wnw-cookie-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}
      .wnw-cookie-btn{border:0;border-radius:12px;padding:9px 14px;font-weight:750;font-size:12px;cursor:pointer}.wnw-cookie-accept{background:#f97316;color:#fff}.wnw-cookie-essential{background:#334155;color:#fff}.wnw-cookie-link{background:transparent;color:#fdba74;border:1px solid #475569;text-decoration:none;display:inline-flex;align-items:center}
      @media(max-width:640px){#wnw-cookie-banner{left:10px;right:10px;bottom:10px;padding:15px}.wnw-cookie-grid{gap:10px}.wnw-cookie-icon{display:none}.wnw-cookie-actions .wnw-cookie-btn{flex:1 1 135px;text-align:center}}
    `;
    document.head.appendChild(style);
  }

  function ensureBanner() {
    ensureStyles();
    let banner = document.getElementById('wnw-cookie-banner');
    if (banner) return banner;
    banner = document.createElement('div');
    banner.id = 'wnw-cookie-banner';
    banner.setAttribute('role','dialog');
    banner.setAttribute('aria-label','การตั้งค่าคุกกี้และความเป็นส่วนตัว');
    banner.hidden = true;
    banner.innerHTML = `
      <div class="wnw-cookie-grid">
        <div class="wnw-cookie-icon" aria-hidden="true">🍪</div>
        <div class="wnw-cookie-content">
          <div class="wnw-cookie-title">คุกกี้และความเป็นส่วนตัว</div>
          <div class="wnw-cookie-text">เว็บไซต์ใช้ข้อมูลจัดเก็บที่จำเป็นเพื่อจดจำการตั้งค่าและการเข้าสู่ระบบ หากยอมรับทั้งหมด เว็บไซต์จึงจะโหลดเนื้อหาฝังจากผู้ให้บริการภายนอก เช่น Google Maps และ Facebook การเลือกของคุณจะถูกจดจำในอุปกรณ์นี้</div>
          <div class="wnw-cookie-actions">
            <button type="button" class="wnw-cookie-btn wnw-cookie-accept" data-wnw-consent="all">ยอมรับทั้งหมด</button>
            <button type="button" class="wnw-cookie-btn wnw-cookie-essential" data-wnw-consent="essential">เฉพาะที่จำเป็น</button>
            <a class="wnw-cookie-btn wnw-cookie-link" href="${privacyUrl}">อ่าน Privacy Policy</a>
          </div>
        </div>
      </div>`;
    document.body.appendChild(banner);
    banner.querySelectorAll('[data-wnw-consent]').forEach(btn => btn.addEventListener('click', () => {
      setConsent(btn.dataset.wnwConsent);
    }));
    return banner;
  }

  function setConsent(mode) {
    if (!['all','essential'].includes(mode)) return;
    persist(mode);
    const banner = ensureBanner();
    banner.hidden = true;
    window.dispatchEvent(new CustomEvent('wnw:consent-change', {detail:{mode}}));
  }
  function openSettings() {
    const banner = ensureBanner();
    banner.hidden = false;
  }
  function init() {
    const banner = ensureBanner();
    if (!getConsent()) banner.hidden = false;
    window.dispatchEvent(new CustomEvent('wnw:consent-ready', {detail:{mode:getConsent()}}));
  }

  window.WNWPrivacy = {getConsent, setConsent, canUseThirdParty, openSettings, privacyUrl};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();