/* ---------- horário com dois períodos por dia (almoço e jantar) ---------- */
/* CONFIG.turnos[d] = [["12:00","14:30"], ["19:00","22:30"]] ou null (fechado).
   CONFIG.horario[d] continua a existir (da 1.ª abertura ao último fecho) só para o código antigo
   não rebentar; tudo o que decide abertura, horas de entrega e textos passa a usar os turnos. */

const MAX_TURNOS = 2;
const nomeDia = d => DIAS[d][0].toUpperCase() + DIAS[d].slice(1);

/**
 * Períodos de um dia da semana, ordenados.
 * @param {number} d Dia da semana (0 = domingo).
 * @param {object} [fonte] Objeto com turnos/horario (por omissão, CONFIG).
 * @returns {string[][]|null} Lista de [abre, fecha] ou null se fechado.
 */
function turnosDia(d, fonte) {
  const f = fonte || CONFIG;
  if (f.turnos && d in f.turnos) return f.turnos[d] && f.turnos[d].length ? f.turnos[d] : null;
  const h = f.horario && f.horario[d];
  return h ? [h] : null;
}

/** Texto do horário de um dia: "12:00 às 14:30 e 19:00 às 22:30" ou "Fechado". */
const textoTurnos = t => t ? t.map(p => p[0] + " às " + p[1]).join(" e ") : "Fechado";

/** Da 1.ª abertura ao último fecho, para o formato antigo. */
const vaoTurnos = t => t ? [t[0][0], t[t.length - 1][1]] : null;

function estadoLoja() {
  const n = agora(), hoje = turnosDia(n.dow) || [];
  const dentro = hoje.find(p => n.min >= toMin(p[0]) && n.min < toMin(p[1]));
  if (dentro) return { aberto: true, texto: "Aberto agora, até às " + dentro[1] };
  for (let i = 0; i <= 7; i++) {
    const dow = (n.dow + i) % 7, t = turnosDia(dow);
    if (!t) continue;
    const prox = t.find(p => i > 0 || n.min < toMin(p[0]));
    if (!prox) continue;
    return { aberto: false, texto: "Fechado. Abre " + (i === 0 ? "hoje" : i === 1 ? "amanhã" : DIAS[dow]) + " às " + prox[0] };
  }
  return { aberto: false, texto: "Fechado" };
}

function podeJa() {
  const n = agora();
  return (turnosDia(n.dow) || []).some(p => n.min >= toMin(p[0]) && n.min + CONFIG.preparoMin <= toMin(p[1]));
}

function diasDisponiveis() {
  const n = agora(), out = [];
  for (let i = 0; i < 8; i++) {
    const dt = new Date(Date.UTC(n.y, n.m - 1, n.d + i)), dow = dt.getUTCDay(), t = turnosDia(dow);
    if (!t) continue;
    const slots = [];
    t.forEach(p => {
      for (let m = toMin(p[0]) + CONFIG.preparoMin; m <= toMin(p[1]); m += CONFIG.intervaloMin) {
        if (i === 0 && m < n.min + CONFIG.preparoMin) continue;
        slots.push(fmtMin(m));
      }
    });
    if (!slots.length) continue;
    const data = doisD(dt.getUTCDate()) + "/" + doisD(dt.getUTCMonth() + 1);
    out.push({ chave: dt.toISOString().slice(0, 10), rotulo: (i === 0 ? "Hoje" : i === 1 ? "Amanhã" : nomeDia(dow)) + ", " + data, slots });
  }
  return out;
}

/* O app4.js ficou com um setInterval preso à versão antiga de atualizarEstado, que escreve o horário
   de hoje em #f-hoje no formato de um só período. O campo visível passa a ter outro id e o antigo
   fica num elemento escondido, onde essa escrita já não se vê. */
(function separarHoje() {
  const el = document.getElementById("f-hoje");
  if (!el || document.getElementById("f-hoje-turnos")) return;
  el.id = "f-hoje-turnos";
  const isco = document.createElement("span");
  isco.id = "f-hoje"; isco.hidden = true;
  document.body.appendChild(isco);
})();

function atualizarEstado() {
  const e = estadoLoja(), el = $("#estado");
  el.classList.toggle("aberto", e.aberto);
  $("span", el).textContent = e.texto;
  const hoje = document.getElementById("f-hoje-turnos");
  if (hoje) hoje.textContent = textoTurnos(turnosDia(agora().dow));
}

