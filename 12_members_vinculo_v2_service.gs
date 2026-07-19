/** Contratos do membro e infraestrutura persistente das solicitacoes V2. */

function membersVinculoEnvelopeOk_(code, message, data, requestId, warnings) {
  return { ok: true, code: code, errorCode: '', message: message, data: data || {}, warnings: warnings || [], fieldErrors: {}, requestId: requestId || '' };
}

function membersVinculoEnvelopeError_(error, requestId) {
  return {
    ok: false,
    code: error.code || error.errorCode || 'SOLICITACAO_VINCULO_ERRO',
    errorCode: error.code || error.errorCode || 'SOLICITACAO_VINCULO_ERRO',
    message: error.message || 'Nao foi possivel concluir a operacao.',
    data: {}, warnings: [], fieldErrors: error.fieldErrors || {}, details: error.details || {}, requestId: requestId || ''
  };
}

function membersVinculoRequestId_(context, deps) {
  return String(context && context.requestId || '').trim() || 'req-vinc-' + String((deps.uuid ? deps.uuid() : Utilities.getUuid())).replace(/-/g, '').slice(0, 20);
}

function membersVinculoDependencies_(context) {
  var injected = context && context.__deps;
  if (injected) return injected;
  return {
    now: function() { return new Date(); },
    uuid: function() { return Utilities.getUuid(); },
    withLock: function(key, callback) {
      var lock = LockService.getScriptLock();
      lock.waitLock(30000);
      try { return callback(); } finally { lock.releaseLock(); }
    },
    resolveSession: function(email) {
      if (typeof GEAPA_CORE === 'undefined' || !GEAPA_CORE || typeof GEAPA_CORE.corePortalResolverUsuarioAtual !== 'function') {
        throw membersVinculoError_('CORE_SESSAO_INDISPONIVEL', 'A sessao oficial esta indisponivel.', {});
      }
      return GEAPA_CORE.corePortalResolverUsuarioAtual({ email: email }, { origem: 'GEAPA_MEMBROS_VINCULO_V2' });
    },
    resolveParameters: function(environment, parameterIds) {
      if (typeof GEAPA_CORE.coreResolverParametrosNormativosOperacionais !== 'function') {
        throw membersVinculoError_('CORE_PARAMETROS_NORMATIVOS_INDISPONIVEL', 'O parametro normativo esta indisponivel.', {});
      }
      return GEAPA_CORE.coreResolverParametrosNormativosOperacionais(parameterIds || [
        MEMBERS_VINCULO_CFG.normativeIds.suspensionMinimum,
        MEMBERS_VINCULO_CFG.normativeIds.dismissalPresentationBlock
      ], { ambiente: environment, moduloSistema: 'GEAPA_MEMBROS' });
    },
    openSource: membersVinculoOpenDomainSource_,
    notify: membersVinculoNotifyBestEffort_,
    recalculateSummary: membersVinculoRecalculateSummary_
  };
}

function membersVinculoEnvironment_(context) {
  var environment = membersVinculoToken_(context && (context.ambienteDadosV2 || context.ambiente || context.environment));
  if (environment !== 'DEV' && environment !== 'PROD') {
    throw membersVinculoError_('AMBIENTE_VINCULO_INVALIDO', 'O backend deve informar explicitamente DEV ou PROD.', { ambienteRecebido: environment || '(vazio)' });
  }
  return environment;
}

function membersVinculoRejectFrontendTarget_(payload) {
  var forbidden = ['ID_PESSOA','idPessoa','ID_VINCULO','idVinculo','RGA','rga','EMAIL','email'];
  var found = forbidden.filter(function(key) { return payload && Object.prototype.hasOwnProperty.call(payload, key); });
  if (found.length) throw membersVinculoError_('ALVO_VINCULO_NAO_PERMITIDO', 'O navegador nao pode escolher pessoa, vinculo, RGA ou e-mail.', { camposRejeitados: found });
}

