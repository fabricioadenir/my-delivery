/* ---------- registar compra: criar um ingrediente novo sem sair da compra ---------- */
const NOVO_ING = "__novo";

/**
 * Nome sem acentos, maiúsculas nem espaços a mais, para comparar ingredientes.
 * @param {string} t Nome.
 * @returns {string} Nome normalizado.
 */
function nomeIgual(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }

/**
 * Formulário de compra: cada linha pode escolher um ingrediente da lista ou criar um novo.
 * @returns {{titulo:string, corpo:string, pe:string}} Conteúdo da folha.
 */
function vAdmCompra() {
  const e = S.editar, op = (v, t, sel) => `<option value="${v}" ${v === sel ? "selected" : ""}>${esc(t)}</option>`;
  const linhas = e.itens.map((l, n) => {
    const novo = l.ing === NOVO_ING;
    return `<div class="dia"><label class="campo"><span>O que comprou</span><select name="ing${n}">${op("", "Escolher…", l.ing)}${estoque.ingredientes.map(i => op(i.id, i.name, l.ing)).join("")}${op(NOVO_ING, "+ Novo ingrediente (não está na lista)", l.ing)}</select></label>
    ${novo ? `<div class="par" style="margin-top:.8rem"><label class="campo"><span>Nome do ingrediente novo</span><input type="text" name="novoNome${n}" value="${esc(l.novoNome || "")}" placeholder="Wasabi em pó, caixas…"></label>
      <label class="campo"><span>Tipo</span><select name="novoTipo${n}">${opcoesTipo(l.novoTipo)}</select></label></div>
      <small style="display:block;margin-top:.4rem;color:var(--tinta-2)">Fica na lista de ingredientes (calculadora e stock) com a medida escolhida abaixo, e esta compra dá-lhe entrada no stock.</small>` : ""}
    <label class="campo"><span>Quanto pagou por isto (€)</span><input type="text" name="p${n}" inputmode="decimal" value="${esc(l.p)}"></label>
    <div class="par" style="margin-top:.8rem"><label class="campo"><span>Quantas embalagens</span><input type="text" name="emb${n}" inputmode="decimal" value="${esc(l.emb)}"></label><label class="campo"><span>Cada uma traz</span><input type="text" name="cada${n}" inputmode="decimal" value="${esc(l.cada)}"></label></div>
    <label class="campo"><span>Medida</span><select name="medida${n}">${opcoesMedida(l.medida, null)}</select></label>
    <div class="par" style="margin-top:.8rem"><label class="campo"><span>Lote</span><input type="text" name="lote${n}" value="${esc(l.lote)}"></label><label class="campo"><span>Validade</span><input type="date" name="val${n}" value="${esc(l.val)}" style="${CAMPO}"></label></div>
    <p><button type="button" class="ligacao" data-a="compra-linha-apagar" data-i="${n}">Tirar esta linha</button></p></div>`;
  }).join("");
  return { titulo: "Registar compra",
    corpo: VOLTAR_STOCK + `<div class="grupo"><div class="par"><label class="campo" style="margin-top:0"><span>Fornecedor</span><select name="fornecedor">${op("", "Sem fornecedor", e.fornecedor)}${estoque.fornecedores.map(f => op(f.id, f.name, e.fornecedor)).join("")}</select></label>
      <label class="campo" style="margin-top:0"><span>Data</span><input type="date" name="data" value="${esc(e.data)}" style="${CAMPO}"></label></div></div>
      <div class="grupo"><h3>O que comprou</h3>${linhas}<p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="compra-linha-nova">Adicionar linha</button></p></div><div id="erros"></div>`,
    pe: `<button type="button" class="btn btn-bloco" data-a="adm-compra-guardar">Guardar compra</button>` };
}

/** Guarda no rascunho o que está escrito no formulário de compra (incluindo os ingredientes novos). */
function lerCompra() {
  const e = S.editar, val = n => (campo(n) || {}).value;
  e.fornecedor = campo("fornecedor").value; e.data = campo("data").value;
  e.itens = e.itens.map((l, n) => ({ ing: val("ing" + n), p: val("p" + n), emb: val("emb" + n), cada: val("cada" + n), medida: val("medida" + n), lote: val("lote" + n), val: val("val" + n),
    novoNome: campo("novoNome" + n) ? val("novoNome" + n) : l.novoNome, novoTipo: campo("novoTipo" + n) ? val("novoTipo" + n) : l.novoTipo }));
}

