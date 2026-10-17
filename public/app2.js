/* ---------- folha: vistas ---------- */
let focoAntes = null;
function abrir(v){
  if (!S.vista) focoAntes = document.activeElement;
  S.vista = v; S.erros = []; S.confirmarSair = false;
  renderFolha();
  $("#folha").hidden = false; $("#veu").hidden = false;
  document.documentElement.classList.add("travado");
  $("#folha-corpo").scrollTop = 0;
  $(".fechar").focus();
  atualizarPagina();
}
function fechar(){
  S.vista = null;
  $("#folha").hidden = true; $("#veu").hidden = true;
  document.documentElement.classList.remove("travado");
  atualizarPagina();
  if (focoAntes && focoAntes.focus) focoAntes.focus();
}
function renderFolha(){
  const v = ({ carrinho:vCarrinho, finalizar:vFinalizar, enviado:vEnviado, conta:vConta, morada:vMorada, admin:vAdmin, "adm-produto":vAdmProd, "adm-categoria":vAdmCat, "adm-loja":vAdmLoja })[S.vista]();
  $("#folha-titulo").textContent = v.titulo;
  $("#folha-corpo").innerHTML = v.corpo;
  $("#folha-pe").innerHTML = v.pe || "";
  $("#folha-pe").hidden = !v.pe;
  if (S.vista === "finalizar") sincronizar();
}

function vCarrinho(){
  if (!S.cart.length) return { titulo:"O seu carrinho", corpo:`<div class="vazio"><p>O carrinho está vazio</p><p>Escolha um combinado ou monte o pedido peça a peça.</p><button type="button" class="btn" data-a="fechar">Ver o menu</button></div>` };
  const prob = problemasCarrinho();
  const linhas = S.cart.map(i => { const it = ITEM[i.id]; return `<li><div><p class="nome">${esc(it.nome)}</p><p class="un">${eur(it.preco)} cada</p></div><p class="total">${eur(it.preco * i.q)}</p><div>${passo(i.id)}</div><button type="button" class="ligacao" data-a="remover" data-id="${i.id}" style="justify-self:end">Remover</button></li>`; }).join("");
  return {
    titulo:"O seu carrinho",
    corpo:`<ul class="linhas">${linhas}</ul>
      <dl class="contas"><div><dt>Subtotal</dt><dd>${eur(subtotal())}</dd></div><div><dt>Entrega</dt><dd>Calculada a seguir</dd></div></dl>
      ${prob.map(p => `<p class="aviso">${esc(p)}</p>`).join("")}
      <p style="margin-top:1rem"><button type="button" class="ligacao" data-a="fechar">Juntar mais coisas</button></p>`,
    pe:`<button type="button" class="btn btn-bloco" data-a="ir-finalizar" aria-disabled="${prob.length ? "true" : "false"}">Continuar para a entrega</button>`
  };
}

