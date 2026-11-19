/* ---------- imprimir pelo telemóvel: talão em imagem ou PDF ----------
 * No telemóvel o "Imprimir" do navegador muitas vezes não faz nada (sobretudo com o site
 * instalado como app no iPhone). Por isso a pré-visualização tem agora "Partilhar PDF":
 * gera o talão em PDF (mesmo papel e vias escolhidos) e abre a partilha do telemóvel,
 * onde se escolhe a Epson Smart Panel (ou outra app da impressora).
 * No computador o PDF é descarregado. A biblioteca (public/lib/jspdf) só carrega quando se abre a impressão.
 */
let impPdf = null, impPdfA = false;
const impScripts = {};

/** Carrega um script uma só vez. */
function impCarregar(src) {
  if (!impScripts[src]) impScripts[src] = new Promise((ok, falha) => {
    const s = document.createElement("script"); s.src = src; s.onload = ok;
    s.onerror = () => { delete impScripts[src]; falha(new Error("Não foi possível carregar " + src)); };
    document.head.appendChild(s);
  });
  return impScripts[src];
}
const impLibs = () => impCarregar("lib/jspdf.umd.min.js");
const impTatil = () => window.matchMedia && matchMedia("(pointer: coarse)").matches;

/* O PDF é escrito diretamente com texto e linhas (sem "fotografar" o ecrã, que no telemóvel podia sair em branco).
 * As letras de base do PDF só têm o alfabeto latino: setas, emojis, etc. são trocados ou tirados. */
const IMP_WIN = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
function impTxt(t) {
  return String(t == null ? "" : t).replace(/[−‐‑]/g, "-").replace(/→/g, ">").replace(/[  ]/g, " ")
    .split("").filter(c => c.charCodeAt(0) < 256 || IMP_WIN.includes(c)).join("");
}
const impEu = v => impTxt(eur(+v || 0));

/**
 * Escreve um talão no PDF. Com desenhar = false só mede (devolve a altura final).
 * @returns {number} Posição y (mm) no fim do talão.
 */
