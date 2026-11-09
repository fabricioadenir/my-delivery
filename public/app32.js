/* ---------- Gestão → Mais → Raio-X do site: visitas, funil, público, horários e carrinhos abandonados ---------- */
const raioX = { tipo: "7dias", de: "", ate: "", dados: null };

document.head.insertAdjacentHTML("beforeend", `<style>
.rx-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:.6rem}
.rx-kpi{background:var(--sakura-claro);border-radius:14px;padding:.7rem .8rem}
.rx-kpi strong{display:block;font-size:1.6rem;line-height:1.1;color:var(--sakura)}
.rx-kpi small{color:var(--tinta-2)}
.rx-barras{display:grid;gap:.45rem;margin:.4rem 0 0;padding:0;list-style:none}
.rx-barras li{display:grid;grid-template-columns:1fr auto;gap:.15rem .6rem;font-size:.92rem}
.rx-barras .rx-b{grid-column:1/-1;height:8px;border-radius:4px;background:var(--linha,rgba(127,127,127,.18));overflow:hidden}
.rx-barras .rx-b i{display:block;height:100%;background:var(--sakura);border-radius:4px}
.rx-mapa{display:grid;grid-template-columns:2rem repeat(var(--h,24),minmax(0,1fr));gap:2px;font-size:.62rem;color:var(--tinta-2);margin-top:.5rem}
.rx-mapa span{display:flex;align-items:center;min-width:0;overflow:visible;white-space:nowrap}
.rx-mapa i{aspect-ratio:1;border-radius:2px;background:var(--sakura)}
.rx-mapa i.z{background:var(--linha,rgba(127,127,127,.15))}
.rx-dias{display:flex;align-items:flex-end;gap:3px;height:110px;margin-top:.5rem}
.rx-dias div{flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:1px;min-width:4px}
.rx-dias .v{background:var(--sakura);opacity:.35;border-radius:2px 2px 0 0}
.rx-dias .c{background:var(--sakura);border-radius:2px 2px 0 0}
.rx-legenda{display:flex;gap:1rem;font-size:.8rem;color:var(--tinta-2);margin-top:.3rem}
.rx-legenda i{display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--sakura);margin-right:.3rem;vertical-align:-1px}
.rx-nota{font-size:.85rem;color:var(--tinta-2);margin:.5rem 0 0}
</style>`);

const RX_ORIGENS = { direto: "Direto (link ou endereço escrito)", flyer: "Flyer (QR code)", instagram: "Instagram", facebook: "Facebook", google: "Google", "google-anuncio": "Anúncio Google", whatsapp: "WhatsApp", tiktok: "TikTok", "acompanhar-pedido": "Link de acompanhar pedido" };
const RX_APARELHOS = { telemovel: "Telemóvel", computador: "Computador", tablet: "Tablet" };
const RX_IDIOMAS = { pt: "Português", "pt-PT": "Português (Portugal)", "pt-BR": "Português (Brasil)", fr: "Francês", en: "Inglês", es: "Espanhol", de: "Alemão", it: "Italiano", nl: "Neerlandês" };
const RX_DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Percentagem inteira, sem dividir por zero. */
const rxPct = (a, b) => b ? Math.round(a / b * 100) : 0;

/** Lista de barras horizontais. */
function rxBarras(lista, nome, valor, extra) {
  if (!lista || !lista.length) return `<p class="rx-nota">Ainda sem dados.</p>`;
  const max = Math.max(...lista.map(x => +x[valor]), 1);
  return `<ul class="rx-barras">${lista.map(x => `<li><span>${esc(nome(x))}</span><strong>${+x[valor]}${extra ? " " + extra(x) : ""}</strong><span class="rx-b"><i style="width:${Math.max(3, +x[valor] / max * 100)}%"></i></span></li>`).join("")}</ul>`;
}

