/***************************************
 * 07_members_lifecycle_consumers.gs
 *
 * Consumidores de eventos de ciclo de vida
 * registrados no core.
 ***************************************/

function members_processApprovedDismissalByAbsenceEvents() {
  members_assertCore_();

  var events = members_listApprovedDismissalByAbsenceEvents_();
  var summary = {
    ok: true,
    scanned: events.length,
    processed: 0,
    markedProcessedOnly: 0,
    skippedAlreadyProcessed: 0,
    errors: 0,
    results: []
  };

  events.forEach(function(event) {
    var eventId = String(event.eventId || "").trim();

    try {
      var outcome = members_processSingleApprovedDismissalByAbsenceEvent_(event);
      summary.results.push(outcome);

      if (outcome.action === "processed") summary.processed += 1;
      if (outcome.action === "mark_processed_only") summary.markedProcessedOnly += 1;
      if (outcome.action === "skip_already_processed") summary.skippedAlreadyProcessed += 1;
    } catch (err) {
      var safeError = err && err.message ? err.message : String(err);
      summary.ok = false;
      summary.errors += 1;
      summary.results.push({
        ok: false,
        eventId: eventId,
        action: "error",
        error: safeError
      });

      if (eventId) {
        try {
          members_markDismissalByAbsenceEventError_(eventId, safeError);
        } catch (markErr) {
          Logger.log(
            "members_markDismissalByAbsenceEventError_ falhou para " + eventId + ": " +
            (markErr && markErr.message ? markErr.message : markErr)
          );
        }
      }
    }
  });

  return summary;
}

function members_buildOffboardingPayloadFromLifecycleEvent_(event) {
  var normalized = members_normalizeLifecycleEventRecord_(event);
  var eventId = String(normalized.eventId || "").trim();
  var eventDate = normalized.eventDateRaw || normalized.eventDate || "";
  var reason = String(normalized.reason || "").trim() ||
    "Desligamento efetivo por faltas homologado em evento disciplinar.";

  if (!eventId) {
    throw new Error("Evento de ciclo de vida sem ID_EVENTO_MEMBRO.");
  }

  return {
    requestType: SETTINGS.offboarding.requestType,
    leaveTiming: SETTINGS.offboarding.immediate,
    decision: SETTINGS.offboarding.approved,
    finalEmailSent: SETTINGS.offboarding.yes,
    memberRga: String(normalized.memberRga || "").trim(),
    memberEmail: String(normalized.memberEmail || "").trim(),
    memberName: String(normalized.memberName || "").trim(),
    approvedAt: eventDate,
    sourceKey: eventId,
    reason: reason,
    offboardingSourceDescription: "homologacao de desligamento por faltas em evento disciplinar",
    internalNote:
      "Evento " + eventId +
      " consumido pelo geapa-membros a partir de MEMBER_EVENTOS_VINCULO."
  };
}

function members_markDismissalByAbsenceEventProcessed_(eventId, result) {
  var eventInfo = members_findLifecycleEventById_(eventId);
  if (!eventInfo) {
    throw new Error("Evento de ciclo de vida nao encontrado para marcacao de sucesso: " + eventId);
  }

  var note = members_buildLifecycleEventAuditNote_("processado", result);
  var updateContract = members_buildLifecycleEventUpdateContract_(eventInfo.record, {
    eventStatus: SETTINGS.lifecycle.processedMembersStatus,
    processingDate: new Date(),
    processedByModule: SETTINGS.lifecycle.membersModule,
    processingError: "",
    noteToAppend: note
  });

  return members_updateLifecycleEventViaCore_(eventId, updateContract);
}

function members_markDismissalByAbsenceEventError_(eventId, error) {
  var eventInfo = members_findLifecycleEventById_(eventId);
  if (!eventInfo) {
    throw new Error("Evento de ciclo de vida nao encontrado para marcacao de erro: " + eventId);
  }

  var safeError = error && error.message ? error.message : String(error || "");
  var note = members_buildLifecycleEventAuditNote_("erro", { error: safeError });
  var updateContract = members_buildLifecycleEventUpdateContract_(eventInfo.record, {
    processingDate: new Date(),
    processedByModule: SETTINGS.lifecycle.membersModule,
    processingError: safeError,
    noteToAppend: note
  });

  return members_updateLifecycleEventViaCore_(eventId, updateContract);
}

