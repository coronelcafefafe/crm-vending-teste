/* Coronel CRM · Extrato de pendentes (PDF)
   Gera no telemóvel um PDF com os documentos por pagar do XD e deixa partilhar (WhatsApp, email…),
   descarregar ou enviar por email a partir de geral@coronelcafe.com. Não é um documento fiscal. */
window.EXT_INIT = function () {
  const EMPRESA = 'LPAM Unipessoal Lda · Urb. Capitão Salgueiro Maia, 69/70, 4820-260 Fafe';
  const CONTACTO = '919 982 150 · geral@coronelcafe.com · coronelcafe.com';
  const TIPO = { FT: 'Fatura', FR: 'Fatura-recibo', FS: 'Fatura simplificada', ND: 'Nota de débito', NC: 'Nota de crédito' };
  const dPT = s => s ? String(s).slice(0, 10).split('-').reverse().join('/') : '';
  const emailOk = s => String(s || '').split(/[;,\s]+/).find(v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) || '';
  const nomeFich = e => 'Extrato_pendentes_' + String(e.nome || 'cliente').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 50) + '_' + TODAY() + '.pdf';

  /* botão no quadro "Pendentes no XD" da ficha do cliente */
  const orig = xdContaH;
  xdContaH = function (id) {
    const h = orig(id);
    if (!S.canWrite || !xdPend(id).length) return h;
    return h.replace('<h2>Pendentes no XD</h2>', `<h2>Pendentes no XD</h2><button class="btn sm" data-act="extrato" data-id="${id}" style="margin-left:auto;margin-right:10px">Extrato em PDF</button>`);
  };

  let jsLoad = null;
  const loadPDF = () => window.jspdf ? Promise.resolve() : (jsLoad = jsLoad || new Promise((ok, ko) => {
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = ok; s.onerror = () => { jsLoad = null; ko(new Error('jspdf')); }; document.head.appendChild(s);
  }));
  let logo = null;
  const loadLogo = () => logo !== null ? Promise.resolve(logo) : fetch('icon-192.png').then(r => r.blob()).then(b => new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(logo = fr.result); fr.readAsDataURL(b); })).catch(() => (logo = ''));

  async function gerar(id) {
    await loadPDF(); await loadLogo();
    const e = ent(id) || {}, P = xdPend(id), tot = P.reduce((s, d) => s + (+d.pendente || 0), 0);
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, M = 16, INK = [29, 29, 31], INK2 = [110, 110, 115], LINE = [229, 229, 234], GOLD = [196, 160, 82], BOX = [242, 242, 244];
    const cor = c => doc.setTextColor(...c);
    const rule = (y, c = LINE, w = 0.2) => { doc.setDrawColor(...c); doc.setLineWidth(w); doc.line(M, y, W - M, y); };
    const rodape = () => {
      const n = doc.getNumberOfPages();
      for (let i = 1; i <= n; i++) {
        doc.setPage(i); rule(281, GOLD, 0.3); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); cor(INK2);
        doc.text(EMPRESA, M, 286); doc.text(CONTACTO, M, 290); if (n > 1) doc.text(`${i}/${n}`, W - M, 290, { align: 'right' });
      }
    };
    // cabeçalho
    let y = 18;
    if (logo) { try { doc.addImage(logo, 'PNG', M, y - 4, 12, 12); } catch (_) { } }
    const lx = logo ? M + 16 : M;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); cor(INK2); doc.setCharSpace(0.8); doc.text('CORONEL CAFÉ', lx, y); doc.setCharSpace(0);
    doc.setFont('times', 'normal'); doc.setFontSize(22); cor(INK); doc.text('Extrato de pendentes', lx, y + 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); cor(INK2); doc.text('Data: ' + dPT(TODAY()), W - M, y, { align: 'right' });
    y += 14; rule(y, GOLD, 0.3);
    // cliente
    y += 8; doc.setFontSize(8); cor(INK2); doc.text('CLIENTE', M, y);
    y += 5.5; doc.setFontSize(11.5); cor(INK); doc.text(doc.splitTextToSize(e.nome || 'Cliente', W - 2 * M), M, y);
    const info = [e.codigoXd ? 'Cliente n.º ' + e.codigoXd : '', e.nif ? 'NIF ' + e.nif : '', [e.morada, [e.cp, e.localidade].filter(Boolean).join(' ')].filter(Boolean).join(', ')].filter(Boolean);
    doc.setFontSize(9); cor(INK2); info.forEach(t => { y += 5; doc.text(doc.splitTextToSize(t, W - 2 * M)[0], M, y); });
    // tabela
    const C = [{ t: 'Documento', x: M, a: 'left' }, { t: 'Data', x: 82, a: 'left' }, { t: 'Vencimento', x: 104, a: 'left' }, { t: 'Atraso', x: 144, a: 'right' }, { t: 'Valor', x: 168, a: 'right' }, { t: 'Por pagar', x: W - M, a: 'right' }];
    const cab = () => { doc.setFontSize(8); cor(INK2); C.forEach(c => doc.text(c.t, c.x, y, { align: c.a })); y += 2.5; rule(y, GOLD, 0.3); y += 5.5; };
    y += 12; cab();
    P.forEach(d => {
      if (y > 266) { doc.addPage(); y = 22; cab(); }
      const a = diasAtraso(d), nome = [d.tipo, d.numero].filter(Boolean).join(' ');
      doc.setFontSize(9.5); cor(INK);
      doc.text(nome, C[0].x, y); doc.text(dPT(d.data), C[1].x, y); doc.text(dPT(d.vencimento), C[2].x, y);
      cor(a > 30 ? [179, 38, 30] : INK2); doc.text(a ? a + ' dias' : '—', C[3].x, y, { align: 'right' }); cor(INK);
      doc.text(eur(d.total), C[4].x, y, { align: 'right' }); doc.text(eur(d.pendente), C[5].x, y, { align: 'right' });
      y += 2.8; rule(y); y += 5.2;
    });
    // total
    if (y > 250) { doc.addPage(); y = 22; }
    y += 2; doc.setFillColor(...BOX); doc.roundedRect(W - M - 78, y - 5, 78, 12, 2, 2, 'F');
    doc.setFontSize(9); cor(INK2); doc.text('Total por pagar', W - M - 74, y + 2.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); cor(INK); doc.text(eur(tot), W - M - 4, y + 2.5, { align: 'right' }); doc.setFont('helvetica', 'normal');
    y += 18; doc.setFontSize(9); cor(INK2);
    const nota = `Valores em aberto na nossa conta corrente à data de ${dPT(TODAY())}, segundo os documentos emitidos. Se já efetuou o pagamento, agradecemos que nos envie o comprovativo e ignore este extrato. Para qualquer esclarecimento: ${CONTACTO.split(' · ').slice(0, 2).join(' ou ')}.`;
    doc.text(doc.splitTextToSize(nota, W - 2 * M), M, y);
    y += 14; doc.setFontSize(7.5); doc.text('Este extrato é informativo e não serve de fatura nem de recibo.', M, y);
    rodape();
    return { blob: doc.output('blob'), nome: nomeFich(e), tot, n: P.length, e };
  }

  const b64 = blob => new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
  let atual = null;

  Object.assign(ACT, {
    extrato: async (d, b) => {
      b.disabled = true;
      try { atual = await gerar(d.id); } catch (_) { b.disabled = false; return toast('Sem ligação para criar o PDF. Tente outra vez.'); }
      b.disabled = false;
      const f = new File([atual.blob], atual.nome, { type: 'application/pdf' });
      atual.file = f;
      const podePart = !!(navigator.canShare && navigator.canShare({ files: [f] }));
      const em = emailOk(atual.e.email);
      openSheet(`<div class="sh"><h2>Extrato de pendentes</h2><button class="ib" data-act="close" aria-label="Fechar">${ic('x')}</button></div><div class="sb">
        <p style="margin:0 0 6px"><b>${esc(atual.e.nome || 'Cliente')}</b></p>
        <p class="note" style="margin:0 0 14px">${atual.n} documento${atual.n === 1 ? '' : 's'} por pagar · total <b>${eur(atual.tot)}</b>${emLit(d.id) ? ' · cliente em litígio' : ''}</p>
        <div style="display:grid;gap:10px">
          ${podePart ? `<button class="btn pri" data-act="extPart" style="justify-content:center;min-height:48px">Partilhar (WhatsApp, email…)</button>` : ''}
          <button class="btn ${podePart ? '' : 'pri'}" data-act="extEmail" data-id="${d.id}" style="justify-content:center;min-height:48px" ${em && CFG.emailEncomendas ? '' : 'disabled'}>Enviar por email${em ? ' para ' + esc(em) : ''}</button>
          <button class="btn" data-act="extDesc" style="justify-content:center;min-height:48px">Descarregar PDF</button>
        </div>
        ${em ? '<p class="note" style="margin:12px 0 0">O email sai de geral@coronelcafe.com, com cópia para geral@.</p>' : '<p class="note" style="margin:12px 0 0">Este cliente não tem email na ficha. Use Partilhar ou acrescente o email na ficha.</p>'}
      </div>`);
    },
    extPart: async () => {
      if (!atual?.file) return;
      try { await navigator.share({ files: [atual.file], title: atual.nome, text: `Extrato de pendentes · ${atual.e.nome || ''} · ${eur(atual.tot)}` }); closeSheet(); }
      catch (e) { if (e && e.name !== 'AbortError') toast('Não foi possível partilhar. Use Descarregar PDF.'); }
    },
    extDesc: () => {
      if (!atual?.blob) return;
      const u = URL.createObjectURL(atual.blob), a = document.createElement('a');
      a.href = u; a.download = atual.nome; document.body.appendChild(a); a.click(); setTimeout(() => { a.remove(); URL.revokeObjectURL(u); }, 4000);
    },
    extEmail: async (d, b) => {
      if (!atual?.blob || !canAct()) return;
      b.disabled = true; const t0 = b.textContent; b.textContent = 'A enviar…';
      try {
        const { data: { session } } = await S.db.auth.getSession();
        const r = await fetch(CFG.url + '/functions/v1/extrato-email', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (session?.access_token || ''), apikey: CFG.anonKey }, body: JSON.stringify({ entidade: d.id, nome: atual.nome, pdf: await b64(atual.blob) }) });
        const j = await r.json().catch(() => ({}));
        if (r.ok) { closeSheet(); toast('Extrato enviado para ' + j.para); return; }
        toast(j.code === 'sem_email' ? 'O cliente não tem email válido na ficha.' : j.code === 'email_desligado' ? 'O envio por email ainda não está ligado.' : 'Não foi possível enviar o email.');
      } catch (_) { toast('Sem ligação: o extrato não foi enviado.'); }
      b.disabled = false; b.textContent = t0;
    },
  });
};
