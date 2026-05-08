// JM Transportes Financeiro — Cloud bridge
// Exposes window.JMCloud for the React app.
// Loads Supabase JS dynamically; works offline / without keys (local-only mode).

(function () {
  const CFG_KEYS = {
    url: 'jm:cfg:supabaseUrl',
    key: 'jm:cfg:supabaseKey',
    checkout: 'jm:cfg:checkoutUrl',
  };

  const TABLES = {
    'jm:lancamentos': 'lancamentos',
    'jm:boletos': 'boletos',
    'jm:notas': 'notas',
    'jm:dividas': 'dividas',
  };

  const COL_MAP = {
    notas: { numNota: 'num_nota' },
    dividas: {
      valorOriginal: 'valor_original',
      parcelaTotal: 'parcela_total',
      parcelaPaga: 'parcela_paga',
      valorParcela: 'valor_parcela',
      proxVenc: 'prox_venc',
    },
  };
  const inv = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]));

  function toDb(table, item) {
    const map = COL_MAP[table] || {};
    const out = {};
    for (const [k, v] of Object.entries(item)) out[map[k] || k] = v;
    return out;
  }
  function fromDb(table, row) {
    const inverse = inv(COL_MAP[table] || {});
    const out = {};
    for (const [k, v] of Object.entries(row)) out[inverse[k] || k] = v;
    return out;
  }

  const listeners = {};
  function on(evt, cb) { (listeners[evt] = listeners[evt] || []).push(cb); }
  function off(evt, cb) {
    const arr = listeners[evt]; if (!arr) return;
    const i = arr.indexOf(cb); if (i >= 0) arr.splice(i, 1);
  }
  function emit(evt, payload) { (listeners[evt] || []).forEach((cb) => { try { cb(payload); } catch (_) {} }); }

  let supabase = null;
  let user = null;
  let plan = 'free';
  let pushTimers = {};

  function getConfig() {
    return {
      url: localStorage.getItem(CFG_KEYS.url) || '',
      key: localStorage.getItem(CFG_KEYS.key) || '',
      checkout: localStorage.getItem(CFG_KEYS.checkout) || '',
    };
  }
  function setConfig(c) {
    if ('url' in c) localStorage.setItem(CFG_KEYS.url, c.url || '');
    if ('key' in c) localStorage.setItem(CFG_KEYS.key, c.key || '');
    if ('checkout' in c) localStorage.setItem(CFG_KEYS.checkout, c.checkout || '');
    emit('change');
  }
  function isConfigured() {
    const c = getConfig();
    return !!(c.url && c.key);
  }

  async function init() {
    const c = getConfig();
    if (!c.url || !c.key) { supabase = null; user = null; plan = 'free'; emit('change'); return; }
    try {
      const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      supabase = mod.createClient(c.url, c.key, { auth: { persistSession: true, autoRefreshToken: true } });
      const { data } = await supabase.auth.getSession();
      user = data?.session?.user || null;
      supabase.auth.onAuthStateChange(async (_evt, session) => {
        user = session?.user || null;
        await refreshPlan();
        emit('change');
        if (user) await pullAll();
      });
      await refreshPlan();
      emit('change');
      if (user) await pullAll();
    } catch (err) {
      console.error('Supabase init failed', err);
      supabase = null;
      emit('change');
    }
  }

  async function refreshPlan() {
    if (!supabase || !user) { plan = 'free'; return; }
    try {
      const { data } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
      plan = data?.plan === 'pro' ? 'pro' : 'free';
    } catch (_) { plan = 'free'; }
  }

  async function signUp(email, password) {
    if (!supabase) throw new Error('Supabase não configurado');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }
  async function signIn(email, password) {
    if (!supabase) throw new Error('Supabase não configurado');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }
  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  function getUser() { return user; }
  function getPlan() { return plan; }
  function isPro() { return plan === 'pro'; }

  async function pullAll() {
    if (!supabase || !user) return;
    for (const [lsKey, table] of Object.entries(TABLES)) {
      try {
        const { data, error } = await supabase.from(table).select('*').eq('user_id', user.id);
        if (error) throw error;
        const items = (data || []).map((r) => {
          const { user_id, ...rest } = r;
          return fromDb(table, rest);
        });
        try { localStorage.setItem(lsKey, JSON.stringify(items)); } catch (_) {}
        emit('pull', { key: lsKey, data: items });
      } catch (err) { console.warn('pull failed', table, err); }
    }
  }

  function push(lsKey, items) {
    if (!supabase || !user) return;
    const table = TABLES[lsKey]; if (!table) return;
    clearTimeout(pushTimers[lsKey]);
    pushTimers[lsKey] = setTimeout(async () => {
      try {
        const rows = (items || []).map((it) => ({ ...toDb(table, it), user_id: user.id, updated_at: new Date().toISOString() }));
        const { data: existing } = await supabase.from(table).select('id').eq('user_id', user.id);
        const have = new Set((existing || []).map((r) => r.id));
        const localIds = new Set(rows.map((r) => r.id));
        const toDelete = [...have].filter((id) => !localIds.has(id));
        if (rows.length) await supabase.from(table).upsert(rows, { onConflict: 'id' });
        if (toDelete.length) await supabase.from(table).delete().in('id', toDelete);
      } catch (err) { console.warn('push failed', table, err); }
    }, 800);
  }

  function openCheckout() {
    const url = getConfig().checkout;
    if (!url) { alert('Link de checkout não configurado. Vá em Conta → Configurações.'); return; }
    if (!user) { alert('Faça login antes de assinar.'); return; }
    const sep = url.includes('?') ? '&' : '?';
    const finalUrl = `${url}${sep}client_reference_id=${encodeURIComponent(user.id)}&external_reference=${encodeURIComponent(user.id)}`;
    window.open(finalUrl, '_blank', 'noopener,noreferrer');
  }

  window.JMCloud = {
    on, off,
    init, getConfig, setConfig, isConfigured,
    signUp, signIn, signOut,
    getUser, getPlan, isPro,
    push, pullAll,
    openCheckout,
  };
})();
