/* ---------- resultados: pedidos por dia e dias da semana mais movimentados ----------
 * Pedido do Fabricio (21/11): no gráfico dos Resultados queria ver os pedidos de cada dia, para saber
 * quais os dias com mais movimento no período escolhido.
 * - Gráfico com abas "Pedidos" (por defeito) e "Vendas"; cada barra mostra o número em cima e o dia por baixo
 *   (dia da semana + dia do mês). Os dias sem pedidos aparecem a 0 (antes desapareciam do gráfico).
 *   Começa no 1.º dia com pedidos do período. Com muitos dias desliza para o lado e abre no fim (dias mais
 *   recentes). Acima de 62 dias agrupa por semana.
 * - O dia com mais pedidos fica destacado e aparece na frase por baixo.
 * - "Dias da semana" passa a gráfico de segunda a domingo, com a média de pedidos por cada um desses dias
 *   no período (um mês tem 4 ou 5 sábados), e diz qual é o mais movimentado.
 */
document.head.insertAdjacentHTML("beforeend", `<style>
.gd-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:.6rem 0 .3rem;padding-bottom:.2rem}
.gd-barras{display:flex;align-items:flex-end;gap:4px;min-width:100%}
.gd-col{flex:1 0 30px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;min-width:30px}
.gd-val{font-size:.72rem;font-weight:700;color:var(--tinta);margin-bottom:2px;white-space:nowrap}
.gd-barra{width:70%;max-width:34px;background:var(--sakura);border-radius:4px 4px 0 0;opacity:.55}
.gd-col.top .gd-barra{opacity:1}
.gd-col.zero .gd-barra{background:var(--linha);opacity:1}
.gd-col.zero .gd-val{color:var(--tinta-2);font-weight:400}
.gd-rot{font-size:.68rem;color:var(--tinta-2);line-height:1.15;text-align:center;margin-top:3px;white-space:nowrap}
.gd-rot b{display:block;color:var(--tinta);font-weight:600}
.gd-col.top .gd-rot b{color:var(--sakura)}
.gd-sem .gd-col{flex:1 1 0;min-width:0}
.rx-abas.gd-abas{position:static;margin:.9rem 0 .2rem;padding:0;background:none;border:0}
</style>`);

let gdModo = LS.get("gdModo", "pedidos");
const GD_ALT = 90; // altura máxima das barras (px), o resto da coluna é para o número e o dia
const GD_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Dia ISO (AAAA-MM-DD) + n dias. */
const gdSoma = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const gdDow = iso => new Date(iso + "T00:00:00Z").getUTCDay();

/** Valor curto para pôr em cima da barra (vendas: 189 € / 1,2 mil €). */
function gdCurto(v) {
  if (gdModo === "pedidos") return String(v);
  return v >= 1000 ? (v / 1000).toLocaleString("pt-PT", { maximumFractionDigits: 1 }) + " mil €" : Math.round(v) + " €";
}

/** Todos os dias do período (também os sem pedidos), ou semanas quando o período é longo. */
function gdSerie(dias) {
  const por = Object.fromEntries(dias.map(x => [x.day, x]));
  let de = painel.de || (dias[0] && dias[0].day), ate = painel.ate || (dias.length && dias[dias.length - 1].day);
  if (!de || !ate) return { semanas: false, itens: [] };
  const total = Math.round((Date.parse(ate) - Date.parse(de)) / 864e5) + 1;
  const itens = [];
  for (let i = 0; i < total; i++) {
    const d = gdSoma(de, i), x = por[d];
    itens.push({ day: d, orders: x ? +x.orders : 0, revenue: x ? +x.revenue : 0 });
  }
  // dias antes do primeiro pedido do período não interessam (ex.: "Este mês" quando a loja abriu a meio)
  const primeiro = itens.findIndex(x => x.orders > 0);
  if (primeiro > 0) itens.splice(0, primeiro);
  if (itens.length <= 62) return { semanas: false, itens };
  const sem = [];
  itens.forEach(x => {
    const seg = gdSoma(x.day, -((gdDow(x.day) + 6) % 7));
    const ult = sem[sem.length - 1];
    if (ult && ult.day === seg) { ult.orders += x.orders; ult.revenue += x.revenue; }
    else sem.push({ day: seg, orders: x.orders, revenue: x.revenue });
  });
  return { semanas: true, itens: sem };
}

