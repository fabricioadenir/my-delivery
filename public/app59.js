/* ---------- resultados: "Para planear" — horários, almoço x jantar e o bloco com as abas ----------
 * Continua app58.js. O bloco entra logo a seguir ao grupo do gráfico das vendas (marca <!--gt-fim-->).
 */

/** Lista das meias horas de um turno, com barra proporcional. */
function plListaSlots(slots, k, max, topV) {
  const cls = k === "almoco" ? "a" : "j";
  return slots.map(s => {
    const v = gtVal(s.p), top = v > 0 && v === topV;
    return `<div class="pl-slot ${cls}${v ? "" : " zero"}${top ? " top" : ""}"><span>${s.slot}–${s.ate}</span>
      <span class="b" style="width:${max ? v / max * 100 : 0}%"></span><span>${v ? plTxt(s.p) : "—"}</span></div>`;
  }).join("");
}

/** Aba "Horário que mais vendeu": meias horas do almoço e do jantar e o pico de cada um. */
function plAbaHoras() {
  const porT = PL_TURNOS.map(([k, n]) => ({ k, n, slots: plSlots(k) })).filter(t => t.slots.length);
  const todos = porT.flatMap(t => t.slots), max = Math.max(...todos.map(s => gtVal(s.p)), 0);
  const totalN = todos.reduce((s, x) => s + x.p.orders, 0), totalV = todos.reduce((s, x) => s + gtVal(x.p), 0);
  const top = todos.filter(s => gtVal(s.p) === max && max > 0);
  const frase = top.length ? `<p style="margin:.2rem 0 .6rem">Horário com mais ${gdModo === "pedidos" ? "pedidos" : "vendas"}: <strong>${top.map(s => s.slot + "–" + s.ate).join(", ")}</strong> — ${plTxt(top[0].p)} (${Math.round(max / (totalV || 1) * 100)} % do total).</p>` : "";
  const blocos = porT.map(t => {
    const turnoN = t.slots.reduce((s, x) => s + x.p.orders, 0), pico = plPico(t.slots);
    const txtPico = pico && t.slots.length > 1 ? `<small style="color:var(--tinta-2)">Pico: <b>${pico.de}–${pico.ate}</b>, com ${pico.n} de ${turnoN} pedidos (${Math.round(pico.n / (turnoN || 1) * 100)} %).</small>` : "";
    return `<h4 style="margin:.8rem 0 .2rem">${t.n} · ${plN(turnoN, "pedido", "pedidos")}</h4>${plListaSlots(t.slots, t.k, max, max)}${txtPico}`;
  }).join("");
  const cedo = +painel.dados.by_period.mais_cedo || 0;
  return frase + blocos + `<p class="pl-nota">Hora de entrega, em meias horas (${plN(totalN, "pedido", "pedidos")}).${cedo ? ` ${plN(cedo, "pedido", "pedidos")} "o mais cedo possível" ${cedo === 1 ? "conta" : "contam"} pela hora em que ${cedo === 1 ? "foi entregue" : "foram entregues"}.` : ""}</p>`;
}

/** Quantas segundas, terças… houve desde o 1.º dia com pedidos do período. */
function plVezes(dias) {
  const vezes = [0, 0, 0, 0, 0, 0, 0];
  if (!dias.length || !painel.ate) return vezes;
  const inicio = dias[0].day > painel.de ? dias[0].day : painel.de;
  for (let x = inicio; x <= painel.ate; x = gdSoma(x, 1)) vezes[gdDow(x)]++;
  return vezes;
}

/** Média por dia da semana e turno: [{w, almoco, jantar}] com {orders, revenue, media}. */
function plSemana(dias) {
  const vezes = plVezes(dias), m = {};
  (painel.dados.by_period.por_semana || []).forEach(x => { m[x.weekday + x.periodo] = { orders: +x.orders, revenue: +x.revenue }; });
  return [1, 2, 3, 4, 5, 6, 0].map(w => {
    const r = { w, vezes: vezes[w] };
    PL_TURNOS.forEach(([k]) => {
      const p = m[w + k] || { orders: 0, revenue: 0 };
      r[k] = { ...p, media: gtVal(p) / Math.max(vezes[w], 1) };
    });
    return r;
  });
}

/** Cartão de um turno com os números principais. */
function plCartaoTurno(k, n, dias, sem) {
  const t = gtTotais(), p = t[k], todos = gtVal(t.almoco) + gtVal(t.jantar);
  const com = dias.filter(x => x[k].orders > 0).length, slots = plSlots(k);
  const pico = slots.length ? slots.reduce((a, s) => gtVal(s.p) > gtVal(a.p) ? s : a) : null;
  const bw = sem.reduce((a, x) => x[k].media > a[k].media ? x : a);
  return `<div class="pl-turno"><h4><i style="background:var(--gt-${k})"></i>${n}</h4>
    <p><b>${plN(p.orders, "pedido", "pedidos")}</b>${eur(p.revenue)}</p>
    <p>${Math.round(gtVal(p) / (todos || 1) * 100)} % ${gdModo === "pedidos" ? "dos pedidos" : "das vendas"}</p>
    <p>Por pedido: ${p.orders ? eur(p.revenue / p.orders) : "—"}</p>
    <p>Em ${plN(com, "dia", "dias")}</p>
    <p>Pico: ${pico && gtVal(pico.p) ? pico.slot + "–" + pico.ate : "—"}</p>
    <p>Melhor dia: ${bw[k].media > 0 ? plCap(DIAS[bw.w]) : "—"}</p></div>`;
}

