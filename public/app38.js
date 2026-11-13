/* ---------- acompanhamentos pagos, wasabi grátis e "Acompanha …" nos combinados ----------
 * - Os combinados mostram o que trazem: 1 par de palitos e 2 molhos shoyu por cada 20 peças (arredonda para cima).
 *   O texto é calculado pelo n.º de peças; se a descrição já disser "Acompanha", fica como está.
 * - Categoria "Acompanhamentos" (criada na gestão): os produtos dela não aparecem no menu; o cliente
 *   escolhe-os no fim do pedido, com + / −. São produtos normais: têm preço, contam para o pedido mínimo,
 *   aparecem nos itens do pedido, na gestão e no WhatsApp.
 * - Sai o bloco "Acompanhamentos, sem custo" (pauzinhos, soja, wasabi, gengibre). Fica a pergunta
 *   "Gostaria de wasabi?" (sem custo), obrigatória, gravada em extras.wasabi.
 */
document.head.insertAdjacentHTML("beforeend", `<style>
.incluido{color:var(--tinta-2);font-size:.92rem;margin-top:.25rem}
.acomp-linha{display:flex;align-items:center;justify-content:space-between;gap:.6rem;padding:.55rem 0;border-bottom:1px solid var(--linha)}
.acomp-linha small{display:block;color:var(--tinta-2)}
.acomp-incluidos{color:var(--tinta-2);margin:0 0 .4rem}
.wasabi-pergunta{margin-top:.8rem}
.wasabi-pergunta > p{margin:0 0 .1rem;font-weight:700}
.wasabi-pergunta > p small{font-weight:400;color:var(--tinta-2)}
</style>`);

const NOME_CAT_ACOMP = "Acompanhamentos";
const semAcento = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const ehCatAcomp = c => !!c && semAcento(c.nome).startsWith("acompanhament");
const catAcomp = () => D.categorias.find(ehCatAcomp);

/** Produtos visíveis da categoria Acompanhamentos. */
function produtosAcomp() {
  const c = catAcomp();
  return c ? D.produtos.filter(p => p.cat === c.id && p.ativo !== false && ITEM[p.id]) : [];
}

/**
 * O que um combinado traz: 1 par de palitos e 2 shoyu por cada 20 peças.
 * @param {object} p Produto (formato do site).
 * @returns {{pares:number, shoyu:number}|null} Quantidades, ou null se não for combinado.
 */
function incluidoCombinado(p) {
  const pecas = +p.pecas, c = D.categorias.find(x => x.id === p.cat);
  if (!(pecas >= 8) || ehCatAcomp(c) || (ITEM[p.id] && ITEM[p.id].min > 1)) return null;
  const n = Math.ceil(pecas / 20);
  return { pares: n, shoyu: n * 2 };
}
const textoPares = n => n === 1 ? "1 par de palitos" : n + " pares de palitos";
const textoIncluido = i => `Acompanha ${i.shoyu} molhos shoyu e ${textoPares(i.pares)}.`;

/* ---------- menu: sem a categoria Acompanhamentos e com "Acompanha …" nos combinados ---------- */
const montarComAcomp = montarPagina;
montarPagina = function () {
  const todas = D.categorias;
  D.categorias = todas.filter(c => !ehCatAcomp(c));
  try { montarComAcomp(); } finally { D.categorias = todas; }
  D.produtos.forEach(p => {
    const inc = incluidoCombinado(p);
    if (!inc || /acompanha/i.test(p.desc || "")) return;
    document.querySelectorAll(`#menu [data-ctl="${CSS.escape(p.id)}"]`).forEach(ctl => {
      const caixa = ctl.closest("article, li"); if (!caixa || caixa.querySelector(".incluido")) return;
      const depois = caixa.querySelector(".comp, .desc") || caixa.querySelector(".serve, .nome");
      if (depois) depois.insertAdjacentHTML("afterend", `<p class="incluido">${esc(textoIncluido(inc))}</p>`);
    });
  });
};

/* ---------- checkout ---------- */
const novoRascunhoComExtras = novoRascunho;
novoRascunho = function () {
  return Object.assign(novoRascunhoComExtras(), { pauzinhos: "0", soja: false, wasabi: false, gengibre: false, querWasabi: "" });
};

