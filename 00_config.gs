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
    membrosDiretoria: "VIGENCIA_MEMBROS_DIRETORIAS",
    assessores: "VIGENCIA_ASSESSORES",
    semestresDiretoria: "VIGENCIA_SEMESTRES_DIRETORIAS",
    conselheiros: "VIGENCIA_CONSELHEIROS",
    cargosConfig: "CARGOS_INSTITUCIONAIS_CONFIG"
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

  lifecycle: Object.freeze({
    eventKey: "MEMBER_EVENTOS_VINCULO",
    dismissalByAbsenceType: "DESLIGAMENTO_POR_FALTAS",
    registeredStatus: "REGISTRADO",
    homologatedStatus: "HOMOLOGADO",
    processedMembersStatus: "PROCESSADO_MEMBROS",
    activitiesModule: "GEAPA_ATIVIDADES",
    membersModule: "GEAPA_MEMBROS",
    notePrefix: "[geapa-membros]"
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

  externalContacts: Object.freeze({
    participantsKey: "PESSOAS_EXTERNAS_BASE",
    professorsKey: "PROFS_BASE",
    yes: "SIM",
    no: "NAO",
    categoryPublicoValues: Object.freeze([
      "MEMBRO_COMUNIDADE_EXTERNA",
      "ESTUDANTE_EXTERNO",
      "PROFISSIONAL_EXTERNO",
      "DOCENTE_EXTERNO",
      "EGRESSO",
      "PARCEIRO_INSTITUCIONAL",
      "OUTRO"
    ]),
    relationGeapaValues: Object.freeze([
      "PARTICIPANTE_EXTERNO_INTERESSADO",
      "PALESTRANTE_POTENCIAL",
      "CONVIDADO_RECURRENTE",
      "PARCEIRO_INSTITUCIONAL",
      "APOIO_EVENTUAL",
      "SEM_RELACAO_DEFINIDA"
    ])
  }),

  election: Object.freeze({
  chapaKey: "ELEICOES_CHAPAS_INSCRICAO",
  processingKey: "ELEICOES_CHAPAS_PROCESSAMENTO",
  courseConfigKey: "CONFIG_GEAPA",
  courseCoordinationEmailField: "EMAIL_CURSO_MAE",

  electedEmailSubject: "Chapa eleita - início da transição da diretoria GEAPA",

  courseNotificationSubject: "Nova chapa eleita do GEAPA - comunicado institucional",
  statusDeferida: "DEFERIDA",
  statusIndeferida: "INDEFERIDA",
  statusEleita: "ELEITA",
  statusNaoEleita: "NÃO ELEITA",
  statusCancelada: "CANCELADA",

  emailSentYes: "SIM",
  emailSentNo: "NÃO",
  registeredYes: "SIM",
  registeredNo: "NÃO",

  // ~ 3 semestres civis
  maxDiretoriaTotalDays: 548,

  emailApprovedSubject: "Inscrição de chapa deferida - GEAPA",
  emailRejectedSubject: "Inscrição de chapa indeferida - GEAPA",
  emailCancelledSubject: "Confirmação de cancelamento de chapa - GEAPA",

  processingHeaders: Object.freeze({
    chapaId: "ID_CHAPA",
    sourceRow: "LINHA_ORIGEM_INSCRICAO",
    targetBoardId: "ID_DIRETORIA_ALVO"
  }),

  chapaHeaderAliases: Object.freeze({
    presidentName: Object.freeze([
      "Nome Completo do candidato a Presidente"
    ]),
    viceName: Object.freeze([
      "Nome Completo do candidato a Vice-Presidente"
    ])
  }),

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
    cancelledAt: "Data/Hora cancelamento",
    cancelledEmailSent: "E-mail cancelamento enviado?",
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
    templateKey: "GEAPA_CLASSICO",
    whatsappGroupLink: "https://chat.whatsapp.com/E0mtWYO04jAJqWboob1jDu?mode=gi_t"
  }),

  refusalEmail: Object.freeze({
    subject: "Confirmação de recusa de ingresso no GEAPA"
  }),
  
  timeoutEmail: Object.freeze({
    subject: "Prazo encerrado para ingresso no GEAPA"
  }),

  governance: Object.freeze({
    forms: Object.freeze({
      nominationFormKey: "DIRETORIA_NOMEACOES_FORM",
      nominationResponsesKey: "DIRETORIA_NOMEACOES_RESPONSES",
      councilorFormKey: "CONSELHEIROS_ADESAO_FORM",
      councilorResponsesKey: "CONSELHEIROS_ADESAO_RESPONSES"
    }),

    folders: Object.freeze({
      administrativoKey: "ADMINISTRATIVO_PASTA",
      transicaoKey: "TRANSICAO_CONSELHEIROS_PASTA"
    }),

    configKeys: Object.freeze({
      mailConfig: "MAIL_CONFIG",
      mailOutbox: "MAIL_SAIDA",
      mailEvents: "MAIL_EVENTOS",
      mailIndex: "MAIL_INDICE",
      communicationsConfig: "COMUNICACOES_CONFIG",
      communicationsLog: "COMUNICACOES_LOG"
    }),

    states: Object.freeze({
      apto: "APTO",
      aptoComLimite: "APTO_COM_LIMITE",
      inelegivel: "INELEGIVEL",
      accepted: "ACEITO",
      refused: "RECUSADO"
    }),

    values: Object.freeze({
      yes: "SIM",
      no: "NAO",
      uniqueYes: "SIM",
      activeYes: "SIM",
      statusAtivo: "ATIVO",
      cargoDestinationHeader: "DESTINO_VIGENCIA",
      cargoGrupoDiretoria: "DIRETORIA",
      cargoGrupoAssessoria: "ASSESSORIA",
      cargoGrupoConselho: "CONSELHO",
      cargoConselheiroNome: "Conselheiro(a) Consultivo(a)",
      destinationDiretoria: "MEMBROS_DIRETORIA",
      destinationAssessoria: "ASSESSORES",
      destinationConselho: "CONSELHEIROS"
    }),

    currentHeaders: Object.freeze({
      countedDays: "QTD_DIAS_QUE_CONTAM_PARA_LIMITE_DIRETORIA",
      limitDays: "LIMITE_DIAS_DIRETORIA",
      balanceDays: "SALDO_DIAS_DIRETORIA",
      eligibilityStatus: "STATUS_ELEGIBILIDADE_DIRETORIA",
      estimatedLimitDate: "DATA_LIMITE_ESTIMADA_DIRETORIA"
    }),

    limits: Object.freeze({
      maxDiretoriaSemesters: 3,
      councilorInvitationLeadDays: 14,
      councilorMinimumRoleMonths: 3
    }),

    email: Object.freeze({
      nominationSubject: "Resultado da analise de nomeacao da diretoria - GEAPA",
      nomineeConfirmedSubject: "Nomeacao confirmada para cargo da diretoria - GEAPA",
      councilorInviteSubject: "Convite para adesao como conselheiro(a) consultivo(a) - GEAPA"
    }),

    properties: Object.freeze({
      nominationPrefix: "GEAPA_MEMBROS_GOV_NOM_",
      councilorInvitePrefix: "GEAPA_MEMBROS_GOV_CONV_",
      councilorResponsePrefix: "GEAPA_MEMBROS_GOV_CONS_"
    })
  })
});

function members_assertCore_() {
  if (typeof GEAPA_CORE === "undefined") {
    throw new Error('Library "GEAPA-CORE" não encontrada. Adicione a library com o identificador GEAPA_CORE.');
  }
  members_ensureCoreCompatibility_();
}
