/***************************************
 * 08_members_sheet_ux.gs
 *
 * UX operacional das abas do modulo GEAPA - Membros.
 * - notas de cabecalho
 * - agrupamento visual por cores
 * - linha 1 congelada
 * - filtro
 * - dropdowns nas colunas fechadas, quando permitido
 * - compactacao visual de colunas longas
 ***************************************/

const MEMBERS_SHEET_UX = Object.freeze({
  colors: Object.freeze({
    identity: '#d9ead3',
    academic: '#d0e0e3',
    process: '#fff2cc',
    history: '#fce5cd',
    governance: '#ead1dc',
    operational: '#d9d2e9',
    neutralText: '#202124'
  }),
  dataRowHeight: 28,
  futureNotes: Object.freeze({
    name: 'Nome da pessoa em processo de ingresso no GEAPA.',
    enrollmentSemester: 'Semestre de inscricao original vindo do seletivo ou formulario. Ex.: 2026/1.',
    rga: 'RGA usado para identidade academica e deduplicacao.',
    cpf: 'CPF do candidato. Use apenas numeros ou o formato padrao da planilha.',
    phone: 'Telefone principal para contato rapido.',
    email: 'Email principal usado nos convites e confirmacoes.',
    birthDate: 'Data de nascimento da pessoa.',
    instagram: 'Instagram informado pela pessoa, se houver.',
    naturality: 'Naturalidade declarada no ingresso.',
    sex: 'Sexo informado na inscricao.',
    academicHistory: 'Historico academico livre trazido da inscricao.',
    currentSemester: 'Semestre atual do aluno calculado pelo sistema com base no RGA informado.',
    status: 'Status cadastral do registro no fluxo de membros. Ex.: Em Espera, Integrado.',
    processStatus: 'Etapa operacional do convite. Ex.: Enviar e-mail, E-mail enviado, Aceitou, Integrado.',
    sentAt: 'Data e hora em que o convite inicial foi enviado.',
    threadId: 'Thread do Gmail associada ao convite centralizado.',
    repliedAt: 'Data e hora da resposta ACEITO ou RECUSO.',
    messageId: 'MessageId da resposta usada no processamento.',
    notes: 'Campo livre para observacoes do processo de ingresso.',
    entrySemester: 'Semestre em que a entrada no grupo foi efetivada.',
    integratedAt: 'Data da integracao em MEMBERS_ATUAIS.'
  }),
  currentNotes: Object.freeze({
    name: 'Nome oficial do membro ativo.',
    rga: 'RGA do membro usado em cruzamentos e governanca.',
    cpf: 'CPF do membro.',
    phone: 'Telefone principal para contato.',
    email: 'Email principal do membro ativo.',
    birthDate: 'Data de nascimento. Usada em fluxos comemorativos.',
    instagram: 'Instagram do membro, quando informado.',
    naturality: 'Naturalidade do membro.',
    academicHistory: 'Historico academico resumido do membro.',
    integratedAt: 'Data oficial de integracao ao grupo.',
    effectiveGroupTime: 'Texto derivado com o tempo efetivo no grupo.',
    entrySemester: 'Semestre em que o membro entrou no GEAPA.',
    semesterCount: 'Quantidade de semestres completos no grupo.',
    currentSemester: 'Semestre atual do aluno calculado pelo sistema com base no RGA informado.',
    presentationCount: 'Quantidade de apresentacoes ja realizadas.',
    diretoriaDays: 'Quantidade acumulada de dias em cargos de diretoria.',
    currentRole: 'Cargo ou funcao atual no grupo.',
    sex: 'Sexo do membro.',
    suspended: 'Indica se o membro ja foi suspenso anteriormente.',
    status: 'Status cadastral do membro. Ex.: Ativo, Suspenso, Desligado.'
  }),
  histNotes: Object.freeze({
    name: 'Nome do ex-membro registrado no historico.',
    rga: 'RGA preservado para trilha historica.',
    cpf: 'CPF do ex-membro.',
    phone: 'Telefone registrado no historico.',
    email: 'Email registrado no historico.',
    birthDate: 'Data de nascimento preservada para referencia.',
    sex: 'Sexo preservado no historico do ex-membro.',
    instagram: 'Instagram preservado no historico.',
    naturality: 'Naturalidade preservada no historico.',
    academicHistory: 'Historico academico trazido do cadastro original.',
    integratedAt: 'Data em que a pessoa entrou no GEAPA.',
    entrySemester: 'Semestre de entrada.',
    effectiveGroupTime: 'Tempo efetivo de permanencia no grupo.',
    finalStatus: 'Status final homologado. Ex.: Desligado homologado.',
    requestAt: 'Data da solicitacao ou disparo do desligamento.',
    exitSemester: 'Semestre de saida.',
    semesterCount: 'Quantidade de semestres completos no grupo ate a saida.',
    approvedAt: 'Data de homologacao do desligamento.',
    reason: 'Motivo oficial do desligamento.',
    wasDirector: 'Indica se a pessoa passou pela diretoria.',
    internalNote: 'Observacao interna do historico.',
    status: 'Status do registro historico.'
  }),
  seletivoInscricaoNotes: Object.freeze({
    'Nome': 'Nome do candidato vindo da inscricao do seletivo.',
    'RGA': 'RGA informado no seletivo.',
    'EMAIL': 'Email principal informado no seletivo.',
    'CPF': 'CPF informado na inscricao.',
    'Telefone': 'Telefone informado na inscricao.',
    'Semestre atual': 'Semestre atual do aluno calculado pelo sistema com base no RGA informado.',
    'Data de nascimento': 'Data de nascimento informada na inscricao.'
  }),
  seletivoAvaliacaoNotes: Object.freeze({
    'RGA': 'RGA usado para localizar a inscricao correspondente.',
    'EMAIL': 'Email de referencia do candidato.',
    'Resultado Final': 'Resultado usado pelo importador de membros. Ex.: Aprovado imediato ou Aprovado em espera.',
    'Processado integracao': 'Controle tecnico do importador. Indica se a linha ja foi consumida pelo modulo.',
    'Data integracao sistema': 'Momento em que a linha do seletivo foi integrada pelo sistema.'
  }),
  chapaNotes: Object.freeze({
    'Carimbo de data/hora': 'Momento de envio da inscricao da chapa.',
    'Endereco de e-mail': 'Email do remetente da inscricao.',
    'Nome do candidato a Presidente': 'Nome informado para o cargo de Presidente.',
    'RGA do candidato a Presidente': 'RGA do candidato a Presidente.',
    'Nome do candidato a Vice-Presidente': 'Nome informado para o cargo de Vice-Presidente.',
    'RGA do candidato a Vice-presidente': 'RGA do candidato a Vice-Presidente.',
    'Proposta Basica de Gestao': 'Resumo da proposta apresentada pela chapa.',
    'Status Presidente': 'Resultado automatico da checagem do candidato a Presidente. Valores esperados: DEFERIDA ou INDEFERIDA.',
    'Motivos Presidente': 'Justificativas automaticas relacionadas ao candidato a Presidente.',
    'Status Vice': 'Resultado automatico da checagem do candidato a Vice. Valores esperados: DEFERIDA ou INDEFERIDA.',
    'Motivos Vice': 'Justificativas automaticas relacionadas ao candidato a Vice.',
    'Status da Chapa': 'Resultado automatico da chapa apos analisar Presidente e Vice. Valores: DEFERIDA ou INDEFERIDA.',
    'Motivos da Chapa': 'Consolidado das justificativas automaticas da chapa.',
    'Parecer automatico': 'Parecer textual gerado pelo modulo com base na analise objetiva.',
    'Data/Hora da analise': 'Momento em que a analise automatica foi executada.',
    'Resultado final': 'Decisao final do processo eleitoral. Valores possiveis: INDEFERIDA, ELEITA, NAO ELEITA ou CANCELADA.',
    'Data/Hora resultado final': 'Momento em que o resultado final foi definido.',
    'Data/Hora cancelamento': 'Momento em que a chapa foi marcada como cancelada.',
    'E-mail cancelamento enviado?': 'Controle tecnico do email de cancelamento. Valores: SIM ou NAO.',
    'E-mail resultado enviado?': 'Controle tecnico do email de deferimento ou indeferimento.',
    'Diretoria registrada?': 'Indica se a diretoria da chapa eleita ja foi registrada. Valores: SIM ou NAO.',
    'Observacao da diretoria': 'Campo livre para anotacoes manuais da diretoria.',
    'E-mail chapa eleita enviado?': 'Controle tecnico do email da chapa eleita. Valores: SIM ou NAO.',
    'Data/Hora e-mail chapa eleita': 'Momento do envio do email da chapa eleita.'
  }),
  futureGroups: Object.freeze([
    Object.freeze({ color: '#d9ead3', keys: ['name', 'rga', 'cpf', 'phone', 'email', 'birthDate', 'instagram', 'naturality', 'sex'] }),
    Object.freeze({ color: '#d0e0e3', keys: ['enrollmentSemester', 'academicHistory', 'currentSemester', 'entrySemester'] }),
    Object.freeze({ color: '#fff2cc', keys: ['status', 'processStatus', 'sentAt', 'threadId', 'repliedAt', 'messageId', 'integratedAt'] }),
    Object.freeze({ color: '#ead1dc', keys: ['notes'] })
  ]),
  currentGroups: Object.freeze([
    Object.freeze({ color: '#d9ead3', keys: ['name', 'rga', 'cpf', 'phone', 'email', 'birthDate', 'instagram', 'naturality', 'sex'] }),
    Object.freeze({ color: '#d0e0e3', keys: ['entrySemester', 'currentSemester', 'semesterCount', 'presentationCount', 'effectiveGroupTime'] }),
    Object.freeze({ color: '#fff2cc', keys: ['currentRole', 'diretoriaDays', 'suspended', 'status'] }),
    Object.freeze({ color: '#ead1dc', keys: ['integratedAt', 'academicHistory'] })
  ]),
  histGroups: Object.freeze([
    Object.freeze({ color: '#d9ead3', keys: ['name', 'rga', 'cpf', 'phone', 'email', 'birthDate', 'sex', 'instagram', 'naturality'] }),
    Object.freeze({ color: '#d0e0e3', keys: ['integratedAt', 'entrySemester', 'exitSemester', 'semesterCount', 'effectiveGroupTime'] }),
    Object.freeze({ color: '#fff2cc', keys: ['finalStatus', 'requestAt', 'approvedAt', 'reason'] }),
    Object.freeze({ color: '#ead1dc', keys: ['wasDirector', 'internalNote', 'status', 'academicHistory'] })
  ]),
  seletivoInscricaoGroups: Object.freeze([
    Object.freeze({ color: '#d9ead3', headers: ['Nome', 'RGA', 'CPF', 'Telefone', 'EMAIL', 'Data de nascimento'] }),
    Object.freeze({ color: '#d0e0e3', headers: ['Semestre atual'] })
  ]),
  seletivoAvaliacaoGroups: Object.freeze([
    Object.freeze({ color: '#d9ead3', headers: ['RGA', 'EMAIL'] }),
    Object.freeze({ color: '#fff2cc', headers: ['Resultado Final', 'Processado integracao', 'Data integracao sistema'] })
  ]),
  chapaGroups: Object.freeze([
    Object.freeze({ color: '#d9ead3', headers: ['Carimbo de data/hora', 'Endereco de e-mail', 'Nome do candidato a Presidente', 'RGA do candidato a Presidente', 'Nome do candidato a Vice-Presidente', 'RGA do candidato a Vice-presidente'] }),
    Object.freeze({ color: '#d0e0e3', headers: ['Proposta Basica de Gestao'] }),
    Object.freeze({ color: '#fff2cc', headers: ['Status Presidente', 'Motivos Presidente', 'Status Vice', 'Motivos Vice', 'Status da Chapa', 'Motivos da Chapa', 'Parecer automatico', 'Data/Hora da analise'] }),
    Object.freeze({ color: '#ead1dc', headers: ['Resultado final', 'Data/Hora resultado final', 'Data/Hora cancelamento', 'Observacao da diretoria'] }),
    Object.freeze({ color: '#d9d2e9', headers: ['E-mail cancelamento enviado?', 'E-mail resultado enviado?', 'Diretoria registrada?', 'E-mail chapa eleita enviado?', 'Data/Hora e-mail chapa eleita'] })
  ])
});

