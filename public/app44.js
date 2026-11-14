/* ---------- palitos com elástico ----------
 * Checkout: quando o pedido leva palitos (combinados ou "Par de palitos"), pergunta
 * "Quer os palitos com elástico?" (sem custo), obrigatória, como o wasabi. Gravado em extras.elastico.
 * Aparece no ecrã "Pedido recebido", no WhatsApp ("Palitos: com/sem elástico") e no cartão da gestão.
 */
document.head.insertAdjacentHTML("beforeend", `<style>
#elastico-caixa:empty{display:none}
#elastico-caixa .wasabi-pergunta{margin-top:1rem}
</style>`);

/** O pedido leva palitos? */
function levaPalitos() {
  if (incluidosNoCarrinho().pares > 0) return true;
  return S.cart.some(i => i.q > 0 && ITEM[i.id] && /palito/i.test(ITEM[i.id].nome) && produtosAcomp().some(p => p.id === i.id));
}

const novoRascunhoSemElastico = novoRascunho;
novoRascunho = function () { return Object.assign(novoRascunhoSemElastico(), { querElastico: "" }); };

/** Pergunta do elástico (vazia se o pedido não leva palitos). */
function perguntaElastico() {
  if (!levaPalitos()) return "";
  const r = S.rascunho || {}, m = v => r.querElastico === v ? "checked" : "";
  return `<div class="wasabi-pergunta" role="radiogroup" aria-labelledby="elastico-titulo">
      <p id="elastico-titulo">Quer os palitos com elástico? <small>Sem custo, mais fáceis de usar</small></p>
      <label class="opcao"><input type="radio" name="querElastico" value="sim" ${m("sim")}><span><strong>Sim, com elástico</strong></span></label>
      <label class="opcao"><input type="radio" name="querElastico" value="nao" ${m("nao")}><span><strong>Não, palitos normais</strong></span></label>
    </div>`;
}

const vFinalizarSemElastico = VISTAS.finalizar;
VISTAS.finalizar = function () {
  const v = vFinalizarSemElastico();
  v.corpo = v.corpo.replace(/(<div class="wasabi-pergunta" role="radiogroup" aria-labelledby="wasabi-titulo">[\s\S]*?<\/label>\s*<\/div>)/, `$1<div id="elastico-caixa">${perguntaElastico()}</div>`);
  return v;
};

/* Ao juntar/tirar palitos no checkout, a pergunta aparece ou desaparece. */
const redesenharAcompSemElastico = redesenharAcomp;
redesenharAcomp = function (id, a) {
  redesenharAcompSemElastico(id, a);
  const c = $("#elastico-caixa"); if (c) c.innerHTML = perguntaElastico();
};

const lerFinalizarSemElastico = lerFinalizar;
lerFinalizar = function () {
  lerFinalizarSemElastico();
  const r = S.rascunho; if (!r || S.vista !== "finalizar") return;
  const e = $('#folha-corpo [name="querElastico"]:checked');
  if (e) r.querElastico = e.value;
};

const validarSemElastico = validarCheckout;
validarCheckout = function (r) {
  const v = validarSemElastico(r);
  if (levaPalitos() && !r.querElastico) v.erros.push("Diga se quer os palitos com elástico (é sem custo).");
  return v;
};

const corpoPedidoSemElastico = corpoPedido;
corpoPedido = function (r, v) {
  const c = corpoPedidoSemElastico(r, v);
  if (levaPalitos() && r.querElastico) c.extras = Object.assign({}, c.extras, { elastico: r.querElastico === "sim" });
  return c;
};

/* WhatsApp e "Pedido recebido". */
const acompanhamentosSemElastico = acompanhamentos;
acompanhamentos = function (r) {
  const t = acompanhamentosSemElastico(r);
  return levaPalitos() && r.querElastico ? t + ", Palitos: " + (r.querElastico === "sim" ? "com elástico" : "sem elástico") : t;
};

const vEnviadoSemElastico = VISTAS.enviado;
VISTAS.enviado = function () {
  const v = vEnviadoSemElastico(), p = S.ultimo, m = p && /Palitos: (com|sem) elástico/.exec(p.acomp || "");
  if (m) v.corpo = v.corpo.replace("<p><strong>Total ", `<p><strong>Palitos:</strong> ${m[1]} elástico</p><p><strong>Total `);
  return v;
};

/* Gestão: linha no cartão do pedido. */
const cartaoSemElastico = cartaoOperacao;
cartaoOperacao = function (p) {
  const h = cartaoSemElastico(p);
  if (!p.extras || typeof p.extras.elastico !== "boolean") return h;
  const linha = `<p><strong>Palitos:</strong> ${p.extras.elastico ? "com elástico" : "sem elástico"}</p>`;
  const i = h.indexOf("<p><strong>Total ") >= 0 ? h.indexOf("<p><strong>Total ") : h.indexOf("<p>Desconto de ");
  return i >= 0 ? h.slice(0, i) + linha + h.slice(i) : h;
};

if (S.vista === "finalizar" || (S.vista && /^(admin|adm-pedidos)$/.test(S.vista))) renderFolha();
