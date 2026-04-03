/***************************************
 * 06_members_core_record_adapters.gs
 *
 * Camada de adaptação progressiva para aproveitar os helpers
 * mais altos do GEAPA-CORE sem quebrar o comportamento atual.
 *
 * Estratégia:
 * - se a versão atual da Library já expõe os helpers novos, usa-os
 * - caso contrário, faz fallback para a leitura manual já compatível
 ***************************************/

function members_coreCanReadRecords_() {
  return !!(GEAPA_CORE && typeof GEAPA_CORE.coreReadRecordsByKey === 'function');
}

function members_coreCanFindFirstRecord_() {
  return !!(GEAPA_CORE && typeof GEAPA_CORE.coreFindFirstRecordByField === 'function');
}

function members_readRecordsByKey_(key, opts) {
  members_assertCore_();
  opts = opts || {};

  if (members_coreCanReadRecords_()) {
    return (GEAPA_CORE.coreReadRecordsByKey(key, opts) || []).map(members_backfillRecordAliases_);
  }

  var sh = members_sheetByKey_(key);
  var headerRow = Number(opts.headerRow || 1);
  var startRow = Number(opts.startRow || (headerRow + 1));
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();

  if (lastRow < startRow || lastCol < 1) return [];

  var headers = sh.getRange(headerRow, 1, 1, lastCol).getValues()[0]
    .map(function(h) { return String(h || '').trim(); });

  var values = sh.getRange(startRow, 1, lastRow - startRow + 1, lastCol).getValues();
  var out = [];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c];
    }
    obj.__rowNumber = startRow + i;
    out.push(members_backfillRecordAliases_(obj));
  }

  return out;
}

function members_findFirstRecordByField_(records, headerName, value, opts) {
  members_assertCore_();
  opts = opts || {};

  if (members_coreCanFindFirstRecord_()) {
    return GEAPA_CORE.coreFindFirstRecordByField(records, headerName, value, opts);
  }

  var normalize = opts.normalize !== false;
  var target = normalize ? String(value || '').trim().toLowerCase() : value;

  for (var i = 0; i < records.length; i++) {
    var candidate = records[i][headerName];
    var current = normalize ? String(candidate || '').trim().toLowerCase() : candidate;
    if (current === target) return records[i];
  }

  return null;
}
