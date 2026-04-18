/***************************************
 * 06_members_chapas.gs
 *
 * Fluxo eleitoral simplificado:
 * - lê inscrições de chapas
 * - analisa Presidente e Vice
 * - marca DEFERIDA / INDEFERIDA
 * - envia email automático com o resultado
 * - quando Resultado final = ELEITA,
 *   registra automaticamente Presidente e Vice
 *   em VIGENCIA_MEMBROS_DIRETORIAS
 ***************************************/

function members_setupChapasSheet_() {
  members_assertCore_();

  const sheet = GEAPA_CORE.coreGetSheetByKey(SETTINGS.election.chapaKey);
  if (!sheet) {
    throw new Error("Não foi possível localizar a planilha de inscrições de chapas via GEAPA-CORE.");
  }

  const required = [
    SETTINGS.election.chapaHeaders.presidentStatus,
    SETTINGS.election.chapaHeaders.presidentReasons,
    SETTINGS.election.chapaHeaders.viceStatus,
    SETTINGS.election.chapaHeaders.viceReasons,
    SETTINGS.election.chapaHeaders.chapaStatus,
    SETTINGS.election.chapaHeaders.chapaReasons,
    SETTINGS.election.chapaHeaders.automaticOpinion,
    SETTINGS.election.chapaHeaders.analyzedAt,
    SETTINGS.election.chapaHeaders.finalResult,
    SETTINGS.election.chapaHeaders.finalResultAt,
    SETTINGS.election.chapaHeaders.cancelledAt,
    SETTINGS.election.chapaHeaders.cancelledEmailSent,
    SETTINGS.election.chapaHeaders.emailSent,
    SETTINGS.election.chapaHeaders.boardRegistered,
    SETTINGS.election.chapaHeaders.electedEmailSent,
    SETTINGS.election.chapaHeaders.electedEmailSentAt,
    SETTINGS.election.chapaHeaders.internalNote
  ];

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim());
  const normalizedExistingHeaders = {};

  headers.forEach(function(header) {
    normalizedExistingHeaders[members_normalizeChapaHeaderKey_(header)] = true;
  });

  let appendAt = lastCol;
  required.forEach(col => {
    if (!normalizedExistingHeaders[members_normalizeChapaHeaderKey_(col)]) {
      appendAt++;
      sheet.getRange(1, appendAt).setValue(col);
      normalizedExistingHeaders[members_normalizeChapaHeaderKey_(col)] = true;
    }
  });
}

function members_processPendingChapas() {
  members_assertCore_();
  members_setupChapasSheet_();

  const sheet = GEAPA_CORE.coreGetSheetByKey(SETTINGS.election.chapaKey);
  if (!sheet) {
    throw new Error("Não foi possível localizar a planilha de chapas.");
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return;

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim());
  const idx = members_getChapaHeaderIndexMap_(headers);
  const ctx = members_buildChapaContext_();

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  for (let i = 0; i < values.length; i++) {
    const absoluteRow = i + 2;
    const row = values[i];

    const analyzedAt = idx.analyzedAt >= 0 ? row[idx.analyzedAt] : "";
    if (analyzedAt) continue;

    members_analyzeChapaRow_(sheet, absoluteRow, headers, ctx);
  }
}

function members_reprocessAllChapas() {
  members_assertCore_();
  members_setupChapasSheet_();

  const sheet = GEAPA_CORE.coreGetSheetByKey(SETTINGS.election.chapaKey);
  if (!sheet) {
    throw new Error("Não foi possível localizar a planilha de chapas.");
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return;

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim());
  const idx = members_getChapaHeaderIndexMap_(headers);
  const ctx = members_buildChapaContext_();

  for (let absoluteRow = 2; absoluteRow <= lastRow; absoluteRow++) {
    const clearHeaders = [
      SETTINGS.election.chapaHeaders.presidentStatus,
      SETTINGS.election.chapaHeaders.presidentReasons,
      SETTINGS.election.chapaHeaders.viceStatus,
      SETTINGS.election.chapaHeaders.viceReasons,
      SETTINGS.election.chapaHeaders.chapaStatus,
      SETTINGS.election.chapaHeaders.chapaReasons,
      SETTINGS.election.chapaHeaders.automaticOpinion,
      SETTINGS.election.chapaHeaders.analyzedAt
    ];

    clearHeaders.forEach(h => {
      const col = idx[h];
      if (col != null && col >= 0) {
        sheet.getRange(absoluteRow, col + 1).clearContent();
      }
    });

    members_analyzeChapaRow_(sheet, absoluteRow, headers, ctx);
  }
}

function members_processCancelledChapas() {
  members_assertCore_();
  members_setupChapasSheet_();

  const chapaSheet = GEAPA_CORE.coreGetSheetByKey(SETTINGS.election.chapaKey);
  if (!chapaSheet) {
    throw new Error("Não foi possível localizar a planilha de chapas.");
  }

  const lastRow = chapaSheet.getLastRow();
  const lastCol = chapaSheet.getLastColumn();
  if (lastRow < 2) return;

  const headers = chapaSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim());
  const idx = members_getChapaHeaderIndexMap_(headers);
  const values = chapaSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  for (let i = 0; i < values.length; i++) {
    const absoluteRow = i + 2;
    const row = values[i];
    const finalResult = idx.finalResult >= 0 ? String(row[idx.finalResult] || "").trim() : "";
    if (normalizeMembersText_(finalResult) !== normalizeMembersText_(SETTINGS.election.statusCancelada)) continue;

    const cancelledAt = idx.cancelledAt >= 0 ? row[idx.cancelledAt] : "";
    if (!cancelledAt) {
      members_writeChapaCellByHeader_(chapaSheet, absoluteRow, idx, SETTINGS.election.chapaHeaders.cancelledAt, new Date());
    }

    const finalResultAt = idx.finalResultAt >= 0 ? row[idx.finalResultAt] : "";
    if (!finalResultAt) {
      members_writeChapaCellByHeader_(chapaSheet, absoluteRow, idx, SETTINGS.election.chapaHeaders.finalResultAt, new Date());
    }

    members_sendCancelledChapaEmail_(chapaSheet, absoluteRow, idx);
  }
}

