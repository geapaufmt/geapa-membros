/** Analise humana, decisao e execucao idempotente das solicitacoes V2. */

function membersVinculoAdminSanitizeList_(request) {
  var terminal = MEMBERS_VINCULO_CFG.terminalStatuses.indexOf(membersVinculoToken_(request.STATUS_SOLICITACAO)) >= 0;
  return {
    idSolicitacao: request.ID_SOLICITACAO,
    tipo: request.TIPO_SOLICITACAO, modalidade: request.MODALIDADE_SOLICITADA,
    dataSolicitacao: request.DATA_SOLICITACAO, idSemestre: request.ID_SEMESTRE_REFERENCIA,
    status: request.STATUS_SOLICITACAO, resultadoValidacao: request.RESULTADO_VALIDACAO,
    decisao: request.DECISAO_DIRETORIA || '', atualizadoEm: request.ATUALIZADO_EM || '',
    terminal: terminal, acaoDisponivel: terminal ? 'VISUALIZAR' : 'ANALISAR'
  };
}

function membersVinculoAdminContext_(context, deps, permission, forWrite) {
  var environment = membersVinculoEnvironment_(context);
  var session = membersVinculoResolveSession_(context, deps, permission);
  var queue = deps.openSource('PESSOAS', MEMBERS_VINCULO_CFG.logicalSheet, environment, forWrite === true);
  return { environment: environment, session: session, queue: queue, now: deps.now(), actor: String(session.idPessoa || '').trim() };
}

function membersAdminSolicitacoesVinculoListar(filtros, contexto) {
  var deps = membersVinculoDependencies_(contexto || {}); var requestId = membersVinculoRequestId_(contexto || {}, deps);
  try {
    var ctx = membersVinculoAdminContext_(contexto, deps, MEMBERS_VINCULO_CFG.permissions.analyze, false);
    filtros = filtros || {};
    var initialDate = filtros.dataInicio ? membersVinculoCivilDate_(filtros.dataInicio, 'FILTRO_DATA_INICIO_INVALIDA').iso : '';
    var finalDate = filtros.dataFim ? membersVinculoCivilDate_(filtros.dataFim, 'FILTRO_DATA_FIM_INVALIDA').iso : '';
    var memberFilter = membersVinculoToken_(filtros.membro);
    var responsibleFilter = membersVinculoToken_(filtros.responsavel);
    var items = ctx.queue.records.filter(function(record) {
      if (filtros.tipo && membersVinculoToken_(record.TIPO_SOLICITACAO) !== membersVinculoToken_(filtros.tipo)) return false;
      if (filtros.modalidade && membersVinculoToken_(record.MODALIDADE_SOLICITADA) !== membersVinculoToken_(filtros.modalidade)) return false;
      if (filtros.status && membersVinculoToken_(record.STATUS_SOLICITACAO) !== membersVinculoToken_(filtros.status)) return false;
      if (filtros.idSemestre && String(record.ID_SEMESTRE_REFERENCIA || '') !== String(filtros.idSemestre)) return false;
      var requestDate = record.DATA_SOLICITACAO ? membersVinculoCivilDate_(record.DATA_SOLICITACAO, 'SOLICITACAO_DATA_INVALIDA').iso : '';
      if (initialDate && requestDate < initialDate) return false;
      if (finalDate && requestDate > finalDate) return false;
      if (memberFilter && membersVinculoToken_(record.ID_PESSOA).indexOf(memberFilter) < 0) return false;
      if (responsibleFilter) {
        var responsibles = [record.ANALISADO_PRELIMINARMENTE_POR, record.DECIDIDO_POR, record.ATUALIZADO_POR].map(membersVinculoToken_).join('|');
        if (responsibles.indexOf(responsibleFilter) < 0) return false;
      }
      return true;
    }).map(membersVinculoAdminSanitizeList_);
    return membersVinculoEnvelopeOk_('SOLICITACOES_VINCULO_ADMIN_LISTADAS', 'Solicitacoes carregadas.', { items: items }, requestId);
  } catch (error) { return membersVinculoEnvelopeError_(error, requestId); }
}

