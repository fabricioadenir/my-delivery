/* ---------- modo de teste: fazer pedidos reais pelo site sem contar nas contas ----------
 * Gestão → Mais → Pedidos de teste → "Ligar modo de teste neste aparelho".
 * Com o modo ligado (e a sessão da gestão iniciada neste aparelho), o site mostra um aviso amarelo em baixo
 * e os pedidos feitos aqui seguem o caminho normal (checkout, ecrã final, acompanhamento, gestão,
 * notificação), mas vão marcados como teste: não gastam a numeração, não contam nas vendas,
 * relatórios, clientes, Raio-X nem stock, e não ocupam horas aos clientes.
 * Apagam-se na gestão: no cartão do pedido ou em Mais → Pedidos de teste.
 */
const testeAtivo = () => !!LS.get("modoTeste", false) && !!LS.get("token", null);

document.head.insertAdjacentHTML("beforeend", `<style>
#faixa-teste{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:15;width:max-content;max-width:calc(100% - 32px);display:flex;align-items:center;gap:.6rem;background:#FFD23F;color:#2B2100;font-weight:700;font-size:.9rem;line-height:1.25;padding:.4rem .4rem .4rem .9rem;border-radius:999px;box-shadow:0 4px 16px rgba(0,0,0,.25)}
#faixa-teste button{border:0;background:rgba(0,0,0,.14);color:inherit;font-weight:700;border-radius:999px;padding:.35rem .8rem;min-height:36px;white-space:nowrap}
.teste-nota{background:#FFD23F;color:#2B2100;border-radius:12px;padding:.6rem .8rem;font-weight:700;margin:0 0 .6rem}
.etiqueta.teste{background:#FFD23F;color:#2B2100}
.teste-estado{display:flex;align-items:center;gap:.6rem;font-weight:700}
.teste-estado i{width:.8rem;height:.8rem;border-radius:50%;background:var(--linha);display:inline-block}
.teste-estado.on i{background:#E0A800}
</style>`);

/** Mostra ou esconde a faixa "Modo de teste" no topo do site. */
function faixaTeste() {
  let f = document.getElementById("faixa-teste");
  if (!testeAtivo()) { if (f) f.remove(); return; }
  if (f) return;
  document.body.insertAdjacentHTML("beforeend", `<div id="faixa-teste" role="status"><span>Modo de teste: os pedidos daqui não contam</span><button type="button" data-a="teste-desligar">Desligar</button></div>`);
}

/* Pedido feito com o modo ligado: vai com a sessão da gestão e marcado como teste. */
const apiSemTeste = api;
api = async function (caminho, opcoes = {}) {
  if (caminho === "/orders" && opcoes.method === "POST" && testeAtivo()) {
    opcoes = Object.assign({}, opcoes, { auth: true, body: Object.assign({}, opcoes.body, { test: true }) });
  }
  return apiSemTeste(caminho, opcoes);
};

/* Ecrã final e lista "Os meus pedidos" lembram que foi um teste. */
const concluirSemTeste = concluirPedido;
concluirPedido = function (r, v, res) {
  concluirSemTeste(r, v, res);
  if (!res || !res.test) return;
  if (S.ultimo) S.ultimo.teste = true;
  if (S.pedidos[0]) { S.pedidos[0].teste = true; LS.set("pedidos", S.pedidos); }
  if (S.vista === "enviado") renderFolha();
};

const vEnviadoSemTeste = VISTAS.enviado;
VISTAS.enviado = function () {
  const v = vEnviadoSemTeste();
  if (S.ultimo && S.ultimo.teste) v.corpo = `<p class="teste-nota">Pedido de teste. Não conta nas vendas nem no stock. Apague-o na gestão, em Pedidos.</p>` + v.corpo;
  return v;
};