function members_processElectedChapas() {
  members_assertCore_();
  members_setupChapasSheet_();

  const chapaSheet = GEAPA_CORE.coreGetSheetByKey(SETTINGS.election.chapaKey);
  const diretoriaSheet = GEAPA_CORE.coreGetSheetByKey(SETTINGS.vigenciaKeys.membrosDiretoria);
  const boardsSheet = GEAPA_CORE.coreGetSheetByKey(SETTINGS.vigenciaKeys.diretorias);

  if (!chapaSheet || !diretoriaSheet || !boardsSheet) {
    throw new Error("Não foi possível localizar planilhas de chapas ou vigências.");
  }

  const lastRow = chapaSheet.getLastRow();
  const lastCol = chapaSheet.getLastColumn();
  if (lastRow < 2) return;

  const headers = chapaSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim());
  const idx = members_getChapaHeaderIndexMap_(headers);
  const ctx = members_buildChapaContext_();

  const values = chapaSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  for (let i = 0; i < values.length; i++) {
    const absoluteRow = i + 2;
    const row = values[i];

    const finalResult = idx.finalResult >= 0 ? String(row[idx.finalResult] || "").trim() : "";
    const alreadyRegistered = idx.boardRegistered >= 0 ? String(row[idx.boardRegistered] || "").trim() : "";
    const chapaStatus = idx.chapaStatus >= 0 ? String(row[idx.chapaStatus] || "").trim() : "";

    if (normalizeMembersText_(finalResult) !== normalizeMembersText_(SETTINGS.election.statusEleita)) continue;
    if (normalizeMembersText_(alreadyRegistered) === normalizeMembersText_(SETTINGS.election.registeredYes)) continue;

    if (normalizeMembersText_(chapaStatus) !== normalizeMembersText_(SETTINGS.election.statusDeferida)) {
      if (idx.internalNote >= 0) {
        chapaSheet.getRange(absoluteRow, idx.internalNote + 1).setValue(
          "Resultado final marcado como ELEITA, mas a chapa não está com status DEFERIDA. Conferir manualmente."
        );
      }
      continue;
    }

    members_markOtherDeferredChapasAsNotElected_(chapaSheet, values, absoluteRow, idx);
    members_registerElectedChapa_(chapaSheet, absoluteRow, headers, ctx);
  }
}

function members_analyzeChapaRow_(sheet, rowIndex, headers, ctx) {
  const idx = members_getChapaHeaderIndexMap_(headers);
  const row = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];

  const submitterEmail = idx.submitterEmail >= 0 ? String(row[idx.submitterEmail] || "").trim() : "";

  const presidentName = idx.presidentName >= 0 ? String(row[idx.presidentName] || "").trim() : "";
  const presidentRga = idx.presidentRga >= 0 ? String(row[idx.presidentRga] || "").trim() : "";

  const viceName = idx.viceName >= 0 ? String(row[idx.viceName] || "").trim() : "";
  const viceRga = idx.viceRga >= 0 ? String(row[idx.viceRga] || "").trim() : "";

  const presidentResult = members_evaluateChapaCandidate_("PRESIDENTE", presidentName, presidentRga, ctx);
  const viceResult = members_evaluateChapaCandidate_("VICE", viceName, viceRga, ctx);

  let chapaStatus = SETTINGS.election.statusDeferida;
  const chapaReasons = [];

  if (presidentRga && viceRga && members_normalizeDigits_(presidentRga) === members_normalizeDigits_(viceRga)) {
    chapaStatus = SETTINGS.election.statusIndeferida;
    chapaReasons.push("A mesma pessoa não pode compor simultaneamente os cargos de Presidente e Vice-Presidente.");
  }

  if (
    presidentResult.status !== SETTINGS.election.statusDeferida ||
    viceResult.status !== SETTINGS.election.statusDeferida
  ) {
    chapaStatus = SETTINGS.election.statusIndeferida;
  }

  if (presidentResult.reasons.length) {
    chapaReasons.push("Presidente: " + presidentResult.reasons.join(" "));
  }

  if (viceResult.reasons.length) {
    chapaReasons.push("Vice: " + viceResult.reasons.join(" "));
  }

  const automaticOpinion = members_buildChapaOpinion_(chapaStatus, chapaReasons);

  members_writeChapaCellByHeader_(sheet, rowIndex, idx, SETTINGS.election.chapaHeaders.presidentStatus, presidentResult.status);
  members_writeChapaCellByHeader_(sheet, rowIndex, idx, SETTINGS.election.chapaHeaders.presidentReasons, presidentResult.reasons.join(" "));
  members_writeChapaCellByHeader_(sheet, rowIndex, idx, SETTINGS.election.chapaHeaders.viceStatus, viceResult.status);
  members_writeChapaCellByHeader_(sheet, rowIndex, idx, SETTINGS.election.chapaHeaders.viceReasons, viceResult.reasons.join(" "));
  members_writeChapaCellByHeader_(sheet, rowIndex, idx, SETTINGS.election.chapaHeaders.chapaStatus, chapaStatus);
  members_writeChapaCellByHeader_(sheet, rowIndex, idx, SETTINGS.election.chapaHeaders.chapaReasons, chapaReasons.join(" "));
  members_writeChapaCellByHeader_(sheet, rowIndex, idx, SETTINGS.election.chapaHeaders.automaticOpinion, automaticOpinion);
  members_writeChapaCellByHeader_(sheet, rowIndex, idx, SETTINGS.election.chapaHeaders.analyzedAt, new Date());

  const currentFinalResult = idx.finalResult >= 0 ? String(row[idx.finalResult] || "").trim() : "";
  const currentFinalResultNormalized = normalizeMembersText_(currentFinalResult);
  const indeferidaNormalized = normalizeMembersText_(SETTINGS.election.statusIndeferida);

  if (normalizeMembersText_(chapaStatus) === indeferidaNormalized) {
    if (!currentFinalResultNormalized || currentFinalResultNormalized === indeferidaNormalized) {
      members_writeChapaCellByHeader_(sheet, rowIndex, idx, SETTINGS.election.chapaHeaders.finalResult, SETTINGS.election.statusIndeferida);
    }

    const currentFinalResultAt = idx.finalResultAt >= 0 ? row[idx.finalResultAt] : "";
    if (!currentFinalResultAt) {
      members_writeChapaCellByHeader_(sheet, rowIndex, idx, SETTINGS.election.chapaHeaders.finalResultAt, new Date());
    }
  }

  const emailSent = idx.emailSent >= 0 ? String(row[idx.emailSent] || "").trim() : "";
  if (normalizeMembersText_(emailSent) !== normalizeMembersText_(SETTINGS.election.emailSentYes)) {
    const recipients = members_buildChapaRecipients_(
      submitterEmail,
      presidentResult.member ? members_getCurrentField_(presidentResult.member, "email") : "",
      viceResult.member ? members_getCurrentField_(viceResult.member, "email") : ""
    );

    if (recipients.length) {
      const approved = normalizeMembersText_(chapaStatus) === normalizeMembersText_(SETTINGS.election.statusDeferida);

      const emailPresidentName =
        (presidentResult.member && members_getCurrentField_(presidentResult.member, "name"))
          ? String(members_getCurrentField_(presidentResult.member, "name")).trim()
          : presidentName;

      const emailViceName =
        (viceResult.member && members_getCurrentField_(viceResult.member, "name"))
          ? String(members_getCurrentField_(viceResult.member, "name")).trim()
          : viceName;

      members_queueEntryFlowOutgoing_(
        members_buildChapaOutgoingContract_({
          rowIndex: rowIndex,
          refDate: new Date(),
          identifier: members_buildChapaCorrelationIdentifier_(rowIndex, presidentRga, viceRga),
          presidentName: emailPresidentName,
          viceName: emailViceName,
          presidentRga: presidentRga,
          viceRga: viceRga,
          approved: approved,
          reasons: chapaReasons,
          recipients: recipients
        })
      );

      members_writeChapaCellByHeader_(
        sheet,
        rowIndex,
        idx,
        SETTINGS.election.chapaHeaders.emailSent,
        SETTINGS.election.emailSentYes
      );
    }
  }
}

