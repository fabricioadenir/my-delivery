/* ---------- Raio-X: regista, sem dados pessoais, o que os visitantes fazem no site ----------
 * Sem cookies e sem nome/telefone. Cada visita tem um código aleatório guardado só enquanto o separador está aberto.
 * Não conta: aparelhos onde alguém entrou na gestão (ficam marcados), robôs e navegadores automáticos.
 * Os eventos vão em lotes para /api/events; ao sair da página seguem com sendBeacon.
 */
const RX = { fila: [], vistas: new Set(), tempo: null, sessao: null, observador: null };

/** Diz se este aparelho deve ficar de fora (equipa, robôs). */
function rxIgnorar() {
  // quem entra na gestão fica marcado uma vez; depois pode voltar a contar no Raio-X
  if (LS.get("token", null) && !LS.get("equipaMarcada", false)) { LS.set("equipaMarcada", true); LS.set("naoContar", true); }
  return LS.get("naoContar", false) || navigator.webdriver === true;
}

/** Código da visita: novo a cada separador aberto. */
function rxSessao() {
  if (RX.sessao) return RX.sessao;
  try { RX.sessao = sessionStorage.getItem("ss_visita"); } catch (e) { RX.sessao = null; }
  if (!RX.sessao) {
    RX.sessao = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 36);
    try { sessionStorage.setItem("ss_visita", RX.sessao); } catch (e) {}
    RX.nova = true;
  }
  return RX.sessao;
}

/** Junta um evento à fila e agenda o envio. */
function rxEvento(tipo, dados = {}) {
  if (rxIgnorar()) return;
  RX.fila.push(Object.assign({ session_id: rxSessao(), type: tipo }, dados));
  if (RX.fila.length >= 20) rxEnviar();
  else if (!RX.tempo) RX.tempo = setTimeout(rxEnviar, 4000);
}

/** Envia o que está na fila. Ao sair da página usa sendBeacon, que não se perde. */
function rxEnviar(aSair) {
  clearTimeout(RX.tempo); RX.tempo = null;
  if (!RX.fila.length || rxIgnorar()) { RX.fila = []; return; }
  const corpo = JSON.stringify({ events: RX.fila.splice(0, 40) });
  try {
    if (aSair && navigator.sendBeacon && navigator.sendBeacon(API + "/events", new Blob([corpo], { type: "application/json" }))) return;
    fetch(API + "/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: corpo, keepalive: true }).catch(() => {});
  } catch (e) {}
  if (RX.fila.length) RX.tempo = setTimeout(rxEnviar, 1000);
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") rxEnviar(true); });
window.addEventListener("pagehide", () => rxEnviar(true));

/* ---------- de onde veio e em que aparelho ---------- */

/** De onde veio a visita: ?o=flyer (QR do flyer), utm_source, anúncios, redes sociais, Google ou direto. */
function rxOrigem() {
  const q = new URLSearchParams(location.search), ua = navigator.userAgent;
  const marcado = q.get("o") || q.get("utm_source");
  if (marcado) return marcado.toLowerCase().slice(0, 40);
  if (q.get("fbclid") || /FBAN|FBAV|FB_IAB/.test(ua)) return "facebook";
  if (/Instagram/.test(ua)) return "instagram";
  if (q.get("gclid")) return "google-anuncio";
  if (q.get("pedido")) return "acompanhar-pedido";
  let host = "";
  try { host = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : ""; } catch (e) { host = ""; }
  if (!host || host === location.hostname.replace(/^www\./, "") || /sa[ck]uraesalsushi\.pt$/.test(host)) return "direto";
  const conhecidos = [["instagram", /instagram/], ["facebook", /facebook|fb\.com|fb\.me/], ["google", /google\./], ["whatsapp", /whatsapp|wa\.me/], ["tiktok", /tiktok/], ["bing", /bing\./], ["youtube", /youtube|youtu\.be/]];
  const c = conhecidos.find(x => x[1].test(host));
  return c ? c[0] : host.slice(0, 40);
}

/** iPhone pelo tamanho do ecrã (o iPhone não diz o modelo ao site). */
const IPHONES = {
  "320x568": "iPhone SE (1.ª) ou 5s", "375x667": "iPhone SE, 6, 7 ou 8", "414x736": "iPhone 6, 7 ou 8 Plus",
  "375x812": "iPhone X, XS, 11 Pro ou mini", "414x896": "iPhone XR, 11 ou 11 Pro Max", "390x844": "iPhone 12, 13 ou 14",
  "428x926": "iPhone 12/13 Pro Max ou 14 Plus", "393x852": "iPhone 14 Pro, 15 ou 16", "430x932": "iPhone 14 Pro Max, 15 Plus/Pro Max ou 16 Plus",
  "402x874": "iPhone 16 Pro ou 17", "440x956": "iPhone 16/17 Pro Max", "420x912": "iPhone Air"
};
/** Marca a partir do código de modelo Android. */
function rxMarca(m) {
  if (!m) return "";
  if (/^SM-/i.test(m)) return "Samsung " + m;
  if (/^Pixel/i.test(m)) return "Google " + m;
  if (/^(Redmi|POCO|Mi )/i.test(m) || /^(2[0-9]{3}[0-9A-Z]{3,}|M2[0-9]{3})/.test(m)) return "Xiaomi " + m;
  if (/^(CPH|RMX)/i.test(m)) return (/^RMX/i.test(m) ? "Realme " : "Oppo ") + m;
  if (/^(moto|XT[0-9])/i.test(m)) return "Motorola " + m;
  if (/^(VOG|ELE|MAR|ANE|LYA|JNY|NOH|ABR)-/i.test(m)) return "Huawei " + m;
  if (/^(V2[0-9]{3})/i.test(m)) return "Vivo " + m;
  return m;
}

/** Sistema, navegador, modelo e tipo de aparelho. */
async function rxAparelho() {
  const ua = navigator.userAgent, d = {};
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const ios = ua.match(/OS (\d+)[_.](\d+)/), and = ua.match(/Android (\d+(?:\.\d+)?)/);
  d.device = ipad || /Tablet/i.test(ua) || (and && !/Mobile/.test(ua)) ? "tablet" : /Mobi|iPhone|Android/.test(ua) ? "telemovel" : "computador";
  d.os = /iPhone|iPad|iPod/.test(ua) || ipad ? "iOS" + (ios ? " " + ios[1] : "") : and ? "Android " + and[1] : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /CrOS/.test(ua) ? "ChromeOS" : /Linux/.test(ua) ? "Linux" : "Outro";
  d.browser = /Instagram/.test(ua) ? "Instagram" : /FBAN|FBAV|FB_IAB/.test(ua) ? "Facebook" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /EdgA?\/|Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Outro";
  const w = Math.min(screen.width, screen.height), h = Math.max(screen.width, screen.height);
  d.screen = w + "x" + h;
  if (/iPhone/.test(ua)) d.model = IPHONES[d.screen] || "iPhone (" + d.screen + ")";
  else if (ipad) d.model = "iPad";
  else if (and) {
    let m = "";
    try {
      if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues)
        m = (await Promise.race([navigator.userAgentData.getHighEntropyValues(["model"]), new Promise(r => setTimeout(() => r({}), 800))])).model || "";
    } catch (e) { m = ""; }
    if (!m) { const x = ua.match(/Android [\d.]+; (?:[a-z]{2}[-_][a-z]{2}; )?([^;)]+?)(?: Build|\))/i); m = x && x[1] !== "K" ? x[1].trim() : ""; }
    d.model = rxMarca(m) || null;
  } else if (/Macintosh/.test(ua)) d.model = "Mac";
  else if (/Windows/.test(ua)) d.model = "PC Windows";
  return d;
}

