/* Mundicacau · Oficina e assistências
   Fichas de entrada (oficina), assistências no cliente e manutenções: fotos, etiqueta QR com o proprietário,
   estados, cronómetro, deslocação com GPS ("Estou aqui"), peças filtradas pelo modelo e grupo da máquina,
   orçamento opcional, avisos ao cliente (email e WhatsApp), agrupamento de trabalhos iguais,
   rota do dia (do mais longe para o mais perto) e exportação para faturar. */
window.OFI_INIT = function () {
  const NOVAS = ['manuais', 'croquis', 'locais', 'fichas', 'fichas_tempos', 'modelos', 'desl_tabelas', 'oficina_config'];
  NOVAS.forEach(c => { if (!COLS.includes(c)) COLS.push(c); S.data[c] = new Map(); });

  const EST = { recebido: 'Recebido', diagnostico: 'Em diagnóstico', orcamento: 'Orçamento enviado', aguarda_peca: 'À espera de peça', reparacao: 'Em reparação', pronto: 'Pronto', entregue: 'Entregue', cancelado: 'Cancelado' };
  const EST_T = { recebido: 'info', diagnostico: 'warn', orcamento: 'gold', aguarda_peca: 'bad', reparacao: 'warn', pronto: 'ok', entregue: 'mute', cancelado: 'mute' };
  const TIPO = { oficina: 'Oficina (entrou cá)', guarda: 'Guarda (só armazenamento)', local: 'Assistência no cliente', manutencao: 'Manutenção', reparacao: 'Reparação no cliente' };
  const TIPO_C = { oficina: 'Oficina', guarda: 'Guarda', local: 'No cliente', manutencao: 'Manutenção', reparacao: 'Reparação' };
  const EQUIP = ['Máquina completa', 'Caldeira', 'Grupo café', 'Moinho doseador', 'Módulo copos', 'Placa eletrónica', 'Moedeiro / sistema de pagamento', 'Bomba', 'Misturador', 'Distribuidor de copos'];
  const ABERTOS = ['recebido', 'diagnostico', 'orcamento', 'aguarda_peca', 'reparacao'];
  const fora = f => ['local', 'manutencao', 'reparacao'].includes(f.tipo);
  const naCasa = f => ['oficina', 'guarda'].includes(f.tipo) && !['entregue', 'cancelado'].includes(f.estado);
  const ESPERA = ['recebido', 'aguarda_peca', 'orcamento'], CURSO = ['diagnostico', 'reparacao'];
  const estL = f => f.tipo === 'guarda' && f.estado === 'recebido' ? 'Guardado' : EST[f.estado] || f.estado;
  const cfg = () => S.data.oficina_config.get(1) || { empresa: 'Mundicacau', precoHora: 30, precoKm: 0.4, idaVolta: true, baseLat: 41.19025117241961, baseLng: -8.450665245494452 };
  const prop = f => f.proprietario || entName(f.entidade);
  const loc = f => f.local ? S.data.locais.get(f.local) : null;
  const ondeXY = f => { const l = loc(f); if (l && l.lat && l.lng) return { lat: l.lat, lng: l.lng }; const e = ent(f.entidade); return e && e.lat && e.lng ? { lat: e.lat, lng: e.lng } : null; };
  const ondeTxt = f => { const l = loc(f); return l ? [l.nome, [l.morada, l.cp, l.localidade].filter(Boolean).join(', ')].filter(Boolean).join(' · ') : ''; };
  const cod = f => f.codigo || ('MC-' + String(f.numero || '').padStart(4, '0'));
  const nomeEq = f => [f.equipamento, f.modelo ? ((f.marca ? f.marca + ' ' : '') + f.modelo) : ''].filter(Boolean).join(' · ');
  const fmtMin = m => { m = Math.round(m || 0); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + pad(m % 60) + ' min'; };
  const fmtKm = k => (+k || 0).toLocaleString('pt-PT', { maximumFractionDigits: 1 });
  const dias = f => Math.max(0, diffDays(TODAY(), (f.entrada || TODAY()).slice(0, 10)));
  const urlF = id => location.origin + location.pathname + '#f=' + id;
  const fotoF = p => /^https?:/.test(p) ? p : S.db.storage.from('fichas').getPublicUrl(p).data.publicUrl;

  /* ---------- catálogo: modelos, grupos e peças ---------- */
  const splitM = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
  const modelosL = () => { const s = new Set(D('modelos').map(m => m.nome)); D('artigos').forEach(a => splitM(a.modelos).forEach(x => s.add(x))); D('fichas').forEach(f => f.modelo && s.add(f.modelo)); return [...s].sort((a, b) => a.localeCompare(b, 'pt')); };
  const isPeca = a => (a.peca || a.familia === 'Peças') && a.ativo !== false && !a.oculto;
  const servePara = (a, mod) => !mod || splitM(a.modelos).some(x => norm(x) === norm(mod));
  const grupoOk = (a, grp) => { if (!grp) return true; const g = norm(a.grupoPeca), q = norm(grp); return !!g && (g.includes(q) || q.includes(g)); };
  const pecasDe = (mod, grp) => D('artigos').filter(a => isPeca(a) && servePara(a, mod) && grupoOk(a, grp));
  const gruposDe = mod => { const s = new Set(); D('artigos').filter(a => isPeca(a) && servePara(a, mod)).forEach(a => a.grupoPeca && s.add(a.grupoPeca)); return [...s].sort((a, b) => a.localeCompare(b, 'pt')); };

  /* ---------- valores ---------- */
  const tempos = f => D('fichas_tempos').filter(t => t.ficha === f.id);
  const aberto = f => tempos(f).find(t => !t.fim);
  const minutos = f => tempos(f).reduce((s, t) => s + (t.fim ? (+t.minutos || 0) : (Date.now() - new Date(t.inicio)) / 60000), 0);
  const precoH = f => +(f.precoHora ?? ent(f.entidade)?.precoHora ?? cfg().precoHora) || 0;
  function deslCalc(e, km) {
    if (km == null || km === '' || isNaN(+km)) return null; km = +km; const c = cfg();
    if (e?.deslModo === 'escaloes') {
      const t = S.data.desl_tabelas.get(e.deslTabela); const L = (t?.escaloes || []).slice().sort((a, b) => a.ate - b.ate);
      if (!L.length) return { valor: 0, txt: 'Cliente por escalões mas sem tabela escolhida' };
      const x = L.find(s => km <= +s.ate) || L[L.length - 1];
      return { valor: +x.valor, txt: `${fmtKm(km)} km · escalão até ${x.ate} km (${t.nome})${km > L[L.length - 1].ate ? ' · acima do último escalão, confirmar' : ''}` };
    }
    const pk = +(e?.precoKm ?? c.precoKm) || 0, mult = c.idaVolta ? 2 : 1;
    return { valor: km * mult * pk, txt: `${fmtKm(km)} km${mult === 2 ? ' × 2 (ida e volta)' : ''} × ${eur(pk)}/km` };
  }
  // tempo faturado: blocos de meia hora; passa da tolerância (5 min) → bloco seguinte; mínimo 1 h fora, ½ h na oficina
  function faturaMin(f, min) {
    const c = cfg(), bl = +c.blocoMin || 30, tol = +(c.toleranciaMin ?? 5), mn = fora(f) ? +(c.minimoForaMin ?? 60) : +(c.minimoOficinaMin ?? 30);
    if (f.tipo === 'guarda' && min <= 0) return 0;
    if (min <= 0 && !(fora(f) && f.chegadaEm)) return 0;
    return Math.max(mn, Math.ceil(Math.max(0, Math.round(min) - tol) / bl) * bl);
  }
  function valores(f) {
    const min = minutos(f), fmin = faturaMin(f, min), mo = fmin / 60 * precoH(f);
    const d = fora(f) && f.km != null ? deslCalc(ent(f.entidade), f.km) : null;
    const pc = (f.pecas || []).reduce((s, p) => s + (+p.qt || 0) * (+p.preco || 0), 0);
    return { min, fmin, mo, desl: d, pc, total: mo + (d?.valor || 0) + pc };
  }

  /* ---------- distância ---------- */
  const hav = (a, b, c, d) => { const r = x => x * Math.PI / 180, dl = r(c - a), dn = r(d - b); const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dn / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(h)); };
  async function kmEstrada(lat, lng) {
    const c = cfg();
    try { const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${c.baseLng},${c.baseLat};${lng},${lat}?overview=false`); const j = await r.json(); if (j.routes?.[0]) return { km: Math.round(j.routes[0].distance / 100) / 10, fonte: 'por estrada' }; } catch (_) { }
    return { km: Math.round(hav(c.baseLat, c.baseLng, lat, lng) * 1.3 * 10) / 10, fonte: 'estimado (linha reta × 1,3)' };
  }

  /* ---------- navegação, títulos, formulários ---------- */
  P.qr = P.qr || 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z';
  P.cam = 'M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8';
  P.clock = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2';
  P.route = 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4M18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4M6 15V9a4 4 0 0 1 4-4h2M18 9v6a4 4 0 0 1-4 4h-2';
  P.print = 'M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z';
  P.dl = 'M12 3v12M7 10l5 5 5-5M4 21h16';
  const tirar = ['leads', 'visitas', 'avencas', 'pedidos', 'pendentes', 'rota', 'compras', 'assistente'];
  for (let i = NAV.length - 1; i >= 0; i--) if (tirar.includes(NAV[i][0])) NAV.splice(i, 1);
  for (let i = NAV.length - 1; i >= 0; i--) if (['maquinas', 'mapa'].includes(NAV[i][0])) NAV.splice(i, 1);
  NAV.splice(1, 0, ['oficina', 'Oficina e assistências', 'tool'], ['rotaof', 'Rota do dia', 'route'], ['ativos', 'Ativos dos clientes', 'box']);
  const iMais = NAV.findIndex(n => n[0] === 'mais'); NAV.splice(iMais, 0, ['ofcfg', 'Preços e deslocações', 'euro']);
  for (let i = NAV.length - 1; i > 0; i--) if (NAV[i][0] === 'sep' && (NAV[i - 1][0] === 'sep' || i === NAV.length - 1)) NAV.splice(i, 1);
  SO_VALORES.push('ofcfg');
  TABS.splice(0, TABS.length, ['inicio', 'Início', 'home'], ['oficina', 'Oficina', 'tool'], ['rotaof', 'Rota', 'route'], ['clientes', 'Clientes', 'users'], ['mais', 'Mais', 'menu']);
  Object.assign(TITLES, { ativos: 'Ativos dos clientes', inicio: 'Início', oficina: 'Oficina e assistências', ofcfg: 'Preços e deslocações', rotaof: 'Rota do dia' });
  Object.defineProperty(TITLES, 'ofi', { get() { const f = S.data.fichas.get(S.params?.id); return f ? 'Ficha ' + cod(f) : 'Ficha'; } });
  const nc0 = navCounts; navCounts = () => ({ ...nc0(), oficina: D('fichas').filter(f => f.tipo !== 'guarda' && ABERTOS.includes(f.estado)).length });

  // clientes: tipos e zonas da Mundicacau, condições de faturação
  Object.keys(TIPOS).forEach(k => delete TIPOS[k]);
  Object.assign(TIPOS, { torrefator: 'Torrefator', vending: 'Operador de vending', horeca: 'HORECA', empresa: 'Empresa / instituição', particular: 'Particular' });
  ZONAS.splice(0, ZONAS.length, 'Porto', 'Braga', 'Aveiro', 'Viseu', 'Vila Real', 'Outra');
  const fe = F.entidades; fe.find(f => f.k === 'estado').def = 'cliente';
  for (let i = fe.length - 1; i >= 0; i--) if (['equipamento', 'codigoXd', 'origem', 'litigio', 'proximoContacto'].includes(fe[i].k)) fe.splice(i, 1);
  fe.push(
    { k: 'precoHora', l: 'Preço/hora deste cliente (€) · vazio = preço padrão', t: 'num', so: 1 },
    { k: 'deslModo', l: 'Deslocação cobrada', t: 'sel', o: { km: 'Por km percorrido', escaloes: 'Por escalões de distância (tabela)' }, so: 1 },
    { k: 'precoKm', l: 'Preço por km (€) · vazio = preço padrão', t: 'num', so: 1 },
    { k: 'deslTabela', l: 'Tabela de escalões (se for por escalões)', t: 'sel', get o() { return Object.fromEntries(D('desl_tabelas').map(t => [t.id, t.nome])); }, so: 1 },
  );

  NOMES.locais = ['local', 'Novo local de assistência'];
  F.locais = [
    { k: 'entidade', l: 'Cliente que paga (ex.: o torrefator)', t: 'ent', req: 1, full: 1 },
    { k: 'nome', l: 'Nome comercial (ex.: Café Avenida)', t: 'text', req: 1, full: 1 },
    { k: 'morada', l: 'Endereço', t: 'text', req: 1, full: 1 },
    { k: 'cp', l: 'Código postal (0000-000)', t: 'text', req: 1 },
    { k: 'localidade', l: 'Cidade / localidade', t: 'text', req: 1 },
    { k: 'coords', l: 'Coordenadas (ex.: 41.19025, -8.45066) · vazio = calcula pela morada', t: 'text', full: 1 },
    { k: 'contacto', l: 'Pessoa de contacto', t: 'text' },
    { k: 'telefone', l: 'Telefone', t: 'tel' },
    { k: 'notas', l: 'Notas (horário, como chegar…)', t: 'area', full: 1 },
  ];
  NOMES.fichas = ['ficha', 'Nova ficha de assistência'];
  F.fichas = [
    { k: 'tipo', l: 'Tipo de trabalho', t: 'sel', o: TIPO, req: 1, def: 'oficina' },
    { k: 'estado', l: 'Estado', t: 'sel', o: EST, req: 1, def: 'recebido' },
    { k: 'entidade', l: 'Cliente', t: 'ent', req: 1, full: 1 },
    { k: 'proprietario', l: 'Proprietário da peça (sai na etiqueta) · vazio = nome do cliente', t: 'text', full: 1 },
    { k: 'equipamento', l: 'O que entrou (escolha ou escreva, ex.: Módulo copos) · uma ficha por peça ou máquina', t: 'text', req: 1, def: 'Máquina completa' },
    { k: 'marca', l: 'Marca', t: 'text', def: 'Necta' },
    { k: 'modelo', l: 'Modelo da máquina', t: 'sel', get o() { return modelosL(); } },
    { k: 'grupo', l: 'Grupo / conjunto (filtra as peças)', t: 'sel', get o() { const s = new Set(); D('artigos').forEach(a => isPeca(a) && a.grupoPeca && s.add(a.grupoPeca)); return [...s].sort((a, b) => a.localeCompare(b, 'pt')); } },
    { k: 'nSerie', l: 'N.º de série', t: 'text' },
    { k: 'localNome', l: 'Assistência fora · nome comercial do local (ex.: Café Avenida)', t: 'text', full: 1 },
    { k: 'localMorada', l: 'Endereço do local', t: 'text', full: 1 },
    { k: 'localCp', l: 'Código postal do local', t: 'text' },
    { k: 'localCidade', l: 'Cidade do local', t: 'text' },
    { k: 'localCoords', l: 'Coordenadas do local (opcional: calcula pela morada)', t: 'text' },
    { k: 'localTelefone', l: 'Telefone do local', t: 'tel' },
    { k: 'avaria', l: 'Avaria / o que o cliente pediu', t: 'area', full: 1 },
    { k: 'resp', l: 'Técnico', t: 'user', def: '@me' },
    { k: 'prevista', l: 'Data prometida ao cliente', t: 'date' },
    { k: 'precoHora', l: 'Preço/hora só desta ficha (€) · vazio = do cliente', t: 'num', so: 1 },
    { k: 'notas', l: 'Notas internas', t: 'area', full: 1 },
  ];
  xdSheet = () => { }; // sem XD na Mundicacau
  // locais: coordenadas coladas do Google Maps ou calculadas pela morada
  const parseXY = t => { const m = String(t || '').replace(/[()]/g, ' ').match(/(-?\d{1,2}[.,]\d+)\s*[,; ]\s*(-?\d{1,3}[.,]\d+)/); if (!m) return null; const lat = parseFloat(m[1].replace(',', '.')), lng = parseFloat(m[2].replace(',', '.')); return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null; };
  async function geocode(q) { try { const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pt&q=' + encodeURIComponent(q), { headers: { 'Accept-Language': 'pt' } }); const j = await r.json(); if (j[0]) return { lat: +j[0].lat, lng: +j[0].lon }; } catch (_) { } return null; }
  async function prepLocal(v, antigo) {
    if ('coords' in v) { const t = String(v.coords || '').trim(); delete v.coords; if (t) { const xy = parseXY(t); if (!xy) { toast('Coordenadas inválidas. Use o formato 41.19025, -8.45066'); return false; } v.lat = xy.lat; v.lng = xy.lng; } }
    if (v.cp && !/^\d{4}-\d{3}$/.test(String(v.cp).trim())) { const d = String(v.cp).replace(/\D/g, ''); if (d.length === 7) v.cp = d.slice(0, 4) + '-' + d.slice(4); else { toast('Código postal no formato 0000-000'); return false; } }
    const temXY = v.lat != null || (antigo && antigo.lat);
    if (!temXY) { const m = v.morada ?? antigo?.morada, cp = v.cp ?? antigo?.cp, lc = v.localidade ?? antigo?.localidade; const xy = (m && await geocode(`${m}, ${cp || ''} ${lc || ''}`)) || ((cp || lc) && await geocode(`${cp || ''} ${lc || ''}`)); if (xy) { v.lat = xy.lat; v.lng = xy.lng; toast('Coordenadas calculadas pela morada'); } }
    return true;
  }
  // ao editar um local, mostra as coordenadas no campo
  const edit0 = ACT.edit; ACT.edit = (d, b, e) => { if (d.col === 'locais') { const l = S.data.locais.get(d.id); if (l) l.coords = l.lat != null ? `${l.lat}, ${l.lng}` : ''; } return edit0(d, b, e); };
  const of0 = openForm;
  openForm = (col, id, preset) => { const r = of0(col, id, preset); if (col === 'fichas') { const i = document.getElementById('f-equipamento'); if (i && !document.getElementById('of-eqL')) { i.setAttribute('list', 'of-eqL'); i.setAttribute('autocomplete', 'off'); i.insertAdjacentHTML('afterend', `<datalist id="of-eqL">${[...new Set([...EQUIP, ...D('fichas').map(f => f.equipamento).filter(Boolean)])].map(x => `<option value="${esc(x)}">`).join('')}</datalist>`); } } return r; };
  // depois de criar uma ficha, abre-a (fotos, etiqueta, cronómetro)
  const save0 = save;
  save = async (col, id, vals) => {
    if (col === 'locais' && vals) {
      const ok = await prepLocal(vals); if (!ok) return null;
    }
    if (col === 'fichas' && vals) {
      const T = k => String(vals[k] || '').trim();
      const ln = T('localNome'), lv = { morada: T('localMorada'), cp: T('localCp'), localidade: T('localCidade'), coords: T('localCoords'), telefone: T('localTelefone') };
      ['localNome', 'localMorada', 'localCp', 'localCidade', 'localCoords', 'localTelefone'].forEach(k => delete vals[k]);
      if (ln && vals.entidade) {
        const ja = D('locais').find(x => x.entidade === vals.entidade && norm(x.nome) === norm(ln));
        if (!ja && (!lv.morada || !lv.cp || !lv.localidade)) { toast('Para o local novo faltam o endereço, o código postal ou a cidade.'); return null; }
        const dados = Object.fromEntries(Object.entries(lv).filter(([, x]) => x));
        if (!ja) { dados.entidade = vals.entidade; dados.nome = ln; }
        if (!(await prepLocal(dados, ja))) return null;
        const lid = ja ? ja.id : await save0('locais', null, dados);
        if (ja && Object.keys(dados).length) await save0('locais', ja.id, dados);
        if (lid) vals.local = lid;
        if (!vals.tipo || vals.tipo === 'oficina') vals.tipo = 'local';
      }
    }
    const r = await save0(col, id, vals); if (r && col === 'fichas' && !id) setTimeout(() => go('ofi', { id: r }), 60); if (r && col === 'locais' && !id && S.ofLocalPara) { const fid = S.ofLocalPara; S.ofLocalPara = null; await save0('fichas', fid, { local: r }); } return r; };

  /* ---------- estilos ---------- */
  const st = document.createElement('style');
  st.textContent = `
.of-est{display:flex;flex-wrap:wrap;gap:6px}
.of-crono{font-size:40px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:.02em;line-height:1.1}
.of-big{min-height:54px;font-size:16px;flex:1}
.of-row2{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.of-fotos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
@media(min-width:700px){.of-fotos{grid-template-columns:repeat(5,minmax(0,1fr))}}
.of-fotos a,.of-fotos label{position:relative;aspect-ratio:1/1;border-radius:10px;overflow:hidden;background:var(--surface-2);display:grid;place-items:center;border:1px dashed var(--line);cursor:pointer;color:var(--ink-2);font-size:12.5px;text-align:center}
.of-fotos img{width:100%;height:100%;object-fit:cover;display:block}
.of-fotos button{position:absolute;top:4px;right:4px;width:26px;height:26px;border-radius:50%;border:0;background:rgba(0,0,0,.55);color:#fff;display:grid;place-items:center}
.of-alert{border:1px solid var(--gold);background:var(--info-soft);border-radius:14px;padding:14px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.of-alert b{font-size:16px}
.of-pc{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--line)}
.of-pc:first-child{border-top:0}
.of-pc .grow{flex:1;min-width:0}
.of-pc small{display:block;color:var(--ink-3)}
.of-qt{display:flex;align-items:center;gap:6px}
.of-qt button{width:32px;height:32px;border-radius:8px;border:1px solid var(--line);background:var(--surface)}
.of-res{max-height:340px;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:0 10px;margin-top:8px}
.of-n{display:inline-grid;place-items:center;min-width:44px;height:44px;padding:0 6px;border-radius:10px;background:var(--surface-2);font-weight:600;font-variant-numeric:tabular-nums;flex:none}
.of-sum td{padding:8px 0}
[data-act="xdPed"]{display:none!important}
a.btn.pri{color:#fff}
.of-cqw{overflow:auto;-webkit-overflow-scrolling:touch;margin-top:10px;border:1px solid var(--line);border-radius:10px;max-height:80vh}
.of-cqw .of-cq{margin-top:0;border:0;border-radius:0}
.of-cq-zoom .of-cq{width:220%}
.of-cq{position:relative;margin-top:10px;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff}
.of-cq img{display:block;width:100%;height:auto}
.of-pt{position:absolute;transform:translate(-50%,-50%);min-width:26px;height:26px;padding:0 5px;border-radius:13px;border:2px solid var(--brand);background:rgba(255,255,255,.92);color:var(--brand);font-size:12px;font-weight:700;display:grid;place-items:center}
.of-pt.on{background:var(--brand);color:#fff}
.of-pt i{position:absolute;top:-9px;right:-9px;min-width:18px;height:18px;border-radius:9px;background:var(--ok,#1a7f4b);color:#fff;font-style:normal;font-size:11px;display:grid;place-items:center;padding:0 3px}
.of-stop{background:var(--bad)!important;border-color:var(--bad)!important;color:#fff!important}
`;
  document.head.appendChild(st);

  /* ---------- linhas de lista ---------- */
  function fRow(f) {
    const e = ent(f.entidade), d = dias(f), l = fora(f) ? loc(f) : null;
    const sub = [cod(f), TIPO_C[f.tipo], l?.localidade, nomeEq(f), f.avaria].filter(Boolean).join(' · ');
    const late = f.tipo === 'oficina' && ABERTOS.includes(f.estado) && d > 30;
    return `<div class="row" role="button" tabindex="0" data-act="ofiOpen" data-id="${f.id}"><span class="of-n">${f.numero}</span>
      <span class="rt"><span class="r1">${l ? esc(l.nome) + ` <small style="color:var(--ink-3)">· ${esc(e?.nome || '')}</small>` : esc(prop(f)) + (f.proprietario && e && f.proprietario !== e.nome ? ` <small style="color:var(--ink-3)">· ${esc(e.nome)}</small>` : '')}</span><span class="r2">${esc(sub)}</span></span>
      <span class="rr">${badge(estL(f), EST_T[f.estado])}${['oficina', 'guarda'].includes(f.tipo) ? `<span class="note${late ? '' : ''}" style="${late ? 'color:var(--bad);font-weight:500' : ''}">${d} d</span>` : f.prevista ? `<span class="note">${fD(f.prevista)}</span>` : ''}${aberto(f) ? badge('A contar tempo', 'warn') : ''}</span></div>`;
  }
  const byEntrada = (a, b) => (b.entrada || '').localeCompare(a.entrada || '');

  function gruposIguais() {
    const m = new Map();
    D('fichas').filter(f => f.tipo !== 'guarda' && ['recebido', 'diagnostico'].includes(f.estado) && f.equipamento && f.equipamento !== 'Máquina completa').forEach(f => { const k = f.equipamento; if (!m.has(k)) m.set(k, []); m.get(k).push(f); });
    return [...m.entries()].filter(([, L]) => L.length >= 2).sort((a, b) => b[1].length - a[1].length);
  }
  const alertasH = () => gruposIguais().map(([k, L]) => `<div class="of-alert"><span style="flex:1;min-width:220px"><b>${L.length} × ${esc(k)} à espera</b><br><span class="note">${esc([...new Set(L.map(prop))].join(', '))}. Pode fazer todas de seguida.</span></span><button class="btn pri sm" data-act="ofiGrupo" data-c="${esc(k)}">Ver as ${L.length}</button></div>`).join('');

  /* ---------- Início (painel da oficina) ---------- */
  VIEWS.inicio = () => loadingOr(() => {
    const F0 = D('fichas'), naOf = F0.filter(f => f.tipo === 'oficina' && ABERTOS.includes(f.estado)), prontos = F0.filter(f => f.estado === 'pronto');
    const hoje = F0.filter(f => fora(f) && ABERTOS.includes(f.estado) && (!f.prevista || f.prevista <= TODAY()));
    const antigos = naOf.filter(f => dias(f) > 30).sort((a, b) => dias(b) - dias(a));
    const porAvisar = prontos.filter(f => !f.avisadoEm);
    return `<div class="pg">${roBanner()}
    <div class="mini" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))"><div><span>Na oficina</span><b>${naOf.length}</b></div><div><span>Prontos por entregar</span><b>${prontos.length}</b></div><div><span>Assistências por fazer</span><b>${hoje.length}</b></div><div><span>Há mais de 30 dias</span><b style="color:${antigos.length ? 'var(--bad)' : 'inherit'}">${antigos.length}</b></div></div>
    ${S.canWrite ? `<div class="of-row2"><button class="btn pri of-big" data-act="ofiNew" data-preset='{"tipo":"oficina"}'>${ic('plus', 18)}Entrada na oficina</button><button class="btn of-big" data-act="ofiNew" data-preset='{"tipo":"local"}'>${ic('pin', 18)}Assistência no cliente</button></div>` : ''}
    ${alertasH()}
    ${porAvisar.length ? `<div class="panel"><div class="ph"><h2>Prontos · avisar o cliente</h2></div>${porAvisar.map(fRow).join('')}</div>` : ''}
    <div class="panel"><div class="ph"><h2>Assistências no cliente</h2><button class="lnk" data-act="go" data-v="rotaof">Ver rota</button></div>${hoje.length ? hoje.map(fRow).join('') : '<div class="empty">Sem assistências por fazer.</div>'}</div>
    ${antigos.length ? `<div class="panel"><div class="ph"><h2>Há mais tempo na oficina</h2></div>${antigos.slice(0, 6).map(fRow).join('')}</div>` : ''}
    </div>`;
  });

  /* ---------- lista da oficina ---------- */
  const CHIPS = ['Em espera', 'Em curso', 'Prontos', 'Entregues', 'Todas'];
  VIEWS.oficina = () => loadingOr(() => {
    let c = S.f.oficina || 'Em espera'; if (!c.startsWith('eq:') && !CHIPS.includes(c)) c = 'Em espera';
    let L = D('fichas').filter(f => f.tipo !== 'guarda' || c === 'Todas');
    if (c.startsWith('eq:')) { const k = c.slice(3); L = L.filter(f => f.equipamento === k && ['recebido', 'diagnostico'].includes(f.estado)); }
    else if (c === 'Em espera') L = L.filter(f => ESPERA.includes(f.estado));
    else if (c === 'Em curso') L = L.filter(f => CURSO.includes(f.estado));
    else if (c === 'Prontos') L = L.filter(f => f.estado === 'pronto');
    else if (c === 'Entregues') L = L.filter(f => f.estado === 'entregue');
    const velhoPrimeiro = !['Entregues', 'Todas'].includes(c);
    L = L.filter(f => match('oficina', f, ['codigo', 'numero', 'proprietario', 'entidade', 'equipamento', 'modelo', 'nSerie', 'avaria'])).sort((a, b) => velhoPrimeiro ? (a.entrada || '').localeCompare(b.entrada || '') : byEntrada(a, b));
    const porFat = D('fichas').filter(f => ['pronto', 'entregue'].includes(f.estado) && !f.faturado).length;
    return `<div class="pg">${roBanner()}
     <div class="tb"><div class="tbr"><label class="srch">${ic('search', 18)}<input id="q-oficina" data-q="oficina" type="search" placeholder="N.º da ficha, cliente, peça, n.º de série" value="${esc(S.q.oficina || '')}" autocomplete="off"></label>${S.canWrite ? `<button class="btn pri" data-act="ofiNew">${ic('plus', 18)}<span>Nova ficha</span></button>` : ''}</div>
     <div class="chips">${c.startsWith('eq:') ? `<button class="chipb on" data-act="chip" data-v="oficina" data-c="Em espera">${esc(c.slice(3))} ✕</button>` : ''}${CHIPS.map(x => `<button class="chipb ${x === c ? 'on' : ''}" data-act="chip" data-v="oficina" data-c="${x}">${x}</button>`).join('')}</div></div>
     ${c.startsWith('eq:') ? '' : alertasH()}${velhoPrimeiro && L.length ? '<p class="note" style="margin:0">Do mais antigo para o mais recente: em cima estão as que estão paradas há mais tempo.</p>' : ''}
     ${listBlock('oficina', L, fRow, '<b>Sem fichas</b>Crie uma ficha quando entrar uma peça ou máquina.')}
     ${(() => { const cl = [...new Set(D('fichas').filter(f => ['pronto', 'entregue'].includes(f.estado) && !f.faturado).map(f => f.entidade))].map(id => [id, entName(id)]).sort((a, b) => a[1].localeCompare(b[1], 'pt')); return `<div class="panel"><div class="ph"><h2>${S.verValores ? 'Faturar e PDF das fichas' : 'PDF das fichas'}</h2></div><div class="pb">
       <p class="note" style="margin-top:0">${porFat} fichas prontas ou entregues ainda por faturar.${S.verValores ? ' O Excel serve de base para lançar no Sage.' : ''}</p>
       <div class="fld" style="max-width:360px"><label for="offcli">Cliente</label><select id="offcli"><option value="">Todos os clientes</option>${cl.map(([id, n]) => `<option value="${id}">${esc(n)}</option>`).join('')}</select></div>
       <div class="of-row2">${S.verValores ? `<button class="btn" data-act="ofiExport" ${porFat ? '' : 'disabled'}>${ic('dl', 16)}Excel para faturar</button><button class="btn" data-act="ofiPdfLote" data-c="1" ${porFat ? '' : 'disabled'}>${ic('doc', 16)}PDF com preços</button>` : ''}<button class="btn" data-act="ofiPdfLote" data-c="0" ${porFat ? '' : 'disabled'}>${ic('doc', 16)}PDF sem preços${S.verValores ? ' (para o cliente)' : ''}</button></div></div></div>`; })()}
    </div>`;
  });

  /* ---------- ficha ---------- */
  VIEWS.ofi = () => loadingOr(() => {
    const f = S.data.fichas.get(S.params.id);
    if (!f) return `<div class="panel empty"><b>Ficha não encontrada</b>Pode ter sido apagada.</div>`;
    if (S.ofPick && S.ofPick.id !== f.id) S.ofPick = null;
    const e = ent(f.entidade) || {}, tel = e.telemovel || e.telefone, ro = !S.canWrite, v = valores(f), run = aberto(f);
    const addr = [e.morada, e.cp, e.localidade].filter(Boolean).join(', ');
    const L0 = fora(f) ? loc(f) : null, xy = ondeXY(f), dest = xy ? `${xy.lat},${xy.lng}` : (L0 ? [L0.morada, L0.cp, L0.localidade].filter(Boolean).join(', ') : addr);
    const T = tempos(f).sort((a, b) => (b.inicio || '').localeCompare(a.inicio || ''));
    const mod = S.ofPick?.mod ?? f.modelo ?? '', grp = S.ofPick?.grp ?? f.grupo ?? '', q = S.ofPick?.q || '';
    const res = S.ofPick?.open ? pecasDe(mod, grp).filter(a => !q || norm(a.nome + ' ' + (a.ref || '')).includes(norm(q))).slice(0, 60) : [];
    let h = `<div class="pg">${roBanner()}
    <div><button class="btn sm" data-act="go" data-v="oficina">${ic('back', 16)}Oficina</button></div>
    <div class="fh"><span class="of-n" style="min-width:56px;height:56px;font-size:20px">${f.numero}</span><div style="min-width:0;flex:1"><h1>${esc(L0 ? L0.nome : prop(f))}</h1>
      <div class="meta">${badge(cod(f), 'info')}${badge(estL(f), EST_T[f.estado])}${badge(TIPO_C[f.tipo], 'gold')}${(L0 || (f.proprietario && f.proprietario !== e.nome)) && e.nome ? badge('Cliente: ' + e.nome) : ''}${['oficina', 'guarda'].includes(f.tipo) ? badge(`Entrou a ${fDY(f.entrada)} · ${dias(f)} d`, dias(f) > 30 && ABERTOS.includes(f.estado) ? 'bad' : 'mute') : f.prevista ? badge('Agendada ' + fDY(f.prevista)) : ''}${f.faturado ? badge('Faturado', 'ok') : ''}</div></div></div>
    <div class="panel"><div class="pb" style="padding-top:12px"><div class="kv">${[['Equipamento', nomeEq(f)], ['N.º de série', f.nSerie], ['Grupo', f.grupo], ['Avaria / pedido', f.avaria], ['Técnico', f.resp ? nameOf(f.resp) : ''], ['Notas', f.notas]].filter(x => x[1]).map(([l, x]) => `<div class="kvi"><span>${l}</span><b style="white-space:pre-wrap">${esc(x)}</b></div>`).join('')}</div></div></div>
    <div class="acts"><a class="act ${tel ? '' : 'off'}" href="tel:${esc(telClean(tel))}">${ic('phone')}<span>Ligar</span></a><a class="act ${e.telemovel ? '' : 'off'}" href="https://wa.me/${esc(waNum(e.telemovel))}" target="_blank" rel="noopener">${ic('wa')}<span>WhatsApp</span></a><a class="act ${e.email ? '' : 'off'}" href="mailto:${esc(e.email || '')}">${ic('mail')}<span>Email</span></a><a class="act ${dest ? '' : 'off'}" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}" target="_blank" rel="noopener">${ic('pin')}<span>Ir até lá</span></a></div>
    ${ro ? (f.modelo ? `<div class="of-row2"><button class="btn" data-act="ofiManuais" data-c="${esc(f.modelo)}">${ic('doc', 16)}Manuais</button></div>` : '') : `<div class="of-row2"><button class="btn" data-act="ofiLabel" data-id="${f.id}">${ic('qr', 16)}Imprimir etiqueta</button>${f.tipo === 'oficina' ? `<button class="btn" data-act="ofiDocMenu" data-id="${f.id}" data-c="entrada">${ic('doc', 16)}Comprovativo de entrada</button>` : ''}<button class="btn ${['pronto', 'entregue'].includes(f.estado) ? 'pri' : ''}" data-act="ofiDocMenu" data-id="${f.id}" data-c="entrega">${ic('doc', 16)}${f.tipo === 'oficina' ? 'Guia de entrega' : 'Folha de serviço'}</button><button class="btn" data-act="ofiAviso" data-id="${f.id}">${ic('send', 16)}${fora(f) ? 'Enviar relatório ao cliente' : 'Avisar cliente'}</button>${f.modelo ? `<button class="btn" data-act="ofiManuais" data-c="${esc(f.modelo)}">${ic('doc', 16)}Manuais${(() => { const n = D('manuais').filter(m => norm(m.modelo) === norm(f.modelo)).length; return n ? ` (${n})` : ''; })()}</button>` : ''}<button class="btn" data-act="ofiPdfUm" data-id="${f.id}">${ic('doc', 16)}PDF da ficha</button><button class="btn" data-act="ofiEdit" data-id="${f.id}">${ic('edit', 16)}Editar ficha</button></div>`}
    <div class="panel"><div class="ph"><h2>Estado</h2>${f.avisadoEm ? `<span class="note">Cliente avisado ${fD(f.avisadoEm)}</span>` : ''}</div><div class="pb"><div class="of-est">${Object.entries(EST).map(([k, l]) => `<button class="chipb ${f.estado === k ? 'on' : ''}" data-act="ofiEst" data-id="${f.id}" data-c="${k}" ${ro ? 'disabled' : ''}>${l}</button>`).join('')}</div></div></div>`;

    // local da assistência (cliente do cliente)
    if (fora(f)) {
      const LS = D('locais').filter(x => x.entidade === f.entidade && x.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
      h += `<div class="panel" ${L0 ? '' : 'style="border-color:var(--gold)"'}><div class="ph"><h2>Local da assistência</h2><span class="note">onde está a máquina</span></div><div class="pb">
        ${L0 ? `<p style="margin:0 0 4px"><b>${esc(L0.nome)}</b></p><p class="note" style="margin:0 0 10px">${esc([[L0.morada, L0.cp, L0.localidade].filter(Boolean).join(', '), [L0.contacto, L0.telefone].filter(Boolean).join(' · ')].filter(Boolean).join(' · ') || 'Sem morada')}${L0.lat != null ? `<br>Coordenadas ${(+L0.lat).toFixed(5)}, ${(+L0.lng).toFixed(5)}` : '<br><span style="color:var(--bad)">Sem coordenadas: ficam ao carregar em «Estou aqui»</span>'}${L0.notas ? '<br>' + esc(L0.notas) : ''}</p>
          <div class="of-row2" style="margin-bottom:12px">${L0.telefone ? `<a class="btn sm" href="tel:${esc(telClean(L0.telefone))}">${ic('phone', 16)}Ligar para o local</a>` : ''}<a class="btn sm" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}" target="_blank" rel="noopener">${ic('pin', 16)}Ir até lá</a>${ro ? '' : `<button class="btn sm" data-act="edit" data-col="locais" data-id="${L0.id}">${ic('edit', 16)}Editar local</button>`}</div>`
        : `<p class="note" style="margin:0 0 10px">A assistência é no cliente do cliente? Escolha o local (ex.: o café onde está a máquina). Se for na morada de ${esc(e.nome || 'cliente')}, deixe em branco.</p>`}
        ${ro ? '' : `<div class="of-row2"><div class="fld" style="flex:1;min-width:200px;margin:0"><label for="oflocal">Local</label><select id="oflocal" data-oflocal="${f.id}"><option value="">Na morada de ${esc(e.nome || 'cliente')}</option>${LS.map(x => `<option value="${x.id}" ${x.id === f.local ? 'selected' : ''}>${esc(x.nome)}${x.localidade ? ' · ' + esc(x.localidade) : ''}</option>`).join('')}</select></div><button class="btn" style="align-self:flex-end" data-act="ofiLocalNovo" data-id="${f.id}">${ic('plus', 16)}Novo local</button></div>`}
      </div></div>`;
    }

    // deslocação
    if (fora(f)) {
      const dc = f.km != null ? deslCalc(e, f.km) : null;
      h += `<div class="panel"><div class="ph"><h2>Deslocação</h2><span class="note">${e.deslModo === 'escaloes' ? 'Cliente por escalões' : 'Cliente por km'}</span></div><div class="pb">
        ${f.chegadaEm ? `<p style="margin:0 0 8px">Chegou a ${fD(f.chegadaEm)} · <b>${fmtKm(f.km)} km</b> desde a ${esc(cfg().empresa)}${f.chegadaLat ? ` · <a href="https://www.google.com/maps/search/?api=1&query=${f.chegadaLat},${f.chegadaLng}" target="_blank" rel="noopener">ver no mapa</a>` : ''}</p>` : '<p class="note" style="margin:0 0 10px">Quando chegar ao local, carregue em «Estou aqui». O telemóvel envia a localização, calcula os km desde a empresa e começa a contar o tempo de trabalho.</p>'}
        ${dc && S.verValores ? `<p class="note" style="margin:0 0 10px">${esc(dc.txt)} = <b>${eur(dc.valor)}</b></p>` : ''}
        ${ro ? '' : `<div class="of-row2"><button class="btn pri of-big" data-act="ofiAqui" data-id="${f.id}">${ic('pin', 18)}${f.chegadaEm ? 'Atualizar localização' : 'Estou aqui'}</button><div class="fld" style="width:130px;margin:0"><label for="ofkm">Km (corrigir)</label><input id="ofkm" type="number" step="0.1" inputmode="decimal" data-ofkm="${f.id}" value="${f.km ?? ''}"></div></div>`}
      </div></div>`;
    }

    // cronómetro
    h += `<div class="panel"><div class="ph"><h2>Tempo de trabalho</h2><span class="note">Total ${fmtMin(v.min)}${v.fmin ? ' · a faturar ' + fmtMin(v.fmin) : ''}</span></div><div class="pb">
      <div class="of-row2"><div style="flex:1"><div class="of-crono" id="ofcrono" data-ini="${run ? esc(run.inicio) : ''}">${run ? '00:00:00' : fmtMin(v.min)}</div><span class="note">${run ? 'A contar desde ' + fD(run.inicio) + (run.resp ? ' · ' + esc(nameOf(run.resp)) : '') : 'Parado'}</span></div>
      ${ro ? '' : `<button class="btn pri of-big ${run ? 'of-stop' : ''}" style="flex:0 0 170px" data-act="ofiCrono" data-id="${f.id}">${ic('clock', 18)}${run ? 'Parar' : 'Iniciar'}</button>`}</div>
      ${ro ? '' : `<div class="of-row2" style="margin-top:14px;align-items:flex-end"><span class="note" style="flex-basis:100%;margin-bottom:-4px">Ou escreva o tempo à mão:</span>
        <div class="fld" style="width:70px;margin:0"><label for="ofmh">Horas</label><input id="ofmh" type="number" min="0" step="1" inputmode="numeric" placeholder="0"></div>
        <div class="fld" style="width:76px;margin:0"><label for="ofmm">Minutos</label><input id="ofmm" type="number" min="0" max="59" step="1" inputmode="numeric" placeholder="0"></div>
        <div class="fld" style="width:150px;margin:0"><label for="ofmd">Data</label><input id="ofmd" type="date" value="${TODAY()}"></div>
        <div class="fld" style="flex:1;min-width:150px;margin:0"><label for="ofmr">Técnico</label><select id="ofmr">${teamIds().map(id => `<option value="${esc(id)}" ${id === S.uid ? 'selected' : ''}>${esc(nameOf(id))}</option>`).join('')}</select></div>
        <button class="btn" data-act="ofiTMan" data-id="${f.id}">${ic('plus', 16)}Adicionar tempo</button></div>`}
      ${T.length ? `<table class="tt" style="margin-top:12px"><tbody>${T.slice(0, 20).map(t => `<tr><td>${t.tipo === 'manual' ? fDY(t.inicio) + ' · <i>manual</i>' : fD(t.inicio)}${t.resp ? ' · ' + esc(nameOf(t.resp)) : ''}</td><td class="num">${t.fim ? fmtMin(t.minutos) : 'a contar'}</td>${ro ? '' : `<td style="width:36px">${t.fim ? `<button class="ib" data-act="ofiTDel" data-id="${t.id}" aria-label="Apagar este tempo">${ic('x', 14)}</button>` : ''}</td>`}</tr>`).join('')}</tbody></table>` : ''}
    </div></div>`;

    // fotos
    h += `<div class="panel"><div class="ph"><h2>Fotos</h2><span class="note">${(f.fotos || []).length}</span></div><div class="pb"><div class="of-fotos">
      ${(f.fotos || []).map((p, i) => `<a href="${esc(fotoF(p))}" target="_blank" rel="noopener"><img src="${esc(fotoF(p))}" alt="Foto ${i + 1}" loading="lazy">${ro ? '' : `<button data-act="ofiFotoDel" data-id="${f.id}" data-i="${i}" aria-label="Apagar foto">${ic('x', 14)}</button>`}</a>`).join('')}
      ${ro ? '' : `<label>${ic('cam', 26)}<span>Tirar foto</span><input type="file" accept="image/*" capture="environment" data-ofifoto="${f.id}" hidden></label><label>${ic('plus', 22)}<span>Da galeria</span><input type="file" accept="image/*" multiple data-ofifoto="${f.id}" hidden></label>`}
    </div></div></div>`;

    // diagnóstico e trabalho
    h += `<div class="panel"><div class="ph"><h2>Diagnóstico e trabalho feito</h2></div><div class="pb"><div class="fg">
      <div class="fld full"><label for="ofdiag">Diagnóstico</label><textarea id="ofdiag" data-oftxt="diagnostico" data-id="${f.id}" ${ro ? 'readonly' : ''} placeholder="O que foi encontrado">${esc(f.diagnostico || '')}</textarea></div>
      <div class="fld full"><label for="oftrab">Trabalho realizado (vai no relatório ao cliente)</label><textarea id="oftrab" data-oftxt="trabalho" data-id="${f.id}" ${ro ? 'readonly' : ''} placeholder="O que foi feito">${esc(f.trabalho || '')}</textarea></div></div></div></div>`;

    // peças
    const P0 = f.pecas || [];
    h += `<div class="panel"><div class="ph"><h2>Peças aplicadas</h2>${S.verValores && v.pc ? `<b class="num">${eur(v.pc)}</b>` : ''}</div><div class="pb">
      ${P0.length ? P0.map((p, i) => `<div class="of-pc"><span class="grow">${esc(p.nome)}<small>${esc(p.ref || '')}${S.verValores ? ' · ' + eur(p.preco) + '/un' : ''}</small></span>${ro ? `<b>${p.qt}</b>` : `<span class="of-qt"><button data-act="ofiPq" data-id="${f.id}" data-i="${i}" data-c="-1">−</button><b class="num">${String(p.qt).replace('.', ',')}</b><button data-act="ofiPq" data-id="${f.id}" data-i="${i}" data-c="1">+</button></span>`}</div>`).join('') : '<p class="note" style="margin:0">Ainda sem peças.</p>'}
      ${ro ? '' : `<div class="of-row2" style="margin-top:12px;align-items:flex-end"><div class="fld" style="flex:1;min-width:160px;margin:0"><label for="ofcod">Código da peça</label><input id="ofcod" data-ofcod="${f.id}" placeholder="Ex.: 0V2277" autocomplete="off" autocapitalize="characters" enterkeyhint="done"></div><div class="fld" style="width:76px;margin:0"><label for="ofcodqt">Qt</label><input id="ofcodqt" type="number" min="1" step="1" value="1" inputmode="numeric"></div><button class="btn pri" data-act="ofiCod" data-id="${f.id}">Pôr</button></div>`}
      ${(() => { const CQ = D('croquis').filter(c => f.modelo && norm(c.modelo) === norm(f.modelo)).sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || a.grupo.localeCompare(b.grupo, 'pt')); return CQ.length ? `<div style="margin-top:14px"><div class="eyebrow" style="margin-bottom:8px">Croquis do ${esc(f.modelo)} · toque num número</div><div class="of-est">${CQ.map(c => `<button class="chipb ${S.ofCroqui === c.id ? 'on' : ''}" data-act="ofiCroqui" data-c="${c.id}">${esc(c.grupo)}</button>`).join('')}</div>${S.ofCroqui && CQ.some(c => c.id === S.ofCroqui) ? croquiH(f, S.data.croquis.get(S.ofCroqui)) : ''}</div>` : (f.modelo ? `<p class="note" style="margin:12px 0 0">Ainda não há croquis do ${esc(f.modelo)}.</p>` : ''); })()}
      ${ro ? '' : !S.ofPick?.open ? `<div style="margin-top:12px"><button class="btn" data-act="ofiPick" data-id="${f.id}">${ic('search', 16)}Procurar peça${f.modelo ? ' do ' + esc(f.modelo) : ''}</button></div>` : `
        <div class="fg" style="margin-top:12px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
          <div class="fld"><label for="ofpm">Modelo</label><select id="ofpm" data-ofp="mod"><option value="">Todos os modelos</option>${modelosL().map(m => `<option ${m === mod ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div>
          <div class="fld"><label for="ofpg">Grupo</label><select id="ofpg" data-ofp="grp"><option value="">Todos os grupos</option>${gruposDe(mod).map(g => `<option ${g === grp ? 'selected' : ''}>${esc(g)}</option>`).join('')}${grp && !gruposDe(mod).includes(grp) ? `<option selected>${esc(grp)}</option>` : ''}</select></div>
          <div class="fld"><label for="ofpq">Procurar</label><input id="ofpq" data-ofp="q" value="${esc(q)}" placeholder="Nome ou referência" autocomplete="off"></div></div>
        <p class="note" style="margin:8px 0 0">${pecasDe(mod, grp).length} peças ${mod ? 'do ' + esc(mod) : ''}${grp ? ' · ' + esc(grp) : ''}. <button class="lnk" style="border:0;background:none;text-decoration:underline;color:var(--ink-2)" data-act="ofiPickX">Fechar</button></p>
        <div class="of-res" id="ofres">${res.length ? res.map(a => `<div class="of-pc"><span class="grow">${esc(a.nome)}<small>${esc(a.ref || '')}${a.grupoPeca ? ' · ' + esc(a.grupoPeca) : ''}${S.verValores && a.preco != null ? ' · ' + eur(a.preco) : ''}</small></span><button class="btn sm" data-act="ofiPadd" data-id="${f.id}" data-a="${a.id}">Pôr</button></div>`).join('') : '<p class="note">Nenhuma peça com estes filtros.</p>'}</div>`}
    </div></div>`;

    // orçamento e valores (só para quem vê valores)
    if (S.verValores) {
      h += `<div class="panel"><div class="ph"><h2>Orçamento</h2><span class="note">opcional</span>${f.orcEstado ? badge({ enviado: 'Enviado', aceite: 'Aceite', recusado: 'Recusado' }[f.orcEstado], { enviado: 'info', aceite: 'ok', recusado: 'bad' }[f.orcEstado]) : ''}</div><div class="pb"><div class="fg" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
        <div class="fld"><label for="oforc">Valor sem IVA (€)</label><input id="oforc" type="number" step="0.01" inputmode="decimal" data-oforc="orcValor" data-id="${f.id}" value="${f.orcValor ?? ''}" placeholder="${v.total ? (Math.round(v.total * 100) / 100) : ''}"></div>
        <div class="fld" style="grid-column:1/-1"><label for="oforn">Descrição do orçamento</label><textarea id="oforn" data-oforc="orcNotas" data-id="${f.id}" placeholder="Ex.: substituição da resistência e vedantes da caldeira">${esc(f.orcNotas || '')}</textarea></div></div>
        <div class="of-row2" style="margin-top:10px"><button class="btn" data-act="ofiOrc" data-id="${f.id}">${ic('send', 16)}Enviar orçamento</button>${f.orcEstado ? `<button class="btn sm" data-act="ofiOrcE" data-id="${f.id}" data-c="aceite">Aceite</button><button class="btn sm" data-act="ofiOrcE" data-id="${f.id}" data-c="recusado">Recusado</button>` : ''}${f.orcEm ? `<span class="note">Enviado ${fD(f.orcEm)}</span>` : ''}</div></div></div>`;
      h += `<div class="panel"><div class="ph"><h2>Ficha de custo</h2><b class="num">${eur(v.total)}</b></div><div class="pb"><table class="tt of-sum"><tbody>
        <tr><td>Mão de obra · ${fmtMin(v.fmin)} a faturar (tempo real ${fmtMin(v.min)}${fora(f) ? ', mínimo ' + fmtMin(cfg().minimoForaMin ?? 60) + ' fora' : ', mínimo ' + fmtMin(cfg().minimoOficinaMin ?? 30) + ' na oficina'}) × ${eur(precoH(f))}/h</td><td class="num">${eur(v.mo)}</td></tr>
        ${fora(f) ? `<tr><td>Deslocação${v.desl ? ' · ' + esc(v.desl.txt) : ' · falta a localização ou os km'}</td><td class="num">${eur(v.desl?.valor || 0)}</td></tr>` : ''}
        <tr><td>Peças · ${(f.pecas || []).reduce((s, p) => s + (+p.qt || 0), 0)} un</td><td class="num">${eur(v.pc)}</td></tr>
        <tr><td><b>Total sem IVA</b></td><td class="num"><b>${eur(v.total)}</b></td></tr></tbody></table>
        ${ro ? '' : `<label class="tog"><input type="checkbox" data-offat="${f.id}" ${f.faturado ? 'checked' : ''}><span>Já está faturado</span></label>`}</div></div>`;
    }
    return h + `</div>`;
  });

  /* ---------- rota do dia ---------- */
  VIEWS.rotaof = () => loadingOr(() => {
    const c = cfg();
    const L = D('fichas').filter(f => fora(f) && ABERTOS.includes(f.estado) && (!f.prevista || f.prevista <= TODAY()) && (S.f.rotaof !== 'Minhas' || !f.resp || f.resp === S.uid));
    const com = L.map(f => { const e = ent(f.entidade) || {}, l = loc(f), xy = ondeXY(f); return { f, e, l, xy, d: xy ? hav(c.baseLat, c.baseLng, xy.lat, xy.lng) : null }; });
    const ok = com.filter(x => x.d != null).sort((a, b) => b.d - a.d), sem = com.filter(x => x.d == null);
    const pts = ok.map(x => `${x.xy.lat},${x.xy.lng}`);
    const gm = pts.length ? `https://www.google.com/maps/dir/?api=1&origin=${c.baseLat},${c.baseLng}&destination=${pts[pts.length - 1]}${pts.length > 1 ? '&waypoints=' + encodeURIComponent(pts.slice(0, -1).join('|')) : ''}&travelmode=driving` : '';
    return `<div class="pg">${roBanner()}
      <div class="chips">${['Todas', 'Minhas'].map(x => `<button class="chipb ${(S.f.rotaof || 'Todas') === x ? 'on' : ''}" data-act="chip" data-v="rotaof" data-c="${x}">${x}</button>`).join('')}</div>
      <p class="note" style="margin:0">Assistências por fazer até hoje, por ordem: começa no cliente mais longe da ${esc(c.empresa)} e acaba no mais perto, para terminar o dia perto de casa.</p>
      ${gm ? `<a class="btn pri of-big" href="${esc(gm)}" target="_blank" rel="noopener">${ic('route', 18)}Abrir percurso no Google Maps</a>` : ''}
      <div class="panel">${ok.length ? ok.map((x, i) => `<div class="row" role="button" tabindex="0" data-act="ofiOpen" data-id="${x.f.id}"><span class="of-n">${i + 1}</span><span class="rt"><span class="r1">${x.l ? esc(x.l.nome) + ` <small style="color:var(--ink-3)">· ${esc(x.e.nome || '')}</small>` : esc(x.e.nome || '')}</span><span class="r2">${esc([(x.l || x.e).localidade, '≈ ' + Math.round(x.d * 1.3) + ' km', nomeEq(x.f), x.f.avaria].filter(Boolean).join(' · '))}</span></span><span class="rr">${badge(cod(x.f))}</span></div>`).join('') : '<div class="empty"><b>Sem assistências para hoje</b>As assistências no cliente aparecem aqui por ordem.</div>'}</div>
      ${sem.length ? `<div class="panel"><div class="ph"><h2>Sem localização</h2></div><div class="pb" style="padding-bottom:4px"><p class="note" style="margin:0">Estes locais ainda não têm coordenadas. Ficam com elas na primeira vez que alguém carregar em «Estou aqui».</p></div>${sem.map(x => fRow(x.f)).join('')}</div>` : ''}
    </div>`;
  });

  /* ---------- preços e deslocações ---------- */
  const escTxt = L => (L || []).slice().sort((a, b) => a.ate - b.ate).map(s => `${s.ate}=${s.valor}`).join('; ');
  const parseEsc = t => String(t || '').split(/[;\n]+/).map(x => x.split('=').map(y => parseFloat(String(y).replace(',', '.')))).filter(([a, b]) => a > 0 && b >= 0).map(([ate, valor]) => ({ ate, valor }));
  VIEWS.ofcfg = () => loadingOr(() => {
    const c = cfg();
    return `<div class="pg">
      <div class="panel"><div class="ph"><h2>Preços padrão</h2></div><div class="pb"><div class="fg" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
        <div class="fld"><label for="cf-ph">Preço/hora (€)</label><input id="cf-ph" type="number" step="0.01" value="${c.precoHora ?? ''}"></div>
        <div class="fld"><label for="cf-pk">Preço por km (€)</label><input id="cf-pk" type="number" step="0.01" value="${c.precoKm ?? ''}"></div>
        <div class="fld"><label for="cf-bl">Faturar em blocos de (min)</label><input id="cf-bl" type="number" step="1" value="${c.blocoMin ?? 30}"></div>
        <div class="fld"><label for="cf-tol">Tolerância antes do bloco seguinte (min)</label><input id="cf-tol" type="number" step="1" value="${c.toleranciaMin ?? 5}"></div>
        <div class="fld"><label for="cf-mf">Mínimo nas assistências fora (min)</label><input id="cf-mf" type="number" step="1" value="${c.minimoForaMin ?? 60}"></div>
        <div class="fld"><label for="cf-mo">Mínimo na oficina (min)</label><input id="cf-mo" type="number" step="1" value="${c.minimoOficinaMin ?? 30}"></div>
        <div class="fld"><label for="cf-lat">Morada da empresa · latitude</label><input id="cf-lat" type="number" step="any" value="${c.baseLat ?? ''}"></div>
        <div class="fld"><label for="cf-lng">longitude</label><input id="cf-lng" type="number" step="any" value="${c.baseLng ?? ''}"></div></div>
        <label class="tog"><input id="cf-iv" type="checkbox" ${c.idaVolta ? 'checked' : ''}><span>Nos clientes por km, cobrar ida e volta</span></label>
        <p class="note" style="margin:0 0 10px">Exemplo com blocos de 30 min e 5 min de tolerância: 35 min fatura ½ h, 36 min fatura 1 h, 1 h 06 fatura 1 h 30. Cada cliente pode ter o seu preço/hora e a sua forma de cobrar a deslocação (na ficha do cliente). Os escalões contam a distância de ida.</p>
        ${S.isAdmin ? '<button class="btn pri" data-act="ofCfgSave">Guardar</button>' : '<p class="note">Só o administrador altera estes valores.</p>'}</div></div>
      <div class="panel"><div class="ph"><h2>Tabelas de escalões</h2></div><div class="pb">
        <p class="note" style="margin-top:0">Escreva os escalões como «até km = valor», separados por ponto e vírgula. Ex.: 40=30; 70=50; 150=90</p>
        ${D('desl_tabelas').map(t => `<div class="fg" style="grid-template-columns:minmax(0,1fr) minmax(0,2fr) auto;align-items:end;margin-bottom:10px"><div class="fld"><label>Nome</label><input data-dtn="${t.id}" value="${esc(t.nome)}"></div><div class="fld"><label>Escalões</label><input data-dte="${t.id}" value="${esc(escTxt(t.escaloes))}"></div><button class="btn" data-act="ofTabSave" data-id="${t.id}">Guardar</button></div><p class="note" style="margin:-4px 0 14px">${D('entidades').filter(e => e.deslTabela === t.id).length} clientes usam esta tabela</p>`).join('')}
        ${S.canWrite ? '<button class="btn" data-act="ofTabNew">' + ic('plus', 16) + 'Nova tabela</button>' : ''}</div></div></div>`;
  });
  ACT.ofCfgSave = async () => { const n = id => { const x = $('#' + id).value; return x === '' ? null : parseFloat(x); }; if (await patch('oficina_config', 1, { precoHora: n('cf-ph'), precoKm: n('cf-pk'), blocoMin: n('cf-bl') || 30, toleranciaMin: n('cf-tol') ?? 5, minimoForaMin: n('cf-mf') ?? 60, minimoOficinaMin: n('cf-mo') ?? 30, baseLat: n('cf-lat'), baseLng: n('cf-lng'), idaVolta: $('#cf-iv').checked })) toast('Guardado'); };
  ACT.ofTabSave = async d => { const nome = $(`[data-dtn="${d.id}"]`).value.trim(), L = parseEsc($(`[data-dte="${d.id}"]`).value); if (!nome || !L.length) return toast('Falta o nome ou os escalões'); if (await patch('desl_tabelas', d.id, { nome, escaloes: L })) toast('Tabela guardada'); };
  ACT.ofTabNew = async () => { await save('desl_tabelas', null, { nome: 'Nova tabela', escaloes: [{ ate: 40, valor: 30 }, { ate: 70, valor: 50 }, { ate: 150, valor: 90 }] }); };

  /* ---------- ficha do cliente, por secções ---------- */
  const vf0 = VIEWS.ficha;
  const prometH = f => { if (!f.prevista) return ''; const atr = f.prevista < TODAY() && ABERTOS.includes(f.estado); return `<span class="note" style="${atr ? 'color:var(--bad);font-weight:500' : ''}">Prometido ${fDY(f.prevista)}</span>`; };
  function linhaEspera(f) {
    const d = dias(f), l = loc(f);
    return `<div class="row" role="button" tabindex="0" data-act="ofiOpen" data-id="${f.id}"><span class="of-n">${f.numero}</span><span class="rt"><span class="r1">${esc(nomeEq(f))}${l ? ` <small style="color:var(--ink-3)">· ${esc(l.nome)}</small>` : ''}</span><span class="r2">${esc([cod(f), TIPO_C[f.tipo], f.avaria].filter(Boolean).join(' · '))}</span></span>
      <span class="rr">${badge(estL(f), EST_T[f.estado])}<span class="note" style="${d > 30 ? 'color:var(--bad);font-weight:500' : ''}">há ${d} d</span>${prometH(f)}</span></div>`;
  }
  VIEWS.ficha = () => {
    const e = ent(S.params.id); if (!e) return vf0();
    const tab = ['resumo', 'tarefas', 'locais', 'encomendas'].includes(S.params.tab) ? S.params.tab : 'resumo';
    const F0 = D('fichas').filter(f => f.entidade === e.id), asc = (a, b) => (a.entrada || '').localeCompare(b.entrada || '');
    const espera = F0.filter(f => f.tipo !== 'guarda' && ABERTOS.includes(f.estado)).sort(asc);
    const ativos = F0.filter(naCasa).sort(asc);
    const porFat = F0.filter(f => ['pronto', 'entregue'].includes(f.estado) && !f.faturado).sort(asc);
    const hist = F0.filter(f => f.faturado || f.estado === 'cancelado').sort(byEntrada);
    const tarefas = D('tarefas').filter(t => t.entidade === e.id && !t.feito);
    const LS = D('locais').filter(x => x.entidade === e.id).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
    const enc = D('encomendas').filter(x => x.entidade === e.id);
    const tel = e.telemovel || e.telefone, addr = [e.morada, e.cp, e.localidade].filter(Boolean).join(', ');
    const t = S.data.desl_tabelas.get(e.deslTabela);
    const tabs = [['resumo', 'Resumo'], ['tarefas', 'Tarefas', espera.length + tarefas.length], ['locais', 'Locais', LS.length], ['encomendas', 'Vendas', enc.length]];
    const pre = o => esc(JSON.stringify(Object.assign({ entidade: e.id }, o)));
    let h = `<div class="pg">${roBanner()}<div class="fh"><span class="av">${esc(initials(e.nome))}</span><div style="min-width:0;flex:1"><h1>${esc(e.nome)}</h1><div class="meta">${(e.tipos || []).map(k => badge(TIPOS[k] || k, 'gold')).join('')}${e.localidade ? badge(e.localidade) : ''}${ativos.length ? badge(ativos.length + ' na empresa', 'info') : ''}</div></div>${S.canWrite ? `<button class="btn sm" data-act="edit" data-col="entidades" data-id="${e.id}">${ic('edit', 16)}<span>Editar</span></button>` : ''}</div>
    <div class="acts"><a class="act ${tel ? '' : 'off'}" href="tel:${esc(telClean(tel))}">${ic('phone')}<span>Ligar</span></a><a class="act ${e.telemovel ? '' : 'off'}" href="https://wa.me/${esc(waNum(e.telemovel))}" target="_blank" rel="noopener">${ic('wa')}<span>WhatsApp</span></a><a class="act ${e.email ? '' : 'off'}" href="mailto:${esc(e.email || '')}">${ic('mail')}<span>Email</span></a><a class="act ${addr ? '' : 'off'}" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}" target="_blank" rel="noopener">${ic('pin')}<span>Mapa</span></a></div>
    ${S.canWrite ? `<div class="of-row2"><button class="btn sm" data-act="ofiNew" data-preset='${pre({ tipo: 'oficina' })}'>${ic('tool', 16)}Entrada na oficina</button><button class="btn sm" data-act="ofiNew" data-preset='${pre({ tipo: 'local' })}'>${ic('pin', 16)}Assistência fora</button><button class="btn sm" data-act="ofiNew" data-preset='${pre({ tipo: 'guarda', equipamento: 'Máquina completa' })}'>${ic('box', 16)}Guardar máquina</button><button class="btn sm" data-act="new" data-col="encomendas" data-preset='${pre({})}'>${ic('euro', 16)}Venda de peças</button></div>` : ''}
    <div class="tabs">${tabs.map(([k, l, n]) => `<button class="${tab === k ? 'on' : ''}" data-act="ftab" data-c="${k}">${l}${n ? `<i>${n}</i>` : ''}</button>`).join('')}</div>`;
    if (tab === 'resumo') {
      h += `<div class="panel"><div class="pb" style="padding-top:4px"><div class="kv">${[['Pessoa de contacto', e.contacto], ['Telemóvel', e.telemovel], ['Telefone', e.telefone], ['Email', e.email], ['NIF', e.nif], ['Morada', addr], ...(S.verValores ? [['Preço/hora', eur(e.precoHora ?? cfg().precoHora)], ['Deslocação', e.deslModo === 'escaloes' ? 'Escalões · ' + (t?.nome || 'sem tabela') : 'Por km · ' + eur(e.precoKm ?? cfg().precoKm) + '/km']] : [])].filter(x => x[1]).map(([l, x]) => `<div class="kvi"><span>${l}</span><b>${esc(x)}</b></div>`).join('')}</div>${e.notas ? `<div class="kvi"><span>Notas</span><b style="font-weight:400;white-space:pre-wrap">${esc(e.notas)}</b></div>` : ''}</div></div>
      <div class="panel"><div class="ph"><h2>Em espera</h2><span class="note">reparações e assistências pedidas · ${espera.length}</span></div>${espera.length ? espera.map(linhaEspera).join('') : '<div class="pb"><p class="note" style="margin:0">Nada em espera.</p></div>'}</div>
      <div class="panel"><div class="ph"><h2>Ativos na empresa</h2><span class="note">${ativos.length} ${ativos.length === 1 ? 'item' : 'itens'}</span></div>${ativos.length ? ativos.map(linhaEspera).join('') : '<div class="pb"><p class="note" style="margin:0">Este cliente não tem nada na empresa.</p></div>'}</div>
      <div class="panel"><div class="ph"><h2>Fechadas não faturadas</h2>${S.verValores && porFat.length ? `<b class="num">${eur(porFat.reduce((a, f) => a + valores(f).total, 0))}</b>` : `<span class="note">${porFat.length}</span>`}</div>${porFat.length ? porFat.map(fRow).join('') : '<div class="pb"><p class="note" style="margin:0">Tudo faturado.</p></div>'}</div>
      <div class="panel"><div class="ph"><h2>Histórico</h2><span class="note">${hist.length}</span></div>${hist.length ? hist.slice(0, S.ofHist === e.id ? 999 : 10).map(fRow).join('') + (hist.length > 10 && S.ofHist !== e.id ? `<div class="pb"><button class="btn sm" data-act="ofiHist" data-id="${e.id}">Ver as ${hist.length}</button></div>` : '') : '<div class="pb"><p class="note" style="margin:0">Sem histórico.</p></div>'}</div>`;
    }
    if (tab === 'tarefas') {
      h += `<div class="panel"><div class="ph"><h2>Fichas por concluir</h2><span class="note">${espera.length}</span></div>${espera.length ? espera.map(linhaEspera).join('') : '<div class="empty"><b>Nada por concluir</b></div>'}</div>`;
      if (tarefas.length) h += `<div class="panel"><div class="ph"><h2>Outras tarefas em aberto</h2></div>${tarefas.map(x => `<div class="row" role="button" tabindex="0" data-act="edit" data-col="tarefas" data-id="${x.id}"><span class="rt"><span class="r1">${esc(x.titulo)}</span><span class="r2">${x.data ? fDY(x.data) : ''}</span></span></div>`).join('')}</div>`;
    }
    if (tab === 'locais') {
      h += `${S.canWrite ? `<div><button class="btn sm" data-act="new" data-col="locais" data-preset='${pre({})}'>${ic('plus', 16)}Novo local</button></div>` : ''}<div class="panel">${LS.length ? LS.map(x => `<div class="row" role="button" tabindex="0" data-act="${S.canWrite ? 'edit' : 'noop'}" data-col="locais" data-id="${x.id}"><span class="rt"><span class="r1">${esc(x.nome)}</span><span class="r2">${esc([[x.morada, x.cp, x.localidade].filter(Boolean).join(', '), x.contacto, x.telefone].filter(Boolean).join(' · '))}</span></span><span class="rr">${x.lat == null ? badge('Sem coordenadas', 'warn') : ''}${badge(D('fichas').filter(f => f.local === x.id).length + ' fichas')}</span></div>`).join('') : '<div class="empty"><b>Sem locais</b>Registe os clientes deste cliente onde estão as máquinas.</div>'}</div>`;
    }
    if (tab === 'encomendas') {
      h += `${S.canWrite ? `<div><button class="btn sm" data-act="new" data-col="encomendas" data-preset='${pre({})}'>${ic('plus', 16)}Venda de peças / consumíveis</button></div>` : ''}${enc.length ? `<div class="panel">${enc.sort((a, b) => (b.data || '').localeCompare(a.data || '')).map(encRow).join('')}</div>` : '<div class="panel empty"><b>Sem vendas</b></div>'}`;
    }
    return h + '</div>';
  };
  ACT.ofiHist = d => { S.ofHist = d.id; render(); };

  /* ---------- Ativos dos clientes (o que cada cliente tem na empresa) ---------- */
  VIEWS.ativos = () => loadingOr(() => {
    const A = D('fichas').filter(naCasa), m = new Map();
    A.forEach(f => { if (!m.has(f.entidade)) m.set(f.entidade, []); m.get(f.entidade).push(f); });
    const q = norm(S.q.ativos || ''), asc = (a, b) => (a.entrada || '').localeCompare(b.entrada || '');
    let C = [...m.entries()].map(([id, L]) => ({ id, nome: entName(id), L: L.sort(asc) })).filter(c => !q || norm(c.nome).includes(q) || c.L.some(f => norm(nomeEq(f) + ' ' + cod(f) + ' ' + (f.nSerie || '')).includes(q)));
    C.sort((a, b) => b.L.length - a.L.length || a.nome.localeCompare(b.nome, 'pt'));
    const resumo = L => { const k = new Map(); L.forEach(f => { const n = f.equipamento || 'Outro'; k.set(n, (k.get(n) || 0) + 1); }); return [...k.entries()].map(([n, x]) => `${x} × ${n}`).join(' · '); };
    return `<div class="pg">${roBanner()}
      <div class="mini"><div><span>Clientes com material cá</span><b>${m.size}</b></div><div><span>Itens na empresa</span><b>${A.length}</b></div><div><span>Em guarda</span><b>${A.filter(f => f.tipo === 'guarda').length}</b></div><div><span>Em reparação / prontos</span><b>${A.filter(f => f.tipo === 'oficina').length}</b></div></div>
      <div class="tb"><div class="tbr"><label class="srch">${ic('search', 18)}<input id="q-ativos" data-q="ativos" type="search" placeholder="Cliente, equipamento, código ou n.º de série" value="${esc(S.q.ativos || '')}" autocomplete="off"></label>${S.canWrite ? `<button class="btn" data-act="ofiNew" data-preset='{"tipo":"guarda","equipamento":"Máquina completa"}'>${ic('box', 18)}<span>Guardar máquina</span></button>` : ''}</div></div>
      <p class="note" style="margin:0">Só aparecem clientes com alguma coisa na empresa (em reparação, pronta por levantar ou em guarda). Os dias contam desde a entrada, para a futura taxa de espaço.</p>
      ${C.length ? C.map(c => `<div class="panel"><div class="ph"><h2><a href="#" data-act="ofiCli" data-id="${c.id}" style="color:inherit;text-decoration:none">${esc(c.nome)}</a></h2><span class="note">${esc(resumo(c.L))}</span></div>${c.L.map(f => `<div class="row" role="button" tabindex="0" data-act="ofiOpen" data-id="${f.id}"><span class="of-n">${f.numero}</span><span class="rt"><span class="r1">${esc(nomeEq(f))}</span><span class="r2">${esc([cod(f), f.nSerie ? 'S/N ' + f.nSerie : '', 'entrou ' + fDY(f.entrada)].filter(Boolean).join(' · '))}</span></span><span class="rr">${badge(estL(f), EST_T[f.estado])}<span class="note" style="${dias(f) > 90 ? 'color:var(--bad);font-weight:500' : ''}">${dias(f)} d</span></span></div>`).join('')}</div>`).join('') : '<div class="panel empty"><b>Nenhum cliente tem material na empresa</b></div>'}
    </div>`;
  });
  ACT.ofiCli = d => go('ficha', { id: d.id });

  /* ---------- ações ---------- */
  const fx = id => S.data.fichas.get(id);
  ACT.ofiOpen = d => { S.ofPick = null; go('ofi', { id: d.id }); };
  ACT.ofiNew = d => { let p = null; try { p = d.preset ? JSON.parse(d.preset) : null; } catch (_) { } openForm('fichas', null, p); };
  ACT.ofiEdit = d => openForm('fichas', d.id);
  ACT.ofiLocalNovo = d => { const f = fx(d.id); if (!f) return; S.ofLocalPara = f.id; openForm('locais', null, { entidade: f.entidade }); };
  ACT.ofiGrupo = d => { S.f.oficina = 'eq:' + d.c; go('oficina'); };
  const new0 = ACT.new; ACT.new = (d, b, e) => { if (d.col === 'locais') S.ofLocalPara = null; return d.col === 'fichas' ? ACT.ofiNew(d) : new0(d, b, e); };
  ACT.quick = () => {
    const eid = S.view === 'ficha' ? S.params.id : null, pre = o => esc(JSON.stringify(Object.assign(eid ? { entidade: eid } : {}, o)));
    openSheet(`<div class="sh"><h2>Criar${eid ? ' para ' + esc(entName(eid)) : ''}</h2><button class="ib" data-act="close" aria-label="Fechar">${ic('x')}</button></div><div class="sb"><div class="mgrid">
      <button data-act="ofiNew" data-preset='${pre({ tipo: 'oficina' })}'>${ic('tool', 20)}<span>Entrada na oficina</span></button>
      <button data-act="ofiNew" data-preset='${pre({ tipo: 'local' })}'>${ic('pin', 20)}<span>Assistência no cliente</span></button>
      <button data-act="ofiNew" data-preset='${pre({ tipo: 'manutencao' })}'>${ic('repeat', 20)}<span>Manutenção</span></button>
      ${eid ? '' : `<button data-act="new" data-col="entidades">${ic('users', 20)}<span>Cliente</span></button>`}
      <button data-act="new" data-col="tarefas" ${eid ? `data-preset='${pre({})}'` : ''}>${ic('cal', 20)}<span>Tarefa</span></button>
      <button data-act="new" data-col="encomendas" ${eid ? `data-preset='${pre({})}'` : ''}>${ic('box', 20)}<span>Venda de peças / consumíveis</span></button>
    </div></div>`);
  };

  ACT.ofiEst = async d => {
    const f = fx(d.id); if (!f || f.estado === d.c) return; const p = { estado: d.c };
    if (d.c === 'pronto' && !f.prontoEm) p.prontoEm = new Date().toISOString();
    if (d.c === 'entregue') p.entregueEm = new Date().toISOString();
    if (['pronto', 'entregue'].includes(d.c) && aberto(f)) await paraCrono(f);
    if (await patch('fichas', f.id, p)) { toast(EST[d.c]); if (d.c === 'pronto' && !f.avisadoEm) setTimeout(() => ACT.ofiAviso({ id: f.id }), 200); if (d.c === 'entregue') setTimeout(() => ACT.ofiDocMenu({ id: f.id, c: 'entrega' }), 200); }
  };

  async function paraCrono(f) {
    const t = aberto(f); if (!t) return; const fim = new Date(), min = Math.max(1, Math.round((fim - new Date(t.inicio)) / 60000));
    await patch('fichas_tempos', t.id, { fim: fim.toISOString(), minutos: min }); await patch('fichas', f.id, { cronoInicio: null, cronoTipo: null });
  }
  async function iniciaCrono(f) {
    if (aberto(f)) return; const now = new Date().toISOString();
    await save('fichas_tempos', null, { ficha: f.id, tipo: 'trabalho', inicio: now, resp: S.uid || null });
    const p = { cronoInicio: now, cronoTipo: 'trabalho' }; if (f.estado === 'recebido') p.estado = fora(f) ? 'reparacao' : 'diagnostico';
    await patch('fichas', f.id, p);
  }
  ACT.ofiCrono = async (d, b) => { const f = fx(d.id); if (!f || !canAct()) return; b.disabled = true; if (aberto(f)) { await paraCrono(f); toast('Tempo parado'); } else { await iniciaCrono(f); toast('A contar o tempo'); } b.disabled = false; };

  ACT.ofiAqui = async (d, b) => {
    const f = fx(d.id); if (!f || !canAct()) return;
    if (!navigator.geolocation) return toast('Este telemóvel não dá a localização');
    b.disabled = true; toast('A obter a localização…');
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lng } = pos.coords; const r = await kmEstrada(lat, lng);
      await patch('fichas', f.id, { chegadaEm: new Date().toISOString(), chegadaLat: lat, chegadaLng: lng, km: r.km, deslValor: deslCalc(ent(f.entidade), r.km)?.valor ?? null });
      const l = loc(f), e = ent(f.entidade); if (l) { if (!l.lat || !l.lng) await patch('locais', l.id, { lat, lng }); } else if (e && (!e.lat || !e.lng)) await patch('entidades', e.id, { lat, lng });
      await iniciaCrono(fx(f.id)); b.disabled = false; toast(`${fmtKm(r.km)} km (${r.fonte}) · tempo a contar`);
    }, err => { b.disabled = false; toast(err.code === 1 ? 'Sem autorização para a localização. Escreva os km à mão.' : 'Não foi possível obter a localização'); }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
  };

  ACT.ofiTMan = async d => {
    const f = fx(d.id); if (!f || !canAct()) return; const h = parseInt($('#ofmh')?.value, 10) || 0, m = parseInt($('#ofmm')?.value, 10) || 0, min = h * 60 + m;
    if (min <= 0) return toast('Escreva as horas ou os minutos'); if (min > 24 * 60) return toast('Mais de 24 h numa linha? Confirme o tempo.');
    const dia = $('#ofmd')?.value || TODAY(), ini = new Date(dia + 'T09:00:00').toISOString(), fim = new Date(new Date(ini).getTime() + min * 60000).toISOString();
    if (await save('fichas_tempos', null, { ficha: f.id, tipo: 'manual', inicio: ini, fim, minutos: min, resp: $('#ofmr')?.value || S.uid || null, notas: 'Tempo escrito à mão' })) toast(fmtMin(min) + ' adicionados');
  };
  ACT.ofiTDel = async d => { const t = S.data.fichas_tempos.get(d.id); if (!t || !confirm(`Apagar este tempo (${fmtMin(t.minutos)})?`)) return; if (await remove('fichas_tempos', d.id)) toast('Tempo apagado'); };
  // peças
  ACT.ofiPick = d => { const f = fx(d.id); S.ofPick = { id: d.id, open: true, mod: f?.modelo || '', grp: '', q: '' }; render(); setTimeout(() => $('#ofpq')?.focus(), 50); };
  ACT.ofiPickX = () => { S.ofPick = null; render(); };
  async function poePeca(f, a, qt = 1, ref) {
    const L = clone(f.pecas || []);
    const x = a ? L.find(p => p.artigo === a.id) : L.find(p => !p.artigo && norm(p.ref) === norm(ref));
    if (x) x.qt = (+x.qt || 0) + qt; else L.push(a ? { artigo: a.id, nome: a.nome, ref: a.ref || '', qt, preco: +a.preco || 0 } : { artigo: null, nome: 'Peça ' + ref + ' (fora do catálogo)', ref, qt, preco: 0 });
    if (await patch('fichas', f.id, { pecas: L })) toast(`${qt} × ${a ? a.nome : ref}`);
  }
  const nref = r => String(r || '').replace(/[\s.\-]/g, '').toUpperCase();
  const porRef = ref => { const q = nref(ref); return D('artigos').find(a => a.ref && nref(a.ref) === q); };
  ACT.ofiPadd = async d => { const f = fx(d.id), a = S.data.artigos.get(d.a); if (f && a) await poePeca(f, a, 1); };
  ACT.ofiCod = async d => {
    const f = fx(d.id), inp = $('#ofcod'), ref = (inp?.value || '').trim(), qt = Math.max(1, parseInt($('#ofcodqt')?.value, 10) || 1); if (!f || !ref) return inp?.focus();
    const a = porRef(ref);
    if (!a) { if (!confirm(`O código ${ref} não está no catálogo. Pôr na ficha mesmo assim (sem preço)?`)) return; }
    else if (f.modelo && a.modelos && !servePara(a, f.modelo) && !confirm(`${a.nome} (${a.ref}) não aparece no catálogo do ${f.modelo}. Pôr mesmo assim?`)) return;
    await poePeca(f, a, qt, ref); const i2 = $('#ofcod'); if (i2) { i2.value = ''; i2.focus(); } const q2 = $('#ofcodqt'); if (q2) q2.value = 1;
  };
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target?.dataset?.ofcod) { e.preventDefault(); ACT.ofiCod({ id: e.target.dataset.ofcod }); } });

  // croqui: desenho do catálogo de peças com os números clicáveis
  const croquiUrl = p => /^https?:|^data:/.test(p) ? p : S.db.storage.from('croquis').getPublicUrl(p).data.publicUrl;
  const ptN = a => Array.isArray(a) ? { pos: String(a[0]), ref: a[1], xy: a[2] || [], nota: a[3] || '' } : { pos: String(a.pos), ref: a.ref, xy: a.x != null ? [[a.x, a.y]] : (a.xy || []), nota: a.nota || '' };
  S.cqImg = S.cqImg || {}; S.pdfDocs = S.pdfDocs || {};
  const manPecas = mod => D('manuais').filter(m => norm(m.modelo) === norm(mod) && m.tipo === 'pecas').sort((a, b) => (b.criado || '').localeCompare(a.criado || ''))[0];
  let pdfjsP = null;
  const pdfjs = () => pdfjsP || (pdfjsP = import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs').then(m => { m.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs'; return m; }));
  async function pdfDoc(man) {
    if (!S.pdfDocs[man.id]) S.pdfDocs[man.id] = (async () => { const { data, error } = await S.db.storage.from('manuais').createSignedUrl(man.ficheiro, 3600); if (error) throw error; const lib = await pdfjs(); return lib.getDocument(data.signedUrl).promise; })();
    return S.pdfDocs[man.id];
  }
  async function desenhaCroqui(c, f) {
    if (S.cqImg[c.id] || c.imagem || S.cqImg[c.id + ':a']) return; S.cqImg[c.id + ':a'] = 1;
    try {
      const man = manPecas(c.modelo); if (!man) return;
      const doc = await pdfDoc(man), page = await doc.getPage(c.pagina), [x0, y0, x1, y1] = c.crop || [0, 0, 595, 842];
      const k = 1400 / (x1 - x0), vp = page.getViewport({ scale: k }), cv = document.createElement('canvas');
      cv.width = Math.round((x1 - x0) * k); cv.height = Math.round((y1 - y0) * k);
      const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.translate(-x0 * k, -y0 * k);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      S.cqImg[c.id] = cv.toDataURL('image/jpeg', .85); render();
      if (S.canWrite) cv.toBlob(async b => { const path = `${c.id}.jpg`; const { error } = await S.db.storage.from('croquis').upload(path, b, { contentType: 'image/jpeg', upsert: true }); if (!error) patch('croquis', c.id, { imagem: path }); }, 'image/jpeg', .85);
    } catch (e) { console.warn('croqui', e); S.cqImg[c.id + ':erro'] = 1; render(); } finally { delete S.cqImg[c.id + ':a']; }
  }
  function croquiH(f, c) {
    if (!c) return '';
    const P = (c.pontos || []).map(ptN);
    const qtd = ref => { const a = porRef(ref); return (f.pecas || []).filter(p => (a && p.artigo === a.id) || nref(p.ref) === nref(ref)).reduce((s, p) => s + (+p.qt || 0), 0); };
    const src = S.cqImg[c.id] || (c.imagem ? croquiUrl(c.imagem) + (c.atualizado ? '?v=' + encodeURIComponent(c.atualizado) : '') : '');
    if (!src) setTimeout(() => desenhaCroqui(c, f), 0);
    const semImg = !src ? `<div class="pb"><p class="note" style="margin:0">${S.cqImg[c.id + ':erro'] ? 'Não foi possível abrir o desenho.' : manPecas(c.modelo) ? 'A preparar o desenho do catálogo…' : `Para ver o desenho, carregue o catálogo de peças do ${esc(c.modelo)} em «Manuais». A lista de números já funciona.`}</p></div>` : '';
    const zoom = S.ofZoom ? ' of-cq-zoom' : '';
    return `${src ? `<div class="of-row2" style="margin-top:8px"><button class="btn sm" data-act="ofiZoom">${S.ofZoom ? 'Desenho normal' : 'Ampliar desenho'}</button><span class="note">Toque num número para pôr a peça.</span></div><div class="of-cqw${zoom}"><div class="of-cq"><img src="${esc(src)}" alt="Desenho ${esc(c.grupo)}">${P.map(p => { const n = qtd(p.ref); return p.xy.map(([x, y]) => `<button class="of-pt ${n ? 'on' : ''}" style="left:${+x}%;top:${+y}%" data-act="ofiPos" data-id="${f.id}" data-c="${c.id}" data-p="${esc(p.pos)}" data-r="${esc(p.ref)}" title="${esc(p.ref)}">${esc(p.pos)}${n ? `<i>${n}</i>` : ''}</button>`).join(''); }).join('')}</div></div>` : semImg}
      <table class="tt" style="margin-top:8px"><tbody>${P.map(p => { const a = porRef(p.ref), n = qtd(p.ref); return `<tr data-act="ofiPos" data-id="${f.id}" data-c="${c.id}" data-p="${esc(p.pos)}" data-r="${esc(p.ref)}" style="cursor:pointer"><td style="width:42px"><b>${esc(p.pos)}</b></td><td>${esc(a?.nome || p.ref)}<br><small style="color:var(--ink-3)">${esc(p.ref)}${p.nota ? ' · ' + esc(p.nota) : ''}${p.xy.length ? '' : ' · sem posição no desenho'}</small></td><td class="num">${n ? badge(n + ' na ficha', 'ok') : ''}</td></tr>`; }).join('')}</tbody></table>`;
  }
  ACT.ofiZoom = () => { S.ofZoom = !S.ofZoom; render(); };
  ACT.ofiCroqui = d => { S.ofCroqui = S.ofCroqui === d.c ? null : d.c; render(); };
  const achaPt = d => { const c = S.data.croquis.get(d.c); if (!c) return {}; const p = (c.pontos || []).map(ptN).find(x => x.pos === String(d.p) && (!d.r || x.ref === d.r)); return { c, p }; };
  ACT.ofiPos = d => {
    const f = fx(d.id), { c, p } = achaPt(d); if (!f || !c || !p) return;
    const a = porRef(p.ref), n = (f.pecas || []).filter(x => (a && x.artigo === a.id) || nref(x.ref) === nref(p.ref)).reduce((s, x) => s + (+x.qt || 0), 0);
    openSheet(`<div class="sh"><h2>N.º ${esc(p.pos)} · ${esc(c.grupo)}</h2><button class="ib" data-act="close" aria-label="Fechar">${ic('x')}</button></div><div class="sb">
      <p style="margin:0 0 4px;font-size:17px"><b>${esc(a?.nome || 'Peça ' + p.ref)}</b></p><p class="note" style="margin:0 0 14px">Código ${esc(p.ref)}${p.nota ? ' · ' + esc(p.nota) : ''}${S.verValores && a?.preco != null ? ' · ' + eur(a.preco) : ''}${a ? '' : ' · não está no catálogo'}</p>
      <div class="of-row2"><span style="flex:1">Nesta assistência: <b>${n}</b></span>${S.canWrite ? `<button class="btn" data-act="ofiPosQ" data-id="${f.id}" data-c="${c.id}" data-p="${esc(p.pos)}" data-r="${esc(p.ref)}" data-q="-1" ${n ? '' : 'disabled'}>− 1</button><button class="btn pri" data-act="ofiPosQ" data-id="${f.id}" data-c="${c.id}" data-p="${esc(p.pos)}" data-r="${esc(p.ref)}" data-q="1">+ 1</button>` : ''}</div></div>`);
  };
  ACT.ofiPosQ = async d => {
    const f = fx(d.id), { c, p } = achaPt(d); if (!f || !p) return; const a = porRef(p.ref);
    if (+d.q > 0) await poePeca(f, a, 1, p.ref);
    else { const L = clone(f.pecas || []), i = L.findIndex(x => (a && x.artigo === a.id) || nref(x.ref) === nref(p.ref)); if (i >= 0) { L[i].qt = (+L[i].qt || 0) - 1; if (L[i].qt <= 0) L.splice(i, 1); await patch('fichas', f.id, { pecas: L }); } }
    ACT.ofiPos(d);
  };

  /* ---------- manuais da máquina ---------- */
  const TIPO_MAN = { pecas: 'Catálogo de peças', tecnico: 'Manual técnico', utilizador: 'Manual do utilizador', outro: 'Outro' };
  const tam = b => !b ? '' : b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.round(b / 1024) + ' KB';
  ACT.ofiManuais = d => {
    const mod = d.c || ''; const L = D('manuais').filter(m => !mod || norm(m.modelo) === norm(mod)).sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt'));
    openSheet(`<div class="sh"><h2>Manuais${mod ? ' · ' + esc(mod) : ''}</h2><button class="ib" data-act="close" aria-label="Fechar">${ic('x')}</button></div><div class="sb">
      ${L.length ? L.map(m => `<div class="of-pc"><span class="grow">${esc(m.titulo)}<small>${esc(TIPO_MAN[m.tipo] || m.tipo)}${m.tamanho ? ' · ' + tam(m.tamanho) : ''}</small></span><button class="btn sm" data-act="ofiManAbrir" data-id="${m.id}">${ic('dl', 16)}Abrir</button>${S.isAdmin ? `<button class="ib" data-act="ofiManDel" data-id="${m.id}" aria-label="Apagar manual">${ic('x', 14)}</button>` : ''}</div>`).join('') : `<p class="note">Ainda não há manuais${mod ? ' do ' + esc(mod) : ''}.</p>`}
      ${S.canWrite ? `<div style="border-top:1px solid var(--line);margin-top:14px;padding-top:14px"><div class="eyebrow" style="margin-bottom:8px">Carregar manual (PDF)</div><div class="fg">
        <div class="fld"><label for="mnmod">Modelo</label><input id="mnmod" value="${esc(mod)}" list="mnmodL"><datalist id="mnmodL">${modelosL().map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
        <div class="fld"><label for="mntipo">Tipo</label><select id="mntipo">${Object.entries(TIPO_MAN).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
        <div class="fld full"><label for="mntit">Título</label><input id="mntit" placeholder="Ex.: Catálogo de peças Brio 250"></div>
        <div class="fld full"><label for="mnfile">Ficheiro</label><input id="mnfile" type="file" accept="application/pdf,.pdf"></div></div>
        <button class="btn pri" data-act="ofiManUp">${ic('plus', 16)}Carregar</button><p class="note">O catálogo de peças é usado também para os desenhos (croquis) com os números.</p></div>` : ''}</div>`);
  };
  ACT.ofiManAbrir = async d => {
    const m = S.data.manuais.get(d.id); if (!m) return; const w = window.open('', '_blank');
    const { data, error } = await S.db.storage.from('manuais').createSignedUrl(m.ficheiro, 3600, { download: false });
    if (error || !data) { w?.close(); return toast('Não foi possível abrir o manual'); }
    if (w) w.location = data.signedUrl; else location.href = data.signedUrl;
  };
  ACT.ofiManUp = async (d, b) => {
    const file = $('#mnfile')?.files?.[0], mod = ($('#mnmod')?.value || '').trim(), tipo = $('#mntipo')?.value || 'tecnico', tit = ($('#mntit')?.value || '').trim() || file?.name?.replace(/\.pdf$/i, '');
    if (!file) return toast('Escolha o ficheiro PDF'); if (!mod) return toast('Escreva o modelo');
    b.disabled = true; toast('A carregar ' + tam(file.size) + '…');
    const path = `${mod.replace(/[^\w-]+/g, '_')}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
    const { error } = await S.db.storage.from('manuais').upload(path, file, { contentType: 'application/pdf' });
    if (error) { b.disabled = false; console.warn(error); return toast('Não foi possível carregar o ficheiro'); }
    await save('manuais', null, { modelo: mod, titulo: tit, tipo, ficheiro: path, tamanho: file.size });
    if (tipo === 'pecas') D('croquis').filter(c => norm(c.modelo) === norm(mod)).forEach(c => { delete S.cqImg[c.id + ':erro']; });
    toast('Manual carregado'); ACT.ofiManuais({ c: mod });
  };
  ACT.ofiManDel = async d => { const m = S.data.manuais.get(d.id); if (!m || !confirm(`Apagar o manual «${m.titulo}»?`)) return; if (await remove('manuais', m.id)) { S.db.storage.from('manuais').remove([m.ficheiro]); toast('Manual apagado'); ACT.ofiManuais({ c: m.modelo }); } };
  ACT.ofiPq = async d => { const f = fx(d.id); if (!f) return; const L = clone(f.pecas || []), i = +d.i; if (!L[i]) return; L[i].qt = (+L[i].qt || 0) + (+d.c); if (L[i].qt <= 0) L.splice(i, 1); await patch('fichas', f.id, { pecas: L }); };

  // fotos
  async function comprime(file) {
    try { const bmp = await createImageBitmap(file); const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)); const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); return await new Promise(ok => c.toBlob(b => ok(b || file), 'image/jpeg', .82)); } catch (_) { return file; }
  }
  ACT.ofiFotoDel = async d => { const f = fx(d.id); if (!f || !confirm('Apagar esta foto?')) return; const L = (f.fotos || []).slice(), [p] = L.splice(+d.i, 1); if (await patch('fichas', f.id, { fotos: L }) && p && !/^https?:/.test(p)) S.db.storage.from('fichas').remove([p]); };
  document.addEventListener('change', async e => {
    const t = e.target, ds = t.dataset || {};
    if (ds.ofifoto && t.files?.length) {
      if (!canAct()) return; const f = fx(ds.ofifoto); if (!f) return; toast('A enviar ' + t.files.length + (t.files.length > 1 ? ' fotos…' : ' foto…'));
      const novos = [];
      for (const file of t.files) { const blob = await comprime(file); const path = `${f.id}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`; const { error } = await S.db.storage.from('fichas').upload(path, blob, { contentType: 'image/jpeg', upsert: false }); if (error) { console.warn(error); toast('Não foi possível enviar a foto'); } else novos.push(path); }
      if (novos.length && await patch('fichas', f.id, { fotos: [...(fx(f.id).fotos || []), ...novos] })) toast(novos.length > 1 ? novos.length + ' fotos guardadas' : 'Foto guardada');
      t.value = ''; return;
    }
    if (ds.oftxt && S.canWrite) { await patch('fichas', ds.id, { [ds.oftxt]: t.value }); toast('Guardado'); return; }
    if (ds.oforc && S.canWrite) { await patch('fichas', ds.id, { [ds.oforc]: ds.oforc === 'orcValor' ? (t.value === '' ? null : parseFloat(t.value)) : t.value }); return; }
    if (ds.ofkm && S.canWrite) { const km = t.value === '' ? null : parseFloat(t.value), f = fx(ds.ofkm); await patch('fichas', f.id, { km, deslValor: km == null ? null : deslCalc(ent(f.entidade), km)?.valor ?? null }); toast('Km atualizados'); return; }
    if (ds.oflocal && S.canWrite) { await patch('fichas', ds.oflocal, { local: t.value || null }); toast(t.value ? 'Local escolhido' : 'Na morada do cliente'); return; }
    if (ds.offat && S.canWrite) { await patch('fichas', ds.offat, { faturado: t.checked }); return; }
    if (ds.ofp && S.ofPick) { S.ofPick[ds.ofp] = t.value; if (ds.ofp === 'mod') S.ofPick.grp = ''; render(); }
  });
  document.addEventListener('input', e => { const t = e.target; if (t.dataset?.ofp === 'q' && S.ofPick) { S.ofPick.q = t.value; render(); } });

  /* ---------- mensagens ao cliente ---------- */
  const assinOf = () => `\n\n${S.me?.name && !/mundicacau|geral@/i.test(S.me.name) ? S.me.name + ' · ' : ''}${cfg().empresa}`;
  function msgPronto(f) {
    const e = ent(f.entidade) || {};
    return { assunto: `${f.tipo === 'oficina' ? 'Pronto para levantar' : 'Assistência concluída'} · ficha ${cod(f)} · ${prop(f)}`, texto: `Olá${e.contacto ? ' ' + e.contacto : ''},\n\nInformamos que o trabalho da ficha ${cod(f)} (${nomeEq(f)}${f.nSerie ? ', n.º de série ' + f.nSerie : ''}) de ${prop(f)} está pronto${f.tipo === 'oficina' ? ' e pode ser levantado nas nossas instalações' : ''}. A fatura terá a referência ${cod(f)}.${f.trabalho ? '\n\nTrabalho realizado:\n' + f.trabalho : ''}\n\nObrigado pela preferência.${assinOf()}` };
  }
  function msgRelatorio(f) {
    const e = ent(f.entidade) || {}, v = valores(f), P0 = f.pecas || [];
    const t = [`Relatório de assistência · ficha ${cod(f)}`, '', `Cliente: ${e.nome || ''}`, ondeTxt(f) ? `Local: ${ondeTxt(f)}` : '', `Data: ${fDY(f.chegadaEm || TODAY())}`, `Equipamento: ${nomeEq(f)}${f.nSerie ? ' · n.º de série ' + f.nSerie : ''}`, f.resp ? `Técnico: ${nameOf(f.resp)}` : '', f.chegadaEm ? `Chegada: ${fD(f.chegadaEm)}` : '', `Tempo de trabalho: ${fmtMin(v.min)}${v.fmin && v.fmin !== Math.round(v.min) ? ` (a faturar: ${fmtMin(v.fmin)})` : ''}`, f.km != null ? `Deslocação: ${fmtKm(f.km)} km` : '', f.avaria ? `\nPedido: ${f.avaria}` : '', f.trabalho ? `\nTrabalho realizado:\n${f.trabalho}` : '', P0.length ? `\nPeças aplicadas:\n${P0.map(p => `- ${p.qt} × ${p.nome}${p.ref ? ' (' + p.ref + ')' : ''}`).join('\n')}` : '', (f.fotos || []).length ? `\nFotos: ${(f.fotos || []).map(fotoF).join('\n')}` : ''].filter(x => x !== '').join('\n');
    return { assunto: `Relatório de assistência · ficha ${cod(f)} · ${e.nome || ''}`, texto: t + `\n\nObrigado.${assinOf()}` };
  }
  function msgOrc(f) {
    const e = ent(f.entidade) || {}, val = f.orcValor ?? valores(f).total;
    return { assunto: `Orçamento · ficha ${cod(f)} · ${prop(f)}`, texto: `Olá${e.contacto ? ' ' + e.contacto : ''},\n\nSegue o orçamento para a ficha ${cod(f)} (${nomeEq(f)}${f.nSerie ? ', n.º de série ' + f.nSerie : ''}).\n\n${f.orcNotas ? f.orcNotas + '\n\n' : ''}Valor: ${eur(val)} + IVA.\n\nPedimos que nos confirme se podemos avançar com a reparação.${assinOf()}` };
  }
  function enviarSheet(f, m, titulo, nota, marca) {
    const e = ent(f.entidade) || {}, em = (String(e.email || '').match(/[^@\s;,]+@[^@\s;,]+\.[^@\s;,]+/) || [''])[0];
    const mail = `mailto:${em}?subject=${encodeURIComponent(m.assunto)}&body=${encodeURIComponent(m.texto)}`;
    const wa = `https://wa.me/${waNum(e.telemovel)}?text=${encodeURIComponent(m.texto)}`;
    openSheet(`<div class="sh"><h2>${esc(titulo)}</h2><button class="ib" data-act="close" aria-label="Fechar">${ic('x')}</button></div><div class="sb">
      <p class="note" style="margin-top:0">${esc(nota)}</p><pre style="white-space:pre-wrap;font:inherit;background:var(--surface-2);border-radius:10px;padding:12px;margin:0">${esc(m.texto)}</pre></div>
      <div class="sf"><span class="grow"></span><a class="btn ${em ? '' : 'off'}" ${em ? '' : 'style="opacity:.45;pointer-events:none"'} data-act="mailgo" data-ofmark="${marca}" data-id="${f.id}" href="${esc(mail)}">${ic('mail', 16)}Email${em ? '' : ' (sem email)'}</a><a class="btn pri" ${e.telemovel ? '' : 'style="opacity:.45;pointer-events:none"'} data-act="mailgo" data-ofmark="${marca}" data-id="${f.id}" href="${esc(wa)}" target="_blank" rel="noopener">${ic('wa', 16)}WhatsApp${e.telemovel ? '' : ' (sem telemóvel)'}</a></div>`);
  }
  ACT.ofiAviso = d => { const f = fx(d.id); if (!f) return; const rel = fora(f); enviarSheet(f, rel ? msgRelatorio(f) : msgPronto(f), rel ? 'Relatório ao cliente' : 'Avisar o cliente', 'Abre o email ou o WhatsApp com a mensagem já escrita. Reveja e carregue em enviar.', 'aviso'); };
  ACT.ofiOrc = d => { const f = fx(d.id); if (!f) return; enviarSheet(f, msgOrc(f), 'Enviar orçamento', 'Fica registado na ficha e no cliente quando carregar num dos botões.', 'orc'); };
  ACT.ofiOrcE = async d => { const f = fx(d.id); if (!f) return; const p = { orcEstado: d.c }; if (d.c === 'aceite' && f.estado === 'orcamento') p.estado = 'reparacao'; await patch('fichas', f.id, p); toast(d.c === 'aceite' ? 'Orçamento aceite' : 'Orçamento recusado'); };
  // os links do email/WhatsApp não passam pelo ACT: regista aqui o envio
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-ofmark]'); if (!a || !S.canWrite) return; const f = fx(a.dataset.id); if (!f) return;
    if (a.dataset.ofmark === 'aviso') patch('fichas', f.id, { avisadoEm: new Date().toISOString() });
    if (a.dataset.ofmark === 'doc-entrada') patch('fichas', f.id, { entradaDocEm: new Date().toISOString() });
    if (a.dataset.ofmark === 'doc-entrega') patch('fichas', f.id, { entregaDocEm: new Date().toISOString() });
    if (a.dataset.ofmark === 'orc') { const p = { orcEstado: 'enviado', orcEm: new Date().toISOString() }; if (f.orcValor == null) p.orcValor = Math.round(valores(f).total * 100) / 100; if (ABERTOS.includes(f.estado) && f.estado !== 'reparacao') p.estado = 'orcamento'; patch('fichas', f.id, p); }
  }, true);

  /* ---------- etiqueta com QR e proprietário ---------- */
  function loadQR() { return window.qrcode ? Promise.resolve() : new Promise((ok, ko) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js'; s.onload = ok; s.onerror = ko; document.head.appendChild(s); }); }
  ACT.ofiLabel = async d => {
    const f = fx(d.id); if (!f) return; const w = window.open('', '_blank'); if (!w) return toast('O navegador bloqueou a janela. Permita janelas para este site.');
    try { await loadQR(); } catch (_) { w.close(); return toast('Sem ligação para gerar o QR'); }
    const q = qrcode(0, 'M'); q.addData(urlF(f.id)); q.make(); const svg = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etiqueta ficha ${f.numero}</title><style>
      @page{size:62mm 40mm;margin:0}.n{white-space:nowrap}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#000}
      .e{width:62mm;height:40mm;padding:2.5mm;display:flex;gap:2.5mm;align-items:center;page-break-after:always}
      .q{width:30mm;height:30mm;flex:none}.q svg{width:100%;height:100%}
      .t{min-width:0;display:flex;flex-direction:column;gap:1mm}.p{font-weight:700;font-size:12pt;line-height:1.1;text-transform:uppercase;overflow-wrap:anywhere}
      .n{font-size:12pt;font-weight:700}.s{font-size:7.5pt;line-height:1.2}.m{font-size:7pt;letter-spacing:.08em;color:#333}
      @media screen{body{background:#eee;padding:20px}.e{background:#fff;margin:0 auto 10px;box-shadow:0 1px 4px rgba(0,0,0,.2)}.b{text-align:center;font:14px Arial;margin:14px}}
      @media print{.b{display:none}}</style></head><body>
      <div class="e"><div class="q">${svg}</div><div class="t"><div class="p">${esc(prop(f))}</div><div class="n">${esc(cod(f))}</div><div class="s">${esc(nomeEq(f))}${f.nSerie ? '<br>S/N ' + esc(f.nSerie) : ''}</div><div class="s">Entrada ${fDY(f.entrada)}</div><div class="m">${esc(cfg().empresa.toUpperCase())}</div></div></div>
      <div class="b">Etiqueta 62 × 40 mm · <button onclick="print()">Imprimir</button></div>
      <script>setTimeout(()=>print(),400)<\/script></body></html>`);
    w.document.close();
  };


  /* ---------- documentos: comprovativo de entrada e guia de entrega ---------- */
  P.doc = P.doc || 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6';
  const nota = f => `Guarde esta referência: ${cod(f)}. É a mesma que vai aparecer na fatura.`;
  function linhasDoc(f, tipo) {
    const e = ent(f.entidade) || {}, v = valores(f), L = [];
    L.push(['Referência', cod(f)], ['Cliente', e.nome || ''], ...(fora(f) && loc(f) ? [['Local', ondeTxt(f)]] : []), ...(f.proprietario && f.proprietario !== e.nome ? [['Proprietário', f.proprietario]] : []), ['Equipamento', nomeEq(f)], ...(f.nSerie ? [['N.º de série', f.nSerie]] : []));
    if (tipo === 'entrada') L.push(['Data de entrada', fD(f.entrada)], ['Avaria / pedido', f.avaria || '—'], ...(f.prevista ? [['Data prevista', fDY(f.prevista)]] : []));
    else L.push(['Data de entrada', fDY(f.entrada)], [f.tipo === 'oficina' ? 'Data de entrega' : 'Data do serviço', fDY(f.entregueEm || f.chegadaEm || new Date().toISOString())], ...(f.avaria ? [['Pedido', f.avaria]] : []), ...(f.trabalho ? [['Trabalho realizado', f.trabalho]] : []), ['Tempo de trabalho', fmtMin(v.min) + (v.fmin && v.fmin !== Math.round(v.min) ? ` (a faturar: ${fmtMin(v.fmin)})` : '')], ...(fora(f) && f.km != null ? [['Deslocação', fmtKm(f.km) + ' km']] : []));
    return L;
  }
  function textoDoc(f, tipo) {
    const P0 = f.pecas || [], L = linhasDoc(f, tipo);
    const titulo = tipo === 'entrada' ? 'Comprovativo de entrada' : (f.tipo === 'oficina' ? 'Guia de entrega' : 'Folha de serviço');
    let t = `${titulo} · ${cod(f)}\n\n` + L.map(([a, b]) => `${a}: ${b}`).join('\n');
    if (tipo !== 'entrada' && P0.length) t += `\n\nPeças aplicadas:\n${P0.map(p => `- ${p.qt} × ${p.nome}${p.ref ? ' (' + p.ref + ')' : ''}`).join('\n')}`;
    t += `\n\n${nota(f)}${tipo !== 'entrada' ? ' A fatura segue depois.' : ''}${assinOf()}`;
    return { assunto: `${titulo} · ${cod(f)} · ${prop(f)}`, texto: t };
  }
  ACT.ofiDocMenu = d => {
    const f = fx(d.id); if (!f) return; const tipo = d.c, titulo = tipo === 'entrada' ? 'Comprovativo de entrada' : (f.tipo === 'oficina' ? 'Guia de entrega' : 'Folha de serviço');
    const m = textoDoc(f, tipo), e = ent(f.entidade) || {}, em = (String(e.email || '').match(/[^@\s;,]+@[^@\s;,]+\.[^@\s;,]+/) || [''])[0];
    openSheet(`<div class="sh"><h2>${titulo}</h2><button class="ib" data-act="close" aria-label="Fechar">${ic('x')}</button></div><div class="sb">
      <p class="note" style="margin-top:0">${tipo === 'entrada' ? 'Entregue ao cliente quando deixa o material. Leva a referência que depois aparece na fatura.' : 'O cliente leva isto quando levanta: diz o que foi feito e que peças levou. A fatura segue depois com a mesma referência.'}</p>
      <pre style="white-space:pre-wrap;font:inherit;background:var(--surface-2);border-radius:10px;padding:12px;margin:0">${esc(m.texto)}</pre></div>
      <div class="sf"><button class="btn" data-act="ofiDoc" data-id="${f.id}" data-c="${tipo}">${ic('print', 16)}Imprimir</button><span class="grow"></span>
      <a class="btn" ${em ? '' : 'style="opacity:.45;pointer-events:none"'} data-act="mailgo" data-ofmark="doc-${tipo}" data-id="${f.id}" href="${esc(`mailto:${em}?subject=${encodeURIComponent(m.assunto)}&body=${encodeURIComponent(m.texto)}`)}">${ic('mail', 16)}Email</a>
      <a class="btn pri" ${e.telemovel ? '' : 'style="opacity:.45;pointer-events:none"'} data-act="mailgo" data-ofmark="doc-${tipo}" data-id="${f.id}" href="${esc(`https://wa.me/${waNum(e.telemovel)}?text=${encodeURIComponent(m.texto)}`)}" target="_blank" rel="noopener">${ic('wa', 16)}WhatsApp</a></div>`);
  };
  ACT.ofiDoc = async d => {
    const f = fx(d.id); if (!f) return; const tipo = d.c, w = window.open('', '_blank'); if (!w) return toast('O navegador bloqueou a janela. Permita janelas para este site.');
    let qr = ''; try { await loadQR(); const q = qrcode(0, 'M'); q.addData(urlF(f.id)); q.make(); qr = q.createSvgTag({ cellSize: 3, margin: 0, scalable: true }); } catch (_) { }
    const titulo = tipo === 'entrada' ? 'Comprovativo de entrada' : (f.tipo === 'oficina' ? 'Guia de entrega' : 'Folha de serviço'), P0 = f.pecas || [];
    let logo = new URL('logo.png', location.href).href; try { const bl = await (await fetch(logo)).blob(); logo = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(bl); }); } catch (_) { }
    const assin = tipo === 'entrada' ? ['Entregue pelo cliente', 'Recebido por ' + esc(cfg().empresa)] : ['Entregue por ' + esc(cfg().empresa), 'Recebido pelo cliente'];
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${titulo} ${esc(cod(f))}</title><style>
      @page{size:A4;margin:16mm}body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:11pt;margin:0}
      .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #2F4F94;padding-bottom:10px}
      .top img{height:56px}.ref{text-align:right}.ref b{display:block;font-size:20pt;color:#2F4F94;letter-spacing:.02em}.ref span{font-size:9pt;color:#555}
      h1{font-size:15pt;margin:18px 0 10px}.qr{width:26mm;height:26mm;margin-top:6px;margin-left:auto}.qr svg{width:100%;height:100%}
      table{width:100%;border-collapse:collapse}td{padding:6px 4px;border-bottom:1px solid #ddd;vertical-align:top}td:first-child{width:34%;color:#555}
      td.pre{white-space:pre-wrap}h2{font-size:12pt;margin:18px 0 6px}.nota{margin-top:18px;padding:10px 12px;background:#EEF4FB;border-left:4px solid #0090E0;font-size:10.5pt}
      .ass{display:flex;gap:30px;margin-top:46px}.ass div{flex:1;border-top:1px solid #333;padding-top:6px;font-size:9.5pt;color:#444}
      @media screen{body{background:#eee}.pg{background:#fff;max-width:190mm;margin:20px auto;padding:16mm;box-shadow:0 1px 6px rgba(0,0,0,.2)}.b{text-align:center;margin:10px}}@media print{.b{display:none}}</style></head><body>
      <div class="b"><button onclick="print()">Imprimir</button></div><div class="pg">
      <div class="top"><img src="${esc(logo)}" alt=""><div class="ref"><span>Referência</span><b>${esc(cod(f))}</b>${qr ? `<div class="qr">${qr}</div>` : ''}</div></div>
      <h1>${titulo}</h1>
      <table>${linhasDoc(f, tipo).map(([a, b]) => `<tr><td>${esc(a)}</td><td class="pre">${esc(b)}</td></tr>`).join('')}</table>
      ${tipo !== 'entrada' && P0.length ? `<h2>Peças aplicadas</h2><table>${P0.map(p => `<tr><td>${esc(p.ref || '')}</td><td>${esc(p.nome)} · ${esc(String(p.qt).replace('.', ','))} un</td></tr>`).join('')}</table>` : ''}
      <div class="nota">${esc(nota(f))}${tipo !== 'entrada' ? ' A fatura segue depois.' : ''}</div>
      <div class="ass"><div>${assin[0]}</div><div>${assin[1]}</div></div></div>
      <script>window.onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`);
    w.document.close();
    patch('fichas', f.id, tipo === 'entrada' ? { entradaDocEm: new Date().toISOString() } : { entregaDocEm: new Date().toISOString() });
  };


  /* ---------- PDF das fichas (com preços só para o administrador) ---------- */
  function pagFicha(f, precos, logo) {
    const e = ent(f.entidade) || {}, v = valores(f), P0 = f.pecas || [], tipoT = f.tipo === 'oficina' ? 'Ficha de reparação' : f.tipo === 'guarda' ? 'Ficha de guarda' : f.tipo === 'manutencao' ? 'Ficha de manutenção' : 'Ficha de assistência';
    const L = linhasDoc(f, 'entrega').filter(([a]) => a !== 'Referência');
    const T = tempos(f).filter(t => t.fim).sort((a, b) => (a.inicio || '').localeCompare(b.inicio || ''));
    return `<section class="pg"><div class="top"><img src="${esc(logo)}" alt=""><div class="ref"><span>${tipoT}</span><b>${esc(cod(f))}</b><span>${esc(estL(f))}${f.faturado ? ' · faturada' : ''}</span></div></div>
      <table>${L.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="pre">${esc(b)}</td></tr>`).join('')}${f.diagnostico ? `<tr><td>Diagnóstico</td><td class="pre">${esc(f.diagnostico)}</td></tr>` : ''}</table>
      ${T.length ? `<h2>Tempos</h2><table>${T.map(t => `<tr><td>${t.tipo === 'manual' ? esc(fDY(t.inicio)) + ' (manual)' : esc(fD(t.inicio))}${t.resp ? ' · ' + esc(nameOf(t.resp)) : ''}</td><td class="r">${esc(fmtMin(t.minutos))}</td></tr>`).join('')}<tr><td><b>Total</b></td><td class="r"><b>${esc(fmtMin(v.min))}</b>${v.fmin ? ` · a faturar ${esc(fmtMin(v.fmin))}` : ''}</td></tr></table>` : ''}
      ${P0.length ? `<h2>Peças aplicadas</h2><table><tr class="h"><td>Código</td><td>Peça</td><td class="r">Qt</td>${precos ? '<td class="r">Preço</td><td class="r">Total</td>' : ''}</tr>${P0.map(p => `<tr><td>${esc(p.ref || '')}</td><td>${esc(p.nome)}</td><td class="r">${esc(String(p.qt).replace('.', ','))}</td>${precos ? `<td class="r">${eur(p.preco)}</td><td class="r">${eur((+p.qt || 0) * (+p.preco || 0))}</td>` : ''}</tr>`).join('')}</table>` : ''}
      ${precos ? `<h2>Valores (sem IVA)</h2><table><tr><td>Mão de obra · ${esc(fmtMin(v.fmin))} × ${eur(precoH(f))}/h</td><td class="r">${eur(v.mo)}</td></tr>${fora(f) ? `<tr><td>Deslocação${v.desl ? ' · ' + esc(v.desl.txt) : ''}</td><td class="r">${eur(v.desl?.valor || 0)}</td></tr>` : ''}<tr><td>Peças</td><td class="r">${eur(v.pc)}</td></tr><tr><td><b>Total sem IVA</b></td><td class="r"><b>${eur(v.total)}</b></td></tr></table>` : ''}
      <div class="nota">${esc(nota(f))}</div>
      ${precos ? '' : '<div class="ass"><div>Técnico</div><div>Cliente</div></div>'}</section>`;
  }
  async function abrirPdf(L, precos, titulo) {
    if (precos && !S.verValores) precos = false;
    const w = window.open('', '_blank'); if (!w) return toast('O navegador bloqueou a janela. Permita janelas para este site.');
    let logo = new URL('logo.png', location.href).href; try { const bl = await (await fetch(logo)).blob(); logo = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(bl); }); } catch (_) { }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
      @page{size:A4;margin:14mm}body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:10.5pt;margin:0}
      .pg{page-break-after:always}.pg:last-child{page-break-after:auto}
      .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #2F4F94;padding-bottom:8px;margin-bottom:12px}.top img{height:50px}
      .ref{text-align:right}.ref b{display:block;font-size:18pt;color:#2F4F94}.ref span{display:block;font-size:9pt;color:#555}
      table{width:100%;border-collapse:collapse}td{padding:5px 4px;border-bottom:1px solid #ddd;vertical-align:top}td:first-child{color:#555;width:32%}tr.h td{font-weight:700;color:#111;border-bottom:1.5px solid #999}
      td.pre{white-space:pre-wrap}.r{text-align:right;white-space:nowrap}h2{font-size:11.5pt;margin:14px 0 4px}
      .nota{margin-top:14px;padding:8px 10px;background:#EEF4FB;border-left:4px solid #0090E0;font-size:9.5pt}.ass{display:flex;gap:30px;margin-top:40px}.ass div{flex:1;border-top:1px solid #333;padding-top:6px;font-size:9pt;color:#444}
      @media screen{body{background:#eee}.pg{background:#fff;max-width:190mm;margin:16px auto;padding:14mm;box-shadow:0 1px 6px rgba(0,0,0,.2)}.b{text-align:center;margin:10px;font:14px Arial}}@media print{.b{display:none}}</style></head><body>
      <div class="b">${L.length} ficha${L.length > 1 ? 's' : ''} · ${precos ? 'com preços (uso interno)' : 'sem preços'} · <button onclick="print()">Guardar em PDF / Imprimir</button></div>
      ${L.map(f => pagFicha(f, precos, logo)).join('')}
      <script>window.onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`);
    w.document.close();
  }
  ACT.ofiPdfLote = d => { const cli = $('#offcli')?.value || ''; const L = D('fichas').filter(f => ['pronto', 'entregue'].includes(f.estado) && !f.faturado && (!cli || f.entidade === cli)).sort((a, b) => a.numero - b.numero); if (!L.length) return toast('Sem fichas'); abrirPdf(L, d.c === '1', `Fichas ${cli ? entName(cli) + ' ' : ''}${TODAY()}`); };
  ACT.ofiPdfUm = d => {
    const f = fx(d.id); if (!f) return; if (!S.verValores) return abrirPdf([f], false, 'Ficha ' + cod(f));
    openSheet(`<div class="sh"><h2>PDF da ficha ${esc(cod(f))}</h2><button class="ib" data-act="close" aria-label="Fechar">${ic('x')}</button></div><div class="sb"><p class="note" style="margin-top:0">No ecrã de impressão escolha «Guardar como PDF».</p><div class="mgrid">
      <button data-act="ofiPdfSel" data-id="${f.id}" data-c="1">${ic('euro', 20)}<span>Com preços (interno)</span></button>
      <button data-act="ofiPdfSel" data-id="${f.id}" data-c="0">${ic('doc', 20)}<span>Sem preços (para o cliente)</span></button></div></div>`);
  };
  ACT.ofiPdfSel = d => { closeSheet(); const f = fx(d.id); if (f) abrirPdf([f], d.c === '1', 'Ficha ' + cod(f)); };

  /* ---------- exportar para faturar (CSV que abre no Excel) ---------- */
  ACT.ofiExport = () => {
    const cli = $('#offcli')?.value || ''; const L = D('fichas').filter(f => ['pronto', 'entregue'].includes(f.estado) && !f.faturado && (!cli || f.entidade === cli)).sort((a, b) => a.numero - b.numero); if (!L.length) return toast('Nada por faturar');
    const c = v => { v = String(v ?? ''); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }, n = x => (Math.round((+x || 0) * 100) / 100).toString().replace('.', ',');
    const rows = [['Ficha (referência na fatura)', 'Data', 'Cliente', 'NIF', 'Referência', 'Descrição', 'Quantidade', 'Preço unitário s/ IVA', 'IVA %', 'Total s/ IVA']];
    L.forEach(f => {
      const e = ent(f.entidade) || {}, v = valores(f), dt = (f.entregueEm || f.prontoEm || f.entrada || '').slice(0, 10), base = [cod(f), dt, e.nome || '', e.nif || ''];
      const desc = `Ficha ${cod(f)} · ${nomeEq(f)}${f.nSerie ? ' S/N ' + f.nSerie : ''}`;
      if (v.fmin > 0) rows.push([...base, 'MO', 'Mão de obra · ' + desc, n(v.fmin / 60), n(precoH(f)), 23, n(v.mo)]);
      if (v.desl) rows.push([...base, 'DESL', 'Deslocação · ' + v.desl.txt, 1, n(v.desl.valor), 23, n(v.desl.valor)]);
      (f.pecas || []).forEach(p => rows.push([...base, p.ref || '', p.nome, n(p.qt), n(p.preco), 23, n(p.qt * p.preco)]));
      if (f.orcValor != null && f.orcEstado === 'aceite' && !v.min && !(f.pecas || []).length) rows.push([...base, 'ORC', 'Reparação conforme orçamento · ' + desc, 1, n(f.orcValor), 23, n(f.orcValor)]);
    });
    const blob = new Blob(['﻿' + rows.map(r => r.map(c).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `faturar-${TODAY()}.csv`; document.body.appendChild(a); a.click(); a.remove();
    openSheet(`<div class="sh"><h2>Ficheiro exportado</h2><button class="ib" data-act="close" aria-label="Fechar">${ic('x')}</button></div><div class="sb"><p>${L.length} fichas no ficheiro <b>faturar-${TODAY()}.csv</b>.</p><p class="note">Depois de lançar no Sage, marque-as como faturadas para não saírem no próximo ficheiro.</p></div><div class="sf"><span class="grow"></span><button class="btn" data-act="close">Agora não</button><button class="btn pri" data-act="ofiFatAll" data-ids="${L.map(f => f.id).join(',')}">Marcar como faturadas</button></div>`);
  };
  ACT.ofiFatAll = async d => { for (const id of d.ids.split(',')) await patch('fichas', id, { faturado: true }); closeSheet(); toast('Marcadas como faturadas'); };

  /* ---------- relógio e QR lido pela câmara ---------- */
  setInterval(() => { const el = document.getElementById('ofcrono'); if (!el || !el.dataset.ini) return; const s = Math.max(0, Math.floor((Date.now() - new Date(el.dataset.ini)) / 1000)); el.textContent = pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60); }, 1000);
  const abreHash = () => { const m = location.hash.match(/^#f=([0-9a-f-]{36})$/); if (!m) return; let n = 0; const t = () => { if (S.uid && S.ready.fichas) { history.replaceState(null, '', location.pathname); go('ofi', { id: m[1] }); } else if (n++ < 300) setTimeout(t, 300); }; t(); };
  window.addEventListener('hashchange', abreHash); abreHash();
};