function members_evaluateChapaCandidate_(targetRole, informedName, informedRga, ctx) {
  const out = {
    status: SETTINGS.election.statusDeferida,
    reasons: [],
    member: null
  };

  const normalizedRga = members_normalizeDigits_(informedRga);
  if (!normalizedRga) {
    out.status = SETTINGS.election.statusIndeferida;
    out.reasons.push("RGA não informado.");
    return out;
  }

  const member = ctx.membersByRga[normalizedRga];
  if (!member) {
    out.status = SETTINGS.election.statusIndeferida;
    out.reasons.push("RGA não localizado em MEMBERS_ATUAIS.");
    return out;
  }

  out.member = member;

  const memberStatus = normalizeMembersText_(members_getCurrentField_(member, "status"));
  if (memberStatus !== normalizeMembersText_(SETTINGS.values.active)) {
    out.status = SETTINGS.election.statusIndeferida;
    out.reasons.push("O candidato não está com status ativo em MEMBERS_ATUAIS.");
  }

  const semestresNoGrupo = members_getChapaCandidateSemesterCount_(member, new Date());
  if (semestresNoGrupo == null || semestresNoGrupo < 1) {
    out.status = SETTINGS.election.statusIndeferida;
    out.reasons.push("O candidato não possui pelo menos 1 semestre no grupo.");
  }

  const semestreAtual = members_parseSemesterNumber_(members_getCurrentField_(member, "currentSemester"));
  if (semestreAtual == null || semestreAtual < 1 || semestreAtual > 7) {
    out.status = SETTINGS.election.statusIndeferida;
    out.reasons.push("O candidato não está entre o 1º e o 7º semestre.");
  }

  const history = ctx.diretoriaByRga[normalizedRga] || [];

  // Regra do regimento:
  // Presidente não pode voltar a Presidente;
  // Vice não pode voltar a Vice.
  if (targetRole === "PRESIDENTE" && members_candidateHasBeenSpecificRole_(history, "PRESIDENTE")) {
    out.status = SETTINGS.election.statusIndeferida;
    out.reasons.push("O candidato já exerceu o cargo de Presidente em mandato anterior.");
  }

  if (targetRole === "VICE" && members_candidateHasBeenSpecificRole_(history, "VICE")) {
    out.status = SETTINGS.election.statusIndeferida;
    out.reasons.push("O candidato já exerceu o cargo de Vice-Presidente em mandato anterior.");
  }

  // Limite total de tempo em diretoria:
  // soma o tempo já exercido + o novo mandato.
  const previousDiretoriaDays = members_getAccumulatedDiretoriaDays_(history, ctx.nextBoard ? ctx.nextBoard.start : new Date());
  const newMandateDays = ctx.newMandateDays || 0;
  const totalIfElected = previousDiretoriaDays + newMandateDays;

  if (totalIfElected > SETTINGS.election.maxDiretoriaTotalDays) {
    out.status = SETTINGS.election.statusIndeferida;
    out.reasons.push(
      "O candidato ultrapassaria o limite máximo de permanência em cargos de diretoria ao assumir o novo mandato."
    );
  }

  if (informedName && members_getCurrentField_(member, "name")) {
    const sameName = members_namesAreCompatible_(informedName, members_getCurrentField_(member, "name"));
    if (!sameName) {
      out.reasons.push("Nome informado diverge parcialmente do nome cadastrado; conferir manualmente.");
    }
  }

  return out;
}