function membersAdminSolicitacaoVinculoDetalhe(payload, contexto) {
  var deps = membersVinculoDependencies_(contexto || {}); var requestId = membersVinculoRequestId_(contexto || {}, deps);
  try {
    var ctx = membersVinculoAdminContext_(contexto, deps, MEMBERS_VINCULO_CFG.permissions.analyze, false);
    var request = membersVinculoFindRequest_(ctx.queue.records, payload && payload.idSolicitacao);
    var base = deps.openSource('PESSOAS', 'BASE', ctx.environment, false).records.filter(function(record) { return String(record.ID_PESSOA || '') === String(request.ID_PESSOA); })[0] || {};
    var details = deps.openSource('PESSOAS', 'MEMBROS_DETALHES', ctx.environment, false).records.filter(function(record) { return String(record.ID_PESSOA || '') === String(request.ID_PESSOA); })[0] || {};
    var link = deps.openSource('PESSOAS', 'VINCULOS', ctx.environment, false).records.filter(function(record) { return String(record.ID_VINCULO || '') === String(request.ID_VINCULO); })[0] || {};
    var copy = Object.assign({}, request); delete copy.__rowNumber;
    var parameters = membersVinculoReadParameters_(deps, ctx.environment, membersVinculoToken_(request.TIPO_SOLICITACAO) === MEMBERS_VINCULO_CFG.types.dismissal);
    var normativeComparison = membersVinculoCompareNormativeSnapshots_(request, parameters);
    var finalRequirements = membersVinculoResolveFinalMinutesRequirement_(request, normativeComparison, null);
    return membersVinculoEnvelopeOk_('SOLICITACAO_VINCULO_ADMIN_DETALHE', 'Detalhe carregado.', {
      solicitacao: copy,
      somenteLeitura: MEMBERS_VINCULO_CFG.terminalStatuses.indexOf(membersVinculoToken_(request.STATUS_SOLICITACAO)) >= 0,
      pessoa: { nome: String(base.NOME_COMPLETO || base.NOME_EXIBICAO || '').trim(), rgaMascarado: membersVinculoMaskRga_(details.RGA), emailMascarado: membersVinculoMaskEmail_(base.EMAIL_PRINCIPAL || base.EMAIL) },
      vinculo: { idVinculo: link.ID_VINCULO, tipo: link.TIPO_VINCULO, status: link.STATUS_VINCULO, dataInicio: link.DATA_INICIO, ativo: link.ATIVO },
      parametrosNormativos: { snapshot: {
        SUSPENSAO_MINIMA: { valor: request.SUSPENSAO_MINIMA_VALOR_SNAPSHOT, unidade: request.SUSPENSAO_MINIMA_UNIDADE_SNAPSHOT, baseLegal: request.SUSPENSAO_MINIMA_BASE_LEGAL_SNAPSHOT },
        BLOQUEIO_DESLIGAMENTO_ANTES_APRESENTACAO: { valor: request.BLOQUEIO_DESLIGAMENTO_VALOR_SNAPSHOT, unidade: request.BLOQUEIO_DESLIGAMENTO_UNIDADE_SNAPSHOT, baseLegal: request.BLOQUEIO_DESLIGAMENTO_BASE_LEGAL_SNAPSHOT },
        DESLIGAMENTO_VOLUNTARIO_DECISAO_FINAL_EXIGE_ATA: { valor: request.ATA_DESLIGAMENTO_OBRIGATORIA_SNAPSHOT, tipoValor: request.ATA_DESLIGAMENTO_TIPO_VALOR_SNAPSHOT, unidade: 'NAO_APLICAVEL', baseLegal: request.ATA_DESLIGAMENTO_BASE_LEGAL_SNAPSHOT }
      }, vigente: normativeComparison.current, divergencias: normativeComparison.differences },
      requisitosDecisaoFinal: finalRequirements
    }, requestId);
  } catch (error) { return membersVinculoEnvelopeError_(error, requestId); }
}

function membersVinculoAdminUpdateStatus_(payload, contexto, permission, targetStatus, action, extraBuilder) {
  var deps = membersVinculoDependencies_(contexto || {}); var requestId = membersVinculoRequestId_(contexto || {}, deps);
  try {
    var output = deps.withLock(action, function() {
      var ctx = membersVinculoAdminContext_(contexto, deps, permission, true);
      var request = membersVinculoFindRequest_(ctx.queue.records, payload && payload.idSolicitacao);
      membersVinculoAssertRequestTransition_(request, targetStatus, action);
      var extra = extraBuilder ? extraBuilder(ctx, request, payload || {}, deps) : {};
      var updated = membersVinculoUpdate_(ctx.queue, request, Object.assign({
        STATUS_SOLICITACAO: targetStatus, ATUALIZADO_EM: ctx.now, ATUALIZADO_POR: ctx.actor,
        HISTORICO_STATUS_JSON: membersVinculoHistoryAppend_(request, targetStatus, ctx.actor, ctx.now, action),
        AUDITORIA_JSON: membersVinculoAuditAppend_(request, { acao: action, em: ctx.now, por: ctx.actor, requestId: requestId })
      }, extra));
      membersVinculoNotifyOwnerBestEffort_(deps, ctx.queue, updated, ctx.environment, action, ctx.actor, ctx.now);
      return updated;
    });
    return membersVinculoEnvelopeOk_(action, 'Operacao administrativa registrada.', { idSolicitacao: output.ID_SOLICITACAO, status: output.STATUS_SOLICITACAO }, requestId);
  } catch (error) { return membersVinculoEnvelopeError_(error, requestId); }
}

function membersAdminSolicitacaoVinculoIniciarAnalise(payload, contexto) {
  return membersVinculoAdminUpdateStatus_(payload, contexto, MEMBERS_VINCULO_CFG.permissions.analyze, MEMBERS_VINCULO_CFG.statuses.analyzing, 'ANALISE_VINCULO_INICIADA');
}

function membersAdminSolicitacaoVinculoSolicitarComplemento(payload, contexto) {
  return membersVinculoAdminUpdateStatus_(payload, contexto, MEMBERS_VINCULO_CFG.permissions.analyze, MEMBERS_VINCULO_CFG.statuses.complement, 'COMPLEMENTO_VINCULO_SOLICITADO', function(ctx, request, data) {
    var message = String(data.mensagem || data.observacao || '').trim();
    if (message.length < 10) throw membersVinculoError_('MENSAGEM_COMPLEMENTO_OBRIGATORIA', 'Informe o complemento solicitado.', {});
    return { OBS_DECISAO: message };
  });
}

function membersAdminSolicitacaoVinculoRegistrarAnalisePreliminar(payload, contexto) {
  return membersVinculoAdminUpdateStatus_(payload, contexto, MEMBERS_VINCULO_CFG.permissions.analyze, MEMBERS_VINCULO_CFG.statuses.scheduledFinal, 'ANALISE_PRELIMINAR_REGISTRADA', function(ctx, request, data) {
    if (membersVinculoToken_(request.MODALIDADE_SOLICITADA) !== MEMBERS_VINCULO_CFG.modalities.dismissalSemesterEnd) throw membersVinculoError_('ANALISE_PRELIMINAR_NAO_APLICAVEL', 'Analise preliminar aplica-se somente ao desligamento de fim de semestre.', {});
    var observation = String(data.observacao || '').trim();
    if (!observation) throw membersVinculoError_('OBS_ANALISE_PRELIMINAR_OBRIGATORIA', 'Registre a observacao da analise preliminar.', {});
    return { RESULTADO_ANALISE_PRELIMINAR: 'CONCLUIDA_SEM_HOMOLOGACAO', OBS_ANALISE_PRELIMINAR: observation, ANALISADO_PRELIMINARMENTE_EM: ctx.now, ANALISADO_PRELIMINARMENTE_POR: ctx.actor, OBS_DECISAO: 'Analise preliminar concluida. A homologacao final devera ocorrer na data efetiva prevista.' };
  });
}