function impTalaoPdf(doc, p, x0, w, y, via, papel, desenhar) {
  const k = papel === "t58" ? 0.85 : 1, lh = s => s * 0.3528 * 1.22;
  const fonte = (s, b) => { doc.setFont("helvetica", b ? "bold" : "normal"); doc.setFontSize(s * k); };
  const linha = (t, s, o = {}) => {
    fonte(s, o.b);
    const partes = doc.splitTextToSize(impTxt(t), w - (o.recuo || 0));
    partes.forEach(l => {
      y += lh(s * k);
      if (desenhar) doc.text(l, o.centro ? x0 + w / 2 : x0 + (o.recuo || 0), y - lh(s * k) * 0.22, { align: o.centro ? "center" : "left", charSpace: o.esp || 0 });
    });
  };
  const sep = () => { y += 2; if (desenhar) { doc.setLineDashPattern([0.8, 0.8], 0); doc.setLineWidth(0.2); doc.line(x0, y, x0 + w, y); doc.setLineDashPattern([], 0); } y += 1.5; };
  const duas = (a, b, s, bold) => {
    fonte(s, bold); y += lh(s * k);
    if (desenhar) { doc.text(impTxt(a), x0, y - lh(s * k) * 0.22); doc.text(impTxt(b), x0 + w, y - lh(s * k) * 0.22, { align: "right" }); }
  };
  const segs = (lista, s) => { // uma linha com partes a negrito
    y += lh(s * k); let x = x0;
    lista.forEach(([t, b]) => { fonte(s, b); if (desenhar) doc.text(impTxt(t), x, y - lh(s * k) * 0.22); x += doc.getTextWidth(impTxt(t)); });
  };
  const caixa = (t, s, b, centro, grossa) => {
    y += 1.5; const topo = y; y += 1.4;
    fonte(s, b); const partes = doc.splitTextToSize(impTxt(t), w - 4);
    partes.forEach(l => { y += lh(s * k); if (desenhar) doc.text(l, centro ? x0 + w / 2 : x0 + 2, y - lh(s * k) * 0.22, { align: centro ? "center" : "left" }); });
    y += 1.4; if (desenhar) { doc.setLineWidth(grossa ? 0.6 : 0.4); doc.rect(x0, topo, w, y - topo); }
    y += 0.5;
  };

  linha(CONFIG.nome, 15, { b: true, centro: true });
  linha("sakuraesalsushi.pt · " + CONFIG.telefoneVisivel, 8.5, { centro: true });
  sep();
  fonte(17, true); y += lh(17 * k);
  if (desenhar) {
    const n = "N.º " + p.number; doc.text(impTxt(n), x0, y - lh(17 * k) * 0.22);
    if (p.public_code) { const wN = doc.getTextWidth(impTxt(n)); fonte(11, true); doc.text(impTxt(" · " + p.public_code), x0 + wN, y - lh(17 * k) * 0.22); }
  }
  const origem = p.channel && p.channel !== "site" ? ((typeof ORIGENS !== "undefined" && ORIGENS[p.channel]) || p.channel) : "Site";
  linha("Recebido " + fmtData(p.created_at) + " · " + origem, 8.5);
  caixa(p.asap ? "O MAIS CEDO POSSÍVEL" : "ENTREGA " + fmtData(p.deliver_at).replace(", ", " às "), 12, true, true, true);
  linha("CLIENTE", 9, { b: true, esp: 0.3 });
  linha(p.customer_name, 10, { b: true });
  linha(p.customer_phone, 10);
  linha(p.address_street, 10);
  linha(p.address_locality + (p.zone_name && p.zone_name !== p.address_locality ? " (" + p.zone_name + ")" : ""), 10);
  if (p.address_reference) linha("Ref.: " + p.address_reference, 10);
  sep();
  (p.order_items || []).forEach(i => {
    fonte(10, false); const val = impEu(i.line_total), wV = doc.getTextWidth(val) + 2, q = 9 * k;
    const nome = doc.splitTextToSize(impTxt(i.product_name), w - q - wV);
    nome.forEach((l, j) => {
      y += lh(10 * k); const by = y - lh(10 * k) * 0.22;
      if (!desenhar) return;
      if (!j) { fonte(10, true); doc.text(impTxt(i.quantity + "x"), x0, by); fonte(10, false); doc.text(val, x0 + w, by, { align: "right" }); }
      doc.text(l, x0 + q, by);
    });
    y += 0.6;
  });
  sep();
  duas("Produtos", impEu(p.subtotal), 10);
  if (+p.discount > 0) duas("Desconto", "-" + impEu(p.discount), 10);
  duas("Entrega", +p.delivery_fee ? impEu(p.delivery_fee) : "Grátis", 10);
  y += 1; duas("TOTAL", impEu(p.total), 13, true);
  segs([["Pagamento: ", false], [p.payment_method || "por indicar", true], [" (na entrega)", false]], 10);
  if (p.change_for && /^(Numerário|Dinheiro)$/.test(p.payment_method || "")) {
    const c = Math.round(+p.change_for * 100) - Math.round(+p.total * 100);
    segs([["Troco para " + impEu(p.change_for) + (c > 0 ? " > " : c === 0 ? " (valor certo)" : " (confirmar)"), false], [c > 0 ? "levar " + impTxt(eur(c / 100)) : "", true]], 10);
  }
  const ex = p.extras || {}, extras = [];
  if (typeof ex.wasabi === "boolean") extras.push("Wasabi: " + (ex.wasabi ? "SIM" : "não"));
  if (typeof ex.elastico === "boolean") extras.push("Palitos: " + (ex.elastico ? "COM elástico" : "sem elástico"));
  if (extras.length) { sep(); extras.forEach(t => linha(t, 10, { b: true })); }
  if (p.allergy_notes) caixa("ATENÇÃO: " + p.allergy_notes, 10, true, false);
  if (p.notes) caixa("NOTAS: " + p.notes, 10, true, false);
  sep();
  linha("Não serve de fatura · Obrigado!", 8.5, { centro: true });
  if (via) { y += 1; linha(via, 8, { centro: true, esp: 0.5 }); }
  return y;
}

/**
 * Até onde vai o tracejado do meio na folha A4: só até ao fim do talão mais comprido (+ 6 mm),
 * em vez da folha toda — poupa tinta e tempo, e a folha é cortada nesse tamanho (pedido do Fabricio, 19/11).
 * @param {number[]} fins Posição y (mm) onde acaba cada talão.
 * @returns {number} y (mm) do fim do tracejado.
 */
const impFimCorte = fins => Math.min(297, Math.max(...fins) + 6);

