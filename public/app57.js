/* ---------- resultados: almoço x jantar no gráfico por dia ----------
 * Pedido do Fabricio (24/11): a loja abre ao almoço e ao jantar. Cada barra do gráfico passa a ter duas
 * cores (almoço em baixo, amarelo; jantar em cima, vermelho), com o valor de cada um dentro da sua parte
 * e o total em cima. Por baixo do gráfico, a legenda com o total do período de cada um.
 * Dados: dashboard → by_period (função vendas_por_turno, migração 20261124_vendas_por_turno.sql).
 * Almoço = entrega antes das 16:00. "O mais cedo possível" conta pela hora em que foi entregue.
 */
document.head.insertAdjacentHTML("beforeend", `<style>
:root{--gt-almoco:#F5B83D;--sobre-almoco:#1A2140;--gt-jantar:var(--sakura);--sobre-jantar:#fff}
:root[data-theme="dark"]{--gt-almoco:#F2C056;--sobre-almoco:#1A1405;--sobre-jantar:#2A0005}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--gt-almoco:#F2C056;--sobre-almoco:#1A1405;--sobre-jantar:#2A0005}}
.gd-col{flex:1 0 36px;min-width:36px}
.gt-pilha{width:78%;max-width:38px;display:flex;flex-direction:column;border-radius:4px 4px 0 0;overflow:hidden;opacity:.8}
.gd-col.top .gt-pilha{opacity:1}
.gt-seg{display:flex;align-items:center;justify-content:center;font-size:.62rem;font-weight:700;line-height:1;overflow:hidden}
.gt-seg.j{background:var(--gt-jantar);color:var(--sobre-jantar)}
.gt-seg.a{background:var(--gt-almoco);color:var(--sobre-almoco)}
.gt-zero{width:70%;max-width:34px;height:3px;background:var(--linha)}
.gt-leg{margin:.2rem 0 .5rem;font-size:.85rem;line-height:1.4}
.gt-leg span{display:block;margin:.15rem 0}
.gt-leg i{width:.8rem;height:.8rem;border-radius:3px;display:inline-block;vertical-align:-1px;margin-right:.4rem}
.gt-leg i.a{background:var(--gt-almoco)}.gt-leg i.j{background:var(--gt-jantar)}
</style>`);

const GT_ALT = 110; // altura máxima das barras (px)
const GT_MIN = 16;  // altura mínima de uma parte com valor, para o número caber lá dentro

/** Turnos do painel atual: { "AAAA-MM-DD": { almoco: {orders, revenue}, jantar: {…} } }. */
function gtPorDia() {
  const bp = painel.dados && painel.dados.by_period, m = {};
  ((bp && bp.por_dia) || []).forEach(x => {
    const dia = m[x.day] || (m[x.day] = { almoco: { orders: 0, revenue: 0 }, jantar: { orders: 0, revenue: 0 } });
    dia[x.periodo] = { orders: +x.orders, revenue: +x.revenue };
  });
  return m;
}

/** Junta almoço e jantar a cada dia (ou semana) da série do gráfico. */
const gtSerieBase = gdSerie;
gdSerie = function (dias) {
  const r = gtSerieBase(dias), m = gtPorDia();
  r.itens.forEach(x => { x.almoco = { orders: 0, revenue: 0 }; x.jantar = { orders: 0, revenue: 0 }; });
  const chave = iso => r.semanas ? gdSoma(iso, -((gdDow(iso) + 6) % 7)) : iso;
  const porDia = Object.fromEntries(r.itens.map(x => [x.day, x]));
  Object.keys(m).forEach(iso => {
    const alvo = porDia[chave(iso)]; if (!alvo) return;
    ["almoco", "jantar"].forEach(p => { alvo[p].orders += m[iso][p].orders; alvo[p].revenue += m[iso][p].revenue; });
  });
  return r;
};

/** Valor de um turno no modo do gráfico (pedidos ou vendas). */
const gtVal = t => gdModo === "pedidos" ? t.orders : t.revenue;

