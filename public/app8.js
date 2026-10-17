/* ---------- custos e fichas técnicas: dados e vistas ---------- */
let custos = { ingredientes: [], preparacoes: [], fichas: [], rende: {}, produto: {}, prep: {} };
const UNIDADES = { g: "gramas (g)", ml: "mililitros (ml)", un: "unidades (un)" };
const VOLTAR_CUSTOS = `<p style="margin-bottom:1rem"><button type="button" class="ligacao" data-a="adm-custos">Voltar aos custos</button></p>`;

/**
 * Formata um custo: quatro casas abaixo de 1 €, duas acima.
 * @param {number} n Valor em euros.
 * @returns {string} Texto formatado.
 */
function fmtCusto(n) { return +n < 1 ? (+n).toFixed(4).replace(".", ",") + " €" : eur(+n); }

/** Carrega ingredientes, preparações, fichas e custos calculados pelo backend. */
async function carregarCustos() {
  const d = await api("/admin/costing", { auth: true });
  custos = { ingredientes: d.ingredients, preparacoes: d.preparations, fichas: d.recipe_items, rende: {}, produto: {}, prep: {} };
  d.recipe_yields.forEach(y => { custos.rende[y.id] = y.recipe_yield; });
  d.product_costs.forEach(c => { custos.produto[c.product_id] = c.unit_cost; });
  d.preparation_costs.forEach(c => { custos.prep[c.preparation_id] = c.unit_cost; });
}

const vAdminBase = vAdmin;
vAdmin = function () {
  const v = vAdminBase(), alvo = `<button type="button" class="btn btn-sec btn-bloco" data-a="adm-loja">`;
  v.corpo = v.corpo.replace(alvo, `<button type="button" class="btn btn-sec btn-bloco" data-a="adm-custos">Custos e fichas técnicas</button>` + alvo);
  return v;
};

const cartaoPedidoBase = cartaoPedido;
cartaoPedido = function (p) {
  const alvo = `<label class="campo"><span>Estado</span>`;
  const linha = p.cost_total == null ? `<p style="color:var(--tinta-2)">Custo por calcular: há produtos sem ficha técnica.</p>`
    : `<p>Custo de produção: ${eur(+p.cost_total)}. Sobram ${eur(p.subtotal - p.cost_total)} antes da entrega e dos custos fixos.</p>`;
  return cartaoPedidoBase(p).replace(alvo, linha + alvo);
};

/**
 * Linha de um produto com preço, custo e margem.
 * @param {object} p Produto.
 * @returns {string} HTML da linha.
 */
function linhaRentabilidade(p) {
  const c = custos.produto[p.id];
  const info = c == null ? "Sem ficha técnica" : `Custo ${fmtCusto(c)}, margem ${fmtCusto(p.preco - c)} (${p.preco ? Math.round((p.preco - c) / p.preco * 100) : 0} %)`;
  return `<div class="cartao"><div><strong>${esc(p.nome)}</strong><small>Preço ${eur(p.preco)}. ${info}</small></div><div class="acoes"><button type="button" class="ligacao" data-a="adm-ficha" data-id="${esc(p.id)}">Ficha técnica</button></div></div>`;
}

/**
 * Vista de rentabilidade por produto.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vAdmCustos() {
  const grupos = D.categorias.map(c => { const ps = D.produtos.filter(p => p.cat === c.id); return ps.length ? `<div class="grupo"><h3>${esc(c.nome)}</h3>${ps.map(linhaRentabilidade).join("")}</div>` : ""; }).join("");
  return { titulo: "Custos e fichas técnicas",
    corpo: VOLTAR + `<div class="pilha" style="margin-bottom:1rem"><button type="button" class="btn btn-bloco" data-a="adm-ingredientes">Ingredientes e embalagens (${custos.ingredientes.length})</button>
      <button type="button" class="btn btn-sec btn-bloco" data-a="adm-preparacoes">Preparações (${custos.preparacoes.length})</button></div>${grupos}` };
}

/**
 * Lista de ingredientes e embalagens.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vAdmIngredientes() {
  const linhas = custos.ingredientes.map(i => `<div class="cartao"><div><strong>${esc(i.name)}</strong>${i.kind === "packaging" ? `<span class="etiqueta">Embalagem</span>` : ""}<small>${fmtCusto(i.unit_cost)} por ${esc(i.unit)}</small></div><div class="acoes"><button type="button" class="ligacao" data-a="adm-ing" data-id="${esc(i.id)}">Editar</button></div></div>`).join("");
  return { titulo: "Ingredientes e embalagens",
    corpo: VOLTAR_CUSTOS + `<div class="grupo">${linhas || `<p style="color:var(--tinta-2)">Comece por registar o que compra: salmão, arroz, nori, caixas, sacos.</p>`}<p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="adm-ing-novo">Novo ingrediente</button></p></div>` };
}

/**
 * Formulário de um ingrediente.
 * @returns {{titulo:string, corpo:string, pe:string}} Conteúdo da folha.
 */
