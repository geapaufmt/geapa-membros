/***************************************
 * 02_acceptance_processing.gs
 *
 * Etapa 2 do fluxo:
 * - lê respostas de aceite
 * - identifica "ACEITO"
 * - registra data de resposta
 * - calcula semestre de entrada
 * - copia para Membros Atuais
 * - marca como Integrado
 * - envia email final
 ***************************************/

/**
 * Processa respostas de aceite no Gmail.
 *
 * Regra atual:
 * - busca threads recentes
 * - procura remetentes que existam em MEMBERS_FUTURO
 * - se a última mensagem contiver "ACEITO", integra o membro
 */
function members_processAcceptanceReplies() {
  members_assertCore_();

  const futureSheet = GEAPA_CORE.coreGetSheetByKey(SETTINGS.futureKey);
  const currentSheet = GEAPA_CORE.coreGetSheetByKey(SETTINGS.currentKey);
  if (!futureSheet || !currentSheet) {
    throw new Error("Não foi possível localizar MEMBERS_FUTURO ou MEMBERS_ATUAIS.");
  }

  const futureLastRow = futureSheet.getLastRow();
  const futureLastCol = futureSheet.getLastColumn();
  if (futureLastRow < 2) return;

  const futureHeaders = futureSheet.getRange(1, 1, 1, futureLastCol).getValues()[0].map(h => String(h || "").trim());
  const futureIdx = getMembersHeaderIndexMap_(futureHeaders);
  const futureValues = futureSheet.getRange(2, 1, futureLastRow - 1, futureLastCol).getValues();

  for (let i = 0; i < futureValues.length; i++) {
    const absoluteRow = i + 2;
    const row = futureValues[i];

    const processStatus = futureIdx.processStatus >= 0
      ? String(row[futureIdx.processStatus] || "").trim()
      : "";

    if (
      normalizeMembersText_(processStatus) === normalizeMembersText_(SETTINGS.values.integrated) ||
      normalizeMembersText_(processStatus) === normalizeMembersText_(SETTINGS.values.refused)
    ) {
      continue;
    }

    const threadId = futureIdx.threadId >= 0
      ? String(row[futureIdx.threadId] || "").trim()
      : "";

    if (!threadId) continue;

    let thread;
    try {
      thread = GmailApp.getThreadById(threadId);
    } catch (e) {
      thread = null;
    }
    if (!thread) continue;

    const msgs = thread.getMessages();
    if (!msgs.length) continue;

    const lastMsg = msgs[msgs.length - 1];
    const messageId = lastMsg.getId();

    const savedMessageId = futureIdx.messageId >= 0
    ? String(row[futureIdx.messageId] || "").trim()
    : "";

    if (savedMessageId && savedMessageId === String(messageId)) {
    continue;
    }

    const fromEmail = members_extractEmail_(lastMsg.getFrom() || "");
    const rowEmail = futureIdx.email >= 0 ? members_normalizeEmail_(row[futureIdx.email]) : "";

    if (!fromEmail || !rowEmail || fromEmail !== rowEmail) continue;

    const body = `${lastMsg.getPlainBody() || ""}\n${lastMsg.getBody() || ""}`;

    if (members_hasRefusalText_(body)) {
      const refusalReason = members_extractRefusalReason_(body);
      members_markFutureAsRefused_(futureSheet, absoluteRow, futureIdx, messageId, refusalReason);
      continue;
    }

    if (!members_hasAcceptanceText_(body)) continue;

    members_integrateAcceptedFutureMember_(futureSheet, currentSheet, absoluteRow, futureHeaders, futureIdx, row, messageId);
  }
}

/**
 * Retorna o semestre de entrada com base na data de aceite.
 *
 * Formato:
 * - YYYY/S
 *
 * @param {Date|string|number} acceptanceDate
 * @return {string}
 */
function members_getEntrySemesterFromAcceptanceDate_(acceptanceDate) {
  return members_getSemesterId_(acceptanceDate, { plainText: false });
}

/**
 * Procura a linha do membro em espera pelo email.
 *
 * @param {Array[]} values
 * @param {Object} idx
 * @param {string} email
 * @return {number}
 */
function members_findFutureRowByEmail_(values, idx, email) {
  if (idx.email < 0) return -1;

  const target = normalizeMembersText_(email);
  for (let i = 0; i < values.length; i++) {
    const rowEmail = normalizeMembersText_(values[i][idx.email]);
    if (rowEmail && rowEmail === target) return i;
  }
  return -1;
}

