// =========================================================================
// cronograma.js — ecra Cronograma: lista de fases (nao Gantt horizontal) com
// estado, progresso de subtarefas e avisos de dependencia (que nunca bloqueiam).
// Sub-separador "Administrativo" com as tarefas administrativas.
// =========================================================================

import { obter, alterar } from "./estado.js";
import { semanaAtual, data as fmtData, esc } from "./utils.js";
import { PLANTAS } from "./plantas_dados.js";

let vista = "fases";     // "fases" | "admin"
let contentorRef = null;

const ESTADOS = [
  ["nao_iniciada", "Não iniciada"],
  ["em_curso", "Em curso"],
  ["concluida", "Concluída"],
  ["bloqueada", "Bloqueada"],
];
const TITULO_PLANTA = Object.fromEntries(PLANTAS.map((p) => [p.id, p.titulo]));

export function render(contentor) {
  contentorRef = contentor;
  desenhar();
}

function desenhar() {
  const c = contentorRef;
  c.innerHTML = `
    <div class="subtabs">
      <button class="subtabs__b ${vista === "fases" ? "is-ativo" : ""}" data-vista="fases">Fases</button>
      <button class="subtabs__b ${vista === "admin" ? "is-ativo" : ""}" data-vista="admin">Administrativo</button>
    </div>
    <div id="crono-corpo"></div>`;
  const corpo = c.querySelector("#crono-corpo");
  if (vista === "fases") desenharFases(corpo);
  else desenharAdmin(corpo);
  ligar();
}

// ------------------------------------------------------------------- Fases
function desenharFases(corpo) {
  const sem = semanaAtual();
  corpo.innerHTML = `
    <p class="nota">Semana atual: <strong>S${sem}</strong></p>
    ${obter().fases.map((f) => cartaoFase(f, sem)).join("")}`;
}

function cartaoFase(f, sem) {
  const total = f.subtarefas.length;
  const feitas = f.subtarefas.filter((s) => s.concluida).length;
  const p = total ? Math.round(feitas / total * 100) : (f.estado === "concluida" ? 100 : 0);
  const atual = f.semanaInicio != null && sem >= f.semanaInicio && sem <= f.semanaFim;
  const emFalta = dependenciasEmFalta(f);
  const mostrarAviso = emFalta.length && (f.estado === "em_curso" || f.estado === "concluida");

  return `
    <div class="fase ${atual ? "fase--atual" : ""}" data-id="${f.id}">
      <div class="fase__cab">
        <span class="fase__num">${esc(f.numero)}</span>
        <span class="fase__nome">${esc(f.nome)}</span>
        ${estadoBadge(f.estado)}
      </div>
      <div class="fase__meta">
        <span>S${f.semanaInicio}–S${f.semanaFim}</span>
        ${atual ? `<span class="tag-atual">esta semana</span>` : ""}
        <span class="fase__prog">${feitas}/${total} tarefas</span>
      </div>
      <div class="barra barra--fina"><div class="barra__cheio" style="width:${p}%"></div></div>

      ${mostrarAviso ? `<div class="aviso">⚠ Depende de fases ainda não concluídas: ${emFalta.map(esc).join(", ")}. Podes avançar à mesma.</div>` : ""}

      <label class="fase__estado">
        <span>Estado</span>
        <select data-acao="estado">
          ${ESTADOS.map(([v, t]) => `<option value="${v}" ${f.estado === v ? "selected" : ""}>${t}</option>`).join("")}
        </select>
      </label>

      ${total ? `<ul class="subs">${f.subtarefas.map((s, i) => `
        <li class="sub ${s.concluida ? "is-feita" : ""}">
          <label>
            <input type="checkbox" data-acao="sub" data-i="${i}" ${s.concluida ? "checked" : ""}>
            <span class="sub__nome">${esc(s.nome)}</span>
            <span class="sub__sem">S${s.semanaInicio}–S${s.semanaFim}</span>
          </label>
        </li>`).join("")}</ul>` : ""}

      ${f.plantasAssociadas?.length ? `<div class="chips">${f.plantasAssociadas.map((id) =>
        `<button class="chip" data-planta="${id}">▦ ${esc(TITULO_PLANTA[id] || id)}</button>`).join("")}</div>` : ""}
    </div>`;
}

