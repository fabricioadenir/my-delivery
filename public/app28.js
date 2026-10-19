/* ---------- combinados: quanto custariam as mesmas peças compradas avulsas ---------- */
document.head.insertAdjacentHTML("beforeend", `<style>
.calc-res .aviso-avulso{background:var(--sakura-claro);border:1.5px solid var(--sakura);border-radius:12px;padding:.6rem .8rem;color:var(--tinta);font-weight:600}
.calc-res .nota-avulso{color:var(--tinta-2);font-size:.88rem;margin:-.2rem 0 0}
</style>`);

/**
 * Soma o preço de venda no site das peças da receita que são produtos (linhas "c:").
 * Ingredientes, preparados e produtos sem preço ou desativados não se compram avulsos e ficam de fora.
 * @returns {{total:number, pecas:number, fora:number}} Total avulso da receita, linhas contadas e linhas deixadas de fora.
 */
function somarAvulso() {
  let total = 0, pecas = 0, fora = 0;
  S.editar.itens.forEach((_, n) => {
    const r = campo("ref" + n), q = campo("q" + n), ref = r && r.value, qt = q ? num(q.value) : NaN;
    if (!ref || !(qt > 0)) return;
    if (ref[0] !== "c") { fora++; return; }
    const p = D.produtos.find(x => x.id === ref.slice(2)), preco = p ? +p.preco || 0 : 0;
    if (!p || p.ativo === false || !(preco > 0)) { fora++; return; }
    total += preco * qt;
    pecas++;
  });
  return { total, pecas, fora };
}

/**
 * Frase que compara um preço do combinado com o preço avulso.
 * @param {string} rotulo Como chamar o preço ("Com 13,70 €", "Hoje, a 12,00 €").
 * @param {number} preco Preço por unidade do combinado.
 * @param {number} avulso Preço avulso por unidade do combinado.
 * @returns {string} HTML da linha ou do aviso.
 */
function linhaPoupanca(rotulo, preco, avulso) {
  const dif = avulso - preco;
  if (dif >= 0.005) return `<div class="l"><span>${rotulo} o cliente poupa</span><span>${eur(dif)} (${Math.round(dif / avulso * 100)} %)</span></div>`;
  return `<div class="aviso-avulso">${rotulo} o combinado sai ${Math.abs(dif) < 0.005 ? "igual a" : eur(-dif) + " mais caro que"} comprar as peças avulsas.</div>`;
}

const mostrarContasSemAvulso = mostrarContasFicha;
/** Resultado da calculadora com a comparação entre o combinado e as mesmas peças avulsas. */
mostrarContasFicha = function () {
  mostrarContasSemAvulso();
  const a = somarAvulso();
  if (!(a.total > 0)) return;
  const c = contasFicha();
  if (!(c.total > 0) || !(c.rend > 0)) return;
  const avulso = a.total / c.rend, cada = c.rend > 1 ? " (por unidade)" : "";
  let h = `<div class="l sep"><span>Mesmas peças avulsas${cada}</span><span>${eur(avulso)}</span></div>`;
  if (a.fora) h += `<p class="nota-avulso">${a.fora === 1 ? "1 item que não se vende avulso fica" : a.fora + " itens que não se vendem avulsos ficam"} de fora desta conta.</p>`;
  if (c.redondo > 0 && isFinite(c.redondo)) h += linhaPoupanca(`Com ${eur(c.redondo)}`, c.redondo, avulso);
  if (c.atual > 0 && Math.abs(c.atual - c.redondo) >= 0.005) h += linhaPoupanca(`Hoje, a ${eur(c.atual)},`, c.atual, avulso);
  $("#calc-res").insertAdjacentHTML("beforeend", h);
};