function applyMembersSheetUx() {
  return members_applySheetUx_();
}

function reapplyMembersSheetUx() {
  return members_applySheetUx_();
}

function applyMembersFutureSheetUx() {
  return members_applyFutureSheetUx_();
}

function applyMembersCurrentSheetUx() {
  return members_applyCurrentSheetUx_();
}

function applyMembersHistorySheetUx() {
  return members_applyHistorySheetUx_();
}

function applyMembersSeletivoSheetUx() {
  return Object.freeze({
    ok: true,
    inscricao: members_applySeletivoInscricaoSheetUx_(),
    avaliacao: members_applySeletivoAvaliacaoSheetUx_()
  });
}

function applyMembersChapasSheetUx() {
  return members_applyChapasSheetUx_();
}

function members_applySheetUx_() {
  return Object.freeze({
    ok: true,
    future: members_applyFutureSheetUx_(),
    current: members_applyCurrentSheetUx_(),
    history: members_applyHistorySheetUx_(),
    seletivoInscricao: members_applySeletivoInscricaoSheetUx_(),
    seletivoAvaliacao: members_applySeletivoAvaliacaoSheetUx_(),
    chapas: members_applyChapasSheetUx_()
  });
}

function members_applyFutureSheetUx_() {
  return members_applyAliasedSheetUx_(SETTINGS.futureKey, 'future', MEMBERS_SHEET_UX.futureNotes, MEMBERS_SHEET_UX.futureGroups, {
    'Status': { values: [SETTINGS.values.waiting, SETTINGS.values.active, SETTINGS.values.integrated, SETTINGS.values.disqualified], allowInvalid: true, helpText: 'Status cadastral sugerido para MEMBERS_FUTURO.' },
    'Status do processo': { values: [SETTINGS.values.sendEmail, SETTINGS.values.emailed, SETTINGS.values.accepted, SETTINGS.values.refused, SETTINGS.values.integrated, SETTINGS.values.expired, SETTINGS.seletivo.waitingProcessStatus], allowInvalid: true, helpText: 'Etapas operacionais conhecidas do fluxo de ingresso.' }
  }, {
    compactTextHeaders: ['Observacoes do processo', 'Observacoes do processo', 'Participa/Participou de algum/alguns laboratorio(s), projeto(s), pesquisa(s), empresa junior, monitoria, etc? se sim, citar qual/quais.']
  });
}