/** Abas Pedidos / Vendas. */
function gdAbas() {
  return `<div class="rx-abas gd-abas" role="tablist" aria-label="Mostrar no gráfico">${[["pedidos", "Pedidos"], ["vendas", "Vendas"]].map(([k, t]) =>
    `<button type="button" role="tab" aria-selected="${gdModo === k}" data-a="gd-modo" data-m="${k}">${t}</button>`).join("")}</div>`;
}

/** Colunas do gráfico. */
function gdColunas(itens, rotulo, destaque) {
  const val = x => gdModo === "pedidos" ? x.orders : x.revenue;
  const max = Math.max(...itens.map(val), gdModo === "pedidos" ? 1 : 0.01);
  return itens.map(x => {
    const v = val(x), alt = v > 0 ? Math.max(4, Math.round(v / max * GD_ALT)) : 3, r = rotulo(x);
    return `<div class="gd-col${v ? "" : " zero"}${v && destaque(x) ? " top" : ""}" title="${esc(r.titulo)}: ${x.orders} ${x.orders === 1 ? "pedido" : "pedidos"}, ${eur(x.revenue)}">
      <span class="gd-val">${gdCurto(gdModo === "pedidos" ? v : Math.round(v))}</span>
      <div class="gd-barra" style="height:${alt}px"></div>
      <span class="gd-rot"><b>${esc(r.cima)}</b>${esc(r.baixo)}</span></div>`;
  }).join("");
}

/** Gráfico dos pedidos (ou vendas) por dia do período. */
graficoDias = function (dias) {
  const { semanas, itens } = gdSerie(dias || []);
  if (!itens.length || !itens.some(x => x.orders)) return gdAbas() + `<p style="color:var(--tinta-2)">Sem pedidos neste período.</p>`;
  const chave = x => gdModo === "pedidos" ? x.orders : x.revenue;
  const maxV = Math.max(...itens.map(chave));
  const melhor = itens.filter(x => chave(x) === maxV);
  const rot = x => semanas
    ? { cima: x.day.slice(8, 10) + "/" + x.day.slice(5, 7), baixo: "sem.", titulo: "Semana de " + fmtDia(x.day) }
    : { cima: GD_CURTO[gdDow(x.day)], baixo: x.day.slice(8, 10), titulo: DIAS[gdDow(x.day)] + " " + fmtDia(x.day) };
  const nome = x => semanas ? "semana de " + fmtDia(x.day) : DIAS[gdDow(x.day)] + " " + fmtDia(x.day);
  const comPedido = itens.filter(x => x.orders), totalP = itens.reduce((s, x) => s + x.orders, 0);
  const media = totalP / comPedido.length;
  const qual = gdModo === "pedidos"
    ? `${semanas ? "Semana" : "Dia"} com mais pedidos: <strong>${melhor.map(nome).join(", ")}</strong>, com ${maxV} ${maxV === 1 ? "pedido" : "pedidos"}.`
    : `${semanas ? "Semana" : "Dia"} com mais vendas: <strong>${melhor.map(nome).join(", ")}</strong>, com ${eur(maxV)}.`;
  const mediaV = itens.reduce((s, x) => s + x.revenue, 0) / comPedido.length;
  const extra = semanas ? "" : gdModo === "pedidos"
    ? ` Nos dias com pedidos, a média foi de ${media.toLocaleString("pt-PT", { maximumFractionDigits: 1 })} ${media === 1 ? "pedido" : "pedidos"} por dia.`
    : ` Nos dias com pedidos, a média foi de ${eur(mediaV)} por dia.`;
  return gdAbas() + `<div class="gd-scroll" data-gd-fim><div class="gd-barras" role="img" aria-label="${gdModo === "pedidos" ? "Pedidos" : "Vendas"} por ${semanas ? "semana" : "dia"}">${gdColunas(itens, rot, x => chave(x) === maxV)}</div></div>
    <small style="color:var(--tinta-2)">${qual}${extra}</small>`;
};

