/* ---------- ordenar os pedidos (Hoje e Pedidos) ----------
 * Por defeito, o pedido mais novo (recebido há menos tempo) fica em cima.
 * Botões "Ordenar": Mais novos · Mais antigos · Hora de entrega. A escolha fica guardada neste aparelho.
 */
const ORDENS_PEDIDOS = { novos: "Mais novos", antigos: "Mais antigos", entrega: "Hora de entrega" };
let ordemPedidos = ORDENS_PEDIDOS[LS.get("ordemPedidos", "")] ? LS.get("ordemPedidos", "") : "novos";

/** Ordena uma lista de pedidos pela ordem escolhida (devolve uma cópia). */
function ordenarPedidos(lista) {
  const recebido = p => String(p.created_at || "");
  const entrega = p => String((p.asap ? p.created_at : p.deliver_at) || "");
  const c = lista.slice();
  if (ordemPedidos === "entrega") return c.sort((a, b) => entrega(a).localeCompare(entrega(b)) || recebido(a).localeCompare(recebido(b)));
  if (ordemPedidos === "antigos") return c.sort((a, b) => recebido(a).localeCompare(recebido(b)));
  return c.sort((a, b) => recebido(b).localeCompare(recebido(a)));
}

/** Botões para escolher a ordem. */
const botoesOrdem = () => `<div class="filtros" style="margin-bottom:.8rem"><span style="align-self:center;color:var(--tinta-2);margin-right:.2rem">Ordenar:</span>${Object.keys(ORDENS_PEDIDOS).map(k => `<button type="button" data-a="pedidos-ordem" data-o="${k}" aria-pressed="${k === ordemPedidos}">${ORDENS_PEDIDOS[k]}</button>`).join("")}</div>`;

/* Por tratar e as listas de Entregues/Cancelados seguem a ordem escolhida. */
porTratar = function () { return ordenarPedidos(pedidosLoja.filter(p => ATIVOS.includes(p.status))); };
const carregarInicioSemOrdem = carregarInicio;
carregarInicio = async function (silencioso) {
  const r = await carregarInicioSemOrdem(silencioso);
  pedidosLoja = ordenarPedidos(pedidosLoja);
  return r;
};

/* Hoje: botões por baixo de "Por tratar (n)". */
const vHojeSemOrdem = VISTAS.admin;
VISTAS.admin = function () {
  const v = vHojeSemOrdem();
  v.corpo = v.corpo.replace(/(<h3 style="margin:1\.2rem 0 \.8rem">Por tratar \(\d+\)<\/h3>)/, "$1" + botoesOrdem());
  return v;
};

/* Pedidos: botões por baixo dos filtros. */
const vPedidosSemOrdem = VISTAS["adm-pedidos"];
VISTAS["adm-pedidos"] = function () {
  const v = vPedidosSemOrdem();
  v.corpo = v.corpo.replace(/(<div class="filtros">[\s\S]*?<\/div>)/, "$1" + botoesOrdem());
  return v;
};

ACOES["pedidos-ordem"] = function (b) {
  ordemPedidos = b.dataset.o; LS.set("ordemPedidos", ordemPedidos);
  if (typeof pedidosLoja !== "undefined" && pedidosLoja) pedidosLoja = ordenarPedidos(pedidosLoja);
  renderFolha();
};

if (typeof pedidosLoja !== "undefined" && pedidosLoja) pedidosLoja = ordenarPedidos(pedidosLoja);
if (S.vista && /^(admin|adm-pedidos)$/.test(S.vista)) renderFolha();