/**
 * Verifica se o corpo contém aceite.
 *
 * @param {string} body
 * @return {boolean}
 */

/**
 * Tenta extrair apenas a parte nova da resposta,
 * removendo o trecho citado do email anterior.
 *
 * @param {string} body
 * @return {string}
 */
function members_extractLatestReplyText_(body) {
  let text = String(body || "");

  // remove HTML básico
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<[^>]*>/g, " ");

  // normaliza espaços
  text = text.replace(/\r/g, "").replace(/\u00a0/g, " ");

  const lines = text.split("\n");
  const kept = [];

  for (let i = 0; i < lines.length; i++) {
    const line = String(lines[i] || "").trim();

    // para ao encontrar bloco citado/reencaminhado
    if (
      /^em .* escreveu:$/i.test(line) ||
      /^on .* wrote:$/i.test(line) ||
      /^>/.test(line) ||
      /^de: /i.test(line) ||
      /^from: /i.test(line) ||
      /^assunto: /i.test(line) ||
      /^subject: /i.test(line)
    ) {
      break;
    }

    kept.push(line);
  }

  return kept.join(" ").replace(/\s+/g, " ").trim();
}

function members_hasAcceptanceText_(body) {
  const text = normalizeMembersText_(members_extractLatestReplyText_(body));
  return /\baceito\b/.test(text);
}

function members_hasRefusalText_(body) {
  const text = normalizeMembersText_(members_extractLatestReplyText_(body));
  return /\brecuso\b/.test(text) || /\bnão aceito\b/.test(text) || /\bnao aceito\b/.test(text);
}

function members_extractRefusalReason_(body) {
  const raw = members_extractLatestReplyText_(body);

  let reason = String(raw || "")
    .replace(/^recuso[\s,:;.-]*/i, "")
    .replace(/^não aceito[\s,:;.-]*/i, "")
    .replace(/^nao aceito[\s,:;.-]*/i, "")
    .trim();

  return reason;
}

/**
 * Extrai email do campo From.
 *
 * @param {string} from
 * @return {string}
 */
function members_extractEmail_(from) {
  return members_extractEmailCompat_(from);
}

function members_assertLifecycleOutboxCore_() {
  if (
    !members_coreHas_("coreMailQueueOutgoing") ||
    !members_coreHas_("coreMailProcessOutbox")
  ) {
    throw new Error("GEAPA-CORE sem suporte completo para MAIL_SAIDA no fluxo de membros.");
  }
}

function members_getOfficialGroupConfigRecord_() {
  if (!members_coreHas_("coreReadRecordsByKey")) return {};

  try {
    const records = GEAPA_CORE.coreReadRecordsByKey("DADOS_OFICIAIS_GEAPA", {
      skipBlankRows: true
    });
    return records && records.length ? (records[0] || {}) : {};
  } catch (err) {
    return {};
  }
}

function members_getOfficialWhatsAppGroupLink_() {
  const officialRecord = members_getOfficialGroupConfigRecord_();
  const officialLink = String(officialRecord.LINK_GRUPO_WHATSAPP || "").trim();
  return officialLink || String((SETTINGS.finalEmail && SETTINGS.finalEmail.whatsappGroupLink) || "").trim();
}

function members_formatLifecycleDate_(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!(date instanceof Date) || isNaN(date.getTime())) return "";

  if (members_coreHas_("coreFormatDate")) {
    return GEAPA_CORE.coreFormatDate(date, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }

  return Utilities.formatDate(date, Session.getScriptTimeZone(), "dd/MM/yyyy");
}

function members_buildEntryFlowContextFromRow_(row, futureIdx, rowIndex, refDate) {
  const eventDate = refDate instanceof Date ? refDate : new Date();
  const name = futureIdx.name >= 0 ? String(row[futureIdx.name] || "").trim() : "";
  const email = futureIdx.email >= 0 ? String(row[futureIdx.email] || "").trim() : "";
  const rga = futureIdx.rga >= 0 ? String(row[futureIdx.rga] || "").trim() : "";
  const identifier = members_buildInviteCorrelationIdentifier_({
    rowIndex: rowIndex,
    name: name,
    email: email,
    rga: rga
  });

  return Object.freeze({
    rowIndex: rowIndex,
    refDate: eventDate,
    name: name,
    email: email,
    rga: rga,
    identifier: identifier,
    entityId: rga || identifier
  });
}

