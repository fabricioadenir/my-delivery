/* ---------- stock, compras e fornecedores: dados e vistas ---------- */
let estoque = { ingredientes: [], fornecedores: [], compras: [], aExpirar: [], perdasMes: 0 }, variacoes = [];
const MOTIVOS = ["Fora de validade", "Aparas e limpeza", "Sobra do turno", "Erro de produção", "Danificado", "Outro"];
const VOLTAR_STOCK = `<p style="margin-bottom:1rem"><button type="button" class="ligacao" data-a="adm-stock">Voltar ao stock</button></p>`;

/**
 * Formata uma quantidade com até três casas e vírgula.
 * @param {number} n Quantidade.
 * @returns {string} Texto formatado.
 */
function fmtQtd(n) { return String(Math.round(+n * 1000) / 1000).replace(".", ","); }

/**
 * Formata uma data AAAA-MM-DD como DD/MM.
 * @param {string} iso Data ISO.
 * @returns {string} Dia e mês.
 */
function fmtDia(iso) { return iso.slice(8, 10) + "/" + iso.slice(5, 7); }

/** Carrega stock, fornecedores, compras recentes e alertas. */
async function carregarStock() {
  const d = await api("/admin/stock", { auth: true });
  estoque = { ingredientes: d.ingredients, fornecedores: d.suppliers, compras: d.purchases, aExpirar: d.expiring, perdasMes: d.waste_month };
}

const vAdminSemStock = vAdmin;
vAdmin = function () {
  const v = vAdminSemStock(), alvo = `<button type="button" class="btn btn-sec btn-bloco" data-a="adm-loja">`;
  v.corpo = v.corpo.replace(alvo, `<button type="button" class="btn btn-sec btn-bloco" data-a="adm-stock">Stock e compras</button>` + alvo);
  return v;
};

/**
 * Avisos do stock: variações de preço, mínimos e validades.
 * @returns {string} HTML dos avisos.
 */
function avisosStock() {
  const baixo = estoque.ingredientes.filter(i => i.min_stock != null && +i.stock_qty < +i.min_stock);
  const precos = variacoes.filter(v => +v.previous > 0).map(v => `<p class="aviso">${esc(v.name)}: de ${fmtCusto(v.previous)} para ${fmtCusto(v.current)} por ${esc(v.unit)} (${v.current > v.previous ? "+" : ""}${((v.current - v.previous) / v.previous * 100).toFixed(2).replace(".", ",")} %)</p>`).join("");
  const minimos = baixo.length ? `<p class="aviso">Abaixo do mínimo: ${baixo.map(i => esc(i.name) + " (" + fmtQtd(i.stock_qty) + " " + esc(i.unit) + ")").join(", ")}</p>` : "";
  const validades = estoque.aExpirar.length ? `<p class="aviso">Validade a terminar: ${estoque.aExpirar.map(x => esc(x.ingredients.name) + (x.lot ? ", lote " + esc(x.lot) : "") + ", " + fmtDia(x.expires_on)).join("; ")}</p>` : "";
  return precos + minimos + validades;
}

/**
 * Vista principal do stock.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vAdmStock() {
  const valor = estoque.ingredientes.reduce((s, i) => s + Math.max(0, +i.stock_qty) * +i.unit_cost, 0);
  const linhas = estoque.ingredientes.map(i => `<div class="cartao"><div><strong>${esc(i.name)}</strong><small>Em stock: ${fmtQtd(i.stock_qty)} ${esc(i.unit)}, vale ${eur(Math.max(0, +i.stock_qty) * +i.unit_cost)}${i.min_stock != null ? ". Mínimo " + fmtQtd(i.min_stock) : ""}</small></div><div class="acoes"><button type="button" class="ligacao" data-a="stock-item" data-id="${esc(i.id)}">Acertar</button></div></div>`).join("");
  const compras = estoque.compras.map(c => `<div class="cartao"><div><strong>${fmtDia(c.purchased_on)}, ${eur(+c.total)}</strong><small>${esc(c.suppliers ? c.suppliers.name : "Sem fornecedor")}. ${(c.purchase_items || []).map(x => fmtQtd(x.quantity) + " " + esc(x.ingredients.unit) + " de " + esc(x.ingredients.name)).join(", ")}</small></div></div>`).join("");
  return { titulo: "Stock e compras",
    corpo: VOLTAR + avisosStock() + `<p style="margin:1rem 0">Valor em stock: <strong>${eur(valor)}</strong>. Perdas este mês: <strong>${eur(+estoque.perdasMes)}</strong>.</p>
      <div class="pilha" style="margin-bottom:1rem"><button type="button" class="btn btn-bloco" data-a="adm-compra">Registar compra</button><button type="button" class="btn btn-sec btn-bloco" data-a="adm-fornecedores">Fornecedores (${estoque.fornecedores.length})</button></div>
      <div class="grupo"><h3>Ingredientes e embalagens</h3>${linhas || `<p style="color:var(--tinta-2)">Registe primeiro os ingredientes em Custos e fichas técnicas.</p>`}</div>
      <div class="grupo"><h3>Compras recentes</h3>${compras || `<p style="color:var(--tinta-2)">Ainda não registou compras.</p>`}</div>` };
}

/**
 * Vista para acertar o stock de um ingrediente.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vAdmStockItem() {
  const i = S.editar;
  return { titulo: i.name,
    corpo: VOLTAR_STOCK + `<p class="aviso" style="margin:0 0 1rem">Em stock: ${fmtQtd(i.stock_qty)} ${esc(i.unit)}.</p><div id="erros"></div>
      <div class="grupo"><h3>Contagem</h3><label class="campo"><span>Quantidade que tem agora (${esc(i.unit)})</span><input type="text" name="contagem" inputmode="decimal"></label><p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="stock-contar">Guardar contagem</button></p></div>
      <div class="grupo"><h3>Perda ou desperdício</h3><div class="par"><label class="campo"><span>Quantidade perdida (${esc(i.unit)})</span><input type="text" name="perda" inputmode="decimal"></label>
        <label class="campo"><span>Motivo</span><select name="motivo">${MOTIVOS.map(m => `<option>${m}</option>`).join("")}</select></label></div><p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="stock-perda">Registar perda</button></p></div>
      <div class="grupo"><h3>Stock mínimo</h3><label class="campo"><span>Avisar abaixo de (${esc(i.unit)})</span><input type="text" name="minimo" inputmode="decimal" value="${i.min_stock != null ? fmtQtd(i.min_stock) : ""}"><small>Deixe vazio para não avisar.</small></label><p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="stock-minimo">Guardar mínimo</button></p></div>` };
}

/**
 * Formulário de registo de uma compra.
 * @returns {{titulo:string, corpo:string, pe:string}} Conteúdo da folha.
 */
