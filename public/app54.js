/* ---------- Clientes: um cliente por telemóvel, resumo, filtros e ficha detalhada ----------
 * Pedido do Fabricio (20/11): a lista mostrava a mesma pessoa em várias linhas quando o telemóvel vinha
 * escrito de formas diferentes ("965268866" e "965 268 866") e dava pouca informação.
 * Agora (dados de GET /api/admin/customers/overview → customers_overview(), agrupado por tel_chave):
 * - Topo: clientes, quantos voltaram, ticket médio, gasto por cliente e as entregas por fazer.
 * - Filtros (com contagem), ordenação e pesquisa por nome, telemóvel ou localidade.
 * - Cartão curto por cliente; ao tocar abre a ficha: próximo pedido, números, gostos (produtos, wasabi,
 *   palitos), hábitos (almoço/jantar, dias, antecedência, pagamento, canal), morada, dados guardados e
 *   histórico de pedidos com os itens.
 * Os números com "dados guardados" que nunca encomendaram (ou só têm pedidos cancelados) aparecem como "Sem pedido".
 */
document.head.insertAdjacentHTML("beforeend", `<style>
.cli-topo{display:grid;gap:.6rem;margin-bottom:1rem}
.cli-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:.6rem}
.cli-kpi{background:var(--sakura-claro);border-radius:14px;padding:.7rem .8rem;min-width:0}
.cli-kpi strong{display:block;font-size:1.45rem;line-height:1.15;color:var(--sakura)}
.cli-kpi small{color:var(--tinta-2);display:block;line-height:1.3}
.cli-chips{display:flex;gap:.4rem;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;margin:0 -1.2rem .8rem;padding:0 1.2rem}
.cli-chips::-webkit-scrollbar{display:none}
.cli-chips button{flex:none;border:1.5px solid var(--linha);background:var(--papel);color:inherit;border-radius:999px;padding:.4rem .8rem;font:inherit;font-weight:700;font-size:.88rem;min-height:38px;white-space:nowrap}
.cli-chips button[aria-pressed="true"]{background:var(--sakura);border-color:var(--sakura);color:var(--sobre-petala,#fff)}
.cli-chips b{margin-left:.3rem;font-weight:700;opacity:.75}
.cli-barra{margin-bottom:.7rem}
.cli-barra .campo{margin:0}
.cli-ordem{display:flex;align-items:center;justify-content:space-between;gap:.6rem;margin:-.2rem 0 .5rem;color:var(--tinta-2);font-size:.9rem}
.cli-ordem label{display:flex;align-items:center;gap:.4rem;margin:0;font-weight:400}
.cli-ordem select{width:auto;min-height:38px;padding:.2rem 1.8rem .2rem .6rem;border-radius:10px;border:1px solid var(--linha);background:var(--papel);font:inherit;color:var(--tinta)}
.cli-lista{padding:.2rem 1.1rem}
.cli-item{width:100%;display:grid;grid-template-columns:1fr auto;gap:.15rem .6rem;align-items:center;text-align:left;background:none;border:0;padding:.8rem 0;font:inherit;color:inherit;cursor:pointer}
.cli-item + .cli-item{border-top:1px solid var(--linha)}
.cli-item .nome{font-weight:800;display:flex;flex-wrap:wrap;align-items:center;gap:.3rem}
.cli-item .nome .etiqueta{margin-left:0}
.cli-item small{color:var(--tinta-2);display:block;grid-column:1}
.cli-item .seta{grid-row:1/5;grid-column:2;color:var(--sakura);font-size:1.4rem;font-weight:700}
.cli-prox{display:inline-block;margin-top:.25rem;background:#E7F5EC;color:#1F6B3F;border-radius:999px;padding:.05rem .6rem;font-size:.8rem;font-weight:700}
.etiqueta.cli-novo{background:#E6F0FB;color:#1D4F8C}
.etiqueta.cli-voltou,.etiqueta.cli-fiel{background:#E7F5EC;color:#1F6B3F}
.etiqueta.cli-frio{background:#FFF1D6;color:#7A4B00}
.etiqueta.cli-inativo,.etiqueta.cli-sem{background:var(--linha);color:var(--tinta-2)}
.etiqueta.cli-conta{background:transparent;border:1px solid var(--linha);color:var(--tinta-2)}
.cli-acoes{display:flex;flex-wrap:wrap;gap:.4rem 1.2rem;margin:.2rem 0 1rem}
.cli-destaque{border-left:4px solid #1F8F4E}
.cli-linhas{display:grid;gap:0;margin:0;padding:0;list-style:none}
.cli-linhas li{display:grid;grid-template-columns:minmax(7.5rem,40%) 1fr;gap:.6rem;padding:.5rem 0}
.cli-linhas li + li{border-top:1px solid var(--linha)}
.cli-linhas span{color:var(--tinta-2)}
.cli-ped{padding:.7rem 0}
.cli-ped + .cli-ped{border-top:1px solid var(--linha)}
.cli-ped small{color:var(--tinta-2);display:block}
.cli-nota{color:var(--tinta-2);font-size:.88rem;margin:.4rem 0 0}
@media (prefers-color-scheme: dark){
  .etiqueta.cli-novo{background:#16304F;color:#BBD7F7}
  .etiqueta.cli-voltou,.etiqueta.cli-fiel,.cli-prox{background:#173A26;color:#B5E6C7}
  .etiqueta.cli-frio{background:#4A3510;color:#FFD99A}
}
</style>`);

