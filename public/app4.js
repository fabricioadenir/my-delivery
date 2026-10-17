/* ---------- ações ---------- */
const ACOES = {
  "abrir-admin"(){ abrir("admin"); },
  "adm-prod-novo"(b){ S.editar = { id:"", cat:b.dataset.id, nome:"", desc:"", preco:"", min:1, pecas:"", foto:"", arte:"", ativo:true }; abrir("adm-produto"); mostrarFoto(); },
  "adm-prod"(b){ S.editar = copia(D.produtos.find(p => p.id === b.dataset.id)); abrir("adm-produto"); mostrarFoto(); },
  "adm-foto-tirar"(){ S.editar.foto = ""; const f = campo("fotoFicheiro"); if (f) f.value = ""; mostrarFoto(); },
  "adm-prod-guardar"(){
    const p = S.editar, e = [], preco = num(campo("preco").value), min = parseInt(campo("min").value, 10) || 1, pecas = parseInt(campo("pecas").value, 10) || "";
    const nome = campo("nome").value.trim();
    if (!nome) e.push("Escreva o nome do produto.");
    if (!isFinite(preco) || preco < 0) e.push("Escreva o preço, por exemplo 0,80.");
    if (min < 1 || min > 99) e.push("A quantidade mínima tem de estar entre 1 e 99.");
    if (e.length) return mostrarErros(e);
    const novo = { id:p.id || "x" + Date.now().toString(36), cat:campo("cat").value, nome, desc:campo("desc").value.trim(), preco, min, pecas, foto:p.foto || "", arte:p.arte || "", ativo:campo("ativo").checked };
    const i = D.produtos.findIndex(x => x.id === novo.id);
    if (i >= 0) D.produtos[i] = novo; else D.produtos.push(novo);
    gravado("Produto guardado");
  },
  "adm-prod-apagar"(b){ if (!doisPassos(b, "Confirmar: apagar este produto")) return; D.produtos = D.produtos.filter(p => p.id !== S.editar.id); gravado("Produto apagado"); },
  "adm-cat-nova"(){ S.editar = { id:"", nome:"", desc:"", vista:"lista" }; abrir("adm-categoria"); },
  "adm-cat"(b){ S.editar = copia(D.categorias.find(c => c.id === b.dataset.id)); abrir("adm-categoria"); },
  "adm-cat-guardar"(){
    const c = S.editar, nome = campo("nome").value.trim();
    if (!nome) return mostrarErros(["Escreva o nome da categoria."]);
    const nova = { id:c.id || "k" + Date.now().toString(36), nome, desc:campo("desc").value.trim(), vista:campo("vista").value };
    const i = D.categorias.findIndex(x => x.id === nova.id);
    if (i >= 0) D.categorias[i] = nova; else D.categorias.push(nova);
    gravado("Categoria guardada");
  },
  "adm-cat-apagar"(b){ if (!doisPassos(b, "Confirmar: apagar esta categoria")) return; D.categorias = D.categorias.filter(c => c.id !== S.editar.id); gravado("Categoria apagada"); },
  "adm-cat-mover"(b){ const i = D.categorias.findIndex(c => c.id === b.dataset.id), j = i + (+b.dataset.d); if (i < 0 || j < 0 || j >= D.categorias.length) return; const t = D.categorias[i]; D.categorias[i] = D.categorias[j]; D.categorias[j] = t; gravarDados(); renderFolha(); },
  "adm-loja"(){ S.editar = copia(D.loja); abrir("adm-loja"); },
  "adm-zona-nova"(){ lerLoja(); S.editar.zonas.push({ id:"z" + Date.now().toString(36), nome:"", taxa:0 }); renderFolha(); },
  "adm-zona-apagar"(b){ lerLoja(); S.editar.zonas.splice(+b.dataset.i, 1); renderFolha(); },
  "adm-loja-guardar"(){
    lerLoja(); const L = S.editar, e = [], horario = {};
    [0,1,2,3,4,5,6].forEach(d => { const h = L.horario[d]; if (!h) { horario[d] = null; return; } if (!h[0] || !h[1] || toMin(h[0]) >= toMin(h[1])) e.push(DIAS[d][0].toUpperCase() + DIAS[d].slice(1) + ": a hora de fecho tem de ser depois da de abertura."); horario[d] = h; });
    const pm = num(L.pedidoMinimo), pr = parseInt(L.preparoMin, 10);
    if (!isFinite(pm) || pm < 0) e.push("Escreva o pedido mínimo em euros.");
    if (!(pr >= 0)) e.push("Escreva o tempo de preparação em minutos.");
    const zonas = L.zonas.map(z => ({ id:z.id, nome:z.nome, taxa:num(z.taxa) }));
    zonas.forEach(z => { if (!z.nome) e.push("Dê um nome a todas as zonas."); if (!isFinite(z.taxa) || z.taxa < 0) e.push("Escreva a taxa de " + (z.nome || "cada zona") + ", ou 0 se for grátis."); });
    if (e.length) return mostrarErros([...new Set(e)]);
    D.loja = { pedidoMinimo:pm, preparoMin:pr, horario, zonas }; gravado("Definições guardadas");
  },
  "adm-exportar"(b){
    const t = JSON.stringify(D), manual = () => { $("#adm-saida").innerHTML = `<textarea readonly style="margin-top:.8rem;min-height:140px">${esc(t)}</textarea>`; const a = $("#adm-saida textarea"); a.focus(); a.select(); b.textContent = "Selecione o texto abaixo e copie"; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => { b.textContent = "Dados copiados"; }, manual); else manual();
  },
  "adm-repor"(b){ if (!doisPassos(b, "Confirmar: apagar as minhas alterações")) return; LS.del("dados"); D = semente(); gravado("Menu de exemplo reposto"); },
  "abrir-carrinho"(){ lerFinalizar(); abrir("carrinho"); },
  "abrir-conta"(){ lerFinalizar(); abrir("conta"); },
  fechar(){ lerFinalizar(); fechar(); },
  mais(b){ const id = b.dataset.id, era = qtd(id); setQtd(id, !era ? ITEM[id].min : era + 1); if (!era) brinde("No carrinho: " + ITEM[id].nome); },
  menos(b){ const id = b.dataset.id, q = qtd(id); setQtd(id, q <= ITEM[id].min ? 0 : q - 1); },
  remover(b){ setQtd(b.dataset.id, 0); },
  "ir-finalizar"(b){ if (b.getAttribute("aria-disabled") === "true") return; if (!S.rascunho) S.rascunho = novoRascunho(); abrir("finalizar"); },
  enviar(){ enviar(); },
  copiar(b){
    const t = S.ultimo.texto, ok = () => { b.textContent = "Pedido copiado"; };
    const manual = () => { const r = document.createRange(); r.selectNodeContents($("#msg")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); try { document.execCommand("copy"); ok(); } catch (e) { b.textContent = "Selecione o texto acima e copie"; } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, manual); else manual();
  },
  "guardar-perfil"(){
    const nome = campo("nome").value.trim(), tel = campo("tel").value.trim(), e = [];
    if (nome.length < 2) e.push("Escreva o seu nome.");
    if (tel.replace(/\D/g, "").length < 9) e.push("Escreva um número de telemóvel com 9 dígitos.");
    if (e.length) return mostrarErros(e);
    S.perfil = { nome, tel }; LS.set("perfil", S.perfil);
    if (S.rascunho) { S.rascunho.nome = nome; S.rascunho.tel = tel; }
    brinde("Dados guardados"); renderFolha();
  },
  "morada-nova"(){ S.editar = { rotulo:"Casa", zona:CONFIG.zonas[0].id }; abrir("morada"); },
  "morada-editar"(b){ S.editar = Object.assign({}, S.moradas.find(m => m.id === b.dataset.id)); abrir("morada"); },
  "morada-apagar"(b){ S.moradas = S.moradas.filter(m => m.id !== b.dataset.id); if (S.moradas.length && !S.moradas.some(m => m.padrao)) S.moradas[0].padrao = true; LS.set("moradas", S.moradas); renderFolha(); },
  "morada-principal"(b){ S.moradas.forEach(m => m.padrao = m.id === b.dataset.id); LS.set("moradas", S.moradas); renderFolha(); },
  "morada-guardar"(){
    const m = { id:S.editar.id || "m" + Date.now(), rotulo:campo("rotulo").value.trim() || "Morada", rua:campo("rua").value.trim(), localidade:campo("localidade").value.trim(), zona:campo("zona").value, ref:campo("ref").value.trim(), padrao:!!S.editar.padrao }, e = [];
    if (!m.rua) e.push("Escreva a rua e o número.");
    if (!m.localidade) e.push("Escreva a localidade ou aldeia.");
    if (e.length) return mostrarErros(e);
    const i = S.moradas.findIndex(x => x.id === m.id);
    if (i >= 0) S.moradas[i] = m; else { if (!S.moradas.length) m.padrao = true; S.moradas.push(m); }
    LS.set("moradas", S.moradas); brinde("Morada guardada"); abrir("conta");
  },
  repetir(b){
    const p = S.pedidos[+b.dataset.i]; if (!p) return;
    p.itens.forEach(x => { if (ITEM[x.id]) setQtd(x.id, qtd(x.id) + x.q); });
    abrir("carrinho");
  },
  sair(){
    if (!S.confirmarSair) { S.confirmarSair = true; renderFolha(); return; }
    S.perfil = null; S.moradas = []; S.pedidos = []; S.rascunho = null;
    ["perfil","moradas","pedidos"].forEach(LS.del); brinde("Dados apagados"); fechar();
  }
};
document.addEventListener("click", ev => {
  const b = ev.target.closest("[data-a]"); if (!b) return;
  const a = b.dataset.a, id = b.dataset.id, naFolha = !!b.closest("#folha");
  if (!ACOES[a]) return;
  ACOES[a](b);
  if (a === "mais" || a === "menos" || a === "remover") {
    atualizarPagina();
    if (naFolha && S.vista === "carrinho") renderFolha();
    const raiz = naFolha ? $("#folha") : document.querySelector("main");
    const alvo = $(`[data-a="${a}"][data-id="${id}"]`, raiz) || $(`[data-a="mais"][data-id="${id}"]`, raiz) || (naFolha ? $(".fechar") : null);
    if (alvo) alvo.focus();
  } else atualizarPagina();
});
$("#folha").addEventListener("change", () => { if (S.vista === "finalizar") sincronizar(); });
$("#folha").addEventListener("change", ev => { if (ev.target.name === "fotoFicheiro") carregarFoto(ev.target.files[0]); });
$("#folha").addEventListener("input", () => { if (S.vista === "finalizar") lerFinalizar(); });
document.addEventListener("keydown", ev => {
  if (!S.vista) return;
  if (ev.key === "Escape") { lerFinalizar(); fechar(); return; }
  if (ev.key !== "Tab") return;
  const f = [...$("#folha").querySelectorAll("button,a[href],input:not([type=hidden]),select,textarea")].filter(el => el.offsetParent !== null);
  if (!f.length) return;
  if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
  else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
});

montarPagina(); atualizarEstado(); atualizarPagina();
setInterval(atualizarEstado, 60000);
if (location.hash === "#admin") abrir("admin");
