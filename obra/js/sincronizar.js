// =========================================================================
// sincronizar.js — sync opcional com Google Sheets (via Apps Script Web App).
//
// Modelo: a app da obra e' UM documento estruturado (nao uma lista de linhas),
// por isso guardamos o estado inteiro como JSON numa celula de uma folha
// dedicada. Estrategia simples e segura: "last-write-wins" pela marca de
// tempo `atualizadoEm`.
//
//   • PUXAR  (get)  — JSONP GET  ?action=get           → devolve {json, ts}
//   • ENVIAR (set)  — POST no-cors com o JSON no corpo  (sem CORS/preflight)
//
// O URL do Web App NAO esta' embutido: o utilizador cola-o na app (guardado
// em localStorage). Assim nada e' inventado e cada pessoa usa a sua folha.
// =========================================================================

import { obter, substituir, atualizadoEm, subscrever } from "./estado.js";

const CHAVE_URL = "obra_sync_url";
const CHAVE_JA = "obra_sync_ja";   // marca que este dispositivo ja' sincronizou

// Um dispositivo que NUNCA sincronizou tem, no maximo, o seed (dados do Excel).
// Nesse estado nunca deve ENVIAR: se o fizesse, apagaria na Sheet o trabalho
// feito noutro dispositivo. Primeira sincronizacao = so' receber.
function jaSincronizou() {
  try { return localStorage.getItem(CHAVE_JA) === "1"; } catch { return false; }
}
function marcarSincronizado() {
  try { localStorage.setItem(CHAVE_JA, "1"); } catch {}
}

export function obterUrl() {
  try { return localStorage.getItem(CHAVE_URL) || ""; } catch { return ""; }
}
export function definirUrl(url) {
  try { localStorage.setItem(CHAVE_URL, (url || "").trim()); } catch {}
}
export function temUrl() { return !!obterUrl(); }

// ---------------------------------------------------------------- JSONP (get)
// Unica forma fiavel de LER de um Apps Script sem esbarrar em CORS.
function jsonp(params, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const url = obterUrl();
    if (!url) return reject(new Error("sem URL de sincronizacao"));
    const cb = "obra_cb_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
    const script = document.createElement("script");
    let terminado = false;
    const limpar = () => {
      terminado = true;
      try { delete window[cb]; } catch {}
      if (script.parentNode) script.parentNode.removeChild(script);
    };
    window[cb] = (dados) => { limpar(); resolve(dados); };
    const t = setTimeout(() => { if (!terminado) { limpar(); reject(new Error("timeout")); } }, timeout);
    const qs = Object.entries({ ...params, callback: cb })
      .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&");
    script.src = url + (url.includes("?") ? "&" : "?") + qs;
    script.onerror = () => { clearTimeout(t); limpar(); reject(new Error("falha de rede")); };
    document.head.appendChild(script);
  });
}

// ---------------------------------------------------------------- POST (set)
// no-cors + text/plain = "simple request": e' enviado sem preflight. Nao se
// consegue LER a resposta neste modo, por isso confirmamos no proximo pull.
// keepalive=true permite que o envio sobreviva ao fecho da pagina (unload).
async function enviarEstado(keepalive = false) {
  const url = obterUrl();
  if (!url) throw new Error("sem URL de sincronizacao");
  const corpo = JSON.stringify({ action: "set", estado: obter() });
  await fetch(url, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: corpo,
    keepalive,
  });
}

// pull-only: adota o remoto se for mais recente (ou se for a 1a sincronizacao
// deste dispositivo, caso em que o que esta' na Sheet manda sempre).
export async function puxarRemoto() {
  const localTs = atualizadoEm();
  const primeira = !jaSincronizou();
  const resp = await jsonp({ action: "get" });
  const remoto = resp && resp.json ? safeParse(resp.json) : null;
  const remotoTs = remoto && remoto.atualizadoEm ? remoto.atualizadoEm : 0;
  if (remoto && remoto.acoes && (primeira || remotoTs > localTs)) {
    substituir(remoto);
    marcarSincronizado();
    return { estado: "importado", ts: remotoTs };
  }
  // contactamos a Sheet com sucesso: podemos passar a enviar. Se ela estiver
  // vazia nao ha' nada a perder; se tinha dados, ja' os adotamos acima.
  marcarSincronizado();
  return { estado: "igual", ts: localTs };
}

// ---------------------------------------------------------------- orquestracao
// PULL-FIRST: le o remoto, compara pela marca de tempo e fica com o mais
// recente. So ENVIA se o local for mais recente — assim nunca escrevemos por
// cima de dados mais novos que ja' estejam na Sheet (ex.: outro telemovel).
// Devolve { estado: 'importado'|'enviado'|'igual', ts }.
export async function sincronizar() {
  const localTs = atualizadoEm();
  const primeira = !jaSincronizou();

  // 1) ler o remoto (se falhar, e' erro de sync — nao arriscamos escrever)
  const resp = await jsonp({ action: "get" });
  const remoto = resp && resp.json ? safeParse(resp.json) : null;
  const remotoTs = remoto && remoto.atualizadoEm ? remoto.atualizadoEm : 0;

  // 2) PRIMEIRA sincronizacao deste dispositivo: se a Sheet tem dados, adotamo-los
  //    sempre (nunca enviar por cima do que ja' la' esta').
  if (primeira && remoto && remoto.acoes) {
    substituir(remoto);
    marcarSincronizado();
    return { estado: "importado", ts: remotoTs };
  }

  // 3) remoto mais recente -> adotamos
  if (remoto && remotoTs > localTs) {
    substituir(remoto);
    marcarSincronizado();
    return { estado: "importado", ts: remotoTs };
  }
  // 4) local mais recente (ou Sheet ainda vazia) -> enviamos
  if (localTs > remotoTs) {
    await enviarEstado();
    marcarSincronizado();
    return { estado: "enviado", ts: localTs };
  }
  // 5) iguais -> nada a fazer
  marcarSincronizado();
  return { estado: "igual", ts: localTs };
}

function safeParse(s) { try { return typeof s === "string" ? JSON.parse(s) : s; } catch { return null; } }

// ---------------------------------------------------------------- automatico
// RECEBE ao abrir a app; ENVIA (keepalive) ao esconder/fechar, mas so' se
// houve alteracoes locais desde a ultima sincronizacao (evita escrever por
// cima de dados mais recentes quando so' estiveste a consultar).
let sujo = false;
let ligado = false;
export function ligarAutomatico(aoImportar) {
  if (ligado) return;
  ligado = true;

  subscrever(() => { sujo = true; });   // qualquer alteracao marca "por enviar"

  // so' envia se houve alteracoes locais E este dispositivo ja' recebeu uma vez
  const enviarSeSujo = () => {
    if (sujo && temUrl() && jaSincronizou()) { enviarEstado(true).catch(() => {}); sujo = false; }
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") enviarSeSujo();
  });
  window.addEventListener("pagehide", enviarSeSujo);

  // receber ao abrir (se ja' houver URL configurado)
  if (temUrl()) {
    puxarRemoto()
      .then((r) => { sujo = false; if (r.estado === "importado" && aoImportar) aoImportar(); })
      .catch(() => { sujo = false; });
  } else {
    sujo = false;
  }
}