let cliDados = [], cliFiltro = "todos", cliOrdem = "recente", cliSel = null;

const CLI_CANAL = { site: "Site", whatsapp: "WhatsApp", instagram: "Instagram", telefone: "Telefone", presencial: "Presencial", outro: "Outro" };
const CLI_DIAS_PL = ["domingos", "segundas", "terças", "quartas", "quintas", "sextas", "sábados"];
const FMT_HORA_LX = new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit" });
const FMT_DIA_LX = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Lisbon" });

/** "vila nova De paiva" → "Vila Nova de Paiva". */
const cliLocal = s => String(s || "").trim().toLowerCase().replace(/(^|\s)\S/g, m => m.toUpperCase()).replace(/\s(De|Da|Do|Das|Dos|E)(?=\s)/g, m => m.toLowerCase());
const cliHoje = () => { const n = agora(); return n.y + "-" + doisD(n.m) + "-" + doisD(n.d); };
const cliDiasEntre = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const cliPlural = (n, um, varios) => n + " " + (n === 1 ? um : varios);

/** "hoje", "ontem", "há 5 dias", "amanhã", "sáb 21/11". */
function cliQuando(dia) {
  if (!dia) return "—";
  const d = cliDiasEntre(cliHoje(), dia);
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d === -1) return "ontem";
  if (d < 0 && d > -30) return "há " + -d + " dias";
  return fmtDia(dia) + (dia.slice(0, 4) !== cliHoje().slice(0, 4) ? "/" + dia.slice(0, 4) : "");
}

/** Entrega de um pedido em texto: "hoje às 19:30", "o mais cedo possível". */
function cliEntrega(p) {
  if (p.asap || !p.deliver_at) return "o mais cedo possível" + (p.created_at && FMT_DIA_LX.format(new Date(p.created_at)) !== cliHoje() ? " (" + fmtDia(FMT_DIA_LX.format(new Date(p.created_at))) + ")" : "");
  const dt = new Date(p.deliver_at), dia = FMT_DIA_LX.format(dt), d = cliDiasEntre(cliHoje(), dia);
  const qd = d === 0 ? "hoje" : d === 1 ? "amanhã" : d === -1 ? "ontem" : DIAS[new Date(dia + "T12:00:00Z").getUTCDay()].slice(0, 3) + " " + fmtDia(dia);
  return qd + " às " + FMT_HORA_LX.format(dt);
}

/** Segmento do cliente: decide a etiqueta e os filtros. */
function cliSegmento(c) {
  if (!c.orders) return { k: "sem", t: "Sem pedido" };
  const dias = c.days_since == null ? 0 : c.days_since;
  if (dias > 30) return { k: "inativo", t: "Inativo" };
  if (dias > 14 && !c.next_order) return { k: "frio", t: "A arrefecer" };
  if (c.orders >= 3) return { k: "fiel", t: "Fiel" };
  if (c.orders === 2) return { k: "voltou", t: "Voltou" };
  return { k: "novo", t: "Novo" };
}

