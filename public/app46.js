/* ---------- imprimir o pedido (talão de cozinha / entrega) ----------
 * Gestão → cartão do pedido → "Imprimir". Abre a pré-visualização do talão, no formato
 * dos restaurantes (n.º, hora de entrega em destaque, cliente, itens, totais, pagamento, notas).
 * Papel, escolhido aqui e guardado neste aparelho:
 *  - "Folha A4 cortada ao meio": 2 vias lado a lado (cada uma com 10,5 cm de largura);
 *    corta-se a folha ao meio na linha tracejada e fica um talão para a cozinha e outro para a entrega.
 *  - "Térmica 80 mm" e "Térmica 58 mm": rolo das impressoras de talões; 1 ou 2 vias, uma a seguir à outra.
 * Não é fatura: o talão diz "Não serve de fatura".
 */
const IMP_PAPEIS = {
  a4: { nome: "Folha A4 cortada ao meio", nota: "Saem 2 talões lado a lado. Corte a folha ao meio na linha tracejada." },
  t80: { nome: "Térmica 80 mm", nota: "Para a impressora de talões com rolo de 80 mm." },
  t58: { nome: "Térmica 58 mm", nota: "Para a impressora de talões com rolo de 58 mm." }
};
let impPedidoId = null, impVoltar = "adm-pedidos";

/** Preferências de impressão deste aparelho. */
function impPrefs() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem("ss_impressao") || "{}") || {}; } catch (e) { /* sem armazenamento */ }
  return { papel: IMP_PAPEIS[p.papel] ? p.papel : "a4", vias: p.vias === 1 ? 1 : 2 };
}
function impGuardar(p) { try { localStorage.setItem("ss_impressao", JSON.stringify(p)); } catch (e) { /* sem armazenamento */ } }

document.head.insertAdjacentHTML("beforeend", `<style>
.talao{background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;font-size:10pt;line-height:1.3;box-sizing:border-box}
.talao *{color:#000}
.talao p{margin:0}
.talao .t-centro{text-align:center}
.talao .t-loja{font-size:15pt;font-weight:800;letter-spacing:.02em}
.talao .t-peq{font-size:8.5pt}
.talao .t-sep{border-top:1px dashed #000;margin:2.2mm 0}
.talao .t-num{font-size:17pt;font-weight:800;line-height:1.15}
.talao .t-num small{font-size:11pt;font-weight:700}
.talao .t-caixa{border:2px solid #000;padding:1.5mm 2mm;margin:2mm 0;text-align:center;font-weight:800;font-size:12pt}
.talao .t-titulo{font-weight:800;font-size:9pt;letter-spacing:.06em;margin-bottom:.8mm}
.talao .t-forte{font-weight:800}
.talao table{width:100%;border-collapse:collapse}
.talao td{vertical-align:top;padding:.6mm 0}
.talao td.t-q{width:9mm;font-weight:800;white-space:nowrap}
.talao td.t-v{text-align:right;white-space:nowrap;padding-left:2mm}
.talao .t-linha{display:flex;justify-content:space-between;gap:2mm}
.talao .t-total{font-size:13pt;font-weight:800;margin-top:1mm}
.talao .t-aviso{border:1.5px solid #000;padding:1.5mm 2mm;margin-top:2mm;font-weight:700}
.talao .t-via{font-size:8pt;text-align:center;margin-top:2mm;letter-spacing:.08em}
.talao.t58{font-size:8.5pt}
.talao.t58 .t-loja{font-size:12pt}.talao.t58 .t-num{font-size:14pt}.talao.t58 .t-caixa{font-size:10pt}.talao.t58 .t-total{font-size:11pt}
.imp-previa{background:#e9e9e9;border-radius:12px;padding:12px;overflow-x:auto;margin:.8rem 0}
.imp-previa .talao{margin:0 auto;box-shadow:0 2px 10px #0003}
#impressao{display:none}
@media print{
  html.a-imprimir,html.a-imprimir body{background:#fff!important;margin:0!important;padding:0!important;overflow:visible!important;height:auto!important}
  html.a-imprimir body>*:not(#impressao){display:none!important}
  html.a-imprimir #impressao{display:block!important}
  #impressao .imp-folha{display:flex;width:210mm}
  #impressao .imp-folha .talao{width:105mm;padding:10mm 9mm}
  #impressao .imp-folha .talao+.talao{border-left:1px dashed #000}
  #impressao .imp-rolo .talao{padding:2mm 3mm 6mm}
  #impressao .imp-rolo .talao+.talao{break-before:page;page-break-before:always}
  #impressao .talao{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
</style>`);

/** Valor em euros para o talão. */
const impEur = v => eur(+v || 0);

