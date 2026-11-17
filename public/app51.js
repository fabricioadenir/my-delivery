/* ---------- tipos de artigo: ingrediente, embalagem, utensílio e equipamento ---------- */
const TIPOS_ART = { ingredient: "Ingrediente", packaging: "Embalagem", utensil: "Utensílio", equipment: "Equipamento" };
const TIPOS_ART_PLURAL = { ingredient: "Ingredientes", packaging: "Embalagens", utensil: "Utensílios", equipment: "Equipamentos" };

/**
 * Opções do seletor de tipo.
 * @param {string} sel Tipo escolhido.
 * @returns {string} HTML das opções.
 */
function opcoesTipo(sel) { return Object.keys(TIPOS_ART).map(k => `<option value="${k}" ${k === (sel || "ingredient") ? "selected" : ""}>${TIPOS_ART[k]}</option>`).join(""); }

/**
 * Tipo válido (o que não se reconhece passa a ingrediente).
 * @param {string} k Tipo.
 * @returns {string} Tipo.
 */
function tipoValido(k) { return TIPOS_ART[k] ? k : "ingredient"; }

/**
 * Mexe no cartão de um ingrediente dentro de um HTML de lista (identificado pelo data-id do botão).
 * @param {string} html HTML da lista.
 * @param {string} id Id do ingrediente.
 * @param {Function} f Recebe o HTML do cartão e devolve o novo.
 * @returns {string} HTML alterado.
 */
function noCartao(html, id, f) {
  return html.split(`<div class="cartao">`).map(c => c.includes(`data-id="${esc(id)}"`) ? f(c) : c).join(`<div class="cartao">`);
}

const vIngredienteSemTipos = VISTAS["adm-ingrediente"];
/** Formulário do ingrediente com os quatro tipos. */
function vIngredienteComTipos() {
  const v = vIngredienteSemTipos();
  v.corpo = v.corpo.replace(/<select name="tipo">[\s\S]*?<\/select>/, `<select name="tipo">${opcoesTipo(S.editar.kind)}</select><small>Utensílios (papel toalha, luvas, película) e equipamentos (bandejas, facas, tábuas) ficam no stock, mas não são ingredientes de receitas.</small>`);
  return v;
}

const vIngredientesSemTipos = VISTAS["adm-ingredientes"];
/** Lista da calculadora: etiqueta de utensílio/equipamento e sem "Rende pronto" para estes. */
function vIngredientesComTipos() {
  const v = vIngredientesSemTipos();
  custos.ingredientes.filter(i => i.kind === "utensil" || i.kind === "equipment").forEach(i => {
    v.corpo = noCartao(v.corpo, i.id, c => c.replace("</strong>", `</strong><span class="etiqueta">${TIPOS_ART[i.kind]}</span>`).replace(/<button type="button" class="ligacao" data-a="adm-prep-de"[^>]*>[^<]*<\/button>/, ""));
  });
  v.corpo = v.corpo.replace(/Ingredientes e embalagens/g, "Ingredientes, embalagens e utensílios");
  return v;
}

/**
 * Stock com os artigos separados por tipo.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vAdmStock() {
  const valor = estoque.ingredientes.reduce((s, i) => s + Math.max(0, +i.stock_qty) * +i.unit_cost, 0);
  const cartao = i => `<div class="cartao"><div><strong>${esc(i.name)}</strong><small>Em stock: ${fmtQtd(i.stock_qty)} ${esc(i.unit)}, vale ${eur(Math.max(0, +i.stock_qty) * +i.unit_cost)}${i.min_stock != null ? ". Mínimo " + fmtQtd(i.min_stock) : ""}</small></div><div class="acoes"><button type="button" class="ligacao" data-a="stock-item" data-id="${esc(i.id)}">Acertar</button></div></div>`;
  const grupos = Object.keys(TIPOS_ART).map(k => {
    const itens = estoque.ingredientes.filter(i => tipoValido(i.kind) === k);
    return itens.length ? `<div class="grupo"><h3>${TIPOS_ART_PLURAL[k]}</h3>${itens.map(cartao).join("")}</div>` : "";
  }).join("");
  const compras = estoque.compras.map(c => `<div class="cartao"><div><strong>${fmtDia(c.purchased_on)}, ${eur(+c.total)}</strong><small>${esc(c.suppliers ? c.suppliers.name : "Sem fornecedor")}. ${(c.purchase_items || []).map(x => fmtQtd(x.quantity) + " " + esc(x.ingredients.unit) + " de " + esc(x.ingredients.name)).join(", ")}</small></div></div>`).join("");
  return { titulo: "Stock e compras",
    corpo: VOLTAR + avisosStock() + `<p style="margin:1rem 0">Valor em stock: <strong>${eur(valor)}</strong>. Perdas este mês: <strong>${eur(+estoque.perdasMes)}</strong>.</p>
      <div class="pilha" style="margin-bottom:1rem"><button type="button" class="btn btn-bloco" data-a="adm-compra">Registar compra</button><button type="button" class="btn btn-sec btn-bloco" data-a="adm-fornecedores">Fornecedores (${estoque.fornecedores.length})</button></div>
      ${grupos || `<div class="grupo"><p style="color:var(--tinta-2)">Registe primeiro os ingredientes na calculadora de preço ou numa compra.</p></div>`}
      <div class="grupo"><h3>Compras recentes</h3>${compras || `<p style="color:var(--tinta-2)">Ainda não registou compras.</p>`}</div>` };
}

Object.assign(VISTAS, { "adm-ingrediente": vIngredienteComTipos, "adm-ingredientes": vIngredientesComTipos, "adm-stock": vAdmStock });