function membersVinculoResolveSemesterById_(deps, environment, idSemestre) {
  var records = deps.openSource('VIGENCIAS', 'SEMESTRES', environment, false).records;
  var matches = records.filter(function(record) { return String(record.ID_SEMESTRE || '').trim() === String(idSemestre || '').trim(); });
  if (matches.length !== 1) throw membersVinculoError_('SEMESTRE_REFERENCIA_INDISPONIVEL', 'O semestre de referencia nao foi localizado de forma inequivoca.', { idSemestre: idSemestre, quantidade: matches.length });
  var start = membersVinculoCivilDate_(matches[0].DATA_INICIO, 'SEMESTRE_DATA_INICIO_INVALIDA');
  var end = membersVinculoCivilDate_(matches[0].DATA_FIM, 'SEMESTRE_DATA_FIM_INVALIDA');
  if (end.iso < start.iso) throw membersVinculoError_('SEMESTRE_INTERVALO_INVALIDO', 'O semestre possui intervalo invalido.', {});
  return { idSemestre: idSemestre, dataInicio: start.iso, dataFim: end.iso, status: membersVinculoToken_(matches[0].STATUS) };
}

function membersVinculoApplyNormativeReview_(ctx, request, payload, deps) {
  var parameters = membersVinculoReadParameters_(deps, ctx.environment, membersVinculoToken_(request.TIPO_SOLICITACAO) === MEMBERS_VINCULO_CFG.types.dismissal);
  var comparison = membersVinculoCompareNormativeSnapshots_(request, parameters);
  var treatment = membersVinculoRequireTransitionTreatment_(comparison, payload, ctx.actor, membersVinculoHasPermission_(ctx.session, MEMBERS_VINCULO_CFG.permissions.override));
  var changes = { PARAMETROS_ATUAIS_JSON: JSON.stringify(comparison.current), DIVERGENCIA_PARAMETROS: comparison.divergent ? 'SIM' : 'NAO' };
  if (treatment.divergent) Object.assign(changes, { TRATAMENTO_TRANSICAO: treatment.treatment, TRATAMENTO_TRANSICAO_EM: ctx.now, TRATAMENTO_TRANSICAO_POR: ctx.actor, JUSTIFICATIVA_ADMINISTRATIVA_REFORCADA: treatment.justification });
  return { parameters: parameters, comparison: comparison, treatment: treatment, finalRequirements: membersVinculoResolveFinalMinutesRequirement_(request, comparison, treatment), changes: changes };
}

function membersVinculoRevalidateDismissalBeforeEffect_(ctx, request, parameters, deps) {
  var links = deps.openSource('PESSOAS', 'VINCULOS', ctx.environment, false);
  var link = membersVinculoFindCurrentLink_(links.records, request.ID_PESSOA);
  if (String(link.ID_VINCULO || '') !== String(request.ID_VINCULO || '')) {
    throw membersVinculoError_('VINCULO_SOLICITACAO_DIVERGENTE', 'O vinculo ativo atual difere do vinculo da solicitacao.', {});
  }
  var external = membersVinculoAssessExternal_(deps, { idPessoa: request.ID_PESSOA }, ctx.environment, MEMBERS_VINCULO_CFG.types.dismissal, null, parameters.BLOQUEIO_DESLIGAMENTO_ANTES_APRESENTACAO, ctx.now);
  request.VALIDACAO_VINCULO_ATIVO = 'VALIDO';
  if (membersVinculoToken_(external.apresentacao) !== 'NAO_VERIFICADO') request.VALIDACAO_APRESENTACAO = external.apresentacao;
  if (membersVinculoToken_(external.arquivos) !== 'NAO_VERIFICADO') request.VALIDACAO_ARQUIVOS_PENDENTES = external.arquivos;
  if (membersVinculoToken_(external.obrigacoes) !== 'NAO_VERIFICADO') request.VALIDACAO_OBRIGACOES = external.obrigacoes;
  if (membersVinculoToken_(external.funcao) !== 'NAO_VERIFICADO') request.VALIDACAO_FUNCAO_ATIVA = external.funcao;
  request.RESULTADO_VALIDACAO = [request.VALIDACAO_APRESENTACAO, request.VALIDACAO_ARQUIVOS_PENDENTES, request.VALIDACAO_OBRIGACOES, request.VALIDACAO_FUNCAO_ATIVA].some(function(value) { return ['NAO_VERIFICADO','PENDENTE','ATIVA','CONFLITO'].indexOf(membersVinculoToken_(value)) >= 0; }) ? 'PENDENTE_ANALISE_MANUAL' : 'VALIDADO';
  request.MENSAGEM_VALIDACAO = external.mensagem || '';
  request.VALIDADO_EM = ctx.now;
  return external;
}

