/* ---------- logótipo no círculo da abertura e ícone da conta no telemóvel ---------- */
const LOGO_PARTES = ["img/logo-1.txt", "img/logo-2.txt", "img/logo-3.txt", "img/logo-4.txt"];
let logoSrc = "", logoFalhou = false;

document.head.insertAdjacentHTML("beforeend", `<style>
.travessa.com-logo{display:block;padding:0;overflow:hidden;background:#fff}
.travessa.com-logo img{width:100%;height:100%;display:block;object-fit:cover}
.topo .icone-btn,.topo .icone-btn svg{flex:none}
.topo .marca{min-width:0}
@media (max-width:419px){#btn-carrinho span:not(#conta-itens){display:none}.topo .contido{gap:.6rem}}
</style>`);

/**
 * Junta as partes do logótipo (imagem WebP em base64) numa só imagem.
 * @returns {Promise<string>} Endereço data: da imagem.
 */
async function carregarLogo() {
  const partes = await Promise.all(LOGO_PARTES.map(async u => { const r = await fetch(u); if (!r.ok) throw new Error(u); return (await r.text()).trim(); }));
  return "data:image/webp;base64," + partes.join("");
}

/** Mostra o logótipo no círculo da página inicial (círculo branco enquanto carrega). */
function mostrarLogo() {
  const t = $("#travessa");
  if (logoFalhou) return;
  t.classList.add("com-logo");
  t.removeAttribute("aria-hidden");
  t.innerHTML = logoSrc ? `<img src="${logoSrc}" alt="Logótipo Sakura & Sal Sushi" width="600" height="600">` : "";
}

const montarSemLogo = montarPagina;
/** Monta a página e repõe o logótipo, que a montagem base substitui por desenhos. */
montarPagina = function () { montarSemLogo(); mostrarLogo(); };

mostrarLogo();
carregarLogo().then(src => { logoSrc = src; mostrarLogo(); })
  .catch(() => { logoFalhou = true; $("#travessa").classList.remove("com-logo"); montarPagina(); });
