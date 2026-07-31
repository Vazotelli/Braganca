// =========================================================================
// pagamentos.js — ecra Pagamentos: uma linha por especialidade (mao de obra),
// com % pago; expandir para ver/editar marcos, marcar pago, adicionar/eliminar.
// =========================================================================

import {
  obter, alterar, pagoDe, pctPago, totaisMO,
  adicionarMarco, eliminarMarco, inserirMarco,
  adicionarEspecialidade, eliminarEspecialidade, inserirEspecialidade,
} from "./estado.js";
import { euros, perc, data as fmtData, hojeISO, esc } from "./utils.js";
import { mostrarUndo } from "./ui.js";

let expandidoId = null;
let contentorRef = null;

export function render(contentor) {
  contentorRef = contentor;
  desenhar();
}

function desenhar() {
  const t = totaisMO();
  const esps = obter().especialidades;
  contentorRef.innerHTML = `
    <div class="resumo">
      <div class="resumo__cartao">
        <span class="resumo__rot">Pago</span>
        <strong class="resumo__val">${euros(t.pago)}</strong>
        <span class="resumo__sub">de ${euros(t.contratado)} contratado</span>
      </div>
    </div>
    <div class="barra"><div class="barra__cheio" style="width:${pctBarra(t.pago, t.contratado)}%"></div></div>
    <div id="lista-esp">${esps.map(cartaoEsp).join("")}</div>
    <button class="btn-add" data-acao="addEsp">
      <svg class="ic ic--sm" aria-hidden="true"><use href="#i-mais"></use></svg>Adicionar especialidade
    </button>`;
  ligar();
}

function cartaoEsp(e) {
  const aberto = expandidoId === e.id;
  const p = pctPago(e);
  return `
    <div class="esp ${aberto ? "is-aberto" : ""}" data-id="${e.id}">
      <div class="esp__topo">
        <div class="esp__cab">
          <span class="esp__nome">${esc(e.nome) || "<em>nova especialidade</em>"}</span>
          <span class="esp__val">${euros(pagoDe(e))} / ${euros(e.totalContratado)}</span>
        </div>
        <div class="barra barra--fina"><div class="barra__cheio" style="width:${Math.round(p * 100)}%"></div></div>
        <span class="esp__pct">${perc(p)}</span>
      </div>
      ${aberto ? corpoEsp(e) : ""}
    </div>`;
}

function corpoEsp(e) {
  return `
    <div class="esp__corpo">
      <div class="esp__editcab">
        <label class="campo campo--largo"><span>Nome da especialidade</span>
          <input type="text" data-acao="nomeEsp" value="${esc(e.nome ?? "")}" placeholder="Ex.: Eletricista"></label>
        <label class="campo"><span>Total contratado (s/IVA)</span>
          <input type="number" inputmode="decimal" step="any" data-acao="totalEsp" value="${vin(e.totalContratado)}"></label>
      </div>
      ${e.marcos.map(marco).join("") || `<p class="vazio">Sem marcos.</p>`}
      <button class="btn-add" data-acao="addMarco">
        <svg class="ic ic--sm" aria-hidden="true"><use href="#i-mais"></use></svg>Adicionar marco
      </button>
      <button class="btn-eliminar" data-acao="eliminarEsp">
        <svg class="ic ic--sm" aria-hidden="true"><use href="#i-lixo"></use></svg>Eliminar especialidade
      </button>
    </div>`;
}

function marco(m) {
  const pago = !!m.dataPaga;
  return `
    <div class="marco ${pago ? "is-pago" : ""}" data-marco="${m.id}">
      <div class="marco__topo">
        <button class="marco__pago" data-acao="togglePago" aria-pressed="${pago}">
          ${pago ? `<svg class="ic ic--sm" aria-hidden="true"><use href="#i-check"></use></svg>Pago` : "Marcar pago"}
        </button>
        <input class="marco__desc" type="text" data-acao="descricao" placeholder="Descrição do marco" value="${esc(m.descricao ?? "")}">
      </div>
      <div class="marco__grelha">
        <label class="campo"><span>Valor</span>
          <input type="number" inputmode="decimal" step="any" data-acao="valor" value="${vin(m.valor)}"></label>
        <label class="campo"><span>Método</span>
          <select data-acao="metodo">
            <option ${m.metodo === "Transferência" ? "selected" : ""}>Transferência</option>
            <option ${m.metodo === "Dinheiro" ? "selected" : ""}>Dinheiro</option>
          </select></label>
        <label class="campo"><span>Data prevista</span>
          <input type="date" data-acao="dataPrevista" value="${m.dataPrevista ?? ""}"></label>
        <label class="campo"><span>Data paga</span>
          <input type="date" data-acao="dataPaga" value="${m.dataPaga ?? ""}" ${pago ? "" : "disabled"}></label>
      </div>
      <button class="btn-eliminar" data-acao="eliminarMarco">
        <svg class="ic ic--sm" aria-hidden="true"><use href="#i-lixo"></use></svg>Eliminar marco
      </button>
    </div>`;
}