const CLI_FILTROS = [
  ["todos", "Todos", () => true],
  ["voltaram", "Voltaram", c => c.orders >= 2],
  ["um", "Só 1 pedido", c => c.orders === 1],
  ["entregar", "Por entregar", c => !!c.next_order],
  ["frio", "Sem pedir há 15+ dias", c => c.orders > 0 && !c.next_order && c.days_since > 14],
  ["conta", "Dados guardados", c => !!c.account],
  ["sem", "Sem pedido", c => !c.orders]
];

const CLI_ORDENS = {
  recente: ["Último pedido", (a, b) => String(b.last_order || "").localeCompare(String(a.last_order || "")) || b.total - a.total],
  gasto: ["Mais gastaram", (a, b) => b.total - a.total],
  pedidos: ["Mais pedidos", (a, b) => b.orders - a.orders || b.total - a.total],
  ausente: ["Mais tempo sem pedir", (a, b) => (b.orders ? b.days_since : -1) - (a.orders ? a.days_since : -1)],
  nome: ["Nome", (a, b) => String(a.name).localeCompare(String(b.name), "pt")]
};

const cliNum = c => Object.assign(c, { total: +c.total || 0, ticket: c.ticket == null ? null : +c.ticket, profit: c.profit == null ? null : +c.profit, orders: +c.orders || 0 });

/** Lista filtrada, pesquisada e ordenada. */
function cliVisiveis() {
  const f = (CLI_FILTROS.find(x => x[0] === cliFiltro) || CLI_FILTROS[0])[2];
  const q = String(buscaCliente || "").toLowerCase().trim(), qd = q.replace(/\D/g, "");
  return cliDados.filter(f).filter(c => !q
    || (c.name + " " + (c.names || []).join(" ") + " " + cliLocal(c.locality)).toLowerCase().includes(q)
    || (qd.length >= 3 && String(c.key).includes(qd)))
    .sort(CLI_ORDENS[cliOrdem][1]);
}

/** Cartões da lista (substitui a lista antiga; a pesquisa de app17.js volta a chamar esta função). */
listaClientes = function () {
  const l = cliVisiveis();
  if (!l.length) return `<p style="color:var(--tinta-2);margin:.8rem 0">${cliDados.length ? "Nenhum cliente neste filtro ou com esse nome/número." : "Os clientes aparecem aqui depois do primeiro pedido."}</p>`;
  return l.map(c => {
    const s = cliSegmento(c), linha1 = c.orders
      ? `${cliPlural(c.orders, "pedido", "pedidos")} · ${eur(c.total)}${c.orders > 1 ? " · ticket " + eur(c.ticket) : ""}`
      : c.cancelled ? cliPlural(c.cancelled, "pedido cancelado", "pedidos cancelados") : "Guardou os dados no site, ainda sem pedido";
    const quando = c.last_delivered ? "Última entrega " + cliQuando(c.last_delivered) : c.orders ? "1.º pedido por entregar" : c.account ? "Dados guardados " + cliQuando(String(c.account.since).slice(0, 10)) : "";
    const linha2 = [quando, cliLocal(c.locality)].filter(Boolean).join(" · ");
    const prox = c.next_order ? `<small><span class="cli-prox">Entrega ${esc(cliEntrega(c.next_order))}</span></small>` : "";
    return `<button type="button" class="cli-item" data-a="cli-abrir" data-k="${esc(c.key)}">
      <span class="nome">${esc(c.name)} <span class="etiqueta cli-${s.k}">${s.t}</span></span>
      <small>${linha1}</small>${linha2 ? `<small>${esc(linha2)}</small>` : ""}${prox}<span class="seta" aria-hidden="true">›</span></button>`;
  }).join("");
};

