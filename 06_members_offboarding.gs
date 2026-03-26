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
      throw new Error("Não foi possível localizar MEMBERS_ATUAIS ou MEMBERS_HIST.");
    }

    const match = members_findCurrentMemberMatch_(currentSheet, payload);
    if (!match.found) {
      throw new Error(
        'Membro não encontrado em MEMBERS_ATUAIS. ' +
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
    throw new Error("Payload de offboarding ausente ou inválido.");
  }

  if (String(payload.requestType || "").trim() !== SETTINGS.offboarding.requestType) {
    throw new Error("requestType inválido.");
  }

  if (String(payload.leaveTiming || "").trim() !== SETTINGS.offboarding.immediate) {
    throw new Error("leaveTiming inválido.");
  }

  if (String(payload.decision || "").trim().toUpperCase() !== SETTINGS.offboarding.approved) {
    throw new Error("decision inválido.");
  }

  if (String(payload.finalEmailSent || "").trim().toUpperCase() !== SETTINGS.offboarding.yes) {
    throw new Error("finalEmailSent inválido.");
  }

  const hasKey =
    String(payload.memberRga || "").trim() ||
    String(payload.memberEmail || "").trim() ||
    String(payload.memberName || "").trim();

  if (!hasKey) {
    throw new Error("Payload sem chave de identificação do membro.");
  }
}

function members_findCurrentMemberMatch_(sheet, payload) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return { found: false };

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim());
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const map = members_getHeaderMap_(headers);

  const rgaIdx = map["rga"];
  const emailIdx = map["email"];
  const nameIdx = map["membro"];

  const targetRga = members_normalizeKey_(payload.memberRga);
  const targetEmail = members_normalizeKey_(payload.memberEmail);
  const targetName = members_normalizeKey_(payload.memberName);

  if (rgaIdx != null && rgaIdx >= 0 && targetRga) {
    for (let i = 0; i < rows.length; i++) {
      if (members_normalizeKey_(rows[i][rgaIdx]) === targetRga) {
        return {
          found: true,
          rowNumber: i + 2,
          rowValues: rows[i],
          headers,
          headerMap: map,
          matchBy: "RGA"
        };
      }
    }
  }

  if (emailIdx != null && emailIdx >= 0 && targetEmail) {
    for (let i = 0; i < rows.length; i++) {
      if (members_normalizeKey_(rows[i][emailIdx]) === targetEmail) {
        return {
          found: true,
          rowNumber: i + 2,
          rowValues: rows[i],
          headers,
          headerMap: map,
          matchBy: "EMAIL"
        };
      }
    }
  }

  if (nameIdx != null && nameIdx >= 0 && targetName) {
    for (let i = 0; i < rows.length; i++) {
      if (members_normalizeKey_(rows[i][nameIdx]) === targetName) {
        return {
          found: true,
          rowNumber: i + 2,
          rowValues: rows[i],
          headers,
          headerMap: map,
          matchBy: "NOME"
        };
      }
    }
  }

  return { found: false };
}

function members_buildHistoryRowFromCurrentAndOffboard_(currentRow, currentHeaders, histHeaders, payload, matchBy) {
  const currentMap = members_getHeaderMap_(currentHeaders);
  const output = new Array(histHeaders.length).fill("");

  const approvedAt = members_toDate_(payload.approvedAt);
  const requestAt = members_toDate_(payload.requestTimestamp);
  const exitSemester = members_getSemesterFromDate_(approvedAt);
  const rga = members_pickValue_(currentRow, currentMap, ["rga"]);
  const wasDirector = members_hasDirectorHistoryByRga_(rga) ? "Sim" : "Não";

  const automaticNote =
    "Migrado automaticamente de MEMBERS_ATUAIS para MEMBERS_HIST após deferimento " +
    "de desligamento imediato no formulário oficial. Match por " + matchBy + ".";

  histHeaders.forEach((header, idx) => {
    const h = String(header || "").trim().toLowerCase();

    switch (h) {
      case "membro":
        output[idx] = members_pickValue_(currentRow, currentMap, ["membro"]);
        return;
      case "rga":
        output[idx] = members_pickValue_(currentRow, currentMap, ["rga"]);
        return;
      case "cpf":
        output[idx] = members_pickValue_(currentRow, currentMap, ["cpf"]);
        return;
      case "telefone":
        output[idx] = members_pickValue_(currentRow, currentMap, ["telefone"]);
        return;
      case "email":
        output[idx] = members_pickValue_(currentRow, currentMap, ["email"]);
        return;
      case "data de nascimento":
        output[idx] = members_pickValue_(currentRow, currentMap, ["data de nascimento"]);
        return;
      case "instagram":
        output[idx] = members_pickValue_(currentRow, currentMap, ["instagram", "@ instagram"]);
        return;
      case "naturalidade":
        output[idx] = members_pickValue_(currentRow, currentMap, ["naturalidade"]);
        return;
      case "participa/participou de algum/alguns laboratório(s), projeto(s), pesquisa(s), empresa júnior, monitoria, etc? se sim, citar qual/quais.":
        output[idx] = members_pickValue_(currentRow, currentMap, [
          "participa/participou de algum/alguns laboratório(s), projeto(s), pesquisa(s), empresa júnior, monitoria, etc? se sim, citar qual/quais."
        ]);
        return;
      case "data integração":
        output[idx] = members_pickValue_(currentRow, currentMap, ["data integração"]);
        return;
      case "semestre de entrada":
        output[idx] = members_normalizeSemesterText_(
          members_pickValue_(currentRow, currentMap, ["semestre de entrada"])
        );
        return;
      case "status final":
        output[idx] = SETTINGS.offboarding.finalStatus;
        return;
      case "data de solicitação":
        output[idx] = requestAt || payload.requestTimestamp || "";
        return;
      case "semestre de saída":
        output[idx] = members_getSemesterFromDate_(approvedAt);
        return;
      case "n° de semestres no grupo":
        output[idx] = members_pickValue_(currentRow, currentMap, ["n° de semestres no grupo"]);
        return;
      case "data de homologação":
        output[idx] = approvedAt || payload.approvedAt || "";
        return;
      case "motivo":
        output[idx] = String(payload.reason || "").trim();
        return;
      case "foi membro da diretoria?":
        output[idx] = wasDirector;
        return;
      case "observação interna":
        output[idx] = automaticNote;
        return;
      case "status":
        output[idx] = SETTINGS.offboarding.histStatus;
        return;
      default:
        return;
    }
  });

  return output;
}

