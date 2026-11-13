/* ---------- estados do pedido: só Confirmado, Em preparação, Em entrega e Entregue ----------
 * Sai o passo "Pronto": de "Em preparação" passa-se direto a "Em entrega".
 * O pedido novo continua a entrar como "received" na base de dados, mas aparece como "Por confirmar"
 * (é a espera, não um passo). Na gestão, "Mudar estado" só oferece os 4 estados e "Cancelado".
 * Pedidos antigos em "Pronto" aparecem ao cliente como "Em preparação" e na gestão seguem para "Saiu para entrega".
 */
const ESTADOS_PEDIDO = ["confirmed", "preparing", "out_for_delivery", "delivered"];
ESTADOS.received = "Por confirmar";
PROXIMO.preparing = ["out_for_delivery", "Saiu para entrega"];
FRASE.received = "Recebemos o seu pedido. Vamos confirmá-lo em breve.";
PASSOS.splice(0, PASSOS.length, ...ESTADOS_PEDIDO);

/* Cliente: "Pronto" (pedidos antigos) conta como "Em preparação". */
const consultarComPronto = consultarPedidos;
consultarPedidos = async function (ids) {
  const lista = await consultarComPronto(ids);
  lista.forEach(o => { if (o.status === "ready") o.status = "preparing"; });
  Object.keys(rastos).forEach(id => { if (rastos[id].status === "ready") rastos[id].status = "preparing"; });
  Object.keys(estadosCliente).forEach(id => { if (estadosCliente[id] === "ready") estadosCliente[id] = "preparing"; });
  return lista;
};

/* Gestão: a lista "Mudar estado" só com os estados que se usam (mais o atual, se for outro). */
const cartaoComTodosEstados = cartaoOperacao;
cartaoOperacao = function (p) {
  const h = cartaoComTodosEstados(p);
  const lista = ESTADOS_PEDIDO.concat("cancelled");
  if (!lista.includes(p.status)) lista.unshift(p.status);
  const opcoes = lista.map(k => `<option value="${k}" ${k === p.status ? "selected" : ""}>${ESTADOS[k]}</option>`).join("");
  return h.replace(/(<select name="estadoPedido"[^>]*>)[\s\S]*?(<\/select>)/, `$1${opcoes}$2`);
};

if (S.vista && /^(admin|adm-pedidos|acompanhar)$/.test(S.vista)) renderFolha();
