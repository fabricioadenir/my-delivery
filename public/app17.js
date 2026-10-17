/* ---------- menu, mais, clientes, relatórios, dinheiro, IVA, cenários e estado do pedido ---------- */
let clientes = [], buscaCliente = "", estadosCliente = {};

/**
 * Executa uma alteração do menu ou da loja, recarrega os dados e volta ao sítio certo.
 * @param {Function} trabalho Função assíncrona que chama o backend.
 * @param {string} mensagem Aviso mostrado quando corre bem.
 */
async function adminAcao(trabalho, mensagem) {
  const destino = S.vista === "adm-loja" ? "adm-mais" : "adm-menu";
  try { await trabalho(); await carregarAdmin(); brinde(mensagem); abrir(destino); }
  catch (e) { erroGestao(e); }
}

/**
 * Gestão do menu: categorias e produtos.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vMenu() {
  return { titulo: "Menu", corpo: `<p style="margin-bottom:1rem"><button type="button" class="btn btn-sec" data-a="adm-cat-nova">Nova categoria</button></p>${D.categorias.map(blocoCategoria).join("")}` };
}

/**
 * Restantes áreas da gestão.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vMais() {
  const item = (a, t, d) => `<button type="button" class="btn btn-sec btn-bloco" data-a="${a}" style="justify-content:space-between;border-radius:16px"><span>${t}</span><small style="font-weight:400;color:var(--tinta-2)">${d}</small></button>`;
  return { titulo: "Mais",
    corpo: `<div class="pilha">${item("adm-painel", "Resultados", "Vendas, lucro e equilíbrio")}${item("adm-financas", "Despesas e custos fixos", "Fixos, despesas, entregas, IVA")}${item("adm-custos", "Custos e fichas técnicas", "Ingredientes e margens")}
      ${item("adm-clientes", "Clientes", "Quem compra e quanto")}${item("adm-relatorios", "Relatórios", "Exportar para Excel")}${item("adm-loja", "Horário e zonas", "Abertura, taxas, pedido mínimo")}
      ${item("fechar", "Ver o site", "Como os clientes o veem")}${item("adm-sair", "Sair da gestão", "Termina a sessão")}</div>` };
}

/**
 * Cartões dos clientes que correspondem à pesquisa.
 * @returns {string} HTML da lista.
 */
function listaClientes() {
  const n = agora(), limite = new Date(Date.UTC(n.y, n.m - 1, n.d - 30)).toISOString().slice(0, 10), q = buscaCliente.toLowerCase();
  const tipo = c => c.last_order < limite ? "Inativo" : c.orders > 1 ? "Recorrente" : "Novo";
  return clientes.filter(c => !q || (c.name + " " + c.phone).toLowerCase().includes(q)).map(c => { const d = String(c.phone).replace(/\D/g, "");
    return `<div class="cartao"><div><strong>${esc(c.name)}</strong><span class="etiqueta">${tipo(c)}</span><small>${esc(c.phone)}${c.zone ? ", " + esc(c.zone) : ""}</small><small>${c.orders} ${c.orders === 1 ? "pedido" : "pedidos"}, ${eur(+c.total)} no total, ticket de ${eur(+c.ticket)}. Último em ${fmtDia(c.last_order)}${c.favorite ? ". Pede mais: " + esc(c.favorite) : ""}</small></div>
      <div class="acoes"><a class="ligacao" href="https://wa.me/${d.length === 9 ? "351" + d : d}" target="_blank" rel="noopener">WhatsApp</a></div></div>`; }).join("") || `<p style="color:var(--tinta-2)">${clientes.length ? "Nenhum cliente com esse nome ou número." : "Os clientes aparecem aqui depois do primeiro pedido."}</p>`;
}

/**
 * Lista de clientes com pesquisa.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vClientes() {
  return { titulo: "Clientes (" + clientes.length + ")",
    corpo: VOLTAR + `<label class="campo" style="margin:0 0 1rem"><span>Procurar por nome ou telemóvel</span><input type="text" name="busca" value="${esc(buscaCliente)}"></label><div class="grupo" id="lista-clientes">${listaClientes()}</div>` };
}

/**
 * Ecrã de exportação de relatórios.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vRelatorios() {
  const tipos = [["pedidos", "Pedidos"], ["produtos", "Produtos vendidos"], ["despesas", "Despesas"], ["clientes", "Clientes"], ["stock", "Stock atual"]];
  return { titulo: "Relatórios",
    corpo: VOLTAR + `<div class="grupo"><label class="campo" style="margin-top:0"><span>Período</span><select name="periodoRel">${Object.keys(PERIODOS).filter(k => k !== "personalizado").map(k => `<option value="${k}" ${k === painel.tipo ? "selected" : ""}>${PERIODOS[k]}</option>`).join("")}</select><small>Vale para pedidos, produtos e despesas. Abre no Excel.</small></label></div>
      <div class="pilha">${tipos.map(t => `<button type="button" class="btn btn-sec btn-bloco" data-a="rel-baixar" data-t="${t[0]}">Descarregar ${t[1]}</button>`).join("")}</div>` };
}

/**
 * Descarrega linhas como ficheiro CSV que o Excel português abre diretamente.
 * @param {string} nome Nome do ficheiro sem extensão.
 * @param {Array[]} linhas Linhas, com o cabeçalho na primeira.
 */
