/***************************************
 * 07_members_header_aliases.gs
 *
 * Aliases de cabeçalhos para manter compatibilidade
 * entre os nomes legados e a padronização operacional.
 ***************************************/

const MEMBERS_HEADER_ALIASES = Object.freeze({
  future: Object.freeze({
    name: Object.freeze(["Nome", "NOME_MEMBRO"]),
    enrollmentSemester: Object.freeze(["Semestre de inscrição", "SEMESTRE_INSCRICAO"]),
    rga: Object.freeze(["RGA"]),
    cpf: Object.freeze(["CPF"]),
    phone: Object.freeze(["TELEFONE", "Telefone"]),
    email: Object.freeze(["EMAIL", "Email", "E-mail"]),
    birthDate: Object.freeze(["DATA DE NASCIMENTO", "Data de nascimento", "DATA_NASCIMENTO"]),
    instagram: Object.freeze(["@ Instagram", "INSTAGRAM"]),
    naturality: Object.freeze(["Naturalidade", "NATURALIDADE"]),
    sex: Object.freeze(["Sexo", "SEXO"]),
    academicHistory: Object.freeze([
      "Participa/Participou de algum/alguns laboratório(s), projeto(s), pesquisa(s), empresa júnior, monitoria, etc? se sim, citar qual/quais.",
      "HISTORICO_ATIVIDADES_ACADEMICAS"
    ]),
    currentSemester: Object.freeze(["Semestre atual", "SEMESTRE_ATUAL"]),
    status: Object.freeze(["Status", "STATUS_CADASTRAL"]),
    processStatus: Object.freeze(["Status do processo", "STATUS_PROCESSO_INGRESSO"]),
    sentAt: Object.freeze(["Data envio convite", "DATA_ENVIO_CONVITE"]),
    threadId: Object.freeze(["ThreadId convite", "THREAD_ID_CONVITE"]),
    repliedAt: Object.freeze(["Data resposta", "DATA_RESPOSTA"]),
    messageId: Object.freeze(["MessageId resposta", "MessageId convite", "MESSAGE_ID_RESPOSTA"]),
    notes: Object.freeze(["Observações do processo", "Observacoes do processo", "OBSERVACAO_PROCESSO"]),
    entrySemester: Object.freeze(["Semestre de entrada", "Semestre de Entrada", "SEMESTRE_ENTRADA"]),
    integratedAt: Object.freeze(["Data integração", "Data integracao", "DATA_INTEGRACAO"])
  }),
  current: Object.freeze({
    name: Object.freeze(["Membro", "MEMBRO", "NOME_MEMBRO", "Nome"]),
    rga: Object.freeze(["RGA"]),
    cpf: Object.freeze(["CPF"]),
    phone: Object.freeze(["TELEFONE", "Telefone"]),
    email: Object.freeze(["EMAIL", "Email", "E-mail"]),
    birthDate: Object.freeze(["Data de nascimento", "DATA_NASCIMENTO"]),
    instagram: Object.freeze(["@ Instagram", "INSTAGRAM"]),
    naturality: Object.freeze(["Naturalidade", "NATURALIDADE"]),
    academicHistory: Object.freeze([
      "Participa/Participou de algum/alguns laboratório(s), projeto(s), pesquisa(s), empresa júnior, monitoria, etc? se sim, citar qual/quais.",
      "HISTORICO_ATIVIDADES_ACADEMICAS"
    ]),
    integratedAt: Object.freeze(["Data integração", "Data integracao", "DATA_INTEGRACAO"]),
    effectiveGroupTime: Object.freeze(["TEMPO_EFETIVO_NO_GRUPO"]),
    entrySemester: Object.freeze(["Semestre de entrada", "Semestre de Entrada", "SEMESTRE_ENTRADA"]),
    semesterCount: Object.freeze(["N° de semestres no grupo", "Nº de semestres no grupo", "NÂ° de semestres no grupo", "NÂº de semestres no grupo", "QTD_SEMESTRES_NO_GRUPO"]),
    currentSemester: Object.freeze(["Semestre atual", "SEMESTRE_ATUAL"]),
    presentationCount: Object.freeze(["Apresentações já feitas", "Apresentacoes ja feitas", "QTD_APRESENTACOES_REALIZADAS"]),
    diretoriaDays: Object.freeze(["Dias em cargos da diretoria", "QTD_DIAS_EM_CARGOS_DIRETORIA"]),
    currentRole: Object.freeze(["Cargo/função atual", "Cargo/funcao atual", "CARGO_FUNCAO_ATUAL"]),
    sex: Object.freeze(["Sexo", "SEXO"]),
    suspended: Object.freeze(["Já foi suspenso?", "Ja foi suspenso?", "FLAG_JA_FOI_SUSPENSO"]),
    status: Object.freeze(["Status", "STATUS_CADASTRAL"])
  }),
  hist: Object.freeze({
    name: Object.freeze(["Membro", "MEMBRO", "NOME_MEMBRO"]),
    rga: Object.freeze(["RGA"]),
    cpf: Object.freeze(["CPF"]),
    phone: Object.freeze(["Telefone", "TELEFONE"]),
    email: Object.freeze(["Email", "E-mail", "EMAIL"]),
    birthDate: Object.freeze(["Data de nascimento", "DATA_NASCIMENTO"]),
    sex: Object.freeze(["Sexo", "SEXO"]),
    instagram: Object.freeze(["@ Instagram", "INSTAGRAM"]),
    naturality: Object.freeze(["Naturalidade", "NATURALIDADE"]),
    academicHistory: Object.freeze([
      "Participa/Participou de algum/alguns laboratório(s), projeto(s), pesquisa(s), empresa júnior, monitoria, etc? se sim, citar qual/quais.",
      "HISTORICO_ATIVIDADES_ACADEMICAS"
    ]),
    integratedAt: Object.freeze(["Data integração", "Data de integração", "DATA_INTEGRACAO"]),
    entrySemester: Object.freeze(["Semestre de Entrada", "Semestre de entrada", "SEMESTRE_ENTRADA"]),
    effectiveGroupTime: Object.freeze(["TEMPO_EFETIVO_NO_GRUPO"]),
    finalStatus: Object.freeze(["Status final", "STATUS_DESLIGAMENTO"]),
    requestAt: Object.freeze(["Data de solicitação", "DATA_SOLICITACAO_DESLIGAMENTO"]),
    exitSemester: Object.freeze(["Semestre de saída", "SEMESTRE_SAIDA"]),
    semesterCount: Object.freeze(["N° de semestres no grupo", "Nº de semestres no grupo", "NÂ° de semestres no grupo", "NÂº de semestres no grupo", "QTD_SEMESTRES_NO_GRUPO"]),
    approvedAt: Object.freeze(["Data de homologação", "DATA_HOMOLOGACAO"]),
    reason: Object.freeze(["Motivo", "MOTIVO_DESLIGAMENTO"]),
    wasDirector: Object.freeze(["Foi membro da diretoria?", "FLAG_FOI_MEMBRO_DIRETORIA"]),
    internalNote: Object.freeze(["Observação interna", "Observacao interna", "OBSERVACAO_INTERNA"]),
    status: Object.freeze(["Status", "STATUS_REGISTRO"])
  })
});

