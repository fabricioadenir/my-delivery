/* ---------- Resultados: produtos mais vendidos por abas ----------
 * Pedido do Fabricio (18/11): a lista única de "Produtos mais vendidos" misturava combinados, peças e quentes.
 * Agora há abas como no Raio-X:
 * - Resumo: quanto cada categoria vendeu (valor, % das vendas, lucro, pedidos) e o mais vendido de cada uma.
 * - Por peça: cada peça no total, juntando as vendidas avulso (porções de 4) e as que foram dentro dos
 *   combinados (pela receita atual de cada combinado), com o detalhe de em que combinados saíram.
 * - Uma aba por categoria com vendas (Combinados, Unidades, Quentes, Bebidas…): o que foi pedido assim.
 * Os dados vêm de dashboard → product_sales (função vendas_por_produto). A aba escolhida fica no aparelho.
 * Trocar de aba não volta a desenhar o ecrã (não perde a posição).
 */
document.head.insertAdjacentHTML("beforeend", `<style>
.rs-abas{position:static;margin:0 0 .9rem;padding:0 0 .2rem;background:none;border:0}
.rs-lista{display:grid;gap:.75rem;margin:0;padding:0;list-style:none}
.rs-lista li{display:grid;grid-template-columns:1.6rem 1fr auto;gap:.1rem .5rem;align-items:baseline}
.rs-lista .rs-n{color:var(--tinta-2);font-weight:700;font-size:.85rem}
.rs-lista .rs-q{font-weight:700;white-space:nowrap}
.rs-lista small{grid-column:2/-1;color:var(--tinta-2);display:block;line-height:1.35}
.rs-lista .rx-b{grid-column:2/-1;height:7px;border-radius:4px;background:var(--linha,rgba(127,127,127,.18));overflow:hidden;margin-top:.15rem}
.rs-lista .rx-b i{display:block;height:100%;background:var(--sakura);border-radius:4px}
.rs-lista .rx-b i.rs-comb{background:var(--sakura-claro);box-shadow:inset 0 0 0 1px var(--sakura)}
.rs-lista .rs-barra2{display:flex}
.rs-lista details{grid-column:2/-1}
.rs-lista details summary{cursor:pointer;color:var(--sakura);font-weight:700;font-size:.85rem;list-style:none;margin-top:.15rem}
.rs-lista details summary::-webkit-details-marker{display:none}
.rs-lista details li{display:list-item;padding:.1rem 0}
.rs-lista details ul{margin:.3rem 0 0;padding:0 0 0 .8rem;list-style:none;font-size:.88rem;color:var(--tinta-2)}
.rs-legenda{display:flex;gap:1rem;flex-wrap:wrap;font-size:.82rem;color:var(--tinta-2);margin:0 0 .7rem}
.rs-legenda i{display:inline-block;width:.8rem;height:.8rem;border-radius:3px;vertical-align:-.1rem;margin-right:.3rem;background:var(--sakura)}
.rs-legenda i.rs-comb{background:var(--sakura-claro);box-shadow:inset 0 0 0 1px var(--sakura)}
</style>`);

/** Número com no máximo uma casa decimal, à portuguesa (12 · 4,5). */
const rsNum = n => { const v = Math.round(+n * 10) / 10; return String(v).replace(".", ","); };
/** Percentagem inteira de a em b. */
const rsPct = (a, b) => (+b > 0 ? Math.round(+a / +b * 100) : 0);
/** Chave da aba de uma categoria. */
const rsChave = c => "c:" + (c.id || c.nome);

let rsAba = LS.get("resAba", "resumo");

/**
 * Quantidade de um produto como se vende: combinados e bebidas em unidades,
 * peças em peças e porções (48 peças · 12 porções de 4).
 */
function rsQuantidade(p) {
  if (+p.min_qty > 1) {
    const porcoes = +p.quantidade / +p.min_qty;
    return { forte: rsNum(p.quantidade) + " peças", fraco: rsNum(porcoes) + (porcoes === 1 ? " porção de " : " porções de ") + p.min_qty };
  }
  return { forte: rsNum(p.quantidade) + (+p.quantidade === 1 ? " vendido" : " vendidos"), fraco: "" };
}

