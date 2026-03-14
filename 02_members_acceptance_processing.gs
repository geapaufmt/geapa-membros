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

  const query = `subject:"${SETTINGS.inviteEmail.subject}" newer_than:30d`;
  const threads = GmailApp.search(query, 0, 100);

  threads.forEach(thread => {
    const msgs = thread.getMessages();
    if (!msgs.length) return;

    const lastMsg = msgs[msgs.length - 1];
    const from = String(lastMsg.getFrom() || "");
    const fromEmail = members_extractEmail_(from);
    if (!fromEmail) return;

    const body = `${lastMsg.getPlainBody() || ""}\n${lastMsg.getBody() || ""}`;
    if (!members_hasAcceptanceText_(body)) return;

    const futureRowIndex = members_findFutureRowByEmail_(futureValues, futureIdx, fromEmail);
    if (futureRowIndex === -1) return;

    const absoluteRow = futureRowIndex + 2;
    const row = futureSheet.getRange(absoluteRow, 1, 1, futureLastCol).getValues()[0];

    const currentProcessStatus = futureIdx.processStatus >= 0
      ? String(row[futureIdx.processStatus] || "").trim()
      : "";

    // evita reintegrar alguém já integrado
    if (normalizeMembersText_(currentProcessStatus) === normalizeMembersText_(SETTINGS.values.integrated)) return;

    const acceptedAt = new Date();
    const entrySemester = members_getEntrySemesterFromAcceptanceDate_(acceptedAt);

    // Atualiza linha em MEMBERS_FUTURO
    if (futureIdx.repliedAt >= 0) {
      futureSheet.getRange(absoluteRow, futureIdx.repliedAt + 1).setValue(acceptedAt);
    }
    if (futureIdx.processStatus >= 0) {
      futureSheet.getRange(absoluteRow, futureIdx.processStatus + 1).setValue(SETTINGS.values.accepted);
    }
    if (futureIdx.entrySemester >= 0) {
      futureSheet.getRange(absoluteRow, futureIdx.entrySemester + 1).setValue(entrySemester);
    }

    // Prepara cópia para MEMBERS_ATUAIS
    const rga = futureIdx.rga >= 0 ? String(row[futureIdx.rga] || "").trim() : "";

    // Se já estiver integrado, não faz nada
    if (normalizeMembersText_(currentProcessStatus) === normalizeMembersText_(SETTINGS.values.integrated)) {
    return;
    }

    // Se o RGA já existir em Membros Atuais, apenas marca corretamente a origem
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

    currentSheet.appendRow(newCurrentRow);

    // Marca origem como integrada
    if (futureIdx.status >= 0) {
      futureSheet.getRange(absoluteRow, futureIdx.status + 1).setValue(SETTINGS.values.active);
    }

    if (futureIdx.processStatus >= 0) {
      futureSheet.getRange(absoluteRow, futureIdx.processStatus + 1).setValue(SETTINGS.values.integrated);
    }

    if (futureIdx.notes >= 0) {
      futureSheet.getRange(absoluteRow, futureIdx.notes + 1).setValue("Membro integrado em Membros Atuais.");
    }

    // Envia email final
    const name = futureIdx.name >= 0 ? String(row[futureIdx.name] || "").trim() : "";
    MailApp.sendEmail({
      to: fromEmail,
      subject: SETTINGS.finalEmail.subject,
      htmlBody: buildMembersFinalEmailHtml_(name, SETTINGS.finalEmail.whatsappGroupLink)
    });
  });
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
  const semesterObj = GEAPA_CORE.coreGetSemesterForDate(acceptanceDate);
  return semesterObj && semesterObj.id ? semesterObj.id : "";
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
function members_hasAcceptanceText_(body) {
  const text = normalizeMembersText_(body);
  return text.includes("aceito");
}

/**
 * Extrai email do campo From.
 *
 * @param {string} from
 * @return {string}
 */
function members_extractEmail_(from) {
  const m = String(from || "").match(/<([^>]+)>/);
  return (m ? m[1] : String(from || "")).trim().toLowerCase();
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