function membersVinculoDecisionChanges_(request, status, decision, observation, ctx, requestId) {
  return {
    STATUS_SOLICITACAO: status,
    DECISAO_DIRETORIA: decision,
    OBS_DECISAO: observation || '',
    DATA_DECISAO: ctx.now,
    DECIDIDO_POR: ctx.actor,
    ATUALIZADO_EM: ctx.now,
    ATUALIZADO_POR: ctx.actor,
    HISTORICO_STATUS_JSON: membersVinculoHistoryAppend_(request, status, ctx.actor, ctx.now, decision),
    AUDITORIA_JSON: membersVinculoAuditAppend_(request, { acao: decision, em: ctx.now, por: ctx.actor, requestId: requestId || '' })
  };
}

function membersVinculoAssertFinalValidations_(ctx, request, payload) {
  if (membersVinculoToken_(request.VALIDACAO_APRESENTACAO) === 'CONFLITO') throw membersVinculoError_('CONFLITO_APRESENTACAO_BLOQUEANTE', 'Ha apresentacao conflitante; a decisao final esta bloqueada.', {});
  var unresolved = ['VALIDACAO_APRESENTACAO','VALIDACAO_ARQUIVOS_PENDENTES','VALIDACAO_OBRIGACOES','VALIDACAO_FUNCAO_ATIVA'].filter(function(field) {
    return ['NAO_VERIFICADO','PENDENTE','ATIVA','CONFLITO'].indexOf(membersVinculoToken_(request[field])) >= 0;
  });
  if (unresolved.length) {
    var justification = String(payload.overrideJustificativa || '').trim();
    if (!membersVinculoHasPermission_(ctx.session, MEMBERS_VINCULO_CFG.permissions.override) || justification.length < 20) {
      throw membersVinculoError_('VALIDACOES_MANUAIS_PENDENTES', 'Existem validacoes pendentes; registre conferencia manual autorizada.', { campos: unresolved });
    }
    if (unresolved.indexOf('VALIDACAO_FUNCAO_ATIVA') >= 0 && payload.confirmacaoFuncaoRegularizada !== true) {
      throw membersVinculoError_('FUNCAO_ATIVA_NAO_REGULARIZADA', 'A funcao ativa deve ser encerrada, substituida ou transferida antes da execucao.', {});
    }
    return { OVERRIDE_VALIDACOES: 'SIM', OVERRIDE_JUSTIFICATIVA: justification, OVERRIDE_POR: ctx.actor, OVERRIDE_EM: ctx.now };
  }
  return { OVERRIDE_VALIDACOES: 'NAO' };
}

function membersVinculoAppendGeneric_(source, record) {
  var row = source.headers.map(function(header) { return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : ''; });
  source.sheet.getRange(source.sheet.getLastRow() + 1, 1, 1, source.headers.length).setValues([row]);
  record.__rowNumber = source.sheet.getLastRow(); source.records.push(record); return record;
}

function membersVinculoFindGeneratedEvent_(events, requestId, type) {
  var marker = 'SOLICITACAO=' + requestId;
  return (events.records || []).filter(function(record) {
    return membersVinculoToken_(record.TIPO_EVENTO) === membersVinculoToken_(type) && String(record.OBSERVACOES || '').indexOf(marker) >= 0;
  })[0] || null;
}

function membersVinculoResolveEventRga_(deps, environment, idPessoa) {
  var details = deps.openSource('PESSOAS', 'MEMBROS_DETALHES', environment, false).records.filter(function(record) {
    return String(record.ID_PESSOA || '').trim() === String(idPessoa || '').trim();
  })[0] || {};
  if (String(details.RGA || '').trim()) return String(details.RGA).trim();
  var identifiers = deps.openSource('PESSOAS', 'IDENTIFICADORES', environment, false).records.filter(function(record) {
    return String(record.ID_PESSOA || '').trim() === String(idPessoa || '').trim() && membersVinculoToken_(record.TIPO_IDENTIFICADOR) === 'RGA';
  });
  if (identifiers.length !== 1 || !String(identifiers[0].VALOR_IDENTIFICADOR || '').trim()) {
    throw membersVinculoError_('RGA_EVENTO_VINCULO_INDISPONIVEL', 'O RGA oficial necessario ao evento de vinculo nao foi resolvido de forma inequivoca.', { idPessoa: idPessoa, quantidade: identifiers.length });
  }
  return String(identifiers[0].VALOR_IDENTIFICADOR).trim();
}

function membersVinculoCreateEvent_(events, request, type, eventDate, actor, deps, environment) {
  var existing = membersVinculoFindGeneratedEvent_(events, request.ID_SOLICITACAO, type);
  if (existing) return existing;
  var rga = events.headers.indexOf('RGA') >= 0 ? membersVinculoResolveEventRga_(deps, environment, request.ID_PESSOA) : '';
  return membersVinculoAppendGeneric_(events, {
    ID_EVENTO_MEMBRO: 'EVT-' + String(deps.uuid()).replace(/-/g, '').slice(0, 20).toUpperCase(),
    ID_PESSOA: request.ID_PESSOA, ID_VINCULO: request.ID_VINCULO, RGA: rga, TIPO_EVENTO: type,
    DATA_EVENTO: eventDate, STATUS_EVENTO: 'HOMOLOGADO', MODULO_ORIGEM: 'GEAPA_MEMBROS_VINCULO_V2', ORIGEM_MODULO: 'GEAPA_MEMBROS_VINCULO_V2',
    CHAVE_ORIGEM: request.ID_SOLICITACAO + ':' + type,
    OBSERVACOES: 'SOLICITACAO=' + request.ID_SOLICITACAO + '; decisao humana registrada no sistema.',
    ATUALIZADO_EM: new Date(), PROCESSADO_POR_MODULO: actor, DATA_PROCESSAMENTO: new Date(), ERRO_PROCESSAMENTO: ''
  });
}

