/* ---------- calculadora de preço: custo da receita ao vivo, margem e preço sugerido ---------- */
document.head.insertAdjacentHTML("beforeend", `<style>
.calc-linha{display:grid;grid-template-columns:1fr 7.5rem;gap:.6rem;align-items:end;margin-top:.8rem}
.calc-linha .custo-l{grid-column:1 / -1;display:flex;justify-content:space-between;color:var(--tinta-2);font-size:.92rem}
.calc-res{display:grid;gap:.45rem;margin-top:1rem}
.calc-res .l{display:flex;justify-content:space-between;gap:1rem}
.calc-res .forte{font-weight:800;font-size:1.15rem;color:var(--sakura)}
.calc-res .sep{border-top:1px solid var(--linha);padding-top:.45rem}
.passo-calc{display:flex;gap:.7rem;align-items:flex-start;text-align:left}
.passo-calc b{flex:none;width:1.7rem;height:1.7rem;border-radius:50%;background:var(--sakura);color:var(--sobre-sakura);display:grid;place-items:center;font-size:.9rem}
</style>`);

/**
 * Custo por unidade base de um componente escolhido no seletor.
 * @param {string} ref Referência "i:", "p:" ou "c:" seguida do id.
 * @returns {{c:number,u:string}|null} Custo e unidade (g, ml ou un).
 */
function custoRef(ref) {
  if (!ref) return null;
  const t = ref[0], id = ref.slice(2);
  if (t === "i") { const i = custos.ingredientes.find(x => x.id === id); return i ? { c: +i.unit_cost || 0, u: i.unit } : null; }
  if (t === "p") { const p = custos.preparacoes.find(x => x.id === id); return p ? { c: +custos.prep[id] || 0, u: p.unit } : null; }
  return { c: +custos.produto[id] || 0, u: "un" };
}

/**
 * Linhas do editor com a unidade e o custo de cada linha.
 * @param {boolean} soIngredientes Limita a ingredientes (preparados).
 * @returns {string} HTML das linhas e do botão de adicionar.
 */
linhasEditor = function (soIngredientes) {
  return S.editar.itens.map((l, n) => `<div class="calc-linha"><label class="campo" style="margin:0"><span>Ingrediente ou preparado</span><select name="ref${n}">${opcoesRef(l.ref, soIngredientes)}</select></label>
    <label class="campo" style="margin:0"><span>Quanto <span id="lu${n}"></span></span><input type="text" name="q${n}" inputmode="decimal" value="${esc(l.q)}" placeholder="0"></label>
    <div class="custo-l"><span id="lc${n}"></span><button type="button" class="ligacao" data-a="linha-apagar" data-i="${n}">Tirar</button></div></div>`).join("") + `<p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="linha-nova">Adicionar ingrediente</button></p>`;
};

/**
 * Lê as linhas do ecrã, mostra o custo de cada uma e devolve o total.
 * @returns {number} Custo total das linhas.
 */
function somarLinhas() {
  let total = 0;
  S.editar.itens.forEach((_, n) => {
    const r = campo("ref" + n), q = campo("q" + n), k = custoRef(r && r.value), qt = q ? num(q.value) : NaN;
    $("#lu" + n).textContent = k ? "(" + k.u + ")" : "";
    const v = k && qt > 0 ? k.c * qt : 0;
    total += v;
    $("#lc" + n).textContent = k && qt > 0 ? fmtQtd(qt) + " " + k.u + " × " + fmtCusto(k.c) + " = " + fmtCusto(v) : "";
  });
  return total;
}

/** Margem e IVA guardados neste dispositivo. */
function preferenciasCalc() { return { m: LS.get("calc_margem", "65"), iva: LS.get("calc_iva", "0") }; }

/**
 * Faz as contas da receita de um produto com a margem e o IVA escritos.
 * @returns {object} Custos, preço sugerido e comparação com o preço atual.
 */
function contasFicha() {
  const total = somarLinhas(), rend = num(campo("rend").value), m = num(campo("margem").value) / 100, iva = (num(campo("iva").value) || 0) / 100;
  const p = D.produtos.find(x => x.id === S.editar.id) || {}, porUn = rend > 0 ? total / rend : NaN;
  const semIva = m >= 0 && m < 1 ? porUn / (1 - m) : NaN, comIva = semIva * (1 + iva), redondo = Math.ceil(comIva * 20 - 1e-9) / 20;
  const atual = +p.preco || 0, atualSemIva = atual / (1 + iva);
  return { total, rend, porUn, m, iva, semIva, comIva, redondo, atual, min: +p.min || 1, margemAtual: atualSemIva > 0 ? (atualSemIva - porUn) / atualSemIva : NaN };
}

