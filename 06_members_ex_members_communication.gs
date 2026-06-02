/***************************************
 * 06_members_ex_members_communication.gs
 *
 * Helpers de comunicacao para ex-membros
 * apos desligamento homologado.
 ***************************************/

/**
 * Garante que a aba oficial de ex-membros possua as colunas
 * de comunicacao pos-desligamento e devolve o contexto atualizado.
 *
 * @return {{sheet: GoogleAppsScript.Spreadsheet.Sheet, headers: string[], headerMap: Object<string, number>, ensureResult: Object}}
 */
function ensureExMembrosCommunicationColumns_() {
  members_assertCore_();

  var sheet = members_sheetByKey_(SETTINGS.histKey);
  if (!sheet) {
    throw new Error("Nao foi possivel localizar a aba oficial de Ex-Membros via GEAPA-CORE.");
  }

  var expectedHeaders = members_getExMembersCommunicationExpectedHeaders_();
  var aliasMap = members_buildExMembersCommunicationAliasMap_();
  var ensureResult = typeof members_externalContactsEnsureHeadersInSheet_ === "function"
    ? members_externalContactsEnsureHeadersInSheet_(sheet, expectedHeaders, aliasMap)
    : members_ensureHeadersInSheetFallback_(sheet, expectedHeaders, aliasMap);
  var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0]
    .map(function(header) { return String(header || "").trim(); });

  return {
    sheet: sheet,
    headers: headers,
    headerMap: members_buildHeaderMap_(headers),
    ensureResult: ensureResult
  };
}

/**
 * Normaliza a resposta de consentimento do formulario.
 *
 * @param {*} value
 * @return {string} "SIM" ou "NAO"
 */
function normalizeCommunicationConsent_(value) {
  if (value === true) return SETTINGS.exMembersCommunication.values.yes;
  if (value === false) return SETTINGS.exMembersCommunication.values.no;

  var text = members_normalizeExMembersCompare_(value);
  if (!text) return SETTINGS.exMembersCommunication.values.no;

  if (
    /(^|[^a-z0-9])(nao|nao desejo|nao quero|nao autorizo|parar de receber|nao receber)([^a-z0-9]|$)/.test(text)
  ) {
    return SETTINGS.exMembersCommunication.values.no;
  }

  if (
    /(^|[^a-z0-9])(sim|desejo continuar|quero continuar|autorizo|continuar recebendo|receber comunicacoes)([^a-z0-9]|$)/.test(text)
  ) {
    return SETTINGS.exMembersCommunication.values.yes;
  }

  return SETTINGS.exMembersCommunication.values.no;
}

/**
 * Normaliza a selecao de eixos de interesse do formulario
 * para o formato canonico "I; II; III".
 *
 * @param {*} value
 * @return {string}
 */
function normalizeEixosInteresse_(value) {
  var normalizedText = members_normalizeEixosInteresseInput_(value);
  if (!normalizedText) return "";

  if (/(^|[^a-z0-9])tod(?:o|os|a|as)([^a-z0-9]|$)/.test(normalizedText)) {
    return SETTINGS.exMembersCommunication.axes.map(function(axis) {
      return axis.code;
    }).join("; ");
  }

  var codes = members_matchExMemberAxisCodes_(normalizedText);
  return codes.join("; ");
}

/**
 * Atualiza os campos de comunicacao pos-desligamento
 * na linha oficial do ex-membro.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} exMemberSheet
 * @param {number} rowIndex
 * @param {{recebeComunicacoes: string, statusComunicacao: string, eixosInteresse: string, dataAutorizacao: *, origemAutorizacao: string, dataDescadastramento?: *, obsComunicacao?: string, axisFlags?: Object<string, string>}} data
 * @return {{ok: boolean, rowIndex: number, updatedHeaders: string[]}}
 */