function members_testDismissalByAbsenceLifecycleConsumer() {
  var sampleEvent = {
    ID_EVENTO_MEMBRO: "EVT-123",
    TIPO_EVENTO: SETTINGS.lifecycle.dismissalByAbsenceType,
    STATUS_EVENTO: SETTINGS.lifecycle.homologatedStatus,
    DATA_EVENTO: "18/04/2026",
    ORIGEM_MODULO: SETTINGS.lifecycle.activitiesModule,
    RGA: "202012345",
    EMAIL_MEMBRO: "MEMBRO@UFMS.BR",
    NOME_MEMBRO: "Maria da Silva"
  };

  var payload = members_buildOffboardingPayloadFromLifecycleEvent_(sampleEvent);
  var stateProcessedOnly = members_classifyDismissalByAbsenceExecution_({
    alreadyProcessed: false,
    currentFound: false,
    histFound: true
  });
  var stateNeedsOffboard = members_classifyDismissalByAbsenceExecution_({
    alreadyProcessed: false,
    currentFound: true,
    histFound: false
  });
  var stateError = members_classifyDismissalByAbsenceExecution_({
    alreadyProcessed: false,
    currentFound: false,
    histFound: false
  });
  var mergedNotes = members_mergeLifecycleEventNotes_("Observacao anterior", "Observacao nova");
  var updateContract = members_buildLifecycleEventUpdateContract_(sampleEvent, {
    eventStatus: SETTINGS.lifecycle.processedMembersStatus,
    processingDate: new Date("2026-04-18T12:00:00Z"),
    processedByModule: SETTINGS.lifecycle.membersModule,
    processingError: "",
    noteToAppend: "Observacao nova"
  });

  members_assertDismissalByAbsenceTest_(payload.requestType === SETTINGS.offboarding.requestType, "Payload com requestType invalido.");
  members_assertDismissalByAbsenceTest_(payload.leaveTiming === SETTINGS.offboarding.immediate, "Payload com leaveTiming invalido.");
  members_assertDismissalByAbsenceTest_(payload.decision === SETTINGS.offboarding.approved, "Payload com decision invalido.");
  members_assertDismissalByAbsenceTest_(payload.finalEmailSent === SETTINGS.offboarding.yes, "Payload com finalEmailSent invalido.");
  members_assertDismissalByAbsenceTest_(payload.memberEmail === "membro@ufms.br", "Payload nao normalizou email.");
  members_assertDismissalByAbsenceTest_(payload.sourceKey === "EVT-123", "Payload nao reaproveitou o ID do evento.");
  members_assertDismissalByAbsenceTest_(stateProcessedOnly.action === "mark_processed_only", "Classificacao idempotente incorreta.");
  members_assertDismissalByAbsenceTest_(stateNeedsOffboard.action === "processed", "Classificacao de processamento incorreta.");
  members_assertDismissalByAbsenceTest_(stateError.action === "error", "Classificacao de erro incorreta.");
  members_assertDismissalByAbsenceTest_(mergedNotes === "Observacao anterior\nObservacao nova", "Merge de notes incorreto.");
  members_assertDismissalByAbsenceTest_(Object.prototype.hasOwnProperty.call(updateContract, "processingDate"), "Contrato sem processingDate.");
  members_assertDismissalByAbsenceTest_(Object.prototype.hasOwnProperty.call(updateContract, "processedByModule"), "Contrato sem processedByModule.");
  members_assertDismissalByAbsenceTest_(Object.prototype.hasOwnProperty.call(updateContract, "processingError"), "Contrato sem processingError.");
  members_assertDismissalByAbsenceTest_(Object.prototype.hasOwnProperty.call(updateContract, "notes"), "Contrato sem notes completo.");
  members_assertDismissalByAbsenceTest_(!Object.prototype.hasOwnProperty.call(updateContract, "processedAt"), "Contrato ainda contem processedAt.");
  members_assertDismissalByAbsenceTest_(!Object.prototype.hasOwnProperty.call(updateContract, "lastError"), "Contrato ainda contem lastError.");
  members_assertDismissalByAbsenceTest_(!Object.prototype.hasOwnProperty.call(updateContract, "notesAppend"), "Contrato ainda contem notesAppend.");

  return {
    ok: true,
    testedAt: new Date(),
    payloadSample: payload,
    stateProcessedOnly: stateProcessedOnly,
    stateNeedsOffboard: stateNeedsOffboard,
    stateError: stateError,
    updateContractSample: updateContract
  };
}

