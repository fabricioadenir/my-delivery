/* ---------- preço psicológico: o total que o cliente vê fica logo abaixo de um valor redondo ---------- */
document.head.insertAdjacentHTML("beforeend", `<style>
.estilos{display:grid;gap:.5rem;margin:.2rem 0 .3rem}
.estilo{display:grid;grid-template-columns:auto 1fr auto;gap:.2rem .7rem;align-items:center;border:1.5px solid var(--linha);border-radius:14px;padding:.7rem .9rem;cursor:pointer;background:var(--papel)}
.estilo:has(input:checked){border-color:var(--sakura);background:var(--sakura-claro)}
.estilo input{width:20px;height:20px;accent-color:var(--sakura);margin:0}
.estilo strong{font-size:1.1rem}
.estilo small{grid-column:2 / -1;color:var(--tinta-2)}
</style>`);

/**
 * Preço por unidade em que o total mostrado ao cliente (o mínimo de unidades)
 * fica logo abaixo de um valor redondo: 3,96 € em vez de 4,00 €, 12,90 € em vez de 13 €.
 * Nunca fica abaixo do preço mínimo que garante a margem.
 * @param {number} minimo Preço mínimo por unidade (com margem e IVA).
 * @param {number} q Unidades do pedido mínimo.
 * @returns {number} Preço por unidade em euros.
 */
function precoPsicologico(minimo, q) {
  if (!(minimo > 0)) return NaN;
  const c = Math.ceil(minimo * 100 - 1e-6);
  if (q === 1 && c >= 1000) return (Math.floor(c / 100) * 100 + (c % 100 <= 90 ? 90 : 190)) / 100;
  for (let alvo = c * q; alvo < 1e6; alvo++) {
    const passo = alvo < 500 ? 50 : 100, teto = Math.ceil(alvo / passo) * passo, u = Math.floor((teto - 1) / q);
    if (u >= c && u * q >= teto - 10) return u / 100;
    alvo = teto;
  }
  return NaN;
}

/**
 * Preço redondo por unidade: múltiplo de 5 cêntimos, acima do mínimo.
 * @param {number} minimo Preço mínimo por unidade.
 * @returns {number} Preço por unidade em euros.
 */
function precoRedondo(minimo) { return Math.ceil(minimo * 20 - 1e-9) / 20; }

const contasSemEstilo = contasFicha;
/**
 * Contas da receita com as duas opções de preço e a escolhida.
 * @returns {object} Contas; `redondo` passa a ser o preço escolhido.
 */
contasFicha = function () {
  const c = contasSemEstilo(), el = campo("estilo") ? $('#folha [name="estilo"]:checked') : null;
  c.estilo = el ? el.value : LS.get("calc_estilo", "psico");
  if (el) LS.set("calc_estilo", c.estilo);
  c.psico = precoPsicologico(c.comIva, c.min);
  c.redondoBase = precoRedondo(c.comIva);
  c.redondo = c.estilo === "redondo" ? c.redondoBase : c.psico;
  return c;
};

/**
 * Margem real de um preço, sem IVA.
 * @param {object} c Contas.
 * @param {number} preco Preço por unidade com IVA.
 * @returns {string} Percentagem.
 */
function margemDe(c, preco) { const s = preco / (1 + c.iva); return s > 0 ? Math.round((s - c.porUn) / s * 100) + " %" : "—"; }

/**
 * Cartão de uma opção de preço.
 * @param {object} c Contas.
 * @param {string} v Valor da opção.
 * @param {number} preco Preço por unidade.
 * @param {string} titulo Explicação curta (a do preço psicológico é calculada).
 * @returns {string} HTML da opção.
 */
function opcaoEstilo(c, v, preco, titulo) {
  if (v === "psico") { const t = Math.round(preco * c.min * 100), passo = t < 500 ? 50 : 100; titulo = `Fica abaixo de ${eur(Math.ceil(t / passo) * passo / 100)}, parece mais barato`; }
  const total = c.min > 1 ? `${c.min} un. por <strong>${eur(preco * c.min)}</strong>` : `<strong>${eur(preco)}</strong>`;
  return `<label class="estilo"><input type="radio" name="estilo" value="${v}" ${c.estilo === v ? "checked" : ""}><span>${total}</span><span>${c.min > 1 ? eur(preco) + " cada" : ""}</span><small>${titulo} · margem ${margemDe(c, preco)}</small></label>`;
}

/** Mostra o resultado da calculadora com a escolha entre preço psicológico e redondo. */
mostrarContasFicha = function () {
  const c = contasFicha(), el = $("#calc-res"), usar = $("#btn-usar"), pc = n => isFinite(n) ? Math.round(n * 100) + " %" : "—";
  const l = (a, b, cls = "") => `<div class="l ${cls}"><span>${a}</span><span>${b}</span></div>`;
  if (!(c.total > 0) || !(c.rend > 0)) { el.innerHTML = `<p class="nota" style="margin:0">Escolha os ingredientes, as quantidades e quantas unidades a receita faz.</p>`; usar.hidden = true; return; }
  const ok = isFinite(c.psico) && c.psico > 0;
  el.innerHTML = l("Custo da receita", fmtCusto(c.total)) + l(`Custo por unidade (÷ ${fmtQtd(c.rend)})`, fmtCusto(c.porUn))
    + (ok ? l(`Mínimo para ter ${pc(c.m)} de margem${c.iva ? " com IVA" : ""}`, fmtCusto(c.comIva), "sep")
      + `<div class="estilos" role="radiogroup" aria-label="Preço a usar">${opcaoEstilo(c, "psico", c.psico, "")}${opcaoEstilo(c, "redondo", c.redondoBase, "Redondo")}</div>`
      + l("Fica de lucro por unidade", eur(c.redondo / (1 + c.iva) - c.porUn)) : `<p class="erros" style="margin:0">A margem tem de estar entre 0 e 99 %.</p>`)
    + (c.atual ? l(`Hoje vende a ${eur(c.atual)}${c.min > 1 ? " (" + c.min + " un. " + eur(c.atual * c.min) + ")" : ""}`, "margem " + pc(c.margemAtual), "sep") : "");
  usar.hidden = !ok || Math.abs(c.redondo - c.atual) < 0.005;
  usar.textContent = `Guardar e pôr ${eur(c.redondo)}${c.min > 1 ? " (" + c.min + " un. " + eur(c.redondo * c.min) + ")" : ""} no site`;
};