/** Mostra o resultado da calculadora enquanto se escreve. */
function mostrarContasFicha() {
  const c = contasFicha(), el = $("#calc-res"), usar = $("#btn-usar"), pc = n => isFinite(n) ? Math.round(n * 100) + " %" : "—";
  const l = (a, b, cls = "") => `<div class="l ${cls}"><span>${a}</span><span>${b}</span></div>`;
  if (!(c.total > 0) || !(c.rend > 0)) { el.innerHTML = `<p class="nota" style="margin:0">Escolha os ingredientes, as quantidades e quantas unidades a receita faz.</p>`; usar.hidden = true; return; }
  const ok = isFinite(c.redondo) && c.redondo > 0, vezes = c.min > 1 ? l(`Pedido mínimo de ${c.min} un.`, eur(c.redondo * c.min)) : "";
  el.innerHTML = l("Custo da receita", fmtCusto(c.total)) + l(`Custo por unidade (÷ ${fmtQtd(c.rend)})`, fmtCusto(c.porUn))
    + (ok ? l(`Preço com margem de ${pc(c.m)}${c.iva ? " e IVA de " + pc(c.iva) : ""}`, fmtCusto(c.comIva), "sep") + l("Preço sugerido", eur(c.redondo), "forte") + vezes
      + l("Fica de lucro por unidade", eur(c.redondo / (1 + c.iva) - c.porUn)) : `<p class="erros" style="margin:0">A margem tem de estar entre 0 e 99 %.</p>`)
    + (c.atual ? l(`Hoje vende a ${eur(c.atual)}`, "margem " + pc(c.margemAtual), "sep") : "");
  usar.hidden = !ok || Math.abs(c.redondo - c.atual) < 0.005;
  usar.textContent = `Guardar e pôr ${eur(c.redondo)} no site`;
}

/** Mostra o custo do lote de um preparado e quanto custa cada kg, litro ou unidade pronta. */
function mostrarContasPreparado() {
  const total = somarLinhas(), rend = num(campo("rend").value), u = campo("unidade").value, el = $("#calc-res");
  el.innerHTML = total > 0 && rend > 0 ? `<div class="l"><span>Custo do lote</span><span>${fmtCusto(total)}</span></div><div class="l forte"><span>Pronto a usar</span><span>${precoLegivel(total / rend, u)}</span></div>`
    : `<p class="nota" style="margin:0">Escreva o que entra e quanto fica pronto para ver a quanto fica.</p>`;
}

/**
 * Calculadora de preço de um produto.
 * @returns {{titulo:string, corpo:string, pe:string}} Conteúdo da folha.
 */
vAdmFicha = function () {
  const e = S.editar, p = D.produtos.find(x => x.id === e.id) || {}, pr = preferenciasCalc();
  return { titulo: "Calculadora de preço",
    corpo: VOLTAR_CUSTOS + `<div class="grupo"><h3 style="margin:0">${esc(e.nome)}</h3><small style="color:var(--tinta-2)">Hoje no site: ${eur(+p.preco || 0)}${p.min > 1 ? " por unidade, mínimo " + p.min : ""}</small>
      <label class="campo"><span>Esta receita faz quantas unidades?</span><input type="text" name="rend" inputmode="decimal" value="${esc(e.rend)}"><small>Exemplo: meia folha de nori, 60 g de arroz e 60 g de salmão fazem 4 hossomaki, escreva 4. Um combinado é 1.</small></label></div>
      <div class="grupo"><h3>O que leva</h3>${linhasEditor(false)}</div>
      <div class="grupo"><h3>Margem e preço</h3><div class="par"><label class="campo" style="margin-top:0"><span>Margem de lucro (%)</span><input type="text" name="margem" inputmode="decimal" value="${esc(pr.m)}"></label>
      <label class="campo" style="margin-top:0"><span>IVA a somar (%)</span><input type="text" name="iva" inputmode="decimal" value="${esc(pr.iva)}"></label></div>
      <small style="color:var(--tinta-2)">Margem de 65 % quer dizer que, de cada 10 € vendidos, 6,50 € ficam para si e 3,50 € pagam a matéria-prima. Se ainda não cobra IVA, deixe 0.</small>
      <div id="calc-res" class="calc-res" aria-live="polite"></div></div><div id="erros"></div>`,
    pe: `<div class="pilha"><button type="button" class="btn btn-bloco" id="btn-usar" data-a="adm-ficha-preco" hidden></button><button type="button" class="btn btn-sec btn-bloco" data-a="adm-ficha-guardar">Guardar só a receita</button></div>` };
};

const vPreparadoBase = VISTAS["adm-preparacao"];
/**
 * Preparado com o custo do lote ao vivo.
 * @returns {{titulo:string, corpo:string, pe:string}} Conteúdo da folha.
 */
function vPreparadoComContas() {
  const v = vPreparadoBase();
  v.corpo = v.corpo.replace(`<div id="erros"></div>`, `<div class="grupo"><h3>Quanto custa pronto</h3><div id="calc-res" class="calc-res" aria-live="polite"></div></div><div id="erros"></div>`)
    .replace("O rendimento é quanto fica pronto a usar.", "Rendimento é quanto fica pronto a usar, depois de cozido ou limpo. Exemplo: 1000 g de arroz cru com 100 ml de vinagre dão 2200 g de arroz pronto.");
  return v;
}

