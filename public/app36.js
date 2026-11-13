/* ---------- pedidos externos: registar na gestão um pedido que chegou por WhatsApp, telefone ou em pessoa ----------
 * Gestão → Pedidos → "Registar pedido". Entra na mesma numeração, com código público, estados, custos e stock.
 * Sempre entrega (sem levantar no local). Preços e taxa vêm do menu e da zona; pode levar desconto em euros.
 */
document.head.insertAdjacentHTML("beforeend", `<style>
.man-prod{display:flex;align-items:center;justify-content:space-between;gap:.6rem;padding:.55rem 0;border-bottom:1px solid var(--linha)}
.man-prod:last-child{border-bottom:0}
.man-prod small{display:block;color:var(--tinta-2)}
.man-resumo p{display:flex;justify-content:space-between;margin:.25rem 0}
.man-resumo .total{font-size:1.15rem;font-weight:800}
.man-quando{display:grid;grid-template-columns:1fr 1fr;gap:.6rem}
</style>`);

const ORIGENS = { whatsapp: "WhatsApp", instagram: "Instagram", telefone: "Telefone", presencial: "Presencial", outro: "Outro" };
let manual = null;

/** Pedido em branco para o formulário. */
function novoManual() {
  const n = agora();
  return { nome: "", tel: "", zona: (CONFIG.zonas[0] || {}).id || "", rua: "", localidade: "", ref: "", asap: true,
    dia: n.y + "-" + doisD(n.m) + "-" + doisD(n.d), hora: "", pag: CONFIG.pagamentos[0] || "", troco: "", desconto: "",
    origem: "whatsapp", obs: "", itens: {} };
}

/** Linhas do pedido: chave do ITEM (inclui "~fresca"/"~natural") e quantidade. */
const linhasManual = () => Object.entries(manual.itens).filter(([k, q]) => q > 0 && ITEM[k]);
const subManual = () => linhasManual().reduce((s, [k, q]) => s + ITEM[k].preco * q, 0);

/** Quantidade de um produto no formulário, com + / −. */
function passoManual(k, rotulo) {
  const q = manual.itens[k] || 0, n = esc(ITEM[k].nome);
  if (!q) return `<button type="button" class="btn btn-sec" data-a="man-mais" data-id="${k}" aria-label="Juntar ${n}">${rotulo ? esc(rotulo) : "Juntar"}</button>`;
  return `<div class="passo" role="group" aria-label="Quantidade de ${n}">${rotulo ? `<small style="margin-right:.3rem">${esc(rotulo)}</small>` : ""}<button type="button" data-a="man-menos" data-id="${k}" aria-label="Tirar um">−</button><span>${q}</span><button type="button" data-a="man-mais" data-id="${k}" aria-label="Juntar mais um">+</button></div>`;
}

/** Produtos do menu (visíveis) por categoria. */
function listaProdutosManual() {
  return D.categorias.map(c => {
    const ps = D.produtos.filter(p => p.cat === c.id && p.ativo !== false && ITEM[p.id]);
    if (!ps.length) return "";
    return `<div class="grupo"><h3>${esc(c.nome)}</h3>${ps.map(p => {
      const it = ITEM[p.id];
      const ctl = it.temp
        ? `<div class="temp-escolha">${OPCOES_TEMP.map(([o, r]) => passoManual(chaveTemp(p.id, o), r)).join("")}</div>`
        : passoManual(p.id);
      return `<div class="man-prod"><div><strong>${esc(p.nome)}</strong><small>${it.min > 1 ? it.min + " un. " + eur(it.preco * it.min) : eur(it.preco)}</small></div>${ctl}</div>`;
    }).join("")}</div>`;
  }).join("");
}

/** Resumo com subtotal, entrega, desconto e total. */
function resumoManual() {
  const sub = subManual(), z = ZONA[manual.zona], taxa = z ? +z.taxa : 0, desc = Math.min(sub, num(manual.desconto) || 0);
  return `<div class="man-resumo"><p><span>Produtos</span><span>${eur(sub)}</span></p><p><span>Entrega${z ? " em " + esc(z.nome) : ""}</span><span>${taxa ? eur(taxa) : "Grátis"}</span></p>
    ${desc > 0 ? `<p><span>Desconto</span><span>−${eur(desc)}</span></p>` : ""}<p class="total"><span>Total</span><span>${eur(sub - desc + taxa)}</span></p></div>`;
}

