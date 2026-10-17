/* ---------- peças vendidas em porções: o cliente só vê o preço da porção ---------- */
/* Produtos com quantidade mínima > 1 (ex.: 4) passam a ser vendidos em porções desse tamanho.
   O menu e o carrinho mostram "4 un. 3,20 €" e nunca o preço de uma unidade. */

document.head.insertAdjacentHTML("beforeend", `<style>.precos .un{display:none}</style>`);

/** Tamanho da porção de um produto (1 = vende-se à unidade). */
const porcao = id => (ITEM[id] && ITEM[id].min > 1 ? ITEM[id].min : 1);

const montarComPrecoUnidade = montarPagina;
montarPagina = function () {
  montarComPrecoUnidade();
  document.querySelectorAll(".precos .un").forEach(el => el.remove());
};

const passoUmAUm = passo;
passo = function (id) {
  const m = porcao(id), h = passoUmAUm(id);
  if (m === 1) return h;
  return h.replace(`aria-label="Juntar mais um"`, `aria-label="Juntar mais ${m}"`).replace(`aria-label="Tirar um"`, `aria-label="Tirar ${m}"`);
};

const vCarrinhoComPrecoUnidade = VISTAS.carrinho;
function vCarrinhoPorPorcao() {
  const v = vCarrinhoComPrecoUnidade();
  let k = 0;
  if (v.corpo) v.corpo = v.corpo.replace(/<p class="un">[^<]*? cada<\/p>/g, original => {
    const i = S.cart[k++];
    return i && porcao(i.id) > 1 ? `<p class="un">${i.q} un.</p>` : original;
  });
  return v;
}
Object.assign(VISTAS, { carrinho: vCarrinhoPorPorcao });

Object.assign(ACOES, {
  mais(b) {
    const id = b.dataset.id, m = porcao(id), q = qtd(id);
    setQtd(id, q ? (Math.floor(q / m) + 1) * m : ITEM[id].min);
    if (!q) brinde("No carrinho: " + ITEM[id].nome);
  },
  menos(b) {
    const id = b.dataset.id, m = porcao(id), q = qtd(id);
    setQtd(id, q <= ITEM[id].min ? 0 : (Math.ceil(q / m) - 1) * m);
  }
});