function membersVinculoResolveSession_(context, deps, permission) {
  var provided = context && (context.sessaoOficial || context.sessionOfficial || context.session) || {};
  var email = String(provided.email || context && context.emailOficial || '').trim().toLowerCase();
  if (!email) throw membersVinculoError_('SESSAO_OFICIAL_AUSENTE', 'Sua sessao expirou ou nao foi resolvida.', {});
  var session = deps.resolveSession(email, context) || {};
  if (session.ok === false || session.autenticado === false || !String(session.idPessoa || '').trim()) {
    throw membersVinculoError_('SESSAO_OFICIAL_INVALIDA', 'Sua sessao expirou ou nao foi resolvida.', {});
  }
  if (provided.idPessoa && String(provided.idPessoa) !== String(session.idPessoa)) {
    throw membersVinculoError_('SESSAO_IDENTIDADE_DIVERGENTE', 'A identidade da sessao diverge da resolucao oficial.', {});
  }
  var permissions = (session.permissoes || []).map(function(item) { return String(item || '').trim().toLowerCase(); });
  if (permission && permissions.indexOf(String(permission).toLowerCase()) < 0) {
    throw membersVinculoError_('ACESSO_NEGADO', 'Voce nao possui permissao para esta operacao.', { permissaoExigida: permission });
  }
  return session;
}

function membersVinculoHasPermission_(session, permission) {
  return (session.permissoes || []).map(function(item) { return String(item || '').trim().toLowerCase(); }).indexOf(String(permission).toLowerCase()) >= 0;
}

function membersVinculoOpenDomainSource_(domain, logicalSheet, environment, forWrite) {
  if (typeof GEAPA_CORE === 'undefined' || !GEAPA_CORE || typeof GEAPA_CORE.coreGetDomainSheet !== 'function') {
    throw membersVinculoError_('CORE_DOMINIO_V2_INDISPONIVEL', 'As bases V2 estao indisponiveis.', {});
  }
  var sheet = GEAPA_CORE.coreGetDomainSheet(domain, logicalSheet, { ambiente: environment, forWrite: forWrite === true });
  if (!sheet) throw membersVinculoError_('FONTE_V2_INDISPONIVEL', 'A fonte V2 solicitada esta indisponivel.', { dominio: domain, abaLogica: logicalSheet, ambiente: environment });
  return membersVinculoReadSource_(sheet);
}

function membersVinculoReadSource_(sheet) {
  var lastColumn = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  var headers = lastColumn ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(value) { return String(value || '').trim(); }) : [];
  var records = [];
  if (lastRow > 1 && headers.length) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).getValues().forEach(function(values, index) {
      if (values.every(function(value) { return value === '' || value == null; })) return;
      var record = { __rowNumber: index + 2 };
      headers.forEach(function(header, column) { record[header] = values[column]; });
      records.push(record);
    });
  }
  return { sheet: sheet, headers: headers, records: records };
}

function membersVinculoRequireHeaders_(source, required) {
  var missing = (required || []).filter(function(header) { return source.headers.indexOf(header) < 0; });
  if (missing.length) throw membersVinculoError_('SOLICITACOES_VINCULO_CABECALHOS_INVALIDOS', 'A base SOLICITACOES_VINCULO nao possui todos os cabecalhos.', { cabecalhosAusentes: missing });
}

function membersVinculoAppend_(source, record) {
  membersVinculoRequireHeaders_(source, MEMBERS_VINCULO_HEADERS);
  var row = source.headers.map(function(header) { return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : ''; });
  source.sheet.getRange(source.sheet.getLastRow() + 1, 1, 1, source.headers.length).setValues([row]);
  record.__rowNumber = source.sheet.getLastRow();
  source.records.push(record);
  return record;
}

function membersVinculoUpdate_(source, record, changes) {
  if (!record || !record.__rowNumber) throw membersVinculoError_('REGISTRO_VINCULO_SEM_LINHA', 'Registro operacional sem numero de linha.', {});
  Object.keys(changes || {}).forEach(function(key) { record[key] = changes[key]; });
  var row = source.headers.map(function(header) { return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : ''; });
  source.sheet.getRange(record.__rowNumber, 1, 1, source.headers.length).setValues([row]);
  return record;
}

function membersVinculoFindCurrentLink_(records, idPessoa) {
  var matches = (records || []).filter(function(record) {
    return String(record.ID_PESSOA || '').trim() === String(idPessoa) &&
      membersVinculoToken_(record.TIPO_VINCULO) === 'MEMBRO_EFETIVO' &&
      membersVinculoToken_(record.STATUS_VINCULO) === 'ATIVO' && membersVinculoIsYes_(record.ATIVO);
  });
  if (!matches.length) throw membersVinculoError_('VINCULO_EFETIVO_ATIVO_NAO_ENCONTRADO', 'Somente membro efetivo com vinculo ativo pode solicitar.', {});
  if (matches.length > 1) throw membersVinculoError_('VINCULO_EFETIVO_ATIVO_DUPLICADO', 'Existe mais de um vinculo efetivo ativo para a pessoa.', { quantidade: matches.length });
  if (!String(matches[0].ID_VINCULO || '').trim()) throw membersVinculoError_('ID_VINCULO_AUSENTE', 'O vinculo ativo nao possui ID_VINCULO.', {});
  return matches[0];
}

