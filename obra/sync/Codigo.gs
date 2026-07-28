/**
 * Apps Script da app "Obra Bragança" — guarda o estado (um documento JSON)
 * numa folha dedicada da tua Google Sheet e devolve-o quando a app pede.
 *
 * COMO INSTALAR (ver passo a passo no README):
 *   ⚠️ Usa uma Sheet NOVA e vazia — NÃO a do tracker de despesas (partirias o
 *      script dele; um projeto só admite um doGet/doPost).
 *   1. Cria uma Google Sheet nova → Extensões → Apps Script.
 *   2. Cola ISTO tudo, Guarda (💾).
 *   3. Implementar (Deploy) → Nova implementação → tipo "App Web".
 *      • Executar como: Eu
 *      • Quem tem acesso: Qualquer pessoa
 *   4. Copia o URL que termina em /exec e cola-o na app (Painel → Sincronização).
 *
 * A app envia o estado por POST e lê-o por GET (JSONP). Guardamos em 2 células
 * de uma folha "OBRA_APP" criada automaticamente. NÃO mexas nessa folha à mão.
 */
var TAB = 'OBRA_APP';
var CEL_JSON = 'A1';   // estado completo em JSON
var CEL_TS   = 'A2';   // marca de tempo (atualizadoEm)

function folha_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB);
  if (!sh) { sh = ss.insertSheet(TAB); sh.hideSheet(); }
  return sh;
}

// LER — devolve {json, ts}. Se vier ?callback=xxx responde em JSONP.
function doGet(e) {
  var cb = (e && e.parameter && e.parameter.callback) || '';
  var sh = folha_();
  var json = sh.getRange(CEL_JSON).getValue() || '';
  var ts = Number(sh.getRange(CEL_TS).getValue() || 0);
  var payload = JSON.stringify({ json: String(json), ts: ts });
  if (cb) {
    return ContentService.createTextOutput(cb + '(' + payload + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

// GRAVAR — recebe {action:'set', estado:{...}} e escreve nas células.
function doPost(e) {
  try {
    var dados = JSON.parse(e.postData.contents);
    if (dados && dados.action === 'set' && dados.estado) {
      var json = JSON.stringify(dados.estado);
      var ts = Number(dados.estado.atualizadoEm || 0);
      var sh = folha_();
      sh.getRange(CEL_JSON).setValue(json);   // limite ~50.000 caracteres/célula
      sh.getRange(CEL_TS).setValue(ts);
    }
  } catch (err) { /* ignora corpo inválido */ }
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
