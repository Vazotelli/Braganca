// =========================================================================
// painel.js — ecra inicial: KPIs (total do projeto, materiais, especialidades),
// proximos pagamentos e acoes a terminar. Em 2 segundos ve-se o essencial.
// =========================================================================

import { obter, totaisMateriais, totaisMO, reporSeed } from "./estado.js";
import { euros, perc, data as fmtData, diasAte, esc } from "./utils.js";
import { exportarExcel } from "./exportar.js";
import { limparRegistos } from "./registo.js";
import { obterUrl, definirUrl, sincronizar } from "./sincronizar.js";

export function render(contentor) {
  const mat = totaisMateriais();
  const mo = totaisMO();
  const totalProjeto = mat.estCom + mo.contratado;
  const gastoTotal = mat.gastoCom + mo.pago;
  const pctGasto = totalProjeto ? gastoTotal / totalProjeto : 0;

  contentor.innerHTML = `
    <div class="cartao kpi-total" data-ir="custos">
      <span class="resumo__rot">Total do projeto</span>
      <strong class="kpi-total__val">${euros(totalProjeto)}</strong>
      <div class="barra"><div class="barra__cheio" style="width:${Math.round(pctGasto * 100)}%"></div></div>
      <span class="resumo__sub">Gasto ${euros(gastoTotal)} · <strong>${perc(pctGasto)}</strong></span>
    </div>

    <div class="resumo">
      <div class="resumo__cartao" data-ir="custos">
        <span class="resumo__rot">Materiais</span>
        <strong class="resumo__val">${euros(mat.gastoCom)}</strong>
        <span class="resumo__sub">de ${euros(mat.estCom)} estimado</span>
      </div>
      <div class="resumo__cartao" data-ir="pagamentos">
        <span class="resumo__rot">Especialidades</span>
        <strong class="resumo__val">${euros(mo.pago)}</strong>
        <span class="resumo__sub">de ${euros(mo.contratado)} contratado</span>
      </div>
    </div>

    <h2 class="pl-grupo">Próximos pagamentos</h2>
    ${proximosPagamentos()}

    <h2 class="pl-grupo">Ações a terminar</h2>
    ${acoesTerminar()}

    <h2 class="pl-grupo">Sincronização</h2>
    <div class="cartao sync">
      <label class="sync__lbl" for="sync-url">URL do Web App (Google Sheets)</label>
      <input id="sync-url" class="sync__url" type="url" inputmode="url" autocomplete="off"
             placeholder="https://script.google.com/macros/s/.../exec" value="${esc(obterUrl())}">
      <div class="painel-acoes">
        <button class="btn-sec" data-fn="sincronizar">⟳ Sincronizar agora</button>
      </div>
      <p class="sync__estado" id="sync-estado">${obterUrl()
        ? "Automático: recebe ao abrir, envia ao fechar. Ou toca para sincronizar já."
        : "Cola o URL do teu Web App e toca em Sincronizar."}</p>
    </div>

    <h2 class="pl-grupo">Dados</h2>
    <div class="painel-acoes">
      <button class="btn-sec" data-fn="exportar">⬇ Exportar para Excel</button>
      <button class="btn-sec btn-sec--perigo" data-fn="repor">↺ Repor dados do Excel</button>
    </div>`;

  contentor.querySelectorAll("[data-ir]").forEach((el) => {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => window.__ir?.(el.dataset.ir));
  });

  contentor.querySelector('[data-fn="exportar"]').addEventListener("click", exportarExcel);
  contentor.querySelector('[data-fn="repor"]').addEventListener("click", async () => {
    if (!confirm("Repor todos os dados a partir do Excel?\n\nIsto apaga as tuas alterações e as fotos guardadas. Não é possível anular.")) return;
    reporSeed();
    await limparRegistos();
    location.reload();
  });

  // --- Sincronização ---
  const urlEl = contentor.querySelector("#sync-url");
  const estadoEl = contentor.querySelector("#sync-estado");
  urlEl.addEventListener("change", () => definirUrl(urlEl.value));
  contentor.querySelector('[data-fn="sincronizar"]').addEventListener("click", async (ev) => {
    definirUrl(urlEl.value);
    if (!urlEl.value.trim()) { estadoEl.textContent = "⚠ Falta o URL do Web App."; return; }
    const botao = ev.currentTarget;
    botao.disabled = true; estadoEl.textContent = "A sincronizar…";
    try {
      const r = await sincronizar();
      if (r.estado === "importado") {
        estadoEl.textContent = "↓ Dados atualizados a partir da Sheet.";
        setTimeout(() => window.__ir?.("painel"), 400);
      } else if (r.estado === "enviado") {
        estadoEl.textContent = "↑ Enviado para a Sheet.";
      } else {
        estadoEl.textContent = "✓ Já está tudo igual.";
      }
    } catch (e) {
      estadoEl.textContent = "✗ Não deu para sincronizar (vê o URL / a ligação).";
      console.warn("sync:", e);
    } finally {
      botao.disabled = false;
    }
  });
}

function proximosPagamentos() {
  const lista = [];
  for (const e of obter().especialidades) {
    for (const m of e.marcos) {
      if (!m.dataPaga && m.dataPrevista) {
        lista.push({ nome: e.nome, valor: m.valor, quando: m.dataPrevista, dias: diasAte(m.dataPrevista) });
      }
    }
  }
  lista.sort((a, b) => (a.quando < b.quando ? -1 : 1));
  if (!lista.length) return `<p class="vazio">Sem pagamentos previstos.</p>`;
  return lista.slice(0, 6).map((p) => {
    const urgente = p.dias !== null && p.dias <= 5;
    return `
      <div class="painel-linha ${urgente ? "is-urgente" : ""}" data-ir="pagamentos">
        <div>
          <div class="painel-linha__t">${esc(p.nome)}</div>
          <div class="painel-linha__s">${fmtData(p.quando)}${etiquetaDias(p.dias)}</div>
        </div>
        <strong>${euros(p.valor)}</strong>
      </div>`;
  }).join("");
}

function acoesTerminar() {
  const lista = obter().acoes
    .filter((a) => !a.feito && a.dataFim)
    .map((a) => ({ ...a, dias: diasAte(a.dataFim) }))
    .sort((a, b) => (a.dataFim < b.dataFim ? -1 : 1))
    .filter((a) => a.dias <= 14);            // horizonte de 2 semanas (+ atrasadas)
  if (!lista.length) return `<p class="vazio">Nada a terminar nas próximas 2 semanas.</p>`;
  return lista.slice(0, 8).map((a) => {
    const urgente = a.dias <= 5;
    return `
      <div class="painel-linha ${urgente ? "is-urgente" : ""}" data-ir="cronograma">
        <div>
          <div class="painel-linha__t">${esc(a.descricao) || "(sem descrição)"}</div>
          <div class="painel-linha__s">${fmtData(a.dataFim)}${etiquetaDias(a.dias)}</div>
        </div>
      </div>`;
  }).join("");
}

function etiquetaDias(dias) {
  if (dias === null || dias === undefined) return "";
  if (dias < 0) return ` · <span class="acao-tag acao-tag--vermelho">atrasada ${-dias} d</span>`;
  if (dias === 0) return ` · <span class="acao-tag acao-tag--vermelho">hoje</span>`;
  if (dias <= 5) return ` · <span class="acao-tag acao-tag--vermelho">em ${dias} d</span>`;
  return ` · em ${dias} d`;
}
