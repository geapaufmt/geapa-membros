/**
 * Adapters de integração progressiva com GEAPA-CORE.
 *
 * Objetivo:
 * - centralizar pontos compartilháveis no core sem quebrar versões atuais;
 * - manter fallback local quando a Library ainda não expõe o helper.
 */

function members_coreHas_(fnName) {
  return !!(
    typeof GEAPA_CORE !== "undefined" &&
    GEAPA_CORE &&
    typeof GEAPA_CORE[fnName] === "function"
  );
}

function members_getSemesterId_(value, opts) {
  opts = opts || {};
  const plainText = opts.plainText === true;

  if (members_coreHas_("coreGetSemesterIdForDate")) {
    const idFromCore = GEAPA_CORE.coreGetSemesterIdForDate(value);
    const asText = String(idFromCore || "").trim();
    return plainText ? members_forcePlainText_(asText) : asText;
  }

  const semesterObj = GEAPA_CORE.coreGetSemesterForDate(value);
  const id = semesterObj && semesterObj.id ? String(semesterObj.id).trim() : "";
  return plainText ? members_forcePlainText_(id) : id;
}

function members_normalizeEmailCompat_(value) {
  if (members_coreHas_("coreNormalizeEmail")) {
    return String(GEAPA_CORE.coreNormalizeEmail(value) || "").trim();
  }
  return String(value || "").trim().toLowerCase();
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

function members_sendTrackedEmail_(params) {
  const to = String(params.to || "").trim();
  const subject = String(params.subject || "").trim();
  const htmlBody = String(params.htmlBody || "");
  const newerThanDays = Number(params.newerThanDays || SETTINGS.timeoutDays || 7);

  if (!to || !subject) {
    throw new Error("members_sendTrackedEmail_: parâmetros obrigatórios ausentes (to/subject).");
  }

  if (members_coreHas_("coreSendTrackedEmail")) {
    const sent = GEAPA_CORE.coreSendTrackedEmail({
      to: to,
      subject: subject,
      htmlBody: htmlBody,
      newerThanDays: newerThanDays
    }) || {};

    return {
      threadId: String(sent.threadId || "").trim(),
      messageId: String(sent.messageId || "").trim()
    };
  }

  MailApp.sendEmail({
    to: to,
    subject: subject,
    htmlBody: htmlBody
  });

  Utilities.sleep(1500);

  const threads = GmailApp.search(
    `to:${to} subject:"${subject}" newer_than:${newerThanDays}d`,
    0,
    10
  );

  let threadId = "";
  let messageId = "";

  if (threads && threads.length) {
    const thread = threads[0];
    threadId = String(thread.getId() || "");

    const msgs = thread.getMessages();
    if (msgs && msgs.length) {
      messageId = String(msgs[msgs.length - 1].getId() || "");
    }
  }

  return { threadId, messageId };
}
