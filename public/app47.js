/* ---------- imprimir pelo telemóvel: talão em PDF ----------
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

/** Gera o PDF do pedido com o papel e as vias escolhidos. */
async function impGerarPdf(p) {
  await impLibs();
  const pref = impPrefs(), { jsPDF } = window.jspdf;
  const vias = pref.vias === 2 ? ["VIA COZINHA", "VIA ENTREGA"] : [""];
  let pdf;
  if (pref.papel === "a4") {
    pdf = new jsPDF({ unit: "mm", format: "a4" });
    vias.forEach((v, i) => impTalaoPdf(pdf, p, 105 * i + 9, 87, 10, v, "a4", true));
    if (vias.length === 2) { pdf.setLineDashPattern([1.5, 1.5], 0); pdf.setLineWidth(0.2); pdf.line(105, 0, 105, 297); pdf.setLineDashPattern([], 0); }
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

/** Abre a partilha do telemóvel com o PDF; no computador descarrega-o. */
async function impEntregarPdf(f) {
  if (impTatil() && navigator.canShare && navigator.canShare({ files: [f] })) {
    await navigator.share({ files: [f], title: f.name });
    return;
  }
  const url = URL.createObjectURL(f), a = document.createElement("a");
  a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** Botão "Partilhar PDF": gera e partilha; se o telemóvel pedir outro toque, deixa o PDF pronto. */
async function impPartilhar() {
  const p = pedidosLoja.find(x => x.id === impPedidoId);
  if (!p || impPdfA) return;
  try {
    if (!impPdf || impPdf.id !== p.id || impPdf.pref !== JSON.stringify(impPrefs())) {
      impPdfA = true; renderFolha();
      impPdf = { id: p.id, pref: JSON.stringify(impPrefs()), file: await impGerarPdf(p), pronto: false };
    }
    impPdfA = false;
    try { await impEntregarPdf(impPdf.file); impPdf.pronto = false; }
    catch (e) {
      if (e && e.name === "AbortError") { renderFolha(); return; }
      impPdf.pronto = true; // o telemóvel exige um toque novo para partilhar
    }
    renderFolha();
  } catch (e) {
    impPdfA = false; renderFolha();
    brinde("Não foi possível criar o PDF. Verifique a internet e tente outra vez.");
  }
}

const vImprimirSemPdf = VISTAS["adm-imprimir"];
VISTAS["adm-imprimir"] = function () {
  const v = vImprimirSemPdf();
  if (!v.pe) return v;
  impLibs().catch(() => {}); // adianta o carregamento para o PDF sair rápido
  const pronto = impPdf && impPdf.pronto && impPdf.id === impPedidoId && impPdf.pref === JSON.stringify(impPrefs());
  const rotulo = impPdfA ? "A preparar o PDF…" : pronto ? "PDF pronto: tocar para partilhar" : impTatil() ? "Partilhar PDF (Epson Smart Panel)" : "Descarregar PDF";
  const pdf = `<button type="button" class="btn btn-bloco" data-a="imp-pdf" ${impPdfA ? "disabled" : ""}>${rotulo}</button>`;
  const nav = `<button type="button" class="btn btn-sec btn-bloco" data-a="imp-imprimir" style="margin-top:.5rem">Imprimir pelo navegador</button>`;
  v.pe = impTatil() ? pdf + nav : nav.replace("btn btn-sec", "btn").replace(' style="margin-top:.5rem"', "") + pdf.replace('class="btn btn-bloco"', 'class="btn btn-sec btn-bloco" style="margin-top:.5rem"');
  if (impTatil()) v.corpo = v.corpo.replace('<p class="nota">Na janela de impressão:', '<p class="nota">No telemóvel: toque em "Partilhar PDF" e escolha a <strong>Epson Smart Panel</strong>; lá, imprima em A4 com tamanho real (100%).</p><p class="nota">No computador, na janela de impressão:');
  return v;
};

Object.assign(ACOES, {
  "imp-pdf"() {
    if (impPdf && impPdf.pronto) { impPdf.pronto = false; impEntregarPdf(impPdf.file).catch(() => {}).finally(renderFolha); return; }
    impPartilhar();
  }
});

if (S.vista === "adm-imprimir") renderFolha();