/** Lista com número, nome, quantidade à direita, detalhe por baixo e barra. */
function rsLista(itens, n = 8) {
  if (!itens.length) return `<p style="color:var(--tinta-2)">Sem vendas neste período.</p>`;
  const li = itens.map((x, i) => `<li><span class="rs-n">${i + 1}</span><strong>${esc(x.nome)}</strong><span class="rs-q">${x.q}</span>
    <small>${x.det}</small>${x.barra}${x.extra || ""}</li>`);
  if (li.length <= n) return `<ul class="rs-lista">${li.join("")}</ul>`;
  return `<ul class="rs-lista">${li.slice(0, n).join("")}</ul><details class="rx-mais"><summary>Ver todos (${li.length})</summary><ul class="rs-lista" style="margin-top:.75rem">${li.slice(n).join("")}</ul></details>`;
}

const rsBarra = (v, max) => `<span class="rx-b"><i style="width:${Math.max(3, +v / Math.max(+max, 1) * 100)}%"></i></span>`;

/** Aba Resumo: vendas por categoria. */
function rsResumo(ps) {
  const total = ps.categorias.reduce((s, c) => s + +c.receita, 0), max = Math.max(...ps.categorias.map(c => +c.receita), 1);
  const pecas = ps.pecas.reduce((s, p) => s + +p.total, 0), dentro = ps.pecas.reduce((s, p) => s + +p.em_combinados, 0);
  const itens = ps.categorias.map(c => {
    const prods = ps.produtos.filter(p => rsChave({ id: p.categoria_id, nome: p.categoria }) === rsChave(c));
    const top = prods[0], porPecas = prods.some(p => +p.min_qty > 1);
    const qtd = porPecas ? rsNum(prods.reduce((s, p) => s + +p.quantidade, 0)) + " peças" : rsNum(c.quantidade) + (+c.quantidade === 1 ? " vendido" : " vendidos");
    return { nome: c.nome, q: eur(+c.receita),
      det: `${rsPct(c.receita, total)} % das vendas · ${qtd} · lucro ${eur(+c.lucro)} · em ${c.pedidos} ${+c.pedidos === 1 ? "pedido" : "pedidos"}${top ? `<br>Mais vendido: ${esc(top.nome)} (${rsQuantidade(top).forte})` : ""}`,
      barra: rsBarra(c.receita, max) };
  });
  return rsLista(itens, 20) + (pecas ? `<p class="rx-nota" style="margin-top:.8rem">Peças feitas no período: <strong>${rsNum(pecas)}</strong> — ${rsNum(pecas - dentro)} vendidas avulso e ${rsNum(dentro)} dentro dos combinados. Vendas sem taxas de entrega e já com descontos.</p>` : "");
}

/** Aba Por peça: avulso + dentro dos combinados. */
function rsPecas(ps) {
  const max = Math.max(...ps.pecas.map(p => +p.total), 1);
  const itens = ps.pecas.map(p => {
    const av = +p.avulso, cb = +p.em_combinados;
    const partes = [av ? `${rsNum(av)} avulso${p.pedidos_avulso ? ` (${p.pedidos_avulso} ${+p.pedidos_avulso === 1 ? "pedido" : "pedidos"})` : ""}` : "nenhuma avulso", cb ? `${rsNum(cb)} em combinados` : "nenhuma em combinados"];
    const lista = (p.combinados || []).map(c => `<li>${esc(c.nome)}: ${rsNum(c.pecas)}</li>`).join("");
    return { nome: p.nome, q: rsNum(p.total) + " peças", det: partes.join(" · ") + ` · ${esc(p.categoria)}`,
      barra: `<span class="rx-b rs-barra2"><i style="width:${av / max * 100}%;border-radius:0"></i><i class="rs-comb" style="width:${cb / max * 100}%;border-radius:0"></i></span>`,
      extra: lista ? `<details><summary>Em que combinados</summary><ul>${lista}</ul></details>` : "" };
  });
  return `<p class="rs-legenda"><span><i></i>Avulso</span><span><i class="rs-comb"></i>Dentro dos combinados</span></p>${rsLista(itens, 10)}
    <p class="rx-nota" style="margin-top:.8rem">Conta cada peça vendida, seja avulso ou dentro de um combinado. As peças dos combinados vêm da receita atual de cada combinado (Calculadora de preço); combinados sem peças na receita não entram aqui.</p>`;
}