function updateExMemberCommunicationFields_(exMemberSheet, rowIndex, data) {
  var context = ensureExMembrosCommunicationColumns_();
  var sheet = exMemberSheet || context.sheet;
  var headers = context.headers;
  var headerMap = context.headerMap;
  var rowValues = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  var currentRecord = members_buildRecordFromRowValues_(headers, rowValues, rowIndex);
  var writes = [];

  function queue(headerName, value) {
    writes.push({ headerName: headerName, value: value });
  }

  queue(SETTINGS.exMembersCommunication.headers.receivesCommunications, data.recebeComunicacoes);
  queue(SETTINGS.exMembersCommunication.headers.communicationStatus, data.statusComunicacao);
  queue(SETTINGS.exMembersCommunication.headers.axesOfInterest, data.eixosInteresse || "");
  queue(SETTINGS.exMembersCommunication.headers.authorizationAt, data.dataAutorizacao || "");
  queue(SETTINGS.exMembersCommunication.headers.authorizationOrigin, data.origemAutorizacao || "");

  if (data.dataDescadastramento) {
    queue(SETTINGS.exMembersCommunication.headers.unsubscribedAt, data.dataDescadastramento);
  }

  if (data.obsComunicacao) {
    var currentObs = members_getRecordValueByAliases_(
      currentRecord,
      members_getHeaderAliases_("hist", "communicationNotes")
    );
    queue(
      SETTINGS.exMembersCommunication.headers.communicationNotes,
      members_mergeExMemberFreeText_(currentObs, data.obsComunicacao)
    );
  }

  var axisFlags = data.axisFlags || members_buildExMemberCommunicationAxisFlags_(data.eixosInteresse || "");
  Object.keys(axisFlags).forEach(function(headerName) {
    queue(headerName, axisFlags[headerName]);
  });

  writes.forEach(function(write) {
    members_writeCellByHeaderCompat_(sheet, rowIndex, headerMap, write.headerName, write.value, {
      normalize: true,
      oneBased: false
    });
  });

  return {
    ok: true,
    rowIndex: rowIndex,
    updatedHeaders: writes.map(function(write) { return write.headerName; })
  };
}

/**
 * Retorna destinatarios elegiveis vindos exclusivamente
 * da aba oficial de Ex-Membros.
 *
 * @param {{eixos?: string|string[]}=} options
 * @return {Array<{nome: string, rga: string, email: string, eixosInteresse: string, origem: string}>}
 */
function getExMembersCommunicationRecipients_(options) {
  members_assertCore_();
  options = options || {};

  var sheet = members_sheetByKey_(SETTINGS.histKey);
  if (!sheet) {
    throw new Error("Nao foi possivel localizar a aba oficial de Ex-Membros via GEAPA-CORE.");
  }

  var requestedAxes = normalizeEixosInteresse_(options.eixos || "");
  var requestedCodes = requestedAxes
    ? requestedAxes.split(/\s*;\s*/).filter(Boolean)
    : [];

  var seen = Object.create(null);

  return members_readSheetRecordsCompat_(sheet)
    .filter(function(record) {
      return members_isExMemberRecordEligibleForCommunication_(record, requestedCodes);
    })
    .map(function(record) {
      return {
        nome: String(members_getRecordValueByAliases_(record, members_getHeaderAliases_("hist", "name")) || "").trim(),
        rga: String(members_getRecordValueByAliases_(record, members_getHeaderAliases_("hist", "rga")) || "").trim(),
        email: members_normalizeEmail_(
          members_getRecordValueByAliases_(record, members_getHeaderAliases_("hist", "email")) || ""
        ),
        eixosInteresse: String(
          members_getRecordValueByAliases_(record, members_getHeaderAliases_("hist", "axesOfInterest")) || ""
        ).trim(),
        origem: "EX_MEMBROS"
      };
    })
    .filter(function(item) {
      if (!item.email || seen[item.email]) return false;
      seen[item.email] = true;
      return true;
    });
}

/**
 * Extrai e normaliza os campos de comunicacao opcionalmente
 * enviados no payload de desligamento.
 *
 * @param {Object} payload
 * @return {{hasPayload: boolean, recebeComunicacoes: string, statusComunicacao: string, eixosInteresse: string, dataAutorizacao: *, origemAutorizacao: string, axisFlags: Object<string, string>}|null}
 */
function members_buildExMemberCommunicationDataFromPayload_(payload) {
  var extracted = members_extractOffboardingCommunicationPrefs_(payload);
  if (!extracted.hasPayload) return null;

  var consent = normalizeCommunicationConsent_(extracted.rawConsent);
  var normalizedAxes = consent === SETTINGS.exMembersCommunication.values.yes
    ? normalizeEixosInteresse_(extracted.rawAxes)
    : "";

  return {
    hasPayload: true,
    recebeComunicacoes: consent,
    statusComunicacao: consent === SETTINGS.exMembersCommunication.values.yes
      ? SETTINGS.exMembersCommunication.values.active
      : SETTINGS.exMembersCommunication.values.notAuthorized,
    eixosInteresse: normalizedAxes,
    dataAutorizacao: consent === SETTINGS.exMembersCommunication.values.yes ? new Date() : "",
    origemAutorizacao: SETTINGS.exMembersCommunication.values.authorizationOrigin,
    axisFlags: members_buildExMemberCommunicationAxisFlags_(normalizedAxes)
  };
}