function novoRascunho(){
  const pad = S.moradas.find(m => m.padrao) || S.moradas[0];
  const dias = diasDisponiveis();
  return { nome:S.perfil ? S.perfil.nome : "", tel:S.perfil ? S.perfil.tel : "", morada:pad ? pad.id : "nova",
    rotulo:"Casa", rua:"", localidade:"", zona:CONFIG.zonas[0].id, ref:"", guardar:true,
    quando:podeJa() ? "ja" : "agendar", dia:dias[0] ? dias[0].chave : "", hora:dias[0] ? dias[0].slots[0] : "",
    pauzinhos:"2", soja:true, wasabi:true, gengibre:true, pag:CONFIG.pagamentos[0], troco:"", obs:"" };
}
function camposMorada(m){
  return `<label class="campo"><span>Nome desta morada</span><input type="text" name="rotulo" value="${esc(m.rotulo || "")}" placeholder="Casa, trabalho…"></label>
    <label class="campo"><span>Rua e número</span><input type="text" name="rua" value="${esc(m.rua || "")}" autocomplete="address-line1"></label>
    <div class="par">
      <label class="campo"><span>Localidade ou aldeia</span><input type="text" name="localidade" value="${esc(m.localidade || "")}" autocomplete="address-level2"></label>
      <label class="campo"><span>Concelho</span><select name="zona">${CONFIG.zonas.map(z => `<option value="${z.id}" ${m.zona === z.id ? "selected" : ""}>${esc(z.nome)}</option>`).join("")}</select></label>
    </div>
    <label class="campo"><span>Indicações para o estafeta</span><input type="text" name="ref" value="${esc(m.ref || "")}" placeholder="Cor da casa, andar, ao lado de…"><small>Opcional</small></label>`;
}
function vFinalizar(){
  const r = S.rascunho, dias = diasDisponiveis(), ja = podeJa();
  if (r.quando === "ja" && !ja) r.quando = "agendar";
  if (!dias.find(d => d.chave === r.dia)) { r.dia = dias[0] ? dias[0].chave : ""; r.hora = dias[0] ? dias[0].slots[0] : ""; }
  if (r.morada !== "nova" && !S.moradas.find(m => m.id === r.morada)) r.morada = "nova";
  const moradas = S.moradas.map(m => `<label class="opcao"><input type="radio" name="morada" value="${m.id}" ${r.morada === m.id ? "checked" : ""}><span><strong>${esc(m.rotulo || "Morada")}</strong><small>${esc(m.rua)}, ${esc(m.localidade)} (${esc(ZONA[m.zona] ? ZONA[m.zona].nome : "")})</small></span></label>`).join("");
  return {
    titulo:"Entrega e pagamento",
    corpo:`<p style="margin-bottom:1rem"><button type="button" class="ligacao" data-a="abrir-carrinho">Voltar ao carrinho</button></p>
    <fieldset class="grupo"><legend>Os seus dados</legend>
      <label class="campo"><span>Nome</span><input type="text" name="nome" value="${esc(r.nome)}" autocomplete="name"></label>
      <label class="campo"><span>Telemóvel</span><input type="tel" name="tel" value="${esc(r.tel)}" autocomplete="tel" inputmode="tel"></label>
    </fieldset>
    <fieldset class="grupo"><legend>Morada de entrega</legend>
      ${moradas}
      ${S.moradas.length ? `<label class="opcao"><input type="radio" name="morada" value="nova" ${r.morada === "nova" ? "checked" : ""}><span><strong>Outra morada</strong></span></label>` : `<input type="hidden" name="morada" value="nova">`}
      <div id="nova-morada">${camposMorada(r)}
        <label class="opcao" style="margin-top:.5rem"><input type="checkbox" name="guardar" ${r.guardar ? "checked" : ""}><span>Guardar esta morada para a próxima vez</span></label>
      </div>
    </fieldset>
    <fieldset class="grupo"><legend>Quando quer receber</legend>
      ${ja ? `<label class="opcao"><input type="radio" name="quando" value="ja" ${r.quando === "ja" ? "checked" : ""}><span><strong>O mais cedo possível</strong><small>Cerca de ${CONFIG.preparoMin} minutos</small></span></label>` : `<p class="aviso" style="margin:0 0 .4rem">${esc(estadoLoja().texto)}. Pode agendar já a sua entrega.</p>`}
      <label class="opcao"><input type="radio" name="quando" value="agendar" ${r.quando === "agendar" ? "checked" : ""}><span><strong>Agendar dia e hora</strong></span></label>
      <div class="par" id="agendar">
        <label class="campo"><span>Dia</span><select name="dia">${dias.map(d => `<option value="${d.chave}" ${d.chave === r.dia ? "selected" : ""}>${esc(d.rotulo)}</option>`).join("")}</select></label>
        <label class="campo"><span>Hora</span><select name="hora"></select></label>
      </div>
    </fieldset>
    <fieldset class="grupo"><legend>Acompanhamentos, sem custo</legend>
      <label class="campo"><span>Pares de pauzinhos</span><select name="pauzinhos">${[0,1,2,3,4,5,6,8,10].map(n => `<option ${String(n) === String(r.pauzinhos) ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <label class="opcao"><input type="checkbox" name="soja" ${r.soja ? "checked" : ""}><span>Molho de soja</span></label>
      <label class="opcao"><input type="checkbox" name="wasabi" ${r.wasabi ? "checked" : ""}><span>Wasabi</span></label>
      <label class="opcao"><input type="checkbox" name="gengibre" ${r.gengibre ? "checked" : ""}><span>Gengibre</span></label>
    </fieldset>
    <fieldset class="grupo"><legend>Pagamento na entrega</legend>
      ${CONFIG.pagamentos.map(p => `<label class="opcao"><input type="radio" name="pag" value="${esc(p)}" ${r.pag === p ? "checked" : ""}><span><strong>${esc(p)}</strong></span></label>`).join("")}
      <label class="campo" id="campo-troco"><span>Precisa de troco para quanto?</span><input type="text" name="troco" value="${esc(r.troco)}" inputmode="decimal" placeholder="Por exemplo, 50 €"><small>Opcional</small></label>
    </fieldset>
    <fieldset class="grupo"><legend>Alergias e observações</legend>
      <label class="campo"><span>Há algo que devamos saber?</span><textarea name="obs" placeholder="Alergias, sem wasabi, tocar à campainha…">${esc(r.obs)}</textarea></label>
    </fieldset>`,
    pe:`<div id="erros"></div><dl class="contas" id="contas" style="margin:0 0 .9rem"></dl>
      <button type="button" class="btn btn-zap btn-bloco" data-a="enviar">Enviar pedido pelo WhatsApp</button>`
  };
}
const campo = n => $(`#folha-corpo [name="${n}"]`);
const radio = n => { const el = $(`#folha-corpo [name="${n}"]:checked`) || $(`#folha-corpo input[type=hidden][name="${n}"]`); return el ? el.value : ""; };
function lerFinalizar(){
  const r = S.rascunho; if (!r || S.vista !== "finalizar") return;
  ["nome","tel","rotulo","rua","localidade","zona","ref","dia","hora","pauzinhos","troco","obs"].forEach(k => { const el = campo(k); if (el && !(k === "hora" && !el.options.length)) r[k] = el.value; });
  ["guardar","soja","wasabi","gengibre"].forEach(k => { const el = campo(k); if (el) r[k] = el.checked; });
  r.morada = radio("morada") || "nova"; r.quando = radio("quando") || "agendar"; r.pag = radio("pag") || CONFIG.pagamentos[0];
}
function zonaEscolhida(){
  const r = S.rascunho;
  if (r.morada === "nova") return ZONA[r.zona];
  const m = S.moradas.find(x => x.id === r.morada); return m ? ZONA[m.zona] : null;
}
function sincronizar(){
  lerFinalizar();
  const r = S.rascunho, dias = diasDisponiveis();
  $("#nova-morada").hidden = r.morada !== "nova";
  $("#agendar").hidden = r.quando !== "agendar";
  $("#campo-troco").hidden = r.pag !== "Dinheiro";
  const dia = dias.find(d => d.chave === r.dia) || dias[0], sel = campo("hora");
  if (dia && sel) {
    if (!dia.slots.includes(r.hora)) r.hora = dia.slots[0];
    sel.innerHTML = dia.slots.map(h => `<option ${h === r.hora ? "selected" : ""}>${h}</option>`).join("");
  }
  const z = zonaEscolhida(), sub = subtotal(), taxa = z ? z.taxa : 0;
  $("#contas").innerHTML = `<div><dt>Subtotal</dt><dd>${eur(sub)}</dd></div><div><dt>Entrega${z ? " em " + esc(z.nome) : ""}</dt><dd>${taxa ? eur(taxa) : "Grátis"}</dd></div><div class="final"><dt>Total</dt><dd>${eur(sub + taxa)}</dd></div>`;
}

function textoPedido(p){
  const L = [];
  L.push("*NOVO PEDIDO | " + CONFIG.nome + "*", "Pedido n.º " + p.num, "");
  L.push("*Cliente*", "Nome: " + p.nome, "Telemóvel: " + p.tel, "");
  L.push("*Itens*");
  p.itens.forEach(i => L.push(i.q + "x " + i.nome + " ...... " + eur(i.preco * i.q)));
  L.push("", "*Entrega*", "Quando: " + p.quando, "Morada: " + p.morada.rua + ", " + p.morada.localidade, "Concelho: " + p.zona);
  if (p.morada.ref) L.push("Indicações: " + p.morada.ref);
  L.push("", "*Acompanhamentos*", p.acomp, "");
  L.push("*Pagamento*", p.pag + (p.troco ? " (troco para " + p.troco + ")" : ""), "");
  if (p.obs) L.push("*Alergias e observações*", p.obs, "");
  L.push("Subtotal: " + eur(p.sub), "Entrega: " + (p.taxa ? eur(p.taxa) : "grátis"), "*Total: " + eur(p.sub + p.taxa) + "*");
  return L.join("\n");
}
function enviar(){
  lerFinalizar();
  const r = S.rascunho, e = problemasCarrinho().slice(), dias = diasDisponiveis();
  if (!S.cart.length) e.push("O carrinho está vazio.");
  const nome = r.nome.trim(), tel = r.tel.trim(), digitos = tel.replace(/\D/g, "");
  if (nome.length < 2) e.push("Escreva o seu nome.");
  if (digitos.length < 9) e.push("Escreva um número de telemóvel com 9 dígitos.");
  let m;
  if (r.morada === "nova") {
    m = { rotulo:r.rotulo.trim() || "Casa", rua:r.rua.trim(), localidade:r.localidade.trim(), zona:r.zona, ref:r.ref.trim() };
    if (!m.rua) e.push("Escreva a rua e o número da morada.");
    if (!m.localidade) e.push("Escreva a localidade ou aldeia.");
  } else m = S.moradas.find(x => x.id === r.morada);
  if (!m) e.push("Escolha uma morada de entrega.");
  if (m && !ZONA[m.zona]) e.push("Essa morada fica fora das zonas de entrega. Escolha ou escreva outra.");
  let quando = "";
  if (r.quando === "ja") { if (podeJa()) quando = "O mais cedo possível"; else e.push("Já não conseguimos entregar agora. Agende um dia e uma hora."); }
  else { const d = dias.find(x => x.chave === r.dia); if (d && d.slots.includes(r.hora)) quando = d.rotulo + " às " + r.hora; else e.push("Escolha o dia e a hora da entrega."); }
  if (e.length) { S.erros = e; $("#erros").innerHTML = `<div class="erros" role="alert" tabindex="-1"><strong>Falta corrigir:</strong><ul>${e.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`; $("#erros .erros").focus(); return; }

  const z = ZONA[m.zona], n = agora();
  const ac = []; if (+r.pauzinhos) ac.push(r.pauzinhos + (r.pauzinhos === "1" ? " par" : " pares") + " de pauzinhos"); if (r.soja) ac.push("molho de soja"); if (r.wasabi) ac.push("wasabi"); if (r.gengibre) ac.push("gengibre");
  const p = { num:doisD(n.d) + doisD(n.m) + "-" + doisD(n.hh) + doisD(n.mm), data:doisD(n.d) + "/" + doisD(n.m) + "/" + n.y,
    nome, tel, itens:S.cart.map(i => ({ id:i.id, q:i.q, nome:ITEM[i.id].nome, preco:ITEM[i.id].preco })),
    quando, morada:{ rua:m.rua, localidade:m.localidade, ref:m.ref || "" }, zona:z.nome,
    acomp:ac.length ? ac.join(", ") : "Nenhum", pag:r.pag, troco:r.pag === "Dinheiro" ? r.troco.trim() : "", obs:r.obs.trim(),
    sub:subtotal(), taxa:z.taxa };
  p.texto = textoPedido(p);
  p.url = "https://wa.me/" + CONFIG.whatsapp + "?text=" + encodeURIComponent(p.texto);

  S.perfil = { nome, tel }; LS.set("perfil", S.perfil);
  if (r.morada === "nova" && r.guardar) {
    S.moradas.push({ id:"m" + Date.now(), rotulo:m.rotulo, rua:m.rua, localidade:m.localidade, zona:m.zona, ref:m.ref, padrao:!S.moradas.length });
    LS.set("moradas", S.moradas);
  }
  S.pedidos.unshift({ num:p.num, data:p.data, itens:p.itens.map(i => ({ id:i.id, q:i.q, nome:i.nome })), total:p.sub + p.taxa, texto:p.texto });
  S.pedidos = S.pedidos.slice(0, 20); LS.set("pedidos", S.pedidos);
  S.cart = []; LS.set("cart", S.cart); S.rascunho = null; S.ultimo = p;
  try { window.open(p.url, "_blank", "noopener"); } catch (err) {}
  abrir("enviado");
}
function vEnviado(){
  const p = S.ultimo;
  return { titulo:"Falta só carregar em enviar",
    corpo:`<p>Abrimos o WhatsApp com o pedido n.º <strong>${esc(p.num)}</strong> já escrito. Carregue em enviar na conversa e aguarde a nossa confirmação.</p>
      <p class="aviso">O pedido só fica feito depois de enviar a mensagem no WhatsApp.</p>
      <pre class="msg" id="msg">${esc(p.texto)}</pre>
      <div class="pilha">
        <a class="btn btn-zap btn-bloco" href="${esc(p.url)}" target="_blank" rel="noopener">Abrir o WhatsApp outra vez</a>
        <button type="button" class="btn btn-sec btn-bloco" data-a="copiar">Copiar o pedido</button>
        <button type="button" class="ligacao" data-a="fechar">Voltar ao menu</button>
      </div>` };
}

function vConta(){
  if (!S.perfil) return { titulo:"Entrar",
    corpo:`<p style="margin-bottom:1rem">Guarde o seu nome, telemóvel e moradas para encomendar mais depressa. Não precisa de palavra-passe: os dados ficam só neste dispositivo.</p>
      <div class="grupo"><label class="campo" style="margin-top:0"><span>Nome</span><input type="text" name="nome" autocomplete="name"></label>
      <label class="campo"><span>Telemóvel</span><input type="tel" name="tel" autocomplete="tel" inputmode="tel"></label></div>
      <div id="erros"></div>`,
    pe:`<button type="button" class="btn btn-bloco" data-a="guardar-perfil">Guardar e entrar</button>` };
  const moradas = S.moradas.length ? S.moradas.map(m => `<div class="cartao"><div><strong>${esc(m.rotulo || "Morada")}</strong>${m.padrao ? `<span class="etiqueta">Principal</span>` : ""}<small>${esc(m.rua)}, ${esc(m.localidade)} (${esc(ZONA[m.zona] ? ZONA[m.zona].nome : "")})</small></div>
      <div class="acoes">${m.padrao ? "" : `<button type="button" class="ligacao" data-a="morada-principal" data-id="${m.id}">Tornar principal</button>`}<button type="button" class="ligacao" data-a="morada-editar" data-id="${m.id}">Editar</button><button type="button" class="ligacao" data-a="morada-apagar" data-id="${m.id}">Apagar</button></div></div>`).join("") : `<p style="color:var(--tinta-2)">Ainda não guardou nenhuma morada.</p>`;
  const pedidos = S.pedidos.length ? S.pedidos.map((p, i) => `<div class="cartao"><div><strong>N.º ${esc(p.num)}</strong><small>${esc(p.data)}, ${eur(p.total)}</small><small>${p.itens.map(x => x.q + "x " + esc(x.nome)).join(", ")}</small></div><div class="acoes"><button type="button" class="ligacao" data-a="repetir" data-i="${i}">Pedir de novo</button></div></div>`).join("") : `<p style="color:var(--tinta-2)">Os pedidos que enviar aparecem aqui.</p>`;
  return { titulo:"A sua conta",
    corpo:`<div class="grupo"><h3>Os seus dados</h3>
        <label class="campo"><span>Nome</span><input type="text" name="nome" value="${esc(S.perfil.nome)}" autocomplete="name"></label>
        <label class="campo"><span>Telemóvel</span><input type="tel" name="tel" value="${esc(S.perfil.tel)}" autocomplete="tel" inputmode="tel"></label>
        <div id="erros" style="margin-top:.8rem"></div>
        <p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="guardar-perfil">Guardar alterações</button></p></div>
      <div class="grupo"><h3>Moradas</h3>${moradas}<p style="margin-top:.8rem"><button type="button" class="btn btn-sec" data-a="morada-nova">Adicionar morada</button></p></div>
      <div class="grupo"><h3>Pedidos anteriores</h3>${pedidos}</div>
      <p><button type="button" class="ligacao" data-a="sair">${S.confirmarSair ? "Confirmar: apagar os meus dados deste dispositivo" : "Sair e apagar os meus dados deste dispositivo"}</button></p>` };
}
function vMorada(){
  const m = S.editar;
  return { titulo:m.id ? "Editar morada" : "Nova morada",
    corpo:`<p style="margin-bottom:1rem"><button type="button" class="ligacao" data-a="abrir-conta">Voltar à conta</button></p><div class="grupo">${camposMorada(m)}</div><div id="erros"></div>`,
    pe:`<button type="button" class="btn btn-bloco" data-a="morada-guardar">Guardar morada</button>` };
}
function mostrarErros(e){ $("#erros").innerHTML = `<div class="erros" role="alert" tabindex="-1">${e.map(esc).join("<br>")}</div>`; $("#erros .erros").focus(); }

