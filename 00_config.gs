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
    diretorias: "VIGENCIA_DIRETORIAS",
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
    expired: "Prazo expirado"
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

  election: Object.freeze({
  chapaKey: "ELEICOES_CHAPAS_INSCRICAO",

  electedEmailSubject: "Chapa eleita - início da transição da diretoria GEAPA",

  statusDeferida: "DEFERIDA",
  statusIndeferida: "INDEFERIDA",
  statusEleita: "ELEITA",

  emailSentYes: "SIM",
  emailSentNo: "NÃO",
  registeredYes: "SIM",
  registeredNo: "NÃO",

  // ~ 3 semestres civis
  maxDiretoriaTotalDays: 548,

  emailApprovedSubject: "Inscrição de chapa deferida - GEAPA",
  emailRejectedSubject: "Inscrição de chapa indeferida - GEAPA",

  chapaHeaders: Object.freeze({
    submittedAt: "Carimbo de data/hora",
    submitterEmail: "Endereço de e-mail",
    presidentName: "Nome do candidato a Presidente",
    presidentRga: "RGA do candidato a Presidente",
    viceName: "Nome do candidato a Vice-Presidente",
    viceRga: "RGA do candidato a Vice-presidente",
    proposal: "Proposta Básica de Gestão",

    presidentStatus: "Status Presidente",
    presidentReasons: "Motivos Presidente",
    viceStatus: "Status Vice",
    viceReasons: "Motivos Vice",
    chapaStatus: "Status da Chapa",
    chapaReasons: "Motivos da Chapa",
    automaticOpinion: "Parecer automático",
    analyzedAt: "Data/Hora da análise",
    finalResult: "Resultado final",
    finalResultAt: "Data/Hora resultado final",
    emailSent: "E-mail resultado enviado?",
    boardRegistered: "Diretoria registrada?",
    internalNote: "Observação da diretoria",
    electedEmailSent: "E-mail chapa eleita enviado?",
    electedEmailSentAt: "Data/Hora e-mail chapa eleita"
  })
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