/**
 * Localiza um ex-membro ja existente na base oficial
 * usando RGA, email normalizado e nome como ultimo fallback.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} payload
 * @return {{found: boolean, rowNumber?: number, rowValues?: Array<*>, headers?: string[], matchBy?: string, record?: Object}}
 */
function members_findExistingExMemberRowByIdentity_(sheet, payload) {
  var records = members_readSheetRecordsCompat_(sheet);
  if (!records.length) return { found: false };

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function(header) { return String(header || "").trim(); });
  var targetRga = members_normalizeKey_(payload.memberRga);
  var targetEmail = members_normalizeEmail_(payload.memberEmail);
  var targetName = members_normalizeKey_(payload.memberName);

  for (var i = 0; i < records.length; i++) {
    var record = records[i];
    var rowValues = headers.map(function(header) { return record[header]; });
    var rowRga = members_normalizeKey_(
      members_getRecordValueByAliases_(record, members_getHeaderAliases_("hist", "rga"))
    );
    var rowEmail = members_normalizeEmail_(
      members_getRecordValueByAliases_(record, members_getHeaderAliases_("hist", "email"))
    );
    var rowName = members_normalizeKey_(
      members_getRecordValueByAliases_(record, members_getHeaderAliases_("hist", "name"))
    );

    if (targetRga && rowRga && targetRga === rowRga) {
      return { found: true, rowNumber: record.__rowNumber, rowValues: rowValues, headers: headers, matchBy: "RGA", record: record };
    }

    if (targetEmail && rowEmail && targetEmail === rowEmail) {
      return { found: true, rowNumber: record.__rowNumber, rowValues: rowValues, headers: headers, matchBy: "EMAIL", record: record };
    }

    if (targetName && rowName && targetName === rowName) {
      return { found: true, rowNumber: record.__rowNumber, rowValues: rowValues, headers: headers, matchBy: "NOME", record: record };
    }
  }

  return { found: false };
}

/**
 * Mescla a linha historica recem-gerada com uma linha
 * preexistente de Ex-Membros, preservando campos nao vazios
 * e evitando perda de observacoes.
 *
 * @param {Array<*>} existingRowValues
 * @param {Array<*>} nextRowValues
 * @param {string[]} headers
 * @return {Array<*>}
 */
function members_buildMergedHistoryRowForExistingExMember_(existingRowValues, nextRowValues, headers) {
  var merged = nextRowValues.map(function(value, index) {
    return value !== "" ? value : existingRowValues[index];
  });

  var internalNoteIndex = members_findHeaderIndexByAliases_(
    headers,
    members_getHeaderAliases_("hist", "internalNote"),
    { notFoundValue: -1 }
  );

  if (internalNoteIndex >= 0) {
    merged[internalNoteIndex] = members_mergeExMemberFreeText_(
      existingRowValues[internalNoteIndex],
      nextRowValues[internalNoteIndex]
    );
  }

  return merged;
}

/**
 * Monta os headers esperados para comunicacao de ex-membros.
 *
 * @return {string[]}
 */
function members_getExMembersCommunicationExpectedHeaders_() {
  var headers = [
    SETTINGS.exMembersCommunication.headers.receivesCommunications,
    SETTINGS.exMembersCommunication.headers.communicationStatus,
    SETTINGS.exMembersCommunication.headers.axesOfInterest,
    SETTINGS.exMembersCommunication.headers.authorizationAt,
    SETTINGS.exMembersCommunication.headers.authorizationOrigin,
    SETTINGS.exMembersCommunication.headers.unsubscribedAt,
    SETTINGS.exMembersCommunication.headers.communicationNotes
  ];

  SETTINGS.exMembersCommunication.axes.forEach(function(axis) {
    headers.push(axis.column);
  });

  return headers;
}

/**
 * Monta o mapa de aliases aceitos para as colunas
 * de comunicacao de ex-membros.
 *
 * @return {Object<string, string[]>}
 */
