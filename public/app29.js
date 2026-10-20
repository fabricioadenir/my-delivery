/* ---------- várias fotos por produto ---------- */
/* Na gestão: juntar várias fotos, ordenar e escolher a principal (a 1.ª).
   No menu: aparece só a principal, com a quantidade de fotos no canto inferior.
   Ao tocar, abre em grande e o cliente passa de uma para a outra. */

const FOTOS_MAX = 12;
let luzFotos = [], luzI = 0, luzNome = "", toqueX = null, toqueY = null, arrastouEm = 0;

const ICONE_FOTOS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="7" y="7" width="14" height="13" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h11"/></svg>`;

document.head.insertAdjacentHTML("beforeend", `<style>
.ver-foto .n-fotos{position:absolute;left:.6rem;bottom:.6rem;display:flex;align-items:center;gap:.3rem;background:#0A0D1ECC;color:#fff;border-radius:999px;padding:.3rem .65rem;font-size:.8rem;font-weight:700;line-height:1}
.ver-foto .n-fotos svg{width:14px;height:14px}
.ver-foto:not(.ver-foto-g) .n-fotos{left:-4px;bottom:-4px;padding:.22rem .4rem;font-size:.72rem;gap:.2rem}
.ver-foto:not(.ver-foto-g) .n-fotos svg{width:12px;height:12px}
#luz .luz-nav{position:absolute;top:50%;right:auto;transform:translateY(-50%);width:48px;height:48px;border-radius:50%;border:0;background:#FFFFFFE6;color:#111;font-size:1.9rem;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0 0 .2rem}
#luz .luz-nav.ant{left:.6rem}
#luz .luz-nav.seg{left:auto;right:.6rem}
#luz .luz-nav[hidden]{display:none}
#luz .luz-pontos{display:flex;gap:.4rem;justify-content:center}
#luz .luz-pontos[hidden]{display:none}
#luz .luz-pontos i{width:8px;height:8px;border-radius:50%;background:#FFFFFF55}
#luz .luz-pontos i.ativo{background:#fff}
.galeria-adm{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.7rem}
.galeria-adm figure{margin:0;border:1px solid var(--linha);border-radius:14px;overflow:hidden;background:var(--papel);display:flex;flex-direction:column}
.galeria-adm figure.principal{border:2px solid var(--sakura)}
.galeria-adm .gf-img{position:relative;background:var(--sal)}
.galeria-adm img{display:block;width:100%;height:130px;object-fit:contain}
.galeria-adm .selo{position:absolute;left:.4rem;top:.4rem;background:var(--sakura);color:var(--sobre-sakura);border-radius:999px;padding:.15rem .55rem;font-size:.75rem;font-weight:700}
.galeria-adm .ordem{position:absolute;right:.4rem;top:.4rem;background:#0A0D1ECC;color:#fff;border-radius:999px;padding:.15rem .5rem;font-size:.75rem;font-weight:700}
.galeria-adm .gf-acoes{display:flex;flex-wrap:wrap;gap:.2rem .6rem;align-items:center;justify-content:space-between;padding:.45rem .55rem}
.galeria-adm .gf-setas{display:flex;gap:.3rem}
.galeria-adm .gf-setas button{width:34px;height:34px;border-radius:50%;border:1px solid var(--linha);background:var(--papel);color:var(--tinta);font-size:1rem;cursor:pointer}
.galeria-adm .gf-setas button:disabled{opacity:.35;cursor:default}
</style>`);

$("#luz").insertAdjacentHTML("beforeend", `<button type="button" class="luz-nav ant" aria-label="Foto anterior" hidden>‹</button>
  <button type="button" class="luz-nav seg" aria-label="Foto seguinte" hidden>›</button><div class="luz-pontos" aria-hidden="true" hidden></div>`);

/**
 * Fotos de um produto, pela ordem; a primeira é a principal.
 * @param {object} p Produto.
 * @returns {string[]} Endereços das fotos.
 */
