/***************************************
 * 01_waiting_list_invites.gs
 *
 * Etapa 1 do fluxo de membros:
 * - quando Status do processo = "Enviar e-mail"
 * - envia o convite
 * - marca a linha como "E-mail enviado"
 ***************************************/

/**
 * Trigger instalável de edição.
 *
 * Reage apenas quando:
 * - a edição ocorre na aba MEMBERS_FUTURO
 * - a coluna editada é "Status do processo"
 * - o valor novo é "Enviar e-mail"
 *
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e
 */
function members_onEditProcessStatus(e) {
  try {
    members_assertCore_();

    if (!e || !e.range) return;

    const editedSheet = e.range.getSheet();
    const futureSheet = GEAPA_CORE.coreGetSheetByKey(SETTINGS.futureKey);
    if (!futureSheet) return;

    if (editedSheet.getSheetId() !== futureSheet.getSheetId()) return;
    if (e.range.getRow() < 2) return;

    const lastCol = editedSheet.getLastColumn();
    const headers = editedSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim());
    const idx = getMembersHeaderIndexMap_(headers);

    if (idx.processStatus < 0) {
      throw new Error('Cabeçalho "Status do processo" não encontrado em Membros em Espera.');
    }

    // só reage se a célula editada for a coluna Status do processo
    if (e.range.getColumn() !== idx.processStatus + 1) return;

    const newValue = String(e.value || "").trim();
    if (normalizeMembersText_(newValue) !== normalizeMembersText_(SETTINGS.values.sendEmail)) return;

    members_sendInviteByRow_(editedSheet, e.range.getRow(), headers);
  } catch (err) {
    console.error("members_onEditProcessStatus erro:", err);
  }
}

/**
 * Envia o email de convite para a linha informada
 * e marca o processo como "E-mail enviado".
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} rowIndex
 * @param {string[]=} headers
 */
function members_sendInviteByRow_(sheet, rowIndex, headers) {
  const lastCol = sheet.getLastColumn();
  const head = headers || sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim());
  const row = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
  const idx = getMembersHeaderIndexMap_(head);

  const name = idx.name >= 0 ? String(row[idx.name] || "").trim() : "";
  const email = idx.email >= 0 ? String(row[idx.email] || "").trim() : "";
  const processStatus = idx.processStatus >= 0 ? String(row[idx.processStatus] || "").trim() : "";

  if (!email) {
    throw new Error(`Linha ${rowIndex}: EMAIL não encontrado.`);
  }

  if (normalizeMembersText_(processStatus) !== normalizeMembersText_(SETTINGS.values.sendEmail)) {
    return;
  }

  const inviteDraft = members_buildInviteOutgoingDraft_({
    rowIndex: rowIndex,
    name: name,
    email: email,
    rga: idx.rga >= 0 ? String(row[idx.rga] || "").trim() : ""
  });

  const trackedSend = members_sendTrackedEmail_({
    to: email,
    subject: inviteDraft.subject,
    body: inviteDraft.bodyText,
    htmlBody: inviteDraft.htmlBody,
    newerThanDays: SETTINGS.timeoutDays
  });
  const threadId = String((trackedSend && trackedSend.threadId) || "").trim();

  const now = new Date();

  if (idx.processStatus >= 0) {
    sheet.getRange(rowIndex, idx.processStatus + 1).setValue(SETTINGS.values.emailed);
  }

  if (idx.sentAt >= 0) {
    sheet.getRange(rowIndex, idx.sentAt + 1).setValue(now);
  }

  if (idx.threadId >= 0 && threadId) {
    sheet.getRange(rowIndex, idx.threadId + 1).setValue(threadId);
  }
}

function members_assertInviteRendererCore_() {
  const requiredFns = [
    "coreMailBuildCorrelationKey",
    "coreMailBuildOutgoingDraft"
  ];

  requiredFns.forEach(function(fnName) {
    if (!members_coreHas_(fnName)) {
      throw new Error(
        'O piloto do convite institucional exige GEAPA-CORE com a funcao "' + fnName + '" exportada.'
      );
    }
  });
}