function membersVinculoExecuteEffect_(ctx, request, effect, payload, deps) {
  var links = deps.openSource('PESSOAS', 'VINCULOS', ctx.environment, true);
  var events = deps.openSource('PESSOAS', 'EVENTOS', ctx.environment, true);
  var link = links.records.filter(function(record) { return String(record.ID_VINCULO || '') === String(request.ID_VINCULO); })[0];
  if (!link) throw membersVinculoError_('VINCULO_EXECUCAO_NAO_ENCONTRADO', 'O vinculo da solicitacao nao foi encontrado.', {});
  var nowCivil = membersVinculoToday_(ctx.now).iso;
  var event;
  try {
    if (effect === 'SUSPENSAO') {
      if (membersVinculoToken_(link.STATUS_VINCULO) !== 'SUSPENSO') membersVinculoUpdate_(links, link, { STATUS_VINCULO: 'SUSPENSO', ATIVO: 'SIM', DATA_FIM: '' });
      membersVinculoUpdate_(ctx.queue, request, { ETAPA_EXECUCAO: 'VINCULO_SUSPENSO', RUN_ID_ULTIMO_PROCESSAMENTO: payload.runId || '' });
      event = membersVinculoCreateEvent_(events, request, 'SUSPENSAO', request.DATA_INICIO_PRETENDIDA || nowCivil, ctx.actor, deps, ctx.environment);
      membersVinculoUpdate_(ctx.queue, request, { ID_EVENTO_SUSPENSAO: event.ID_EVENTO_MEMBRO, ETAPA_EXECUCAO: 'EVENTO_SUSPENSAO_REGISTRADO' });
      deps.recalculateSummary(ctx.environment);
      return membersVinculoUpdate_(ctx.queue, request, {
        STATUS_SOLICITACAO: MEMBERS_VINCULO_CFG.statuses.suspensionActive, DATA_EFETIVA: request.DATA_INICIO_PRETENDIDA || nowCivil,
        EXECUTADO_EM: ctx.now, EXECUTADO_POR: ctx.actor, ETAPA_EXECUCAO: 'SUSPENSAO_ATIVA', ERRO_EXECUCAO: '',
        ATUALIZADO_EM: ctx.now, ATUALIZADO_POR: ctx.actor,
        HISTORICO_STATUS_JSON: membersVinculoHistoryAppend_(request, MEMBERS_VINCULO_CFG.statuses.suspensionActive, ctx.actor, ctx.now, 'Suspensao efetivada.'),
        AUDITORIA_JSON: membersVinculoAuditAppend_(request, { acao: 'EFETIVAR_SUSPENSAO', em: ctx.now, por: ctx.actor, idEvento: event.ID_EVENTO_MEMBRO })
      });
    }
    if (effect === 'RETORNO') {
      if (membersVinculoToken_(link.STATUS_VINCULO) !== 'ATIVO') membersVinculoUpdate_(links, link, { STATUS_VINCULO: 'ATIVO', ATIVO: 'SIM', DATA_FIM: '' });
      event = membersVinculoCreateEvent_(events, request, 'RETORNO', request.DATA_FIM_PRETENDIDA || nowCivil, ctx.actor, deps, ctx.environment);
      membersVinculoUpdate_(ctx.queue, request, { ID_EVENTO_RETORNO: event.ID_EVENTO_MEMBRO, ETAPA_EXECUCAO: 'EVENTO_RETORNO_REGISTRADO' });
      deps.recalculateSummary(ctx.environment);
      return membersVinculoUpdate_(ctx.queue, request, {
        STATUS_SOLICITACAO: MEMBERS_VINCULO_CFG.statuses.completed, DATA_EFETIVA: request.DATA_FIM_PRETENDIDA || nowCivil,
        EXECUTADO_EM: ctx.now, EXECUTADO_POR: ctx.actor, ETAPA_EXECUCAO: 'CONCLUIDO', ERRO_EXECUCAO: '', ATIVO: 'NAO',
        ATUALIZADO_EM: ctx.now, ATUALIZADO_POR: ctx.actor,
        HISTORICO_STATUS_JSON: membersVinculoHistoryAppend_(request, MEMBERS_VINCULO_CFG.statuses.completed, ctx.actor, ctx.now, 'Retorno efetivado.'),
        AUDITORIA_JSON: membersVinculoAuditAppend_(request, { acao: 'EFETIVAR_RETORNO', em: ctx.now, por: ctx.actor, idEvento: event.ID_EVENTO_MEMBRO })
      });
    }
    if (effect === 'DESLIGAMENTO') {
      if (membersVinculoToken_(link.STATUS_VINCULO) !== 'DESLIGADO' || membersVinculoIsYes_(link.ATIVO)) membersVinculoUpdate_(links, link, { STATUS_VINCULO: 'DESLIGADO', DATA_FIM: payload.dataEfetiva || nowCivil, MOTIVO_FIM: request.MOTIVO_CATEGORIA || 'DESLIGAMENTO_VOLUNTARIO', ATIVO: 'NAO', LINK_ATA_OU_PROCESSO: payload.ataReferencia || payload.idAtaDeliberacao || '' });
      membersVinculoUpdate_(ctx.queue, request, { ETAPA_EXECUCAO: 'VINCULO_DESLIGADO', RUN_ID_ULTIMO_PROCESSAMENTO: payload.runId || '' });
      event = membersVinculoCreateEvent_(events, request, 'DESLIGAMENTO_VOLUNTARIO', payload.dataEfetiva || nowCivil, ctx.actor, deps, ctx.environment);
      membersVinculoUpdate_(ctx.queue, request, { ID_EVENTO_DESLIGAMENTO: event.ID_EVENTO_MEMBRO, ETAPA_EXECUCAO: 'EVENTO_DESLIGAMENTO_REGISTRADO' });
      deps.recalculateSummary(ctx.environment);
      return membersVinculoUpdate_(ctx.queue, request, {
        STATUS_SOLICITACAO: MEMBERS_VINCULO_CFG.statuses.executed, DATA_EFETIVA: payload.dataEfetiva || nowCivil,
        EXECUTADO_EM: ctx.now, EXECUTADO_POR: ctx.actor, ETAPA_EXECUCAO: 'EXECUTADO', ERRO_EXECUCAO: '', ATIVO: 'NAO',
        ATUALIZADO_EM: ctx.now, ATUALIZADO_POR: ctx.actor,
        HISTORICO_STATUS_JSON: membersVinculoHistoryAppend_(request, MEMBERS_VINCULO_CFG.statuses.executed, ctx.actor, ctx.now, 'Desligamento voluntario efetivado.'),
        AUDITORIA_JSON: membersVinculoAuditAppend_(request, { acao: 'EFETIVAR_DESLIGAMENTO_VOLUNTARIO', em: ctx.now, por: ctx.actor, idEvento: event.ID_EVENTO_MEMBRO })
      });
    }
    throw membersVinculoError_('EFEITO_VINCULO_INVALIDO', 'Efeito de vinculo invalido.', { efeito: effect });
  } catch (error) {
    membersVinculoUpdate_(ctx.queue, request, { STATUS_SOLICITACAO: MEMBERS_VINCULO_CFG.statuses.executionError, ERRO_EXECUCAO: (error.code || 'ERRO') + ': ' + error.message, ATUALIZADO_EM: ctx.now, ATUALIZADO_POR: ctx.actor });
    throw error;
  }
}

