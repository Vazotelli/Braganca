// =========================================================================
// app.js — arranque e navegacao entre ecras (tab bar).
// Passo 1: so o esqueleto. Cada ecra e' ligado ao seu modulo nos passos
// seguintes; por agora mostram um placeholder "em construcao".
// =========================================================================

import { render as renderCustos } from "./custos.js";
import { render as renderVenda } from "./venda.js";
import { render as renderPagamentos } from "./pagamentos.js";
import { render as renderCronograma } from "./cronograma.js";
import { render as renderPlantas, abrir as abrirPlanta } from "./plantas.js";

// Definicao dos 5 ecras. `render` sera' substituido pelos modulos reais
// (custos.js, pagamentos.js, ...) a medida que os passos avancam.
const ECRAS = {
  painel: {
    titulo: "Painel",
    render: (container) => placeholder(container, "▣", "Painel"),
  },
  custos: {
    titulo: "Custos",
    render: renderCustos,
  },
  pagamentos: {
    titulo: "Pagamentos",
    render: renderPagamentos,
  },
  cronograma: {
    titulo: "Cronograma",
    render: renderCronograma,
  },
  plantas: {
    titulo: "Plantas",
    render: renderPlantas,
  },
  venda: {
    titulo: "Venda",
    render: renderVenda,
  },
};

const ECRA_INICIAL = "painel";

// Placeholder temporario (removido em cada passo ao ligar o ecra real).
function placeholder(container, icone, nome) {
  container.innerHTML = `
    <div class="placeholder">
      <span class="placeholder__icone">${icone}</span>
      <p><strong>${nome}</strong></p>
      <p>Em construção.</p>
    </div>`;
}

// Mostra o ecra pedido e atualiza cabecalho + estado da tab bar.
function mostrarEcra(nome) {
  const ecra = ECRAS[nome] || ECRAS[ECRA_INICIAL];
  const container = document.getElementById("conteudo");
  const titulo = document.getElementById("titulo-ecra");

  titulo.textContent = ecra.titulo;
  container.scrollTo?.(0, 0);
  window.scrollTo(0, 0);
  ecra.render(container);

  // marcar o botao ativo
  document.querySelectorAll(".tabbar__botao").forEach((botao) => {
    const ativo = botao.dataset.ecra === nome;
    botao.setAttribute("aria-current", ativo ? "page" : "false");
  });

  // guardar na hash para poder recarregar no mesmo ecra
  if (location.hash !== "#" + nome) {
    history.replaceState(null, "", "#" + nome);
  }
}

// Liga os cliques da tab bar.
function ligarNavegacao() {
  document.getElementById("tabbar").addEventListener("click", (ev) => {
    const botao = ev.target.closest(".tabbar__botao");
    if (botao) mostrarEcra(botao.dataset.ecra);
  });
}

// Navegacao acessivel a outros modulos (ex.: chips do Plano abrem uma planta)
window.__ir = mostrarEcra;
window.__abrirPlanta = (id) => { mostrarEcra("plantas"); setTimeout(() => abrirPlanta(id), 60); };

// Arranque.
function arrancar() {
  ligarNavegacao();
  const inicial = location.hash.slice(1);
  mostrarEcra(ECRAS[inicial] ? inicial : ECRA_INICIAL);
}

document.addEventListener("DOMContentLoaded", arrancar);
