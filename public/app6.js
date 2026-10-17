/* ---------- gestão da loja ligada ao backend ---------- */
const ESTADOS = { received: "Recebido", confirmed: "Confirmado", preparing: "Em preparação", ready: "Pronto", out_for_delivery: "Em entrega", delivered: "Entregue", cancelled: "Cancelado" };
const CAMPO = "width:100%;min-height:48px;padding:.65rem .8rem;border:1.5px solid var(--linha);border-radius:12px;background:var(--sal)";
const VOLTAR = `<p style="margin-bottom:1rem"><button type="button" class="ligacao" data-a="abrir-admin">Voltar à loja</button></p>`;
let pedidosLoja = [], semDono = false;

/** Carrega menu completo, definições e pedidos para a gestão. */
async function carregarAdmin() {
  const d = await api("/admin/data", { auth: true });
  pedidosLoja = d.orders || [];
  aplicarDados(d);
}

/**
 * Executa uma alteração na gestão, recarrega os dados e trata erros e sessão expirada.
 * @param {Function} trabalho Função assíncrona que chama o backend.
 * @param {string} mensagem Aviso mostrado quando corre bem.
 */
async function adminAcao(trabalho, mensagem) {
  try { await trabalho(); await carregarAdmin(); brinde(mensagem); abrir("admin"); }
  catch (e) {
    if (e.status === 401 || e.status === 403) { LS.del("token"); abrir("adm-login"); brinde("Sessão terminada. Entre de novo."); }
    else if ($("#erros")) mostrarErros([e.message]);
    else brinde(e.message);
  }
}

/**
 * Formata uma data do backend na hora de Portugal.
 * @param {string} iso Data ISO.
 * @returns {string} Dia, mês e hora.
 */
