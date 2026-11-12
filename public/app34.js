/* ---------- dados do cliente guardados na base de dados (telemóvel + PIN), opcionais ----------
 * Convidado: encomenda sem guardar nada (só fica o n.º do pedido para o acompanhar).
 * Com dados guardados: nome, moradas e pedidos ficam na conta e aparecem em qualquer telemóvel
 * depois de entrar com o número e o PIN. Esqueceu o PIN ou mudou de telemóvel: a loja envia pelo
 * WhatsApp um link /?recuperar=<código> para escolher um PIN novo.
 */
document.head.insertAdjacentHTML("beforeend", `<style>
.guardar-conta{margin-top:.9rem;border:1.5px dashed var(--linha);border-radius:14px;padding:.3rem .8rem .6rem}
.guardar-conta .opcao{padding-bottom:.4rem}
.guardar-conta .nota{margin:.3rem 0 0;font-size:.9rem}
input[name="pin"],input[name="pinNovo"],input[name="pinAtual"]{letter-spacing:.5em;font-size:1.25rem;max-width:9rem}
.conta-troca{margin-top:1rem;text-align:center}
.conta-topo{margin:0 0 1rem;color:var(--tinta-2)}
</style>`);

const PIN_OK = /^[0-9]{4}$/;
const sessaoCliente = () => LS.get("cliente", null);
const telBonito = t => { const d = String(t || "").replace(/\D/g, ""); return d.length === 9 ? d.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") : String(t || ""); };
const diaPt = iso => new Date(iso).toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", year: "numeric" });
const linkZapLoja = msg => "https://wa.me/" + CONFIG.whatsapp + "?text=" + encodeURIComponent(msg);
const campoPin = (nome, rotulo, ajuda, novo) => `<label class="campo"><span>${rotulo}</span><input type="password" name="${nome}" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="${novo ? "new-password" : "current-password"}">${ajuda ? `<small>${ajuda}</small>` : ""}</label>`;
let contaModo = null, recuperar = null, apagarConta = false;

/**
 * Chama o backend com a sessão do cliente.
 * @param {string} caminho Caminho depois de /api.
 * @param {object} opcoes Opções de api().
 * @param {boolean} silencioso Sem indicador de carregamento.
 * @returns {Promise<any>} Resposta.
 */
async function apiCliente(caminho, opcoes = {}, silencioso = false) {
  try { return await (silencioso ? apiSemIndicador : api)(caminho, Object.assign({ cliente: true }, opcoes)); }
  catch (e) {
    if ((e.status === 401 || e.status === 403) && /Sessão terminada/.test(e.message)) { terminarLocal(); brinde("Sessão terminada. Entre outra vez."); if (S.vista === "conta") renderFolha(); }
    throw e;
  }
}

/**
 * Aplica ao site os dados guardados na conta.
 * @param {object} c Resposta com nome, tel, moradas e pedidos.
 */
function aplicarConta(c) {
  if (!c) return;
  S.perfil = { nome: c.nome, tel: telBonito(c.tel) };
  S.moradas = arr(c.moradas);
  S.pedidos = arr(c.pedidos).map(o => ({ id: o.id, num: String(o.number), data: diaPt(o.created_at), itens: arr(o.itens), total: +o.total }));
  arr(c.pedidos).forEach(o => { estadosCliente[o.id] = o.status; });
  LS.set("perfil", S.perfil); LS.set("moradas", S.moradas); LS.set("pedidos", S.pedidos);
  if (S.rascunho && !S.rascunho.nome) S.rascunho.nome = S.perfil.nome;
  if (S.rascunho && !S.rascunho.tel) S.rascunho.tel = S.perfil.tel;
}

/**
 * Guarda a sessão recebida ao entrar, criar ou recuperar.
 * @param {{token:string, conta:object}} res Resposta do backend.
 */
function entrouConta(res) {
  LS.set("cliente", res.token);
  contaModo = null; recuperar = null; apagarConta = false;
  aplicarConta(res.conta);
}

/** Apaga deste aparelho a sessão e os dados do cliente. */
function terminarLocal() {
  ["cliente", "perfil", "moradas", "pedidos"].forEach(LS.del);
  S.perfil = null; S.moradas = []; S.pedidos = []; S.rascunho = null;
}

/** Envia para a conta o nome e as moradas atuais. */
async function sincronizarConta() {
  if (!sessaoCliente() || !S.perfil) return;
  try { aplicarConta(await apiCliente("/cliente/eu", { method: "PUT", body: { nome: S.perfil.nome, moradas: S.moradas } }, true)); }
  catch (e) { brinde("Não foi possível guardar na sua conta. Verifique a internet."); }
  if (S.vista === "conta") renderFolha();
}

/** Atualiza os dados da conta a partir do servidor. */
async function refrescarConta() {
  if (!sessaoCliente()) return;
  try { aplicarConta(await apiCliente("/cliente/eu", {}, true)); if (S.vista === "conta") renderFolha(); atualizarPagina(); }
  catch (e) { /* sem internet: fica com o que está no aparelho */ }
}

/** Mostra erros na folha. */
function errosFolha(lista) {
  const el = $("#erros"); if (!el) return brinde(lista[0]);
  el.innerHTML = `<div class="erros" role="alert" tabindex="-1">${lista.map(esc).join("<br>")}</div>`;
  $("#erros .erros").focus();
}

/* ---------- vistas da conta ---------- */

/** Entrar ou guardar os dados pela primeira vez. */
function vContaSemSessao() {
  const modo = contaModo || (S.perfil ? "criar" : "entrar"), p = S.perfil || {};
  const soAqui = S.perfil ? `<p class="aviso" style="margin:0 0 1rem">Os seus dados estão só neste aparelho. Se mudar de telemóvel ou de navegador, perdem-se. Guarde-os com um PIN para os ter em qualquer lado.</p>` : "";
  if (modo === "entrar") return { titulo: "Entrar",
    corpo: `<p class="conta-topo">Entre com o seu telemóvel e PIN para ver as suas moradas e pedidos, em qualquer aparelho.</p>
      <div class="grupo"><label class="campo" style="margin-top:0"><span>Telemóvel</span><input type="tel" name="tel" value="${esc(p.tel || "")}" autocomplete="tel" inputmode="tel"></label>
      ${campoPin("pin", "PIN", "", false)}</div><div id="erros"></div>
      <p class="conta-troca"><button type="button" class="ligacao" data-a="conta-esqueci">Esqueci o PIN</button></p>
      <p class="conta-troca"><button type="button" class="ligacao" data-a="conta-modo" data-m="criar">Ainda não guardou os seus dados? Guardar agora</button></p>
      <p class="nota" style="text-align:center">Não é obrigatório. Pode sempre encomendar como convidado.</p>`,
    pe: `<button type="button" class="btn btn-bloco" data-a="conta-entrar">Entrar</button>` };
  return { titulo: "Guardar os meus dados",
    corpo: soAqui + `<p class="conta-topo">Guarde o nome, o telemóvel e as moradas. Da próxima vez a morada já aparece preenchida e pode repetir um pedido com um toque, em qualquer telemóvel.</p>
      <div class="grupo"><label class="campo" style="margin-top:0"><span>Nome</span><input type="text" name="nome" value="${esc(p.nome || "")}" autocomplete="name"></label>
      <label class="campo"><span>Telemóvel</span><input type="tel" name="tel" value="${esc(p.tel || "")}" autocomplete="tel" inputmode="tel"></label>
      ${campoPin("pin", "Escolha um PIN de 4 números", "Serve para entrar noutro telemóvel. Sem ele, ninguém vê os seus dados nem os seus pedidos, mesmo sabendo o seu número. Evite 1234 ou 1111.", true)}</div>
      <div id="erros"></div>
      <p class="conta-troca"><button type="button" class="ligacao" data-a="conta-modo" data-m="entrar">Já guardou os seus dados? Entrar</button></p>
      <p class="nota" style="text-align:center">É opcional. Pode sempre encomendar como convidado, sem guardar nada.</p>
      ${S.perfil ? `<p class="conta-troca"><button type="button" class="ligacao" data-a="sair">${S.confirmarSair ? "Confirmar: apagar os dados deste aparelho" : "Apagar os dados deste aparelho"}</button></p>` : ""}`,
    pe: `<button type="button" class="btn btn-bloco" data-a="conta-criar">Guardar os meus dados</button>` };
}

/** Escolher um PIN novo a partir do link enviado pelo WhatsApp. */
function vRecuperar() {
  const r = recuperar;
  if (!r.info) return { titulo: "Link de recuperação",
    corpo: `<p class="conta-topo">${r.erro ? esc(r.erro) : "A verificar o link…"}</p>
      ${r.erro ? `<div class="pilha"><a class="btn btn-zap btn-bloco" href="${esc(linkZapLoja("Olá! Preciso de um link novo para escolher o PIN do site."))}" target="_blank" rel="noopener">Pedir um link novo no WhatsApp</a><button type="button" class="ligacao" data-a="conta-modo" data-m="entrar">Entrar com o PIN</button></div>` : ""}` };
  return { titulo: "Escolher um PIN novo",
    corpo: `<p class="conta-topo">Olá ${esc(r.info.nome)}! Escolha um PIN novo para os dados guardados com o número terminado em ${esc(r.info.tel_fim)}.</p>
      <div class="grupo">${campoPin("pinNovo", "PIN novo, 4 números", "Evite 1234 ou 1111. Este link só funciona uma vez.", true)}</div><div id="erros"></div>`,
    pe: `<button type="button" class="btn btn-bloco" data-a="recuperar-guardar">Guardar PIN e entrar</button>` };
}

const vContaComConta = VISTAS.conta;
/** Conta com sessão: dados, moradas, pedidos (com Pedir de novo), PIN e sair. */
function vContaComSessao() {
  const v = vContaComConta();
  v.titulo = "Os meus dados";
  v.corpo = `<p class="conta-topo">Guardados na sua conta. Em qualquer telemóvel, entre com o número ${esc(S.perfil.tel)} e o seu PIN.</p>` + v.corpo
    .replace(/<input type="tel" name="tel"([^>]*)>/, `<input type="tel" name="tel"$1 readonly aria-readonly="true">`)
    .replace("<h3>Pedidos anteriores</h3>", "<h3>Os meus pedidos</h3>")
    .replace(/<p><button type="button" class="ligacao" data-a="sair">[\s\S]*?<\/button><\/p>/, "")
    + `<div class="grupo"><h3>Mudar o PIN</h3>${campoPin("pinAtual", "PIN atual", "", false)}${campoPin("pinNovo", "PIN novo", "", true)}
        <div id="erros-pin"></div><p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="conta-pin">Mudar PIN</button></p></div>
      <div class="pilha"><button type="button" class="btn btn-sec btn-bloco" data-a="conta-sair">Sair deste telemóvel</button>
        <button type="button" class="ligacao" data-a="conta-apagar">${apagarConta ? "Confirmar: apagar os meus dados guardados" : "Apagar os meus dados guardados"}</button></div>`;
  return v;
}

VISTAS.conta = function () {
  if (recuperar) return vRecuperar();
  return sessaoCliente() && S.perfil ? vContaComSessao() : vContaSemSessao();
};

/* ---------- finalizar: convidado ou guardar os dados ---------- */
const vFinalizarSemConta = VISTAS.finalizar;
VISTAS.finalizar = function () {
  const v = vFinalizarSemConta(), r = S.rascunho;
  let bloco;
  if (sessaoCliente() && S.perfil) bloco = `<p class="nota" style="margin:.8rem 0 0">A encomendar com os dados guardados de <strong>${esc(S.perfil.nome)}</strong>. O pedido fica em "Os meus dados".</p>`;
  else {
    const entrar = r.contaModo === "entrar";
    bloco = `<div class="guardar-conta">
      <label class="opcao"><input type="checkbox" name="guardarConta" ${r.guardarConta ? "checked" : ""}><span><strong>Guardar os meus dados</strong><small>Da próxima vez a morada já aparece preenchida e pode repetir este pedido com um toque, em qualquer telemóvel. Fica protegido por um PIN.</small></span></label>
      <div id="pin-conta">${entrar ? `<p class="aviso" style="margin:0 0 .3rem">Este número já tem dados guardados. Escreva o seu PIN para entrar.</p>` : ""}
        ${campoPin("pin", entrar ? "O seu PIN" : "Escolha um PIN de 4 números", entrar ? `<button type="button" class="ligacao" data-a="conta-esqueci">Esqueci o PIN</button>` : "Serve para ver os seus dados noutro telemóvel. Evite 1234 ou 1111.", !entrar)}</div>
      <p class="nota" id="nota-convidado">Sem marcar, encomenda como convidado e nada fica gravado.</p>
      <p class="nota"><button type="button" class="ligacao" data-a="abrir-conta">Já guardou os seus dados? Entrar</button></p></div>`;
  }
  v.corpo = v.corpo.replace("</fieldset>", bloco + "</fieldset>");
  return v;
};

const novoRascunhoBase = novoRascunho;
novoRascunho = function () { return Object.assign(novoRascunhoBase(), { guardarConta: false, pin: "", contaModo: "criar", guardar: true }); };

const sincronizarBase = sincronizar;
sincronizar = function () {
  sincronizarBase();
  const r = S.rascunho, com = !!(sessaoCliente() && S.perfil), cx = campo("guardar");
  if (cx) cx.closest("label").hidden = !com;
  const caixa = $("#pin-conta"); if (caixa) caixa.hidden = !r.guardarConta;
  const nota = $("#nota-convidado"); if (nota) nota.hidden = !!r.guardarConta;
};
$("#folha").addEventListener("input", ev => {
  if (S.vista !== "finalizar" || !S.rascunho) return;
  if (ev.target.name === "pin") S.rascunho.pin = ev.target.value.replace(/\D/g, "").slice(0, 4);
});
$("#folha").addEventListener("change", ev => {
  if (S.vista !== "finalizar" || !S.rascunho || ev.target.name !== "guardarConta") return;
  S.rascunho.guardarConta = ev.target.checked; sincronizar();
  if (ev.target.checked) { const p = campo("pin"); if (p) p.focus(); }
});

const enviarSemConta = enviar;
/** Antes de registar o pedido, cria ou abre a conta se o cliente pediu para guardar os dados. */
enviar = async function () {
  lerFinalizar();
  const r = S.rascunho;
  if (sessaoCliente() || !r || !r.guardarConta) return enviarSemConta();
  const v = validarCheckout(r);
  if (v.erros.length) return enviarSemConta();
  const pin = campo("pin") ? campo("pin").value : r.pin;
  if (!PIN_OK.test(pin)) return errosFolha([r.contaModo === "entrar" ? "Escreva o seu PIN de 4 números." : "Escolha um PIN de 4 números para guardar os seus dados, ou desmarque \"Guardar os meus dados\"."]);
  let res;
  try {
    if (r.contaModo === "entrar") res = await api("/cliente/entrar", { method: "POST", body: { tel: r.tel.trim(), pin } });
    else {
      const nova = r.morada === "nova" ? [{ id: "m" + Date.now(), rotulo: r.rotulo.trim() || "Casa", rua: r.rua.trim(), localidade: r.localidade.trim(), zona: r.zona, ref: r.ref.trim(), padrao: !S.moradas.length }] : [];
      res = await api("/cliente/criar", { method: "POST", body: { nome: r.nome.trim(), tel: r.tel.trim(), pin, moradas: S.moradas.concat(nova) } });
      r.guardar = false;   // a morada nova já foi com os dados
    }
  } catch (e) {
    if (e.status === 409) { r.contaModo = "entrar"; r.pin = ""; renderFolha(); return errosFolha([e.message]); }
    if (e.status === 404 && r.contaModo === "entrar") { r.contaModo = "criar"; r.pin = ""; renderFolha(); return errosFolha(["Não há dados guardados com este número. Escolha um PIN para os guardar."]); }
    return errosFolha([e.message]);
  }
  if (r.contaModo === "entrar") {
    const m = r.morada !== "nova" && S.moradas.find(x => x.id === r.morada);
    if (m) Object.assign(r, { morada: "nova", rotulo: m.rotulo, rua: m.rua, localidade: m.localidade, zona: m.zona, ref: m.ref || "" });
    if (r.morada === "nova") r.guardar = !arr(res.conta && res.conta.moradas).some(x => x.rua === r.rua.trim() && x.localidade === r.localidade.trim());
  }
  const nome = r.nome;
  entrouConta(res);
  r.nome = nome; r.guardarConta = false; r.pin = "";
  renderFolha();
  brinde("Dados guardados");
  return enviarSemConta();
};

const guardarComPerfil = guardarNoDispositivo;
/**
 * Depois de um pedido: com conta guarda moradas novas na conta; como convidado só fica o pedido para acompanhar.
 * @param {object} r Rascunho do checkout.
 * @param {object} m Morada usada.
 * @param {object} p Pedido concluído.
 */
guardarNoDispositivo = function (r, m, p) {
  if (sessaoCliente() && S.perfil) {
    const antes = S.moradas.length, tel = S.perfil.tel, nomeAntes = S.perfil.nome;
    guardarComPerfil(r, m, p);
    S.perfil.tel = tel; LS.set("perfil", S.perfil);   // o número da conta não muda com o do pedido
    if (S.moradas.length !== antes || S.perfil.nome !== nomeAntes) sincronizarConta();
    return;
  }
  const dois = Date.now() - 2 * 86400000;
  S.pedidos = S.pedidos.filter(x => x.id || x.texto).slice(0, 10);
  S.pedidos.unshift({ num: p.num, data: p.data, itens: S.cart.map(i => ({ id: i.id, q: i.q, nome: ITEM[i.id].nome })), total: p.sub + p.taxa, quando: Date.now() });
  if (!S.perfil) S.pedidos = S.pedidos.filter(x => !x.quando || x.quando > dois);
  LS.set("pedidos", S.pedidos);
  S.cart = []; LS.set("cart", S.cart); S.rascunho = null; S.ultimo = p;
};

/* ---------- ações ---------- */
const ACOES_ANTES = Object.assign({}, ACOES);
const lerTel = () => (campo("tel") ? campo("tel").value.trim() : "");

Object.assign(ACOES, {
  async "abrir-conta"(b) {
    if (recuperar && !recuperar.info) recuperar = null;
    await ACOES_ANTES["abrir-conta"](b);
    refrescarConta();
  },
  "conta-modo"(b) { contaModo = b.dataset.m; recuperar = null; S.erros = []; if (S.vista !== "conta") abrir("conta"); else renderFolha(); },
  "conta-esqueci"() {
    const tel = lerTel() || (S.rascunho && S.rascunho.tel) || "";
    window.open(linkZapLoja("Olá! Esqueci o PIN do site" + (tel ? " (número " + tel + ")" : "") + ". Podem enviar-me o link para escolher um PIN novo?"), "_blank", "noopener");
  },
  async "conta-entrar"() {
    const tel = lerTel(), pin = campo("pin").value;
    if (tel.replace(/\D/g, "").length < 9) return errosFolha(["Escreva o seu número de telemóvel."]);
    if (!PIN_OK.test(pin)) return errosFolha(["Escreva o seu PIN de 4 números."]);
    const locais = S.moradas.slice();
    let res;
    try { res = await api("/cliente/entrar", { method: "POST", body: { tel, pin } }); }
    catch (e) { return errosFolha([e.message]); }
    entrouConta(res);
    // moradas que estavam só neste aparelho passam para a conta
    const novas = locais.filter(l => !S.moradas.some(x => x.rua === l.rua && x.localidade === l.localidade));
    if (novas.length) { S.moradas = S.moradas.concat(novas.map(x => Object.assign({}, x, { padrao: false }))); sincronizarConta(); }
    brinde("Olá, " + S.perfil.nome.split(" ")[0] + "!"); renderFolha(); atualizarPagina();
  },
  async "conta-criar"() {
    const nome = campo("nome").value.trim(), tel = lerTel(), pin = campo("pin").value, e = [];
    if (nome.length < 2) e.push("Escreva o seu nome.");
    if (tel.replace(/\D/g, "").length < 9) e.push("Escreva um número de telemóvel com 9 dígitos.");
    if (!PIN_OK.test(pin)) e.push("Escolha um PIN de 4 números.");
    if (e.length) return errosFolha(e);
    let res;
    try { res = await api("/cliente/criar", { method: "POST", body: { nome, tel, pin, moradas: S.moradas } }); }
    catch (err) { if (err.status === 409) { contaModo = "entrar"; renderFolha(); } return errosFolha([err.message]); }
    entrouConta(res);
    brinde("Dados guardados"); renderFolha(); atualizarPagina();
  },
  async "recuperar-guardar"() {
    const pin = campo("pinNovo").value;
    if (!PIN_OK.test(pin)) return errosFolha(["Escolha um PIN de 4 números."]);
    try { entrouConta(await api("/cliente/recuperar", { method: "POST", body: { codigo: recuperar.codigo, pin } })); }
    catch (e) { return errosFolha([e.message]); }
    brinde("PIN novo guardado"); renderFolha(); atualizarPagina();
  },
  async "conta-pin"() {
    const atual = campo("pinAtual").value, novo = campo("pinNovo").value, out = $("#erros-pin");
    const erro = t => { out.innerHTML = `<div class="erros" role="alert" tabindex="-1">${esc(t)}</div>`; $(".erros", out).focus(); };
    if (!PIN_OK.test(atual) || !PIN_OK.test(novo)) return erro("Escreva o PIN atual e o novo, com 4 números cada.");
    try { await apiCliente("/cliente/pin", { method: "PUT", body: { atual, novo } }); }
    catch (e) { return erro(e.message); }
    brinde("PIN mudado"); renderFolha();
  },
  async "conta-sair"() {
    try { await apiCliente("/cliente/sair", { method: "POST" }, true); } catch (e) { /* sai neste aparelho na mesma */ }
    terminarLocal(); contaModo = "entrar"; brinde("Saiu deste telemóvel"); renderFolha(); atualizarPagina();
  },
  async "conta-apagar"() {
    if (!apagarConta) { apagarConta = true; return renderFolha(); }
    try { await apiCliente("/cliente/eu", { method: "DELETE" }); }
    catch (e) { return brinde(e.message); }
    terminarLocal(); apagarConta = false; contaModo = null; brinde("Dados apagados"); fechar();
  },
  "guardar-perfil"(b) {
    if (!sessaoCliente()) return ACOES_ANTES["guardar-perfil"](b);
    const nome = campo("nome").value.trim();
    if (nome.length < 2) return errosFolha(["Escreva o seu nome."]);
    S.perfil.nome = nome; LS.set("perfil", S.perfil);
    if (S.rascunho) S.rascunho.nome = nome;
    sincronizarConta().then(() => brinde("Dados guardados"));
  },
  "morada-guardar"(b) { const n = S.moradas.length, antes = JSON.stringify(S.moradas); ACOES_ANTES["morada-guardar"](b); if (JSON.stringify(S.moradas) !== antes || S.moradas.length !== n) sincronizarConta(); },
  "morada-apagar"(b) { ACOES_ANTES["morada-apagar"](b); sincronizarConta(); },
  "morada-principal"(b) { ACOES_ANTES["morada-principal"](b); sincronizarConta(); },
  sair(b) {
    if (sessaoCliente()) return ACOES["conta-sair"](b);
    ACOES_ANTES.sair(b);
    if (S.vista === "conta") renderFolha();
  }
});

/* ---------- gestão: link de recuperação para quem tem dados guardados ---------- */
let contasCli = {};
const chaveTel = t => { let d = String(t || "").replace(/\D/g, ""); if (d.startsWith("00351")) d = d.slice(5); else if (d.startsWith("351") && d.length === 12) d = d.slice(3); return d; };
const linkRecuperar = c => location.origin + "/?recuperar=" + c.code;

/** Carrega (sem bloquear) os números que têm dados guardados. */
async function carregarContasCli() {
  try { contasCli = Object.fromEntries((await apiSemIndicador("/admin/client-accounts", { auth: true })).map(c => [c.phone, c])); }
  catch (e) { /* sem esta lista a gestão funciona na mesma */ }
}
const carregarInicioSemContas = carregarInicio;
carregarInicio = async function (silencioso) { const [r] = await Promise.all([carregarInicioSemContas(silencioso), carregarContasCli()]); return r; };

const contactosSemRecuperar = contactosPedido;
/**
 * No aviso de "confirmado", quem tem dados guardados recebe também o link para escolher um PIN novo.
 * @param {object} p Pedido.
 * @returns {string} HTML das ligações.
 */
contactosPedido = function (p) {
  const html = contactosSemRecuperar(p), c = contasCli[chaveTel(p.customer_phone)];
  if (!c || (p.status !== "confirmed" && !c.locked)) return html;
  const extra = encodeURIComponent("\nMudou de telemóvel ou esqueceu o PIN do site? Escolha um novo aqui: " + linkRecuperar(c));
  return html.replace('" target="_blank" rel="noopener">Avisar pelo WhatsApp', extra + '" target="_blank" rel="noopener">Avisar pelo WhatsApp');
};

/** Lista de clientes (igual à da gestão) com a marca "Dados guardados" e o envio do link de PIN novo. */
listaClientes = function () {
  const n = agora(), limite = new Date(Date.UTC(n.y, n.m - 1, n.d - 30)).toISOString().slice(0, 10), q = buscaCliente.toLowerCase();
  const tipo = c => c.last_order < limite ? "Inativo" : c.orders > 1 ? "Recorrente" : "Novo";
  return clientes.filter(c => !q || (c.name + " " + c.phone).toLowerCase().includes(q)).map(c => {
    const d = chaveTel(c.phone), tel = d.length === 9 ? "351" + d : d, conta = contasCli[d];
    const msg = conta ? "Olá " + String(c.name).split(" ")[0] + ", para escolher um PIN novo e ver os seus dados no site, abra: " + linkRecuperar(conta) + " . " + CONFIG.nome : "";
    return `<div class="cartao"><div><strong>${esc(c.name)}</strong><span class="etiqueta">${tipo(c)}</span>${conta ? `<span class="etiqueta">${conta.locked ? "PIN bloqueado" : "Dados guardados"}</span>` : ""}<small>${esc(c.phone)}${c.zone ? ", " + esc(c.zone) : ""}</small><small>${c.orders} ${c.orders === 1 ? "pedido" : "pedidos"}, ${eur(+c.total)} no total, ticket de ${eur(+c.ticket)}. Último em ${fmtDia(c.last_order)}${c.favorite ? ". Pede mais: " + esc(c.favorite) : ""}</small></div>
      <div class="acoes" style="flex-direction:column;align-items:end;gap:.4rem"><a class="ligacao" href="https://wa.me/${tel}" target="_blank" rel="noopener">WhatsApp</a>${conta ? `<a class="ligacao" href="https://wa.me/${tel}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Enviar link de PIN novo</a>` : ""}</div></div>`;
  }).join("") || `<p style="color:var(--tinta-2)">${clientes.length ? "Nenhum cliente com esse nome ou número." : "Os clientes aparecem aqui depois do primeiro pedido."}</p>`;
};
const abrirClientesSemContas = ACOES["adm-clientes"];
ACOES["adm-clientes"] = async function (b) { await carregarContasCli(); return abrirClientesSemContas(b); };

/* ---------- arranque ---------- */
(async function () {
  const q = new URLSearchParams(location.search), codigo = q.get("recuperar");
  if (codigo) {
    q.delete("recuperar");
    history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "") + location.hash);
    recuperar = { codigo, info: null, erro: "" };
    abrir("conta");
    try { recuperar.info = await apiSemIndicador("/cliente/recuperar/" + encodeURIComponent(codigo)); }
    catch (e) { recuperar.erro = e.status === 404 ? e.message : "Não foi possível verificar o link. Verifique a internet e abra-o outra vez."; }
    if (S.vista === "conta") renderFolha();
    return;
  }
  refrescarConta();
})();