function membersAdminSolicitacaoVinculoIndeferir(payload, contexto) {
  return membersVinculoAdminUpdateStatus_(payload, contexto, MEMBERS_VINCULO_CFG.permissions.approve, MEMBERS_VINCULO_CFG.statuses.denied, 'SOLICITACAO_VINCULO_INDEFERIDA', function(ctx, request, data, deps) {
    var observation = String(data.obsDecisao || '').trim();
    if (!observation) throw membersVinculoError_('OBS_DECISAO_OBRIGATORIA', 'Informe o motivo do indeferimento.', {});
    var norm = membersVinculoApplyNormativeReview_(ctx, request, data, deps);
    membersVinculoAssertFinalDecisionDocument_(request, data, norm.finalRequirements);
    return Object.assign({}, norm.changes, { DECISAO_DIRETORIA: 'INDEFERIDO', OBS_DECISAO: observation, ATA_REFERENCIA: String(data.ataReferencia || '').trim(), ID_ATA_DELIBERACAO: String(data.idAtaDeliberacao || '').trim(), DOCUMENTO_DECISAO_REFERENCIA: String(data.documentoDecisaoReferencia || '').trim(), DATA_DECISAO: ctx.now, DECIDIDO_POR: ctx.actor, ATIVO: 'NAO' });
  });
}

function membersAdminSolicitacaoVinculoHomologarSuspensao(payload, contexto) {
  var deps = membersVinculoDependencies_(contexto || {}); var requestId = membersVinculoRequestId_(contexto || {}, deps);
  try {
    var result = deps.withLock('HOMOLOGAR_SUSPENSAO', function() {
      var ctx = membersVinculoAdminContext_(contexto, deps, MEMBERS_VINCULO_CFG.permissions.approve, true);
      var request = membersVinculoFindRequest_(ctx.queue.records, payload && payload.idSolicitacao);
      if (membersVinculoToken_(request.TIPO_SOLICITACAO) !== MEMBERS_VINCULO_CFG.types.suspension) throw membersVinculoError_('TIPO_SOLICITACAO_INCOMPATIVEL', 'A solicitacao nao e de suspensao.', {});
      var norm = membersVinculoApplyNormativeReview_(ctx, request, payload || {}, deps);
      var override = membersVinculoAssertFinalValidations_(ctx, request, payload || {});
      if (membersVinculoToken_(request.VALIDACAO_SUSPENSAO_ANTERIOR) === 'CONFIRMADA') Object.assign(override, membersVinculoAssertSecondSuspensionOverride_(payload || {}, ctx.actor));
      var start = membersVinculoCivilDate_(request.DATA_INICIO_PRETENDIDA);
      var target = start.iso > membersVinculoToday_(ctx.now).iso ? MEMBERS_VINCULO_CFG.statuses.approvedFuture : MEMBERS_VINCULO_CFG.statuses.suspensionActive;
      membersVinculoAssertTransition_(request.STATUS_SOLICITACAO, target);
      membersVinculoUpdate_(ctx.queue, request, Object.assign({}, norm.changes, override,
        membersVinculoDecisionChanges_(request, target, 'HOMOLOGADA', String(payload.obsDecisao || '').trim(), ctx, requestId),
        { ATA_REFERENCIA: String(payload.ataReferencia || '').trim(), ID_ATA_DELIBERACAO: String(payload.idAtaDeliberacao || '').trim() }));
      if (target === MEMBERS_VINCULO_CFG.statuses.suspensionActive) {
        var active = membersVinculoExecuteEffect_(ctx, request, 'SUSPENSAO', payload || {}, deps);
        membersVinculoNotifyOwnerBestEffort_(deps, ctx.queue, active, ctx.environment, 'SUSPENSAO_APROVADA_E_INICIADA', ctx.actor, ctx.now);
        return active;
      }
      membersVinculoNotifyOwnerBestEffort_(deps, ctx.queue, request, ctx.environment, 'SUSPENSAO_APROVADA', ctx.actor, ctx.now);
      return request;
    });
    return membersVinculoEnvelopeOk_('SUSPENSAO_HOMOLOGADA', 'Decisao humana de suspensao registrada.', { idSolicitacao: result.ID_SOLICITACAO, status: result.STATUS_SOLICITACAO }, requestId);
  } catch (error) { return membersVinculoEnvelopeError_(error, requestId); }
}