function members_processSingleApprovedDismissalByAbsenceEvent_(event) {
  var normalized = members_normalizeLifecycleEventRecord_(event);
  var eventId = String(normalized.eventId || "").trim();
  var latestEventInfo = null;

  if (!eventId) {
    throw new Error("Evento homologado sem ID_EVENTO_MEMBRO.");
  }

  latestEventInfo = members_findLifecycleEventById_(eventId);
  if (latestEventInfo && latestEventInfo.record) {
    normalized = members_normalizeLifecycleEventRecord_(latestEventInfo.record);
  }

  if (normalized.eventStatus === SETTINGS.lifecycle.processedMembersStatus) {
    return {
      ok: true,
      eventId: eventId,
      action: "skip_already_processed",
      message: "Evento ja estava marcado como PROCESSADO_MEMBROS."
    };
  }

  var payload = members_buildOffboardingPayloadFromLifecycleEvent_(normalized);
  var currentSheet = members_sheetByKey_(SETTINGS.currentKey);
  var histSheet = members_sheetByKey_(SETTINGS.histKey);

  if (!currentSheet || !histSheet) {
    throw new Error("Nao foi possivel localizar MEMBERS_ATUAIS ou MEMBERS_HIST.");
  }

  var currentMatch = members_findCurrentMemberMatch_(currentSheet, payload);
  var histMatch = members_historyFindEquivalentRow_(histSheet, payload);
  var execution = members_classifyDismissalByAbsenceExecution_({
    alreadyProcessed: normalized.eventStatus === SETTINGS.lifecycle.processedMembersStatus,
    currentFound: !!(currentMatch && currentMatch.found),
    histFound: !!(histMatch && histMatch.found)
  });

  if (execution.action === "skip_already_processed") {
    return {
      ok: true,
      eventId: eventId,
      action: execution.action,
      message: execution.message
    };
  }

  if (execution.action === "error") {
    throw new Error(
      execution.message +
      " RGA=\"" + String(payload.memberRga || "") + "\"" +
      ", EMAIL=\"" + String(payload.memberEmail || "") + "\"" +
      ", NOME=\"" + String(payload.memberName || "") + "\"."
    );
  }

  if (execution.action === "mark_processed_only") {
    var markOnlyResult = {
      ok: true,
      eventId: eventId,
      action: "mark_processed_only",
      matchBy: "HISTORICO_EQUIVALENTE",
      duplicatedHistory: true,
      moved: false,
      note: execution.message
    };
    members_markDismissalByAbsenceEventProcessed_(eventId, markOnlyResult);
    return markOnlyResult;
  }

  var offboardResult = members_offboardApprovedImmediateExit(payload);
  var processedResult = {
    ok: true,
    eventId: eventId,
    action: "processed",
    moved: !!offboardResult.moved,
    duplicatedHistory: !!offboardResult.duplicatedHistory,
    matchBy: offboardResult.matchBy || "",
    removedCurrentRowNumber: offboardResult.removedCurrentRowNumber || "",
    note: execution.message
  };

  members_markDismissalByAbsenceEventProcessed_(eventId, processedResult);
  return processedResult;
}