function fmtData(iso) {
  return new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** Desenha a folha, incluindo as vistas de entrada e de pedidos. */
function renderFolha() {
  const vistas = { carrinho: vCarrinho, finalizar: vFinalizar, enviado: vEnviado, conta: vConta, morada: vMorada, admin: vAdmin, "adm-produto": vAdmProd, "adm-categoria": vAdmCat, "adm-loja": vAdmLoja, "adm-login": vAdmLogin, "adm-pedidos": vAdmPedidos };
  const v = vistas[S.vista]();
  $("#folha-titulo").textContent = v.titulo;
  $("#folha-corpo").innerHTML = v.corpo;
  $("#folha-pe").innerHTML = v.pe || "";
  $("#folha-pe").hidden = !v.pe;
  if (S.vista === "finalizar") sincronizar();
}

/**
 * Vista de entrada na gestão.
 * @returns {{titulo:string, corpo:string, pe:string}} Conteúdo da folha.
 */
function vAdmLogin() {
  const aviso = semDono ? `<p class="aviso" style="margin:0 0 1rem">A loja ainda não tem conta de dono. Escreva o seu email e escolha uma palavra-passe com pelo menos 6 caracteres.</p>` : "";
  return { titulo: semDono ? "Criar conta de dono" : "Entrar na gestão",
    corpo: `${aviso}<div class="grupo"><label class="campo" style="margin-top:0"><span>Email</span><input type="email" name="email" autocomplete="username" style="${CAMPO}"></label>
      <label class="campo"><span>Palavra-passe</span><input type="password" name="senha" autocomplete="${semDono ? "new-password" : "current-password"}" style="${CAMPO}"></label></div><div id="erros"></div>`,
    pe: `<button type="button" class="btn btn-bloco" data-a="${semDono ? "adm-criar-conta" : "adm-entrar"}">${semDono ? "Criar conta de dono" : "Entrar"}</button>` };
}

/**
 * Bloco de uma categoria na gestão, com os seus produtos.
 * @param {object} c Categoria.
 * @param {number} i Posição na lista.
 * @returns {string} HTML do bloco.
 */
function blocoCategoria(c, i) {
  const linhas = D.produtos.filter(p => p.cat === c.id).map(p => `<div class="cartao adm-prod">${p.foto ? `<img class="foto" src="${esc(p.foto)}" alt="">` : `<span class="mini">${p.arte ? arte(p.arte) : ""}</span>`}<div><strong>${esc(p.nome)}</strong>${p.ativo === false ? `<span class="etiqueta">Oculto</span>` : ""}<small>${eur(+p.preco || 0)}${p.min > 1 ? ", mínimo " + p.min + " unidades" : ""}</small></div><div class="acoes"><button type="button" class="ligacao" data-a="adm-prod" data-id="${esc(p.id)}">Editar</button></div></div>`).join("");
  const mover = (i ? `<button type="button" class="ligacao" data-a="adm-cat-mover" data-id="${esc(c.id)}" data-d="-1">Subir</button>` : "") + (i < D.categorias.length - 1 ? `<button type="button" class="ligacao" data-a="adm-cat-mover" data-id="${esc(c.id)}" data-d="1">Descer</button>` : "");
  return `<div class="grupo"><h3>${esc(c.nome)}</h3><p class="adm-acoes"><button type="button" class="ligacao" data-a="adm-cat" data-id="${esc(c.id)}">Editar categoria</button>${mover}</p>
    ${linhas || `<p style="color:var(--tinta-2)">Sem produtos. A categoria só aparece no site quando tiver pelo menos um.</p>`}
    <p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="adm-prod-novo" data-id="${esc(c.id)}">Novo produto</button></p></div>`;
}

/**
 * Vista principal da gestão.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vAdmin() {
  const novos = pedidosLoja.filter(p => p.status === "received").length;
  return { titulo: "Gerir a loja",
    corpo: `<div class="pilha" style="margin-bottom:1rem"><button type="button" class="btn btn-bloco" data-a="adm-pedidos">Pedidos${novos ? " (" + novos + " por confirmar)" : ""}</button>
      <button type="button" class="btn btn-sec btn-bloco" data-a="adm-loja">Horário, zonas e pedido mínimo</button>
      <button type="button" class="btn btn-sec btn-bloco" data-a="adm-cat-nova">Nova categoria</button></div>
      ${D.categorias.map(blocoCategoria).join("")}<p><button type="button" class="ligacao" data-a="adm-sair">Sair da gestão</button></p>` };
}

/**
 * Cartão de um pedido com o seletor de estado.
 * @param {object} p Pedido vindo do backend.
 * @returns {string} HTML do cartão.
 */
function cartaoPedido(p) {
  const itens = (p.order_items || []).map(i => i.quantity + "x " + esc(i.product_name)).join(", ");
  const opcoes = Object.keys(ESTADOS).map(k => `<option value="${k}" ${k === p.status ? "selected" : ""}>${ESTADOS[k]}</option>`).join("");
  return `<div class="grupo"><h3>N.º ${p.number}, ${eur(+p.total)}</h3>
    <p><strong>${esc(p.customer_name)}</strong>, <a href="tel:${esc(p.customer_phone)}">${esc(p.customer_phone)}</a></p>
    <p>${esc(p.address_street)}, ${esc(p.address_locality)} (${esc(p.zone_name)})${p.address_reference ? ". " + esc(p.address_reference) : ""}</p>
    <p>Entrega: ${p.asap ? "o mais cedo possível" : fmtData(p.deliver_at)}</p><p>${itens}</p>
    <p>Pagamento: ${esc(p.payment_method || "por indicar")}${p.change_for ? ", troco para " + eur(+p.change_for) : ""}</p>
    ${p.allergy_notes ? `<p class="aviso">${esc(p.allergy_notes)}</p>` : ""}
    <label class="campo"><span>Estado</span><select name="estadoPedido" data-id="${esc(p.id)}">${opcoes}</select></label>
    <small style="color:var(--tinta-2)">Recebido em ${fmtData(p.created_at)}</small></div>`;
}

/**
 * Vista dos pedidos recebidos.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vAdmPedidos() {
  return { titulo: "Pedidos", corpo: VOLTAR + (pedidosLoja.map(cartaoPedido).join("") || `<p style="color:var(--tinta-2)">Ainda não há pedidos. Os pedidos feitos no site aparecem aqui.</p>`) };
}

/**
 * Guarda no backend o novo estado de um pedido.
 * @param {HTMLSelectElement} sel Seletor alterado.
 */
async function mudarEstado(sel) {
  try {
    await api("/admin/orders/" + sel.dataset.id, { method: "PATCH", auth: true, body: { status: sel.value } });
    const p = pedidosLoja.find(x => x.id === sel.dataset.id);
    if (p) p.status = sel.value;
    brinde("Estado atualizado");
  } catch (e) { brinde(e.message); }
}

/**
 * Entra ou cria a conta de dono e abre a gestão.
 * @param {string} caminho Rota de autenticação.
 */
async function autenticar(caminho) {
  const body = { email: campo("email").value.trim(), password: campo("senha").value };
  if (body.email.length < 5 || body.password.length < 6) return mostrarErros(["Escreva o email e uma palavra-passe com pelo menos 6 caracteres."]);
  try {
    const s = await api(caminho, { method: "POST", body });
    if (s.confirm) { semDono = false; renderFolha(); return mostrarErros(["Conta criada. Abra o email que recebeu, confirme o endereço e depois entre aqui."]); }
    if (!s.staff) return mostrarErros(["Esta conta não tem acesso à gestão."]);
    LS.set("token", s.token);
    await carregarAdmin(); abrir("admin");
  } catch (e) { mostrarErros([e.message]); }
}
