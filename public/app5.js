/* ---------- ligação ao backend: menu e pedidos ---------- */
const API = "/api";

/**
 * Chama o backend e devolve o JSON da resposta.
 * @param {string} caminho Caminho depois de /api.
 * @param {{method?:string, body?:object, auth?:boolean}} opcoes Método, corpo e se envia a sessão.
 * @returns {Promise<any>} Resposta do servidor.
 */
async function api(caminho, opcoes = {}) {
  const cab = { "Content-Type": "application/json" };
  const token = opcoes.auth ? LS.get("token", null) : null;
  if (token) cab.Authorization = "Bearer " + token;
  const r = await fetch(API + caminho, { method: opcoes.method || "GET", headers: cab, body: opcoes.body ? JSON.stringify(opcoes.body) : undefined });
  let d = null;
  try { d = await r.json(); } catch (e) { d = null; }
  if (r.ok) return d;
  const erro = new Error(d && typeof d.detail === "string" ? d.detail : "Não foi possível concluir. Tente outra vez.");
  erro.status = r.status;
  throw erro;
}

/**
 * Converte os dados do backend no formato usado pelo site.
 * @param {object} d Resposta de /menu ou /admin/data.
 * @returns {{categorias:object[], produtos:object[], loja:object}} Dados do site.
 */
