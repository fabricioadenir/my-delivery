/* ---------- ordenar produtos dentro da categoria (setas na gestão do menu) ---------- */
document.head.insertAdjacentHTML("beforeend", `<style>
.adm-prod .acoes{align-items:center;gap:.4rem}
.mover-btn{width:40px;height:40px;border-radius:50%;border:1.5px solid var(--linha);background:var(--papel);color:var(--tinta);font-size:1.1rem;font-weight:700;line-height:1;cursor:pointer}
.mover-btn:hover{border-color:var(--sakura);color:var(--sakura)}
.mover-btn[disabled]{visibility:hidden}
.adm-prod .acoes .ligacao{margin-left:.4rem}
</style>`);

/**
 * Bloco de uma categoria na gestão, com setas para mudar a ordem dos produtos.
 * @param {object} c Categoria.
 * @param {number} i Posição da categoria na lista.
 * @returns {string} HTML do bloco.
 */
blocoCategoria = function (c, i) {
  const ps = D.produtos.filter(p => p.cat === c.id);
  const seta = (p, d, n) => `<button type="button" class="mover-btn" data-a="adm-prod-mover" data-id="${esc(p.id)}" data-d="${d}" aria-label="${d < 0 ? "Subir" : "Descer"} ${esc(p.nome)}"${(d < 0 ? n === 0 : n === ps.length - 1) ? " disabled" : ""}>${d < 0 ? "↑" : "↓"}</button>`;
  const linhas = ps.map((p, n) => `<div class="cartao adm-prod">${p.foto ? `<img class="foto" src="${esc(p.foto)}" alt="">` : `<span class="mini">${p.arte ? arte(p.arte) : ""}</span>`}<div><strong>${esc(p.nome)}</strong>${p.ativo === false ? `<span class="etiqueta">Oculto</span>` : ""}<small>${eur(+p.preco || 0)}${p.min > 1 ? ", mínimo " + p.min + " unidades" : ""}</small></div><div class="acoes">${ps.length > 1 ? seta(p, -1, n) + seta(p, 1, n) : ""}<button type="button" class="ligacao" data-a="adm-prod" data-id="${esc(p.id)}">Editar</button></div></div>`).join("");
  const mover = (i ? `<button type="button" class="ligacao" data-a="adm-cat-mover" data-id="${esc(c.id)}" data-d="-1">Subir</button>` : "") + (i < D.categorias.length - 1 ? `<button type="button" class="ligacao" data-a="adm-cat-mover" data-id="${esc(c.id)}" data-d="1">Descer</button>` : "");
  return `<div class="grupo"><h3>${esc(c.nome)}</h3><p class="adm-acoes"><button type="button" class="ligacao" data-a="adm-cat" data-id="${esc(c.id)}">Editar categoria</button>${mover}</p>
    ${ps.length > 1 ? `<p class="nota" style="margin:0 0 .4rem">Use as setas para escolher a ordem em que aparecem no site.</p>` : ""}
    ${linhas || `<p style="color:var(--tinta-2)">Sem produtos. A categoria só aparece no site quando tiver pelo menos um.</p>`}
    <p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="adm-prod-novo" data-id="${esc(c.id)}">Novo produto</button></p></div>`;
};

/**
 * Troca um produto com o vizinho na lista local, sem mexer nas outras categorias.
 * @param {string} id Produto a mover.
 * @param {number} d -1 para subir, 1 para descer.
 * @returns {string[]|null} Nova ordem dos produtos da categoria, ou null se não mexeu.
 */
function trocarProduto(id, d) {
  const p = D.produtos.find(x => x.id === id); if (!p) return null;
  const pos = D.produtos.map((x, k) => x.cat === p.cat ? k : -1).filter(k => k >= 0);
  const ids = pos.map(k => D.produtos[k].id), i = ids.indexOf(id), j = i + d;
  if (j < 0 || j >= ids.length) return null;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  const porId = Object.fromEntries(D.produtos.map(x => [x.id, x]));
  pos.forEach((k, n) => { D.produtos[k] = porId[ids[n]]; });
  return ids;
}

/**
 * Redesenha a gestão do menu sem saltar para o topo e devolve o foco à seta usada.
 * @param {string} id Produto movido.
 * @param {number} d Direção usada.
 */
function redesenharMenu(id, d) {
  const corpo = $("#folha-corpo"), y = corpo.scrollTop;
  renderFolha();
  corpo.scrollTop = y;
  const alvo = $(`[data-a="adm-prod-mover"][data-id="${id}"][data-d="${d}"]:not([disabled])`, corpo) || $(`[data-a="adm-prod-mover"][data-id="${id}"]:not([disabled])`, corpo);
  if (alvo) alvo.focus();
}

Object.assign(ACOES, {
  async "adm-prod-mover"(b) {
    const id = b.dataset.id, d = +b.dataset.d, ids = trocarProduto(id, d);
    if (!ids) return;
    redesenharMenu(id, d);
    try {
      await api("/admin/products/order", { method: "POST", auth: true, body: { ids } });
      montarPagina(); atualizarPagina(); brinde("Ordem guardada");
    } catch (e) {
      erroGestao(e);
      try { await carregarAdmin(); if (S.vista === "adm-menu") redesenharMenu(id, d); } catch (e2) { /* fica a mensagem de erro */ }
    }
  }
});
