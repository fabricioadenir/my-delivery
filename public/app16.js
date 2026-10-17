/* ---------- gestão em ecrã inteiro: navegação, sessão renovável, início e pedidos ---------- */
let inicio = null, filtroPedidos = "tratar", pedidosVistos = null;
const ATIVOS = ["received", "confirmed", "preparing", "ready", "out_for_delivery"];
const PROXIMO = { received: ["confirmed", "Confirmar pedido"], confirmed: ["preparing", "Começar a preparar"], preparing: ["ready", "Marcar como pronto"], ready: ["out_for_delivery", "Saiu para entrega"], out_for_delivery: ["delivered", "Marcar como entregue"] };
const AVISO_CLIENTE = { received: "recebemos o seu pedido", confirmed: "o seu pedido está confirmado", preparing: "o seu pedido está a ser preparado", ready: "o seu pedido está pronto", out_for_delivery: "o seu pedido saiu para entrega", delivered: "o seu pedido foi entregue. Bom apetite", cancelled: "o seu pedido foi cancelado" };
const SEPARADORES = [["hoje", "abrir-admin", "Hoje", "M4 11l8-7 8 7v9H4z"], ["pedidos", "adm-pedidos", "Pedidos", "M6 4h12v17l-3-2-3 2-3-2-3 2zM9 9h6M9 13h6"], ["menu", "adm-menu", "Menu", "M4 6h16M4 12h16M4 18h10"], ["stock", "adm-stock", "Stock", "M4 8l8-4 8 4v9l-8 4-8-4zM4 8l8 4 8-4M12 12v9"], ["mais", "adm-mais", "Mais", "M5 12h.01M12 12h.01M19 12h.01"]];
const GRUPOS = { admin: "hoje", "adm-pedidos": "pedidos", "adm-menu": "menu", "adm-produto": "menu", "adm-categoria": "menu", "adm-stock": "stock", "adm-stock-item": "stock", "adm-compra": "stock", "adm-fornecedores": "stock", "adm-fornecedor": "stock" };

document.head.insertAdjacentHTML("beforeend", `<style>
.folha.gestao{width:100%;animation:none}
.gestao .folha-corpo{width:min(860px,100%);margin-inline:auto;padding-bottom:6.5rem}
.gestao .folha-pe{margin-bottom:calc(58px + env(safe-area-inset-bottom,0px))}
#g-nav{position:fixed;left:0;right:0;bottom:0;z-index:32;display:flex;background:var(--papel);border-top:1px solid var(--linha);padding-bottom:env(safe-area-inset-bottom,0px)}
#g-nav button{flex:1;position:relative;border:0;background:none;padding:.5rem .2rem;font-weight:700;font-size:.78rem;color:var(--tinta-2);display:grid;justify-items:center;gap:.15rem;min-height:58px}
#g-nav button[aria-current="page"]{color:var(--sakura)}
#g-nav svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#g-nav b{position:absolute;top:.3rem;left:calc(50% + .4rem);background:var(--sakura);color:var(--sobre-sakura);border-radius:999px;min-width:1.3rem;padding:0 .3rem;font-size:.75rem}
.filtros{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem}
.filtros button{border:2px solid var(--linha);background:var(--papel);border-radius:999px;padding:.5rem .9rem;font-weight:700;min-height:44px}
.filtros button[aria-pressed="true"]{border-color:var(--sakura);color:var(--sakura)}
.progresso{height:.7rem;border-radius:999px;background:var(--linha);overflow:hidden;margin-top:.5rem}
.progresso i{display:block;height:100%;background:var(--alga)}
@media (min-width:900px){#g-nav{top:0;right:auto;width:210px;flex-direction:column;justify-content:flex-start;border-top:0;border-right:1px solid var(--linha);padding-top:5rem}
#g-nav button{flex:none;grid-auto-flow:column;justify-content:start;gap:.7rem;padding:.8rem 1.3rem;font-size:1rem}
#g-nav b{position:static}.folha.gestao{padding-left:210px}.gestao .folha-pe{margin-bottom:0}.gestao .folha-corpo{padding-bottom:2rem}}
</style>`);
document.body.insertAdjacentHTML("beforeend", `<nav id="g-nav" aria-label="Gestão" hidden>${SEPARADORES.map(s => `<button type="button" data-a="${s[1]}" data-g="${s[0]}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${s[3]}"/></svg><span>${s[2]}</span></button>`).join("")}</nav>`);

