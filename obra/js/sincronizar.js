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

import { obter, substituir, atualizadoEm } from "./estado.js";

const CHAVE_URL = "obra_sync_url";

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
async function enviarEstado() {
  const url = obterUrl();
  if (!url) throw new Error("sem URL de sincronizacao");
  const corpo = JSON.stringify({ action: "set", estado: obter() });
  await fetch(url, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: corpo,
  });
}

// ---------------------------------------------------------------- orquestracao
// PULL-FIRST: le o remoto, compara pela marca de tempo e fica com o mais
// recente. So ENVIA se o local for mais recente — assim nunca escrevemos por
// cima de dados mais novos que ja' estejam na Sheet (ex.: outro telemovel).
// Devolve { estado: 'importado'|'enviado'|'igual', ts }.
export async function sincronizar() {
  const localTs = atualizadoEm();

  // 1) ler o remoto (se falhar, e' erro de sync — nao arriscamos escrever)
  const resp = await jsonp({ action: "get" });
  const remoto = resp && resp.json ? safeParse(resp.json) : null;
  const remotoTs = remoto && remoto.atualizadoEm ? remoto.atualizadoEm : 0;

  // 2) remoto mais recente -> adotamos
  if (remoto && remotoTs > localTs) {
    substituir(remoto);
    return { estado: "importado", ts: remotoTs };
  }
  // 3) local mais recente (ou Sheet ainda vazia) -> enviamos
  if (localTs > remotoTs) {
    await enviarEstado();
    return { estado: "enviado", ts: localTs };
  }
  // 4) iguais -> nada a fazer
  return { estado: "igual", ts: localTs };
}

function safeParse(s) { try { return typeof s === "string" ? JSON.parse(s) : s; } catch { return null; } }
