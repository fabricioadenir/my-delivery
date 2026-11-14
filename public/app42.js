/* ---------- troco a levar ----------
 * Gestão → cartão do pedido: quando o cliente paga em numerário e diz "troco para X",
 * mostra logo quanto troco levar (X − total). Ex.: total 79,46 €, troco para 80,00 € → levar 0,54 €.
 */

/** Linha com o troco a levar (vazia se não houver "troco para"). */
function linhaTroco(p) {
  if (!p.change_for || !/^(Numerário|Dinheiro)$/.test(p.payment_method || "")) return "";
  const centimos = Math.round(+p.change_for * 100) - Math.round(+p.total * 100);
  if (centimos > 0) return `<p><strong>Troco a levar: ${eur(centimos / 100)}</strong></p>`;
  if (centimos === 0) return `<p><strong>Valor certo, não precisa de troco.</strong></p>`;
  return `<p class="aviso">O cliente indicou ${eur(+p.change_for)}, menos do que o total. Confirmar com o cliente.</p>`;
}

const cartaoSemTroco = cartaoOperacao;
cartaoOperacao = function (p) {
  const h = cartaoSemTroco(p), t = linhaTroco(p);
  if (!t) return h;
  const marca = ", troco para " + eur(+p.change_for) + "</p>";
  const i = h.indexOf(marca);
  return i >= 0 ? h.slice(0, i + marca.length) + t + h.slice(i + marca.length) : h;
};

if (S.vista && /^(admin|adm-pedidos)$/.test(S.vista)) renderFolha();
