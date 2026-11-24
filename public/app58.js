/* ---------- resultados: "Para planear" (melhor dia, horário, almoço x jantar) ----------
 * Pedido do Fabricio (24/11): botões para ver o dia que mais vendeu, o horário que mais vendeu e
 * almoço x jantar, para se planear (equipa, compras, preparação). Fica logo a seguir ao gráfico das vendas
 * e segue o modo do gráfico (Pedidos ou Vendas) para ordenar. Desenho das abas em app59.js.
 * Dados: dashboard → by_period (vendas_por_turno).
 */
document.head.insertAdjacentHTML("beforeend", `<style>
.pl-dia{display:block;padding:.55rem 0;border-top:1px solid var(--linha)}
.pl-dia:first-of-type{border-top:0}
.pl-dia .l1{display:flex;justify-content:space-between;gap:.6rem;font-weight:700}
.pl-dia small{color:var(--tinta-2)}
.pl-hbar{display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--linha);margin:.3rem 0 .2rem}
.pl-hbar .a{background:var(--gt-almoco)}.pl-hbar .j{background:var(--gt-jantar)}
.pl-slot{display:grid;grid-template-columns:5.6rem 1fr auto;align-items:center;gap:.5rem;font-size:.85rem;margin:.25rem 0}
.pl-slot .b{height:14px;border-radius:0 4px 4px 0;min-width:2px}
.pl-slot.a .b{background:var(--gt-almoco)}.pl-slot.j .b{background:var(--gt-jantar)}
.pl-slot.zero .b{background:var(--linha)}.pl-slot.zero{color:var(--tinta-2)}
.pl-slot.top{font-weight:700}
.pl-2{display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin:.4rem 0 .8rem}
.pl-turno{border:1.5px solid var(--linha);border-radius:12px;padding:.6rem .7rem;font-size:.82rem;line-height:1.35}
.pl-turno h4{margin:0 0 .3rem;display:flex;align-items:center;gap:.4rem;font-size:1rem}
.pl-turno h4 i{width:.8rem;height:.8rem;border-radius:3px;display:inline-block}
.pl-turno p{margin:.15rem 0}.pl-turno b{display:block;font-size:1.05rem}
.pl-tab{width:100%;border-collapse:collapse;font-size:.85rem;margin:.3rem 0}
.pl-tab th,.pl-tab td{padding:.35rem .3rem;text-align:center}
.pl-tab th:first-child,.pl-tab td:first-child{text-align:left}
.pl-tab td.v{border-radius:6px;font-weight:700}
.pl-nota{color:var(--tinta-2);font-size:.8rem;margin:.5rem 0 0}
</style>`);

let plAba = LS.get("plAba", "dias");
const PL_TURNOS = [["almoco", "Almoço", "a"], ["jantar", "Jantar", "j"]];
const plN = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const plFmt1 = n => n.toLocaleString("pt-PT", { maximumFractionDigits: 1 });
const plCap = s => s[0].toUpperCase() + s.slice(1);

/** Valor no modo do gráfico, já formatado (ex.: "7 pedidos" ou "322,70 €"). */
const plTxt = p => gdModo === "pedidos" ? plN(p.orders, "pedido", "pedidos") : eur(p.revenue);

/** Dias com pedidos: [{day, almoco, jantar, total}], do turno guardado em by_period. */
function plDias() {
  const m = gtPorDia();
  return Object.keys(m).sort().map(day => {
    const a = m[day].almoco, j = m[day].jantar;
    return { day, almoco: a, jantar: j, total: { orders: a.orders + j.orders, revenue: a.revenue + j.revenue } };
  }).filter(x => x.total.orders > 0);
}

/** Nome do dia ("Sexta 13/11"). */
const plNomeDia = iso => plCap(DIAS[gdDow(iso)]) + " " + fmtDia(iso);

/** Barra horizontal com almoço e jantar. */
function plBarra(x) {
  const a = gtVal(x.almoco), j = gtVal(x.jantar), t = a + j || 1;
  return `<div class="pl-hbar" aria-hidden="true"><span class="a" style="width:${a / t * 100}%"></span><span class="j" style="width:${j / t * 100}%"></span></div>`;
}

/** Linha "Almoço 3 · 84,70 € · Jantar 4 · 180,96 €". */
const plDetalhe = x => PL_TURNOS.map(([k, n]) => `${n} ${x[k].orders} · ${eur(x[k].revenue)}`).join(" &nbsp;·&nbsp; ");

/** Melhor dia de um turno (ou null). */
function plMelhorDe(dias, k) {
  const com = dias.filter(x => x[k].orders > 0);
  return com.length ? com.reduce((m, x) => gtVal(x[k]) > gtVal(m[k]) ? x : m) : null;
}

/** Aba "Dia que mais vendeu": os 5 melhores dias e o melhor almoço / jantar. */
function plAbaDias(dias) {
  const top = dias.slice().sort((p, q) => gtVal(q.total) - gtVal(p.total) || q.total.revenue - p.total.revenue).slice(0, 5);
  const linhas = top.map((x, i) => `<div class="pl-dia"><div class="l1"><span>${i + 1}. ${plNomeDia(x.day)}</span><span>${plTxt(x.total)}</span></div>
    ${plBarra(x)}<small>${plDetalhe(x)}</small></div>`).join("");
  const melhor = PL_TURNOS.map(([k, n]) => {
    const x = plMelhorDe(dias, k);
    return x ? `<p style="margin:.2rem 0">Melhor ${n.toLowerCase()}: <strong>${plNomeDia(x.day)}</strong> — ${plN(x[k].orders, "pedido", "pedidos")}, ${eur(x[k].revenue)}.</p>` : "";
  }).join("");
  return linhas + `<div style="margin-top:.6rem">${melhor}</div>
    <p class="pl-nota">Ordenado por ${gdModo === "pedidos" ? "pedidos" : "vendas"}, como no gráfico. Amarelo = almoço, vermelho = jantar.</p>`;
}

/** Meias horas de um turno, da primeira à última com pedidos (as do meio a 0). */
function plSlots(k) {
  const bp = painel.dados.by_period, por = {};
  (bp.por_hora || []).filter(s => s.periodo === k).forEach(s => { por[s.slot] = { orders: +s.orders, revenue: +s.revenue }; });
  const ks = Object.keys(por).sort();
  if (!ks.length) return [];
  const out = [];
  for (let m = toMin(ks[0]); m <= toMin(ks[ks.length - 1]); m += 30) {
    const s = fmtMin(m);
    out.push({ slot: s, ate: fmtMin(m + 30), p: por[s] || { orders: 0, revenue: 0 } });
  }
  return out;
}

/** Pico de um turno: a hora (2 meias horas seguidas) com mais pedidos/vendas. */
function plPico(slots) {
  let melhor = null;
  slots.forEach((s, i) => {
    const nx = slots[i + 1], v = gtVal(s.p) + (nx ? gtVal(nx.p) : 0);
    if (!s.p.orders) return; // o pico começa numa meia hora com pedidos
    if (!melhor || v > melhor.v) melhor = { de: s.slot, ate: nx ? nx.ate : s.ate, v, n: s.p.orders + (nx ? nx.p.orders : 0) };
  });
  return melhor;
}
