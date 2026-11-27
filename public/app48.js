/* ---------- Raio-X do checkout: até onde o cliente foi no formulário e onde parou ----------
 * Continua anónimo: não sai nome, telemóvel nem rua — só se estão preenchidos (sim/não), a localidade,
 * a zona, quando queria receber, pagamento, respostas (wasabi/elástico), avisos que viu e por onde saiu.
 * Eventos (app31.js manda-os para /api/events):
 *  - "finalizar": já leva o valor e os itens do carrinho (app31.js);
 *  - "checkout": resumo do formulário, enviado quando muda (no máximo de 2,5 em 2,5 s);
 *  - "checkout_erro": avisos que apareceram ("Diga se quer wasabi", "Essa hora já está ocupada", pedido mínimo…);
 *  - "checkout_saiu": fechou o formulário, voltou ao carrinho, foi aos dados ou saiu do site/app.
 * O servidor avisa a equipa quando alguém abre o formulário e fica 10 min sem pedir (ver migração 20261116).
 * Na gestão, Raio-X → Carrinhos mostra em cada carrinho abandonado onde parou e o que escolheu.
 */
const CK = { inicio: 0, passo: "", passos: [], tentativas: 0, saidas: 0, ultimo: "", tempo: null, erro: "", erroEm: 0 };

/** Em que bloco do formulário fica cada campo. */
const CK_PASSOS = {
  nome: "dados", tel: "dados",
  morada: "morada", rotulo: "morada", rua: "morada", localidade: "morada", zona: "morada", ref: "morada", guardar: "morada",
  quando: "entrega", dia: "entrega", hora: "entrega",
  querWasabi: "acompanhamentos", querGengibre: "acompanhamentos", querElastico: "acompanhamentos",
  pag: "pagamento", troco: "pagamento", obs: "observacoes",
  guardarConta: "guardar_dados", pin: "guardar_dados"
};
const CK_NOMES = {
  dados: "Os seus dados", morada: "Morada", entrega: "Quando receber", acompanhamentos: "Acompanhamentos",
  pagamento: "Pagamento", observacoes: "Observações", guardar_dados: "Guardar dados", fazer_pedido: "Tocou em Fazer pedido",
  carrinho: "Carrinho"
};

/** Marca o bloco onde o cliente está a mexer. */
function ckPasso(p) {
  if (!p) return;
  CK.passo = p;
  if (!CK.passos.includes(p)) CK.passos.push(p);
}

/** Resumo do formulário, sem nome, telemóvel nem rua. */
function ckResumo() {
  const r = S.rascunho;
  if (!r) return null;
  const m = r.morada !== "nova" ? S.moradas.find(x => x.id === r.morada) : null;
  let z = null, dias = [], ja = false, probs = [];
  try { z = zonaEscolhida(); } catch (e) { z = null; }
  try { dias = diasDisponiveis(); } catch (e) { dias = []; }
  try { ja = podeJa(); } catch (e) { ja = false; }
  try { probs = problemasCarrinho().slice(0, 3).map(x => String(x).slice(0, 120)); } catch (e) { probs = []; }
  const d0 = dias[0], dia = dias.find(d => d.chave === r.dia);
  const palitos = typeof levaPalitos === "function" && levaPalitos();
  return {
    passo: CK.passo || null, passos: CK.passos.slice(), tentativas: CK.tentativas, saidas: CK.saidas,
    seg: CK.inicio ? Math.round((Date.now() - CK.inicio) / 1000) : 0,
    nome: (r.nome || "").trim().length >= 2,
    tel: (r.tel || "").replace(/\D/g, "").length >= 9,
    morada: m ? "guardada" : "nova",
    rua: !!((m ? m.rua : r.rua) || "").trim(),
    localidade: ((m ? m.localidade : r.localidade) || "").trim().slice(0, 40) || null,
    zona: z ? z.nome : null, taxa: z ? (+z.taxa || 0) : null,
    quando: r.quando || null,
    dia: r.quando === "agendar" && dia ? dia.rotulo : null,
    hora: r.quando === "agendar" ? (r.hora || null) : null,
    ja, primeira: d0 && d0.slots[0] ? d0.rotulo + " às " + d0.slots[0] : null,
    pag: r.pag || null,
    wasabi: r.querWasabi || null,
    gengibre: r.querGengibre || null,
    elastico: palitos ? (r.querElastico || null) : "nao_pergunta",
    conta: typeof sessaoCliente === "function" && sessaoCliente() && S.perfil ? "com_dados" : r.guardarConta ? "guardar" : "convidado",
    subtotal: Math.round(subtotal() * 100) / 100,
    problemas: probs
  };
}

