(() => {
  const db = window.SCHOOL_SUPABASE;
  async function loadDefaults(){
    try {
      const current = [...document.scripts].find(s=>/\/assets\/app-config\.js/i.test(s.src));
      const url = current ? new URL('./default-data.json', current.src).href : '../assets/default-data.json';
      const r = await fetch(url); return await r.json();
    } catch (_) { return {}; }
  }
  function merge(base,incoming){
    if(Array.isArray(base))return Array.isArray(incoming)?incoming:base;
    if(base && typeof base==='object'){
      const out=JSON.parse(JSON.stringify(base));
      if(incoming && typeof incoming==='object')Object.keys(incoming).forEach(k=>out[k]=(k in base)?merge(base[k],incoming[k]):incoming[k]);
      return out;
    }
    return incoming===undefined?base:incoming;
  }
  async function load(){
    const fallback=await loadDefaults();
    if(!db)return fallback;
    try{
      const {data,error}=await db.from('site_settings').select('data').eq('id',1).maybeSingle();
      if(error)throw error;
      return data?.data?merge(fallback,data.data):fallback;
    }catch(_){return fallback}
  }
  window.WNWPageData={load};
})();