function members_markOtherDeferredChapasAsNotElected_(sheet, values, electedRowIndex, idx) {
  const deferidaNormalized = normalizeMembersText_(SETTINGS.election.statusDeferida);
  const eleitaNormalized = normalizeMembersText_(SETTINGS.election.statusEleita);
  const naoEleitaNormalized = normalizeMembersText_(SETTINGS.election.statusNaoEleita);
  const timestamp = new Date();

  (values || []).forEach(function(row, i) {
    const absoluteRow = i + 2;
    if (absoluteRow === electedRowIndex) return;

    const chapaStatus = idx.chapaStatus >= 0 ? String(row[idx.chapaStatus] || "").trim() : "";
    if (normalizeMembersText_(chapaStatus) !== deferidaNormalized) return;

    const finalResult = idx.finalResult >= 0 ? String(row[idx.finalResult] || "").trim() : "";
    const finalResultNormalized = normalizeMembersText_(finalResult);
    if (finalResultNormalized === eleitaNormalized) return;

    if (!finalResultNormalized || finalResultNormalized === naoEleitaNormalized) {
      members_writeChapaCellByHeader_(sheet, absoluteRow, idx, SETTINGS.election.chapaHeaders.finalResult, SETTINGS.election.statusNaoEleita);
    }

    const finalResultAt = idx.finalResultAt >= 0 ? row[idx.finalResultAt] : "";
    if (!finalResultAt) {
      members_writeChapaCellByHeader_(sheet, absoluteRow, idx, SETTINGS.election.chapaHeaders.finalResultAt, timestamp);
    }
  });
}

function members_registerElectedChapa_(chapaSheet, rowIndex, headers, ctx) {
  const idx = members_getChapaHeaderIndexMap_(headers);
  const row = chapaSheet.getRange(rowIndex, 1, 1, chapaSheet.getLastColumn()).getValues()[0];

  const presidentRga = members_normalizeDigits_(idx.presidentRga >= 0 ? row[idx.presidentRga] : "");
  const viceRga = members_normalizeDigits_(idx.viceRga >= 0 ? row[idx.viceRga] : "");

  const president = ctx.membersByRga[presidentRga];
  const vice = ctx.membersByRga[viceRga];

  if (!president || !vice) {
    members_writeChapaCellByHeader_(
      chapaSheet,
      rowIndex,
      idx,
      SETTINGS.election.chapaHeaders.internalNote,
      "Não foi possível registrar diretoria: Presidente ou Vice não localizado em MEMBERS_ATUAIS."
    );
    return;
  }

  const diretoriaSheet = GEAPA_CORE.coreGetSheetByKey(SETTINGS.vigenciaKeys.membrosDiretoria);
  const boardsSheet = GEAPA_CORE.coreGetSheetByKey(SETTINGS.vigenciaKeys.diretorias);

  const targetBoard = ctx.nextBoard || members_getNextBoardWindow_(boardsSheet);
  if (!targetBoard) {
    throw new Error("Não foi possível identificar a próxima diretoria em VIGENCIA_DIRETORIAS.");
  }

  const dirLastCol = diretoriaSheet.getLastColumn();
  const dirHeaders = diretoriaSheet.getRange(1, 1, 1, dirLastCol).getValues()[0].map(h => String(h || "").trim());

  const existing = members_findExistingBoardRoles_(diretoriaSheet, targetBoard.id);
  if (existing.hasPresident || existing.hasVice) {
    members_writeChapaCellByHeader_(
      chapaSheet,
      rowIndex,
      idx,
      SETTINGS.election.chapaHeaders.internalNote,
      "Já existem cargos de Presidente e/ou Vice registrados para a diretoria " + targetBoard.id + ". Nada foi inserido."
    );
    return;
  }

  const rowsToAppend = [
    members_buildBoardMemberRow_(dirHeaders, president, "Presidente", targetBoard),
    members_buildBoardMemberRow_(dirHeaders, vice, "Vice Presidente", targetBoard)
  ];

  diretoriaSheet.getRange(diretoriaSheet.getLastRow() + 1, 1, rowsToAppend.length, dirHeaders.length).setValues(rowsToAppend);

  members_writeChapaCellByHeader_(chapaSheet, rowIndex, idx, SETTINGS.election.chapaHeaders.boardRegistered, SETTINGS.election.registeredYes);

  const finalResultAt = idx.finalResultAt >= 0 ? row[idx.finalResultAt] : "";
  if (!finalResultAt) {
    members_writeChapaCellByHeader_(chapaSheet, rowIndex, idx, SETTINGS.election.chapaHeaders.finalResultAt, new Date());
  }

  members_sendElectedChapaEmail_(chapaSheet, rowIndex, idx, president, vice);
}