const apiSemRenovar = api;
/**
 * Chama o backend e, se a sessão tiver expirado, renova-a e repete o pedido uma vez.
 * @param {string} caminho Caminho depois de /api.
 * @param {object} opcoes Opções do pedido.
 * @returns {Promise<any>} Resposta do servidor.
 */
api = async function (caminho, opcoes = {}) {
  try { return await apiSemRenovar(caminho, opcoes); }
  catch (e) {
    const refresh = LS.get("refresh", null);
    if (e.status !== 401 || !opcoes.auth || !refresh) throw e;
    let s;
    try { s = await apiSemRenovar("/session/refresh", { method: "POST", body: { refresh_token: refresh } }); } catch (falha) { throw e; }
    LS.set("token", s.token); LS.set("refresh", s.refresh);
    return apiSemRenovar(caminho, opcoes);
  }
};

/** Ajusta a folha ao modo de gestão: ecrã inteiro, barra de navegação e ligações de voltar. */
function aplicarGestao() {
  const g = /^adm/.test(S.vista || "") && S.vista !== "adm-login", grupo = GRUPOS[S.vista] || "mais", volta = $('#folha-corpo [data-a="abrir-admin"]');
  $("#folha").classList.toggle("gestao", g); $("#g-nav").hidden = !g;
  if (!g) return;
  document.querySelectorAll("#g-nav button").forEach(b => { if (b.dataset.g === grupo) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  const novos = pedidosLoja.filter(p => p.status === "received").length;
  $('#g-nav [data-g="pedidos"] span').innerHTML = "Pedidos" + (novos ? ` <b>${novos}</b>` : "");
  if (!volta) return;
  if (["adm-produto", "adm-categoria"].includes(S.vista)) { volta.dataset.a = "adm-menu"; volta.textContent = "Voltar ao menu"; }
  else if (grupo === "mais" && S.vista !== "adm-mais") { volta.dataset.a = "adm-mais"; volta.textContent = "Voltar"; }
  else volta.closest("p").remove();
}
const renderSemGestao = renderFolha;
renderFolha = function () { renderSemGestao(); aplicarGestao(); };
const fecharSemGestao = fechar;
fechar = function () { fecharSemGestao(); $("#folha").classList.remove("gestao"); $("#g-nav").hidden = true; };

/**
 * Carrega o resumo do dia, do mês, os pedidos recentes e os avisos.
 * @param {boolean} silencioso Não mostra o indicador de carregamento.
 */
async function carregarInicio(silencioso) {
  const n = agora(), dia = d => n.y + "-" + doisD(n.m) + "-" + doisD(d);
  inicio = await (silencioso ? apiSemIndicador : api)("/admin/home?today=" + dia(n.d) + "&month_start=" + dia(1), { auth: true });
  pedidosLoja = inicio.orders || [];
  const recebidos = pedidosLoja.filter(p => p.status === "received").map(p => p.id), novo = pedidosVistos && recebidos.some(id => !pedidosVistos.has(id));
  pedidosVistos = new Set(recebidos);
  return novo;
}

/** Toca um aviso curto quando chega um pedido novo. */
function tocarAviso() {
  try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.frequency.value = 880; g.gain.value = 0.15; o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.35); }
  catch (e) { /* som indisponível neste dispositivo */ }
}

/**
 * Ligações rápidas para falar com o cliente e abrir a morada no mapa.
 * @param {object} p Pedido.
 * @returns {string} HTML das ligações.
 */
function contactosPedido(p) {
  const d = String(p.customer_phone).replace(/\D/g, ""), tel = d.length === 9 ? "351" + d : d;
  const msg = `Olá ${String(p.customer_name).split(" ")[0]}, ${AVISO_CLIENTE[p.status]} (n.º ${p.number}). ${CONFIG.nome}`;
  const mapa = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(p.address_street + ", " + p.address_locality);
  return `<p class="adm-acoes"><a class="ligacao" href="tel:${esc(p.customer_phone)}">Ligar</a><a class="ligacao" href="https://wa.me/${tel}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Avisar pelo WhatsApp</a><a class="ligacao" href="${esc(mapa)}" target="_blank" rel="noopener">Abrir no mapa</a></p>`;
}

/**
 * Cartão de um pedido para operar: contactos, itens, total e o passo seguinte.
 * @param {object} p Pedido vindo do backend.
 * @returns {string} HTML do cartão.
 */