function members_slugCorrelationToken_(value) {
  return members_normalizeTextCompat_(value, {
    removeAccents: true,
    collapseWhitespace: true,
    caseMode: "lower"
  })
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function members_buildInviteCorrelationIdentifier_(ctx) {
  const rgaDigits = members_onlyDigitsCompat_(ctx.rga);
  if (rgaDigits) return rgaDigits;

  const normalizedEmail = members_normalizeEmailCompat_(ctx.email);
  if (normalizedEmail) {
    const emailLocalPart = String(normalizedEmail.split("@")[0] || "").trim();
    const emailToken = members_slugCorrelationToken_(emailLocalPart);
    if (emailToken) return emailToken;
  }

  const nameToken = members_slugCorrelationToken_(ctx.name);
  if (nameToken) return nameToken;

  return "linha-" + String(ctx.rowIndex || "");
}

function members_buildInviteCorrelationKey_(ctx) {
  members_assertInviteRendererCore_();

  const now = new Date();
  const identifier = members_buildInviteCorrelationIdentifier_(ctx);

  return GEAPA_CORE.coreMailBuildCorrelationKey("MEM", {
    businessId: String(now.getFullYear()) + "-" + identifier,
    flowCode: "CNV",
    stage: "CAND"
  });
}

function members_getInviteSubjectHuman_() {
  return "Confirmação de interesse em ingressar no GEAPA";
}

function members_buildInviteOutgoingDraft_(ctx) {
  members_assertInviteRendererCore_();

  const safeName = String(ctx.name || "").trim() || "candidato(a)";
  const correlationKey = members_buildInviteCorrelationKey_(ctx);
  const subjectHuman = members_getInviteSubjectHuman_();

  return GEAPA_CORE.coreMailBuildOutgoingDraft({
    moduleName: "MEMBROS",
    templateKey: "GEAPA_OPERACIONAL",
    correlationKey: correlationKey,
    to: ctx.email,
    cc: "",
    bcc: "",
    subjectHuman: subjectHuman,
    payload: {
      title: subjectHuman,
      subtitle: "Fluxo de ingresso no GEAPA",
      introText:
        "Olá, " + safeName + "!\n\n" +
        "Entramos em contato para confirmar se você deseja ingressar oficialmente no GEAPA.",
      blocks: [
        {
          title: "Como responder",
          text: "Responda este mesmo e-mail com uma das palavras abaixo.",
          items: [
            {
              label: "Para confirmar seu ingresso",
              value: "ACEITO"
            },
            {
              label: "Se não desejar ingressar neste momento",
              value: "RECUSO"
            }
          ]
        },
        {
          title: "Observações",
          text: "Você pode escrever outras informações junto da resposta, se quiser.",
          items: [
            { value: "ACEITO, muito obrigado!" },
            { value: "RECUSO, pois no momento não conseguirei participar." }
          ]
        }
      ],
      footerNote:
        "Assim que sua resposta for processada, daremos continuidade ao procedimento correspondente."
    }
  });
}

/**
 * Monta o email de convite para ingresso.
 *
 * A resposta esperada deve conter:
 * ACEITO
 *
 * @param {string} name
 * @return {string}
 */
function buildMembersInviteEmailHtml_(name) {
  const safeName = escapeMembersHtml_(name || "candidato(a)");

  return `
    <p>Olá, <b>${safeName}</b>!</p>
    <p>Entramos em contato para confirmar se você deseja ingressar oficialmente no GEAPA.</p>
    <p>Se desejar entrar no grupo, responda este email com a palavra:</p>
    <p><b>ACEITO</b></p>
    <p>Se não desejar entrar no grupo neste momento, responda com:</p>
    <p><b>RECUSO</b></p>
    <p>Você pode escrever outras informações junto da resposta, se quiser.</p>
    <p>Exemplos:</p>
    <p><i>ACEITO, muito obrigado!</i><br><i>RECUSO, pois no momento não conseguirei participar.</i></p>
    <p>Assim que sua resposta for processada, daremos continuidade ao procedimento correspondente.</p>
    <p>Atenciosamente,<br>GEAPA</p>
  `;
}

/**
 * Retorna mapa de índices dos cabeçalhos usados no módulo.
 *
 * @param {string[]} headers
 * @return {Object}
 */
function getMembersHeaderIndexMap_(headers) {
  const normalizedMap = members_buildHeaderMap_(headers, { normalize: true, oneBased: false });
  const find = function(aliases) {
    return members_findHeaderIndexByAliases_(normalizedMap, aliases, { notFoundValue: -1 });
  };

  return {
    name: find(members_getHeaderAliases_("future", "name")),
    email: find(members_getHeaderAliases_("future", "email")),
    rga: find(members_getHeaderAliases_("future", "rga")),
    status: find(members_getHeaderAliases_("future", "status")),
    processStatus: find(members_getHeaderAliases_("future", "processStatus")),
    sentAt: find(members_getHeaderAliases_("future", "sentAt")),
    repliedAt: find(members_getHeaderAliases_("future", "repliedAt")),
    notes: find(members_getHeaderAliases_("future", "notes")),
    entrySemester: find(members_getHeaderAliases_("future", "entrySemester")),
    threadId: find(members_getHeaderAliases_("future", "threadId")),
    messageId: find(members_getHeaderAliases_("future", "messageId")),
    integratedAt: find(members_getHeaderAliases_("future", "integratedAt"))
  };
}

/**
 * Normaliza texto para comparação.
 *
 * @param {*} value
 * @return {string}
 */
function normalizeMembersText_(value) {
  return members_normalizeTextCompat_(value, {
    collapseWhitespace: true,
    caseMode: "lower"
  });
}

/**
 * Escapa HTML básico.
 *
 * @param {string} text
 * @return {string}
 */
function escapeMembersHtml_(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