const montarSemTurnos = montarPagina;
montarPagina = function () {
  montarSemTurnos();
  const n = agora();
  $("#tab-horario").innerHTML = [1, 2, 3, 4, 5, 6, 0].map(d => {
    const t = turnosDia(d);
    return `<tr class="${d === n.dow ? "hoje" : ""}"><td>${nomeDia(d)}${d === n.dow ? " (hoje)" : ""}</td><td class="${t ? "" : "fechado"}">${textoTurnos(t)}</td></tr>`;
  }).join("");
};

/* ---------- dados do backend ---------- */
const mapearUmTurno = mapear;
mapear = function (d) {
  const r = mapearUmTurno(d), turnos = { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
  (d.hours || []).forEach(h => {
    if (!h.is_open || !h.opens || !h.closes) return;
    const t = [[h.opens.slice(0, 5), h.closes.slice(0, 5)]];
    if (h.opens2 && h.closes2) t.push([h.opens2.slice(0, 5), h.closes2.slice(0, 5)]);
    turnos[h.weekday] = t;
    r.loja.horario[h.weekday] = vaoTurnos(t);
  });
  r.loja.turnos = turnos;
  return r;
};

/* ---------- gestão: horário de funcionamento ---------- */
document.head.insertAdjacentHTML("beforeend", `<style>
.dia .turno2{margin-top:.5rem}
.dia .turno2 .opcao{font-size:.92rem}
.dia .turno2 .par.desligado{opacity:.45}
</style>`);

function vAdmLoja() {
  const L = S.editar;
  if (!L.turnos) L.turnos = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(d => [d, turnosDia(d, L)]));
  const dias = [1, 2, 3, 4, 5, 6, 0].map(d => {
    const t = L.turnos[d], p1 = t ? t[0] : null, p2 = t && t[1] ? t[1] : null;
    const ref = p1 ? toMin(p1[0]) : toMin("18:00");
    const sug = ref >= toMin("16:00") ? ["12:00", "14:30"] : ["19:00", "22:30"];
    return `<div class="dia"><label class="opcao"><input type="checkbox" name="ab${d}" ${t ? "checked" : ""}><span><strong>${nomeDia(d)}</strong></span></label>
      <div class="par"><label class="campo"><span>Abre</span><input type="time" name="de${d}" value="${esc(p1 ? p1[0] : "18:00")}"></label><label class="campo"><span>Fecha</span><input type="time" name="ate${d}" value="${esc(p1 ? p1[1] : "22:30")}"></label></div>
      <div class="turno2"><label class="opcao"><input type="checkbox" name="p2${d}" data-turno2="${d}" ${p2 ? "checked" : ""}><span>Também abre noutro período (ex.: almoço e jantar)</span></label>
      <div class="par ${p2 ? "" : "desligado"}" id="par2-${d}"><label class="campo"><span>Abre</span><input type="time" name="de2${d}" value="${esc(p2 ? p2[0] : sug[0])}"></label><label class="campo"><span>Fecha</span><input type="time" name="ate2${d}" value="${esc(p2 ? p2[1] : sug[1])}"></label></div></div></div>`;
  }).join("");
  const zonas = L.zonas.map((z, i) => `<div class="par" style="align-items:end"><label class="campo"><span>Zona</span><input type="text" name="zn${i}" value="${esc(z.nome)}"></label><label class="campo"><span>Taxa (€)</span><input type="text" name="zt${i}" inputmode="decimal" value="${esc(String(z.taxa).replace(".", ","))}"></label></div>${L.zonas.length > 1 ? `<p><button type="button" class="ligacao" data-a="adm-zona-apagar" data-i="${i}">Apagar ${esc(z.nome || "zona")}</button></p>` : ""}`).join("");
  return { titulo: "Horário e definições",
    corpo: `<p style="margin-bottom:1rem"><button type="button" class="ligacao" data-a="abrir-admin">Voltar à loja</button></p>
      <div class="grupo"><h3>Horário de funcionamento</h3><p style="color:var(--tinta-2)">Desmarque os dias em que está fechado. Para abrir ao almoço e ao jantar, marque o segundo período.</p>${dias}</div>
      <div class="grupo"><h3>Pedidos</h3><div class="par">
        <label class="campo"><span>Pedido mínimo (€)</span><input type="text" name="pedidoMinimo" inputmode="decimal" value="${esc(String(L.pedidoMinimo).replace(".", ","))}"></label>
        <label class="campo"><span>Preparação (min)</span><input type="text" name="preparoMin" inputmode="numeric" value="${esc(L.preparoMin)}"></label></div></div>
      <div class="grupo"><h3>Zonas e taxa de entrega</h3>${zonas}<p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="adm-zona-nova">Adicionar zona</button></p></div>
      <div id="erros"></div>`,
    pe: `<button type="button" class="btn btn-bloco" data-a="adm-loja-guardar">Guardar definições</button>` };
}
VISTAS["adm-loja"] = vAdmLoja;

