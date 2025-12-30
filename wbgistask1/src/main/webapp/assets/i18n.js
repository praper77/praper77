// Lightweight i18n loader: reads lang from localStorage or ?lang=, loads JSON, applies data-i18n keys
(function(){
  const DEFAULT_LANG = 'zh';
  function getLangFromQuery(){
    const m = new URL(location.href).searchParams.get('lang');
    return m && (m === 'zh' || m === 'en') ? m : null;
  }
  function getLang(){
    return getLangFromQuery() || localStorage.getItem('lang') || DEFAULT_LANG;
  }
  function setLang(lang){
    localStorage.setItem('lang', lang);
  }
  async function loadBundle(lang){
    const res = await fetch(`assets/i18n/${lang}.json`);
    return await res.json();
  }
  function t(obj, path, vars){
    const segs = path.split('.');
    let cur = obj;
    for (const s of segs) { if (!cur) break; cur = cur[s]; }
    if (typeof cur !== 'string') return path;
    if (vars && typeof vars === 'object') {
      Object.entries(vars).forEach(([k,v])=>{
        cur = cur.replace(`{${k}}`, String(v));
      });
    }
    return cur;
  }
  function applyI18n(bundle){
    // Replace elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el=>{
      const key = el.getAttribute('data-i18n');
      const varsRaw = el.getAttribute('data-i18n-vars');
      let vars = null;
      if (varsRaw) {
        try { vars = JSON.parse(varsRaw); } catch {}
      }
      const text = t(bundle, key, vars);
      el.textContent = text;
    });
    // Replace placeholders
    document.querySelectorAll('[data-i18n-ph]').forEach(el=>{
      const key = el.getAttribute('data-i18n-ph');
      el.setAttribute('placeholder', t(bundle, key));
    });
    // Replace aria-labels
    document.querySelectorAll('[data-i18n-aria]').forEach(el=>{
      const key = el.getAttribute('data-i18n-aria');
      el.setAttribute('aria-label', t(bundle, key));
    });
  }

  // Expose small API
  window.i18n = {
    getLang, setLang, loadBundle, applyI18n
  };

  // Initial run
  (async function init(){
    const lang = getLang();
    try {
      const bundle = await loadBundle(lang);
      applyI18n(bundle);
      // mark current lang button
      document.querySelectorAll('[data-lang]').forEach(btn=>{
        btn.classList.toggle('primary', btn.dataset.lang === lang);
      });
      // Update dynamic labels showing status options
      const statusSel = document.getElementById('statusSel');
      if (statusSel) {
        // Keep values the same; only replace display texts
        statusSel.querySelector('option[value=""]').textContent = t(bundle, 'map.filtersStatusAll');
        statusSel.querySelector('option[value="available"]').textContent = t(bundle, 'map.filtersStatusAvailable');
        statusSel.querySelector('option[value="maintenance"]').textContent = t(bundle, 'map.filtersStatusMaintenance');
      }
    } catch (e) {
      console.warn('i18n load failed', e);
    }
  })();

  // Language switch handler
  document.addEventListener('click', async (e)=>{
    const btn = e.target.closest('[data-lang]');
    if (!btn) return;
    const lang = btn.dataset.lang;
    setLang(lang);
    try {
      const bundle = await loadBundle(lang);
      applyI18n(bundle);
      document.querySelectorAll('[data-lang]').forEach(b=>{
        b.classList.toggle('primary', b.dataset.lang === lang);
      });
    } catch (err) {
      console.warn('i18n switch failed', err);
    }
  });
})();