// =========================================================================
// venda.js — ecra Venda: investimento (Joao/Joana), preços de venda,
// impostos e divisao do lucro. Campos editaveis a laranja; o resto e' calculado.
// =========================================================================

import { obter, alterar, calcularNegocio } from "./estado.js";
import { euros, perc } from "./utils.js";

let contentorRef = null;

export function render(contentor) {
  contentorRef = contentor;
  desenhar();
}

function desenhar() {
  const n = obter().negocio;
  const c = calcularNegocio();

  contentorRef.innerHTML = `
    <div class="cartao venda-edit">
      <h2 class="venda-h">Valores base <span class="venda-dica">(editáveis)</span></h2>
      ${campoNum("Investimento total", "investimentoTotal", n.investimentoTotal, "€")}
      ${campoNum("Preço de venda — Apartamento E", "precoVendaE", n.precoVendaE, "€")}
      ${campoNum("Preço de venda — Apartamento D", "precoVendaD", n.precoVendaD, "€")}
      ${campoNum("Impostos sobre a venda", "taxaImpostos", n.taxaImpostos * 100, "%")}
    </div>

    <div class="cartao">
      <h2 class="venda-h">Investimento</h2>
      ${linha("João", euros(c.joao), perc(c.pInvJoao))}
      ${linha("Joana", euros(c.joana), perc(c.pInvJoana))}
      <p class="venda-nota">Joana entra com 1/3 do total (máx. 20.000 €); o resto é do João.</p>
    </div>

    <div class="cartao">
      <h2 class="venda-h">Venda (pós-impostos)</h2>
      ${linha("Apartamento E", euros(c.posE), "")}
      ${linha("Apartamento D", euros(c.posD), "")}
      ${linha("Total de vendas", euros(c.vendas), "", true)}
    </div>

    <div class="cartao">
      <h2 class="venda-h">Lucro</h2>
      ${linha("Lucro total", euros(c.lucroTotal), "", true, tom(c.lucroTotal))}
      ${linha("João", euros(c.lucroJoao), perc(c.pLucroJoao), false, tom(c.lucroJoao))}
      ${linha("Joana", euros(c.lucroJoana), perc(c.pLucroJoana), false, tom(c.lucroJoana))}
      <p class="venda-nota">O João leva a sua % de investimento + metade da % da Joana (faz a obra).</p>
    </div>

    <div class="cartao venda-total">
      <h2 class="venda-h">Retorno total (investimento + lucro)</h2>
      ${linha("João", euros(c.totalJoao), "", true, tom(c.totalJoao - c.joao))}
      ${linha("Joana", euros(c.totalJoana), "", true, tom(c.totalJoana - c.joana))}
    </div>`;

  ligar();
}

function campoNum(rotulo, campo, valor, sufixo) {
  const v = (valor === null || valor === undefined || Number.isNaN(valor)) ? "" : +(+valor).toFixed(4);
  return `
    <label class="campo-edit">
      <span>${rotulo}</span>
      <span class="campo-edit__wrap">
        <input type="number" inputmode="decimal" step="any" data-campo="${campo}" value="${v}">
        <span class="campo-edit__suf">${sufixo}</span>
      </span>
    </label>`;
}

// verde se dá lucro, vermelho se dá prejuízo, neutro se for zero
function tom(v) {
  if (typeof v !== "number" || Number.isNaN(v) || v === 0) return "";
  return v > 0 ? "is-ok" : "is-mau";
}

function linha(rotulo, valor, pct, forte = false, tomValor = "") {
  return `
    <div class="venda-linha ${forte ? "is-forte" : ""}">
      <span class="venda-linha__rot">${rotulo}</span>
      <span class="venda-linha__val ${tomValor}">${valor}${pct ? ` <small>(${pct})</small>` : ""}</span>
    </div>`;
}

function ligar() {
  if (contentorRef._ligadoVenda) return;
  contentorRef._ligadoVenda = true;
  contentorRef.addEventListener("change", (ev) => {
    const el = ev.target.closest("[data-campo]");
    if (!el) return;
    const campo = el.dataset.campo;
    let v = el.value === "" ? 0 : parseFloat(el.value);
    if (Number.isNaN(v)) v = 0;
    alterar((est) => {
      est.negocio[campo] = (campo === "taxaImpostos") ? v / 100 : v;
    });
    desenhar();
  });
}