/** Números do topo, calculados sobre todos os clientes (não sobre o filtro). */
function cliResumo() {
  const com = cliDados.filter(c => c.orders), receberam = com.filter(c => c.delivered > 0 || c.orders > 1);
  const voltaram = com.filter(c => c.orders >= 2), pedidos = com.reduce((s, c) => s + c.orders, 0), vendas = com.reduce((s, c) => s + c.total, 0);
  const totalPago = com.reduce((s, c) => s + (c.ticket || 0) * c.orders, 0);
  const prox = cliDados.filter(c => c.next_order).sort((a, b) => String(a.next_order.deliver_at || "").localeCompare(String(b.next_order.deliver_at || "")));
  const pct = receberam.length ? Math.round(voltaram.length / receberam.length * 100) : 0;
  const kpis = `<div class="cli-kpis">
    <div class="cli-kpi"><strong>${com.length}</strong><small>${com.length === 1 ? "cliente encomendou" : "clientes encomendaram"}${cliDados.length > com.length ? ` · ${cliDados.length - com.length} sem pedido` : ""}</small></div>
    <div class="cli-kpi"><strong>${voltaram.length} <span style="font-size:1rem">(${pct} %)</span></strong><small>voltaram a encomendar</small></div>
    <div class="cli-kpi"><strong>${pedidos ? eur(totalPago / pedidos) : "—"}</strong><small>ticket médio (${cliPlural(pedidos, "pedido", "pedidos")})</small></div>
    <div class="cli-kpi"><strong>${com.length ? eur(vendas / com.length) : "—"}</strong><small>gasto médio por cliente</small></div></div>`;
  const entregas = prox.length ? `<div class="grupo cli-destaque" style="margin:0"><h3 style="font-size:1.05rem;margin-bottom:.3rem">Por entregar (${prox.length})</h3>${prox.map(c =>
    `<button type="button" class="cli-item" data-a="cli-abrir" data-k="${esc(c.key)}" style="padding:.5rem 0"><span class="nome">${esc(c.name)}</span><small>${esc(cliEntrega(c.next_order))} · ${eur(+c.next_order.total)} · ${esc(ESTADOS[c.next_order.status] || c.next_order.status)}${c.orders > 1 ? " · " + cliPlural(c.orders - 1, "pedido anterior", "pedidos anteriores") : " · 1.º pedido"}</small><span class="seta" aria-hidden="true">›</span></button>`).join("")}</div>` : "";
  return `<div class="cli-topo">${kpis}${entregas}</div>`;
}

function cliChips() {
  return `<div class="cli-chips" role="group" aria-label="Filtrar clientes">${CLI_FILTROS.map(([k, t, f]) => {
    const n = cliDados.filter(f).length;
    if (!n && k !== "todos" && k !== cliFiltro) return "";
    return `<button type="button" data-a="cli-filtro" data-f="${k}" aria-pressed="${k === cliFiltro}">${t}<b>${n}</b></button>`;
  }).join("")}</div>`;
}

const cliContagem = () => { const n = cliVisiveis().length; return n === 1 ? "1 cliente" : n + " clientes"; };

function vClientesNovo() {
  return { titulo: "Clientes",
    corpo: VOLTAR + cliResumo() + `<div class="cli-barra"><label class="campo"><span>Procurar nome, telemóvel ou localidade</span><input type="search" name="busca" value="${esc(buscaCliente)}" autocomplete="off"></label></div>
      <div id="cli-chips">${cliChips()}</div>
      <div class="cli-ordem"><span id="cli-conta">${cliContagem()}</span><label>Ordenar <select name="cli-ordem" aria-label="Ordenar clientes">${Object.entries(CLI_ORDENS).map(([k, v]) => `<option value="${k}" ${k === cliOrdem ? "selected" : ""}>${v[0]}</option>`).join("")}</select></label></div>
      <div class="grupo cli-lista" id="lista-clientes">${listaClientes()}</div>
      <p class="cli-nota">A mesma pessoa conta uma vez, mesmo que tenha escrito o telemóvel de formas diferentes. "Voltaram" = clientes com 2 ou mais pedidos, em percentagem de quem já recebeu pelo menos um.</p>` };
}

/* ---------- ficha do cliente ---------- */
const cliLinha = (rotulo, valor) => valor ? `<li><span>${rotulo}</span><strong style="font-weight:600">${valor}</strong></li>` : "";

