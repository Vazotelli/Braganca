// =========================================================================
// estado.js — store central + persistencia em localStorage.
// Chave unica `obra_braganca_v1`, escrita com debounce de 500ms.
// So dados estruturados aqui; fotos/notas ficam em IndexedDB (registo.js).
// =========================================================================

import { SEED } from "./dados.js";

const CHAVE = "obra_braganca_v1";

function clone(o) { return JSON.parse(JSON.stringify(o)); }

let estado = carregar();
const ouvintes = new Set();
let timer = null;

function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) return JSON.parse(bruto);
  } catch (e) {
    console.warn("estado guardado ilegível, uso o seed:", e);
  }
  return clone(SEED);
}

function guardarJa() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch (e) {
    console.error("falha a guardar em localStorage:", e);
  }
}

function agendarGuardar() {
  clearTimeout(timer);
  timer = setTimeout(guardarJa, 500);
}

function notificar() {
  ouvintes.forEach((fn) => { try { fn(estado); } catch (e) { console.error(e); } });
}

// --- API ---
export function obter() { return estado; }

export function subscrever(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

// altera o estado atraves de uma funcao que o muta, depois grava + notifica
export function alterar(mutador) {
  mutador(estado);
  agendarGuardar();
  notificar();
}

export function reporSeed() {
  estado = clone(SEED);
  guardarJa();
  notificar();
}

// tamanho aproximado ocupado em localStorage (KB)
export function tamanhoKB() {
  try { return Math.round((localStorage.getItem(CHAVE) || "").length / 1024 * 10) / 10; }
  catch { return 0; }
}

// -------------------------------------------------------------------------
// Selectores de dominio (mesma logica de calculo do Excel)
// -------------------------------------------------------------------------
export function ivaDe(m) {
  return (typeof m.iva === "number") ? m.iva : 0;
}

// recalcula total e IVA de uma linha de material apos edicao
export function recalcularLinha(m) {
  if (typeof m.qtd === "number" && typeof m.precoUnit === "number") {
    m.total = Math.round(m.qtd * m.precoUnit * 100) / 100;
  }
  m.iva = (m.ivaAtivo && typeof m.total === "number")
    ? Math.round(m.total * m.taxaIva * 100) / 100
    : null;
}

// totais de materiais:
//   estimado = Σ(TOTAL>0) + Σ(IVA>0)   (exclui creditos negativos)
//   gasto    = Σ(adjudicado TOTAL+IVA)
export function totaisMateriais() {
  let estSem = 0, estIva = 0, gastoSem = 0, gastoIva = 0;
  for (const m of estado.materiais) {
    const t = typeof m.total === "number" ? m.total : null;
    if (t !== null && t > 0) { estSem += t; estIva += ivaDe(m); }
    if (m.adjudicado && t !== null) { gastoSem += t; gastoIva += ivaDe(m); }
  }
  const r = (x) => Math.round(x * 100) / 100;
  return {
    estSem: r(estSem), estIva: r(estIva), estCom: r(estSem + estIva),
    gastoSem: r(gastoSem), gastoIva: r(gastoIva), gastoCom: r(gastoSem + gastoIva),
  };
}