function members_buildEntryFlowCorrelationKey_(ctx, stage) {
  members_assertInviteRendererCore_();

  return GEAPA_CORE.coreMailBuildCorrelationKey("MEM", {
    businessId: String(ctx.refDate.getFullYear()) + "-" + ctx.identifier,
    flowCode: "CNV",
    stage: String(stage || "CAND").trim().toUpperCase()
  });
}

function members_queueEntryFlowOutgoing_(contract) {
  if (!contract || !String(contract.to || "").trim()) return null;

  members_assertLifecycleOutboxCore_();
  const queueResult = GEAPA_CORE.coreMailQueueOutgoing(contract);

  try {
    GEAPA_CORE.coreMailProcessOutbox();
  } catch (err) {}

  return queueResult;
}

function members_buildAcceptedFinalOutgoingContract_(ctx, acceptedAt) {
  const safeName = String(ctx.name || "").trim() || "membro(a)";
  const whatsappLink = members_getOfficialWhatsAppGroupLink_();
  const subjectHuman = String((SETTINGS.finalEmail && SETTINGS.finalEmail.subject) || "Sua entrada no GEAPA foi confirmada").trim();
  const formattedIntegrationDate = members_formatLifecycleDate_(acceptedAt || ctx.refDate);
  const blocks = [
    {
      title: "Próximos passos",
      text: "Sua integração foi concluída com sucesso e você já pode acompanhar as atividades e comunicações do grupo."
    }
  ];

  return {
    moduleName: "MEMBROS",
    templateKey: String((SETTINGS.finalEmail && SETTINGS.finalEmail.templateKey) || "GEAPA_CLASSICO").trim() || "GEAPA_CLASSICO",
    correlationKey: members_buildEntryFlowCorrelationKey_(ctx, "INTEGRADO"),
    entityType: "MEMBRO",
    entityId: ctx.entityId,
    flowCode: "CNV",
    stage: "INTEGRADO",
    to: ctx.email,
    cc: "",
    bcc: "",
    subjectHuman: subjectHuman,
    payload: {
      title: subjectHuman,
      subtitle: "Ingresso confirmado no GEAPA",
      introText:
        "Olá, " + safeName + "!\n\n" +
        "Sua entrada no GEAPA foi confirmada e você já foi integrado(a) oficialmente ao grupo.",
      blocks: blocks,
      cta: whatsappLink ? {
        label: "Entrar no grupo do WhatsApp",
        url: whatsappLink,
        helper: "Use este botão para entrar no grupo oficial do GEAPA."
      } : null,
      footerNote: formattedIntegrationDate
        ? ("Data de integração: " + formattedIntegrationDate + ".")
        : ""
    },
    priority: "NORMAL",
    sendAfter: "",
    metadata: {
      rowIndex: ctx.rowIndex,
      rga: ctx.rga,
      email: ctx.email,
      name: ctx.name,
      notificationType: "FINAL_ACCEPTANCE"
    }
  };
}

function members_buildRefusalOutgoingContract_(ctx, refusalReason) {
  const safeName = String(ctx.name || "").trim() || "candidato(a)";
  const subjectHuman = String((SETTINGS.refusalEmail && SETTINGS.refusalEmail.subject) || "Confirmação de recusa de ingresso no GEAPA").trim();
  const blocks = refusalReason
    ? [{
        title: "Motivo informado",
        text: String(refusalReason || "").trim()
      }]
    : [];

  return {
    moduleName: "MEMBROS",
    templateKey: String((SETTINGS.refusalEmail && SETTINGS.refusalEmail.templateKey) || "GEAPA_CLASSICO").trim() || "GEAPA_CLASSICO",
    correlationKey: members_buildEntryFlowCorrelationKey_(ctx, "RECUSOU"),
    entityType: "MEMBRO",
    entityId: ctx.entityId,
    flowCode: "CNV",
    stage: "RECUSOU",
    to: ctx.email,
    cc: "",
    bcc: "",
    subjectHuman: subjectHuman,
    payload: {
      title: subjectHuman,
      subtitle: "Fluxo de ingresso no GEAPA",
      introText:
        "Olá, " + safeName + "!\n\n" +
        "Recebemos sua resposta e confirmamos a sua recusa em ingressar no GEAPA neste processo seletivo.",
      blocks: blocks,
      footerNote: "Caso deseje participar futuramente, será necessário realizar inscrição e participação em um novo processo seletivo."
    },
    priority: "NORMAL",
    sendAfter: "",
    metadata: {
      rowIndex: ctx.rowIndex,
      rga: ctx.rga,
      email: ctx.email,
      name: ctx.name,
      notificationType: "REFUSAL_CONFIRMATION"
    }
  };
}

