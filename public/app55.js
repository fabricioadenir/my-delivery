/* ---------- editar os itens de um pedido já feito ----------
 * Pedido do Fabricio (21/11): a cliente pediu por WhatsApp para juntar um combinado a um pedido já confirmado.
 * Em vez de criar outro pedido, o cartão tem "Editar itens": junta, tira ou muda quantidades no mesmo pedido
 * (mesmo número e código). Só até "Em preparação"; depois de sair para entrega fica bloqueado.
 * - Os produtos que já estavam mantêm o preço do pedido; os novos entram ao preço atual do menu.
 * - Total e custo de produção são recalculados na base de dados (edit_order_items); o desconto e a taxa mantêm-se.
 * - Cada alteração fica registada (order_changes) e aparece no cartão, com ligação para enviar o total novo
 *   pelo WhatsApp. O talão impresso depois da alteração sai com "PEDIDO ALTERADO" e o que mudou.
 */
document.head.insertAdjacentHTML("beforeend", `<style>
.ed-linha{display:flex;align-items:center;justify-content:space-between;gap:.6rem;padding:.55rem 0;border-bottom:1px solid var(--linha)}
.ed-linha:last-child{border-bottom:0}
.ed-linha small{display:block;color:var(--tinta-2)}
.ed-linha.tirado strong{text-decoration:line-through;color:var(--tinta-2)}
.ed-novo{color:var(--sakura);font-weight:700}
.ed-alterado{border-left:3px solid var(--sakura);padding:.4rem .7rem;margin:.6rem 0;background:var(--sakura-claro);border-radius:6px}
.ed-alterado p{margin:.15rem 0}
</style>`);

const EDITAVEIS = ["received", "confirmed", "preparing", "ready"];
let edicao = null, edVoltar = "adm-pedidos";

/** Chave do ITEM (menu) que corresponde a uma linha do pedido, para andar de porção em porção. */
function edChaveLinha(l) {
  if (!l.product_id) return null;
  const m = /\((fresca|natural)\)$/i.exec(l.nome);
  const k = m && typeof chaveTemp === "function" ? chaveTemp(l.product_id, m[1].toLowerCase()) : l.product_id;
  return ITEM[k] ? k : null;
}

/** Passo do + / − (porções de 4 nos produtos vendidos assim). */
const edPasso = k => (k && ITEM[k] && ITEM[k].min) || 1;

/** Linha já existente no pedido para uma chave do menu (para juntar à mesma linha em vez de criar outra). */
const edLinhaDe = k => edicao.linhas.find(l => edChaveLinha(l) === k);

/** Começa a edição a partir do pedido carregado na gestão. */
function edComecar(p) {
  edicao = {
    id: p.id, numero: p.number, codigo: p.public_code, nota: "",
    linhas: (p.order_items || []).map(i => ({ item_id: i.id, product_id: i.product_id, nome: i.product_name, preco: +i.unit_price, q: +i.quantity, q0: +i.quantity })),
    novos: {}
  };
}

const edPedido = () => edicao && pedidosLoja.find(o => o.id === edicao.id);
const edSub = () => edicao.linhas.reduce((s, l) => s + l.preco * l.q, 0) + Object.entries(edicao.novos).reduce((s, [k, q]) => s + (ITEM[k] ? ITEM[k].preco * q : 0), 0);
const edMudou = () => edicao.linhas.some(l => l.q !== l.q0) || Object.values(edicao.novos).some(q => q > 0);
const edVazio = () => !edicao.linhas.some(l => l.q > 0) && !Object.values(edicao.novos).some(q => q > 0);

/** + / − de uma linha do pedido ou de um produto novo. */
function edControlo(tipo, id, q, nome, rotulo) {
  const n = esc(nome);
  if (!q) return `<button type="button" class="btn btn-sec" data-a="ed-mais" data-t="${tipo}" data-id="${esc(id)}" aria-label="${tipo === "l" ? "Repor" : "Juntar"} ${n}">${rotulo ? esc(rotulo) : tipo === "l" ? "Repor" : "Juntar"}</button>`;
  return `<div class="passo" role="group" aria-label="Quantidade de ${n}">${rotulo ? `<small style="margin-right:.3rem">${esc(rotulo)}</small>` : ""}<button type="button" data-a="ed-menos" data-t="${tipo}" data-id="${esc(id)}" aria-label="Tirar um">−</button><span>${q}</span><button type="button" data-a="ed-mais" data-t="${tipo}" data-id="${esc(id)}" aria-label="Juntar mais um">+</button></div>`;
}

