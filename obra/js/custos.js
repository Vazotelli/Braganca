// =========================================================================
// custos.js — ecra Custos: vista Materiais (editavel) + vista Medições (leitura).
// Regra critica: so linhas com adjudicado=true contam para o GASTO real.
// =========================================================================

import { obter, alterar, recalcularLinha, ivaDe, totaisMateriais } from "./estado.js";
import { euros, numero, esc } from "./utils.js";

// estado local do ecra (persiste enquanto a app esta aberta)
let vista = "materiais";           // "materiais" | "medicoes"
let filtroCapitulo = "";           // "" = todos
let filtroAdjudicado = "todos";    // "todos" | "sim" | "nao"
let filtroEstado = "todos";        // "todos" | "por_orcamentar" | "por_decidir"
let expandidoId = null;            // id do material com editor aberto
let contentorRef = null;

const TAXAS = [0.06, 0.13, 0.23];

// ------------------------------------------------------------------ entrada
export function render(contentor) {
  contentorRef = contentor;
  desenhar();
}

function desenhar() {
  const c = contentorRef;
  c.innerHTML = `
    <div class="subtabs">
      <button class="subtabs__b ${vista === "materiais" ? "is-ativo" : ""}" data-vista="materiais">Materiais</button>
      <button class="subtabs__b ${vista === "medicoes" ? "is-ativo" : ""}" data-vista="medicoes">Medições</button>
    </div>
    <div id="custos-corpo"></div>`;

  c.querySelector(".subtabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-vista]");
    if (b) { vista = b.dataset.vista; expandidoId = null; desenhar(); }
  });

  const corpo = c.querySelector("#custos-corpo");
  if (vista === "materiais") desenharMateriais(corpo);
  else desenharMedicoes(corpo);
}

// ---------------------------------------------------------------- Materiais
function desenharMateriais(corpo) {
  const t = totaisMateriais();
  const capitulos = [...new Set(obter().materiais.map((m) => m.capitulo).filter(Boolean))];

  corpo.innerHTML = `
    <div class="resumo">
      <div class="resumo__cartao">
        <span class="resumo__rot">Gasto real (adjudicado)</span>
        <strong class="resumo__val">${euros(t.gastoCom)}</strong>
        <span class="resumo__sub">s/IVA ${euros(t.gastoSem)}</span>
      </div>
      <div class="resumo__cartao">
        <span class="resumo__rot">Estimado (total)</span>
        <strong class="resumo__val">${euros(t.estCom)}</strong>
        <span class="resumo__sub">s/IVA ${euros(t.estSem)}</span>
      </div>
    </div>
    <div class="barra"><div class="barra__cheio" style="width:${pct(t.gastoCom, t.estCom)}%"></div></div>

    <div class="filtros">
      <select id="f-cap" class="filtros__sel" aria-label="Capítulo">
        <option value="">Todos os capítulos</option>
        ${capitulos.map((cap) => `<option value="${esc(cap)}" ${cap === filtroCapitulo ? "selected" : ""}>${esc(cap)}</option>`).join("")}
      </select>
      <select id="f-adj" class="filtros__sel" aria-label="Adjudicado">
        <option value="todos" ${sel("todos", filtroAdjudicado)}>Adjudicado: todos</option>
        <option value="sim" ${sel("sim", filtroAdjudicado)}>Só adjudicados</option>
        <option value="nao" ${sel("nao", filtroAdjudicado)}>Só não adjudicados</option>
      </select>
      <select id="f-est" class="filtros__sel" aria-label="Estado">
        <option value="todos" ${sel("todos", filtroEstado)}>Estado: todos</option>
        <option value="por_orcamentar" ${sel("por_orcamentar", filtroEstado)}>Por orçamentar</option>
        <option value="por_decidir" ${sel("por_decidir", filtroEstado)}>Por decidir</option>
      </select>
    </div>

    <div id="lista-mat"></div>`;

  corpo.querySelector("#f-cap").addEventListener("change", (e) => { filtroCapitulo = e.target.value; desenhar(); });
  corpo.querySelector("#f-adj").addEventListener("change", (e) => { filtroAdjudicado = e.target.value; desenhar(); });
  corpo.querySelector("#f-est").addEventListener("change", (e) => { filtroEstado = e.target.value; desenhar(); });

  desenharLista(corpo.querySelector("#lista-mat"));
}

function materiaisFiltrados() {
  return obter().materiais.filter((m) => {
    if (filtroCapitulo && m.capitulo !== filtroCapitulo) return false;
    if (filtroAdjudicado === "sim" && !m.adjudicado) return false;
    if (filtroAdjudicado === "nao" && m.adjudicado) return false;
    if (filtroEstado !== "todos" && m.estado !== filtroEstado) return false;
    return true;
  });
}

function desenharLista(alvo) {
  const mats = materiaisFiltrados();
  if (!mats.length) { alvo.innerHTML = `<p class="vazio">Sem materiais com estes filtros.</p>`; return; }

  // agrupar por capitulo, preservando a ordem de aparecimento
  const grupos = [];
  const idx = {};
  for (const m of mats) {
    const k = m.capitulo || "Sem capítulo";
    if (!(k in idx)) { idx[k] = grupos.length; grupos.push({ capitulo: k, itens: [] }); }
    grupos[idx[k]].itens.push(m);
  }

  alvo.innerHTML = grupos.map((g) => {
    const subEst = g.itens.reduce((s, m) => s + ((m.total > 0 ? m.total : 0) + (m.total > 0 ? ivaDe(m) : 0)), 0);
    return `
      <div class="grupo">
        <div class="grupo__cab"><span>${esc(g.capitulo)}</span><span>${euros(subEst)}</span></div>
        ${g.itens.map(linhaMaterial).join("")}
      </div>`;
  }).join("");

  alvo.querySelectorAll(".mat").forEach((el) => {
    el.querySelector(".mat__topo").addEventListener("click", (ev) => {
      if (ev.target.closest("input,select,label,button")) return;
      const id = el.dataset.id;
      expandidoId = (expandidoId === id) ? null : id;
      desenhar();
    });
  });
  ligarEdicao(alvo);
}