function members_buildTimeoutOutgoingContract_(ctx) {
  const safeName = String(ctx.name || "").trim() || "candidato(a)";
  const subjectHuman = String((SETTINGS.timeoutEmail && SETTINGS.timeoutEmail.subject) || "Prazo encerrado para ingresso no GEAPA").trim();

  return {
    moduleName: "MEMBROS",
    templateKey: String((SETTINGS.timeoutEmail && SETTINGS.timeoutEmail.templateKey) || "GEAPA_CLASSICO").trim() || "GEAPA_CLASSICO",
    correlationKey: members_buildEntryFlowCorrelationKey_(ctx, "EXPIRADO"),
    entityType: "MEMBRO",
    entityId: ctx.entityId,
    flowCode: "CNV",
    stage: "EXPIRADO",
    to: ctx.email,
    cc: "",
    bcc: "",
    subjectHuman: subjectHuman,
    payload: {
      title: subjectHuman,
      subtitle: "Fluxo de ingresso no GEAPA",
      introText:
        "Olá, " + safeName + "!\n\n" +
        "O prazo para resposta ao convite de ingresso no GEAPA foi encerrado.",
      blocks: [
        {
          title: "Prazo finalizado",
          text: "Como não houve manifestação dentro do período de " + SETTINGS.timeoutDays + " dias, seu convite foi finalizado e sua participação neste processo foi encerrada."
        }
      ],
      footerNote: "Caso deseje ingressar futuramente, será necessário participar de um novo processo seletivo."
    },
    priority: "NORMAL",
    sendAfter: "",
    metadata: {
      rowIndex: ctx.rowIndex,
      rga: ctx.rga,
      email: ctx.email,
      name: ctx.name,
      notificationType: "INVITATION_TIMEOUT"
    }
  };
}

/**
 * Email final após integração.
 *
 * @param {string} name
 * @param {string} whatsappLink
 * @return {string}
 */
function buildMembersFinalEmailHtml_(name, whatsappLink) {
  const safeName = escapeMembersHtml_(name || "membro(a)");
  const safeLink = escapeMembersHtml_(whatsappLink || "");

  return `
    <p>Olá, <b>${safeName}</b>!</p>
    <p>Sua entrada no GEAPA foi confirmada e você já foi integrado(a) oficialmente ao grupo.</p>
    <p>Segue o link do grupo do WhatsApp:</p>
    <p><a href="${safeLink}">${safeLink}</a></p>
    <p>Seja bem-vindo(a)!</p>
    <p>Atenciosamente,<br>GEAPA</p>
  `;
}

function members_markFutureAsRefused_(futureSheet, absoluteRow, futureIdx, messageId, refusalReason) {
  const now = new Date();

  const row = futureSheet.getRange(absoluteRow, 1, 1, futureSheet.getLastColumn()).getValues()[0];
  const name = futureIdx.name >= 0 ? String(row[futureIdx.name] || "").trim() : "";
  const email = futureIdx.email >= 0 ? String(row[futureIdx.email] || "").trim() : "";

  if (futureIdx.status >= 0) {
    futureSheet.getRange(absoluteRow, futureIdx.status + 1).setValue(SETTINGS.values.disqualified);
  }

  if (futureIdx.repliedAt >= 0) {
    futureSheet.getRange(absoluteRow, futureIdx.repliedAt + 1).setValue(now);
  }

  if (futureIdx.processStatus >= 0) {
    futureSheet.getRange(absoluteRow, futureIdx.processStatus + 1).setValue(SETTINGS.values.refused);
  }

  if (futureIdx.messageId >= 0 && messageId) {
    futureSheet.getRange(absoluteRow, futureIdx.messageId + 1).setValue(messageId);
  }

  if (futureIdx.notes >= 0) {
    const note = refusalReason
      ? `Convite recusado pelo candidato. Motivo informado: ${refusalReason}`
      : "Convite recusado pelo candidato.";
    futureSheet.getRange(absoluteRow, futureIdx.notes + 1).setValue(note);
  }

  if (email) {
    const ctx = members_buildEntryFlowContextFromRow_(row, futureIdx, absoluteRow, now);
    members_queueEntryFlowOutgoing_(
      members_buildRefusalOutgoingContract_(ctx, refusalReason)
    );
  }
}

function buildMembersRefusalEmailHtml_(name) {
  const safeName = escapeMembersHtml_(name || "candidato(a)");

  return `
    <p>Olá, <b>${safeName}</b>!</p>
    <p>Recebemos sua resposta e confirmamos a sua recusa em ingressar no GEAPA neste processo seletivo.</p>
    <p>Caso deseje participar futuramente, será necessário realizar inscrição e participação em um novo processo seletivo.</p>
    <p>Agradecemos seu retorno.</p>
    <p>Atenciosamente,<br>GEAPA</p>
  `;
}

