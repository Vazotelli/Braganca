// =========================================================================
// ui.js — componentes de interface partilhados.
// mostrarUndo: snackbar discreto com botao "Anular" (sem modais de confirmacao).
// =========================================================================

let temporizador = null;

export function mostrarUndo(mensagem, aoAnular) {
  let el = document.getElementById("snackbar");
  if (!el) {
    el = document.createElement("div");
    el.id = "snackbar";
    el.className = "snackbar";
    document.body.appendChild(el);
  }
  el.textContent = "";
  const txt = document.createElement("span");
  txt.textContent = mensagem;
  const btn = document.createElement("button");
  btn.className = "snackbar__b";
  btn.textContent = "Anular";
  el.append(txt, btn);
  el.classList.add("is-visivel");

  const fechar = () => el.classList.remove("is-visivel");
  btn.onclick = () => { clearTimeout(temporizador); fechar(); aoAnular(); };
  clearTimeout(temporizador);
  temporizador = setTimeout(fechar, 6000);
}