function members_historyFindEquivalentRow_(histSheet, payload) {
  const lastRow = histSheet.getLastRow();
  const lastCol = histSheet.getLastColumn();
  if (lastRow < 2) return { found: false };

  const headers = histSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim());
  const rows = histSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const map = members_getHeaderMap_(headers);

  const rgaIdx = map["rga"];
  const approvedIdx = map["data de homologação"];

  const targetRga = members_normalizeKey_(payload.memberRga);
  const targetApprovedAt = members_toDate_(payload.approvedAt);

  for (let i = 0; i < rows.length; i++) {
    const rowRga = members_normalizeKey_(rows[i][rgaIdx]);
    const rowApprovedAt = members_toDate_(rows[i][approvedIdx]);

    const sameRga = targetRga && rowRga && targetRga === rowRga;
    const sameApprovedAt =
      targetApprovedAt && rowApprovedAt &&
      targetApprovedAt.getTime() === rowApprovedAt.getTime();

    if (sameRga && sameApprovedAt) {
      return { found: true, rowNumber: i + 2 };
    }
  }

  return { found: false };
}

function members_hasDirectorHistoryByRga_(rga) {
  const normalizedRga = members_normalizeKey_(rga);
  if (!normalizedRga) return false;

  const sheet = GEAPA_CORE.coreGetSheetByKey(SETTINGS.vigenciaKeys.membrosDiretoria);
  if (!sheet) throw new Error("Não foi possível localizar VIGENCIA_MEMBROS_DIRETORIAS.");

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return false;

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim());
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const map = members_getHeaderMap_(headers);
  const rgaIdx = map["rga"];

  if (rgaIdx == null || rgaIdx < 0) {
    throw new Error('Cabeçalho "RGA" não encontrado em VIGENCIA_MEMBROS_DIRETORIAS.');
  }

  return rows.some(row => members_normalizeKey_(row[rgaIdx]) === normalizedRga);
}

function members_pickValue_(row, map, candidates) {
  for (let i = 0; i < candidates.length; i++) {
    const idx = map[String(candidates[i] || "").trim().toLowerCase()];
    if (idx != null && idx >= 0) return row[idx];
  }
  return "";
}

function members_normalizeKey_(value) {
  return members_normalizeKeyCompat_(value);
}

function members_toDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return value;
  }
  const dt = new Date(value);
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
    const semesterObj = GEAPA_CORE.coreGetSemesterForDate(value);
    const semesterId = semesterObj && semesterObj.id ? String(semesterObj.id).trim() : "";
    return members_forcePlainText_(semesterId);
  }

  const text = String(value).trim();

  // já está no formato 2025/1
  let m = text.match(/^(\d{4})\/([12])$/);
  if (m) return members_forcePlainText_(`${m[1]}/${m[2]}`);

  // se veio como data convertida
  const dt = new Date(value);
  if (!isNaN(dt)) {
    const semesterObj = GEAPA_CORE.coreGetSemesterForDate(dt);
    const semesterId = semesterObj && semesterObj.id ? String(semesterObj.id).trim() : "";
    return members_forcePlainText_(semesterId);
  }

  return members_forcePlainText_(text);
}

function members_getSemesterFromDate_(value) {
  const dt = members_toDate_(value);
  if (!dt) return "";
  return members_getSemesterId_(dt, { plainText: true });
}
