/* ---------- "Fechar por hoje": fecha a loja só no dia de hoje, sem mexer no horário ----------
 * settings.closed_on = dia (Lisboa) sem pedidos. O site mostra "Fechado hoje. Abre … às …", tira
 * "o mais cedo possível" e as horas de hoje; agendar para outros dias continua. No dia seguinte abre sozinha.
 * A base de dados (create_order) também recusa pedidos para hoje, mesmo com a página antiga aberta.
 * Gestão → Hoje: botão "Fechar por hoje" / "Reabrir hoje".
 */
CONFIG.fechadoEm = "";
let fechoLido = false;
const hojeChave = () => { const n = agora(); return n.y + "-" + doisD(n.m) + "-" + doisD(n.d); };
const fechadoHoje = () => !!CONFIG.fechadoEm && CONFIG.fechadoEm === hojeChave();

const mapearSemFecho = mapear;
mapear = function (d) {
  CONFIG.fechadoEm = (d && d.settings && d.settings.closed_on) || "";
  fechoLido = true;
  return mapearSemFecho(d);
};

const estadoLojaSemFecho = estadoLoja;
estadoLoja = function () {
  if (!fechadoHoje()) return estadoLojaSemFecho();
  const n = agora();
  for (let i = 1; i <= 7; i++) {
    const dow = (n.dow + i) % 7, t = turnosDia(dow);
    if (t) return { aberto: false, texto: "Fechado hoje. Abre " + (i === 1 ? "amanhã" : DIAS[dow]) + " às " + t[0][0] };
  }
  return { aberto: false, texto: "Fechado hoje" };
};

const podeJaSemFecho = podeJa;
podeJa = function () { return !fechadoHoje() && podeJaSemFecho(); };

const diasSemFecho = diasDisponiveis;
diasDisponiveis = function () {
  const dias = diasSemFecho();
  return fechadoHoje() ? dias.filter(d => d.chave !== CONFIG.fechadoEm) : dias;
};

const atualizarEstadoSemFecho = atualizarEstado;
atualizarEstado = function () {
  atualizarEstadoSemFecho();
  const hoje = document.getElementById("f-hoje-turnos");
  if (hoje && fechadoHoje()) hoje.textContent = "Fechado hoje";
};

/* Gestão → Hoje */
const vInicioSemFecho = VISTAS.admin;
VISTAS.admin = function () {
  const v = vInicioSemFecho();
  if (!v || v.titulo !== "Hoje") return v;
  const caixa = fechadoHoje()
    ? `<div class="grupo" style="border:2px solid var(--sakura)"><h3>Loja fechada hoje</h3>
        <p style="margin:.3rem 0 .8rem">O site não aceita pedidos para hoje. Os clientes ainda podem agendar para outro dia. Amanhã abre sozinha, com o horário normal.</p>
        <button type="button" class="btn" data-a="adm-reabrir-hoje">Reabrir hoje</button></div>`
    : `<div class="grupo"><h3>Loja aberta hoje</h3>
        <p class="nota" style="margin:.3rem 0 .8rem">Para deixar de receber pedidos só hoje, sem mudar o horário. Amanhã abre sozinha.</p>
        <button type="button" class="btn btn-sec" data-a="adm-fechar-hoje">Fechar por hoje</button></div>`;
  v.corpo = caixa + v.corpo;
  return v;
};

/**
 * Guarda o dia fechado (ou reabre) e atualiza o ecrã.
 * @param {string|null} dia Data AAAA-MM-DD ou null para reabrir.
 */
async function mudarFechoHoje(dia) {
  try {
    await api("/admin/closed-today", { method: "PUT", auth: true, body: { closed_on: dia } });
    CONFIG.fechadoEm = dia || "";
    atualizarEstado(); renderFolha();
    brinde(dia ? "Loja fechada por hoje" : "Loja aberta outra vez");
  } catch (e) { erroGestao(e); }
}

Object.assign(ACOES, {
  "adm-fechar-hoje"() { mudarFechoHoje(hojeChave()); },
  "adm-reabrir-hoje"() { mudarFechoHoje(null); }
});

atualizarEstado();

/* O menu pode ter chegado antes deste ficheiro: vai buscar só o dia fechado. */
if (!fechoLido && D.produtos.length && D.produtos.every(p => p.temp !== undefined)) {
  apiSemIndicador("/menu").then(d => { CONFIG.fechadoEm = (d.settings && d.settings.closed_on) || ""; fechoLido = true; atualizarEstado(); }).catch(() => {});
}