/** Funil: quantos passaram de cada passo. */
function rxFunil(f) {
  const passos = [["Visitas", f.visitas], ["Viram o menu", f.viram_menu], ["Juntaram ao carrinho", f.carrinho], ["Abriram o finalizar", f.finalizar], ["Enviaram o pedido", f.enviados]];
  return `<ul class="rx-barras">${passos.map((p, i) => `<li><span>${p[0]}</span><strong>${p[1]}${i ? ` <small style="font-weight:400;color:var(--tinta-2)">${rxPct(p[1], f.visitas)} %</small>` : ""}</strong><span class="rx-b"><i style="width:${Math.max(3, rxPct(p[1], f.visitas || 1))}%"></i></span></li>`).join("")}</ul>`;
}

/** Visitas e carrinhos por dia. */
function rxDias(dias) {
  if (!dias.length) return `<p class="rx-nota">Ainda sem visitas neste período.</p>`;
  const max = Math.max(...dias.map(d => +d.visitas), 1);
  const melhor = dias.reduce((a, b) => +b.visitas > +a.visitas ? b : a);
  return `<div class="rx-dias" role="img" aria-label="Visitas por dia">${dias.map(d => `<div title="${fmtDia(d.dia)}: ${d.visitas} visitas, ${d.carrinhos} com carrinho, ${d.enviados} pedidos"><span class="v" style="height:${Math.max(0, (+d.visitas - +d.carrinhos) / max * 100)}px"></span><span class="c" style="height:${+d.carrinhos / max * 100}px"></span></div>`).join("")}</div>
    <div class="rx-legenda"><span><i style="opacity:.35"></i>Visitas</span><span><i></i>Com carrinho</span></div>
    <p class="rx-nota">Melhor dia: ${fmtDia(melhor.dia)}, com ${melhor.visitas} visitas.</p>`;
}

/** Mapa de calor dia da semana × hora. */
function rxMapa(mapa) {
  if (!mapa.length) return `<p class="rx-nota">Ainda sem visitas neste período.</p>`;
  const v = {}; let max = 1;
  mapa.forEach(m => { v[m.dow + "-" + m.hora] = +m.visitas; max = Math.max(max, +m.visitas); });
  const hs = mapa.map(m => +m.hora), h0 = Math.min(9, ...hs), h1 = Math.max(23, ...hs);
  const horas = Array.from({ length: h1 - h0 + 1 }, (_, i) => h0 + i);
  const cab = `<span></span>` + horas.map(h => `<span style="justify-content:center">${h % 3 === 0 ? h + "h" : ""}</span>`).join("");
  const linhas = [1, 2, 3, 4, 5, 6, 0].map(d => `<span>${RX_DIAS[d]}</span>` + horas.map(h => { const n = v[d + "-" + h] || 0; return n ? `<i title="${RX_DIAS[d]} ${h}h: ${n} visitas" style="opacity:${0.25 + 0.75 * n / max}"></i>` : `<i class="z"></i>`; }).join("")).join("");
  const top = mapa.slice().sort((a, b) => b.visitas - a.visitas).slice(0, 3).map(m => `${RX_DIAS[m.dow]} às ${m.hora}h (${m.visitas})`).join(", ");
  return `<div class="rx-mapa" style="--h:${horas.length}" role="img" aria-label="Visitas por dia da semana e hora">${cab}${linhas}</div><p class="rx-nota">Mais movimento: ${top}.</p>`;
}

/** Horas do dia com mais visitas, juntando todos os dias. */
function rxHoras(horas) {
  if (!horas.length) return "";
  const top = horas.slice().sort((a, b) => b.visitas - a.visitas).slice(0, 3).map(h => `${h.hora}h–${h.hora + 1}h`).join(", ");
  return `<p class="rx-nota">Horas com mais visitas: ${top}.</p>`;
}

/** Cartões dos carrinhos que não chegaram a pedido. */
function rxAbandonados(lista) {
  if (!lista.length) return `<p class="rx-nota">Nenhum carrinho abandonado neste período.</p>`;
  return lista.map(c => { const q = new Date(c.quando), n = q.toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    return `<div class="cartao"><div><strong>${eur(+c.valor)}</strong><span class="etiqueta">${c.chegou_a_finalizar ? "Chegou a finalizar" : "Só carrinho"}</span>
      <small>${esc(n)} · ${esc(RX_ORIGENS[c.origem] || c.origem)} · ${esc(c.modelo || RX_APARELHOS[c.aparelho] || "")}${c.cidade ? " · " + esc(c.cidade) : ""}</small>
      <small>${c.itens.map(i => i.q + " × " + esc(i.nome)).join(", ")}</small></div></div>`; }).join("");
}

