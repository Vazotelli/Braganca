// =========================================================================
// plantas.js — ecra Plantas: lista com miniaturas (planta base, projetos de
// especialidade, marcacoes de obra) e visualizador full-screen com pinch-zoom
// e pan (transform CSS + Pointer Events, sem bibliotecas). PDF abre em iframe.
// =========================================================================

import { PLANTAS } from "./plantas_dados.js";
import { esc } from "./utils.js";

const BASE = "plantas/";
let contentorRef = null;

export function render(contentor) {
  contentorRef = contentor;
  const grupos = [
    ["Planta base", PLANTAS.filter((p) => p.tipo === "arquitetura")],
    ["Projetos de especialidade", PLANTAS.filter((p) => p.tipo === "especialidade")],
    ["Marcações de obra", PLANTAS.filter((p) => p.tipo === "marcacao")],
  ];
  contentor.innerHTML = grupos.map(([titulo, itens]) => `
    <h2 class="pl-grupo">${titulo}</h2>
    ${itens.length ? itens.map(cartao).join("")
      : `<p class="vazio">Sem ficheiros nesta secção.</p>`}
  `).join("");

  contentor.querySelectorAll("[data-abrir]").forEach((el) => {
    el.addEventListener("click", () => abrir(el.dataset.abrir));
  });
}

function ePdf(f) { return f.toLowerCase().endsWith(".pdf"); }

function cartao(p) {
  const src = BASE + p.ficheiro;
  const mini = ePdf(p.ficheiro)
    ? `<div class="pl-mini pl-mini--pdf"><svg class="ic" aria-hidden="true"><use href="#i-ficheiro"></use></svg></div>`
    : `<img class="pl-mini" src="${src}" alt="" loading="lazy">`;
  return `
    <button class="pl-item" data-abrir="${p.id}">
      ${mini}
      <span class="pl-info">
        <span class="pl-titulo">${esc(p.titulo)}</span>
        <span class="pl-cont">${esc(p.conteudo || p.especialidade)}</span>
      </span>
      <span class="pl-seta"><svg class="ic ic--sm" aria-hidden="true"><use href="#i-seta"></use></svg></span>
    </button>`;
}

// abre a planta com o id dado (usado tambem pelas chips do Cronograma)
export function abrir(id) {
  const p = PLANTAS.find((x) => x.id === id);
  if (!p) return;
  const src = BASE + p.ficheiro;
  ePdf(p.ficheiro) ? abrirPdf(src, p.titulo) : abrirImagem(src, p.titulo);
}

// ------------------------------------------------------------------ PDF
function abrirPdf(src, titulo) {
  const o = criarOverlay(titulo);
  const frame = document.createElement("iframe");
  frame.className = "visor__pdf";
  frame.src = src;
  o.corpo.appendChild(frame);
}

// ---------------------------------------------------- Imagem (zoom + pan)
function abrirImagem(src, titulo) {
  const o = criarOverlay(titulo);
  const img = document.createElement("img");
  img.className = "visor__img";
  img.src = src;
  img.draggable = false;
  o.corpo.appendChild(img);

  let escala = 1, tx = 0, ty = 0;
  const ponteiros = new Map();
  let iniDist = 0, iniEsc = 1, cx = 0, cy = 0;     // ponto de conteudo fixo no pinch
  let ultimo = null;                                // pan com 1 dedo
  let ultimoToque = 0;

  const aplicar = () => { img.style.transform = `translate(${tx}px,${ty}px) scale(${escala})`; };
  const limite = (v) => Math.max(1, Math.min(6, v));
  const rect = () => o.corpo.getBoundingClientRect();

  img.style.transformOrigin = "0 0";

  o.corpo.addEventListener("pointerdown", (e) => {
    o.corpo.setPointerCapture(e.pointerId);
    ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ponteiros.size === 2) {
      const [a, b] = [...ponteiros.values()];
      iniDist = Math.hypot(a.x - b.x, a.y - b.y);
      iniEsc = escala;
      const r = rect();
      const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
      cx = (mx - tx) / escala; cy = (my - ty) / escala;
    } else {
      ultimo = { x: e.clientX, y: e.clientY };
      const agora = Date.now();
      if (agora - ultimoToque < 300) duploToque(e);
      ultimoToque = agora;
    }
  });

  o.corpo.addEventListener("pointermove", (e) => {
    if (!ponteiros.has(e.pointerId)) return;
    ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ponteiros.size === 2) {
      const [a, b] = [...ponteiros.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      escala = limite(iniEsc * (dist / iniDist));
      const r = rect();
      const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
      tx = mx - cx * escala; ty = my - cy * escala;
      aplicar();
    } else if (ultimo && escala > 1) {
      tx += e.clientX - ultimo.x; ty += e.clientY - ultimo.y;
      ultimo = { x: e.clientX, y: e.clientY };
      aplicar();
    }
  });

  const soltar = (e) => {
    ponteiros.delete(e.pointerId);
    if (ponteiros.size < 2) ultimo = null;
    if (escala <= 1.001) { escala = 1; tx = 0; ty = 0; aplicar(); }
  };
  o.corpo.addEventListener("pointerup", soltar);
  o.corpo.addEventListener("pointercancel", soltar);

  function duploToque(e) {
    const r = rect();
    if (escala > 1) { escala = 1; tx = 0; ty = 0; }
    else {
      escala = 2.5;
      const px = e.clientX - r.left, py = e.clientY - r.top;
      tx = px - (px - tx) * escala; ty = py - (py - ty) * escala;
    }
    aplicar();
  }

  // rato (desktop): roda = zoom
  o.corpo.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = rect(), px = e.clientX - r.left, py = e.clientY - r.top;
    const antes = escala;
    escala = limite(escala * (e.deltaY < 0 ? 1.15 : 0.87));
    const f = escala / antes;
    tx = px - (px - tx) * f; ty = py - (py - ty) * f;
    if (escala <= 1.001) { escala = 1; tx = 0; ty = 0; }
    aplicar();
  }, { passive: false });
}

// ---------------------------------------------------------------- overlay
function criarOverlay(titulo) {
  const el = document.createElement("div");
  el.className = "visor";
  el.innerHTML = `
    <div class="visor__topo">
      <span class="visor__titulo">${esc(titulo)}</span>
      <button class="visor__fechar" aria-label="Fechar">
        <svg class="ic ic--sm" aria-hidden="true"><use href="#i-fechar"></use></svg>
      </button>
    </div>
    <div class="visor__corpo"></div>`;
  document.body.appendChild(el);
  document.body.style.overflow = "hidden";
  const fechar = () => { el.remove(); document.body.style.overflow = ""; };
  el.querySelector(".visor__fechar").addEventListener("click", fechar);
  el.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });
  return { el, corpo: el.querySelector(".visor__corpo"), fechar };
}