function members_getHeaderAliases_(scope, key) {
  var group = MEMBERS_HEADER_ALIASES[scope] || {};
  return group[key] || [];
}

function members_findHeaderIndexByAliases_(headersOrMap, aliases, opts) {
  var headerMap = Array.isArray(headersOrMap)
    ? members_buildHeaderMap_(headersOrMap, { normalize: true, oneBased: opts && opts.oneBased === true })
    : (headersOrMap || {});
  var list = Array.isArray(aliases) ? aliases : [aliases];

  for (var i = 0; i < list.length; i++) {
    var key = members_normalizeOffboardingHeader_(list[i]);
    if (Object.prototype.hasOwnProperty.call(headerMap, key)) {
      return headerMap[key];
    }
  }

  return opts && opts.notFoundValue != null ? opts.notFoundValue : -1;
}

function members_getRecordValueByAliases_(record, aliases) {
  var keys = Object.keys(record || {});
  var list = Array.isArray(aliases) ? aliases : [aliases];

  for (var i = 0; i < list.length; i++) {
    var target = members_normalizeOffboardingHeader_(list[i]);
    for (var j = 0; j < keys.length; j++) {
      if (members_normalizeOffboardingHeader_(keys[j]) === target) {
        return record[keys[j]];
      }
    }
  }

  return "";
}

