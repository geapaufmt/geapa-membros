/***************************************
 * 06_members_governance_transition.gs
 *
 * Fluxos complementares da transicao de diretoria:
 * - painel de elegibilidade temporal em MEMBERS_ATUAIS;
 * - processamento de nomeacoes da diretoria via formulario;
 * - convite e adesao de conselheiros via formulario;
 * - sincronizacao de acessos das pastas institucionais;
 * - sincronizacao das opcoes do formulario de nomeacoes.
 ***************************************/

const MEMBERS_GOVERNANCE_FORM_ALIASES = Object.freeze({
  nomination: Object.freeze({
    submittedAt: Object.freeze(["Carimbo de data/hora", "Timestamp"]),
    submitterEmail: Object.freeze(["Endereco de e-mail", "Endere\u00e7o de e-mail", "Email Address"]),
    boardId: Object.freeze(["ID_Diretoria", "ID Diretoria", "ID da Diretoria"]),
    roleName: Object.freeze([
      "Ocupacao",
      "Ocupa\u00e7\u00e3o",
      "Ocupacao pretendida",
      "Ocupa\u00e7\u00e3o pretendida",
      "Cargo/Fun\u00e7\u00e3o",
      "Cargo/Funcao",
      "Cargo/Fun\u00e7ao",
      "Cargo",
      "Funcao",
      "Func\u00e3o"
    ]),
    rga: Object.freeze(["RGA"]),
    memberName: Object.freeze(["Nome do indicado", "Nome do Indicado", "Nome para conferencia", "Nome para confer\u00eancia", "Nome"]),
    stayUntilMandateEnd: Object.freeze([
      "Pretende permanecer at\u00e9 o final do mandato?",
      "Pretende permanecer ate o final do mandato?",
      "Pretende ocupar o cargo at\u00e9 o final do mandato?",
      "Pretende ocupar o cargo ate o final do mandato?",
      "Permanecer at\u00e9 o final do mandato?",
      "Permanecer ate o final do mandato?",
      "Pretende ficar at\u00e9 o final do mandato?",
      "Pretende ficar ate o final do mandato?"
    ]),
    plannedExitDate: Object.freeze([
      "Data prevista de sa\u00edda",
      "Data prevista de saida",
      "Data pretendida de sa\u00edda",
      "Data pretendida de saida",
      "Previs\u00e3o de sa\u00edda",
      "Previsao de saida",
      "Quando pretende sair do cargo?"
    ])
  }),
  councilor: Object.freeze({
    submittedAt: Object.freeze(["Carimbo de data/hora", "Timestamp"]),
    submitterEmail: Object.freeze(["Endereco de e-mail", "Endere\u00e7o de e-mail", "Email Address"]),
    rga: Object.freeze(["RGA"]),
    memberName: Object.freeze(["Nome", "Nome completo", "Nome Completo"]),
    decision: Object.freeze([
      "Aceita aderir como conselheiro(a)?",
      "Aceita aderir como Conselheiro(a)?",
      "Aceita o convite?",
      "Deseja aderir?",
      "Aceite",
      "Aceite ou recusa",
      "Aceite/recusa",
      "Resposta"
    ])
  }),
  formItems: Object.freeze({
    boardId: Object.freeze(["ID_Diretoria", "ID Diretoria", "ID da Diretoria", "Diretoria", "Diretoria alvo"]),
    roleName: Object.freeze([
      "Ocupacao",
      "Ocupa\u00e7\u00e3o",
      "Ocupacao pretendida",
      "Ocupa\u00e7\u00e3o pretendida",
      "Cargo/Fun\u00e7\u00e3o",
      "Cargo/Funcao",
      "Cargo/Fun\u00e7ao",
      "Cargo",
      "Funcao",
      "Func\u00e3o",
      "Cargo ou Funcao",
      "Cargo ou Fun\u00e7\u00e3o"
    ]),
    stayUntilMandateEnd: Object.freeze([
      "Pretende permanecer at\u00e9 o final do mandato?",
      "Pretende permanecer ate o final do mandato?",
      "Pretende ocupar o cargo at\u00e9 o final do mandato?",
      "Pretende ocupar o cargo ate o final do mandato?"
    ]),
    plannedExitDate: Object.freeze([
      "Data prevista de sa\u00edda",
      "Data prevista de saida",
      "Data pretendida de sa\u00edda",
      "Data pretendida de saida"
    ])
  })
});

const MEMBERS_GOVERNANCE_OCCUPATION_ALIASES = Object.freeze([
  "Ocupacao",
  "Ocupa\u00e7\u00e3o",
  "Cargo/Fun\u00e7\u00e3o",
  "Cargo/Funcao",
  "Cargo/Fun\u00e7ao"
]);

/**
 * Retorna a lista oficial de colunas derivadas de governanca em MEMBERS_ATUAIS.
 *
 * @return {string[]}
 */
function members_getGovernanceCurrentHeaderList_() {
  return [
    SETTINGS.governance.currentHeaders.countedDays,
    SETTINGS.governance.currentHeaders.limitDays,
    SETTINGS.governance.currentHeaders.balanceDays,
    SETTINGS.governance.currentHeaders.eligibilityStatus,
    SETTINGS.governance.currentHeaders.estimatedLimitDate
  ];
}

/**
 * Garante que a aba MEMBERS_ATUAIS contenha as colunas oficiais de elegibilidade.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet=} sheet
 * @return {string[]}
 */
function members_ensureGovernanceCurrentHeaders_(sheet) {
  var targetSheet = sheet || members_sheetByKey_(SETTINGS.currentKey);
  if (!targetSheet) return [];

  var headers = targetSheet.getRange(1, 1, 1, Math.max(targetSheet.getLastColumn(), 1)).getValues()[0]
    .map(function(item) { return String(item || "").trim(); });
  var normalized = headers.map(members_normalizeHeaderForUx_);
  var appendAt = headers.length;

  members_getGovernanceCurrentHeaderList_().forEach(function(header) {
    if (normalized.indexOf(members_normalizeHeaderForUx_(header)) >= 0) return;
    appendAt += 1;
    targetSheet.getRange(1, appendAt).setValue(header);
    headers.push(header);
    normalized.push(members_normalizeHeaderForUx_(header));
  });

  return headers;
}

/**
 * Busca um campo do Registry com tolerancia a variacoes de capitalizacao e nomes.
 *
 * @param {Object} item
 * @param {string[]} candidateKeys
 * @return {*}
 */
function members_getGovernanceRegistryField_(item, candidateKeys) {
  var source = item || {};
  var keys = Object.keys(source);
  for (var i = 0; i < (candidateKeys || []).length; i++) {
    var target = members_normalizeGovernanceText_(candidateKeys[i]);
    for (var j = 0; j < keys.length; j++) {
      if (members_normalizeGovernanceText_(keys[j]) === target) {
        return source[keys[j]];
      }
    }
  }
  return "";
}

/**
 * Retorna o cache local das entradas do Registry usadas por governanca.
 *
 * @return {Array<Object>}
 */
function members_getGovernanceRegistryEntries_() {
  members_assertCore_();

  if (members_getGovernanceRegistryEntries_.cache) {
    return members_getGovernanceRegistryEntries_.cache.slice();
  }

  var raw = members_coreHas_("coreGetRegistry")
    ? (GEAPA_CORE.coreGetRegistry() || {})
    : {};

  var entries = Object.keys(raw).map(function(key) {
    var item = raw[key] || {};
    return Object.freeze({
      key: key,
      id: members_getGovernanceRegistryField_(item, ["id", "fileId", "file_id", "resourceId", "resource_id", "ID"]),
      sheet: members_getGovernanceRegistryField_(item, ["sheet", "sheetName", "sheet_name", "tab", "aba"]),
      url: members_getGovernanceRegistryField_(item, ["url", "link", "publicUrl", "public_url", "URL"]),
      type: members_getGovernanceRegistryField_(item, ["type", "kind", "resourceType", "resource_type"]),
      raw: item
    });
  });

  members_getGovernanceRegistryEntries_.cache = entries.slice();
  return entries;
}

/**
 * Localiza uma entrada especifica do Registry.
 *
 * @param {string} key
 * @return {?Object}
 */
function members_getGovernanceRegistryEntry_(key) {
  var target = String(key || "").trim();
  if (!target) return null;

  var entries = members_getGovernanceRegistryEntries_();
  for (var i = 0; i < entries.length; i++) {
    if (String(entries[i].key || "").trim() === target) {
      return entries[i];
    }
  }

  return null;
}

/**
 * Retorna o id cru de uma chave do Registry.
 *
 * @param {string} key
 * @return {string}
 */
function members_getGovernanceRegistryId_(key) {
  var entry = members_getGovernanceRegistryEntry_(key);
  return entry && entry.id ? String(entry.id).trim() : "";
}

/**
 * Retorna a URL crua de uma chave do Registry.
 *
 * @param {string} key
 * @return {string}
 */
function members_getGovernanceRegistryUrl_(key) {
  var entry = members_getGovernanceRegistryEntry_(key);
  return entry && entry.url ? String(entry.url).trim() : "";
}

/**
 * Abre um formulario a partir de uma chave do Registry.
 *
 * @param {string} key
 * @return {?GoogleAppsScript.Forms.Form}
 */
function members_openGovernanceFormByKey_(key) {
  var id = members_getGovernanceRegistryId_(key);
  var url = members_getGovernanceRegistryUrl_(key);

  if (id) {
    try {
      return FormApp.openById(id);
    } catch (err) {
      Logger.log("members_openGovernanceFormByKey_ | openById | " + key + " | " + (err && err.message ? err.message : err));
    }
  }

  if (url && /\/forms\/d\//i.test(url)) {
    try {
      return FormApp.openByUrl(url);
    } catch (err) {
      Logger.log("members_openGovernanceFormByKey_ | openByUrl | " + key + " | " + (err && err.message ? err.message : err));
    }
  }

  Logger.log("members_openGovernanceFormByKey_ | " + key + " | sem id/url utilizavel | " + JSON.stringify({
    id: id,
    url: url
  }));
  return null;
}

/**
 * Abre uma pasta do Drive a partir de uma chave do Registry.
 *
 * @param {string} key
 * @return {?GoogleAppsScript.Drive.Folder}
 */
function members_openGovernanceFolderByKey_(key) {
  var id = members_getGovernanceRegistryId_(key);
  if (!id) return null;

  try {
    return DriveApp.getFolderById(id);
  } catch (err) {
    Logger.log("members_openGovernanceFolderByKey_ | " + key + " | " + (err && err.message ? err.message : err));
    return null;
  }
}

/**
 * Monta a URL publica de uma pasta do Drive.
 *
 * @param {string} key
 * @return {string}
 */
function members_buildGovernanceFolderUrl_(key) {
  var id = members_getGovernanceRegistryId_(key);
  return id ? ("https://drive.google.com/drive/folders/" + id) : "";
}

/**
 * Monta a URL publica do formulario de resposta.
 *
 * @param {string} key
 * @return {string}
 */
function members_buildGovernanceFormUrl_(key) {
  var form = members_openGovernanceFormByKey_(key);
  var registryUrl = String(members_getGovernanceRegistryUrl_(key) || "").trim();
  if (!form) {
    return registryUrl;
  }

  try {
    var publishedUrl = String(form.getPublishedUrl() || "").trim();
    if (publishedUrl) return publishedUrl;
  } catch (err) {
    // Mantem fallback para a URL cadastrada no Registry quando o Forms nao devolve a publicacao.
  }

  return registryUrl;
}

/**
 * Retorna a URL da planilha associada a uma key oficial.
 *
 * @param {string} key
 * @return {string}
 */
function members_buildGovernanceSheetUrl_(key) {
  var sheet = members_sheetByKey_(key);
  if (!sheet) return "";

  try {
    return String(sheet.getParent().getUrl() || "").trim();
  } catch (err) {
    return "";
  }
}

/**
 * Retorna o objeto de propriedades do script usado para idempotencia.
 *
 * @return {GoogleAppsScript.Properties.Properties}
 */
function members_getGovernanceScriptProperties_() {
  return PropertiesService.getScriptProperties();
}

/**
 * Construi uma chave persistente para estados internos de governanca.
 *
 * @param {string} prefix
 * @param {string} token
 * @return {string}
 */
function members_getGovernancePropertyKey_(prefix, token) {
  return String(prefix || "") + String(token || "").trim();
}

/**
 * Retorna um valor numerico persistido em ScriptProperties.
 *
 * @param {string} prefix
 * @param {string} token
 * @return {number}
 */
function members_getGovernanceNumericState_(prefix, token) {
  var key = members_getGovernancePropertyKey_(prefix, token);
  if (!String(token || "").trim()) return 0;
  var value = Number(members_getGovernanceScriptProperties_().getProperty(key) || 0);
  return isNaN(value) ? 0 : value;
}

/**
 * Incrementa um contador persistente de governanca.
 *
 * @param {string} prefix
 * @param {string} token
 * @return {number}
 */
function members_incrementGovernanceNumericState_(prefix, token) {
  if (!String(token || "").trim()) return 0;
  var nextValue = members_getGovernanceNumericState_(prefix, token) + 1;
  members_setGovernanceProcessingState_(prefix, token, String(nextValue));
  return nextValue;
}

/**
 * Verifica se um token ja foi processado anteriormente.
 *
 * @param {string} prefix
 * @param {string} token
 * @return {boolean}
 */
function members_hasGovernanceProcessingState_(prefix, token) {
  var key = members_getGovernancePropertyKey_(prefix, token);
  if (!String(token || "").trim()) return false;
  return !!members_getGovernanceScriptProperties_().getProperty(key);
}

/**
 * Persiste um token processado para garantir idempotencia.
 *
 * @param {string} prefix
 * @param {string} token
 * @param {string=} value
 */
function members_setGovernanceProcessingState_(prefix, token, value) {
  var key = members_getGovernancePropertyKey_(prefix, token);
  if (!String(token || "").trim()) return;
  var guard = members_shouldSkipOperationalSideEffect_(
    MEMBERS_OPERATIONAL_CONTROL.capabilities.sync,
    "members_setGovernanceProcessingState_",
    {
      propertyKey: key
    }
  );
  if (guard.skip) return;
  members_getGovernanceScriptProperties_().setProperty(
    key,
    String(value || new Date().toISOString())
  );
}

/**
 * Remove os registros mais recentes de convite para conselheiros salvos em ScriptProperties.
 *
 * Uso:
 * - sem parametro: apaga os 6 convites mais recentes;
 * - com parametro numerico: apaga a quantidade informada.
 *
 * @param {number=} limit
 * @return {Object}
 */
function members_clearRecentCouncilorInviteStates(limit) {
  var maxItems = Math.max(1, Number(limit || 6) || 6);
  var prefix = String(SETTINGS.governance.properties.councilorInvitePrefix || "");
  var resendPrefix = String(SETTINGS.governance.properties.councilorInviteResendPrefix || "");
  var props = members_getGovernanceScriptProperties_();
  var all = props.getProperties() || {};
  var entries = Object.keys(all).filter(function(key) {
    return key.indexOf(prefix) === 0;
  }).map(function(key) {
    var rawValue = String(all[key] || "").trim();
    var parsed = new Date(rawValue);
    return {
      key: key,
      value: rawValue,
      timestamp: isNaN(parsed.getTime()) ? 0 : parsed.getTime()
    };
  }).sort(function(a, b) {
    if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
    return String(b.value || "").localeCompare(String(a.value || ""));
  });

  var targets = entries.slice(0, maxItems);
  targets.forEach(function(item) {
    props.deleteProperty(item.key);
    if (resendPrefix) {
      var token = String(item.key || "").slice(prefix.length);
      members_incrementGovernanceNumericState_(resendPrefix, token);
    }
  });

  members_logGovernanceEvent_("COUNCILOR_INVITE_STATE_CLEARED", {
    requested: maxItems,
    deleted: targets.length,
    keys: targets.map(function(item) { return item.key; })
  });

  return {
    ok: true,
    requested: maxItems,
    deleted: targets.length,
    keys: targets.map(function(item) { return item.key; })
  };
}

/**
 * Registra logs de governanca no logger padrao do Apps Script.
 *
 * @param {string} eventCode
 * @param {Object=} payload
 */
function members_logGovernanceEvent_(eventCode, payload) {
  var base = "[geapa-membros][governanca][" + String(eventCode || "EVENTO").trim() + "]";
  var serialized = "";

  try {
    serialized = payload ? JSON.stringify(payload) : "";
  } catch (err) {
    serialized = String(payload || "");
  }

  Logger.log(base + (serialized ? (" " + serialized) : ""));
}

/**
 * Extrai o dominio de um e-mail normalizado.
 *
 * @param {string} email
 * @return {string}
 */
function members_getGovernanceEmailDomain_(email) {
  var normalized = members_normalizeEmailCompat_(email);
  var parts = normalized.split("@");
  return parts.length === 2 ? String(parts[1] || "").trim().toLowerCase() : "";
}

/**
 * Indica se um destinatario parece externo ao dominio da conta executora.
 *
 * @param {string} email
 * @return {boolean}
 */
function members_isGovernanceLikelyExternalEmail_(email) {
  var targetDomain = members_getGovernanceEmailDomain_(email);
  if (!targetDomain) return false;

  try {
    var actorEmail = Session.getEffectiveUser && Session.getEffectiveUser()
      ? Session.getEffectiveUser().getEmail()
      : "";
    var actorDomain = members_getGovernanceEmailDomain_(actorEmail);
    return !!actorDomain && actorDomain !== targetDomain;
  } catch (err) {
    return false;
  }
}

/**
 * Resume erros de Drive em linguagem operacional para facilitar diagnostico.
 *
 * @param {string} email
 * @param {*} err
 * @return {Object}
 */
function members_describeGovernanceDriveError_(email, err) {
  var message = err && err.message ? String(err.message) : String(err || "");
  var lower = message.toLowerCase();
  var likelyCause = "";

  if (lower.indexOf("access denied") >= 0 || lower.indexOf("permiss") >= 0) {
    likelyCause = members_isGovernanceLikelyExternalEmail_(email)
      ? "Possivel bloqueio de compartilhamento externo para este e-mail ou falta de permissao do proprietario da pasta/Drive."
      : "Possivel falta de permissao da conta executora para compartilhar ou administrar esta pasta.";
  } else if (lower.indexOf("service error: drive") >= 0) {
    likelyCause = "Falha do servico do Drive ao consultar ou atualizar permissoes da pasta.";
  } else if (lower.indexOf("cannot share") >= 0 || lower.indexOf("sharing") >= 0) {
    likelyCause = "Possivel restricao de compartilhamento configurada na pasta, no Drive compartilhado ou na organizacao.";
  }

  return {
    error: message,
    likelyCause: likelyCause
  };
}

/**
 * Normaliza um texto de comparacao no fluxo de governanca.
 *
 * @param {*} value
 * @return {string}
 */
function members_normalizeGovernanceText_(value) {
  return members_normalizeTextCompat_(value, {
    removeAccents: true,
    collapseWhitespace: true,
    caseMode: "lower"
  });
}

/**
 * L\u00ea a ocupacao de um registro com compatibilidade entre o nome novo e o legado.
 *
 * @param {Object} record
 * @return {string}
 */
function members_getGovernanceOccupationValue_(record) {
  return String(members_getRecordValueByAliases_(record || {}, MEMBERS_GOVERNANCE_OCCUPATION_ALIASES) || "").trim();
}

/**
 * Escreve a ocupacao em todas as colunas compat\u00edveis presentes na linha alvo.
 *
 * @param {Array<*>} row
 * @param {Object} idx
 * @param {string} value
 */
function members_setGovernanceOccupationValue_(row, idx, value) {
  MEMBERS_GOVERNANCE_OCCUPATION_ALIASES.forEach(function(headerName) {
    members_setRowValueIfHeaderExists_(row, idx, headerName, value || "");
  });
}

/**
 * Localiza a coluna de ocupacao em um mapa de cabecalhos com compatibilidade retroativa.
 *
 * @param {Object} idx
 * @return {number}
 */
function members_getGovernanceOccupationHeaderIndex_(idx) {
  return members_findHeaderIndexByAliases_(idx, MEMBERS_GOVERNANCE_OCCUPATION_ALIASES, { notFoundValue: -1 });
}

/**
 * Tenta interpretar textos de data em formatos comuns das planilhas do GEAPA.
 *
 * @param {*} value
 * @return {?Date}
 */
function members_parseGovernanceDateText_(value) {
  var text = String(value || "").trim();
  if (!text) return null;

  var match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (match) {
    var day = Number(match[1]);
    var month = Number(match[2]) - 1;
    var year = Number(match[3]);
    var hour = Number(match[4] || 0);
    var minute = Number(match[5] || 0);
    var second = Number(match[6] || 0);
    var date = new Date(year, month, day, hour, minute, second);
    if (!isNaN(date.getTime())) return date;
  }

  match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (match) {
    var isoDate = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4] || 0),
      Number(match[5] || 0),
      Number(match[6] || 0)
    );
    if (!isNaN(isoDate.getTime())) return isoDate;
  }

  return null;
}

/**
 * Converte um valor em data valida de governanca.
 *
 * @param {*} value
 * @return {?Date}
 */
function members_toGovernanceDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return members_startOfDay_(value);
  }

  var date = members_parseGovernanceDateText_(value) || new Date(value);
  return isNaN(date.getTime()) ? null : members_startOfDay_(date);
}

