/* ---------- indicador de carregamento e bloqueio de cliques repetidos ---------- */
let pedidosEmCurso = 0;

document.head.insertAdjacentHTML("beforeend", `<style>
#ocupado{position:fixed;left:50%;top:calc(.8rem + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:50;display:flex;align-items:center;gap:.6rem;background:var(--tinta);color:var(--sal);padding:.6rem 1.1rem;border-radius:999px;font-weight:700;box-shadow:0 8px 24px #00000040}
#ocupado i{width:1.1rem;height:1.1rem;border-radius:50%;border:3px solid #ffffff55;border-top-color:var(--petala);animation:rodar .7s linear infinite}
@keyframes rodar{to{transform:rotate(360deg)}}
.ocupado .folha-corpo,.ocupado .folha-pe{opacity:.45;pointer-events:none}
.ocupado,.ocupado button{cursor:progress}
@media (prefers-reduced-motion: reduce){#ocupado i{animation-duration:2s}}
</style>`);
document.body.insertAdjacentHTML("beforeend", `<div id="ocupado" role="status" aria-live="polite" hidden><i></i><span></span></div>`);

/**
 * Liga ou desliga o indicador conforme haja pedidos ao servidor em curso.
 * @param {number} delta +1 quando um pedido começa, -1 quando termina.
 * @param {string} texto Mensagem a mostrar enquanto decorre.
 */
function marcarOcupado(delta, texto) {
  pedidosEmCurso = Math.max(0, pedidosEmCurso + delta);
  if (texto) $("#ocupado span").textContent = texto;
  $("#ocupado").hidden = pedidosEmCurso === 0;
  document.documentElement.classList.toggle("ocupado", pedidosEmCurso > 0);
}

const apiSemIndicador = api;
/**
 * Chama o backend mostrando o indicador de carregamento até haver resposta.
 * @param {string} caminho Caminho depois de /api.
 * @param {{method?:string, body?:object, auth?:boolean}} opcoes Opções do pedido.
 * @returns {Promise<any>} Resposta do servidor.
 */
api = async function (caminho, opcoes = {}) {
  marcarOcupado(1, !opcoes.method || opcoes.method === "GET" ? "A carregar…" : "A guardar…");
  try { return await apiSemIndicador(caminho, opcoes); }
  finally { marcarOcupado(-1); }
};

// Enquanto houver um pedido em curso, ignora novos toques em botões de ação.
document.addEventListener("click", ev => {
  if (pedidosEmCurso > 0 && ev.target.closest("[data-a]")) { ev.preventDefault(); ev.stopPropagation(); }
}, true);