/** Gera o PDF do pedido com o papel e as vias escolhidos. */
async function impGerarPdf(p) {
  await impLibs();
  const pref = impPrefs(), { jsPDF } = window.jspdf;
  const vias = pref.vias === 2 ? ["VIA COZINHA", "VIA ENTREGA"] : [""];
  let pdf;
  if (pref.papel === "a4") {
    pdf = new jsPDF({ unit: "mm", format: "a4" });
    const fim = impFimCorte(vias.map((v, i) => impTalaoPdf(pdf, p, 105 * i + 9, 87, 10, v, "a4", true)));
    if (vias.length === 2) { pdf.setLineDashPattern([1.5, 1.5], 0); pdf.setLineWidth(0.2); pdf.line(105, 0, 105, fim); pdf.setLineDashPattern([], 0); }
  } else {
    const papel = pref.papel === "t58" ? 58 : 80, larg = papel === 58 ? 48 : 72;
    vias.forEach(v => {
      const medida = new jsPDF({ unit: "mm", format: [papel, 1000] });
      const alt = impTalaoPdf(medida, p, (papel - larg) / 2, larg, 3, v, pref.papel, false) + 6;
      if (!pdf) pdf = new jsPDF({ unit: "mm", format: [papel, alt], orientation: "portrait" });
      else pdf.addPage([papel, alt], "portrait");
      impTalaoPdf(pdf, p, (papel - larg) / 2, larg, 3, v, pref.papel, true);
    });
  }
  return new File([pdf.output("blob")], `pedido-${p.number}${p.public_code ? "-" + p.public_code : ""}.pdf`, { type: "application/pdf" });
}

/* ---------- talão em imagem ----------
 * A Epson Smart Panel mostra o PDF mas imprime-o em branco; imagens imprimem bem.
 * Por isso, no telemóvel, o talão sai em imagem PNG, desenhada com as mesmas regras do PDF
 * (o "papel" abaixo imita os métodos do jsPDF que impTalaoPdf usa, em mm, numa tela de 10 px/mm ≈ 254 ppp).
 */
const IMP_PXMM = 10;
function impPapelImagem(ctx) {
  const px = IMP_PXMM;
  let tam = 10, neg = false, tracejado = [];
  const aplicar = () => { ctx.font = `${neg ? 700 : 400} ${tam * 0.3528 * px}px Helvetica, Arial, sans-serif`; };
  const largura = t => ctx.measureText(t).width / px;
  return {
    setFont(_, estilo) { neg = estilo === "bold"; aplicar(); },
    setFontSize(s) { tam = s; aplicar(); },
    getTextWidth(t) { aplicar(); return largura(String(t)); },
    splitTextToSize(t, w) {
      aplicar(); const linhas = []; let atual = "";
      String(t).split(/\s+/).filter(Boolean).forEach(pal => {
        const tenta = atual ? atual + " " + pal : pal;
        if (largura(tenta) <= w || !atual) atual = tenta; else { linhas.push(atual); atual = pal; }
      });
      linhas.push(atual);
      return linhas;
    },
    text(t, x, y, o = {}) {
      aplicar(); ctx.fillStyle = "#000"; t = String(t);
      const esp = (o.charSpace || 0) * px;
      if (!esp) { ctx.textAlign = o.align === "center" ? "center" : o.align === "right" ? "right" : "left"; ctx.fillText(t, x * px, y * px); return; }
      const total = ctx.measureText(t).width + esp * (t.length - 1);
      let cx = o.align === "center" ? x * px - total / 2 : o.align === "right" ? x * px - total : x * px;
      ctx.textAlign = "left";
      for (const c of t) { ctx.fillText(c, cx, y * px); cx += ctx.measureText(c).width + esp; }
    },
    setLineDashPattern(a) { tracejado = (a || []).map(v => v * px); },
    setLineWidth(w) { ctx.lineWidth = Math.max(1, w * px); },
    line(x1, y1, x2, y2) { ctx.strokeStyle = "#000"; ctx.setLineDash(tracejado); ctx.beginPath(); ctx.moveTo(x1 * px, y1 * px); ctx.lineTo(x2 * px, y2 * px); ctx.stroke(); ctx.setLineDash([]); },
    rect(x, y, w, h) { ctx.strokeStyle = "#000"; ctx.setLineDash([]); ctx.strokeRect(x * px, y * px, w * px, h * px); }
  };
}