function fotosDe(p) {
  if (!p) return [];
  if (Array.isArray(p.fotos) && p.fotos.length) return p.fotos.filter(Boolean);
  return p.foto ? [p.foto] : [];
}

/* Os dados do backend passam a trazer a lista de fotos. */
const mapearUmaFoto = mapear;
mapear = function (d) {
  const r = mapearUmaFoto(d), porId = {};
  (d.products || []).forEach(p => { porId[p.id] = p; });
  r.produtos.forEach(p => {
    const o = porId[p.id], lista = o && Array.isArray(o.photos) ? o.photos.filter(Boolean) : [];
    p.fotos = lista.length ? lista : (p.foto ? [p.foto] : []);
    p.foto = p.fotos[0] || "";
  });
  return r;
};

/* ---------- menu: só a principal, com a quantidade no canto ---------- */

/** Liga cada foto do menu ao seu produto e mostra quantas fotos tem. */
function contarFotosMenu() {
  document.querySelectorAll("#menu .ver-foto").forEach(b => {
    const caixa = b.closest("article, li"), ctl = caixa ? $("[data-ctl]", caixa) : null;
    if (!ctl) return;
    const p = D.produtos.find(x => String(x.id) === ctl.dataset.ctl), n = fotosDe(p).length;
    b.dataset.id = ctl.dataset.ctl;
    const velho = $(".n-fotos", b); if (velho) velho.remove();
    if (n > 1) {
      b.insertAdjacentHTML("beforeend", `<span class="n-fotos" aria-hidden="true">${ICONE_FOTOS}${n}${b.classList.contains("ver-foto-g") ? " fotos" : ""}</span>`);
      b.setAttribute("aria-label", "Ver as " + n + " fotos" + (b.dataset.nome ? " de " + b.dataset.nome : ""));
    }
  });
}

const montarSemGaleria = montarPagina;
montarPagina = function () { montarSemGaleria(); contarFotosMenu(); };

/* ---------- foto em grande: passar de uma para a outra ---------- */

/** Mostra a foto atual da galeria aberta. */
function mostrarLuz() {
  const luz = $("#luz"), n = luzFotos.length, img = $("img", luz);
  img.src = luzFotos[luzI];
  img.alt = (luzNome ? "Foto de " + luzNome : "Foto do produto") + (n > 1 ? ", " + (luzI + 1) + " de " + n : "");
  $("p", luz).textContent = (luzNome || "") + (n > 1 ? (luzNome ? " · " : "") + (luzI + 1) + " de " + n : "");
  luz.querySelectorAll(".luz-nav").forEach(b => { b.hidden = n < 2; });
  const pontos = $(".luz-pontos", luz);
  pontos.hidden = n < 2;
  pontos.innerHTML = n > 1 ? luzFotos.map((_, i) => `<i class="${i === luzI ? "ativo" : ""}"></i>`).join("") : "";
  [luzI + 1, luzI - 1].forEach(i => { if (n > 1) new Image().src = luzFotos[(i + n) % n]; });
}

/**
 * Passa para outra foto da galeria aberta.
 * @param {number} d +1 seguinte, -1 anterior.
 */
function passarFoto(d) {
  const n = luzFotos.length; if (n < 2) return;
  luzI = (luzI + d + n) % n;
  mostrarLuz();
}

const abrirUmaFoto = abrirFoto;
abrirFoto = function (src, nome, origem) {
  const p = origem && origem.dataset && origem.dataset.id ? D.produtos.find(x => String(x.id) === origem.dataset.id) : null, lista = fotosDe(p);
  abrirUmaFoto(src, nome, origem);
  luzFotos = lista.length ? lista : [src];
  luzI = Math.max(0, luzFotos.indexOf(src));
  luzNome = nome || "";
  mostrarLuz();
};