/** Tabela segunda a domingo × almoço/jantar, com a média e a cor mais forte onde há mais. */
function plTabela(sem) {
  const max = Math.max(...sem.flatMap(x => [x.almoco.media, x.jantar.media]), 0);
  const cel = (p, k) => {
    const a = max ? 0.12 + 0.88 * p.media / max : 0, cor = k === "almoco" ? "245,184,61" : "214,0,8";
    const txt = gdModo === "pedidos" ? plFmt1(p.media) : Math.round(p.media) + " €";
    const forte = a > 0.6 && k === "jantar";
    return `<td class="v" style="background:rgba(${cor},${p.media ? a : 0});${forte ? "color:#fff" : ""}" title="${p.orders} pedidos, ${eur(p.revenue)}">${p.media ? txt : "0"}</td>`;
  };
  return `<table class="pl-tab"><thead><tr><th>Dia</th><th>Almoço</th><th>Jantar</th></tr></thead><tbody>${sem.map(x =>
    `<tr><td>${plCap(DIAS[x.w])} <small style="color:var(--tinta-2)">(${x.vezes}×)</small></td>${cel(x.almoco, "almoco")}${cel(x.jantar, "jantar")}</tr>`).join("")}</tbody></table>`;
}

/** Aba "Almoço x jantar". */
function plAbaTurnos(dias) {
  const sem = plSemana(dias);
  const ranking = sem.flatMap(x => PL_TURNOS.map(([k, n]) => ({ txt: DIAS[x.w] + " ao " + n.toLowerCase(), p: x[k] })))
    .filter(x => x.p.media > 0).sort((p, q) => q.p.media - p.p.media).slice(0, 3);
  const unid = gdModo === "pedidos" ? " pedidos" : "";
  const frase = ranking.length ? `<p style="margin:.2rem 0">Turnos mais fortes: ${ranking.map(r => `<strong>${r.txt}</strong> (${gdModo === "pedidos" ? plFmt1(r.p.media) : eur(r.p.media)}${unid} em média)`).join(", ")}.</p>` : "";
  return `<div class="pl-2">${plCartaoTurno("almoco", "Almoço", dias, sem)}${plCartaoTurno("jantar", "Jantar", dias, sem)}</div>
    ${frase}<h4 style="margin:.8rem 0 .1rem">${gdModo === "pedidos" ? "Média de pedidos" : "Média de vendas"} por dia da semana</h4>${plTabela(sem)}
    <p class="pl-nota">Média = total desse turno ÷ n.º de vezes que esse dia da semana apareceu no período (entre parênteses), desde o 1.º pedido. Conta também os dias em que a loja esteve fechada.</p>`;
}

/** Bloco "Para planear" com as abas. */
function plBloco(d) {
  if (!d.by_period) return "";
  const dias = plDias();
  if (!dias.length) return "";
  const abas = [["dias", "Dia que mais vendeu", () => plAbaDias(dias)], ["horas", "Horário que mais vendeu", plAbaHoras], ["turnos", "Almoço x jantar", () => plAbaTurnos(dias)]];
  const sel = abas.some(a => a[0] === plAba) ? plAba : "dias";
  return `<div class="grupo" id="pl-bloco"><h3>Para planear</h3>
    <div class="rx-abas rs-abas" role="tablist" aria-label="Para planear">${abas.map(([k, t]) => `<button type="button" role="tab" aria-selected="${k === sel}" data-a="pl-aba" data-aba="${k}">${t}</button>`).join("")}</div>
    ${abas.map(([k, , f]) => `<div role="tabpanel" data-pl="${k}"${k === sel ? "" : " hidden"}>${f()}</div>`).join("")}</div>`;
}

/* Põe o bloco logo a seguir ao grupo do gráfico das vendas. */
const plVistaBase = VISTAS["adm-painel"];
VISTAS["adm-painel"] = function () {
  const v = plVistaBase(), i = v.corpo.indexOf("<!--gt-fim-->");
  if (i < 0 || !painel.dados) return v;
  const fim = v.corpo.indexOf("</div>", i) + 6;
  v.corpo = v.corpo.slice(0, fim) + plBloco(painel.dados) + v.corpo.slice(fim);
  return v;
};

ACOES["pl-aba"] = function (b) {
  plAba = b.dataset.aba; LS.set("plAba", plAba);
  const g = b.closest("#pl-bloco"); if (!g) return;
  g.querySelectorAll('[role="tab"]').forEach(x => x.setAttribute("aria-selected", String(x === b)));
  g.querySelectorAll("[data-pl]").forEach(p => { p.hidden = p.dataset.pl !== plAba; });
  const barra = b.parentElement;
  barra.scrollLeft = b.offsetLeft - barra.clientWidth / 2 + b.clientWidth / 2;
};

if (S.vista === "adm-painel" && painel.dados) renderFolha();