/**
 * Soma dias inteiros a uma data, preservando a normalizacao no inicio do dia.
 *
 * @param {Date} date
 * @param {number} days
 * @return {?Date}
 */
function members_addGovernanceDays_(date, days) {
  var base = members_toGovernanceDate_(date);
  if (!base) return null;
  var next = new Date(base.getTime());
  next.setDate(next.getDate() + Number(days || 0));
  return members_startOfDay_(next);
}

/**
 * Soma meses de calendario a uma data, preservando a normalizacao no inicio do dia.
 *
 * @param {Date} date
 * @param {number} months
 * @return {?Date}
 */
function members_addGovernanceMonths_(date, months) {
  var base = members_toGovernanceDate_(date);
  if (!base) return null;
  var next = new Date(base.getTime());
  next.setMonth(next.getMonth() + Number(months || 0));
  return members_startOfDay_(next);
}

/**
 * Formata datas em padrao legivel para emails e logs.
 *
 * @param {*} value
 * @return {string}
 */
function members_formatGovernanceDate_(value) {
  var date = members_toGovernanceDate_(value);
  if (!date) return "";

  if (members_coreHas_("coreFormatDate")) {
    return String(GEAPA_CORE.coreFormatDate(date, Session.getScriptTimeZone(), "dd/MM/yyyy") || "");
  }

  return Utilities.formatDate(date, Session.getScriptTimeZone(), "dd/MM/yyyy");
}

/**
 * Converte um timestamp em segmento estavel de chave idempotente.
 *
 * @param {*} value
 * @return {string}
 */
function members_buildGovernanceTimestampKey_(value) {
  var date = value instanceof Date ? value : new Date(value);
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return String(value || "").trim();
  }

  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyyMMddHHmmss");
}

/**
 * Interpreta uma flag institucional SIM/NAO.
 *
 * @param {*} value
 * @return {boolean}
 */
function members_isGovernanceYes_(value) {
  var normalized = members_normalizeGovernanceText_(value);
  return normalized === "sim" || normalized === "s" || normalized === "yes" || normalized === "true";
}

/**
 * Interpreta uma flag institucional NAO.
 *
 * @param {*} value
 * @return {boolean}
 */
function members_isGovernanceNo_(value) {
  var normalized = members_normalizeGovernanceText_(value);
  return normalized === "nao" || normalized === "n" || normalized === "no" || normalized === "false";
}

/**
 * Resolve a previsao final de permanencia declarada no formulario de nomeacao.
 *
 * @param {Object} boardWindow
 * @param {*} institutionalEnd
 * @param {*} stayUntilMandateEndValue
 * @param {*} plannedExitDateValue
 * @return {Object}
 */
function members_resolveGovernanceNominationPlannedEnd_(boardWindow, institutionalEnd, stayUntilMandateEndValue, plannedExitDateValue) {
  var maxAllowedEnd = members_toGovernanceDate_(institutionalEnd);
  var declaredExitDate = members_toGovernanceDate_(plannedExitDateValue);
  var normalizedStayValue = members_normalizeGovernanceText_(stayUntilMandateEndValue);
  var declaredEarlyExit = members_isGovernanceNo_(normalizedStayValue) || (!normalizedStayValue && !!declaredExitDate);
  var result = {
    valid: true,
    declaredEarlyExit: declaredEarlyExit,
    declaredExitDate: declaredExitDate,
    predictedEndDate: maxAllowedEnd,
    appliedDeclaredExit: false,
    note: "",
    rejectionReason: ""
  };

  if (!boardWindow || !maxAllowedEnd || !declaredEarlyExit) {
    return result;
  }

  if (!declaredExitDate) {
    result.valid = false;
    result.rejectionReason = "O formulario indicou saida antes do fim do mandato, mas sem uma data prevista de saida valida.";
    return result;
  }

  if (declaredExitDate.getTime() < boardWindow.start.getTime()) {
    result.valid = false;
    result.rejectionReason = "A data prevista de saida informada no formulario e anterior ao inicio do vinculo na diretoria.";
    return result;
  }

  if (declaredExitDate.getTime() < maxAllowedEnd.getTime()) {
    result.predictedEndDate = declaredExitDate;
    result.appliedDeclaredExit = true;
    result.note = "Nomeacao registrada com saida antecipada informada no formulario.";
    return result;
  }

  if (declaredExitDate.getTime() > maxAllowedEnd.getTime()) {
    result.note = "A data de saida informada no formulario ultrapassa a permanencia maxima permitida pelo sistema, e por isso prevaleceu a data limite institucional.";
    return result;
  }

  result.appliedDeclaredExit = true;
  result.note = "A data de saida informada no formulario coincide com a data maxima ja permitida para o vinculo.";
  return result;
}

/**
 * Divide um campo de variacoes em uma lista canonica.
 *
 * @param {*} value
 * @return {string[]}
 */
function members_splitGovernanceVariants_(value) {
  return String(value || "")
    .split(/\r?\n|;|,|\|/g)
    .map(function(item) { return String(item || "").trim(); })
    .filter(function(item) { return !!item; });
}

/**
 * Constroi uma representacao canonica do catalogo oficial de cargos.
 *
 * @return {Object}
 */
function members_readGovernanceCargoCatalog_() {
  var records = members_readRecordsByKey_(SETTINGS.vigenciaKeys.cargosConfig, {
    skipBlankRows: true
  });

  var entries = records.map(function(record) {
    var namePublic = String(record["NOME_PUBLICO"] || "").trim();
    var cargoKey = String(record["CARGO_KEY"] || "").trim();
    var groupName = String(record["GRUPO_CARGO"] || "").trim();
    var destination = members_resolveGovernanceCargoDestinationRaw_(record);
    var variants = members_splitGovernanceVariants_(record["ESCRITA_VARIACAO"]);
    var compareKeys = [namePublic, cargoKey].concat(variants).map(members_normalizeGovernanceText_).filter(Boolean);

    return Object.freeze({
      raw: record,
      nomePublico: namePublic,
      cargoKey: cargoKey,
      grupoCargo: groupName,
      destinoVigencia: destination,
      ativo: members_isGovernanceYes_(record["ATIVO"]),
      obrigatorioComposicaoInicial: members_isGovernanceYes_(record["OBRIGATORIO_COMPOSICAO_INICIAL"]),
      cargoUnico: members_isGovernanceYes_(record["\u00c9_CARGO_UNICO"] || record["E_CARGO_UNICO"]),
      permitirViaForm: members_isGovernanceYes_(record["PERMITIR_NOMEACAO_VIA_FORM"]),
      contaParaLimite: members_isGovernanceYes_(record["CONTA_PARA_LIMITE_DIRETORIA"]),
      exigirHomologacaoPrevia: members_isGovernanceYes_(record["EXIGIR_HOMOLOGACAO_PREVIA"]),
      recebeEmails: members_isGovernanceYes_(record["RECEBE_EMAILS"]),
      compareKeys: compareKeys,
      displayOrder: Number(record["DISPLAY_ORDEM"] || 0) || 0
    });
  });

  return Object.freeze({
    items: entries,
    byCompareKey: entries.reduce(function(map, item) {
      item.compareKeys.forEach(function(key) {
        if (!map[key]) map[key] = item;
      });
      return map;
    }, {})
  });
}

/**
 * Resolve o destino de vigencia configurado para um cargo, com fallback pelo grupo institucional.
 *
 * @param {Object} record
 * @return {string}
 */
function members_resolveGovernanceCargoDestinationRaw_(record) {
  var explicit = members_normalizeGovernanceText_(
    members_getGovernanceRecordValue_(record, [
      SETTINGS.governance.values.cargoDestinationHeader,
      "DESTINO_VIGENCIA",
      "Destino Vigencia",
      "Destino de Vigencia",
      "Destino de Vigência"
    ])
  );

  if (explicit === members_normalizeGovernanceText_(SETTINGS.governance.values.destinationDiretoria)) {
    return SETTINGS.governance.values.destinationDiretoria;
  }
  if (explicit === members_normalizeGovernanceText_(SETTINGS.governance.values.destinationAssessoria)) {
    return SETTINGS.governance.values.destinationAssessoria;
  }
  if (explicit === members_normalizeGovernanceText_(SETTINGS.governance.values.destinationConselho)) {
    return SETTINGS.governance.values.destinationConselho;
  }

  var groupName = members_normalizeGovernanceText_(record["GRUPO_CARGO"]);
  if (groupName === members_normalizeGovernanceText_(SETTINGS.governance.values.cargoGrupoAssessoria)) {
    return SETTINGS.governance.values.destinationAssessoria;
  }
  if (groupName === members_normalizeGovernanceText_(SETTINGS.governance.values.cargoGrupoConselho)) {
    return SETTINGS.governance.values.destinationConselho;
  }

  return SETTINGS.governance.values.destinationDiretoria;
}

/**
 * Converte um destino de vigencia no respectivo Registry KEY da aba oficial.
 *
 * @param {string} destination
 * @return {string}
 */
function members_getGovernanceDestinationSheetKey_(destination) {
  var normalized = members_normalizeGovernanceText_(destination);
  if (normalized === members_normalizeGovernanceText_(SETTINGS.governance.values.destinationAssessoria)) {
    return SETTINGS.vigenciaKeys.assessores;
  }
  if (normalized === members_normalizeGovernanceText_(SETTINGS.governance.values.destinationConselho)) {
    return SETTINGS.vigenciaKeys.conselheiros;
  }
  return SETTINGS.vigenciaKeys.membrosDiretoria;
}

/**
 * Anota o destino de vigencia em um registro lido das abas oficiais.
 *
 * @param {Object} record
 * @param {string} destination
 * @return {Object}
 */
function members_tagGovernanceRecordDestination_(record, destination) {
  var tagged = {};
  Object.keys(record || {}).forEach(function(key) {
    tagged[key] = record[key];
  });
  tagged.__governanceDestination = destination;
  return tagged;
}

/**
 * Le os vinculos oficiais de governanca a partir de uma lista de destinos.
 *
 * @param {string[]} destinations
 * @return {Array<Object>}
 */
function members_readGovernanceRecordsByDestinations_(destinations) {
  var requested = Array.isArray(destinations) && destinations.length
    ? destinations.slice()
    : [
        SETTINGS.governance.values.destinationDiretoria,
        SETTINGS.governance.values.destinationAssessoria,
        SETTINGS.governance.values.destinationConselho
      ];
  var seen = {};
  var out = [];

  requested.forEach(function(destination) {
    var canonical = members_normalizeGovernanceText_(destination);
    if (!canonical || seen[canonical]) return;
    seen[canonical] = true;

    var key = members_getGovernanceDestinationSheetKey_(destination);
    var records = members_readRecordsByKey_(key, {
      skipBlankRows: true
    });

    records.forEach(function(record) {
      out.push(members_tagGovernanceRecordDestination_(record, destination));
    });
  });

  return out;
}

/**
 * Resolve um cargo do catalogo oficial por nome publico, variacao ou cargo key.
 *
 * @param {Object} catalog
 * @param {*} value
 * @return {?Object}
 */
function members_resolveGovernanceCargoConfig_(catalog, value) {
  var key = members_normalizeGovernanceText_(value);
  if (!catalog || !catalog.byCompareKey || !key) return null;
  return catalog.byCompareKey[key] || null;
}

/**
 * Encontra o cargo institucional de conselheiro consultivo.
 *
 * @param {Object} catalog
 * @return {?Object}
 */
function members_findGovernanceCouncilorCargo_(catalog) {
  return members_resolveGovernanceCargoConfig_(catalog, SETTINGS.governance.values.cargoConselheiroNome) ||
    members_resolveGovernanceCargoConfig_(catalog, "conselheiro consultivo") ||
    null;
}

/**
 * Busca um valor em registros de governanca por uma lista de aliases tolerantes.
 *
 * @param {Object} record
 * @param {string[]} aliases
 * @return {*}
 */
function members_getGovernanceRecordValue_(record, aliases) {
  return members_getRecordValueByAliases_(members_backfillRecordAliases_(record || {}), aliases || []);
}

/**
 * Resolve um identificador estavel de janela de governanca.
 *
 * @param {Object} record
 * @param {string[]} aliases
 * @param {string} fallbackPrefix
 * @param {number} fallbackIndex
 * @return {string}
 */
function members_getGovernanceWindowId_(record, aliases, fallbackPrefix, fallbackIndex) {
  var explicit = String(members_getGovernanceRecordValue_(record, aliases) || "").trim();
  if (explicit) return explicit;
  return String(fallbackPrefix || "WINDOW") + "_" + String(fallbackIndex || 0);
}

/**
 * Retorna as janelas de diretoria cadastradas na planilha oficial.
 *
 * @return {Array<Object>}
 */
function members_readGovernanceBoardWindows_() {
  var records = members_readRecordsByKey_(SETTINGS.vigenciaKeys.diretorias, {
    skipBlankRows: true
  });

  return records
    .map(function(record, index) {
      var id = members_getGovernanceWindowId_(
        record,
        ["ID_Diretoria", "ID Diretoria", "ID da Diretoria", "ID", "DIRETORIA_ID"],
        "DIRETORIA",
        index + 1
      );
      var start = members_toGovernanceDate_(members_getGovernanceRecordValue_(record, [
        "In\u00edcio_Mandato",
        "Inicio_Mandato",
        "Data_In\u00edcio_Mandato",
        "Data_Inicio_Mandato",
        "Inicio",
        "In\u00edcio",
        "Data_In\u00edcio",
        "Data_Inicio",
        "Data Inicio",
        "Inicio Mandato",
        "In\u00edcio Mandato"
      ]));
      var end = members_toGovernanceDate_(members_getGovernanceRecordValue_(record, [
        "Fim_Mandato",
        "Data_Fim_Mandato",
        "Fim",
        "Data_Fim",
        "Data Fim",
        "Final",
        "Data_Final",
        "Data Final",
        "Fim Mandato"
      ]));
      if (!start || !end) return null;
      return Object.freeze({
        id: id,
        start: start,
        end: end
      });
    })
    .filter(Boolean)
    .sort(function(a, b) {
      return a.start.getTime() - b.start.getTime();
    });
}

/**
 * Localiza uma diretoria por id.
 *
 * @param {Array<Object>} boards
 * @param {string} boardId
 * @return {?Object}
 */
function members_findGovernanceBoardById_(boards, boardId) {
  var target = String(boardId || "").trim();
  if (!target) return null;

  for (var i = 0; i < (boards || []).length; i++) {
    if (String(boards[i].id || "").trim() === target) {
      return boards[i];
    }
  }

  return null;
}

/**
 * Retorna a diretoria vigente na data de referencia.
 *
 * @param {Array<Object>} boards
 * @param {Date=} refDate
 * @return {?Object}
 */
function members_getGovernanceActiveBoard_(boards, refDate) {
  var today = members_toGovernanceDate_(refDate || new Date());
  if (!today) return null;

  for (var i = 0; i < (boards || []).length; i++) {
    if (boards[i].start.getTime() <= today.getTime() && boards[i].end.getTime() >= today.getTime()) {
      return boards[i];
    }
  }

  return null;
}

/**
 * Retorna a proxima diretoria prevista para transicao.
 *
 * @param {Array<Object>} boards
 * @param {Date=} refDate
 * @return {?Object}
 */
function members_getGovernanceNextBoard_(boards, refDate) {
  var today = members_toGovernanceDate_(refDate || new Date());
  if (!today) return null;

  for (var i = 0; i < (boards || []).length; i++) {
    if (boards[i].start.getTime() >= today.getTime()) {
      return boards[i];
    }
  }

  return null;
}

/**
 * Resolve a diretoria alvo padrao para nomeacoes e painel.
 *
 * @param {Array<Object>} boards
 * @param {string=} explicitBoardId
 * @return {?Object}
 */
function members_getGovernanceTargetBoard_(boards, explicitBoardId) {
  var explicit = members_findGovernanceBoardById_(boards, explicitBoardId);
  if (explicit) return explicit;

  return members_getGovernanceNextBoard_(boards, new Date()) ||
    members_getGovernanceActiveBoard_(boards, new Date()) ||
    null;
}

/**
 * Define a prioridade de exibicao de uma ocupacao derivada das vigencias.
 *
 * @param {string} destination
 * @return {number}
 */
function members_getGovernanceCurrentOccupationPriority_(destination) {
  var normalized = members_normalizeGovernanceText_(destination);
  if (normalized === members_normalizeGovernanceText_(SETTINGS.governance.values.destinationDiretoria)) return 1;
  if (normalized === members_normalizeGovernanceText_(SETTINGS.governance.values.destinationAssessoria)) return 2;
  if (normalized === members_normalizeGovernanceText_(SETTINGS.governance.values.destinationConselho)) return 3;
  return 9;
}

/**
 * Resolve a ocupacao atual de um membro a partir das abas oficiais de vigencia.
 *
 * A coluna em MEMBERS_ATUAIS e tratada como painel derivado: primeiro sao
 * considerados vinculos ativos em Diretoria, depois Assessoria, depois Conselho.
 * Sem vinculo ativo de governanca, o valor volta para "Membro".
 *
 * @param {string} rga
 * @param {Array<Object>} governanceRecords
 * @param {Object<string, Object>} boardsById
 * @param {*=} referenceDate
 * @return {string}
 */
function members_resolveCurrentOccupationFromGovernance_(rga, governanceRecords, boardsById, referenceDate) {
  var targetRga = members_onlyDigitsCompat_(rga);
  var today = members_toGovernanceDate_(referenceDate || new Date());
  var matches = [];

  if (!targetRga || !today) return "Membro";

  (governanceRecords || []).forEach(function(record) {
    if (members_onlyDigitsCompat_(record["RGA"]) !== targetRga) return;

    var interval = members_getGovernanceEffectiveInterval_(record, boardsById);
    if (!interval) return;
    if (interval.start.getTime() > today.getTime() || interval.end.getTime() < today.getTime()) return;

    var occupation = String(members_getRecordValueByAliases_(record, MEMBERS_GOVERNANCE_OCCUPATION_ALIASES) || "").trim();
    if (!occupation && members_normalizeGovernanceText_(record.__governanceDestination) === members_normalizeGovernanceText_(SETTINGS.governance.values.destinationConselho)) {
      occupation = SETTINGS.governance.values.cargoConselheiroNome;
    }
    if (!occupation) return;

    matches.push({
      occupation: occupation,
      priority: members_getGovernanceCurrentOccupationPriority_(record.__governanceDestination)
    });
  });

  if (!matches.length) return "Membro";

  matches.sort(function(a, b) {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.occupation.localeCompare(b.occupation);
  });

  var bestPriority = matches[0].priority;
  return matches
    .filter(function(item) { return item.priority === bestPriority; })
    .map(function(item) { return item.occupation; })
    .filter(function(value, index, list) { return value && list.indexOf(value) === index; })
    .join(" / ") || "Membro";
}

/**
 * Localiza com seguranca a coluna de ocupacao atual em MEMBERS_ATUAIS.
 *
 * Usa apenas os aliases especificos da ocupacao atual e recusa explicitamente
 * colunas de flag/status para evitar escrita em campos operacionais indevidos.
 *
 * @param {string[]} headers
 * @return {number}
 */
function members_findGovernanceCurrentOccupationColumnIndex_(headers) {
  var allowed = members_getHeaderAliases_("current", "currentRole").map(members_normalizeOffboardingHeader_);
  var forbidden = members_getHeaderAliases_("current", "suspended")
    .concat(members_getHeaderAliases_("current", "status"))
    .map(members_normalizeOffboardingHeader_);

  for (var i = 0; i < (headers || []).length; i++) {
    var normalized = members_normalizeOffboardingHeader_(headers[i]);
    if (forbidden.indexOf(normalized) >= 0) continue;
    if (allowed.indexOf(normalized) >= 0) return i;
  }

  return -1;
}

/**
 * Localiza com seguranca a coluna de flag de suspensao em MEMBERS_ATUAIS.
 *
 * @param {string[]} headers
 * @return {number}
 */
function members_findGovernanceCurrentSuspendedColumnIndex_(headers) {
  var allowed = members_getHeaderAliases_("current", "suspended").map(members_normalizeOffboardingHeader_);

  for (var i = 0; i < (headers || []).length; i++) {
    if (allowed.indexOf(members_normalizeOffboardingHeader_(headers[i])) >= 0) return i;
  }

  return -1;
}

/**
 * Verifica se uma linha de processamento indica suspensao efetivada/homologada.
 *
 * @param {Object} record
 * @return {boolean}
 */
function members_isApprovedSuspensionProcessingRecord_(record) {
  var applied = members_normalizeGovernanceText_(members_getRecordValueByAliases_(record, [
    "SUSPENSAO_APLICADA",
    "SUSPENSÃO_APLICADA",
    "SUSPENSAO EFETIVADA",
    "SUSPENSÃO EFETIVADA"
  ]));
  var decision = members_normalizeGovernanceText_(members_getRecordValueByAliases_(record, [
    "DECISAO_DIRETORIA",
    "DECISÃO_DIRETORIA",
    "DECISAO",
    "DECISÃO"
  ]));
  var status = members_normalizeGovernanceText_(members_getRecordValueByAliases_(record, [
    "STATUS_SOLICITACAO",
    "STATUS_SOLICITAÇÃO",
    "STATUS"
  ]));

  if (members_isGovernanceYes_(applied)) return true;

  return decision === "deferido" ||
    decision === "aprovado" ||
    decision === "homologado" ||
    status === "deferido" ||
    status === "aprovado" ||
    status === "homologado" ||
    status === "aplicado" ||
    status === "aplicada" ||
    status === "processado" ||
    status === "processada";
}