/* No checkout, por cima de "Fazer pedido". */
const vFinalizarSemTeste = VISTAS.finalizar;
VISTAS.finalizar = function () {
  const v = vFinalizarSemTeste();
  if (testeAtivo() && v.pe) v.pe = `<p class="teste-nota" style="text-align:center">Modo de teste: este pedido fica marcado como teste.</p>` + v.pe;
  return v;
};

/* ---------- gestão ---------- */
const pedidosTeste = () => (typeof pedidosLoja !== "undefined" && pedidosLoja ? pedidosLoja : []).filter(p => p.is_test);

/** Os testes não têm número real: aparece "N.º TESTE" no cartão, nos avisos e no talão. */
const marcarTeste = p => { if (p && p.is_test) p.number = "TESTE"; return p; };

const cartaoSemTeste = cartaoOperacao;
cartaoOperacao = function (p) {
  if (!p.is_test) return cartaoSemTeste(p);
  marcarTeste(p);
  let h = cartaoSemTeste(p);
  h = h.replace(`<span class="etiqueta">${ESTADOS[p.status]}</span>`, `<span class="etiqueta">${ESTADOS[p.status]}</span><span class="etiqueta teste">Pedido de teste</span>`);
  const botao = `<p style="margin-top:.6rem"><button type="button" class="btn btn-sec btn-bloco" data-a="teste-apagar" data-id="${esc(p.id)}">Apagar pedido de teste</button></p>`;
  return h.replace(/(<small style="color:var\(--tinta-2\)">Recebido em)/, botao + "$1");
};

const carregarInicioSemTeste = carregarInicio;
carregarInicio = async function (silencioso) {
  const r = await carregarInicioSemTeste(silencioso);
  (pedidosLoja || []).forEach(marcarTeste);
  return r;
};

/**
 * Ecrã Mais → Pedidos de teste.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vTeste() {
  const on = testeAtivo(), lista = pedidosTeste();
  const linha = p => `<div class="cartao"><div><strong>${esc(p.public_code || "")} · ${eur(+p.total)}</strong><span class="etiqueta">${ESTADOS[p.status] || p.status}</span>
      <small>${esc(p.customer_name)} · entrega ${p.asap ? "o mais cedo possível" : fmtData(p.deliver_at)} · feito ${fmtData(p.created_at)}</small></div>
      <div class="acoes"><button type="button" class="ligacao" data-a="teste-apagar" data-id="${esc(p.id)}">Apagar</button></div></div>`;
  return { titulo: "Pedidos de teste",
    corpo: VOLTAR.replace('data-a="abrir-admin">Voltar à loja', 'data-a="adm-mais">Voltar') + `<div class="grupo">
      <p class="teste-estado ${on ? "on" : ""}"><i aria-hidden="true"></i>Modo de teste neste aparelho: ${on ? "ligado" : "desligado"}</p>
      <p style="margin-top:.6rem">Com o modo ligado, faça um pedido no site como um cliente. Passa por tudo igual (checkout, horas ocupadas, ecrã final, acompanhamento, Pedidos, notificação), mas:</p>
      <ul style="margin:.4rem 0 0 1.2rem;line-height:1.5"><li>não gasta a numeração (aparece "N.º TESTE")</li><li>não conta nas vendas, resultados, clientes, relatórios nem no Raio-X</li><li>não desconta stock ao marcar como entregue</li><li>não tira horas de entrega aos clientes</li></ul>
      <p class="rx-nota">Só vale neste aparelho e com a sessão da gestão iniciada. Enquanto estiver ligado, o site mostra um aviso amarelo em baixo.</p>
      <div class="pilha" style="margin-top:.8rem">${on
        ? `<button type="button" class="btn btn-bloco" data-a="teste-site">Ir ao site fazer um pedido de teste</button><button type="button" class="btn btn-sec btn-bloco" data-a="teste-desligar">Desligar modo de teste</button>`
        : `<button type="button" class="btn btn-bloco" data-a="teste-ligar">Ligar modo de teste neste aparelho</button>`}</div></div>
      <h3 style="margin:1.2rem 0 .8rem">Pedidos de teste (${lista.length})</h3>
      ${lista.length ? lista.map(linha).join("") + `<p style="margin-top:.8rem"><button type="button" class="btn btn-sec btn-bloco" data-a="teste-apagar-todos">Apagar todos os pedidos de teste</button></p>`
        : `<p style="color:var(--tinta-2)">Não há pedidos de teste.</p>`}` };
}

/**
 * Apaga um pedido de teste (ou todos) e tira-o das listas deste aparelho.
 * @param {string|null} id Pedido a apagar; null apaga todos.
 */
