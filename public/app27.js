/* ---------- preparados dentro de preparados: o arroz pode levar o molho su ---------- */

/**
 * Ids das preparações que usam a preparação indicada, direta ou indiretamente.
 * Servem para não deixar escolher uma preparação que daria uma volta (A leva B e B leva A).
 * @param {string} id Preparação a editar.
 * @returns {Set<string>} Ids que não podem entrar nela.
 */
function prepsQueUsam(id) {
  const usam = new Set();
  if (!id) return usam;
  let mudou = true;
  while (mudou) {
    mudou = false;
    custos.preparacoes.forEach(p => {
      if (usam.has(p.id)) return;
      const leva = (p.preparation_items || []).some(x => x.sub_preparation_id === id || usam.has(x.sub_preparation_id));
      if (leva) { usam.add(p.id); mudou = true; }
    });
  }
  return usam;
}

const opcoesRefSemPreps = opcoesRef;
/**
 * Opções do seletor. No editor de preparações aparecem também as outras preparações,
 * menos a própria e as que já a usam.
 * @param {string} sel Referência escolhida.
 * @param {boolean} soIngredientes Verdadeiro no editor de preparações.
 * @returns {string} HTML das opções.
 */
opcoesRef = function (sel, soIngredientes) {
  if (!soIngredientes) return opcoesRefSemPreps(sel, false);
  const atual = S.editar.id, fora = prepsQueUsam(atual);
  const op = (v, t) => `<option value="${v}" ${v === sel ? "selected" : ""}>${esc(t)}</option>`;
  const preps = custos.preparacoes.filter(p => p.id !== atual && !fora.has(p.id));
  return opcoesRefSemPreps(sel, true) + (preps.length ? `<optgroup label="Preparações">${preps.map(p => op("p:" + p.id, p.name + " (" + p.unit + ")")).join("")}</optgroup>` : "");
};

Object.assign(ACOES, {
  "adm-prep"(b) {
    const p = custos.preparacoes.find(x => x.id === b.dataset.id);
    if (!p) return;
    const itens = (p.preparation_items || []).map(x => ({ ref: x.sub_preparation_id ? "p:" + x.sub_preparation_id : "i:" + x.ingredient_id, q: txtNum(x.quantity) }));
    S.editar = { id: p.id, nome: p.name, unidade: p.unit, rend: txtNum(p.yield_qty), itens: itens.length ? itens : [{ ref: "", q: "" }] };
    abrir("adm-preparacao");
  }
});