/**
 * HTML de um talão (uma via).
 * @param {object} p Pedido da gestão.
 * @param {string} papel "a4", "t80" ou "t58".
 * @param {string} via Texto da via ("VIA COZINHA") ou vazio.
 */
function talaoHtml(p, papel, via) {
  const itens = (p.order_items || []).map(i => `<tr><td class="t-q">${i.quantity}x</td><td>${esc(i.product_name)}</td><td class="t-v">${impEur(i.line_total)}</td></tr>`).join("");
  const entrega = p.asap ? "O MAIS CEDO POSSÍVEL" : "ENTREGA " + esc(fmtData(p.deliver_at)).replace(", ", " às ");
  const origem = p.channel && p.channel !== "site" ? ` · ${esc((typeof ORIGENS !== "undefined" && ORIGENS[p.channel]) || p.channel)}` : " · Site";
  const ex = p.extras || {}, extras = [];
  if (typeof ex.wasabi === "boolean") extras.push("Wasabi: " + (ex.wasabi ? "SIM" : "não"));
  if (typeof ex.elastico === "boolean") extras.push("Palitos: " + (ex.elastico ? "COM elástico" : "sem elástico"));
  let troco = "";
  if (p.change_for && /^(Numerário|Dinheiro)$/.test(p.payment_method || "")) {
    const c = Math.round(+p.change_for * 100) - Math.round(+p.total * 100);
    troco = `<p>Troco para ${impEur(p.change_for)}${c > 0 ? ` → <span class="t-forte">levar ${eur(c / 100)}</span>` : c === 0 ? " (valor certo)" : " (confirmar com o cliente)"}</p>`;
  }
  const fee = +p.delivery_fee || 0;
  return `<div class="talao ${papel}">
    <p class="t-centro t-loja">${esc(CONFIG.nome)}</p>
    <p class="t-centro t-peq">sakuraesalsushi.pt · ${esc(CONFIG.telefoneVisivel)}</p>
    <div class="t-sep"></div>
    <p class="t-num">N.º ${p.number}${p.public_code ? ` <small>· ${esc(p.public_code)}</small>` : ""}</p>
    <p class="t-peq">Recebido ${esc(fmtData(p.created_at))}${origem}</p>
    <p class="t-caixa">${entrega}</p>
    <p class="t-titulo">CLIENTE</p>
    <p class="t-forte">${esc(p.customer_name)}</p>
    <p>${esc(p.customer_phone)}</p>
    <p>${esc(p.address_street)}</p>
    <p>${esc(p.address_locality)}${p.zone_name && p.zone_name !== p.address_locality ? ` (${esc(p.zone_name)})` : ""}</p>
    ${p.address_reference ? `<p>Ref.: ${esc(p.address_reference)}</p>` : ""}
    <div class="t-sep"></div>
    <table>${itens}</table>
    <div class="t-sep"></div>
    <p class="t-linha"><span>Produtos</span><span>${impEur(p.subtotal)}</span></p>
    ${+p.discount > 0 ? `<p class="t-linha"><span>Desconto</span><span>−${impEur(p.discount)}</span></p>` : ""}
    <p class="t-linha"><span>Entrega</span><span>${fee ? impEur(fee) : "Grátis"}</span></p>
    <p class="t-linha t-total"><span>TOTAL</span><span>${impEur(p.total)}</span></p>
    <p>Pagamento: <span class="t-forte">${esc(p.payment_method || "por indicar")}</span> (na entrega)</p>${troco}
    ${extras.length ? `<div class="t-sep"></div><p class="t-forte">${extras.join("<br>")}</p>` : ""}
    ${p.allergy_notes ? `<p class="t-aviso">ATENÇÃO: ${esc(p.allergy_notes)}</p>` : ""}
    ${p.notes ? `<p class="t-aviso">NOTAS: ${esc(p.notes)}</p>` : ""}
    <div class="t-sep"></div>
    <p class="t-centro t-peq">Não serve de fatura · Obrigado!</p>
    ${via ? `<p class="t-via">${via}</p>` : ""}
  </div>`;
}

/** Vias a imprimir conforme as preferências. */
function impVias(p, pref) {
  const nomes = pref.vias === 2 ? ["VIA COZINHA", "VIA ENTREGA"] : [""];
  return nomes.map(v => talaoHtml(p, pref.papel, v)).join("");
}

