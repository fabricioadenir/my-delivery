/* ---------- ações da gestão e arranque ---------- */

/**
 * Lê o formulário de produto.
 * @returns {{erros:string[], dados:object}} Erros de validação e corpo para o backend.
 */
function lerProduto() {
  const preco = num(campo("preco").value), min = parseInt(campo("min").value, 10) || 1, nome = campo("nome").value.trim(), erros = [];
  if (!nome) erros.push("Escreva o nome do produto.");
  if (!isFinite(preco) || preco < 0) erros.push("Escreva o preço, por exemplo 0,80.");
  if (min < 1 || min > 99) erros.push("A quantidade mínima tem de estar entre 1 e 99.");
  return { erros, dados: { category_id: campo("cat").value, name: nome, description: campo("desc").value.trim() || null, price: preco, min_qty: min, pieces: parseInt(campo("pecas").value, 10) || null, active: campo("ativo").checked } };
}

/**
 * Lê o formulário da loja.
 * @returns {{erros:string[], dados:object}} Erros de validação e corpo para o backend.
 */
function lerDefinicoes() {
  lerLoja();
  const L = S.editar, erros = [], uuid = /^[0-9a-f-]{36}$/;
  const hours = [0, 1, 2, 3, 4, 5, 6].map(d => { const h = L.horario[d]; if (h && (!h[0] || !h[1] || toMin(h[0]) >= toMin(h[1]))) erros.push(DIAS[d][0].toUpperCase() + DIAS[d].slice(1) + ": a hora de fecho tem de ser depois da de abertura."); return { weekday: d, is_open: !!h, opens: h ? h[0] : null, closes: h ? h[1] : null }; });
  const zones = L.zonas.map(z => ({ id: uuid.test(z.id) ? z.id : null, name: z.nome, fee: num(z.taxa) }));
  zones.forEach(z => { if (!z.name) erros.push("Dê um nome a todas as zonas."); if (!isFinite(z.fee) || z.fee < 0) erros.push("Escreva a taxa de " + (z.name || "cada zona") + ", ou 0 se for grátis."); });
  const min_order = num(L.pedidoMinimo), prep_minutes = parseInt(L.preparoMin, 10);
  if (!isFinite(min_order) || min_order < 0) erros.push("Escreva o pedido mínimo em euros.");
  if (!(prep_minutes >= 0)) erros.push("Escreva o tempo de preparação em minutos.");
  return { erros: [...new Set(erros)], dados: { min_order, prep_minutes, hours, zones } };
}

/**
 * Vista mostrada depois de o pedido ficar registado.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vEnviado() {
  const p = S.ultimo;
  return { titulo: "Pedido n.º " + p.num + " registado",
    corpo: `<p>O seu pedido ficou registado. Para o confirmarmos, envie-o agora pelo WhatsApp.</p>
      <div class="pilha" style="margin-top:1rem"><a class="btn btn-zap btn-bloco" href="${esc(p.url)}" target="_blank" rel="noopener">Enviar pelo WhatsApp</a></div>
      <pre class="msg" id="msg">${esc(p.texto)}</pre>
      <div class="pilha"><button type="button" class="btn btn-sec btn-bloco" data-a="copiar">Copiar o pedido</button>
        <button type="button" class="ligacao" data-a="fechar">Voltar ao menu</button></div>` };
}

Object.assign(ACOES, {
  async "abrir-admin"() {
    if (LS.get("token", null)) {
      try { await carregarAdmin(); return abrir("admin"); } catch (e) { LS.del("token"); }
    }
    try { semDono = !(await api("/auth/status")).admin_exists; } catch (e) { semDono = false; }
    abrir("adm-login");
  },
  "adm-entrar"() { autenticar("/auth/login"); },
  "adm-criar-conta"() { autenticar("/auth/signup"); },
  "adm-sair"() { LS.del("token"); pedidosLoja = []; fechar(); carregarMenu(); },
  "adm-pedidos"() { abrir("adm-pedidos"); },
  "adm-prod-guardar"() {
    const p = S.editar, f = lerProduto();
    if (f.erros.length) return mostrarErros(f.erros);
    adminAcao(async () => {
      let foto = p.foto || null;
      if (foto && foto.startsWith("data:")) foto = (await api("/admin/photo", { method: "POST", auth: true, body: { data_url: foto } })).url;
      await api("/admin/products" + (p.id ? "/" + p.id : ""), { method: p.id ? "PUT" : "POST", auth: true, body: Object.assign(f.dados, { photo_url: foto }) });
    }, "Produto guardado");
  },
  "adm-prod-apagar"(b) {
    if (!doisPassos(b, "Confirmar: apagar este produto")) return;
    adminAcao(() => api("/admin/products/" + S.editar.id, { method: "DELETE", auth: true }), "Produto apagado");
  },
  "adm-cat-guardar"() {
    const c = S.editar, nome = campo("nome").value.trim();
    if (!nome) return mostrarErros(["Escreva o nome da categoria."]);
    const body = { name: nome, description: campo("desc").value.trim() || null, layout: campo("vista").value === "cartoes" ? "cards" : "list" };
    adminAcao(() => api("/admin/categories" + (c.id ? "/" + c.id : ""), { method: c.id ? "PUT" : "POST", auth: true, body }), "Categoria guardada");
  },
  "adm-cat-apagar"(b) {
    if (!doisPassos(b, "Confirmar: apagar esta categoria")) return;
    adminAcao(() => api("/admin/categories/" + S.editar.id, { method: "DELETE", auth: true }), "Categoria apagada");
  },
  "adm-cat-mover"(b) {
    const ids = D.categorias.map(c => c.id), i = ids.indexOf(b.dataset.id), j = i + (+b.dataset.d);
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    adminAcao(() => api("/admin/categories/order", { method: "POST", auth: true, body: { ids } }), "Ordem guardada");
  },
  "adm-loja-guardar"() {
    const f = lerDefinicoes();
    if (f.erros.length) return mostrarErros(f.erros);
    adminAcao(() => api("/admin/store", { method: "PUT", auth: true, body: f.dados }), "Definições guardadas");
  }
});

$("#folha").addEventListener("change", ev => { if (ev.target.name === "estadoPedido") mudarEstado(ev.target); });

/** Liga o site ao backend: fecha a gestão antiga, carrega o menu e abre a gestão se pedido no endereço. */
async function iniciarLigacao() {
  if (S.vista) fechar();
  await carregarMenu();
  if (location.hash === "#admin") ACOES["abrir-admin"]();
}
iniciarLigacao();
