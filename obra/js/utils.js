// =========================================================================
// utils.js — formatacao (€, números, datas), semanas ISO. Funcoes puras.
// =========================================================================

// Formatacao PT-PT feita a mao para garantir milhares com "." e decimais com ","
// (o Intl pt-PT usa espaco como separador de milhares, que nao e o que queremos).
function fmt(v, casas, milhares) {
  const neg = v < 0;
  let [int, dec] = Math.abs(v).toFixed(casas).split(".");
  if (milhares) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (dec) dec = dec.replace(/0+$/, "");   // tira zeros finais
  return (neg ? "-" : "") + int + (dec ? "," + dec : "");
}

// 1234.56 -> "1.234,56 €"   (null/NaN -> "—")
export function euros(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const neg = v < 0;
  let [int, dec] = Math.abs(v).toFixed(2).split(".");
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (neg ? "-" : "") + int + "," + dec + " €";
}

// numero com ate `casas` casas decimais; null -> "—"
export function numero(v, casas = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return fmt(v, casas, true);
}

// "2026-06-04" -> "04/06/2026"   (null -> "—")
export function data(iso) {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

// numero da semana ISO de uma Date
export function semanaISO(dt) {
  const d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  const diaSemana = (d.getUTCDay() + 6) % 7;      // 0=segunda
  d.setUTCDate(d.getUTCDate() - diaSemana + 3);    // quinta desta semana
  const primeiraQuinta = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const dsPQ = (primeiraQuinta.getUTCDay() + 6) % 7;
  primeiraQuinta.setUTCDate(primeiraQuinta.getUTCDate() - dsPQ + 3);
  return 1 + Math.round((d - primeiraQuinta) / (7 * 864e5));
}

export function semanaAtual() {
  return semanaISO(new Date());
}

// data de hoje em ISO "YYYY-MM-DD"
export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// dias entre hoje e uma data ISO (negativo = já passou)
export function diasAte(iso) {
  if (!iso) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(iso + "T00:00:00");
  return Math.round((alvo - hoje) / 864e5);
}

// percentagem 0..1 -> "14,7%"
export function perc(v, casas = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: casas, maximumFractionDigits: casas,
  }).format(v * 100) + "%";
}

// escapar texto para inserir em HTML
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
