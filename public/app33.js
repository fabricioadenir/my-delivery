/* ---------- Gestão → Mais → Notificações: avisos no telemóvel da equipa (visitas, quem está a finalizar, pedidos) ----------
 * No iPhone só funciona com o site adicionado ao ecrã principal (iOS 16.4 ou mais recente) e aberto a partir desse ícone.
 * As notificações abrem a gestão: ?abrir=raiox ou ?abrir=pedidos.
 */
const PUSH_CHAVE = "BCpBnKLFRZi3tBvQvzhxv3_TUbc4zW_HYgmDzTB8VUEXlJZneYYVYByCvWmDBcaQ-hPoBuWtKJp-GQt2RlRBtIc";
const notif = { estado: "carregando", prefs: null, sub: null };

const pushSuportado = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const eIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const modoApp = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;

/** Chave pública VAPID em bytes, como o PushManager pede. */
function chaveBytes(b64) {
  const s = atob((b64 + "=".repeat((4 - b64.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}

/** Regista o service worker (só nos aparelhos da equipa). */
async function registoSw() {
  if (!pushSuportado()) return null;
  try { return await navigator.serviceWorker.register("/sw.js", { scope: "/" }); } catch (e) { return null; }
}

/** Descobre em que estado estão as notificações neste aparelho. */
async function carregarNotif() {
  notif.prefs = null; notif.sub = null;
  if (!pushSuportado()) { notif.estado = eIos() && !modoApp() ? "instalar" : "sem-suporte"; return; }
  if (Notification.permission === "denied") { notif.estado = "negado"; return; }
  const reg = await registoSw();
  notif.sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!notif.sub) { notif.estado = "desligado"; return; }
  try {
    const r = await api("/admin/push/status", { method: "POST", auth: true, body: { endpoint: notif.sub.endpoint } });
    notif.prefs = r.subscribed_prefs || await guardarSub(notif.sub, { notify_visits: true, notify_checkout: true, notify_orders: true });
    notif.estado = "ligado";
  } catch (e) { notif.estado = "erro"; notif.erro = e.message; }
}

/** Envia a subscrição e as preferências para o servidor. */
async function guardarSub(sub, prefs) {
  const j = sub.toJSON(), ap = typeof rxAparelho === "function" ? await rxAparelho() : {};
  return api("/admin/push/subscribe", { method: "POST", auth: true, body: Object.assign({
    endpoint: sub.endpoint, p256dh: (j.keys || {}).p256dh || "", auth: (j.keys || {}).auth || "", device: (ap.model || ap.os || "").slice(0, 80)
  }, prefs) });
}

/** Ecrã das notificações. */
function vNotif() {
  const caixa = (nome, titulo, desc) => `<label class="opcao"><input type="checkbox" name="${nome}" ${notif.prefs && notif.prefs[nome] ? "checked" : ""}><span><strong>${titulo}</strong><small>${desc}</small></span></label>`;
  const passos = `<ol style="margin:.6rem 0 0 1.2rem;display:grid;gap:.4rem">
      <li>Abra <strong>sakuraesalsushi.pt</strong> no <strong>Safari</strong>.</li>
      <li>Toque em <strong>Partilhar</strong> (quadrado com seta) e depois em <strong>Adicionar ao ecrã principal</strong>.</li>
      <li>Abra a app <strong>Sakura & Sal</strong> que aparece no ecrã principal.</li>
      <li>Entre em <strong>Gerir a loja → Mais → Notificações</strong> e carregue em <strong>Ativar</strong>.</li></ol>`;
  const corpos = {
    carregando: `<p class="rx-nota">A verificar…</p>`,
    instalar: `<p>No iPhone as notificações só funcionam com o site instalado no ecrã principal.</p>${passos}<p class="rx-nota">É preciso iOS 16.4 ou mais recente. Se já tinha adicionado o site antes, apague o ícone antigo e adicione de novo.</p>`,
    "sem-suporte": `<p>Este navegador não permite notificações de sites.</p><p class="rx-nota">No Android use o Chrome. No iPhone, siga estes passos:</p>${passos}`,
    negado: `<p>As notificações foram recusadas neste aparelho.</p><p class="rx-nota">No iPhone: Ajustes → Notificações → Sakura & Sal → Permitir notificações. Depois volte aqui.</p>`,
    erro: `<p class="aviso">${esc(notif.erro || "Não foi possível verificar as notificações.")}</p>`,
    desligado: `<p>Receba um aviso neste telemóvel quando alguém entrar no site, estiver a finalizar um pedido ou enviar um pedido.</p>
      <p style="margin-top:.8rem"><button type="button" class="btn" data-a="notif-ativar">Ativar notificações</button></p>
      <p class="rx-nota">O telemóvel vai pedir autorização: escolha Permitir.</p>`,
    ligado: `<p>As notificações estão ligadas neste aparelho. Escolha o que quer receber:</p>
      <div style="margin-top:.6rem">${caixa("notify_orders", "Pedidos novos", "Número, cliente, valor e localidade.")}${caixa("notify_checkout", "Alguém a finalizar", "Quando um visitante abre o formulário de envio.")}${caixa("notify_visits", "Cada visita ao site", "Origem, aparelho e cidade aproximada. Pode ser muita coisa.")}</div>
      <div class="pilha" style="margin-top:.8rem"><button type="button" class="btn btn-sec btn-bloco" data-a="notif-teste">Enviar notificação de teste</button>
      <button type="button" class="ligacao" data-a="notif-desligar">Desligar neste aparelho</button></div>
      <p class="rx-nota">As suas próprias visitas não dão aviso: este aparelho não conta no Raio-X.</p>`
  };
  return { titulo: "Notificações", corpo: VOLTAR + `<div class="grupo">${corpos[notif.estado] || corpos.erro}</div>` };
}

/** Abre o ecrã depois de verificar o estado. */
async function abrirNotif() {
  notif.estado = "carregando"; abrir("adm-notif");
  await carregarNotif();
  if (S.vista === "adm-notif") renderFolha();
}

VISTAS["adm-notif"] = vNotif;
Object.assign(ACOES, {
  "adm-notif"() { abrirNotif(); },
  async "notif-ativar"() {
    // o pedido de autorização tem de ser a primeira coisa depois do toque (exigência do iPhone)
    let perm;
    try { perm = await Notification.requestPermission(); } catch (e) { perm = "default"; }
    if (perm !== "granted") { notif.estado = perm === "denied" ? "negado" : "desligado"; renderFolha(); if (perm !== "denied") brinde("Sem autorização, não há notificações"); return; }
    try {
      const reg = (await registoSw()) && await navigator.serviceWorker.ready;
      if (!reg) throw new Error("Não foi possível preparar as notificações neste aparelho.");
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveBytes(PUSH_CHAVE) });
      notif.sub = sub;
      notif.prefs = await guardarSub(sub, { notify_visits: true, notify_checkout: true, notify_orders: true });
      notif.estado = "ligado"; renderFolha(); brinde("Notificações ligadas");
    } catch (e) { mostrarErros([e.message || "Não foi possível ligar as notificações."]); }
  },
  async "notif-teste"() {
    try {
      const r = await api("/admin/push/test", { method: "POST", auth: true, body: { endpoint: notif.sub.endpoint } });
      brinde(r.sent ? "Enviada. Deve chegar em segundos" : "Não foi possível enviar. Desligue e ligue de novo");
    } catch (e) { erroGestao(e); }
  },
  async "notif-desligar"() {
    try {
      const ep = notif.sub && notif.sub.endpoint;
      if (notif.sub) await notif.sub.unsubscribe();
      if (ep) await api("/admin/push/remove", { method: "POST", auth: true, body: { endpoint: ep } });
      notif.sub = null; notif.prefs = null; notif.estado = "desligado"; renderFolha(); brinde("Notificações desligadas neste aparelho");
    } catch (e) { erroGestao(e); }
  }
});

$("#folha").addEventListener("change", async ev => {
  if (S.vista !== "adm-notif" || !/^notify_/.test(ev.target.name) || !notif.sub) return;
  const prefs = { notify_visits: !!campo("notify_visits").checked, notify_checkout: !!campo("notify_checkout").checked, notify_orders: !!campo("notify_orders").checked };
  try { notif.prefs = await api("/admin/push/subscribe", { method: "POST", auth: true, body: Object.assign({ endpoint: notif.sub.endpoint }, prefs) }); brinde("Guardado"); }
  catch (e) { ev.target.checked = !ev.target.checked; erroGestao(e); }
});

const vMaisSemNotif = VISTAS["adm-mais"];
VISTAS["adm-mais"] = function () {
  const v = vMaisSemNotif();
  const item = `<button type="button" class="btn btn-sec btn-bloco" data-a="adm-notif" style="justify-content:space-between;border-radius:16px"><span>Notificações</span><small style="font-weight:400;color:var(--tinta-2)">Visitas e pedidos no telemóvel</small></button>`;
  v.corpo = v.corpo.replace(/(data-a="adm-raiox"[\s\S]*?<\/button>)/, "$1" + item);
  return v;
};

/* Ao tocar numa notificação: abre o Raio-X ou os pedidos (só com a sessão da gestão iniciada). */
(function abrirPelaNotificacao() {
  const q = new URLSearchParams(location.search), alvo = q.get("abrir");
  if (!alvo) return;
  q.delete("abrir");
  try { history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "") + location.hash); } catch (e) {}
  if (!LS.get("token", null)) return;
  setTimeout(() => { const a = ACOES[alvo === "pedidos" ? "adm-pedidos" : "adm-raiox"]; if (a) a(); }, 400);
})();

/* Mantém o service worker atualizado nos aparelhos da equipa. */
if (LS.get("token", null) && pushSuportado()) registoSw();