/** Produtos que já estão no pedido. */
function edLinhasHtml() {
  return edicao.linhas.map((l, i) => {
    const muda = l.q !== l.q0, info = l.q ? `${eur(l.preco * l.q)}${muda ? ` <span class="ed-novo">(antes ${l.q0})</span>` : ""}` : "Tirado do pedido";
    return `<div class="ed-linha${l.q ? "" : " tirado"}"><div><strong>${esc(l.nome)}</strong><small>${info}</small></div>${edControlo("l", i, l.q, l.nome)}</div>`;
  }).join("");
}

/** Menu para juntar produtos (quando o produto já está no pedido, mexe na mesma linha). */
function edMenuHtml() {
  return D.categorias.map(c => {
    const ps = D.produtos.filter(p => p.cat === c.id && p.ativo !== false && ITEM[p.id]);
    if (!ps.length) return "";
    return `<div class="grupo"><h3>${esc(c.nome)}</h3>${ps.map(p => {
      const it = ITEM[p.id];
      const ctl = k => {
        const l = edLinhaDe(k);
        return l ? edControlo("l", edicao.linhas.indexOf(l), l.q, l.nome, it.temp ? ITEM[k].opcao : "") : edControlo("n", k, edicao.novos[k] || 0, ITEM[k].nome, it.temp ? ITEM[k].opcao : "");
      };
      const html = it.temp ? `<div class="temp-escolha">${OPCOES_TEMP.map(([o]) => ctl(chaveTemp(p.id, o))).join("")}</div>` : ctl(p.id);
      return `<div class="ed-linha"><div><strong>${esc(p.nome)}</strong><small>${it.min > 1 ? it.min + " un. " + eur(it.preco * it.min) : eur(it.preco)}</small></div>${html}</div>`;
    }).join("")}</div>`;
  }).join("");
}

/** Resumo: total antes e depois, diferença e aviso do troco. */
function edResumo() {
  const p = edPedido(); if (!p) return "";
  const sub = edSub(), desc = +p.discount || 0, taxa = +p.delivery_fee || 0, total = sub - desc + taxa, dif = total - (+p.total);
  const novos = Object.entries(edicao.novos).filter(([k, q]) => q > 0 && ITEM[k]);
  let troco = "";
  if (p.change_for && /^(Numerário|Dinheiro)$/.test(p.payment_method || "") && +p.change_for < total - 0.004)
    troco = `<p class="aviso">O cliente pediu troco para ${eur(+p.change_for)}, menos do que o total novo. Confirme com o cliente.</p>`;
  return `<div class="man-resumo">
    ${novos.map(([k, q]) => `<p><span class="ed-novo">+ ${q}x ${esc(ITEM[k].nome)}</span><span>${eur(ITEM[k].preco * q)}</span></p>`).join("")}
    <p><span>Produtos</span><span>${eur(sub)}</span></p>
    ${desc > 0 ? `<p><span>Desconto</span><span>−${eur(desc)}</span></p>` : ""}
    <p><span>Entrega</span><span>${taxa ? eur(taxa) : "Grátis"}</span></p>
    <p><span>Total antes</span><span>${eur(+p.total)}</span></p>
    <p class="total"><span>Total novo</span><span>${eur(total)}</span></p>
    ${Math.abs(dif) > 0.004 ? `<p><span>Diferença</span><span><strong>${dif > 0 ? "+" : "−"}${eur(Math.abs(dif))}</strong></span></p>` : ""}</div>${troco}
    ${desc > sub ? `<p class="aviso">O desconto (${eur(desc)}) fica maior do que os produtos.</p>` : ""}`;
}