function members_integrateAcceptedFutureMember_(futureSheet, currentSheet, absoluteRow, futureHeaders, futureIdx, row, messageId) {
  const currentProcessStatus = futureIdx.processStatus >= 0
    ? String(row[futureIdx.processStatus] || "").trim()
    : "";

  if (normalizeMembersText_(currentProcessStatus) === normalizeMembersText_(SETTINGS.values.integrated)) {
    return;
  }

  const acceptedAt = new Date();
  const entrySemester = members_getEntrySemesterFromAcceptanceDate_(acceptedAt);

  if (futureIdx.repliedAt >= 0) {
    futureSheet.getRange(absoluteRow, futureIdx.repliedAt + 1).setValue(acceptedAt);
  }
  if (futureIdx.processStatus >= 0) {
    futureSheet.getRange(absoluteRow, futureIdx.processStatus + 1).setValue(SETTINGS.values.accepted);
  }
  if (futureIdx.entrySemester >= 0) {
    futureSheet.getRange(absoluteRow, futureIdx.entrySemester + 1).setValue(entrySemester);
  }
  if (futureIdx.messageId >= 0 && messageId) {
    futureSheet.getRange(absoluteRow, futureIdx.messageId + 1).setValue(messageId);
  }

  const rga = futureIdx.rga >= 0 ? String(row[futureIdx.rga] || "").trim() : "";
  if (rga && members_currentHasRga_(currentSheet, rga)) {
    if (futureIdx.status >= 0) {
      futureSheet.getRange(absoluteRow, futureIdx.status + 1).setValue(SETTINGS.values.active);
    }
    if (futureIdx.processStatus >= 0) {
      futureSheet.getRange(absoluteRow, futureIdx.processStatus + 1).setValue(SETTINGS.values.integrated);
    }
    if (futureIdx.notes >= 0) {
      futureSheet.getRange(absoluteRow, futureIdx.notes + 1).setValue("Membro já existente em Membros Atuais; linha de espera marcada como integrada.");
    }
    return;
  }

  const currentLastCol = currentSheet.getLastColumn();
  const currentHeaders = currentSheet.getRange(1, 1, 1, currentLastCol).getValues()[0].map(h => String(h || "").trim());

  const newCurrentRow = members_buildCurrentRowFromFutureRow_(
    row,
    futureHeaders,
    currentHeaders,
    entrySemester
  );

  const newRowIndex = currentSheet.getLastRow() + 1;
  currentSheet.appendRow(newCurrentRow);

  // atualiza campos derivados logo após a integração
  GEAPA_CORE.coreSyncMembersCurrentDerivedFields();

  // grava Data integração no destino, se existir a coluna
  const currentIdx = members_getHeaderMap_(currentHeaders);
  const integratedAtIdx = members_findHeaderIndexByAliases_(
    currentIdx,
    members_getHeaderAliases_("current", "integratedAt"),
    { notFoundValue: -1 }
  );
  if (integratedAtIdx != null && integratedAtIdx >= 0) {
    currentSheet.getRange(newRowIndex, integratedAtIdx + 1).setValue(acceptedAt);
  }

  if (futureIdx.status >= 0) {
    futureSheet.getRange(absoluteRow, futureIdx.status + 1).setValue(SETTINGS.values.active);
  }
  if (futureIdx.processStatus >= 0) {
    futureSheet.getRange(absoluteRow, futureIdx.processStatus + 1).setValue(SETTINGS.values.integrated);
  }
  if (futureIdx.notes >= 0) {
    futureSheet.getRange(absoluteRow, futureIdx.notes + 1).setValue("Membro integrado em Membros Atuais.");
  }

  const fromEmail = futureIdx.email >= 0 ? String(row[futureIdx.email] || "").trim() : "";

  if (fromEmail) {
    const ctx = members_buildEntryFlowContextFromRow_(row, futureIdx, absoluteRow, acceptedAt);
    members_queueEntryFlowOutgoing_(
      members_buildAcceptedFinalOutgoingContract_(ctx, acceptedAt)
    );
  }
}