function membersVinculoFindOpenRequest_(records, idVinculo) {
  return (records || []).filter(function(record) {
    return String(record.ID_VINCULO || '').trim() === String(idVinculo) && membersVinculoIsOpenStatus_(record.STATUS_SOLICITACAO) && membersVinculoIsYes_(record.ATIVO);
  })[0] || null;
}

function membersVinculoFindByIdempotency_(records, idPessoa, key) {
  return (records || []).filter(function(record) {
    return String(record.ID_PESSOA || '').trim() === String(idPessoa) && String(record.CHAVE_IDEMPOTENCIA || '').trim() === String(key || '').trim();
  })[0] || null;
}

function membersVinculoFindRequest_(records, id) {
  var request = (records || []).filter(function(record) { return String(record.ID_SOLICITACAO || '').trim() === String(id || '').trim(); })[0];
  if (!request) throw membersVinculoError_('SOLICITACAO_VINCULO_NAO_ENCONTRADA', 'Solicitacao de vinculo nao encontrada.', {});
  return request;
}

function membersVinculoNewId_(deps) {
  return 'SVI-' + String(deps.uuid()).replace(/-/g, '').slice(0, 20).toUpperCase();
}

function membersVinculoAuditAppend_(record, event) {
  var audit = [];
  try { audit = JSON.parse(String(record.AUDITORIA_JSON || '[]')); } catch (ignored) {}
  audit.push(event);
  return JSON.stringify(audit);
}

function membersVinculoHistoryAppend_(record, status, actor, at, reason) {
  var history = [];
  try { history = JSON.parse(String(record.HISTORICO_STATUS_JSON || '[]')); } catch (ignored) {}
  history.push({ status: status, em: at, por: actor, motivo: reason || '' });
  return JSON.stringify(history);
}

function membersVinculoReadParameters_(deps, environment, includeFinalMinutes) {
  var ids = [MEMBERS_VINCULO_CFG.normativeIds.suspensionMinimum, MEMBERS_VINCULO_CFG.normativeIds.dismissalPresentationBlock];
  if (includeFinalMinutes === true) ids.push(MEMBERS_VINCULO_CFG.normativeIds.dismissalFinalMinutes);
  var parameters = deps.resolveParameters(environment, ids);
  membersVinculoValidateNormativeParameter_(parameters.SUSPENSAO_MINIMA, MEMBERS_VINCULO_CFG.normativeIds.suspensionMinimum);
  membersVinculoValidateNormativeParameter_(parameters.BLOQUEIO_DESLIGAMENTO_ANTES_APRESENTACAO, MEMBERS_VINCULO_CFG.normativeIds.dismissalPresentationBlock);
  if (includeFinalMinutes === true) membersVinculoValidateFinalMinutesParameter_(parameters.DESLIGAMENTO_VOLUNTARIO_DECISAO_FINAL_EXIGE_ATA);
  return parameters;
}

function membersVinculoReadSemesterSafe_(deps, environment, required, now) {
  try {
    var source = deps.openSource('VIGENCIAS', 'SEMESTRES', environment, false);
    return { semester: membersVinculoResolveActiveSemester_(source.records, now), warning: null };
  } catch (error) {
    if (required) throw error;
    return { semester: null, warning: { code: error.code || 'SEMESTRE_NAO_VERIFICADO', message: 'Semestre letivo nao resolvido; nenhuma referencia foi inventada.' } };
  }
}

