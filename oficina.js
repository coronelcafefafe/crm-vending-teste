/* Mundicacau · Oficina e assistências
   Fichas de entrada (oficina), assistências no cliente e manutenções: fotos, etiqueta QR com o proprietário,
   estados, cronómetro, deslocação com GPS ("Estou aqui"), peças filtradas pelo modelo e grupo da máquina,
   orçamento opcional, avisos ao cliente (email e WhatsApp), agrupamento de trabalhos iguais,
   rota do dia (do mais longe para o mais perto) e exportação para faturar. */
window.OFI_INIT = function () {
  const NOVAS = ['locais', 'fichas', 'fichas_tempos', 'modelos', 'desl_tabelas', 'oficina_config'];
  NOVAS.forEach(c => { if (!COLS.includes(c)) COLS.push(c); S.data[c] = new Map(); });

  const EST = { recebido: 'Recebido', diagnostico: 'Em diagnóstico', orcamento: 'Orçamento enviado', aguarda_peca: 'À espera de peça', reparacao: 'Em reparação', pronto: 'Pronto', entregue: 'Entregue', cancelado: 'Cancelado' };
  const EST_T = { recebido: 'info', diagnostico: 'warn', orcamento: 'gold', aguarda_peca: 'bad', reparacao: 'warn', pronto: 'ok', entregue: 'mute', cancelado: 'mute' };
  const TIPO = { oficina: 'Oficina (entrou cá)', local: 'Assistência no cliente', manutencao: 'Manutenção', reparacao: 'Reparação no cliente' };
  const TIPO_C = { oficina: 'Oficina', local: 'No cliente', manutencao: 'Manutenção', reparacao: 'Reparação' };
  const EQUIP = ['Máquina completa', 'Caldeira', 'Grupo café', 'Moinho doseador', 'Placa eletrónica', 'Moedeiro / sistema de pagamento', 'Bomba', 'Misturador', 'Distribuidor de copos', 'Outra peça'];
  const ABERTOS = ['recebido', 'diagnostico', 'orcamento', 'aguarda_peca', 'reparacao'];
  const fora = f => f.tipo !== 'oficina';
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
  function valores(f) {
    const min = minutos(f), mo = min / 60 * precoH(f);
    const d = fora(f) && f.km != null ? deslCalc(ent(f.entidade), f.km) : null;
    const pc = (f.pecas || []).reduce((s, p) => s + (+p.qt || 0) * (+p.preco || 0), 0);
    return { min, mo, desl: d, pc, total: mo + (d?.valor || 0) + pc };
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
  NAV.splice(1, 0, ['oficina', 'Oficina e assistências', 'tool'], ['rotaof', 'Rota do dia', 'route']);
  const iMais = NAV.findIndex(n => n[0] === 'mais'); NAV.splice(iMais, 0, ['ofcfg', 'Preços e deslocações', 'euro']);
  for (let i = NAV.length - 1; i > 0; i--) if (NAV[i][0] === 'sep' && (NAV[i - 1][0] === 'sep' || i === NAV.length - 1)) NAV.splice(i, 1);
  SO_VALORES.push('ofcfg');
  TABS.splice(0, TABS.length, ['inicio', 'Início', 'home'], ['oficina', 'Oficina', 'tool'], ['rotaof', 'Rota', 'route'], ['clientes', 'Clientes', 'users'], ['mais', 'Mais', 'menu']);
  Object.assign(TITLES, { inicio: 'Início', oficina: 'Oficina e assistências', ofcfg: 'Preços e deslocações', rotaof: 'Rota do dia' });
  Object.defineProperty(TITLES, 'ofi', { get() { const f = S.data.fichas.get(S.params?.id); return f ? 'Ficha ' + cod(f) : 'Ficha'; } });
  const nc0 = navCounts; navCounts = () => ({ ...nc0(), oficina: D('fichas').filter(f => ABERTOS.includes(f.estado)).length });

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
    { k: 'nome', l: 'Nome do local (ex.: Café Avenida)', t: 'text', req: 1, full: 1 },
    { k: 'morada', l: 'Morada', t: 'text', full: 1 },
    { k: 'cp', l: 'Código postal', t: 'text' },
    { k: 'localidade', l: 'Localidade', t: 'text' },
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
    { k: 'equipamento', l: 'O que entrou / equipamento', t: 'sel', o: EQUIP, req: 1, def: 'Máquina completa' },
    { k: 'marca', l: 'Marca', t: 'text', def: 'Necta' },
    { k: 'modelo', l: 'Modelo da máquina', t: 'sel', get o() { return modelosL(); } },
    { k: 'grupo', l: 'Grupo / conjunto (filtra as peças)', t: 'sel', get o() { const s = new Set(); D('artigos').forEach(a => isPeca(a) && a.grupoPeca && s.add(a.grupoPeca)); return [...s].sort((a, b) => a.localeCompare(b, 'pt')); } },
    { k: 'nSerie', l: 'N.º de série', t: 'text' },
    { k: 'avaria', l: 'Avaria / o que o cliente pediu', t: 'area', full: 1 },
    { k: 'resp', l: 'Técnico', t: 'user', def: '@me' },
    { k: 'prevista', l: 'Data prevista / agendada', t: 'date' },
    { k: 'precoHora', l: 'Preço/hora só desta ficha (€) · vazio = do cliente', t: 'num', so: 1 },
    { k: 'notas', l: 'Notas internas', t: 'area', full: 1 },
  ];
  xdSheet = () => { }; // sem XD na Mundicacau
  // depois de criar uma ficha, abre-a (fotos, etiqueta, cronómetro)
  const save0 = save;
  save = async (col, id, vals) => { const r = await save0(col, id, vals); if (r && col === 'fichas' && !id) setTimeout(() => go('ofi', { id: r }), 60); if (r && col === 'locais' && !id && S.ofLocalPara) { const fid = S.ofLocalPara; S.ofLocalPara = null; await save0('fichas', fid, { local: r }); } return r; };

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
      <span class="rr">${badge(EST[f.estado] || f.estado, EST_T[f.estado])}${f.tipo === 'oficina' ? `<span class="note${late ? '' : ''}" style="${late ? 'color:var(--bad);font-weight:500' : ''}">${d} d</span>` : f.prevista ? `<span class="note">${fD(f.prevista)}</span>` : ''}${aberto(f) ? badge('A contar tempo', 'warn') : ''}</span></div>`;
  }
  const byEntrada = (a, b) => (b.entrada || '').localeCompare(a.entrada || '');

  function gruposIguais() {
    const m = new Map();
    D('fichas').filter(f => ['recebido', 'diagnostico'].includes(f.estado) && f.equipamento && f.equipamento !== 'Máquina completa').forEach(f => { const k = f.equipamento; if (!m.has(k)) m.set(k, []); m.get(k).push(f); });
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
  const CHIPS = ['Em curso', 'Na oficina', 'No cliente', 'Prontos', 'Entregues', 'Todas'];
  VIEWS.oficina = () => loadingOr(() => {
    const c = S.f.oficina || 'Em curso';
    let L = D('fichas');
    if (c.startsWith('eq:')) { const k = c.slice(3); L = L.filter(f => f.equipamento === k && ['recebido', 'diagnostico'].includes(f.estado)); }
    else if (c === 'Em curso') L = L.filter(f => ABERTOS.includes(f.estado) || f.estado === 'pronto');
    else if (c === 'Na oficina') L = L.filter(f => f.tipo === 'oficina' && ABERTOS.includes(f.estado));
    else if (c === 'No cliente') L = L.filter(f => fora(f) && ABERTOS.includes(f.estado));
    else if (c === 'Prontos') L = L.filter(f => f.estado === 'pronto');
    else if (c === 'Entregues') L = L.filter(f => f.estado === 'entregue');
    L = L.filter(f => match('oficina', f, ['codigo', 'numero', 'proprietario', 'entidade', 'equipamento', 'modelo', 'nSerie', 'avaria'])).sort(byEntrada);
    const porFat = D('fichas').filter(f => ['pronto', 'entregue'].includes(f.estado) && !f.faturado).length;
    return `<div class="pg">${roBanner()}
     <div class="tb"><div class="tbr"><label class="srch">${ic('search', 18)}<input id="q-oficina" data-q="oficina" type="search" placeholder="N.º da ficha, cliente, peça, n.º de série" value="${esc(S.q.oficina || '')}" autocomplete="off"></label>${S.canWrite ? `<button class="btn pri" data-act="ofiNew">${ic('plus', 18)}<span>Nova ficha</span></button>` : ''}</div>
     <div class="chips">${c.startsWith('eq:') ? `<button class="chipb on" data-act="chip" data-v="oficina" data-c="Em curso">${esc(c.slice(3))} ✕</button>` : ''}${CHIPS.map(x => `<button class="chipb ${x === c ? 'on' : ''}" data-act="chip" data-v="oficina" data-c="${x}">${x}</button>`).join('')}</div></div>
     ${c.startsWith('eq:') ? '' : alertasH()}
     ${listBlock('oficina', L, fRow, '<b>Sem fichas</b>Crie uma ficha quando entrar uma peça ou máquina.')}
     ${S.verValores ? `<div class="panel"><div class="ph"><h2>Faturar</h2></div><div class="pb"><p class="note" style="margin-top:0">${porFat} fichas prontas ou entregues ainda por faturar. O ficheiro abre no Excel e serve de base para lançar no Sage.</p><button class="btn" data-act="ofiExport" ${porFat ? '' : 'disabled'}>${ic('dl', 16)}Exportar para faturar</button></div></div>` : ''}
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
      <div class="meta">${badge(cod(f), 'info')}${badge(EST[f.estado], EST_T[f.estado])}${badge(TIPO_C[f.tipo], 'gold')}${(L0 || (f.proprietario && f.proprietario !== e.nome)) && e.nome ? badge('Cliente: ' + e.nome) : ''}${f.tipo === 'oficina' ? badge(`Entrou a ${fDY(f.entrada)} · ${dias(f)} d`, dias(f) > 30 && ABERTOS.includes(f.estado) ? 'bad' : 'mute') : f.prevista ? badge('Agendada ' + fDY(f.prevista)) : ''}${f.faturado ? badge('Faturado', 'ok') : ''}</div></div></div>
    <div class="panel"><div class="pb" style="padding-top:12px"><div class="kv">${[['Equipamento', nomeEq(f)], ['N.º de série', f.nSerie], ['Grupo', f.grupo], ['Avaria / pedido', f.avaria], ['Técnico', f.resp ? nameOf(f.resp) : ''], ['Notas', f.notas]].filter(x => x[1]).map(([l, x]) => `<div class="kvi"><span>${l}</span><b style="white-space:pre-wrap">${esc(x)}</b></div>`).join('')}</div></div></div>
    <div class="acts"><a class="act ${tel ? '' : 'off'}" href="tel:${esc(telClean(tel))}">${ic('phone')}<span>Ligar</span></a><a class="act ${e.telemovel ? '' : 'off'}" href="https://wa.me/${esc(waNum(e.telemovel))}" target="_blank" rel="noopener">${ic('wa')}<span>WhatsApp</span></a><a class="act ${e.email ? '' : 'off'}" href="mailto:${esc(e.email || '')}">${ic('mail')}<span>Email</span></a><a class="act ${dest ? '' : 'off'}" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}" target="_blank" rel="noopener">${ic('pin')}<span>Ir até lá</span></a></div>
    ${ro ? '' : `<div class="of-row2"><button class="btn" data-act="ofiLabel" data-id="${f.id}">${ic('qr', 16)}Imprimir etiqueta</button>${f.tipo === 'oficina' ? `<button class="btn" data-act="ofiDocMenu" data-id="${f.id}" data-c="entrada">${ic('doc', 16)}Comprovativo de entrada</button>` : ''}<button class="btn ${['pronto', 'entregue'].includes(f.estado) ? 'pri' : ''}" data-act="ofiDocMenu" data-id="${f.id}" data-c="entrega">${ic('doc', 16)}${f.tipo === 'oficina' ? 'Guia de entrega' : 'Folha de serviço'}</button><button class="btn" data-act="ofiAviso" data-id="${f.id}">${ic('send', 16)}${fora(f) ? 'Enviar relatório ao cliente' : 'Avisar cliente'}</button><button class="btn" data-act="ofiEdit" data-id="${f.id}">${ic('edit', 16)}Editar ficha</button></div>`}
    <div class="panel"><div class="ph"><h2>Estado</h2>${f.avisadoEm ? `<span class="note">Cliente avisado ${fD(f.avisadoEm)}</span>` : ''}</div><div class="pb"><div class="of-est">${Object.entries(EST).map(([k, l]) => `<button class="chipb ${f.estado === k ? 'on' : ''}" data-act="ofiEst" data-id="${f.id}" data-c="${k}" ${ro ? 'disabled' : ''}>${l}</button>`).join('')}</div></div></div>`;

    // local da assistência (cliente do cliente)
    if (fora(f)) {
      const LS = D('locais').filter(x => x.entidade === f.entidade && x.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
      h += `<div class="panel" ${L0 ? '' : 'style="border-color:var(--gold)"'}><div class="ph"><h2>Local da assistência</h2><span class="note">onde está a máquina</span></div><div class="pb">
        ${L0 ? `<p style="margin:0 0 4px"><b>${esc(L0.nome)}</b></p><p class="note" style="margin:0 0 10px">${esc([[L0.morada, L0.cp, L0.localidade].filter(Boolean).join(', '), [L0.contacto, L0.telefone].filter(Boolean).join(' · ')].filter(Boolean).join(' · ') || 'Sem morada')}${L0.notas ? '<br>' + esc(L0.notas) : ''}</p>
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
    h += `<div class="panel"><div class="ph"><h2>Tempo de trabalho</h2><span class="note">Total ${fmtMin(v.min)}</span></div><div class="pb">
      <div class="of-row2"><div style="flex:1"><div class="of-crono" id="ofcrono" data-ini="${run ? esc(run.inicio) : ''}">${run ? '00:00:00' : fmtMin(v.min)}</div><span class="note">${run ? 'A contar desde ' + fD(run.inicio) + (run.resp ? ' · ' + esc(nameOf(run.resp)) : '') : 'Parado'}</span></div>
      ${ro ? '' : `<button class="btn pri of-big ${run ? 'of-stop' : ''}" style="flex:0 0 170px" data-act="ofiCrono" data-id="${f.id}">${ic('clock', 18)}${run ? 'Parar' : 'Iniciar'}</button>`}</div>
      ${T.length ? `<table class="tt" style="margin-top:12px"><tbody>${T.slice(0, 8).map(t => `<tr><td>${fD(t.inicio)}${t.resp ? ' · ' + esc(nameOf(t.resp)) : ''}</td><td class="num">${t.fim ? fmtMin(t.minutos) : 'a contar'}</td></tr>`).join('')}</tbody></table>` : ''}
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
      ${ro ? '' : !S.ofPick?.open ? `<div style="margin-top:12px"><button class="btn" data-act="ofiPick" data-id="${f.id}">${ic('plus', 16)}Adicionar peça${f.modelo ? ' do ' + esc(f.modelo) : ''}</button></div>` : `
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
        <tr><td>Mão de obra · ${fmtMin(v.min)} × ${eur(precoH(f))}/h</td><td class="num">${eur(v.mo)}</td></tr>
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
        <div class="fld"><label for="cf-lat">Morada da empresa · latitude</label><input id="cf-lat" type="number" step="any" value="${c.baseLat ?? ''}"></div>
        <div class="fld"><label for="cf-lng">longitude</label><input id="cf-lng" type="number" step="any" value="${c.baseLng ?? ''}"></div></div>
        <label class="tog"><input id="cf-iv" type="checkbox" ${c.idaVolta ? 'checked' : ''}><span>Nos clientes por km, cobrar ida e volta</span></label>
        <p class="note" style="margin:0 0 10px">Cada cliente pode ter o seu preço/hora e a sua forma de cobrar a deslocação (na ficha do cliente). Os escalões contam a distância de ida.</p>
        ${S.isAdmin ? '<button class="btn pri" data-act="ofCfgSave">Guardar</button>' : '<p class="note">Só o administrador altera estes valores.</p>'}</div></div>
      <div class="panel"><div class="ph"><h2>Tabelas de escalões</h2></div><div class="pb">
        <p class="note" style="margin-top:0">Escreva os escalões como «até km = valor», separados por ponto e vírgula. Ex.: 40=30; 70=50; 150=90</p>
        ${D('desl_tabelas').map(t => `<div class="fg" style="grid-template-columns:minmax(0,1fr) minmax(0,2fr) auto;align-items:end;margin-bottom:10px"><div class="fld"><label>Nome</label><input data-dtn="${t.id}" value="${esc(t.nome)}"></div><div class="fld"><label>Escalões</label><input data-dte="${t.id}" value="${esc(escTxt(t.escaloes))}"></div><button class="btn" data-act="ofTabSave" data-id="${t.id}">Guardar</button></div><p class="note" style="margin:-4px 0 14px">${D('entidades').filter(e => e.deslTabela === t.id).length} clientes usam esta tabela</p>`).join('')}
        ${S.canWrite ? '<button class="btn" data-act="ofTabNew">' + ic('plus', 16) + 'Nova tabela</button>' : ''}</div></div></div>`;
  });
  ACT.ofCfgSave = async () => { const n = id => { const x = $('#' + id).value; return x === '' ? null : parseFloat(x); }; if (await patch('oficina_config', 1, { precoHora: n('cf-ph'), precoKm: n('cf-pk'), baseLat: n('cf-lat'), baseLng: n('cf-lng'), idaVolta: $('#cf-iv').checked })) toast('Guardado'); };
  ACT.ofTabSave = async d => { const nome = $(`[data-dtn="${d.id}"]`).value.trim(), L = parseEsc($(`[data-dte="${d.id}"]`).value); if (!nome || !L.length) return toast('Falta o nome ou os escalões'); if (await patch('desl_tabelas', d.id, { nome, escaloes: L })) toast('Tabela guardada'); };
  ACT.ofTabNew = async () => { await save('desl_tabelas', null, { nome: 'Nova tabela', escaloes: [{ ate: 40, valor: 30 }, { ate: 70, valor: 50 }, { ate: 150, valor: 90 }] }); };

  /* ---------- separador «Assistências» na ficha do cliente ---------- */
  const vf0 = VIEWS.ficha;
  VIEWS.ficha = () => {
    let h = vf0(); const e = ent(S.params.id); if (!e) return h;
    const L = D('fichas').filter(f => f.entidade === e.id).sort(byEntrada), on = S.params.tab === 'assist';
    h = h.replace('<div class="tabs">', `<div class="tabs"><button class="${on ? 'on' : ''}" data-act="ftab" data-c="assist">Assistências${L.length ? `<i>${L.length}</i>` : ''}</button>`);
    if (!on) return h;
    const orc = L.filter(f => f.orcValor != null || f.orcEstado);
    const t = S.data.desl_tabelas.get(e.deslTabela);
    const box = S.verValores ? `<div class="mini"><div><span>Preço/hora</span><b>${eur(e.precoHora ?? cfg().precoHora)}</b></div><div><span>Deslocação</span><b style="font-size:15px">${e.deslModo === 'escaloes' ? 'Escalões · ' + esc(t?.nome || 'sem tabela') : 'Por km · ' + eur(e.precoKm ?? cfg().precoKm) + '/km'}</b></div></div>` : '';
    const c = `${box}${S.canWrite ? `<div class="of-row2"><button class="btn sm" data-act="ofiNew" data-preset='${esc(JSON.stringify({ entidade: e.id, tipo: 'oficina' }))}'>${ic('plus', 16)}Entrada na oficina</button><button class="btn sm" data-act="ofiNew" data-preset='${esc(JSON.stringify({ entidade: e.id, tipo: 'local' }))}'>${ic('pin', 16)}Assistência no cliente</button></div>` : ''}
      ${L.length ? `<div class="panel">${L.map(fRow).join('')}</div>` : '<div class="panel empty"><b>Sem assistências</b></div>'}
      ${(() => { const LS = D('locais').filter(x => x.entidade === e.id).sort((a, b) => a.nome.localeCompare(b.nome, 'pt')); return `<div class="panel"><div class="ph"><h2>Locais de assistência</h2><span class="note">clientes deste cliente</span>${S.canWrite ? `<button class="lnk" data-act="new" data-col="locais" data-preset='${esc(JSON.stringify({ entidade: e.id }))}'>Novo local</button>` : ''}</div>${LS.length ? LS.map(x => `<div class="row" role="button" tabindex="0" data-act="${S.canWrite ? 'edit' : 'noop'}" data-col="locais" data-id="${x.id}"><span class="rt"><span class="r1">${esc(x.nome)}</span><span class="r2">${esc([x.localidade, x.contacto, x.telefone].filter(Boolean).join(' · '))}</span></span><span class="rr">${badge(D('fichas').filter(f => f.local === x.id).length + ' fichas')}</span></div>`).join('') : '<div class="pb"><p class="note" style="margin:0">Sem locais. Se este cliente tem máquinas em casa dos seus clientes (ex.: um torrefator), registe aqui esses locais.</p></div>'}</div>`; })()}
      ${orc.length && S.verValores ? `<div class="panel"><div class="ph"><h2>Orçamentos</h2></div><div class="pb"><table class="tt"><tbody>${orc.map(f => `<tr data-act="ofiOpen" data-id="${f.id}" style="cursor:pointer"><td>${esc(cod(f))} · ${esc(nomeEq(f))}${f.orcEm ? ' · ' + fDY(f.orcEm) : ''}</td><td>${badge({ enviado: 'Enviado', aceite: 'Aceite', recusado: 'Recusado' }[f.orcEstado] || 'Por enviar')}</td><td class="num">${eur(f.orcValor)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
    const k = h.lastIndexOf('</div>'); return h.slice(0, k) + c + h.slice(k);
  };

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

  // peças
  ACT.ofiPick = d => { const f = fx(d.id); S.ofPick = { id: d.id, open: true, mod: f?.modelo || '', grp: f?.grupo || '', q: '' }; render(); setTimeout(() => $('#ofpq')?.focus(), 50); };
  ACT.ofiPickX = () => { S.ofPick = null; render(); };
  ACT.ofiPadd = async d => {
    const f = fx(d.id), a = S.data.artigos.get(d.a); if (!f || !a) return; const L = clone(f.pecas || []);
    const x = L.find(p => p.artigo === a.id); if (x) x.qt = (+x.qt || 0) + 1; else L.push({ artigo: a.id, nome: a.nome, ref: a.ref || '', qt: 1, preco: +a.preco || 0 });
    if (await patch('fichas', f.id, { pecas: L })) toast('Peça adicionada');
  };
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
    const t = [`Relatório de assistência · ficha ${cod(f)}`, '', `Cliente: ${e.nome || ''}`, ondeTxt(f) ? `Local: ${ondeTxt(f)}` : '', `Data: ${fDY(f.chegadaEm || TODAY())}`, `Equipamento: ${nomeEq(f)}${f.nSerie ? ' · n.º de série ' + f.nSerie : ''}`, f.resp ? `Técnico: ${nameOf(f.resp)}` : '', f.chegadaEm ? `Chegada: ${fD(f.chegadaEm)}` : '', `Tempo de trabalho: ${fmtMin(v.min)}`, f.km != null ? `Deslocação: ${fmtKm(f.km)} km` : '', f.avaria ? `\nPedido: ${f.avaria}` : '', f.trabalho ? `\nTrabalho realizado:\n${f.trabalho}` : '', P0.length ? `\nPeças aplicadas:\n${P0.map(p => `- ${p.qt} × ${p.nome}${p.ref ? ' (' + p.ref + ')' : ''}`).join('\n')}` : '', (f.fotos || []).length ? `\nFotos: ${(f.fotos || []).map(fotoF).join('\n')}` : ''].filter(x => x !== '').join('\n');
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
    else L.push(['Data de entrada', fDY(f.entrada)], [f.tipo === 'oficina' ? 'Data de entrega' : 'Data do serviço', fDY(f.entregueEm || f.chegadaEm || new Date().toISOString())], ...(f.avaria ? [['Pedido', f.avaria]] : []), ...(f.trabalho ? [['Trabalho realizado', f.trabalho]] : []), ['Tempo de trabalho', fmtMin(v.min)], ...(fora(f) && f.km != null ? [['Deslocação', fmtKm(f.km) + ' km']] : []));
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

  /* ---------- exportar para faturar (CSV que abre no Excel) ---------- */
  ACT.ofiExport = () => {
    const L = D('fichas').filter(f => ['pronto', 'entregue'].includes(f.estado) && !f.faturado).sort((a, b) => a.numero - b.numero); if (!L.length) return toast('Nada por faturar');
    const c = v => { v = String(v ?? ''); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }, n = x => (Math.round((+x || 0) * 100) / 100).toString().replace('.', ',');
    const rows = [['Ficha (referência na fatura)', 'Data', 'Cliente', 'NIF', 'Referência', 'Descrição', 'Quantidade', 'Preço unitário s/ IVA', 'IVA %', 'Total s/ IVA']];
    L.forEach(f => {
      const e = ent(f.entidade) || {}, v = valores(f), dt = (f.entregueEm || f.prontoEm || f.entrada || '').slice(0, 10), base = [cod(f), dt, e.nome || '', e.nif || ''];
      const desc = `Ficha ${cod(f)} · ${nomeEq(f)}${f.nSerie ? ' S/N ' + f.nSerie : ''}`;
      if (v.min > 0) rows.push([...base, 'MO', 'Mão de obra · ' + desc, n(v.min / 60), n(precoH(f)), 23, n(v.mo)]);
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