/** Envia o resumo se mudou (ou sempre, com forcar). */
function ckEnviarResumo(forcar) {
  clearTimeout(CK.tempo); CK.tempo = null;
  if (S.vista !== "finalizar" || !S.rascunho) return;
  try { lerFinalizar(); } catch (e) { /* formulário a meio de desenhar */ }
  const d = ckResumo();
  if (!d) return;
  const chave = JSON.stringify(Object.assign({}, d, { seg: 0 }));
  if (!forcar && chave === CK.ultimo) return;
  CK.ultimo = chave;
  rxEvento("checkout", { value: d.subtotal, detail: d });
}
const ckAgendar = () => { clearTimeout(CK.tempo); CK.tempo = setTimeout(() => ckEnviarResumo(false), 2500); };

/** O cliente saiu do formulário (como = "fechou o formulário", "voltou ao carrinho", "saiu do site"…). */
function ckSaiu(como) {
  ckEnviarResumo(false);
  rxEvento("checkout_saiu", {
    value: Math.round(subtotal() * 100) / 100,
    detail: { como, passo: CK.passo || null, seg: CK.inicio ? Math.round((Date.now() - CK.inicio) / 1000) : 0 }
  });
  rxEnviar(true);
}

/** Abriu o formulário: começa a contar (se voltou a abri-lo há pouco, continua a mesma contagem). */
function ckComecar() {
  if (!CK.inicio || Date.now() - CK.inicio > 30 * 60000) Object.assign(CK, { inicio: Date.now(), passo: "", passos: [], tentativas: 0, saidas: 0 });
  CK.ultimo = "";
  setTimeout(() => ckEnviarResumo(true), 1500);
}

/* abrir / fechar o formulário */
const abrirSemCheckout = abrir;
abrir = function (v) {
  const antes = S.vista;
  if (antes === "finalizar" && v !== "finalizar" && v !== "enviado" && S.rascunho)
    ckSaiu({ carrinho: "voltou ao carrinho", conta: "foi aos dados guardados" }[v] || "foi para " + v);
  abrirSemCheckout(v);
  if (v === "finalizar" && antes !== "finalizar") ckComecar();
  if (v === "enviado") Object.assign(CK, { inicio: 0, passo: "", passos: [], tentativas: 0, saidas: 0 });
};

const fecharSemCheckout = fechar;
fechar = function () {
  if (S.vista === "finalizar" && S.rascunho) ckSaiu("fechou o formulário");
  fecharSemCheckout();
};

/* saiu do site ou da app (mudou de app, bloqueou o telemóvel, fechou o separador) e voltou */
document.addEventListener("visibilitychange", () => {
  if (S.vista !== "finalizar" || !S.rascunho) return;
  if (document.visibilityState === "hidden") { CK.saidas++; ckSaiu("saiu do site"); }
  else ckEnviarResumo(true);
});

/* o que toca no formulário */
const folhaCk = document.getElementById("folha");
folhaCk.addEventListener("focusin", ev => {
  if (S.vista === "finalizar" && ev.target && CK_PASSOS[ev.target.name]) ckPasso(CK_PASSOS[ev.target.name]);
});
folhaCk.addEventListener("change", ev => {
  if (S.vista !== "finalizar") return;
  if (ev.target && CK_PASSOS[ev.target.name]) ckPasso(CK_PASSOS[ev.target.name]);
  ckAgendar();
});
folhaCk.addEventListener("click", ev => {
  const b = ev.target.closest && ev.target.closest("[data-a]");
  if (!b) return;
  const a = b.dataset.a;
  if (S.vista === "finalizar") {
    if (a === "acomp-mais" || a === "acomp-menos") { ckPasso("acompanhamentos"); ckAgendar(); }
    else if (a === "enviar") { CK.tentativas++; ckPasso("fazer_pedido"); ckEnviarResumo(true); }
  } else if (S.vista === "carrinho" && a === "ir-finalizar" && b.getAttribute("aria-disabled") === "true") {
    // botão "Continuar para a entrega" bloqueado (ex.: pedido mínimo): também é um motivo para desistir
    let probs = [];
    try { probs = problemasCarrinho().slice(0, 3).map(x => String(x).slice(0, 160)); } catch (e) { probs = []; }
    if (probs.length) rxEvento("checkout_erro", { value: Math.round(subtotal() * 100) / 100, detail: { msgs: probs, passo: "carrinho" } });
  }
}, true);   // antes do "Fazer pedido", que apaga o rascunho quando o pedido entra

