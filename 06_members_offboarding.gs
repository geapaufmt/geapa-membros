/***************************************
 * 06_members_offboarding.gs
 ***************************************/

function members_offboardApprovedImmediateExit(payload) {
  members_assertCore_();
  members_validateOffboardPayload_(payload);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const currentSheet = GEAPA_CORE.coreGetSheetByKey(SETTINGS.currentKey);
    const histSheet = GEAPA_CORE.coreGetSheetByKey(SETTINGS.histKey);

    if (!currentSheet || !histSheet) {
      throw new Error("Nao foi possivel localizar MEMBERS_ATUAIS ou MEMBERS_HIST.");
    }

    const match = members_findCurrentMemberMatch_(currentSheet, payload);
    if (!match.found) {
      throw new Error(
        'Membro nao encontrado em MEMBERS_ATUAIS. ' +
        'RGA="' + String(payload.memberRga || "") + '", ' +
        'EMAIL="' + String(payload.memberEmail || "") + '", ' +
        'NOME="' + String(payload.memberName || "") + '".'
      );
    }

    const duplicate = members_historyFindEquivalentRow_(histSheet, payload);

    if (!duplicate.found) {
      const histHeaders = histSheet
        .getRange(1, 1, 1, histSheet.getLastColumn())
        .getValues()[0]
        .map(h => String(h || "").trim());

      const histRow = members_buildHistoryRowFromCurrentAndOffboard_(
        match.rowValues,
        match.headers,
        histHeaders,
        payload,
        match.matchBy
      );

      histSheet.appendRow(histRow);
    }

    currentSheet.deleteRow(match.rowNumber);
    GEAPA_CORE.coreSyncMembersCurrentDerivedFields();

    return {
      ok: true,
      moved: true,
      duplicatedHistory: duplicate.found,
      matchBy: match.matchBy,
      removedCurrentRowNumber: match.rowNumber
    };
  } finally {
    lock.releaseLock();
  }
}

function members_validateOffboardPayload_(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload de offboarding ausente ou invalido.");
  }

  if (String(payload.requestType || "").trim() !== SETTINGS.offboarding.requestType) {
    throw new Error("requestType invalido.");
  }

  if (String(payload.leaveTiming || "").trim() !== SETTINGS.offboarding.immediate) {
    throw new Error("leaveTiming invalido.");
  }

  if (String(payload.decision || "").trim().toUpperCase() !== SETTINGS.offboarding.approved) {
    throw new Error("decision invalido.");
  }

  if (String(payload.finalEmailSent || "").trim().toUpperCase() !== SETTINGS.offboarding.yes) {
    throw new Error("finalEmailSent invalido.");
  }

  const hasKey =
    String(payload.memberRga || "").trim() ||
    String(payload.memberEmail || "").trim() ||
    String(payload.memberName || "").trim();

  if (!hasKey) {
    throw new Error("Payload sem chave de identificacao do membro.");
  }
}

function members_findCurrentMemberMatch_(sheet, payload) {
  const found = members_findMemberCurrentRowByAnyCompat_({
    rga: payload.memberRga,
    email: payload.memberEmail,
    name: payload.memberName
  });

  if (found && found.found) {
    return found;
  }

  const records = members_readSheetRecordsCompat_(sheet);
  if (!records.length) return { found: false };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(h => String(h || "").trim());
  const map = members_getHeaderMap_(headers);
  const targetRga = members_normalizeKey_(payload.memberRga);
  const targetEmail = members_normalizeKey_(payload.memberEmail);
  const targetName = members_normalizeKey_(payload.memberName);

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const rowValues = headers.map(header => record[header]);

    if (targetRga && members_normalizeKey_(record["RGA"]) === targetRga) {
      return { found: true, rowNumber: record.__rowNumber, rowValues, headers, headerMap: map, matchBy: "RGA" };
    }

    if (targetEmail && members_normalizeKey_(record["EMAIL"]) === targetEmail) {
      return { found: true, rowNumber: record.__rowNumber, rowValues, headers, headerMap: map, matchBy: "EMAIL" };
    }

    if (targetName && members_normalizeKey_(record["MEMBRO"] || record["Nome"]) === targetName) {
      return { found: true, rowNumber: record.__rowNumber, rowValues, headers, headerMap: map, matchBy: "NOME" };
    }
  }

  return { found: false };
}