async function apagarTeste(id) {
  const alvo = id ? pedidosLoja.find(p => p.id === id) : null;
  const pergunta = id ? `Apagar o pedido de teste ${alvo && alvo.public_code ? alvo.public_code : ""}?` : `Apagar os ${pedidosTeste().length} pedidos de teste?`;
  if (!confirm(pergunta)) return;
  try {
    const r = await api(id ? "/admin/test-orders/" + id : "/admin/test-orders", { method: "DELETE", auth: true });
    const fora = new Set(id ? [id] : pedidosTeste().map(p => p.id));
    pedidosLoja = pedidosLoja.filter(p => !fora.has(p.id));
    const antes = S.pedidos.length;
    S.pedidos = S.pedidos.filter(p => !fora.has(p.id));
    if (S.pedidos.length !== antes) LS.set("pedidos", S.pedidos);
    brinde(r && r.deleted > 1 ? r.deleted + " pedidos de teste apagados" : "Pedido de teste apagado");
    renderFolha();
  } catch (e) { erroGestao(e); }
}

VISTAS["adm-teste"] = vTeste;
Object.assign(ACOES, {
  "adm-teste"() { abrir("adm-teste"); },
  "teste-ligar"() { LS.set("modoTeste", true); faixaTeste(); renderFolha(); brinde("Modo de teste ligado neste aparelho"); },
  "teste-desligar"() {
    LS.del("modoTeste"); faixaTeste();
    if (S.vista) renderFolha();
    brinde("Modo de teste desligado");
  },
  "teste-site"() { fechar(); faixaTeste(); window.scrollTo({ top: 0, behavior: "smooth" }); },
  "teste-apagar"(b) { apagarTeste(b.dataset.id); },
  "teste-apagar-todos"() { apagarTeste(null); }
});

/* Sair da gestão desliga o modo de teste. */
const sairSemTeste = ACOES["adm-sair"];
ACOES["adm-sair"] = function (b) { LS.del("modoTeste"); const r = sairSemTeste(b); faixaTeste(); return r; };

const vMaisSemTeste = VISTAS["adm-mais"];
VISTAS["adm-mais"] = function () {
  const v = vMaisSemTeste(), n = pedidosTeste().length;
  const item = `<button type="button" class="btn btn-sec btn-bloco" data-a="adm-teste" style="justify-content:space-between;border-radius:16px"><span>Pedidos de teste</span><small style="font-weight:400;color:var(--tinta-2)">${testeAtivo() ? "Modo de teste ligado" : "Testar um pedido sem contar"}${n ? " · " + n + (n === 1 ? " teste" : " testes") : ""}</small></button>`;
  v.corpo = /data-a="adm-notif"[\s\S]*?<\/button>/.test(v.corpo)
    ? v.corpo.replace(/(data-a="adm-notif"[\s\S]*?<\/button>)/, "$1" + item)
    : v.corpo.replace(/(<button[^>]*data-a="fechar")/, item + "$1");
  return v;
};

if (typeof pedidosLoja !== "undefined" && pedidosLoja) pedidosLoja.forEach(marcarTeste);
faixaTeste();
if (S.vista && /^(admin|adm-pedidos|adm-mais)$/.test(S.vista)) renderFolha();