function dependenciasEmFalta(f) {
  const porNumero = Object.fromEntries(obter().fases.map((x) => [x.numero, x]));
  return (f.dependeDe || [])
    .filter((n) => porNumero[n] && porNumero[n].estado !== "concluida")
    .map((n) => n);
}

function estadoBadge(estado) {
  const txt = (ESTADOS.find(([v]) => v === estado) || [, estado])[1];
  return `<span class="badge badge--${estado}">${txt}</span>`;
}

// ------------------------------------------------------------- Administrativo
function desenharAdmin(corpo) {
  corpo.innerHTML = obter().tarefasAdministrativas.map(cartaoAdmin).join("");
}

function cartaoAdmin(t) {
  return `
    <div class="cartao admin" data-id="${t.id}">
      <div class="fase__cab">
        <span class="fase__nome">${esc(t.nome)}</span>
        ${estadoBadge(t.estado)}
      </div>
      <div class="fase__meta">${t.responsavel ? "Responsável: " + esc(t.responsavel) : ""}</div>
      <label class="fase__estado"><span>Estado</span>
        <select data-acao="estadoAdmin">
          ${ESTADOS.map(([v, txt]) => `<option value="${v}" ${t.estado === v ? "selected" : ""}>${txt}</option>`).join("")}
        </select></label>
      <div class="admin__datas">
        <label class="campo"><span>Submetido</span><input type="date" data-acao="dataSubmissao" value="${t.dataSubmissao ?? ""}"></label>
        <label class="campo"><span>Aprovado</span><input type="date" data-acao="dataAprovacao" value="${t.dataAprovacao ?? ""}"></label>
      </div>
      ${t.bloqueia?.length ? `<p class="nota">Bloqueia: ${t.bloqueia.map(rotuloBloqueio).map(esc).join(", ")}</p>` : ""}
    </div>`;
}

function rotuloBloqueio(id) {
  if (id === "venda") return "Venda";
  if (/^\d+$/.test(id)) return "Fase " + id;
  const t = obter().tarefasAdministrativas.find((x) => x.id === id);
  return t ? t.nome : id;
}

// ------------------------------------------------------------------- eventos
function ligar() {
  const c = contentorRef;
  if (c._ligadoCrono) { ligarSubtabs(); return; }
  c._ligadoCrono = true;
  ligarSubtabs();

  c.addEventListener("change", (ev) => {
    const el = ev.target.closest("[data-acao]");
    if (!el) return;
    const faseEl = ev.target.closest(".fase");
    const admEl = ev.target.closest(".admin");
    const acao = el.dataset.acao;
    alterar((est) => {
      if (faseEl) {
        const f = est.fases.find((x) => x.id === faseEl.dataset.id);
        if (!f) return;
        if (acao === "estado") f.estado = el.value;
        else if (acao === "sub") {
          f.subtarefas[+el.dataset.i].concluida = el.checked;
          // se todas concluidas, sugere estado concluida; se alguma por fazer e estava concluida, volta a em_curso
          const todas = f.subtarefas.every((s) => s.concluida);
          if (todas && f.subtarefas.length) f.estado = "concluida";
          else if (f.estado === "concluida") f.estado = "em_curso";
        }
      } else if (admEl) {
        const t = est.tarefasAdministrativas.find((x) => x.id === admEl.dataset.id);
        if (!t) return;
        if (acao === "estadoAdmin") t.estado = el.value;
        else if (acao === "dataSubmissao") t.dataSubmissao = el.value || null;
        else if (acao === "dataAprovacao") t.dataAprovacao = el.value || null;
      }
    });
    desenhar();
  });

  c.addEventListener("click", (ev) => {
    const chip = ev.target.closest("[data-planta]");
    if (chip) { irParaPlanta(chip.dataset.planta); }
  });
}

function ligarSubtabs() {
  contentorRef.querySelector(".subtabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-vista]");
    if (b) { vista = b.dataset.vista; desenhar(); }
  });
}

// abre o separador Plantas focado numa planta (ligado no app.js)
function irParaPlanta(id) {
  if (typeof window.__abrirPlanta === "function") window.__abrirPlanta(id);
}
