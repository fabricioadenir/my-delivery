/* ---------- pedido feito só pelo site; WhatsApp passa a ser opcional ----------
 * O pedido fica registado ao tocar "Fazer pedido" (já era assim). O ecrã final diz que está recebido,
 * mostra o resumo e o acompanhamento; "Enviar também pelo WhatsApp" fica como opção.
 */
document.head.insertAdjacentHTML("beforeend", `<style>
.recebido-ok{display:flex;align-items:center;gap:.7rem;margin-bottom:.8rem}
.recebido-ok span{flex:none;width:44px;height:44px;border-radius:50%;background:var(--sakura);color:var(--sobre-petala,#fff);display:grid;place-items:center;font-size:1.5rem;font-weight:800}
.recebido-resumo p{margin:.25rem 0}
.zap-opcional{margin-top:1.2rem;text-align:center;color:var(--tinta-2);font-size:.92rem}
</style>`);

/* Checkout: botão principal "Fazer pedido". */
const vFinalizarSoSite = VISTAS.finalizar;
VISTAS.finalizar = function () {
  const v = vFinalizarSoSite();
  v.pe = v.pe.replace(/<button type="button" class="btn btn-zap btn-bloco" data-a="enviar">[^<]*<\/button>/,
    `<p class="nota" style="margin:0 0 .5rem;text-align:center">Paga na entrega. Confirmamos o pedido por mensagem.</p><button type="button" class="btn btn-bloco" data-a="enviar">Fazer pedido</button>`);
  return v;
};

/* Ecrã final: pedido recebido, sem obrigar ao WhatsApp. */
VISTAS.enviado = function () {
  const p = S.ultimo, id = S.pedidos[0] && S.pedidos[0].id, total = (+p.sub || 0) + (+p.taxa || 0);
  return { titulo: "Pedido recebido",
    corpo: `<div class="recebido-ok"><span aria-hidden="true">✓</span><p style="margin:0"><strong>Recebemos o seu pedido ${esc(p.num)}.</strong><br>Vamos confirmá-lo por mensagem para o ${esc(p.tel)}. Não precisa de fazer mais nada.</p></div>
      <div class="grupo recebido-resumo">
        <p><strong>Entrega:</strong> ${esc(p.quando)}</p>
        <p><strong>Morada:</strong> ${esc(p.morada.rua)}, ${esc(p.morada.localidade)}</p>
        <p>${p.itens.map(i => esc(i.q + "x " + i.nome)).join("<br>")}</p>
        <p><strong>Total ${eur(total)}</strong>${p.pag ? ", " + esc(p.pag) + " na entrega" : ""}</p></div>
      ${id ? `<div class="pilha" style="margin-top:1rem"><button type="button" class="btn btn-bloco" data-a="acompanhar" data-id="${esc(id)}">Acompanhar o pedido</button></div>` : ""}
      <div class="pilha" style="margin-top:.6rem"><button type="button" class="btn btn-sec btn-bloco" data-a="fechar">Voltar ao menu</button></div>
      <p class="zap-opcional">Prefere falar connosco? <a class="ligacao" href="${esc(p.url)}" target="_blank" rel="noopener" data-zap-pedido>Enviar também pelo WhatsApp</a> (opcional)</p>` };
};

/* O id do pedido só fica guardado depois de o ecrã final abrir: volta a desenhá-lo para mostrar "Acompanhar o pedido". */
const concluirSemAcompanhar = concluirPedido;
concluirPedido = function (r, v, res) {
  concluirSemAcompanhar(r, v, res);
  if (S.vista === "enviado") renderFolha();
};
