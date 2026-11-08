/* ---------- logótipo no círculo da abertura e ícone da conta no telemóvel ---------- */
const LOGO_ABERTURA = "img/logo-completo.webp";
let logoFalhou = false;

document.head.insertAdjacentHTML("beforeend", `<style>
.travessa.com-logo{display:block;padding:0;overflow:hidden;background:#fff}
.travessa.com-logo img{width:100%;height:100%;display:block;object-fit:cover}
.topo .icone-btn,.topo .icone-btn svg{flex:none}
.topo .marca{min-width:0}
@media (max-width:419px){#btn-carrinho span:not(#conta-itens){display:none}.topo .contido{gap:.6rem}}
</style>`);

/** Mostra o logótipo no círculo da página inicial; se a imagem falhar, volta aos desenhos das peças. */
function mostrarLogo() {
  const t = $("#travessa");
  if (logoFalhou) return;
  t.classList.add("com-logo");
  t.removeAttribute("aria-hidden");
  t.innerHTML = `<img src="${LOGO_ABERTURA}" alt="Logótipo Sakura & Sal Sushi" width="600" height="600" decoding="async">`;
  t.querySelector("img").addEventListener("error", () => {
    logoFalhou = true;
    t.classList.remove("com-logo");
    montarPagina();
  }, { once: true });
}

const montarSemLogo = montarPagina;
/** Monta a página e repõe o logótipo, que a montagem base substitui por desenhos. */
montarPagina = function () { montarSemLogo(); mostrarLogo(); };

mostrarLogo();
