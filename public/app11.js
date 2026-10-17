/* ---------- stock, compras e fornecedores: ações ---------- */

/**
 * Executa uma alteração de stock, recarrega os dados e abre a vista indicada.
 * @param {Function} trabalho Função assíncrona que chama o backend.
 * @param {string} mensagem Aviso mostrado quando corre bem.
 * @param {string} vista Vista a abrir no fim.
 */
async function stockAcao(trabalho, mensagem, vista) {
  try { await trabalho(); await carregarStock(); brinde(mensagem); abrir(vista); }
  catch (e) { erroGestao(e); }
}

/**
 * Envia uma ação de stock do ingrediente aberto.
 * @param {string} action Tipo: count, waste ou minimum.
 * @param {number|null} quantity Quantidade.
 * @param {string|null} reason Motivo.
 * @param {string} mensagem Aviso de sucesso.
 */
function acaoIngrediente(action, quantity, reason, mensagem) {
  stockAcao(() => api("/admin/stock/" + S.editar.id, { method: "POST", auth: true, body: { action, quantity, reason } }), mensagem, "adm-stock");
}

/** Guarda no rascunho o que está escrito no formulário de compra. */
function lerCompra() {
  const e = S.editar;
  e.fornecedor = campo("fornecedor").value; e.data = campo("data").value;
  e.itens = e.itens.map((l, n) => ({ ing: campo("ing" + n).value, q: campo("q" + n).value, p: campo("p" + n).value, lote: campo("lote" + n).value, val: campo("val" + n).value }));
}

/**
 * Valida a compra.
 * @returns {{erros:string[], body:object}} Erros e corpo para o backend.
 */
function corpoCompra() {
  lerCompra();
  const e = S.editar, erros = [];
  const items = e.itens.filter(l => l.ing || l.q || l.p).map(l => ({ ingredient_id: l.ing, quantity: num(l.q), total_price: num(l.p), lot: l.lote.trim() || null, expires_on: l.val || null }));
  if (!items.length) erros.push("Adicione pelo menos uma linha.");
  if (items.some(l => !l.ingredient_id || !(l.quantity > 0) || !(l.total_price >= 0))) erros.push("Cada linha precisa de ingrediente, quantidade e preço total.");
  return { erros, body: { supplier_id: e.fornecedor || null, purchased_on: e.data || null, items } };
}

Object.assign(ACOES, {
  async "adm-stock"() { try { await carregarStock(); abrir("adm-stock"); } catch (e) { erroGestao(e); } },
  "stock-item"(b) { S.editar = copia(estoque.ingredientes.find(i => i.id === b.dataset.id)); abrir("adm-stock-item"); },
  "stock-contar"() {
    const q = num(campo("contagem").value);
    if (!(q >= 0)) return mostrarErros(["Escreva a quantidade contada."]);
    acaoIngrediente("count", q, null, "Contagem guardada");
  },
  "stock-perda"() {
    const q = num(campo("perda").value);
    if (!(q > 0)) return mostrarErros(["Escreva a quantidade perdida."]);
    acaoIngrediente("waste", q, campo("motivo").value, "Perda registada");
  },
  "stock-minimo"() {
    const t = campo("minimo").value.trim(), q = t === "" ? null : num(t);
    if (q !== null && !(q >= 0)) return mostrarErros(["Escreva o stock mínimo ou deixe vazio."]);
    acaoIngrediente("minimum", q, null, "Stock mínimo guardado");
  },
  "adm-compra"() {
    const n = agora();
    S.editar = { fornecedor: "", data: n.y + "-" + doisD(n.m) + "-" + doisD(n.d), itens: [{ ing: "", q: "", p: "", lote: "", val: "" }] };
    abrir("adm-compra");
  },
  "compra-linha-nova"() { lerCompra(); S.editar.itens.push({ ing: "", q: "", p: "", lote: "", val: "" }); renderFolha(); },
  "compra-linha-apagar"(b) { lerCompra(); S.editar.itens.splice(+b.dataset.i, 1); renderFolha(); },
  "adm-compra-guardar"() {
    const f = corpoCompra();
    if (f.erros.length) return mostrarErros(f.erros);
    stockAcao(async () => { variacoes = (await api("/admin/purchases", { method: "POST", auth: true, body: f.body })).changes || []; }, "Compra registada", "adm-stock");
  },
  "adm-fornecedores"() { abrir("adm-fornecedores"); },
  "adm-forn-novo"() { S.editar = { id: "", name: "", phone: "", nif: "", notes: "" }; abrir("adm-fornecedor"); },
  "adm-forn"(b) { S.editar = copia(estoque.fornecedores.find(f => f.id === b.dataset.id)); abrir("adm-fornecedor"); },
  "adm-forn-guardar"() {
    const id = S.editar.id, body = { name: campo("nome").value.trim(), phone: campo("tel").value.trim() || null, nif: campo("nif").value.trim() || null, notes: campo("notas").value.trim() || null };
    if (!body.name) return mostrarErros(["Escreva o nome do fornecedor."]);
    stockAcao(() => api("/admin/suppliers" + (id ? "/" + id : ""), { method: id ? "PUT" : "POST", auth: true, body }), "Fornecedor guardado", "adm-fornecedores");
  },
  "adm-forn-apagar"(b) {
    if (!doisPassos(b, "Confirmar: apagar este fornecedor")) return;
    stockAcao(() => api("/admin/suppliers/" + S.editar.id, { method: "DELETE", auth: true }), "Fornecedor apagado", "adm-fornecedores");
  }
});