function members_buildHistoryRowFromCurrentAndOffboard_(currentRow, currentHeaders, histHeaders, payload, matchBy) {
  const currentMap = members_getHeaderMap_(currentHeaders);
  const output = new Array(histHeaders.length).fill("");

  const approvedAt = members_offboardingToDate_(payload.approvedAt);
  const requestAt = members_offboardingToDate_(payload.requestTimestamp);
  const rga = members_pickValue_(currentRow, currentMap, ["rga"]);
  const wasDirector = members_hasDirectorHistoryByRga_(rga) ? "Sim" : "Nao";

  const automaticNote =
    "Migrado automaticamente de MEMBERS_ATUAIS para MEMBERS_HIST apos deferimento " +
    "de desligamento imediato no formulario oficial. Match por " + matchBy + ".";

  histHeaders.forEach((header, idx) => {
    if (members_histHeaderMatches_(header, "Membro")) {
      output[idx] = members_pickValue_(currentRow, currentMap, ["membro"]);
      return;
    }
    if (members_histHeaderMatches_(header, "RGA")) {
      output[idx] = members_pickValue_(currentRow, currentMap, ["rga"]);
      return;
    }
    if (members_histHeaderMatches_(header, "CPF")) {
      output[idx] = members_pickValue_(currentRow, currentMap, ["cpf"]);
      return;
    }
    if (members_histHeaderMatches_(header, "Telefone")) {
      output[idx] = members_pickValue_(currentRow, currentMap, ["telefone"]);
      return;
    }
    if (members_histHeaderMatches_(header, ["EMAIL", "E-mail", "Email"])) {
      output[idx] = members_pickValue_(currentRow, currentMap, ["email"]);
      return;
    }
    if (members_histHeaderMatches_(header, "Data de nascimento")) {
      output[idx] = members_pickValue_(currentRow, currentMap, ["data de nascimento"]);
      return;
    }
    if (members_histHeaderMatches_(header, "Instagram")) {
      output[idx] = members_pickValue_(currentRow, currentMap, ["instagram", "@ instagram"]);
      return;
    }
    if (members_histHeaderMatches_(header, "Naturalidade")) {
      output[idx] = members_pickValue_(currentRow, currentMap, ["naturalidade"]);
      return;
    }
    if (members_histHeaderMatches_(header, "Participa/Participou de algum/alguns laboratório(s), projeto(s), pesquisa(s), empresa júnior, monitoria, etc? se sim, citar qual/quais.")) {
      output[idx] = members_pickValue_(currentRow, currentMap, [
        "participa/participou de algum/alguns laboratório(s), projeto(s), pesquisa(s), empresa júnior, monitoria, etc? se sim, citar qual/quais.",
        "participa/participou de algum/alguns laboratã³rio(s), projeto(s), pesquisa(s), empresa jãºnior, monitoria, etc? se sim, citar qual/quais."
      ]);
      return;
    }
    if (members_histHeaderMatches_(header, ["Data integração", "Data de integração"])) {
      output[idx] = members_pickValue_(currentRow, currentMap, ["data integração", "data integração"]);
      return;
    }
    if (members_histHeaderMatches_(header, "Semestre de entrada")) {
      output[idx] = members_normalizeSemesterText_(
        members_pickValue_(currentRow, currentMap, ["semestre de entrada"])
      );
      return;
    }
    if (members_histHeaderMatches_(header, SETTINGS.histHeaders.finalStatus)) {
      output[idx] = SETTINGS.offboarding.finalStatus;
      return;
    }
    if (members_histHeaderMatches_(header, [SETTINGS.histHeaders.requestAt, "Data de solicitação"])) {
      output[idx] = requestAt || payload.requestTimestamp || "";
      return;
    }
    if (members_histHeaderMatches_(header, [SETTINGS.histHeaders.exitSemester, "Semestre de saída"])) {
      output[idx] = members_getSemesterFromDate_(approvedAt);
      return;
    }
    if (members_histHeaderMatches_(header, [
      SETTINGS.histHeaders.semesterCount,
      "Nº de semestres no grupo",
      "No de semestres no grupo"
    ])) {
      output[idx] = members_pickValue_(currentRow, currentMap, [
        SETTINGS.histHeaders.semesterCount,
        "Nº de semestres no grupo",
        "N° de semestres no grupo",
        "No de semestres no grupo",
        "Numero de semestres no grupo"
      ]);
      return;
    }
    if (members_histHeaderMatches_(header, [SETTINGS.histHeaders.approvedAt, "Data de homologação"])) {
      output[idx] = approvedAt || payload.approvedAt || "";
      return;
    }
    if (members_histHeaderMatches_(header, SETTINGS.histHeaders.reason)) {
      output[idx] = String(payload.reason || "").trim();
      return;
    }
    if (members_histHeaderMatches_(header, SETTINGS.histHeaders.wasDirector)) {
      output[idx] = wasDirector;
      return;
    }
    if (members_histHeaderMatches_(header, SETTINGS.histHeaders.internalNote)) {
      output[idx] = automaticNote;
      return;
    }
    if (members_histHeaderMatches_(header, "Status")) {
      output[idx] = SETTINGS.offboarding.histStatus;
    }
  });

  return output;
}

