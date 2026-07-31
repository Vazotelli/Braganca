// =========================================================================
// cronograma.js — Plano de ações (simples): cada ação tem uma descrição e uma
// data de fim (combinada em obra). Adicionar, marcar feito, editar, eliminar.
// Ordenado por data; ações atrasadas/por vencer destacadas.
// =========================================================================

import { obter, alterar, adicionarAcao, eliminarAcao, inserirAcao } from "./estado.js";
import { data as fmtData, diasAte, esc } from "./utils.js";
import { mostrarUndo } from "./ui.js";
import { abrir as abrirRegisto, contagens } from "./registo.js";

let contentorRef = null;

export function render(contentor) {
  contentorRef = contentor;
  desenhar();
}

// ordena: por fazer primeiro (por data asc, sem data no fim), depois feitas
function ordenar(acoes) {
  return [...acoes].sort((a, b) => {
    if (a.feito !== b.feito) return a.feito ? 1 : -1;
    const da = a.dataFim || "9999", db = b.dataFim || "9999";
    return da < db ? -1 : da > db ? 1 : 0;
  });
}

function desenhar() {
  const acoes = ordenar(obter().acoes);
  const porFazer = acoes.filter((a) => !a.feito).length;
  contentorRef.innerHTML = `
    <p class="nota">${porFazer} ${porFazer === 1 ? "ação por concluir" : "ações por concluir"}.</p>
    <button class="btn-add" data-acao="addAcao">
      <svg class="ic ic--sm" aria-hidden="true"><use href="#i-mais"></use></svg>Adicionar ação
    </button>
    <div id="lista-acoes">${acoes.map(cartao).join("") || `<p class="vazio">Sem ações. Adiciona a primeira.</p>`}</div>`;
  ligar();
  atualizarContagens();
}

// crachas com o n.o de registos (fotos/notas) por acao — carregados do IndexedDB
async function atualizarContagens() {
  const m = await contagens();
  contentorRef.querySelectorAll("[data-conta]").forEach((el) => {
    el.textContent = m[el.dataset.conta] || 0;
  });
}
window.__registosMudaram = () => atualizarContagens();

function cartao(a) {
  const d = a.dataFim ? diasAte(a.dataFim) : null;
  let estado = "", etiqueta = "";
  if (!a.feito && d !== null) {
    if (d < 0) { estado = "is-atrasada"; etiqueta = `<span class="acao-tag acao-tag--vermelho">atrasada ${-d} d</span>`; }
    else if (d === 0) { estado = "is-hoje"; etiqueta = `<span class="acao-tag acao-tag--vermelho">hoje</span>`; }
    else if (d <= 5) { estado = "is-perto"; etiqueta = `<span class="acao-tag acao-tag--ambar">em ${d} d</span>`; }
  }
  return `
    <div class="acao ${a.feito ? "is-feita" : ""} ${estado}" data-id="${a.id}">
      <label class="acao__feito" title="Concluída">
        <input type="checkbox" data-acao="feito" ${a.feito ? "checked" : ""}>
      </label>
      <div class="acao__corpo">
        <div class="acao__cab">
          <input class="acao__desc" type="text" data-acao="descricao" placeholder="Descrição da ação" value="${esc(a.descricao ?? "")}" title="${esc(a.descricao ?? "")}">
          ${etiqueta}
        </div>
        <div class="acao__fim">
          <input class="acao__data" type="date" data-acao="dataFim" value="${a.dataFim ?? ""}" title="Data de fim">
          <button class="acao__reg" data-acao="registo" title="Fotos e notas">
            <svg class="ic ic--sm" aria-hidden="true"><use href="#i-camara"></use></svg>
            <span data-conta="${a.id}">0</span>
          </button>
        </div>
      </div>
      <button class="acao__del btn-ic" data-acao="eliminarAcao" aria-label="Eliminar">
        <svg class="ic ic--sm" aria-hidden="true"><use href="#i-fechar"></use></svg>
      </button>
    </div>`;
}

function ligar() {
  const c = contentorRef;
  if (c._ligadoPlano) return;
  c._ligadoPlano = true;

  c.addEventListener("change", (ev) => {
    const el = ev.target.closest("[data-acao]");
    if (!el || el.tagName === "BUTTON") return;
    const acaoEl = ev.target.closest(".acao");
    if (!acaoEl) return;
    const campo = el.dataset.acao;
    alterar((est) => {
      const a = est.acoes.find((x) => x.id === acaoEl.dataset.id);
      if (!a) return;
      if (campo === "feito") a.feito = el.checked;
      else if (campo === "dataFim") a.dataFim = el.value || null;
      else if (campo === "descricao") a.descricao = el.value;
    });
    // so redesenhar em mudancas que reordenam (feito/data); descricao nao reordena
    if (campo === "descricao") el.title = el.value;   // tooltip acompanha o texto cortado
    else desenhar();
  });

  c.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-acao]");
    if (!btn) return;
    if (btn.dataset.acao === "registo") {
      const acaoEl = ev.target.closest(".acao");
      const a = obter().acoes.find((x) => x.id === acaoEl.dataset.id);
      abrirRegisto(acaoEl.dataset.id, a?.descricao || "");
      return;
    }
    if (btn.dataset.acao === "addAcao") {
      const id = adicionarAcao();
      desenhar();
      const novo = document.querySelector(`.acao[data-id="${id}"] .acao__desc`);
      novo?.focus();
    } else if (btn.dataset.acao === "eliminarAcao") {
      const id = ev.target.closest(".acao").dataset.id;
      const info = eliminarAcao(id);
      desenhar();
      if (info) mostrarUndo("Ação eliminada.", () => { inserirAcao(info.item, info.indice); desenhar(); });
    }
  });
}