function vAdmIngrediente() {
  const i = S.editar, sel = (v, a) => v === a ? "selected" : "";
  return { titulo: i.id ? "Editar ingrediente" : "Novo ingrediente",
    corpo: VOLTAR_CUSTOS + `<div class="grupo"><label class="campo" style="margin-top:0"><span>Nome</span><input type="text" name="nome" value="${esc(i.name)}"></label>
      <div class="par"><label class="campo"><span>Tipo</span><select name="tipo"><option value="ingredient" ${sel(i.kind, "ingredient")}>Ingrediente</option><option value="packaging" ${sel(i.kind, "packaging")}>Embalagem</option></select></label>
      <label class="campo"><span>Mede-se em</span><select name="unidade">${Object.keys(UNIDADES).map(u => `<option value="${u}" ${sel(i.unit, u)}>${UNIDADES[u]}</option>`).join("")}</select></label></div>
      <div class="par"><label class="campo"><span>Preço de compra (€)</span><input type="text" name="preco" inputmode="decimal" value="${esc(String(i.purchase_price).replace(".", ","))}"></label>
      <label class="campo"><span>Quantidade comprada</span><input type="text" name="qtd" inputmode="decimal" value="${esc(String(i.purchase_qty).replace(".", ","))}"></label></div>
      <small style="color:var(--tinta-2)">Exemplo: 1 kg de salmão por 13 € é preço 13 e quantidade 1000, medido em gramas.</small></div><div id="erros"></div>
      ${i.id ? `<p><button type="button" class="ligacao" data-a="adm-ing-apagar">Apagar este ingrediente</button></p>` : ""}`,
    pe: `<button type="button" class="btn btn-bloco" data-a="adm-ing-guardar">Guardar ingrediente</button>` };
}

/**
 * Lista de preparações com o custo por unidade.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vAdmPreparacoes() {
  const linhas = custos.preparacoes.map(p => `<div class="cartao"><div><strong>${esc(p.name)}</strong><small>Rende ${String(p.yield_qty).replace(".", ",")} ${esc(p.unit)}. Custo ${fmtCusto(custos.prep[p.id] || 0)} por ${esc(p.unit)}</small></div><div class="acoes"><button type="button" class="ligacao" data-a="adm-prep" data-id="${esc(p.id)}">Editar</button></div></div>`).join("");
  return { titulo: "Preparações",
    corpo: VOLTAR_CUSTOS + `<div class="grupo">${linhas || `<p style="color:var(--tinta-2)">Uma preparação é o que faz em lote antes de montar as peças: arroz temperado, salmão limpo, molhos.</p>`}<p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="adm-prep-nova">Nova preparação</button></p></div>` };
}

/**
 * Opções do seletor de componente de uma linha.
 * @param {string} sel Referência escolhida.
 * @param {boolean} soIngredientes Limita a ingredientes (preparações).
 * @returns {string} HTML das opções.
 */
function opcoesRef(sel, soIngredientes) {
  const op = (v, t) => `<option value="${v}" ${v === sel ? "selected" : ""}>${esc(t)}</option>`;
  const ing = `<option value="">Escolher…</option><optgroup label="Ingredientes e embalagens">${custos.ingredientes.map(i => op("i:" + i.id, i.name + " (" + i.unit + ")")).join("")}</optgroup>`;
  if (soIngredientes) return ing;
  return ing + `<optgroup label="Preparações">${custos.preparacoes.map(p => op("p:" + p.id, p.name + " (" + p.unit + ")")).join("")}</optgroup>
    <optgroup label="Produtos, para montar combinados">${D.produtos.filter(p => p.id !== S.editar.id).map(p => op("c:" + p.id, p.nome + " (un)")).join("")}</optgroup>`;
}