function membersVinculoAssessExternal_(deps, session, environment, requestType, period, blockParameter, now) {
  if (typeof deps.assessExternal === 'function') return deps.assessExternal(session, environment, requestType, period, blockParameter, now);
  var result = { apresentacao: 'NAO_VERIFICADO', arquivos: 'NAO_VERIFICADO', obrigacoes: 'NAO_VERIFICADO', funcao: 'NAO_VERIFICADO', mensagem: 'Integracoes externas devem ser conferidas manualmente pela Diretoria.' };
  try {
    var presentations = deps.openSource('ATIVIDADES', 'APRESENTACOES', environment, false).records;
    var personPresentations = presentations.filter(function(record) {
      return String(record.ID_PESSOA || '').trim() === String(session.idPessoa) && membersVinculoToken_(record.STATUS_APRESENTACAO || record.STATUS) !== 'CANCELADA';
    });
    var start = period && period.dataInicio ? period.dataInicio : membersVinculoToday_(now).iso;
    var end = period && period.dataFim;
    if (!end && requestType === MEMBERS_VINCULO_CFG.types.dismissal) {
      var today = membersVinculoToday_(now);
      var limit = new Date(today.year, today.month - 1, today.day + Number(blockParameter.valor), 12);
      end = membersVinculoCivilDate_(limit).iso;
    }
    var conflict = personPresentations.some(function(record) {
      try {
        var date = membersVinculoCivilDate_(record.DATA_APRESENTACAO || record.DATA_ATIVIDADE || record.DATA).iso;
        return date >= start && (!end || date <= end);
      } catch (ignored) { return false; }
    });
    result.apresentacao = conflict ? 'CONFLITO' : 'SEM_CONFLITO';
  } catch (ignoredPresentation) {}
  try {
    var files = deps.openSource('ATIVIDADES', 'ARQUIVOS', environment, false).records;
    var pending = files.some(function(record) {
      return String(record.ID_PESSOA || '').trim() === String(session.idPessoa) && ['PENDENTE','AGUARDANDO','NAO_ENVIADO'].indexOf(membersVinculoToken_(record.STATUS_ARQUIVO || record.STATUS)) >= 0;
    });
    result.arquivos = pending ? 'PENDENTE' : 'SEM_PENDENCIA';
  } catch (ignoredFiles) {}
  return result;
}

function membersVinculoAssessPriorSuspension_(deps, environment, link) {
  try {
    var events = deps.openSource('PESSOAS', 'EVENTOS', environment, false);
    if (events.headers.indexOf(MEMBERS_VINCULO_EVENT_ID_VINCULO_HEADER) < 0) {
      return { status: 'NAO_VERIFICADO', message: 'A base de eventos ainda nao possui ID_VINCULO; a permanencia atual exige conferencia manual.' };
    }
    var found = events.records.some(function(record) {
      return String(record.ID_VINCULO || '').trim() === String(link.ID_VINCULO || '').trim() &&
        membersVinculoToken_(record.TIPO_EVENTO) === 'SUSPENSAO' &&
        membersVinculoToken_(record.STATUS_EVENTO || 'HOMOLOGADO') === 'HOMOLOGADO';
    });
    return { status: found ? 'CONFIRMADA' : 'SEM_SUSPENSAO', message: '' };
  } catch (error) {
    return { status: 'NAO_VERIFICADO', message: 'Nao foi possivel verificar suspensao anterior na permanencia atual.' };
  }
}

