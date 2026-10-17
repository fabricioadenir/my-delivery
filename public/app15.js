/* ---------- despesas, custos fixos e custo das entregas ---------- */
let fin = { fixos: [], despesas: [], zonas: [], settings: { cost_per_km: 0, profit_goal: 0 } };
const CATEGORIAS = ["Equipamento e utensílios", "Marketing e folhetos", "Manutenção", "Contabilidade", "Software", "Seguros", "Impostos e taxas", "Outras"];
const VOLTAR_FIN = `<p style="margin-bottom:1rem"><button type="button" class="ligacao" data-a="adm-financas">Voltar às despesas</button></p>`;

/** Carrega custos fixos, despesas recentes, distâncias das zonas e definições de custo. */
async function carregarFinancas() {
  const d = await api("/admin/finance", { auth: true });
  fin = { fixos: d.fixed_costs, despesas: d.expenses, zonas: d.zones, settings: d.settings };
}

/**
 * Executa uma alteração financeira, recarrega os dados e abre a vista indicada.
 * @param {Function} trabalho Função assíncrona que chama o backend.
 * @param {string} mensagem Aviso mostrado quando corre bem.
 */
async function finAcao(trabalho, mensagem) {
  try { await trabalho(); await carregarFinancas(); brinde(mensagem); abrir("adm-financas"); }
  catch (e) { erroGestao(e); }
}

const vAdminSemFinancas = vAdmin;
vAdmin = function () {
  const v = vAdminSemFinancas(), alvo = `<button type="button" class="btn btn-sec btn-bloco" data-a="adm-custos">`;
  v.corpo = v.corpo.replace(alvo, `<button type="button" class="btn btn-sec btn-bloco" data-a="adm-painel">Resultados</button><button type="button" class="btn btn-sec btn-bloco" data-a="adm-financas">Despesas e custos fixos</button>` + alvo);
  return v;
};

/**
 * Vista de custos fixos, despesas e custo das entregas.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vAdmFinancas() {
  const n = agora(), hoje = n.y + "-" + doisD(n.m) + "-" + doisD(n.d), total = fin.fixos.reduce((s, f) => s + +f.monthly_amount, 0);
  const fixos = fin.fixos.map(f => `<div class="cartao"><div><strong>${esc(f.name)}</strong><small>${eur(+f.monthly_amount)} por mês</small></div><div class="acoes"><button type="button" class="ligacao" data-a="adm-fixo" data-id="${esc(f.id)}">Editar</button></div></div>`).join("");
  const despesas = fin.despesas.map(x => `<div class="cartao"><div><strong>${fmtDia(x.spent_on)}, ${eur(+x.amount)}</strong><small>${esc(x.category)}${x.description ? ". " + esc(x.description) : ""}</small></div><div class="acoes"><button type="button" class="ligacao" data-a="despesa-apagar" data-id="${esc(x.id)}">Apagar</button></div></div>`).join("");
  const zonas = fin.zonas.map((z, i) => `<label class="campo"><span>Ida e volta até ${esc(z.name)} (km)</span><input type="text" name="km${i}" inputmode="decimal" value="${fmtQtd(z.distance_km)}"></label>`).join("");
  return { titulo: "Despesas e custos fixos",
    corpo: VOLTAR + `<div id="erros"></div><div class="grupo"><h3>Custos fixos, ${eur(total)} por mês</h3><p style="color:var(--tinta-2)">O que paga todos os meses, venda ou não: renda, luz, água, gás, internet, Segurança Social.</p>${fixos}<p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="adm-fixo-novo">Novo custo fixo</button></p></div>
      <div class="grupo"><h3>Registar despesa</h3><p style="color:var(--tinta-2)">Gastos pontuais. Ingredientes e embalagens registam-se em Stock e compras, e o combustível já entra no custo por km.</p>
        <div class="par"><label class="campo"><span>Data</span><input type="date" name="data" value="${hoje}" style="${CAMPO}"></label><label class="campo"><span>Valor (€)</span><input type="text" name="valor" inputmode="decimal"></label></div>
        <label class="campo"><span>Categoria</span><select name="categoria">${CATEGORIAS.map(c => `<option>${c}</option>`).join("")}</select></label>
        <label class="campo"><span>Descrição</span><input type="text" name="descricao" placeholder="Folhetos, faca nova…"></label>
        <p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="despesa-guardar">Registar despesa</button></p></div>
      <div class="grupo"><h3>Despesas recentes</h3>${despesas || `<p style="color:var(--tinta-2)">Ainda não registou despesas.</p>`}</div>
      <div class="grupo"><h3>Entregas e meta</h3><label class="campo"><span>Custo por km (€)</span><input type="text" name="km" inputmode="decimal" value="${txtNum(fin.settings.cost_per_km)}"><small>Combustível mais desgaste do carro. Os pedidos da mesma hora e zona dividem o custo da viagem.</small></label>
        ${zonas}<label class="campo"><span>Meta de lucro por mês (€)</span><input type="text" name="meta" inputmode="decimal" value="${txtNum(fin.settings.profit_goal)}"></label>
        <p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="financas-guardar">Guardar entregas e meta</button></p></div>` };
}

/**
 * Formulário de um custo fixo.
 * @returns {{titulo:string, corpo:string, pe:string}} Conteúdo da folha.
 */
