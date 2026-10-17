/* ---------- acompanhamento do pedido pelo cliente, atualizado sozinho ---------- */
const PASSOS = ["received", "confirmed", "preparing", "ready", "out_for_delivery", "delivered"];
const FRASE = {
  received: "Recebemos o seu pedido. Falta só confirmarmos.", confirmed: "Pedido confirmado. Começamos a preparar em breve.",
  preparing: "Estamos a preparar o seu sushi.", ready: "Está pronto e vai sair para entrega.",
  out_for_delivery: "Vai a caminho da sua morada.", delivered: "Entregue. Bom apetite!",
  cancelled: "Este pedido foi cancelado. Se tiver dúvidas, fale connosco."
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEGUNDOS_VISTA = 20, SEGUNDOS_FAIXA = 60;
let rastos = {}, seguir = null, ultimaConsulta = 0;

document.head.insertAdjacentHTML("beforeend", `<style>
#faixa-pedido{display:flex;width:100%;align-items:center;justify-content:center;gap:.6rem;flex-wrap:wrap;border:0;background:var(--sakura);color:var(--sobre-sakura);padding:.7rem 1rem;font-weight:700;text-align:center;cursor:pointer}
#faixa-pedido[hidden]{display:none}
.so-leitor{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
#faixa-pedido u{text-underline-offset:3px}
.rasto-topo{text-align:center;padding:.4rem 0 1rem}
.rasto-topo .grande{font-family:var(--display);font-weight:800;font-size:1.7rem;line-height:1.15;color:var(--sakura)}
.rasto-topo p + p{margin-top:.4rem;color:var(--tinta-2)}
.rasto{list-style:none;margin:0;padding:0}
.rasto li{position:relative;padding:0 0 1.3rem 2.4rem;color:var(--tinta-2)}
.rasto li::before{content:"";position:absolute;left:.3rem;top:.15rem;width:1.1rem;height:1.1rem;border-radius:50%;border:2px solid var(--linha);background:var(--papel);box-sizing:border-box}
.rasto li::after{content:"";position:absolute;left:.8rem;top:1.35rem;bottom:.05rem;width:2px;background:var(--linha)}
.rasto li:last-child{padding-bottom:0}
.rasto li:last-child::after{display:none}
.rasto li.feito{color:var(--tinta)}
.rasto li.feito::before{background:var(--sakura);border-color:var(--sakura)}
.rasto li.feito::after{background:var(--sakura)}
.rasto li.atual{color:var(--tinta);font-weight:700}
.rasto li.atual::before{border-color:var(--sakura);border-width:4px;animation:pulsar 1.6s ease-in-out infinite}
@keyframes pulsar{50%{box-shadow:0 0 0 7px var(--sakura-claro)}}
@media (prefers-reduced-motion: reduce){.rasto li.atual::before{animation:none}}
</style>`);
$(".topo").insertAdjacentHTML("afterend", `<button type="button" id="faixa-pedido" data-a="acompanhar" hidden></button>`);

/**
 * Pergunta ao servidor o estado de pedidos e guarda a resposta.
 * @param {string[]} ids Identificadores dos pedidos.
 * @returns {Promise<object[]>} Pedidos encontrados.
 */
async function consultarPedidos(ids) {
  const lista = await apiSemIndicador("/orders/status", { method: "POST", body: { ids } });
  lista.forEach(o => { rastos[o.id] = o; estadosCliente[o.id] = o.status; });
  ultimaConsulta = Date.now();
  return lista;
}

/**
 * Diz se um pedido ainda está a decorrer.
 * @param {string} id Identificador do pedido.
 * @returns {boolean} Verdadeiro enquanto não for entregue nem cancelado.
 */
function emCurso(id) {
  const o = rastos[id];
  return !!o && o.status !== "delivered" && o.status !== "cancelled";
}

/**
 * Hora de entrega combinada, em texto simples.
 * @param {object} o Pedido devolvido pelo servidor.
 * @returns {string} Texto para mostrar, ou vazio.
 */
function textoEntrega(o) {
  if (o.asap || !o.deliver_at) return "Entrega logo que possível";
  const d = new Date(o.deliver_at), fuso = { timeZone: "Europe/Lisbon" };
  const dia = d.toLocaleDateString("pt-PT", Object.assign({ weekday: "long", day: "numeric", month: "long" }, fuso));
  return "Entrega pedida para " + dia + ", às " + d.toLocaleTimeString("pt-PT", Object.assign({ hour: "2-digit", minute: "2-digit" }, fuso));
}

/**
 * Lista dos passos do pedido, marcando os feitos e o atual.
 * @param {string} estado Estado atual do pedido.
 * @returns {string} HTML da lista.
 */
function passosHtml(estado) {
  const i = PASSOS.indexOf(estado);
  return `<ol class="rasto">${PASSOS.map((s, n) => {
    const tipo = n < i || estado === "delivered" ? "feito" : n === i ? "atual" : "";
    const nota = tipo === "feito" ? " (feito)" : tipo === "atual" ? " (agora)" : "";
    return `<li class="${tipo}"${tipo === "atual" ? ' aria-current="step"' : ""}>${ESTADOS[s]}<span class="so-leitor">${nota}</span></li>`;
  }).join("")}</ol>`;
}

/**
 * Vista de acompanhamento de um pedido.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vAcompanhar() {
  const o = rastos[seguir.id], zap = `<a class="btn btn-sec btn-bloco" href="https://wa.me/${esc(CONFIG.whatsapp)}" target="_blank" rel="noopener">Falar connosco no WhatsApp</a>`;
  const voltar = `<button type="button" class="ligacao" data-a="fechar">Voltar ao menu</button>`;
  if (!o) return { titulo: "Acompanhar pedido", corpo: `<div class="rasto-topo" role="status"><p>${seguir.falha ? "Não foi possível consultar o pedido. Verifique a ligação à internet." : seguir.visto ? "Não encontrámos este pedido." : "A procurar o seu pedido…"}</p></div>
    <div class="pilha">${seguir.visto || seguir.falha ? `<button type="button" class="btn btn-bloco" data-a="rasto-atualizar">Tentar de novo</button>` : ""}${zap}${voltar}</div>` };
  const hora = new Date(ultimaConsulta).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  return { titulo: "Pedido n.º " + o.number,
    corpo: `<div class="rasto-topo" role="status" aria-live="polite"><p class="grande">${ESTADOS[o.status]}</p><p>${FRASE[o.status]}</p>${o.status === "cancelled" || o.status === "delivered" ? "" : `<p>${esc(textoEntrega(o))}</p>`}</div>
      ${o.status === "cancelled" ? "" : `<div class="grupo">${passosHtml(o.status)}</div>`}
      <p class="nota" style="text-align:center;margin:0 0 1rem">${emCurso(o.id) ? "Esta página atualiza-se sozinha. " : ""}Visto às ${hora}.${seguir.falha ? " Sem ligação, a tentar de novo." : ""}</p>
      <div class="pilha">${emCurso(o.id) ? `<button type="button" class="btn btn-bloco" data-a="rasto-atualizar">Atualizar agora</button>` : ""}${zap}${voltar}</div>` };
}

/** Consulta o pedido aberto e redesenha a vista; avisa quando o estado muda. */
async function atualizarAcompanhar() {
  if (!seguir) return;
  const antes = rastos[seguir.id] && rastos[seguir.id].status;
  try { await consultarPedidos([seguir.id]); seguir.falha = false; } catch (e) { seguir.falha = true; }
  seguir.visto = true;
  const agoraE = rastos[seguir.id] && rastos[seguir.id].status;
  if (S.vista === "acompanhar") renderFolha();
  if (antes && agoraE && antes !== agoraE) { brinde("Pedido: " + ESTADOS[agoraE]); if (navigator.vibrate) navigator.vibrate(200); }
  mostrarFaixa();
}

/**
 * Pedidos recentes deste dispositivo que podem ainda estar a decorrer.
 * @returns {object[]} Pedidos com identificador, do mais recente para o mais antigo.
 */
function pedidosRecentes() {
  const dia = t => new Date(t).toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", year: "numeric" });
  const dias = [dia(Date.now()), dia(Date.now() - 86400000)];
  return S.pedidos.filter(p => p.id && dias.includes(p.data));
}

/**
 * Diz se há pedidos recentes cujo estado ainda pode mudar.
 * @returns {boolean} Verdadeiro se valer a pena perguntar ao servidor.
 */
function haPorSaber() { return pedidosRecentes().some(p => !rastos[p.id] || emCurso(p.id)); }

/** Mostra no topo do site o pedido em curso, se houver. */
function mostrarFaixa() {
  const p = pedidosRecentes().find(x => emCurso(x.id)), f = $("#faixa-pedido");
  f.hidden = !p;
  if (!p) return;
  f.dataset.id = p.id;
  f.innerHTML = `<span>Pedido n.º ${esc(p.num)}: ${ESTADOS[rastos[p.id].status]}</span><u>Acompanhar</u>`;
}

/** Atualiza o estado dos pedidos recentes para a faixa do topo. */
async function atualizarFaixa() {
  const ids = pedidosRecentes().map(p => p.id);
  if (!ids.length) return;
  try { await consultarPedidos(ids); } catch (e) { /* tenta de novo no próximo ciclo */ }
  mostrarFaixa();
}

const vEnviadoBase = VISTAS.enviado, vContaSemRasto = VISTAS.conta;
Object.assign(VISTAS, {
  acompanhar: vAcompanhar,
  enviado() {
    const v = vEnviadoBase(), id = S.pedidos[0] && S.pedidos[0].id;
    if (id) v.corpo += `<div class="grupo" style="margin-top:1rem"><h3>Acompanhe o pedido</h3><p style="color:var(--tinta-2);margin-bottom:.8rem">Veja aqui quando for confirmado, quando estiver a ser preparado e quando sair para entrega.</p><button type="button" class="btn btn-bloco" data-a="acompanhar" data-id="${esc(id)}">Acompanhar o pedido</button></div>`;
    return v;
  },
  conta() {
    const v = vContaSemRasto();
    S.pedidos.forEach((p, i) => { if (p.id) v.corpo = v.corpo.replace(`data-a="repetir" data-i="${i}">`, `data-a="acompanhar" data-id="${esc(p.id)}">Acompanhar</button><button type="button" class="ligacao" data-a="repetir" data-i="${i}">`); });
    return v;
  }
});

Object.assign(ACOES, {
  acompanhar(b) {
    seguir = { id: b.dataset.id, visto: !!rastos[b.dataset.id], falha: false };
    abrir("acompanhar");
    atualizarAcompanhar();
  },
  "rasto-atualizar"() { atualizarAcompanhar(); }
});

const contactosSemLigacao = contactosPedido;
/**
 * Ligações para falar com o cliente; o aviso do WhatsApp leva a ligação de acompanhamento.
 * @param {object} p Pedido.
 * @returns {string} HTML das ligações.
 */
contactosPedido = function (p) {
  const fim = encodeURIComponent(". " + CONFIG.nome), extra = encodeURIComponent("\nAcompanhe o pedido aqui: " + location.origin + "/?pedido=" + p.id);
  return p.status === "cancelled" ? contactosSemLigacao(p) : contactosSemLigacao(p).replace(fim + '"', fim + extra + '"');
};

const fecharSemFaixa = fechar;
/** Fecha a folha e atualiza a faixa do pedido em curso. */
fechar = function () { fecharSemFaixa(); if (haPorSaber()) atualizarFaixa(); };

let ciclos = 0;
setInterval(() => {
  ciclos += 1;
  if (document.hidden) return;
  if (S.vista === "acompanhar" && seguir && (!rastos[seguir.id] || emCurso(seguir.id))) return atualizarAcompanhar();
  if (!S.vista && ciclos % (SEGUNDOS_FAIXA / SEGUNDOS_VISTA) === 0 && haPorSaber()) atualizarFaixa();
}, SEGUNDOS_VISTA * 1000);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  if (S.vista === "acompanhar") atualizarAcompanhar(); else atualizarFaixa();
});

const pedidoNaLigacao = new URLSearchParams(location.search).get("pedido");
if (pedidoNaLigacao && UUID.test(pedidoNaLigacao)) ACOES.acompanhar({ dataset: { id: pedidoNaLigacao } });
else atualizarFaixa();
