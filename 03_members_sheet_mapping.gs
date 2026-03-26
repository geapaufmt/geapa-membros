/***************************************
 * 03_sheet_mapping.gs
 *
 * Mapeamento entre Membros em Espera e Membros Atuais.
 ***************************************/

/**
 * Retorna mapa de índices de cabeçalhos de uma aba.
 *
 * @param {string[]} headers
 * @return {Object<string, number>}
 */
function members_getHeaderMap_(headers) {
  return members_buildHeaderMap_(headers, { normalize: true, oneBased: false });
}

/**
 * Constrói mapa de cabeçalho com opções de normalização e indexação.
 *
 * @param {string[]} headers
 * @param {{normalize?: boolean, oneBased?: boolean}=} opts
 * @return {Object<string, number>}
 */
function members_buildHeaderMap_(headers, opts) {
  opts = opts || {};
  const normalize = opts.normalize !== false;
  const oneBased = opts.oneBased === true;

  const map = {};
  headers.forEach((h, i) => {
    const raw = String(h || "").trim();
    if (!raw) return;
    const key = normalize ? raw.toLowerCase() : raw;
    map[key] = oneBased ? i + 1 : i;
  });
  return map;
}

/**
 * Copia os dados de uma linha de "Membros em Espera" para uma nova linha
 * em "Membros Atuais", respeitando os cabeçalhos.
 *
 * Regras:
 * - "Nome" na origem vai para "MEMBRO" no destino
 * - cabeçalhos iguais são copiados diretamente
 * - "Status" no destino é forçado para "Ativo"
 * - "Semestre de entrada" no destino recebe o valor calculado
 *
 * @param {Array} sourceRow
 * @param {string[]} sourceHeaders
 * @param {string[]} targetHeaders
 * @param {string} entrySemesterFull
 * @return {Array}
 */
function members_buildCurrentRowFromFutureRow_(sourceRow, sourceHeaders, targetHeaders, entrySemesterFull) {
  const sourceMap = members_getHeaderMap_(sourceHeaders);
  const targetMap = members_getHeaderMap_(targetHeaders);

  const targetRow = new Array(targetHeaders.length).fill("");

  targetHeaders.forEach((targetHeader, targetIndex) => {
    const normalizedTarget = String(targetHeader || "").trim().toLowerCase();

    // Nome -> MEMBRO
    if (normalizedTarget === "membro") {
      const sourceIdx = sourceMap["nome"];
      if (sourceIdx >= 0) targetRow[targetIndex] = sourceRow[sourceIdx];
      return;
    }

    // Status no destino -> Ativo
    if (normalizedTarget === String(SETTINGS.headers.status).trim().toLowerCase()) {
      targetRow[targetIndex] = SETTINGS.values.active;
      return;
    }

    // Semestre de entrada no destino -> valor calculado
    if (normalizedTarget === String(SETTINGS.headers.entrySemester).trim().toLowerCase()) {
      targetRow[targetIndex] = entrySemesterFull || "";
      return;
    }

    // Cargo/função atual no destino -> Membro
    if (normalizedTarget === "cargo/função atual") {
      targetRow[targetIndex] = "Membro";
      return;
    }

    // Demais cabeçalhos iguais
    const sourceIdx = sourceMap[normalizedTarget];
    if (sourceIdx >= 0) {
      targetRow[targetIndex] = sourceRow[sourceIdx];
    }
  });

  return targetRow;
}

/**
 * Verifica se já existe em Membros Atuais alguém com o mesmo RGA.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} rga
 * @return {boolean}
 */
function members_currentHasRga_(sheet, rga) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || !rga) return false;

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim());
  const map = members_getHeaderMap_(headers);
  const rgaIdx = map["rga"];
  if (rgaIdx == null || rgaIdx < 0) return false;

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return values.some(row => String(row[rgaIdx] || "").trim() === String(rga || "").trim());
}