function members_listApprovedDismissalByAbsenceEvents_() {
  return members_readRecordsByKey_(SETTINGS.lifecycle.eventKey, {
    skipBlankRows: true
  })
    .map(members_normalizeLifecycleEventRecord_)
    .filter(function(event) {
      return (
        event.eventType === SETTINGS.lifecycle.dismissalByAbsenceType &&
        event.eventStatus === SETTINGS.lifecycle.homologatedStatus &&
        (!event.sourceModule || event.sourceModule === SETTINGS.lifecycle.activitiesModule)
      );
    });
}

function members_normalizeLifecycleEventRecord_(record) {
  record = record || {};

  return {
    raw: record,
    rowNumber: Number(record.__rowNumber || 0) || 0,
    eventId: String(members_getRecordValueByAliases_(record, members_getHeaderAliases_("lifecycleEvent", "eventId")) || "").trim(),
    eventType: String(members_getRecordValueByAliases_(record, members_getHeaderAliases_("lifecycleEvent", "eventType")) || "").trim().toUpperCase(),
    eventStatus: String(members_getRecordValueByAliases_(record, members_getHeaderAliases_("lifecycleEvent", "eventStatus")) || "").trim().toUpperCase(),
    eventDateRaw: members_getRecordValueByAliases_(record, members_getHeaderAliases_("lifecycleEvent", "eventDate")),
    eventDate: members_offboardingToDate_(members_getRecordValueByAliases_(record, members_getHeaderAliases_("lifecycleEvent", "eventDate"))),
    sourceModule: String(members_getRecordValueByAliases_(record, members_getHeaderAliases_("lifecycleEvent", "sourceModule")) || "").trim().toUpperCase(),
    sourceKey: String(members_getRecordValueByAliases_(record, members_getHeaderAliases_("lifecycleEvent", "sourceKey")) || "").trim(),
    sourceRow: members_getRecordValueByAliases_(record, members_getHeaderAliases_("lifecycleEvent", "sourceRow")),
    memberName: String(members_getRecordValueByAliases_(record, members_getHeaderAliases_("lifecycleEvent", "memberName")) || "").trim(),
    memberEmail: members_normalizeEmail_(members_getRecordValueByAliases_(record, members_getHeaderAliases_("lifecycleEvent", "memberEmail")) || ""),
    memberRga: String(members_getRecordValueByAliases_(record, members_getHeaderAliases_("lifecycleEvent", "memberRga")) || "").trim(),
    notes: String(members_getRecordValueByAliases_(record, members_getHeaderAliases_("lifecycleEvent", "notes")) || "").trim(),
    reason: String(members_getRecordValueByAliases_(record, members_getHeaderAliases_("lifecycleEvent", "reason")) || "").trim()
  };
}

function members_classifyDismissalByAbsenceExecution_(state) {
  if (state.alreadyProcessed) {
    return {
      action: "skip_already_processed",
      message: "Evento ja marcado como PROCESSADO_MEMBROS."
    };
  }

  if (state.currentFound) {
    return {
      action: "processed",
      message: state.histFound
        ? "Membro ainda consta em MEMBERS_ATUAIS e o historico equivalente ja existe; fluxo fara apenas a remocao da base atual."
        : "Membro localizado em MEMBERS_ATUAIS; fluxo seguira para desligamento efetivo."
    };
  }

  if (state.histFound) {
    return {
      action: "mark_processed_only",
      message: "Membro ja esta fora de MEMBERS_ATUAIS e o historico equivalente ja existe em MEMBERS_HIST."
    };
  }

  return {
    action: "error",
    message: "Nao foi possivel confirmar desligamento idempotente: membro ausente em MEMBERS_ATUAIS e sem historico equivalente."
  };
}

function members_findLifecycleEventById_(eventId) {
  var targetId = String(eventId || "").trim();
  if (!targetId) return null;

  var records = members_readRecordsByKey_(SETTINGS.lifecycle.eventKey, {
    skipBlankRows: true
  });

  for (var i = 0; i < records.length; i++) {
    var recordId = String(
      members_getRecordValueByAliases_(records[i], members_getHeaderAliases_("lifecycleEvent", "eventId")) || ""
    ).trim();
    if (recordId === targetId) {
      return {
        record: records[i],
        rowNumber: Number(records[i].__rowNumber || 0) || 0
      };
    }
  }

  return null;
}

