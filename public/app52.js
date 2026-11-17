/* ---------- calculadora: mostrar também os produtos ocultos no site ---------- */
/*
 * A calculadora lista D.produtos. Os produtos ocultos só vêm em /admin/data; se o menu público (/menu)
 * chegar depois, substitui D e os ocultos desaparecem da calculadora. Ao abrir a calculadora carrega-se
 * também o menu completo da gestão, como já acontece em Gestão → Menu.
 */
Object.assign(ACOES, {
  async "adm-custos"() {
    try { await Promise.all([carregarCustos(), carregarAdmin()]); abrir("adm-custos"); } catch (e) { erroGestao(e); }
  }
});

const vCalculadoraSemOcultos = VISTAS["adm-custos"];
/** Calculadora com a etiqueta "Oculto no site" nos produtos desligados. */
function vCalculadoraComOcultos() {
  const v = vCalculadoraSemOcultos();
  D.produtos.filter(p => p.ativo === false).forEach(p => {
    v.corpo = noCartao(v.corpo, p.id, c => c.replace("</strong>", `</strong><span class="etiqueta">Oculto no site</span>`));
  });
  return v;
}

Object.assign(VISTAS, { "adm-custos": vCalculadoraComOcultos });