function members_buildChapaContext_() {
  const currentSheet = GEAPA_CORE.coreGetSheetByKey(SETTINGS.currentKey);
  const diretoriaSheet = GEAPA_CORE.coreGetSheetByKey(SETTINGS.vigenciaKeys.membrosDiretoria);
  const boardsSheet = GEAPA_CORE.coreGetSheetByKey(SETTINGS.vigenciaKeys.diretorias);

  if (!currentSheet || !diretoriaSheet || !boardsSheet) {
    throw new Error("Não foi possível localizar MEMBERS_ATUAIS, VIGENCIA_MEMBROS_DIRETORIAS ou VIGENCIA_DIRETORIAS.");
  }

  const membersByRga = {};
  const diretoriaByRga = {};

  members_readSheetRecordsCompat_(currentSheet).forEach(obj => {
    const rga = members_normalizeDigits_(obj["RGA"]);
    if (!rga) return;
    membersByRga[rga] = obj;
  });

  members_readSheetRecordsCompat_(diretoriaSheet).forEach(obj => {
    const rga = members_normalizeDigits_(obj["RGA"]);
    if (!rga) return;

    if (!diretoriaByRga[rga]) {
      diretoriaByRga[rga] = [];
    }
    diretoriaByRga[rga].push(obj);
  });

  const nextBoard = members_getNextBoardWindow_(boardsSheet);
  const newMandateDays = nextBoard ? members_getInclusiveDaysBetween_(nextBoard.start, nextBoard.end) : 0;

  return {
    membersByRga,
    diretoriaByRga,
    nextBoard,
    newMandateDays
  };
}

function members_getChapaHeaderIndexMap_(headers) {
  const out = {};
  const normalizedMap = {};

  (headers || []).forEach(function(header, index) {
    const normalized = members_normalizeChapaHeaderKey_(header);
    if (!normalized || Object.prototype.hasOwnProperty.call(normalizedMap, normalized)) return;
    normalizedMap[normalized] = index;
  });

  Object.keys(SETTINGS.election.chapaHeaders).forEach(k => {
    const headerName = SETTINGS.election.chapaHeaders[k];
    const normalizedHeader = members_normalizeChapaHeaderKey_(headerName);
    out[k] = normalizedMap[normalizedHeader] != null ? normalizedMap[normalizedHeader] : -1;
    out[headerName] = out[k];
    out[normalizeMembersText_(headerName)] = out[k];
    out[normalizedHeader] = out[k];
  });

  return out;
}

function members_getGenericHeaderMap_(headers) {
  return members_buildHeaderMapCompat_(headers, { normalize: true, oneBased: false });
}

function members_normalizeChapaHeaderKey_(value) {
  return members_normalizeTextCompat_(value, {
    removeAccents: true,
    collapseWhitespace: true,
    caseMode: "lower"
  });
}

function members_writeChapaCellByHeader_(sheet, rowIndex, idx, headerName, value) {
  const normalizedHeader = normalizeMembersText_(headerName);
  const directIndex = idx && Object.prototype.hasOwnProperty.call(idx, headerName) ? idx[headerName] : -1;
  const normalizedIndex = idx && Object.prototype.hasOwnProperty.call(idx, normalizedHeader) ? idx[normalizedHeader] : -1;
  const colIndex = directIndex >= 0 ? directIndex : normalizedIndex;

  if (colIndex >= 0) {
    sheet.getRange(rowIndex, colIndex + 1).setValue(value);
    return true;
  }

  return members_writeCellByHeaderCompat_(sheet, rowIndex, idx, headerName, value, { oneBased: false });
}

function members_parseSemesterNumber_(value) {
  const txt = String(value || "").trim();
  const m = txt.match(/(\d+)/);
  if (!m) return null;
  return parseInt(m[1], 10);
}

function members_getChapaCandidateSemesterCount_(member, referenceDate) {
  const explicitSemesterCount = members_parseSemesterNumber_(members_getCurrentField_(member, "semesterCount"));
  if (explicitSemesterCount != null) {
    return explicitSemesterCount;
  }

  const integratedAt = members_chapasToDate_(members_getCurrentField_(member, "integratedAt"));
  if (!integratedAt) {
    return null;
  }

  return members_getCompletedSemestersSince_(integratedAt, referenceDate || new Date());
}

function members_getCompletedSemestersSince_(startValue, endValue) {
  const start = members_chapasToDate_(startValue);
  const end = members_chapasToDate_(endValue);
  if (!start || !end) return null;
  if (end < start) return 0;

  let totalMonths =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());

  if (end.getDate() < start.getDate()) {
    totalMonths -= 1;
  }

  if (totalMonths < 0) totalMonths = 0;

  return Math.floor(totalMonths / 6);
}

function members_normalizeDigits_(value) {
  return String(value || "").replace(/\D/g, "");
}

function members_candidateHasBeenSpecificRole_(historyRows, targetRole) {
  return (historyRows || []).some(r => members_classifyBoardRole_(r["Cargo/Função"]) === targetRole);
}

function members_classifyBoardRole_(cargo) {
  const t = members_removeAccents_(String(cargo || "").trim().toLowerCase());

  if (t.indexOf("vice") >= 0 && t.indexOf("president") >= 0) return "VICE";
  if (t.indexOf("president") >= 0) return "PRESIDENTE";
  return "OUTRO";
}

function members_getAccumulatedDiretoriaDays_(historyRows, referenceDate) {
  if (!historyRows || !historyRows.length) return 0;

  let total = 0;

  historyRows.forEach(r => {
    const start = members_chapasToDate_(r["Data_Início"]);
    const end =
      members_chapasToDate_(r["Data_Fim"]) ||
      members_chapasToDate_(r["Data_Fim_previsto"]) ||
      members_chapasToDate_(referenceDate);

    if (!start || !end) return;
    if (end < start) return;

    total += members_getInclusiveDaysBetween_(start, end);
  });

  return total;
}