function cartaoOperacao(p) {
  const itens = (p.order_items || []).map(i => i.quantity + "x " + esc(i.product_name)).join(", "), prox = PROXIMO[p.status];
  const custo = p.cost_total == null ? "" : `<p style="color:var(--tinta-2)">Custo de produção ${eur(+p.cost_total)}, sobram ${eur(p.subtotal - p.cost_total)} antes da entrega.</p>`;
  return `<div class="grupo"><h3>N.º ${p.number}<span class="etiqueta">${ESTADOS[p.status]}</span></h3>
    <p><strong>Entrega: ${p.asap ? "o mais cedo possível" : fmtData(p.deliver_at)}</strong></p>
    <p>${esc(p.customer_name)}, ${esc(p.customer_phone)}</p>${contactosPedido(p)}
    <p>${esc(p.address_street)}, ${esc(p.address_locality)} (${esc(p.zone_name)})${p.address_reference ? ". " + esc(p.address_reference) : ""}</p>
    <p>${itens}</p><p><strong>Total ${eur(+p.total)}</strong>. ${esc(p.payment_method || "Pagamento por indicar")}${p.change_for ? ", troco para " + eur(+p.change_for) : ""}</p>
    ${p.allergy_notes ? `<p class="aviso">${esc(p.allergy_notes)}</p>` : ""}${custo}
    ${prox ? `<p style="margin-top:.8rem"><button type="button" class="btn btn-bloco" data-a="pedido-avancar" data-id="${esc(p.id)}" data-s="${prox[0]}">${prox[1]}</button></p>` : ""}
    <label class="campo"><span>Mudar estado</span><select name="estadoPedido" data-id="${esc(p.id)}">${Object.keys(ESTADOS).map(k => `<option value="${k}" ${k === p.status ? "selected" : ""}>${ESTADOS[k]}</option>`).join("")}</select></label>
    <small style="color:var(--tinta-2)">Recebido em ${fmtData(p.created_at)}</small></div>`;
}

/**
 * Pedidos por tratar, pela ordem em que têm de sair.
 * @returns {object[]} Lista ordenada.
 */
function porTratar() {
  const hora = p => p.asap ? p.created_at : p.deliver_at;
  return pedidosLoja.filter(p => ATIVOS.includes(p.status)).sort((a, b) => String(hora(a)).localeCompare(String(hora(b))));
}

/**
 * Avisos do início: stock, validades, fichas em falta e definições por preencher.
 * @param {object} a Avisos vindos do backend.
 * @returns {string} HTML dos avisos.
 */
function avisosInicio(a) {
  const t = [];
  if (a.low_stock.length) t.push("Stock abaixo do mínimo: " + a.low_stock.map(i => esc(i.name) + " (" + fmtQtd(i.qty) + " " + esc(i.unit) + ")").join(", ") + ".");
  if (a.expiring.length) t.push("Validade a terminar: " + a.expiring.map(i => esc(i.name) + ", " + fmtDia(i.date)).join("; ") + ".");
  if (a.without_recipe) t.push("Produtos sem ficha técnica: " + a.without_recipe + ". Sem ficha, não há custo nem baixa de stock.");
  if (+a.cost_per_km === 0) t.push("O custo por km está a zero. Defina-o em Mais, Despesas e custos fixos.");
  if (!a.fixed_costs) t.push("Ainda não registou custos fixos.");
  return t.map(x => `<p class="aviso">${x}</p>`).join("");
}