function members_processInvitationTimeouts() {
  members_assertCore_();

  const futureSheet = GEAPA_CORE.coreGetSheetByKey(SETTINGS.futureKey);
  if (!futureSheet) {
    throw new Error("Não foi possível localizar MEMBERS_FUTURO.");
  }

  const lastRow = futureSheet.getLastRow();
  const lastCol = futureSheet.getLastColumn();
  if (lastRow < 2) return;

  const headers = futureSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim());
  const idx = getMembersHeaderIndexMap_(headers);
  const values = futureSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const now = new Date();
  const msLimit = SETTINGS.timeoutDays * 24 * 60 * 60 * 1000;

  for (let i = 0; i < values.length; i++) {
    const absoluteRow = i + 2;
    const row = futureSheet.getRange(absoluteRow, 1, 1, lastCol).getValues()[0];

    const status = idx.status >= 0 ? String(row[idx.status] || "").trim() : "";
    const processStatus = idx.processStatus >= 0 ? String(row[idx.processStatus] || "").trim() : "";
    const repliedAt = idx.repliedAt >= 0 ? row[idx.repliedAt] : "";
    const sentAt = idx.sentAt >= 0 ? row[idx.sentAt] : "";
    const email = idx.email >= 0 ? String(row[idx.email] || "").trim() : "";
    const name = idx.name >= 0 ? String(row[idx.name] || "").trim() : "";

    // Só trata quem está aguardando resposta após email enviado
    if (normalizeMembersText_(processStatus) !== normalizeMembersText_(SETTINGS.values.emailed)) {
      continue;
    }

    // Se já respondeu, ignora
    if (repliedAt) continue;
    if (!sentAt) continue;

    const sentDate = new Date(sentAt);
    if (isNaN(sentDate.getTime())) continue;

    const elapsed = now.getTime() - sentDate.getTime();
    if (elapsed < msLimit) continue;

    if (idx.status >= 0) {
      futureSheet.getRange(absoluteRow, idx.status + 1).setValue(SETTINGS.values.disqualified);
    }

    if (idx.processStatus >= 0) {
      futureSheet.getRange(absoluteRow, idx.processStatus + 1).setValue(SETTINGS.values.expired);
    }

    if (idx.notes >= 0) {
      futureSheet.getRange(absoluteRow, idx.notes + 1).setValue(
        `Prazo de ${SETTINGS.timeoutDays} dias expirado sem resposta ao convite.`
      );
    }

    if (email) {
      const ctx = members_buildEntryFlowContextFromRow_(row, idx, absoluteRow, now);
      members_queueEntryFlowOutgoing_(
        members_buildTimeoutOutgoingContract_(ctx)
      );
    }
  }
}

function buildMembersTimeoutEmailHtml_(name) {
  const safeName = escapeMembersHtml_(name || "candidato(a)");

  return `
    <p>Olá, <b>${safeName}</b>!</p>
    <p>O prazo para resposta ao convite de ingresso no GEAPA foi encerrado.</p>
    <p>Como não houve manifestação dentro do período de ${SETTINGS.timeoutDays} dias, seu convite foi finalizado e sua participação neste processo foi encerrada.</p>
    <p>Caso deseje ingressar futuramente, será necessário participar de um novo processo seletivo.</p>
    <p>Atenciosamente,<br>GEAPA</p>
  `;
}

function members_canUseMailHubReplyProcessing_() {
  return members_coreHas_("coreMailGetLatestEvent") && members_coreHas_("coreMailMarkEventProcessed");
}

function members_tryIngestMailHubInbox_() {
  if (!members_coreHas_("coreMailIngestInbox")) return null;

  try {
    return GEAPA_CORE.coreMailIngestInbox({
      maxEventsPerExecution: 50
    });
  } catch (err) {
    return null;
  }
}

function members_tryGetPendingReplyEventFromMailHub_(threadId, rowEmail, savedMessageId) {
  if (!members_canUseMailHubReplyProcessing_()) return null;

  const event = GEAPA_CORE.coreMailGetLatestEvent({
    moduleName: "MEMBROS",
    processingStatus: "PENDENTE",
    threadId: String(threadId || "").trim()
  });

  if (!event) return null;
  if (String(event.direction || "").trim().toUpperCase() !== "ENTRADA") return null;
  if (savedMessageId && String(event.messageId || "").trim() === String(savedMessageId || "").trim()) return null;

  const normalizedFrom = members_normalizeEmail_(event.fromEmail || "");
  if (!normalizedFrom || !rowEmail || normalizedFrom !== rowEmail) return null;

  const body = [
    String(event.plainBody || "").trim(),
    String(event.snippet || "").trim()
  ].filter(Boolean).join("\n");

  return Object.freeze({
    eventId: String(event.eventId || "").trim(),
    messageId: String(event.messageId || "").trim(),
    threadId: String(event.threadId || "").trim(),
    body: body,
    event: event
  });
}

