/* ---------- Raio-X por abas ----------
 * O ecrã era uma página muito comprida. Agora:
 * - Topo: período (compacto) e abas fixas ao rolar: Resumo · Quando · Origem · Produtos · Carrinhos · Aparelhos.
 * - Resumo: os 4 números, o funil e "Destaques" que levam à aba com o detalhe.
 * - Listas longas mostram as 5 primeiras; o resto fica em "Ver todos".
 * A aba escolhida fica guardada neste aparelho.
 */
document.head.insertAdjacentHTML("beforeend", `<style>
.rx-periodo{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:.6rem}
.rx-periodo select{min-height:40px;padding:.3rem 2rem .3rem .7rem;border-radius:10px;border:1px solid var(--linha);background:var(--papel);font:inherit;color:inherit}
.rx-periodo small{color:var(--tinta-2)}
.rx-abas{position:sticky;top:-1.2rem;z-index:2;margin:0 -1.2rem 1rem;padding:.55rem 1.2rem;background:var(--sal);border-bottom:1px solid var(--linha);display:flex;gap:.4rem;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.rx-abas::-webkit-scrollbar{display:none}
.rx-abas button{flex:none;border:1.5px solid var(--linha);background:var(--papel);color:inherit;border-radius:999px;padding:.45rem .85rem;font:inherit;font-weight:700;font-size:.9rem;min-height:40px;white-space:nowrap}
.rx-abas button[aria-selected="true"]{background:var(--sakura);border-color:var(--sakura);color:var(--sobre-petala,#fff)}
.rx-abas b{display:inline-block;min-width:1.3em;margin-left:.3rem;padding:0 .35em;border-radius:999px;background:var(--sakura-claro);color:var(--sakura);font-size:.78rem;line-height:1.5}
.rx-abas button[aria-selected="true"] b{background:#ffffff40;color:inherit}
.rx-destaques{display:grid;gap:0;margin:0;padding:0;list-style:none}
.rx-destaques li + li{border-top:1px solid var(--linha)}
.rx-destaques button{width:100%;display:grid;grid-template-columns:1fr auto;align-items:center;gap:.1rem .6rem;text-align:left;background:none;border:0;padding:.65rem 0;font:inherit;color:inherit;cursor:pointer}
.rx-destaques small{color:var(--tinta-2);grid-column:1}
.rx-destaques span.seta{grid-row:1/3;grid-column:2;color:var(--sakura);font-weight:700}
.rx-mais summary{cursor:pointer;color:var(--sakura);font-weight:700;font-size:.9rem;margin-top:.5rem;list-style:none}
.rx-mais summary::-webkit-details-marker{display:none}
.rx-mais[open] summary{margin-bottom:.2rem}
.rx-dobra > summary{cursor:pointer;font-weight:700;list-style:none;display:flex;justify-content:space-between}
.rx-dobra > summary::-webkit-details-marker{display:none}
.rx-dobra > summary::after{content:"Mostrar";color:var(--sakura);font-size:.9rem}
.rx-dobra[open] > summary::after{content:"Esconder"}
</style>`);

const RX_ABAS = { resumo: "Resumo", quando: "Quando", origem: "Origem", produtos: "Produtos", carrinhos: "Carrinhos", aparelhos: "Aparelhos" };
raioX.aba = RX_ABAS[LS.get("rxAba", "")] ? LS.get("rxAba", "") : "resumo";

/** Como rxBarras, mas só as primeiras n; o resto em "Ver todos". */
function rxBarrasCurtas(lista, nome, valor, extra, n = 5) {
  const html = rxBarras(lista, nome, valor, extra), itens = html.match(/<li>[\s\S]*?<\/li>/g);
  if (!itens || itens.length <= n) return html;
  return `<ul class="rx-barras">${itens.slice(0, n).join("")}</ul><details class="rx-mais"><summary>Ver todos (${itens.length})</summary><ul class="rx-barras">${itens.slice(n).join("")}</ul></details>`;
}

/** Linha de destaque do Resumo que abre a aba com o detalhe. */
const rxDestaque = (aba, titulo, texto) => `<li><button type="button" data-a="rx-aba" data-aba="${aba}"><strong>${titulo}</strong><small>${texto}</small><span class="seta" aria-hidden="true">›</span></button></li>`;