/** "Pede sempre", "Nunca pede", "Às vezes (1 de 3)". */
function cliSempre(o, sempre, nunca) {
  const t = (o.sim || 0) + (o.nao || 0);
  if (!t) return "";
  if (!o.nao) return sempre + (t > 1 ? ` (${t} de ${t})` : "");
  if (!o.sim) return nunca + (t > 1 ? ` (${t} de ${t})` : "");
  return `Às vezes (${o.sim} de ${t})`;
}

/** Chave mais frequente de um objeto {chave: contagem}. */
const cliTopo = o => Object.entries(o || {}).sort((a, b) => b[1] - a[1]);

/** Produtos do cliente por valor gasto, com a quantidade; 5 primeiros e o resto em "Ver todos". */
function cliProdutos(lista) {
  if (!lista.length) return "";
  const l = lista.slice().sort((a, b) => +b.value - +a.value || b.qty - a.qty), max = Math.max(...l.map(x => +x.value), 0.01);
  const li = x => `<li><span>${esc(x.name)}</span><strong>${x.qty}× <small style="font-weight:400;color:var(--tinta-2)">${eur(+x.value)}</small></strong><span class="rx-b"><i style="width:${Math.max(3, +x.value / max * 100)}%"></i></span></li>`;
  const top = l.slice(0, 5).map(li).join(""), resto = l.slice(5).map(li).join("");
  return `<p class="cli-nota" style="margin:0 0 .2rem">O que mais pediu (por valor)</p><ul class="rx-barras">${top}</ul>${resto ? `<details class="rx-mais"><summary>Ver todos (${l.length})</summary><ul class="rx-barras">${resto}</ul></details>` : ""}`;
}