/** Aba de uma categoria: os produtos pedidos dessa categoria. */
function rsCategoria(ps, c) {
  const prods = ps.produtos.filter(p => rsChave({ id: p.categoria_id, nome: p.categoria }) === rsChave(c));
  const max = Math.max(...prods.map(p => +p.quantidade), 1);
  const itens = prods.map(p => {
    const q = rsQuantidade(p);
    return { nome: p.nome, q: q.forte,
      det: [q.fraco, eur(+p.receita), rsPct(p.receita, c.receita) + " % da categoria", p.sem_custo ? "sem ficha técnica" : "lucro " + eur(+p.lucro), `em ${p.pedidos} ${+p.pedidos === 1 ? "pedido" : "pedidos"}`].filter(Boolean).join(" · "),
      barra: rsBarra(p.quantidade, max) };
  });
  return `<p class="rx-nota" style="margin:0 0 .7rem">${esc(c.nome)}: ${eur(+c.receita)}, lucro ${eur(+c.lucro)}, em ${c.pedidos} ${+c.pedidos === 1 ? "pedido" : "pedidos"}.</p>${rsLista(itens, 10)}`;
}

const rankingsAntigo = rankings;
/** Produtos mais vendidos com abas; clientes e dias da semana ficam como estavam. */
rankings = function (d) {
  const antigo = rankingsAntigo(d), ps = d.product_sales;
  if (!ps || !ps.categorias) return antigo;
  const corte = antigo.indexOf(`<div class="grupo"><h3>Melhores clientes</h3>`), resto = corte >= 0 ? antigo.slice(corte) : "";
  const abas = [{ k: "resumo", t: "Resumo", html: () => rsResumo(ps) }];
  if (ps.pecas.length) abas.push({ k: "pecas", t: "Por peça", html: () => rsPecas(ps) });
  ps.categorias.forEach(c => abas.push({ k: rsChave(c), t: c.nome, html: () => rsCategoria(ps, c) }));
  const sel = abas.some(a => a.k === rsAba) ? rsAba : "resumo";
  if (!ps.categorias.length) return `<div class="grupo"><h3>Produtos mais vendidos</h3><p style="color:var(--tinta-2)">Sem vendas neste período.</p></div>` + resto;
  const botoes = abas.map(a => `<button type="button" role="tab" aria-selected="${a.k === sel}" data-a="res-aba" data-aba="${esc(a.k)}">${esc(a.t)}</button>`).join("");
  const paineis = abas.map(a => `<div role="tabpanel" data-painel="${esc(a.k)}"${a.k === sel ? "" : " hidden"}>${a.html()}</div>`).join("");
  return `<div class="grupo" id="res-produtos"><h3>Produtos mais vendidos</h3>
    <div class="rx-abas rs-abas" role="tablist" aria-label="Ver produtos por">${botoes}</div>${paineis}</div>` + resto;
};

ACOES["res-aba"] = function (b) {
  rsAba = b.dataset.aba; LS.set("resAba", rsAba);
  const g = b.closest("#res-produtos"); if (!g) return;
  g.querySelectorAll('[role="tab"]').forEach(x => x.setAttribute("aria-selected", String(x === b)));
  g.querySelectorAll("[data-painel]").forEach(p => { p.hidden = p.dataset.painel !== rsAba; });
  const barra = b.parentElement;
  barra.scrollLeft = b.offsetLeft - barra.clientWidth / 2 + b.clientWidth / 2;
};

if (S.vista === "adm-painel" && painel.dados) renderFolha();