function members_applyCurrentSheetUx_() {
  return members_applyAliasedSheetUx_(SETTINGS.currentKey, 'current', MEMBERS_SHEET_UX.currentNotes, MEMBERS_SHEET_UX.currentGroups, {
    'Status': { values: [SETTINGS.values.active, SETTINGS.values.suspended, SETTINGS.values.offboarded], allowInvalid: true, helpText: 'Status cadastral sugerido para MEMBERS_ATUAIS.' }
  }, {
    compactTextHeaders: ['TEMPO_EFETIVO_NO_GRUPO', 'Participa/Participou de algum/alguns laboratorio(s), projeto(s), pesquisa(s), empresa junior, monitoria, etc? se sim, citar qual/quais.']
  });
}

function members_applyHistorySheetUx_() {
  return members_applyAliasedSheetUx_(SETTINGS.histKey, 'hist', MEMBERS_SHEET_UX.histNotes, MEMBERS_SHEET_UX.histGroups, {
    'Status final': { values: [SETTINGS.offboarding.histStatus], allowInvalid: true, helpText: 'Status final homologado esperado no historico.' }
  }, {
    compactTextHeaders: ['Motivo', 'Observacao interna', 'Participa/Participou de algum/alguns laboratorio(s), projeto(s), pesquisa(s), empresa junior, monitoria, etc? se sim, citar qual/quais.']
  });
}