/* Corre antes do fecho ao toque (app18): as setas não fecham a foto. */
window.addEventListener("click", ev => {
  const luz = $("#luz"); if (luz.hidden) return;
  const nav = ev.target.closest && ev.target.closest(".luz-nav");
  if (nav || Date.now() - arrastouEm < 400) {
    ev.preventDefault(); ev.stopPropagation();
    if (nav) passarFoto(nav.classList.contains("seg") ? 1 : -1);
  }
}, true);
window.addEventListener("keydown", ev => {
  if ($("#luz").hidden || !["ArrowLeft", "ArrowRight"].includes(ev.key)) return;
  ev.preventDefault(); ev.stopPropagation();
  passarFoto(ev.key === "ArrowRight" ? 1 : -1);
}, true);
$("#luz").addEventListener("touchstart", ev => { const t = ev.touches[0]; toqueX = t.clientX; toqueY = t.clientY; }, { passive: true });
$("#luz").addEventListener("touchend", ev => {
  if (toqueX == null) return;
  const t = ev.changedTouches[0], dx = t.clientX - toqueX, dy = t.clientY - toqueY;
  toqueX = toqueY = null;
  if (luzFotos.length > 1 && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { arrastouEm = Date.now(); passarFoto(dx < 0 ? 1 : -1); }
}, { passive: true });

/* ---------- gestão: várias fotos, ordem e principal ---------- */

/** Garante que o produto em edição tem a lista de fotos e a principal certa. */
function fotosEmEdicao() {
  const p = S.editar;
  if (!Array.isArray(p.fotos)) p.fotos = fotosDe(p);
  p.foto = p.fotos[0] || "";
  return p.fotos;
}

/** Marca o formulário como alterado, para avisar antes de sair sem guardar. */
function fotosAlteradas() { try { sujo = true; aGuardar = false; } catch (e) { /* sem aviso de alterações */ } }

/**
 * HTML da galeria de fotos do produto em edição.
 * @returns {string} Miniaturas com ações.
 */
function galeriaHtml() {
  const fs = fotosEmEdicao(), n = fs.length;
  if (!n) return `<small>Sem fotos. No site aparece o desenho ou o número de peças.</small>`;
  return `<div class="galeria-adm">${fs.map((f, i) => `<figure class="${i ? "" : "principal"}">
      <div class="gf-img"><img src="${esc(f)}" alt="Foto ${i + 1}${i ? "" : ", principal"}">${i ? `<span class="ordem">${i + 1}</span>` : `<span class="selo">Principal</span>`}</div>
      <div class="gf-acoes">${n > 1 ? `<span class="gf-setas"><button type="button" data-a="adm-foto-mover" data-i="${i}" data-d="-1" aria-label="Passar a foto ${i + 1} para a esquerda" ${i ? "" : "disabled"}>←</button><button type="button" data-a="adm-foto-mover" data-i="${i}" data-d="1" aria-label="Passar a foto ${i + 1} para a direita" ${i < n - 1 ? "" : "disabled"}>→</button></span>` : ""}
        ${i ? `<button type="button" class="ligacao" data-a="adm-foto-principal" data-i="${i}">Principal</button>` : ""}
        <button type="button" class="ligacao" data-a="adm-foto-tirar" data-i="${i}">Tirar</button></div></figure>`).join("")}</div>
    <small>${n > 1 ? "No menu aparece só a principal, com o número de fotos no canto. O cliente toca e vê as " + n + "." : "É assim que aparece no site, inteira. O cliente pode tocar para ampliar."}${n < FOTOS_MAX ? "" : " Chegou ao máximo de " + FOTOS_MAX + " fotos."}</small>`;
}

mostrarFoto = function () { const el = $("#foto-prev"); if (el) el.innerHTML = galeriaHtml(); };

const vAdmProdUmaFoto = VISTAS["adm-produto"];
VISTAS["adm-produto"] = function () {
  const v = vAdmProdUmaFoto();
  v.corpo = v.corpo
    .replace(`<h3>Foto</h3><div id="foto-prev" class="pilha"></div>`, `<h3>Fotos</h3><div id="foto-prev" class="pilha">${galeriaHtml()}</div>`)
    .replace(`<span>Escolher foto</span><input type="file" name="fotoFicheiro" accept="image/*">`, `<span>Juntar fotos</span><input type="file" name="fotoFicheiro" accept="image/*" multiple>`)
    .replace(`Tire com o telemóvel ou escolha da galeria. É reduzida automaticamente.`, `Pode escolher várias de uma vez (até ${FOTOS_MAX}). A primeira é a principal; pode mudar depois.`);
  return v;
};

/**
 * Lê uma imagem e devolve-a já reduzida.
 * @param {File} f Ficheiro escolhido.
 * @returns {Promise<string>} Imagem em data URL.
 */
function lerFoto(f) {
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onerror = falha;
    r.onload = () => { const img = new Image(); img.onerror = falha; img.onload = () => ok(reduzirFoto(img)); img.src = r.result; };
    r.readAsDataURL(f);
  });
}