function linhaMaterial(m) {
  const cIva = (typeof m.total === "number") ? m.total + ivaDe(m) : null;
  const aberto = expandidoId === m.id;
  const badge = m.estado === "por_orcamentar" ? `<span class="badge badge--aviso">por orçamentar</span>`
    : m.estado === "por_decidir" ? `<span class="badge badge--aviso">por decidir</span>` : "";
  const qtdTxt = (m.qtd === null || m.qtd === undefined) ? "?" : numero(m.qtd);
  return `
    <div class="mat ${aberto ? "is-aberto" : ""}" data-id="${m.id}">
      <div class="mat__topo">
        <label class="mat__adj" title="Adjudicado">
          <input type="checkbox" data-acao="adj" ${m.adjudicado ? "checked" : ""}>
        </label>
        <div class="mat__info">
          <span class="mat__artigo">${esc(m.artigo)} ${badge}</span>
          <span class="mat__meta">${qtdTxt} ${esc(m.unidade || "")} × ${m.precoUnit != null ? euros(m.precoUnit) : "—"}</span>
        </div>
        <div class="mat__valores">
          <strong>${euros(cIva)}</strong>
          <span class="mat__siva">s/IVA ${euros(m.total)}</span>
        </div>
      </div>
      ${aberto ? editor(m) : ""}
    </div>`;
}

function editor(m) {
  return `
    <div class="editor">
      <label class="campo"><span>Quantidade</span>
        <input type="number" inputmode="decimal" step="any" data-acao="qtd" value="${vin(m.qtd)}"></label>
      <label class="campo"><span>Preço unit. (s/IVA)</span>
        <input type="number" inputmode="decimal" step="any" data-acao="pu" value="${vin(m.precoUnit)}"></label>
      <label class="campo"><span>IVA</span>
        <select data-acao="taxa">
          <option value="0" ${!m.ivaAtivo ? "selected" : ""}>sem IVA</option>
          ${TAXAS.map((tx) => `<option value="${tx}" ${m.ivaAtivo && Math.abs(m.taxaIva - tx) < 1e-6 ? "selected" : ""}>${Math.round(tx * 100)}%</option>`).join("")}
        </select></label>
      <label class="campo"><span>Fornecedor</span>
        <input type="text" data-acao="fornecedor" value="${esc(m.fornecedor ?? "")}"></label>
      <label class="campo campo--largo"><span>Observações</span>
        <input type="text" data-acao="obs" value="${esc(m.observacoes ?? "")}"></label>
    </div>`;
}

function ligarEdicao(alvo) {
  alvo.addEventListener("change", (ev) => {
    const el = ev.target.closest("[data-acao]");
    if (!el) return;
    const cartao = ev.target.closest(".mat");
    const id = cartao.dataset.id;
    const acao = el.dataset.acao;
    alterar((est) => {
      const m = est.materiais.find((x) => x.id === id);
      if (!m) return;
      if (acao === "adj") m.adjudicado = el.checked;
      else if (acao === "qtd") m.qtd = el.value === "" ? null : parseFloat(el.value);
      else if (acao === "pu") m.precoUnit = el.value === "" ? null : parseFloat(el.value);
      else if (acao === "taxa") {
        const tx = parseFloat(el.value);
        m.ivaAtivo = tx > 0;
        if (tx > 0) m.taxaIva = tx;
      } else if (acao === "fornecedor") m.fornecedor = el.value;
      else if (acao === "obs") m.observacoes = el.value;
      if (acao !== "fornecedor" && acao !== "obs") recalcularLinha(m);
    });
    desenhar();
  });
}

// ---------------------------------------------------------------- Medições
function desenharMedicoes(corpo) {
  const meds = obter().medicoes;
  corpo.innerHTML = `
    <p class="nota">Totais por capítulo (só leitura). O cálculo detalhado fica no Excel.</p>
    ${meds.map((md) => {
      const valor = (md.quantidade != null && md.precoUnit != null)
        ? euros(md.quantidade * md.precoUnit) : "—";
      const badge = md.estado === "por_decidir" ? `<span class="badge badge--aviso">por decidir</span>` : "";
      return `
        <div class="cartao med">
          <div class="med__cab"><strong>${esc(md.capitulo)} ${badge}</strong><span>${valor}</span></div>
          <div class="med__meta">${numero(md.quantidade)} ${esc(md.unidade)}${md.precoUnit != null ? " × " + euros(md.precoUnit) : ""}</div>
          ${md.notas ? `<div class="med__notas">${esc(md.notas)}</div>` : ""}
        </div>`;
    }).join("")}`;
}

// ---------------------------------------------------------------- auxiliares
function pct(a, b) { return (b > 0) ? Math.min(100, Math.round(a / b * 100)) : 0; }
function sel(v, atual) { return v === atual ? "selected" : ""; }
// valor limpo (sem ruido de virgula flutuante) para input type=number
function vin(v) { return (v === null || v === undefined) ? "" : String(parseFloat(v.toFixed(6))); }
