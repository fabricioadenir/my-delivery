/* ---------- melhorias da auditoria de usabilidade: nomes coerentes, avisos com ação, alterações por guardar ---------- */
const FORMULARIOS = new Set(["adm-produto", "adm-categoria", "adm-loja", "adm-ingrediente", "adm-preparacao", "adm-ficha", "adm-compra", "adm-fixo", "adm-fornecedor", "adm-stock-item"]);
const TERMOS = [[/fichas técnicas/g, "receitas"], [/Fichas técnicas/g, "Receitas"], [/ficha técnica/g, "receita"], [/Ficha técnica/g, "Receita"], [/Sem ficha,/g, "Sem receita,"],
  [/Voltar aos custos/g, "Voltar à calculadora"], [/Preparações/g, "Preparados"], [/ticket médio de/g, "valor médio por pedido de"], [/(^|\D)1 pedidos/g, (m, a) => a + "1 pedido"], [/baixa de stock/g, "desconto no stock"]];
const TEXTO_EXATO = { "Acertar": "Corrigir stock", "Registar o que comprou": "Novo ingrediente" };
let sujo = false, aGuardar = false;

document.head.insertAdjacentHTML("beforeend", `<meta name="theme-color" content="#1A2140"><style>
.brinde{top:calc(80px + env(safe-area-inset-top,0px));bottom:auto}
.cartao.adm-prod{grid-template-columns:44px minmax(0,1fr);align-items:start}
.cartao.adm-prod .acoes{grid-column:1 / -1;justify-content:flex-end;flex-wrap:wrap}
.menu-mais .btn{flex-direction:column;align-items:flex-start;text-align:left;gap:.15rem;padding-block:.8rem}
.menu-mais .btn small{text-align:left}
.aviso-acao{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.3rem 1rem}
.folha-corpo{overscroll-behavior:contain}
button,a,label,select{touch-action:manipulation}
</style>`);

/**
 * Troca os nomes antigos pelos atuais num texto.
 * @param {string} t Texto original.
 * @returns {string} Texto com os nomes coerentes.
 */
function termosAtuais(t) { return TEXTO_EXATO[t.trim()] ? t.replace(t.trim(), TEXTO_EXATO[t.trim()]) : TERMOS.reduce((s, [de, para]) => s.replace(de, para), t); }

/**
 * Aplica os nomes atuais a todos os textos e grupos de opções de um elemento.
 * @param {HTMLElement} raiz Elemento a corrigir.
 */
function corrigirTermos(raiz) {
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { const t = termosAtuais(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t; }
  raiz.querySelectorAll("optgroup").forEach(g => { g.label = termosAtuais(g.label); });
}

/**
 * Avisos do início, cada um com um botão que leva ao sítio onde se resolve.
 * @param {object} a Avisos vindos do backend.
 * @returns {string} HTML dos avisos.
 */
avisosInicio = function (a) {
  const item = (txt, acao, rot) => `<div class="aviso aviso-acao"><span>${txt}</span><button type="button" class="ligacao" data-a="${acao}">${rot}</button></div>`, t = [];
  if (a.low_stock.length) t.push(item("Stock abaixo do mínimo: " + a.low_stock.map(i => esc(i.name) + " (" + fmtQtd(i.qty) + " " + esc(i.unit) + ")").join(", ") + ".", "adm-stock", "Ver stock"));
  if (a.expiring.length) t.push(item("Validade a terminar: " + a.expiring.map(i => esc(i.name) + ", " + fmtDia(i.date)).join("; ") + ".", "adm-stock", "Ver stock"));
  if (a.without_recipe) t.push(item(`${a.without_recipe} ${a.without_recipe === 1 ? "produto ainda sem receita" : "produtos ainda sem receita"}: sem custo nem desconto no stock.`, "adm-custos", "Calcular preços"));
  if (+a.cost_per_km === 0) t.push(item("O custo por km das entregas está a zero.", "adm-financas", "Definir custo por km"));
  if (!a.fixed_costs) t.push(item("Ainda não registou custos fixos (renda, luz, internet…).", "adm-financas", "Registar custos fixos"));
  return t.join("");
};

const vMaisSemArrumo = VISTAS["adm-mais"];
VISTAS["adm-mais"] = function () { const v = vMaisSemArrumo(); v.corpo = v.corpo.replace(`<div class="pilha">`, `<div class="pilha menu-mais">`); return v; };

const vIngredientesSemDica = VISTAS["adm-ingredientes"];
VISTAS["adm-ingredientes"] = function () {
  const v = vIngredientesSemDica();
  v.corpo = v.corpo.replace(/(data-a="adm-ing-novo">[^<]*<\/button><\/p>)/, `$1<p class="nota" style="margin-top:.4rem">Comprou de novo algo que já está na lista? Use Stock → Registar compra, para não ficar repetido.</p>`);
  return v;
};

const renderSemTermos = renderFolha;
/** Desenha a folha e acerta os nomes. */
renderFolha = function () { renderSemTermos(); corrigirTermos($("#folha")); };

const brindeSemTermos = brinde;
/**
 * Mostra um aviso curto com os nomes atuais.
 * @param {string} t Texto do aviso.
 */
brinde = function (t) { brindeSemTermos(termosAtuais(String(t))); };

/**
 * Pergunta antes de sair de um formulário com alterações por guardar.
 * @returns {boolean} Verdadeiro se pode sair.
 */
function podeSair() {
  if (!sujo || aGuardar) return true;
  if (!confirm("Tem alterações por guardar. Sair sem guardar?")) return false;
  sujo = false;
  return true;
}

const abrirSemAviso = abrir;
abrir = function (v) {
  if (v !== S.vista && !podeSair()) return;
  if (v !== S.vista) { sujo = false; aGuardar = false; }
  return abrirSemAviso(v);
};
const fecharSemAviso = fechar;
fechar = function () { if (!podeSair()) return; sujo = false; aGuardar = false; return fecharSemAviso(); };
const errosSemAviso = mostrarErros;
mostrarErros = function (e) { aGuardar = false; return errosSemAviso(e); };

$("#folha").addEventListener("input", ev => {
  if (FORMULARIOS.has(S.vista) && ev.target.matches("input,select,textarea") && !["margem", "iva"].includes(ev.target.name)) { sujo = true; aGuardar = false; }
}, true);
document.addEventListener("click", ev => {
  const b = ev.target.closest("[data-a]");
  if (b && /guardar|ficha-preco/.test(b.dataset.a)) aGuardar = true;
}, true);
window.addEventListener("beforeunload", ev => { if (sujo && !aGuardar) { ev.preventDefault(); ev.returnValue = ""; } });