/** Gera o talão em imagem PNG, com o papel e as vias escolhidos. */
async function impGerarImagem(p) {
  const pref = impPrefs(), px = IMP_PXMM, vias = pref.vias === 2 ? ["VIA COZINHA", "VIA ENTREGA"] : [""];
  const tela = (wmm, hmm) => { const c = document.createElement("canvas"); c.width = Math.round(wmm * px); c.height = Math.round(hmm * px); const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); return [c, ctx]; };
  let c;
  if (pref.papel === "a4") {
    const [c4, ctx] = tela(210, 297), papel = impPapelImagem(ctx);
    const fim = impFimCorte(vias.map((v, i) => impTalaoPdf(papel, p, 105 * i + 9, 87, 10, v, "a4", true)));
    if (vias.length === 2) { papel.setLineDashPattern([1.5, 1.5]); papel.setLineWidth(0.2); papel.line(105, 0, 105, fim); }
    c = c4;
  } else {
    const larg = pref.papel === "t58" ? 58 : 80, util = larg === 58 ? 48 : 72, x0 = (larg - util) / 2;
    const [cm, ctxm] = tela(larg, 10), alturas = vias.map(v => impTalaoPdf(impPapelImagem(ctxm), p, x0, util, 3, v, pref.papel, false) + 6);
    const [ct, ctx] = tela(larg, alturas.reduce((a, b) => a + b, 0)), papel = impPapelImagem(ctx);
    let y = 0;
    vias.forEach((v, i) => {
      impTalaoPdf(papel, p, x0, util, y + 3, v, pref.papel, true); y += alturas[i];
      if (i < vias.length - 1) { papel.setLineDashPattern([1, 1]); papel.setLineWidth(0.2); papel.line(0, y, larg, y); papel.setLineDashPattern([]); }
    });
    c = ct; void cm;
  }
  const blob = await new Promise(ok => c.toBlob(ok, "image/png"));
  return new File([blob], `pedido-${p.number}${p.public_code ? "-" + p.public_code : ""}.png`, { type: "image/png" });
}

/** Abre a partilha do telemóvel com o ficheiro; no computador descarrega-o. */
async function impEntregar(f) {
  if (impTatil() && navigator.canShare && navigator.canShare({ files: [f] })) {
    await navigator.share({ files: [f], title: f.name });
    return;
  }
  const url = URL.createObjectURL(f), a = document.createElement("a");
  a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** Gera (imagem ou PDF) e partilha; se o telemóvel pedir outro toque, deixa o ficheiro pronto. */
async function impPartilhar(tipo) {
  const p = pedidosLoja.find(x => x.id === impPedidoId);
  if (!p || impPdfA) return;
  const chave = JSON.stringify(impPrefs()) + tipo;
  try {
    if (!impPdf || impPdf.id !== p.id || impPdf.pref !== chave) {
      impPdfA = tipo; renderFolha();
      impPdf = { id: p.id, pref: chave, tipo, file: tipo === "img" ? await impGerarImagem(p) : await impGerarPdf(p), pronto: false };
    }
    impPdfA = false;
    try { await impEntregar(impPdf.file); impPdf.pronto = false; }
    catch (e) {
      if (e && e.name === "AbortError") { renderFolha(); return; }
      impPdf.pronto = true; // o telemóvel exige um toque novo para partilhar
    }
    renderFolha();
  } catch (e) {
    impPdfA = false; renderFolha();
    brinde(tipo === "img" ? "Não foi possível criar a imagem do talão." : "Não foi possível criar o PDF. Verifique a internet e tente outra vez.");
  }
}

const vImprimirSemPdf = VISTAS["adm-imprimir"];
VISTAS["adm-imprimir"] = function () {
  const v = vImprimirSemPdf();
  if (!v.pe) return v;
  if (!impTatil()) impLibs().catch(() => {}); // adianta o carregamento do PDF no computador
  const pronto = t => impPdf && impPdf.pronto && impPdf.tipo === t && impPdf.id === impPedidoId && impPdf.pref === JSON.stringify(impPrefs()) + t;
  const botao = (t, rotulo, sec) => `<button type="button" class="btn ${sec ? "btn-sec " : ""}btn-bloco" data-a="imp-partilhar" data-t="${t}" ${impPdfA ? "disabled" : ""}${sec ? ' style="margin-top:.5rem"' : ""}>${impPdfA === t ? "A preparar…" : pronto(t) ? "Pronto: tocar para partilhar" : rotulo}</button>`;
  if (impTatil()) {
    v.pe = botao("img", "Partilhar imagem (Epson Smart Panel)") + botao("pdf", "Partilhar PDF", true);
    v.corpo = v.corpo.replace('<p class="nota">Na janela de impressão:', '<p class="nota">No telemóvel: toque em "Partilhar imagem" e escolha a <strong>Epson Smart Panel</strong>. Lá, papel <strong>A4 normal</strong>, <strong>sem margens desligado</strong> (com margens) e tamanho real.</p><p class="nota">No computador, na janela de impressão:');
  } else {
    v.pe = `<button type="button" class="btn btn-bloco" data-a="imp-imprimir">Imprimir</button>` + botao("pdf", "Descarregar PDF", true) + botao("img", "Descarregar imagem", true);
  }
  return v;
};

Object.assign(ACOES, {
  "imp-partilhar"(b) {
    const t = b.dataset.t;
    if (impPdf && impPdf.pronto && impPdf.tipo === t) { impPdf.pronto = false; impEntregar(impPdf.file).catch(() => {}).finally(renderFolha); return; }
    impPartilhar(t);
  }
});

if (S.vista === "adm-imprimir") renderFolha();
