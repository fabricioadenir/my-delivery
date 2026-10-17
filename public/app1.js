/* =====================================================================
   CONFIGURAÇÃO: é aqui que se muda preços, horário, zonas e contactos.
   ===================================================================== */
const CONFIG = {
  nome: "Sakura & Sal",
  whatsapp: "351913838543",          // número que recebe os pedidos, sem + nem espaços
  telefoneVisivel: "913 838 543",
  logoUrl: "",                        // cole aqui o logótipo (URL ou data:image/...) para substituir o desenho
  pedidoMinimo: 12,                   // em euros, sem contar a entrega
  preparoMin: 45,                     // minutos entre o pedido e a primeira entrega possível
  intervaloMin: 30,                   // intervalo entre horas de entrega
  // 0 = domingo ... 6 = sábado. null = fechado.
  horario: { 0:["18:00","22:00"], 1:null, 2:null, 3:null, 4:["18:00","22:00"], 5:["18:00","22:00"], 6:["18:00","22:00"] },
  zonas: [
    { id:"vnp",   nome:"Vila Nova de Paiva", taxa:1.5 },
    { id:"satao", nome:"Sátão",              taxa:3.0 }
  ],
  pagamentos: ["MB WAY","Dinheiro"]
};

const PADRAO_LOJA = JSON.stringify({ pedidoMinimo:CONFIG.pedidoMinimo, preparoMin:CONFIG.preparoMin, horario:CONFIG.horario, zonas:CONFIG.zonas });
/* Menu de exemplo. Depois de editar em "Gerir a loja", valem os dados guardados. */
function semente(){
  const un = (id, cat, nome, desc, arte) => ({ id:"p-" + id, cat, nome, desc, preco:0.80, min:4, pecas:"", foto:"", arte, ativo:true });
  const co = (n, preco, desc) => ({ id:"c" + n, cat:"combinados", nome:"Combinado " + n + " peças", desc, preco, min:1, pecas:n, foto:"", arte:"", ativo:true });
  return {
    categorias: [
      { id:"combinados", nome:"Combinados", desc:"Seleções prontas, de 12 a 60 peças.", vista:"cartoes" },
      { id:"unidades",   nome:"Unidades",   desc:"Monte o pedido à sua maneira, peça a peça.", vista:"lista" },
      { id:"quentes",    nome:"Quentes",    desc:"Servidos mornos.", vista:"lista" },
      { id:"bebidas",    nome:"Bebidas",    desc:"", vista:"lista" }
    ],
    produtos: [
      co(12, 12, "Para 1 pessoa. 4 hossomaki de salmão, 4 uramaki Califórnia, 2 nigiri e 2 sashimi de salmão."),
      co(16, 15, "Para 1 pessoa com fome. 4 hossomaki de salmão, 4 uramaki de salmão e queijo-creme, 4 hot roll, 2 nigiri e 2 sashimi."),
      co(20, 18, "Para 1 a 2 pessoas. 8 hossomaki, 4 uramaki Califórnia, 4 hot roll, 2 nigiri e 2 sashimi."),
      co(30, 26, "Para 2 pessoas. 8 hossomaki, 8 uramaki, 4 hot roll, 4 nigiri, 4 sashimi e 2 gunkan."),
      co(40, 33, "Para 2 a 3 pessoas. 8 hossomaki, 12 uramaki, 8 hot roll, 4 nigiri, 4 sashimi e 4 gunkan."),
      co(60, 48, "Para 4 pessoas. 12 hossomaki, 16 uramaki, 12 hot roll, 8 nigiri, 8 sashimi e 4 gunkan."),
      un("hs", "unidades", "Hossomaki de salmão", "Rolo fino de alga com arroz e salmão", "maki-salmao"),
      un("hp", "unidades", "Hossomaki de pepino", "Rolo fino de alga com arroz e pepino", "maki-pepino"),
      un("uc", "unidades", "Uramaki Califórnia", "Arroz por fora, com delícias do mar, pepino e sésamo", "ura-california"),
      un("uq", "unidades", "Uramaki de salmão e queijo-creme", "Arroz por fora, salmão e queijo-creme", "ura-salmao"),
      un("ns", "unidades", "Nigiri de salmão", "Bolinho de arroz com fatia de salmão", "nigiri"),
      un("ss", "unidades", "Sashimi de salmão", "Fatia de salmão, sem arroz", "sashimi"),
      un("gs", "unidades", "Gunkan de salmão", "Arroz envolto em alga com salmão picado", "gunkan"),
      un("hr", "quentes",  "Hot roll", "Rolo panado e frito, servido morno com molho", "hot")
    ],
    loja: JSON.parse(PADRAO_LOJA)
  };
}
/* ===================== fim da configuração ===================== */