/**
 * Monta o indice de RGAs que ja tiveram suspensao registrada.
 *
 * @return {Object<string, boolean>}
 */
function members_buildSuspendedRgaIndexFromProcessing_() {
  var index = {};

  try {
    members_readRecordsByKey_(SETTINGS.offboarding.suspensionQueueKey, {
      skipBlankRows: true
    }).forEach(function(record) {
      var rga = members_onlyDigitsCompat_(members_getRecordValueByAliases_(record, ["RGA", "RGA_MEMBRO"]));
      if (!rga || !members_isApprovedSuspensionProcessingRecord_(record)) return;
      index[rga] = true;
    });
  } catch (err) {
    members_logGovernanceEvent_("SUSPENSION_FLAG_PROCESSING_READ_ERROR", {
      key: SETTINGS.offboarding.suspensionQueueKey,
      error: err && err.message ? err.message : String(err)
    });
  }

  try {
    members_readRecordsByKey_(SETTINGS.lifecycle.eventKey, {
      skipBlankRows: true
    }).forEach(function(record) {
      var eventType = members_normalizeGovernanceText_(members_getRecordValueByAliases_(record, members_getHeaderAliases_("lifecycleEvent", "eventType")));
      var eventStatus = members_normalizeGovernanceText_(members_getRecordValueByAliases_(record, members_getHeaderAliases_("lifecycleEvent", "eventStatus")));
      var rga = members_onlyDigitsCompat_(members_getRecordValueByAliases_(record, members_getHeaderAliases_("lifecycleEvent", "memberRga")));
      if (!rga || eventType.indexOf("suspensao") < 0) return;
      if (eventStatus !== "homologado" && eventStatus !== "processado" && eventStatus !== "processado_membros") return;
      index[rga] = true;
    });
  } catch (err2) {
    members_logGovernanceEvent_("SUSPENSION_FLAG_EVENTS_READ_ERROR", {
      key: SETTINGS.lifecycle.eventKey,
      error: err2 && err2.message ? err2.message : String(err2)
    });
  }

  return index;
}

/**
 * Retorna as janelas oficiais de semestres da diretoria.
 *
 * @return {Array<Object>}
 */
function members_readGovernanceSemesterWindows_() {
  var records = members_readRecordsByKey_(SETTINGS.vigenciaKeys.semestresDiretoria, {
    skipBlankRows: true
  });

  return records.map(function(record, index) {
    var id = members_getGovernanceWindowId_(
      record,
      ["ID_Janela", "ID_Semestre_Diretoria", "ID_SEMESTRE_DIRETORIA", "ID_Semestre", "ID Semestre", "ID"],
      "SEMESTRE_DIRETORIA",
      index + 1
    );
    var start = members_toGovernanceDate_(members_getGovernanceRecordValue_(record, [
      "Data_In\u00edcio",
      "Data_Inicio",
      "Inicio",
      "In\u00edcio",
      "Data Inicio",
      "Inicio Semestre",
      "In\u00edcio Semestre",
      "Inicio Diretoria",
      "In\u00edcio Diretoria"
    ]));
    var end = members_toGovernanceDate_(members_getGovernanceRecordValue_(record, [
      "Data_Fim",
      "Fim",
      "Data Fim",
      "Data_Final",
      "Data Final",
      "Fim Semestre",
      "Fim Diretoria",
      "Final"
    ]));
    if (!start || !end) return null;
    return Object.freeze({
      id: id,
      start: start,
      end: end
    });
  }).filter(Boolean).sort(function(a, b) {
    return a.start.getTime() - b.start.getTime();
  });
}

/**
 * Encontra a posicao da janela oficial que contem ou sucede a data informada.
 *
 * @param {Array<Object>} windows
 * @param {Date} date
 * @return {number}
 */
function members_findGovernanceSemesterAnchorIndex_(windows, date) {
  var target = members_toGovernanceDate_(date);
  if (!target) return -1;

  for (var i = 0; i < (windows || []).length; i++) {
    if (windows[i].start.getTime() <= target.getTime() && windows[i].end.getTime() >= target.getTime()) {
      return i;
    }
    if (windows[i].start.getTime() > target.getTime()) {
      return i;
    }
  }

  return (windows || []).length ? ((windows || []).length - 1) : -1;
}

/**
 * Seleciona o conjunto de janelas que representa o limite total de permanencia.
 *
 * @param {Array<Object>} windows
 * @param {Date} anchorDate
 * @return {Array<Object>}
 */
function members_getGovernanceLimitWindows_(windows, anchorDate) {
  var anchorIdx = members_findGovernanceSemesterAnchorIndex_(windows, anchorDate);
  if (anchorIdx < 0) return [];

  return (windows || []).slice(anchorIdx, anchorIdx + SETTINGS.governance.limits.maxDiretoriaSemesters);
}

/**
 * Calcula a sobreposicao em dias entre dois intervalos.
 *
 * @param {Date} startA
 * @param {Date} endA
 * @param {Date} startB
 * @param {Date} endB
 * @return {number}
 */