$("#folha").addEventListener("change", ev => {
  const d = ev.target.dataset && ev.target.dataset.turno2;
  if (d === undefined) return;
  const par = document.getElementById("par2-" + d);
  if (par) par.classList.toggle("desligado", !ev.target.checked);
});

/** Lê o formulário do horário para S.editar (turnos ordenados pela hora de abertura). */
function lerLoja() {
  const L = S.editar;
  if (!L.turnos) L.turnos = {};
  [0, 1, 2, 3, 4, 5, 6].forEach(d => {
    if (!campo("ab" + d).checked) { L.turnos[d] = null; L.horario[d] = null; return; }
    const t = [[campo("de" + d).value, campo("ate" + d).value]];
    if (campo("p2" + d).checked) t.push([campo("de2" + d).value, campo("ate2" + d).value]);
    t.sort((a, b) => (a[0] ? toMin(a[0]) : 0) - (b[0] ? toMin(b[0]) : 0));
    L.turnos[d] = t.slice(0, MAX_TURNOS);
    L.horario[d] = vaoTurnos(L.turnos[d]);
  });
  L.pedidoMinimo = campo("pedidoMinimo").value; L.preparoMin = campo("preparoMin").value;
  L.zonas.forEach((z, i) => { z.nome = campo("zn" + i).value.trim(); z.taxa = campo("zt" + i).value; });
}

/**
 * Lê e valida o formulário da loja.
 * @returns {{erros:string[], dados:object}} Erros de validação e corpo para o backend.
 */
function lerDefinicoes() {
  lerLoja();
  const L = S.editar, erros = [], uuid = /^[0-9a-f-]{36}$/;
  const hours = [0, 1, 2, 3, 4, 5, 6].map(d => {
    const t = L.turnos[d];
    if (!t) return { weekday: d, is_open: false, opens: null, closes: null, opens2: null, closes2: null };
    t.forEach(p => { if (!p[0] || !p[1] || toMin(p[0]) >= toMin(p[1])) erros.push(nomeDia(d) + ": a hora de fecho tem de ser depois da de abertura."); });
    if (t[1] && t[0][1] && t[1][0] && toMin(t[0][1]) >= toMin(t[1][0])) erros.push(nomeDia(d) + ": os dois períodos não se podem sobrepor (o segundo tem de abrir depois de o primeiro fechar).");
    return { weekday: d, is_open: true, opens: t[0][0], closes: t[0][1], opens2: t[1] ? t[1][0] : null, closes2: t[1] ? t[1][1] : null };
  });
  const zones = L.zonas.map(z => ({ id: uuid.test(z.id) ? z.id : null, name: z.nome, fee: num(z.taxa) }));
  zones.forEach(z => { if (!z.name) erros.push("Dê um nome a todas as zonas."); if (!isFinite(z.fee) || z.fee < 0) erros.push("Escreva a taxa de " + (z.name || "cada zona") + ", ou 0 se for grátis."); });
  const min_order = num(L.pedidoMinimo), prep_minutes = parseInt(L.preparoMin, 10);
  if (!isFinite(min_order) || min_order < 0) erros.push("Escreva o pedido mínimo em euros.");
  if (!(prep_minutes >= 0)) erros.push("Escreva o tempo de preparação em minutos.");
  return { erros: [...new Set(erros)], dados: { min_order, prep_minutes, hours, zones } };
}

montarPagina(); atualizarEstado(); atualizarPagina();
