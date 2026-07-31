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
  let e = clone(SEED);
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) e = JSON.parse(bruto);
  } catch (err) {
    console.warn("estado guardado ilegível, uso o seed:", err);
  }
  // migracao leve: garantir id em cada medicao (o seed antigo nao tinha)
  (e.medicoes || []).forEach((m, i) => { if (!m.id) m.id = "med_" + i; });
  // migracao: bloco "negocio" (investimento/venda) pode faltar em dados antigos
  if (!e.negocio) e.negocio = clone(SEED).negocio;
  // migracao: plano de acoes
  if (!e.acoes) e.acoes = clone(SEED).acoes || [];
  return e;
}

// preservarTs=true mantem a marca de tempo que veio nos dados (usado ao importar
// da Sheet): senao o estado importado ficava "mais recente" que o remoto e a
// app reenviava-o na sincronizacao seguinte.
function guardarJa(preservarTs = false) {
  try {
    if (!preservarTs) estado.atualizadoEm = Date.now();   // last-write-wins
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch (e) {
    console.error("falha a guardar em localStorage:", e);
  }
}

function agendarGuardar() {
  clearTimeout(timer);
  timer = setTimeout(guardarJa, 500);
}

// grava JA' se a app for para segundo plano ou fechar (nao perder edicoes recentes)
if (typeof window !== "undefined") {
  const flush = () => { clearTimeout(timer); guardarJa(); };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
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

// substitui o estado inteiro (usado pelo sync ao puxar dados remotos).
// mantem a marca de tempo do remoto -> ficamos exatamente iguais a' Sheet.
export function substituir(novo) {
  if (!novo || typeof novo !== "object") return;
  estado = novo;
  guardarJa(true);
  notificar();
}

// marca de tempo da ultima alteracao (para o sync decidir quem e' mais recente)
export function atualizadoEm() {
  return estado.atualizadoEm || 0;
}

// --- adicionar / eliminar / inserir (com suporte a Anular) ---
let contadorNovo = 0;
function novoId(pref) { return `${pref}_${Date.now().toString(36)}_${contadorNovo++}`; }

export function adicionarMaterial(capitulo = "") {
  const m = {
    id: novoId("mat"), capitulo, especialidade: capitulo, artigo: "",
    qtd: null, unidade: "", precoUnit: null, total: null, iva: null,
    ivaAtivo: false, taxaIva: 0.23, adjudicado: false,
    fornecedor: null, observacoes: "", estado: "ok",
  };
  estado.materiais.push(m);
  agendarGuardar(); notificar();
  return m.id;
}

export function eliminarMaterial(id) {
  const i = estado.materiais.findIndex((x) => x.id === id);
  if (i < 0) return null;
  const [item] = estado.materiais.splice(i, 1);
  agendarGuardar(); notificar();
  return { item, indice: i };
}

export function inserirMaterial(item, indice) {
  estado.materiais.splice(Math.min(indice, estado.materiais.length), 0, item);
  agendarGuardar(); notificar();
}

export function adicionarMedicao() {
  const md = {
    id: novoId("med"), capitulo: "", quantidade: null, unidade: "",
    precoUnit: null, notas: "", estado: "ok",
  };
  estado.medicoes.push(md);
  agendarGuardar(); notificar();
  return md.id;
}

export function eliminarMedicao(id) {
  const i = estado.medicoes.findIndex((x) => x.id === id);
  if (i < 0) return null;
  const [item] = estado.medicoes.splice(i, 1);
  agendarGuardar(); notificar();
  return { item, indice: i };
}

export function inserirMedicao(item, indice) {
  estado.medicoes.splice(Math.min(indice, estado.medicoes.length), 0, item);
  agendarGuardar(); notificar();
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

// -------------------------------------------------------------------------
// Plano de acoes
// -------------------------------------------------------------------------
export function adicionarAcao() {
  const a = { id: novoId("acao"), descricao: "", dataFim: null, feito: false };
  estado.acoes.push(a);
  agendarGuardar(); notificar();
  return a.id;
}
export function eliminarAcao(id) {
  const i = estado.acoes.findIndex((x) => x.id === id);
  if (i < 0) return null;
  const [item] = estado.acoes.splice(i, 1);
  agendarGuardar(); notificar();
  return { item, indice: i };
}
export function inserirAcao(item, indice) {
  estado.acoes.splice(Math.min(indice, estado.acoes.length), 0, item);
  agendarGuardar(); notificar();
}

// -------------------------------------------------------------------------
// Pagamentos (mao de obra)
// -------------------------------------------------------------------------
export function pagoDe(e) {
  return e.marcos.reduce((s, m) => s + (m.dataPaga ? (m.valor || 0) : 0), 0);
}
export function pctPago(e) {
  const t = e.totalContratado || 0;
  return t ? pagoDe(e) / t : 0;
}
export function totaisMO() {
  let contratado = 0, pago = 0;
  for (const e of estado.especialidades) {
    contratado += e.totalContratado || 0;
    pago += pagoDe(e);
  }
  return { contratado, pago };
}

export function adicionarEspecialidade() {
  const e = { id: novoId("esp"), nome: "", totalContratado: 0, taxaIva: 0.06, marcos: [] };
  estado.especialidades.push(e);
  agendarGuardar(); notificar();
  return e.id;
}
export function eliminarEspecialidade(id) {
  const i = estado.especialidades.findIndex((x) => x.id === id);
  if (i < 0) return null;
  const [item] = estado.especialidades.splice(i, 1);
  agendarGuardar(); notificar();
  return { item, indice: i };
}
export function inserirEspecialidade(item, indice) {
  estado.especialidades.splice(Math.min(indice, estado.especialidades.length), 0, item);
  agendarGuardar(); notificar();
}

export function adicionarMarco(espId) {
  const e = estado.especialidades.find((x) => x.id === espId);
  if (!e) return null;
  const m = { id: novoId("mk"), descricao: "", valor: 0, dataPrevista: null, dataPaga: null, metodo: "Transferência" };
  e.marcos.push(m);
  agendarGuardar(); notificar();
  return m.id;
}
export function eliminarMarco(espId, marcoId) {
  const e = estado.especialidades.find((x) => x.id === espId);
  if (!e) return null;
  const i = e.marcos.findIndex((m) => m.id === marcoId);
  if (i < 0) return null;
  const [item] = e.marcos.splice(i, 1);
  agendarGuardar(); notificar();
  return { espId, item, indice: i };
}
export function inserirMarco(espId, item, indice) {
  const e = estado.especialidades.find((x) => x.id === espId);
  if (!e) return;
  e.marcos.splice(Math.min(indice, e.marcos.length), 0, item);
  agendarGuardar(); notificar();
}

// Constantes da regra de investimento (fixas; so os 4 valores laranja sao editaveis)
const JOANA_LIMIAR = 60000;   // acima disto a Joana entra so com o teto
const JOANA_TETO = 20000;     // teto do investimento da Joana
const JOANA_FRACAO = 1 / 3;   // senao, 1/3 do total

// calculo do investimento / venda / lucro (Joao / Joana)
export function calcularNegocio() {
  const n = estado.negocio || {};
  const num0 = (v) => (typeof v === "number" && !Number.isNaN(v)) ? v : 0;

  const total = num0(n.investimentoTotal);
  const joana = total > JOANA_LIMIAR ? JOANA_TETO : total * JOANA_FRACAO;
  const joao = total - joana;
  const pInvJoao = total ? joao / total : 0;
  const pInvJoana = total ? joana / total : 0;
  // Joao leva a sua % + metade da % da Joana (faz a obra)
  const pLucroJoao = pInvJoao + pInvJoana / 2;
  const pLucroJoana = 1 - pLucroJoao;

  const liquido = 1 - num0(n.taxaImpostos);
  const posE = num0(n.precoVendaE) * liquido;
  const posD = num0(n.precoVendaD) * liquido;
  const vendas = posE + posD;
  const lucroTotal = vendas - total;

  const lucroJoao = lucroTotal * pLucroJoao;
  const lucroJoana = lucroTotal * pLucroJoana;

  return {
    total, joao, joana, pInvJoao, pInvJoana, pLucroJoao, pLucroJoana,
    posE, posD, vendas, lucroTotal, lucroJoao, lucroJoana,
    totalJoao: joao + lucroJoao, totalJoana: joana + lucroJoana,
  };
}