function members_markMailHubEventProcessed_(eventId) {
  if (!eventId || !members_coreHas_("coreMailMarkEventProcessed")) return null;

  try {
    return GEAPA_CORE.coreMailMarkEventProcessed(
      String(eventId || "").trim(),
      "geapa-membros.members_processAcceptanceReplies"
    );
  } catch (err) {
    return null;
  }
}

function members_processAcceptanceReplies() {
  members_assertCore_();
  members_tryIngestMailHubInbox_();

  const futureSheet = GEAPA_CORE.coreGetSheetByKey(SETTINGS.futureKey);
  const currentSheet = GEAPA_CORE.coreGetSheetByKey(SETTINGS.currentKey);
  if (!futureSheet || !currentSheet) {
    throw new Error("NÃ£o foi possÃ­vel localizar MEMBERS_FUTURO ou MEMBERS_ATUAIS.");
  }

  const futureLastRow = futureSheet.getLastRow();
  const futureLastCol = futureSheet.getLastColumn();
  if (futureLastRow < 2) return;

  const futureHeaders = futureSheet.getRange(1, 1, 1, futureLastCol).getValues()[0].map(h => String(h || "").trim());
  const futureIdx = getMembersHeaderIndexMap_(futureHeaders);
  const futureRange = futureSheet.getRange(2, 1, futureLastRow - 1, futureLastCol);
  const futureValues = futureRange.getValues();
  const futureFormulas = futureRange.getFormulas();

  for (let i = 0; i < futureValues.length; i++) {
    const absoluteRow = i + 2;
    const row = futureValues[i];
    const rowFormulas = futureFormulas[i];

    const processStatus = futureIdx.processStatus >= 0
      ? String(row[futureIdx.processStatus] || "").trim()
      : "";

    if (
      normalizeMembersText_(processStatus) === normalizeMembersText_(SETTINGS.values.integrated) ||
      normalizeMembersText_(processStatus) === normalizeMembersText_(SETTINGS.values.refused)
    ) {
      continue;
    }

    const threadId = futureIdx.threadId >= 0
      ? String(row[futureIdx.threadId] || "").trim()
      : "";

    if (!threadId) continue;

    const savedMessageId = futureIdx.messageId >= 0
      ? String(row[futureIdx.messageId] || "").trim()
      : "";
    const rowEmail = futureIdx.email >= 0 ? members_normalizeEmail_(row[futureIdx.email]) : "";
    const mailHubReply = members_tryGetPendingReplyEventFromMailHub_(threadId, rowEmail, savedMessageId);

    if (mailHubReply && members_hasRefusalText_(mailHubReply.body)) {
      const refusalReason = members_extractRefusalReason_(mailHubReply.body);
      members_markFutureAsRefused_(futureSheet, absoluteRow, futureIdx, mailHubReply.messageId, refusalReason);
      members_markMailHubEventProcessed_(mailHubReply.eventId);
      continue;
    }

    if (mailHubReply && members_hasAcceptanceText_(mailHubReply.body)) {
      members_integrateAcceptedFutureMember_(
        futureSheet,
        currentSheet,
        absoluteRow,
        futureHeaders,
        futureIdx,
        row,
        rowFormulas,
        mailHubReply.messageId
      );
      members_markMailHubEventProcessed_(mailHubReply.eventId);
      continue;
    }

    let thread;
    try {
      thread = GmailApp.getThreadById(threadId);
    } catch (e) {
      thread = null;
    }
    if (!thread) continue;

    const msgs = thread.getMessages();
    if (!msgs.length) continue;

    const lastMsg = msgs[msgs.length - 1];
    const messageId = lastMsg.getId();

    if (savedMessageId && savedMessageId === String(messageId)) {
      continue;
    }

    const fromEmail = members_extractEmail_(lastMsg.getFrom() || "");

    if (!fromEmail || !rowEmail || fromEmail !== rowEmail) continue;

    const body = `${lastMsg.getPlainBody() || ""}\n${lastMsg.getBody() || ""}`;

    if (members_hasRefusalText_(body)) {
      const refusalReason = members_extractRefusalReason_(body);
      members_markFutureAsRefused_(futureSheet, absoluteRow, futureIdx, messageId, refusalReason);
      if (mailHubReply && mailHubReply.messageId === String(messageId)) {
        members_markMailHubEventProcessed_(mailHubReply.eventId);
      }
      continue;
    }

    if (!members_hasAcceptanceText_(body)) continue;

    members_integrateAcceptedFutureMember_(
      futureSheet,
      currentSheet,
      absoluteRow,
      futureHeaders,
      futureIdx,
      row,
      rowFormulas,
      messageId
    );
    if (mailHubReply && mailHubReply.messageId === String(messageId)) {
      members_markMailHubEventProcessed_(mailHubReply.eventId);
    }
  }
}