/* avisos que aparecem no formulário (validação, servidor, PIN) */
function ckLerErros() {
  if (S.vista !== "finalizar") return;
  const caixa = document.querySelector("#erros .erros");
  if (!caixa) { CK.erro = ""; return; }
  const lis = [...caixa.querySelectorAll("li")].map(li => li.textContent.trim());
  const msgs = (lis.length ? lis : [caixa.textContent.replace(/^\s*Falta corrigir:\s*/, "").trim()]).filter(Boolean).slice(0, 6).map(m => m.slice(0, 160));
  if (!msgs.length) return;
  const chave = msgs.join("|");
  if (chave === CK.erro && Date.now() - CK.erroEm < 20000) return;
  CK.erro = chave; CK.erroEm = Date.now();
  rxEvento("checkout_erro", { value: Math.round(subtotal() * 100) / 100, detail: { msgs, passo: CK.passo || null } });
}
let ckErrosAgendado = false;
new MutationObserver(() => {
  if (ckErrosAgendado) return;
  ckErrosAgendado = true;
  setTimeout(() => { ckErrosAgendado = false; ckLerErros(); }, 50);
}).observe(folhaCk, { childList: true, subtree: true });

/* ---------- gestão → Raio-X → Carrinhos: onde parou cada um ---------- */
function ckTempo(seg) {
  if (!(seg > 0)) return "";
  return seg >= 60 ? Math.round(seg / 60) + " min" : seg + " s";
}

/** Linhas com o que o cliente escolheu no formulário. */
function ckLinhas(c) {
  const k = c.checkout, out = [];
  if (!k) return c.chegou_a_finalizar ? [`<small class="rx-nota">Sem detalhe do formulário (só a partir de 16/11).</small>`] : [];
  const sim = v => (v ? "✓" : "✗");
  out.push(`Dados: nome ${sim(k.nome)} · telemóvel ${sim(k.tel)}`);
  const local = [k.localidade, k.zona].filter(Boolean).join(", ");
  out.push(`Morada: rua ${sim(k.rua)}${local ? " · " + esc(local) : ""}${k.zona && k.taxa !== null ? " (" + (+k.taxa ? eur(+k.taxa) : "grátis") + ")" : ""}`);
  let q = k.quando === "ja" ? "O mais cedo possível" : k.quando === "agendar" ? "Agendar" + (k.dia ? " " + esc(k.dia) + (k.hora ? " às " + esc(k.hora) : "") : "") : "—";
  if (k.ja === false) q += ` <span class="rx-nota">(o mais cedo possível não estava disponível${k.primeira ? "; 1.ª hora livre: " + esc(k.primeira) : ""})</span>`;
  out.push("Entrega: " + q);
  const ac = [];
  if (k.wasabi) ac.push("wasabi " + (k.wasabi === "sim" ? "sim" : "não")); else ac.push("wasabi por responder");
  if ("gengibre" in k) ac.push(k.gengibre ? "gengibre " + (k.gengibre === "sim" ? "sim" : "não") : "gengibre por responder");
  if (k.elastico && k.elastico !== "nao_pergunta") ac.push("elástico " + (k.elastico === "sim" ? "sim" : "não"));
  else if (k.elastico === null) ac.push("elástico por responder");
  out.push("Pagamento: " + esc(k.pag || "—") + " · " + ac.join(" · "));
  const conta = { com_dados: "com dados guardados", guardar: "quis guardar os dados (PIN)", convidado: "como convidado" }[k.conta];
  if (conta) out.push("Conta: " + conta + (k.tentativas ? ` · tocou em "Fazer pedido" ${k.tentativas} ${k.tentativas === 1 ? "vez" : "vezes"}` : ""));
  return out.map(l => `<small>${l}</small>`);
}

rxAbandonados = function (lista) {
  if (!lista || !lista.length) return `<p class="rx-nota">Nenhum carrinho abandonado neste período.</p>`;
  return lista.map(c => {
    const q = new Date(c.quando), n = q.toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    const etiqueta = c.passo ? "Parou em: " + (CK_NOMES[c.passo] || c.passo) : c.chegou_a_finalizar ? "Chegou a finalizar" : "Só carrinho";
    const tempo = c.chegou_a_finalizar && c.seg_checkout > 0 ? " · " + ckTempo(c.seg_checkout) + " no formulário" : "";
    const erros = (c.erros || []).length ? `<small><strong>Avisos que viu:</strong> ${c.erros.map(esc).join(" · ")}</small>` : "";
    const saida = c.saida ? `<small><strong>Saída:</strong> ${esc(c.saida)}</small>` : "";
    return `<div class="cartao"><div><strong>${eur(+c.valor)}</strong><span class="etiqueta">${esc(etiqueta)}</span>
      <small>${esc(n)} · ${esc(RX_ORIGENS[c.origem] || c.origem)} · ${esc(c.modelo || RX_APARELHOS[c.aparelho] || "")}${c.cidade ? " · " + esc(c.cidade) : ""}${tempo}</small>
      <small>${(c.itens || []).map(i => i.q + " × " + esc(i.nome)).join(", ")}</small>
      ${ckLinhas(c).join("")}${erros}${saida}</div></div>`;
  }).join("");
};
