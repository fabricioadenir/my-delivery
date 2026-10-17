/* ---------- compras em linguagem simples: embalagens, medidas e preço por kg ---------- */
const MEDIDAS = { g: { base: "g", f: 1, nome: "gramas (g)" }, kg: { base: "g", f: 1000, nome: "quilos (kg)" }, ml: { base: "ml", f: 1, nome: "mililitros (ml)" }, l: { base: "ml", f: 1000, nome: "litros (L)" }, un: { base: "un", f: 1, nome: "unidades" } };

/**
 * Preço fácil de ler: por kg, por litro ou por unidade.
 * @param {number} custo Custo por unidade base.
 * @param {string} unidade Unidade base: g, ml ou un.
 * @returns {string} Texto do preço.
 */
function precoLegivel(custo, unidade) {
  if (unidade === "g") return eur(custo * 1000) + " por kg";
  if (unidade === "ml") return eur(custo * 1000) + " por litro";
  return fmtCusto(custo) + " por unidade";
}

/**
 * Opções do seletor de medida.
 * @param {string} sel Medida escolhida.
 * @param {string|null} base Limita às medidas desta unidade base.
 * @returns {string} HTML das opções.
 */
function opcoesMedida(sel, base) {
  return Object.keys(MEDIDAS).filter(k => !base || MEDIDAS[k].base === base).map(k => `<option value="${k}" ${k === sel ? "selected" : ""}>${MEDIDAS[k].nome}</option>`).join("");
}

/**
 * Quantidade total comprada, na unidade base.
 * @param {string} emb Número de embalagens.
 * @param {string} cada Quanto traz cada embalagem.
 * @param {string} medida Medida escolhida.
 * @returns {number} Total em g, ml ou un.
 */
function totalComprado(emb, cada, medida) { return MEDIDAS[medida] ? num(emb) * num(cada) * MEDIDAS[medida].f : NaN; }

/** Mostra, enquanto se escreve, quanto se comprou e a quanto fica o kg, o litro ou a unidade. */
function resumoIngrediente() {
  const el = $("#resumo-ing"); if (!el) return;
  const medida = campo("medida").value, total = totalComprado(campo("emb").value, campo("cada").value, medida), pago = num(campo("preco").value);
  el.textContent = total > 0 && pago >= 0 ? `Comprou ${fmtQtd(total)} ${MEDIDAS[medida].base} por ${eur(pago)}. Fica a ${precoLegivel(pago / total, MEDIDAS[medida].base)}.` : "Escreva quanto pagou e quanto veio para ver a quanto fica.";
}

/**
 * Lista de ingredientes com o preço pago e o preço por kg, litro ou unidade.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vAdmIngredientes() {
  const linhas = custos.ingredientes.map(i => `<div class="cartao"><div><strong>${esc(i.name)}</strong>${i.kind === "packaging" ? `<span class="etiqueta">Embalagem</span>` : ""}<small>${eur(+i.purchase_price)} por ${fmtQtd(i.purchase_qty)} ${esc(i.unit)}, ou ${precoLegivel(+i.unit_cost, i.unit)}</small></div><div class="acoes"><button type="button" class="ligacao" data-a="adm-ing" data-id="${esc(i.id)}">Editar</button></div></div>`).join("");
  return { titulo: "Ingredientes e embalagens",
    corpo: VOLTAR_CUSTOS + `<div class="grupo">${linhas || `<p style="color:var(--tinta-2)">Comece por registar o que compra: salmão, arroz, nori, caixas, sacos.</p>`}<p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="adm-ing-novo">Registar o que comprou</button></p></div>` };
}

/**
 * Formulário de ingrediente escrito como uma compra: quanto pagou, quantas embalagens e quanto traz cada uma.
 * @returns {{titulo:string, corpo:string, pe:string}} Conteúdo da folha.
 */