function mapear(d) {
  const s = d.settings || {}, horario = { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
  CONFIG.nome = s.business_name || CONFIG.nome;
  CONFIG.whatsapp = s.whatsapp || CONFIG.whatsapp;
  CONFIG.telefoneVisivel = s.phone_display || CONFIG.telefoneVisivel;
  CONFIG.intervaloMin = s.slot_minutes || CONFIG.intervaloMin;
  if (s.payment_methods && s.payment_methods.length) CONFIG.pagamentos = s.payment_methods;
  (d.hours || []).forEach(h => { horario[h.weekday] = h.is_open ? [h.opens.slice(0, 5), h.closes.slice(0, 5)] : null; });
  return {
    categorias: (d.categories || []).map(c => ({ id: c.id, nome: c.name, desc: c.description || "", vista: c.layout === "cards" ? "cartoes" : "lista" })),
    produtos: (d.products || []).map(p => ({ id: p.id, cat: p.category_id, nome: p.name, desc: p.description || "", preco: +p.price, min: p.min_qty, pecas: p.pieces || "", foto: p.photo_url || "", arte: p.illustration || "", ativo: p.active !== false })),
    loja: { pedidoMinimo: +s.min_order || 0, preparoMin: s.prep_minutes || 0, horario, zonas: (d.zones || []).map(z => ({ id: z.id, nome: z.name, taxa: +z.fee })) }
  };
}

/**
 * Aplica dados novos ao site e volta a desenhar a página.
 * @param {object} d Resposta do backend.
 */
function aplicarDados(d) {
  D = mapear(d);
  indexar();
  S.cart = S.cart.filter(i => ITEM[i.id]);
  LS.set("cart", S.cart);
  S.rascunho = null;
  montarPagina(); atualizarEstado(); atualizarPagina();
}

/** Carrega o menu público a partir do backend. */
async function carregarMenu() {
  try { aplicarDados(await api("/menu")); }
  catch (e) { brinde("Não foi possível carregar o menu. Atualize a página."); }
}

/**
 * Lê a morada escolhida no checkout e junta os erros encontrados.
 * @param {object} r Rascunho do checkout.
 * @param {string[]} e Lista de erros a preencher.
 * @returns {object|undefined} Morada escolhida.
 */
function moradaEscolhida(r, e) {
  if (r.morada !== "nova") {
    const g = S.moradas.find(x => x.id === r.morada);
    if (!g) e.push("Escolha uma morada de entrega.");
    else if (!ZONA[g.zona]) e.push("Essa morada fica fora das zonas de entrega. Escolha ou escreva outra.");
    return g;
  }
  const m = { rotulo: r.rotulo.trim() || "Casa", rua: r.rua.trim(), localidade: r.localidade.trim(), zona: r.zona, ref: r.ref.trim() };
  if (!m.rua) e.push("Escreva a rua e o número da morada.");
  if (!m.localidade) e.push("Escreva a localidade ou aldeia.");
  if (!ZONA[m.zona]) e.push("Escolha o concelho da entrega.");
  return m;
}

/**
 * Lê o momento de entrega escolhido e junta os erros encontrados.
 * @param {object} r Rascunho do checkout.
 * @param {string[]} e Lista de erros a preencher.
 * @returns {{texto?:string, local?:string|null}} Texto para o cliente e data local para o backend.
 */
function quandoEscolhido(r, e) {
  if (r.quando === "ja") {
    if (podeJa()) return { texto: "O mais cedo possível", local: null };
    e.push("Já não conseguimos entregar agora. Agende um dia e uma hora.");
    return {};
  }
  const d = diasDisponiveis().find(x => x.chave === r.dia);
  if (d && d.slots.includes(r.hora)) return { texto: d.rotulo + " às " + r.hora, local: r.dia + "T" + r.hora };
  e.push("Escolha o dia e a hora da entrega.");
  return {};
}

/**
 * Valida o checkout.
 * @param {object} r Rascunho do checkout.
 * @returns {{erros:string[], morada:object, quando:string, local:string|null}} Resultado da validação.
 */
function validarCheckout(r) {
  const erros = problemasCarrinho().slice();
  if (!S.cart.length) erros.push("O carrinho está vazio.");
  if (r.nome.trim().length < 2) erros.push("Escreva o seu nome.");
  if (r.tel.replace(/\D/g, "").length < 9) erros.push("Escreva um número de telemóvel com 9 dígitos.");
  const morada = moradaEscolhida(r, erros), q = quandoEscolhido(r, erros);
  return { erros, morada, quando: q.texto, local: q.local };
}

/**
 * Monta o corpo do pedido para o backend. Os preços não são enviados.
 * @param {object} r Rascunho do checkout.
 * @param {object} v Resultado de validarCheckout.
 * @returns {object} Corpo de POST /orders.
 */
function corpoPedido(r, v) {
  return {
    customer_name: r.nome.trim(), customer_phone: r.tel.trim(), zone_id: v.morada.zona,
    address_street: v.morada.rua, address_locality: v.morada.localidade, address_reference: v.morada.ref || null,
    asap: r.quando === "ja", deliver_at_local: v.local || null,
    items: S.cart.map(i => ({ product_id: i.id, quantity: i.q })),
    payment_method: r.pag, change_for: r.pag === "Dinheiro" ? r.troco.trim() || null : null,
    extras: { pauzinhos: +r.pauzinhos || 0, soja: !!r.soja, wasabi: !!r.wasabi, gengibre: !!r.gengibre },
    allergy_notes: r.obs.trim() || null
  };
}

/**
 * Descreve os acompanhamentos escolhidos.
 * @param {object} r Rascunho do checkout.
 * @returns {string} Texto para a mensagem.
 */
function acompanhamentos(r) {
  const ac = [];
  if (+r.pauzinhos) ac.push(r.pauzinhos + (r.pauzinhos === "1" ? " par" : " pares") + " de pauzinhos");
  if (r.soja) ac.push("molho de soja");
  if (r.wasabi) ac.push("wasabi");
  if (r.gengibre) ac.push("gengibre");
  return ac.length ? ac.join(", ") : "Nenhum";
}

/**
 * Guarda conta, morada e histórico neste dispositivo depois de um pedido registado.
 * @param {object} r Rascunho do checkout.
 * @param {object} m Morada usada.
 * @param {object} p Pedido concluído.
 */
function guardarNoDispositivo(r, m, p) {
  S.perfil = { nome: p.nome, tel: p.tel }; LS.set("perfil", S.perfil);
  if (r.morada === "nova" && r.guardar) {
    S.moradas.push({ id: "m" + Date.now(), rotulo: m.rotulo, rua: m.rua, localidade: m.localidade, zona: m.zona, ref: m.ref, padrao: !S.moradas.length });
    LS.set("moradas", S.moradas);
  }
  S.pedidos.unshift({ num: p.num, data: p.data, itens: S.cart.map(i => ({ id: i.id, q: i.q, nome: ITEM[i.id].nome })), total: p.sub + p.taxa, texto: p.texto });
  S.pedidos = S.pedidos.slice(0, 20); LS.set("pedidos", S.pedidos);
  S.cart = []; LS.set("cart", S.cart); S.rascunho = null; S.ultimo = p;
}

/**
 * Mostra o pedido registado e prepara a mensagem do WhatsApp com os valores do backend.
 * @param {object} r Rascunho do checkout.
 * @param {object} v Resultado de validarCheckout.
 * @param {object} res Resposta de POST /orders.
 */
function concluirPedido(r, v, res) {
  const n = agora(), m = v.morada;
  const p = {
    num: String(res.number), data: doisD(n.d) + "/" + doisD(n.m) + "/" + n.y, nome: r.nome.trim(), tel: r.tel.trim(),
    itens: (res.items || []).map(i => ({ q: i.quantity, nome: i.name, preco: +i.unit_price })),
    quando: v.quando, morada: { rua: m.rua, localidade: m.localidade, ref: m.ref || "" }, zona: res.zone_name,
    acomp: acompanhamentos(r), pag: r.pag, troco: r.pag === "Dinheiro" ? r.troco.trim() : "", obs: r.obs.trim(),
    sub: +res.subtotal, taxa: +res.delivery_fee
  };
  p.texto = textoPedido(p);
  p.url = "https://wa.me/" + CONFIG.whatsapp + "?text=" + encodeURIComponent(p.texto);
  guardarNoDispositivo(r, m, p);
  abrir("enviado");
}

/** Valida o checkout, regista o pedido no backend e mostra o passo do WhatsApp. */
async function enviar() {
  lerFinalizar();
  const r = S.rascunho, v = validarCheckout(r), botao = $('#folha-pe [data-a="enviar"]');
  const falhar = e => { $("#erros").innerHTML = `<div class="erros" role="alert" tabindex="-1"><strong>Falta corrigir:</strong><ul>${e.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`; $("#erros .erros").focus(); };
  if (v.erros.length) return falhar(v.erros);
  if (botao.getAttribute("aria-disabled") === "true") return;
  botao.setAttribute("aria-disabled", "true"); botao.textContent = "A registar o pedido…";
  try { concluirPedido(r, v, await api("/orders", { method: "POST", body: corpoPedido(r, v) })); }
  catch (e) {
    botao.setAttribute("aria-disabled", "false"); botao.textContent = "Enviar pedido pelo WhatsApp";
    falhar([e.message]);
  }
}