/* O app4 chama carregarFoto com o 1.º ficheiro; aqui lêem-se todos os escolhidos. */
carregarFoto = async function () {
  const inp = campo("fotoFicheiro"); if (!inp || !inp.files.length) return;
  const escolhidas = [...inp.files], fs = fotosEmEdicao(), livres = FOTOS_MAX - fs.length;
  inp.value = "";
  if (livres <= 0) return brinde("Já tem " + FOTOS_MAX + " fotos. Tire uma para juntar outra.");
  let falhas = 0;
  for (const f of escolhidas.slice(0, livres)) {
    try { fs.push(await lerFoto(f)); } catch (e) { falhas++; }
  }
  fotosEmEdicao(); mostrarFoto(); fotosAlteradas();
  if (escolhidas.length > livres) brinde("Só cabem mais " + livres + ". As restantes ficaram de fora.");
  else if (falhas) brinde(falhas === 1 ? "Não foi possível ler uma das imagens" : "Não foi possível ler " + falhas + " imagens");
};

Object.assign(ACOES, {
  "adm-foto-tirar"(b) {
    const fs = fotosEmEdicao(), i = +b.dataset.i;
    if (b.dataset.i == null) fs.length = 0; else fs.splice(i, 1);
    fotosEmEdicao(); mostrarFoto(); fotosAlteradas();
  },
  "adm-foto-principal"(b) {
    const fs = fotosEmEdicao(), i = +b.dataset.i;
    fs.unshift(fs.splice(i, 1)[0]);
    fotosEmEdicao(); mostrarFoto(); fotosAlteradas();
    brinde("Esta passa a ser a foto do menu");
  },
  "adm-foto-mover"(b) {
    const fs = fotosEmEdicao(), i = +b.dataset.i, j = i + +b.dataset.d;
    if (j < 0 || j >= fs.length) return;
    [fs[i], fs[j]] = [fs[j], fs[i]];
    fotosEmEdicao(); mostrarFoto(); fotosAlteradas();
    const seta = $(`[data-a="adm-foto-mover"][data-i="${j}"][data-d="${b.dataset.d}"]`) || $(`[data-a="adm-foto-mover"][data-i="${j}"]:not([disabled])`);
    if (seta) seta.focus();
  },
  "adm-prod-guardar"() {
    const p = S.editar, f = lerProduto();
    if (f.erros.length) return mostrarErros(f.erros);
    adminAcao(async () => {
      const fs = fotosEmEdicao();
      for (let i = 0; i < fs.length; i++) {
        if (fs[i].startsWith("data:")) fs[i] = (await api("/admin/photo", { method: "POST", auth: true, body: { data_url: fs[i] } })).url;
      }
      fotosEmEdicao();
      await api("/admin/products" + (p.id ? "/" + p.id : ""), { method: p.id ? "PUT" : "POST", auth: true, body: Object.assign(f.dados, { photos: fs, photo_url: fs[0] || null }) });
    }, "Produto guardado");
  }
});

contarFotosMenu();