/**
 * Valida a compra e converte embalagens e medidas na unidade de cada ingrediente.
 * Linhas com ingrediente novo levam o índice em `novo` e são criadas antes de gravar a compra.
 * @returns {{erros:string[], body:object, novos:object[]}} Erros, corpo para o backend e ingredientes a criar.
 */
function corpoCompra() {
  lerCompra();
  const e = S.editar, erros = [], novos = [], nomes = new Set();
  const usadas = e.itens.map((l, n) => ({ l, n })).filter(({ l }) => l.ing || l.cada || l.p);
  const items = usadas.map(({ l, n }) => {
    const total = totalComprado(l.emb, l.cada, l.medida), preco = num(l.p);
    if (l.ing === NOVO_ING) {
      const nome = (l.novoNome || "").trim(), chave = nomeIgual(nome), existe = estoque.ingredientes.find(i => nomeIgual(i.name) === chave);
      if (!nome) erros.push("Escreva o nome do ingrediente novo.");
      else if (existe) erros.push(`"${existe.name}" já está na lista. Escolha-o em vez de criar outro.`);
      else if (nomes.has(chave)) erros.push(`"${nome}" aparece em duas linhas como novo. Crie-o só numa.`);
      nomes.add(chave);
      if (total > 0 && preco >= 0) novos.push({ linha: n, body: { name: nome, kind: tipoValido(l.novoTipo), unit: MEDIDAS[l.medida].base, purchase_price: preco, purchase_qty: total } });
      return { ingredient_id: NOVO_ING, linha: n, quantity: total, total_price: preco, lot: l.lote.trim() || null, expires_on: l.val || null };
    }
    const ing = estoque.ingredientes.find(i => i.id === l.ing);
    if (ing && MEDIDAS[l.medida].base !== ing.unit) erros.push(`${ing.name} mede-se em ${ing.unit}. Mude a medida dessa linha.`);
    return { ingredient_id: l.ing, quantity: total, total_price: preco, lot: l.lote.trim() || null, expires_on: l.val || null };
  });
  if (!items.length) erros.push("Adicione pelo menos uma linha.");
  if (items.some(l => !l.ingredient_id || !(l.quantity > 0) || !(l.total_price >= 0))) erros.push("Cada linha precisa do que comprou, de quanto pagou e de quanto veio.");
  return { erros, novos, body: { supplier_id: e.fornecedor || null, purchased_on: e.data || null, items } };
}

Object.assign(VISTAS, { "adm-compra": vAdmCompra });
Object.assign(ACOES, {
  async "adm-stock"() { variacoes = []; try { await carregarStock(); abrir("adm-stock"); } catch (e) { erroGestao(e); } },
  "adm-compra-guardar"() {
    const f = corpoCompra();
    if (f.erros.length) return mostrarErros(f.erros);
    stockAcao(async () => {
      for (const n of f.novos) {
        const salvo = await api("/admin/ingredients", { method: "POST", auth: true, body: n.body });
        // Se a compra falhar a seguir, o ingrediente já criado fica escolhido na linha (não se cria duas vezes).
        estoque.ingredientes.push(Object.assign({ stock_qty: 0 }, n.body, { id: salvo.id }));
        S.editar.itens[n.linha].ing = salvo.id;
        f.body.items.forEach(it => { if (it.linha === n.linha) it.ingredient_id = salvo.id; });
      }
      if (f.novos.length) renderFolha();
      const body = Object.assign({}, f.body, { items: f.body.items.map(({ linha, ...it }) => it) });
      variacoes = (await api("/admin/purchases", { method: "POST", auth: true, body })).changes || [];
    }, f.novos.length ? "Compra registada e ingrediente criado" : "Compra registada", "adm-stock");
  }
});

$("#folha").addEventListener("change", ev => {
  if (S.vista !== "adm-compra") return;
  const m = /^ing(\d+)$/.exec(ev.target.name || "");
  if (!m) return;
  const n = +m[1], antes = S.editar.itens[n] && S.editar.itens[n].ing;
  if (ev.target.value !== NOVO_ING && antes !== NOVO_ING) return;
  lerCompra(); renderFolha();
  if (ev.target.value === NOVO_ING) { const c = campo("novoNome" + n); if (c) c.focus(); }
});