function vAdmIngrediente() {
  const i = S.editar, sel = (v, a) => v === a ? "selected" : "";
  return { titulo: i.id ? "Editar ingrediente" : "Registar o que comprou",
    corpo: VOLTAR_CUSTOS + `<div class="grupo"><label class="campo" style="margin-top:0"><span>O que comprou</span><input type="text" name="nome" value="${esc(i.name)}" placeholder="Wasabi em pó, salmão, caixas…"></label>
      <label class="campo"><span>Tipo</span><select name="tipo"><option value="ingredient" ${sel(i.kind, "ingredient")}>Ingrediente</option><option value="packaging" ${sel(i.kind, "packaging")}>Embalagem</option></select></label>
      <label class="campo"><span>Quanto pagou no total (€)</span><input type="text" name="preco" inputmode="decimal" value="${esc(i.preco)}"></label>
      <div class="par"><label class="campo"><span>Quantas embalagens</span><input type="text" name="emb" inputmode="decimal" value="${esc(i.emb)}"></label>
      <label class="campo"><span>Cada uma traz</span><input type="text" name="cada" inputmode="decimal" value="${esc(i.cada)}"></label></div>
      <label class="campo"><span>Medida</span><select name="medida">${opcoesMedida(i.medida, i.id ? MEDIDAS[i.medida].base : null)}</select><small>Exemplo: uma caixa com 10 saquetas de 35 g são 10 embalagens, cada uma traz 35, em gramas.</small></label>
      <p class="aviso" id="resumo-ing"></p></div>
      ${i.id ? "" : `<div class="grupo"><label class="opcao"><input type="checkbox" name="entrada" checked><span><strong>Dar entrada no stock</strong><small>Soma esta compra ao que tem em casa.</small></span></label></div>`}
      <div id="erros"></div>
      ${i.id ? `<p style="color:var(--tinta-2)">Para registar uma compra nova deste ingrediente, use Stock e compras.</p><p><button type="button" class="ligacao" data-a="adm-ing-apagar">Apagar este ingrediente</button></p>` : ""}`,
    pe: `<button type="button" class="btn btn-bloco" data-a="adm-ing-guardar">${i.id ? "Guardar alterações" : "Guardar compra"}</button>` };
}

/**
 * Lista de preparações com o custo por kg, litro ou unidade.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vAdmPreparacoes() {
  const linhas = custos.preparacoes.map(p => `<div class="cartao"><div><strong>${esc(p.name)}</strong><small>Rende ${fmtQtd(p.yield_qty)} ${esc(p.unit)}. Custa ${precoLegivel(+custos.prep[p.id] || 0, p.unit)}</small></div><div class="acoes"><button type="button" class="ligacao" data-a="adm-prep" data-id="${esc(p.id)}">Editar</button></div></div>`).join("");
  return { titulo: "Preparações",
    corpo: VOLTAR_CUSTOS + `<div class="grupo">${linhas || `<p style="color:var(--tinta-2)">Uma preparação é o que faz em lote antes de montar as peças: arroz temperado, salmão limpo, molhos.</p>`}<p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="adm-prep-nova">Nova preparação</button></p></div>` };
}

/**
 * Formulário de compra com embalagens e medida em cada linha.
 * @returns {{titulo:string, corpo:string, pe:string}} Conteúdo da folha.
 */
function vAdmCompra() {
  const e = S.editar, op = (v, t, sel) => `<option value="${v}" ${v === sel ? "selected" : ""}>${esc(t)}</option>`;
  const linhas = e.itens.map((l, n) => `<div class="dia"><label class="campo"><span>O que comprou</span><select name="ing${n}">${op("", "Escolher…", l.ing)}${estoque.ingredientes.map(i => op(i.id, i.name, l.ing)).join("")}</select></label>
    <label class="campo"><span>Quanto pagou por isto (€)</span><input type="text" name="p${n}" inputmode="decimal" value="${esc(l.p)}"></label>
    <div class="par" style="margin-top:.8rem"><label class="campo"><span>Quantas embalagens</span><input type="text" name="emb${n}" inputmode="decimal" value="${esc(l.emb)}"></label><label class="campo"><span>Cada uma traz</span><input type="text" name="cada${n}" inputmode="decimal" value="${esc(l.cada)}"></label></div>
    <label class="campo"><span>Medida</span><select name="medida${n}">${opcoesMedida(l.medida, null)}</select></label>
    <div class="par" style="margin-top:.8rem"><label class="campo"><span>Lote</span><input type="text" name="lote${n}" value="${esc(l.lote)}"></label><label class="campo"><span>Validade</span><input type="date" name="val${n}" value="${esc(l.val)}" style="${CAMPO}"></label></div>
    <p><button type="button" class="ligacao" data-a="compra-linha-apagar" data-i="${n}">Tirar esta linha</button></p></div>`).join("");
  return { titulo: "Registar compra",
    corpo: VOLTAR_STOCK + `<div class="grupo"><div class="par"><label class="campo" style="margin-top:0"><span>Fornecedor</span><select name="fornecedor">${op("", "Sem fornecedor", e.fornecedor)}${estoque.fornecedores.map(f => op(f.id, f.name, e.fornecedor)).join("")}</select></label>
      <label class="campo" style="margin-top:0"><span>Data</span><input type="date" name="data" value="${esc(e.data)}" style="${CAMPO}"></label></div></div>
      <div class="grupo"><h3>O que comprou</h3>${linhas}<p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="compra-linha-nova">Adicionar linha</button></p></div><div id="erros"></div>`,
    pe: `<button type="button" class="btn btn-bloco" data-a="adm-compra-guardar">Guardar compra</button>` };
}

