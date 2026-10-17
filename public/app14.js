/* ---------- resultados: painel do período ---------- */
let painel = { tipo: "mes", de: "", ate: "", dados: null };
const PERIODOS = { hoje: "Hoje", ontem: "Ontem", "7dias": "Últimos 7 dias", mes: "Este mês", mesanterior: "Mês anterior", ano: "Este ano", personalizado: "Escolher datas" };

/**
 * Datas de início e fim de um período, na hora de Portugal.
 * @param {string} tipo Chave de PERIODOS.
 * @returns {string[]} Início e fim em AAAA-MM-DD.
 */
function datasPeriodo(tipo) {
  const n = agora(), dia = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10), hoje = dia(n.y, n.m, n.d);
  if (tipo === "personalizado") return [painel.de || hoje, painel.ate || hoje];
  if (tipo === "ontem") return [dia(n.y, n.m, n.d - 1), dia(n.y, n.m, n.d - 1)];
  if (tipo === "7dias") return [dia(n.y, n.m, n.d - 6), hoje];
  if (tipo === "mes") return [dia(n.y, n.m, 1), hoje];
  if (tipo === "mesanterior") return [dia(n.y, n.m - 1, 1), dia(n.y, n.m, 0)];
  if (tipo === "ano") return [dia(n.y, 1, 1), hoje];
  return [hoje, hoje];
}

/** Carrega do backend os resultados do período escolhido. */
async function carregarPainel() {
  const [de, ate] = datasPeriodo(painel.tipo);
  painel.de = de; painel.ate = ate;
  painel.dados = await api("/admin/dashboard?start=" + de + "&end=" + ate, { auth: true });
}

/**
 * Gráfico de barras das vendas por dia.
 * @param {object[]} dias Lista com day, revenue e orders.
 * @returns {string} SVG ou texto quando não há vendas.
 */
function graficoDias(dias) {
  if (!dias.length) return `<p style="color:var(--tinta-2)">Sem vendas neste período.</p>`;
  const max = Math.max(...dias.map(x => +x.revenue), 1), l = 16;
  const barras = dias.map((x, i) => { const a = Math.max(2, +x.revenue / max * 70); return `<rect x="${i * l + 3}" y="${75 - a}" width="${l - 6}" height="${a}" rx="2" fill="var(--sakura)"><title>${fmtDia(x.day)}: ${eur(+x.revenue)}, ${x.orders} pedidos</title></rect>`; }).join("");
  const melhor = dias.reduce((a, b) => +b.revenue > +a.revenue ? b : a);
  return `<svg viewBox="0 0 ${dias.length * l} 80" role="img" aria-label="Vendas por dia" style="width:100%;max-height:140px" preserveAspectRatio="none">${barras}</svg>
    <small style="color:var(--tinta-2)">De ${fmtDia(dias[0].day)} a ${fmtDia(dias[dias.length - 1].day)}. Melhor dia: ${fmtDia(melhor.day)}, com ${eur(+melhor.revenue)}.</small>`;
}

/**
 * Conta de resultados do período.
 * @param {object} d Dados do painel.
 * @returns {string} HTML da conta.
 */
function contaResultado(d) {
  const linha = (t, v, c) => `<div class="${c || ""}"><dt>${t}</dt><dd>${v}</dd></div>`, total = +d.revenue + +d.fees;
  return `<dl class="contas" style="margin:0">${linha("Vendas", eur(+d.revenue))}${linha("Taxas de entrega cobradas", eur(+d.fees))}
    ${linha("Custo de produção", "− " + eur(+d.production_cost))}${linha("Custo das entregas (" + d.routes + " rotas)", "− " + eur(+d.delivery_cost))}
    ${linha("Custos fixos do período", "− " + eur(+d.fixed_costs))}${linha("Outras despesas", "− " + eur(+d.expenses))}${linha("Perdas e desperdício", "− " + eur(+d.waste))}
    ${linha("Resultado estimado", eur(+d.result) + (total > 0 ? " (" + Math.round(d.result / total * 100) + " %)" : ""), "final")}</dl>`;
}

/**
 * Texto do ponto de equilíbrio e da meta de lucro.
 * @param {object} d Dados do painel.
 * @returns {string} HTML com as frases.
 */