function members_assertLifecycleEventUpdateCore_() {
  var supported =
    members_coreHas_("coreUpdateMemberLifecycleEvent") ||
    members_coreHas_("coreUpdateMemberLifecycleEventById") ||
    members_coreHas_("corePatchMemberLifecycleEvent");

  if (!supported) {
    throw new Error(
      "GEAPA-CORE sem API publica de atualizacao de MEMBER_EVENTOS_VINCULO. " +
      "Atualize a library antes de processar desligamentos por faltas."
    );
  }
}

function members_updateLifecycleEventViaCore_(eventId, updates) {
  var targetEventId = String(eventId || "").trim();
  if (!targetEventId) {
    throw new Error("ID_EVENTO_MEMBRO obrigatorio para atualizacao via core.");
  }

  members_assertLifecycleEventUpdateCore_();

  var contract = Object.assign({
    eventId: targetEventId
  }, updates || {});

  var attempts = [
    function() {
      if (!members_coreHas_("coreUpdateMemberLifecycleEvent")) return null;
      return GEAPA_CORE.coreUpdateMemberLifecycleEvent(contract);
    },
    function() {
      if (!members_coreHas_("coreUpdateMemberLifecycleEventById")) return null;
      return GEAPA_CORE.coreUpdateMemberLifecycleEventById(contract);
    },
    function() {
      if (!members_coreHas_("corePatchMemberLifecycleEvent")) return null;
      return GEAPA_CORE.corePatchMemberLifecycleEvent(contract);
    }
  ];

  var errors = [];

  for (var i = 0; i < attempts.length; i++) {
    try {
      var result = attempts[i]();
      if (result !== null) return result;
    } catch (err) {
      errors.push(err && err.message ? err.message : String(err));
    }
  }

  throw new Error(
    "Falha ao atualizar evento de ciclo de vida via API publica do core. " +
    errors.join(" | ")
  );
}

function members_buildLifecycleEventUpdateContract_(eventRecord, updates) {
  updates = updates || {};

  var contract = {};
  if (updates.eventStatus != null) contract.eventStatus = updates.eventStatus;
  if (updates.processedByModule != null) contract.processedByModule = updates.processedByModule;
  if (updates.processingDate != null) contract.processingDate = updates.processingDate;
  if (updates.processingError != null) contract.processingError = updates.processingError;

  if (Object.prototype.hasOwnProperty.call(updates, "noteToAppend")) {
    var existingNotes = members_getRecordValueByAliases_(eventRecord, members_getHeaderAliases_("lifecycleEvent", "notes"));
    contract.notes = members_mergeLifecycleEventNotes_(existingNotes, updates.noteToAppend);
  }

  return contract;
}

function members_mergeLifecycleEventNotes_(currentNotes, newNote) {
  var current = String(currentNotes || "").trim();
  var addition = String(newNote || "").trim();

  if (!current) return addition;
  if (!addition) return current;
  return current + "\n" + addition;
}

function members_buildLifecycleEventAuditNote_(kind, details) {
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
  var base = SETTINGS.lifecycle.notePrefix + " " + timestamp + " - ";

  if (kind === "processado") {
    var moved = details && details.moved ? "sim" : "nao";
    var duplicate = details && details.duplicatedHistory ? "sim" : "nao";
    var matchBy = details && details.matchBy ? String(details.matchBy) : "";
    var suffix =
      "evento processado com sucesso; moved=" + moved +
      "; duplicatedHistory=" + duplicate;
    if (matchBy) suffix += "; matchBy=" + matchBy;
    if (details && details.note) suffix += "; note=" + details.note;
    return base + suffix + ".";
  }

  return base + "erro no processamento: " + String((details && details.error) || "erro nao especificado") + ".";
}

function members_assertDismissalByAbsenceTest_(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
