// =========================================================================
// painel.js — ecra inicial: KPIs (total do projeto, materiais, especialidades),
// proximos pagamentos e acoes a terminar. Em 2 segundos ve-se o essencial.
// =========================================================================

import { obter, totaisMateriais, totaisMO } from "./estado.js";
import { euros, perc, data as fmtData, diasAte, esc } from "./utils.js";

export function render(contentor) {
  const mat = totaisMateriais();
  const mo = totaisMO();
  const totalProjeto = mat.estCom + mo.contratado;
  const gastoTotal = mat.gastoCom + mo.pago;
  const pctGasto = totalProjeto ? gastoTotal / totalProjeto : 0;

  contentor.innerHTML = `
    <div class="cartao kpi-total" data-ir="custos">
      <span class="resumo__rot">Total do projeto</span>
      <strong class="kpi-total__val">${euros(totalProjeto)}</strong>
      <div class="barra"><div class="barra__cheio" style="width:${Math.round(pctGasto * 100)}%"></div></div>
      <span class="resumo__sub">Gasto ${euros(gastoTotal)} · <strong>${perc(pctGasto)}</strong></span>
    </div>

    <div class="resumo">
      <div class="resumo__cartao" data-ir="custos">
        <span class="resumo__rot">Materiais</span>
        <strong class="resumo__val">${euros(mat.gastoCom)}</strong>
        <span class="resumo__sub">de ${euros(mat.estCom)} estimado</span>
      </div>
      <div class="resumo__cartao" data-ir="pagamentos">
        <span class="resumo__rot">Especialidades</span>
        <strong class="resumo__val">${euros(mo.pago)}</strong>
        <span class="resumo__sub">de ${euros(mo.contratado)} contratado</span>
      </div>
    </div>

    <h2 class="pl-grupo">Próximos pagamentos</h2>
    ${proximosPagamentos()}

    <h2 class="pl-grupo">Ações a terminar</h2>
    ${acoesTerminar()}`;

  contentor.querySelectorAll("[data-ir]").forEach((el) => {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => window.__ir?.(el.dataset.ir));
  });
}

function proximosPagamentos() {
  const lista = [];
  for (const e of obter().especialidades) {
    for (const m of e.marcos) {
      if (!m.dataPaga && m.dataPrevista) {
        lista.push({ nome: e.nome, valor: m.valor, quando: m.dataPrevista, dias: diasAte(m.dataPrevista) });
      }
    }
  }
  lista.sort((a, b) => (a.quando < b.quando ? -1 : 1));
  if (!lista.length) return `<p class="vazio">Sem pagamentos previstos.</p>`;
  return lista.slice(0, 6).map((p) => {
    const urgente = p.dias !== null && p.dias <= 5;
    return `
      <div class="painel-linha ${urgente ? "is-urgente" : ""}" data-ir="pagamentos">
        <div>
          <div class="painel-linha__t">${esc(p.nome)}</div>
          <div class="painel-linha__s">${fmtData(p.quando)}${etiquetaDias(p.dias)}</div>
        </div>
        <strong>${euros(p.valor)}</strong>
      </div>`;
  }).join("");
}

function acoesTerminar() {
  const lista = obter().acoes
    .filter((a) => !a.feito && a.dataFim)
    .map((a) => ({ ...a, dias: diasAte(a.dataFim) }))
    .sort((a, b) => (a.dataFim < b.dataFim ? -1 : 1))
    .filter((a) => a.dias <= 14);            // horizonte de 2 semanas (+ atrasadas)
  if (!lista.length) return `<p class="vazio">Nada a terminar nas próximas 2 semanas.</p>`;
  return lista.slice(0, 8).map((a) => {
    const urgente = a.dias <= 5;
    return `
      <div class="painel-linha ${urgente ? "is-urgente" : ""}" data-ir="cronograma">
        <div>
          <div class="painel-linha__t">${esc(a.descricao) || "(sem descrição)"}</div>
          <div class="painel-linha__s">${fmtData(a.dataFim)}${etiquetaDias(a.dias)}</div>
        </div>
      </div>`;
  }).join("");
}

function etiquetaDias(dias) {
  if (dias === null || dias === undefined) return "";
  if (dias < 0) return ` · <span class="acao-tag acao-tag--vermelho">atrasada ${-dias} d</span>`;
  if (dias === 0) return ` · <span class="acao-tag acao-tag--vermelho">hoje</span>`;
  if (dias <= 5) return ` · <span class="acao-tag acao-tag--vermelho">em ${dias} d</span>`;
  return ` · em ${dias} d`;
}