function members_applySeletivoInscricaoSheetUx_() {
  return members_applyExactSheetUx_(SETTINGS.seletivo.inscricaoKey, MEMBERS_SHEET_UX.seletivoInscricaoNotes, MEMBERS_SHEET_UX.seletivoInscricaoGroups, {}, {
    compactTextHeaders: ['Nome', 'EMAIL']
  });
}

function members_applySeletivoAvaliacaoSheetUx_() {
  return members_applyExactSheetUx_(SETTINGS.seletivo.avaliacaoKey, MEMBERS_SHEET_UX.seletivoAvaliacaoNotes, MEMBERS_SHEET_UX.seletivoAvaliacaoGroups, {
    'Resultado Final': {
      values: [SETTINGS.seletivo.resultadoAprovadoImediato, SETTINGS.seletivo.resultadoAprovadoEspera],
      allowInvalid: true,
      helpText: 'Resultados conhecidos consumidos pelo importador de membros.'
    },
    'Processado integracao': {
      values: ['SIM', 'NAO'],
      allowInvalid: true,
      helpText: 'Controle tecnico do importador. Valores sugeridos: SIM ou NAO.'
    }
  }, {});
}

function members_applyChapasSheetUx_() {
  var yesValue = SETTINGS.election.emailSentYes || 'SIM';
  var noValue = SETTINGS.election.emailSentNo || 'NAO';
  return members_applyExactSheetUx_(SETTINGS.election.chapaKey, MEMBERS_SHEET_UX.chapaNotes, MEMBERS_SHEET_UX.chapaGroups, {
    'Status Presidente': { values: [SETTINGS.election.statusDeferida, SETTINGS.election.statusIndeferida], allowInvalid: true, helpText: 'Resultado automatico esperado para o Presidente.' },
    'Status Vice': { values: [SETTINGS.election.statusDeferida, SETTINGS.election.statusIndeferida], allowInvalid: true, helpText: 'Resultado automatico esperado para o Vice.' },
    'Status da Chapa': { values: [SETTINGS.election.statusDeferida, SETTINGS.election.statusIndeferida], allowInvalid: true, helpText: 'Resultado automatico consolidado da chapa.' },
    'Resultado final': { values: [SETTINGS.election.statusIndeferida, SETTINGS.election.statusEleita, SETTINGS.election.statusNaoEleita, SETTINGS.election.statusCancelada], allowInvalid: true, helpText: 'Decisao final manual ou automatica do processo eleitoral.' },
    'E-mail cancelamento enviado?': { values: [yesValue, noValue], allowInvalid: true, helpText: 'Controle tecnico do envio do cancelamento.' },
    'E-mail resultado enviado?': { values: [yesValue, noValue], allowInvalid: true, helpText: 'Controle tecnico do email de resultado.' },
    'Diretoria registrada?': { values: [SETTINGS.election.registeredYes || 'SIM', SETTINGS.election.registeredNo || 'NAO'], allowInvalid: true, helpText: 'Controle tecnico do registro da diretoria.' },
    'E-mail chapa eleita enviado?': { values: [yesValue, noValue], allowInvalid: true, helpText: 'Controle tecnico do email da chapa eleita.' }
  }, {
    compactTextHeaders: ['Proposta Basica de Gestao', 'Motivos Presidente', 'Motivos Vice', 'Motivos da Chapa', 'Parecer automatico', 'Observacao da diretoria']
  });
}