/** Ecrã "Editar itens". */
function vEditarItens() {
  const p = edPedido();
  if (!edicao || !p) return { titulo: "Editar itens", corpo: `<p>O pedido já não está na lista.</p><p><button type="button" class="ligacao" data-a="ed-voltar">Voltar</button></p>` };
  const bloqueado = !EDITAVEIS.includes(p.status);
  return { titulo: `Editar itens · N.º ${p.number}`,
    corpo: `<p><button type="button" class="ligacao" data-a="ed-voltar">Voltar sem guardar</button></p>
      <p style="color:var(--tinta-2);margin:.4rem 0 1rem">${esc(p.customer_name)} · ${p.public_code ? "pedido " + esc(p.public_code) + " · " : ""}${ESTADOS[p.status]}. Fica o mesmo pedido, com o mesmo número. Os produtos que já estavam mantêm o preço; os que juntar entram ao preço atual.</p>
      ${bloqueado ? `<p class="aviso">Este pedido já não pode ser alterado (${ESTADOS[p.status]}).</p>` : ""}
      <div class="grupo"><h3>No pedido</h3>${edLinhasHtml()}</div>
      <h3 style="margin:1.2rem 0 .6rem">Juntar do menu</h3>
      ${edMenuHtml()}
      <div class="grupo"><label class="campo" style="margin-top:0"><span>Motivo (opcional)</span><input type="text" name="ed_nota" value="${esc(edicao.nota)}" maxlength="300" placeholder="Ex.: cliente pediu por WhatsApp" autocomplete="off"></label></div>
      <div id="ed-resumo" class="grupo">${edResumo()}</div>`,
    pe: `<div id="erros"></div><button type="button" class="btn btn-bloco" data-a="ed-guardar" ${bloqueado ? "disabled" : ""}>Guardar alterações</button>` };
}
VISTAS["adm-pedido-editar"] = vEditarItens;
GRUPOS["adm-pedido-editar"] = "pedidos";
FORMULARIOS.add("adm-pedido-editar");

/** Volta a desenhar sem perder a posição. */
function edRedesenhar(b) {
  const corpo = $("#folha-corpo"), y = corpo ? corpo.scrollTop : 0, sel = b ? `[data-a="${b.dataset.a}"][data-t="${b.dataset.t}"][data-id="${b.dataset.id}"]` : null;
  renderFolha();
  const c2 = $("#folha-corpo"); if (c2) c2.scrollTop = y;
  const alvo = sel && ($(sel) || $(`[data-t="${b.dataset.t}"][data-id="${b.dataset.id}"]`)); if (alvo) alvo.focus();
}

function edMexer(b, sinal) {
  if (!edicao) return;
  sujo = true; aGuardar = false; // sair da folha sem guardar pergunta primeiro
  const nota = campo("ed_nota"); if (nota) edicao.nota = nota.value;
  if (b.dataset.t === "l") {
    const l = edicao.linhas[+b.dataset.id]; if (!l) return;
    const passo = edPasso(edChaveLinha(l));
    l.q = Math.max(0, sinal > 0 && !l.q && l.q0 ? l.q0 : l.q + sinal * passo);
  } else {
    const k = b.dataset.id, passo = edPasso(k);
    edicao.novos[k] = Math.max(0, (edicao.novos[k] || 0) + sinal * passo);
  }
  edRedesenhar(b);
}

$("#folha").addEventListener("input", ev => {
  if (S.vista === "adm-pedido-editar" && ev.target.name === "ed_nota" && edicao) edicao.nota = ev.target.value;
});

Object.assign(ACOES, {
  "ed-abrir"(b) {
    const p = pedidosLoja.find(o => o.id === b.dataset.id); if (!p) return;
    edComecar(p); edVoltar = S.vista === "admin" ? "admin" : "adm-pedidos"; abrir("adm-pedido-editar");
  },
  "ed-mais"(b) { edMexer(b, 1); },
  "ed-menos"(b) { edMexer(b, -1); },
  "ed-voltar"() { edicao = null; sujo = false; abrir(edVoltar); },
  async "ed-guardar"() {
    const p = edPedido(); if (!p) return;
    const nota = campo("ed_nota"); if (nota) edicao.nota = nota.value;
    if (!edMudou()) return mostrarErros(["Ainda não mudou nada no pedido."]);
    if (edVazio()) return mostrarErros(["O pedido tem de ficar com pelo menos um produto. Para o anular, mude o estado para Cancelado."]);
    if ((+p.discount || 0) > edSub()) return mostrarErros(["O desconto fica maior do que os produtos."]);
    const items = edicao.linhas.map(l => ({ item_id: l.item_id, quantity: l.q }))
      .concat(Object.entries(edicao.novos).filter(([k, q]) => q > 0 && ITEM[k]).map(([k, q]) => {
        const it = ITEM[k], l = { product_id: it.base || k, quantity: q }; if (it.opcao) l.option = it.opcao; return l;
      }));
    let res;
    try { res = await api(`/admin/orders/${encodeURIComponent(p.id)}/items`, { method: "PUT", auth: true, body: { items, note: edicao.nota.trim() || null } }); }
    catch (err) { if (err.status === 401 || err.status === 403) return erroGestao(err); return mostrarErros([err.message]); }
    edicao = null; sujo = false;
    try { await carregarInicio(true); } catch (err) { /* a lista atualiza-se na próxima vez */ }
    abrir(edVoltar);
    const dif = +res.difference || 0;
    brinde(`Pedido alterado. Total ${eur(+res.total)}${Math.abs(dif) > 0.004 ? ` (${dif > 0 ? "+" : "−"}${eur(Math.abs(dif))})` : ""}`);
  }
});

