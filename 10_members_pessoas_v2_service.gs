/***************************************
 * 10_members_pessoas_v2_service.gs
 *
 * Camada incremental do dominio PESSOAS v2.
 *
 * Responsabilidade do modulo:
 * - refletir eventos homologados/processados de membros em Pessoas v2;
 * - manter vinculos e detalhes basicos de membros;
 * - recalcular o resumo operacional leve de Pessoas.
 *
 * O modulo nao decide frequencia, apresentacoes ou cargos/funcoes.
 ***************************************/

var MEMBERS_PESSOAS_V2_KEYS = Object.freeze({
  pessoasBase: Object.freeze(['PESSOAS_V2_BASE', 'PESSOAS_BASE']),
  identificadores: Object.freeze(['PESSOAS_V2_IDENTIFICADORES', 'PESSOAS_IDENTIFICADORES']),
  membrosDetalhes: Object.freeze(['PESSOAS_V2_MEMBROS_DETALHES', 'MEMBROS_DETALHES']),
  vinculos: Object.freeze(['PESSOAS_V2_VINCULOS_GEAPA', 'VINCULOS_GEAPA']),
  eventos: Object.freeze(['PESSOAS_V2_MEMBROS_EVENTOS_VINCULO', 'MEMBROS_EVENTOS_VINCULO']),
  resumo: Object.freeze(['PESSOAS_V2_RESUMO_OPERACIONAL', 'PESSOAS_RESUMO_OPERACIONAL'])
});

function members_pessoasV2Options_(opts) {
  opts = opts || {};
  return {
    dryRun: opts.dryRun !== false,
    confirmacao: String(opts.confirmacao || '').trim(),
    failOnUnavailable: opts.failOnUnavailable === true,
    sheets: opts.sheets || null
  };
}

function members_pessoasV2NewReport_(action, opts) {
  return {
    ok: true,
    action: action,
    dryRun: opts ? opts.dryRun : true,
    unavailable: false,
    errors: [],
    warnings: [],
    operations: [],
    resumoQuantitativo: {}
  };
}

function members_pessoasV2Issue_(report, severity, code, message, details) {
  var item = { code: code, message: message };
  if (details) item.details = details;
  if (severity === 'ERRO') {
    report.ok = false;
    report.errors.push(item);
  } else {
    report.warnings.push(item);
  }
}

function members_pessoasV2CallCoreApi_(coreFunctionName, options, action) {
  members_assertCore_();
  var opts = members_pessoasV2Options_(options || {});
  if (typeof GEAPA_CORE[coreFunctionName] !== 'function') {
    var report = members_pessoasV2NewReport_(action, opts);
    members_pessoasV2Issue_(report, 'AVISO', 'CORE_API_V2_INDISPONIVEL', 'GEAPA-CORE ainda nao expoe a API operacional v2 solicitada.', {
      coreFunctionName: coreFunctionName
    });
    return report;
  }
  return GEAPA_CORE[coreFunctionName](options || {});
}

function members_pessoasV2TrySheetByKeys_(keys, injectedSheets) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (injectedSheets && injectedSheets[key]) return injectedSheets[key];
    try {
      var sheet = GEAPA_CORE.coreGetSheetByKey(key);
      if (sheet) return sheet;
    } catch (err) {}
  }
  return null;
}

function members_pessoasV2Open_(opts, report) {
  members_assertCore_();
  var sheets = {};
  Object.keys(MEMBERS_PESSOAS_V2_KEYS).forEach(function(name) {
    sheets[name] = members_pessoasV2TrySheetByKeys_(MEMBERS_PESSOAS_V2_KEYS[name], opts.sheets);
    if (!sheets[name]) {
      members_pessoasV2Issue_(report, 'ERRO', 'PESSOAS_V2_ABA_INDISPONIVEL', 'Aba de Pessoas v2 indisponivel para o geapa-membros.', {
        logicalName: name,
        triedKeys: MEMBERS_PESSOAS_V2_KEYS[name]
      });
    }
  });

  if (report.errors.length) {
    report.unavailable = true;
    if (!opts.failOnUnavailable) {
      report.ok = true;
      report.errors = [];
      members_pessoasV2Issue_(report, 'AVISO', 'PESSOAS_V2_NAO_CONFIGURADO', 'Pessoas v2 ainda nao esta disponivel via Registry/Library; fluxo legado segue sem bloqueio.');
    }
  }
  return sheets;
}