function members_applyAliasedSheetUx_(key, scope, notesByKey, groupDefs, validationByHeader, opts) {
  var sheet = members_getSheetByKeyForUx_(key);
  if (!sheet) return members_buildMissingSheetUxResult_(key);

  var headers = members_getSheetHeadersForUx_(sheet);
  var resolvedNotes = members_resolveNotesByAliases_(headers, scope, notesByKey || {});
  var resolvedGroups = members_resolveColorGroupsByAliases_(headers, scope, groupDefs || []);
  var resolvedValidation = members_resolveValidationRulesByHeader_(headers, validationByHeader || {});
  return members_applySheetPresentation_(sheet, resolvedNotes, resolvedGroups, resolvedValidation, opts || {});
}

function members_applyExactSheetUx_(key, notesMap, groupDefs, validationByHeader, opts) {
  var sheet = members_getSheetByKeyForUx_(key);
  if (!sheet) return members_buildMissingSheetUxResult_(key);

  var headers = members_getSheetHeadersForUx_(sheet);
  var resolvedNotes = members_resolveExactNotes_(headers, notesMap || {});
  var resolvedGroups = members_resolveExactColorGroups_(headers, groupDefs || []);
  var resolvedValidation = members_resolveValidationRulesByHeader_(headers, validationByHeader || {});
  return members_applySheetPresentation_(sheet, resolvedNotes, resolvedGroups, resolvedValidation, opts || {});
}

