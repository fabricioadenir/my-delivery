/* ---------- bebidas com opção "Fresca" ou "Natural" ----------
 * Na gestão, cada produto tem a caixa "Escolher fresca ou natural" (coluna products.temp_option).
 * No site, esses produtos mostram dois botões (Fresca / Natural) em vez de "Adicionar".
 * No carrinho cada opção é uma linha própria, com a chave "<id do produto>~fresca" ou "~natural";
 * o pedido envia o produto verdadeiro com option "Fresca"/"Natural" e fica "Água (fresca)".
 */
document.head.insertAdjacentHTML("beforeend", `<style>
.temp-escolha{display:flex;flex-direction:column;align-items:flex-end;gap:.4rem}
.temp-escolha .temp-linha{display:flex;align-items:center;gap:.5rem}
.temp-escolha .temp-linha small{font-weight:600;color:var(--tinta-2)}
.temp-escolha .btn{min-width:7.5rem}
.temp-escolha .temp-botoes{display:flex;gap:.4rem;flex-wrap:wrap;justify-content:flex-end}
.temp-escolha .temp-botoes .btn{min-width:0}
</style>`);

const OPCOES_TEMP = [["fresca", "Fresca"], ["natural", "Natural"]];
const chaveTemp = (id, o) => id + "~" + o;

/* O backend passa a trazer temp_option em cada produto. */
const mapearSemTemp = mapear;
mapear = function (d) {
  const r = mapearSemTemp(d), porId = {};
  (d.products || []).forEach(p => { porId[p.id] = p; });
  r.produtos.forEach(p => { p.temp = !!(porId[p.id] && porId[p.id].temp_option); });
  return r;
};

/* Cada produto com opção ganha duas entradas no ITEM: uma para fresca e outra para natural. */
const indexarSemTemp = indexar;
indexar = function () {
  indexarSemTemp();
  D.produtos.forEach(p => {
    const base = ITEM[p.id];
    if (!p.temp || !base) return;
    base.temp = true;
    OPCOES_TEMP.forEach(([o, rotulo]) => {
      ITEM[chaveTemp(p.id, o)] = Object.assign({}, base, { id: chaveTemp(p.id, o), nome: base.nome + " (" + o + ")", base: p.id, opcao: rotulo, temp: false });
    });
  });
};
indexar();
S.cart = S.cart.filter(i => ITEM[i.id]);

/* No menu: botões Fresca / Natural; quando já há no carrinho, o + / − de cada uma. */
const passoSemTemp = passo;
passo = function (id) {
  const it = ITEM[id];
  if (!it || !it.temp) return passoSemTemp(id);
  const n = esc(it.nome), linhas = OPCOES_TEMP.map(([o, rotulo]) => {
    const k = chaveTemp(id, o);
    return { k, rotulo, q: qtd(k) };
  });
  if (!linhas.some(l => l.q)) {
    return `<div class="temp-escolha"><div class="temp-botoes" role="group" aria-label="Escolha ${n} fresca ou natural">${linhas.map(l =>
      `<button type="button" class="btn btn-sec" data-a="mais" data-id="${l.k}" aria-label="Adicionar ${n} ${l.rotulo.toLowerCase()}">${l.rotulo}</button>`).join("")}</div></div>`;
  }
  return `<div class="temp-escolha">${linhas.map(l => l.q
    ? `<div class="temp-linha"><small>${l.rotulo}</small>${passoSemTemp(l.k)}</div>`
    : `<button type="button" class="btn btn-sec" data-a="mais" data-id="${l.k}" aria-label="Adicionar ${n} ${l.rotulo.toLowerCase()}">+ ${l.rotulo}</button>`).join("")}</div>`;
};

/* O pedido leva o produto verdadeiro e a opção escolhida. */
const corpoPedidoSemTemp = corpoPedido;
corpoPedido = function (r, v) {
  const c = corpoPedidoSemTemp(r, v);
  c.items = S.cart.map(i => {
    const it = ITEM[i.id], linha = { product_id: it.base || i.id, quantity: i.q };
    if (it.opcao) linha.option = it.opcao;
    return linha;
  });
  return c;
};

/* Pedir de novo: pedidos vindos da conta trazem o id do produto e o nome com "(fresca)"/"(natural)". */
const repetirSemTemp = ACOES.repetir;
ACOES.repetir = function (b) {
  const p = S.pedidos[+b.dataset.i];
  if (p) p.itens = p.itens.map(x => {
    const it = ITEM[x.id];
    if (!it || !it.temp) return x;
    const o = /\(fresca\)\s*$/i.test(x.nome || "") ? "fresca" : "natural";
    return Object.assign({}, x, { id: chaveTemp(x.id, o) });
  });
  return repetirSemTemp(b);
};

/* Raio-X: conta sempre o produto verdadeiro. */
const rxEventoSemTemp = rxEvento;
rxEvento = function (tipo, dados = {}) {
  if (dados && typeof dados.product_id === "string" && dados.product_id.includes("~")) dados = Object.assign({}, dados, { product_id: dados.product_id.split("~")[0] });
  return rxEventoSemTemp(tipo, dados);
};

/* ---------- gestão: caixa no formulário do produto ---------- */
const vAdmProdSemTemp = VISTAS["adm-produto"];
VISTAS["adm-produto"] = function () {
  const v = vAdmProdSemTemp(), p = S.editar || {};
  const caixa = `<label class="opcao"><input type="checkbox" name="temp" ${p.temp ? "checked" : ""}><span><strong>Escolher fresca ou natural</strong><small>Para bebidas: ao adicionar, o cliente escolhe se quer fresca ou natural (o preço é o mesmo).</small></span></label>`;
  const marca = /(<label class="opcao"><input type="checkbox" name="ativo"[\s\S]*?<\/label>)/;
  v.corpo = marca.test(v.corpo) ? v.corpo.replace(marca, "$1" + caixa) : v.corpo + `<div class="grupo">${caixa}</div>`;
  return v;
};
const lerProdutoSemTemp = lerProduto;
lerProduto = function () {
  const f = lerProdutoSemTemp(), c = campo("temp");
  if (c) f.dados.temp_option = c.checked;
  return f;
};

/* O menu pode ter chegado antes deste ficheiro carregar: nesse caso volta a pedi-lo para trazer a opção. */
if (D.produtos.some(p => p.temp === undefined)) carregarMenu();
else if (document.querySelector("[data-ctl]")) atualizarPagina();
