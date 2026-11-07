/* Mundicacau · Oficina e assistências
   Fichas de entrada (oficina), assistências no cliente e manutenções: fotos, etiqueta QR com o proprietário,
   estados, cronómetro, deslocação com GPS ("Estou aqui"), peças filtradas pelo modelo e grupo da máquina,
   orçamento opcional, avisos ao cliente (email e WhatsApp), agrupamento de trabalhos iguais,
   rota do dia (do mais longe para o mais perto) e exportação para faturar. */
window.OFI_INIT = function () {
  const NOVAS = ['tecnicos', 'tempos_padrao', 'kits', 'planos', 'manuais', 'croquis', 'locais', 'fichas', 'fichas_tempos', 'modelos', 'desl_tabelas', 'oficina_config'];
  NOVAS.forEach(c => { if (!COLS.includes(c)) COLS.push(c); S.data[c] = new Map(); });

  const EST = { recebido: 'Recebido', diagnostico: 'Em diagnóstico', orcamento: 'Orçamento enviado', aguarda_peca: 'À espera de peça', reparacao: 'Em reparação', pronto: 'Pronto', entregue: 'Entregue', cancelado: 'Cancelado' };
  const EST_T = { recebido: 'info', diagnostico: 'warn', orcamento: 'gold', aguarda_peca: 'bad', reparacao: 'warn', pronto: 'ok', entregue: 'mute', cancelado: 'mute' };
  const TIPO = { oficina: 'Oficina (entrou cá)', guarda: 'Guarda (só armazenamento)', local: 'Assistência no cliente', manutencao: 'Manutenção', reparacao: 'Reparação no cliente' };
  const TIPO_C = { oficina: 'Oficina', guarda: 'Guarda', local: 'No cliente', manutencao: 'Manutenção', reparacao: 'Reparação' };
  const EQUIP = ['Máquina completa', 'Caldeira', 'Grupo café Z2000', 'Grupo café Z3000', 'Moinho doseador', 'Módulo copos', 'Placa eletrónica', 'Moedeiro / sistema de pagamento', 'Bomba', 'Misturador', 'Distribuidor de copos'];
  const ABERTOS = ['recebido', 'diagnostico', 'orcamento', 'aguarda_peca', 'reparacao'];
  const fora = f => ['local', 'manutencao', 'reparacao'].includes(f.tipo);
  const naCasa = f => ['oficina', 'guarda'].includes(f.tipo) && !['entregue', 'cancelado'].includes(f.estado);
  const ESPERA = ['recebido', 'aguarda_peca', 'orcamento'], CURSO = ['diagnostico', 'reparacao'];
  const estL = f => f.tipo === 'guarda' && f.estado === 'recebido' ? 'Guardado' : EST[f.estado] || f.estado;
  /* ---------- módulos por plano ---------- */
  const MODS = [
    ['fora', 'Assistências fora', 'Trabalhos no cliente, «Estou aqui», km, locais e rota do dia'],
    ['ativos', 'Ativos e guarda de máquinas', 'O que cada cliente tem na empresa e máquinas só guardadas'],
    ['stock', 'Stock de peças', 'Baixa automática pelas fichas, stock mínimo e lista de encomenda'],
    ['garantias', 'Máquinas e garantias', 'Histórico por n.º de série, garantia e aviso de retrabalho'],
    ['link', 'Link do cliente', 'O cliente acompanha a reparação e aceita o orçamento'],
    ['planeamento', 'Planear trabalho', 'Lotes, tempos médios, kits e peças a preparar'],
    ['rendimento', 'Rendimento dos técnicos', 'Faturação por técnico e tempos'],
    ['croquis', 'Croquis das peças', 'Desenhos do catálogo com os números clicáveis'],
    ['sage', 'Integração Sage', 'Ficheiro para faturar no Sage', 'integra'],
    ['avisos', 'Avisos automáticos', 'Email e WhatsApp enviados pelo servidor', 'integra']];
  const PLANOS = { base: ['Base', []], profissional: ['Profissional', ['fora', 'ativos', 'stock', 'garantias', 'link']], empresa: ['Empresa', MODS.map(m => m[0])] };
  const temMod = k => (cfg().modulos || {})[k] !== false;
  const VMOD = { rotaof: 'fora', ativos: 'ativos', encomendarp: 'stock', stock: 'stock', equip: 'garantias', equipum: 'garantias', planear: 'planeamento', tempos: 'planeamento', tecnicosof: 'rendimento' };
  SO_VALORES.push('modulos');
  window.MODV = v => !VMOD[v] || temMod(VMOD[v]);
  const cfg = () => S.data.oficina_config.get(1) || { empresa: 'Mundicacau', precoHora: 30, precoKm: 0.4, idaVolta: true, baseLat: 41.19025117241961, baseLng: -8.450665245494452 };
  const prop = f => f.proprietario || entName(f.entidade);
  const loc = f => f.local ? S.data.locais.get(f.local) : null;
  const ondeXY = f => { const l = loc(f); if (l && l.lat && l.lng) return { lat: l.lat, lng: l.lng }; const e = ent(f.entidade); return e && e.lat && e.lng ? { lat: e.lat, lng: e.lng } : null; };
  const ondeTxt = f => { const l = loc(f); return l ? [l.nome, [l.morada, l.cp, l.localidade].filter(Boolean).join(', ')].filter(Boolean).join(' · ') : ''; };
  const cod = f => f.codigo || (f.numero ? 'MC-' + String(f.numero).padStart(4, '0') : 'Nova · por enviar');
  const nomeEq = f => [f.equipamento, f.modelo ? ((f.marca ? f.marca + ' ' : '') + f.modelo) : ''].filter(Boolean).join(' · ');
  const fmtMin = m => { m = Math.round(m || 0); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + pad(m % 60) + ' min'; };
  const fmtKm = k => (+k || 0).toLocaleString('pt-PT', { maximumFractionDigits: 1 });
  const dias = f => Math.max(0, diffDays(TODAY(), (f.entrada || TODAY()).slice(0, 10)));
  const urlF = id => location.origin + location.pathname + '#f=' + id;
  // fotos privadas: links temporários pedidos ao servidor e guardados por 1 hora
  const URLS = new Map(), PEND = new Set(); let urlT = null;
  function fotoF(p) {
    if (!p || /^https?:|^data:|^blob:/.test(p)) return p || ''; const lb = window.OFF?.blob(p); if (lb) return lb; const c = URLS.get(p); if (navigator.onLine === false) return (c && c.url) || `${CFG.url}/storage/v1/object/sign/fichas/${p}`; if (c && c.exp > Date.now() + 60000) return c.url;
    PEND.add(p); clearTimeout(urlT); urlT = setTimeout(pedeUrls, 30); return '';
  }
  async function pedeUrls() {
    const L = [...PEND]; PEND.clear(); if (!L.length || !S.db || navigator.onLine === false) return;
    const { data } = await S.db.storage.from('fichas').createSignedUrls(L, 3600);
    (data || []).forEach(x => { if (!x.signedUrl) return; URLS.set(x.path, { url: x.signedUrl, exp: Date.now() + 3500e3 }); document.querySelectorAll('[data-foto]').forEach(el => { if (el.dataset.foto !== x.path) return; if (el.tagName === 'IMG') el.src = x.signedUrl; else el.href = x.signedUrl; }); });
  }
  async function urlsLongas(paths, seg = 7 * 86400) { const L = (paths || []).filter(p => p && !/^https?:|^data:/.test(p)); if (!L.length) return {}; const { data } = await S.db.storage.from('fichas').createSignedUrls(L, seg); const m = {}; (data || []).forEach(x => { if (x.signedUrl) m[x.path] = x.signedUrl; }); return m; }
  const imgF = (p, alt, extra = '') => { const u = fotoF(p); return `<img data-foto="${esc(p)}" ${u ? `src="${esc(u)}"` : ''} alt="${esc(alt)}" ${extra}>`; };

  /* ---------- catálogo: modelos, grupos e peças ---------- */
  const splitM = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
  const modelosL = () => { const s = new Set(D('modelos').map(m => m.nome)); D('artigos').forEach(a => splitM(a.modelos).forEach(x => s.add(x))); D('fichas').forEach(f => f.modelo && s.add(f.modelo)); return [...s].sort((a, b) => a.localeCompare(b, 'pt')); };
  const isPeca = a => (a.peca || a.familia === 'Peças') && a.ativo !== false && !a.oculto;
  const servePara = (a, mod) => !mod || splitM(a.modelos).some(x => norm(x) === norm(mod));
  const grupoOk = (a, grp) => { if (!grp) return true; const g = norm(a.grupoPeca), q = norm(grp); return !!g && (g.includes(q) || q.includes(g)); };
  const pecasDe = (mod, grp) => D('artigos').filter(a => isPeca(a) && servePara(a, mod) && grupoOk(a, grp));
  const gruposDe = mod => { const s = new Set(); D('artigos').filter(a => isPeca(a) && servePara(a, mod)).forEach(a => a.grupoPeca && s.add(a.grupoPeca)); return [...s].sort((a, b) => a.localeCompare(b, 'pt')); };

  /* ---------- valores ---------- */
  let TIDX = null;
  const tidx = () => { if (!TIDX) { TIDX = new Map(); D('fichas_tempos').forEach(t => { if (!TIDX.has(t.ficha)) TIDX.set(t.ficha, []); TIDX.get(t.ficha).push(t); }); } return TIDX; };
  const r0 = render; render = (...a) => { TIDX = null; return r0(...a); };
  const tempos = f => tidx().get(f.id) || [];
  const TECS = () => D('tecnicos').filter(t => t.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  const tecNome = id => S.data.tecnicos.get(id)?.nome || '';
  const meuTec = () => { const em = String(S.me?.email || '').toLowerCase(); return D('tecnicos').find(t => t.email && t.email.toLowerCase() === em); };
  const quemTempo = t => t.tecnico ? tecNome(t.tecnico) : (t.resp ? nameOf(t.resp) : '');
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
    const total = f.emGarantia ? 0 : mo + (d?.valor || 0) + pc;
    return { min, fmin, mo, desl: d, pc, total, custoGar: f.emGarantia ? mo + (d?.valor || 0) + pc : 0 };
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
  NAV.splice(1, 0, ['meudia', 'O meu dia', 'clock'], ['planear', 'Planear trabalho', 'cal'], ['oficina', 'Oficina e assistências', 'tool'], ['rotaof', 'Rota do dia', 'route'], ['ativos', 'Ativos dos clientes', 'box'], ['equip', 'Máquinas (n.º de série)', 'tool']);
  const iMais = NAV.findIndex(n => n[0] === 'mais'); NAV.splice(iMais, 0, ['encomendarp', 'Peças a encomendar', 'box'], ['tecnicosof', 'Técnicos e rendimento', 'chart'], ['tempos', 'Tempos e kits', 'clock'], ['ofcfg', 'Preços e deslocações', 'euro'], ['modulos', 'Plano e módulos', 'grid']);
  for (let i = NAV.length - 1; i > 0; i--) if (NAV[i][0] === 'sep' && (NAV[i - 1][0] === 'sep' || i === NAV.length - 1)) NAV.splice(i, 1);
  SO_VALORES.push('ofcfg', 'tecnicosof');
  TABS.splice(0, TABS.length, ['inicio', 'Início', 'home'], ['meudia', 'O meu dia', 'clock'], ['oficina', 'Oficina', 'tool'], ['clientes', 'Clientes', 'users'], ['mais', 'Mais', 'menu']);
  Object.assign(TITLES, { modulos: 'Plano e módulos', equip: 'Máquinas por n.º de série', equipum: 'Máquina', encomendarp: 'Peças a encomendar', meudia: 'O meu dia', planear: 'Planear trabalho', tecnicosof: 'Técnicos e rendimento', tempos: 'Tempos e kits', ativos: 'Ativos dos clientes', inicio: 'Início', oficina: 'Oficina e assistências', ofcfg: 'Preços e deslocações', rotaof: 'Rota do dia' });
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
    { k: 'tipo', l: 'Tipo de trabalho', t: 'sel', get o() { return Object.fromEntries(Object.entries(TIPO).filter(([k]) => k === 'oficina' || (k === 'guarda' ? temMod('ativos') : temMod('fora')))); }, req: 1, def: 'oficina' },
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
    { k: 'tecnico', l: 'Técnico', t: 'sel', get o() { return Object.fromEntries(TECS().map(t => [t.id, t.nome])); } },
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
.of-cq.ed .of-pt{cursor:grab;touch-action:none;border-color:#B45309;color:#B45309}
.of-cq.ed .of-pt.sel{background:#B45309;color:#fff}
.of-cq.ed.poe{cursor:crosshair;outline:3px dashed #B45309;outline-offset:-3px}
.of-edbar{position:sticky;top:calc(env(safe-area-inset-top) + 56px);z-index:5;display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:#FFF7ED;border:1px solid #F5C08A;border-radius:10px;padding:8px 10px;margin-top:8px}
.of-pt i{position:absolute;top:-9px;right:-9px;min-width:18px;height:18px;border-radius:9px;background:var(--ok,#1a7f4b);color:#fff;font-style:normal;font-size:11px;display:grid;place-items:center;padding:0 3px}
.of-stop{background:var(--bad)!important;border-color:var(--bad)!important;color:#fff!important}
`;
  document.head.appendChild(st);

  /* ---------- linhas de lista ---------- */
  function fRow(f) {
    const e = ent(f.entidade), d = dias(f), l = fora(f) ? loc(f) : null;
    const sub = [cod(f), TIPO_C[f.tipo], l?.localidade, nomeEq(f), f.avaria].filter(Boolean).join(' · ');
    const late = f.tipo === 'oficina' && ABERTOS.includes(f.estado) && d > 30;
    return `<div class="row" role="button" tabindex="0" data-act="ofiOpen" data-id="${f.id}"><span class="of-n">${f.numero ?? "•"}</span>
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
    ${S.canWrite ? `<div class="of-row2"><button class="btn pri of-big" data-act="ofiNew" data-preset='{"tipo":"oficina"}'>${ic('plus', 18)}Entrada na oficina</button><button class="btn of-big" data-act="ofiNew" data-preset='{"tipo":"local"}'>${ic('pin', 18)}Assistência no cliente</button><button class="btn of-big" data-act="go" data-v="planear">${ic('cal', 18)}Planear trabalho</button></div>` : ''}
    ${alertasH()}
    ${(() => { const n = temMod('stock') ? aEncomendar().length : 0; return n ? `<div class="of-alert" style="border-color:#B45309"><span style="flex:1"><b>${n} ${n === 1 ? 'peça precisa' : 'peças precisam'} de ser encomendada${n === 1 ? '' : 's'}</b><br><span class="note">Abaixo do stock mínimo ou em falta para os planos marcados.</span></span><button class="btn sm" data-act="go" data-v="encomendarp">Ver lista</button></div>` : ''; })()}
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
       <div class="of-row2">${S.verValores && temMod('sage') ? `<button class="btn" data-act="ofiExport" ${porFat ? '' : 'disabled'}>${ic('dl', 16)}Excel para faturar</button><button class="btn" data-act="ofiPdfLote" data-c="1" ${porFat ? '' : 'disabled'}>${ic('doc', 16)}PDF com preços</button>` : ''}<button class="btn" data-act="ofiPdfLote" data-c="0" ${porFat ? '' : 'disabled'}>${ic('doc', 16)}PDF sem preços${S.verValores ? ' (para o cliente)' : ''}</button></div></div></div>`; })()}
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
    <div class="fh"><span class="of-n" style="min-width:56px;height:56px;font-size:20px">${f.numero ?? "•"}</span><div style="min-width:0;flex:1"><h1>${esc(L0 ? L0.nome : prop(f))}</h1>
      <div class="meta">${badge(cod(f), 'info')}${badge(estL(f), EST_T[f.estado])}${badge(TIPO_C[f.tipo], 'gold')}${(L0 || (f.proprietario && f.proprietario !== e.nome)) && e.nome ? badge('Cliente: ' + e.nome) : ''}${['oficina', 'guarda'].includes(f.tipo) ? badge(`Entrou a ${fDY(f.entrada)} · ${dias(f)} d`, dias(f) > 30 && ABERTOS.includes(f.estado) ? 'bad' : 'mute') : f.prevista ? badge('Agendada ' + fDY(f.prevista)) : ''}${f.faturado ? badge('Faturado', 'ok') : ''}${fechada(f) && garantiaAte(f) >= TODAY() ? badge('Garantia até ' + fDY(garantiaAte(f)), 'ok') : ''}${f.emGarantia ? badge('Em garantia', 'ok') : ''}</div></div></div>
    ${avisoGarantia(f)}
    ${f.tipo !== 'guarda' && temMod('garantias') ? `<div class="of-row2" style="flex-wrap:wrap;gap:6px"><span class="note">Garantia desta ficha:</span>${S.canWrite ? Object.entries(GAR).map(([k, l]) => `<button class="chipb ${(f.garantiaTipo || 'pecas') === k ? 'on' : ''}" data-act="ofiGarT" data-id="${f.id}" data-c="${k}">${l}${k === 'sem' ? '' : ' · ' + durL(gDias({ garantiaTipo: k }))}</button>`).join('') : `<b>${GAR[f.garantiaTipo || 'pecas']}${f.garantiaTipo === 'sem' ? '' : ' · ' + durL(gDias(f))}</b>`}</div>` : ''}
    ${temMod('garantias') && nsN(f.nSerie) && D('fichas').filter(x => nsN(x.nSerie) === nsN(f.nSerie)).length > 1 ? `<div><button class="btn sm" data-act="ofiEquip" data-c="${esc(nsN(f.nSerie))}">${ic('clock', 16)}Histórico desta máquina (${D('fichas').filter(x => nsN(x.nSerie) === nsN(f.nSerie)).length} intervenções)</button></div>` : ''}
    <div class="panel"><div class="pb" style="padding-top:12px"><div class="kv">${[['Equipamento', nomeEq(f)], ['N.º de série', f.nSerie], ['Grupo', f.grupo], ['Avaria / pedido', f.avaria], ['Técnico', f.tecnico ? tecNome(f.tecnico) : (f.resp ? nameOf(f.resp) : '')], ['Notas', f.notas]].filter(x => x[1]).map(([l, x]) => `<div class="kvi"><span>${l}</span><b style="white-space:pre-wrap">${esc(x)}</b></div>`).join('')}</div></div></div>
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
        <div class="fld" style="flex:1;min-width:150px;margin:0"><label for="ofmr">Técnico</label><select id="ofmr">${TECS().map(t => `<option value="${t.id}" ${t.id === (meuTec()?.id || f.tecnico) ? 'selected' : ''}>${esc(t.nome)}</option>`).join('') || '<option value="">—</option>'}</select></div>
        <button class="btn" data-act="ofiTMan" data-id="${f.id}">${ic('plus', 16)}Adicionar tempo</button></div>`}
      ${T.length ? `<table class="tt" style="margin-top:12px"><tbody>${T.slice(0, 20).map(t => `<tr><td>${t.tipo === 'manual' ? fDY(t.inicio) + ' · <i>manual</i>' : fD(t.inicio)}${quemTempo(t) ? ' · ' + esc(quemTempo(t)) : ''}${t.plano ? ' · lote' : ''}</td><td class="num">${t.fim ? fmtMin(t.minutos) : 'a contar'}</td>${ro ? '' : `<td style="width:36px">${t.fim ? `<button class="ib" data-act="ofiTDel" data-id="${t.id}" aria-label="Apagar este tempo">${ic('x', 14)}</button>` : ''}</td>`}</tr>`).join('')}</tbody></table>` : ''}
    </div></div>`;

    // fotos
    h += `<div class="panel"><div class="ph"><h2>Fotos</h2><span class="note">${(f.fotos || []).length}</span></div><div class="pb"><div class="of-fotos">
      ${(f.fotos || []).map((p, i) => `<a data-foto="${esc(p)}" href="${esc(fotoF(p) || '#')}" target="_blank" rel="noopener">${imgF(p, 'Foto ' + (i + 1), 'loading="lazy"')}${ro ? '' : `<button data-act="ofiFotoDel" data-id="${f.id}" data-i="${i}" aria-label="Apagar foto">${ic('x', 14)}</button>`}</a>`).join('')}
      ${ro ? '' : `<label>${ic('cam', 26)}<span>Tirar foto</span><input type="file" accept="image/*" capture="environment" data-ofifoto="${f.id}" hidden></label><label>${ic('plus', 22)}<span>Da galeria</span><input type="file" accept="image/*" multiple data-ofifoto="${f.id}" hidden></label>`}
    </div></div></div>`;

    // assinatura do cliente
    h += `<div class="panel"><div class="ph"><h2>Assinatura do cliente</h2>${f.assinadoEm ? `<span class="note">${fD(f.assinadoEm)}</span>` : ''}</div><div class="pb">
      ${f.assinatura ? `<div style="border:1px solid var(--line);border-radius:10px;background:#fff;max-width:420px">${imgF(f.assinatura, 'Assinatura', 'style="display:block;width:100%;height:auto"')}</div><p class="note" style="margin:6px 0 10px">${esc(f.assinadoNome || '')}</p>` : '<p class="note" style="margin:0 0 10px">Ainda não assinada. Peça ao cliente para assinar no ecrã quando levantar o material ou no fim da assistência.</p>'}
      ${ro ? '' : `<button class="btn ${f.assinatura ? '' : 'pri'}" data-act="ofiAss" data-id="${f.id}">${ic('edit', 16)}${f.assinatura ? 'Assinar de novo' : 'Recolher assinatura'}</button>`}</div></div>`;

    // diagnóstico e trabalho
    h += `<div class="panel"><div class="ph"><h2>Diagnóstico e trabalho feito</h2></div><div class="pb"><div class="fg">
      <div class="fld full"><label for="ofdiag">Diagnóstico</label><textarea id="ofdiag" data-oftxt="diagnostico" data-id="${f.id}" ${ro ? 'readonly' : ''} placeholder="O que foi encontrado">${esc(f.diagnostico || '')}</textarea></div>
      <div class="fld full"><label for="oftrab">Trabalho realizado (vai no relatório ao cliente)</label><textarea id="oftrab" data-oftxt="trabalho" data-id="${f.id}" ${ro ? 'readonly' : ''} placeholder="O que foi feito">${esc(f.trabalho || '')}</textarea></div></div></div></div>`;

    // peças
    const P0 = f.pecas || [];
    h += `<div class="panel"><div class="ph"><h2>Peças aplicadas</h2>${S.verValores && v.pc ? `<b class="num">${eur(v.pc)}</b>` : ''}</div><div class="pb">
      ${P0.length ? P0.map((p, i) => `<div class="of-pc"><span class="grow">${esc(p.nome)}<small>${esc(p.ref || '')}${S.verValores ? ' · ' + eur(p.preco) + '/un' : ''}</small></span>${ro ? `<b>${p.qt}</b>` : `<span class="of-qt"><button data-act="ofiPq" data-id="${f.id}" data-i="${i}" data-c="-1">−</button><b class="num">${String(p.qt).replace('.', ',')}</b><button data-act="ofiPq" data-id="${f.id}" data-i="${i}" data-c="1">+</button></span>`}</div>`).join('') : '<p class="note" style="margin:0">Ainda sem peças.</p>'}
      ${ro ? '' : `<div class="of-row2" style="margin-top:12px;align-items:flex-end"><div class="fld" style="flex:1;min-width:160px;margin:0"><label for="ofcod">Código da peça</label><input id="ofcod" data-ofcod="${f.id}" placeholder="Ex.: 0V2277" autocomplete="off" autocapitalize="characters" enterkeyhint="done"></div><div class="fld" style="width:76px;margin:0"><label for="ofcodqt">Qt</label><input id="ofcodqt" type="number" min="1" step="1" value="1" inputmode="numeric"></div><button class="btn pri" data-act="ofiCod" data-id="${f.id}">Pôr</button></div>`}
      ${(() => { const CQ = temMod('croquis') ? D('croquis').filter(c => f.modelo && norm(c.modelo) === norm(f.modelo)).sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || a.grupo.localeCompare(b.grupo, 'pt')) : []; return CQ.length ? `<div style="margin-top:14px"><div class="eyebrow" style="margin-bottom:8px">Croquis do ${esc(f.modelo)} · toque num número</div><div class="of-est">${CQ.map(c => `<button class="chipb ${S.ofCroqui === c.id ? 'on' : ''}" data-act="ofiCroqui" data-c="${c.id}">${esc(c.grupo)}</button>`).join('')}</div>${S.ofCroqui && CQ.some(c => c.id === S.ofCroqui) ? croquiH(f, S.data.croquis.get(S.ofCroqui)) : ''}</div>` : (f.modelo ? `<p class="note" style="margin:12px 0 0">Ainda não há croquis do ${esc(f.modelo)}.</p>` : '').replace(/^(.*)$/s, m => temMod('croquis') ? m : ''); })()}
      ${ro ? '' : !S.ofPick?.open ? `<div style="margin-top:12px"><button class="btn" data-act="ofiPick" data-id="${f.id}">${ic('search', 16)}Procurar peça${f.modelo ? ' do ' + esc(f.modelo) : ''}</button></div>` : `
        <div class="fg" style="margin-top:12px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
          <div class="fld"><label for="ofpm">Modelo</label><select id="ofpm" data-ofp="mod"><option value="">Todos os modelos</option>${modelosL().map(m => `<option ${m === mod ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div>
          <div class="fld"><label for="ofpg">Grupo</label><select id="ofpg" data-ofp="grp"><option value="">Todos os grupos</option>${gruposDe(mod).map(g => `<option ${g === grp ? 'selected' : ''}>${esc(g)}</option>`).join('')}${grp && !gruposDe(mod).includes(grp) ? `<option selected>${esc(grp)}</option>` : ''}</select></div>
          <div class="fld"><label for="ofpq">Procurar</label><input id="ofpq" data-ofp="q" value="${esc(q)}" placeholder="Nome ou referência" autocomplete="off"></div></div>
        <p class="note" style="margin:8px 0 0">${pecasDe(mod, grp).length} peças ${mod ? 'do ' + esc(mod) : ''}${grp ? ' · ' + esc(grp) : ''}. <button class="lnk" style="border:0;background:none;text-decoration:underline;color:var(--ink-2)" data-act="ofiPickX">Fechar</button></p>
        <div class="of-res" id="ofres">${res.length ? res.map(a => `<div class="of-pc"><span class="grow">${esc(a.nome)}<small>${esc(a.ref || '')}${a.grupoPeca ? ' · ' + esc(a.grupoPeca) : ''}${S.verValores && a.preco != null ? ' · ' + eur(a.preco) : ''}${stkH(a)}</small></span><button class="btn sm" data-act="ofiPadd" data-id="${f.id}" data-a="${a.id}">Pôr</button></div>`).join('') : '<p class="note">Nenhuma peça com estes filtros.</p>'}</div>`}
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
        ${f.emGarantia ? `<tr><td>Coberto pela garantia (custo interno ${eur(v.custoGar)})</td><td class="num">− ${eur(v.custoGar)}</td></tr>` : ''}<tr><td><b>Total sem IVA</b></td><td class="num"><b>${eur(v.total)}</b></td></tr></tbody></table>
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
        <div class="fld"><label for="cf-gar">Garantia de peças e reparações (dias)</label><input id="cf-gar" type="number" step="1" value="${c.garantiaDias ?? 30}"></div>
        <div class="fld"><label for="cf-garn">Garantia de máquinas novas (dias)</label><input id="cf-garn" type="number" step="1" value="${c.garantiaMaqNovaDias ?? 365}"></div>
        <div class="fld"><label for="cf-garu">Garantia de máquinas usadas (dias)</label><input id="cf-garu" type="number" step="1" value="${c.garantiaMaqUsadaDias ?? 180}"></div>
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
  ACT.ofCfgSave = async () => { const n = id => { const x = $('#' + id).value; return x === '' ? null : parseFloat(x); }; if (await patch('oficina_config', 1, { precoHora: n('cf-ph'), precoKm: n('cf-pk'), blocoMin: n('cf-bl') || 30, toleranciaMin: n('cf-tol') ?? 5, minimoForaMin: n('cf-mf') ?? 60, minimoOficinaMin: n('cf-mo') ?? 30, garantiaDias: n('cf-gar') || 30, garantiaMaqNovaDias: n('cf-garn') || 365, garantiaMaqUsadaDias: n('cf-garu') || 180, baseLat: n('cf-lat'), baseLng: n('cf-lng'), idaVolta: $('#cf-iv').checked })) toast('Guardado'); };
  ACT.ofTabSave = async d => { const nome = $(`[data-dtn="${d.id}"]`).value.trim(), L = parseEsc($(`[data-dte="${d.id}"]`).value); if (!nome || !L.length) return toast('Falta o nome ou os escalões'); if (await patch('desl_tabelas', d.id, { nome, escaloes: L })) toast('Tabela guardada'); };
  ACT.ofTabNew = async () => { await save('desl_tabelas', null, { nome: 'Nova tabela', escaloes: [{ ate: 40, valor: 30 }, { ate: 70, valor: 50 }, { ate: 150, valor: 90 }] }); };

  /* ---------- ficha do cliente, por secções ---------- */
  const vf0 = VIEWS.ficha;
  const prometH = f => { if (!f.prevista) return ''; const atr = f.prevista < TODAY() && ABERTOS.includes(f.estado); return `<span class="note" style="${atr ? 'color:var(--bad);font-weight:500' : ''}">Prometido ${fDY(f.prevista)}</span>`; };
  function linhaEspera(f) {
    const d = dias(f), l = loc(f);
    return `<div class="row" role="button" tabindex="0" data-act="ofiOpen" data-id="${f.id}"><span class="of-n">${f.numero ?? "•"}</span><span class="rt"><span class="r1">${esc(nomeEq(f))}${l ? ` <small style="color:var(--ink-3)">· ${esc(l.nome)}</small>` : ''}</span><span class="r2">${esc([cod(f), TIPO_C[f.tipo], f.avaria].filter(Boolean).join(' · '))}</span></span>
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
    ${S.canWrite ? `<div class="of-row2"><button class="btn sm" data-act="ofiNew" data-preset='${pre({ tipo: 'oficina' })}'>${ic('tool', 16)}Entrada na oficina</button>${temMod('fora') ? `<button class="btn sm" data-act="ofiNew" data-preset='${pre({ tipo: 'local' })}'>${ic('pin', 16)}Assistência fora</button>` : ''}${temMod('ativos') ? `<button class="btn sm" data-act="ofiNew" data-preset='${pre({ tipo: 'guarda', equipamento: 'Máquina completa' })}'>${ic('box', 16)}Guardar máquina</button>` : ''}<button class="btn sm" data-act="new" data-col="encomendas" data-preset='${pre({})}'>${ic('euro', 16)}Venda de peças</button></div>` : ''}
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
      ${C.length ? C.map(c => `<div class="panel"><div class="ph"><h2><a href="#" data-act="ofiCli" data-id="${c.id}" style="color:inherit;text-decoration:none">${esc(c.nome)}</a></h2><span class="note">${esc(resumo(c.L))}</span></div>${c.L.map(f => `<div class="row" role="button" tabindex="0" data-act="ofiOpen" data-id="${f.id}"><span class="of-n">${f.numero ?? "•"}</span><span class="rt"><span class="r1">${esc(nomeEq(f))}</span><span class="r2">${esc([cod(f), f.nSerie ? 'S/N ' + f.nSerie : '', 'entrou ' + fDY(f.entrada)].filter(Boolean).join(' · '))}</span></span><span class="rr">${badge(estL(f), EST_T[f.estado])}<span class="note" style="${dias(f) > 90 ? 'color:var(--bad);font-weight:500' : ''}">${dias(f)} d</span></span></div>`).join('')}</div>`).join('') : '<div class="panel empty"><b>Nenhum cliente tem material na empresa</b></div>'}
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
      ${temMod('fora') ? `<button data-act="ofiNew" data-preset='${pre({ tipo: 'local' })}'>${ic('pin', 20)}<span>Assistência no cliente</span></button>` : ''}
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
    await save('fichas_tempos', null, { ficha: f.id, tipo: 'trabalho', inicio: now, resp: S.uid || null, tecnico: meuTec()?.id || f.tecnico || null });
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

  ACT.ofiAss = d => {
    const f = fx(d.id); if (!f) return; const e = ent(f.entidade) || {}, l = loc(f);
    openSheet(`<div class="sh"><h2>Assinatura do cliente · ${esc(cod(f))}</h2><button class="ib" data-act="close" aria-label="Fechar">${ic('x')}</button></div><div class="sb">
      <p class="note" style="margin-top:0">${esc(nomeEq(f))}. O cliente assina com o dedo no quadro.</p>
      <canvas id="asscv" style="width:100%;height:220px;border:1.5px dashed var(--line);border-radius:12px;background:#fff;touch-action:none;display:block"></canvas>
      <div class="fld" style="margin-top:12px"><label for="assnm">Nome de quem assina</label><input id="assnm" value="${esc(f.assinadoNome || l?.contacto || e.contacto || '')}" autocomplete="off"></div></div>
      <div class="sf"><button class="btn" data-act="ofiAssLimpa">Limpar</button><span class="grow"></span><button class="btn pri" data-act="ofiAssOk" data-id="${f.id}" data-c="${d.c || ''}">Guardar assinatura</button></div>`);
    setTimeout(() => {
      const cv = $('#asscv'); if (!cv) return; const r = cv.getBoundingClientRect(), k = window.devicePixelRatio || 1;
      cv.width = r.width * k; cv.height = r.height * k; const ctx = cv.getContext('2d'); ctx.scale(k, k); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
      let on = false; cv._vazio = true;
      const pt = ev => { const b = cv.getBoundingClientRect(); return [ev.clientX - b.left, ev.clientY - b.top]; };
      cv.onpointerdown = ev => { on = true; cv.setPointerCapture(ev.pointerId); const [x, y] = pt(ev); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + .1, y + .1); ctx.stroke(); cv._vazio = false; };
      cv.onpointermove = ev => { if (!on) return; const [x, y] = pt(ev); ctx.lineTo(x, y); ctx.stroke(); };
      cv.onpointerup = cv.onpointercancel = () => { on = false; };
    }, 60);
  };
  ACT.ofiAssLimpa = () => { const cv = $('#asscv'); if (!cv) return; cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); cv._vazio = true; };
  ACT.ofiAssOk = async (d, b) => {
    const f = fx(d.id), cv = $('#asscv'); if (!f || !cv || !canAct()) return; if (cv._vazio) return toast('Falta a assinatura');
    const nome = ($('#assnm')?.value || '').trim(); if (!nome) return toast('Escreva o nome de quem assina');
    b.disabled = true; const blob = await new Promise(ok => cv.toBlob(ok, 'image/png')); const path = `${f.id}/assinatura-${Date.now()}.png`;
    const { error } = await S.db.storage.from('fichas').upload(path, blob, { contentType: 'image/png' });
    if (error) { b.disabled = false; console.warn(error); return toast('Não foi possível guardar a assinatura'); }
    const old = f.assinatura; await patch('fichas', f.id, { assinatura: path, assinadoNome: nome, assinadoEm: new Date().toISOString() });
    if (old) S.db.storage.from('fichas').remove([old]);
    closeSheet(); toast('Assinatura guardada'); if (d.c === 'guia') setTimeout(() => ACT.ofiDocMenu({ id: f.id, c: 'entrega' }), 150);
  };
  ACT.ofiTMan = async d => {
    const f = fx(d.id); if (!f || !canAct()) return; const h = parseInt($('#ofmh')?.value, 10) || 0, m = parseInt($('#ofmm')?.value, 10) || 0, min = h * 60 + m;
    if (min <= 0) return toast('Escreva as horas ou os minutos'); if (min > 24 * 60) return toast('Mais de 24 h numa linha? Confirme o tempo.');
    const dia = $('#ofmd')?.value || TODAY(), ini = new Date(dia + 'T09:00:00').toISOString(), fim = new Date(new Date(ini).getTime() + min * 60000).toISOString();
    if (await save('fichas_tempos', null, { ficha: f.id, tipo: 'manual', inicio: ini, fim, minutos: min, resp: S.uid || null, tecnico: $('#ofmr')?.value || null, notas: 'Tempo escrito à mão' })) toast(fmtMin(min) + ' adicionados');
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
    if (S.cqEd?.id === c.id) return croquiEdH(f, c);
    const P = (c.pontos || []).map(ptN);
    const qtd = ref => { const a = porRef(ref); return (f.pecas || []).filter(p => (a && p.artigo === a.id) || nref(p.ref) === nref(ref)).reduce((s, p) => s + (+p.qt || 0), 0); };
    const src = S.cqImg[c.id] || (c.imagem ? croquiUrl(c.imagem) + (c.atualizado ? '?v=' + encodeURIComponent(c.atualizado) : '') : '');
    if (!src) setTimeout(() => desenhaCroqui(c, f), 0);
    const semImg = !src ? `<div class="pb"><p class="note" style="margin:0">${S.cqImg[c.id + ':erro'] ? 'Não foi possível abrir o desenho.' : manPecas(c.modelo) ? 'A preparar o desenho do catálogo…' : `Para ver o desenho, carregue o catálogo de peças do ${esc(c.modelo)} em «Manuais». A lista de números já funciona.`}</p></div>` : '';
    const zoom = S.ofZoom ? ' of-cq-zoom' : '';
    return `${src ? `<div class="of-row2" style="margin-top:8px"><button class="btn sm" data-act="ofiZoom">${S.ofZoom ? 'Desenho normal' : 'Ampliar desenho'}</button><span class="note" style="flex:1">Toque num número para pôr a peça.</span>${S.isAdmin ? `<button class="btn sm" data-act="ofiCqEd" data-c="${c.id}" data-id="${f.id}">${ic('edit', 16)}Corrigir números</button>` : ''}</div><div class="of-cqw${zoom}"><div class="of-cq"><img src="${esc(src)}" alt="Desenho ${esc(c.grupo)}">${P.map(p => { const n = qtd(p.ref); return p.xy.map(([x, y]) => `<button class="of-pt ${n ? 'on' : ''}" style="left:${+x}%;top:${+y}%" data-act="ofiPos" data-id="${f.id}" data-c="${c.id}" data-p="${esc(p.pos)}" data-r="${esc(p.ref)}" title="${esc(p.ref)}">${esc(p.pos)}${n ? `<i>${n}</i>` : ''}</button>`).join(''); }).join('')}</div></div>` : semImg}
      <table class="tt" style="margin-top:8px"><tbody>${P.map(p => { const a = porRef(p.ref), n = qtd(p.ref); return `<tr data-act="ofiPos" data-id="${f.id}" data-c="${c.id}" data-p="${esc(p.pos)}" data-r="${esc(p.ref)}" style="cursor:pointer"><td style="width:42px"><b>${esc(p.pos)}</b></td><td>${esc(a?.nome || p.ref)}<br><small style="color:var(--ink-3)">${esc(p.ref)}${p.nota ? ' · ' + esc(p.nota) : ''}${p.xy.length ? '' : ' · sem posição no desenho'}</small></td><td class="num">${n ? badge(n + ' na ficha', 'ok') : ''}</td></tr>`; }).join('')}</tbody></table>`;
  }

  /* ---------- editor dos croquis (administrador): arrastar números, pôr os que faltam ---------- */
  const ptA = p => [p.pos, p.ref, p.xy.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]), ...(p.nota ? [p.nota] : [])];
  ACT.ofiCqEd = d => { const c = S.data.croquis.get(d.c); if (!c || !S.isAdmin) return; S.ofZoom = true; S.cqEd = { id: c.id, P: (c.pontos || []).map(ptN).map(p => ({ ...p, xy: p.xy.map(v => [...v]) })), sujo: false, poe: null, sel: null }; render(); };
  function croquiEdH(f, c) {
    const E = S.cqEd, src = S.cqImg[c.id] || (c.imagem ? croquiUrl(c.imagem) + (c.atualizado ? '?v=' + encodeURIComponent(c.atualizado) : '') : '');
    if (!src) setTimeout(() => desenhaCroqui(c, f), 0);
    const falta = E.P.filter(p => !p.xy.length).length, alvo = E.poe != null ? E.P[E.poe] : null;
    return `<div class="of-edbar"><b style="flex:1">A corrigir · ${esc(c.grupo)}${falta ? ` · ${falta} sem posição` : ' · todos no desenho'}</b>
      <button class="btn sm" data-act="ofiCqNovo">${ic('plus', 16)}Número novo</button><button class="btn sm" data-act="ofiCqSair">Cancelar</button><button class="btn sm pri" data-act="ofiCqGuardar" ${E.sujo ? '' : 'disabled'}>Guardar</button></div>
      <p class="note" style="margin:6px 0 0">${alvo ? `<b>Toque no desenho onde fica o n.º ${esc(alvo.pos)}.</b> ` : ''}Arraste um número para o mudar de sítio. Para pôr um que falta, use «Pôr» na lista e toque no desenho.</p>
      ${src ? `<div class="of-cqw of-cq-zoom"><div class="of-cq ed${alvo ? ' poe' : ''}" id="cq-ed"><img src="${esc(src)}" alt="Desenho ${esc(c.grupo)}" draggable="false">${E.P.map((p, i) => p.xy.map(([x, y], j) => `<span class="of-pt${E.sel === i ? ' sel' : ''}" style="left:${+x}%;top:${+y}%" data-i="${i}" data-j="${j}">${esc(p.pos)}</span>`).join('')).join('')}</div></div>` : '<p class="note">A preparar o desenho…</p>'}
      <table class="tt" style="margin-top:8px"><tbody>${E.P.map((p, i) => `<tr${E.sel === i ? ' style="background:#FFF7ED"' : ''}><td style="width:42px"><b>${esc(p.pos)}</b></td><td>${esc(porRef(p.ref)?.nome || p.ref)}<br><small style="color:var(--ink-3)">${esc(p.ref)} · ${p.xy.length ? p.xy.length + (p.xy.length > 1 ? ' posições' : ' posição') : '<b style="color:#B45309">sem posição</b>'}</small></td>
        <td class="num" style="white-space:nowrap"><button class="btn sm${!p.xy.length ? ' pri' : ''}" data-act="ofiCqPoe" data-i="${i}">${p.xy.length ? '+ Pôr outra' : 'Pôr'}</button>${p.xy.length ? ` <button class="btn sm" data-act="ofiCqTira" data-i="${i}" aria-label="Tirar a última posição">Tirar</button>` : ''}</td></tr>`).join('')}</tbody></table>`;
  }
  const cqSujo = () => { S.cqEd.sujo = true; render(); };
  ACT.ofiCqPoe = d => { S.cqEd.poe = +d.i; S.cqEd.sel = +d.i; render(); document.getElementById('cq-ed')?.scrollIntoView({ block: 'center' }); };
  ACT.ofiCqTira = d => { const p = S.cqEd.P[+d.i]; p.xy.pop(); cqSujo(); };
  ACT.ofiCqSair = () => { if (S.cqEd?.sujo && !confirm('Sair sem guardar as alterações?')) return; S.cqEd = null; render(); };
  ACT.ofiCqNovo = () => openSheet(`<div class="sh"><h2>Número novo no desenho</h2><button class="ib" data-act="close" aria-label="Fechar">${ic('x')}</button></div><div class="sb">
    <div class="fld"><label for="cqn-p">N.º no desenho</label><input id="cqn-p" inputmode="numeric" autocomplete="off"></div>
    <div class="fld"><label for="cqn-r">Código da peça</label><input id="cqn-r" autocomplete="off"></div>
    <div class="fld"><label for="cqn-n">Nota (opcional)</label><input id="cqn-n" autocomplete="off"></div>
    <button class="btn pri" data-act="ofiCqNovoOk">Continuar e tocar no desenho</button></div>`);
  ACT.ofiCqNovoOk = () => { const v = k => (document.getElementById(k)?.value || '').trim(), pos = v('cqn-p'), ref = v('cqn-r'); if (!pos || !ref) return toast('Escreva o número e o código'); const E = S.cqEd; E.P.push({ pos, ref, xy: [], nota: v('cqn-n') }); E.poe = E.sel = E.P.length - 1; E.sujo = true; closeSheet(); render(); };
  ACT.ofiCqGuardar = async () => {
    const E = S.cqEd, P = E.P.map(ptA).sort((a, b) => (parseFloat(a[0]) || 0) - (parseFloat(b[0]) || 0));
    if (await patch('croquis', E.id, { pontos: P })) { S.cqEd = null; toast('Croqui guardado'); render(); }
  };
  // arrastar e tocar no desenho
  const pct = (el, e) => { const r = el.getBoundingClientRect(); return [Math.min(100, Math.max(0, (e.clientX - r.left) / r.width * 100)), Math.min(100, Math.max(0, (e.clientY - r.top) / r.height * 100))]; };
  let arr = null;
  document.addEventListener('pointerdown', e => {
    const box = e.target.closest?.('#cq-ed'); if (!box || !S.cqEd) return;
    const pt = e.target.closest('.of-pt');
    if (pt) { e.preventDefault(); arr = { el: pt, box, i: +pt.dataset.i, j: +pt.dataset.j, mov: false }; pt.setPointerCapture?.(e.pointerId); S.cqEd.sel = arr.i; return; }
    if (S.cqEd.poe != null) { const [x, y] = pct(box, e); S.cqEd.P[S.cqEd.poe].xy.push([x, y]); S.cqEd.poe = null; cqSujo(); }
  });
  document.addEventListener('pointermove', e => { if (!arr) return; const [x, y] = pct(arr.box, e); arr.el.style.left = x + '%'; arr.el.style.top = y + '%'; arr.xy = [x, y]; arr.mov = true; });
  document.addEventListener('pointerup', () => { if (!arr) return; const a = arr; arr = null; if (a.mov && a.xy) { S.cqEd.P[a.i].xy[a.j] = a.xy; cqSujo(); } else render(); });
  ACT.ofiZoom = () => { S.ofZoom = !S.ofZoom; render(); };
  ACT.ofiCroqui = d => { S.ofCroqui = S.ofCroqui === d.c ? null : d.c; render(); };
  const achaPt = d => { const c = S.data.croquis.get(d.c); if (!c) return {}; const p = (c.pontos || []).map(ptN).find(x => x.pos === String(d.p) && (!d.r || x.ref === d.r)); return { c, p }; };
  ACT.ofiPos = d => {
    const f = fx(d.id), { c, p } = achaPt(d); if (!f || !c || !p) return;
    const a = porRef(p.ref), n = (f.pecas || []).filter(x => (a && x.artigo === a.id) || nref(x.ref) === nref(p.ref)).reduce((s, x) => s + (+x.qt || 0), 0);
    openSheet(`<div class="sh"><h2>N.º ${esc(p.pos)} · ${esc(c.grupo)}</h2><button class="ib" data-act="close" aria-label="Fechar">${ic('x')}</button></div><div class="sb">
      <p style="margin:0 0 4px;font-size:17px"><b>${esc(a?.nome || 'Peça ' + p.ref)}</b></p><p class="note" style="margin:0 0 14px">Código ${esc(p.ref)}${p.nota ? ' · ' + esc(p.nota) : ''}${S.verValores && a?.preco != null ? ' · ' + eur(a.preco) : ''}${a ? stkH(a) : ' · não está no catálogo'}</p>
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
    if (ds.offat && S.canWrite) { await patch('fichas', ds.offat, { faturado: t.checked, faturadoEm: t.checked ? new Date().toISOString() : null }); return; }
    if (ds.ofp && S.ofPick) { S.ofPick[ds.ofp] = t.value; if (ds.ofp === 'mod') S.ofPick.grp = ''; render(); }
  });
  document.addEventListener('input', e => { const t = e.target; if (t.dataset?.ofp === 'q' && S.ofPick) { S.ofPick.q = t.value; render(); } });

  /* ---------- mensagens ao cliente ---------- */
  const assinOf = () => `\n\n${S.me?.name && !/mundicacau|geral@/i.test(S.me.name) ? S.me.name + ' · ' : ''}${cfg().empresa}`;
  function msgPronto(f) {
    const e = ent(f.entidade) || {};
    return { assunto: `${f.tipo === 'oficina' ? 'Pronto para levantar' : 'Assistência concluída'} · ficha ${cod(f)} · ${prop(f)}`, texto: `Olá${e.contacto ? ' ' + e.contacto : ''},\n\nInformamos que o trabalho da ficha ${cod(f)} (${nomeEq(f)}${f.nSerie ? ', n.º de série ' + f.nSerie : ''}) de ${prop(f)} está pronto${f.tipo === 'oficina' ? ' e pode ser levantado nas nossas instalações' : ''}. A fatura terá a referência ${cod(f)}.${f.trabalho ? '\n\nTrabalho realizado:\n' + f.trabalho : ''}\n\nObrigado pela preferência.${assinOf()}` };
  }
  function msgRelatorio(f, links = {}) {
    const e = ent(f.entidade) || {}, v = valores(f), P0 = f.pecas || [];
    const t = [`Relatório de assistência · ficha ${cod(f)}`, '', `Cliente: ${e.nome || ''}`, ondeTxt(f) ? `Local: ${ondeTxt(f)}` : '', `Data: ${fDY(f.chegadaEm || TODAY())}`, `Equipamento: ${nomeEq(f)}${f.nSerie ? ' · n.º de série ' + f.nSerie : ''}`, f.resp ? `Técnico: ${nameOf(f.resp)}` : '', f.chegadaEm ? `Chegada: ${fD(f.chegadaEm)}` : '', `Tempo de trabalho: ${fmtMin(v.min)}${v.fmin && v.fmin !== Math.round(v.min) ? ` (a faturar: ${fmtMin(v.fmin)})` : ''}`, f.km != null ? `Deslocação: ${fmtKm(f.km)} km` : '', f.avaria ? `\nPedido: ${f.avaria}` : '', f.trabalho ? `\nTrabalho realizado:\n${f.trabalho}` : '', P0.length ? `\nPeças aplicadas:\n${P0.map(p => `- ${p.qt} × ${p.nome}${p.ref ? ' (' + p.ref + ')' : ''}`).join('\n')}` : '', (f.fotos || []).length ? `\nFotos: ${(f.fotos || []).map(p => links[p]).filter(Boolean).join('\n')}` : ''].filter(x => x !== '').join('\n');
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
  ACT.ofiAviso = async d => { const f = fx(d.id); if (!f) return; const rel = fora(f), links = rel ? await urlsLongas(f.fotos) : {}; enviarSheet(f, rel ? msgRelatorio(f, links) : msgPronto(f), rel ? 'Relatório ao cliente' : 'Avisar o cliente', 'Abre o email ou o WhatsApp com a mensagem já escrita. Reveja e carregue em enviar.', 'aviso'); };
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
    else L.push(...(f.emGarantia ? [['Garantia', 'Reparação coberta pela garantia']] : []), ...(garantiaAte(f) ? [['Garantia', GAR[f.garantiaTipo || 'pecas'] + ' · ' + durL(gDias(f)) + ' · até ' + fDY(garantiaAte(f))]] : []), ['Data de entrada', fDY(f.entrada)], [f.tipo === 'oficina' ? 'Data de entrega' : 'Data do serviço', fDY(f.entregueEm || f.chegadaEm || new Date().toISOString())], ...(f.avaria ? [['Pedido', f.avaria]] : []), ...(f.trabalho ? [['Trabalho realizado', f.trabalho]] : []), ['Tempo de trabalho', fmtMin(v.min) + (v.fmin && v.fmin !== Math.round(v.min) ? ` (a faturar: ${fmtMin(v.fmin)})` : '')], ...(fora(f) && f.km != null ? [['Deslocação', fmtKm(f.km) + ' km']] : []));
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
      <div class="sf">${tipo !== 'entrada' && S.canWrite ? `<button class="btn ${f.assinatura ? '' : 'pri'}" data-act="ofiAss" data-id="${f.id}" data-c="guia">${ic('edit', 16)}${f.assinatura ? 'Assinado ✓' : 'Assinatura do cliente'}</button>` : ''}<button class="btn" data-act="ofiDoc" data-id="${f.id}" data-c="${tipo}">${ic('print', 16)}Imprimir</button><span class="grow"></span>
      <a class="btn" ${em ? '' : 'style="opacity:.45;pointer-events:none"'} data-act="mailgo" data-ofmark="doc-${tipo}" data-id="${f.id}" href="${esc(`mailto:${em}?subject=${encodeURIComponent(m.assunto)}&body=${encodeURIComponent(m.texto)}`)}">${ic('mail', 16)}Email</a>
      <a class="btn pri" ${e.telemovel ? '' : 'style="opacity:.45;pointer-events:none"'} data-act="mailgo" data-ofmark="doc-${tipo}" data-id="${f.id}" href="${esc(`https://wa.me/${waNum(e.telemovel)}?text=${encodeURIComponent(m.texto)}`)}" target="_blank" rel="noopener">${ic('wa', 16)}WhatsApp</a></div>`);
  };
  ACT.ofiDoc = async d => {
    const f = fx(d.id); if (!f) return; const tipo = d.c, w = window.open('', '_blank'); if (!w) return toast('O navegador bloqueou a janela. Permita janelas para este site.');
    let qr = ''; try { await loadQR(); const q = qrcode(0, 'M'); q.addData(urlF(f.id)); q.make(); qr = q.createSvgTag({ cellSize: 3, margin: 0, scalable: true }); } catch (_) { }
    const titulo = tipo === 'entrada' ? 'Comprovativo de entrada' : (f.tipo === 'oficina' ? 'Guia de entrega' : 'Folha de serviço'), P0 = f.pecas || [];
    let logo = new URL('logo.png', location.href).href; try { const bl = await (await fetch(logo)).blob(); logo = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(bl); }); } catch (_) { }
    const assUrl = f.assinatura ? (await urlsLongas([f.assinatura], 3600))[f.assinatura] : '';
    const assin = tipo === 'entrada' ? ['Entregue pelo cliente', 'Recebido por ' + esc(cfg().empresa)] : ['Entregue por ' + esc(cfg().empresa), 'Recebido pelo cliente'];
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${titulo} ${esc(cod(f))}</title><style>
      @page{size:A4;margin:16mm}body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:11pt;margin:0}
      .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #2F4F94;padding-bottom:10px}
      .top img{height:56px}.ref{text-align:right}.ref b{display:block;font-size:20pt;color:#2F4F94;letter-spacing:.02em}.ref span{font-size:9pt;color:#555}
      h1{font-size:15pt;margin:18px 0 10px}.qr{width:26mm;height:26mm;margin-top:6px;margin-left:auto}.qr svg{width:100%;height:100%}
      table{width:100%;border-collapse:collapse}td{padding:6px 4px;border-bottom:1px solid #ddd;vertical-align:top}td:first-child{width:34%;color:#555}
      td.pre{white-space:pre-wrap}h2{font-size:12pt;margin:18px 0 6px}.nota{margin-top:18px;padding:10px 12px;background:#EEF4FB;border-left:4px solid #0090E0;font-size:10.5pt}
      .ass2{display:flex;gap:30px;margin-top:22px}.ass2>div{flex:1}.ass2 .sg{height:64px;display:flex;align-items:flex-end}.ass2 .sg img{max-height:62px;max-width:100%}.ass2 .ln{border-top:1px solid #333;padding-top:6px;font-size:9.5pt;color:#444}.ass{display:flex;gap:30px;margin-top:46px}.ass div{flex:1;border-top:1px solid #333;padding-top:6px;font-size:9.5pt;color:#444}
      @media screen{body{background:#eee}.pg{background:#fff;max-width:190mm;margin:20px auto;padding:16mm;box-shadow:0 1px 6px rgba(0,0,0,.2)}.b{text-align:center;margin:10px}}@media print{.b{display:none}}</style></head><body>
      <div class="b"><button onclick="print()">Imprimir</button></div><div class="pg">
      <div class="top"><img src="${esc(logo)}" alt=""><div class="ref"><span>Referência</span><b>${esc(cod(f))}</b>${qr ? `<div class="qr">${qr}</div>` : ''}</div></div>
      <h1>${titulo}</h1>
      <table>${linhasDoc(f, tipo).map(([a, b]) => `<tr><td>${esc(a)}</td><td class="pre">${esc(b)}</td></tr>`).join('')}</table>
      ${tipo !== 'entrada' && P0.length ? `<h2>Peças aplicadas</h2><table>${P0.map(p => `<tr><td>${esc(p.ref || '')}</td><td>${esc(p.nome)} · ${esc(String(p.qt).replace('.', ','))} un</td></tr>`).join('')}</table>` : ''}
      <div class="nota">${esc(nota(f))}${tipo !== 'entrada' ? ' A fatura segue depois.' : ''}</div>
      <div class="ass2"><div><div class="sg"></div><div class="ln">${assin[0]}</div></div><div><div class="sg">${tipo !== 'entrada' && assUrl ? `<img src="${esc(assUrl)}" alt="Assinatura">` : ''}</div><div class="ln">${assin[1]}${tipo !== 'entrada' && f.assinadoNome ? ' · ' + esc(f.assinadoNome) + (f.assinadoEm ? ' · ' + esc(fD(f.assinadoEm)) : '') : ''}</div></div></div></div>
      <script>window.onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`);
    w.document.close();
    patch('fichas', f.id, tipo === 'entrada' ? { entradaDocEm: new Date().toISOString() } : { entregaDocEm: new Date().toISOString() });
  };


  /* ---------- PDF das fichas (com preços só para o administrador) ---------- */
  function pagFicha(f, precos, logo) {
    const e = ent(f.entidade) || {}, v = valores(f), P0 = f.pecas || [], tipoT = f.tipo === 'oficina' ? 'Ficha de reparação' : f.tipo === 'guarda' ? 'Ficha de guarda' : f.tipo === 'manutencao' ? 'Ficha de manutenção' : 'Ficha de assistência';
    const L = linhasDoc(f, 'entrega').filter(([a]) => a !== 'Referência'); if (f.assinadoEm) L.push(['Assinado pelo cliente', (f.assinadoNome || '') + ' · ' + fD(f.assinadoEm)]);
    const T = tempos(f).filter(t => t.fim).sort((a, b) => (a.inicio || '').localeCompare(b.inicio || ''));
    return `<section class="pg"><div class="top"><img src="${esc(logo)}" alt=""><div class="ref"><span>${tipoT}</span><b>${esc(cod(f))}</b><span>${esc(estL(f))}${f.faturado ? ' · faturada' : ''}</span></div></div>
      <table>${L.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="pre">${esc(b)}</td></tr>`).join('')}${f.diagnostico ? `<tr><td>Diagnóstico</td><td class="pre">${esc(f.diagnostico)}</td></tr>` : ''}</table>
      ${T.length ? `<h2>Tempos</h2><table>${T.map(t => `<tr><td>${t.tipo === 'manual' ? esc(fDY(t.inicio)) + ' (manual)' : esc(fD(t.inicio))}${t.resp ? ' · ' + esc(nameOf(t.resp)) : ''}</td><td class="r">${esc(fmtMin(t.minutos))}</td></tr>`).join('')}<tr><td><b>Total</b></td><td class="r"><b>${esc(fmtMin(v.min))}</b>${v.fmin ? ` · a faturar ${esc(fmtMin(v.fmin))}` : ''}</td></tr></table>` : ''}
      ${P0.length ? `<h2>Peças aplicadas</h2><table><tr class="h"><td>Código</td><td>Peça</td><td class="r">Qt</td>${precos ? '<td class="r">Preço</td><td class="r">Total</td>' : ''}</tr>${P0.map(p => `<tr><td>${esc(p.ref || '')}</td><td>${esc(p.nome)}</td><td class="r">${esc(String(p.qt).replace('.', ','))}</td>${precos ? `<td class="r">${eur(p.preco)}</td><td class="r">${eur((+p.qt || 0) * (+p.preco || 0))}</td>` : ''}</tr>`).join('')}</table>` : ''}
      ${precos ? `<h2>Valores (sem IVA)</h2><table><tr><td>Mão de obra · ${esc(fmtMin(v.fmin))} × ${eur(precoH(f))}/h</td><td class="r">${eur(v.mo)}</td></tr>${fora(f) ? `<tr><td>Deslocação${v.desl ? ' · ' + esc(v.desl.txt) : ''}</td><td class="r">${eur(v.desl?.valor || 0)}</td></tr>` : ''}<tr><td>Peças</td><td class="r">${eur(v.pc)}</td></tr><tr><td><b>Total sem IVA</b></td><td class="r"><b>${eur(v.total)}</b></td></tr></table>` : ''}
      <div class="nota">${esc(nota(f))}</div>
      ${precos ? '' : `<div class="ass2"><div><div class="sg"></div><div class="ln">Técnico${f.tecnico ? ' · ' + esc(tecNome(f.tecnico)) : ''}</div></div><div><div class="sg">${ASS[f.assinatura] ? `<img src="${esc(ASS[f.assinatura])}" alt="Assinatura">` : ''}</div><div class="ln">Cliente${f.assinadoNome ? ' · ' + esc(f.assinadoNome) : ''}</div></div></div>`}</section>`;
  }
  let ASS = {};
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
      .nota{margin-top:14px;padding:8px 10px;background:#EEF4FB;border-left:4px solid #0090E0;font-size:9.5pt}.ass2{display:flex;gap:30px;margin-top:22px}.ass2>div{flex:1}.ass2 .sg{height:64px;display:flex;align-items:flex-end}.ass2 .sg img{max-height:62px;max-width:100%}.ass2 .ln{border-top:1px solid #333;padding-top:6px;font-size:9.5pt;color:#444}.ass{display:flex;gap:30px;margin-top:40px}.ass div{flex:1;border-top:1px solid #333;padding-top:6px;font-size:9pt;color:#444}
      @media screen{body{background:#eee}.pg{background:#fff;max-width:190mm;margin:16px auto;padding:14mm;box-shadow:0 1px 6px rgba(0,0,0,.2)}.b{text-align:center;margin:10px;font:14px Arial}}@media print{.b{display:none}}</style></head><body>
      <div class="b">${L.length} ficha${L.length > 1 ? 's' : ''} · ${precos ? 'com preços (uso interno)' : 'sem preços'} · <button onclick="print()">Guardar em PDF / Imprimir</button></div>
      ${(ASS = await urlsLongas(L.map(f => f.assinatura), 3600), L.map(f => pagFicha(f, precos, logo)).join(''))}
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
      if (f.emGarantia) return;
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
  ACT.ofiFatAll = async d => { for (const id of d.ids.split(',')) await patch('fichas', id, { faturado: true, faturadoEm: new Date().toISOString() }); closeSheet(); toast('Marcadas como faturadas'); };



  /* =================== MÁQUINAS (N.º DE SÉRIE), GARANTIAS E RETRABALHO =================== */
  const GAR = { pecas: 'Peças / reparação', maq_nova: 'Máquina nova', maq_usada: 'Máquina usada', sem: 'Sem garantia' };
  const gDias = f => { const c = cfg(), t = f?.garantiaTipo || 'pecas'; return t === 'sem' ? 0 : t === 'maq_nova' ? +(c.garantiaMaqNovaDias ?? 365) || 365 : t === 'maq_usada' ? +(c.garantiaMaqUsadaDias ?? 180) || 180 : +(c.garantiaDias ?? 30) || 30; };
  const durL = d => d % 365 === 0 ? (d / 365 === 1 ? '1 ano' : d / 365 + ' anos') : d % 30 === 0 && d >= 60 ? d / 30 + ' meses' : d + ' dias';
  const fimFecho = f => (f.entregueEm || f.prontoEm || '').slice(0, 10);
  const garantiaAte = f => { const d = fimFecho(f), n = gDias(f); if (!d || !n) return ''; const x = new Date(d + 'T12:00'); x.setDate(x.getDate() + n); return iso(x); };
  const nsN = v => String(v || '').replace(/[^0-9a-z]/gi, '').toUpperCase();
  // trabalho anterior ainda dentro da garantia: mesma máquina (n.º de série) ou o mesmo tipo de peça do mesmo cliente
  function anterior(f) {
    if (!f || fechada(f) || f.tipo === 'guarda') return null;
    const ent0 = (f.entrada || TODAY()).slice(0, 10);
    const C = D('fichas').filter(x => x.id !== f.id && fechada(x) && garantiaAte(x) && garantiaAte(x) >= ent0 && fimFecho(x) <= ent0);
    const ns = nsN(f.nSerie);
    if (ns) { const m = C.filter(x => nsN(x.nSerie) === ns).sort((a, b) => fimFecho(b).localeCompare(fimFecho(a)))[0]; if (m) return { f: m, certo: true }; }
    if (f.equipamento && f.equipamento !== 'Máquina completa') { const m = C.filter(x => x.entidade === f.entidade && x.equipamento === f.equipamento && !nsN(x.nSerie)).sort((a, b) => fimFecho(b).localeCompare(fimFecho(a)))[0]; if (m) return { f: m, certo: false }; }
    return null;
  }
  function avisoGarantia(f) {
    if (!temMod('garantias')) return '';
    if (f.emGarantia) { const o = S.data.fichas.get(f.garantiaDe); return `<div class="of-alert" style="border-color:var(--ok,#1a7f4b)"><span style="flex:1"><b>Reparação em garantia</b><br><span class="note">Não se fatura ao cliente${o ? ` · garantia da ficha ${esc(cod(o))} de ${fDY(fimFecho(o))}` : ''}.</span></span>${S.canWrite ? `<button class="btn sm" data-act="ofiGar" data-id="${f.id}" data-c="0">Tirar da garantia</button>` : ''}</div>`; }
    const a = anterior(f); if (!a) return '';
    return `<div class="of-alert" style="border-color:#B45309"><span style="flex:1"><b>${a.certo ? 'Retrabalho: esta máquina' : 'Possível retrabalho: este cliente'} já teve ${a.certo ? 'uma reparação' : 'uma reparação de ' + esc(f.equipamento)} a ${fDY(fimFecho(a.f))}</b><br><span class="note">Ficha ${esc(cod(a.f))} · garantia até ${fDY(garantiaAte(a.f))}${a.f.trabalho ? ' · ' + esc(a.f.trabalho) : ''}${a.certo ? '' : '. As peças não têm n.º de série: confirme se é a mesma.'}</span></span>
      <button class="btn sm" data-act="ofiOpen" data-id="${a.f.id}">Ver ficha anterior</button>${S.canWrite ? `<button class="btn sm pri" data-act="ofiGar" data-id="${f.id}" data-c="1" data-g="${a.f.id}">Marcar como garantia</button>` : ''}</div>`;
  }
  ACT.ofiGarT = d => patch('fichas', d.id, { garantiaTipo: d.c });
  ACT.ofiGar = async d => { const on = d.c === '1'; if (await patch('fichas', d.id, { emGarantia: on, garantiaDe: on ? d.g || null : null })) toast(on ? 'Marcada como garantia: não se fatura' : 'Tirada da garantia'); };

  // histórico de cada máquina pelo n.º de série
  function maquinasSerie() {
    const m = new Map();
    D('fichas').forEach(f => { const ns = nsN(f.nSerie); if (!ns) return; if (!m.has(ns)) m.set(ns, []); m.get(ns).push(f); });
    return [...m.entries()].map(([ns, L]) => { L.sort((a, b) => (a.entrada || '').localeCompare(b.entrada || '')); const ult = L[L.length - 1]; return { ns, nome: [...L].reverse().find(f => f.nSerie)?.nSerie || ns, L, ult, modelo: [...L].reverse().find(f => f.modelo)?.modelo || '', marca: [...L].reverse().find(f => f.marca)?.marca || '' }; });
  }
  VIEWS.equip = () => loadingOr(() => {
    const q = norm(S.q.equip || ''); let M = maquinasSerie().filter(x => !q || norm(x.ns + ' ' + x.modelo + ' ' + entName(x.ult.entidade)).includes(q)).sort((a, b) => (b.ult.entrada || '').localeCompare(a.ult.entrada || ''));
    return `<div class="pg">${roBanner()}<div class="tb"><div class="tbr"><label class="srch">${ic('search', 18)}<input id="q-equip" data-q="equip" type="search" placeholder="N.º de série, modelo ou cliente" value="${esc(S.q.equip || '')}" autocomplete="off"></label></div></div>
      <p class="note" style="margin:0">Cada máquina pelo n.º de série, com todas as intervenções. As peças soltas não têm n.º de série: ficam no histórico do cliente.</p>
      ${listBlock('equip', M, x => { const ga = fechada(x.ult) ? garantiaAte(x.ult) : ''; return `<div class="row" role="button" tabindex="0" data-act="ofiEquip" data-c="${esc(x.ns)}"><span class="rt"><span class="r1">${esc(x.nome)} · ${esc([x.marca, x.modelo].filter(Boolean).join(' '))}</span><span class="r2">${esc(entName(x.ult.entidade))} · ${x.L.length} ${x.L.length === 1 ? 'intervenção' : 'intervenções'} · última ${fDY(x.ult.entrada)}</span></span><span class="rr">${naCasa(x.ult) ? badge('Na empresa', 'info') : ''}${ga && ga >= TODAY() ? badge('Garantia até ' + fDY(ga), 'ok') : ''}</span></div>`; }, '<b>Sem máquinas com n.º de série</b>Escreva o n.º de série nas fichas das máquinas.')}</div>`;
  });
  ACT.ofiEquip = d => go('equipum', { ns: nsN(d.c) });
  VIEWS.equipum = () => loadingOr(() => {
    const x = maquinasSerie().find(m => m.ns === S.params.ns); if (!x) return '<div class="panel empty"><b>Máquina não encontrada</b></div>';
    const min = x.L.reduce((a, f) => a + minReal(f), 0), pecas = x.L.reduce((a, f) => a + (f.pecas || []).reduce((s, p) => s + (+p.qt || 0), 0), 0);
    return `<div class="pg"><div><button class="btn sm" data-act="go" data-v="equip">${ic('back', 16)}Máquinas</button></div>
      <div class="fh"><div style="flex:1"><h1>${esc(x.nome)}</h1><div class="meta">${badge([x.marca, x.modelo].filter(Boolean).join(' ') || 'Máquina', 'gold')}${badge(entName(x.ult.entidade))}</div></div></div>
      <div class="mini"><div><span>Intervenções</span><b>${x.L.length}</b></div><div><span>Tempo total</span><b>${fmtMin(min)}</b></div><div><span>Peças aplicadas</span><b>${pecas}</b></div>${S.verValores ? `<div><span>Faturado</span><b>${eur(x.L.filter(f => f.faturado && !f.emGarantia).reduce((a, f) => a + valores(f).total, 0))}</b></div>` : ''}</div>
      <div class="panel"><div class="ph"><h2>Histórico</h2></div>${[...x.L].reverse().map(f => `<div class="row" role="button" tabindex="0" data-act="ofiOpen" data-id="${f.id}"><span class="of-n">${f.numero ?? '•'}</span><span class="rt"><span class="r1">${fDY(f.entrada)} · ${esc(cod(f))}${f.emGarantia ? ' · garantia' : ''}</span><span class="r2">${esc([f.avaria, f.trabalho, (f.pecas || []).map(p => p.qt + '× ' + p.nome).join(', ')].filter(Boolean).join(' · '))}</span></span><span class="rr">${badge(estL(f), EST_T[f.estado])}${f.tecnico ? `<span class="note">${esc(tecNome(f.tecnico))}</span>` : ''}</span></div>`).join('')}</div></div>`;
  });

  /* =================== STOCK DE PEÇAS =================== */
  const stockDe = id => { try { const s = window.stockMap ? window.stockMap().get(id) : null; return s ? s.atual : null; } catch (_) { return null; } };
  let SMc = null, SMk = '';
  const stockAll = () => { const k = D('stock_mov').length + ':' + D('artigos').length; if (SMc && SMk === k) return SMc; SMc = window.stockMap ? window.stockMap() : new Map(); SMk = k; return SMc; };
  const stk = id => { const s = stockAll().get(id); return s ? Math.round(s.atual * 100) / 100 : 0; };
  const stkH = a => { if (!a || !temMod('stock')) return ''; const n = stk(a.id); return ` · <span style="color:${n <= 0 ? 'var(--bad)' : a.stockMin != null && n <= a.stockMin ? '#B45309' : 'inherit'}">stock ${String(n).replace('.', ',')}</span>`; };
  // a peça aplicada na ficha abate ao stock (um movimento "peça" por artigo e por ficha)
  const syncA = new Map();
  async function syncStock(fid) {
    if (!temMod('stock')) return;
    if (syncA.get(fid)) { syncA.set(fid, 2); return; } syncA.set(fid, 1);
    try {
      const f = fx(fid); if (!f) return;
      const quer = new Map(); (f.pecas || []).forEach(p => { if (p.artigo && S.data.artigos.has(p.artigo)) quer.set(p.artigo, (quer.get(p.artigo) || 0) + (+p.qt || 0)); });
      const tem = D('stock_mov').filter(m => m.ficha === fid && m.tipo === 'peca');
      for (const m of tem) { const q = quer.get(m.artigo); if (!q) await remove('stock_mov', m.id); else if (+m.qt !== q) await patch('stock_mov', m.id, { qt: q }); quer.delete(m.artigo); }
      for (const [artigo, qt] of quer) if (qt > 0) await save('stock_mov', null, { data: TODAY(), tipo: 'peca', artigo, qt, ficha: fid, notas: 'Aplicada na ficha ' + cod(f) });
    } finally { const again = syncA.get(fid) === 2; syncA.delete(fid); if (again) syncStock(fid); }
  }
  const patchF0 = patch;
  patch = async (col, id, p) => { const r = await patchF0(col, id, p); if (r && col === 'fichas' && p && 'pecas' in p) syncStock(id); return r; };
  // necessidades dos planos ainda por fazer
  function precisoPlanos() {
    const m = new Map();
    D('planos').filter(p => p.estado !== 'feito').forEach(p => (p.lotes || []).forEach(l => { const n = (l.fichas || []).map(id => S.data.fichas.get(id)).filter(f => f && !fechada(f)).length; if (!n) return; kitPara(l.equipamento, l.modelo).pecas.forEach(k => { const a = porRef(k.ref); if (a) m.set(a.id, (m.get(a.id) || 0) + (+k.qt || 0) * n); }); }));
    return m;
  }
  function aEncomendar() {
    const prec = precisoPlanos(), L = [];
    D('artigos').filter(isPeca).forEach(a => { const st = stk(a.id), min = +a.stockMin || 0, nec = prec.get(a.id) || 0; if (a.stockMin == null && !nec) return; const falta = Math.max(0, min + nec - st); if (falta > 0 || st < min) L.push({ a, st, min, nec, falta: Math.ceil(falta) }); });
    return L.sort((x, y) => (x.a.fornecedor || '').localeCompare(y.a.fornecedor || '', 'pt') || x.a.nome.localeCompare(y.a.nome, 'pt'));
  }
  VIEWS.encomendarp = () => loadingOr(() => {
    const L = aEncomendar(), forn = [...new Set(L.map(x => x.a.fornecedor || 'Sem fornecedor'))];
    return `<div class="pg">${roBanner()}<p class="note" style="margin:0">Peças abaixo do stock mínimo e peças que faltam para os planos de trabalho marcados. As peças aplicadas nas fichas abatem automaticamente ao stock. As entradas fazem-se em «Stock do armazém».</p>
      ${L.length ? forn.map(fo => { const X = L.filter(x => (x.a.fornecedor || 'Sem fornecedor') === fo); return `<div class="panel"><div class="ph"><h2>${esc(fo)}</h2><button class="lnk" data-act="ofiEncMail" data-c="${esc(fo)}">Enviar lista por email</button></div>
        <div style="overflow:auto"><table class="tt" style="min-width:520px"><thead><tr><th style="text-align:left">Peça</th><th>Stock</th><th>Mínimo</th><th>Para os planos</th><th>Encomendar</th></tr></thead><tbody>${X.map(x => `<tr data-act="open" data-col="artigos" data-id="${x.a.id}" style="cursor:pointer"><td>${esc(x.a.nome)}<br><small style="color:var(--ink-3)">${esc(x.a.ref || '')}</small></td><td class="num" style="color:${x.st <= 0 ? 'var(--bad)' : 'inherit'}">${String(x.st).replace('.', ',')}</td><td class="num">${x.a.stockMin ?? '—'}</td><td class="num">${x.nec || '—'}</td><td class="num"><b>${x.falta}</b></td></tr>`).join('')}</tbody></table></div></div>`; }).join('') : '<div class="panel empty"><b>Nada para encomendar</b>Defina o stock mínimo das peças na ficha de cada artigo.</div>'}</div>`;
  });
  ACT.ofiEncMail = d => {
    const X = aEncomendar().filter(x => (x.a.fornecedor || 'Sem fornecedor') === d.c && x.falta > 0); if (!X.length) return toast('Nada para encomendar a este fornecedor');
    const txt = `Bom dia,\n\nGostaríamos de encomendar:\n\n${X.map(x => `- ${x.falta} × ${x.a.ref || ''} ${x.a.nome}`).join('\n')}\n\nObrigado.${assinOf()}`;
    location.href = `mailto:?subject=${encodeURIComponent('Encomenda de peças · ' + cfg().empresa)}&body=${encodeURIComponent(txt)}`;
  };
  // ficha do artigo: stock mínimo e fornecedor
  if (F.artigos && !F.artigos.some(f => f.k === 'stockMin')) F.artigos.push({ k: 'stockMin', l: 'Stock mínimo (avisa para encomendar)', t: 'num' }, { k: 'fornecedor', l: 'Fornecedor', t: 'text' });

  /* =================== PLANEAMENTO, MÉDIAS E RENDIMENTO =================== */
  P.chart = P.chart || 'M4 20V10M10 20V4M16 20v-7M22 20H2';
  const PER = { manha: 'Manhã', tarde: 'Tarde', dia: 'Dia inteiro' };
  const capPer = p => { const c = cfg(); return p === 'tarde' ? (+c.tardeMin || 240) : p === 'dia' ? (+c.manhaMin || 240) + (+c.tardeMin || 240) : (+c.manhaMin || 240); };
  const fechada = f => ['pronto', 'entregue'].includes(f.estado);
  const minReal = f => tempos(f).reduce((s, t) => s + (t.fim ? (+t.minutos || 0) : 0), 0);
  // quota de cada técnico numa ficha (pelo tempo)
  function quotas(f) {
    const m = new Map(); let tot = 0;
    tempos(f).forEach(t => { if (!t.fim || !t.tecnico) return; m.set(t.tecnico, (m.get(t.tecnico) || 0) + (+t.minutos || 0)); tot += +t.minutos || 0; });
    if (!tot && f.tecnico) return new Map([[f.tecnico, 1]]);
    const q = new Map(); m.forEach((v, k) => q.set(k, tot ? v / tot : 0)); return q;
  }
  // médias de tempo por tipo de trabalho (só oficina)
  let MED = null, MEDk = '';
  function medias() {
    const key = D('fichas').length + ':' + D('fichas_tempos').length + ':' + D('tempos_padrao').length;
    if (MED && MEDk === key) return MED;
    const g = new Map();
    D('fichas').filter(f => f.tipo === 'oficina' && fechada(f) && f.equipamento).forEach(f => {
      const min = minReal(f); if (min <= 0) return;
      const k = f.equipamento; if (!g.has(k)) g.set(k, { all: [], tec: new Map() }); const o = g.get(k); o.all.push(min);
      quotas(f).forEach((q, tid) => { if (q >= .8) { if (!o.tec.has(tid)) o.tec.set(tid, []); o.tec.get(tid).push(min); } });
    });
    D('tempos_padrao').forEach(t => { if (!g.has(t.equipamento)) g.set(t.equipamento, { all: [], tec: new Map() }); });
    const st = L => { if (!L.length) return null; const r = L.slice(-40); const avg = r.reduce((a, b) => a + b, 0) / r.length; return { n: L.length, avg, min: Math.min(...r), max: Math.max(...r) }; };
    MED = new Map(); g.forEach((o, k) => { const tec = new Map(); o.tec.forEach((L, tid) => tec.set(tid, st(L))); MED.set(k, { geral: st(o.all), tec }); }); MEDk = key; return MED;
  }
  const padrao = eq => D('tempos_padrao').find(t => norm(t.equipamento) === norm(eq))?.minutos;
  function estimativa(eq, tid) {
    const m = medias().get(eq), t = tid && m?.tec.get(tid);
    if (t && t.n >= 3) return { min: t.avg, fonte: 'média deste técnico (' + t.n + ')' };
    if (m?.geral && m.geral.n >= 3) return { min: m.geral.avg, fonte: 'média geral (' + m.geral.n + ')' };
    const p = padrao(eq); if (p) return { min: p, fonte: 'tempo padrão' };
    return { min: 45, fonte: 'tempo padrão' };
  }
  // kit de peças: definido à mão ou tirado do histórico
  function kitPara(eq, mod) {
    const k = D('kits').find(x => norm(x.equipamento) === norm(eq) && (!x.modelo || !mod || norm(x.modelo) === norm(mod)));
    if (k && (k.pecas || []).length) return { pecas: k.pecas, fonte: 'kit', id: k.id };
    const F0 = D('fichas').filter(f => f.tipo === 'oficina' && fechada(f) && f.equipamento === eq && (!mod || f.modelo === mod)).slice(-60);
    if (F0.length < 3) return { pecas: [], fonte: 'sem histórico' };
    const c = new Map(); F0.forEach(f => (f.pecas || []).forEach(p => { if (!p.ref) return; const o = c.get(p.ref) || { n: 0, qt: 0 }; o.n++; o.qt += +p.qt || 0; c.set(p.ref, o); }));
    const pecas = [...c.entries()].filter(([, o]) => o.n / F0.length >= .3).map(([ref, o]) => ({ ref, qt: Math.max(1, Math.round(o.qt / o.n)) }));
    return { pecas, fonte: 'histórico (' + F0.length + ' fichas)' };
  }
  function pecasLote(L) { // L = [{equipamento, modelo, fichas:[ids]}]
    const tot = new Map();
    L.forEach(l => { const k = kitPara(l.equipamento, l.modelo); k.pecas.forEach(p => tot.set(p.ref, (tot.get(p.ref) || 0) + (+p.qt || 0) * l.fichas.length)); });
    return [...tot.entries()].map(([ref, qt]) => ({ ref, qt, a: porRef(ref) })).sort((a, b) => (a.a?.nome || a.ref).localeCompare(b.a?.nome || b.ref, 'pt'));
  }
  const emPlano = () => { const s = new Set(); D('planos').filter(p => p.estado !== 'feito').forEach(p => (p.lotes || []).forEach(l => (l.fichas || []).forEach(id => s.add(id)))); return s; };
  const PRONTAS_PARA = ['recebido', 'diagnostico', 'reparacao'];
  function gerarPlano(tid, periodo, modo) {
    const cap = capPer(periodo), ocup = emPlano();
    const C = D('fichas').filter(f => f.tipo === 'oficina' && PRONTAS_PARA.includes(f.estado) && !ocup.has(f.id) && (!f.tecnico || f.tecnico === tid)).sort((a, b) => (a.entrada || '').localeCompare(b.entrada || ''));
    let livre = cap; const lotes = [];
    const poe = (f) => { const e = estimativa(f.equipamento, tid).min; if (e > livre && (lotes.length || e > cap * 1.15)) return false; let l = modo === 'lotes' ? lotes.find(x => x.equipamento === f.equipamento && x.modelo === (f.modelo || '')) : null; if (!l) { l = { equipamento: f.equipamento, modelo: f.modelo || '', fichas: [], est: 0 }; lotes.push(l); } l.fichas.push(f.id); l.est += e; livre -= e; return true; };
    if (modo === 'lotes') {
      const g = new Map(); C.forEach(f => { const k = f.equipamento + '|' + (f.modelo || ''); if (!g.has(k)) g.set(k, []); g.get(k).push(f); });
      const grupos = [...g.values()].sort((a, b) => b.length - a.length || (a[0].entrada || '').localeCompare(b[0].entrada || ''));
      grupos.forEach(G => G.forEach(f => { if (livre > 10) poe(f); }));
    } else C.forEach(f => { if (livre > 10) poe(f); });
    lotes.forEach(l => l.est = Math.round(l.est));
    return { lotes, cap, usado: cap - livre };
  }
  const proxUtil = () => { const d = new Date(); d.setDate(d.getDate() + 1); while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1); return iso(d); };

  function loteH(l, i, tid, extra = '') {
    const F = l.fichas.map(id => S.data.fichas.get(id)).filter(Boolean);
    return `<div class="panel"><div class="ph"><h2>Lote ${i + 1} · ${F.length} × ${esc(l.equipamento)}</h2><span class="note">≈ ${fmtMin(l.est)}${l.min != null ? ' · feito em ' + fmtMin(l.min) : ''}</span></div>
      <div class="pb" style="padding-bottom:4px"><p class="note" style="margin:0">${esc(l.modelo || '')} · ${esc(estimativa(l.equipamento, tid).fonte)} · ${fmtMin(estimativa(l.equipamento, tid).min)} cada</p></div>
      ${F.map(f => `<div class="row" role="button" tabindex="0" data-act="ofiOpen" data-id="${f.id}"><span class="of-n">${f.numero ?? "•"}</span><span class="rt"><span class="r1">${esc(cod(f))} · ${esc(prop(f))}</span><span class="r2">${esc([f.avaria, 'entrou ' + fDY(f.entrada)].filter(Boolean).join(' · '))}</span></span><span class="rr">${badge(estL(f), EST_T[f.estado])}<span class="note" style="${dias(f) > 30 ? 'color:var(--bad);font-weight:500' : ''}">${dias(f)} d</span></span></div>`).join('')}${extra}</div>`;
  }
  function pecasH(L, plano) {
    const P0 = pecasLote(L); if (!P0.length) return `<div class="panel"><div class="ph"><h2>Peças a preparar</h2></div><div class="pb"><p class="note" style="margin:0">Sem kit para estes trabalhos. Defina os kits em «Tempos e kits».</p></div></div>`;
    const prep = new Set(plano?.preparadas || []);
    return `<div class="panel"><div class="ph"><h2>Peças a preparar</h2><span class="note">${plano ? prep.size + ' de ' + P0.length + ' preparadas' : P0.length + ' referências'}</span></div><div class="pb">
      ${P0.map(p => `<label class="of-pc" style="cursor:${plano ? 'pointer' : 'default'}">${plano ? `<input type="checkbox" data-ofprep="${plano.id}" value="${esc(p.ref)}" ${prep.has(p.ref) ? 'checked' : ''} style="width:22px;height:22px">` : ''}<span class="grow">${esc(p.a?.nome || 'Peça ' + p.ref)}<small>${esc(p.ref)}${p.a ? stkH(p.a) : ''}${p.a && stk(p.a.id) < p.qt ? ` · <b style="color:var(--bad)">faltam ${Math.ceil(p.qt - Math.max(0, stk(p.a.id)))}</b>` : ''}</small></span><b class="num">${p.qt}</b></label>`).join('')}
      <p class="note" style="margin:10px 0 0">Prepare as peças antes de começar, para não perder tempo à procura.</p></div></div>`;
  }

  /* ----- Planear trabalho ----- */
  VIEWS.planear = () => loadingOr(() => {
    const T = TECS(), st = S.ofPlan || (S.ofPlan = { tec: meuTec()?.id || T[0]?.id || '', data: proxUtil(), periodo: 'manha', modo: 'lotes' });
    const prop0 = S.ofPlanProp;
    const futuros = D('planos').filter(p => p.data >= TODAY() && p.estado !== 'feito').sort((a, b) => (a.data + a.periodo).localeCompare(b.data + b.periodo));
    return `<div class="pg">${roBanner()}
      <div class="panel"><div class="ph"><h2>Organizar o trabalho de um técnico</h2></div><div class="pb"><div class="fg" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
        <div class="fld"><label for="pl-t">Técnico</label><select id="pl-t" data-ofpl="tec">${T.map(t => `<option value="${t.id}" ${t.id === st.tec ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}</select></div>
        <div class="fld"><label for="pl-d">Dia</label><input id="pl-d" type="date" data-ofpl="data" value="${st.data}"></div>
        <div class="fld"><label for="pl-p">Período</label><select id="pl-p" data-ofpl="periodo">${Object.entries(PER).map(([k, l]) => `<option value="${k}" ${k === st.periodo ? 'selected' : ''}>${l} (${fmtMin(capPer(k))})</option>`).join('')}</select></div>
        <div class="fld"><label for="pl-m">Como organizar</label><select id="pl-m" data-ofpl="modo"><option value="lotes" ${st.modo === 'lotes' ? 'selected' : ''}>Por lotes de trabalhos iguais</option><option value="antigas" ${st.modo === 'antigas' ? 'selected' : ''}>As fichas mais antigas</option></select></div></div>
        ${S.canWrite ? `<button class="btn pri of-big" data-act="ofiPlanGerar">${ic('cal', 18)}Gerar plano</button>` : ''}</div></div>
      ${prop0 ? `<div class="of-alert" style="border-color:var(--brand)"><span style="flex:1"><b>${esc(tecNome(prop0.tec))} · ${PER[prop0.periodo]} de ${fDY(prop0.data)}</b><br><span class="note">Ocupação ≈ ${fmtMin(prop0.usado)} de ${fmtMin(prop0.cap)} · ${prop0.lotes.reduce((a, l) => a + l.fichas.length, 0)} fichas em ${prop0.lotes.length} ${prop0.lotes.length === 1 ? 'lote' : 'lotes'}</span></span>${prop0.lotes.length ? `<button class="btn pri" data-act="ofiPlanOk">Confirmar plano</button>` : ''}</div>
        ${prop0.lotes.length ? prop0.lotes.map((l, i) => loteH(l, i, prop0.tec)).join('') + pecasH(prop0.lotes) : '<div class="panel empty"><b>Não há trabalho para planear</b>Todas as fichas em espera já estão noutro plano.</div>'}` : ''}
      <div class="panel"><div class="ph"><h2>Planos marcados</h2><span class="note">${futuros.length}</span></div>${futuros.length ? futuros.map(p => `<div class="row" role="button" tabindex="0" data-act="ofiPlanVer" data-id="${p.id}"><span class="rt"><span class="r1">${esc(tecNome(p.tecnico))} · ${PER[p.periodo]} de ${fDY(p.data)}</span><span class="r2">${esc((p.lotes || []).map(l => (l.fichas || []).length + ' × ' + l.equipamento).join(' · '))}</span></span><span class="rr">${badge(p.estado === 'em_curso' ? 'Em curso' : 'Planeado', p.estado === 'em_curso' ? 'warn' : 'info')}${S.canWrite ? `<button class="ib" data-act="ofiPlanDel" data-id="${p.id}" aria-label="Apagar plano">${ic('x', 14)}</button>` : ''}</span></div>`).join('') : '<div class="pb"><p class="note" style="margin:0">Nenhum plano marcado.</p></div>'}</div>
    </div>`;
  });
  ACT.ofiPlanGerar = () => { const st = S.ofPlan; if (!st.tec) return toast('Escolha o técnico'); const r = gerarPlano(st.tec, st.periodo, st.modo); S.ofPlanProp = { ...st, ...r }; render(); };
  ACT.ofiPlanOk = async (d, b) => {
    const p = S.ofPlanProp; if (!p) return; b.disabled = true;
    const id = await save('planos', null, { data: p.data, periodo: p.periodo, tecnico: p.tec, modo: p.modo, lotes: p.lotes.map(l => ({ equipamento: l.equipamento, modelo: l.modelo, fichas: l.fichas, est: l.est })), preparadas: [], estado: 'planeado' });
    if (id) { for (const l of p.lotes) for (const fid of l.fichas) await patch('fichas', fid, { tecnico: p.tec }); S.ofPlanProp = null; toast('Plano marcado para ' + tecNome(p.tec)); }
    b.disabled = false;
  };
  ACT.ofiPlanVer = d => { const p = S.data.planos.get(d.id); if (!p) return; S.ofDiaTec = p.tecnico; S.ofDiaData = p.data; go('meudia'); };
  ACT.ofiPlanDel = async d => { if (!confirm('Apagar este plano? As fichas voltam a ficar livres.')) return; if (await remove('planos', d.id)) toast('Plano apagado'); };

  /* ----- O meu dia ----- */
  VIEWS.meudia = () => loadingOr(() => {
    const T = TECS(), eu = meuTec(), tid = S.ofDiaTec || eu?.id || T[0]?.id, dia = S.ofDiaData || TODAY();
    const PL = D('planos').filter(p => p.tecnico === tid && p.data === dia).sort((a, b) => a.periodo.localeCompare(b.periodo) * -1);
    const prox = D('planos').filter(p => p.tecnico === tid && p.data > dia && p.estado !== 'feito').sort((a, b) => a.data.localeCompare(b.data))[0];
    let h = `<div class="pg">${roBanner()}<div class="of-row2">${!eu || S.isAdmin ? `<div class="fld" style="margin:0;min-width:150px"><label for="md-t">Técnico</label><select id="md-t" data-ofdia="tec">${T.map(t => `<option value="${t.id}" ${t.id === tid ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}</select></div>` : `<h2 style="margin:0;flex:1">${esc(eu.nome)}</h2>`}<div class="fld" style="margin:0;width:170px"><label for="md-d">Dia</label><input id="md-d" type="date" data-ofdia="data" value="${dia}"></div></div>`;
    if (!PL.length) return h + `<div class="panel empty"><b>Sem plano para este dia</b>${S.canWrite ? 'Use «Planear trabalho» para organizar o dia.' : ''}${prox ? `<br><button class="btn sm" style="margin-top:10px" data-act="ofiPlanVer" data-id="${prox.id}">Ver o próximo: ${fDY(prox.data)}</button>` : ''}</div>${S.canWrite ? `<div><button class="btn" data-act="go" data-v="planear">${ic('cal', 16)}Planear trabalho</button></div>` : ''}</div>`;
    PL.forEach(p => {
      const L = p.lotes || [], est = L.reduce((a, l) => a + (+l.est || 0), 0);
      const F = L.flatMap(l => l.fichas || []).map(id => S.data.fichas.get(id)).filter(Boolean), feitas = F.filter(fechada);
      const real = L.reduce((a, l) => a + (+l.min || 0), 0), estFeitas = feitas.reduce((a, f) => a + estimativa(f.equipamento, tid).min, 0);
      const rend = real >= 10 && feitas.length ? Math.round(estFeitas / real * 100) : null;
      h += `<div class="mini"><div><span>${PER[p.periodo]}</span><b>${feitas.length} de ${F.length} fichas</b></div><div><span>Planeado</span><b>${fmtMin(est)}</b></div><div><span>Tempo gasto</span><b>${fmtMin(real)}</b></div><div><span>Rendimento</span><b style="color:${rend == null ? 'inherit' : rend >= 100 ? 'var(--ok,#1a7f4b)' : rend < 80 ? 'var(--bad)' : 'inherit'}">${rend == null ? '—' : rend + ' %'}</b></div></div>`;
      h += pecasH(L, p);
      L.forEach((l, i) => {
        const corre = l.ini && !l.fim, abertas = (l.fichas || []).map(id => S.data.fichas.get(id)).filter(f => f && !fechada(f)).length;
        const bot = S.canWrite ? `<div class="pb"><div class="of-row2">${corre ? `<div style="flex:1"><div class="of-crono" id="ofcrono" data-ini="${esc(l.ini)}">00:00:00</div><span class="note">Lote a contar desde ${fD(l.ini)}</span></div><button class="btn pri of-big of-stop" style="flex:0 0 190px" data-act="ofiLoteStop" data-id="${p.id}" data-i="${i}">${ic('clock', 18)}Parar lote</button>` : abertas ? `<button class="btn pri of-big" data-act="ofiLoteStart" data-id="${p.id}" data-i="${i}">${ic('clock', 18)}Iniciar lote (${abertas} ${abertas === 1 ? 'ficha' : 'fichas'})</button>` : `<span class="note">Lote concluído${l.min != null ? ' em ' + fmtMin(l.min) : ''}.</span>`}</div></div>` : '';
        h += loteH(l, i, tid, bot);
      });
      if (S.canWrite && p.estado !== 'feito' && F.length && feitas.length === F.length) h += `<div><button class="btn" data-act="ofiPlanFim" data-id="${p.id}">Fechar o plano</button></div>`;
    });
    return h + '</div>';
  });
  ACT.ofiLoteStart = async d => {
    const p = S.data.planos.get(d.id); if (!p || !canAct()) return; if ((p.lotes || []).some(l => l.ini && !l.fim)) return toast('Já há um lote a contar. Pare-o primeiro.');
    const L = clone(p.lotes); L[+d.i].ini = new Date().toISOString(); L[+d.i].fim = null;
    await patch('planos', p.id, { lotes: L, estado: 'em_curso' });
    for (const id of L[+d.i].fichas) { const f = S.data.fichas.get(id); if (f && f.estado === 'recebido') await patch('fichas', id, { estado: 'reparacao' }); }
    toast('Lote a contar');
  };
  ACT.ofiLoteStop = d => {
    const p = S.data.planos.get(d.id); if (!p) return; const l = p.lotes[+d.i], F = (l.fichas || []).map(id => S.data.fichas.get(id)).filter(f => f && !fechada(f));
    const min = Math.max(1, Math.round((Date.now() - new Date(l.ini)) / 60000));
    openSheet(`<div class="sh"><h2>Parar lote · ${fmtMin(min)}</h2><button class="ib" data-act="close" aria-label="Fechar">${ic('x')}</button></div><div class="sb">
      <p class="note" style="margin-top:0">Marque as fichas que ficaram prontas. O tempo divide-se por elas e conta para as médias.</p>
      ${F.map(f => `<label class="of-pc" style="cursor:pointer"><input type="checkbox" class="of-lchk" value="${f.id}" checked style="width:22px;height:22px"><span class="grow">${esc(cod(f))} · ${esc(f.equipamento)}<small>${esc(prop(f))}</small></span></label>`).join('')}</div>
      <div class="sf"><span class="grow"></span><button class="btn" data-act="close">Continuar a contar</button><button class="btn pri" data-act="ofiLoteFim" data-id="${p.id}" data-i="${d.i}">Parar e guardar</button></div>`);
  };
  ACT.ofiLoteFim = async (d, b) => {
    const p = S.data.planos.get(d.id); if (!p) return; b.disabled = true;
    const L = clone(p.lotes), l = L[+d.i], fim = new Date(), min = Math.max(1, Math.round((fim - new Date(l.ini)) / 60000));
    const ok = [...document.querySelectorAll('.of-lchk:checked')].map(x => x.value), tid = p.tecnico;
    const cada = ok.length ? Math.max(1, Math.round(min / ok.length)) : 0;
    for (const id of ok) {
      await save('fichas_tempos', null, { ficha: id, tipo: 'trabalho', inicio: l.ini, fim: fim.toISOString(), minutos: cada, resp: S.uid || null, tecnico: tid, plano: p.id });
      await patch('fichas', id, { estado: 'pronto', prontoEm: fim.toISOString(), tecnico: tid });
    }
    l.fim = fim.toISOString(); l.min = (+l.min || 0) + min; l.feitas = (l.feitas || 0) + ok.length;
    if (ok.length < (l.fichas || []).length) l.ini = null;
    await patch('planos', p.id, { lotes: L });
    closeSheet(); toast(ok.length ? `${ok.length} prontas · ${fmtMin(cada)} cada` : 'Lote parado');
  };
  ACT.ofiPlanFim = async d => { await patch('planos', d.id, { estado: 'feito' }); toast('Plano fechado'); };
  document.addEventListener('change', async e => {
    const t = e.target, ds = t.dataset || {};
    if (ds.ofpl && S.ofPlan) { S.ofPlan[ds.ofpl] = t.value; S.ofPlanProp = null; render(); }
    if (ds.ofdia) { if (ds.ofdia === 'tec') S.ofDiaTec = t.value; else S.ofDiaData = t.value; render(); }
    if (ds.ofprep && S.canWrite) { const p = S.data.planos.get(ds.ofprep); if (!p) return; const s = new Set(p.preparadas || []); t.checked ? s.add(t.value) : s.delete(t.value); await patch('planos', p.id, { preparadas: [...s] }); }
    if (ds.oftp && S.canWrite) { const v = parseInt(t.value, 10); if (!(v > 0)) return toast('Minutos inválidos'); const x = D('tempos_padrao').find(z => z.equipamento === ds.oftp); if (x) await patch('tempos_padrao', x.id, { minutos: v }); else await save('tempos_padrao', null, { equipamento: ds.oftp, minutos: v }); toast('Tempo padrão guardado'); }
  });

  /* ----- Tempos e kits ----- */
  VIEWS.tempos = () => loadingOr(() => {
    const M = medias(), T = TECS(), eqs = [...new Set([...M.keys(), ...EQUIP])].filter(k => k !== 'Máquina completa' || M.has(k)).sort((a, b) => (M.get(b)?.geral?.n || 0) - (M.get(a)?.geral?.n || 0) || a.localeCompare(b, 'pt'));
    return `<div class="pg">${roBanner()}<p class="note" style="margin:0">Médias com o tempo real das fichas concluídas na oficina (cronómetro, tempo à mão e lotes). Até haver 3 trabalhos usa-se o tempo padrão. O planeador usa a média do técnico quando ele já tem 3 ou mais.</p>
      <div class="panel" style="overflow:auto"><table class="tt" style="min-width:640px"><thead><tr><th style="text-align:left">Trabalho</th><th>Padrão (min)</th><th>Média geral</th>${T.map(t => `<th>${esc(t.nome)}</th>`).join('')}<th>Kit</th></tr></thead><tbody>
      ${eqs.map(eq => { const m = M.get(eq), k = kitPara(eq, 'Brio 250'); return `<tr><td><b>${esc(eq)}</b></td><td><input type="number" min="1" step="1" style="width:72px" data-oftp="${esc(eq)}" value="${padrao(eq) ?? ''}" placeholder="45" ${S.canWrite ? '' : 'disabled'}></td><td class="num">${m?.geral ? `<b>${fmtMin(m.geral.avg)}</b><br><small style="color:var(--ink-3)">${m.geral.n} feitos · ${fmtMin(m.geral.min)}–${fmtMin(m.geral.max)}</small>` : '—'}</td>${T.map(t => { const x = m?.tec.get(t.id); return `<td class="num">${x ? fmtMin(x.avg) + `<br><small style="color:var(--ink-3)">${x.n}</small>` : '—'}</td>`; }).join('')}<td><button class="btn sm" data-act="ofiKit" data-c="${esc(eq)}">${k.pecas.length} peças</button></td></tr>`; }).join('')}
      </tbody></table></div></div>`;
  });
  ACT.ofiKit = d => {
    const eq = d.c, k = kitPara(eq, 'Brio 250');
    openSheet(`<div class="sh"><h2>Kit · ${esc(eq)}</h2><button class="ib" data-act="close" aria-label="Fechar">${ic('x')}</button></div><div class="sb">
      <p class="note" style="margin-top:0">Peças que se preparam para cada trabalho deste tipo (Brio 250). Origem: ${esc(k.fonte)}.</p>
      <div id="kitL">${k.pecas.map((p, i) => { const a = porRef(p.ref); return `<div class="of-pc"><span class="grow">${esc(a?.nome || 'Peça ' + p.ref)}<small>${esc(p.ref)}</small></span><input type="number" min="0" step="1" class="kitq" data-ref="${esc(p.ref)}" value="${p.qt}" style="width:64px" ${S.canWrite ? '' : 'disabled'}></div>`; }).join('') || '<p class="note">Sem peças.</p>'}</div>
      ${S.canWrite ? `<div class="of-row2" style="margin-top:10px;align-items:flex-end"><div class="fld" style="flex:1;margin:0"><label for="kitref">Acrescentar pelo código</label><input id="kitref" placeholder="Ex.: 093167"></div><button class="btn" data-act="ofiKitAdd">Pôr</button></div>` : ''}</div>
      ${S.canWrite ? `<div class="sf"><span class="grow"></span><button class="btn pri" data-act="ofiKitSave" data-c="${esc(eq)}">Guardar kit</button></div>` : ''}`);
  };
  ACT.ofiKitAdd = () => { const r = ($('#kitref')?.value || '').trim(); if (!r) return; const a = porRef(r); if (!a) return toast('Código não encontrado no catálogo'); $('#kitL').insertAdjacentHTML('beforeend', `<div class="of-pc"><span class="grow">${esc(a.nome)}<small>${esc(a.ref)}</small></span><input type="number" min="0" step="1" class="kitq" data-ref="${esc(a.ref)}" value="1" style="width:64px"></div>`); $('#kitref').value = ''; };
  ACT.ofiKitSave = async d => {
    const pecas = [...document.querySelectorAll('.kitq')].map(i => ({ ref: i.dataset.ref, qt: parseInt(i.value, 10) || 0 })).filter(p => p.qt > 0);
    const k = D('kits').find(x => norm(x.equipamento) === norm(d.c) && (!x.modelo || norm(x.modelo) === norm('Brio 250')));
    if (k) await patch('kits', k.id, { pecas }); else await save('kits', null, { equipamento: d.c, modelo: 'Brio 250', pecas });
    closeSheet(); toast('Kit guardado');
  };

  /* ----- Técnicos e rendimento (administrador) ----- */
  const mesAtual = () => TODAY().slice(0, 7);
  VIEWS.tecnicosof = () => loadingOr(() => {
    if (!S.verValores) return '<div class="panel empty"><b>Só para o administrador</b></div>';
    const mes = S.f.tecmes || mesAtual(), T = TECS();
    const meses = [...new Set(D('fichas').map(f => (f.faturadoEm || f.prontoEm || '').slice(0, 7)).filter(Boolean).concat(mesAtual()))].sort().reverse().slice(0, 12);
    const R = new Map(T.map(t => [t.id, { t, fichas: [], fat: 0, min: 0 }]));
    D('fichas').forEach(f => {
      const q = quotas(f);
      if (fechada(f) && (f.prontoEm || '').slice(0, 7) === mes) { let best = null, bq = 0; q.forEach((v, k) => { if (v > bq) { bq = v; best = k; } }); if (best && R.has(best)) R.get(best).fichas.push(f); }
      if (f.faturado && (f.faturadoEm || '').slice(0, 7) === mes) { const tot = valores(f).total; q.forEach((v, k) => { if (R.has(k)) R.get(k).fat += tot * v; }); }
    });
    D('fichas_tempos').forEach(t => { if (t.fim && t.tecnico && R.has(t.tecnico) && (t.inicio || '').slice(0, 7) === mes) R.get(t.tecnico).min += +t.minutos || 0; });
    const L = [...R.values()].sort((a, b) => b.fat - a.fat), maxF = Math.max(1, ...L.map(x => x.fat)), totF = L.reduce((a, x) => a + x.fat, 0);
    const nomeMes = m => new Date(m + '-01T12:00').toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
    return `<div class="pg">${roBanner()}
      <div class="of-row2"><div class="fld" style="margin:0;min-width:200px"><label for="tm">Mês</label><select id="tm" data-ofmes="1">${meses.map(m => `<option value="${m}" ${m === mes ? 'selected' : ''}>${nomeMes(m)}</option>`).join('')}</select></div><span class="note" style="flex:1">Faturado = fichas faturadas neste mês, sem IVA, divididas pelo tempo que cada técnico trabalhou nelas.</span></div>
      <div class="mini"><div><span>Faturado no mês</span><b>${eur(totF)}</b></div><div><span>Fichas fechadas</span><b>${L.reduce((a, x) => a + x.fichas.length, 0)}</b></div><div><span>Horas registadas</span><b>${fmtMin(L.reduce((a, x) => a + x.min, 0))}</b></div></div>
      ${L.map((x, i) => `<div class="panel"><div class="ph"><h2>${i + 1}.º ${esc(x.t.nome)}</h2><b class="num">${eur(x.fat)}</b></div><div class="pb">
        <div style="height:10px;border-radius:5px;background:var(--surface-2);overflow:hidden;margin-bottom:12px"><div style="height:100%;width:${Math.round(x.fat / maxF * 100)}%;background:var(--brand)"></div></div>
        <div class="kv"><div class="kvi"><span>Fichas fechadas</span><b>${x.fichas.length}</b></div><div class="kvi"><span>Horas trabalhadas</span><b>${fmtMin(x.min)}</b></div><div class="kvi"><span>Faturado por hora</span><b>${x.min ? eur(x.fat / (x.min / 60)) + '/h' : '—'}</b></div><div class="kvi"><span>Média por ficha</span><b>${x.fichas.length ? eur(x.fat / x.fichas.length) : '—'}</b></div></div>
        ${x.fichas.length ? `<details style="margin-top:8px"><summary class="note" style="cursor:pointer">Ver as ${x.fichas.length} fichas</summary><div class="of-est" style="margin-top:8px">${x.fichas.sort((a, b) => a.numero - b.numero).map(f => `<button class="chipb" data-act="ofiOpen" data-id="${f.id}">${esc(cod(f))}</button>`).join('')}</div></details>` : ''}</div></div>`).join('')}
      <div><button class="btn" data-act="go" data-v="tempos">${ic('clock', 16)}Ver tempos médios e kits</button></div></div>`;
  });
  document.addEventListener('change', e => { if (e.target?.dataset?.ofmes) { S.f.tecmes = e.target.value; render(); } });


  /* ---------- ecrã «Plano e módulos» (administrador) ---------- */
  VIEWS.modulos = () => loadingOr(() => {
    if (!S.isAdmin) return '<div class="panel empty"><b>Só o administrador vê o plano</b></div>';
    const c = cfg(), pl = c.plano || 'empresa';
    const linha = ([k, n, d, t]) => { const on = temMod(k); return `<label class="row" style="cursor:pointer;align-items:center"><span class="rt"><span class="r1">${esc(n)}${t ? ' ' + badge('Integração', 'info') : ''}${k === 'link' || k === 'avisos' ? ' ' + badge('Em preparação', 'mute') : ''}</span><span class="r2">${esc(d)}</span></span><input type="checkbox" data-ofmod="${k}" ${on ? 'checked' : ''} style="width:24px;height:24px"></label>`; };
    return `<div class="pg"><div class="panel"><div class="ph"><h2>Plano</h2></div><div class="pb"><div class="of-est">${Object.entries(PLANOS).map(([k, [n, L]]) => `<button class="chipb ${pl === k ? 'on' : ''}" data-act="ofiPlano" data-c="${k}">${n} · ${L.length} módulos</button>`).join('')}${pl === 'medida' ? `<button class="chipb on">À medida</button>` : ''}</div>
      <p class="note" style="margin:10px 0 0">Ao escolher um plano, os módulos ficam como em baixo. Pode depois ligar ou desligar um a um (fica «À medida»). As fichas, fotos, cronómetro, assinatura, PDF, clientes e manuais estão sempre incluídos. Desligar um módulo não apaga dados: ficam guardados para quando voltar a ligar.</p></div></div>
      <div class="panel"><div class="ph"><h2>Módulos</h2></div>${MODS.filter(m => !m[3]).map(linha).join('')}</div>
      <div class="panel"><div class="ph"><h2>Integrações</h2></div>${MODS.filter(m => m[3]).map(linha).join('')}<div class="pb"><p class="note" style="margin:0">As integrações ligam-se por empresa quando houver os dados de cada uma (conta do Sage, email e número de WhatsApp da empresa).</p></div></div></div>`;
  });
  const gravaMods = async (modulos, plano) => { if (await patch('oficina_config', 1, { modulos, plano })) toast('Plano atualizado'); };
  ACT.ofiPlano = d => { const L = PLANOS[d.c][1]; gravaMods(Object.fromEntries(MODS.map(([k]) => [k, L.includes(k)])), d.c); };
  document.addEventListener('change', e => { const k = e.target?.dataset?.ofmod; if (!k || !S.isAdmin) return; const m = { ...Object.fromEntries(MODS.map(([x]) => [x, temMod(x)])), [k]: e.target.checked }; const pl = Object.entries(PLANOS).find(([, [, L]]) => MODS.every(([x]) => m[x] === L.includes(x))); gravaMods(m, pl ? pl[0] : 'medida'); });
  // ecrãs de módulos desligados
  Object.keys(VMOD).forEach(v => { const f0 = VIEWS[v]; if (!f0) return; VIEWS[v] = (...a) => temMod(VMOD[v]) ? f0(...a) : `<div class="pg"><div class="panel empty"><b>Módulo não incluído no plano</b>${S.isAdmin ? '<button class="btn" data-act="go" data-v="modulos">Ver plano e módulos</button>' : 'Fale com o administrador.'}</div></div>`; });
  /* ---------- relógio e QR lido pela câmara ---------- */
  setInterval(() => { const el = document.getElementById('ofcrono'); if (!el || !el.dataset.ini) return; const s = Math.max(0, Math.floor((Date.now() - new Date(el.dataset.ini)) / 1000)); el.textContent = pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60); }, 1000);
  const abreHash = () => { const m = location.hash.match(/^#f=([0-9a-f-]{36})$/); if (!m) return; let n = 0; const t = () => { if (S.uid && S.ready.fichas) { history.replaceState(null, '', location.pathname); go('ofi', { id: m[1] }); } else if (n++ < 300) setTimeout(t, 300); }; t(); };
  window.addEventListener('hashchange', abreHash); abreHash();
};