function members_findRecordKeyByAliases_(record, aliases) {
  var keys = Object.keys(record || {});
  var list = Array.isArray(aliases) ? aliases : [aliases];

  for (var i = 0; i < list.length; i++) {
    var target = members_normalizeOffboardingHeader_(list[i]);
    for (var j = 0; j < keys.length; j++) {
      if (members_normalizeOffboardingHeader_(keys[j]) === target) {
        return keys[j];
      }
    }
  }

  return "";
}

function members_findPayloadValueByAliases_(payload, aliases) {
  return members_getRecordValueByAliases_(payload, aliases);
}

function members_adaptPayloadToSheetHeaders_(sheet, payload, aliasGroup) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function(h) { return String(h || "").trim(); });
  var adapted = {};
  var aliasesByScope = MEMBERS_HEADER_ALIASES[aliasGroup] || {};

  headers.forEach(function(header) {
    var normalizedHeader = members_normalizeOffboardingHeader_(header);
    var matchedValue = members_findPayloadValueByAliases_(payload, header);

    if (matchedValue !== "") {
      adapted[header] = matchedValue;
      return;
    }

    var aliasKeys = Object.keys(aliasesByScope);
    for (var i = 0; i < aliasKeys.length; i++) {
      var aliases = aliasesByScope[aliasKeys[i]];
      var aliasesNormalized = aliases.map(members_normalizeOffboardingHeader_);
      if (aliasesNormalized.indexOf(normalizedHeader) >= 0) {
        var value = members_findPayloadValueByAliases_(payload, aliases);
        if (value !== "") adapted[header] = value;
        return;
      }
    }
  });

  return adapted;
}

function members_getCurrentField_(record, key) {
  return members_getRecordValueByAliases_(record, members_getHeaderAliases_("current", key));
}

function members_backfillRecordAliases_(record) {
  var scopes = Object.keys(MEMBERS_HEADER_ALIASES);

  scopes.forEach(function(scope) {
    var group = MEMBERS_HEADER_ALIASES[scope] || {};
    Object.keys(group).forEach(function(key) {
      var aliases = group[key];
      var existingKey = members_findRecordKeyByAliases_(record, aliases);
      if (!existingKey) return;

      aliases.forEach(function(alias) {
        if (!Object.prototype.hasOwnProperty.call(record, alias)) {
          record[alias] = record[existingKey];
        }
      });
    });
  });

  return record;
}

function members_aliasesMatchKnownHeaderGroup_(header, aliases) {
  var normalizedHeader = members_normalizeOffboardingHeader_(header);
  var list = Array.isArray(aliases) ? aliases : [aliases];
  var normalizedAliases = list.map(members_normalizeOffboardingHeader_);
  var scopes = Object.keys(MEMBERS_HEADER_ALIASES);

  for (var s = 0; s < scopes.length; s++) {
    var group = MEMBERS_HEADER_ALIASES[scopes[s]] || {};
    var keys = Object.keys(group);

    for (var k = 0; k < keys.length; k++) {
      var aliasesList = group[keys[k]].map(members_normalizeOffboardingHeader_);
      if (
        aliasesList.indexOf(normalizedHeader) >= 0 &&
        normalizedAliases.some(function(alias) { return aliasesList.indexOf(alias) >= 0; })
      ) {
        return true;
      }
    }
  }

  return false;
}