const rxSecoes = {
  resumo(d) {
    const f = d.funil, p = d.pedidos, fora = d.pedidos_fora;
    const tempo = d.tempo_medio_seg >= 60 ? Math.round(d.tempo_medio_seg / 60) + " min" : d.tempo_medio_seg + " s";
    const top = (l, k) => (l || []).slice().sort((a, b) => b[k] - a[k])[0];
    const hora = top(d.mapa, "visitas"), origem = top(d.origens, "visitas"), prod = top((d.produtos || []).filter(x => +x.carrinhos), "carrinhos"), ab = (d.abandonados || []).length;
    const local = top(d.localidades_pedidos, "pedidos");
    const dest = [
      hora && rxDestaque("quando", "Mais movimento", `${RX_DIAS[hora.dow]} às ${hora.hora}h (${hora.visitas} visitas)`),
      origem && rxDestaque("origem", "Principal origem", `${esc(RX_ORIGENS[origem.origem] || origem.origem)} · ${rxPct(origem.visitas, f.visitas)} % das visitas${local ? ` · mais pedidos em ${esc(local.nome)}` : ""}`),
      prod && rxDestaque("produtos", "Mais vezes no carrinho", `${esc(prod.nome)} (${prod.carrinhos})`),
      rxDestaque("carrinhos", "Carrinhos abandonados", ab ? `${ab} ${ab === 1 ? "visita juntou" : "visitas juntaram"} produtos e não enviou` : "Nenhum neste período")
    ].filter(Boolean).join("");
    return `<div class="grupo"><div class="rx-kpis">
        <div class="rx-kpi"><strong>${f.visitas}</strong><small>visitas</small></div>
        <div class="rx-kpi"><strong>${f.carrinho}</strong><small>juntaram ao carrinho (${rxPct(f.carrinho, f.visitas)} %)</small></div>
        <div class="rx-kpi"><strong>${p.n}</strong><small>pedidos recebidos${p.n ? ", " + eur(+p.total) : ""}</small></div>
        <div class="rx-kpi"><strong>${rxPct(p.n, f.visitas)} %</strong><small>das visitas viraram pedido</small></div>
      </div>
      ${fora && fora.n ? `<p class="rx-nota">Fora do site (WhatsApp, telefone…): ${fora.n} ${fora.n === 1 ? "pedido" : "pedidos"}, ${eur(+fora.total)}. Não contam na conversão.</p>` : ""}
      <p class="rx-nota">Tempo médio de quem viu o menu: ${tempo}. Voltaram ao site: ${d.repetidas} de ${f.visitas} visitas.</p></div>
      <div class="grupo"><h3>Destaques</h3><ul class="rx-destaques">${dest}</ul></div>
      <div class="grupo"><h3>Do menu ao pedido</h3>${rxFunil(f)}<p class="rx-nota">"Enviaram o pedido" conta quem carregou em enviar no site. Os pedidos recebidos vêm da lista de pedidos.</p></div>`;
  },
  quando(d) {
    return `<div class="grupo"><h3>Visitas por dia</h3>${rxDias(d.por_dia)}</div>
      <div class="grupo"><h3>Dias e horas com mais visitas</h3>${rxMapa(d.mapa)}${rxHoras(d.por_hora)}</div>`;
  },
  origem(d) {
    const nomeCidade = c => c.cidade + (c.pais && c.pais !== "PT" ? " (" + c.pais + ")" : "");
    return `<div class="grupo"><h3>De onde vêm</h3>${rxBarrasCurtas(d.origens, x => RX_ORIGENS[x.origem] || x.origem, "visitas")}<p class="rx-nota">Para saber quantos vêm do flyer, o QR code deve abrir sakuraesalsushi.pt/?o=flyer. Para uma publicação, use ?o=instagram-post (ou outro nome).</p></div>
      <div class="grupo"><h3>Localidades dos pedidos</h3>${rxBarrasCurtas(d.localidades_pedidos, x => x.nome, "pedidos", x => `<small style="font-weight:400;color:var(--tinta-2)">${eur(+x.total)}</small>`)}<p class="rx-nota">Exatas: vêm da morada de entrega.</p></div>
      <div class="grupo"><h3>Onde estão as visitas</h3>${rxBarrasCurtas(d.cidades, nomeCidade, "visitas")}<p class="rx-nota">Cidade aproximada pela rede de internet. Nos dados móveis aparece muitas vezes a cidade da operadora (Viseu, Porto, Lisboa), não a aldeia.</p></div>`;
  },
  produtos(d) {
    const cinza = t => `<small style="font-weight:400;color:var(--tinta-2)">${t}</small>`;
    return `<div class="grupo"><h3>Mais pedidos</h3>${rxBarrasCurtas(d.mais_pedidos, x => x.nome, "quantidade", x => cinza(eur(+x.total)))}<p class="rx-nota">Pedidos reais feitos no site.</p></div>
      <div class="grupo"><h3>Foram para o carrinho</h3>${rxBarrasCurtas(d.produtos.filter(x => +x.carrinhos), x => x.nome, "carrinhos", x => cinza(x.unidades + " un."))}</div>
      <div class="grupo"><h3>Menus mais vistos</h3>${rxBarrasCurtas(d.categorias, x => x.nome, "visitas")}</div>
      <div class="grupo"><h3>Fotos mais abertas</h3>${rxBarrasCurtas(d.produtos.filter(x => +x.fotos).sort((a, b) => b.fotos - a.fotos), x => x.nome, "fotos")}</div>`;
  },
  carrinhos(d) {
    return `<div class="grupo"><h3>Carrinhos abandonados</h3><p class="rx-nota" style="margin:0 0 .6rem">Visitas que juntaram produtos e não enviaram o pedido. Sem nome nem contacto: o site não sabe quem são.</p>${rxAbandonados(d.abandonados)}</div>`;
  },
  aparelhos(d) {
    const contar = !LS.get("naoContar", false);
    return `<div class="grupo"><h3>Aparelhos</h3>${rxBarras(d.aparelhos, x => RX_APARELHOS[x.aparelho] || x.aparelho, "visitas")}</div>
      <div class="grupo"><h3>Modelos</h3>${rxBarrasCurtas(d.modelos, x => x.nome, "visitas")}<p class="rx-nota">O iPhone não diz o modelo ao site: é estimado pelo tamanho do ecrã. Nos Android aparece o código do modelo quando o navegador o revela.</p></div>
      <details class="grupo rx-dobra"><summary>Sistema, navegador e idioma</summary>
        <h3 style="margin-top:1rem">Sistema</h3>${rxBarrasCurtas(d.sistemas, x => x.nome, "visitas")}
        <h3 style="margin-top:1rem">Navegador</h3>${rxBarrasCurtas(d.navegadores, x => x.nome, "visitas")}
        <h3 style="margin-top:1rem">Idioma do telemóvel</h3>${rxBarrasCurtas(d.idiomas, x => RX_IDIOMAS[x.nome] || RX_IDIOMAS[String(x.nome).slice(0, 2)] || x.nome, "visitas")}</details>
      <div class="grupo"><h3>Este aparelho</h3><p class="rx-nota" style="margin-top:0">${contar ? "As visitas deste aparelho estão a contar." : "Este aparelho não conta nas estatísticas (entrou na gestão)."}</p>
        <p class="rx-nota">Noutros aparelhos teus (ou da família) sem entrar na gestão: abre neles sakuraesalsushi.pt/?naocontar. Para voltar a contar: ?contar.</p>
        <p style="margin-top:.6rem"><button type="button" class="btn btn-sec" data-a="rx-contar">${contar ? "Não contar este aparelho" : "Voltar a contar este aparelho"}</button></p></div>`;
  }
};

