/* ---------- fotos dos produtos: inteiras no menu e ampliadas ao toque ---------- */
const FOTO_LADO = 1400, FOTO_MAX = 1400000;
let focoFoto = null;

document.head.insertAdjacentHTML("beforeend", `<style>
.ver-foto{position:relative;display:block;padding:0;border:0;background:none;cursor:zoom-in;border-radius:14px;flex:none}
.ver-foto:focus-visible{outline:3px solid var(--petala);outline-offset:2px}
.ver-foto .foto{width:76px;height:76px}
.ver-foto-g{margin:-1.4rem -1.4rem 0;width:calc(100% + 2.8rem);border-radius:21px 21px 0 0;overflow:hidden;background:var(--sal)}
.ver-foto-g .foto-g{width:100%;margin:0;aspect-ratio:auto;height:auto;max-height:26rem;object-fit:contain;border-radius:0}
.ver-foto .lupa{position:absolute;right:.6rem;bottom:.6rem;display:flex;align-items:center;gap:.35rem;background:#0A0D1ECC;color:#fff;border-radius:999px;padding:.3rem .7rem;font-size:.8rem;font-weight:700}
.ver-foto .lupa svg{width:15px;height:15px}
.ver-foto:not(.ver-foto-g) .lupa{right:-4px;bottom:-4px;padding:.25rem}
.ver-foto:not(.ver-foto-g) .lupa span{display:none}
#luz{position:fixed;inset:0;z-index:60;background:#05070FF2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.8rem;padding:calc(3.6rem + env(safe-area-inset-top,0px)) .6rem calc(1rem + env(safe-area-inset-bottom,0px));cursor:zoom-out}
#luz[hidden]{display:none}
#luz img{max-width:100%;max-height:100%;min-height:0;flex:0 1 auto;object-fit:contain;border-radius:12px;background:#111}
#luz p{color:#fff;font-weight:700;text-align:center;margin:0}
#luz button{position:absolute;right:.8rem;top:calc(.8rem + env(safe-area-inset-top,0px));width:48px;height:48px;border-radius:50%;border:0;background:#fff;color:#111;font-size:1.7rem;line-height:1;cursor:pointer}
</style>`);
document.body.insertAdjacentHTML("beforeend", `<div id="luz" role="dialog" aria-modal="true" aria-label="Foto ampliada" hidden>
  <button type="button" aria-label="Fechar a foto">×</button><img alt=""><p></p></div>`);

const LUPA = `<span class="lupa" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.500M11 8.500v5M8.500 11h5"/></svg><span>Ampliar</span></span>`;

/**
 * Envolve cada foto do menu num botão que a abre em grande.
 * A foto dos cartões passa a mostrar-se inteira, sem cortes.
 */
function prepararFotos() {
  document.querySelectorAll("#menu img.foto, #menu img.foto-g").forEach(img => {
    if (img.parentElement.classList.contains("ver-foto")) return;
    const caixa = img.closest("article, li"), nome = caixa ? $(".serve, .nome", caixa) : null;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ver-foto" + (img.classList.contains("foto-g") ? " ver-foto-g" : "");
    b.dataset.nome = nome ? nome.textContent : "";
    b.setAttribute("aria-label", "Ampliar a foto" + (b.dataset.nome ? " de " + b.dataset.nome : ""));
    img.replaceWith(b);
    b.append(img);
    b.insertAdjacentHTML("beforeend", LUPA);
  });
}

/**
 * Abre a foto em ecrã inteiro.
 * @param {string} src Endereço da imagem.
 * @param {string} nome Nome do produto, mostrado por baixo.
 * @param {HTMLElement} origem Botão que abriu a foto, para devolver o foco ao fechar.
 */
function abrirFoto(src, nome, origem) {
  const luz = $("#luz");
  focoFoto = origem;
  $("img", luz).src = src;
  $("img", luz).alt = nome ? "Foto de " + nome : "Foto do produto";
  $("p", luz).textContent = nome || "";
  luz.hidden = false;
  document.documentElement.classList.add("travado");
  $("button", luz).focus();
}

/** Fecha a foto ampliada e devolve o foco a quem a abriu. */
function fecharFoto() {
  $("#luz").hidden = true;
  if (!S.vista) document.documentElement.classList.remove("travado");
  if (focoFoto && focoFoto.focus) focoFoto.focus();
}

const montarSemFotos = montarPagina;
/** Monta a página e prepara as fotos para ampliar. */
montarPagina = function () { montarSemFotos(); prepararFotos(); };

document.addEventListener("click", ev => {
  if (!$("#luz").hidden) { ev.preventDefault(); ev.stopPropagation(); return fecharFoto(); }
  const b = ev.target.closest(".ver-foto");
  if (b) abrirFoto($("img", b).src, b.dataset.nome, b);
}, true);
document.addEventListener("keydown", ev => {
  if ($("#luz").hidden) return;
  ev.stopPropagation();
  if (ev.key === "Escape" || ev.key === "Tab") { ev.preventDefault(); if (ev.key === "Escape") fecharFoto(); }
}, true);

/**
 * Reduz uma imagem para o tamanho máximo, baixando a qualidade se ficar pesada.
 * @param {HTMLImageElement} img Imagem já carregada.
 * @returns {string} Imagem em data URL JPEG.
 */
function reduzirFoto(img) {
  const k = Math.min(1, FOTO_LADO / Math.max(img.width, img.height)), c = document.createElement("canvas");
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  let q = 0.84, url = c.toDataURL("image/jpeg", q);
  while (url.length > FOTO_MAX && q > 0.5) { q -= 0.1; url = c.toDataURL("image/jpeg", q); }
  return url;
}

/**
 * Lê a foto escolhida na gestão, mantendo qualidade para se ver ampliada.
 * @param {File} f Ficheiro escolhido.
 */
carregarFoto = function (f) {
  if (!f) return;
  const falha = () => brinde("Não foi possível ler essa imagem"), r = new FileReader();
  r.onerror = falha;
  r.onload = () => {
    const img = new Image();
    img.onerror = falha;
    img.onload = () => { S.editar.foto = reduzirFoto(img); mostrarFoto(); };
    img.src = r.result;
  };
  r.readAsDataURL(f);
};

/** Mostra na gestão a foto inteira, tal como o cliente a vai ver. */
mostrarFoto = function () {
  const el = $("#foto-prev"); if (!el) return;
  el.innerHTML = S.editar.foto ? `<img src="${esc(S.editar.foto)}" alt="Foto atual" style="width:100%;max-height:320px;object-fit:contain;border-radius:12px;display:block;background:var(--sal)">
    <small>É assim que aparece no site, inteira. O cliente pode tocar para ampliar.</small><button type="button" class="ligacao" data-a="adm-foto-tirar">Tirar a foto</button>` : `<small>Sem foto. No site aparece o desenho ou o número de peças.</small>`;
};

prepararFotos();