function membersVinculoCreateRequest_(type, payload, context, deps) {
  payload = payload || {};
  membersVinculoRejectFrontendTarget_(payload);
  var environment = membersVinculoEnvironment_(context);
  var session = membersVinculoResolveSession_(context, deps, MEMBERS_VINCULO_CFG.permissions.request);
  var now = deps.now();
  var key = String(payload.chaveIdempotencia || '').trim();
  if (key.length < 8) throw membersVinculoError_('CHAVE_IDEMPOTENCIA_INVALIDA', 'A chave de idempotencia deve ter ao menos 8 caracteres.', {}, { chaveIdempotencia: 'Invalida' });
  var reason = String(payload.motivoCategoria || payload.motivo || '').trim();
  if (!reason) throw membersVinculoError_('MOTIVO_OBRIGATORIO', 'Informe o motivo da solicitacao.', {}, { motivoCategoria: 'Obrigatorio' });
  if (!membersVinculoIsYes_(payload.cienciaRegras)) throw membersVinculoError_('CIENCIA_REGRAS_OBRIGATORIA', 'Confirme a ciencia das regras aplicaveis.', {}, { cienciaRegras: 'Obrigatoria' });

  var queue = deps.openSource('PESSOAS', MEMBERS_VINCULO_CFG.logicalSheet, environment, true);
  var links = deps.openSource('PESSOAS', 'VINCULOS', environment, false);
  var link = membersVinculoFindCurrentLink_(links.records, session.idPessoa);
  var idempotent = membersVinculoFindByIdempotency_(queue.records, session.idPessoa, key);
  if (idempotent) return { idempotent: true, request: idempotent, warnings: [] };
  var open = membersVinculoFindOpenRequest_(queue.records, link.ID_VINCULO);
  if (open) throw membersVinculoError_('SOLICITACAO_VINCULO_ABERTA_EXISTENTE', 'Ja existe uma solicitacao aberta para este vinculo.', { idSolicitacao: open.ID_SOLICITACAO, status: open.STATUS_SOLICITACAO });

  var parameters = membersVinculoReadParameters_(deps, environment, type === MEMBERS_VINCULO_CFG.types.dismissal);
  var modality;
  var semesterRequired;
  if (type === MEMBERS_VINCULO_CFG.types.suspension) {
    modality = MEMBERS_VINCULO_CFG.modalities.suspension;
    semesterRequired = true;
  } else {
    modality = membersVinculoToken_(payload.modalidadeSolicitada);
    if ([MEMBERS_VINCULO_CFG.modalities.dismissalImmediate, MEMBERS_VINCULO_CFG.modalities.dismissalSemesterEnd].indexOf(modality) < 0) {
      throw membersVinculoError_('MODALIDADE_DESLIGAMENTO_INVALIDA', 'Escolha uma modalidade valida de desligamento.', {}, { modalidadeSolicitada: 'Invalida' });
    }
    semesterRequired = modality === MEMBERS_VINCULO_CFG.modalities.dismissalSemesterEnd;
  }
  var semesterResult = membersVinculoReadSemesterSafe_(deps, environment, semesterRequired, now);
  var semester = semesterResult.semester;
  var period = null;
  if (type === MEMBERS_VINCULO_CFG.types.suspension) {
    period = membersVinculoValidateSuspensionPeriod_(payload.dataInicioPretendida, payload.dataFimPretendida, semester, parameters.SUSPENSAO_MINIMA);
    if (String(payload.justificativa || '').trim().length < 10) throw membersVinculoError_('JUSTIFICATIVA_SUSPENSAO_OBRIGATORIA', 'Informe uma justificativa para a suspensao.', {}, { justificativa: 'Muito curta' });
  }
  var external = membersVinculoAssessExternal_(deps, session, environment, type, period, parameters.BLOQUEIO_DESLIGAMENTO_ANTES_APRESENTACAO, now);
  var priorSuspension = type === MEMBERS_VINCULO_CFG.types.suspension
    ? membersVinculoAssessPriorSuspension_(deps, environment, link)
    : { status: 'NAO_APLICAVEL', message: '' };
  var id = membersVinculoNewId_(deps);
  var actor = String(session.idPessoa || '').trim();
  var snapshot = membersVinculoSnapshotParameters_(parameters, now, type);
  var row = Object.assign({
    ID_SOLICITACAO: id, ID_PESSOA: session.idPessoa, ID_VINCULO: link.ID_VINCULO,
    TIPO_SOLICITACAO: type, MODALIDADE_SOLICITADA: modality, DATA_SOLICITACAO: now,
    CHAVE_IDEMPOTENCIA: key, STATUS_SOLICITACAO: MEMBERS_VINCULO_CFG.statuses.received, ATIVO: 'SIM',
    ID_SEMESTRE_REFERENCIA: semester ? semester.idSemestre : '',
    DATA_INICIO_SEMESTRE_SNAPSHOT: semester ? semester.dataInicio : '', DATA_FIM_SEMESTRE_SNAPSHOT: semester ? semester.dataFim : '',
    DATA_INICIO_PRETENDIDA: period ? period.dataInicio : '', DATA_FIM_PRETENDIDA: period ? period.dataFim : '',
    DATA_EFETIVA_PRETENDIDA: modality === MEMBERS_VINCULO_CFG.modalities.dismissalSemesterEnd && semester ? semester.dataFim : '',
    MOTIVO_CATEGORIA: reason, JUSTIFICATIVA: String(payload.justificativa || '').trim(), OBSERVACOES_MEMBRO: String(payload.observacoes || '').trim(),
    DOCUMENTO_REFERENCIA: String(payload.documentoReferencia || '').trim(), CIENCIA_REGRAS_EM: now,
    CIENCIA_REGRAS_VERSAO: String(payload.cienciaRegrasVersao || 'VINCULO_V2').trim(),
    VALIDACAO_VINCULO_ATIVO: 'VALIDO', VALIDACAO_SEMESTRE: semester ? 'VALIDO' : 'NAO_VERIFICADO',
    VALIDACAO_PERIODO_SUSPENSAO: period ? 'VALIDO' : 'NAO_APLICAVEL', VALIDACAO_SUSPENSAO_ANTERIOR: priorSuspension.status,
    VALIDACAO_APRESENTACAO: external.apresentacao, VALIDACAO_ARQUIVOS_PENDENTES: external.arquivos,
    VALIDACAO_OBRIGACOES: external.obrigacoes, VALIDACAO_FUNCAO_ATIVA: external.funcao,
    RESULTADO_VALIDACAO: [external.apresentacao, external.arquivos, external.obrigacoes, external.funcao].indexOf('NAO_VERIFICADO') >= 0 ? 'PENDENTE_ANALISE_MANUAL' : 'VALIDADO',
    MENSAGEM_VALIDACAO: [external.mensagem || '', priorSuspension.message || ''].filter(Boolean).join(' '), VALIDADO_EM: now, CRIADO_EM: now, CRIADO_POR: actor,
    ATUALIZADO_EM: now, ATUALIZADO_POR: actor,
    HISTORICO_STATUS_JSON: JSON.stringify([{ status: MEMBERS_VINCULO_CFG.statuses.received, em: now, por: actor, motivo: 'Solicitacao criada pelo membro.' }]),
    AUDITORIA_JSON: JSON.stringify([{ acao: 'CRIAR_SOLICITACAO', em: now, por: actor, requestId: context.requestId || '' }])
  }, snapshot);
  membersVinculoAppend_(queue, row);
  var notification = deps.notify('SOLICITACAO_RECEBIDA', row, session, environment);
  var warnings = [];
  if (semesterResult.warning) warnings.push(semesterResult.warning);
  if (notification && notification.ok === false) {
    warnings.push({ code: 'NOTIFICACAO_NAO_ENVIADA', message: notification.message || 'Solicitacao salva; notificacao pendente.' });
    membersVinculoUpdate_(queue, row, { AUDITORIA_JSON: membersVinculoAuditAppend_(row, { acao: 'NOTIFICACAO_FALHOU', tipoEvento: 'SOLICITACAO_RECEBIDA', em: now, por: actor, code: 'NOTIFICACAO_NAO_ENVIADA' }) });
  }
  return { idempotent: false, request: row, warnings: warnings };
}