function membersAdminSolicitacaoVinculoHomologarEfetivarDesligamento(payload, contexto) {
  var deps = membersVinculoDependencies_(contexto || {}); var requestId = membersVinculoRequestId_(contexto || {}, deps);
  try {
    var result = deps.withLock('HOMOLOGAR_E_EFETIVAR_DESLIGAMENTO', function() {
      var ctx = membersVinculoAdminContext_(contexto, deps, MEMBERS_VINCULO_CFG.permissions.approve, true);
      if (!membersVinculoHasPermission_(ctx.session, MEMBERS_VINCULO_CFG.permissions.execute)) throw membersVinculoError_('ACESSO_NEGADO_EXECUCAO', 'A execucao exige permissao especifica.', { permissaoExigida: MEMBERS_VINCULO_CFG.permissions.execute });
      var request = membersVinculoFindRequest_(ctx.queue.records, payload && payload.idSolicitacao);
      if (membersVinculoToken_(request.TIPO_SOLICITACAO) !== MEMBERS_VINCULO_CFG.types.dismissal) throw membersVinculoError_('TIPO_SOLICITACAO_INCOMPATIVEL', 'A solicitacao nao e de desligamento.', {});
      if (membersVinculoToken_(request.STATUS_SOLICITACAO) === MEMBERS_VINCULO_CFG.statuses.executed && String(request.ID_EVENTO_DESLIGAMENTO || '').trim()) {
        return { request: request, idempotent: true };
      }
      membersVinculoAssertRequestTransition_(request, MEMBERS_VINCULO_CFG.statuses.executed, 'HOMOLOGAR_E_EFETIVAR_DESLIGAMENTO');
      if (payload.confirmacaoReforcada !== true) throw membersVinculoError_('CONFIRMACAO_REFORCADA_OBRIGATORIA', 'Confirme explicitamente a homologacao e efetivacao.', {});
      var norm = membersVinculoApplyNormativeReview_(ctx, request, payload || {}, deps);
      membersVinculoAssertFinalDecisionDocument_(request, payload || {}, norm.finalRequirements);
      membersVinculoRevalidateDismissalBeforeEffect_(ctx, request, norm.parameters, deps);
      var override = membersVinculoAssertFinalValidations_(ctx, request, payload || {});
      var effective = membersVinculoToday_(ctx.now).iso;
      if (membersVinculoToken_(request.MODALIDADE_SOLICITADA) === MEMBERS_VINCULO_CFG.modalities.dismissalSemesterEnd) {
        var semester = membersVinculoResolveSemesterById_(deps, ctx.environment, request.ID_SEMESTRE_REFERENCIA);
        effective = semester.dataFim;
        if (membersVinculoToday_(ctx.now).iso < effective) throw membersVinculoError_('HOMOLOGACAO_FINAL_ANTECIPADA_BLOQUEADA', 'A homologacao final somente pode ocorrer na data oficial do fim do semestre ou depois.', { dataEfetiva: effective });
        if (String(request.DATA_FIM_SEMESTRE_SNAPSHOT || '') !== effective) {
          override.CALENDARIO_DIVERGENTE = 'SIM';
          override.AUDITORIA_JSON = membersVinculoAuditAppend_(request, { acao: 'DATA_FIM_SEMESTRE_ATUALIZADA', snapshot: request.DATA_FIM_SEMESTRE_SNAPSHOT, vigente: effective, em: ctx.now, por: ctx.actor });
        }
      }
      membersVinculoUpdate_(ctx.queue, request, Object.assign({}, norm.changes, override,
        membersVinculoDecisionChanges_(request, MEMBERS_VINCULO_CFG.statuses.executed, 'HOMOLOGADO', String(payload.obsDecisao || '').trim(), ctx, requestId),
        { ATA_REFERENCIA: String(payload.ataReferencia || '').trim(), ID_ATA_DELIBERACAO: String(payload.idAtaDeliberacao || '').trim() }));
      var executed = membersVinculoExecuteEffect_(ctx, request, 'DESLIGAMENTO', Object.assign({}, payload, { dataEfetiva: effective }), deps);
      membersVinculoNotifyOwnerBestEffort_(deps, ctx.queue, executed, ctx.environment, 'DESLIGAMENTO_HOMOLOGADO_EXECUTADO', ctx.actor, ctx.now);
      if (ctx.environment === 'DEV' && contexto && contexto.featureFlags && contexto.featureFlags.ENABLE_EGRESS_FEEDBACK === true) {
        membersEgressRegisterInvitationBestEffort_(ctx, executed, deps);
      }
      return { request: executed, idempotent: false };
    });
    return membersVinculoEnvelopeOk_(result.idempotent ? 'DESLIGAMENTO_JA_EXECUTADO' : 'DESLIGAMENTO_HOMOLOGADO_E_EXECUTADO', result.idempotent ? 'O desligamento ja estava efetivado.' : 'Desligamento homologado por decisao humana e efetivado.', { idSolicitacao: result.request.ID_SOLICITACAO, status: result.request.STATUS_SOLICITACAO, idEvento: result.request.ID_EVENTO_DESLIGAMENTO, idempotente: result.idempotent }, requestId);
  } catch (error) { return membersVinculoEnvelopeError_(error, requestId); }
}