/** Ecrã de pré-visualização e escolha do papel. */
function vImprimir() {
  const p = pedidosLoja.find(x => x.id === impPedidoId), pref = impPrefs();
  const voltar = `<p style="margin-bottom:1rem"><button type="button" class="ligacao" data-a="${impVoltar === "admin" ? "abrir-admin" : "adm-pedidos"}">Voltar aos pedidos</button></p>`;
  if (!p) return { titulo: "Imprimir pedido", corpo: voltar + `<p>Não encontrei este pedido. Volte aos pedidos e tente outra vez.</p>` };
  const papeis = Object.keys(IMP_PAPEIS).map(k => `<button type="button" data-a="imp-papel" data-p="${k}" aria-pressed="${k === pref.papel}">${IMP_PAPEIS[k].nome}</button>`).join("");
  const vias = [1, 2].map(n => `<button type="button" data-a="imp-vias" data-n="${n}" aria-pressed="${n === pref.vias}">${n === 1 ? "1 via" : "2 vias (cozinha e entrega)"}</button>`).join("");
  const largura = pref.papel === "t58" ? "48mm" : pref.papel === "t80" ? "72mm" : "105mm";
  const notaA4 = pref.papel === "a4" ? (pref.vias === 2 ? IMP_PAPEIS.a4.nota : "Sai 1 talão na metade esquerda da folha.") : IMP_PAPEIS[pref.papel].nota;
  return { titulo: `Imprimir N.º ${p.number}`,
    corpo: voltar + `<div class="grupo"><h3>Papel</h3><div class="filtros">${papeis}</div><p class="nota" style="margin:0">${notaA4}</p>
      <h3 style="margin-top:1rem">Vias</h3><div class="filtros">${vias}</div></div>
      <p class="nota">Pré-visualização (1 via, tamanho real aproximado):</p>
      <div class="imp-previa"><div style="width:${largura};margin:0 auto">${talaoHtml(p, pref.papel, pref.vias === 2 ? "VIA COZINHA" : "")
        .replace('class="talao ', `style="width:${largura};padding:${pref.papel === "a4" ? "6mm 6mm" : "2mm 3mm"}" class="talao `)}</div></div>
      <p class="nota">Na janela de impressão: margens "Predefinição" ou "Nenhuma", escala 100% e sem cabeçalhos/rodapés.</p>`,
    pe: `<button type="button" class="btn btn-bloco" data-a="imp-imprimir">Imprimir</button>` };
}
VISTAS["adm-imprimir"] = vImprimir;
GRUPOS["adm-imprimir"] = "pedidos";

/** Monta as vias no fim da página e abre a janela de impressão do navegador. */
function imprimirPedido() {
  const p = pedidosLoja.find(x => x.id === impPedidoId);
  if (!p) return;
  const pref = impPrefs();
  let alvo = document.getElementById("impressao");
  if (!alvo) { alvo = document.createElement("div"); alvo.id = "impressao"; document.body.appendChild(alvo); }
  alvo.innerHTML = `<div class="${pref.papel === "a4" ? "imp-folha" : "imp-rolo"}">${impVias(p, pref)}</div>`;
  let pag = document.getElementById("impressao-pagina");
  if (!pag) { pag = document.createElement("style"); pag.id = "impressao-pagina"; document.head.appendChild(pag); }
  pag.textContent = pref.papel === "a4" ? "@media print{@page{size:A4 portrait;margin:0}}"
    : `@media print{@page{margin:0}#impressao .talao{width:${pref.papel === "t58" ? "48mm" : "72mm"}}}`;
  document.documentElement.classList.add("a-imprimir");
  window.print();
}
window.addEventListener("afterprint", () => document.documentElement.classList.remove("a-imprimir"));

Object.assign(ACOES, {
  "pedido-imprimir"(b) { impPedidoId = b.dataset.id; impVoltar = S.vista === "admin" ? "admin" : "adm-pedidos"; abrir("adm-imprimir"); },
  "imp-papel"(b) { impGuardar(Object.assign(impPrefs(), { papel: b.dataset.p })); renderFolha(); },
  "imp-vias"(b) { impGuardar(Object.assign(impPrefs(), { vias: +b.dataset.n })); renderFolha(); },
  "imp-imprimir"() { imprimirPedido(); }
});

/* Cartão do pedido: ligação "Imprimir" junto de Ligar / WhatsApp / mapa. */
const cartaoSemImprimir = cartaoOperacao;
cartaoOperacao = function (p) {
  const h = cartaoSemImprimir(p), botao = `<button type="button" class="ligacao" data-a="pedido-imprimir" data-id="${esc(p.id)}">Imprimir</button>`;
  const marca = "Abrir no mapa</a>";
  return h.includes(marca) ? h.replace(marca, marca + botao) : h.replace(/(<small style="color:var\(--tinta-2\)">Recebido em)/, `<p class="adm-acoes">${botao}</p>$1`);
};

if (S.vista && /^(admin|adm-pedidos)$/.test(S.vista)) renderFolha();
