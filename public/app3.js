/* ---------- gerir a loja ---------- */
const num = v => parseFloat(String(v).replace(",", ".").replace(/[^\d.]/g, ""));
const copia = o => JSON.parse(JSON.stringify(o));
function gravarDados(){
  MEM.dados = D; let ok = true;
  try { localStorage.setItem("ss_dados", JSON.stringify(D)); } catch (e) { ok = false; }
  indexar(); S.cart = S.cart.filter(i => ITEM[i.id]); LS.set("cart", S.cart); S.rascunho = null;
  montarPagina(); atualizarEstado();
  return ok;
}
function gravado(msg){ brinde(gravarDados() ? msg : "Atenção: sem espaço neste dispositivo, a alteração pode perder-se"); abrir("admin"); }
function vAdmin(){
  const cats = D.categorias.map((c, i) => {
    const ps = D.produtos.filter(p => p.cat === c.id);
    return `<div class="grupo"><h3>${esc(c.nome)}</h3>
      <p class="adm-acoes"><button type="button" class="ligacao" data-a="adm-cat" data-id="${esc(c.id)}">Editar categoria</button>${i ? `<button type="button" class="ligacao" data-a="adm-cat-mover" data-id="${esc(c.id)}" data-d="-1">Subir</button>` : ""}${i < D.categorias.length - 1 ? `<button type="button" class="ligacao" data-a="adm-cat-mover" data-id="${esc(c.id)}" data-d="1">Descer</button>` : ""}</p>
      ${ps.map(p => { const min = parseInt(p.min, 10) || 1; return `<div class="cartao adm-prod">${p.foto ? `<img class="foto" src="${esc(p.foto)}" alt="">` : `<span class="mini">${p.arte ? arte(p.arte) : ""}</span>`}<div><strong>${esc(p.nome)}</strong>${p.ativo === false ? `<span class="etiqueta">Oculto</span>` : ""}<small>${eur(+p.preco || 0)}${min > 1 ? ", mínimo " + min + " unidades" : ""}</small></div><div class="acoes"><button type="button" class="ligacao" data-a="adm-prod" data-id="${esc(p.id)}">Editar</button></div></div>`; }).join("") || `<p style="color:var(--tinta-2)">Sem produtos. A categoria só aparece no site quando tiver pelo menos um.</p>`}
      <p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="adm-prod-novo" data-id="${esc(c.id)}">Novo produto</button></p></div>`;
  }).join("");
  return { titulo:"Gerir a loja",
    corpo:`<p class="aviso" style="margin:0 0 1rem">Nesta versão, o que alterar aqui fica guardado só neste dispositivo. Os clientes só veem as alterações quando o site estiver ligado a uma base de dados.</p>
      <div class="pilha" style="margin-bottom:1rem"><button type="button" class="btn btn-bloco" data-a="adm-loja">Horário, zonas e pedido mínimo</button><button type="button" class="btn btn-sec btn-bloco" data-a="adm-cat-nova">Nova categoria</button></div>
      ${cats}
      <div class="grupo"><h3>Cópia dos dados</h3><p style="color:var(--tinta-2)">Copie tudo o que configurou (menu, preços, fotos, horário) para guardar ou passar para outro sítio.</p>
        <p class="adm-acoes" style="margin-top:.6rem"><button type="button" class="ligacao" data-a="adm-exportar">Copiar dados da loja</button><button type="button" class="ligacao" data-a="adm-repor">Repor o menu de exemplo</button></p><div id="adm-saida"></div></div>` };
}
function mostrarFoto(){
  const el = $("#foto-prev"); if (!el) return;
  el.innerHTML = S.editar.foto ? `<img src="${esc(S.editar.foto)}" alt="Foto atual" style="width:100%;max-height:220px;object-fit:cover;border-radius:12px;display:block"><button type="button" class="ligacao" data-a="adm-foto-tirar">Tirar a foto</button>` : `<small>Sem foto. No site aparece o desenho ou o número de peças.</small>`;
}
function carregarFoto(f){
  if (!f) return;
  const r = new FileReader();
  r.onerror = () => brinde("Não foi possível ler essa imagem");
  r.onload = () => {
    const img = new Image();
    img.onerror = () => brinde("Não foi possível ler essa imagem");
    img.onload = () => {
      const k = Math.min(1, 640 / Math.max(img.width, img.height)), c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      S.editar.foto = c.toDataURL("image/jpeg", 0.78); mostrarFoto();
    };
    img.src = r.result;
  };
  r.readAsDataURL(f);
}
function vAdmProd(){
  const p = S.editar;
  return { titulo:p.id ? "Editar produto" : "Novo produto",
    corpo:`<p style="margin-bottom:1rem"><button type="button" class="ligacao" data-a="abrir-admin">Voltar à loja</button></p>
      <div class="grupo">
        <label class="campo" style="margin-top:0"><span>Categoria</span><select name="cat">${D.categorias.map(c => `<option value="${esc(c.id)}" ${c.id === p.cat ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}</select></label>
        <label class="campo"><span>Nome</span><input type="text" name="nome" value="${esc(p.nome)}"></label>
        <label class="campo"><span>Descrição</span><textarea name="desc">${esc(p.desc)}</textarea></label>
        <div class="par">
          <label class="campo"><span>Preço (€)</span><input type="text" name="preco" inputmode="decimal" value="${esc(p.preco === "" ? "" : String(p.preco).replace(".", ","))}"><small>Por unidade</small></label>
          <label class="campo"><span>Quantidade mínima</span><input type="text" name="min" inputmode="numeric" value="${esc(p.min)}"><small>1 = sem mínimo</small></label>
        </div>
        <label class="campo"><span>Número de peças na caixa</span><input type="text" name="pecas" inputmode="numeric" value="${esc(p.pecas || "")}"><small>Opcional. Aparece em grande nos combinados sem foto.</small></label>
      </div>
      <div class="grupo"><h3>Foto</h3><div id="foto-prev" class="pilha"></div>
        <label class="campo"><span>Escolher foto</span><input type="file" name="fotoFicheiro" accept="image/*"><small>Tire com o telemóvel ou escolha da galeria. É reduzida automaticamente.</small></label></div>
      <div class="grupo"><label class="opcao"><input type="checkbox" name="ativo" ${p.ativo === false ? "" : "checked"}><span><strong>Visível no site</strong><small>Desligue quando o produto estiver esgotado.</small></span></label></div>
      <div id="erros"></div>
      ${p.id ? `<p><button type="button" class="ligacao" data-a="adm-prod-apagar">Apagar este produto</button></p>` : ""}`,
    pe:`<button type="button" class="btn btn-bloco" data-a="adm-prod-guardar">Guardar produto</button>` };
}
function vAdmCat(){
  const c = S.editar, n = c.id ? D.produtos.filter(p => p.cat === c.id).length : 0;
  return { titulo:c.id ? "Editar categoria" : "Nova categoria",
    corpo:`<p style="margin-bottom:1rem"><button type="button" class="ligacao" data-a="abrir-admin">Voltar à loja</button></p>
      <div class="grupo">
        <label class="campo" style="margin-top:0"><span>Nome</span><input type="text" name="nome" value="${esc(c.nome)}" placeholder="Bebidas, sobremesas…"></label>
        <label class="campo"><span>Descrição</span><input type="text" name="desc" value="${esc(c.desc)}"><small>Opcional</small></label>
        <label class="campo"><span>Como aparece no site</span><select name="vista"><option value="lista" ${c.vista !== "cartoes" ? "selected" : ""}>Lista, uma linha por produto</option><option value="cartoes" ${c.vista === "cartoes" ? "selected" : ""}>Cartões grandes, com foto em destaque</option></select></label>
      </div><div id="erros"></div>
      ${c.id ? (n ? `<p style="color:var(--tinta-2)">Para apagar esta categoria, mova ou apague primeiro os ${n} produtos que tem.</p>` : `<p><button type="button" class="ligacao" data-a="adm-cat-apagar">Apagar esta categoria</button></p>`) : ""}`,
    pe:`<button type="button" class="btn btn-bloco" data-a="adm-cat-guardar">Guardar categoria</button>` };
}
function vAdmLoja(){
  const L = S.editar;
  const dias = [1,2,3,4,5,6,0].map(d => { const h = L.horario[d];
    return `<div class="dia"><label class="opcao"><input type="checkbox" name="ab${d}" ${h ? "checked" : ""}><span><strong>${DIAS[d][0].toUpperCase() + DIAS[d].slice(1)}</strong></span></label>
      <div class="par"><label class="campo"><span>Abre</span><input type="time" name="de${d}" value="${esc(h ? h[0] : "18:00")}"></label><label class="campo"><span>Fecha</span><input type="time" name="ate${d}" value="${esc(h ? h[1] : "22:00")}"></label></div></div>`; }).join("");
  const zonas = L.zonas.map((z, i) => `<div class="par" style="align-items:end"><label class="campo"><span>Zona</span><input type="text" name="zn${i}" value="${esc(z.nome)}"></label><label class="campo"><span>Taxa (€)</span><input type="text" name="zt${i}" inputmode="decimal" value="${esc(String(z.taxa).replace(".", ","))}"></label></div>${L.zonas.length > 1 ? `<p><button type="button" class="ligacao" data-a="adm-zona-apagar" data-i="${i}">Apagar ${esc(z.nome || "zona")}</button></p>` : ""}`).join("");
  return { titulo:"Horário e definições",
    corpo:`<p style="margin-bottom:1rem"><button type="button" class="ligacao" data-a="abrir-admin">Voltar à loja</button></p>
      <div class="grupo"><h3>Horário de funcionamento</h3><p style="color:var(--tinta-2)">Desmarque os dias em que está fechado.</p>${dias}</div>
      <div class="grupo"><h3>Pedidos</h3><div class="par">
        <label class="campo"><span>Pedido mínimo (€)</span><input type="text" name="pedidoMinimo" inputmode="decimal" value="${esc(String(L.pedidoMinimo).replace(".", ","))}"></label>
        <label class="campo"><span>Preparação (min)</span><input type="text" name="preparoMin" inputmode="numeric" value="${esc(L.preparoMin)}"></label></div></div>
      <div class="grupo"><h3>Zonas e taxa de entrega</h3>${zonas}<p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="adm-zona-nova">Adicionar zona</button></p></div>
      <div id="erros"></div>`,
    pe:`<button type="button" class="btn btn-bloco" data-a="adm-loja-guardar">Guardar definições</button>` };
}
function lerLoja(){
  const L = S.editar;
  [0,1,2,3,4,5,6].forEach(d => { L.horario[d] = campo("ab" + d).checked ? [campo("de" + d).value, campo("ate" + d).value] : null; });
  L.pedidoMinimo = campo("pedidoMinimo").value; L.preparoMin = campo("preparoMin").value;
  L.zonas.forEach((z, i) => { z.nome = campo("zn" + i).value.trim(); z.taxa = campo("zt" + i).value; });
}
const doisPassos = (b, txt) => { if (b.dataset.ok === "1") return true; b.dataset.ok = "1"; b.textContent = txt; return false; };

