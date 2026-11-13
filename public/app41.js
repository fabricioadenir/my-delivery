/* ---------- intervalo mínimo de 15 minutos entre entregas ----------
 * Cada pedido ocupa uma hora (a agendada ou, no "o mais cedo possível", a hora do pedido + preparação).
 * Site: as horas a menos de 15 min de outro pedido não aparecem; "o mais cedo possível" só aparece se a hora
 * prevista estiver livre. Horas de 5 em 5 minutos. A base de dados (create_order) volta a verificar.
 * Gestão → Registar pedido: só avisa (pode gravar na mesma, para exceções).
 */
let HORAS_OCUPADAS = [];   // [["AAAA-MM-DDTHH:MM", "AAAA-MM-DDTHH:MM"], …] limites exclusivos, hora de Lisboa
const INTERVALO_ENTREGAS = 15;

/** A hora (dia "AAAA-MM-DD" + "HH:MM") fica a menos de 15 min de outro pedido? */
const horaOcupada = (dia, hora) => { const t = dia + "T" + hora; return HORAS_OCUPADAS.some(([de, ate]) => de < t && t < ate); };

/**
 * Vai buscar as horas ocupadas; se mudaram e o checkout está aberto, volta a desenhá-lo.
 * @param {boolean} redesenhar Redesenhar o checkout se houver mudanças.
 */
async function carregarOcupadas(redesenhar) {
  try {
    const lista = await apiSemIndicador("/blocked-times");
    if (!Array.isArray(lista)) return;
    const mudou = JSON.stringify(lista) !== JSON.stringify(HORAS_OCUPADAS);
    HORAS_OCUPADAS = lista;
    if (mudou && redesenhar && S.vista === "finalizar") { lerFinalizar(); renderFolha(); }
  } catch (e) { /* sem ligação: o servidor verifica na mesma ao fazer o pedido */ }
}

const mapearSemIntervalo = mapear;
mapear = function (d) {
  const r = mapearSemIntervalo(d);
  CONFIG.intervaloMin = Math.min(CONFIG.intervaloMin || 5, 5);
  return r;
};
CONFIG.intervaloMin = Math.min(CONFIG.intervaloMin || 5, 5);

const diasSemIntervalo = diasDisponiveis;
diasDisponiveis = function () {
  return diasSemIntervalo()
    .map(d => Object.assign({}, d, { slots: d.slots.filter(h => !horaOcupada(d.chave, h)) }))
    .filter(d => d.slots.length);
};

const podeJaSemIntervalo = podeJa;
podeJa = function () {
  if (!podeJaSemIntervalo()) return false;
  const n = agora(), m = n.min + CONFIG.preparoMin;
  if (m >= 24 * 60) return true;
  return !horaOcupada(n.y + "-" + doisD(n.m) + "-" + doisD(n.d), fmtMin(m));
};

/* Ao abrir o checkout e de minuto a minuto enquanto estiver aberto, atualiza as horas ocupadas. */
const irFinalizarSemIntervalo = ACOES["ir-finalizar"];
ACOES["ir-finalizar"] = function (b) { const r = irFinalizarSemIntervalo(b); carregarOcupadas(true); return r; };
setInterval(() => { if (S.vista === "finalizar") carregarOcupadas(true); }, 60000);

/* Se o servidor recusar a hora (outro cliente apanhou-a entretanto), mostra logo as horas certas. */
const apiSemIntervalo = api;
api = async function (caminho, opcoes) {
  try { return await apiSemIntervalo(caminho, opcoes); }
  catch (e) {
    if (caminho === "/orders" && /hora|mais cedo/i.test(e.message || "")) carregarOcupadas(true);
    throw e;
  }
};

carregarOcupadas(false);

/* ---------- gestão: aviso no "Registar pedido" ---------- */
const FMT_LISBOA = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
/** Minutos "locais de Lisboa" desde 1970 (só para comparar horas entre si). */
const minLisboa = d => { const [a, h] = FMT_LISBOA.format(d).split(" "); const [y, mo, di] = a.split("-").map(Number), [hh, mi] = h.split(":").map(Number); return Date.UTC(y, mo - 1, di, hh, mi) / 60000; };
const minDeTexto = (dia, hora) => { const [y, mo, di] = dia.split("-").map(Number), [hh, mi] = hora.split(":").map(Number); return Date.UTC(y, mo - 1, di, hh, mi) / 60000; };
const hhmm = m => fmtMin(((m % 1440) + 1440) % 1440);

/** Pedidos a menos de 15 min da hora escolhida no formulário. */
function conflitosManual() {
  if (!manual) return [];
  let alvo;
  if (manual.asap) alvo = minLisboa(new Date()) + CONFIG.preparoMin;
  else if (/^\d{4}-\d{2}-\d{2}$/.test(manual.dia || "") && /^\d{2}:\d{2}/.test(manual.hora || "")) alvo = minDeTexto(manual.dia, manual.hora.slice(0, 5));
  else return [];
  return (pedidosLoja || []).filter(o => o.status !== "cancelled").map(o => {
    const t = o.deliver_at ? minLisboa(new Date(o.deliver_at)) : minLisboa(new Date(o.created_at)) + CONFIG.preparoMin;
    return { o, t };
  }).filter(x => Math.abs(x.t - alvo) < INTERVALO_ENTREGAS).sort((a, b) => a.t - b.t);
}

function atualizarAvisoHora() {
  if (S.vista !== "adm-pedido-novo") return;
  let el = $("#man-aviso-hora");
  if (!el) {
    const q = $("#man-quando"); if (!q) return;
    q.parentElement.insertAdjacentHTML("beforeend", `<p id="man-aviso-hora" class="aviso" role="status" style="margin:.6rem 0 0" hidden></p>`);
    el = $("#man-aviso-hora");
  }
  const c = conflitosManual();
  el.hidden = !c.length;
  el.textContent = c.length ? "Atenção: fica a menos de 15 minutos de " + c.map(x => "n.º " + x.o.number + " (" + hhmm(x.t) + (x.o.customer_name ? ", " + x.o.customer_name.split(" ")[0] : "") + ")").join(", ") + ". Pode gravar na mesma, se for exceção." : "";
}
$("#folha").addEventListener("input", atualizarAvisoHora);
$("#folha").addEventListener("change", atualizarAvisoHora);
const vManualSemAviso = VISTAS["adm-pedido-novo"];
if (vManualSemAviso) VISTAS["adm-pedido-novo"] = function () {
  const v = vManualSemAviso();
  setTimeout(atualizarAvisoHora, 0);
  return v;
};