/** Mensagem de WhatsApp com o que mudou e o total novo. */
function edMensagem(p, c) {
  const d = String(p.customer_phone).replace(/\D/g, ""), tel = d.length === 9 ? "351" + d : d;
  const msg = `Olá ${String(p.customer_name).split(" ")[0]}, atualizámos o seu pedido ${p.public_code || p.number}: ${c.summary}. Total novo: ${eur(+c.new_total)}. ${CONFIG.nome}`;
  return `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
}

/** Bloco "Pedido alterado" no cartão (a última alteração em destaque; as anteriores em resumo). */
function edBlocoAlterado(p) {
  const cs = p.changes || []; if (!cs.length) return "";
  const u = cs[cs.length - 1];
  const antes = cs.length > 1 ? `<p><small>${cs.length - 1} ${cs.length === 2 ? "alteração anterior" : "alterações anteriores"}: ${cs.slice(0, -1).map(c => esc(fmtData(c.changed_at)) + " " + esc(c.summary)).join(" · ")}</small></p>` : "";
  return `<div class="ed-alterado"><p><strong>Pedido alterado ${esc(fmtData(u.changed_at))}</strong></p>
    <p>${esc(u.summary)}${u.note ? ` <small>(${esc(u.note)})</small>` : ""}</p>
    <p>Total ${eur(+u.old_total)} → <strong>${eur(+u.new_total)}</strong></p>${antes}
    <p><a class="ligacao" href="${edMensagem(p, u)}" target="_blank" rel="noopener">Enviar o total novo pelo WhatsApp</a></p></div>`;
}

/* Cartão do pedido: bloco da alteração e botão "Editar itens". */
const cartaoSemEditar = cartaoOperacao;
cartaoOperacao = function (p) {
  let h = cartaoSemEditar(p);
  const bloco = edBlocoAlterado(p);
  if (bloco) {
    const i = h.indexOf("<p><strong>Total ") >= 0 ? h.indexOf("<p><strong>Total ") : h.indexOf("<p>Desconto de ");
    h = i >= 0 ? h.slice(0, i) + bloco + h.slice(i) : h;
  }
  if (!EDITAVEIS.includes(p.status) || !(p.order_items || []).every(i => i.id)) return h;
  const botao = `<p style="margin-top:.8rem"><button type="button" class="btn btn-sec btn-bloco" data-a="ed-abrir" data-id="${esc(p.id)}">Editar itens</button></p>`;
  const avancar = h.indexOf('<p style="margin-top:.8rem"><button type="button" class="btn btn-bloco" data-a="pedido-avancar"');
  if (avancar >= 0) return h.slice(0, avancar) + botao + h.slice(avancar);
  return h.replace(/(<label class="campo"><span>Mudar estado)/, botao + "$1");
};

/* Talão impresso depois de uma alteração: "PEDIDO ALTERADO" e o que mudou, na caixa das notas (HTML e PDF). */
function edParaTalao(p) {
  const cs = p && p.changes; if (!cs || !cs.length) return p;
  const u = cs[cs.length - 1];
  const txt = `PEDIDO ALTERADO ${fmtData(u.changed_at)}: ${u.summary}`;
  return Object.assign({}, p, { notes: p.notes ? txt + " · " + p.notes : txt });
}
if (typeof talaoHtml === "function") {
  const talaoSemAlterado = talaoHtml;
  talaoHtml = function (p, papel, via) { return talaoSemAlterado(edParaTalao(p), papel, via).replace("NOTAS: PEDIDO ALTERADO", "PEDIDO ALTERADO"); };
}
if (typeof impTalaoPdf === "function") {
  const pdfSemAlterado = impTalaoPdf;
  impTalaoPdf = function (doc, p, ...resto) { return pdfSemAlterado(doc, edParaTalao(p), ...resto); };
}

if (S.vista && /^(admin|adm-pedidos)$/.test(S.vista)) renderFolha();