/**
 * Ecrã inicial da gestão: o dia, o mês, a meta e o que há para tratar.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vInicio() {
  const h = inicio.today, m = inicio.month, meta = +inicio.alerts.profit_goal, lista = porTratar();
  const barra = meta > 0 ? `<p style="margin-top:.6rem">Meta do mês: ${eur(+m.result)} de ${eur(meta)}</p><div class="progresso" role="img" aria-label="Progresso da meta"><i style="width:${Math.max(0, Math.min(100, m.result / meta * 100))}%"></i></div>` : "";
  return { titulo: "Hoje",
    corpo: `<div class="grupo"><h3>${eur(+h.revenue)} em ${h.orders} ${h.orders === 1 ? "pedido" : "pedidos"} hoje</h3>
      <p>Este mês: ${eur(+m.revenue)} em ${m.orders} pedidos, resultado estimado de ${eur(+m.result)}.</p>${barra}</div>
      <h3 style="margin:1.2rem 0 .8rem">Por tratar (${lista.length})</h3>
      ${lista.map(cartaoOperacao).join("") || `<p style="color:var(--tinta-2);margin-bottom:1rem">Não há pedidos por tratar. Os pedidos novos aparecem aqui sozinhos.</p>`}${avisosInicio(inicio.alerts)}` };
}

/**
 * Lista de pedidos com filtros por situação.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vPedidos() {
  const grupos = { tratar: porTratar(), concluidos: pedidosLoja.filter(p => p.status === "delivered"), cancelados: pedidosLoja.filter(p => p.status === "cancelled") };
  const nomes = { tratar: "Por tratar", concluidos: "Entregues", cancelados: "Cancelados" };
  return { titulo: "Pedidos",
    corpo: `<div class="filtros">${Object.keys(nomes).map(k => `<button type="button" data-a="pedidos-filtro" data-f="${k}" aria-pressed="${k === filtroPedidos}">${nomes[k]} (${grupos[k].length})</button>`).join("")}</div>
      ${grupos[filtroPedidos].map(cartaoOperacao).join("") || `<p style="color:var(--tinta-2)">Nada aqui por agora.</p>`}<p style="color:var(--tinta-2)">Mostra os 50 pedidos mais recentes.</p>` };
}

/**
 * Muda o estado de um pedido no backend e atualiza o ecrã.
 * @param {string} id Identificador do pedido.
 * @param {string} estado Novo estado.
 */
async function mudarEstadoPedido(id, estado) {
  try {
    await api("/admin/orders/" + id, { method: "PATCH", auth: true, body: { status: estado } });
    const p = pedidosLoja.find(x => x.id === id);
    if (p) p.status = estado;
    brinde("N.º " + (p ? p.number : "") + ": " + ESTADOS[estado]); renderFolha();
  } catch (e) { erroGestao(e); }
}
/**
 * Muda o estado a partir do seletor do cartão.
 * @param {HTMLSelectElement} sel Seletor alterado.
 */
function mudarEstado(sel) { mudarEstadoPedido(sel.dataset.id, sel.value); }

/**
 * Entra na gestão com uma sessão que se renova sozinha.
 * @param {string} caminho Rota de autenticação pedida pelo formulário.
 */
async function autenticar(caminho) {
  const body = { email: campo("email").value.trim(), password: campo("senha").value };
  if (body.email.length < 5 || body.password.length < 6) return mostrarErros(["Escreva o email e uma palavra-passe com pelo menos 6 caracteres."]);
  try {
    let s = await api(caminho === "/auth/signup" ? caminho : "/session/login", { method: "POST", body });
    if (s.confirm) { semDono = false; renderFolha(); return mostrarErros(["Conta criada. Abra o email que recebeu, confirme o endereço e depois entre aqui."]); }
    if (!s.refresh) s = await api("/session/login", { method: "POST", body });
    if (!s.staff) return mostrarErros(["Esta conta não tem acesso à gestão."]);
    LS.set("token", s.token); LS.set("refresh", s.refresh);
    ACOES["abrir-admin"]();
  } catch (e) { mostrarErros([e.message]); }
}

Object.assign(VISTAS, { admin: vInicio, "adm-pedidos": vPedidos });
Object.assign(ACOES, {
  async "abrir-admin"() {
    if (LS.get("token", null)) {
      try { await carregarInicio(false); return abrir("admin"); } catch (e) { if (e.status !== 401 && e.status !== 403) return brinde(e.message); LS.del("token"); LS.del("refresh"); }
    }
    try { semDono = !(await api("/auth/status")).admin_exists; } catch (e) { semDono = false; }
    abrir("adm-login");
  },
  async "adm-pedidos"() { try { await carregarInicio(false); abrir("adm-pedidos"); } catch (e) { erroGestao(e); } },
  "pedidos-filtro"(b) { filtroPedidos = b.dataset.f; renderFolha(); },
  "pedido-avancar"(b) { mudarEstadoPedido(b.dataset.id, b.dataset.s); },
  "adm-sair"() { LS.del("token"); LS.del("refresh"); pedidosLoja = []; inicio = null; fechar(); carregarMenu(); }
});

setInterval(async () => {
  if (!["admin", "adm-pedidos"].includes(S.vista) || pedidosEmCurso > 0 || document.hidden) return;
  try { if (await carregarInicio(true)) { tocarAviso(); brinde("Chegou um pedido novo"); } if (["admin", "adm-pedidos"].includes(S.vista) && !document.activeElement.matches("select")) renderFolha(); }
  catch (e) { /* tenta de novo no próximo ciclo */ }
}, 45000);