function baixarCsv(nome, linhas) {
  const cel = v => typeof v === "number" ? String(v).replace(".", ",") : '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const url = URL.createObjectURL(new Blob(["\ufeff" + linhas.map(l => l.map(cel).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = nome + ".csv"; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Prepara as linhas de um relatório.
 * @param {string} tipo pedidos, produtos, despesas, clientes ou stock.
 * @returns {Promise<Array[]>} Linhas com cabeçalho.
 */
async function linhasRelatorio(tipo) {
  const [de, ate] = datasPeriodo(campo("periodoRel").value);
  if (tipo === "clientes") return [["Nome", "Telemóvel", "Zona", "Pedidos", "Total", "Ticket médio", "Primeiro pedido", "Último pedido", "Favorito"]].concat((await api("/admin/customers", { auth: true })).map(c => [c.name, c.phone, c.zone, +c.orders, +c.total, +c.ticket, c.first_order, c.last_order, c.favorite]));
  if (tipo === "stock") return [["Ingrediente", "Unidade", "Em stock", "Custo por unidade", "Valor", "Mínimo"]].concat((await api("/admin/stock", { auth: true })).ingredients.map(i => [i.name, i.unit, +i.stock_qty, +i.unit_cost, Math.round(i.stock_qty * i.unit_cost * 100) / 100, i.min_stock == null ? "" : +i.min_stock]));
  const r = await api("/admin/reports?start=" + de + "&end=" + ate, { auth: true });
  if (tipo === "produtos") return [["Produto", "Quantidade", "Vendas", "Custo", "Lucro"]].concat(r.items.map(i => [i.product, +i.quantity, +i.revenue, +i.cost, Math.round((i.revenue - i.cost) * 100) / 100]));
  if (tipo === "despesas") return [["Data", "Categoria", "Descrição", "Valor"]].concat(r.expenses.map(e => [e.date, e.category, e.description, +e.amount]));
  return [["N.º", "Data", "Hora", "Estado", "Cliente", "Telemóvel", "Zona", "Morada", "Itens", "Pagamento", "Subtotal", "Entrega", "Total", "Custo", "NIF"]].concat(r.orders.map(o => [+o.number, o.date, o.time, ESTADOS[o.status], o.customer, o.phone, o.zone, o.address, o.items, o.payment, +o.subtotal, +o.fee, +o.total, o.cost == null ? "" : +o.cost, o.nif]));
}

/** Atualiza a simulação do ecrã de resultados com os valores escritos. */
function simular() {
  const el = $("#cen-res"); if (!el) return;
  const d = painel.dados, n = num(campo("cenPedidos").value), pct = num(campo("cenPreco").value) || 0;
  const margem = +d.margin_per_order + (d.orders ? d.revenue / d.orders : 0) * pct / 100;
  el.textContent = n > 0 ? `Com ${n} pedidos por mês${pct ? " e preços " + (pct > 0 ? "+" : "") + pct + " %" : ""}, cada pedido deixaria ${eur(margem)} e o mês fecharia com ${eur(n * margem - d.fixed_monthly)} depois dos custos fixos.` : "Escreva quantos pedidos por mês quer simular.";
}

const vPainelBase = VISTAS["adm-painel"];
/**
 * Resultados com o dinheiro que entrou e saiu, o IVA estimado e a simulação.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vPainelCompleto() {
  const v = vPainelBase(), d = painel.dados, x = d.extras, entrou = x.cash_in.reduce((s, c) => s + +c.total, 0);
  const iva = x.vat_regime === "normal" ? `<p>IVA estimado incluído nas vendas: <strong>${eur(+x.vat)}</strong>. Resultado depois de IVA: <strong>${eur(d.result - x.vat)}</strong>.</p>` : x.vat_regime === "isento" ? `<p>Regime de isenção: sem IVA a entregar.</p>` : `<p class="aviso">O regime de IVA ainda não está definido. Escolha-o em Despesas e custos fixos, depois de confirmar com o contabilista.</p>`;
  v.corpo += `<div class="grupo"><h3>Dinheiro que entrou e saiu</h3><dl class="contas" style="margin:0">${x.cash_in.map(c => `<div><dt>${esc(c.method)} (${c.orders} entregues)</dt><dd>${eur(+c.total)}</dd></div>`).join("")}
      <div><dt>Por receber, de pedidos em curso</dt><dd>${eur(+x.pending)}</dd></div><div><dt>Compras de ingredientes</dt><dd>− ${eur(+x.purchases)}</dd></div><div><dt>Outras despesas</dt><dd>− ${eur(+d.expenses)}</dd></div>
      <div class="final"><dt>Saldo do período</dt><dd>${eur(entrou - x.purchases - d.expenses)}</dd></div></dl><small style="color:var(--tinta-2)">Não inclui os custos fixos, que são pagos fora do sistema.</small></div>
    <div class="grupo"><h3>IVA</h3>${iva}</div>
    <div class="grupo"><h3>E se…</h3><div class="par"><label class="campo"><span>Pedidos por mês</span><input type="text" name="cenPedidos" inputmode="numeric"></label><label class="campo"><span>Mudança nos preços (%)</span><input type="text" name="cenPreco" inputmode="decimal" placeholder="0"></label></div><p class="aviso" id="cen-res">Escreva quantos pedidos por mês quer simular.</p></div>`;
  return v;
}

const vFinancasBase = VISTAS["adm-financas"];
/**
 * Despesas e custos fixos com a configuração do IVA.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vFinancasComIva() {
  const v = vFinancasBase(), s = fin.settings, op = (k, t) => `<option value="${k}" ${s.vat_regime === k ? "selected" : ""}>${t}</option>`;
  v.corpo += `<div class="grupo"><h3>IVA</h3><label class="campo"><span>Regime</span><select name="ivaRegime">${op("por_definir", "Por definir")}${op("isento", "Regime de isenção")}${op("normal", "Regime normal, com IVA nas vendas")}</select></label>
    <label class="campo"><span>Taxa de IVA das vendas (%)</span><input type="text" name="ivaTaxa" inputmode="decimal" value="${txtNum(s.default_vat_rate || 0)}"><small>Confirme o regime e a taxa com o seu contabilista. O sistema só estima o IVA, não emite faturas.</small></label>
    <p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="iva-guardar">Guardar IVA</button></p></div>`;
  return v;
}

const vContaBase = VISTAS.conta;
/**
 * Conta do cliente, com o estado atual dos pedidos feitos neste dispositivo.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vContaComEstado() {
  const v = vContaBase();
  S.pedidos.forEach(p => { if (p.id && estadosCliente[p.id]) v.corpo = v.corpo.replace(`<strong>N.º ${esc(p.num)}</strong>`, `<strong>N.º ${esc(p.num)}</strong><span class="etiqueta">${ESTADOS[estadosCliente[p.id]]}</span>`); });
  return v;
}

const concluirSemId = concluirPedido;
concluirPedido = function (r, v, res) {
  concluirSemId(r, v, res);
  if (S.pedidos[0] && res.id) { S.pedidos[0].id = res.id; LS.set("pedidos", S.pedidos); }
};

Object.assign(VISTAS, { "adm-menu": vMenu, "adm-mais": vMais, "adm-clientes": vClientes, "adm-relatorios": vRelatorios, "adm-painel": vPainelCompleto, "adm-financas": vFinancasComIva, conta: vContaComEstado });
Object.assign(ACOES, {
  async "adm-menu"() { try { await carregarAdmin(); abrir("adm-menu"); } catch (e) { erroGestao(e); } },
  "adm-mais"() { abrir("adm-mais"); },
  async "adm-clientes"() { try { clientes = await api("/admin/customers", { auth: true }); buscaCliente = ""; abrir("adm-clientes"); } catch (e) { erroGestao(e); } },
  "adm-relatorios"() { abrir("adm-relatorios"); },
  async "rel-baixar"(b) {
    try { const linhas = await linhasRelatorio(b.dataset.t); if (linhas.length < 2) return brinde("Não há dados para exportar neste período."); baixarCsv("sakura-e-sal-" + b.dataset.t, linhas); brinde("Relatório descarregado"); }
    catch (e) { erroGestao(e); }
  },
  "iva-guardar"() {
    const body = { vat_regime: campo("ivaRegime").value, default_vat_rate: num(campo("ivaTaxa").value) || 0 };
    if (body.vat_regime === "normal" && !(body.default_vat_rate > 0)) return mostrarErros(["Escreva a taxa de IVA das vendas."]);
    finAcao(() => api("/admin/vat", { method: "PUT", auth: true, body }), "IVA guardado");
  },
  async "abrir-conta"() {
    lerFinalizar(); abrir("conta");
    const ids = S.pedidos.filter(p => p.id).slice(0, 20).map(p => p.id);
    if (!ids.length) return;
    try { (await apiSemIndicador("/orders/status", { method: "POST", body: { ids } })).forEach(o => { estadosCliente[o.id] = o.status; }); if (S.vista === "conta") renderFolha(); }
    catch (e) { /* o estado é opcional; a conta funciona sem ele */ }
  }
});

$("#folha").addEventListener("input", ev => {
  if (S.vista === "adm-painel") return simular();
  if (S.vista === "adm-clientes" && ev.target.name === "busca") { buscaCliente = ev.target.value; $("#lista-clientes").innerHTML = listaClientes(); }
});