const DIAS = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const eur = n => n.toFixed(2).replace(".", ",") + " €";
const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const fmtMin = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const doisD = n => String(n).padStart(2, "0");

let ITEM = {}, ZONA = {};

/* ---------- armazenamento no dispositivo ---------- */
const MEM = {};
const LS = {
  get(k, d){ if (k in MEM) return MEM[k]; try { const v = localStorage.getItem("ss_" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v){ MEM[k] = v; try { localStorage.setItem("ss_" + k, JSON.stringify(v)); } catch (e) {} },
  del(k){ delete MEM[k]; try { localStorage.removeItem("ss_" + k); } catch (e) {} }
};
const arr = v => Array.isArray(v) ? v : [];
let D = LS.get("dados", null);
if (!D || !Array.isArray(D.categorias) || !Array.isArray(D.produtos) || !D.loja || !Array.isArray(D.loja.zonas) || !D.loja.zonas.length) D = semente();
function indexar(){
  Object.assign(CONFIG, D.loja);
  ITEM = {};
  D.produtos.forEach(p => { if (p.ativo !== false) ITEM[p.id] = { id:p.id, nome:p.nome, preco:+p.preco || 0, min:Math.max(1, parseInt(p.min, 10) || 1) }; });
  ZONA = Object.fromEntries(CONFIG.zonas.map(z => [z.id, z]));
}
indexar();
const S = {
  cart: arr(LS.get("cart", [])).filter(i => i && ITEM[i.id] && i.q > 0),
  perfil: LS.get("perfil", null),
  moradas: arr(LS.get("moradas", [])),
  pedidos: arr(LS.get("pedidos", [])),
  vista: null, rascunho: null, ultimo: null, editar: null, erros: [], confirmarSair: false
};

/* ---------- desenhos das peças ---------- */
function arte(t){
  const a = '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">', f = "</svg>";
  const ARROZ = "#FBFAF4", ALGA = "#1E2A26", SALMAO = "#F3875F", RISCA = "#FCD3C2";
  const anel = (r, n, cores, raio) => Array.from({length:n}, (_, i) => { const g = i / n * Math.PI * 2; return `<circle cx="${(32 + Math.cos(g) * r).toFixed(1)}" cy="${(32 + Math.sin(g) * r).toFixed(1)}" r="${raio}" fill="${cores[i % cores.length]}"/>`; }).join("");
  const maki = c => `<circle cx="32" cy="32" r="29" fill="${ALGA}"/><circle cx="32" cy="32" r="23.500" fill="${ARROZ}"/><circle cx="32" cy="32" r="10" fill="${c}"/><circle cx="29" cy="29" r="3" fill="#fff" opacity=".35"/>`;
  const ura = (c1, c2) => `<circle cx="32" cy="32" r="29" fill="${ARROZ}" stroke="#E4E1D6" stroke-width="1.500"/>${anel(22, 10, ["#D9B46A", "#3A3A34"], 1.6)}<circle cx="32" cy="32" r="14" fill="${ALGA}"/><circle cx="32" cy="32" r="11" fill="${c1}"/><path d="M32 21a11 11 0 0 1 0 22z" fill="${c2}"/>`;
  switch (t) {
    case "maki-salmao": return a + maki(SALMAO) + f;
    case "maki-pepino": return a + maki("#8CBF6A") + f;
    case "ura-california": return a + ura("#F6B7A0", "#9CCB74") + f;
    case "ura-salmao": return a + ura(SALMAO, "#FFF6E0") + f;
    case "hot": return a + `<circle cx="32" cy="32" r="29" fill="#D9A24C"/>${anel(24, 12, ["#B97F2E", "#EFC681"], 2)}<circle cx="32" cy="32" r="18" fill="${ARROZ}"/><circle cx="32" cy="32" r="8" fill="${SALMAO}"/><path d="M9 27c8 6 15-6 23 0s15-6 23 0" fill="none" stroke="#5A2E1A" stroke-width="2.600" stroke-linecap="round"/>` + f;
    case "nigiri": return a + `<g transform="rotate(-16 32 32)"><rect x="8" y="31" width="48" height="20" rx="10" fill="${ARROZ}" stroke="#E4E1D6" stroke-width="1.500"/><path d="M5 31c2-12 14-17 27-17s25 5 27 17c-8 5-18 7-27 7s-19-2-27-7z" fill="${SALMAO}"/><path d="M18 18l-4 16M28 15l-2 22M38 15l2 22M47 18l4 16" stroke="${RISCA}" stroke-width="2.200" stroke-linecap="round"/></g>` + f;
    case "sashimi": return a + [0, 1, 2].map(i => `<g transform="translate(${i * 8 - 8} ${i * 9 - 9}) rotate(-18 32 32)"><rect x="12" y="23" width="40" height="17" rx="7" fill="${SALMAO}" stroke="#E06E48"/><path d="M22 25v13M32 25v13M42 25v13" stroke="${RISCA}" stroke-width="2" stroke-linecap="round"/></g>`).join("") + f;
    case "gunkan": return a + `<rect x="8" y="24" width="48" height="32" rx="13" fill="${ALGA}"/><ellipse cx="32" cy="25" rx="24" ry="12" fill="#F29A4A"/>` + [[22,22],[30,27],[38,21],[44,27],[27,19],[35,31],[18,28]].map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#F7BE7C"/>`).join("") + f;
  }
  return a + f;
}
const FLOR = `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">${[0,72,144,216,288].map(g => `<path transform="rotate(${g} 32 32)" d="M32 31C23 22 24 9 29.500 5l2.500 3 2.500-3C40 9 41 22 32 31z" fill="#FF6A3D"/>`).join("")}<rect x="27.500" y="27.500" width="9" height="9" rx="1.500" transform="rotate(45 32 32)" fill="#fff"/></svg>`;

/* ---------- tempo (hora de Portugal continental) ---------- */
function agora(){
  const p = new Intl.DateTimeFormat("en-GB", { timeZone:"Europe/Lisbon", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).formatToParts(new Date());
  const g = t => +p.find(x => x.type === t).value;
  const y = g("year"), m = g("month"), d = g("day"), h = g("hour") % 24;
  return { y, m, d, hh:h, mm:g("minute"), min:h * 60 + g("minute"), dow:new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}
function estadoLoja(){
  const n = agora(), h = CONFIG.horario[n.dow];
  if (h && n.min >= toMin(h[0]) && n.min < toMin(h[1])) return { aberto:true, texto:"Aberto agora, até às " + h[1] };
  for (let i = 0; i <= 7; i++) {
    const dow = (n.dow + i) % 7, hh = CONFIG.horario[dow];
    if (!hh || (i === 0 && n.min >= toMin(hh[0]))) continue;
    return { aberto:false, texto:"Fechado. Abre " + (i === 0 ? "hoje" : i === 1 ? "amanhã" : DIAS[dow]) + " às " + hh[0] };
  }
  return { aberto:false, texto:"Fechado" };
}
function podeJa(){
  const n = agora(), h = CONFIG.horario[n.dow];
  return !!(h && n.min >= toMin(h[0]) && n.min + CONFIG.preparoMin <= toMin(h[1]));
}
function diasDisponiveis(){
  const n = agora(), out = [];
  for (let i = 0; i < 8; i++) {
    const dt = new Date(Date.UTC(n.y, n.m - 1, n.d + i)), dow = dt.getUTCDay(), h = CONFIG.horario[dow];
    if (!h) continue;
    const slots = [];
    for (let t = toMin(h[0]) + CONFIG.preparoMin; t <= toMin(h[1]); t += CONFIG.intervaloMin) {
      if (i === 0 && t < n.min + CONFIG.preparoMin) continue;
      slots.push(fmtMin(t));
    }
    if (!slots.length) continue;
    const data = doisD(dt.getUTCDate()) + "/" + doisD(dt.getUTCMonth() + 1);
    out.push({ chave:dt.toISOString().slice(0, 10), rotulo:(i === 0 ? "Hoje" : i === 1 ? "Amanhã" : DIAS[dow][0].toUpperCase() + DIAS[dow].slice(1)) + ", " + data, slots });
  }
  return out;
}

/* ---------- carrinho ---------- */
const qtd = id => (S.cart.find(i => i.id === id) || {}).q || 0;
const subtotal = () => S.cart.reduce((s, i) => s + ITEM[i.id].preco * i.q, 0);
const nItens = () => S.cart.reduce((s, i) => s + i.q, 0);
function setQtd(id, q){
  q = Math.max(0, Math.min(99, q));
  const i = S.cart.findIndex(x => x.id === id);
  if (q === 0) { if (i >= 0) S.cart.splice(i, 1); }
  else if (i >= 0) S.cart[i].q = q;
  else S.cart.push({ id, q });
  LS.set("cart", S.cart);
}
function problemasCarrinho(){
  const p = [], sub = subtotal();
  S.cart.forEach(i => { const it = ITEM[i.id]; if (i.q < it.min) p.push(it.nome + ": o mínimo são " + it.min + " unidades."); });
  if (sub < CONFIG.pedidoMinimo) p.push("Faltam " + eur(CONFIG.pedidoMinimo - sub) + " para o pedido mínimo de " + eur(CONFIG.pedidoMinimo) + ".");
  return p;
}
function passo(id){
  const q = qtd(id), n = esc(ITEM[id].nome);
  const MINP = ITEM[id].min, peca = MINP > 1;
  if (!q) return `<button type="button" class="btn btn-sec" data-a="mais" data-id="${id}" aria-label="Adicionar ${peca ? MINP + " unidades de " : ""}${n}">Adicionar${peca ? " " + MINP : ""}</button>`;
  return `<div class="passo" role="group" aria-label="Quantidade de ${n}"><button type="button" data-a="menos" data-id="${id}" aria-label="${peca && q <= MINP ? "Remover" : "Tirar um"}">−</button><span>${q}</span><button type="button" data-a="mais" data-id="${id}" aria-label="Juntar mais um">+</button></div>`;
}

/* ---------- página ---------- */
function montarPagina(){
  $("#marca").innerHTML = (CONFIG.logoUrl ? `<img src="${esc(CONFIG.logoUrl)}" alt="">` : FLOR) + `<span>${esc(CONFIG.nome)}</span>`;
  $("#travessa").innerHTML = ["nigiri","ura-salmao","maki-salmao","hot","gunkan","ura-california"].map(arte).join("");
  $("#petalas").innerHTML = [[8,60,520,200],[22,-40,430,-160],[41,90,600,260],[63,-70,380,140],[78,30,560,-220],[92,-90,470,300]].map((p, i) =>
    `<svg class="petala" viewBox="0 0 24 24" style="left:${p[0]}%;--dx:${p[1]}px;--dy:${p[2]}px;--rot:${p[3]}deg;animation-delay:${i * 0.5}s"><path d="M12 2C18 8 20 15 12 22 4 15 6 8 12 2z"/></svg>`).join("");
  $("#f-zonas").textContent = CONFIG.zonas.map(z => z.nome).join(", ").replace(/, ([^,]*)$/, " e $1");
  $("#f-min").textContent = eur(CONFIG.pedidoMinimo);
  const cats = D.categorias.map(c => ({ c, ps:D.produtos.filter(p => p.cat === c.id && p.ativo !== false) })).filter(x => x.ps.length);
  $("#nav").innerHTML = cats.map(x => `<a href="#cat-${esc(x.c.id)}">${esc(x.c.nome)}</a>`).join("") + `<a href="#horario">Horário</a>`;
  const precoHtml = p => ITEM[p.id].min > 1 ? `<span class="precos"><span class="un">${eur(ITEM[p.id].preco)} a unidade</span><span class="preco" data-tot="${esc(p.id)}"></span></span>` : `<span class="preco">${eur(ITEM[p.id].preco)}</span>`;
  const cartao = p => `<article class="combo">${p.foto ? `<img class="foto-g" src="${esc(p.foto)}" alt="" loading="lazy">` : +p.pecas ? `<p class="num">${+p.pecas}<small>peças</small></p>` : p.arte ? `<div class="tira">${arte(p.arte)}</div>` : ""}
      <p class="serve">${esc(p.nome)}</p>${p.desc ? `<p class="comp">${esc(p.desc)}</p>` : ""}
      <div class="fundo">${precoHtml(p)}<span data-ctl="${esc(p.id)}"></span></div></article>`;
  const linha = p => { const im = p.foto ? `<img class="foto" src="${esc(p.foto)}" alt="" loading="lazy">` : p.arte ? arte(p.arte) : "";
    return `<li class="${im ? "" : "sem-img"}">${im}<div><p class="nome">${esc(p.nome)}</p>${p.desc ? `<p class="desc">${esc(p.desc)}</p>` : ""}</div>
      <div class="lado">${precoHtml(p)}<span data-ctl="${esc(p.id)}"></span></div></li>`; };
  $("#menu").innerHTML = cats.map(x => `<section class="seccao" id="cat-${esc(x.c.id)}"><div class="contido"><h2>${esc(x.c.nome)}</h2>${x.c.desc ? `<p class="intro">${esc(x.c.desc)}</p>` : ""}
      ${x.c.vista === "cartoes" ? `<div class="combos">${x.ps.map(cartao).join("")}</div>` : `<ul class="pecas">${x.ps.map(linha).join("")}</ul>`}</div></section>`).join("") +
    `<div class="contido"><p class="nota" style="margin:0 0 3rem">Tem alguma alergia? Os nossos pratos contêm ou podem conter peixe, crustáceos, soja, glúten, sésamo, ovo e leite. Diga-nos ao finalizar o pedido.</p></div>`;
  const n = agora();
  $("#tab-horario").innerHTML = [1,2,3,4,5,6,0].map(d => {
    const h = CONFIG.horario[d], nome = DIAS[d][0].toUpperCase() + DIAS[d].slice(1);
    return `<tr class="${d === n.dow ? "hoje" : ""}"><td>${nome}${d === n.dow ? " (hoje)" : ""}</td><td class="${h ? "" : "fechado"}">${h ? h[0] + " às " + h[1] : "Fechado"}</td></tr>`;
  }).join("");
  $("#tab-zonas").innerHTML = CONFIG.zonas.map(z => `<tr><td>${esc(z.nome)}</td><td>${z.taxa ? eur(z.taxa) : "Grátis"}</td></tr>`).join("");
  $("#nota-min").textContent = "Pedido mínimo de " + eur(CONFIG.pedidoMinimo) + ", sem contar a entrega. Pagamento na entrega: " + CONFIG.pagamentos.join(" ou ") + ".";
  const z = $("#lig-zap"); z.href = "https://wa.me/" + CONFIG.whatsapp; z.textContent = CONFIG.telefoneVisivel;
}
function atualizarEstado(){
  const e = estadoLoja(), el = $("#estado"), h = CONFIG.horario[agora().dow];
  el.classList.toggle("aberto", e.aberto);
  $("span", el).textContent = e.texto;
  $("#f-hoje").textContent = h ? h[0] + " às " + h[1] : "Fechado";
}
function atualizarPagina(){
  document.querySelectorAll("[data-ctl]").forEach(el => el.innerHTML = passo(el.dataset.ctl));
  document.querySelectorAll("[data-tot]").forEach(el => { const it = ITEM[el.dataset.tot]; if (!it) return; const q = qtd(it.id) || it.min; el.textContent = q + " un. " + eur(it.preco * q); });
  const n = nItens();
  $("#conta-itens").textContent = n;
  $("#btn-carrinho").setAttribute("aria-label", "Carrinho, " + n + (n === 1 ? " item" : " itens"));
  $("#txt-conta").textContent = S.perfil ? S.perfil.nome.split(" ")[0] : "Entrar";
  $("#barra").hidden = n === 0 || !!S.vista;
  $("#barra-esq").textContent = "Ver carrinho (" + n + ")";
  $("#barra-dir").textContent = eur(subtotal());
}
let tBrinde;
function brinde(t){ const b = $("#brinde"); b.textContent = t; b.hidden = false; clearTimeout(tBrinde); tBrinde = setTimeout(() => b.hidden = true, 1800); }