function vAdmCompra() {
  const e = S.editar, op = (v, t, sel) => `<option value="${v}" ${v === sel ? "selected" : ""}>${esc(t)}</option>`;
  const linhas = e.itens.map((l, n) => `<div class="dia"><label class="campo"><span>Ingrediente</span><select name="ing${n}">${op("", "Escolher…", l.ing)}${estoque.ingredientes.map(i => op(i.id, i.name + " (" + i.unit + ")", l.ing)).join("")}</select></label>
    <div class="par" style="margin-top:.8rem"><label class="campo"><span>Quantidade</span><input type="text" name="q${n}" inputmode="decimal" value="${esc(l.q)}"></label><label class="campo"><span>Preço total (€)</span><input type="text" name="p${n}" inputmode="decimal" value="${esc(l.p)}"></label></div>
    <div class="par" style="margin-top:.8rem"><label class="campo"><span>Lote</span><input type="text" name="lote${n}" value="${esc(l.lote)}"></label><label class="campo"><span>Validade</span><input type="date" name="val${n}" value="${esc(l.val)}" style="${CAMPO}"></label></div>
    <p><button type="button" class="ligacao" data-a="compra-linha-apagar" data-i="${n}">Tirar esta linha</button></p></div>`).join("");
  return { titulo: "Registar compra",
    corpo: VOLTAR_STOCK + `<div class="grupo"><div class="par"><label class="campo" style="margin-top:0"><span>Fornecedor</span><select name="fornecedor">${op("", "Sem fornecedor", e.fornecedor)}${estoque.fornecedores.map(f => op(f.id, f.name, e.fornecedor)).join("")}</select></label>
      <label class="campo" style="margin-top:0"><span>Data</span><input type="date" name="data" value="${esc(e.data)}" style="${CAMPO}"></label></div></div>
      <div class="grupo"><h3>O que comprou</h3>${linhas}<p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="compra-linha-nova">Adicionar linha</button></p></div><div id="erros"></div>`,
    pe: `<button type="button" class="btn btn-bloco" data-a="adm-compra-guardar">Guardar compra</button>` };
}

/**
 * Lista de fornecedores.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vAdmFornecedores() {
  const linhas = estoque.fornecedores.map(f => `<div class="cartao"><div><strong>${esc(f.name)}</strong><small>${[f.phone, f.nif ? "NIF " + f.nif : "", f.notes].filter(Boolean).map(esc).join(", ")}</small></div><div class="acoes"><button type="button" class="ligacao" data-a="adm-forn" data-id="${esc(f.id)}">Editar</button></div></div>`).join("");
  return { titulo: "Fornecedores", corpo: VOLTAR_STOCK + `<div class="grupo">${linhas || `<p style="color:var(--tinta-2)">Ainda não tem fornecedores.</p>`}<p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="adm-forn-novo">Novo fornecedor</button></p></div>` };
}

/**
 * Formulário de um fornecedor.
 * @returns {{titulo:string, corpo:string, pe:string}} Conteúdo da folha.
 */
function vAdmFornecedor() {
  const f = S.editar;
  return { titulo: f.id ? "Editar fornecedor" : "Novo fornecedor",
    corpo: VOLTAR_STOCK + `<div class="grupo"><label class="campo" style="margin-top:0"><span>Nome</span><input type="text" name="nome" value="${esc(f.name)}"></label>
      <div class="par"><label class="campo"><span>Telefone</span><input type="tel" name="tel" value="${esc(f.phone || "")}"></label><label class="campo"><span>NIF</span><input type="text" name="nif" inputmode="numeric" value="${esc(f.nif || "")}"></label></div>
      <label class="campo"><span>Notas</span><input type="text" name="notas" value="${esc(f.notes || "")}" placeholder="Dias de entrega, condições de pagamento…"></label></div><div id="erros"></div>
      ${f.id ? `<p><button type="button" class="ligacao" data-a="adm-forn-apagar">Apagar este fornecedor</button></p>` : ""}`,
    pe: `<button type="button" class="btn btn-bloco" data-a="adm-forn-guardar">Guardar fornecedor</button>` };
}

Object.assign(VISTAS, { admin: vAdmin, "adm-stock": vAdmStock, "adm-stock-item": vAdmStockItem, "adm-compra": vAdmCompra, "adm-fornecedores": vAdmFornecedores, "adm-fornecedor": vAdmFornecedor });
