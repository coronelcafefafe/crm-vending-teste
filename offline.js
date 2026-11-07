/* Mundicacau · funcionar sem rede
   - cópia local de todas as tabelas no telemóvel (IndexedDB)
   - fila de envio: o que se faz sem rede fica guardado e é enviado quando a rede volta
   - fotos e assinaturas tiradas sem rede ficam no telemóvel até subirem
   - a app abre sem rede com a última sessão conhecida */
(function () {
  const DBN = 'oficina-offline', VER = 1;
  let idb = null;
  const abre = () => idb || (idb = new Promise((ok, ko) => {
    const r = indexedDB.open(DBN, VER);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('tabelas')) d.createObjectStore('tabelas'); if (!d.objectStoreNames.contains('fila')) d.createObjectStore('fila', { keyPath: 'n', autoIncrement: true }); if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta'); };
    r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
  }));
  const tx = async (store, modo, fn) => { const d = await abre(); return new Promise((ok, ko) => { const t = d.transaction(store, modo), s = t.objectStore(store); let res; Promise.resolve(fn(s)).then(v => res = v); t.oncomplete = () => ok(res); t.onerror = () => ko(t.error); }); };
  const req = r => new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });

  const OFF = window.OFF = {
    fila: 0, aEnviar: false, erros: [], blobs: new Map(),
    online: () => navigator.onLine !== false,
    blob: p => OFF.blobs.get(p) || '',
    async guardaTabela(col, rows) { try { await tx('tabelas', 'readwrite', s => s.put(rows, col)); } catch (e) { console.warn('offline: guardar', col, e); } },
    async lerTabela(col) { try { return await tx('tabelas', 'readonly', s => req(s.get(col))); } catch (_) { return null; } },
    async meta(k, v) { if (v === undefined) return tx('meta', 'readonly', s => req(s.get(k))).catch(() => null); return tx('meta', 'readwrite', s => s.put(v, k)).catch(() => null); },
    async contaFila() { try { OFF.fila = await tx('fila', 'readonly', s => req(s.count())); } catch (_) { OFF.fila = 0; } mostra(); return OFF.fila; },
    async poeFila(op) { await tx('fila', 'readwrite', s => s.add({ ...op, em: Date.now() })); await OFF.contaFila(); },
  };
  const ehRede = e => !e || e instanceof TypeError || /fetch|network|load failed|Failed to fetch|NetworkError|timeout/i.test(String(e?.message || e)) || e?.status === 0;

  /* ----- indicador ----- */
  let pill = null;
  function mostra() {
    if (!pill) { pill = document.createElement('div'); pill.id = 'offpill'; pill.setAttribute('role', 'status'); pill.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top) + 62px);max-width:92vw;white-space:nowrap;z-index:9999;padding:6px 14px;border-radius:999px;font:600 12.5px/1.2 "Hanken Grotesk",system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.18);display:none;cursor:pointer'; pill.onclick = () => OFF.envia(true); document.body.appendChild(pill); }
    const sem = !OFF.online();
    if (!sem && !OFF.fila && !OFF.aEnviar) { pill.style.display = 'none'; return; }
    pill.style.display = 'block';
    pill.style.background = sem ? '#B45309' : '#2F4F94'; pill.style.color = '#fff';
    pill.textContent = sem ? `Sem rede · ${OFF.fila ? OFF.fila + ' por enviar' : 'a trabalhar no telemóvel'}` : OFF.aEnviar ? `A enviar ${OFF.fila}…` : `${OFF.fila} por enviar · tocar para enviar`;
  }
  let canal = null;
  OFF.liga = () => { if (canal || !OFF.online() || !S.db || !S.uid) return; canal = S.db.channel('crm').on('postgres_changes', { event: '*', schema: 'public' }, p => { const col = p.table; if (col === 'membros') { loadTeam(); return; } if (!S.data[col]) return; if (p.eventType === 'DELETE') { if (p.old?.id) S.data[col].delete(p.old.id); } else { const o = fromRow(p.new); S.data[col].set(o.id, o); } schedule(); }).subscribe(); };
  window.addEventListener('online', async () => { mostra(); await OFF.envia(); if (!OFF.fila) OFF.recarrega(); OFF.liga(); });
  window.addEventListener('offline', mostra);

  /* ----- envio da fila ----- */
  OFF.envia = async function (forcar) {
    if (OFF.aEnviar || !OFF.online() || !S.db || !S.uid) return; const n = await OFF.contaFila(); if (!n) return;
    OFF.aEnviar = true; mostra(); let parouRede = false, enviados = 0;
    try {
      const d = await abre();
      const ops = await new Promise((ok, ko) => { const r = d.transaction('fila', 'readonly').objectStore('fila').getAll(); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
      for (const op of ops) {
        let res;
        try {
          if (op.t === 'ins') res = await S.db.from(op.col).upsert(op.row, { onConflict: 'id' }).select().single();
          else if (op.t === 'upd') res = await S.db.from(op.col).update(op.row).eq('id', op.id).select().maybeSingle();
          else if (op.t === 'del') res = await S.db.from(op.col).delete().eq('id', op.id);
          else if (op.t === 'up') res = await S.db.storage.from(op.bucket).upload(op.path, op.blob, { ...(op.opts || {}), upsert: true });
        } catch (e) { if (ehRede(e)) { parouRede = true; break; } res = { error: e }; }
        if (res?.error) {
          if (ehRede(res.error)) { parouRede = true; break; }
          console.warn('offline: operação recusada', op, res.error); OFF.erros.push({ op, erro: res.error.message || String(res.error) });
        } else if (res?.data && op.t !== 'up' && op.t !== 'del') { const o = fromRow(res.data); S.data[op.col]?.set(o.id, o); }
        if (op.t === 'up' && !res?.error) { const u = OFF.blobs.get(op.path); if (u) { setTimeout(() => { URL.revokeObjectURL(u); OFF.blobs.delete(op.path); }, 60000); } }
        await tx('fila', 'readwrite', s => s.delete(op.n)); enviados++;
      }
    } finally { OFF.aEnviar = false; await OFF.contaFila(); schedule(); }
    if (enviados && !parouRede) { toast(enviados === 1 ? 'Alteração enviada' : enviados + ' alterações enviadas'); OFF.recarrega(); }
    if (OFF.erros.length) { toast(OFF.erros.length + ' alterações foram recusadas pelo servidor'); OFF.erros = []; }
  };
  setInterval(() => OFF.envia(), 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) OFF.envia(); });

  /* ----- escrita: tenta a rede, se falhar guarda no telemóvel ----- */
  const agora = () => new Date().toISOString();
  async function emFila(op, col, id, row) {
    if (op === 'ins') {
      id = row.id || (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
      const full = { ...row, id, criado: agora(), atualizado: agora(), criado_por: S.uid, por: S.uid, _local: true };
      await OFF.poeFila({ t: 'ins', col, row: { ...row, id } }); S.data[col].set(id, fromRow(full)); schedule(); return id;
    }
    if (op === 'upd') { const cur = S.data[col].get(id) || { id }; S.data[col].set(id, { ...cur, ...fromRow(row), atualizado: agora() }); await OFF.poeFila({ t: 'upd', col, id, row }); schedule(); return id; }
    if (op === 'del') { S.data[col].delete(id); await OFF.poeFila({ t: 'del', col, id }); schedule(); return id; }
  }
  OFF.save = async (col, id, row) => {
    if (!OFF.online() || OFF.fila) return emFila(id ? 'upd' : 'ins', col, id, row);
    try {
      const q = id ? S.db.from(col).update(row).eq('id', id) : S.db.from(col).insert(row);
      const { data, error } = await q.select().single();
      if (error) { if (ehRede(error)) return emFila(id ? 'upd' : 'ins', col, id, row); dbErr(error); return null; }
      putLocal(col, data); return data.id;
    } catch (e) { if (ehRede(e)) return emFila(id ? 'upd' : 'ins', col, id, row); dbErr(e); return null; }
  };
  OFF.patch = async (col, id, row) => { const r = await OFF.save(col, id, row); return !!r; };
  OFF.remove = async (col, id) => {
    if (!OFF.online() || OFF.fila) { await emFila('del', col, id); return true; }
    try { const { error } = await S.db.from(col).delete().eq('id', id); if (error) { if (ehRede(error)) { await emFila('del', col, id); return true; } dbErr(error); return false; } S.data[col].delete(id); schedule(); return true; }
    catch (e) { if (ehRede(e)) { await emFila('del', col, id); return true; } dbErr(e); return false; }
  };

  /* ----- ficheiros (fotos, assinaturas, croquis) ----- */
  function embrulhaStorage() {
    const st = S.db.storage, from0 = st.from.bind(st);
    st.from = bucket => {
      const api = from0(bucket), up0 = api.upload.bind(api);
      api.upload = async (path, file, opts) => {
        const fila = async () => { OFF.blobs.set(path, URL.createObjectURL(file)); await OFF.poeFila({ t: 'up', bucket, path, blob: file, opts: { contentType: opts?.contentType } }); return { data: { path }, error: null }; };
        if (!OFF.online()) return fila();
        try { const r = await up0(path, file, opts); if (r.error && ehRede(r.error)) return fila(); return r; } catch (e) { if (ehRede(e)) return fila(); return { data: null, error: e }; }
      };
      return api;
    };
  }

  /* ----- leitura: rede ou cópia local ----- */
  let gravaT = null;
  OFF.gravaTudo = () => { clearTimeout(gravaT); gravaT = setTimeout(() => { COLS.forEach(c => { if (S.ready[c] && S.data[c]) OFF.guardaTabela(c, [...S.data[c].values()]); }); }, 2500); };
  OFF.recarrega = async () => { if (!OFF.online() || OFF.fila) return; await Promise.all(COLS.map(c => loadTable(c).catch(() => { }))); };

  window.OFF_INIT = function () {
    // loadTable: rede primeiro, cópia local se falhar
    const lt0 = loadTable;
    loadTable = async col => {
      try { if (!OFF.online()) throw new TypeError('offline'); await lt0(col); OFF.guardaTabela(col, [...S.data[col].values()]); }
      catch (e) { const rows = await OFF.lerTabela(col); if (rows) { S.data[col] = new Map(rows.map(o => [o.id, o])); S.ready[col] = true; schedule(); } else throw e; }
    };
    const sch0 = schedule; schedule = (...a) => { const r = sch0(...a); if (S.uid) OFF.gravaTudo(); return r; };
    const lteam0 = loadTeam;
    loadTeam = async () => { try { if (!OFF.online()) throw 0; await lteam0(); OFF.meta('equipa', [...S.data.equipa.values()]); } catch (_) { const L = await OFF.meta('equipa'); if (L) { S.data.equipa = new Map(L.map(o => [o.id, o])); schedule(); } } };

    // arranque: com rede como antes; sem rede com a última sessão guardada
    boot = async function () {
      render();
      if (!CFG.url || !CFG.anonKey || !window.supabase) { S.offline = true; S.offMsg = 'Sem ligação e sem cópia da app. Abra-a uma vez com rede.'; render(); return; }
      S.db = window.supabase.createClient(CFG.url, CFG.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      embrulhaStorage();
      S.db.auth.onAuthStateChange((ev, session) => { if (ev === 'SIGNED_IN' && session) setTimeout(() => start(session), 0); });
      let session = null; try { session = (await S.db.auth.getSession()).data.session; } catch (_) { }
      if (!session) { const eu = await OFF.meta('eu'); if (eu && !OFF.online()) return start({ user: { id: eu.uid, email: eu.email }, _offline: true }); S.view = 'login'; render(); return; }
      start(session);
    };
    start = async function (session) {
      if (started || !session) return; started = true;
      let m = null;
      if (OFF.online() && !session._offline) { try { const r = await S.db.rpc('ligar_membro'); if (r.error && !ehRede(r.error)) { started = false; S.view = 'semacesso'; S.loginEmail = session.user.email; render(); return; } m = r.data; } catch (_) { } }
      const eu = await OFF.meta('eu');
      if (m && m.email) OFF.meta('eu', { uid: session.user.id, email: m.email, nome: m.nome, papel: m.papel, acesso_total: m.acesso_total });
      else if (eu && eu.uid === session.user.id) m = { email: eu.email, nome: eu.nome, papel: eu.papel, acesso_total: eu.acesso_total };
      if (!m || !m.email) { started = false; S.view = 'semacesso'; S.loginEmail = session.user.email; render(); return; }
      S.uid = session.user.id; S.canWrite = m.papel !== 'leitura'; S.isAdmin = m.papel === 'admin'; S.verValores = m.papel === 'admin' || !!m.acesso_total;
      S.me = { name: m.nome || session.user.email, email: m.email, avatarUrl: avatarFor(m.nome || session.user.email) };
      S.view = 'inicio'; S.hist = []; render();
      await loadTeam();
      await Promise.all(COLS.map(c => loadTable(c).catch(e => { console.warn(c, e); S.ready[c] = true; })));
      OFF.liga();
      S.sample = null; S.assets = S.canWrite ? { upload: uploadFoto } : null;
      await OFF.contaFila(); OFF.envia(); schedule();
      // guardar já as bibliotecas usadas nas etiquetas e nos croquis, para funcionarem sem rede
      if (OFF.online()) setTimeout(() => ['https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js', 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs', 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs'].forEach(u => fetch(u, { mode: 'cors' }).catch(() => { })), 4000);
      if (navigator.storage?.persist) navigator.storage.persist().catch(() => { });
    };
  };
})();
