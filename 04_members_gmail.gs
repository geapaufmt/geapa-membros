/**
 * Adapters de integracao progressiva com GEAPA-CORE.
 *
 * Objetivo:
 * - centralizar pontos compartilhaveis no core sem quebrar versoes atuais;
 * - manter fallback local quando a Library ainda nao expoe o helper.
 */

function members_coreHas_(fnName) {
  return !!(
    typeof GEAPA_CORE !== "undefined" &&
    GEAPA_CORE &&
    typeof GEAPA_CORE[fnName] === "function"
  );
}

function members_ensureCoreCompatibility_() {
  if (typeof GEAPA_CORE === "undefined" || !GEAPA_CORE) return;

  if (typeof GEAPA_CORE.coreNormalizeText !== "function") {
    GEAPA_CORE.coreNormalizeText = function(value, opts) {
      opts = opts || {};
      var text = String(value == null ? "" : value).trim();
      if (!text) return "";
      if (opts.removeAccents === true) {
        text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      }
      if (opts.collapseWhitespace !== false) {
        text = text.replace(/\s+/g, " ");
      }
      if (opts.caseMode === "upper") return text.toUpperCase();
      if (opts.caseMode === "none") return text;
      return text.toLowerCase();
    };
  }

  if (typeof GEAPA_CORE.coreOnlyDigits !== "function") {
    GEAPA_CORE.coreOnlyDigits = function(value) {
      return String(value == null ? "" : value).replace(/\D+/g, "");
    };
  }

  if (typeof GEAPA_CORE.coreNormalizeEmail !== "function") {
    GEAPA_CORE.coreNormalizeEmail = function(value) {
      return String(value || "").trim().toLowerCase();
    };
  }

  if (typeof GEAPA_CORE.coreExtractEmailAddress !== "function") {
    GEAPA_CORE.coreExtractEmailAddress = function(value) {
      var match = String(value || "").match(/<([^>]+)>/);
      return GEAPA_CORE.coreNormalizeEmail(match ? match[1] : value);
    };
  }

  if (typeof GEAPA_CORE.coreUniqueEmails !== "function") {
    GEAPA_CORE.coreUniqueEmails = function(values) {
      var input = Array.isArray(values)
        ? values
        : String(values || "").split(/[;,]/);

      var seen = {};
      var out = [];

      input.forEach(function(item) {
        var email = GEAPA_CORE.coreExtractEmailAddress(item);
        if (!email || seen[email]) return;
        seen[email] = true;
        out.push(email);
      });

      return out;
    };
  }

  if (typeof GEAPA_CORE.coreNormalizeIdentityKey !== "function") {
    GEAPA_CORE.coreNormalizeIdentityKey = function(value) {
      return String(value == null ? "" : value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
    };
  }

  if (typeof GEAPA_CORE.coreBuildHeaderIndexMap !== "function") {
    GEAPA_CORE.coreBuildHeaderIndexMap = function(headers, opts) {
      opts = opts || {};
      var normalize = opts.normalize !== false;
      var oneBased = opts.oneBased === true;
      var map = {};

      (headers || []).forEach(function(header, index) {
        var raw = String(header || "").trim();
        if (!raw) return;
        var key = normalize ? GEAPA_CORE.coreNormalizeHeader(raw) : raw;
        if (!Object.prototype.hasOwnProperty.call(map, key)) {
          map[key] = oneBased ? index + 1 : index;
        }
      });

      return map;
    };
  }

  if (typeof GEAPA_CORE.coreFindHeaderIndex !== "function") {
    GEAPA_CORE.coreFindHeaderIndex = function(headerMap, headerName, opts) {
      opts = opts || {};
      var key = opts.normalize === false
        ? String(headerName || "").trim()
        : GEAPA_CORE.coreNormalizeHeader(headerName);

      return Object.prototype.hasOwnProperty.call(headerMap || {}, key)
        ? headerMap[key]
        : (opts.notFoundValue != null ? opts.notFoundValue : -1);
    };
  }

  if (typeof GEAPA_CORE.coreWriteCellByHeader !== "function") {
    GEAPA_CORE.coreWriteCellByHeader = function(sheet, rowNumber, headerMap, headerName, value, opts) {
      opts = opts || {};
      var idx = GEAPA_CORE.coreFindHeaderIndex(headerMap, headerName, {
        normalize: opts.normalize !== false,
        notFoundValue: -1
      });
      if (idx < 0) return false;
      var col = opts.oneBased === true ? idx : idx + 1;
      sheet.getRange(rowNumber, col).setValue(value);
      return true;
    };
  }

  if (typeof GEAPA_CORE.coreAppendObjectByHeaders !== "function") {
    GEAPA_CORE.coreAppendObjectByHeaders = function(sheet, payload) {
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
        .map(function(h) { return String(h || "").trim(); });
      var row = headers.map(function(header) {
        return Object.prototype.hasOwnProperty.call(payload || {}, header) ? payload[header] : "";
      });
      sheet.appendRow(row);
      return row;
    };
  }

  if (typeof GEAPA_CORE.coreReadSheetRecords !== "function") {
    GEAPA_CORE.coreReadSheetRecords = function(sheet, opts) {
      opts = opts || {};
      var headerRow = Number(opts.headerRow || 1);
      var startRow = Number(opts.startRow || (headerRow + 1));
      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      if (lastRow < startRow || lastCol < 1) return [];

      var headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0]
        .map(function(h) { return String(h || "").trim(); });
      var values = sheet.getRange(startRow, 1, lastRow - startRow + 1, lastCol).getValues();

      return values.map(function(row, idx) {
        var out = {};
        headers.forEach(function(header, col) {
          out[header] = row[col];
        });
        out.__rowNumber = startRow + idx;
        return out;
      });
    };
  }

  if (typeof GEAPA_CORE.coreGetSemesterIdForDate !== "function") {
    GEAPA_CORE.coreGetSemesterIdForDate = function(value) {
      if (!GEAPA_CORE || typeof GEAPA_CORE.coreGetSemesterForDate !== "function") return "";
      var semesterObj = GEAPA_CORE.coreGetSemesterForDate(value);
      return semesterObj && semesterObj.id ? String(semesterObj.id).trim() : "";
    };
  }

  if (typeof GEAPA_CORE.coreSendTrackedEmail !== "function") {
    GEAPA_CORE.coreSendTrackedEmail = function(params) {
      return members_sendTrackedEmailFallback_(params);
    };
  }
}

