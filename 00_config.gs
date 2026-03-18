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

  vigenciaKeys: Object.freeze({
    semestres: "VIGENCIA_SEMESTRES",
    membrosDiretoria: "VIGENCIA_MEMBROS_DIRETORIAS"
  }),

  headers: Object.freeze({
    name: "Nome",
    email: "EMAIL",
    status: "Status",
    processStatus: "Status do processo",
    sentAt: "Data envio convite",
    repliedAt: "Data resposta",
    notes: "Observações do processo",
    entrySemester: "Semestre de entrada",
    threadId: "ThreadId convite",
    messageId: "MessageId resposta",
    integratedAt: "Data integração",
  }),

  histHeaders: Object.freeze({
    finalStatus: "Status final",
    requestAt: "Data de solicitação",
    exitSemester: "Semestre de saída",
    semesterCount: "N° de semestres no grupo",
    approvedAt: "Data de homologação",
    reason: "Motivo",
    wasDirector: "Foi membro da diretoria?",
    internalNote: "Observação interna"
  }),

  values: Object.freeze({
    waiting: "Em Espera",
    sendEmail: "Enviar e-mail",
    emailed: "E-mail enviado",
    accepted: "Aceitou",
    refused: "Recusou",
    integrated: "Integrado",
    active: "Ativo",
    suspended: "Suspenso",
    offboarded: "Desligado",
    disqualified: "Desclassificado",
    expired: "Prazo expirado",
    disqualified: "Desclassificado"
  }),

  offboarding: Object.freeze({
    requestType: "Desligamento",
    immediate: "Imediatamente",
    approved: "DEFERIDO",
    yes: "SIM",
    finalStatus: "Desligado",
    histStatus: "Desligado homologado"
  }),

  seletivo: Object.freeze({
    avaliacaoKey: "SELETIVO_AVALIACAO",
    inscricaoKey: "SELETIVO_INSCRICAO",
    resultadoAprovadoImediato: "Aprovado imediato",
    resultadoAprovadoEspera: "Aprovado em espera",
    processadoHeader: "Processado integração",
    processedAtHeader: "Data integração sistema",
    waitingProcessStatus: "Aguardando vaga",
    waiting: "Em Espera"
  }),

timeoutDays: 7,

  inviteEmail: Object.freeze({
    subject: "Confirmação de interesse em ingressar no GEAPA"
  }),

  finalEmail: Object.freeze({
    subject: "Sua entrada no GEAPA foi confirmada",
    whatsappGroupLink: "https://chat.whatsapp.com/E0mtWYO04jAJqWboob1jDu?mode=gi_t"
  }),

  refusalEmail: Object.freeze({
    subject: "Confirmação de recusa de ingresso no GEAPA"
  }),
  
  timeoutEmail: Object.freeze({
    subject: "Prazo encerrado para ingresso no GEAPA"
  }),
});

function members_assertCore_() {
  if (typeof GEAPA_CORE === "undefined") {
    throw new Error('Library "GEAPA-CORE" não encontrada. Adicione a library com o identificador GEAPA_CORE.');
  }
}