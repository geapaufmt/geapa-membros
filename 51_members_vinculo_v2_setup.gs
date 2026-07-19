/** Setups administrativos. Todos usam dry-run por padrao. */

function membersVinculoSetupOptions_(options) {
  options = options || {};
  var environment = membersVinculoToken_(options.ambiente || options.environment);
  if (environment !== 'DEV' && environment !== 'PROD') throw membersVinculoError_('AMBIENTE_VINCULO_INVALIDO', 'Informe DEV ou PROD explicitamente.', {});
  return { ambiente: environment, dryRun: options.dryRun !== false, confirmacao: String(options.confirmacao || '').trim(), spreadsheet: options.spreadsheet || null };
}

function membersVinculoSetupSolicitacoesV2(options) {
  var opts = membersVinculoSetupOptions_(options);
  var report = { ok: true, dryRun: opts.dryRun, ambiente: opts.ambiente, sheetName: MEMBERS_VINCULO_CFG.sheetName, created: false, headersAdded: [], missingHeaders: [], uxPlanned: true, validationsPlanned: true, writes: 0 };
  var spreadsheet = opts.spreadsheet;
  if (!spreadsheet) {
    if (typeof GEAPA_CORE === 'undefined' || !GEAPA_CORE || typeof GEAPA_CORE.coreGetDomainSpreadsheet !== 'function') throw membersVinculoError_('CORE_DOMINIO_V2_INDISPONIVEL', 'Core V2 indisponivel para o setup.', {});
    spreadsheet = GEAPA_CORE.coreGetDomainSpreadsheet('PESSOAS', { ambiente: opts.ambiente, forWrite: true });
  }
  var sheet = spreadsheet.getSheetByName(MEMBERS_VINCULO_CFG.sheetName);
  if (!sheet) {
    report.created = true;
    report.missingHeaders = MEMBERS_VINCULO_HEADERS.slice();
    if (opts.dryRun) return report;
    var confirmation = 'CRIAR_SOLICITACOES_VINCULO_' + opts.ambiente;
    if (opts.confirmacao !== confirmation) throw membersVinculoError_('CONFIRMACAO_SETUP_OBRIGATORIA', 'Confirme explicitamente o setup ' + opts.ambiente + '.', { confirmacaoEsperada: confirmation });
    sheet = spreadsheet.insertSheet(MEMBERS_VINCULO_CFG.sheetName);
    sheet.getRange(1, 1, 1, MEMBERS_VINCULO_HEADERS.length).setValues([MEMBERS_VINCULO_HEADERS]);
    report.headersAdded = MEMBERS_VINCULO_HEADERS.slice(); report.writes++;
  } else {
    var headers = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(value) { return String(value || '').trim(); }) : [];
    report.missingHeaders = MEMBERS_VINCULO_HEADERS.filter(function(header) { return headers.indexOf(header) < 0; });
    if (!opts.dryRun && report.missingHeaders.length) {
      var headerConfirmation = 'ATUALIZAR_CABECALHOS_SOLICITACOES_VINCULO_' + opts.ambiente;
      if (opts.confirmacao !== headerConfirmation) throw membersVinculoError_('CONFIRMACAO_SETUP_OBRIGATORIA', 'Confirme explicitamente a adicao de cabecalhos.', { confirmacaoEsperada: headerConfirmation });
      sheet.getRange(1, headers.length + 1, 1, report.missingHeaders.length).setValues([report.missingHeaders]);
      report.headersAdded = report.missingHeaders.slice(); report.writes++;
    }
  }
  if (!opts.dryRun) membersVinculoApplySheetUx_(sheet);
  return report;
}

function membersVinculoApplySheetUx_(sheet) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold').setBackground('#d9ead3');
  if (!sheet.getFilter() && sheet.getLastRow() >= 1) sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), sheet.getLastColumn()).createFilter();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  function rule(header, values) {
    var index = headers.indexOf(header); if (index < 0) return;
    sheet.getRange(2, index + 1, Math.max(1, sheet.getMaxRows() - 1), 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build());
  }
  rule('TIPO_SOLICITACAO', Object.keys(MEMBERS_VINCULO_CFG.types).map(function(key) { return MEMBERS_VINCULO_CFG.types[key]; }));
  rule('MODALIDADE_SOLICITADA', Object.keys(MEMBERS_VINCULO_CFG.modalities).map(function(key) { return MEMBERS_VINCULO_CFG.modalities[key]; }));
  rule('STATUS_SOLICITACAO', Object.keys(MEMBERS_VINCULO_CFG.statuses).map(function(key) { return MEMBERS_VINCULO_CFG.statuses[key]; }));
  rule('ATIVO', ['SIM','NAO']);
}