function vCliente() {
  const c = cliDados.find(x => x.key === cliSel);
  if (!c) return { titulo: "Cliente", corpo: `<p><button type="button" class="ligacao" data-a="adm-clientes">Voltar aos clientes</button></p><p>Cliente não encontrado.</p>` };
  const s = cliSegmento(c), tel = "351" + c.key, primeiro = String(c.name).split(" ")[0];
  const voltar = `<p style="margin-bottom:1rem"><button type="button" class="ligacao" data-a="cli-voltar">Voltar aos clientes</button></p>`;
  const mapa = c.street || c.locality ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([c.street, c.locality].filter(Boolean).join(", ")) : "";
  const pin = c.account && c.account.code ? `<a class="ligacao" href="https://wa.me/${tel}?text=${encodeURIComponent("Olá " + primeiro + ", para escolher um PIN novo e ver os seus dados no site, abra: " + location.origin + "/?recuperar=" + c.account.code + " . " + CONFIG.nome)}" target="_blank" rel="noopener">Enviar link de PIN novo</a>` : "";
  const acoes = `<div class="cli-acoes"><a class="ligacao" href="tel:+${tel}">Ligar</a><a class="ligacao" href="https://wa.me/${tel}" target="_blank" rel="noopener">WhatsApp</a>${mapa ? `<a class="ligacao" href="${esc(mapa)}" target="_blank" rel="noopener">Abrir no mapa</a>` : ""}${pin}</div>`;
  const cab = `<p style="margin:0 0 .3rem;display:flex;flex-wrap:wrap;gap:.35rem;align-items:center"><strong style="font-size:1.05rem">${esc(c.phone)}</strong><span class="etiqueta cli-${s.k}" style="margin:0">${s.t}</span>${c.account ? `<span class="etiqueta cli-conta" style="margin:0">${c.account.locked ? "PIN bloqueado" : "Dados guardados"}</span>` : ""}</p>${acoes}`;

  const prox = c.next_order ? `<div class="grupo cli-destaque"><h3 style="font-size:1.05rem;margin-bottom:.2rem">Próxima entrega</h3><p style="margin:0">Pedido ${esc(c.next_order.code)} · <strong>${esc(cliEntrega(c.next_order))}</strong> · ${eur(+c.next_order.total)}</p><small style="color:var(--tinta-2)">${esc(ESTADOS[c.next_order.status] || c.next_order.status)}</small></div>` : "";

  let numeros = "";
  if (c.orders) {
    const margem = c.profit != null && c.total ? Math.round(c.profit / c.total * 100) : null;
    const porEntregar = c.orders - c.delivered;
    numeros = `<div class="grupo"><div class="cli-kpis">
      <div class="cli-kpi"><strong>${c.orders}</strong><small>${c.orders === 1 ? "pedido" : "pedidos"}${porEntregar ? ` · ${porEntregar} por entregar` : ""}${c.cancelled ? ` · ${c.cancelled} cancelado${c.cancelled > 1 ? "s" : ""}` : ""}</small></div>
      <div class="cli-kpi"><strong>${eur(c.total)}</strong><small>em produtos${+c.fees ? ` + ${eur(+c.fees)} de entregas` : ""}</small></div>
      <div class="cli-kpi"><strong>${eur(c.ticket || 0)}</strong><small>ticket médio</small></div>
      <div class="cli-kpi"><strong>${c.profit != null ? eur(c.profit) : "—"}</strong><small>${c.profit != null ? `lucro estimado (${margem} %)` : "lucro: sem custo calculado"}${c.cost_missing && c.profit != null ? ` · falta custo em ${c.cost_missing}` : ""}</small></div></div>
      <ul class="cli-linhas" style="margin-top:.7rem">
        ${cliLinha("Cliente desde", fmtDia(c.first_order) + " (" + cliQuando(c.first_order) + ")")}
        ${cliLinha("Última entrega", c.last_delivered ? fmtDia(c.last_delivered) + " (" + cliQuando(c.last_delivered) + ")" : "Ainda nenhuma entregue")}
        ${cliLinha("Volta em média", c.avg_gap_days != null ? "a cada " + String(c.avg_gap_days).replace(".", ",") + " dias" : "")}
        ${(c.names || []).length > 1 ? cliLinha("Também como", esc(c.names.filter(n => n !== c.name).join(", "))) : ""}
      </ul></div>`;
  } else {
    numeros = `<div class="grupo"><p style="margin:0">${c.cancelled ? `Só tem ${cliPlural(c.cancelled, "pedido cancelado", "pedidos cancelados")}.` : "Guardou os dados no site mas ainda não encomendou."} Pode valer a pena uma mensagem.</p></div>`;
  }

  const gostos = c.orders ? `<div class="grupo"><h3>Gostos</h3>${cliProdutos(c.products || [])}
      <ul class="cli-linhas" style="margin-top:.6rem">
        ${cliLinha("Wasabi", cliSempre(c.wasabi, "Pede sempre", "Nunca pede"))}
        ${cliLinha("Palitos com elástico", cliSempre(c.elastico, "Sempre", "Nunca"))}
      </ul></div>` : "";

  const dias = cliTopo(c.weekdays), maxDia = dias.length ? dias[0][1] : 0;
  const diasTxt = dias.filter(d => d[1] === maxDia).map(d => CLI_DIAS_PL[+d[0]]).join(" e ");
  const refeicao = c.almoco && c.jantar ? `Almoço ${c.almoco} · jantar ${c.jantar}` : c.jantar ? "Jantar" + (c.jantar > 1 ? ` (sempre, ${c.jantar} pedidos)` : "") : c.almoco ? "Almoço" + (c.almoco > 1 ? ` (sempre, ${c.almoco} pedidos)` : "") : "";
  const ant = c.antecedencia_h != null && c.antecedencia_h >= 1 ? (c.antecedencia_h >= 36 ? "agenda com cerca de " + String(Math.round(c.antecedencia_h / 24 * 10) / 10).replace(".", ",") + " dias de antecedência" : "agenda com cerca de " + Math.round(c.antecedencia_h) + " h de antecedência") : "";
  const modo = [c.asap ? cliPlural(c.asap, "vez", "vezes") + " o mais cedo possível" : "", ant].filter(Boolean).join("; ");
  const pag = cliTopo(c.payments).map(([k, n]) => k + (c.orders > 1 ? ` (${n})` : "")).join(", ");
  const canal = cliTopo(c.channels).map(([k, n]) => (CLI_CANAL[k] || k) + (c.orders > 1 ? ` (${n})` : "")).join(", ");
  const habitos = c.orders ? `<div class="grupo"><h3>Hábitos</h3><ul class="cli-linhas">
      ${cliLinha("Refeição", refeicao)}${cliLinha(dias.length > 1 && maxDia === 1 ? "Dias" : "Dia preferido", diasTxt)}${cliLinha("Como encomenda", modo)}
      ${cliLinha("Pagamento", esc(pag))}${cliLinha("Por onde", esc(canal))}</ul></div>` : "";

  const morada = c.street || c.locality ? `<div class="grupo"><h3>Morada (último pedido)</h3><ul class="cli-linhas">
      ${cliLinha("Rua", esc(c.street))}${cliLinha("Localidade", esc(cliLocal(c.locality)))}${cliLinha("Referência", esc(c.reference))}${cliLinha("Zona", esc(c.zone))}</ul></div>` : "";

  const conta = c.account ? `<div class="grupo"><h3>Dados guardados no site</h3><ul class="cli-linhas">
      ${cliLinha("Desde", fmtData(c.account.since))}${cliLinha("Última entrada", c.account.last_login ? fmtData(c.account.last_login) : "")}
      ${cliLinha("Moradas guardadas", String(c.account.addresses))}${cliLinha("PIN", c.account.locked ? "Bloqueado — envie o link de PIN novo" : "Ativo")}</ul></div>` : "";

  const hist = (c.history || []).length ? `<div class="grupo"><h3>Pedidos (${c.history.length})</h3>${c.history.map(p => {
    const canc = p.status === "cancelled";
    return `<div class="cli-ped"${canc ? ' style="opacity:.6"' : ""}><strong>Pedido ${esc(p.code)}</strong> <small style="display:inline">· N.º ${p.number}</small> <span class="etiqueta">${esc(ESTADOS[p.status] || p.status)}</span>
      <small>Entrega ${esc(cliEntrega(p))} · ${eur(+p.total)}${+p.discount ? ` (desconto ${eur(+p.discount)})` : ""} · ${esc(p.payment || "")}${p.channel && p.channel !== "site" ? " · " + esc(CLI_CANAL[p.channel] || p.channel) : ""}</small>
      ${p.items ? `<small>${esc(p.items)}</small>` : ""}<small>Feito ${esc(fmtData(p.created_at))}</small></div>`;
  }).join("")}</div>` : "";

  return { titulo: c.name, corpo: voltar + cab + prox + numeros + gostos + habitos + hist + morada + conta };
}