/** Ecrã do Raio-X. */
function vRaioX() {
  const d = raioX.dados, f = d.funil, p = d.pedidos, contar = !LS.get("naoContar", false);
  const tempo = d.tempo_medio_seg >= 60 ? Math.round(d.tempo_medio_seg / 60) + " min" : d.tempo_medio_seg + " s";
  const ops = Object.keys(PERIODOS).filter(k => k !== "personalizado").map(k => `<option value="${k}" ${k === raioX.tipo ? "selected" : ""}>${PERIODOS[k]}</option>`).join("");
  const nomeCidade = c => c.cidade + (c.pais && c.pais !== "PT" ? " (" + c.pais + ")" : "");
  return { titulo: "Raio-X do site",
    corpo: VOLTAR + `<div class="grupo"><label class="campo" style="margin-top:0"><span>Período</span><select name="periodoRx">${ops}</select></label><small style="color:var(--tinta-2)">De ${fmtDia(raioX.de)} a ${fmtDia(raioX.ate)}</small></div>
      <div class="grupo"><div class="rx-kpis">
        <div class="rx-kpi"><strong>${f.visitas}</strong><small>visitas</small></div>
        <div class="rx-kpi"><strong>${f.carrinho}</strong><small>juntaram ao carrinho (${rxPct(f.carrinho, f.visitas)} %)</small></div>
        <div class="rx-kpi"><strong>${p.n}</strong><small>pedidos recebidos${p.n ? ", " + eur(+p.total) : ""}</small></div>
        <div class="rx-kpi"><strong>${rxPct(p.n, f.visitas)} %</strong><small>das visitas viraram pedido</small></div>
      </div>
      <p class="rx-nota">Tempo médio de quem viu o menu: ${tempo}. Voltaram ao site: ${d.repetidas} de ${f.visitas} visitas.</p></div>
      <div class="grupo"><h3>Do menu ao pedido</h3>${rxFunil(f)}<p class="rx-nota">"Enviaram o pedido" conta quem carregou em enviar no site. Os pedidos recebidos vêm da lista de pedidos.</p></div>
      <div class="grupo"><h3>Visitas por dia</h3>${rxDias(d.por_dia)}</div>
      <div class="grupo"><h3>Dias e horas com mais visitas</h3>${rxMapa(d.mapa)}${rxHoras(d.por_hora)}</div>
      <div class="grupo"><h3>De onde vêm</h3>${rxBarras(d.origens, x => RX_ORIGENS[x.origem] || x.origem, "visitas")}<p class="rx-nota">Para saber quantos vêm do flyer, o QR code deve abrir sakuraesalsushi.pt/?o=flyer. Para uma publicação, use ?o=instagram-post (ou outro nome).</p></div>
      <div class="grupo"><h3>Onde estão</h3>${rxBarras(d.cidades, nomeCidade, "visitas")}<p class="rx-nota">Cidade aproximada pela rede de internet. Nos dados móveis aparece muitas vezes a cidade da operadora (Viseu, Porto, Lisboa), não a aldeia.</p>
        <h3 style="margin-top:1rem">Localidades dos pedidos</h3>${rxBarras(d.localidades_pedidos, x => x.nome, "pedidos", x => `<small style="font-weight:400;color:var(--tinta-2)">${eur(+x.total)}</small>`)}<p class="rx-nota">Estas são exatas: vêm da morada de entrega.</p></div>
      <div class="grupo"><h3>Aparelhos</h3>${rxBarras(d.aparelhos, x => RX_APARELHOS[x.aparelho] || x.aparelho, "visitas")}
        <h3 style="margin-top:1rem">Modelos</h3>${rxBarras(d.modelos, x => x.nome, "visitas")}<p class="rx-nota">O iPhone não diz o modelo ao site: é estimado pelo tamanho do ecrã. Nos Android aparece o código do modelo quando o navegador o revela.</p>
        <h3 style="margin-top:1rem">Sistema</h3>${rxBarras(d.sistemas, x => x.nome, "visitas")}
        <h3 style="margin-top:1rem">Navegador</h3>${rxBarras(d.navegadores, x => x.nome, "visitas")}
        <h3 style="margin-top:1rem">Idioma do telemóvel</h3>${rxBarras(d.idiomas, x => RX_IDIOMAS[x.nome] || RX_IDIOMAS[String(x.nome).slice(0, 2)] || x.nome, "visitas")}</div>
      <div class="grupo"><h3>Menus mais vistos</h3>${rxBarras(d.categorias, x => x.nome, "visitas")}</div>
      <div class="grupo"><h3>Produtos que foram para o carrinho</h3>${rxBarras(d.produtos.filter(x => +x.carrinhos), x => x.nome, "carrinhos", x => `<small style="font-weight:400;color:var(--tinta-2)">${x.unidades} un.</small>`)}
        <h3 style="margin-top:1rem">Fotos mais abertas</h3>${rxBarras(d.produtos.filter(x => +x.fotos).sort((a, b) => b.fotos - a.fotos), x => x.nome, "fotos")}
        <h3 style="margin-top:1rem">Mais pedidos (pedidos reais)</h3>${rxBarras(d.mais_pedidos, x => x.nome, "quantidade", x => `<small style="font-weight:400;color:var(--tinta-2)">${eur(+x.total)}</small>`)}</div>
      <div class="grupo"><h3>Carrinhos abandonados</h3>${rxAbandonados(d.abandonados)}<p class="rx-nota">Visitas que juntaram produtos e não enviaram o pedido. Sem nome nem contacto: o site não sabe quem são.</p></div>
      <div class="grupo"><h3>Este aparelho</h3><p class="rx-nota" style="margin-top:0">${contar ? "As visitas deste aparelho estão a contar." : "Este aparelho não conta nas estatísticas (entrou na gestão)."}</p>
        <p class="rx-nota">Noutros aparelhos teus (ou da família) sem entrar na gestão: abre neles sakuraesalsushi.pt/?naocontar. Para voltar a contar: ?contar.</p>
        <p style="margin-top:.6rem"><button type="button" class="btn btn-sec" data-a="rx-contar">${contar ? "Não contar este aparelho" : "Voltar a contar este aparelho"}</button></p></div>` };
}