/** Regista o início da visita (uma vez por separador). */
async function rxVisita() {
  if (rxIgnorar()) return;
  rxSessao();
  if (!RX.nova) return;
  const repetida = !!LS.get("jaVeio", false);
  LS.set("jaVeio", true);
  const ap = await rxAparelho();
  rxEvento("visita", Object.assign(ap, {
    source: rxOrigem(), lang: (navigator.language || "").slice(0, 12), returning: repetida,
    landing: (location.pathname + (new URLSearchParams(location.search).get("pedido") ? "?pedido" : "")).slice(0, 120)
  }));
}

/* ---------- o que fazem no menu ---------- */

/** Observa as secções do menu: conta uma categoria quando fica à vista (uma vez por visita). */
function rxObservarMenu() {
  if (!("IntersectionObserver" in window)) return;
  if (RX.observador) RX.observador.disconnect();
  RX.observador = new IntersectionObserver(entradas => entradas.forEach(e => {
    if (!e.isIntersecting) return;
    const id = e.target.id.replace(/^cat-/, "");
    if (RX.vistas.has(id)) return;
    RX.vistas.add(id);
    rxEvento("categoria", { category_id: id });
  }), { threshold: 0.3 });
  document.querySelectorAll("#menu section.seccao[id^='cat-']").forEach(s => RX.observador.observe(s));
}

const montarSemRaioX = montarPagina;
montarPagina = function () { montarSemRaioX(); rxObservarMenu(); };

const setQtdSemRaioX = setQtd;
setQtd = function (id, q) {
  const antes = qtd(id);
  setQtdSemRaioX(id, q);
  const dif = qtd(id) - antes;
  if (dif > 0) rxEvento("carrinho_mais", { product_id: id, qty: dif });
  else if (dif < 0) rxEvento("carrinho_menos", { product_id: id, qty: -dif });
};

const abrirSemRaioX = abrir;
abrir = function (v) {
  abrirSemRaioX(v);
  if (v === "carrinho") rxEvento("carrinho_aberto");
  else if (v === "finalizar") rxEvento("finalizar");
  else if (v === "enviado" && S.ultimo) { rxEvento("pedido_enviado", { value: Math.round(((+S.ultimo.sub || 0) + (+S.ultimo.taxa || 0)) * 100) / 100 }); rxEnviar(); }
};

const abrirFotoSemRaioX = abrirFoto;
abrirFoto = function (src, nome, origem) {
  abrirFotoSemRaioX(src, nome, origem);
  const idOrigem = origem && origem.dataset ? origem.dataset.id : "";
  const p = D.produtos.find(x => String(x.id) === idOrigem) || D.produtos.find(x => x.nome === nome);
  if (p) rxEvento("foto", { product_id: p.id });
};

rxVisita();
rxObservarMenu();
