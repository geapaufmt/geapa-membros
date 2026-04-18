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
  return members_buildHeaderMapCompat_(headers, opts || {});
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
    const normalizedTarget = members_normalizeOffboardingHeader_(targetHeader);

    // Nome -> MEMBRO
    if (members_findHeaderIndexByAliases_({ [normalizedTarget]: targetIndex }, members_getHeaderAliases_("current", "name")) >= 0) {
      const sourceIdx = members_findHeaderIndexByAliases_(sourceMap, members_getHeaderAliases_("future", "name"));
      if (sourceIdx >= 0) targetRow[targetIndex] = sourceRow[sourceIdx];
      return;
    }

    // Status no destino -> Ativo
    if (members_findHeaderIndexByAliases_({ [normalizedTarget]: targetIndex }, members_getHeaderAliases_("current", "status")) >= 0) {
      targetRow[targetIndex] = SETTINGS.values.active;
      return;
    }

    // Semestre de entrada no destino -> valor calculado
    if (members_findHeaderIndexByAliases_({ [normalizedTarget]: targetIndex }, members_getHeaderAliases_("current", "entrySemester")) >= 0) {
      targetRow[targetIndex] = entrySemesterFull || "";
      return;
    }

    // Cargo/função atual no destino -> Membro
    if (members_findHeaderIndexByAliases_({ [normalizedTarget]: targetIndex }, members_getHeaderAliases_("current", "currentRole")) >= 0) {
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
  if (!rga) return false;

  const records = members_readSheetRecordsCompat_(sheet);
  const target = String(rga || "").trim();

  return records.some(record => String(record["RGA"] || "").trim() === target);
}

function members_getFutureSourceCell_(sourceRow, sourceFormulas, sourceMap, aliasKey) {
  const aliases = members_getHeaderAliases_("future", aliasKey);
  const sourceIdx = members_findHeaderIndexByAliases_(sourceMap, aliases);
  if (sourceIdx < 0) return "";

  const formulaValue = sourceFormulas && sourceFormulas[sourceIdx];
  if (formulaValue != null && String(formulaValue).trim()) return formulaValue;
  return sourceRow[sourceIdx];
}

function members_buildCurrentRowFromFutureRow_(sourceRow, sourceHeaders, targetHeaders, entrySemesterFull, opts) {
  opts = opts || {};
  const sourceMap = members_getHeaderMap_(sourceHeaders);
  const sourceFormulas = Array.isArray(opts.sourceFormulas) ? opts.sourceFormulas : null;
  const integratedAt = opts.integratedAt || "";
  const targetRow = new Array(targetHeaders.length).fill("");

  targetHeaders.forEach((targetHeader, targetIndex) => {
    const normalizedTarget = members_normalizeOffboardingHeader_(targetHeader);

    if (members_findHeaderIndexByAliases_({ [normalizedTarget]: targetIndex }, members_getHeaderAliases_("current", "name")) >= 0) {
      targetRow[targetIndex] = members_getFutureSourceCell_(sourceRow, sourceFormulas, sourceMap, "name");
      return;
    }

    if (members_findHeaderIndexByAliases_({ [normalizedTarget]: targetIndex }, members_getHeaderAliases_("current", "status")) >= 0) {
      targetRow[targetIndex] = SETTINGS.values.active;
      return;
    }

    if (members_findHeaderIndexByAliases_({ [normalizedTarget]: targetIndex }, members_getHeaderAliases_("current", "entrySemester")) >= 0) {
      targetRow[targetIndex] = entrySemesterFull || "";
      return;
    }

    if (members_findHeaderIndexByAliases_({ [normalizedTarget]: targetIndex }, members_getHeaderAliases_("current", "integratedAt")) >= 0) {
      targetRow[targetIndex] = integratedAt || "";
      return;
    }

    if (members_findHeaderIndexByAliases_({ [normalizedTarget]: targetIndex }, members_getHeaderAliases_("current", "currentRole")) >= 0) {
      targetRow[targetIndex] = "Membro";
      return;
    }

    const aliasKeys = Object.keys(MEMBERS_HEADER_ALIASES.current || {});
    for (let i = 0; i < aliasKeys.length; i++) {
      const aliasKey = aliasKeys[i];
      const currentAliases = members_getHeaderAliases_("current", aliasKey);
      if (members_findHeaderIndexByAliases_({ [normalizedTarget]: targetIndex }, currentAliases) >= 0) {
        targetRow[targetIndex] = members_getFutureSourceCell_(sourceRow, sourceFormulas, sourceMap, aliasKey);
        return;
      }
    }

    const sourceIdx = sourceMap[normalizedTarget];
    if (sourceIdx >= 0) {
      const formulaValue = sourceFormulas && sourceFormulas[sourceIdx];
      targetRow[targetIndex] =
        formulaValue != null && String(formulaValue).trim()
          ? formulaValue
          : sourceRow[sourceIdx];
    }
  });

  return targetRow;
}
