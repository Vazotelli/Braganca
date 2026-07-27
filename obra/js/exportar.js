// =========================================================================
// exportar.js — gera um .xlsx com as folhas espelhadas, usando SheetJS
// carregado localmente (js/vendor/xlsx.mini.js -> window.XLSX). Sem CDN.
// =========================================================================

import { obter, calcularNegocio, ivaDe } from "./estado.js";

export function exportarExcel() {
  const XLSX = window.XLSX;
  if (!XLSX) { alert("Biblioteca de Excel não carregada."); return; }
  const est = obter();
  const wb = XLSX.utils.book_new();
  const folha = (dados, nome) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dados), nome);

  folha(est.materiais.map((m) => ({
    Capítulo: m.capitulo, Especialidade: m.especialidade, Artigo: m.artigo,
    Qtd: m.qtd, Unidade: m.unidade, "Preço unit.": m.precoUnit,
    "Total s/IVA": m.total, IVA: ivaDe(m),
    "Total c/IVA": (typeof m.total === "number") ? m.total + ivaDe(m) : null,
    Adjudicado: m.adjudicado ? "Sim" : "Não",
    Fornecedor: m.fornecedor, Estado: m.estado, Observações: m.observacoes,
  })), "Obra_Materiais");

  folha(est.medicoes.map((x) => ({
    Capítulo: x.capitulo, Quantidade: x.quantidade, Unidade: x.unidade,
    "Preço unit.": x.precoUnit, Estado: x.estado, Notas: x.notas,
  })), "Obra_Medicoes");

  const pag = [];
  for (const e of est.especialidades) {
    if (!e.marcos.length) { pag.push({ Especialidade: e.nome, "Total contratado": e.totalContratado }); }
    for (const mk of e.marcos) {
      pag.push({
        Especialidade: e.nome, "Total contratado": e.totalContratado,
        Marco: mk.descricao, Valor: mk.valor, "Data prevista": mk.dataPrevista,
        "Data paga": mk.dataPaga, Método: mk.metodo,
      });
    }
  }
  folha(pag, "Obra_Pagamentos");

  folha(est.acoes.map((a) => ({
    Ação: a.descricao, "Data fim": a.dataFim, Concluída: a.feito ? "Sim" : "Não",
  })), "Obra_Plano");

  const c = calcularNegocio();
  folha([
    { Item: "Investimento total", Valor: c.total },
    { Item: "Investimento João", Valor: c.joao },
    { Item: "Investimento Joana", Valor: c.joana },
    { Item: "Preço venda Apartamento E", Valor: est.negocio.precoVendaE },
    { Item: "Preço venda Apartamento D", Valor: est.negocio.precoVendaD },
    { Item: "Impostos", Valor: est.negocio.taxaImpostos },
    { Item: "Vendas pós-impostos", Valor: c.vendas },
    { Item: "Lucro total", Valor: c.lucroTotal },
    { Item: "Lucro João", Valor: c.lucroJoao },
    { Item: "Lucro Joana", Valor: c.lucroJoana },
    { Item: "Retorno total João", Valor: c.totalJoao },
    { Item: "Retorno total Joana", Valor: c.totalJoana },
  ], "Obra_Venda");

  const hoje = new Date();
  const stamp = `${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, "0")}${String(hoje.getDate()).padStart(2, "0")}`;
  XLSX.writeFile(wb, `obra_braganca_${stamp}.xlsx`);
}