/* ---------- ligações ---------- */
Object.assign(VISTAS, { "adm-clientes": vClientesNovo, "adm-cliente": vCliente });

/** Volta a desenhar só a lista e os filtros (sem perder o foco da pesquisa). */
function cliRedesenhar() {
  const l = $("#lista-clientes"), ch = $("#cli-chips");
  if (l) l.innerHTML = listaClientes();
  if (ch) ch.innerHTML = cliChips();
  const ct = $("#cli-conta"); if (ct) ct.textContent = cliContagem();
}

ACOES["adm-clientes"] = async function () {
  try {
    cliDados = ((await api("/admin/customers/overview", { auth: true })) || []).map(cliNum);
    buscaCliente = ""; cliFiltro = "todos"; cliOrdem = "recente";
    abrir("adm-clientes");
  } catch (e) { erroGestao(e); }
};
Object.assign(ACOES, {
  "cli-filtro"(b) { cliFiltro = b.dataset.f; cliRedesenhar(); },
  "cli-abrir"(b) { cliSel = b.dataset.k; abrir("adm-cliente"); },
  "cli-voltar"() { abrir("adm-clientes"); }
});

/* a pesquisa de app17.js só redesenha a lista; atualizar também as contagens não é preciso (são do total) */
$("#folha").addEventListener("change", ev => {
  if (S.vista === "adm-clientes" && ev.target.name === "cli-ordem") { cliOrdem = ev.target.value; cliRedesenhar(); }
});
$("#folha").addEventListener("input", ev => {
  if (S.vista === "adm-clientes" && ev.target.name === "busca") { const ct = $("#cli-conta"); if (ct) ct.textContent = cliContagem(); }
});