/** Quanto os combinados do carrinho já trazem. */
function incluidosNoCarrinho() {
  const t = { pares: 0, shoyu: 0 };
  S.cart.forEach(i => {
    const p = D.produtos.find(x => x.id === i.id), inc = p && incluidoCombinado(p);
    if (inc) { t.pares += inc.pares * i.q; t.shoyu += inc.shoyu * i.q; }
  });
  return t;
}

/** + / − de um acompanhamento no checkout. */
function passoAcomp(id) {
  const q = qtd(id), n = esc(ITEM[id].nome);
  if (!q) return `<button type="button" class="btn btn-sec" data-a="acomp-mais" data-id="${esc(id)}" aria-label="Juntar ${n}">Juntar</button>`;
  return `<div class="passo" role="group" aria-label="Quantidade de ${n}"><button type="button" data-a="acomp-menos" data-id="${esc(id)}" aria-label="Tirar um">−</button><span>${q}</span><button type="button" data-a="acomp-mais" data-id="${esc(id)}" aria-label="Juntar mais um">+</button></div>`;
}

/** Lista dos acompanhamentos à venda. */
function listaAcomp() {
  return produtosAcomp().map(p => {
    const it = ITEM[p.id], q = qtd(p.id);
    return `<div class="acomp-linha"><div><strong>${esc(it.nome)}</strong><small>${eur(it.preco)} cada${q ? " · " + eur(it.preco * q) : ""}</small></div>${passoAcomp(p.id)}</div>`;
  }).join("");
}

/** Bloco "Acompanhamentos" do checkout: extras pagos e a pergunta do wasabi. */
function blocoAcomp() {
  const r = S.rascunho, inc = incluidosNoCarrinho(), lista = listaAcomp();
  const jaTem = inc.pares ? `<p class="acomp-incluidos">Os combinados do seu pedido já trazem ${inc.shoyu} molhos shoyu e ${textoPares(inc.pares)}. Se precisar de mais, junte aqui.</p>` : "";
  const marcado = v => r.querWasabi === v ? "checked" : "";
  return `<fieldset class="grupo"><legend>Acompanhamentos</legend>
      ${lista ? jaTem + `<div id="acomp-lista">${lista}</div>` : ""}
      <div class="wasabi-pergunta" role="radiogroup" aria-labelledby="wasabi-titulo">
        <p id="wasabi-titulo">Gostaria de wasabi? <small>Sem custo</small></p>
        <label class="opcao"><input type="radio" name="querWasabi" value="sim" ${marcado("sim")}><span><strong>Sim, quero wasabi</strong></span></label>
        <label class="opcao"><input type="radio" name="querWasabi" value="nao" ${marcado("nao")}><span><strong>Não, obrigado</strong></span></label>
      </div>
    </fieldset>`;
}

const vFinalizarComExtras = VISTAS.finalizar;
VISTAS.finalizar = function () {
  const v = vFinalizarComExtras();
  v.corpo = v.corpo.replace(/<fieldset class="grupo"><legend>Acompanhamentos, sem custo<\/legend>[\s\S]*?<\/fieldset>/, blocoAcomp());
  v.corpo = v.corpo.replace(`placeholder="Alergias, sem wasabi, tocar à campainha…"`, `placeholder="Alergias, tocar à campainha…"`);
  return v;
};

const lerFinalizarSemWasabi = lerFinalizar;
lerFinalizar = function () {
  lerFinalizarSemWasabi();
  const r = S.rascunho; if (!r || S.vista !== "finalizar") return;
  const w = $('#folha-corpo [name="querWasabi"]:checked');
  if (w) r.querWasabi = w.value;
  r.wasabi = r.querWasabi === "sim";
  r.pauzinhos = "0"; r.soja = false; r.gengibre = false;
};

const validarSemWasabi = validarCheckout;
validarCheckout = function (r) {
  const v = validarSemWasabi(r);
  if (!r.querWasabi) v.erros.push("Diga se quer wasabi (é sem custo).");
  return v;
};

const corpoPedidoSemWasabi = corpoPedido;
corpoPedido = function (r, v) {
  const c = corpoPedidoSemWasabi(r, v);
  c.extras = { wasabi: r.querWasabi === "sim" };
  return c;
};

/* Mensagem do WhatsApp: os extras pagos já vão nos itens; aqui fica só o wasabi. */
acompanhamentos = function (r) { return r.querWasabi === "sim" ? "Wasabi: sim (sem custo)" : "Wasabi: não"; };