function members_buildExMembersCommunicationAliasMap_() {
  var map = {};

  map[SETTINGS.exMembersCommunication.headers.receivesCommunications] =
    members_getHeaderAliases_("hist", "receivesCommunications");
  map[SETTINGS.exMembersCommunication.headers.communicationStatus] =
    members_getHeaderAliases_("hist", "communicationStatus");
  map[SETTINGS.exMembersCommunication.headers.axesOfInterest] =
    members_getHeaderAliases_("hist", "axesOfInterest");
  map[SETTINGS.exMembersCommunication.headers.authorizationAt] =
    members_getHeaderAliases_("hist", "authorizationAt");
  map[SETTINGS.exMembersCommunication.headers.authorizationOrigin] =
    members_getHeaderAliases_("hist", "authorizationOrigin");
  map[SETTINGS.exMembersCommunication.headers.unsubscribedAt] =
    members_getHeaderAliases_("hist", "unsubscribedAt");
  map[SETTINGS.exMembersCommunication.headers.communicationNotes] =
    members_getHeaderAliases_("hist", "communicationNotes");

  SETTINGS.exMembersCommunication.axes.forEach(function(axis) {
    var aliasKey = "interestAxis" + axis.code;
    map[axis.column] = members_getHeaderAliases_("hist", aliasKey);
  });

  return map;
}

/**
 * Faz o fallback local para garantir headers,
 * caso o helper de contatos externos nao esteja disponivel.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string[]} expectedHeaders
 * @param {Object<string, string[]>} aliasMap
 * @return {{sheetName: string, created: boolean, renamed: Array<Object>, appended: string[], finalHeaders: string[]}}
 */
function members_ensureHeadersInSheetFallback_(sheet, expectedHeaders, aliasMap) {
  var skipWrites = typeof members_isOperationalDryRun_ === "function" && members_isOperationalDryRun_();
  var lastCol = sheet.getLastColumn();

  if (lastCol < 1) {
    if (!skipWrites) {
      sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders.slice()]);
    }
    return {
      sheetName: sheet.getName(),
      created: true,
      renamed: [],
      appended: expectedHeaders.slice(),
      finalHeaders: expectedHeaders.slice()
    };
  }

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(header) { return String(header || "").trim(); });
  var renamed = [];
  var appended = [];

  expectedHeaders.forEach(function(canonical) {
    if (headers.indexOf(canonical) >= 0) return;

    var aliases = aliasMap[canonical] || [canonical];
    var aliasIndex = members_findFirstExistingAliasIndex_(headers, aliases);

    if (aliasIndex >= 0) {
      var oldHeader = headers[aliasIndex];
      if (!skipWrites) {
        sheet.getRange(1, aliasIndex + 1).setValue(canonical);
      }
      headers[aliasIndex] = canonical;
      renamed.push({ from: oldHeader, to: canonical });
      return;
    }

    headers.push(canonical);
    appended.push(canonical);
  });

  if (appended.length && !skipWrites) {
    sheet.getRange(1, lastCol + 1, 1, appended.length).setValues([appended]);
  }

  return {
    sheetName: sheet.getName(),
    created: false,
    renamed: renamed,
    appended: appended,
    finalHeaders: headers.slice()
  };
}

/**
 * Procura o primeiro alias existente entre os cabecalhos.
 *
 * @param {string[]} headers
 * @param {string[]} aliases
 * @return {number}
 */
function members_findFirstExistingAliasIndex_(headers, aliases) {
  var normalizedHeaders = (headers || []).map(members_normalizeExMembersCompare_);
  var normalizedAliases = (aliases || []).map(members_normalizeExMembersCompare_);

  for (var i = 0; i < normalizedAliases.length; i++) {
    var idx = normalizedHeaders.indexOf(normalizedAliases[i]);
    if (idx >= 0) return idx;
  }

  return -1;
}

/**
 * Normaliza o input bruto de eixos para comparacao.
 *
 * @param {*} value
 * @return {string}
 */
function members_normalizeEixosInteresseInput_(value) {
  if (Array.isArray(value)) {
    return value.map(function(item) { return String(item || "").trim(); }).join("; ");
  }
  return members_normalizeExMembersCompare_(value);
}

/**
 * Identifica os codigos de eixos citados no texto normalizado.
 *
 * @param {string} normalizedText
 * @return {string[]}
 */
function members_matchExMemberAxisCodes_(normalizedText) {
  var codes = [];

  SETTINGS.exMembersCommunication.axes.forEach(function(axis) {
    if (members_textMatchesExMemberAxis_(normalizedText, axis)) {
      codes.push(axis.code);
    }
  });

  return codes.filter(function(code, index, list) {
    return list.indexOf(code) === index;
  });
}

/**
 * Testa se um texto normalizado corresponde a um eixo.
 *
 * @param {string} normalizedText
 * @param {{code: string, aliases: string[]}} axis
 * @return {boolean}
 */
