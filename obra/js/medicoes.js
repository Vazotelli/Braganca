// =========================================================================
// medicoes.js — vista Medições (totais por capítulo) com adicionar/editar/eliminar.
// =========================================================================

import {
  obter, alterar, adicionarMedicao, eliminarMedicao, inserirMedicao,
} from "./estado.js";
import { euros, numero, esc } from "./utils.js";
import { mostrarUndo } from "./ui.js";

let expandidoId = null;
let corpoRef = null;

export function render(corpo) {
  corpoRef = corpo;
  desenhar();
}

function desenhar() {
  const meds = obter().medicoes;
  corpoRef.innerHTML = `
    <p class="nota">Totais por capítulo. O cálculo detalhado por parcela fica no Excel.</p>
    <button id="add-med" class="btn-add">+ Adicionar medição</button>
    <div id="lista-med">${meds.map(cartao).join("")}</div>`;

  ligar();
}

function cartao(md) {
  const aberto = expandidoId === md.id;
  const valor = (md.quantidade != null && md.precoUnit != null)
    ? euros(md.quantidade * md.precoUnit) : "—";
  const badge = md.estado === "por_decidir" ? `<span class="badge badge--aviso">por decidir</span>`
    : md.estado === "por_orcamentar" ? `<span class="badge badge--aviso">por orçamentar</span>` : "";
  return `
    <div class="med cartao ${aberto ? "is-aberto" : ""}" data-id="${md.id}">
      <div class="med__topo">
        <div>
          <div class="med__cab"><strong>${esc(md.capitulo) || "<em>nova medição</em>"} ${badge}</strong></div>
          <div class="med__meta">${numero(md.quantidade)} ${esc(md.unidade)}${md.precoUnit != null ? " × " + euros(md.precoUnit) : ""}</div>
        </div>
        <span class="med__valor">${valor}</span>
      </div>
      ${!aberto && md.notas ? `<div class="med__notas">${esc(md.notas)}</div>` : ""}
      ${aberto ? editor(md) : ""}
    </div>`;
}

function editor(md) {
  const optEstado = (v, txt) => `<option value="${v}" ${md.estado === v ? "selected" : ""}>${txt}</option>`;
  return `
    <div class="editor">
      <label class="campo campo--largo"><span>Capítulo</span>
        <input type="text" data-acao="capitulo" value="${esc(md.capitulo ?? "")}"></label>
      <label class="campo"><span>Quantidade</span>
        <input type="number" inputmode="decimal" step="any" data-acao="quantidade" value="${vin(md.quantidade)}"></label>
      <label class="campo"><span>Unidade</span>
        <input type="text" data-acao="unidade" value="${esc(md.unidade ?? "")}"></label>
      <label class="campo"><span>Preço unit.</span>
        <input type="number" inputmode="decimal" step="any" data-acao="precoUnit" value="${vin(md.precoUnit)}"></label>
      <label class="campo"><span>Estado</span>
        <select data-acao="estado">
          ${optEstado("ok", "normal")}${optEstado("por_orcamentar", "por orçamentar")}${optEstado("por_decidir", "por decidir")}
        </select></label>
      <label class="campo campo--largo"><span>Notas</span>
        <input type="text" data-acao="notas" value="${esc(md.notas ?? "")}"></label>
      <button class="btn-eliminar" data-acao="eliminar">Eliminar medição</button>
    </div>`;
}

function ligar() {
  if (corpoRef._ligadoMed) return;
  corpoRef._ligadoMed = true;

  corpoRef.addEventListener("change", (ev) => {
    const el = ev.target.closest("[data-acao]");
    if (!el || el.tagName === "BUTTON") return;
    const medEl = ev.target.closest(".med");
    if (!medEl) return;
    const acao = el.dataset.acao;
    alterar((est) => {
      const md = est.medicoes.find((x) => x.id === medEl.dataset.id);
      if (!md) return;
      if (acao === "quantidade" || acao === "precoUnit")
        md[acao] = el.value === "" ? null : parseFloat(el.value);
      else md[acao] = el.value;
    });
    desenhar();
  });

  corpoRef.addEventListener("click", (ev) => {
    // adicionar
    if (ev.target.closest("#add-med")) {
      const id = adicionarMedicao();
      expandidoId = id;
      desenhar();
      document.querySelector(`.med[data-id="${id}"]`)?.scrollIntoView({ block: "center" });
      return;
    }
    // eliminar
    const btnDel = ev.target.closest('[data-acao="eliminar"]');
    if (btnDel) {
      const id = ev.target.closest(".med").dataset.id;
      const info = eliminarMedicao(id);
      expandidoId = null;
      desenhar();
      if (info) mostrarUndo("Medição eliminada.", () => { inserirMedicao(info.item, info.indice); desenhar(); });
      return;
    }
    // expandir/colapsar
    const topo = ev.target.closest(".med__topo");
    if (topo && !ev.target.closest("input,select,label,button")) {
      const id = ev.target.closest(".med").dataset.id;
      expandidoId = (expandidoId === id) ? null : id;
      desenhar();
    }
  });
}

function vin(v) { return (v === null || v === undefined) ? "" : String(parseFloat(v.toFixed(6))); }