// Listeners delegados, ligados UMA vez ao contentor persistente
// (marcador no elemento para nao empilhar a cada re-render).
function ligar() {
  if (contentorRef._ligadoPag) return;
  contentorRef._ligadoPag = true;

  contentorRef.addEventListener("change", (ev) => {
    const el = ev.target.closest("[data-acao]");
    if (!el || el.tagName === "BUTTON") return;
    const espEl = ev.target.closest(".esp");
    if (!espEl) return;
    const acao = el.dataset.acao;
    const marcoEl = ev.target.closest(".marco");
    alterar((est) => {
      const e = est.especialidades.find((x) => x.id === espEl.dataset.id);
      if (!e) return;
      if (acao === "nomeEsp") { e.nome = el.value; return; }
      if (acao === "totalEsp") { e.totalContratado = el.value === "" ? 0 : parseFloat(el.value); return; }
      const m = e.marcos.find((x) => x.id === marcoEl?.dataset.marco);
      if (!m) return;
      if (acao === "valor") m.valor = el.value === "" ? 0 : parseFloat(el.value);
      else if (acao === "dataPrevista") m.dataPrevista = el.value || null;
      else if (acao === "dataPaga") m.dataPaga = el.value || null;
      else m[acao] = el.value;
    });
    desenhar();
  });

  contentorRef.addEventListener("click", (ev) => {
    // adicionar especialidade (botao fora de qualquer .esp)
    if (ev.target.closest('button[data-acao="addEsp"]')) {
      const id = adicionarEspecialidade();
      expandidoId = id;
      desenhar();
      document.querySelector(`.esp[data-id="${id}"]`)?.scrollIntoView({ block: "center" });
      return;
    }
    const espEl = ev.target.closest(".esp");
    if (!espEl) return;
    const espId = espEl.dataset.id;
    const btn = ev.target.closest("button[data-acao]");
    if (btn) {
      const acao = btn.dataset.acao;
      if (acao === "eliminarEsp") {
        const info = eliminarEspecialidade(espId);
        expandidoId = null;
        desenhar();
        if (info) mostrarUndo("Especialidade eliminada.", () => { inserirEspecialidade(info.item, info.indice); desenhar(); });
        return;
      }
      if (acao === "togglePago") {
        const marcoId = ev.target.closest(".marco").dataset.marco;
        alterar((est) => {
          const m = est.especialidades.find((x) => x.id === espId)?.marcos.find((x) => x.id === marcoId);
          if (m) m.dataPaga = m.dataPaga ? null : hojeISO();
        });
        desenhar();
      } else if (acao === "addMarco") {
        adicionarMarco(espId); desenhar();
      } else if (acao === "eliminarMarco") {
        const marcoId = ev.target.closest(".marco").dataset.marco;
        const info = eliminarMarco(espId, marcoId);
        desenhar();
        if (info) mostrarUndo("Marco eliminado.", () => { inserirMarco(info.espId, info.item, info.indice); desenhar(); });
      }
      return;
    }
    // clique no cabecalho -> expandir/colapsar
    if (ev.target.closest(".esp__topo")) {
      expandidoId = (expandidoId === espId) ? null : espId;
      desenhar();
    }
  });
}

function pctBarra(a, b) { return (b > 0) ? Math.min(100, Math.round(a / b * 100)) : 0; }
function vin(v) { return (v === null || v === undefined) ? "" : String(parseFloat((+v).toFixed(6))); }