function members_textMatchesExMemberAxis_(normalizedText, axis) {
  if (!normalizedText) return false;

  for (var i = 0; i < axis.aliases.length; i++) {
    var alias = members_normalizeExMembersCompare_(axis.aliases[i]);
    if (!alias) continue;

    if (alias.length <= 4) {
      var pattern = new RegExp("(^|[^a-z0-9])" + alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)");
      if (pattern.test(normalizedText)) return true;
      continue;
    }

    if (normalizedText.indexOf(alias) >= 0) return true;
  }

  return false;
}

/**
 * Converte os codigos normalizados de eixos em flags por coluna.
 *
 * @param {string} normalizedCodes
 * @return {Object<string, string>}
 */
function members_buildExMemberCommunicationAxisFlags_(normalizedCodes) {
  var flags = {};
  var wanted = String(normalizedCodes || "").trim()
    ? String(normalizedCodes || "").trim().split(/\s*;\s*/).filter(Boolean)
    : [];

  SETTINGS.exMembersCommunication.axes.forEach(function(axis) {
    flags[axis.column] = wanted.indexOf(axis.code) >= 0
      ? SETTINGS.exMembersCommunication.values.yes
      : SETTINGS.exMembersCommunication.values.no;
  });

  return flags;
}

/**
 * Extrai os campos de comunicacao de um payload de desligamento,
 * aceitando formas aninhadas e campos planos para compatibilidade.
 *
 * @param {Object} payload
 * @return {{hasPayload: boolean, rawConsent: *, rawAxes: *}}
 */
function members_extractOffboardingCommunicationPrefs_(payload) {
  payload = payload || {};
  var communicationPrefs = payload.communicationPrefs || {};
  var rawConsent = members_pickFirstDefinedValue_([
    communicationPrefs.recebeComunicacoes,
    communicationPrefs.receiveCommunications,
    communicationPrefs.communicationConsent,
    payload.recebeComunicacoes,
    payload.receiveCommunications,
    payload.communicationConsent,
    payload.continueReceivingCommunications,
    members_getRecordValueByAliases_(payload, SETTINGS.exMembersCommunication.formFields.consent)
  ]);
  var rawAxes = members_pickFirstDefinedValue_([
    communicationPrefs.eixosInteresse,
    communicationPrefs.axesOfInterest,
    communicationPrefs.eixos,
    payload.eixosInteresse,
    payload.axesOfInterest,
    payload.eixos,
    members_getRecordValueByAliases_(payload, SETTINGS.exMembersCommunication.formFields.axes)
  ]);

  return {
    hasPayload: rawConsent != null || rawAxes != null,
    rawConsent: rawConsent,
    rawAxes: rawAxes
  };
}

/**
 * Retorna o primeiro valor definido e nao vazio.
 *
 * @param {Array<*>} values
 * @return {*}
 */
function members_pickFirstDefinedValue_(values) {
  for (var i = 0; i < (values || []).length; i++) {
    var value = values[i];
    if (value == null) continue;
    if (typeof value === "string" && !String(value).trim()) continue;
    return value;
  }
  return null;
}

/**
 * Normaliza texto livre para comparacoes tolerantes.
 *
 * @param {*} value
 * @return {string}
 */
function members_normalizeExMembersCompare_(value) {
  return members_normalizeTextCompat_(value, {
    removeAccents: true,
    collapseWhitespace: true,
    caseMode: "lower"
  });
}

/**
 * Mescla dois textos livres sem duplicar o mesmo bloco.
 *
 * @param {*} currentValue
 * @param {*} incomingValue
 * @return {string}
 */
function members_mergeExMemberFreeText_(currentValue, incomingValue) {
  var current = String(currentValue || "").trim();
  var incoming = String(incomingValue || "").trim();

  if (!current) return incoming;
  if (!incoming) return current;
  if (current === incoming) return current;
  if (current.indexOf(incoming) >= 0) return current;
  return current + "\n" + incoming;
}

/**
 * Monta um record a partir dos headers e valores da linha.
 *
 * @param {string[]} headers
 * @param {Array<*>} rowValues
 * @param {number} rowNumber
 * @return {Object}
 */
function members_buildRecordFromRowValues_(headers, rowValues, rowNumber) {
  var record = {};

  (headers || []).forEach(function(header, index) {
    record[header] = rowValues[index];
  });

  record.__rowNumber = rowNumber;
  return members_backfillRecordAliases_(record);
}