/** Volta a desenhar a lista de acompanhamentos e as contas, sem perder o que foi escrito. */
function redesenharAcomp(id, a) {
  const caixa = $("#acomp-lista");
  if (caixa) caixa.innerHTML = listaAcomp();
  sincronizar();
  const alvo = $(`#acomp-lista [data-a="${a}"][data-id="${CSS.escape(id)}"]`) || $(`#acomp-lista [data-a="acomp-mais"][data-id="${CSS.escape(id)}"]`);
  if (alvo) alvo.focus();
}

Object.assign(ACOES, {
  "acomp-mais"(b) { const id = b.dataset.id; if (!ITEM[id]) return; lerFinalizar(); setQtd(id, qtd(id) + 1); redesenharAcomp(id, "acomp-mais"); },
  "acomp-menos"(b) { const id = b.dataset.id; if (!ITEM[id]) return; lerFinalizar(); setQtd(id, qtd(id) - 1); redesenharAcomp(id, "acomp-menos"); }
});

/* ---------- gestão: categoria Acompanhamentos e wasabi no cartão do pedido ---------- */
const blocoCategoriaSemNota = blocoCategoria;
blocoCategoria = function (c, i) {
  const h = blocoCategoriaSemNota(c, i);
  if (!ehCatAcomp(c)) return h;
  return h.replace(/(<\/h3>)/, `$1<p class="nota" style="margin:0 0 .4rem">Estes produtos não aparecem no menu: o cliente escolhe-os no fim do pedido, em "Acompanhamentos", com o preço que puser aqui. Contam para o pedido mínimo.</p>`);
};

const vMenuSemAcomp = VISTAS["adm-menu"];
VISTAS["adm-menu"] = function () {
  const v = vMenuSemAcomp();
  if (!catAcomp()) v.corpo = `<div class="grupo"><h3>Acompanhamentos</h3><p class="nota" style="margin:0 0 .6rem">Crie a categoria "Acompanhamentos" para vender extras no fim do pedido (palitos, shoyu, molhos…). Já entram um par de palitos e um molho shoyu a 0,10 € cada, que pode mudar depois.</p>
      <button type="button" class="btn btn-sec" data-a="adm-acomp-criar">Criar categoria Acompanhamentos</button></div>` + v.corpo;
  return v;
};

ACOES["adm-acomp-criar"] = function () {
  if (catAcomp()) return brinde("A categoria Acompanhamentos já existe");
  adminAcao(async () => {
    const c = await api("/admin/categories", { method: "POST", auth: true, body: { name: NOME_CAT_ACOMP, description: "Extras escolhidos no fim do pedido.", layout: "list" } });
    for (const [nome, desc] of [["Par de palitos", "Um par de palitos (hashi)."], ["Molho shoyu", "Uma saqueta de molho shoyu."]]) {
      await api("/admin/products", { method: "POST", auth: true, body: { category_id: c.id, name: nome, description: desc, price: 0.10, min_qty: 1, active: true } });
    }
  }, "Categoria Acompanhamentos criada");
};

/** Linha do wasabi no cartão do pedido (só pedidos que trazem a escolha). */
const linhaWasabi = p => p.extras && typeof p.extras.wasabi === "boolean" ? `<p><strong>Wasabi:</strong> ${p.extras.wasabi ? "sim" : "não"}</p>` : "";
const cartaoSemWasabi = cartaoOperacao;
cartaoOperacao = function (p) {
  const h = cartaoSemWasabi(p), w = linhaWasabi(p);
  if (!w) return h;
  const i = h.indexOf("<p><strong>Total ") >= 0 ? h.indexOf("<p><strong>Total ") : h.indexOf("<p>Desconto de ");
  return i >= 0 ? h.slice(0, i) + w + h.slice(i) : h;
};

/* O menu pode ter sido desenhado antes deste ficheiro carregar. */
if (document.querySelector("#menu [data-ctl]")) { montarPagina(); atualizarPagina(); }

/* Ecrã "Pedido recebido": mostra a escolha do wasabi. */
const vEnviadoSemWasabi = VISTAS.enviado;
VISTAS.enviado = function () {
  const v = vEnviadoSemWasabi(), p = S.ultimo;
  if (p && /^Wasabi/.test(p.acomp || "")) v.corpo = v.corpo.replace("<p><strong>Total ", `<p><strong>Wasabi:</strong> ${/sim/.test(p.acomp) ? "sim" : "não"}</p><p><strong>Total `);
  return v;
};