/** Formulário do pedido externo. */
function vPedidoManual() {
  const m = manual, sel = (v, a) => v === a ? "selected" : "";
  return { titulo: "Registar pedido",
    corpo: `<p><button type="button" class="ligacao" data-a="adm-pedidos">Voltar aos pedidos</button></p>
      <p style="color:var(--tinta-2);margin:.4rem 0 1rem">Para pedidos que chegaram por fora do site. Ficam com número, código e estados como os outros, e contam nos resultados, custos e stock.</p>
      <div class="grupo"><h3>Cliente</h3>
        <label class="campo" style="margin-top:0"><span>Origem</span><select name="man_origem">${Object.keys(ORIGENS).map(k => `<option value="${k}" ${sel(k, m.origem)}>${ORIGENS[k]}</option>`).join("")}</select></label>
        <label class="campo"><span>Telemóvel</span><input type="tel" name="man_tel" value="${esc(m.tel)}" inputmode="tel" autocomplete="off"><small>Se já fez pedidos, o nome e a morada aparecem sozinhos.</small></label>
        <label class="campo"><span>Nome</span><input type="text" name="man_nome" value="${esc(m.nome)}" autocomplete="off"></label></div>
      <div class="grupo"><h3>Entrega</h3>
        <label class="campo" style="margin-top:0"><span>Zona</span><select name="man_zona">${CONFIG.zonas.map(z => `<option value="${esc(z.id)}" ${sel(z.id, m.zona)}>${esc(z.nome)}${+z.taxa ? " (" + eur(+z.taxa) + ")" : " (grátis)"}</option>`).join("")}</select></label>
        <label class="campo"><span>Rua e número</span><input type="text" name="man_rua" value="${esc(m.rua)}" autocomplete="off"></label>
        <label class="campo"><span>Localidade</span><input type="text" name="man_localidade" value="${esc(m.localidade)}" autocomplete="off"></label>
        <label class="campo"><span>Referência (opcional)</span><input type="text" name="man_ref" value="${esc(m.ref)}" autocomplete="off"></label>
        <fieldset style="border:0;padding:0;margin:.9rem 0 0"><legend style="font-weight:700;margin-bottom:.3rem">Quando</legend>
          <label class="opcao"><input type="radio" name="man_asap" value="1" ${m.asap ? "checked" : ""}><span><strong>O mais cedo possível</strong></span></label>
          <label class="opcao"><input type="radio" name="man_asap" value="0" ${m.asap ? "" : "checked"}><span><strong>Dia e hora marcados</strong></span></label></fieldset>
        <div class="man-quando" id="man-quando" ${m.asap ? "hidden" : ""}><label class="campo"><span>Dia</span><input type="date" name="man_dia" value="${esc(m.dia)}"></label>
          <label class="campo"><span>Hora</span><input type="time" name="man_hora" value="${esc(m.hora)}" step="300"></label></div></div>
      ${listaProdutosManual()}
      <div class="grupo"><h3>Pagamento</h3>
        <label class="campo" style="margin-top:0"><span>Forma de pagamento</span><select name="man_pag">${CONFIG.pagamentos.map(p => `<option ${sel(p, m.pag)}>${esc(p)}</option>`).join("")}</select></label>
        <label class="campo" id="man-troco" ${m.pag === "Numerário" ? "" : "hidden"}><span>Troco para (opcional)</span><input type="text" name="man_troco" value="${esc(m.troco)}" inputmode="decimal"></label>
        <label class="campo"><span>Desconto em euros (opcional)</span><input type="text" name="man_desconto" value="${esc(m.desconto)}" inputmode="decimal" placeholder="0,00"><small>Sai dos produtos; a taxa de entrega mantém-se.</small></label>
        <label class="campo"><span>Notas (opcional)</span><textarea name="man_obs" rows="2">${esc(m.obs)}</textarea></label></div>
      <div id="man-resumo" class="grupo">${resumoManual()}</div>`,
    pe: `<div id="erros"></div><button type="button" class="btn btn-bloco" data-a="man-guardar">Registar pedido</button>` };
}
VISTAS["adm-pedido-novo"] = vPedidoManual;
GRUPOS["adm-pedido-novo"] = "pedidos";
FORMULARIOS.add("adm-pedido-novo");