function members_pessoasV2Read_(sheet) {
  return sheet ? members_readSheetRecordsCompat_(sheet, { skipBlankRows: true }) : [];
}

function members_pessoasV2Headers_(sheet) {
  if (!sheet || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function(header) { return String(header || '').trim(); });
}

function members_pessoasV2BuildRow_(headers, payload) {
  return headers.map(function(header) {
    return Object.prototype.hasOwnProperty.call(payload || {}, header) ? payload[header] : '';
  });
}

function members_pessoasV2Normalize_(value) {
  return members_normalizeKeyCompat_(value);
}

function members_pessoasV2Email_(value) {
  return members_normalizeEmailCompat_(value);
}

function members_pessoasV2RecordValue_(record, aliases) {
  return members_getRecordValueByAliases_(record || {}, aliases);
}

function members_pessoasV2FindPessoa_(records, identity) {
  var targetRga = String(identity.rga || '').trim();
  var targetEmail = members_pessoasV2Email_(identity.email);
  var targetName = members_pessoasV2Normalize_(identity.name);
  for (var i = records.length - 1; i >= 0; i--) {
    var record = records[i];
    var email = members_pessoasV2Email_(record.EMAIL_PRINCIPAL || record.EMAIL);
    var name = members_pessoasV2Normalize_(record.NOME_COMPLETO || record.NOME_EXIBICAO || record.NOME);
    if (targetEmail && email && targetEmail === email) return record;
    if (targetName && name && targetName === name) return record;
  }
  return null;
}

function members_pessoasV2FindPessoaByRga_(baseRecords, detalhesRecords, identity) {
  var targetRga = String(identity.rga || '').trim();
  if (!targetRga) return members_pessoasV2FindPessoa_(baseRecords, identity);
  for (var i = detalhesRecords.length - 1; i >= 0; i--) {
    if (String(detalhesRecords[i].RGA || '').trim() === targetRga) {
      var idPessoa = String(detalhesRecords[i].ID_PESSOA || '').trim();
      for (var b = 0; b < baseRecords.length; b++) {
        if (String(baseRecords[b].ID_PESSOA || '').trim() === idPessoa) return baseRecords[b];
      }
    }
  }
  return members_pessoasV2FindPessoa_(baseRecords, identity);
}

function members_pessoasV2SeqId_(records, field, prefix) {
  var max = 0;
  records.forEach(function(record) {
    var value = String(record[field] || '').trim();
    var match = value.match(new RegExp('^' + prefix + '-(\\d+)$'));
    if (match) max = Math.max(max, Number(match[1]));
  });
  return prefix + '-' + String(max + 1).padStart(6, '0');
}

function members_pessoasV2Append_(sheet, payload, dryRun, report, label) {
  var headers = members_pessoasV2Headers_(sheet);
  var row = members_pessoasV2BuildRow_(headers, payload);
  report.operations.push({ type: 'APPEND', label: label, payload: payload });
  if (!dryRun) sheet.appendRow(row);
}

function members_pessoasV2UpdateRow_(sheet, rowNumber, payload, dryRun, report, label) {
  var headers = members_pessoasV2Headers_(sheet);
  var values = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  var map = members_buildHeaderMap_(headers, { normalize: true, oneBased: false });
  Object.keys(payload || {}).forEach(function(header) {
    var idx = map[members_normalizeOffboardingHeader_(header)];
    if (idx != null && idx >= 0) values[idx] = payload[header];
  });
  report.operations.push({ type: 'UPDATE', label: label, rowNumber: rowNumber, payload: payload });
  if (!dryRun) sheet.getRange(rowNumber, 1, 1, headers.length).setValues([values]);
}