/** Carrega o período escolhido e abre o ecrã. */
async function abrirRaioX() {
  [raioX.de, raioX.ate] = datasPeriodo(raioX.tipo);
  try { raioX.dados = await api(`/admin/insights?start=${raioX.de}&end=${raioX.ate}`, { auth: true }); abrir("adm-raiox"); }
  catch (e) { erroGestao(e); }
}

VISTAS["adm-raiox"] = vRaioX;
Object.assign(ACOES, {
  "adm-raiox"() { abrirRaioX(); },
  "rx-contar"() { LS.set("naoContar", !LS.get("naoContar", false)); renderFolha(); brinde(LS.get("naoContar", false) ? "Este aparelho deixou de contar" : "Este aparelho volta a contar"); }
});

$("#folha").addEventListener("change", ev => {
  if (S.vista !== "adm-raiox" || ev.target.name !== "periodoRx") return;
  raioX.tipo = ev.target.value;
  abrirRaioX();
});

const vMaisSemRaioX = VISTAS["adm-mais"];
VISTAS["adm-mais"] = function () {
  const v = vMaisSemRaioX();
  const item = `<button type="button" class="btn btn-sec btn-bloco" data-a="adm-raiox" style="justify-content:space-between;border-radius:16px"><span>Raio-X do site</span><small style="font-weight:400;color:var(--tinta-2)">Visitas, carrinhos e público</small></button>`;
  v.corpo = v.corpo.replace(/(<div class="pilha[^"]*">)/, "$1" + item);
  return v;
};