/**
 * Linhas editáveis de uma preparação ou ficha.
 * @param {boolean} soIngredientes Limita os componentes a ingredientes.
 * @returns {string} HTML das linhas e do botão de adicionar.
 */
function linhasEditor(soIngredientes) {
  return S.editar.itens.map((l, n) => `<div class="par" style="align-items:end"><label class="campo"><span>Componente</span><select name="ref${n}">${opcoesRef(l.ref, soIngredientes)}</select></label>
    <label class="campo"><span>Quantidade</span><input type="text" name="q${n}" inputmode="decimal" value="${esc(l.q)}"></label></div>
    <p><button type="button" class="ligacao" data-a="linha-apagar" data-i="${n}">Tirar esta linha</button></p>`).join("") + `<p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="linha-nova">Adicionar linha</button></p>`;
}

/**
 * Formulário de uma preparação.
 * @returns {{titulo:string, corpo:string, pe:string}} Conteúdo da folha.
 */
function vAdmPreparacao() {
  const e = S.editar;
  return { titulo: e.id ? "Editar preparação" : "Nova preparação",
    corpo: VOLTAR_CUSTOS + `<div class="grupo"><label class="campo" style="margin-top:0"><span>Nome</span><input type="text" name="nome" value="${esc(e.nome)}" placeholder="Arroz temperado, salmão limpo…"></label>
      <div class="par"><label class="campo"><span>Mede-se em</span><select name="unidade">${Object.keys(UNIDADES).map(u => `<option value="${u}" ${e.unidade === u ? "selected" : ""}>${UNIDADES[u]}</option>`).join("")}</select></label>
      <label class="campo"><span>Rendimento do lote</span><input type="text" name="rend" inputmode="decimal" value="${esc(e.rend)}"></label></div>
      <small style="color:var(--tinta-2)">O rendimento é quanto fica pronto a usar. Exemplo: 1000 g de salmão inteiro rendem 600 g de salmão limpo.</small></div>
      <div class="grupo"><h3>O que entra no lote</h3>${linhasEditor(true)}</div><div id="erros"></div>
      ${e.id ? `<p><button type="button" class="ligacao" data-a="adm-prep-apagar">Apagar esta preparação</button></p>` : ""}`,
    pe: `<button type="button" class="btn btn-bloco" data-a="adm-prep-guardar">Guardar preparação</button>` };
}

/**
 * Formulário da ficha técnica de um produto.
 * @returns {{titulo:string, corpo:string, pe:string}} Conteúdo da folha.
 */
function vAdmFicha() {
  const e = S.editar, c = custos.produto[e.id];
  return { titulo: "Ficha técnica",
    corpo: VOLTAR_CUSTOS + `<p class="aviso" style="margin:0 0 1rem"><strong>${esc(e.nome)}</strong>: ${c == null ? "ainda sem custo calculado." : "custa " + fmtCusto(c) + " por unidade."}</p>
      <div class="grupo"><label class="campo" style="margin-top:0"><span>Quantas unidades rende esta ficha</span><input type="text" name="rend" inputmode="decimal" value="${esc(e.rend)}"><small>Um rolo cortado em 8 peças rende 8. Um combinado rende 1.</small></label></div>
      <div class="grupo"><h3>Componentes</h3>${linhasEditor(false)}</div><div id="erros"></div>`,
    pe: `<button type="button" class="btn btn-bloco" data-a="adm-ficha-guardar">Guardar ficha técnica</button>` };
}

const VISTAS = { carrinho: vCarrinho, finalizar: vFinalizar, enviado: vEnviado, conta: vConta, morada: vMorada, admin: vAdmin, "adm-produto": vAdmProd, "adm-categoria": vAdmCat, "adm-loja": vAdmLoja, "adm-login": vAdmLogin, "adm-pedidos": vAdmPedidos, "adm-custos": vAdmCustos, "adm-ingredientes": vAdmIngredientes, "adm-ingrediente": vAdmIngrediente, "adm-preparacoes": vAdmPreparacoes, "adm-preparacao": vAdmPreparacao, "adm-ficha": vAdmFicha };

/** Desenha a folha a partir do registo de vistas. */
function renderFolha() {
  const v = VISTAS[S.vista]();
  $("#folha-titulo").textContent = v.titulo;
  $("#folha-corpo").innerHTML = v.corpo;
  $("#folha-pe").innerHTML = v.pe || "";
  $("#folha-pe").hidden = !v.pe;
  if (S.vista === "finalizar") sincronizar();
}
