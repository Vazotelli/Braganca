// =========================================================================
// registo.js — fotos + notas por acao, guardadas em IndexedDB (nunca em
// localStorage). Fotos comprimidas antes de gravar: max 1280px, JPEG 0.7.
// =========================================================================

import { data as fmtData, hojeISO, esc } from "./utils.js";

const DB = "obra_braganca";
const STORE = "registos";
const VER = 1;

// ---------------------------------------------------------------- IndexedDB
function abrirDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "id" });
        s.createIndex("acaoId", "acaoId", { unique: false });
      }
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function operar(modo, fn) {
  return abrirDB().then((db) => new Promise((res, rej) => {
    const tx = db.transaction(STORE, modo);
    const store = tx.objectStore(STORE);
    const pedido = fn(store);
    tx.oncomplete = () => res(pedido && pedido.result);
    tx.onerror = () => rej(tx.error);
  }));
}

function guardar(reg) { return operar("readwrite", (s) => s.put(reg)); }
function eliminarDB(id) { return operar("readwrite", (s) => s.delete(id)); }
function todos() { return operar("readonly", (s) => s.getAll()); }
function porAcao(acaoId) {
  return operar("readonly", (s) => s.index("acaoId").getAll(acaoId));
}

// contagem de registos por acao (para os crachas do Plano)
export async function contagens() {
  const lista = await todos().catch(() => []);
  const m = {};
  for (const r of lista) m[r.acaoId] = (m[r.acaoId] || 0) + 1;
  return m;
}

// ---------------------------------------------------------------- compressao
function carregarImagem(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); rej(e); };
    img.src = url;
  });
}

async function comprimir(file) {
  if (!file.type.startsWith("image/")) return file;
  const img = await carregarImagem(file);
  const max = 1280;
  let { width: w, height: h } = img;
  if (w > max || h > max) {
    if (w >= h) { h = Math.round(h * max / w); w = max; }
    else { w = Math.round(w * max / h); h = max; }
  }
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  cv.getContext("2d").drawImage(img, 0, 0, w, h);
  const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.7));
  return blob || file;
}

// ---------------------------------------------------------------- overlay UI
export async function abrir(acaoId, titulo) {
  const el = document.createElement("div");
  el.className = "visor";
  el.innerHTML = `
    <div class="visor__topo">
      <span class="visor__titulo">Registo — ${esc(titulo || "")}</span>
      <button class="visor__fechar" aria-label="Fechar">✕</button>
    </div>
    <div class="visor__corpo reg">
      <div class="reg__novo">
        <label class="reg__addfoto">📷 Adicionar foto
          <input type="file" accept="image/*" capture="environment" multiple hidden>
        </label>
        <div class="reg__previews"></div>
        <textarea class="reg__nota" rows="2" placeholder="Nota (opcional)"></textarea>
        <button class="reg__guardar" disabled>Guardar registo</button>
      </div>
      <div class="reg__lista"><p class="vazio">A carregar…</p></div>
    </div>`;
  document.body.appendChild(el);
  document.body.style.overflow = "hidden";
  const fechar = () => {
    el.remove(); document.body.style.overflow = "";
    pendentes.forEach((p) => URL.revokeObjectURL(p.url));
  };
  el.querySelector(".visor__fechar").addEventListener("click", fechar);

  const input = el.querySelector("input[type=file]");
  const previews = el.querySelector(".reg__previews");
  const btnGuardar = el.querySelector(".reg__guardar");
  const notaEl = el.querySelector(".reg__nota");
  const lista = el.querySelector(".reg__lista");
  let pendentes = [];   // { blob, url }

  input.addEventListener("change", async () => {
    for (const f of input.files) {
      const blob = await comprimir(f);
      const url = URL.createObjectURL(blob);
      pendentes.push({ blob, url });
    }
    input.value = "";
    desenharPreviews();
  });

  function desenharPreviews() {
    previews.innerHTML = pendentes.map((p, i) =>
      `<span class="reg__prev"><img src="${p.url}"><button data-i="${i}" aria-label="Remover">✕</button></span>`).join("");
    previews.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      const i = +b.dataset.i;
      URL.revokeObjectURL(pendentes[i].url);
      pendentes.splice(i, 1);
      desenharPreviews();
    }));
    btnGuardar.disabled = pendentes.length === 0 && !notaEl.value.trim();
  }
  notaEl.addEventListener("input", () => { btnGuardar.disabled = pendentes.length === 0 && !notaEl.value.trim(); });

  btnGuardar.addEventListener("click", async () => {
    const reg = {
      id: "reg_" + Date.now() + "_" + Math.floor(Math.random() * 1e6),
      acaoId,
      nota: notaEl.value.trim(),
      data: hojeISO(),
      criadoEm: Date.now(),
      fotos: pendentes.map((p) => p.blob),
    };
    await guardar(reg);
    pendentes.forEach((p) => URL.revokeObjectURL(p.url));
    pendentes = []; notaEl.value = "";
    desenharPreviews();
    await carregarLista();
    if (typeof window.__registosMudaram === "function") window.__registosMudaram();
  });

  async function carregarLista() {
    const regs = (await porAcao(acaoId).catch(() => [])).sort((a, b) => b.criadoEm - a.criadoEm);
    if (!regs.length) { lista.innerHTML = `<p class="vazio">Sem registos ainda.</p>`; return; }
    lista.innerHTML = regs.map((r) => `
      <div class="reg__item" data-id="${r.id}">
        <div class="reg__item-cab"><span>${fmtData(r.data)}</span>
          <button class="reg__del" aria-label="Eliminar">Eliminar</button></div>
        ${r.nota ? `<p class="reg__item-nota">${esc(r.nota)}</p>` : ""}
        <div class="reg__fotos">${r.fotos.map((b) => `<img src="${URL.createObjectURL(b)}">`).join("")}</div>
      </div>`).join("");
    lista.querySelectorAll(".reg__del").forEach((b) => b.addEventListener("click", async (ev) => {
      const id = ev.target.closest(".reg__item").dataset.id;
      await eliminarDB(id);
      await carregarLista();
      if (typeof window.__registosMudaram === "function") window.__registosMudaram();
    }));
  }
  carregarLista();
}
