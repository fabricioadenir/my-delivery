/* ---------- unidades separadas por tipo e barra de atalhos do menu ---------- */
const TIPOS = {
  hossomaki: "Hossomaki", hosomaki: "Hossomaki", uramaki: "Uramaki", nigiri: "Nigiri", sashimi: "Sashimi",
  gunkan: "Gunkan", temaki: "Temaki", joe: "Joe", jo: "Joe", hot: "Hot roll", harumaki: "Harumaki",
  ceviche: "Ceviche", poke: "Poke", carpaccio: "Carpaccio", sunomono: "Sunomono", futomaki: "Futomaki"
};
const OUTROS = "Outros";
let rodaAtalho = 0, atalhoAtivo = null;

document.head.insertAdjacentHTML("beforeend", `<style>
html{scroll-padding-top:calc(128px + env(safe-area-inset-top,0px))}
#atalhos{position:sticky;top:calc(64px + env(safe-area-inset-top,0px));z-index:19;background:var(--sal);border-bottom:1px solid var(--linha)}
#atalhos[hidden]{display:none}
#atalhos .contido{display:flex;gap:.5rem;overflow-x:auto;padding-block:.6rem;scrollbar-width:none;-webkit-overflow-scrolling:touch}
#atalhos .contido::-webkit-scrollbar{display:none}
#atalhos a{flex:none;text-decoration:none;font-weight:700;font-size:.95rem;padding:.45rem .95rem;border-radius:999px;border:1.5px solid var(--linha);background:var(--papel);color:var(--tinta);min-height:40px;display:inline-flex;align-items:center}
#atalhos a.ativo{background:var(--sakura);border-color:var(--sakura);color:var(--sobre-sakura)}
.sub-tipo{font-size:1.25rem;margin:2rem 0 0;display:flex;align-items:baseline;gap:.6rem}
.sub-tipo small{font-family:var(--texto);font-size:.9rem;font-weight:500;color:var(--tinta-2)}
.sub-tipo + .pecas{margin-top:.8rem}
</style>`);
$("#menu").insertAdjacentHTML("beforebegin", `<nav id="atalhos" aria-label="Ir para uma parte do menu" hidden><div class="contido"></div></nav>`);

/**
 * Tipo de uma peca pela primeira palavra do nome (ex.: "Uramaki California" -> Uramaki).
 * @param {string} nome Nome do produto.
 * @returns {string} Nome do tipo, ou "Outros".
 */
function tipoDe(nome) {
  const p = nome.trim().split(/\s+/)[0].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return TIPOS[p] || OUTROS;
}

/**
 * Identificador seguro para ancoras.
 * @param {string} t Texto.
 * @returns {string} Texto em minusculas, sem acentos nem espacos.
 */
function ancora(t) { return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-"); }

/**
 * Divide a lista de uma categoria em grupos por tipo, quando tem pelo menos dois tipos conhecidos.
 * @param {HTMLElement} sec Seccao da categoria.
 * @returns {{nome:string, id:string}[]} Grupos criados (vazio se a categoria ficou como estava).
 */
function agruparSeccao(sec) {
  const ul = $("ul.pecas", sec); if (!ul) return [];
  const grupos = new Map();
  [...ul.children].forEach(li => { const t = tipoDe($(".nome", li).textContent); if (!grupos.has(t)) grupos.set(t, []); grupos.get(t).push(li); });
  if ([...grupos.keys()].filter(t => t !== OUTROS).length < 2) return [];
  if (grupos.has(OUTROS)) { const o = grupos.get(OUTROS); grupos.delete(OUTROS); grupos.set(OUTROS, o); }
  const frag = document.createDocumentFragment(), feitos = [];
  grupos.forEach((lis, t) => {
    const id = sec.id + "-" + ancora(t), h = document.createElement("h3"), lista = document.createElement("ul");
    h.className = "sub-tipo"; h.id = id; h.innerHTML = `${esc(t)}<small>${lis.length} ${lis.length === 1 ? "opção" : "opções"}</small>`;
    lista.className = "pecas"; lis.forEach(li => lista.append(li));
    frag.append(h, lista); feitos.push({ nome: t, id });
  });
  ul.replaceWith(frag);
  return feitos;
}

/** Separa as categorias por tipo e monta a barra de atalhos. */
function montarAtalhos() {
  const ligacoes = [];
  document.querySelectorAll("#menu section.seccao").forEach(sec => {
    const grupos = agruparSeccao(sec);
    if (grupos.length) grupos.forEach(g => ligacoes.push(g));
    else ligacoes.push({ nome: $("h2", sec).textContent, id: sec.id });
  });
  const nav = $("#atalhos");
  nav.hidden = ligacoes.length < 2;
  atalhoAtivo = null;
  $(".contido", nav).innerHTML = ligacoes.map(l => `<a href="#${esc(l.id)}" data-alvo="${esc(l.id)}">${esc(l.nome)}</a>`).join("");
  marcarAtalho();
}

/** Destaca na barra a parte do menu que esta no ecra e mantem-na visivel. */
function marcarAtalho() {
  const nav = $("#atalhos"); if (nav.hidden) return;
  const links = [...nav.querySelectorAll("a")], limite = nav.getBoundingClientRect().bottom + 24;
  let atual = null;
  links.forEach(a => { const alvo = document.getElementById(a.dataset.alvo); if (alvo && alvo.getBoundingClientRect().top <= limite) atual = a; });
  if (atual === atalhoAtivo) return;
  atalhoAtivo = atual;
  links.forEach(a => a.classList.toggle("ativo", a === atual));
  const c = $(".contido", nav);
  if (atual && c.scrollTo) { c.scrollTo({ left: atual.offsetLeft - c.clientWidth / 2 + atual.offsetWidth / 2, behavior: "smooth" }); }
}

const montarSemAtalhos = montarPagina;
/** Monta a pagina com as unidades separadas por tipo. */
montarPagina = function () { montarSemAtalhos(); montarAtalhos(); };

window.addEventListener("scroll", () => { cancelAnimationFrame(rodaAtalho); rodaAtalho = requestAnimationFrame(marcarAtalho); }, { passive: true });
montarAtalhos();