function members_pessoasV2PessoaPayloadFromEvent_(event) {
  return {
    NOME_COMPLETO: event.memberName || event.name || '',
    NOME_EXIBICAO: event.memberName || event.name || '',
    EMAIL_PRINCIPAL: members_pessoasV2Email_(event.memberEmail || event.email),
    STATUS_CADASTRAL: 'ATIVO',
    OBS_INTERNA: event.notes || '',
    CRIADO_EM: new Date(),
    ATUALIZADO_EM: new Date(),
    ATIVO: 'SIM'
  };
}

function members_pessoasV2EnsurePessoa_(ctx, event, report) {
  var pessoa = members_pessoasV2FindPessoaByRga_(ctx.baseRecords, ctx.detalhesRecords, {
    rga: event.rga,
    email: event.memberEmail || event.email,
    name: event.memberName || event.name
  });
  if (pessoa) return pessoa;

  var idPessoa = members_pessoasV2SeqId_(ctx.baseRecords, 'ID_PESSOA', 'PES');
  var payload = members_pessoasV2PessoaPayloadFromEvent_(event);
  payload.ID_PESSOA = idPessoa;
  members_pessoasV2Append_(ctx.sheets.pessoasBase, payload, ctx.opts.dryRun, report, 'PESSOAS_BASE');
  payload.__rowNumber = ctx.sheets.pessoasBase.getLastRow() + 1;
  ctx.baseRecords.push(payload);
  return payload;
}

function members_pessoasV2EnsureIdentificador_(ctx, idPessoa, tipo, valor, report) {
  valor = String(valor || '').trim();
  if (!valor) return;
  var normalizedTipo = members_pessoasV2Normalize_(tipo);
  var normalizedValue = normalizedTipo === 'EMAIL' ? members_pessoasV2Email_(valor) : String(valor).trim();
  var exists = ctx.identificadoresRecords.some(function(record) {
    return String(record.ID_PESSOA || '').trim() === idPessoa &&
      members_pessoasV2Normalize_(record.TIPO_IDENTIFICADOR) === normalizedTipo &&
      String(record.VALOR_IDENTIFICADOR || '').trim() === normalizedValue;
  });
  if (exists) return;

  var payload = {
    ID_IDENTIFICADOR: members_pessoasV2SeqId_(ctx.identificadoresRecords, 'ID_IDENTIFICADOR', 'PID'),
    ID_PESSOA: idPessoa,
    TIPO_IDENTIFICADOR: normalizedTipo,
    VALOR_IDENTIFICADOR: normalizedValue,
    PRINCIPAL: normalizedTipo === 'EMAIL' || normalizedTipo === 'RGA' ? 'SIM' : '',
    ATIVO: 'SIM',
    OBS: 'Registrado por geapa-membros'
  };
  members_pessoasV2Append_(ctx.sheets.identificadores, payload, ctx.opts.dryRun, report, 'PESSOAS_IDENTIFICADORES');
  ctx.identificadoresRecords.push(payload);
}

function members_pessoasV2EnsureMembroDetalhes_(ctx, idPessoa, event, report) {
  var existing = ctx.detalhesRecords.filter(function(record) {
    return String(record.ID_PESSOA || '').trim() === idPessoa;
  })[0];
  var payload = {
    ID_PESSOA: idPessoa,
    RGA: String(event.rga || '').trim(),
    SEMESTRE_ENTRADA: event.entrySemester || '',
    SEMESTRE_ATUAL: event.currentSemester || '',
    DATA_INTEGRACAO_ORIGINAL: event.eventDate || event.acceptedAt || '',
    HISTORICO_ATIVIDADES_ACADEMICAS: event.academicHistory || '',
    OBS_MEMBRO: event.notes || ''
  };
  if (existing && existing.__rowNumber) {
    members_pessoasV2UpdateRow_(ctx.sheets.membrosDetalhes, existing.__rowNumber, payload, ctx.opts.dryRun, report, 'MEMBROS_DETALHES');
    Object.keys(payload).forEach(function(key) { existing[key] = payload[key]; });
    return;
  }
  members_pessoasV2Append_(ctx.sheets.membrosDetalhes, payload, ctx.opts.dryRun, report, 'MEMBROS_DETALHES');
  ctx.detalhesRecords.push(payload);
}