function members_getInclusiveDaysBetween_(start, end) {
  const startDay = members_startOfDay_(start);
  const endDay = members_startOfDay_(end);
  const diffMs = endDay.getTime() - startDay.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

function members_chapasToDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return value;
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function members_removeAccents_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function members_buildChapaOpinion_(status, reasons) {
  if (normalizeMembersText_(status) === normalizeMembersText_(SETTINGS.election.statusDeferida)) {
    return "Após análise automática dos critérios objetivos, a chapa foi classificada como DEFERIDA.";
  }

  return "Após análise automática dos critérios objetivos, a chapa foi classificada como INDEFERIDA. Motivos: " + reasons.join(" ");
}

function members_buildChapaRecipients_(submitterEmail, presidentEmail, viceEmail) {
  return members_uniqueEmailsCompat_([submitterEmail, presidentEmail, viceEmail]);
}

function members_buildChapaCorrelationIdentifier_(rowIndex, presidentRga, viceRga) {
  const pres = members_normalizeDigits_(presidentRga || "");
  const vice = members_normalizeDigits_(viceRga || "");
  const pair = [pres || "SEM-PRES", vice || "SEM-VICE"].join("-");
  return "CHAPA-" + String(rowIndex || "") + "-" + pair;
}

function members_buildChapaCorrelationKey_(ctx, stage) {
  members_assertInviteRendererCore_();

  return GEAPA_CORE.coreMailBuildCorrelationKey("MEM", {
    businessId: String((ctx.refDate || new Date()).getFullYear()) + "-" + ctx.identifier,
    flowCode: "CHP",
    stage: String(stage || "ANL").trim().toUpperCase()
  });
}

function members_buildChapaOutgoingContract_(ctx) {
  const isApproved = ctx.approved === true;
  const subjectHuman = isApproved
    ? SETTINGS.election.emailApprovedSubject
    : SETTINGS.election.emailRejectedSubject;
  const reasons = Array.isArray(ctx.reasons) ? ctx.reasons.filter(Boolean) : [];
  const formattedReasonItems = reasons.map(function(reason) {
    const text = String(reason || "").trim();
    const match = text.match(/^([^:]+:)\s*(.*)$/);
    if (!match) {
      return { value: text };
    }

    return {
      label: match[1].trim(),
      value: match[2].trim()
    };
  });
  const blocks = isApproved
    ? [{
        title: "Resultado da análise",
        text: "O deferimento foi realizado com base nos critérios objetivos previstos para a inscrição de chapas."
      }]
    : [{
        title: "Motivos identificados",
        items: formattedReasonItems
      }];

  if (!isApproved) {
    blocks.push({
      title: "Próximo passo",
      text: "Os participantes dessa chapa são livres para formarem outras chapas, porém estas serão novamente submetidas à análise automática de critérios."
    });
  }

  return {
    moduleName: "MEMBROS",
    templateKey: "GEAPA_CLASSICO",
    correlationKey: members_buildChapaCorrelationKey_(ctx, isApproved ? "DEF" : "IND"),
    entityType: "CHAPA",
    entityId: ctx.identifier,
    flowCode: "CHP",
    stage: isApproved ? "DEF" : "IND",
    to: ctx.recipients,
    cc: "",
    bcc: "",
    subjectHuman: subjectHuman,
    payload: {
      title: subjectHuman,
      subtitle: "Fluxo eleitoral do GEAPA",
      introText:
        "Olá!\n\n" +
        "A inscrição da chapa composta por " + ctx.presidentName + " (Presidente) e " + ctx.viceName + " (Vice-Presidente) foi " +
        (isApproved ? "DEFERIDA" : "INDEFERIDA") + ".",
      blocks: blocks
    },
    priority: "NORMAL",
    sendAfter: "",
    metadata: {
      rowIndex: ctx.rowIndex,
      presidentRga: ctx.presidentRga,
      viceRga: ctx.viceRga,
      notificationType: isApproved ? "CHAPA_APPROVED" : "CHAPA_REJECTED"
    }
  };
}

function members_buildCancelledChapaOutgoingContract_(ctx) {
  return {
    moduleName: "MEMBROS",
    templateKey: "GEAPA_CLASSICO",
    correlationKey: members_buildChapaCorrelationKey_(ctx, "CAN"),
    entityType: "CHAPA",
    entityId: ctx.identifier,
    flowCode: "CHP",
    stage: "CAN",
    to: ctx.recipients,
    cc: "",
    bcc: "",
    subjectHuman: SETTINGS.election.emailCancelledSubject,
    payload: {
      title: SETTINGS.election.emailCancelledSubject,
      subtitle: "Fluxo eleitoral do GEAPA",
      introText:
        "Olá!\n\n" +
        "A chapa composta por " + ctx.presidentName + " (Presidente) e " + ctx.viceName + " (Vice-Presidente) foi cancelada a pedido dos participantes.",
      blocks: [
        {
          title: "Encerramento da inscrição",
          text: "O cancelamento desta chapa foi registrado no fluxo eleitoral do GEAPA."
        },
        {
          title: "Próximo passo",
          text: "Os participantes permanecem livres para compor outras chapas, que serão novamente submetidas à análise automática de critérios."
        }
      ]
    },
    priority: "NORMAL",
    sendAfter: "",
    metadata: {
      rowIndex: ctx.rowIndex,
      presidentRga: ctx.presidentRga,
      viceRga: ctx.viceRga,
      notificationType: "CHAPA_CANCELLED"
    }
  };
}

function members_buildElectedChapaOutgoingContract_(ctx) {
  return {
    moduleName: "MEMBROS",
    templateKey: "GEAPA_CLASSICO",
    correlationKey: members_buildChapaCorrelationKey_(ctx, "ELE"),
    entityType: "CHAPA",
    entityId: ctx.identifier,
    flowCode: "CHP",
    stage: "ELE",
    to: ctx.recipients,
    cc: "",
    bcc: "",
    subjectHuman: SETTINGS.election.electedEmailSubject,
    payload: {
      title: SETTINGS.election.electedEmailSubject,
      subtitle: "Fluxo eleitoral do GEAPA",
      introText:
        "Olá, " + ctx.presidentName + " e " + ctx.viceName + "!\n\n" +
        "Parabenizamos a chapa de vocês pela aprovação no processo eleitoral do GEAPA.",
      blocks: [
        {
          title: "Transição da diretoria",
          text: "Com a definição da nova gestão, daremos início ao processo de transição da diretoria."
        },
        {
          title: "Próximos passos",
          text: "Solicitamos que a chapa eleita já comece a definir os nomes dos membros que ocuparão os demais cargos da Diretoria, especialmente os cargos de secretaria e comunicação, para que a composição da nova gestão possa ser organizada com antecedência."
        }
      ],
      footerNote: "Em breve, a Diretoria vigente alinhará os próximos passos da transição."
    },
    priority: "NORMAL",
    sendAfter: "",
    metadata: {
      rowIndex: ctx.rowIndex,
      presidentRga: ctx.presidentRga,
      viceRga: ctx.viceRga,
      notificationType: "CHAPA_ELECTED"
    }
  };
}

function buildMembersChapaApprovedEmailHtml_(presidentName, viceName) {
  const pres = escapeMembersHtml_(presidentName || "Presidente");
  const vice = escapeMembersHtml_(viceName || "Vice");

  return `
    <p>Olá!</p>
    <p>A inscrição da chapa composta por <b>${pres}</b> (Presidente) e <b>${vice}</b> (Vice-Presidente) foi <b>DEFERIDA</b>.</p>
    <p>O deferimento foi realizado com base nos critérios objetivos previstos para a inscrição de chapas.</p>
    <p>Atenciosamente,<br>GEAPA</p>
  `;
}

function buildMembersChapaRejectedEmailHtml_(presidentName, viceName, reasons) {
  const pres = escapeMembersHtml_(presidentName || "Candidato à Presidência");
  const vice = escapeMembersHtml_(viceName || "Candidato à Vice-Presidência");
  const reasonsHtml = (reasons || []).map(r => `<li>${escapeMembersHtml_(r)}</li>`).join("");

  return `
    <p>Olá!</p>
    <p>A inscrição da chapa composta por <b>${pres}</b> (Presidente) e <b>${vice}</b> (Vice-Presidente) foi <b>INDEFERIDA</b>.</p>
    <p>Motivos identificados na análise automática:</p>
    <ul>${reasonsHtml}</ul>
    <p>Caso a Diretoria permita retificação ou nova composição, uma nova chapa poderá ser submetida à análise.</p>
    <p>Atenciosamente,<br>GEAPA</p>
  `;
}

function members_getNextBoardWindow_(boardsSheet) {
  if (boardsSheet.getLastRow() < 2) return null;

  const lastCol = boardsSheet.getLastColumn();
  const headers = boardsSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim());
  const idx = members_getGenericHeaderMap_(headers);

  const values = boardsSheet.getRange(2, 1, boardsSheet.getLastRow() - 1, lastCol).getValues();
  const now = new Date();

  const candidates = [];

  values.forEach(row => {
    const id = row[idx[normalizeMembersText_("ID_Diretoria")]];
    const start = row[idx[normalizeMembersText_("Início_Mandato")]];
    const end = row[idx[normalizeMembersText_("Fim_Mandato")]];

    const startDate = members_chapasToDate_(start);
    const endDate = members_chapasToDate_(end);
    if (!id || !startDate || !endDate) return;

    if (startDate.getTime() >= members_startOfDay_(now).getTime()) {
      candidates.push({
        id: String(id).trim(),
        start: startDate,
        end: endDate
      });
    }
  });

  if (!candidates.length) return null;

  candidates.sort((a, b) => a.start.getTime() - b.start.getTime());
  return candidates[0];
}