/** Lê os campos do formulário para o estado. */
function lerManual() {
  if (!manual || S.vista !== "adm-pedido-novo") return;
  const v = n => { const c = campo("man_" + n); return c ? c.value : manual[n]; };
  Object.assign(manual, { nome: v("nome"), tel: v("tel"), zona: v("zona"), rua: v("rua"), localidade: v("localidade"), ref: v("ref"),
    dia: v("dia"), hora: v("hora"), pag: v("pag"), troco: v("troco"), desconto: v("desconto"), origem: v("origem"), obs: v("obs") });
  const r = document.querySelector('[name="man_asap"]:checked'); if (r) manual.asap = r.value === "1";
}

/** Preenche nome e morada a partir do último pedido com o mesmo telemóvel. */
function preencherPorTelefone() {
  const d = manual.tel.replace(/\D/g, "").slice(-9);
  if (d.length < 9) return;
  const p = pedidosLoja.find(o => String(o.customer_phone || "").replace(/\D/g, "").slice(-9) === d);
  if (!p) return;
  const muda = [];
  if (!manual.nome) { manual.nome = p.customer_name; muda.push(["nome", p.customer_name]); }
  if (!manual.rua && !manual.localidade) {
    Object.assign(manual, { rua: p.address_street || "", localidade: p.address_locality || "", ref: p.address_reference || "" });
    muda.push(["rua", manual.rua], ["localidade", manual.localidade], ["ref", manual.ref]);
    if (p.zone_id && ZONA[p.zone_id]) { manual.zona = p.zone_id; muda.push(["zona", p.zone_id]); }
  }
  muda.forEach(([n, val]) => { const c = campo("man_" + n); if (c) c.value = val; });
  if (muda.length) { brinde("Dados do último pedido de " + manual.nome.split(" ")[0]); atualizarResumoManual(); }
}

function atualizarResumoManual() { const r = $("#man-resumo"); if (r) r.innerHTML = resumoManual(); }

$("#folha").addEventListener("input", ev => {
  if (S.vista !== "adm-pedido-novo") return;
  lerManual();
  if (ev.target.name === "man_tel") preencherPorTelefone();
  if (["man_desconto", "man_zona"].includes(ev.target.name)) atualizarResumoManual();
});
$("#folha").addEventListener("change", ev => {
  if (S.vista !== "adm-pedido-novo") return;
  lerManual();
  const q = $("#man-quando"); if (q) q.hidden = manual.asap;
  const t = $("#man-troco"); if (t) t.hidden = manual.pag !== "Numerário";
  atualizarResumoManual();
});

/** Volta a desenhar o formulário sem perder a posição. */
function redesenharManual(foco) {
  const corpo = $("#folha-corpo"), y = corpo ? corpo.scrollTop : 0;
  renderFolha();
  const c2 = $("#folha-corpo"); if (c2) c2.scrollTop = y;
  const alvo = foco && ($(`[data-a="man-mais"][data-id="${foco}"]`) || $(`[data-a="man-menos"][data-id="${foco}"]`)); if (alvo) alvo.focus();
}