function vAdmFixo() {
  const f = S.editar;
  return { titulo: f.id ? "Editar custo fixo" : "Novo custo fixo",
    corpo: VOLTAR_FIN + `<div class="grupo"><label class="campo" style="margin-top:0"><span>Nome</span><input type="text" name="nome" value="${esc(f.name)}" placeholder="Renda, eletricidade, internet…"></label>
      <label class="campo"><span>Valor por mês (€)</span><input type="text" name="valor" inputmode="decimal" value="${esc(f.valor)}"></label></div><div id="erros"></div>
      ${f.id ? `<p><button type="button" class="ligacao" data-a="adm-fixo-apagar">Apagar este custo fixo</button></p>` : ""}`,
    pe: `<button type="button" class="btn btn-bloco" data-a="adm-fixo-guardar">Guardar custo fixo</button>` };
}

/** Abre os resultados do período atual do painel. */
async function abrirPainel() {
  try { await carregarPainel(); abrir("adm-painel"); } catch (e) { erroGestao(e); }
}

Object.assign(VISTAS, { admin: vAdmin, "adm-painel": vAdmPainel, "adm-financas": vAdmFinancas, "adm-fixo": vAdmFixo });
Object.assign(ACOES, {
  "adm-painel"() { abrirPainel(); },
  "painel-ver"() { painel.de = campo("de").value; painel.ate = campo("ate").value; if (!painel.de || !painel.ate || painel.ate < painel.de) return brinde("Escolha as duas datas, com o fim depois do início."); abrirPainel(); },
  async "adm-financas"() { try { await carregarFinancas(); abrir("adm-financas"); } catch (e) { erroGestao(e); } },
  "adm-fixo-novo"() { S.editar = { id: "", name: "", valor: "" }; abrir("adm-fixo"); },
  "adm-fixo"(b) { const f = fin.fixos.find(x => x.id === b.dataset.id); S.editar = { id: f.id, name: f.name, valor: txtNum(f.monthly_amount) }; abrir("adm-fixo"); },
  "adm-fixo-guardar"() {
    const id = S.editar.id, body = { name: campo("nome").value.trim(), monthly_amount: num(campo("valor").value) };
    if (!body.name || !(body.monthly_amount >= 0)) return mostrarErros(["Escreva o nome e o valor por mês."]);
    finAcao(() => api("/admin/fixed-costs" + (id ? "/" + id : ""), { method: id ? "PUT" : "POST", auth: true, body }), "Custo fixo guardado");
  },
  "adm-fixo-apagar"(b) { if (doisPassos(b, "Confirmar: apagar este custo fixo")) finAcao(() => api("/admin/fixed-costs/" + S.editar.id, { method: "DELETE", auth: true }), "Custo fixo apagado"); },
  "despesa-guardar"() {
    const body = { spent_on: campo("data").value || null, category: campo("categoria").value, description: campo("descricao").value.trim() || null, amount: num(campo("valor").value) };
    if (!(body.amount > 0)) return mostrarErros(["Escreva o valor da despesa."]);
    finAcao(() => api("/admin/expenses", { method: "POST", auth: true, body }), "Despesa registada");
  },
  "despesa-apagar"(b) { if (doisPassos(b, "Confirmar")) finAcao(() => api("/admin/expenses/" + b.dataset.id, { method: "DELETE", auth: true }), "Despesa apagada"); },
  "financas-guardar"() {
    const body = { cost_per_km: num(campo("km").value), profit_goal: num(campo("meta").value) || 0, zones: fin.zonas.map((z, i) => ({ id: z.id, distance_km: num(campo("km" + i).value) || 0 })) };
    if (!(body.cost_per_km >= 0)) return mostrarErros(["Escreva o custo por km, ou 0."]);
    finAcao(() => api("/admin/finance/settings", { method: "PUT", auth: true, body }), "Entregas e meta guardadas");
  }
});

$("#folha").addEventListener("change", ev => {
  if (S.vista !== "adm-painel" || ev.target.name !== "periodo") return;
  painel.tipo = ev.target.value;
  if (painel.tipo === "personalizado") renderFolha(); else abrirPainel();
});