function members_applySheetPresentation_(sheet, notesMap, colorGroups, validationRules, opts) {
  opts = opts || {};
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var operations = [];

  operations.push(members_trySheetUxOperation_(sheet, 'freezeHeaderRow', function() {
    if (members_coreHas_('coreFreezeHeaderRow')) {
      GEAPA_CORE.coreFreezeHeaderRow(sheet, 1);
    } else {
      sheet.setFrozenRows(1);
    }
  }));

  operations.push(members_trySheetUxOperation_(sheet, 'headerNotes', function() {
    if (members_coreHas_('coreApplyHeaderNotes')) {
      GEAPA_CORE.coreApplyHeaderNotes(sheet, notesMap || {}, 1);
    } else {
      members_applyHeaderNotesFallback_(sheet, notesMap || {});
    }
  }));

  operations.push(members_trySheetUxOperation_(sheet, 'headerStyles', function() {
    if (members_coreHas_('coreApplyHeaderColors')) {
      GEAPA_CORE.coreApplyHeaderColors(sheet, colorGroups || [], 1, {
        defaultColor: '#f3f3f3',
        fontColor: MEMBERS_SHEET_UX.colors.neutralText,
        fontWeight: 'bold',
        wrap: true
      });
    } else {
      members_applyHeaderColorsFallback_(sheet, colorGroups || []);
    }
  }));

  operations.push(members_trySheetUxOperation_(sheet, 'filter', function() {
    if (members_coreHas_('coreEnsureFilter')) {
      GEAPA_CORE.coreEnsureFilter(sheet, 1, {});
    } else {
      members_ensureFilterFallback_(sheet);
    }
  }));

  operations.push(members_trySheetUxOperation_(sheet, 'compactLongText', function() {
    members_applyCompactTextUx_(sheet, opts.compactTextHeaders || [], MEMBERS_SHEET_UX.dataRowHeight);
  }));

  operations.push(members_trySheetUxOperation_(sheet, 'dropdownValidation', function() {
    if (!validationRules || !Object.keys(validationRules).length) return;
    if (members_coreHas_('coreApplyDropdownValidationByHeader')) {
      GEAPA_CORE.coreApplyDropdownValidationByHeader(sheet, validationRules, 1, {});
    } else {
      members_applyDropdownValidationFallback_(sheet, validationRules);
    }
  }));

  return Object.freeze({
    ok: true,
    sheetName: sheet.getName(),
    lastColumn: lastColumn,
    lastRow: lastRow,
    operations: Object.freeze(operations)
  });
}

function members_trySheetUxOperation_(sheet, operation, fn) {
  try {
    fn();
    return Object.freeze({ operation: operation, status: 'APPLIED' });
  } catch (err) {
    if (members_isTypedColumnsRestrictionError_(err)) {
      return Object.freeze({
        operation: operation,
        status: 'SKIPPED_TYPED_COLUMNS',
        reason: err && err.message ? err.message : String(err || 'Operacao nao permitida em colunas com tipo.')
      });
    }
    throw err;
  }
}