function members_historyFindEquivalentRow_(histSheet, payload) {
  const records = members_readSheetRecordsCompat_(histSheet);
  const targetRga = members_normalizeKey_(payload.memberRga);
  const targetApprovedAt = members_offboardingToDate_(payload.approvedAt);

  for (let i = 0; i < records.length; i++) {
    const rowRga = members_normalizeKey_(members_getRecordValueByHeaderAliases_(records[i], ["RGA"]));
    const rowApprovedAt = members_offboardingToDate_(
      members_getRecordValueByHeaderAliases_(records[i], [
        SETTINGS.histHeaders.approvedAt,
        "Data de homologacao"
      ])
    );

    const sameRga = targetRga && rowRga && targetRga === rowRga;
    const sameApprovedAt =
      targetApprovedAt && rowApprovedAt &&
      targetApprovedAt.getTime() === rowApprovedAt.getTime();

    if (sameRga && sameApprovedAt) {
      return { found: true, rowNumber: records[i].__rowNumber };
    }
  }

  return { found: false };
}

function members_hasDirectorHistoryByRga_(rga) {
  const normalizedRga = members_normalizeKey_(rga);
  if (!normalizedRga) return false;

  const records = members_readRecordsByKey_(SETTINGS.vigenciaKeys.membrosDiretoria);
  return records.some(record => members_normalizeKey_(record["RGA"]) === normalizedRga);
}

function members_pickValue_(row, map, candidates) {
  for (let i = 0; i < candidates.length; i++) {
    const idx = map[members_normalizeOffboardingHeader_(candidates[i])];
    if (idx != null && idx >= 0) return row[idx];
  }
  return "";
}

function members_normalizeKey_(value) {
  return members_normalizeKeyCompat_(value);
}

function members_normalizeOffboardingHeader_(value) {
  return GEAPA_CORE.coreNormalizeHeader(String(value || "").trim());
}

function members_histHeaderMatches_(header, aliases) {
  const normalizedHeader = members_normalizeOffboardingHeader_(header);
  const list = Array.isArray(aliases) ? aliases : [aliases];

  for (let i = 0; i < list.length; i++) {
    if (normalizedHeader === members_normalizeOffboardingHeader_(list[i])) {
      return true;
    }
  }
  return false;
}

function members_getRecordValueByHeaderAliases_(record, aliases) {
  const keys = Object.keys(record || {});
  const list = Array.isArray(aliases) ? aliases : [aliases];

  for (let i = 0; i < list.length; i++) {
    const target = members_normalizeOffboardingHeader_(list[i]);
    for (let j = 0; j < keys.length; j++) {
      if (members_normalizeOffboardingHeader_(keys[j]) === target) {
        return record[keys[j]];
      }
    }
  }

  return "";
}

function members_offboardingToDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return value;
  }

  const text = String(value || "").trim();
  if (!text) return null;

  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (br) {
    const day = Number(br[1]);
    const month = Number(br[2]) - 1;
    const year = Number(br[3]);
    const hour = Number(br[4] || 0);
    const minute = Number(br[5] || 0);
    const second = Number(br[6] || 0);
    const dtBr = new Date(year, month, day, hour, minute, second);
    return isNaN(dtBr) ? null : dtBr;
  }

  const dt = new Date(text);
  return isNaN(dt) ? null : dt;
}

function members_forcePlainText_(value) {
  const text = String(value == null ? "" : value).trim();
  if (!text) return "";
  return "'" + text;
}

function members_normalizeSemesterText_(value) {
  if (value == null || value === "") return "";

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return members_getSemesterId_(value, { plainText: true });
  }

  const text = String(value).trim();
  const match = text.match(/^(\d{4})\/([12])$/);
  if (match) return members_forcePlainText_(`${match[1]}/${match[2]}`);

  const dt = new Date(value);
  if (!isNaN(dt)) {
    return members_getSemesterId_(dt, { plainText: true });
  }

  return members_forcePlainText_(text);
}

function members_getSemesterFromDate_(value) {
  const dt = members_offboardingToDate_(value);
  if (!dt) return "";
  return members_getSemesterId_(dt, { plainText: true });
}
