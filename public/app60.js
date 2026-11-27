/* ---------- gengibre (27/11) ----------
 * Checkout: por baixo do wasabi, "Gostaria de gengibre?" (sem custo), obrigatória, como o wasabi.
 * Gravado em extras.gengibre. Aparece no ecrã "Pedido recebido", no WhatsApp ("Gengibre: sim (sem custo)"),
 * no cartão da gestão, no talão, no Raio-X do checkout e nos Gostos da ficha do cliente.
 * Pedidos antigos (antes de 13/11) tinham extras.gengibre marcado por defeito junto com "pauzinhos": esses não contam.
 */

/** Pedido com a resposta nova do gengibre (não os antigos com pauzinhos/soja). */
const temGengibre = ex => !!ex && typeof ex.gengibre === "boolean" && !("pauzinhos" in ex);

const novoRascunhoSemGengibre = novoRascunho;
novoRascunho = function () { return Object.assign(novoRascunhoSemGengibre(), { querGengibre: "" }); };

function perguntaGengibre() {
  const r = S.rascunho || {}, m = v => r.querGengibre === v ? "checked" : "";
  return `<div class="wasabi-pergunta" role="radiogroup" aria-labelledby="gengibre-titulo">
      <p id="gengibre-titulo">Gostaria de gengibre? <small>Sem custo</small></p>
      <label class="opcao"><input type="radio" name="querGengibre" value="sim" ${m("sim")}><span><strong>Sim, quero gengibre</strong></span></label>
      <label class="opcao"><input type="radio" name="querGengibre" value="nao" ${m("nao")}><span><strong>Não, obrigado</strong></span></label>
    </div>`;
}

const vFinalizarSemGengibre = VISTAS.finalizar;
VISTAS.finalizar = function () {
  const v = vFinalizarSemGengibre();
  v.corpo = v.corpo.replace(/(<div class="wasabi-pergunta" role="radiogroup" aria-labelledby="wasabi-titulo">[\s\S]*?<\/label>\s*<\/div>)/, `$1${perguntaGengibre()}`);
  return v;
};

const lerFinalizarSemGengibre = lerFinalizar;
lerFinalizar = function () {
  lerFinalizarSemGengibre();
  const r = S.rascunho; if (!r || S.vista !== "finalizar") return;
  const g = $('#folha-corpo [name="querGengibre"]:checked');
  if (g) r.querGengibre = g.value;
  r.gengibre = r.querGengibre === "sim";
};

const validarSemGengibre = validarCheckout;
validarCheckout = function (r) {
  const v = validarSemGengibre(r);
  if (!r.querGengibre) {
    const i = v.erros.findIndex(e => /wasabi/i.test(e));
    v.erros.splice(i >= 0 ? i + 1 : v.erros.length, 0, "Diga se quer gengibre (é sem custo).");
  }
  return v;
};

const corpoPedidoSemGengibre = corpoPedido;
corpoPedido = function (r, v) {
  const c = corpoPedidoSemGengibre(r, v);
  if (r.querGengibre) c.extras = Object.assign({}, c.extras, { gengibre: r.querGengibre === "sim" });
  return c;
};

/* WhatsApp: "Wasabi: sim (sem custo), Gengibre: não, Palitos: com elástico". */
const acompanhamentosSemGengibre = acompanhamentos;
acompanhamentos = function (r) {
  const t = acompanhamentosSemGengibre(r);
  if (!r.querGengibre) return t;
  const g = "Gengibre: " + (r.querGengibre === "sim" ? "sim (sem custo)" : "não");
  return /^Wasabi: (sim \(sem custo\)|não)/.test(t) ? t.replace(/^Wasabi: (sim \(sem custo\)|não)/, "$&, " + g) : t + ", " + g;
};

/* "Pedido recebido": a linha do wasabi (app38) procura "sim" em todo o texto; tira-se o gengibre antes
   para não a enganar e junta-se a linha do gengibre a seguir. */
const vEnviadoSemGengibre = VISTAS.enviado;
VISTAS.enviado = function () {
  const p = S.ultimo, orig = p && p.acomp, m = orig ? /, Gengibre: (sim|não)( \(sem custo\))?/.exec(orig) : null;
  let v;
  if (m) p.acomp = orig.replace(m[0], "");
  try { v = vEnviadoSemGengibre(); } finally { if (m) p.acomp = orig; }
  if (m) {
    const linha = `<p><strong>Gengibre:</strong> ${m[1]}</p>`;
    v.corpo = /<p><strong>Palitos:<\/strong>/.test(v.corpo)
      ? v.corpo.replace("<p><strong>Palitos:</strong>", linha + "<p><strong>Palitos:</strong>")
      : v.corpo.replace("<p><strong>Total ", linha + "<p><strong>Total ");
  }
  return v;
};

/* Gestão: linha no cartão do pedido, logo a seguir ao wasabi. */
const cartaoSemGengibre = cartaoOperacao;
cartaoOperacao = function (p) {
  const h = cartaoSemGengibre(p);
  if (!temGengibre(p.extras)) return h;
  const linha = `<p><strong>Gengibre:</strong> ${p.extras.gengibre ? "sim" : "não"}</p>`;
  const w = h.match(/<p><strong>Wasabi:<\/strong> (sim|não)<\/p>/);
  if (w) return h.replace(w[0], w[0] + linha);
  const i = h.indexOf("<p><strong>Total ") >= 0 ? h.indexOf("<p><strong>Total ") : h.indexOf("<p>Desconto de ");
  return i >= 0 ? h.slice(0, i) + linha + h.slice(i) : h;
};

/* Talão (A4 e térmica): a linha do gengibre está em app46.js e app47.js. */
