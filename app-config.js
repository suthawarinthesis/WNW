/* ============================================================
   Supabase configuration for GitHub Pages
   1) Create a Supabase project
   2) Run supabase/setup.sql
   3) Paste Project URL + anon/publishable key below
   IMPORTANT: Never place the service_role key in GitHub Pages.
   ============================================================ */
window.SCHOOL_APP_CONFIG = {
  SUPABASE_URL: 'https://pcapjltgscofrgfcvdkm.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_NTJJiE0r1hojS-8DTRzWFA_3BPADfEH',
  STORAGE_BUCKET: 'site-media',
  ADMISSION_STORAGE_BUCKET: 'admission-files',
  STUDENT_PORTAL_STORAGE_BUCKET: 'student-portal-files'
};

(() => {
  const cfg = window.SCHOOL_APP_CONFIG;
  const configured = cfg &&
    /^https:\/\/.+\.supabase\.co$/i.test(cfg.SUPABASE_URL || '') &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes('YOUR_');

  if (!configured || !window.supabase?.createClient) {
    window.SCHOOL_SUPABASE = null;
    return;
  }

  window.SCHOOL_SUPABASE = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
})();


/* ============================================================
   Dynamic school favicon
   - Uses branding.logoUrl from public.site_settings (id = 1)
   - Cached locally so the icon appears quickly on the next visit
   - Shared by the main site and every subweb that loads app-config.js
   ============================================================ */
(() => {
  const CACHE_KEY = 'wnw-school-favicon-url';

  function applyFavicon(url) {
    if (!url || typeof url !== 'string') return;
    const cleanUrl = url.trim();
    if (!cleanUrl) return;

    const definitions = [
      { rel: 'icon', id: 'school-dynamic-favicon' },
      { rel: 'shortcut icon', id: 'school-dynamic-shortcut-icon' },
      { rel: 'apple-touch-icon', id: 'school-dynamic-apple-icon' }
    ];

    definitions.forEach(({ rel, id }) => {
      let link = document.getElementById(id);
      if (!link) {
        link = document.createElement('link');
        link.id = id;
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = cleanUrl;
    });

    try { localStorage.setItem(CACHE_KEY, cleanUrl); } catch (_) {}
  }

  window.SCHOOL_APPLY_FAVICON = applyFavicon;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) applyFavicon(cached);
  } catch (_) {}

  async function refreshSchoolFavicon() {
    const db = window.SCHOOL_SUPABASE;
    if (!db) return;
    try {
      const { data, error } = await db
        .from('site_settings')
        .select('data')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      const logo = data?.data?.branding?.logoUrl;
      if (logo) applyFavicon(logo);
    } catch (err) {
      console.warn('Unable to refresh school favicon:', err?.message || err);
    }
  }

  window.refreshSchoolFavicon = refreshSchoolFavicon;
  // Run without blocking page rendering.
  Promise.resolve().then(refreshSchoolFavicon);
})();