function membersVinculoSetupEventoIdVinculoV2(options) {
  var opts = membersVinculoSetupOptions_(options);
  var deps = options && options.__deps || membersVinculoDependencies_({});
  var source = deps.openSource('PESSOAS', 'EVENTOS', opts.ambiente, !opts.dryRun);
  var missing = source.headers.indexOf(MEMBERS_VINCULO_EVENT_ID_VINCULO_HEADER) < 0;
  var report = { ok: true, dryRun: opts.dryRun, ambiente: opts.ambiente, header: MEMBERS_VINCULO_EVENT_ID_VINCULO_HEADER, missing: missing, writes: 0, backfill: 'Somente quando a origem historica permitir associacao inequivoca; eventos antigos nao serao reescritos automaticamente.' };
  if (missing && !opts.dryRun) {
    if (opts.confirmacao !== 'ADICIONAR_ID_VINCULO_EVENTOS_' + opts.ambiente) throw membersVinculoError_('CONFIRMACAO_SETUP_OBRIGATORIA', 'Confirme a migracao aditiva de ID_VINCULO.', {});
    source.sheet.getRange(1, source.headers.length + 1).setValue(MEMBERS_VINCULO_EVENT_ID_VINCULO_HEADER); report.writes++;
  }
  return report;
}

function membersVinculoSetupJobsV2(options) {
  var opts = membersVinculoSetupOptions_(options);
  var handler = opts.ambiente === 'DEV' ? 'membersVinculoJobProcessarDev' : 'membersVinculoJobProcessarProd';
  var report = { ok: true, dryRun: opts.dryRun, ambiente: opts.ambiente, handler: handler, frequency: 'DAILY', createsTrigger: !opts.dryRun, writes: 0 };
  if (opts.dryRun) return report;
  if (opts.confirmacao !== 'INSTALAR_JOB_SOLICITACOES_VINCULO_' + opts.ambiente) throw membersVinculoError_('CONFIRMACAO_SETUP_OBRIGATORIA', 'Confirme a instalacao futura do job.', {});
  ScriptApp.newTrigger(handler).timeBased().everyDays(1).atHour(6).create(); report.writes++;
  return report;
}

function membersVinculoAuditarRegistryV2(options) {
  var opts = membersVinculoSetupOptions_(options);
  var recommendations = [
    { KEY: MEMBERS_VINCULO_CFG.registryKey, SPREADSHEET_ID: '<PESSOAS_V2_DB_DEV_SPREADSHEET_ID>', SHEET_NAME: MEMBERS_VINCULO_CFG.sheetName, DISPLAY_NAME: 'PESSOAS v2 - DEV', ATIVO: 'SIM', TYPE: 'BASE', AMBIENTE: 'DEV' },
    { KEY: MEMBERS_VINCULO_CFG.registryKey, SPREADSHEET_ID: '<PESSOAS_V2_DB_PROD_SPREADSHEET_ID>', SHEET_NAME: MEMBERS_VINCULO_CFG.sheetName, DISPLAY_NAME: 'PESSOAS v2 - PROD', ATIVO: 'SIM', TYPE: 'BASE', AMBIENTE: 'PROD' }
  ];
  return { ok: true, dryRun: true, ambienteAuditado: opts.ambiente, writes: 0, registryRowsRecommended: recommendations, normativeRecommendation: {
    requiredForHomolog: true,
    requiredHeaders: ['PARAMETRO_ID','VALOR','TIPO_VALOR','UNIDADE','BASE_LEGAL','MODULO_SISTEMA','VIGENTE','AMBIENTE'],
    requiredRow: { PARAMETRO_ID: MEMBERS_VINCULO_CFG.normativeIds.dismissalFinalMinutes, VALOR: 'SIM', TIPO_VALOR: 'BOOLEANO', UNIDADE: 'NAO_APLICAVEL', BASE_LEGAL: 'NC01-2025-ART16-IV', MODULO_SISTEMA: 'GEAPA_MEMBROS', VIGENTE: 'SIM', AMBIENTE: opts.ambiente },
    options: ['Criar entrada DEV explicita para NORMAS_PARAMETROS_OPERACIONAIS.', 'Ou registrar a fonte institucional compartilhada e somente leitura explicitamente em DEV e PROD.'],
    forbidden: 'Fallback silencioso de HOMOLOG/DEV para PROD.'
  } };
}

function membersVinculoInventariarLegadoDryRun(options) {
  options = options || {};
  var rows = options.legacyRecords || [];
  return { ok: true, dryRun: true, writes: 0, runtimeDependencyCreated: false, total: rows.length, abertas: rows.filter(function(record) { return ['EXECUTADO','INDEFERIDO','CANCELADO'].indexOf(membersVinculoToken_(record.STATUS_SOLICITACAO || record.STATUS)) < 0; }).map(function(record) { return { idSolicitacao: record.ID_SOLICITACAO || '', tipo: record.TIPO_SOLICITACAO || '', status: record.STATUS_SOLICITACAO || record.STATUS || '' }; }), recommendation: 'Decidir migracao ou encerramento manual antes de bloquear Forms e triggers antigos.' };
}