const vCustosBase = VISTAS["adm-custos"];
/**
 * Calculadora: os três passos e a lista de produtos com custo e margem.
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vCalculadora() {
  const v = vCustosBase(), passo = (n, t, d) => `<div class="passo-calc"><b>${n}</b><span><strong>${t}</strong><br><small style="color:var(--tinta-2)">${d}</small></span></div>`;
  v.titulo = "Calculadora de preço";
  v.corpo = v.corpo.replace(`<div class="pilha" style="margin-bottom:1rem">`, `<div class="grupo pilha">${passo(1, "Registe o que compra", "Arroz 1 kg a 1,80 €, nori 50 folhas a 14,50 €, salmão 1 kg a 13 €.")}${passo(2, "Diga quanto rende pronto", "Arroz cru vira arroz cozido, salmão inteiro vira salmão limpo.")}${passo(3, "Monte a receita de cada produto", "Escolha o que leva, a margem, e veja o preço sugerido.")}</div><div class="pilha" style="margin-bottom:1rem">`)
    .replace(/>Preparações \(/, ">Preparados: cozido, limpo (").replace(/data-a="adm-ficha"([^>]*)>Ficha técnica</g, 'data-a="adm-ficha"$1>Calcular preço<').replace(/Sem ficha técnica/g, "Ainda sem receita");
  return v;
}

const vIngredientesBase = VISTAS["adm-ingredientes"];
/**
 * Lista de ingredientes com atalho para criar a versão pronta (cozida ou limpa).
 * @returns {{titulo:string, corpo:string}} Conteúdo da folha.
 */
function vIngredientesComPreparado() {
  const v = vIngredientesBase();
  custos.ingredientes.filter(i => i.kind !== "packaging").forEach(i => {
    v.corpo = v.corpo.replace(`data-a="adm-ing" data-id="${esc(i.id)}">Editar</button>`, `data-a="adm-ing" data-id="${esc(i.id)}">Editar</button><button type="button" class="ligacao" data-a="adm-prep-de" data-id="${esc(i.id)}">Rende pronto</button>`);
  });
  return v;
}

Object.assign(VISTAS, { "adm-ficha": vAdmFicha, "adm-preparacao": vPreparadoComContas, "adm-custos": vCalculadora, "adm-ingredientes": vIngredientesComPreparado });

const renderSemContas = renderFolha;
/** Desenha a folha e, nas calculadoras, faz logo as contas. */
renderFolha = function () {
  renderSemContas();
  if (S.vista === "adm-ficha") mostrarContasFicha();
  if (S.vista === "adm-preparacao") mostrarContasPreparado();
};

["input", "change"].forEach(t => $("#folha").addEventListener(t, ev => {
  if (S.vista === "adm-ficha") {
    if (ev.target.name === "margem") LS.set("calc_margem", ev.target.value);
    if (ev.target.name === "iva") LS.set("calc_iva", ev.target.value);
    mostrarContasFicha();
  } else if (S.vista === "adm-preparacao") mostrarContasPreparado();
}));

const vMaisSemCalc = VISTAS["adm-mais"];
VISTAS["adm-mais"] = function () { const v = vMaisSemCalc(); v.corpo = v.corpo.replace("<span>Custos e fichas técnicas</span>", "<span>Calculadora de preço</span>").replace("Ingredientes e margens", "Custo, margem e preço sugerido"); return v; };

Object.assign(ACOES, {
  "adm-prep-de"(b) {
    const i = custos.ingredientes.find(x => x.id === b.dataset.id); if (!i) return;
    S.editar = { id: "", nome: i.name + (i.unit === "g" ? " pronto" : ""), unidade: i.unit, rend: "", itens: [{ ref: "i:" + i.id, q: i.unit === "un" ? "1" : "1000" }] };
    abrir("adm-preparacao");
  },
  "adm-ficha-preco"() {
    const f = corpoEditor(), c = contasFicha(), p = D.produtos.find(x => x.id === S.editar.id);
    if (f.erros.length) return mostrarErros(f.erros);
    if (!p || !(c.redondo > 0)) return mostrarErros(["Não foi possível calcular o preço."]);
    const produto = { category_id: p.cat, name: p.nome, description: p.desc || null, price: c.redondo, min_qty: +p.min || 1, pieces: parseInt(p.pecas, 10) || null, photo_url: p.foto || null, active: p.ativo !== false };
    custosAcao(async () => {
      await api("/admin/products/" + S.editar.id + "/recipe", { method: "PUT", auth: true, body: { recipe_yield: f.rend, items: f.items } });
      await api("/admin/products/" + S.editar.id, { method: "PUT", auth: true, body: produto });
      await carregarAdmin();
    }, "Receita guardada e preço atualizado no site", "adm-custos");
  }
});