function membersVinculoSanitizeOwn_(request) {
  return {
    idSolicitacao: request.ID_SOLICITACAO, tipo: request.TIPO_SOLICITACAO, modalidade: request.MODALIDADE_SOLICITADA,
    dataSolicitacao: request.DATA_SOLICITACAO, idSemestre: request.ID_SEMESTRE_REFERENCIA,
    dataEfetivaPretendida: request.DATA_EFETIVA_PRETENDIDA || request.DATA_INICIO_PRETENDIDA,
    status: request.STATUS_SOLICITACAO, decisao: request.DECISAO_DIRETORIA || '', mensagemDiretoria: request.OBS_DECISAO || request.MENSAGEM_VALIDACAO || '',
    dataEfetiva: request.DATA_EFETIVA || '', podeCancelar: membersVinculoIsMemberCancellable_(request.STATUS_SOLICITACAO)
  };
}

function membersMeuVinculoOpcoesSolicitacao(contexto) {
  var deps = membersVinculoDependencies_(contexto || {}); var requestId = membersVinculoRequestId_(contexto || {}, deps);
  try {
    var environment = membersVinculoEnvironment_(contexto); var session = membersVinculoResolveSession_(contexto, deps, MEMBERS_VINCULO_CFG.permissions.request);
    var links = deps.openSource('PESSOAS', 'VINCULOS', environment, false); var link = membersVinculoFindCurrentLink_(links.records, session.idPessoa);
    var queue = deps.openSource('PESSOAS', MEMBERS_VINCULO_CFG.logicalSheet, environment, false); var open = membersVinculoFindOpenRequest_(queue.records, link.ID_VINCULO);
    var parameters = membersVinculoReadParameters_(deps, environment); var semesterResult = membersVinculoReadSemesterSafe_(deps, environment, false, deps.now());
    var canSuspend = !!semesterResult.semester;
    if (canSuspend) {
      var today = membersVinculoToday_(deps.now());
      var end = membersVinculoCivilDate_(semesterResult.semester.dataFim);
      canSuspend = membersVinculoCivilDaysInclusive_(today, end) >= Number(parameters.SUSPENSAO_MINIMA.valor);
    }
    return membersVinculoEnvelopeOk_('OPCOES_VINCULO_CARREGADAS', 'Opcoes de vinculo carregadas.', {
      vinculo: { idVinculo: link.ID_VINCULO, tipo: link.TIPO_VINCULO, status: link.STATUS_VINCULO, dataInicio: link.DATA_INICIO },
      semestre: semesterResult.semester, parametroSuspensao: parameters.SUSPENSAO_MINIMA,
      opcoes: { suspensaoDisponivel: canSuspend && !open, desligamentoDisponivel: !open }, solicitacaoAberta: open ? membersVinculoSanitizeOwn_(open) : null
    }, requestId, semesterResult.warning ? [semesterResult.warning] : []);
  } catch (error) { return membersVinculoEnvelopeError_(error, requestId); }
}