function members_applyCompactTextUx_(sheet, headerNames, rowHeight) {
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  if (lastRow > 1) {
    sheet.setRowHeightsForced(2, lastRow - 1, Math.max(24, Number(rowHeight || MEMBERS_SHEET_UX.dataRowHeight || 28)));
  }

  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(item) {
    return String(item || '').trim();
  });
  var targets = members_findExistingHeadersByNormalizedNames_(headers, headerNames || []);
  if (!targets.length || lastRow < 2) return;

  targets.forEach(function(header) {
    var col = members_findHeaderIndexExact_(headers, header);
    if (col < 0) return;
    sheet.getRange(2, col + 1, lastRow - 1, 1)
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP)
      .setVerticalAlignment('middle');
  });
}

function members_applyHeaderNotesFallback_(sheet, notesByHeader) {
  var headers = members_getSheetHeadersForUx_(sheet);
  var row = headers.map(function(header) {
    return String((notesByHeader || {})[header] || '');
  });
  sheet.getRange(1, 1, 1, Math.max(headers.length, 1)).setNotes([row]);
}

function members_applyHeaderColorsFallback_(sheet, groups) {
  var headers = members_getSheetHeadersForUx_(sheet);
  var backgrounds = headers.map(function(header) {
    return members_findHeaderGroupColorForUx_(header, groups || [], '#f3f3f3');
  });
  sheet.getRange(1, 1, 1, Math.max(headers.length, 1))
    .setBackgrounds([backgrounds])
    .setFontColor(MEMBERS_SHEET_UX.colors.neutralText)
    .setFontWeight('bold')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
}

function members_applyDropdownValidationFallback_(sheet, validationRules) {
  var headers = members_getSheetHeadersForUx_(sheet);
  var lastRow = Math.max(sheet.getMaxRows(), 2);

  Object.keys(validationRules || {}).forEach(function(headerName) {
    var rule = validationRules[headerName] || {};
    var values = Array.isArray(rule.values) ? rule.values.filter(function(item) {
      return String(item || '').trim() !== '';
    }) : [];
    if (!values.length) return;

    var col = members_findHeaderIndexExact_(headers, headerName);
    if (col < 0) return;

    var builder = SpreadsheetApp.newDataValidation()
      .requireValueInList(values, true)
      .setAllowInvalid(rule.allowInvalid !== false);

    if (rule.helpText) {
      builder.setHelpText(String(rule.helpText));
    }

    sheet.getRange(2, col + 1, Math.max(lastRow - 1, 1), 1).setDataValidation(builder.build());
  });
}

function members_ensureFilterFallback_(sheet) {
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var lastRow = Math.max(sheet.getLastRow(), 2);
  var filter = sheet.getFilter();
  if (filter) return;
  sheet.getRange(1, 1, lastRow, lastColumn).createFilter();
}

function members_resolveNotesByAliases_(headers, scope, notesByKey) {
  var resolved = {};
  headers.forEach(function(header) {
    if (!header) return;
    var logicalKey = members_resolveAliasLogicalKey_(scope, header);
    if (logicalKey && notesByKey[logicalKey]) {
      resolved[header] = notesByKey[logicalKey];
      return;
    }
    if (Object.prototype.hasOwnProperty.call(notesByKey, header)) {
      resolved[header] = notesByKey[header];
    }
  });
  return resolved;
}

function members_resolveExactNotes_(headers, notesMap) {
  var resolved = {};
  var normalizedNotes = {};

  Object.keys(notesMap || {}).forEach(function(header) {
    normalizedNotes[members_normalizeHeaderForUx_(header)] = notesMap[header];
  });

  headers.forEach(function(header) {
    var normalizedHeader = members_normalizeHeaderForUx_(header);
    if (header && Object.prototype.hasOwnProperty.call(normalizedNotes, normalizedHeader)) {
      resolved[header] = normalizedNotes[normalizedHeader];
    }
  });
  return resolved;
}

