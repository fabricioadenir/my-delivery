/* ---------- imprimir pelo telemóvel: talão em PDF ----------
 * No telemóvel o "Imprimir" do navegador muitas vezes não faz nada (sobretudo com o site
 * instalado como app no iPhone). Por isso a pré-visualização tem agora "Partilhar PDF":
 * gera o talão em PDF (mesmo papel e vias escolhidos) e abre a partilha do telemóvel,
 * onde se escolhe a Epson Smart Panel (ou outra app da impressora).
 * No computador o PDF é descarregado. As bibliotecas (public/lib) só carregam quando se abre a impressão.
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
const impLibs = () => Promise.all([impCarregar("lib/html2canvas.min.js"), impCarregar("lib/jspdf.umd.min.js")]);
const impTatil = () => window.matchMedia && matchMedia("(pointer: coarse)").matches;

/** Desenha um bloco de HTML fora do ecrã e devolve-o em imagem. */
async function impCanvas(html, larguraMm) {
  const caixa = document.createElement("div");
  caixa.style.cssText = `position:fixed;left:-10000px;top:0;width:${larguraMm}mm;background:#fff`;
  caixa.innerHTML = html;
  document.body.appendChild(caixa);
  try { return await html2canvas(caixa, { scale: 3, backgroundColor: "#ffffff", logging: false }); }
  finally { caixa.remove(); }
}

/** Gera o PDF do pedido com o papel e as vias escolhidos. */
async function impGerarPdf(p) {
  await impLibs();
  const pref = impPrefs(), { jsPDF } = window.jspdf;
  let pdf;
  if (pref.papel === "a4") {
    const vias = (pref.vias === 2 ? ["VIA COZINHA", "VIA ENTREGA"] : [""]).map((v, i) => talaoHtml(p, "a4", v)
      .replace('class="talao ', `style="width:105mm;padding:10mm 9mm;${i ? "border-left:1px dashed #000;" : ""}" class="talao `)).join("");
    const c = await impCanvas(`<div style="display:flex;width:210mm">${vias}</div>`, 210);
    pdf = new jsPDF({ unit: "mm", format: "a4" });
    const h = c.height * 210 / c.width, img = c.toDataURL("image/jpeg", 0.92);
    for (let y = 0; y < h; y += 297) { if (y) pdf.addPage(); pdf.addImage(img, "JPEG", 0, -y, 210, h); }
  } else {
    const papel = pref.papel === "t58" ? 58 : 80, larg = papel === 58 ? 48 : 72;
    const vias = pref.vias === 2 ? ["VIA COZINHA", "VIA ENTREGA"] : [""];
    for (let i = 0; i < vias.length; i++) {
      const c = await impCanvas(talaoHtml(p, pref.papel, vias[i]).replace('class="talao ', `style="width:${larg}mm;padding:2mm 0 4mm" class="talao `), larg);
      const h = c.height * larg / c.width, alt = h + 4;
      if (!pdf) pdf = new jsPDF({ unit: "mm", format: [papel, alt], orientation: "portrait" });
      else pdf.addPage([papel, alt], "portrait");
      pdf.addImage(c.toDataURL("image/png"), "PNG", (papel - larg) / 2, 2, larg, h);
    }
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