function membersAdminSolicitacaoVinculoCancelar(payload, contexto) {
  return membersVinculoAdminUpdateStatus_(payload, contexto, MEMBERS_VINCULO_CFG.permissions.analyze, MEMBERS_VINCULO_CFG.statuses.adminCancelled, 'SOLICITACAO_VINCULO_CANCELADA_DIRETORIA', function(ctx, request, data) {
    var reason = String(data.motivo || '').trim(); if (!reason) throw membersVinculoError_('MOTIVO_CANCELAMENTO_OBRIGATORIO', 'Informe o motivo do cancelamento.', {});
    return { CANCELADO_EM: ctx.now, CANCELADO_POR: ctx.actor, MOTIVO_CANCELAMENTO: reason, ATIVO: 'NAO' };
  });
}

function membersAdminSolicitacaoVinculoReprocessar(payload, contexto) {
  var deps = membersVinculoDependencies_(contexto || {}); var requestId = membersVinculoRequestId_(contexto || {}, deps);
  try {
    var result = deps.withLock('REPROCESSAR_SOLICITACAO_VINCULO', function() {
      var ctx = membersVinculoAdminContext_(contexto, deps, MEMBERS_VINCULO_CFG.permissions.execute, true);
      var request = membersVinculoFindRequest_(ctx.queue.records, payload && payload.idSolicitacao);
      if (membersVinculoToken_(request.STATUS_SOLICITACAO) !== MEMBERS_VINCULO_CFG.statuses.executionError) throw membersVinculoError_('SOLICITACAO_SEM_ERRO_RECUPERAVEL', 'A solicitacao nao esta em erro recuperavel.', {});
      var effect;
      if (membersVinculoToken_(request.TIPO_SOLICITACAO) === MEMBERS_VINCULO_CFG.types.dismissal || request.ID_EVENTO_DESLIGAMENTO) effect = 'DESLIGAMENTO';
      else if (request.ID_EVENTO_RETORNO || membersVinculoToken_(request.ETAPA_EXECUCAO).indexOf('RETORNO') >= 0) effect = 'RETORNO';
      else effect = 'SUSPENSAO';
      return membersVinculoExecuteEffect_(ctx, request, effect, payload || {}, deps);
    });
    return membersVinculoEnvelopeOk_('SOLICITACAO_VINCULO_REPROCESSADA', 'Reprocessamento concluido sem duplicar efeitos.', { idSolicitacao: result.ID_SOLICITACAO, status: result.STATUS_SOLICITACAO }, requestId);
  } catch (error) { return membersVinculoEnvelopeError_(error, requestId); }
}

function membersVinculoNotificationTypeForStatus_(request) {
  var status = membersVinculoToken_(request.STATUS_SOLICITACAO);
  var map = {
    RECEBIDO: 'SOLICITACAO_RECEBIDA',
    AGUARDANDO_COMPLEMENTO: 'COMPLEMENTO_VINCULO_SOLICITADO',
    AGENDADO_PARA_ANALISE_FINAL: 'ANALISE_PRELIMINAR_CONCLUIDA',
    PRONTO_PARA_ANALISE_FINAL: 'PRONTO_PARA_ANALISE_FINAL',
    HOMOLOGADO_AGUARDANDO_INICIO: 'SUSPENSAO_APROVADA',
    SUSPENSAO_ATIVA: 'INICIO_SUSPENSAO',
    CONCLUIDO: 'RETORNO_SUSPENSAO',
    INDEFERIDO: 'SOLICITACAO_VINCULO_INDEFERIDA',
    EXECUTADO: 'DESLIGAMENTO_HOMOLOGADO_EXECUTADO',
    CANCELADO_PELO_MEMBRO: 'SOLICITACAO_VINCULO_CANCELADA',
    CANCELADO_PELA_DIRETORIA: 'SOLICITACAO_VINCULO_CANCELADA'
  };
  return map[status] || '';
}

function membersAdminSolicitacaoVinculoReenviarNotificacao(payload, contexto) {
  var deps = membersVinculoDependencies_(contexto || {}); var requestId = membersVinculoRequestId_(contexto || {}, deps);
  try {
    var result = deps.withLock('REENVIAR_NOTIFICACAO_VINCULO', function() {
      var ctx = membersVinculoAdminContext_(contexto, deps, MEMBERS_VINCULO_CFG.permissions.analyze, true);
      var request = membersVinculoFindRequest_(ctx.queue.records, payload && payload.idSolicitacao);
      var eventType = membersVinculoNotificationTypeForStatus_(request);
      if (!eventType) throw membersVinculoError_('NOTIFICACAO_VINCULO_NAO_APLICAVEL', 'Nao existe notificacao segura definida para o status atual.', { status: request.STATUS_SOLICITACAO });
      var notification = membersVinculoNotifyOwnerBestEffort_(deps, ctx.queue, request, ctx.environment, eventType, ctx.actor, ctx.now);
      if (!notification || notification.ok === false) throw membersVinculoError_('NOTIFICACAO_NAO_ENVIADA', 'A notificacao nao foi enviada; a solicitacao e sua decisao permanecem registradas.', {});
      membersVinculoUpdate_(ctx.queue, request, { AUDITORIA_JSON: membersVinculoAuditAppend_(request, { acao: 'NOTIFICACAO_REENVIADA', tipoEvento: eventType, em: ctx.now, por: ctx.actor, requestId: requestId }) });
      return { request: request, eventType: eventType };
    });
    return membersVinculoEnvelopeOk_('NOTIFICACAO_VINCULO_REENVIADA', 'Notificacao reenviada sem alterar a decisao.', { idSolicitacao: result.request.ID_SOLICITACAO, tipoEvento: result.eventType }, requestId);
  } catch (error) { return membersVinculoEnvelopeError_(error, requestId); }
}