Object.assign(ACOES, {
  "man-novo"() { manual = novoManual(); abrir("adm-pedido-novo"); },
  // peças vendidas em porções (ex.: 4) andam de porção em porção, como no site
  "man-mais"(b) { lerManual(); const k = b.dataset.id, m = ITEM[k].min || 1; manual.itens[k] = (manual.itens[k] || 0) + m; redesenharManual(k); },
  "man-menos"(b) { lerManual(); const k = b.dataset.id, m = ITEM[k].min || 1; manual.itens[k] = Math.max(0, (manual.itens[k] || 0) - m); redesenharManual(k); },
  async "man-guardar"() {
    lerManual();
    const m = manual, e = [], linhas = linhasManual(), sub = subManual(), desc = num(m.desconto) || 0;
    if (m.nome.trim().length < 2) e.push("Escreva o nome do cliente.");
    if (m.tel.replace(/\D/g, "").length < 9) e.push("Escreva o telemóvel com 9 dígitos.");
    if (!m.rua.trim() || !m.localidade.trim()) e.push("Escreva a rua e a localidade.");
    if (!ZONA[m.zona]) e.push("Escolha a zona de entrega.");
    if (!m.asap && (!m.dia || !m.hora)) e.push("Escolha o dia e a hora da entrega.");
    if (!linhas.length) e.push("Junte pelo menos um produto.");
    if (desc < 0 || desc > sub) e.push("O desconto tem de ficar entre 0 e " + eur(sub) + ".");
    if (e.length) return mostrarErros(e);
    const corpo = {
      customer_name: m.nome.trim(), customer_phone: m.tel.trim(), zone_id: m.zona,
      address_street: m.rua.trim(), address_locality: m.localidade.trim(), address_reference: m.ref.trim() || null,
      asap: m.asap, deliver_at_local: m.asap ? null : m.dia + "T" + m.hora,
      items: linhas.map(([k, q]) => { const it = ITEM[k], l = { product_id: it.base || k, quantity: q }; if (it.opcao) l.option = it.opcao; return l; }),
      payment_method: m.pag || null, change_for: m.pag === "Numerário" ? (m.troco.trim() || null) : null,
      discount: Math.round(desc * 100) / 100, channel: m.origem, notes: m.obs.trim() || null
    };
    let res;
    try { res = await api("/admin/orders", { method: "POST", auth: true, body: corpo }); }
    catch (err) { if (err.status === 401 || err.status === 403) return erroGestao(err); return mostrarErros([err.message]); }
    manual = null;
    try { await carregarInicio(true); } catch (err) { /* a lista atualiza-se na próxima vez */ }
    filtroPedidos = "tratar";
    abrir("adm-pedidos");
    brinde("Pedido n.º " + res.number + " registado (" + res.code + ")");
  }
});

/* Lista de pedidos: botão para registar. */
const vPedidosSemManual = VISTAS["adm-pedidos"];
VISTAS["adm-pedidos"] = function () {
  const v = vPedidosSemManual();
  v.corpo = `<p style="margin-bottom:1rem"><button type="button" class="btn btn-sec btn-bloco" data-a="man-novo">+ Registar pedido de WhatsApp ou telefone</button></p>` + v.corpo;
  return v;
};

/* Cartão do pedido: origem e desconto. */
const cartaoSemOrigem = cartaoOperacao;
cartaoOperacao = function (p) {
  let h = cartaoSemOrigem(p);
  if (p.channel && p.channel !== "site") h = h.replace(`<span class="etiqueta">${ESTADOS[p.status]}</span>`, `<span class="etiqueta">${ESTADOS[p.status]}</span><span class="etiqueta">${esc(ORIGENS[p.channel] || p.channel)}</span>`);
  if (+p.discount > 0) h = h.replace("<p><strong>Total ", `<p>Desconto de ${eur(+p.discount)}. <strong>Total `);
  if (p.notes) h = h.replace(/(<small style="color:var\(--tinta-2\)">Recebido em)/, `<p class="aviso">${esc(p.notes)}</p>$1`);
  return h;
};

/* Raio-X: a conversão conta só pedidos do site; os de fora aparecem à parte. */
const vRaioXSemFora = VISTAS["adm-raiox"];
VISTAS["adm-raiox"] = function () {
  const v = vRaioXSemFora(), fora = raioX && raioX.dados && raioX.dados.pedidos_fora;
  if (fora && fora.n) v.corpo = v.corpo.replace('<p class="rx-nota">Tempo médio', `<p class="rx-nota">Fora do site (WhatsApp, telefone…): ${fora.n} ${fora.n === 1 ? "pedido" : "pedidos"}, ${eur(+fora.total)}. Não contam na conversão.</p><p class="rx-nota">Tempo médio`);
  return v;
};