function members_resolveColorGroupsByAliases_(headers, scope, groupDefs) {
  return (groupDefs || []).map(function(group) {
    var actualHeaders = headers.filter(function(header) {
      var logicalKey = members_resolveAliasLogicalKey_(scope, header);
      return logicalKey && Array.isArray(group.keys) && group.keys.indexOf(logicalKey) >= 0;
    });
    return Object.freeze({ color: group.color, headers: actualHeaders });
  }).filter(function(group) {
    return group.headers.length > 0;
  });
}

function members_resolveExactColorGroups_(headers, groupDefs) {
  return (groupDefs || []).map(function(group) {
    var normalizedGroupHeaders = Array.isArray(group.headers)
      ? group.headers.map(members_normalizeHeaderForUx_)
      : [];
    return Object.freeze({
      color: group.color,
      headers: headers.filter(function(header) {
        return normalizedGroupHeaders.indexOf(members_normalizeHeaderForUx_(header)) >= 0;
      })
    });
  }).filter(function(group) {
    return group.headers.length > 0;
  });
}

function members_resolveValidationRulesByHeader_(headers, validationByHeader) {
  var resolved = {};
  Object.keys(validationByHeader || {}).forEach(function(headerName) {
    var actualHeader = members_findFirstMatchingHeader_(headers, headerName);
    if (!actualHeader) return;
    resolved[actualHeader] = validationByHeader[headerName];
  });
  return resolved;
}

function members_resolveAliasLogicalKey_(scope, header) {
  var group = MEMBERS_HEADER_ALIASES[scope] || {};
  var normalizedHeader = members_normalizeHeaderForUx_(header);
  var keys = Object.keys(group);

  for (var i = 0; i < keys.length; i++) {
    var aliases = group[keys[i]] || [];
    for (var j = 0; j < aliases.length; j++) {
      if (members_normalizeHeaderForUx_(aliases[j]) === normalizedHeader) {
        return keys[i];
      }
    }
  }

  return '';
}

function members_findExistingHeadersByNormalizedNames_(headers, headerNames) {
  var wanted = (headerNames || []).map(members_normalizeHeaderForUx_);
  return headers.filter(function(header) {
    return wanted.indexOf(members_normalizeHeaderForUx_(header)) >= 0;
  });
}

function members_findFirstMatchingHeader_(headers, expectedHeader) {
  var expected = members_normalizeHeaderForUx_(expectedHeader);
  for (var i = 0; i < headers.length; i++) {
    if (members_normalizeHeaderForUx_(headers[i]) === expected) {
      return headers[i];
    }
  }
  return '';
}

function members_findHeaderIndexExact_(headers, expectedHeader) {
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i] || '').trim() === String(expectedHeader || '').trim()) {
      return i;
    }
  }
  return -1;
}

function members_findHeaderGroupColorForUx_(header, groups, defaultColor) {
  for (var i = 0; i < groups.length; i++) {
    var group = groups[i] || {};
    if (Array.isArray(group.headers) && group.headers.indexOf(header) >= 0) {
      return String(group.color || defaultColor || '#f3f3f3');
    }
  }
  return defaultColor || '#f3f3f3';
}

function members_getSheetHeadersForUx_(sheet) {
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(header) {
    return String(header || '').trim();
  });
}

function members_getSheetByKeyForUx_(key) {
  try {
    members_assertCore_();
    return GEAPA_CORE.coreGetSheetByKey(key);
  } catch (err) {
    return null;
  }
}

function members_buildMissingSheetUxResult_(key) {
  return Object.freeze({
    ok: true,
    missing: true,
    registryKey: key,
    reason: 'Sheet nao encontrada via registry.'
  });
}

function members_isTypedColumnsRestrictionError_(err) {
  var msg = String(err && err.message ? err.message : err || '');
  var normalized = members_normalizeHeaderForUx_(msg);
  return normalized.indexOf('colunas com tipo') >= 0 || normalized.indexOf('columns with type') >= 0;
}

function members_normalizeHeaderForUx_(value) {
  return members_normalizeTextCompat_(value, {
    removeAccents: true,
    collapseWhitespace: true,
    caseMode: 'lower'
  });
}