function membersMeuVinculoSolicitarSuspensao(payload, contexto) {
  var deps = membersVinculoDependencies_(contexto || {}); var requestId = membersVinculoRequestId_(contexto || {}, deps); contexto = Object.assign({}, contexto || {}, { requestId: requestId });
  try {
    var result = deps.withLock('SOLICITAR_SUSPENSAO', function() { return membersVinculoCreateRequest_(MEMBERS_VINCULO_CFG.types.suspension, payload, contexto, deps); });
    return membersVinculoEnvelopeOk_(result.idempotent ? 'SOLICITACAO_VINCULO_IDEMPOTENTE' : 'SUSPENSAO_SOLICITADA', result.idempotent ? 'A solicitacao ja estava registrada.' : 'Solicitacao de suspensao registrada.', { idSolicitacao: result.request.ID_SOLICITACAO, status: result.request.STATUS_SOLICITACAO, idempotente: result.idempotent }, requestId, result.warnings);
  } catch (error) { return membersVinculoEnvelopeError_(error, requestId); }
}

function membersMeuVinculoSolicitarDesligamento(payload, contexto) {
  var deps = membersVinculoDependencies_(contexto || {}); var requestId = membersVinculoRequestId_(contexto || {}, deps); contexto = Object.assign({}, contexto || {}, { requestId: requestId });
  try {
    var result = deps.withLock('SOLICITAR_DESLIGAMENTO', function() { return membersVinculoCreateRequest_(MEMBERS_VINCULO_CFG.types.dismissal, payload, contexto, deps); });
    return membersVinculoEnvelopeOk_(result.idempotent ? 'SOLICITACAO_VINCULO_IDEMPOTENTE' : 'DESLIGAMENTO_SOLICITADO', result.idempotent ? 'A solicitacao ja estava registrada.' : 'Solicitacao de desligamento registrada.', { idSolicitacao: result.request.ID_SOLICITACAO, status: result.request.STATUS_SOLICITACAO, idempotente: result.idempotent }, requestId, result.warnings);
  } catch (error) { return membersVinculoEnvelopeError_(error, requestId); }
}

function membersMeuVinculoSolicitacoesListar(contexto) {
  var deps = membersVinculoDependencies_(contexto || {}); var requestId = membersVinculoRequestId_(contexto || {}, deps);
  try {
    var environment = membersVinculoEnvironment_(contexto); var session = membersVinculoResolveSession_(contexto, deps, null);
    var queue = deps.openSource('PESSOAS', MEMBERS_VINCULO_CFG.logicalSheet, environment, false);
    var items = queue.records.filter(function(record) { return String(record.ID_PESSOA || '') === String(session.idPessoa); }).map(membersVinculoSanitizeOwn_);
    return membersVinculoEnvelopeOk_('MINHAS_SOLICITACOES_VINCULO_LISTADAS', 'Solicitacoes carregadas.', { items: items }, requestId);
  } catch (error) { return membersVinculoEnvelopeError_(error, requestId); }
}