function textoEquilibrio(d) {
  const m = +d.margin_per_order, fixos = +d.fixed_monthly, meta = +d.profit_goal;
  if (!d.orders) return `<p style="color:var(--tinta-2)">Ainda não há pedidos neste período para calcular a margem média por pedido.</p>`;
  if (m <= 0) return `<p class="aviso">Cada pedido está a dar prejuízo antes dos custos fixos (${eur(m)} em média). Reveja preços, fichas técnicas e taxas de entrega.</p>`;
  const pe = Math.ceil(fixos / m), alvo = Math.ceil((fixos + meta) / m);
  return `<p>Cada pedido deixa em média <strong>${eur(m)}</strong> depois da produção e da entrega.</p>
    <p>Para pagar os custos fixos de ${eur(fixos)} por mês precisa de <strong>${pe} pedidos por mês</strong>, cerca de ${Math.ceil(pe / 4.35)} por semana.</p>
    ${meta > 0 ? `<p>Para lucrar ${eur(meta)} por mês precisa de <strong>${alvo} pedidos por mês</strong>, cerca de ${Math.ceil(alvo / 4.35)} por semana.</p>` : `<p style="color:var(--tinta-2)">Defina uma meta de lucro em Despesas e custos fixos para ver quantos pedidos precisa.</p>`}`;
}

/**
 * Listas dos produtos, clientes e dias da semana que mais venderam.
 * @param {object} d Dados do painel.
 * @returns {string} HTML dos três grupos.
 */
function rankings(d) {
  const vazio = `<p style="color:var(--tinta-2)">Sem dados neste período.</p>`;
  const produtos = d.top_products.map(p => `<div class="cartao"><div><strong>${esc(p.name)}</strong><small>${p.quantity} vendidos, ${eur(+p.revenue)}${p.missing_cost ? ". Sem ficha técnica" : ", lucro " + eur(+p.profit)}</small></div></div>`).join("");
  const clientes = d.top_customers.map(c => `<div class="cartao"><div><strong>${esc(c.name)}</strong><small>${c.orders} pedidos, ${eur(+c.total)}</small></div></div>`).join("");
  const semana = d.by_weekday.map(w => `<div class="cartao"><div><strong>${DIAS[w.weekday][0].toUpperCase() + DIAS[w.weekday].slice(1)}</strong><small>${w.orders} pedidos, ${eur(+w.revenue)}${+d.revenue > 0 ? " (" + Math.round(w.revenue / d.revenue * 100) + " % das vendas)" : ""}</small></div></div>`).join("");
  return `<div class="grupo"><h3>Produtos mais vendidos</h3>${produtos || vazio}</div><div class="grupo"><h3>Melhores clientes</h3>${clientes || vazio}</div><div class="grupo"><h3>Dias da semana</h3>${semana || vazio}</div>`;
}

/**
 * Vista dos resultados do período.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vAdmPainel() {
  const d = painel.dados, ant = +d.previous.revenue, varia = ant > 0 ? Math.round((d.revenue - ant) / ant * 100) : null;
  const avisos = (d.orders_without_cost ? `<p class="aviso">Pedidos sem custo calculado: ${d.orders_without_cost}. Há produtos sem ficha técnica, por isso o resultado está acima do real.</p>` : "")
    + (+d.cost_per_km === 0 ? `<p class="aviso">O custo das entregas está a zero. Defina o custo por km em Despesas e custos fixos.</p>` : "");
  return { titulo: "Resultados",
    corpo: VOLTAR + `<div class="grupo"><label class="campo" style="margin-top:0"><span>Período</span><select name="periodo">${Object.keys(PERIODOS).map(k => `<option value="${k}" ${k === painel.tipo ? "selected" : ""}>${PERIODOS[k]}</option>`).join("")}</select></label>
      ${painel.tipo === "personalizado" ? `<div class="par"><label class="campo"><span>De</span><input type="date" name="de" value="${esc(painel.de)}" style="${CAMPO}"></label><label class="campo"><span>Até</span><input type="date" name="ate" value="${esc(painel.ate)}" style="${CAMPO}"></label></div><p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="painel-ver">Ver resultados</button></p>` : `<small style="color:var(--tinta-2)">De ${fmtDia(painel.de)} a ${fmtDia(painel.ate)}</small>`}</div>
      <div class="grupo"><h3>${eur(+d.revenue)} em vendas</h3><p>${d.orders} pedidos, ticket médio de ${eur(+d.ticket)}.</p>
        <p style="color:var(--tinta-2)">${varia === null ? "Sem vendas no período anterior para comparar." : (varia >= 0 ? "Mais " : "Menos ") + Math.abs(varia) + " % do que no período anterior (" + eur(ant) + ")."}</p>${graficoDias(d.by_day)}</div>
      ${avisos}<div class="grupo"><h3>Quanto sobrou</h3>${contaResultado(d)}</div>
      <div class="grupo"><h3>Ponto de equilíbrio</h3>${textoEquilibrio(d)}</div>${rankings(d)}` };
}