function members_integrateAcceptedFutureMember_(futureSheet, currentSheet, absoluteRow, futureHeaders, futureIdx, row, rowFormulas, messageId) {
  const currentProcessStatus = futureIdx.processStatus >= 0
    ? String(row[futureIdx.processStatus] || "").trim()
    : "";

  if (normalizeMembersText_(currentProcessStatus) === normalizeMembersText_(SETTINGS.values.integrated)) {
    return;
  }

  const acceptedAt = new Date();
  const entrySemester = members_getEntrySemesterFromAcceptanceDate_(acceptedAt);

  if (futureIdx.repliedAt >= 0) {
    futureSheet.getRange(absoluteRow, futureIdx.repliedAt + 1).setValue(acceptedAt);
  }
  if (futureIdx.processStatus >= 0) {
    futureSheet.getRange(absoluteRow, futureIdx.processStatus + 1).setValue(SETTINGS.values.accepted);
  }
  if (futureIdx.entrySemester >= 0) {
    futureSheet.getRange(absoluteRow, futureIdx.entrySemester + 1).setValue(entrySemester);
  }
  if (futureIdx.messageId >= 0 && messageId) {
    futureSheet.getRange(absoluteRow, futureIdx.messageId + 1).setValue(messageId);
  }

  const rga = futureIdx.rga >= 0 ? String(row[futureIdx.rga] || "").trim() : "";
  if (rga && members_currentHasRga_(currentSheet, rga)) {
    if (futureIdx.status >= 0) {
      futureSheet.getRange(absoluteRow, futureIdx.status + 1).setValue(SETTINGS.values.active);
    }
    if (futureIdx.processStatus >= 0) {
      futureSheet.getRange(absoluteRow, futureIdx.processStatus + 1).setValue(SETTINGS.values.integrated);
    }
    if (futureIdx.notes >= 0) {
      futureSheet.getRange(absoluteRow, futureIdx.notes + 1).setValue("Membro jÃ¡ existente em Membros Atuais; linha de espera marcada como integrada.");
    }
    return;
  }

  const currentLastCol = currentSheet.getLastColumn();
  const currentHeaders = currentSheet.getRange(1, 1, 1, currentLastCol).getValues()[0].map(h => String(h || "").trim());

  const newCurrentRow = members_buildCurrentRowFromFutureRow_(
    row,
    futureHeaders,
    currentHeaders,
    entrySemester,
    {
      sourceFormulas: rowFormulas,
      integratedAt: acceptedAt
    }
  );

  const newRowIndex = currentSheet.getLastRow() + 1;
  currentSheet.appendRow(newCurrentRow);

  const currentIdx = members_getHeaderMap_(currentHeaders);
  const integratedAtIdx = members_findHeaderIndexByAliases_(
    currentIdx,
    members_getHeaderAliases_("current", "integratedAt"),
    { notFoundValue: -1 }
  );
  if (integratedAtIdx != null && integratedAtIdx >= 0) {
    currentSheet.getRange(newRowIndex, integratedAtIdx + 1).setValue(acceptedAt);
  }

  GEAPA_CORE.coreSyncMembersCurrentDerivedFields();

  if (futureIdx.status >= 0) {
    futureSheet.getRange(absoluteRow, futureIdx.status + 1).setValue(SETTINGS.values.active);
  }
  if (futureIdx.processStatus >= 0) {
    futureSheet.getRange(absoluteRow, futureIdx.processStatus + 1).setValue(SETTINGS.values.integrated);
  }
  if (futureIdx.notes >= 0) {
    futureSheet.getRange(absoluteRow, futureIdx.notes + 1).setValue("Membro integrado em Membros Atuais.");
  }

  const fromEmail = futureIdx.email >= 0 ? String(row[futureIdx.email] || "").trim() : "";

  if (fromEmail) {
    const ctx = members_buildEntryFlowContextFromRow_(row, futureIdx, absoluteRow, acceptedAt);
    members_queueEntryFlowOutgoing_(
      members_buildAcceptedFinalOutgoingContract_(ctx, acceptedAt)
    );
  }
}