function members_getGovernanceOverlapDays_(startA, endA, startB, endB) {
  var start = Math.max(members_toGovernanceDate_(startA).getTime(), members_toGovernanceDate_(startB).getTime());
  var end = Math.min(members_toGovernanceDate_(endA).getTime(), members_toGovernanceDate_(endB).getTime());
  if (end < start) return 0;
  return Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Resolve o intervalo efetivo de um vinculo de governanca.
 *
 * @param {Object} record
 * @param {Object<string, Object>} boardsById
 * @return {?Object}
 */
function members_getGovernanceEffectiveInterval_(record, boardsById) {
  var start = members_toGovernanceDate_(record["Data_In\u00edcio"]);
  var directEnd = members_toGovernanceDate_(record["Data_Fim"]);
  var predictedEnd = members_toGovernanceDate_(record["Data_Fim_previsto"]);
  var boardId = String(record["ID_Diretoria"] || "").trim();
  var board = boardId && boardsById[boardId] ? boardsById[boardId] : null;
  var boardEnd = board ? members_toGovernanceDate_(board.end) : null;
  var end = directEnd || predictedEnd || boardEnd;

  if (!start || !end || end.getTime() < start.getTime()) return null;

  return Object.freeze({
    start: start,
    end: end,
    boardId: boardId
  });
}

/**
 * Recorta um intervalo de diretoria ate uma data de referencia, sem contar dias futuros.
 *
 * @param {?Object} interval
 * @param {*=} referenceDate
 * @return {?Object}
 */
function members_clipGovernanceIntervalToReferenceDate_(interval, referenceDate) {
  if (!interval) return null;
  var cutoff = members_toGovernanceDate_(referenceDate);
  if (!cutoff) return interval;
  if (interval.start.getTime() > cutoff.getTime()) return null;

  var clippedEnd = interval.end.getTime() > cutoff.getTime()
    ? cutoff
    : interval.end;
  if (clippedEnd.getTime() < interval.start.getTime()) return null;

  return Object.freeze({
    start: interval.start,
    end: clippedEnd,
    boardId: interval.boardId
  });
}

/**
 * Soma os dias historicos que contam para o limite de diretoria.
 *
 * @param {string} rga
 * @param {Array<Object>} governanceRecords
 * @param {Object} cargoCatalog
 * @param {Object<string, Object>} boardsById
 * @param {Array<Object>} semesterWindows
 * @param {Object=} opts
 * @return {number}
 */
function members_calculateGovernanceConsumedDays_(rga, governanceRecords, cargoCatalog, boardsById, semesterWindows, opts) {
  var targetRga = members_onlyDigitsCompat_(rga);
  if (!targetRga) return 0;
  opts = opts || {};

  return (governanceRecords || []).reduce(function(total, record) {
    if (members_onlyDigitsCompat_(record["RGA"]) !== targetRga) return total;

    var cargo = members_resolveGovernanceCargoConfig_(cargoCatalog, members_getGovernanceOccupationValue_(record));
    if (!cargo || !cargo.contaParaLimite) return total;

    var interval = members_getGovernanceEffectiveInterval_(record, boardsById);
    interval = members_clipGovernanceIntervalToReferenceDate_(interval, opts.consumptionReferenceDate);
    if (!interval) return total;

    var consumed = 0;
    (semesterWindows || []).forEach(function(window) {
      consumed += members_getGovernanceOverlapDays_(interval.start, interval.end, window.start, window.end);
    });

    return total + consumed;
  }, 0);
}

/**
 * Estima a data limite de permanencia para uma nova nomeacao.
 *
 * @param {Object} boardWindow
 * @param {number} remainingDays
 * @param {Array<Object>} semesterWindows
 * @return {?Date}
 */
function members_estimateGovernanceLimitDate_(boardWindow, remainingDays, semesterWindows) {
  if (!boardWindow || !boardWindow.start || !boardWindow.end) return null;
  if (Number(remainingDays || 0) <= 0) return null;

  var windows = (semesterWindows || []).filter(function(window) {
    return members_getGovernanceOverlapDays_(boardWindow.start, boardWindow.end, window.start, window.end) > 0;
  });

  if (!windows.length) {
    return members_addGovernanceDays_(boardWindow.start, remainingDays - 1);
  }

  var remaining = Number(remainingDays || 0);
  for (var i = 0; i < windows.length; i++) {
    var overlapStart = new Date(Math.max(boardWindow.start.getTime(), windows[i].start.getTime()));
    var overlapEnd = new Date(Math.min(boardWindow.end.getTime(), windows[i].end.getTime()));
    var overlapDays = members_getGovernanceOverlapDays_(overlapStart, overlapEnd, overlapStart, overlapEnd);
    if (overlapDays <= 0) continue;

    if (remaining <= overlapDays) {
      return members_addGovernanceDays_(overlapStart, remaining - 1);
    }

    remaining -= overlapDays;
  }

  return members_toGovernanceDate_(boardWindow.end);
}

/**
 * Avalia a elegibilidade temporal para a diretoria alvo informada.
 *
 * @param {string} rga
 * @param {Object} boardWindow
 * @param {Array<Object>} boardMembers
 * @param {Object} cargoCatalog
 * @param {Object<string, Object>} boardsById
 * @param {Array<Object>} semesterWindows
 * @param {Object=} opts
 * @return {Object}
 */
function members_evaluateGovernanceEligibility_(rga, boardWindow, boardMembers, cargoCatalog, boardsById, semesterWindows, opts) {
  opts = opts || {};
  var limitWindows = members_getGovernanceLimitWindows_(semesterWindows, boardWindow ? boardWindow.start : new Date());
  var limitDays = limitWindows.reduce(function(total, window) {
    return total + members_getInclusiveDaysBetween_(window.start, window.end);
  }, 0);
  var countedDays = members_calculateGovernanceConsumedDays_(
    rga,
    boardMembers,
    cargoCatalog,
    boardsById,
    semesterWindows,
    { consumptionReferenceDate: opts.consumptionReferenceDate }
  );
  var balanceDays = Math.max(0, limitDays - countedDays);
  var boardDays = boardWindow ? members_getInclusiveDaysBetween_(boardWindow.start, boardWindow.end) : 0;
  var estimatedLimitDate = members_estimateGovernanceLimitDate_(boardWindow, balanceDays, semesterWindows);
  var status = SETTINGS.governance.states.inelegivel;

  if (balanceDays <= 0) {
    status = SETTINGS.governance.states.inelegivel;
  } else if (boardDays > 0 && balanceDays < boardDays) {
    status = SETTINGS.governance.states.aptoComLimite;
  } else if (roleItemsAnyType.length) {
    warnings.push("Item de cargo/função encontrado, mas o tipo nao aceita sincronizacao de opcoes: " + members_describeGovernanceFormItemsInline_(roleItemsAnyType));
  } else {
    status = SETTINGS.governance.states.apto;
  }

  return Object.freeze({
    countedDays: countedDays,
    limitDays: limitDays,
    balanceDays: balanceDays,
    status: status,
    estimatedLimitDate: estimatedLimitDate
  });
}

/**
 * Reafirma a implementacao oficial da elegibilidade temporal sem depender do fluxo de formulario.
 *
 * @param {string} rga
 * @param {Object} boardWindow
 * @param {Array<Object>} boardMembers
 * @param {Object} cargoCatalog
 * @param {Object<string, Object>} boardsById
 * @param {Array<Object>} semesterWindows
 * @param {Object=} opts
 * @return {Object}
 */
function members_evaluateGovernanceEligibility_(rga, boardWindow, boardMembers, cargoCatalog, boardsById, semesterWindows, opts) {
  opts = opts || {};
  var limitWindows = members_getGovernanceLimitWindows_(semesterWindows, boardWindow ? boardWindow.start : new Date());
  var limitDays = limitWindows.reduce(function(total, window) {
    return total + members_getInclusiveDaysBetween_(window.start, window.end);
  }, 0);
  var countedDays = members_calculateGovernanceConsumedDays_(
    rga,
    boardMembers,
    cargoCatalog,
    boardsById,
    semesterWindows,
    { consumptionReferenceDate: opts.consumptionReferenceDate }
  );
  var balanceDays = Math.max(0, limitDays - countedDays);
  var boardDays = boardWindow ? members_getInclusiveDaysBetween_(boardWindow.start, boardWindow.end) : 0;
  var estimatedLimitDate = members_estimateGovernanceLimitDate_(boardWindow, balanceDays, semesterWindows);
  var status = SETTINGS.governance.states.inelegivel;

  if (balanceDays <= 0) {
    status = SETTINGS.governance.states.inelegivel;
  } else if (boardDays > 0 && balanceDays < boardDays) {
    status = SETTINGS.governance.states.aptoComLimite;
  } else {
    status = SETTINGS.governance.states.apto;
  }

  return Object.freeze({
    countedDays: countedDays,
    limitDays: limitDays,
    balanceDays: balanceDays,
    status: status,
    estimatedLimitDate: estimatedLimitDate
  });
}

/**
 * Indexa as janelas de diretoria por id para consultas de intervalo.
 *
 * @param {Array<Object>} boards
 * @return {Object<string, Object>}
 */
function members_indexGovernanceBoardsById_(boards) {
  return (boards || []).reduce(function(map, board) {
    map[String(board.id || "").trim()] = board;
    return map;
  }, {});
}

/**
 * Recalcula o painel de elegibilidade temporal em MEMBERS_ATUAIS.
 *
 * @return {Object}
 */
function members_refreshGovernanceEligibilityPanel(eventOrOpts) {
  return members_runOperationalFlow_(
    MEMBERS_OPERATIONAL_CONTROL.flows.governance,
    MEMBERS_OPERATIONAL_CONTROL.capabilities.sync,
    {
      eventOrOpts: eventOrOpts,
      executionTypeFallback: MEMBERS_OPERATIONAL_CONTROL.capabilities.trigger
    },
    function() {
      return members_refreshGovernanceEligibilityPanel_impl_();
    }
  );
}

/**
 * Implementacao interna do recalculo do painel de elegibilidade em MEMBERS_ATUAIS.
 *
 * @return {Object}
 */
function members_refreshGovernanceEligibilityPanel_impl_() {
  members_assertCore_();

  var currentSheet = members_sheetByKey_(SETTINGS.currentKey);
  if (!currentSheet || currentSheet.getLastRow() < 2) {
    return { ok: true, scanned: 0, updated: 0 };
  }

  members_ensureGovernanceCurrentHeaders_(currentSheet);

  var boards = members_readGovernanceBoardWindows_();
  var targetBoard = members_getGovernanceTargetBoard_(boards);
  var boardsById = members_indexGovernanceBoardsById_(boards);
  var semesterWindows = members_readGovernanceSemesterWindows_();
  var cargoCatalog = members_readGovernanceCargoCatalog_();
  var governanceRecords = members_readGovernanceRecordsByDestinations_();
  var headers = currentSheet.getRange(1, 1, 1, currentSheet.getLastColumn()).getValues()[0].map(function(item) {
    return String(item || "").trim();
  });
  var map = members_getHeaderMap_(headers);
  var currentOccupationCol = members_findGovernanceCurrentOccupationColumnIndex_(headers);
  var currentSuspendedCol = members_findGovernanceCurrentSuspendedColumnIndex_(headers);
  var suspendedRgaIndex = currentSuspendedCol >= 0
    ? members_buildSuspendedRgaIndexFromProcessing_()
    : {};
  var records = members_readSheetRecordsCompat_(currentSheet);
  var updated = 0;
  var skipWrites = members_isOperationalDryRun_();

  records.forEach(function(record) {
    var rowNumber = Number(record.__rowNumber || 0) || 0;
    var rga = String(members_getCurrentField_(record, "rga") || "").trim();
    if (!rowNumber || !rga) return;

    var panel = members_evaluateGovernanceEligibility_(rga, targetBoard, governanceRecords, cargoCatalog, boardsById, semesterWindows, {
      consumptionReferenceDate: new Date()
    });
    var currentOccupation = members_resolveCurrentOccupationFromGovernance_(rga, governanceRecords, boardsById, new Date());

    if (currentOccupationCol >= 0 && !skipWrites) {
      currentSheet.getRange(rowNumber, currentOccupationCol + 1).setValue(currentOccupation);
    }

    if (currentSuspendedCol >= 0 && !skipWrites) {
      currentSheet.getRange(rowNumber, currentSuspendedCol + 1)
        .setValue(suspendedRgaIndex[members_onlyDigitsCompat_(rga)] ? SETTINGS.offboarding.yes : SETTINGS.governance.values.no);
    }

    var writes = [
      { aliases: members_getHeaderAliases_("current", "diretoriaLimitCountedDays"), value: panel.countedDays },
      { aliases: members_getHeaderAliases_("current", "diretoriaLimitDays"), value: panel.limitDays },
      { aliases: members_getHeaderAliases_("current", "diretoriaLimitBalanceDays"), value: panel.balanceDays },
      { aliases: members_getHeaderAliases_("current", "diretoriaEligibilityStatus"), value: panel.status },
      { aliases: members_getHeaderAliases_("current", "diretoriaEstimatedLimitDate"), value: panel.estimatedLimitDate || "" }
    ];

    writes.forEach(function(write) {
      var idx = members_findHeaderIndexByAliases_(map, write.aliases, { notFoundValue: -1 });
      if (idx < 0 || skipWrites) return;
      currentSheet.getRange(rowNumber, idx + 1).setValue(write.value);
    });

    if (!skipWrites) {
      updated += 1;
    }
  });

  try {
    if (!skipWrites) {
    members_applyCurrentSheetUx_();
    }
  } catch (err) {}

  if (!boards.length || !semesterWindows.length) {
    members_logGovernanceEvent_("ELIGIBILITY_PANEL_REFERENCES", {
      boardsLoaded: boards.length,
      semesterWindowsLoaded: semesterWindows.length,
      boardId: targetBoard ? targetBoard.id : ""
    });
  }

  return {
    ok: true,
    scanned: records.length,
    updated: updated,
    dryRun: skipWrites,
    boardId: targetBoard ? targetBoard.id : "",
    boardsLoaded: boards.length,
    semesterWindowsLoaded: semesterWindows.length
  };
}

/**
 * Busca um valor de formulario por uma lista de aliases.
 *
 * @param {Object} record
 * @param {string[]} aliases
 * @return {*}
 */
function members_getGovernanceFormValue_(record, aliases) {
  return members_getRecordValueByAliases_(record || {}, aliases || []);
}

/**
 * Cria uma chave idempotente para respostas de nomeacao.
 *
 * @param {Object} record
 * @return {string}
 */
function members_buildGovernanceNominationResponseKey_(record) {
  var submittedAt = members_getGovernanceFormValue_(record, MEMBERS_GOVERNANCE_FORM_ALIASES.nomination.submittedAt);
  var boardId = members_getGovernanceFormValue_(record, MEMBERS_GOVERNANCE_FORM_ALIASES.nomination.boardId);
  var roleName = members_getGovernanceFormValue_(record, MEMBERS_GOVERNANCE_FORM_ALIASES.nomination.roleName);
  var rga = members_getGovernanceFormValue_(record, MEMBERS_GOVERNANCE_FORM_ALIASES.nomination.rga);

  return [
    members_buildGovernanceTimestampKey_(submittedAt),
    String(boardId || "").trim(),
    members_normalizeGovernanceText_(roleName),
    members_onlyDigitsCompat_(rga)
  ].join("|");
}

/**
 * Busca um membro atual por RGA normalizado.
 *
 * @param {string} rga
 * @param {Object<string, Object>} membersByRga
 * @return {?Object}
 */
function members_findGovernanceCurrentMemberByRga_(rga, membersByRga) {
  return membersByRga[members_onlyDigitsCompat_(rga)] || null;
}

/**
 * Indexa os membros atuais por RGA.
 *
 * @return {Object<string, Object>}
 */
function members_indexGovernanceCurrentMembersByRga_() {
  var currentSheet = members_sheetByKey_(SETTINGS.currentKey);
  var out = {};

  members_readSheetRecordsCompat_(currentSheet).forEach(function(record) {
    var rga = members_onlyDigitsCompat_(members_getCurrentField_(record, "rga"));
    if (!rga) return;
    out[rga] = record;
  });

  return out;
}

/**
 * Define a data de referencia para verificar ocupacao de cargos da diretoria alvo.
 *
 * @param {?Object} boardWindow
 * @param {*=} referenceDate
 * @return {?Date}
 */
function members_getGovernanceOccupancyReferenceDate_(boardWindow, referenceDate) {
  var explicit = members_toGovernanceDate_(referenceDate);
  if (explicit) return explicit;
  if (!boardWindow) return members_toGovernanceDate_(new Date());

  var today = members_toGovernanceDate_(new Date());
  if (!today) return members_toGovernanceDate_(boardWindow.start);

  if (today.getTime() < boardWindow.start.getTime()) return members_toGovernanceDate_(boardWindow.start);
  if (today.getTime() > boardWindow.end.getTime()) return members_toGovernanceDate_(boardWindow.end);
  return today;
}

/**
 * Verifica se o cargo unico ja esta ocupado na diretoria alvo.
 *
 * @param {string} boardId
 * @param {Object} cargo
 * @param {Array<Object>} boardMembers
 * @param {Object<string, Object>} boardsById
 * @param {*=} referenceDate
 * @return {boolean}
 */
function members_isGovernanceCargoOccupied_(boardId, cargo, boardMembers, boardsById, referenceDate) {
  if (!cargo || !cargo.cargoUnico) return false;
  var targetBoard = boardId && boardsById[boardId] ? boardsById[boardId] : null;
  if (!targetBoard) return false;
  var occupancyDate = members_getGovernanceOccupancyReferenceDate_(targetBoard, referenceDate);
  if (!occupancyDate) return false;

  return (boardMembers || []).some(function(record) {
    var recordBoardId = String(record["ID_Diretoria"] || "").trim();
    if (recordBoardId !== String(boardId || "").trim()) return false;
    if (record.__governanceDestination && cargo.destinoVigencia) {
      if (members_normalizeGovernanceText_(record.__governanceDestination) !== members_normalizeGovernanceText_(cargo.destinoVigencia)) {
        return false;
      }
    }

    var resolvedCargo = members_resolveGovernanceCargoConfig_(members_readGovernanceCargoCatalog_(), members_getGovernanceOccupationValue_(record));
    if (!resolvedCargo) {
      return members_normalizeGovernanceText_(members_getGovernanceOccupationValue_(record)) === members_normalizeGovernanceText_(cargo.nomePublico);
    }

    if (members_normalizeGovernanceText_(resolvedCargo.nomePublico) !== members_normalizeGovernanceText_(cargo.nomePublico)) {
      return false;
    }

    var interval = members_getGovernanceEffectiveInterval_(record, boardsById);
    if (!interval) return false;

    return interval.start.getTime() <= occupancyDate.getTime() &&
      interval.end.getTime() >= occupancyDate.getTime();
  });
}

/**
 * Busca um vinculo equivalente ja gravado nas abas oficiais de governanca.
 *
 * @param {Object} params
 * @param {Array<Object>} governanceRecords
 * @return {?Object}
 */
function members_findExistingGovernanceBoardMember_(params, governanceRecords) {
  var targetBoardId = String(params.boardId || "").trim();
  var targetCargo = members_normalizeGovernanceText_(params.roleName);
  var targetRga = members_onlyDigitsCompat_(params.rga);
  var targetStart = members_toGovernanceDate_(params.startDate);
  var targetDestination = members_normalizeGovernanceText_(params.destination);

  for (var i = 0; i < (governanceRecords || []).length; i++) {
    var record = governanceRecords[i] || {};
    var sameBoard = String(record["ID_Diretoria"] || "").trim() === targetBoardId;
    var sameCargo = members_normalizeGovernanceText_(members_getGovernanceOccupationValue_(record)) === targetCargo;
    var sameRga = members_onlyDigitsCompat_(record["RGA"]) === targetRga;
    var recordStart = members_toGovernanceDate_(record["Data_In\u00edcio"]);
    var sameStart = (!targetStart && !recordStart) || (targetStart && recordStart && targetStart.getTime() === recordStart.getTime());
    var sameDestination = !targetDestination ||
      !record.__governanceDestination ||
      members_normalizeGovernanceText_(record.__governanceDestination) === targetDestination;

    if (sameBoard && sameCargo && sameRga && sameStart && sameDestination) {
      return record;
    }
  }

  return null;
}

/**
 * Monta a linha oficial de um vinculo em uma das abas oficiais de governanca.
 *
 * @param {string[]} headers
 * @param {Object} payload
 * @return {Array<*>}
 */
function members_buildGovernanceOfficialRow_(headers, payload) {
  var row = new Array((headers || []).length).fill("");
  var idx = members_getGenericHeaderMap_(headers);

  members_setRowValueIfHeaderExists_(row, idx, "Nome", payload.name || "");
  members_setRowValueIfHeaderExists_(row, idx, "Membro", payload.name || "");
  members_setRowValueIfHeaderExists_(row, idx, "RGA", payload.rga || "");
  members_setRowValueIfHeaderExists_(row, idx, "E-mail", payload.email || "");
  members_setRowValueIfHeaderExists_(row, idx, "Email", payload.email || "");
  members_setRowValueIfHeaderExists_(row, idx, "EMAIL", payload.email || "");
  members_setGovernanceOccupationValue_(row, idx, payload.roleName || "");
  members_setRowValueIfHeaderExists_(row, idx, "ID_Diretoria", payload.boardId || "");
  members_setRowValueIfHeaderExists_(row, idx, "Data_In\u00edcio", payload.startDate || "");
  members_setRowValueIfHeaderExists_(row, idx, "Data_Inicio", payload.startDate || "");
  members_setRowValueIfHeaderExists_(row, idx, "Data_Fim", payload.endDate || "");
  members_setRowValueIfHeaderExists_(row, idx, "Data_Fim_previsto", payload.endDatePredicted || "");

  return row;
}

/**
 * Grava um vinculo oficial na aba correspondente ao destino configurado do cargo.
 *
 * @param {Object} payload
 * @param {Object} cargo
 * @return {Object}
 */
function members_appendGovernanceOfficialRecord_(payload, cargo) {
  var guard = members_shouldSkipOperationalSideEffect_(
    MEMBERS_OPERATIONAL_CONTROL.capabilities.sync,
    "members_appendGovernanceOfficialRecord_",
    {
      boardId: payload && payload.boardId ? String(payload.boardId).trim() : "",
      roleName: payload && payload.roleName ? String(payload.roleName).trim() : ""
    }
  );
  if (guard.skip) {
    return members_tagGovernanceRecordDestination_({
      "Nome": payload.name,
      "RGA": payload.rga,
      "E-mail": payload.email,
      "Ocupacao": payload.roleName,
      "Cargo/Fun\u00e7\u00e3o": payload.roleName,
      "ID_Diretoria": payload.boardId,
      "Data_In\u00edcio": payload.startDate,
      "Data_Fim": payload.endDate,
      "Data_Fim_previsto": payload.endDatePredicted,
      "__dryRun": true
    }, cargo && cargo.destinoVigencia
      ? cargo.destinoVigencia
      : SETTINGS.governance.values.destinationDiretoria);
  }

  var destination = cargo && cargo.destinoVigencia
    ? cargo.destinoVigencia
    : SETTINGS.governance.values.destinationDiretoria;
  var sheetKey = members_getGovernanceDestinationSheetKey_(destination);
  var sheet = members_sheetByKey_(sheetKey);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(item) {
    return String(item || "").trim();
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length)
    .setValues([members_buildGovernanceOfficialRow_(headers, payload)]);

  return members_tagGovernanceRecordDestination_({
    "Nome": payload.name,
    "RGA": payload.rga,
    "E-mail": payload.email,
    "Ocupacao": payload.roleName,
    "Cargo/Fun\u00e7\u00e3o": payload.roleName,
    "ID_Diretoria": payload.boardId,
    "Data_In\u00edcio": payload.startDate,
    "Data_Fim": payload.endDate,
    "Data_Fim_previsto": payload.endDatePredicted
  }, destination);
}

/**
 * Retorna os contatos principais da diretoria alvo para os emails de retorno.
 *
 * @param {string} boardId
 * @param {Array<Object>} boardMembers
 * @param {Object<string, Object>} currentMembersByRga
 * @return {string[]}
 */
function members_buildGovernanceBoardContacts_(boardId, boardMembers, currentMembersByRga) {
  var emails = [];

  (boardMembers || []).forEach(function(record) {
    if (String(record["ID_Diretoria"] || "").trim() !== String(boardId || "").trim()) return;

    var roleClass = members_classifyBoardRole_(members_getGovernanceOccupationValue_(record));
    if (roleClass !== "PRESIDENTE" && roleClass !== "VICE") return;

    var recordEmail = members_normalizeEmailCompat_(record["E-mail"] || record["Email"] || record["EMAIL"]);
    if (recordEmail) emails.push(recordEmail);

    var current = currentMembersByRga[members_onlyDigitsCompat_(record["RGA"])] || null;
    if (current) {
      emails.push(members_normalizeEmailCompat_(members_getCurrentField_(current, "email")));
    }
  });

  return members_uniqueEmailsCompat_(emails);
}

/**
 * Monta o contrato de email de retorno da analise de nomeacao.
 *
 * @param {Object} ctx
 * @return {Object}
 */
function members_buildGovernanceNominationOutgoingContract_(ctx) {
  var limitDateText = ctx.limitDate ? members_formatGovernanceDate_(ctx.limitDate) : "";
  var declaredExitText = ctx.declaredExitDate ? members_formatGovernanceDate_(ctx.declaredExitDate) : "";
  var predictedEndText = ctx.predictedEndDate ? members_formatGovernanceDate_(ctx.predictedEndDate) : "";
  var blocks = [
    {
      title: "Resultado da analise",
      items: [
        { label: "ID_Diretoria", value: ctx.boardId },
        { label: "Ocupacao", value: ctx.roleName },
        { label: "Indicado(a)", value: ctx.memberName + " (" + ctx.rga + ")" },
        { label: "Resultado", value: ctx.status }
      ]
    }
  ];

  if (limitDateText) {
    blocks.push({
      title: "Limite temporal",
      text: "A permanencia maxima estimada para esta nomeacao vai at\u00e9 " + limitDateText + "."
    });
  }

  if (declaredExitText) {
    blocks.push({
      title: "Saida antecipada informada",
      text: "O formulario informou que a permanencia pretendida vai at\u00e9 " + declaredExitText + "."
    });
  }

  if (predictedEndText && (declaredExitText || limitDateText)) {
    blocks.push({
      title: "Data_Fim_previsto registrada",
      text: "A previsao atual do vinculo ficou em " + predictedEndText + "."
    });
  }

  if (ctx.reason) {
    blocks.push({
      title: "Motivo resumido",
      text: ctx.reason
    });
  }

  return {
    moduleName: "MEMBROS",
    templateKey: "GEAPA_CLASSICO",
    correlationKey: GEAPA_CORE.coreMailBuildCorrelationKey("MEM", {
      businessId: String(new Date().getFullYear()) + "-" + ctx.boardId + "-" + members_onlyDigitsCompat_(ctx.rga),
      flowCode: "GOV",
      stage: "NOM"
    }),
    entityType: "DIRETORIA",
    entityId: ctx.boardId,
    flowCode: "GOV",
    stage: "NOM",
    to: ctx.recipients.join(","),
    cc: "",
    bcc: "",
    subjectHuman: SETTINGS.governance.email.nominationSubject,
    payload: {
      title: SETTINGS.governance.email.nominationSubject,
      subtitle: "Transicao de diretoria do GEAPA",
      introText: "O sistema concluiu a analise automatica de uma nomeacao enviada por formulario.",
      blocks: blocks
    },
    priority: "NORMAL",
    sendAfter: "",
    metadata: {
      boardId: ctx.boardId,
      rga: ctx.rga,
      roleName: ctx.roleName,
      status: ctx.status,
      notificationType: "BOARD_NOMINATION_RESULT"
    }
  };
}

/**
 * Monta o contrato de email enviado ao nomeado quando a nomeacao e confirmada.
 *
 * @param {Object} ctx
 * @return {Object}
 */
function members_buildGovernanceNomineeConfirmedOutgoingContract_(ctx) {
  var limitDateText = ctx.limitDate ? members_formatGovernanceDate_(ctx.limitDate) : "";
  var declaredExitText = ctx.declaredExitDate ? members_formatGovernanceDate_(ctx.declaredExitDate) : "";
  var predictedEndText = ctx.predictedEndDate ? members_formatGovernanceDate_(ctx.predictedEndDate) : "";
  var blocks = [
    {
      title: "Nomeacao confirmada",
      items: [
        { label: "ID_Diretoria", value: ctx.boardId },
        { label: "Ocupacao", value: ctx.roleName },
        { label: "Resultado", value: ctx.status }
      ]
    }
  ];

  if (limitDateText) {
    blocks.push({
      title: "Limite temporal",
      text: "Sua permanencia maxima estimada neste cargo vai at\u00e9 " + limitDateText + "."
    });
  }

  if (declaredExitText) {
    blocks.push({
      title: "Saida antecipada informada",
      text: "O formulario registrou que sua permanencia pretendida vai at\u00e9 " + declaredExitText + "."
    });
  }

  if (predictedEndText && (declaredExitText || limitDateText)) {
    blocks.push({
      title: "Data_Fim_previsto registrada",
      text: "A previsao atual do seu vinculo ficou em " + predictedEndText + "."
    });
  }

  if (ctx.reason) {
    blocks.push({
      title: "Observacao",
      text: ctx.reason
    });
  }

  return {
    moduleName: "MEMBROS",
    templateKey: "GEAPA_CLASSICO",
    correlationKey: GEAPA_CORE.coreMailBuildCorrelationKey("MEM", {
      businessId: String(new Date().getFullYear()) + "-" + ctx.boardId + "-" + members_onlyDigitsCompat_(ctx.rga) + "-NOMEADO",
      flowCode: "GOV",
      stage: "NMC"
    }),
    entityType: "DIRETORIA",
    entityId: ctx.boardId,
    flowCode: "GOV",
    stage: "NMC",
    to: String(ctx.recipient || "").trim(),
    cc: "",
    bcc: "",
    subjectHuman: SETTINGS.governance.email.nomineeConfirmedSubject,
    payload: {
      title: SETTINGS.governance.email.nomineeConfirmedSubject,
      subtitle: "Transicao de diretoria do GEAPA",
      introText: "Sua nomeacao para a diretoria do GEAPA foi confirmada pelo fluxo automatizado.",
      blocks: blocks
    },
    priority: "NORMAL",
    sendAfter: "",
    metadata: {
      boardId: ctx.boardId,
      rga: ctx.rga,
      roleName: ctx.roleName,
      status: ctx.status,
      notificationType: "BOARD_NOMINATION_CONFIRMED"
    }
  };
}

/**
 * Enfileira emails do fluxo de governanca na MAIL_SAIDA.
 *
 * @param {Object} contract
 * @return {?Object}
 */
function members_queueGovernanceOutgoing_(contract) {
  if (!contract || !String(contract.to || "").trim()) return null;
  var guard = members_shouldSkipOperationalSideEffect_(
    MEMBERS_OPERATIONAL_CONTROL.capabilities.email,
    "members_queueGovernanceOutgoing_",
    {
      to: String(contract.to || "").trim(),
      stage: String(contract.stage || "").trim()
    }
  );
  if (guard.skip) {
    return {
      ok: !guard.blocked,
      blocked: !!guard.blocked,
      dryRun: !!guard.dryRun,
      queued: false,
      reason: guard.reason
    };
  }
  members_assertLifecycleOutboxCore_();
  var queueResult = GEAPA_CORE.coreMailQueueOutgoing(contract);

  try {
    GEAPA_CORE.coreMailProcessOutbox();
  } catch (err) {}

  return queueResult;
}

/**
 * Processa periodicamente as respostas do formulario de nomeacoes.
 *
 * @return {Object}
 */
function members_processDirectorNominations(eventOrOpts) {
  return members_runOperationalFlow_(
    MEMBERS_OPERATIONAL_CONTROL.flows.governance,
    MEMBERS_OPERATIONAL_CONTROL.capabilities.sync,
    {
      eventOrOpts: eventOrOpts,
      executionTypeFallback: MEMBERS_OPERATIONAL_CONTROL.capabilities.trigger
    },
    function() {
      return members_processDirectorNominations_impl_();
    }
  );
}

/**
 * Implementacao interna do processamento das respostas de nomeacao da diretoria.
 *
 * @return {Object}
 */
function members_processDirectorNominations_impl_() {
  members_assertCore_();

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var responses = members_readRecordsByKey_(SETTINGS.governance.forms.nominationResponsesKey, {
      skipBlankRows: true
    });
    var boards = members_readGovernanceBoardWindows_();
    var boardsById = members_indexGovernanceBoardsById_(boards);
    var semesterWindows = members_readGovernanceSemesterWindows_();
    var cargoCatalog = members_readGovernanceCargoCatalog_();
    var governanceRecords = members_readGovernanceRecordsByDestinations_([
      SETTINGS.governance.values.destinationDiretoria,
      SETTINGS.governance.values.destinationAssessoria,
      SETTINGS.governance.values.destinationConselho
    ]);
    var currentMembersByRga = members_indexGovernanceCurrentMembersByRga_();
    var summary = {
      ok: true,
      scanned: responses.length,
      processed: 0,
      skipped: 0,
      results: []
    };

    responses.forEach(function(record) {
      var responseKey = members_buildGovernanceNominationResponseKey_(record);
      if (!responseKey) {
        summary.skipped += 1;
        return;
      }

      if (members_hasGovernanceProcessingState_(SETTINGS.governance.properties.nominationPrefix, responseKey)) {
        summary.skipped += 1;
        return;
      }

      var outcome = members_processSingleDirectorNominationResponse_(record, {
        boards: boards,
        boardsById: boardsById,
        semesterWindows: semesterWindows,
        cargoCatalog: cargoCatalog,
        boardMembers: governanceRecords,
        currentMembersByRga: currentMembersByRga
      });

      members_setGovernanceProcessingState_(
        SETTINGS.governance.properties.nominationPrefix,
        responseKey,
        outcome.status
      );

      if (outcome.appendedRecord) {
        governanceRecords.push(outcome.appendedRecord);
      }

      summary.processed += 1;
      summary.results.push(outcome);
    });

    if (summary.processed) {
      members_refreshGovernanceArtifacts_();
    }

    return summary;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Processa uma unica resposta do formulario de nomeacao.
 *
 * @param {Object} record
 * @param {Object} ctx
 * @return {Object}
 */
function members_processSingleDirectorNominationResponse_(record, ctx) {
  var boardId = String(members_getGovernanceFormValue_(record, MEMBERS_GOVERNANCE_FORM_ALIASES.nomination.boardId) || "").trim();
  var rawRoleName = String(members_getGovernanceFormValue_(record, MEMBERS_GOVERNANCE_FORM_ALIASES.nomination.roleName) || "").trim();
  var rga = members_onlyDigitsCompat_(members_getGovernanceFormValue_(record, MEMBERS_GOVERNANCE_FORM_ALIASES.nomination.rga));
  var informedName = String(members_getGovernanceFormValue_(record, MEMBERS_GOVERNANCE_FORM_ALIASES.nomination.memberName) || "").trim();
  var stayUntilMandateEndValue = members_getGovernanceFormValue_(record, MEMBERS_GOVERNANCE_FORM_ALIASES.nomination.stayUntilMandateEnd);
  var plannedExitDateValue = members_getGovernanceFormValue_(record, MEMBERS_GOVERNANCE_FORM_ALIASES.nomination.plannedExitDate);
  var submitterEmail = members_normalizeEmailCompat_(members_getGovernanceFormValue_(record, MEMBERS_GOVERNANCE_FORM_ALIASES.nomination.submitterEmail));
  var boardWindow = members_getGovernanceTargetBoard_(ctx.boards, boardId);
  var cargo = members_resolveGovernanceCargoConfig_(ctx.cargoCatalog, rawRoleName);
  var member = members_findGovernanceCurrentMemberByRga_(rga, ctx.currentMembersByRga);
  var reason = "";
  var status = SETTINGS.governance.states.inelegivel;
  var limitDate = null;
  var predictedEndDate = null;
  var declaredExitDate = null;
  var appendedRecord = null;
  var registeredNow = false;

  if (!boardWindow) {
    reason = "ID_Diretoria nao localizado nas vigencias oficiais.";
    members_logGovernanceEvent_("NOM_BOARD_NOT_FOUND", { boardId: boardId, rga: rga, roleName: rawRoleName });
  } else if (!cargo) {
    reason = "Cargo inexistente no catalogo oficial de cargos.";
    members_logGovernanceEvent_("NOM_CARGO_NOT_FOUND", { boardId: boardWindow.id, roleName: rawRoleName, rga: rga });
  } else if (!cargo.ativo || !cargo.permitirViaForm) {
    reason = "Cargo nao permitido para nomeacao automatica via formulario.";
    members_logGovernanceEvent_("NOM_CARGO_NOT_ALLOWED", { boardId: boardWindow.id, roleName: cargo.nomePublico, rga: rga });
  } else if (cargo.exigirHomologacaoPrevia) {
    reason = "Cargo depende de homologacao previa e nao pode ser nomeado automaticamente por este fluxo.";
    members_logGovernanceEvent_("NOM_CARGO_NEEDS_APPROVAL", { boardId: boardWindow.id, roleName: cargo.nomePublico, rga: rga });
  } else if (
    cargo.cargoUnico &&
    members_isGovernanceCargoOccupied_(
      boardWindow.id,
      cargo,
      ctx.boardMembers,
      ctx.boardsById,
      members_getGovernanceOccupancyReferenceDate_(boardWindow)
    )
  ) {
    reason = "Cargo unico ja ocupado para a diretoria informada.";
    members_logGovernanceEvent_("NOM_ROLE_OCCUPIED", { boardId: boardWindow.id, roleName: cargo.nomePublico, rga: rga });
  } else if (!member) {
    reason = "Pessoa nao encontrada em MEMBERS_ATUAIS a partir do RGA informado.";
    members_logGovernanceEvent_("NOM_MEMBER_NOT_FOUND", { boardId: boardWindow.id, roleName: cargo.nomePublico, rga: rga });
  } else if (informedName && !members_namesAreCompatible_(informedName, members_getCurrentField_(member, "name"))) {
    reason = "Conflito entre o RGA informado e o nome digitado no formulario.";
    members_logGovernanceEvent_("NOM_NAME_CONFLICT", {
      boardId: boardWindow.id,
      roleName: cargo.nomePublico,
      rga: rga,
      informedName: informedName,
      actualName: members_getCurrentField_(member, "name")
    });
  } else {
    var eligibility = members_evaluateGovernanceEligibility_(
      rga,
      boardWindow,
      ctx.boardMembers,
      ctx.cargoCatalog,
      ctx.boardsById,
      ctx.semesterWindows,
      { consumptionReferenceDate: members_addGovernanceDays_(boardWindow.start, -1) }
    );

    status = eligibility.status;
    limitDate = eligibility.status === SETTINGS.governance.states.aptoComLimite
      ? eligibility.estimatedLimitDate
      : null;

    if (status === SETTINGS.governance.states.inelegivel) {
      reason = "A pessoa indicada nao possui saldo temporal para novo cargo de diretoria.";
      members_logGovernanceEvent_("NOM_INELEGIBLE", {
        boardId: boardWindow.id,
        roleName: cargo.nomePublico,
        rga: rga,
        countedDays: eligibility.countedDays,
        limitDays: eligibility.limitDays
      });
    } else {
      var existing = members_findExistingGovernanceBoardMember_({
        boardId: boardWindow.id,
        roleName: cargo.nomePublico,
        rga: rga,
        startDate: boardWindow.start,
        destination: cargo.destinoVigencia
      }, ctx.boardMembers);

      if (existing) {
        appendedRecord = existing;
        reason = "Nomeacao equivalente ja estava registrada anteriormente.";
        members_logGovernanceEvent_("NOM_ALREADY_REGISTERED", { boardId: boardWindow.id, roleName: cargo.nomePublico, rga: rga });
      } else {
        var maxAllowedEndDate = status === SETTINGS.governance.states.aptoComLimite ? limitDate : boardWindow.end;
        var plannedEnd = members_resolveGovernanceNominationPlannedEnd_(
          boardWindow,
          maxAllowedEndDate,
          stayUntilMandateEndValue,
          plannedExitDateValue
        );

        if (!plannedEnd.valid) {
          status = SETTINGS.governance.states.inelegivel;
          reason = plannedEnd.rejectionReason;
          declaredExitDate = plannedEnd.declaredExitDate;
          members_logGovernanceEvent_("NOM_INVALID_PLANNED_EXIT", {
            boardId: boardWindow.id,
            roleName: cargo.nomePublico,
            rga: rga,
            declaredExitDate: members_formatGovernanceDate_(plannedEnd.declaredExitDate),
            error: plannedEnd.rejectionReason
          });
        } else {
          declaredExitDate = plannedEnd.declaredExitDate;
          predictedEndDate = plannedEnd.predictedEndDate;
          reason = plannedEnd.note || (
            status === SETTINGS.governance.states.aptoComLimite
              ? "Nomeacao registrada com data limite temporal."
              : "Nomeacao registrada integralmente."
          );

          var payload = {
            name: members_getCurrentField_(member, "name") || "",
            rga: rga,
            email: members_normalizeEmailCompat_(members_getCurrentField_(member, "email")),
            roleName: cargo.nomePublico,
            boardId: boardWindow.id,
            startDate: boardWindow.start,
            endDate: "",
            endDatePredicted: predictedEndDate
          };

          registeredNow = true;
          appendedRecord = members_appendGovernanceOfficialRecord_(payload, cargo);

          members_logGovernanceEvent_(
            status === SETTINGS.governance.states.aptoComLimite ? "NOM_ACCEPTED_LIMITED" : "NOM_ACCEPTED",
            {
              boardId: boardWindow.id,
              roleName: cargo.nomePublico,
              rga: rga,
              limitDate: members_formatGovernanceDate_(limitDate),
              predictedEndDate: members_formatGovernanceDate_(predictedEndDate),
              declaredExitDate: members_formatGovernanceDate_(declaredExitDate)
            }
          );
        }
      }
    }
  }

  var recipients = members_uniqueEmailsCompat_(
    [submitterEmail].concat(members_buildGovernanceBoardContacts_(boardWindow ? boardWindow.id : boardId, ctx.boardMembers, ctx.currentMembersByRga))
  );

  members_queueGovernanceOutgoing_(
    members_buildGovernanceNominationOutgoingContract_({
      boardId: boardWindow ? boardWindow.id : boardId,
      roleName: cargo ? cargo.nomePublico : rawRoleName,
      memberName: member ? String(members_getCurrentField_(member, "name") || informedName || "").trim() : informedName,
      rga: rga,
      status: status,
      limitDate: limitDate,
      declaredExitDate: declaredExitDate,
      predictedEndDate: predictedEndDate,
      reason: reason,
      recipients: recipients
    })
  );

  if (
    registeredNow &&
    member &&
    (status === SETTINGS.governance.states.apto || status === SETTINGS.governance.states.aptoComLimite)
  ) {
    var nomineeEmail = members_normalizeEmailCompat_(members_getCurrentField_(member, "email"));
    if (nomineeEmail) {
      members_queueGovernanceOutgoing_(
        members_buildGovernanceNomineeConfirmedOutgoingContract_({
          boardId: boardWindow ? boardWindow.id : boardId,
          roleName: cargo ? cargo.nomePublico : rawRoleName,
          rga: rga,
          status: status,
          limitDate: limitDate,
          declaredExitDate: declaredExitDate,
          predictedEndDate: predictedEndDate,
          reason: reason,
          recipient: nomineeEmail
        })
      );
    }
  }

  return {
    boardId: boardWindow ? boardWindow.id : boardId,
    roleName: cargo ? cargo.nomePublico : rawRoleName,
    rga: rga,
    status: status,
    reason: reason,
    limitDate: limitDate,
    declaredExitDate: declaredExitDate,
    predictedEndDate: predictedEndDate,
    recipients: recipients,
    appendedRecord: appendedRecord,
    registeredNow: registeredNow
  };
}

/**
 * Sincroniza as opcoes do formulario de nomeacoes com a diretoria em transicao.
 *
 * @return {Object}
 */
function members_syncDirectorNominationFormOptions(eventOrOpts) {
  return members_runOperationalFlow_(
    MEMBERS_OPERATIONAL_CONTROL.flows.governance,
    MEMBERS_OPERATIONAL_CONTROL.capabilities.sync,
    {
      eventOrOpts: eventOrOpts,
      executionTypeFallback: MEMBERS_OPERATIONAL_CONTROL.capabilities.trigger
    },
    function() {
      return members_syncDirectorNominationFormOptions_impl_();
    }
  );
}

/**
 * Implementacao interna da sincronizacao das opcoes do formulario de nomeacoes.
 *
 * @return {Object}
 */
function members_syncDirectorNominationFormOptions_impl_() {
  members_assertCore_();

  var form = members_openGovernanceFormByKey_(SETTINGS.governance.forms.nominationFormKey);
  if (!form) {
    return { ok: false, updated: false, reason: "Formulario de nomeacoes nao localizado." };
  }

  var boards = members_readGovernanceBoardWindows_();
  var targetBoard = members_getGovernanceTargetBoard_(boards);
  var boardChoices = targetBoard ? [targetBoard.id] : boards.map(function(board) { return board.id; });
  var cargoChoices = members_getGovernanceAvailableNominationCargoChoices_(targetBoard);
  var stayChoices = ["SIM", "N\u00c3O"];
  var cargoCatalog = members_readGovernanceCargoCatalog_();
  var items = form.getItems();
  var boardItemsAnyType = members_findGovernanceFormItemsByAliasesAnyType_(items, MEMBERS_GOVERNANCE_FORM_ALIASES.formItems.boardId);
  var roleItemsAnyType = members_findGovernanceFormItemsByAliasesAnyType_(items, MEMBERS_GOVERNANCE_FORM_ALIASES.formItems.roleName);
  var stayItemsAnyType = members_findGovernanceFormItemsByAliasesAnyType_(items, MEMBERS_GOVERNANCE_FORM_ALIASES.formItems.stayUntilMandateEnd);
  var plannedExitItemsAnyType = members_findGovernanceFormItemsByAliasesAnyType_(items, MEMBERS_GOVERNANCE_FORM_ALIASES.formItems.plannedExitDate);
  var occupancyReferenceDate = members_getGovernanceOccupancyReferenceDate_(targetBoard);
  var boardItems = members_findGovernanceFormItemsForChoices_(items, MEMBERS_GOVERNANCE_FORM_ALIASES.formItems.boardId, {
    targetValues: boardChoices,
    referenceValues: boards.map(function(board) { return board.id; })
  });
  var roleItems = members_findGovernanceFormItemsForChoices_(items, MEMBERS_GOVERNANCE_FORM_ALIASES.formItems.roleName, {
    targetValues: cargoChoices,
    referenceValues: cargoCatalog.items.map(function(item) { return item.nomePublico; })
  });
  var stayItems = members_findGovernanceFormItemsForChoices_(items, MEMBERS_GOVERNANCE_FORM_ALIASES.formItems.stayUntilMandateEnd, {
    targetValues: stayChoices,
    referenceValues: stayChoices.concat(["NAO"])
  });
  var updatedItems = [];
  var createdItems = [];
  var warnings = [];
  var skipWrites = members_isOperationalDryRun_();

  if (boardItems.length) {
    boardItems.forEach(function(item) {
      if (!skipWrites) members_applyGovernanceChoicesToItem_(item, boardChoices);
      updatedItems.push(String(item.getTitle() || "").trim());
    });
  } else if (boardItemsAnyType.length) {
    warnings.push("Item de diretoria encontrado, mas o tipo nao aceita sincronizacao de opcoes: " + members_describeGovernanceFormItemsInline_(boardItemsAnyType));
  } else {
    warnings.push("Item de diretoria nao encontrado no formulario.");
  }

  if (roleItems.length) {
    roleItems.forEach(function(item) {
      if (!skipWrites) members_applyGovernanceChoicesToItem_(item, cargoChoices);
      updatedItems.push(String(item.getTitle() || "").trim());
    });
  } else {
    warnings.push("Item de cargo/função nao encontrado no formulario.");
  }

  if (!roleItems.length && roleItemsAnyType.length) {
    warnings[warnings.length - 1] = "Item de cargo/função encontrado, mas o tipo nao aceita sincronizacao de opcoes: " +
      members_describeGovernanceFormItemsInline_(roleItemsAnyType);
  }

  if (stayItems.length) {
    stayItems.forEach(function(item) {
      if (!skipWrites) members_applyGovernanceChoicesToItem_(item, stayChoices);
      updatedItems.push(String(item.getTitle() || "").trim());
    });
  } else if (stayItemsAnyType.length) {
    warnings.push("Item de permanencia encontrado, mas o tipo nao aceita sincronizacao de opcoes: " +
      members_describeGovernanceFormItemsInline_(stayItemsAnyType));
  } else if (skipWrites) {
    warnings.push("DRY_RUN: item de permanencia seria criado no formulario.");
  } else {
    var stayItem = form.addMultipleChoiceItem()
      .setTitle("Pretende permanecer at\u00e9 o final do mandato?")
      .setHelpText("Marque N\u00c3O apenas quando a pessoa indicada ja souber que pretende deixar o cargo antes do fim do mandato.")
      .setRequired(true);
    stayItem.setChoiceValues(stayChoices);
    createdItems.push(String(stayItem.getTitle() || "").trim());
  }

  if (!plannedExitItemsAnyType.length && skipWrites) {
    warnings.push("DRY_RUN: item de data prevista de saida seria criado no formulario.");
  } else if (!plannedExitItemsAnyType.length) {
    var plannedExitItem = form.addDateItem()
      .setTitle("Data prevista de sa\u00edda")
      .setHelpText("Preencha somente se a pessoa indicada nao pretende permanecer at\u00e9 o fim do mandato.")
      .setRequired(false);
    createdItems.push(String(plannedExitItem.getTitle() || "").trim());
  }

  items = form.getItems();

  members_logGovernanceEvent_("NOMINATION_FORM_SYNC", {
    boardChoices: boardChoices.length,
    roleChoices: cargoChoices.length,
    stayChoices: stayChoices,
    occupancyReferenceDate: members_formatGovernanceDate_(occupancyReferenceDate),
    totalItems: items.length,
    matchedBoardItemsAnyType: boardItemsAnyType.length,
    matchedRoleItemsAnyType: roleItemsAnyType.length,
    matchedStayItemsAnyType: stayItemsAnyType.length,
    matchedPlannedExitItemsAnyType: plannedExitItemsAnyType.length,
    matchedBoardItems: boardItems.length,
    matchedRoleItems: roleItems.length,
    matchedStayItems: stayItems.length,
    itemsSnapshot: members_buildGovernanceFormItemsSnapshot_(items),
    updatedItems: updatedItems,
    createdItems: createdItems,
    warnings: warnings
  });

  return {
    ok: warnings.length === 0,
    updated: !skipWrites && (updatedItems.length > 0 || createdItems.length > 0),
    dryRun: skipWrites,
    boardChoices: boardChoices,
    roleChoices: cargoChoices,
    stayChoices: stayChoices,
    occupancyReferenceDate: members_formatGovernanceDate_(occupancyReferenceDate),
    totalItems: items.length,
    matchedBoardItemsAnyType: boardItemsAnyType.length,
    matchedRoleItemsAnyType: roleItemsAnyType.length,
    matchedStayItemsAnyType: stayItemsAnyType.length,
    matchedPlannedExitItemsAnyType: plannedExitItemsAnyType.length,
    matchedBoardItems: boardItems.length,
    matchedRoleItems: roleItems.length,
    matchedStayItems: stayItems.length,
    itemsSnapshot: members_buildGovernanceFormItemsSnapshot_(items),
    updatedItems: updatedItems,
    createdItems: createdItems,
    warnings: warnings
  };
}

/**
 * Retorna a lista de cargos disponiveis para o formulario da diretoria alvo.
 *
 * @param {?Object} boardWindow
 * @return {string[]}
 */
function members_getGovernanceAvailableNominationCargoChoices_(boardWindow) {
  var cargoCatalog = members_readGovernanceCargoCatalog_();
  var boards = members_readGovernanceBoardWindows_();
  var targetBoard = boardWindow || members_getGovernanceTargetBoard_(boards);
  var boardsById = members_indexGovernanceBoardsById_(boards);
  var governanceRecords = members_readGovernanceRecordsByDestinations_([
    SETTINGS.governance.values.destinationDiretoria,
    SETTINGS.governance.values.destinationAssessoria,
    SETTINGS.governance.values.destinationConselho
  ]);
  var occupancyReferenceDate = members_getGovernanceOccupancyReferenceDate_(targetBoard);

  return cargoCatalog.items
    .filter(function(item) {
      if (!item.ativo || !item.permitirViaForm) return false;

      if (item.exigirHomologacaoPrevia) return false;
      if (!item.cargoUnico) return true;

      return targetBoard
        ? !members_isGovernanceCargoOccupied_(targetBoard.id, item, governanceRecords, boardsById, occupancyReferenceDate)
        : true;
    })
    .sort(function(a, b) {
      if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
      return a.nomePublico.localeCompare(b.nomePublico);
    })
    .map(function(item) { return item.nomePublico; });
}

/**
 * Localiza um item de formulario por aliases do titulo.
 *
 * @param {Array<GoogleAppsScript.Forms.Item>} items
 * @param {string[]} aliases
 * @return {?GoogleAppsScript.Forms.Item}
 */
function members_findGovernanceFormItemByAliases_(items, aliases) {
  var matches = members_findGovernanceFormItemsForChoices_(items, aliases);
  return matches.length ? matches[0] : null;
}

/**
 * Localiza itens por aliases de titulo, independentemente do tipo.
 *
 * @param {Array<GoogleAppsScript.Forms.Item>} items
 * @param {string[]} aliases
 * @return {Array<GoogleAppsScript.Forms.Item>}
 */
function members_findGovernanceFormItemsByAliasesAnyType_(items, aliases) {
  var normalizedAliases = (aliases || []).map(members_normalizeGovernanceText_).filter(Boolean);
  var matches = [];

  for (var i = 0; i < (items || []).length; i++) {
    var title = "";
    try {
      title = String(items[i].getTitle() || "").trim();
    } catch (err) {
      title = "";
    }

    var normalizedTitle = members_normalizeGovernanceText_(title);
    if (normalizedAliases.indexOf(normalizedTitle) >= 0 ||
        members_governanceTitleMatchesAliasTokens_(normalizedTitle, normalizedAliases)) {
      matches.push(items[i]);
    }
  }

  return members_deduplicateGovernanceItems_(matches);
}

/**
 * Extrai os valores atuais de um item sincronizavel do formulario.
 *
 * @param {GoogleAppsScript.Forms.Item} item
 * @return {string[]}
 */
function members_listGovernanceChoiceValues_(item) {
  if (!members_isGovernanceChoiceItemType_(item)) return [];

  try {
    var type = item.getType();
    if (type === FormApp.ItemType.LIST) {
      return item.asListItem().getChoices().map(function(choice) { return String(choice.getValue() || "").trim(); }).filter(Boolean);
    }
    if (type === FormApp.ItemType.MULTIPLE_CHOICE) {
      return item.asMultipleChoiceItem().getChoices().map(function(choice) { return String(choice.getValue() || "").trim(); }).filter(Boolean);
    }
    if (type === FormApp.ItemType.CHECKBOX) {
      return item.asCheckboxItem().getChoices().map(function(choice) { return String(choice.getValue() || "").trim(); }).filter(Boolean);
    }
  } catch (err) {}

  return [];
}

/**
 * Localiza todos os itens plausiveis de formulario para uma lista de choices.
 *
 * @param {Array<GoogleAppsScript.Forms.Item>} items
 * @param {string[]} aliases
 * @param {Object=} opts
 * @return {Array<GoogleAppsScript.Forms.Item>}
 */
function members_findGovernanceFormItemsForChoices_(items, aliases, opts) {
  opts = opts || {};
  var normalizedAliases = (aliases || []).map(members_normalizeGovernanceText_).filter(Boolean);
  var normalizedReferenceValues = (opts.referenceValues || opts.targetValues || [])
    .map(members_normalizeGovernanceText_)
    .filter(Boolean);
  var exactMatches = [];
  var tokenMatches = [];
  var choiceMatches = [];

  for (var i = 0; i < (items || []).length; i++) {
    if (!members_isGovernanceChoiceItemType_(items[i])) continue;

    var title = "";
    try {
      title = String(items[i].getTitle() || "").trim();
    } catch (err) {
      title = "";
    }

    var normalizedTitle = members_normalizeGovernanceText_(title);
    if (normalizedAliases.indexOf(normalizedTitle) >= 0) {
      exactMatches.push(items[i]);
      continue;
    }

    if (members_governanceTitleMatchesAliasTokens_(normalizedTitle, normalizedAliases)) {
      tokenMatches.push(items[i]);
      continue;
    }

    var currentChoices = members_listGovernanceChoiceValues_(items[i]).map(members_normalizeGovernanceText_).filter(Boolean);
    if (
      currentChoices.length &&
      normalizedReferenceValues.length &&
      currentChoices.some(function(value) { return normalizedReferenceValues.indexOf(value) >= 0; })
    ) {
      choiceMatches.push(items[i]);
    }
  }

  return members_deduplicateGovernanceItems_(exactMatches.concat(tokenMatches, choiceMatches));
}

/**
 * Remove duplicidades de itens mantendo a ordem original.
 *
 * @param {Array<GoogleAppsScript.Forms.Item>} items
 * @return {Array<GoogleAppsScript.Forms.Item>}
 */
function members_deduplicateGovernanceItems_(items) {
  var seen = {};
  return (items || []).filter(function(item) {
    if (!item || typeof item.getId !== "function") return false;
    var id = String(item.getId() || "").trim();
    if (!id || seen[id]) return false;
    seen[id] = true;
    return true;
  });
}

/**
 * Monta um snapshot curto dos itens do formulario para depuracao.
 *
 * @param {Array<GoogleAppsScript.Forms.Item>} items
 * @return {Array<Object>}
 */
function members_buildGovernanceFormItemsSnapshot_(items) {
  return (items || []).map(function(item) {
    var title = "";
    var type = "";
    try {
      title = String(item.getTitle() || "").trim();
    } catch (err) {
      title = "";
    }
    try {
      type = String(item.getType() || "").trim();
    } catch (err) {
      type = "";
    }
    return {
      title: title,
      type: type,
      choiceCount: members_listGovernanceChoiceValues_(item).length
    };
  });
}

/**
 * Converte itens em um resumo textual curto para mensagens de aviso.
 *
 * @param {Array<GoogleAppsScript.Forms.Item>} items
 * @return {string}
 */
function members_describeGovernanceFormItemsInline_(items) {
  return (items || []).map(function(item) {
    var title = "";
    var type = "";
    try {
      title = String(item.getTitle() || "").trim();
    } catch (err) {
      title = "";
    }
    try {
      type = String(item.getType() || "").trim();
    } catch (err) {
      type = "";
    }
    return (title || "(sem titulo)") + " [" + (type || "SEM_TIPO") + "]";
  }).join("; ");
}

/**
 * Indica se o item de formulario aceita choices sincronizaveis.
 *
 * @param {GoogleAppsScript.Forms.Item} item
 * @return {boolean}
 */
function members_isGovernanceChoiceItemType_(item) {
  if (!item || typeof item.getType !== "function") return false;
  var type = item.getType();
  return type === FormApp.ItemType.LIST ||
    type === FormApp.ItemType.MULTIPLE_CHOICE ||
    type === FormApp.ItemType.CHECKBOX;
}

/**
 * Usa tokens dos aliases como busca tolerante para o titulo do item.
 *
 * @param {string} normalizedTitle
 * @param {string[]} normalizedAliases
 * @return {boolean}
 */
function members_governanceTitleMatchesAliasTokens_(normalizedTitle, normalizedAliases) {
  var title = String(normalizedTitle || "").trim();
  if (!title) return false;

  return (normalizedAliases || []).some(function(alias) {
    var tokens = String(alias || "").trim().split(/\s+/).filter(function(token) {
      return token && token.length >= 3;
    });
    if (!tokens.length) return false;

    return tokens.every(function(token) {
      return title.indexOf(token) >= 0;
    });
  });
}

/**
 * Aplica choices em um item de lista, multipla escolha ou checkbox.
 *
 * @param {GoogleAppsScript.Forms.Item} item
 * @param {string[]} values
 */
function members_applyGovernanceChoicesToItem_(item, values) {
  if (!item || !values || !values.length) return;

  var type = item.getType();
  if (type === FormApp.ItemType.LIST) {
    item.asListItem().setChoiceValues(values);
    return;
  }

  if (type === FormApp.ItemType.MULTIPLE_CHOICE) {
    item.asMultipleChoiceItem().setChoiceValues(values);
    return;
  }

  if (type === FormApp.ItemType.CHECKBOX) {
    item.asCheckboxItem().setChoiceValues(values);
  }
}

/**
 * Monta um identificador idempotente para convites de conselheiros.
 *
 * @param {Object} record
 * @param {Date} effectiveEnd
 * @return {string}
 */
function members_buildGovernanceCouncilorInviteKey_(record, effectiveEnd) {
  return [
    members_onlyDigitsCompat_(record["RGA"]),
    String(record["ID_Diretoria"] || "").trim(),
    members_formatGovernanceDate_(effectiveEnd)
  ].join("|");
}

/**
 * Identifica diretores que estao proximos do fim e podem aderir ao conselho.
 *
 * @param {Object=} opts
 * @return {Array<Object>}
 */
function members_findGovernanceOutgoingDirectors_(opts) {
  opts = opts || {};
  var boards = members_readGovernanceBoardWindows_();
  var boardsById = members_indexGovernanceBoardsById_(boards);
  var directorRecords = members_readGovernanceRecordsByDestinations_([
    SETTINGS.governance.values.destinationDiretoria
  ]);
  var allGovernanceRecords = members_readGovernanceRecordsByDestinations_([
    SETTINGS.governance.values.destinationDiretoria,
    SETTINGS.governance.values.destinationAssessoria,
    SETTINGS.governance.values.destinationConselho
  ]);
  var today = members_toGovernanceDate_(new Date());
  var minDate = opts.includeRecentlyEnded === true
    ? members_addGovernanceDays_(today, -SETTINGS.governance.limits.councilorInvitationLeadDays)
    : today;
  var maxDate = members_addGovernanceDays_(today, SETTINGS.governance.limits.councilorInvitationLeadDays);
  var cargoCatalog = members_readGovernanceCargoCatalog_();

  return directorRecords.filter(function(record) {
    var cargo = members_resolveGovernanceCargoConfig_(cargoCatalog, members_getGovernanceOccupationValue_(record));
    if (!cargo) return false;
    if (members_normalizeGovernanceText_(cargo.nomePublico) === members_normalizeGovernanceText_(SETTINGS.governance.values.cargoConselheiroNome)) {
      return false;
    }

    var interval = members_getGovernanceEffectiveInterval_(record, boardsById);
    if (!interval) return false;
    var minimumEndDate = members_addGovernanceDays_(
      members_addGovernanceMonths_(interval.start, SETTINGS.governance.limits.councilorMinimumRoleMonths),
      -1
    );
    if (!minimumEndDate || interval.end.getTime() < minimumEndDate.getTime()) {
      return false;
    }

    var nextBoard = members_getGovernanceNextBoard_(boards, members_addGovernanceDays_(interval.end, 1));
    if (nextBoard) {
      var isReconducted = allGovernanceRecords.some(function(candidate) {
        return members_onlyDigitsCompat_(candidate["RGA"]) === members_onlyDigitsCompat_(record["RGA"]) &&
          String(candidate["ID_Diretoria"] || "").trim() === String(nextBoard.id || "").trim();
      });
      if (isReconducted) return false;
    }

    return interval.end.getTime() >= minDate.getTime() && interval.end.getTime() <= maxDate.getTime();
  }).map(function(record) {
    var interval = members_getGovernanceEffectiveInterval_(record, boardsById);
    return Object.freeze({
      record: record,
      effectiveEnd: interval ? interval.end : null
    });
  }).filter(function(item) {
    return !!item.effectiveEnd;
  });
}

/**
 * Monta o contrato de email para convite de adesao ao conselho.
 *
 * @param {Object} ctx
 * @return {Object}
 */
function members_buildGovernanceCouncilorInviteOutgoingContract_(ctx) {
  var attempt = Math.max(1, Number(ctx.attempt || 1) || 1);
  var blocks = [
    {
      title: "Como responder",
      text: ctx.formUrl
        ? ("Preencha o formulário oficial de adesão neste link: " + ctx.formUrl)
        : "Use o formulário oficial de adesão disponibilizado pela diretoria."
    },
    {
      title: "Periodo atual",
      items: [
        { label: "Ocupacao", value: ctx.roleName },
        { label: "Fim efetivo", value: members_formatGovernanceDate_(ctx.effectiveEnd) }
      ]
    }
  ];

  if (ctx.formUrl) {
    blocks.push({
      title: "Link direto",
      text: ctx.formUrl
    });
  }

  return {
    moduleName: "MEMBROS",
    templateKey: "GEAPA_CLASSICO",
    correlationKey: GEAPA_CORE.coreMailBuildCorrelationKey("MEM", {
      businessId: String(new Date().getFullYear()) + "-" + members_onlyDigitsCompat_(ctx.rga) + "-T" + attempt,
      flowCode: "GOV",
      stage: "CONVCONS"
    }),
    entityType: "CONSELHEIRO",
    entityId: ctx.rga,
    flowCode: "GOV",
    stage: "CONVCONS",
    to: ctx.email,
    cc: "",
    bcc: "",
    subjectHuman: SETTINGS.governance.email.councilorInviteSubject,
    payload: {
      title: SETTINGS.governance.email.councilorInviteSubject,
      subtitle: "Transição institucional do GEAPA",
      introText: "Registramos que o seu vínculo atual na diretoria se aproxima do encerramento e gostaríamos de convidar você para aderir ao corpo de conselheiros consultivos do GEAPA.",
      blocks: blocks
    },
    priority: "NORMAL",
    sendAfter: "",
    metadata: {
      rga: ctx.rga,
      roleName: ctx.roleName,
      attempt: attempt,
      notificationType: "COUNCILOR_INVITE"
    }
  };
}

/**
 * Monta o contrato de email de confirmacao ou recusa da adesao ao conselho.
 *
 * @param {Object} ctx
 * @return {Object}
 */
function members_buildGovernanceCouncilorDecisionOutgoingContract_(ctx) {
  var accepted = ctx.accepted === true;
  var responseToken = members_buildGovernanceCouncilorDecisionCorrelationToken_(ctx.responseKey);
  var subject = accepted
    ? SETTINGS.governance.email.councilorAcceptedSubject
    : SETTINGS.governance.email.councilorRefusedSubject;
  var blocks = [
    {
      title: "Resultado registrado",
      items: [
        { label: "Nome", value: ctx.name },
        { label: "RGA", value: ctx.rga },
        { label: "Resposta", value: accepted ? "ACEITO" : "RECUSADO" }
      ]
    }
  ];

  if (accepted) {
    blocks.push({
      title: "Vigência do vínculo",
      items: [
        { label: "Ocupação", value: ctx.roleName },
        { label: "Início", value: members_formatGovernanceDate_(ctx.startDate) },
        { label: "Fim previsto", value: members_formatGovernanceDate_(ctx.endDate) }
      ]
    });
    blocks.push({
      title: "Como funciona",
      text: "O conselho consultivo é um vínculo de apoio institucional e memória do GEAPA. Ele permite acesso de leitura aos materiais de transição/conselheiros enquanto o vínculo estiver ativo, sem conceder poderes automáticos de diretoria ou edição administrativa."
    });
    blocks.push({
      title: "Acessos",
      text: "A permissão de leitor na pasta de Transição e Conselheiros é sincronizada automaticamente a partir da data de início do vínculo. Se o acesso ainda não aparecer no mesmo dia, ele deve ser restaurado pelo job de sincronização de governança."
    });
  } else {
    blocks.push({
      title: "Sem vínculo criado",
      text: "Registramos sua recusa. Nenhum vínculo de conselheiro será criado automaticamente e nenhum acesso adicional será concedido por este fluxo."
    });
  }

  return {
    moduleName: "MEMBROS",
    templateKey: "GEAPA_CLASSICO",
    correlationKey: GEAPA_CORE.coreMailBuildCorrelationKey("MEM", {
      businessId: String(new Date().getFullYear()) + "-" + members_onlyDigitsCompat_(ctx.rga) + "-" + responseToken,
      flowCode: "GOV",
      stage: accepted ? "CONSOK" : "CONSREC"
    }),
    entityType: "CONSELHEIRO",
    entityId: ctx.rga,
    flowCode: "GOV",
    stage: accepted ? "CONSOK" : "CONSREC",
    to: String(ctx.email || "").trim(),
    cc: "",
    bcc: "",
    subjectHuman: subject,
    payload: {
      title: subject,
      subtitle: "Conselho consultivo do GEAPA",
      introText: accepted
        ? "Sua adesão ao conselho consultivo do GEAPA foi registrada com sucesso."
        : "Registramos sua resposta ao convite para o conselho consultivo do GEAPA.",
      blocks: blocks
    },
    priority: "NORMAL",
    sendAfter: "",
    metadata: {
      rga: ctx.rga,
      responseKey: ctx.responseKey,
      accepted: accepted,
      notificationType: accepted ? "COUNCILOR_ACCEPTED_CONFIRMATION" : "COUNCILOR_REFUSED_CONFIRMATION"
    }
  };
}

/**
 * Gera um token curto e estavel para a correlacao da resposta de conselheiro.
 *
 * @param {*} responseKey
 * @return {string}
 */
function members_buildGovernanceCouncilorDecisionCorrelationToken_(responseKey) {
  var raw = String(responseKey || "").trim();
  var timestamp = raw.split("|")[0] || "";
  var compactTimestamp = timestamp.replace(/\D/g, "").slice(-8);
  return "RC" + (compactTimestamp || members_shortGovernanceHash_(raw, 8));
}

/**
 * Gera um hash curto deterministico para identificadores operacionais.
 *
 * @param {*} value
 * @param {number=} length
 * @return {string}
 */
function members_shortGovernanceHash_(value, length) {
  var text = String(value || "");
  var hash = 0;

  for (var i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash).toString(36).toUpperCase().slice(0, Math.max(1, Number(length || 8)));
}

/**
 * Envia convites para adesao de conselheiros quando o fim do vinculo se aproxima.
 *
 * @return {Object}
 */
function members_sendCouncilorInvitationEmails(eventOrOpts) {
  return members_runOperationalFlow_(
    MEMBERS_OPERATIONAL_CONTROL.flows.councilors,
    MEMBERS_OPERATIONAL_CONTROL.capabilities.sync,
    {
      eventOrOpts: eventOrOpts,
      executionTypeFallback: MEMBERS_OPERATIONAL_CONTROL.capabilities.trigger
    },
    function() {
      return members_sendCouncilorInvitationEmails_impl_();
    }
  );
}

/**
 * Implementacao interna do disparo de convites para adesao ao conselho.
 *
 * @return {Object}
 */
function members_sendCouncilorInvitationEmails_impl_() {
  members_assertCore_();

  var outgoing = members_findGovernanceOutgoingDirectors_();
  var summary = {
    ok: true,
    scanned: outgoing.length,
    sent: 0,
    skipped: 0
  };

  outgoing.forEach(function(item) {
    var inviteKey = members_buildGovernanceCouncilorInviteKey_(item.record, item.effectiveEnd);
    if (members_hasGovernanceProcessingState_(SETTINGS.governance.properties.councilorInvitePrefix, inviteKey)) {
      summary.skipped += 1;
      return;
    }
    var attempt = Math.max(
      1,
      members_getGovernanceNumericState_(SETTINGS.governance.properties.councilorInviteResendPrefix, inviteKey) + 1
    );

    var email = members_normalizeEmailCompat_(item.record["E-mail"] || item.record["Email"] || item.record["EMAIL"]);
    if (!email) {
      summary.skipped += 1;
      return;
    }

    var inviteQueue = members_queueGovernanceOutgoing_(
      members_buildGovernanceCouncilorInviteOutgoingContract_({
        rga: item.record["RGA"],
        email: email,
        roleName: members_getGovernanceOccupationValue_(item.record),
        effectiveEnd: item.effectiveEnd,
        attempt: attempt,
        formUrl: members_buildGovernanceFormUrl_(SETTINGS.governance.forms.councilorFormKey)
      })
    );

    if (inviteQueue && (inviteQueue.dryRun || inviteQueue.blocked)) {
      summary.skipped += 1;
      return;
    }

    members_setGovernanceProcessingState_(
      SETTINGS.governance.properties.councilorInvitePrefix,
      inviteKey,
      new Date().toISOString()
    );

    members_logGovernanceEvent_("COUNCILOR_INVITE_SENT", {
      rga: item.record["RGA"],
      roleName: members_getGovernanceOccupationValue_(item.record),
      effectiveEnd: members_formatGovernanceDate_(item.effectiveEnd),
      attempt: attempt
    });

    summary.sent += 1;
  });

  return summary;
}

/**
 * Cria uma chave idempotente para respostas de adesao ao conselho.
 *
 * @param {Object} record
 * @return {string}
 */
function members_buildGovernanceCouncilorResponseKey_(record) {
  return [
    members_buildGovernanceTimestampKey_(members_getGovernanceFormValue_(record, MEMBERS_GOVERNANCE_FORM_ALIASES.councilor.submittedAt)),
    members_onlyDigitsCompat_(members_getGovernanceFormValue_(record, MEMBERS_GOVERNANCE_FORM_ALIASES.councilor.rga)),
    members_normalizeGovernanceText_(members_getGovernanceFormValue_(record, MEMBERS_GOVERNANCE_FORM_ALIASES.councilor.decision))
  ].join("|");
}

/**
 * Interpreta a decisao do formulario de conselheiros.
 *
 * @param {*} value
 * @return {boolean}
 */
function members_isGovernanceCouncilorAccepted_(value) {
  var normalized = members_normalizeGovernanceText_(value);
  if (!normalized || members_isGovernanceNo_(normalized)) return false;
  if (normalized.indexOf("nao") === 0 || normalized.indexOf("recus") >= 0) return false;

  return normalized === "sim" ||
    normalized === "aceito" ||
    normalized === "aceitar" ||
    normalized === "quero aderir" ||
    normalized === "aceito aderir" ||
    normalized.indexOf("sim") === 0 ||
    normalized.indexOf("aceito") >= 0 ||
    normalized.indexOf("aceitar") >= 0;
}

/**
 * Localiza o diretor de saida correspondente a uma resposta de conselheiro.
 *
 * @param {Object} record
 * @param {Array<Object>} outgoing
 * @return {?Object}
 */
function members_findGovernanceOutgoingDirectorByResponse_(record, outgoing) {
  var rga = members_onlyDigitsCompat_(members_getGovernanceFormValue_(record, MEMBERS_GOVERNANCE_FORM_ALIASES.councilor.rga));
  var informedName = String(members_getGovernanceFormValue_(record, MEMBERS_GOVERNANCE_FORM_ALIASES.councilor.memberName) || "").trim();
  var submitterEmail = members_normalizeEmailCompat_(members_getGovernanceFormValue_(record, MEMBERS_GOVERNANCE_FORM_ALIASES.councilor.submitterEmail));

  for (var i = 0; i < (outgoing || []).length; i++) {
    var current = outgoing[i];
    var currentRga = members_onlyDigitsCompat_(current.record["RGA"]);
    var currentName = String(current.record["Nome"] || current.record["Membro"] || "").trim();
    var currentEmail = members_normalizeEmailCompat_(current.record["E-mail"] || current.record["Email"] || current.record["EMAIL"]);

    if (rga && currentRga === rga) return current;
    if (submitterEmail && currentEmail && submitterEmail === currentEmail) return current;
    if (informedName && currentName && members_namesAreCompatible_(informedName, currentName)) return current;
  }

  return null;
}

/**
 * Verifica se ja existe um vinculo equivalente em Conselheiros.
 *
 * @param {Object} payload
 * @param {Array<Object>} records
 * @return {boolean}
 */
function members_hasEquivalentCouncilorRecord_(payload, records) {
  var targetRga = members_onlyDigitsCompat_(payload.rga);
  var targetStart = members_toGovernanceDate_(payload.startDate);

  return (records || []).some(function(record) {
    var sameRga = members_onlyDigitsCompat_(record["RGA"]) === targetRga;
    var recordStart = members_toGovernanceDate_(record["Data_In\u00edcio"]);
    var sameStart = targetStart && recordStart && targetStart.getTime() === recordStart.getTime();
    var sameRole = members_normalizeGovernanceText_(members_getGovernanceOccupationValue_(record)) === members_normalizeGovernanceText_(payload.roleName);
    return sameRga && sameStart && sameRole;
  });
}

/**
 * Resolve a data final padrao do vinculo de conselheiro.
 *
 * @param {Date} startDate
 * @param {Array<Object>} semesterWindows
 * @return {?Date}
 */
function members_resolveGovernanceCouncilorEndDate_(startDate, semesterWindows) {
  var start = members_toGovernanceDate_(startDate);
  if (!start) return null;

  for (var i = 0; i < (semesterWindows || []).length; i++) {
    var current = semesterWindows[i];
    if (current.start.getTime() <= start.getTime() && current.end.getTime() >= start.getTime()) {
      return current.end;
    }
  }

  return members_addGovernanceDays_(members_addGovernanceMonths_(start, 6), -1);
}

/**
 * Processa periodicamente as respostas do formulario de adesao ao conselho.
 *
 * @return {Object}
 */
function members_processCouncilorAdhesions(eventOrOpts) {
  return members_runOperationalFlow_(
    MEMBERS_OPERATIONAL_CONTROL.flows.councilors,
    MEMBERS_OPERATIONAL_CONTROL.capabilities.sync,
    {
      eventOrOpts: eventOrOpts,
      executionTypeFallback: MEMBERS_OPERATIONAL_CONTROL.capabilities.trigger
    },
    function() {
      return members_processCouncilorAdhesions_impl_();
    }
  );
}

/**
 * Implementacao interna do processamento das respostas de adesao ao conselho.
 *
 * @return {Object}
 */
function members_processCouncilorAdhesions_impl_() {
  members_assertCore_();

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var responses = members_readRecordsByKey_(SETTINGS.governance.forms.councilorResponsesKey, {
      skipBlankRows: true
    });
    var outgoing = members_findGovernanceOutgoingDirectors_({ includeRecentlyEnded: true });
    var semesterWindows = members_readGovernanceSemesterWindows_();
    var cargoCatalog = members_readGovernanceCargoCatalog_();
    var councilorCargo = members_findGovernanceCouncilorCargo_(cargoCatalog);
    var councilorSheet = members_sheetByKey_(SETTINGS.vigenciaKeys.conselheiros);
    var councilorHeaders = councilorSheet
      ? councilorSheet.getRange(1, 1, 1, councilorSheet.getLastColumn()).getValues()[0].map(function(item) { return String(item || "").trim(); })
      : [];
    var currentCouncilors = members_readRecordsByKey_(SETTINGS.vigenciaKeys.conselheiros, {
      skipBlankRows: true
    });
    var summary = {
      ok: true,
      scanned: responses.length,
      processed: 0,
      skipped: 0,
      accepted: 0,
      refused: 0,
      emailsQueued: 0
    };

    responses.forEach(function(record) {
      var responseKey = members_buildGovernanceCouncilorResponseKey_(record);
      if (!responseKey) {
        summary.skipped += 1;
        return;
      }

      if (members_hasGovernanceProcessingState_(SETTINGS.governance.properties.councilorResponsePrefix, responseKey)) {
        summary.skipped += 1;
        return;
      }

      var match = members_findGovernanceOutgoingDirectorByResponse_(record, outgoing);
      if (!match) {
        members_setGovernanceProcessingState_(
          SETTINGS.governance.properties.councilorResponsePrefix,
          responseKey,
          SETTINGS.governance.states.refused
        );
        members_logGovernanceEvent_("COUNCILOR_DIRECTOR_NOT_FOUND", {
          rga: members_getGovernanceFormValue_(record, MEMBERS_GOVERNANCE_FORM_ALIASES.councilor.rga)
        });
        summary.skipped += 1;
        return;
      }

      var accepted = members_isGovernanceCouncilorAccepted_(
        members_getGovernanceFormValue_(record, MEMBERS_GOVERNANCE_FORM_ALIASES.councilor.decision)
      );

      if (!accepted) {
        if (members_queueGovernanceCouncilorDecisionEmail_({
          responseKey: responseKey,
          accepted: false,
          match: match,
          payload: null
        })) {
          summary.emailsQueued += 1;
        }
        members_setGovernanceProcessingState_(
          SETTINGS.governance.properties.councilorResponsePrefix,
          responseKey,
          SETTINGS.governance.states.refused
        );
        members_logGovernanceEvent_("COUNCILOR_REFUSED", {
          rga: match.record["RGA"],
          name: match.record["Nome"] || ""
        });
        summary.processed += 1;
        summary.refused += 1;
        return;
      }

      var startDate = members_addGovernanceDays_(match.effectiveEnd, 1);
      var payload = {
        name: String(match.record["Nome"] || match.record["Membro"] || "").trim(),
        rga: members_onlyDigitsCompat_(match.record["RGA"]),
        email: members_normalizeEmailCompat_(match.record["E-mail"] || match.record["Email"] || match.record["EMAIL"]),
        roleName: councilorCargo ? councilorCargo.nomePublico : SETTINGS.governance.values.cargoConselheiroNome,
        boardId: "",
        startDate: startDate,
        endDate: members_resolveGovernanceCouncilorEndDate_(startDate, semesterWindows),
        endDatePredicted: ""
      };

      if (!members_hasEquivalentCouncilorRecord_(payload, currentCouncilors)) {
        if (!members_isOperationalDryRun_()) {
          councilorSheet.getRange(councilorSheet.getLastRow() + 1, 1, 1, councilorHeaders.length)
            .setValues([members_buildGovernanceOfficialRow_(councilorHeaders, payload)]);

          currentCouncilors.push({
            "Nome": payload.name,
            "RGA": payload.rga,
            "E-mail": payload.email,
            "Ocupacao": payload.roleName,
            "Cargo/Fun\u00e7\u00e3o": payload.roleName,
            "Data_In\u00edcio": payload.startDate,
            "Data_Fim": payload.endDate
          });
        }
      }

      if (members_queueGovernanceCouncilorDecisionEmail_({
        responseKey: responseKey,
        accepted: true,
        match: match,
        payload: payload
      })) {
        summary.emailsQueued += 1;
      }

      members_setGovernanceProcessingState_(
        SETTINGS.governance.properties.councilorResponsePrefix,
        responseKey,
        SETTINGS.governance.states.accepted
      );

      members_logGovernanceEvent_("COUNCILOR_ACCEPTED", {
        rga: payload.rga,
        name: payload.name,
        startDate: members_formatGovernanceDate_(payload.startDate),
        endDate: members_formatGovernanceDate_(payload.endDate)
      });

      summary.processed += 1;
      summary.accepted += 1;
    });

    if (summary.accepted || summary.refused) {
      members_refreshGovernanceArtifacts_();
    }

    return summary;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Enfileira a devolutiva individual sobre a resposta de adesao ao conselho.
 *
 * @param {Object} ctx
 * @return {?Object}
 */
function members_queueGovernanceCouncilorDecisionEmail_(ctx) {
  var match = ctx && ctx.match ? ctx.match : null;
  var record = match && match.record ? match.record : {};
  var payload = ctx && ctx.payload ? ctx.payload : {};
  var email = members_normalizeEmailCompat_(payload.email || record["E-mail"] || record["Email"] || record["EMAIL"]);
  if (!email) return null;

  return members_queueGovernanceOutgoing_(
    members_buildGovernanceCouncilorDecisionOutgoingContract_({
      responseKey: String(ctx && ctx.responseKey ? ctx.responseKey : "").trim(),
      accepted: ctx && ctx.accepted === true,
      name: payload.name || String(record["Nome"] || record["Membro"] || "").trim(),
      rga: payload.rga || members_onlyDigitsCompat_(record["RGA"]),
      email: email,
      roleName: payload.roleName || SETTINGS.governance.values.cargoConselheiroNome,
      startDate: payload.startDate || (match && match.effectiveEnd ? members_addGovernanceDays_(match.effectiveEnd, 1) : ""),
      endDate: payload.endDate || ""
    })
  );
}

/**
 * Repara registros de conselheiros a partir das respostas oficiais do formulario.
 *
 * Use quando um alias de decisao ou regra de vigencia tiver sido corrigido apos
 * respostas ja processadas: remove vinculos criados para recusas, cria aceites
 * faltantes e ajusta Data_Fim para a janela semestral vigente.
 *
 * @return {Object}
 */
function members_repairCouncilorAdhesionsFromResponses() {
  members_assertCore_();

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var responses = members_readRecordsByKey_(SETTINGS.governance.forms.councilorResponsesKey, {
      skipBlankRows: true
    });
    var outgoing = members_findGovernanceOutgoingDirectors_({ includeRecentlyEnded: true });
    var semesterWindows = members_readGovernanceSemesterWindows_();
    var cargoCatalog = members_readGovernanceCargoCatalog_();
    var councilorCargo = members_findGovernanceCouncilorCargo_(cargoCatalog);
    var councilorSheet = members_sheetByKey_(SETTINGS.vigenciaKeys.conselheiros);
    var headers = councilorSheet
      ? councilorSheet.getRange(1, 1, 1, councilorSheet.getLastColumn()).getValues()[0].map(function(item) { return String(item || "").trim(); })
      : [];
    var headerMap = members_buildHeaderMapCompat_(headers, { normalize: true, oneBased: false });
    var lastRow = councilorSheet ? councilorSheet.getLastRow() : 0;
    var rows = lastRow > 1
      ? councilorSheet.getRange(2, 1, lastRow - 1, headers.length).getValues()
      : [];
    var endIndex = members_findHeaderIndexByAliases_(headerMap, ["Data_Fim", "Data Fim", "Fim"], { notFoundValue: -1 });
    var summary = {
      ok: true,
      scanned: responses.length,
      created: 0,
      correctedEndDate: 0,
      removedRefusals: 0,
      emailsQueued: 0,
      skipped: 0,
      dryRun: members_isOperationalDryRun_()
    };
    var rowsToDelete = [];
    var rowsToDeleteSeen = {};

    responses.forEach(function(record) {
      var responseKey = members_buildGovernanceCouncilorResponseKey_(record);
      var match = members_findGovernanceOutgoingDirectorByResponse_(record, outgoing);
      if (!responseKey || !match) {
        summary.skipped += 1;
        return;
      }

      var startDate = members_addGovernanceDays_(match.effectiveEnd, 1);
      var payload = {
        name: String(match.record["Nome"] || match.record["Membro"] || "").trim(),
        rga: members_onlyDigitsCompat_(match.record["RGA"]),
        email: members_normalizeEmailCompat_(match.record["E-mail"] || match.record["Email"] || match.record["EMAIL"]),
        roleName: councilorCargo ? councilorCargo.nomePublico : SETTINGS.governance.values.cargoConselheiroNome,
        boardId: "",
        startDate: startDate,
        endDate: members_resolveGovernanceCouncilorEndDate_(startDate, semesterWindows),
        endDatePredicted: ""
      };
      var rowInfo = members_findGovernanceCouncilorSheetRow_(rows, headers, payload);
      var accepted = members_isGovernanceCouncilorAccepted_(
        members_getGovernanceFormValue_(record, MEMBERS_GOVERNANCE_FORM_ALIASES.councilor.decision)
      );

      if (!accepted) {
        if (members_queueGovernanceCouncilorDecisionEmail_({
          responseKey: responseKey,
          accepted: false,
          match: match,
          payload: null
        })) {
          summary.emailsQueued += 1;
        }
        if (rowInfo && !rowsToDeleteSeen[rowInfo.rowNumber]) {
          rowsToDelete.push(rowInfo.rowNumber);
          rowsToDeleteSeen[rowInfo.rowNumber] = true;
          members_setGovernanceProcessingState_(
            SETTINGS.governance.properties.councilorResponsePrefix,
            responseKey,
            SETTINGS.governance.states.refused
          );
          summary.removedRefusals += 1;
        }
        return;
      }

      if (!rowInfo) {
        if (!summary.dryRun) {
          councilorSheet.getRange(councilorSheet.getLastRow() + 1, 1, 1, headers.length)
            .setValues([members_buildGovernanceOfficialRow_(headers, payload)]);
        }
        members_setGovernanceProcessingState_(
          SETTINGS.governance.properties.councilorResponsePrefix,
          responseKey,
          SETTINGS.governance.states.accepted
        );
        if (members_queueGovernanceCouncilorDecisionEmail_({
          responseKey: responseKey,
          accepted: true,
          match: match,
          payload: payload
        })) {
          summary.emailsQueued += 1;
        }
        summary.created += 1;
        return;
      }

      if (endIndex >= 0) {
        var currentEnd = members_toGovernanceDate_(rowInfo.row[endIndex]);
        var expectedEnd = members_toGovernanceDate_(payload.endDate);
        if (expectedEnd && (!currentEnd || currentEnd.getTime() !== expectedEnd.getTime())) {
          if (!summary.dryRun) {
            councilorSheet.getRange(rowInfo.rowNumber, endIndex + 1).setValue(expectedEnd);
          }
          summary.correctedEndDate += 1;
        }
      }

      members_setGovernanceProcessingState_(
        SETTINGS.governance.properties.councilorResponsePrefix,
        responseKey,
        SETTINGS.governance.states.accepted
      );
      if (members_queueGovernanceCouncilorDecisionEmail_({
        responseKey: responseKey,
        accepted: true,
        match: match,
        payload: payload
      })) {
        summary.emailsQueued += 1;
      }
    });

    rowsToDelete.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) {
      if (!summary.dryRun) {
        councilorSheet.deleteRow(rowNumber);
      }
    });

    if (!summary.dryRun && (summary.created || summary.correctedEndDate || summary.removedRefusals)) {
      members_refreshGovernanceArtifacts_();
    }

    members_logGovernanceEvent_("COUNCILOR_ADHESIONS_REPAIRED", summary);
    return summary;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Encontra uma linha de conselheiro equivalente na aba oficial.
 *
 * @param {Array<Array<*>>} rows
 * @param {Array<string>} headers
 * @param {Object} payload
 * @return {?Object}
 */
function members_findGovernanceCouncilorSheetRow_(rows, headers, payload) {
  var headerMap = members_buildHeaderMapCompat_(headers || [], { normalize: true, oneBased: false });
  var rgaIndex = members_findHeaderIndexByAliases_(headerMap, ["RGA"], { notFoundValue: -1 });
  var startIndex = members_findHeaderIndexByAliases_(headerMap, ["Data_In\u00edcio", "Data_Inicio", "Data Inicio"], { notFoundValue: -1 });
  var roleIndex = members_getGovernanceOccupationHeaderIndex_(headerMap);
  var targetRga = members_onlyDigitsCompat_(payload && payload.rga);
  var targetStart = members_toGovernanceDate_(payload && payload.startDate);
  var targetRole = members_normalizeGovernanceText_(payload && payload.roleName);

  for (var i = 0; i < (rows || []).length; i++) {
    var row = rows[i] || [];
    var sameRga = rgaIndex >= 0 && members_onlyDigitsCompat_(row[rgaIndex]) === targetRga;
    var rowStart = startIndex >= 0 ? members_toGovernanceDate_(row[startIndex]) : null;
    var sameStart = targetStart && rowStart && targetStart.getTime() === rowStart.getTime();
    var sameRole = roleIndex < 0 || members_normalizeGovernanceText_(row[roleIndex]) === targetRole;

    if (sameRga && sameStart && sameRole) {
      return {
        rowNumber: i + 2,
        row: row
      };
    }
  }

  return null;
}

/**
 * Coleta os emails de configuracao que nunca devem ser removidos das pastas.
 *
 * @return {string[]}
 */
function members_collectGovernanceProtectedEmails_() {
  var keys = [
    SETTINGS.courseConfigKey,
    SETTINGS.governance.configKeys.mailConfig,
    SETTINGS.governance.configKeys.communicationsConfig
  ];
  var emails = [];

  keys.forEach(function(key) {
    var records = [];
    try {
      records = members_readRecordsByKey_(key, { skipBlankRows: true });
    } catch (err) {
      records = [];
    }

    records.forEach(function(record) {
      Object.keys(record || {}).forEach(function(field) {
        var value = String(record[field] || "");
        var matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig) || [];
        matches.forEach(function(email) {
          emails.push(members_normalizeEmailCompat_(email));
        });
      });
    });
  });

  return members_uniqueEmailsCompat_(emails);
}

/**
 * Coleta emails que devem ser protegidos em um item especifico do Drive.
 *
 * O proprietario do item e o usuario efetivo do script nunca devem ser
 * removidos pela reconciliacao, mesmo que nao estejam nas configuracoes
 * administrativas lidas das planilhas.
 *
 * @param {GoogleAppsScript.Drive.File|GoogleAppsScript.Drive.Folder} item
 * @return {string[]}
 */
function members_collectGovernanceDriveItemProtectedEmails_(item) {
  var emails = [];

  try {
    var effectiveUser = Session.getEffectiveUser();
    if (effectiveUser && typeof effectiveUser.getEmail === "function") {
      emails.push(members_normalizeEmailCompat_(effectiveUser.getEmail()));
    }
  } catch (err) {
    // Sem acao: alguns contextos podem ocultar o usuario efetivo.
  }

  try {
    var activeUser = Session.getActiveUser();
    if (activeUser && typeof activeUser.getEmail === "function") {
      emails.push(members_normalizeEmailCompat_(activeUser.getEmail()));
    }
  } catch (err2) {
    // Sem acao: usuarios ativos podem nao estar disponiveis em triggers.
  }

  try {
    if (item && typeof item.getOwner === "function") {
      var owner = item.getOwner();
      if (owner && typeof owner.getEmail === "function") {
        emails.push(members_normalizeEmailCompat_(owner.getEmail()));
      }
    }
  } catch (err3) {
    // Sem acao: itens em Drive compartilhado ou atalhos podem nao expor owner.
  }

  return members_uniqueEmailsCompat_(emails);
}

/**
 * Constroi o conjunto de editores da pasta Administrativo.
 *
 * @return {string[]}
 */
function members_buildGovernanceAdministrativeEditors_() {
  var boards = members_readGovernanceBoardWindows_();
  var activeBoard = members_getGovernanceActiveBoard_(boards, new Date());
  if (!activeBoard) return [];

  var today = members_toGovernanceDate_(new Date());
  var governanceRecords = members_readGovernanceRecordsByDestinations_([
    SETTINGS.governance.values.destinationDiretoria
  ]);
  var boardsById = members_indexGovernanceBoardsById_(boards);

  return members_uniqueEmailsCompat_(
    governanceRecords.filter(function(record) {
      if (String(record["ID_Diretoria"] || "").trim() !== String(activeBoard.id || "").trim()) return false;
      var interval = members_getGovernanceEffectiveInterval_(record, boardsById);
      return interval &&
        interval.start.getTime() <= today.getTime() &&
        interval.end.getTime() >= today.getTime();
    }).map(function(record) {
      return record["E-mail"] || record["Email"] || record["EMAIL"];
    })
  );
}

/**
 * Coleta assessores ativos da diretoria vigente para preservar excecoes manuais no Administrativo.
 *
 * Regra: assessores nao recebem acesso automatico, mas uma permissao manual nao deve
 * ser removida pelo sincronizador enquanto o vinculo de assessoria estiver ativo.
 *
 * @return {string[]}
 */
function members_buildGovernanceAdministrativeManualProtectedEmails_() {
  var boards = members_readGovernanceBoardWindows_();
  var activeBoard = members_getGovernanceActiveBoard_(boards, new Date());
  if (!activeBoard) return [];

  var today = members_toGovernanceDate_(new Date());
  var assessorRecords = members_readGovernanceRecordsByDestinations_([
    SETTINGS.governance.values.destinationAssessoria
  ]);
  var boardsById = members_indexGovernanceBoardsById_(boards);

  return members_uniqueEmailsCompat_(
    assessorRecords.filter(function(record) {
      if (String(record["ID_Diretoria"] || "").trim() !== String(activeBoard.id || "").trim()) return false;
      var interval = members_getGovernanceEffectiveInterval_(record, boardsById);
      return interval &&
        interval.start.getTime() <= today.getTime() &&
        interval.end.getTime() >= today.getTime();
    }).map(function(record) {
      return record["E-mail"] || record["Email"] || record["EMAIL"];
    })
  );
}

/**
 * Constroi o conjunto de leitores da pasta de transicao e conselheiros.
 *
 * @return {string[]}
 */
function members_buildGovernanceTransitionReaders_() {
  var boards = members_readGovernanceBoardWindows_();
  var targetBoard = members_getGovernanceTargetBoard_(boards);
  var boardsById = members_indexGovernanceBoardsById_(boards);
  var governanceRecords = members_readGovernanceRecordsByDestinations_([
    SETTINGS.governance.values.destinationDiretoria
  ]);
  var councilors = members_readRecordsByKey_(SETTINGS.vigenciaKeys.conselheiros, {
    skipBlankRows: true
  });
  var today = members_toGovernanceDate_(new Date());
  var emails = [];

  if (targetBoard) {
    governanceRecords.forEach(function(record) {
      if (String(record["ID_Diretoria"] || "").trim() !== String(targetBoard.id || "").trim()) return;
      var interval = members_getGovernanceEffectiveInterval_(record, boardsById);
      if (!interval) return;
      if (interval.end.getTime() < targetBoard.start.getTime()) return;
      emails.push(record["E-mail"] || record["Email"] || record["EMAIL"]);
    });
  }

  councilors.forEach(function(record) {
    var start = members_toGovernanceDate_(record["Data_In\u00edcio"]);
    var end = members_toGovernanceDate_(record["Data_Fim"]);
    if (!start) return;
    if (start.getTime() > today.getTime()) return;
    if (end && end.getTime() < today.getTime()) return;
    emails.push(record["E-mail"] || record["Email"] || record["EMAIL"]);
  });

  return members_uniqueEmailsCompat_(emails);
}

/**
 * Coleta assessores da diretoria alvo para preservar excecoes manuais na pasta de transicao.
 *
 * Regra: assessores nao entram automaticamente na pasta, mas uma concessao manual
 * feita durante a transicao nao deve ser removida pelo sincronizador enquanto o
 * vinculo de assessoria daquela diretoria-alvo permanecer relevante.
 *
 * @return {string[]}
 */
function members_buildGovernanceTransitionManualProtectedEmails_() {
  var boards = members_readGovernanceBoardWindows_();
  var targetBoard = members_getGovernanceTargetBoard_(boards);
  if (!targetBoard) return [];

  var assessorRecords = members_readGovernanceRecordsByDestinations_([
    SETTINGS.governance.values.destinationAssessoria
  ]);
  var boardsById = members_indexGovernanceBoardsById_(boards);

  return members_uniqueEmailsCompat_(
    assessorRecords.filter(function(record) {
      if (String(record["ID_Diretoria"] || "").trim() !== String(targetBoard.id || "").trim()) return false;
      var interval = members_getGovernanceEffectiveInterval_(record, boardsById);
      return interval && interval.end.getTime() >= targetBoard.start.getTime();
    }).map(function(record) {
      return record["E-mail"] || record["Email"] || record["EMAIL"];
    })
  );
}

/**
 * Resolve os atalhos da pasta de transicao para suas pastas reais de destino.
 *
 * A pasta Transicao e Conselheiros funciona como catalogo operacional do que
 * deve continuar disponivel em leitura para transicao e conselho.
 *
 * @param {GoogleAppsScript.Drive.Folder} folder
 * @return {Object}
 */
function members_listGovernanceTransitionShortcutTargetFolders_(folder) {
  var summary = {
    ok: true,
    scanned: 0,
    resolved: 0,
    skipped: 0,
    folders: [],
    warnings: [],
    errors: []
  };
  var seen = {};

  if (!folder) {
    summary.ok = false;
    summary.errors.push({ reason: "missing_transition_folder" });
    return summary;
  }

  try {
    var files = folder.getFiles();
    while (files.hasNext()) {
      var file = files.next();
      summary.scanned += 1;

      var name = file.getName();
      var mimeType = "";
      try {
        mimeType = file.getMimeType();
      } catch (mimeErr) {
        summary.skipped += 1;
        summary.warnings.push({
          item: name,
          reason: "mime_type_unavailable",
          error: String(mimeErr && mimeErr.message ? mimeErr.message : mimeErr)
        });
        continue;
      }

      if (mimeType !== "application/vnd.google-apps.shortcut") {
        summary.skipped += 1;
        summary.warnings.push({
          item: name,
          reason: "not_a_shortcut",
          mimeType: mimeType
        });
        continue;
      }

      var targetId = "";
      var targetMimeType = "";
      try {
        targetId = typeof file.getTargetId === "function" ? String(file.getTargetId() || "").trim() : "";
        targetMimeType = typeof file.getTargetMimeType === "function" ? String(file.getTargetMimeType() || "").trim() : "";
      } catch (targetErr) {
        summary.skipped += 1;
        summary.warnings.push({
          item: name,
          reason: "shortcut_target_unavailable",
          error: String(targetErr && targetErr.message ? targetErr.message : targetErr)
        });
        continue;
      }

      if (!targetId) {
        summary.skipped += 1;
        summary.warnings.push({ item: name, reason: "shortcut_without_target_id" });
        continue;
      }

      if (targetMimeType && targetMimeType !== "application/vnd.google-apps.folder") {
        summary.skipped += 1;
        summary.warnings.push({
          item: name,
          targetId: targetId,
          reason: "shortcut_target_is_not_folder",
          targetMimeType: targetMimeType
        });
        continue;
      }

      if (seen[targetId]) {
        summary.skipped += 1;
        summary.warnings.push({ item: name, targetId: targetId, reason: "duplicate_target" });
        continue;
      }

      try {
        var targetFolder = DriveApp.getFolderById(targetId);
        seen[targetId] = true;
        summary.folders.push({
          id: targetId,
          name: targetFolder.getName(),
          sourceShortcutName: name,
          folder: targetFolder
        });
        summary.resolved += 1;
      } catch (openErr) {
        var diagnosis = members_describeGovernanceDriveError_("", openErr);
        summary.skipped += 1;
        summary.warnings.push({
          item: name,
          targetId: targetId,
          reason: "target_folder_unavailable",
          error: diagnosis.error,
          likelyCause: diagnosis.likelyCause
        });
      }
    }
  } catch (err) {
    var listDiagnosis = members_describeGovernanceDriveError_("", err);
    summary.ok = false;
    summary.errors.push({
      reason: "shortcut_folder_list_error",
      error: listDiagnosis.error,
      likelyCause: listDiagnosis.likelyCause
    });
  }

  if (summary.warnings.length || summary.errors.length) {
    members_logGovernanceEvent_("DRIVE_TRANSITION_SHORTCUT_TARGETS", {
      scanned: summary.scanned,
      resolved: summary.resolved,
      skipped: summary.skipped,
      warnings: summary.warnings.length,
      errors: summary.errors.length
    });
  }

  return summary;
}

/**
 * Extrai os emails atuais de uma pasta para uma role especifica.
 *
 * @param {GoogleAppsScript.Drive.Folder} folder
 * @param {string} role
 * @return {string[]}
 */
function members_listGovernanceFolderEmails_(folder, role) {
  if (!folder) {
    return {
      ok: true,
      emails: [],
      error: "",
      likelyCause: ""
    };
  }

  try {
    var emails = role === "editor"
      ? folder.getEditors().map(function(user) { return user.getEmail(); })
      : folder.getViewers().map(function(user) { return user.getEmail(); });

    return {
      ok: true,
      emails: members_uniqueEmailsCompat_(emails),
      error: "",
      likelyCause: ""
    };
  } catch (err) {
    var diagnosis = members_describeGovernanceDriveError_("", err);
    members_logGovernanceEvent_("DRIVE_ACCESS_LIST_ERROR", {
      folder: folder.getName(),
      role: role,
      error: diagnosis.error,
      likelyCause: diagnosis.likelyCause
    });
    return {
      ok: false,
      emails: [],
      error: diagnosis.error,
      likelyCause: diagnosis.likelyCause
    };
  }
}

/**
 * Sincroniza um conjunto de usuarios com uma role de pasta do Drive.
 *
 * @param {GoogleAppsScript.Drive.Folder} folder
 * @param {string} role
 * @param {string[]} desiredEmails
 * @param {string[]} protectedEmails
 * @return {Object}
 */
function members_syncGovernanceFolderRole_(folder, role, desiredEmails, protectedEmails) {
  var currentRead = members_listGovernanceFolderEmails_(folder, role);
  var current = currentRead.emails || [];
  var desired = members_uniqueEmailsCompat_(desiredEmails || []);
  var protectedSet = members_uniqueEmailsCompat_(
    (protectedEmails || []).concat(members_collectGovernanceDriveItemProtectedEmails_(folder))
  );
  var added = [];
  var removed = [];
  var errors = [];
  var guard = members_shouldSkipOperationalSideEffect_(
    MEMBERS_OPERATIONAL_CONTROL.capabilities.drive,
    "members_syncGovernanceFolderRole_",
    {
      folder: folder && typeof folder.getName === "function" ? folder.getName() : "",
      role: role
    }
  );

  if (guard.skip) {
    return {
      readOk: currentRead.ok !== false,
      readError: currentRead.error || "",
      readLikelyCause: currentRead.likelyCause || "",
      added: [],
      removed: [],
      errors: [],
      dryRun: !!guard.dryRun,
      blocked: !!guard.blocked,
      wouldAdd: desired.filter(function(email) { return current.indexOf(email) < 0; }),
      wouldRemove: current.filter(function(email) {
        return desired.indexOf(email) < 0 && protectedSet.indexOf(email) < 0;
      })
    };
  }

  desired.forEach(function(email) {
    if (current.indexOf(email) >= 0) return;

    try {
      if (role === "editor") {
        folder.addEditor(email);
      } else {
        folder.addViewer(email);
      }
      added.push(email);
      members_logGovernanceEvent_("DRIVE_ACCESS_GRANTED", {
        folder: folder.getName(),
        role: role,
        email: email
      });
    } catch (err) {
      var diagnosis = members_describeGovernanceDriveError_(email, err);
      members_logGovernanceEvent_("DRIVE_ACCESS_GRANT_ERROR", {
        folder: folder.getName(),
        role: role,
        email: email,
        error: diagnosis.error,
        likelyCause: diagnosis.likelyCause
      });
      errors.push({
        action: "grant",
        email: email,
        error: diagnosis.error,
        likelyCause: diagnosis.likelyCause
      });
    }
  });

  current.forEach(function(email) {
    if (desired.indexOf(email) >= 0) return;
    if (protectedSet.indexOf(email) >= 0) return;

    try {
      if (role === "editor") {
        folder.removeEditor(email);
      } else {
        folder.removeViewer(email);
      }
      removed.push(email);
      members_logGovernanceEvent_("DRIVE_ACCESS_REMOVED", {
        folder: folder.getName(),
        role: role,
        email: email
      });
    } catch (err) {
      var removeDiagnosis = members_describeGovernanceDriveError_(email, err);
      members_logGovernanceEvent_("DRIVE_ACCESS_REMOVE_ERROR", {
        folder: folder.getName(),
        role: role,
        email: email,
        error: removeDiagnosis.error,
        likelyCause: removeDiagnosis.likelyCause
      });
      errors.push({
        action: "remove",
        email: email,
        error: removeDiagnosis.error,
        likelyCause: removeDiagnosis.likelyCause
      });
    }
  });

  return {
    readOk: currentRead.ok !== false,
    readError: currentRead.error || "",
    readLikelyCause: currentRead.likelyCause || "",
    added: added,
    removed: removed,
    errors: errors
  };
}

/**
 * Sincroniza leitores/editores nas pastas reais apontadas pelos atalhos da transicao.
 *
 * @param {GoogleAppsScript.Drive.Folder} transitionFolder
 * @param {string[]} desiredReaders
 * @param {string[]} desiredEditors
 * @param {string[]} protectedEmails
 * @return {Object}
 */
function members_syncGovernanceTransitionShortcutTargets_(transitionFolder, desiredReaders, desiredEditors, protectedEmails) {
  var targetDiscovery = members_listGovernanceTransitionShortcutTargetFolders_(transitionFolder);
  var editors = members_uniqueEmailsCompat_(desiredEditors || []);
  var readers = members_uniqueEmailsCompat_(desiredReaders || []).filter(function(email) {
    return editors.indexOf(email) < 0;
  });
  var protectedSet = members_uniqueEmailsCompat_((protectedEmails || []).concat(editors));
  var summary = {
    ok: targetDiscovery.ok !== false,
    scanned: targetDiscovery.scanned,
    resolved: targetDiscovery.resolved,
    skipped: targetDiscovery.skipped,
    warnings: targetDiscovery.warnings,
    errors: targetDiscovery.errors,
    folders: []
  };

  targetDiscovery.folders.forEach(function(item) {
    var folderSummary = {
      id: item.id,
      name: item.name,
      sourceShortcutName: item.sourceShortcutName,
      editors: members_syncGovernanceFolderRole_(
        item.folder,
        "editor",
        editors,
        protectedEmails
      ),
      viewers: null
    };

    folderSummary.viewers = members_syncGovernanceFolderRole_(
      item.folder,
      "viewer",
      readers,
      protectedSet
    );

    summary.folders.push(folderSummary);
  });

  return summary;
}

/**
 * Lista pastas, arquivos e destinos de atalhos contidos na pasta Administrativo.
 *
 * A pasta Administrativo pode conter subpastas, arquivos diretos e atalhos para
 * acervos operacionais. Esta varredura monta o conjunto que deve receber a
 * mesma reconciliação de editor da diretoria vigente.
 *
 * @param {GoogleAppsScript.Drive.Folder} rootFolder
 * @return {Object}
 */
function members_listGovernanceAdministrativeContainedItems_(rootFolder) {
  var maxItems = 500;
  var summary = {
    ok: true,
    scanned: 0,
    resolvedShortcuts: 0,
    skipped: 0,
    limitReached: false,
    warnings: [],
    errors: [],
    items: []
  };
  var seenItems = {};
  var scannedFolders = {};

  function getItemId_(item) {
    try {
      return typeof item.getId === "function" ? String(item.getId() || "").trim() : "";
    } catch (err) {
      return "";
    }
  }

  function getItemName_(item) {
    try {
      return typeof item.getName === "function" ? String(item.getName() || "").trim() : "";
    } catch (err) {
      return "";
    }
  }

  function addItem_(item, type, path, sourceShortcutName) {
    if (!item || summary.items.length >= maxItems) {
      summary.limitReached = summary.items.length >= maxItems;
      return false;
    }

    var id = getItemId_(item);
    var key = (type || "item") + ":" + (id || path || getItemName_(item));
    if (seenItems[key]) return false;

    seenItems[key] = true;
    summary.items.push({
      id: id,
      name: getItemName_(item),
      type: type || "item",
      path: path || "",
      sourceShortcutName: sourceShortcutName || "",
      item: item
    });
    return true;
  }

  function resolveShortcutTarget_(file, path) {
    var name = getItemName_(file);
    var targetId = "";
    var targetMimeType = "";

    try {
      targetId = typeof file.getTargetId === "function" ? String(file.getTargetId() || "").trim() : "";
      targetMimeType = typeof file.getTargetMimeType === "function" ? String(file.getTargetMimeType() || "").trim() : "";
    } catch (err) {
      summary.skipped += 1;
      summary.warnings.push({
        item: name,
        reason: "shortcut_target_unavailable",
        error: String(err && err.message ? err.message : err)
      });
      return;
    }

    if (!targetId) {
      summary.skipped += 1;
      summary.warnings.push({ item: name, reason: "shortcut_without_target_id" });
      return;
    }

    try {
      if (targetMimeType === "application/vnd.google-apps.folder") {
        var targetFolder = DriveApp.getFolderById(targetId);
        summary.resolvedShortcuts += 1;
        addItem_(targetFolder, "shortcut_target_folder", path + " > " + getItemName_(targetFolder), name);
        scanFolder_(targetFolder, path + " > " + getItemName_(targetFolder));
      } else {
        var targetFile = DriveApp.getFileById(targetId);
        summary.resolvedShortcuts += 1;
        addItem_(targetFile, "shortcut_target_file", path + " > " + getItemName_(targetFile), name);
      }
    } catch (err) {
      var diagnosis = members_describeGovernanceDriveError_("", err);
      summary.skipped += 1;
      summary.warnings.push({
        item: name,
        targetId: targetId,
        reason: "shortcut_target_unavailable",
        error: diagnosis.error,
        likelyCause: diagnosis.likelyCause
      });
    }
  }

  function scanFolder_(folder, path) {
    if (!folder || summary.items.length >= maxItems) {
      summary.limitReached = summary.items.length >= maxItems;
      return;
    }

    var folderId = getItemId_(folder);
    if (folderId && scannedFolders[folderId]) return;
    if (folderId) scannedFolders[folderId] = true;

    try {
      var folders = folder.getFolders();
      while (folders.hasNext()) {
        if (summary.items.length >= maxItems) {
          summary.limitReached = true;
          return;
        }

        var childFolder = folders.next();
        var childPath = path + "/" + getItemName_(childFolder);
        summary.scanned += 1;
        addItem_(childFolder, "folder", childPath, "");
        scanFolder_(childFolder, childPath);
      }

      var files = folder.getFiles();
      while (files.hasNext()) {
        if (summary.items.length >= maxItems) {
          summary.limitReached = true;
          return;
        }

        var file = files.next();
        var filePath = path + "/" + getItemName_(file);
        var mimeType = "";
        summary.scanned += 1;
        addItem_(file, "file", filePath, "");

        try {
          mimeType = typeof file.getMimeType === "function" ? String(file.getMimeType() || "").trim() : "";
        } catch (mimeErr) {
          summary.warnings.push({
            item: getItemName_(file),
            reason: "mime_type_unavailable",
            error: String(mimeErr && mimeErr.message ? mimeErr.message : mimeErr)
          });
          continue;
        }

        if (mimeType === "application/vnd.google-apps.shortcut") {
          resolveShortcutTarget_(file, filePath);
        }
      }
    } catch (err) {
      var diagnosis = members_describeGovernanceDriveError_("", err);
      summary.ok = false;
      summary.errors.push({
        folder: getItemName_(folder),
        reason: "administrative_folder_scan_error",
        error: diagnosis.error,
        likelyCause: diagnosis.likelyCause
      });
    }
  }

  if (!rootFolder) {
    summary.ok = false;
    summary.errors.push({ reason: "missing_administrative_folder" });
    return summary;
  }

  scanFolder_(rootFolder, rootFolder.getName());

  if (summary.warnings.length || summary.errors.length || summary.limitReached) {
    members_logGovernanceEvent_("DRIVE_ADMINISTRATIVE_CONTENTS_SCAN", {
      scanned: summary.scanned,
      items: summary.items.length,
      resolvedShortcuts: summary.resolvedShortcuts,
      skipped: summary.skipped,
      limitReached: summary.limitReached,
      warnings: summary.warnings.length,
      errors: summary.errors.length
    });
  }

  return summary;
}

/**
 * Sincroniza editores nos itens internos da pasta Administrativo.
 *
 * Diretores vigentes devem manter acesso de editor aos materiais internos da
 * pasta Administrativo, inclusive quando algum item tiver compartilhamento
 * especifico ou quando houver atalhos para pastas/arquivos operacionais.
 *
 * @param {GoogleAppsScript.Drive.Folder} administrativeFolder
 * @param {string[]} desiredEditors
 * @param {string[]} protectedEmails
 * @return {Object}
 */
function members_syncGovernanceAdministrativeContents_(administrativeFolder, desiredEditors, protectedEmails) {
  var discovery = members_listGovernanceAdministrativeContainedItems_(administrativeFolder);
  var editors = members_uniqueEmailsCompat_(desiredEditors || []);
  var summary = {
    ok: discovery.ok !== false,
    scanned: discovery.scanned,
    items: discovery.items.length,
    resolvedShortcuts: discovery.resolvedShortcuts,
    skipped: discovery.skipped,
    limitReached: discovery.limitReached,
    warnings: discovery.warnings,
    errors: discovery.errors,
    synced: []
  };

  discovery.items.forEach(function(entry) {
    summary.synced.push({
      id: entry.id,
      name: entry.name,
      type: entry.type,
      path: entry.path,
      sourceShortcutName: entry.sourceShortcutName,
      editors: members_syncGovernanceFolderRole_(
        entry.item,
        "editor",
        editors,
        protectedEmails
      )
    });
  });

  return summary;
}

/**
 * Sincroniza as permissoes das pastas Administrativo e Transicao/Conselheiros.
 *
 * @return {Object}
 */
function members_syncGovernanceDriveAccess(eventOrOpts) {
  return members_runOperationalFlow_(
    MEMBERS_OPERATIONAL_CONTROL.flows.governanceDriveSync,
    MEMBERS_OPERATIONAL_CONTROL.capabilities.drive,
    {
      eventOrOpts: eventOrOpts,
      executionTypeFallback: MEMBERS_OPERATIONAL_CONTROL.capabilities.trigger
    },
    function() {
      return members_syncGovernanceDriveAccess_impl_();
    }
  );
}

/**
 * Implementacao interna da sincronizacao de permissoes das pastas de governanca.
 *
 * @return {Object}
 */
function members_syncGovernanceDriveAccess_impl_() {
  members_assertCore_();

  var administrativo = members_openGovernanceFolderByKey_(SETTINGS.governance.folders.administrativoKey);
  var transicao = members_openGovernanceFolderByKey_(SETTINGS.governance.folders.transicaoKey);
  var protectedEmails = members_collectGovernanceProtectedEmails_();
  var administrativoProtectedEmails = members_uniqueEmailsCompat_(
    protectedEmails.concat(members_buildGovernanceAdministrativeManualProtectedEmails_())
  );
  var transicaoProtectedEmails = members_uniqueEmailsCompat_(
    protectedEmails.concat(members_buildGovernanceTransitionManualProtectedEmails_())
  );
  var transitionTargetProtectedEmails = members_uniqueEmailsCompat_(
    administrativoProtectedEmails.concat(transicaoProtectedEmails)
  );
  var administrativeEditors = members_buildGovernanceAdministrativeEditors_();
  var transitionReaders = members_buildGovernanceTransitionReaders_();
  var summary = {
    ok: true,
    administrativo: null,
    administrativoContents: null,
    transicao: null,
    transitionTargets: null
  };

  if (administrativo) {
    summary.administrativo = {
      editors: members_syncGovernanceFolderRole_(
        administrativo,
        "editor",
        administrativeEditors,
        administrativoProtectedEmails
      ),
      viewers: members_syncGovernanceFolderRole_(
        administrativo,
        "viewer",
        [],
        administrativoProtectedEmails
      )
    };

    summary.administrativoContents = members_syncGovernanceAdministrativeContents_(
      administrativo,
      administrativeEditors,
      administrativoProtectedEmails
    );
  }

  if (transicao) {
    summary.transicao = {
      viewers: members_syncGovernanceFolderRole_(
        transicao,
        "viewer",
        transitionReaders,
        transicaoProtectedEmails
      ),
      editors: members_syncGovernanceFolderRole_(
        transicao,
        "editor",
        [],
        transicaoProtectedEmails
      )
    };

    summary.transitionTargets = members_syncGovernanceTransitionShortcutTargets_(
      transicao,
      transitionReaders,
      administrativeEditors,
      transitionTargetProtectedEmails
    );
  }

  return summary;
}

/**
 * Atualiza os artefatos derivados do fluxo de governanca.
 *
 * @return {Object}
 */
function members_refreshGovernanceArtifacts_() {
  var summary = {
    panel: null,
    form: null,
    drive: null
  };

  try {
    summary.panel = members_refreshGovernanceEligibilityPanel();
  } catch (err) {
    members_logGovernanceEvent_("REFRESH_PANEL_ERROR", { error: err && err.message ? err.message : String(err) });
  }

  try {
    summary.form = members_syncDirectorNominationFormOptions();
  } catch (err) {
    members_logGovernanceEvent_("REFRESH_FORM_ERROR", { error: err && err.message ? err.message : String(err) });
  }

  try {
    summary.drive = members_syncGovernanceDriveAccess();
  } catch (err) {
    members_logGovernanceEvent_("REFRESH_DRIVE_ERROR", { error: err && err.message ? err.message : String(err) });
  }

  return summary;
}

/**
 * Monta os links institucionais do fluxo de transicao para o email da chapa eleita.
 *
 * @return {Object}
 */
function members_buildGovernanceTransitionResources_() {
  return Object.freeze({
    membersSheetUrl: members_buildGovernanceSheetUrl_(SETTINGS.currentKey),
    transitionFolderUrl: members_buildGovernanceFolderUrl_(SETTINGS.governance.folders.transicaoKey),
    nominationFormUrl: members_buildGovernanceFormUrl_(SETTINGS.governance.forms.nominationFormKey)
  });
}

/**
 * Alias publico para sincronizacao manual do formulario de diretoria.
 *
 * @return {Object}
 */
function syncDirectorFormOptions() {
  var result = members_syncDirectorNominationFormOptions();
  try {
    Logger.log("[geapa-membros][governanca][syncDirectorFormOptions] " + JSON.stringify(result));
  } catch (err) {}
  return result;
}

/**
 * Alias publico para recalculo manual do painel de elegibilidade.
 *
 * @return {Object}
 */
function refreshGovernanceEligibilityPanel() {
  return members_refreshGovernanceEligibilityPanel();
}
