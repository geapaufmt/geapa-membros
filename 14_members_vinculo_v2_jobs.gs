/** Jobs idempotentes: nunca homologam desligamento de fim de semestre. */

function membersVinculoJobProcessar(options) {
  options = options || {};
  var context = { ambienteDadosV2: options.ambiente || options.environment, __deps: options.__deps || null };
  var deps = membersVinculoDependencies_(context);
  var environment = membersVinculoEnvironment_(context);
  var now = deps.now();
  var runId = String(options.runId || (deps.uuid ? deps.uuid() : Utilities.getUuid()));
  return deps.withLock('JOB_SOLICITACOES_VINCULO_' + environment, function() {
    var queue = deps.openSource('PESSOAS', MEMBERS_VINCULO_CFG.logicalSheet, environment, true);
    var report = { ok: true, ambiente: environment, runId: runId, suspensoesIniciadas: 0, retornos: 0, prontosAnaliseFinal: 0, erros: [] };
    queue.records.forEach(function(request) {
      try {
        var status = membersVinculoToken_(request.STATUS_SOLICITACAO);
        var today = membersVinculoToday_(now).iso;
        if (status === MEMBERS_VINCULO_CFG.statuses.approvedFuture && membersVinculoCivilDate_(request.DATA_INICIO_PRETENDIDA).iso <= today) {
          var ctx = { environment: environment, queue: queue, now: now, actor: 'JOB:' + runId };
          var started = membersVinculoExecuteEffect_(ctx, request, 'SUSPENSAO', { runId: runId }, deps);
          membersVinculoNotifyOwnerBestEffort_(deps, queue, started, environment, 'INICIO_SUSPENSAO', 'JOB:' + runId, now); report.suspensoesIniciadas++;
        } else if (status === MEMBERS_VINCULO_CFG.statuses.suspensionActive && membersVinculoCivilDate_(request.DATA_FIM_PRETENDIDA).iso <= today) {
          var returnCtx = { environment: environment, queue: queue, now: now, actor: 'JOB:' + runId };
          var returned = membersVinculoExecuteEffect_(returnCtx, request, 'RETORNO', { runId: runId }, deps);
          membersVinculoNotifyOwnerBestEffort_(deps, queue, returned, environment, 'RETORNO_SUSPENSAO', 'JOB:' + runId, now); report.retornos++;
        } else if (status === MEMBERS_VINCULO_CFG.statuses.scheduledFinal) {
          var semester = membersVinculoResolveSemesterById_(deps, environment, request.ID_SEMESTRE_REFERENCIA);
          if (semester.dataFim <= today) {
            membersVinculoAssertTransition_(status, MEMBERS_VINCULO_CFG.statuses.readyFinal);
            var calendarChanged = String(request.DATA_FIM_SEMESTRE_SNAPSHOT || '') !== semester.dataFim;
            membersVinculoUpdate_(queue, request, {
              STATUS_SOLICITACAO: MEMBERS_VINCULO_CFG.statuses.readyFinal, DATA_EFETIVA_PRETENDIDA: semester.dataFim,
              ATUALIZADO_EM: now, ATUALIZADO_POR: 'JOB:' + runId, RUN_ID_ULTIMO_PROCESSAMENTO: runId,
              HISTORICO_STATUS_JSON: membersVinculoHistoryAppend_(request, MEMBERS_VINCULO_CFG.statuses.readyFinal, 'JOB:' + runId, now, 'Data oficial do semestre atingida; decisao humana pendente.'),
              AUDITORIA_JSON: membersVinculoAuditAppend_(request, { acao: 'PRONTO_PARA_ANALISE_FINAL', em: now, por: 'JOB:' + runId, calendarioAlterado: calendarChanged, dataFimSnapshot: request.DATA_FIM_SEMESTRE_SNAPSHOT || '', dataFimVigente: semester.dataFim })
            });
            membersVinculoNotifyOwnerBestEffort_(deps, queue, request, environment, 'PRONTO_PARA_ANALISE_FINAL', 'JOB:' + runId, now);
            report.prontosAnaliseFinal++;
          }
        }
      } catch (error) { report.ok = false; report.erros.push({ idSolicitacao: request.ID_SOLICITACAO, code: error.code || 'JOB_ERRO', message: error.message }); }
    });
    return report;
  });
}

function membersVinculoJobProcessarDev(event) {
  return members_runOperationalFlow_(
    MEMBERS_OPERATIONAL_CONTROL.flows.voluntaryLinkRequests,
    MEMBERS_OPERATIONAL_CONTROL.capabilities.trigger,
    { eventOrOpts: event, executionTypeFallback: MEMBERS_OPERATIONAL_CONTROL.capabilities.trigger },
    function() { return membersVinculoJobProcessar({ ambiente: 'DEV' }); }
  );
}

function membersVinculoJobProcessarProd(event) {
  return members_runOperationalFlow_(
    MEMBERS_OPERATIONAL_CONTROL.flows.voluntaryLinkRequests,
    MEMBERS_OPERATIONAL_CONTROL.capabilities.trigger,
    { eventOrOpts: event, executionTypeFallback: MEMBERS_OPERATIONAL_CONTROL.capabilities.trigger },
    function() { return membersVinculoJobProcessar({ ambiente: 'PROD' }); }
  );
}