function members_normalizeTextCompat_(value, opts) {
  if (members_coreHas_("coreNormalizeText")) {
    return String(GEAPA_CORE.coreNormalizeText(value, opts || {}) || "");
  }

  opts = opts || {};
  var text = String(value == null ? "" : value).trim();
  if (!text) return "";
  if (opts.removeAccents === true) {
    text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  if (opts.collapseWhitespace !== false) {
    text = text.replace(/\s+/g, " ");
  }
  if (opts.caseMode === "upper") return text.toUpperCase();
  if (opts.caseMode === "none") return text;
  return text.toLowerCase();
}

function members_onlyDigitsCompat_(value) {
  if (members_coreHas_("coreOnlyDigits")) {
    return String(GEAPA_CORE.coreOnlyDigits(value) || "");
  }
  return String(value == null ? "" : value).replace(/\D+/g, "");
}

function members_getSemesterId_(value, opts) {
  opts = opts || {};
  var plainText = opts.plainText === true;

  if (members_coreHas_("coreGetSemesterIdForDate")) {
    var idFromCore = GEAPA_CORE.coreGetSemesterIdForDate(value);
    var asText = String(idFromCore || "").trim();
    return plainText ? members_forcePlainText_(asText) : asText;
  }

  var semesterObj = GEAPA_CORE.coreGetSemesterForDate(value);
  var id = semesterObj && semesterObj.id ? String(semesterObj.id).trim() : "";
  return plainText ? members_forcePlainText_(id) : id;
}

function members_normalizeEmailCompat_(value) {
  if (members_coreHas_("coreNormalizeEmail")) {
    return String(GEAPA_CORE.coreNormalizeEmail(value) || "").trim();
  }
  return String(value || "").trim().toLowerCase();
}

function members_extractEmailCompat_(value) {
  if (members_coreHas_("coreExtractEmailAddress")) {
    return String(GEAPA_CORE.coreExtractEmailAddress(value) || "").trim();
  }
  var match = String(value || "").match(/<([^>]+)>/);
  return members_normalizeEmailCompat_(match ? match[1] : value);
}

function members_uniqueEmailsCompat_(values) {
  if (members_coreHas_("coreUniqueEmails")) {
    return GEAPA_CORE.coreUniqueEmails(values) || [];
  }

  var input = Array.isArray(values)
    ? values
    : String(values || "").split(/[;,]/);

  var seen = {};
  var out = [];

  input.forEach(function(item) {
    var email = members_extractEmailCompat_(item);
    if (!email || seen[email]) return;
    seen[email] = true;
    out.push(email);
  });

  return out;
}

function members_normalizeKeyCompat_(value) {
  if (members_coreHas_("coreNormalizeIdentityKey")) {
    return String(GEAPA_CORE.coreNormalizeIdentityKey(value) || "").trim();
  }

  return String(value == null ? "" : value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function members_buildHeaderMapCompat_(headers, opts) {
  opts = opts || {};

  if (members_coreHas_("coreBuildHeaderIndexMap")) {
    return GEAPA_CORE.coreBuildHeaderIndexMap(headers, opts) || {};
  }

  var normalize = opts.normalize !== false;
  var oneBased = opts.oneBased === true;
  var map = {};

  (headers || []).forEach(function(header, index) {
    var raw = String(header || "").trim();
    if (!raw) return;
    var key = normalize ? raw.toLowerCase() : raw;
    if (!Object.prototype.hasOwnProperty.call(map, key)) {
      map[key] = oneBased ? index + 1 : index;
    }
  });

  return map;
}

function members_writeCellByHeaderCompat_(sheet, rowNumber, headerMap, headerName, value, opts) {
  if (members_coreHas_("coreWriteCellByHeader")) {
    return GEAPA_CORE.coreWriteCellByHeader(sheet, rowNumber, headerMap, headerName, value, opts || {});
  }

  opts = opts || {};
  var key = opts.normalize === false
    ? String(headerName || "").trim()
    : normalizeMembersText_(headerName);
  var idx = Object.prototype.hasOwnProperty.call(headerMap || {}, key) ? headerMap[key] : -1;
  if (idx < 0) return false;

  var col = opts.oneBased === true ? idx : idx + 1;
  sheet.getRange(rowNumber, col).setValue(value);
  return true;
}

function members_appendObjectByHeadersCompat_(sheet, payload) {
  if (members_coreHas_("coreAppendObjectByHeaders")) {
    return GEAPA_CORE.coreAppendObjectByHeaders(sheet, payload || {});
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function(h) { return String(h || "").trim(); });

  var row = headers.map(function(header) {
    return Object.prototype.hasOwnProperty.call(payload || {}, header) ? payload[header] : "";
  });

  sheet.appendRow(row);
  return row;
}

function members_readSheetRecordsCompat_(sheet, opts) {
  if (members_coreHas_("coreReadSheetRecords")) {
    return GEAPA_CORE.coreReadSheetRecords(sheet, opts || {}) || [];
  }

  opts = opts || {};
  var headerRow = Number(opts.headerRow || 1);
  var startRow = Number(opts.startRow || (headerRow + 1));
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < startRow || lastCol < 1) return [];

  var headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0]
    .map(function(h) { return String(h || "").trim(); });
  var values = sheet.getRange(startRow, 1, lastRow - startRow + 1, lastCol).getValues();

  return values.map(function(row, idx) {
    var obj = {};
    headers.forEach(function(header, col) {
      obj[header] = row[col];
    });
    obj.__rowNumber = startRow + idx;
    return members_backfillRecordAliases_(obj);
  });
}

function members_findMemberCurrentRowByAnyCompat_(identity) {
  if (members_coreHas_("coreFindMemberCurrentRowByAny")) {
    return GEAPA_CORE.coreFindMemberCurrentRowByAny(identity) || { found: false };
  }

  return { found: false };
}

function members_sendHtmlEmailCompat_(params) {
  if (members_coreHas_("coreSendEmailHtml")) {
    return GEAPA_CORE.coreSendEmailHtml(params || {});
  }

  var recipients = members_uniqueEmailsCompat_(params.to);
  if (!recipients.length) {
    throw new Error("members_sendHtmlEmailCompat_: destinatario ausente.");
  }

  MailApp.sendEmail({
    to: recipients.join(","),
    subject: params.subject || "",
    body: params.body || "Mensagem em HTML",
    htmlBody: params.htmlBody || ""
  });
}

function members_sendTrackedEmail_(params) {
  var to = String(params.to || "").trim();
  var subject = String(params.subject || "").trim();
  var body = String(params.body || "");
  var htmlBody = String(params.htmlBody || "");
  var newerThanDays = Number(params.newerThanDays || SETTINGS.timeoutDays || 7);

  if (!to || !subject) {
    throw new Error("members_sendTrackedEmail_: parametros obrigatorios ausentes (to/subject).");
  }

  if (members_coreHas_("coreSendTrackedEmail")) {
    var sent = GEAPA_CORE.coreSendTrackedEmail({
      to: to,
      subject: subject,
      body: body,
      htmlBody: htmlBody,
      newerThanDays: newerThanDays
    }) || {};

    return {
      threadId: String(sent.threadId || "").trim(),
      messageId: String(sent.messageId || "").trim()
    };
  }

  return members_sendTrackedEmailFallback_({
    to: to,
    subject: subject,
    body: body,
    htmlBody: htmlBody,
    newerThanDays: newerThanDays
  });
}

function members_sendTrackedEmailFallback_(params) {
  var to = String(params.to || "").trim();
  var subject = String(params.subject || "").trim();
  var body = String(params.body || "");
  var htmlBody = String(params.htmlBody || "");
  var newerThanDays = Number(params.newerThanDays || SETTINGS.timeoutDays || 7);

  members_sendHtmlEmailCompat_({
    to: to,
    subject: subject,
    body: body,
    htmlBody: htmlBody
  });

  Utilities.sleep(1500);

  var threads = GmailApp.search(
    'to:' + to + ' subject:"' + subject + '" newer_than:' + newerThanDays + 'd',
    0,
    10
  );

  var threadId = "";
  var messageId = "";

  if (threads && threads.length) {
    var thread = threads[0];
    threadId = String(thread.getId() || "");

    var msgs = thread.getMessages();
    if (msgs && msgs.length) {
      messageId = String(msgs[msgs.length - 1].getId() || "");
    }
  }

  return { threadId: threadId, messageId: messageId };
}