VISTAS["adm-raiox"] = function () {
  const d = raioX.dados;
  const ops = Object.keys(PERIODOS).filter(k => k !== "personalizado").map(k => `<option value="${k}" ${k === raioX.tipo ? "selected" : ""}>${PERIODOS[k]}</option>`).join("");
  const ab = (d.abandonados || []).length;
  const abas = Object.keys(RX_ABAS).map(k => `<button type="button" role="tab" aria-selected="${k === raioX.aba}" data-a="rx-aba" data-aba="${k}">${RX_ABAS[k]}${k === "carrinhos" && ab ? `<b>${ab}</b>` : ""}</button>`).join("");
  return { titulo: "Raio-X do site",
    corpo: VOLTAR + `<div class="rx-periodo"><select name="periodoRx" aria-label="Período">${ops}</select><small>${fmtDia(raioX.de)} a ${fmtDia(raioX.ate)}</small></div>
      <div class="rx-abas" role="tablist" aria-label="Secções do Raio-X">${abas}</div>
      <div role="tabpanel">${rxSecoes[raioX.aba](d)}</div>` };
};

ACOES["rx-aba"] = function (b) {
  raioX.aba = b.dataset.aba; LS.set("rxAba", raioX.aba);
  renderFolha();
  const corpo = $(".folha-corpo"), barra = $(".rx-abas");
  if (corpo && barra) {
    corpo.scrollTop = 0;
    const sel = barra.querySelector('[aria-selected="true"]');
    if (sel) barra.scrollLeft = sel.offsetLeft - barra.clientWidth / 2 + sel.clientWidth / 2;
  }
};

if (S.vista === "adm-raiox" && raioX.dados) renderFolha();
