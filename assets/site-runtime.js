(() => {
  const db = window.SCHOOL_SUPABASE;
  const seen = new Set();
  const sessionStarted = Date.now();

  function clean(value, max=1000) {
    return String(value ?? '').replace(/\s+/g,' ').trim().slice(0,max);
  }
  function pageUrl() {
    return clean(location.href.split('#')[0], 1000);
  }
  function isManagerPath() {
    return /(^|\/)manager(\/|$)/i.test(location.pathname);
  }
  function isAlwaysAvailablePath() {
    return isManagerPath() || /\/privacy\/?$/i.test(location.pathname) || /\/emergency\/?$/i.test(location.pathname);
  }

  async function log(source, message, meta={}, level='error') {
    if (!db) return;
    const key = `${source}|${message}|${location.pathname}`.slice(0,800);
    if (seen.has(key)) return;
    seen.add(key);
    if (seen.size > 30) return;
    try {
      await db.rpc('log_site_error_v1', {
        p_source: clean(source,120),
        p_level: ['info','warning','error','critical'].includes(level) ? level : 'error',
        p_message: clean(message,1000),
        p_page_url: pageUrl(),
        p_user_agent: clean(navigator.userAgent,500),
        p_meta: {
          ...meta,
          online: navigator.onLine,
          session_age_seconds: Math.round((Date.now()-sessionStarted)/1000)
        }
      });
    } catch (_) {}
  }

  function describeTarget(target) {
    if (!target) return {};
    if (target instanceof HTMLImageElement) return {tag:'IMG',src:clean(target.currentSrc||target.src,1000),alt:clean(target.alt,200)};
    if (target instanceof HTMLScriptElement) return {tag:'SCRIPT',src:clean(target.src,1000)};
    if (target instanceof HTMLLinkElement) return {tag:'LINK',href:clean(target.href,1000),rel:clean(target.rel,100)};
    if (target instanceof HTMLIFrameElement) return {tag:'IFRAME',src:clean(target.src,1000)};
    return {tag:clean(target.tagName||'',40)};
  }

  window.addEventListener('error', ev => {
    if (ev.target && ev.target !== window) {
      const info = describeTarget(ev.target);
      log('resource_load', `โหลดทรัพยากรไม่สำเร็จ: ${info.tag||'resource'}`, info, 'warning');
      return;
    }
    log('javascript', ev.message || 'JavaScript error', {
      file:clean(ev.filename,1000), line:ev.lineno||0, column:ev.colno||0
    });
  }, true);

  window.addEventListener('unhandledrejection', ev => {
    const reason = ev.reason;
    log('unhandled_promise', reason?.message || reason || 'Unhandled promise rejection', {
      stack:clean(reason?.stack||'',1500)
    });
  });

  window.WNWErrorMonitor = { log };

  function maintenanceHtml(cfg={}) {
    const title = clean(cfg.title || 'เว็บไซต์กำลังปรับปรุง',200);
    const message = clean(cfg.message || 'ขออภัยในความไม่สะดวก กรุณากลับมาใหม่อีกครั้ง',500);
    return `
      <div id="wnw-maintenance-screen" style="position:fixed;inset:0;z-index:2147483000;background:linear-gradient(135deg,#fff7ed,#fff,#fffbeb);font-family:'Noto Sans Thai',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px;color:#0f172a">
        <div style="max-width:680px;width:100%;background:rgba(255,255,255,.92);border:1px solid #fed7aa;border-radius:32px;padding:34px;box-shadow:0 25px 80px rgba(249,115,22,.15);text-align:center">
          <div style="width:72px;height:72px;border-radius:24px;background:#ffedd5;color:#ea580c;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:34px">🛠️</div>
          <div style="font-size:11px;font-weight:800;letter-spacing:.16em;color:#f97316;text-transform:uppercase">Wat Nongwang Wittaya School</div>
          <h1 style="font-size:30px;line-height:1.25;margin:10px 0 10px;font-weight:900">${title}</h1>
          <p style="font-size:14px;line-height:1.9;color:#64748b;margin:0 auto;max-width:540px">${message}</p>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:24px">
            <a href="tel:043320171" style="text-decoration:none;padding:11px 16px;border-radius:14px;background:#f97316;color:white;font-weight:800;font-size:13px">โทรโรงเรียน 043-320-171</a>
            <a href="${emergencyRelativeUrl()}" style="text-decoration:none;padding:11px 16px;border-radius:14px;background:#0f172a;color:white;font-weight:800;font-size:13px">ข้อมูลฉุกเฉิน</a>
          </div>
          <p style="font-size:11px;color:#94a3b8;margin-top:20px">ผู้ดูแลระบบยังสามารถเข้าสู่ Website Manager ได้ตามปกติ</p>
        </div>
      </div>`;
  }

  function emergencyRelativeUrl() {
    try {
      const cfgScript = [...document.scripts].find(s=>/\/assets\/app-config\.js/i.test(s.src));
      return cfgScript ? new URL('../emergency/', cfgScript.src).href : '/emergency/';
    } catch (_) { return '/emergency/'; }
  }

  async function applyMaintenance() {
    if (!db || isAlwaysAvailablePath()) return;
    try {
      const {data,error} = await db.from('site_settings').select('data').eq('id',1).maybeSingle();
      if (error) throw error;
      const cfg = data?.data?.siteMaintenance || {};
      if (cfg.enabled === true && !document.getElementById('wnw-maintenance-screen')) {
        document.body.insertAdjacentHTML('beforeend', maintenanceHtml(cfg));
        document.documentElement.style.overflow='hidden';
        document.body.style.overflow='hidden';
      }
    } catch (err) {
      log('maintenance_check', err?.message || err, {}, 'warning');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyMaintenance, {once:true});
  } else {
    applyMaintenance();
  }
})();