/* ============================================================
   Supabase configuration for GitHub Pages
   1) Create a Supabase project
   2) Run supabase/setup.sql
   3) Paste Project URL + anon/publishable key below
   IMPORTANT: Never place the service_role key in GitHub Pages.
   ============================================================ */
window.SCHOOL_APP_CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY',
  STORAGE_BUCKET: 'site-media'
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