function membersMeuVinculoCancelarSolicitacao(payload, contexto) {
  var deps = membersVinculoDependencies_(contexto || {}); var requestId = membersVinculoRequestId_(contexto || {}, deps);
  try {
    membersVinculoRejectFrontendTarget_(payload || {});
    var result = deps.withLock('CANCELAR_SOLICITACAO_VINCULO', function() {
      var environment = membersVinculoEnvironment_(contexto); var session = membersVinculoResolveSession_(contexto, deps, null); var now = deps.now();
      var queue = deps.openSource('PESSOAS', MEMBERS_VINCULO_CFG.logicalSheet, environment, true); var request = membersVinculoFindRequest_(queue.records, payload && payload.idSolicitacao);
      if (String(request.ID_PESSOA) !== String(session.idPessoa)) throw membersVinculoError_('SOLICITACAO_VINCULO_DE_TERCEIRO', 'Nao e permitido cancelar solicitacao de outra pessoa.', {});
      if (!membersVinculoIsMemberCancellable_(request.STATUS_SOLICITACAO)) throw membersVinculoError_('SOLICITACAO_VINCULO_NAO_CANCELAVEL', 'A solicitacao nao pode mais ser cancelada pelo membro.', { status: request.STATUS_SOLICITACAO });
      membersVinculoAssertTransition_(request.STATUS_SOLICITACAO, MEMBERS_VINCULO_CFG.statuses.memberCancelled);
      return membersVinculoUpdate_(queue, request, { STATUS_SOLICITACAO: MEMBERS_VINCULO_CFG.statuses.memberCancelled, ATIVO: 'NAO', CANCELADO_EM: now, CANCELADO_POR: session.idPessoa, MOTIVO_CANCELAMENTO: String(payload.motivo || '').trim(), ATUALIZADO_EM: now, ATUALIZADO_POR: session.idPessoa, HISTORICO_STATUS_JSON: membersVinculoHistoryAppend_(request, MEMBERS_VINCULO_CFG.statuses.memberCancelled, session.idPessoa, now, payload.motivo), AUDITORIA_JSON: membersVinculoAuditAppend_(request, { acao: 'CANCELAR_PELO_MEMBRO', em: now, por: session.idPessoa, requestId: requestId }) });
    });
    return membersVinculoEnvelopeOk_('SOLICITACAO_VINCULO_CANCELADA', 'Solicitacao cancelada.', { idSolicitacao: result.ID_SOLICITACAO, status: result.STATUS_SOLICITACAO }, requestId);
  } catch (error) { return membersVinculoEnvelopeError_(error, requestId); }
}

function membersVinculoNotifyBestEffort_(eventType, request, session, environment) {
  try {
    if (typeof GEAPA_CORE !== 'undefined' && GEAPA_CORE && typeof GEAPA_CORE.coreMailEnqueue === 'function') {
      return GEAPA_CORE.coreMailEnqueue({ templateKey: 'GEAPA_CLASSICO', correlationKey: 'SVI:' + request.ID_SOLICITACAO + ':' + eventType, tipoEvento: eventType, destinatario: session.email || '', ambiente: environment, dados: { protocolo: request.ID_SOLICITACAO, status: request.STATUS_SOLICITACAO } });
    }
    return { ok: false, message: 'Mail Hub nao disponivel; reenvio podera ser feito depois.' };
  } catch (error) { return { ok: false, message: error.message }; }
}

function membersVinculoNotifyOwnerBestEffort_(deps, queue, request, environment, eventType, actor, now) {
  var result;
  try {
    var person = deps.openSource('PESSOAS', 'BASE', environment, false).records.filter(function(record) {
      return String(record.ID_PESSOA || '').trim() === String(request.ID_PESSOA || '').trim();
    })[0] || {};
    var email = String(person.EMAIL_PRINCIPAL || person.EMAIL || '').trim();
    if (!email) result = { ok: false, message: 'E-mail oficial da pessoa nao localizado.' };
    else result = deps.notify(eventType, request, { email: email, idPessoa: request.ID_PESSOA }, environment) || { ok: true };
  } catch (error) {
    result = { ok: false, message: error.message || 'Falha ao preparar notificacao.' };
  }
  if (result.ok === false && queue && request) {
    try {
      membersVinculoUpdate_(queue, request, { AUDITORIA_JSON: membersVinculoAuditAppend_(request, { acao: 'NOTIFICACAO_FALHOU', tipoEvento: eventType, em: now || new Date(), por: actor || 'SISTEMA', code: 'NOTIFICACAO_NAO_ENVIADA' }) });
    } catch (ignoredAudit) {}
  }
  return result;
}

function membersVinculoRecalculateSummary_(environment) {
  if (typeof GEAPA_CORE === 'undefined' || !GEAPA_CORE || typeof GEAPA_CORE.coreRecalcularPessoasResumoOperacionalV2 !== 'function') {
    throw membersVinculoError_('CORE_RECALCULO_RESUMO_INDISPONIVEL', 'O recalculo do resumo operacional esta indisponivel.', {});
  }
  return GEAPA_CORE.coreRecalcularPessoasResumoOperacionalV2({ ambiente: environment, dryRun: false, confirmacao: 'RECALCULAR_PESSOAS_RESUMO_V2' });
}