/** Dias da semana: gráfico de segunda a domingo com a média de pedidos por cada dia desses no período. */
function gdSemana(d) {
  const ws = Object.fromEntries((d.by_weekday || []).map(w => [w.weekday, w]));
  if (!Object.keys(ws).length || !painel.de || !painel.ate) return "";
  // conta quantas segundas, terças… houve desde o 1.º dia com pedidos do período (a loja pode ter aberto a meio)
  const primeiro = (d.by_day || []).filter(x => +x.orders > 0).map(x => x.day).sort()[0];
  const inicio = primeiro && primeiro > painel.de ? primeiro : painel.de;
  const vezes = [0, 0, 0, 0, 0, 0, 0];
  for (let x = inicio; x <= painel.ate; x = gdSoma(x, 1)) vezes[gdDow(x)]++;
  const itens = [1, 2, 3, 4, 5, 6, 0].map(w => {
    const o = ws[w] ? +ws[w].orders : 0, v = ws[w] ? +ws[w].revenue : 0, n = Math.max(vezes[w], 1);
    return { w, orders: o, revenue: v, media: o / n, mediaV: v / n, vezes: vezes[w] };
  });
  const chave = x => gdModo === "pedidos" ? x.media : x.mediaV;
  const max = Math.max(...itens.map(chave));
  const fmt1 = n => n.toLocaleString("pt-PT", { maximumFractionDigits: 1 });
  const cols = itens.map(x => {
    const v = chave(x), alt = v > 0 ? Math.max(4, Math.round(v / (max || 1) * GD_ALT)) : 3;
    const top = v > 0 && v === max;
    return `<div class="gd-col${v ? "" : " zero"}${top ? " top" : ""}" title="${DIAS[x.w]}: ${x.orders} ${x.orders === 1 ? "pedido" : "pedidos"} em ${x.vezes} ${DIAS[x.w]}${x.vezes === 1 ? "" : "s"}, ${eur(x.revenue)}">
      <span class="gd-val">${gdModo === "pedidos" ? fmt1(x.media) : Math.round(x.mediaV) + " €"}</span>
      <div class="gd-barra" style="height:${alt}px"></div>
      <span class="gd-rot"><b>${GD_CURTO[x.w]}</b>${x.orders} ped.</span></div>`;
  }).join("");
  const melhores = itens.filter(x => chave(x) === max && max > 0);
  const tot = +d.revenue || 0;
  const frase = melhores.length ? `Mais movimentado: <strong>${melhores.map(x => DIAS[x.w]).join(", ")}</strong> — ${melhores.map(x => `${fmt1(x.media)} pedidos em média (${x.orders} em ${x.vezes} ${DIAS[x.w]}${x.vezes === 1 ? "" : "s"}${tot > 0 ? ", " + Math.round(x.revenue / tot * 100) + " % das vendas" : ""})`).join("; ")}.` : "";
  return `<div class="grupo"><h3>Dias da semana</h3>
    <p style="color:var(--tinta-2);margin:0">${gdModo === "pedidos" ? "Média de pedidos" : "Média de vendas"} por cada dia desses no período. Por baixo, o total de pedidos.</p>
    <div class="gd-scroll gd-sem"><div class="gd-barras">${cols}</div></div>
    <small style="color:var(--tinta-2)">${frase}</small></div>`;
}

const rankingsSemGrafico = rankings;
rankings = function (d) {
  const h = rankingsSemGrafico(d), novo = gdSemana(d);
  if (!novo) return h;
  const i = h.indexOf(`<div class="grupo"><h3>Dias da semana</h3>`);
  return i >= 0 ? h.slice(0, i) + novo : h + novo; // "Dias da semana" é sempre o último grupo
};

ACOES["gd-modo"] = function (b) {
  gdModo = b.dataset.m === "vendas" ? "vendas" : "pedidos"; LS.set("gdModo", gdModo);
  const corpo = $("#folha-corpo"), y = corpo ? corpo.scrollTop : 0;
  renderFolha();
  const c2 = $("#folha-corpo"); if (c2) c2.scrollTop = y;
};

/* Abre o gráfico no fim (dias mais recentes). */
const renderSemGd = renderFolha;
renderFolha = function () {
  renderSemGd();
  if (S.vista === "adm-painel") document.querySelectorAll("[data-gd-fim]").forEach(e => { e.scrollLeft = e.scrollWidth; });
};
