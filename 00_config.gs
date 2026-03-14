/***************************************
 * 00_config.gs
 *
 * Configurações do módulo GEAPA - Membros.
 *
 * Responsabilidades iniciais:
 * - fluxo de convite de membros em espera
 * - processamento futuro de aceite e integração
 *
 * Dependência:
 * - Library GEAPA-CORE com identificador GEAPA_CORE
 ***************************************/

const SETTINGS = Object.freeze({
  futureKey: "MEMBERS_FUTURO",
  currentKey: "MEMBERS_ATUAIS",
  histKey: "MEMBERS_HIST",

  headers: Object.freeze({
    name: "Nome",
    email: "EMAIL",
    status: "Status",
    processStatus: "Status do processo",
    sentAt: "Data envio convite",
    repliedAt: "Data resposta",
    notes: "Observações do processo",
    entrySemester: "Semestre de entrada"
  }),

  values: Object.freeze({
    waiting: "Em espera",
    sendEmail: "Enviar e-mail",
    emailed: "E-mail enviado",
    accepted: "Aceitou",
    refused: "Recusou",
    integrated: "Integrado",
    active: "Ativo",
    suspended: "Suspenso",
    offboarded: "Desligado"
  }),

  inviteEmail: Object.freeze({
    subject: "Confirmação de interesse em ingressar no GEAPA"
  }),

  finalEmail: Object.freeze({
    subject: "Sua entrada no GEAPA foi confirmada",
    whatsappGroupLink: "https://chat.whatsapp.com/E0mtWYO04jAJqWboob1jDu?mode=gi_t"
  })
});

function members_assertCore_() {
  if (typeof GEAPA_CORE === "undefined") {
    throw new Error('Library "GEAPA-CORE" não encontrada. Adicione a library com o identificador GEAPA_CORE.');
  }
}