function members_findExistingBoardRoles_(diretoriaSheet, boardId) {
  const out = { hasPresident: false, hasVice: false };

  if (diretoriaSheet.getLastRow() < 2) return out;

  const lastCol = diretoriaSheet.getLastColumn();
  const headers = diretoriaSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim());
  const idx = members_getGenericHeaderMap_(headers);
  const values = diretoriaSheet.getRange(2, 1, diretoriaSheet.getLastRow() - 1, lastCol).getValues();

  values.forEach(row => {
    const rowBoardId = String(row[idx[normalizeMembersText_("ID_Diretoria")]] || "").trim();
    if (rowBoardId !== String(boardId || "").trim()) return;

    const role = members_classifyBoardRole_(row[idx[normalizeMembersText_("Cargo/Função")]]);
    if (role === "PRESIDENTE") out.hasPresident = true;
    if (role === "VICE") out.hasVice = true;
  });

  return out;
}

function members_buildBoardMemberRow_(headers, member, roleName, boardWindow) {
  const arr = new Array(headers.length).fill("");
  const idx = members_getGenericHeaderMap_(headers);

  members_setRowValueIfHeaderExists_(arr, idx, "Nome", members_getCurrentField_(member, "name") || "");
  members_setRowValueIfHeaderExists_(arr, idx, "RGA", member["RGA"] || "");
  members_setRowValueIfHeaderExists_(arr, idx, "E-mail", members_getCurrentField_(member, "email") || "");
  members_setRowValueIfHeaderExists_(arr, idx, "Cargo/Função", roleName);
  members_setRowValueIfHeaderExists_(arr, idx, "ID_Diretoria", boardWindow.id);
  members_setRowValueIfHeaderExists_(arr, idx, "Data_Início", boardWindow.start);
  members_setRowValueIfHeaderExists_(arr, idx, "Data_Fim", "");
  members_setRowValueIfHeaderExists_(arr, idx, "Data_Fim_previsto", boardWindow.end);

  return arr;
}

function members_setRowValueIfHeaderExists_(rowArr, idx, headerName, value) {
  const pos = idx[normalizeMembersText_(headerName)];
  if (pos != null && pos >= 0) {
    rowArr[pos] = value;
  }
}

