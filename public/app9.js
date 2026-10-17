/* ---------- custos e fichas técnicas: ações ---------- */

/**
 * Trata um erro da gestão: sessão expirada volta ao login, o resto é mostrado.
 * @param {Error} e Erro devolvido pelo backend.
 */
function erroGestao(e) {
  if (e.status === 401 || e.status === 403) { LS.del("token"); abrir("adm-login"); brinde("Sessão terminada. Entre de novo."); }
  else if ($("#erros")) mostrarErros([e.message]);
  else brinde(e.message);
}

/**
 * Executa uma alteração de custos, recarrega os dados e abre a vista indicada.
 * @param {Function} trabalho Função assíncrona que chama o backend.
 * @param {string} mensagem Aviso mostrado quando corre bem.
 * @param {string} vista Vista a abrir no fim.
 */
async function custosAcao(trabalho, mensagem, vista) {
  try { await trabalho(); await carregarCustos(); brinde(mensagem); abrir(vista); }
  catch (e) { erroGestao(e); }
}

/** Guarda no rascunho o que está escrito no editor de linhas. */
function lerEditor() {
  const e = S.editar;
  ["nome", "unidade", "rend"].forEach(k => { const el = campo(k); if (el) e[k] = el.value; });
  e.itens = e.itens.map((l, n) => ({ ref: campo("ref" + n).value, q: campo("q" + n).value }));
}

/**
 * Valida o editor de linhas.
 * @returns {{erros:string[], rend:number, items:object[]}} Erros, rendimento e linhas para o backend.
 */
function corpoEditor() {
  lerEditor();
  const e = S.editar, erros = [], rend = num(e.rend);
  if (!(rend > 0)) erros.push("Escreva o rendimento, maior que zero.");
  const items = e.itens.filter(l => l.ref || l.q).map(l => ({ ref: l.ref, quantity: num(l.q) }));
  if (items.some(l => !l.ref || !(l.quantity > 0))) erros.push("Cada linha precisa de um componente e de uma quantidade maior que zero.");
  return { erros, rend, items };
}

/**
 * Converte um número do backend em texto com vírgula.
 * @param {number} n Valor.
 * @returns {string} Texto para um campo.
 */
function txtNum(n) { return String(n).replace(".", ","); }

Object.assign(ACOES, {
  async "adm-custos"() { try { await carregarCustos(); abrir("adm-custos"); } catch (e) { erroGestao(e); } },
  "adm-ingredientes"() { abrir("adm-ingredientes"); },
  "adm-preparacoes"() { abrir("adm-preparacoes"); },
  "adm-ing-novo"() { S.editar = { id: "", name: "", kind: "ingredient", unit: "g", purchase_price: "", purchase_qty: "" }; abrir("adm-ingrediente"); },
  "adm-ing"(b) { S.editar = copia(custos.ingredientes.find(i => i.id === b.dataset.id)); abrir("adm-ingrediente"); },
  "adm-ing-guardar"() {
    const id = S.editar.id, body = { name: campo("nome").value.trim(), kind: campo("tipo").value, unit: campo("unidade").value, purchase_price: num(campo("preco").value), purchase_qty: num(campo("qtd").value) }, e = [];
    if (!body.name) e.push("Escreva o nome.");
    if (!(body.purchase_price >= 0)) e.push("Escreva o preço de compra.");
    if (!(body.purchase_qty > 0)) e.push("Escreva a quantidade comprada, maior que zero.");
    if (e.length) return mostrarErros(e);
    custosAcao(() => api("/admin/ingredients" + (id ? "/" + id : ""), { method: id ? "PUT" : "POST", auth: true, body }), "Ingrediente guardado", "adm-ingredientes");
  },
  "adm-ing-apagar"(b) {
    if (!doisPassos(b, "Confirmar: apagar este ingrediente")) return;
    custosAcao(() => api("/admin/ingredients/" + S.editar.id, { method: "DELETE", auth: true }), "Ingrediente apagado", "adm-ingredientes");
  },
  "adm-prep-nova"() { S.editar = { id: "", nome: "", unidade: "g", rend: "", itens: [{ ref: "", q: "" }] }; abrir("adm-preparacao"); },
  "adm-prep"(b) {
    const p = custos.preparacoes.find(x => x.id === b.dataset.id);
    S.editar = { id: p.id, nome: p.name, unidade: p.unit, rend: txtNum(p.yield_qty), itens: (p.preparation_items || []).map(x => ({ ref: "i:" + x.ingredient_id, q: txtNum(x.quantity) })) };
    abrir("adm-preparacao");
  },
  "adm-prep-guardar"() {
    const f = corpoEditor(), id = S.editar.id, nome = S.editar.nome.trim();
    if (!nome) f.erros.unshift("Escreva o nome da preparação.");
    if (f.erros.length) return mostrarErros(f.erros);
    const body = { name: nome, unit: S.editar.unidade, yield_qty: f.rend, items: f.items };
    custosAcao(() => api("/admin/preparations" + (id ? "/" + id : ""), { method: id ? "PUT" : "POST", auth: true, body }), "Preparação guardada", "adm-preparacoes");
  },
  "adm-prep-apagar"(b) {
    if (!doisPassos(b, "Confirmar: apagar esta preparação")) return;
    custosAcao(() => api("/admin/preparations/" + S.editar.id, { method: "DELETE", auth: true }), "Preparação apagada", "adm-preparacoes");
  },
  "adm-ficha"(b) {
    const id = b.dataset.id, p = D.produtos.find(x => x.id === id);
    const itens = custos.fichas.filter(f => f.product_id === id).map(f => ({ ref: f.ingredient_id ? "i:" + f.ingredient_id : f.preparation_id ? "p:" + f.preparation_id : "c:" + f.component_id, q: txtNum(f.quantity) }));
    S.editar = { id, nome: p.nome, rend: txtNum(custos.rende[id] || 1), itens: itens.length ? itens : [{ ref: "", q: "" }] };
    abrir("adm-ficha");
  },
  "adm-ficha-guardar"() {
    const f = corpoEditor();
    if (f.erros.length) return mostrarErros(f.erros);
    custosAcao(() => api("/admin/products/" + S.editar.id + "/recipe", { method: "PUT", auth: true, body: { recipe_yield: f.rend, items: f.items } }), "Ficha técnica guardada", "adm-custos");
  },
  "linha-nova"() { lerEditor(); S.editar.itens.push({ ref: "", q: "" }); renderFolha(); },
  "linha-apagar"(b) { lerEditor(); S.editar.itens.splice(+b.dataset.i, 1); renderFolha(); }
});