/** Número curto dentro de uma parte da barra (sem €, para caber). */
const gtDentro = v => gdModo === "pedidos" ? String(v) : String(Math.round(v));

/** Alturas das duas partes, proporcionais ao total, com mínimo para o número caber. */
function gtAlturas(x, max) {
  const a = gtVal(x.almoco), j = gtVal(x.jantar);
  const h = v => v > 0 ? Math.max(GT_MIN, Math.round(v / max * GT_ALT)) : 0;
  return { a, j, ha: h(a), hj: h(j) };
}

/** Texto de ajuda de cada coluna (ao tocar e manter). */
function gtTitulo(x, r) {
  const t = (n, p) => `${n}: ${p.orders} ${p.orders === 1 ? "pedido" : "pedidos"}, ${eur(p.revenue)}`;
  return `${r.titulo} — ${t("almoço", x.almoco)}; ${t("jantar", x.jantar)}`;
}

/** Colunas do gráfico com almoço (em baixo) e jantar (em cima). */
gdColunas = function (itens, rotulo, destaque) {
  const max = Math.max(...itens.map(x => gtVal(x.almoco) + gtVal(x.jantar)), gdModo === "pedidos" ? 1 : 0.01);
  return itens.map(x => {
    const r = rotulo(x), { a, j, ha, hj } = gtAlturas(x, max), tot = a + j;
    const barra = tot > 0
      ? `<div class="gt-pilha">${hj ? `<span class="gt-seg j" style="height:${hj}px">${gtDentro(j)}</span>` : ""}${ha ? `<span class="gt-seg a" style="height:${ha}px">${gtDentro(a)}</span>` : ""}</div>`
      : `<div class="gt-zero"></div>`;
    return `<div class="gd-col${tot ? "" : " zero"}${tot && destaque(x) ? " top" : ""}" title="${esc(gtTitulo(x, r))}">
      <span class="gd-val">${gdCurto(gdModo === "pedidos" ? tot : Math.round(tot))}</span>${barra}
      <span class="gd-rot"><b>${esc(r.cima)}</b>${esc(r.baixo)}</span></div>`;
  }).join("");
};

/** Totais do período por turno: { almoco: {orders, revenue}, jantar: {…} }. */
function gtTotais() {
  const m = gtPorDia(), t = { almoco: { orders: 0, revenue: 0 }, jantar: { orders: 0, revenue: 0 } };
  Object.values(m).forEach(d => ["almoco", "jantar"].forEach(p => { t[p].orders += d[p].orders; t[p].revenue += d[p].revenue; }));
  return t;
}

/** Legenda por baixo do gráfico, com o total e a % de cada turno. */
function gtLegenda() {
  const t = gtTotais(), soma = gtVal(t.almoco) + gtVal(t.jantar);
  if (!soma) return "";
  const um = (k, nome) => {
    const p = t[k], pct = Math.round(gtVal(p) / soma * 100);
    return `<span><i class="${k[0]}"></i><b>${nome}</b> · ${p.orders} ${p.orders === 1 ? "pedido" : "pedidos"} · ${eur(p.revenue)} (${pct} % ${gdModo === "pedidos" ? "dos pedidos" : "das vendas"})</span>`;
  };
  return `<div class="gt-leg" aria-label="Legenda">${um("almoco", "Almoço")}${um("jantar", "Jantar")}</div>`;
}

/** Gráfico por dia com legenda; deixa a marca onde acaba, para o bloco "Para planear" entrar a seguir. */
const gtGraficoBase = graficoDias;
graficoDias = function (dias) {
  const h = gtGraficoBase(dias), i = h.lastIndexOf(`<small style="color:var(--tinta-2)">`);
  const comLeg = i >= 0 && painel.dados && painel.dados.by_period ? h.slice(0, i) + gtLegenda() + h.slice(i) : h;
  return comLeg + "<!--gt-fim-->";
};