function members_startOfDay_(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function members_namesAreCompatible_(nameA, nameB) {
  const a = members_normalizeName_(nameA);
  const b = members_normalizeName_(nameB);

  if (!a || !b) return true;
  if (a === b) return true;
  if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return true;

  const aParts = a.split(" ").filter(Boolean);
  const bParts = b.split(" ").filter(Boolean);

  if (!aParts.length || !bParts.length) return true;

  let common = 0;
  aParts.forEach(part => {
    if (bParts.indexOf(part) >= 0) common++;
  });

  // aceita se pelo menos 2 partes coincidirem
  return common >= 2;
}

function members_normalizeName_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function members_sendCancelledChapaEmail_(chapaSheet, rowIndex, idx) {
  const row = chapaSheet.getRange(rowIndex, 1, 1, chapaSheet.getLastColumn()).getValues()[0];

  const alreadySent = idx.cancelledEmailSent >= 0 ? String(row[idx.cancelledEmailSent] || "").trim() : "";
  if (normalizeMembersText_(alreadySent) === normalizeMembersText_(SETTINGS.election.emailSentYes)) {
    return;
  }

  const submitterEmail = idx.submitterEmail >= 0 ? String(row[idx.submitterEmail] || "").trim() : "";
  const presidentName = idx.presidentName >= 0 ? String(row[idx.presidentName] || "").trim() : "Presidente";
  const viceName = idx.viceName >= 0 ? String(row[idx.viceName] || "").trim() : "Vice-Presidente";
  const presidentRga = idx.presidentRga >= 0 ? String(row[idx.presidentRga] || "").trim() : "";
  const viceRga = idx.viceRga >= 0 ? String(row[idx.viceRga] || "").trim() : "";

  const ctx = members_buildChapaContext_();
  const president = presidentRga ? ctx.membersByRga[members_normalizeDigits_(presidentRga)] : null;
  const vice = viceRga ? ctx.membersByRga[members_normalizeDigits_(viceRga)] : null;
  const recipients = members_buildChapaRecipients_(
    submitterEmail,
    president ? members_getCurrentField_(president, "email") : "",
    vice ? members_getCurrentField_(vice, "email") : ""
  );

  if (!recipients.length) return;

  members_queueEntryFlowOutgoing_(
    members_buildCancelledChapaOutgoingContract_({
      rowIndex: rowIndex,
      refDate: new Date(),
      identifier: members_buildChapaCorrelationIdentifier_(rowIndex, presidentRga, viceRga),
      presidentName: president && members_getCurrentField_(president, "name") ? String(members_getCurrentField_(president, "name")).trim() : presidentName,
      viceName: vice && members_getCurrentField_(vice, "name") ? String(members_getCurrentField_(vice, "name")).trim() : viceName,
      presidentRga: presidentRga,
      viceRga: viceRga,
      recipients: recipients
    })
  );

  members_writeChapaCellByHeader_(chapaSheet, rowIndex, idx, SETTINGS.election.chapaHeaders.cancelledEmailSent, SETTINGS.election.emailSentYes);
}

function members_sendElectedChapaEmail_(chapaSheet, rowIndex, idx, president, vice) {
  const row = chapaSheet.getRange(rowIndex, 1, 1, chapaSheet.getLastColumn()).getValues()[0];

  const alreadySent = idx.electedEmailSent >= 0 ? String(row[idx.electedEmailSent] || "").trim() : "";
  if (normalizeMembersText_(alreadySent) === normalizeMembersText_(SETTINGS.election.emailSentYes)) {
    return;
  }

  const submitterEmail = idx.submitterEmail >= 0 ? String(row[idx.submitterEmail] || "").trim() : "";

  const recipients = members_buildChapaRecipients_(
    submitterEmail,
    president ? members_getCurrentField_(president, "email") : "",
    vice ? members_getCurrentField_(vice, "email") : ""
  );

  if (!recipients.length) return;

  const presidentName = president && members_getCurrentField_(president, "name") ? String(members_getCurrentField_(president, "name")).trim() : "Presidente";
  const viceName = vice && members_getCurrentField_(vice, "name") ? String(members_getCurrentField_(vice, "name")).trim() : "Vice-Presidente";

  members_queueEntryFlowOutgoing_(
    members_buildElectedChapaOutgoingContract_({
      rowIndex: rowIndex,
      refDate: new Date(),
      identifier: members_buildChapaCorrelationIdentifier_(rowIndex, president ? members_getCurrentField_(president, "rga") : "", vice ? members_getCurrentField_(vice, "rga") : ""),
      presidentName: presidentName,
      viceName: viceName,
      presidentRga: president ? members_getCurrentField_(president, "rga") : "",
      viceRga: vice ? members_getCurrentField_(vice, "rga") : "",
      recipients: recipients
    })
  );

  members_writeChapaCellByHeader_(
    chapaSheet,
    rowIndex,
    idx,
    SETTINGS.election.chapaHeaders.electedEmailSent,
    SETTINGS.election.emailSentYes
  );

  members_writeChapaCellByHeader_(
    chapaSheet,
    rowIndex,
    idx,
    SETTINGS.election.chapaHeaders.electedEmailSentAt,
    new Date()
  );
}

function buildMembersElectedChapaEmailHtml_(presidentName, viceName) {
  const pres = escapeMembersHtml_(presidentName || "Presidente");
  const vice = escapeMembersHtml_(viceName || "Vice-Presidente");

  return `
    <p>Olá, <b>${pres}</b> e <b>${vice}</b>!</p>

    <p>Parabenizamos a chapa de vocês pela aprovação no processo eleitoral do GEAPA.</p>

    <p>Com a definição da nova gestão, daremos início ao processo de transição da diretoria.</p>

    <p>Solicitamos que a chapa eleita já comece a definir os nomes dos membros que ocuparão os demais cargos da Diretoria, especialmente os cargos de secretaria e comunicação, para que a composição da nova gestão possa ser organizada com antecedência.</p>

    <p>Em breve, a Diretoria vigente alinhará os próximos passos da transição.</p>

    <p>Atenciosamente,<br>GEAPA</p>
  `;
}