/** Guarda no rascunho o que está escrito no formulário de compra. */
function lerCompra() {
  const e = S.editar;
  e.fornecedor = campo("fornecedor").value; e.data = campo("data").value;
  e.itens = e.itens.map((l, n) => ({ ing: campo("ing" + n).value, p: campo("p" + n).value, emb: campo("emb" + n).value, cada: campo("cada" + n).value, medida: campo("medida" + n).value, lote: campo("lote" + n).value, val: campo("val" + n).value }));
}

/**
 * Valida a compra e converte embalagens e medidas na unidade de cada ingrediente.
 * @returns {{erros:string[], body:object}} Erros e corpo para o backend.
 */
function corpoCompra() {
  lerCompra();
  const e = S.editar, erros = [], usadas = e.itens.filter(l => l.ing || l.cada || l.p);
  const items = usadas.map(l => {
    const ing = estoque.ingredientes.find(i => i.id === l.ing);
    if (ing && MEDIDAS[l.medida].base !== ing.unit) erros.push(`${ing.name} mede-se em ${ing.unit}. Mude a medida dessa linha.`);
    return { ingredient_id: l.ing, quantity: totalComprado(l.emb, l.cada, l.medida), total_price: num(l.p), lot: l.lote.trim() || null, expires_on: l.val || null };
  });
  if (!items.length) erros.push("Adicione pelo menos uma linha.");
  if (items.some(l => !l.ingredient_id || !(l.quantity > 0) || !(l.total_price >= 0))) erros.push("Cada linha precisa do que comprou, de quanto pagou e de quanto veio.");
  return { erros, body: { supplier_id: e.fornecedor || null, purchased_on: e.data || null, items } };
}

const LINHA_COMPRA = { ing: "", p: "", emb: "1", cada: "", medida: "g", lote: "", val: "" };
Object.assign(VISTAS, { "adm-ingredientes": vAdmIngredientes, "adm-ingrediente": vAdmIngrediente, "adm-preparacoes": vAdmPreparacoes, "adm-compra": vAdmCompra });
Object.assign(ACOES, {
  "adm-ing-novo"() { S.editar = { id: "", name: "", kind: "ingredient", preco: "", emb: "1", cada: "", medida: "g" }; abrir("adm-ingrediente"); resumoIngrediente(); },
  "adm-ing"(b) {
    const i = custos.ingredientes.find(x => x.id === b.dataset.id), grande = i.unit !== "un" && +i.purchase_qty >= 1000;
    S.editar = { id: i.id, name: i.name, kind: i.kind, preco: txtNum(i.purchase_price), emb: "1", cada: txtNum(grande ? i.purchase_qty / 1000 : +i.purchase_qty), medida: grande ? (i.unit === "g" ? "kg" : "l") : i.unit };
    abrir("adm-ingrediente"); resumoIngrediente();
  },
  "adm-ing-guardar"() {
    const e = S.editar, medida = campo("medida").value, total = totalComprado(campo("emb").value, campo("cada").value, medida), erros = [];
    const body = { name: campo("nome").value.trim(), kind: campo("tipo").value, unit: MEDIDAS[medida].base, purchase_price: num(campo("preco").value), purchase_qty: total };
    if (!body.name) erros.push("Escreva o que comprou.");
    if (!(body.purchase_price >= 0)) erros.push("Escreva quanto pagou.");
    if (!(total > 0)) erros.push("Escreva quantas embalagens e quanto traz cada uma.");
    if (erros.length) return mostrarErros(erros);
    const entrada = !e.id && campo("entrada").checked;
    custosAcao(async () => {
      const salvo = await api("/admin/ingredients" + (e.id ? "/" + e.id : ""), { method: e.id ? "PUT" : "POST", auth: true, body });
      if (entrada) await api("/admin/purchases", { method: "POST", auth: true, body: { supplier_id: null, purchased_on: null, items: [{ ingredient_id: salvo.id, quantity: total, total_price: body.purchase_price, lot: null, expires_on: null }] } });
    }, e.id ? "Ingrediente guardado" : "Compra guardada", "adm-ingredientes");
  },
  "adm-compra"() {
    const n = agora();
    S.editar = { fornecedor: "", data: n.y + "-" + doisD(n.m) + "-" + doisD(n.d), itens: [Object.assign({}, LINHA_COMPRA)] };
    abrir("adm-compra");
  },
  "compra-linha-nova"() { lerCompra(); S.editar.itens.push(Object.assign({}, LINHA_COMPRA)); renderFolha(); }
});

$("#folha").addEventListener("input", () => { if (S.vista === "adm-ingrediente") resumoIngrediente(); });
$("#folha").addEventListener("change", ev => {
  if (S.vista === "adm-ingrediente") return resumoIngrediente();
  const m = S.vista === "adm-compra" && /^ing(\d+)$/.exec(ev.target.name || ""), ing = m && estoque.ingredientes.find(i => i.id === ev.target.value);
  if (ing) campo("medida" + m[1]).value = ing.unit;
});