function members_pessoasV2CloseActiveMemberLinks_(ctx, idPessoa, event, report) {
  ctx.vinculosRecords.forEach(function(record) {
    var tipo = members_pessoasV2Normalize_(record.TIPO_VINCULO);
    var active = members_pessoasV2Normalize_(record.STATUS_VINCULO) === 'ATIVO' || members_pessoasV2Normalize_(record.ATIVO) === 'SIM';
    if (String(record.ID_PESSOA || '').trim() !== idPessoa || tipo !== 'MEMBRO_EFETIVO' || !active || !record.__rowNumber) return;
    members_pessoasV2UpdateRow_(ctx.sheets.vinculos, record.__rowNumber, {
      STATUS_VINCULO: 'DESLIGADO',
      DATA_FIM: event.eventDate || event.approvedAt || '',
      MOTIVO_FIM: event.reason || 'Desligamento homologado',
      ATIVO: 'NAO'
    }, ctx.opts.dryRun, report, 'VINCULOS_GEAPA:ENCERRAR_MEMBRO');
  });
}

function members_pessoasV2EnsureActiveLink_(ctx, idPessoa, tipoVinculo, statusVinculo, event, report) {
  var existing = ctx.vinculosRecords.filter(function(record) {
    return String(record.ID_PESSOA || '').trim() === idPessoa &&
      members_pessoasV2Normalize_(record.TIPO_VINCULO) === members_pessoasV2Normalize_(tipoVinculo) &&
      (members_pessoasV2Normalize_(record.STATUS_VINCULO) === 'ATIVO' || members_pessoasV2Normalize_(record.ATIVO) === 'SIM');
  })[0];
  if (existing) return existing;

  var payload = {
    ID_VINCULO: members_pessoasV2SeqId_(ctx.vinculosRecords, 'ID_VINCULO', 'VIN'),
    ID_PESSOA: idPessoa,
    TIPO_VINCULO: tipoVinculo,
    STATUS_VINCULO: statusVinculo || 'ATIVO',
    DATA_INICIO: event.eventDate || event.acceptedAt || event.approvedAt || '',
    DATA_FIM: '',
    MOTIVO_INICIO: event.reason || event.eventType || '',
    MOTIVO_FIM: '',
    FONTE: event.sourceModule || 'geapa-membros',
    LINK_ATA_OU_PROCESSO: event.sourceKey || '',
    OBS_PUBLICA: '',
    OBS_INTERNA: event.notes || '',
    ATIVO: 'SIM'
  };
  members_pessoasV2Append_(ctx.sheets.vinculos, payload, ctx.opts.dryRun, report, 'VINCULOS_GEAPA:' + tipoVinculo);
  ctx.vinculosRecords.push(payload);
  return payload;
}

function members_pessoasV2BuildContext_(opts, report) {
  var sheets = members_pessoasV2Open_(opts, report);
  if (report.unavailable) return null;
  return {
    opts: opts,
    sheets: sheets,
    baseRecords: members_pessoasV2Read_(sheets.pessoasBase),
    identificadoresRecords: members_pessoasV2Read_(sheets.identificadores),
    detalhesRecords: members_pessoasV2Read_(sheets.membrosDetalhes),
    vinculosRecords: members_pessoasV2Read_(sheets.vinculos),
    eventosRecords: members_pessoasV2Read_(sheets.eventos),
    resumoRecords: members_pessoasV2Read_(sheets.resumo)
  };
}