/**
 * Informa se um registro de ex-membro esta apto a receber
 * comunicacoes abertas do GEAPA.
 *
 * @param {Object} record
 * @param {string[]} requestedCodes
 * @return {boolean}
 */
function members_isExMemberRecordEligibleForCommunication_(record, requestedCodes) {
  var email = members_normalizeEmail_(
    members_getRecordValueByAliases_(record, members_getHeaderAliases_("hist", "email")) || ""
  );
  var consent = String(
    members_getRecordValueByAliases_(record, members_getHeaderAliases_("hist", "receivesCommunications")) || ""
  ).trim().toUpperCase();
  var communicationStatus = String(
    members_getRecordValueByAliases_(record, members_getHeaderAliases_("hist", "communicationStatus")) || ""
  ).trim().toUpperCase();
  var statusRegistro = members_normalizeKey_(
    members_getRecordValueByAliases_(record, members_getHeaderAliases_("hist", "status")) || ""
  );
  var allowedRecordStatuses = [
    members_normalizeKey_(SETTINGS.offboarding.histStatus),
    "ATIVO",
    "VALIDO",
    "VIGENTE"
  ];

  if (!email) return false;
  if (consent !== SETTINGS.exMembersCommunication.values.yes) return false;
  if (communicationStatus !== SETTINGS.exMembersCommunication.values.active) return false;
  if (statusRegistro && allowedRecordStatuses.indexOf(statusRegistro) < 0) return false;

  if (!requestedCodes || !requestedCodes.length) return true;
  return members_recordHasAnyRequestedCommunicationAxis_(record, requestedCodes);
}

/**
 * Verifica se o registro tem pelo menos um eixo solicitado.
 *
 * @param {Object} record
 * @param {string[]} requestedCodes
 * @return {boolean}
 */
function members_recordHasAnyRequestedCommunicationAxis_(record, requestedCodes) {
  for (var i = 0; i < SETTINGS.exMembersCommunication.axes.length; i++) {
    var axis = SETTINGS.exMembersCommunication.axes[i];
    if (requestedCodes.indexOf(axis.code) < 0) continue;

    var axisValue = String(members_getRecordValueByAliases_(record, [axis.column]) || "").trim().toUpperCase();
    if (axisValue === SETTINGS.exMembersCommunication.values.yes) return true;
  }

  var normalizedAxes = normalizeEixosInteresse_(
    members_getRecordValueByAliases_(record, members_getHeaderAliases_("hist", "axesOfInterest")) || ""
  );
  if (!normalizedAxes) return false;

  var normalizedCodes = normalizedAxes.split(/\s*;\s*/).filter(Boolean);
  return requestedCodes.some(function(code) {
    return normalizedCodes.indexOf(code) >= 0;
  });
}

/**
 * Funcao manual de teste dos normalizadores e do contrato
 * de comunicacao de ex-membros.
 *
 * @return {Object}
 */
function members_testExMembersCommunicationHelpers() {
  var consentYes = normalizeCommunicationConsent_("Sim, desejo continuar recebendo comunicacoes");
  var consentNo = normalizeCommunicationConsent_("Nao desejo receber");
  var axes = normalizeEixosInteresse_("II; Defesa vegetal (fitossanidade); Agroecologia");
  var flags = members_buildExMemberCommunicationAxisFlags_(axes);
  var merged = members_mergeExMemberFreeText_("Obs antiga", "Obs nova");

  if (consentYes !== SETTINGS.exMembersCommunication.values.yes) {
    throw new Error("Falha ao normalizar consentimento positivo.");
  }
  if (consentNo !== SETTINGS.exMembersCommunication.values.no) {
    throw new Error("Falha ao normalizar consentimento negativo.");
  }
  if (axes !== "II; III; V") {
    throw new Error("Falha ao normalizar eixos de interesse.");
  }
  if (flags.INTERESSE_EIXO_II !== SETTINGS.exMembersCommunication.values.yes) {
    throw new Error("Falha ao marcar eixo II.");
  }
  if (flags.INTERESSE_EIXO_I !== SETTINGS.exMembersCommunication.values.no) {
    throw new Error("Falha ao manter eixo I como NAO.");
  }
  if (merged !== "Obs antiga\nObs nova") {
    throw new Error("Falha ao mesclar observacoes.");
  }

  return {
    ok: true,
    consentYes: consentYes,
    consentNo: consentNo,
    normalizedAxes: axes,
    flags: flags,
    mergedObservation: merged
  };
}