function members_aplicarEventoMembroV2(event, options) {
  var opts = members_pessoasV2Options_(options);
  if (!opts.dryRun && opts.confirmacao !== 'APLICAR_EVENTO_MEMBRO_V2') {
    throw new Error('Para escrever em Pessoas v2, informe confirmacao: "APLICAR_EVENTO_MEMBRO_V2".');
  }
  var report = members_pessoasV2NewReport_('APLICAR_EVENTO_MEMBRO_V2', opts);
  var ctx = members_pessoasV2BuildContext_(opts, report);
  if (!ctx) return report;

  var eventType = members_pessoasV2Normalize_(event && event.eventType);
  var pessoa = members_pessoasV2EnsurePessoa_(ctx, event || {}, report);
  var idPessoa = String(pessoa.ID_PESSOA || '').trim();

  members_pessoasV2EnsureIdentificador_(ctx, idPessoa, 'EMAIL', event.memberEmail || event.email, report);
  members_pessoasV2EnsureIdentificador_(ctx, idPessoa, 'RGA', event.rga, report);

  if (eventType === 'INGRESSO' || eventType === 'RETORNO') {
    members_pessoasV2EnsureMembroDetalhes_(ctx, idPessoa, event, report);
    members_pessoasV2EnsureActiveLink_(ctx, idPessoa, 'MEMBRO_EFETIVO', 'ATIVO', event, report);
  } else if (eventType === 'DESLIGAMENTO') {
    members_pessoasV2CloseActiveMemberLinks_(ctx, idPessoa, event, report);
    members_pessoasV2EnsureActiveLink_(ctx, idPessoa, 'EGRESSO', 'ATIVO', event, report);
  } else if (eventType === 'SUSPENSAO') {
    members_pessoasV2EnsureActiveLink_(ctx, idPessoa, 'MEMBRO_EFETIVO', 'SUSPENSO', event, report);
  } else {
    members_pessoasV2Issue_(report, 'AVISO', 'EVENTO_MEMBRO_V2_TIPO_NAO_TRATADO', 'Tipo de evento nao tratado pela V1 de Pessoas v2.', { eventType: event.eventType });
  }

  report.resumoQuantitativo.operacoes = report.operations.length;
  return report;
}

function members_recalcularPessoasResumoOperacionalV2(options) {
  return members_pessoasV2CallCoreApi_(
    'coreRecalcularPessoasResumoOperacionalV2',
    options || {},
    'RECALCULAR_PESSOAS_RESUMO_OPERACIONAL_V2'
  );
}

function members_recalcularMembrosDetalhesSemestreAtualV2(options) {
  return members_pessoasV2CallCoreApi_(
    'coreRecalcularMembrosDetalhesSemestreAtualV2',
    options || {},
    'RECALCULAR_MEMBROS_DETALHES_SEMESTRE_ATUAL_V2'
  );
}

function members_diagnosticarPessoasResumoOperacionalV2(options) {
  return members_pessoasV2CallCoreApi_(
    'coreDiagnosticarPessoasResumoOperacionalV2',
    options || {},
    'DIAGNOSTICAR_PESSOAS_RESUMO_OPERACIONAL_V2'
  );
}

function members_diagnosticarPessoasV2(options) {
  var opts = members_pessoasV2Options_(options || {});
  var report = members_pessoasV2NewReport_('DIAGNOSTICAR_PESSOAS_V2', opts);
  var ctx = members_pessoasV2BuildContext_(opts, report);
  if (!ctx) return report;
  report.resumoQuantitativo = {
    pessoasBase: ctx.baseRecords.length,
    identificadores: ctx.identificadoresRecords.length,
    membrosDetalhes: ctx.detalhesRecords.length,
    vinculos: ctx.vinculosRecords.length,
    eventos: ctx.eventosRecords.length,
    resumo: ctx.resumoRecords.length
  };
  return report;
}

function members_tryApplyPessoasV2Event_(event) {
  try {
    return members_aplicarEventoMembroV2(event, { dryRun: false, confirmacao: 'APLICAR_EVENTO_MEMBRO_V2' });
  } catch (err) {
    Logger.log('members_tryApplyPessoasV2Event_ erro: ' + (err && err.message ? err.message : err));
    return null;
  }
}
