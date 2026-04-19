/***************************************
 * 09_members_external_contacts_import.gs
 *
 * Importa respostas do formulario de pessoas externas /
 * contatos academicos para as bases finais do sistema.
 *
 * Regras centrais:
 * - usa a base oficial de eixos via Registry;
 * - roteia docentes para PROFS_BASE;
 * - roteia os demais perfis para PESSOAS_EXTERNAS_BASE;
 * - faz upsert por e-mail principal;
 * - preserva ids e dados preexistentes;
 * - nao depende de listas hardcoded de eixos.
 ***************************************/

const MEMBERS_EXTERNAL_CONTACTS_CFG = Object.freeze({
  headerRow: 1,
  registryKeys: Object.freeze({
    form: "PARTICIPANTES_EXTERNOS_FORM",
    participants: "PESSOAS_EXTERNAS_BASE",
    participantsLegacy: "PARTICIPANTES_EXTERNOS_BASE",
    professors: "PROFS_BASE",
    thematicAxes: "EIXOS_TEMATICOS_OFICIAIS"
  }),
  formSheetNames: Object.freeze([
    "Cadastro de Participantes Externos (respostas)",
    "Cadastro de Participantes Externos (Respostas)",
    "Respostas ao formulario 1",
    "Respostas do formulario 1"
  ]),
  values: Object.freeze({
    yes: "SIM",
    no: "NAO",
    active: "SIM"
  }),
  observationMarker: "IMPORT_FORMULARIO_CONTATOS",
  thematicAxesRequiredHeaders: Object.freeze([
    "ATIVO",
    "ORDEM",
    "CODIGO_EIXO",
    "NUMERAL_ROMANO",
    "NOME_OFICIAL",
    "ROTULO_FORMULARIO"
  ]),
  participantsHeaders: Object.freeze([
    "ID_PARTICIPANTE_EXTERNO",
    "NOME",
    "EMAIL",
    "EMAIL_PREFERENCIAL",
    "TELEFONE",
    "INSTAGRAM",
    "DATA_NASCIMENTO",
    "SEXO",
    "INSTITUICAO",
    "CARGO_OU_ATUACAO",
    "CURSO_OU_AREA",
    "CATEGORIA_PARTICIPANTE",
    "CIDADE",
    "UF",
    "ORIGEM_CONTATO",
    "MOTIVACAO_OU_INTERESSE",
    "RECEBE_COMUNICADOS_GERAIS",
    "RECEBE_REUNIOES_ABERTAS",
    "RECEBE_APRESENTACOES_ALUNOS",
    "RECEBE_EVENTOS_VISITAS",
    "INTERESSE_EIXO_I",
    "INTERESSE_EIXO_II",
    "INTERESSE_EIXO_III",
    "INTERESSE_EIXO_IV",
    "INTERESSE_EIXO_V",
    "INTERESSE_EIXO_VI",
    "INTERESSE_EIXO_VII",
    "INTERESSE_EIXO_VIII",
    "ATIVO",
    "OBSERVACOES",
    "CRIADO_EM",
    "ATUALIZADO_EM"
  ]),
  professorsHeaders: Object.freeze([
    "ID_PROFESSOR",
    "NOME",
    "EMAIL",
    "EMAIL_PREFERENCIAL",
    "TELEFONE",
    "INSTAGRAM",
    "DATA_NASCIMENTO",
    "SEXO",
    "INSTITUICAO",
    "VINCULO_DOCENTE",
    "DISCIPLINAS",
    "TITULACAO",
    "FORMACAO",
    "EIXO_TEMATICO_1",
    "EIXO_TEMATICO_2",
    "CIDADE",
    "UF",
    "ORIGEM_CONTATO",
    "RECEBE_COMUNICADOS_GERAIS",
    "RECEBE_REUNIOES_ABERTAS",
    "RECEBE_APRESENTACOES_ALUNOS",
    "RECEBE_EVENTOS_VISITAS",
    "ATIVO",
    "OBSERVACOES",
    "CRIADO_EM",
    "ATUALIZADO_EM"
  ]),
  commonBaseHeaderAliases: Object.freeze({
    NOME: Object.freeze(["NOME", "Nome", "Professor", "PROFESSOR", "Participante", "PARTICIPANTE"]),
    EMAIL: Object.freeze(["EMAIL", "E-mail", "Email"]),
    EMAIL_PREFERENCIAL: Object.freeze(["EMAIL_PREFERENCIAL", "Email preferencial", "E-mail preferencial"]),
    TELEFONE: Object.freeze(["TELEFONE", "Telefone", "Telefone / WhatsApp"]),
    INSTAGRAM: Object.freeze(["INSTAGRAM", "@ Instagram", "Instagram"]),
    DATA_NASCIMENTO: Object.freeze(["DATA_NASCIMENTO", "Data de nascimento", "Data de Nascimento"]),
    SEXO: Object.freeze(["SEXO", "Sexo"]),
    INSTITUICAO: Object.freeze(["INSTITUICAO", "Instituicao", "Instituicao em que atua como Docente"]),
    CIDADE: Object.freeze(["CIDADE", "Cidade"]),
    UF: Object.freeze(["UF"]),
    ORIGEM_CONTATO: Object.freeze(["ORIGEM_CONTATO", "Origem do contato", "Como conheceu o GEAPA?"]),
    RECEBE_COMUNICADOS_GERAIS: Object.freeze(["RECEBE_COMUNICADOS_GERAIS"]),
    RECEBE_REUNIOES_ABERTAS: Object.freeze(["RECEBE_REUNIOES_ABERTAS"]),
    RECEBE_APRESENTACOES_ALUNOS: Object.freeze(["RECEBE_APRESENTACOES_ALUNOS"]),
    RECEBE_EVENTOS_VISITAS: Object.freeze(["RECEBE_EVENTOS_VISITAS"]),
    ATIVO: Object.freeze(["ATIVO", "Ativo"]),
    OBSERVACOES: Object.freeze(["OBSERVACOES", "Observacoes", "Observacoes gerais"]),
    CRIADO_EM: Object.freeze(["CRIADO_EM", "Criado em"]),
    ATUALIZADO_EM: Object.freeze(["ATUALIZADO_EM", "Atualizado em"])
  }),
  participantsBaseHeaderAliases: Object.freeze({
    ID_PARTICIPANTE_EXTERNO: Object.freeze(["ID_PARTICIPANTE_EXTERNO"]),
    CARGO_OU_ATUACAO: Object.freeze(["CARGO_OU_ATUACAO", "Cargo ou atuacao", "Cargo/Atuacao"]),
    CURSO_OU_AREA: Object.freeze(["CURSO_OU_AREA", "Curso ou area", "Curso/Area"]),
    CATEGORIA_PARTICIPANTE: Object.freeze(["CATEGORIA_PARTICIPANTE", "Categoria participante"]),
    MOTIVACAO_OU_INTERESSE: Object.freeze(["MOTIVACAO_OU_INTERESSE", "Motivacao ou interesse"]),
    INTERESSE_EIXO_I: Object.freeze(["INTERESSE_EIXO_I"]),
    INTERESSE_EIXO_II: Object.freeze(["INTERESSE_EIXO_II"]),
    INTERESSE_EIXO_III: Object.freeze(["INTERESSE_EIXO_III"]),
    INTERESSE_EIXO_IV: Object.freeze(["INTERESSE_EIXO_IV"]),
    INTERESSE_EIXO_V: Object.freeze(["INTERESSE_EIXO_V"]),
    INTERESSE_EIXO_VI: Object.freeze(["INTERESSE_EIXO_VI"]),
    INTERESSE_EIXO_VII: Object.freeze(["INTERESSE_EIXO_VII"]),
    INTERESSE_EIXO_VIII: Object.freeze(["INTERESSE_EIXO_VIII"])
  }),
  professorsBaseHeaderAliases: Object.freeze({
    ID_PROFESSOR: Object.freeze(["ID_PROFESSOR"]),
    VINCULO_DOCENTE: Object.freeze(["VINCULO_DOCENTE", "Vinculo docente", "Qual e seu vinculo docente principal?"]),
    DISCIPLINAS: Object.freeze(["DISCIPLINAS", "Disciplinas"]),
    TITULACAO: Object.freeze(["TITULACAO", "Titulacao"]),
    FORMACAO: Object.freeze(["FORMACAO", "Formacao"]),
    EIXO_TEMATICO_1: Object.freeze(["EIXO_TEMATICO_1", "Eixo tematico 1", "Eixo tematico principal", "Eixo tematico principal de interesse ou atuacao"]),
    EIXO_TEMATICO_2: Object.freeze(["EIXO_TEMATICO_2", "Eixo tematico 2", "Eixo tematico secundario", "Eixo tematico secundario de interesse ou atuacao"])
  }),
  formFields: Object.freeze({
    submittedAt: Object.freeze(["Carimbo de data/hora"]),
    accountEmail: Object.freeze(["Endereco de e-mail", "Endereço de e-mail"]),
    fullName: Object.freeze(["Nome Completo"]),
    preferredEmail: Object.freeze(["E-mail preferencial", "Email preferencial"]),
    phone: Object.freeze(["Telefone / WhatsApp", "Telefone/WhatsApp"]),
    instagram: Object.freeze(["@ Instagram, se houver", "Instagram, se houver"]),
    birthDate: Object.freeze(["Data de Nascimento", "Data de nascimento"]),
    sex: Object.freeze(["Sexo"]),
    geapaProfile: Object.freeze(["Qual e o seu perfil em relacao ao GEAPA?", "Qual é o seu perfil em relação ao GEAPA?"]),
    city: Object.freeze(["Cidade"]),
    uf: Object.freeze(["UF"]),
    sourceContact: Object.freeze(["Como conheceu o GEAPA?"]),
    professorInstitution: Object.freeze(["Instituicao em que atua como Docente", "Instituição em que atua como Docente"]),
    professorBond: Object.freeze(["Qual e seu vinculo docente principal?", "Qual é seu vínculo docente principal?"]),
    professorDisciplines: Object.freeze(["Disciplinas que leciona ou com as quais possui maior vinculo", "Disciplinas que leciona ou com as quais possui maior vínculo"]),
    professorDegree: Object.freeze(["Titulacao (ex: Doutorado em Fitotecnia)", "Titulação (ex: Doutorado em Fitotecnia)"]),
    professorFormation: Object.freeze(["Formacao principal (ex: Agronomia)", "Formação principal (ex: Agronomia)"]),
    professorAxis1: Object.freeze(["Eixo tematico principal de interesse ou atuacao", "Eixo temático principal de interesse ou atuação"]),
    professorAxis2: Object.freeze(["Eixo tematico secundario de interesse ou atuacao", "Eixo temático secundário de interesse ou atuação"]),
    participantOption: Object.freeze(["Qual opcao melhor descreve voce?", "Qual opção melhor descreve você?"]),
    participantInstitution: Object.freeze(["Empresa, instituicao, orgao, laboratorio ou propriedade com que voce esta vinculado(a)", "Empresa, instituição, órgão, laboratório ou propriedade com que você está vinculado(a)"]),
    participantRole: Object.freeze(["Se possivel, descreva brevemente seu cargo, funcao ou area de atuacao profissional, tecnica ou produtiva.", "Se possível, descreva brevemente seu cargo, função ou área de atuação profissional, técnica ou produtiva."]),
    participantRelation: Object.freeze(["Como voce se identifica em relacao ao GEAPA?", "Como você se identifica em relação ao GEAPA?"]),
    participantCourseArea: Object.freeze(["Curso, instituicao, area de formacao, interesse ou atuacao:", "Curso, instituição, área de formação, interesse ou atuação:"]),
    participantWhy: Object.freeze(["O que te trouxe aqui?"]),
    participantAcademicBond: Object.freeze(["Como voce descreveria seu vinculo com o meio academico, tecnico ou com o GEAPA?", "Como você descreveria seu vínculo com o meio acadêmico, técnico ou com o GEAPA?"]),
    participantAreaInterest: Object.freeze(["Area de atuacao, interesse ou formacao", "Área de atuação, interesse ou formação"]),
    participantAxesInterest: Object.freeze(["Quais eixos tematicos te interessam?", "Quais eixos temáticos te interessam?"]),
    receiveGeneral: Object.freeze(["Deseja receber comunicados gerais do GEAPA?"]),
    receiveMeetings: Object.freeze(["Deseja receber convites para reunioes abertas?", "Deseja receber convites para reuniões abertas?"]),
    receivePresentations: Object.freeze(["Deseja receber avisos sobre apresentacoes de alunos?", "Deseja receber avisos sobre apresentações de alunos?"]),
    receiveEvents: Object.freeze(["Deseja receber convites para palestras, eventos, visitas e outras atividades?"]),
    authorizeStorage: Object.freeze(["Autoriza o GEAPA a armazenar seus dados para fins de organizacao de contatos, envio de comunicados, convites para atividades e registro interno?", "Autoriza o GEAPA a armazenar seus dados para fins de organização de contatos, envio de comunicados, convites para atividades e registro interno?"]),
    authorizeMessages: Object.freeze(["Autoriza receber mensagens e comunicacoes do GEAPA pelos canais informados?", "Autoriza receber mensagens e comunicações do GEAPA pelos canais informados?"]),
    generalNotes: Object.freeze(["Observacoes gerais", "Observações gerais"])
  }),
  docenteProfileTokens: Object.freeze(["docente", "professor", "professora"]),
  docenteFieldKeys: Object.freeze([
    "professorInstitution",
    "professorBond",
    "professorDisciplines",
    "professorDegree",
    "professorFormation",
    "professorAxis1",
    "professorAxis2"
  ]),
  idConfig: Object.freeze({
    professors: Object.freeze({
      header: "ID_PROFESSOR",
      prefix: "PROF-",
      padLength: 4
    }),
    participants: Object.freeze({
      header: "ID_PARTICIPANTE_EXTERNO",
      prefix: "EXT-",
      padLength: 4
    })
  }),
  defaultDateNumberFormat: "dd/MM/yyyy"
});

var MEMBERS_EXTERNAL_CONTACTS_RUNTIME = {
  registry: null,
  thematicAxes: null
};

function members_importExternalContactsFromForm(opts) {
  members_assertCore_();
  opts = opts || {};

  var lock = opts.skipLock === true ? null : LockService.getScriptLock();
  if (lock) lock.waitLock(30000);

  try {
    if (opts.resetCache === true) {
      members_externalContactsResetRuntimeCache_();
    }

    var prepared = opts.skipPrepare === true
      ? null
      : members_prepareExternalContactsBases();
    var axes = members_externalContactsLoadActiveAxes_();
    var formSheet = members_externalContactsGetFormSheet_();
    var formRecords = members_readSheetRecordsCompat_(formSheet, {
      headerRow: MEMBERS_EXTERNAL_CONTACTS_CFG.headerRow,
      startRow: MEMBERS_EXTERNAL_CONTACTS_CFG.headerRow + 1
    });
    var professorState = members_externalContactsCreateEntityState_("professors");
    var participantState = members_externalContactsCreateEntityState_("participants");

    var result = {
      ok: true,
      prepared: prepared,
      sourceSheet: formSheet.getName(),
      sourceRowCount: formRecords.length,
      axesCount: axes.length,
      processedCount: 0,
      professors: { created: 0, updated: 0, unchanged: 0 },
      participants: { created: 0, updated: 0, unchanged: 0 },
      skipped: [],
      errors: []
    };

    formRecords.forEach(function(record) {
      try {
        var emailInfo = members_externalContactsResolveMainEmail_(record);
        if (!emailInfo.principalEmail) {
          result.skipped.push({
            rowNumber: record.__rowNumber,
            reason: "email_principal_ausente"
          });
          return;
        }

        var isProfessor = members_externalContactsIsProfessorRecord_(record);
        var payloadInfo = isProfessor
          ? members_externalContactsBuildProfessorPayload_(record, emailInfo)
          : members_externalContactsBuildParticipantPayload_(record, emailInfo);
        var state = isProfessor ? professorState : participantState;
        var entityKey = isProfessor ? "professors" : "participants";
        var upsert = members_externalContactsUpsertByEmail_(state, payloadInfo.payload, {
          entityType: entityKey,
          emailInfo: emailInfo,
          managedObservation: payloadInfo.managedObservation,
          sourceRowNumber: record.__rowNumber
        });

        result.processedCount += 1;
        result[entityKey][upsert.action] += 1;
      } catch (rowErr) {
        result.errors.push({
          rowNumber: record.__rowNumber,
          message: rowErr && rowErr.message ? rowErr.message : String(rowErr)
        });
      }
    });

    result.ok = result.errors.length === 0;
    return result;
  } finally {
    if (lock) lock.releaseLock();
  }
}

function members_prepareExternalContactsBases(opts) {
  members_assertCore_();
  opts = opts || {};

  var lock = opts.skipLock === true ? null : LockService.getScriptLock();
  if (lock) lock.waitLock(30000);

  try {
    var professorsSheet = members_externalContactsGetProfessorsSheet_();
    var participantsSheet = members_externalContactsGetParticipantsSheet_();

    return {
      ok: true,
      professors: members_externalContactsEnsureHeadersInSheet_(
        professorsSheet,
        MEMBERS_EXTERNAL_CONTACTS_CFG.professorsHeaders,
        members_externalContactsGetBaseAliasMap_("professors")
      ),
      participants: members_externalContactsEnsureHeadersInSheet_(
        participantsSheet,
        MEMBERS_EXTERNAL_CONTACTS_CFG.participantsHeaders,
        members_externalContactsGetBaseAliasMap_("participants")
      )
    };
  } finally {
    if (lock) lock.releaseLock();
  }
}

function members_syncProfessorAxesWithOfficialSheet() {
  members_assertCore_();

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    members_externalContactsEnsureHeadersInSheet_(
      members_externalContactsGetProfessorsSheet_(),
      MEMBERS_EXTERNAL_CONTACTS_CFG.professorsHeaders,
      members_externalContactsGetBaseAliasMap_("professors")
    );

    var sheet = members_externalContactsGetProfessorsSheet_();
    var headers = members_externalContactsGetSheetHeaders_(sheet);
    var headerMap = members_buildHeaderMapCompat_(headers, {
      normalize: true,
      oneBased: false
    });
    var records = members_readSheetRecordsCompat_(sheet, {
      headerRow: MEMBERS_EXTERNAL_CONTACTS_CFG.headerRow,
      startRow: MEMBERS_EXTERNAL_CONTACTS_CFG.headerRow + 1
    });
    var updated = [];

    records.forEach(function(record) {
      var axis1 = members_externalContactsInterpretAxis_(
        members_externalContactsGetRecordValue_(record, ["EIXO_TEMATICO_1"])
      );
      var axis2 = members_externalContactsInterpretAxis_(
        members_externalContactsGetRecordValue_(record, ["EIXO_TEMATICO_2"])
      );

      if (axis1 && axis2 && members_externalContactsSameValue_(axis1, axis2)) {
        axis2 = "";
      }

      var changed = false;

      if (!members_externalContactsSameValue_(record.EIXO_TEMATICO_1, axis1)) {
        members_externalContactsWriteValueToAliasFamily_(
          sheet,
          record.__rowNumber,
          headers,
          headerMap,
          "professors",
          "EIXO_TEMATICO_1",
          axis1
        );
        changed = true;
      }

      if (!members_externalContactsSameValue_(record.EIXO_TEMATICO_2, axis2)) {
        members_externalContactsWriteValueToAliasFamily_(
          sheet,
          record.__rowNumber,
          headers,
          headerMap,
          "professors",
          "EIXO_TEMATICO_2",
          axis2
        );
        changed = true;
      }

      if (changed) {
        members_externalContactsWriteRowValue_(sheet, record.__rowNumber, headerMap, "ATUALIZADO_EM", new Date());
        updated.push({
          rowNumber: record.__rowNumber,
          axis1: axis1,
          axis2: axis2
        });
      }
    });

    return {
      ok: true,
      updatedCount: updated.length,
      updated: updated
    };
  } finally {
    lock.releaseLock();
  }
}

function members_diagnoseExternalContactsSetup() {
  members_assertCore_();

  var professorsSheet = members_externalContactsGetProfessorsSheet_();
  var participantsSheet = members_externalContactsGetParticipantsSheet_();
  var formSheet = members_externalContactsGetFormSheet_();
  var axesSheet = members_sheetByKey_(MEMBERS_EXTERNAL_CONTACTS_CFG.registryKeys.thematicAxes);

  return {
    ok: true,
    form: {
      key: MEMBERS_EXTERNAL_CONTACTS_CFG.registryKeys.form,
      sheetName: formSheet.getName(),
      totalRows: Math.max(formSheet.getLastRow() - 1, 0)
    },
    professors: members_externalContactsDiagnoseSheet_(
      professorsSheet,
      MEMBERS_EXTERNAL_CONTACTS_CFG.professorsHeaders,
      members_externalContactsGetBaseAliasMap_("professors")
    ),
    participants: members_externalContactsDiagnoseSheet_(
      participantsSheet,
      MEMBERS_EXTERNAL_CONTACTS_CFG.participantsHeaders,
      members_externalContactsGetBaseAliasMap_("participants")
    ),
    thematicAxes: {
      key: MEMBERS_EXTERNAL_CONTACTS_CFG.registryKeys.thematicAxes,
      sheetName: axesSheet.getName(),
      activeCount: members_externalContactsLoadActiveAxes_().length
    }
  };
}

function members_testExternalContactsImport() {
  return {
    ok: true,
    diagnosisBefore: members_diagnoseExternalContactsSetup(),
    prepared: members_prepareExternalContactsBases(),
    professorAxesSync: members_syncProfessorAxesWithOfficialSheet(),
    importResult: members_importExternalContactsFromForm({ skipPrepare: true })
  };
}

function members_normalizeExternalContactsBirthDatesInBase() {
  members_assertCore_();

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var state = members_externalContactsCreateEntityState_("participants");
    var updated = [];

    state.records.forEach(function(record) {
      var info = members_externalContactsNormalizeBirthDateValue_(record.DATA_NASCIMENTO);
      if (!info.ok || !info.date) return;
      if (members_externalContactsValuesEqual_(record.DATA_NASCIMENTO, info.date)) return;

      members_externalContactsApplyBirthDatePresentationToRow_(state, record.__rowNumber, {
        DATA_NASCIMENTO: info.date
      });
      members_externalContactsWriteRowValue_(state.sheet, record.__rowNumber, state.headerMap, "ATUALIZADO_EM", new Date());
      updated.push(record.__rowNumber);
    });

    return {
      ok: true,
      updatedCount: updated.length,
      updatedRows: updated
    };
  } finally {
    lock.releaseLock();
  }
}

function members_applyExternalContactsHyperlinksToBase() {
  members_assertCore_();

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var state = members_externalContactsCreateEntityState_("participants");

    state.records.forEach(function(record) {
      members_externalContactsApplyContactLinksToRow_(state, record.__rowNumber, record);
    });

    return {
      ok: true,
      processedCount: state.records.length
    };
  } finally {
    lock.releaseLock();
  }
}

function members_backfillExternalContactsBase() {
  members_assertCore_();

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var prepared = members_prepareExternalContactsBases({ skipLock: true });
    var importResult = members_importExternalContactsFromForm({
      skipPrepare: true,
      skipLock: true
    });
    var state = members_externalContactsCreateEntityState_("participants");
    var touched = [];

    state.records.forEach(function(record) {
      var originalEmail = record.EMAIL;
      var originalEmailPreferencial = record.EMAIL_PREFERENCIAL;
      var originalCargo = record.CARGO_OU_ATUACAO;
      var originalBirth = record.DATA_NASCIMENTO;
      var normalizedEmails = members_externalContactsNormalizeExistingEmailFields_(record);

      if (!members_externalContactsValuesEqual_(record.EMAIL, normalizedEmails.EMAIL)) {
        members_externalContactsWriteRowValue_(
          state.sheet,
          record.__rowNumber,
          state.headerMap,
          "EMAIL",
          normalizedEmails.EMAIL
        );
        record.EMAIL = normalizedEmails.EMAIL;
      }

      if (!members_externalContactsValuesEqual_(record.EMAIL_PREFERENCIAL, normalizedEmails.EMAIL_PREFERENCIAL)) {
        members_externalContactsWriteRowValue_(
          state.sheet,
          record.__rowNumber,
          state.headerMap,
          "EMAIL_PREFERENCIAL",
          normalizedEmails.EMAIL_PREFERENCIAL
        );
        record.EMAIL_PREFERENCIAL = normalizedEmails.EMAIL_PREFERENCIAL;
      }

      if (!String(record.CARGO_OU_ATUACAO || "").trim()) {
        var fallbackCargo = members_externalContactsExtractCargoFromObservation_(record.OBSERVACOES);
        if (fallbackCargo) {
          members_externalContactsWriteRowValue_(
            state.sheet,
            record.__rowNumber,
            state.headerMap,
            "CARGO_OU_ATUACAO",
            fallbackCargo
          );
          record.CARGO_OU_ATUACAO = fallbackCargo;
        }
      }

      members_externalContactsApplyBirthDatePresentationToRow_(state, record.__rowNumber, record);
      members_externalContactsApplyContactLinksToRow_(state, record.__rowNumber, record);

      if (
        !members_externalContactsValuesEqual_(originalEmail, record.EMAIL) ||
        !members_externalContactsValuesEqual_(originalEmailPreferencial, record.EMAIL_PREFERENCIAL) ||
        !members_externalContactsValuesEqual_(originalCargo, record.CARGO_OU_ATUACAO) ||
        !members_externalContactsValuesEqual_(originalBirth, record.DATA_NASCIMENTO)
      ) {
        members_externalContactsWriteRowValue_(state.sheet, record.__rowNumber, state.headerMap, "ATUALIZADO_EM", new Date());
        touched.push(record.__rowNumber);
      }
    });

    return {
      ok: true,
      prepared: prepared,
      importResult: importResult,
      touchedCount: touched.length,
      touchedRows: touched
    };
  } finally {
    lock.releaseLock();
  }
}

function members_installExternalContactsImportTrigger() {
  members_assertCore_();

  var handler = "members_importExternalContactsFromForm";
  var existing = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === handler;
  });

  if (existing.length) {
    return {
      ok: true,
      created: false,
      existing: existing.length
    };
  }

  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyHours(6)
    .create();

  return {
    ok: true,
    created: true,
    handler: handler,
    cadence: "everyHours(6)"
  };
}

function members_uninstallExternalContactsImportTrigger() {
  var removed = 0;

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "members_importExternalContactsFromForm") {
      ScriptApp.deleteTrigger(trigger);
      removed += 1;
    }
  });

  return {
    ok: true,
    removed: removed
  };
}

function members_externalContactsResetRuntimeCache_() {
  MEMBERS_EXTERNAL_CONTACTS_RUNTIME.registry = null;
  MEMBERS_EXTERNAL_CONTACTS_RUNTIME.thematicAxes = null;
}

function members_externalContactsGetProfessorsSheet_() {
  return members_sheetByKey_(MEMBERS_EXTERNAL_CONTACTS_CFG.registryKeys.professors);
}

function members_externalContactsGetParticipantsSheet_() {
  try {
    return members_sheetByKey_(MEMBERS_EXTERNAL_CONTACTS_CFG.registryKeys.participants);
  } catch (err) {
    return members_sheetByKey_(MEMBERS_EXTERNAL_CONTACTS_CFG.registryKeys.participantsLegacy);
  }
}

function members_externalContactsGetFormSheet_() {
  try {
    return members_sheetByKey_(MEMBERS_EXTERNAL_CONTACTS_CFG.registryKeys.form);
  } catch (err) {
    var entry = members_externalContactsFindRegistryEntryBySheetNames_(
      MEMBERS_EXTERNAL_CONTACTS_CFG.formSheetNames
    );
    if (!entry) {
      throw new Error(
        "Nao foi possivel localizar a planilha bruta do formulario. " +
        'Cadastre a KEY "' + MEMBERS_EXTERNAL_CONTACTS_CFG.registryKeys.form + '" no Registry.'
      );
    }

    var ss = GEAPA_CORE.coreOpenSpreadsheetById(entry.id);
    var sheet = ss.getSheetByName(entry.sheet);
    if (sheet) return sheet;

    for (var i = 0; i < MEMBERS_EXTERNAL_CONTACTS_CFG.formSheetNames.length; i++) {
      sheet = ss.getSheetByName(MEMBERS_EXTERNAL_CONTACTS_CFG.formSheetNames[i]);
      if (sheet) return sheet;
    }

    throw err;
  }
}

function members_externalContactsGetRegistryEntries_() {
  if (MEMBERS_EXTERNAL_CONTACTS_RUNTIME.registry) {
    return MEMBERS_EXTERNAL_CONTACTS_RUNTIME.registry.slice();
  }

  var raw = GEAPA_CORE.coreGetRegistry() || {};
  var entries = Object.keys(raw).map(function(key) {
    return Object.freeze({
      key: key,
      id: raw[key].id,
      sheet: raw[key].sheet
    });
  });

  MEMBERS_EXTERNAL_CONTACTS_RUNTIME.registry = entries.slice();
  return entries;
}

function members_externalContactsFindRegistryEntryBySheetNames_(sheetNames) {
  var wanted = (Array.isArray(sheetNames) ? sheetNames : [sheetNames]).map(function(name) {
    return members_externalContactsNormalizeCompare_(name);
  }).filter(function(name) {
    return !!name;
  });
  var entries = members_externalContactsGetRegistryEntries_();

  for (var i = 0; i < entries.length; i++) {
    if (wanted.indexOf(members_externalContactsNormalizeCompare_(entries[i].sheet)) >= 0) {
      return entries[i];
    }
  }

  return null;
}

function members_externalContactsLoadActiveAxes_() {
  if (MEMBERS_EXTERNAL_CONTACTS_RUNTIME.thematicAxes) {
    return MEMBERS_EXTERNAL_CONTACTS_RUNTIME.thematicAxes.slice();
  }

  var sheet = members_sheetByKey_(MEMBERS_EXTERNAL_CONTACTS_CFG.registryKeys.thematicAxes);
  var headers = members_externalContactsGetSheetHeaders_(sheet);
  var headerMap = members_buildHeaderMapCompat_(headers, {
    normalize: true,
    oneBased: false
  });
  var missing = MEMBERS_EXTERNAL_CONTACTS_CFG.thematicAxesRequiredHeaders.filter(function(header) {
    return members_findHeaderIndexByAliases_(headerMap, [header], { notFoundValue: -1 }) < 0;
  });

  if (missing.length) {
    throw new Error(
      "Base oficial de eixos sem cabecalhos obrigatorios: " + missing.join(", ")
    );
  }

  var records = members_readRecordsByKey_(MEMBERS_EXTERNAL_CONTACTS_CFG.registryKeys.thematicAxes, {
    headerRow: MEMBERS_EXTERNAL_CONTACTS_CFG.headerRow,
    startRow: MEMBERS_EXTERNAL_CONTACTS_CFG.headerRow + 1
  });

  var axes = records.filter(function(record) {
    return members_externalContactsIsYes_(record.ATIVO);
  }).map(function(record) {
    var canonical = members_externalContactsBuildAxisCanonicalLabel_(record);
    return Object.freeze({
      order: Number(record.ORDEM || 0),
      code: String(record.CODIGO_EIXO || "").trim().toUpperCase(),
      roman: String(record.NUMERAL_ROMANO || "").trim().toUpperCase(),
      officialName: String(record.NOME_OFICIAL || "").trim(),
      formLabel: String(record.ROTULO_FORMULARIO || "").trim(),
      canonical: canonical,
      aliases: members_externalContactsBuildAxisAliases_(record, canonical),
      raw: record
    });
  }).filter(function(item) {
    return !!(item.order && item.roman && item.officialName && item.canonical);
  }).sort(function(a, b) {
    return a.order - b.order;
  });

  if (!axes.length) {
    throw new Error(
      "Nenhum eixo tematico ativo foi encontrado em " +
      MEMBERS_EXTERNAL_CONTACTS_CFG.registryKeys.thematicAxes + "."
    );
  }

  MEMBERS_EXTERNAL_CONTACTS_RUNTIME.thematicAxes = axes.slice();
  return axes.slice();
}

function members_externalContactsBuildAxisCanonicalLabel_(record) {
  var formLabel = String(record.ROTULO_FORMULARIO || "").trim();
  if (formLabel) return formLabel;

  var roman = String(record.NUMERAL_ROMANO || "").trim().toUpperCase();
  var name = String(record.NOME_OFICIAL || "").trim();

  if (roman && name) return roman + " - " + name;
  return name || roman;
}

function members_externalContactsBuildAxisAliases_(record, canonical) {
  var aliases = [];

  function add(value) {
    var text = String(value || "").trim();
    if (!text) return;
    aliases.push(text);
  }

  var order = String(record.ORDEM || "").trim();
  var roman = String(record.NUMERAL_ROMANO || "").trim().toUpperCase();
  var officialName = String(record.NOME_OFICIAL || "").trim();
  var code = String(record.CODIGO_EIXO || "").trim().toUpperCase();

  add(canonical);
  add(record.ROTULO_FORMULARIO);
  add(officialName);
  add(roman);
  add(order);
  add(code);
  add(code.replace(/_/g, " "));
  add(code.replace(/_/g, ""));
  add(roman && officialName ? (roman + " - " + officialName) : "");
  add(order && officialName ? (order + " - " + officialName) : "");

  return aliases.filter(function(alias, index, list) {
    var normalized = members_externalContactsNormalizeCompare_(alias);
    if (!normalized) return false;

    return list.findIndex(function(candidate) {
      return members_externalContactsNormalizeCompare_(candidate) === normalized;
    }) === index;
  });
}

function members_externalContactsInterpretAxis_(raw) {
  var text = members_externalContactsNormalizeCompare_(raw);
  if (!text) return "";

  var axes = members_externalContactsLoadActiveAxes_();
  for (var i = 0; i < axes.length; i++) {
    var axis = axes[i];
    if (text === members_externalContactsNormalizeCompare_(axis.canonical)) {
      return axis.canonical;
    }

    for (var j = 0; j < axis.aliases.length; j++) {
      if (text === members_externalContactsNormalizeCompare_(axis.aliases[j])) {
        return axis.canonical;
      }
    }

    if (
      text.length >= 5 &&
      members_externalContactsNormalizeCompare_(axis.canonical).indexOf(text) >= 0
    ) {
      return axis.canonical;
    }
  }

  return String(raw || "").trim();
}

function members_externalContactsMapAxisInterestFlags_(raw) {
  var flags = {};

  MEMBERS_EXTERNAL_CONTACTS_CFG.participantsHeaders.forEach(function(header) {
    if (header.indexOf("INTERESSE_EIXO_") === 0) {
      flags[header] = MEMBERS_EXTERNAL_CONTACTS_CFG.values.no;
    }
  });

  var text = members_externalContactsNormalizeCompare_(raw);
  if (!text) return flags;

  if (members_externalContactsRawTextMeansAllAxes_(text)) {
    Object.keys(flags).forEach(function(header) {
      flags[header] = MEMBERS_EXTERNAL_CONTACTS_CFG.values.yes;
    });
    return flags;
  }

  members_externalContactsLoadActiveAxes_().forEach(function(axis) {
    var header = "INTERESSE_EIXO_" + axis.roman;
    if (!Object.prototype.hasOwnProperty.call(flags, header)) return;
    if (members_externalContactsRawTextMatchesAxis_(text, axis)) {
      flags[header] = MEMBERS_EXTERNAL_CONTACTS_CFG.values.yes;
    }
  });

  return flags;
}

function members_externalContactsRawTextMeansAllAxes_(normalizedText) {
  if (!normalizedText) return false;
  return /(^|[^a-z0-9])tod(?:o|os|a|as)([^a-z0-9]|$)/.test(normalizedText);
}

function members_externalContactsRawTextMatchesAxis_(normalizedText, axis) {
  if (!normalizedText) return false;

  for (var i = 0; i < axis.aliases.length; i++) {
    var alias = members_externalContactsNormalizeCompare_(axis.aliases[i]);
    if (!alias) continue;

    if (alias.length <= 3) {
      var tokenPattern = new RegExp("(^|[^a-z0-9])" + alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)");
      if (tokenPattern.test(normalizedText)) return true;
      continue;
    }

    if (normalizedText.indexOf(alias) >= 0) return true;
  }

  return false;
}

function members_externalContactsCreateEntityState_(entityType) {
  var sheet = entityType === "professors"
    ? members_externalContactsGetProfessorsSheet_()
    : members_externalContactsGetParticipantsSheet_();
  var expectedHeaders = entityType === "professors"
    ? MEMBERS_EXTERNAL_CONTACTS_CFG.professorsHeaders
    : MEMBERS_EXTERNAL_CONTACTS_CFG.participantsHeaders;

  members_externalContactsEnsureHeadersInSheet_(
    sheet,
    expectedHeaders,
    members_externalContactsGetBaseAliasMap_(entityType)
  );

  var headers = members_externalContactsGetSheetHeaders_(sheet);
  var records = members_readSheetRecordsCompat_(sheet, {
    headerRow: MEMBERS_EXTERNAL_CONTACTS_CFG.headerRow,
    startRow: MEMBERS_EXTERNAL_CONTACTS_CFG.headerRow + 1
  });

  return {
    entityType: entityType,
    sheet: sheet,
    headers: headers,
    headerMap: members_buildHeaderMapCompat_(headers, {
      normalize: true,
      oneBased: false
    }),
    records: records,
    emailIndex: members_externalContactsBuildEmailIndex_(records)
  };
}

function members_externalContactsBuildEmailIndex_(records) {
  var index = Object.create(null);

  (records || []).forEach(function(record) {
    var emails = members_externalContactsUniqueEmails_([
      record.EMAIL,
      record.EMAIL_PREFERENCIAL,
      members_externalContactsExtractFormsEmailFromObservation_(record.OBSERVACOES)
    ]);

    emails.forEach(function(email) {
      index[email] = record;
    });
  });

  return index;
}

function members_externalContactsResolveMainEmail_(record) {
  var preferred = members_externalContactsNormalizeEmail_(
    members_externalContactsGetFormValue_(record, "preferredEmail")
  );
  var account = members_externalContactsNormalizeEmail_(
    members_externalContactsGetFormValue_(record, "accountEmail")
  );
  var normalizedPreferred = preferred && preferred !== account ? preferred : "";
  var principal = normalizedPreferred || account;

  return {
    preferredEmail: normalizedPreferred,
    accountEmail: account,
    principalEmail: principal,
    lookupEmails: members_externalContactsUniqueEmails_([
      principal,
      normalizedPreferred,
      account
    ])
  };
}

function members_externalContactsBuildCommonPayload_(record, emailInfo) {
  var receiveGeneral = members_externalContactsNormalizeYesNo_(
    members_externalContactsGetFormValue_(record, "receiveGeneral")
  );
  var receiveMeetings = members_externalContactsNormalizeYesNo_(
    members_externalContactsGetFormValue_(record, "receiveMeetings")
  );
  var receivePresentations = members_externalContactsNormalizeYesNo_(
    members_externalContactsGetFormValue_(record, "receivePresentations")
  );
  var receiveEvents = members_externalContactsNormalizeYesNo_(
    members_externalContactsGetFormValue_(record, "receiveEvents")
  );
  var authorizeMessages = members_externalContactsNormalizeYesNo_(
    members_externalContactsGetFormValue_(record, "authorizeMessages")
  );

  if (authorizeMessages === MEMBERS_EXTERNAL_CONTACTS_CFG.values.no) {
    receiveGeneral = MEMBERS_EXTERNAL_CONTACTS_CFG.values.no;
    receiveMeetings = MEMBERS_EXTERNAL_CONTACTS_CFG.values.no;
    receivePresentations = MEMBERS_EXTERNAL_CONTACTS_CFG.values.no;
    receiveEvents = MEMBERS_EXTERNAL_CONTACTS_CFG.values.no;
  }

  return {
    payload: {
      NOME: members_externalContactsGetFormValue_(record, "fullName"),
      EMAIL: emailInfo.principalEmail,
      EMAIL_PREFERENCIAL: emailInfo.preferredEmail,
      TELEFONE: members_externalContactsGetFormValue_(record, "phone"),
      INSTAGRAM: members_externalContactsNormalizeInstagram_(members_externalContactsGetFormValue_(record, "instagram")),
      DATA_NASCIMENTO: members_externalContactsNormalizeBirthDateValue_(
        members_externalContactsGetFormValue_(record, "birthDate")
      ).value,
      SEXO: members_externalContactsGetFormValue_(record, "sex"),
      CIDADE: members_externalContactsGetFormValue_(record, "city"),
      UF: members_externalContactsGetFormValue_(record, "uf"),
      ORIGEM_CONTATO: members_externalContactsGetFormValue_(record, "sourceContact"),
      RECEBE_COMUNICADOS_GERAIS: receiveGeneral,
      RECEBE_REUNIOES_ABERTAS: receiveMeetings,
      RECEBE_APRESENTACOES_ALUNOS: receivePresentations,
      RECEBE_EVENTOS_VISITAS: receiveEvents
    },
    authorizeMessages: authorizeMessages,
    authorizeStorage: members_externalContactsNormalizeYesNo_(
      members_externalContactsGetFormValue_(record, "authorizeStorage")
    )
  };
}

function members_externalContactsBuildProfessorPayload_(record, emailInfo) {
  var common = members_externalContactsBuildCommonPayload_(record, emailInfo);
  var birthDateInfo = members_externalContactsNormalizeBirthDateValue_(
    members_externalContactsGetFormValue_(record, "birthDate")
  );
  var axis1 = members_externalContactsInterpretAxis_(
    members_externalContactsGetFormValue_(record, "professorAxis1")
  );
  var axis2 = members_externalContactsInterpretAxis_(
    members_externalContactsGetFormValue_(record, "professorAxis2")
  );

  if (axis1 && axis2 && members_externalContactsSameValue_(axis1, axis2)) {
    axis2 = "";
  }

  common.payload.INSTITUICAO = members_externalContactsGetFormValue_(record, "professorInstitution");
  common.payload.VINCULO_DOCENTE = members_externalContactsGetFormValue_(record, "professorBond");
  common.payload.DISCIPLINAS = members_externalContactsGetFormValue_(record, "professorDisciplines");
  common.payload.TITULACAO = members_externalContactsGetFormValue_(record, "professorDegree");
  common.payload.FORMACAO = members_externalContactsGetFormValue_(record, "professorFormation");
  common.payload.EIXO_TEMATICO_1 = axis1;
  common.payload.EIXO_TEMATICO_2 = axis2;

  return {
    payload: common.payload,
    managedObservation: members_externalContactsBuildManagedObservation_(
      record,
      [
        { label: "OBS_FORM", value: members_externalContactsGetFormValue_(record, "generalNotes") },
        { label: "PERFIL_GEAPA", value: members_externalContactsGetFormValue_(record, "geapaProfile") },
        { label: "EMAIL_FORMS", value: emailInfo.accountEmail },
        {
          label: "DATA_NASCIMENTO_NAO_INTERPRETADA",
          value: birthDateInfo.ok ? "" : birthDateInfo.rawText
        },
        {
          label: "AUTORIZA_ARMAZENAMENTO",
          value: common.authorizeStorage === MEMBERS_EXTERNAL_CONTACTS_CFG.values.no
            ? common.authorizeStorage
            : ""
        },
        {
          label: "AUTORIZA_MENSAGENS",
          value: common.authorizeMessages === MEMBERS_EXTERNAL_CONTACTS_CFG.values.no
            ? common.authorizeMessages
            : ""
        }
      ]
    )
  };
}

function members_externalContactsBuildParticipantPayload_(record, emailInfo) {
  var common = members_externalContactsBuildCommonPayload_(record, emailInfo);
  var birthDateInfo = members_externalContactsNormalizeBirthDateValue_(
    members_externalContactsGetFormValue_(record, "birthDate")
  );
  var category = members_externalContactsJoinDistinct_([
    members_externalContactsGetFormValue_(record, "participantOption"),
    members_externalContactsGetFormValue_(record, "participantRelation"),
    members_externalContactsGetFormValue_(record, "geapaProfile")
  ], " | ");
  var courseArea = members_externalContactsJoinDistinct_([
    members_externalContactsGetFormValue_(record, "participantCourseArea"),
    members_externalContactsGetFormValue_(record, "participantAreaInterest")
  ], " | ");
  var flags = members_externalContactsMapAxisInterestFlags_(
    members_externalContactsGetFormValue_(record, "participantAxesInterest")
  );
  var cargoOuAtuacao = members_externalContactsGetPreferredNonEmpty_([
    members_externalContactsGetFormValue_(record, "participantRole"),
    members_externalContactsGetFormValue_(record, "participantAreaInterest")
  ]);

  common.payload.INSTITUICAO = members_externalContactsGetFormValue_(record, "participantInstitution");
  common.payload.CARGO_OU_ATUACAO = cargoOuAtuacao;
  common.payload.CURSO_OU_AREA = courseArea;
  common.payload.CATEGORIA_PARTICIPANTE = category;
  common.payload.MOTIVACAO_OU_INTERESSE = members_externalContactsGetFormValue_(record, "participantWhy");

  Object.keys(flags).forEach(function(header) {
    common.payload[header] = flags[header];
  });

  return {
    payload: common.payload,
    managedObservation: members_externalContactsBuildManagedObservation_(
      record,
      [
        { label: "OBS_FORM", value: members_externalContactsGetFormValue_(record, "generalNotes") },
        { label: "CARGO_OU_ATUACAO", value: members_externalContactsGetFormValue_(record, "participantRole") },
        { label: "VINCULO_ACADEMICO_TECNICO", value: members_externalContactsGetFormValue_(record, "participantAcademicBond") },
        { label: "EMAIL_FORMS", value: emailInfo.accountEmail },
        {
          label: "DATA_NASCIMENTO_NAO_INTERPRETADA",
          value: birthDateInfo.ok ? "" : birthDateInfo.rawText
        },
        {
          label: "AUTORIZA_ARMAZENAMENTO",
          value: common.authorizeStorage === MEMBERS_EXTERNAL_CONTACTS_CFG.values.no
            ? common.authorizeStorage
            : ""
        },
        {
          label: "AUTORIZA_MENSAGENS",
          value: common.authorizeMessages === MEMBERS_EXTERNAL_CONTACTS_CFG.values.no
            ? common.authorizeMessages
            : ""
        }
      ]
    )
  };
}

function members_externalContactsIsProfessorRecord_(record) {
  var profileSignals = members_externalContactsJoinDistinct_([
    members_externalContactsGetFormValue_(record, "geapaProfile"),
    members_externalContactsGetFormValue_(record, "participantOption"),
    members_externalContactsGetFormValue_(record, "participantRelation")
  ], " ");
  var normalizedProfile = members_externalContactsNormalizeCompare_(profileSignals);

  if (normalizedProfile) {
    for (var i = 0; i < MEMBERS_EXTERNAL_CONTACTS_CFG.docenteProfileTokens.length; i++) {
      if (normalizedProfile.indexOf(MEMBERS_EXTERNAL_CONTACTS_CFG.docenteProfileTokens[i]) >= 0) {
        return true;
      }
    }
  }

  for (var j = 0; j < MEMBERS_EXTERNAL_CONTACTS_CFG.docenteFieldKeys.length; j++) {
    if (members_externalContactsGetFormValue_(record, MEMBERS_EXTERNAL_CONTACTS_CFG.docenteFieldKeys[j])) {
      return true;
    }
  }

  return false;
}

function members_externalContactsUpsertByEmail_(state, payload, opts) {
  opts = opts || {};

  var principalEmail = members_externalContactsNormalizeEmail_(payload.EMAIL || payload.EMAIL_PREFERENCIAL);
  if (!principalEmail) {
    throw new Error("Payload sem e-mail principal para upsert.");
  }

  var lookupEmails = members_externalContactsUniqueEmails_(
    (opts.emailInfo && opts.emailInfo.lookupEmails) || [principalEmail]
  );
  var existing = members_externalContactsFindExistingRecordByEmails_(state, lookupEmails);
  var now = new Date();
  var nextRecord = {};
  var currentRecord = existing || null;
  var expandedPayload = members_externalContactsExpandPayloadToExistingAliases_(state, payload);

  state.headers.forEach(function(header) {
    nextRecord[header] = currentRecord ? currentRecord[header] : "";
  });

  Object.keys(expandedPayload || {}).forEach(function(header) {
    if (members_findHeaderIndexByAliases_(state.headerMap, [header], { notFoundValue: -1 }) >= 0) {
      nextRecord[header] = expandedPayload[header];
    }
  });

  nextRecord.OBSERVACOES = members_externalContactsMergeManagedObservation_(
    currentRecord ? currentRecord.OBSERVACOES : "",
    opts.managedObservation
  );

  if (!String(nextRecord.ATIVO || "").trim()) {
    nextRecord.ATIVO = MEMBERS_EXTERNAL_CONTACTS_CFG.values.active;
  }

  if (!currentRecord) {
    if (members_findHeaderIndexByAliases_(state.headerMap, ["CRIADO_EM"], { notFoundValue: -1 }) >= 0) {
      nextRecord.CRIADO_EM = nextRecord.CRIADO_EM || now;
    }
    if (members_findHeaderIndexByAliases_(state.headerMap, ["ATUALIZADO_EM"], { notFoundValue: -1 }) >= 0) {
      nextRecord.ATUALIZADO_EM = now;
    }

    members_appendObjectByHeadersCompat_(state.sheet, nextRecord);
    var rowNumber = state.sheet.getLastRow();
    nextRecord.__rowNumber = rowNumber;
    members_externalContactsApplyIdResultToRecord_(
      state,
      nextRecord,
      members_externalContactsEnsureRowId_(state, rowNumber)
    );
    members_externalContactsFinalizeRowPresentation_(state, rowNumber, nextRecord);
    members_externalContactsRefreshStateAfterWrite_(state, nextRecord);

    return {
      ok: true,
      action: "created",
      rowNumber: rowNumber,
      email: principalEmail
    };
  }

  var changedHeaders = members_externalContactsDiffHeaders_(state.headers, currentRecord, nextRecord);
  if (!changedHeaders.length) {
    members_externalContactsApplyIdResultToRecord_(
      state,
      nextRecord,
      members_externalContactsEnsureRowId_(state, currentRecord.__rowNumber)
    );
    members_externalContactsFinalizeRowPresentation_(state, currentRecord.__rowNumber, nextRecord);
    members_externalContactsRefreshStateAfterWrite_(state, nextRecord);

    return {
      ok: true,
      action: "unchanged",
      rowNumber: currentRecord.__rowNumber,
      email: principalEmail
    };
  }

  nextRecord.ATUALIZADO_EM = now;

  state.sheet.getRange(currentRecord.__rowNumber, 1, 1, state.headers.length).setValues([
    members_externalContactsBuildRowFromRecord_(state.headers, nextRecord)
  ]);
  nextRecord.__rowNumber = currentRecord.__rowNumber;
  members_externalContactsApplyIdResultToRecord_(
    state,
    nextRecord,
    members_externalContactsEnsureRowId_(state, currentRecord.__rowNumber)
  );
  members_externalContactsFinalizeRowPresentation_(state, currentRecord.__rowNumber, nextRecord);
  members_externalContactsRefreshStateAfterWrite_(state, nextRecord);

  return {
    ok: true,
    action: "updated",
    rowNumber: currentRecord.__rowNumber,
    email: principalEmail,
    changedHeaders: changedHeaders
  };
}

function members_externalContactsFindExistingRecordByEmails_(state, emails) {
  var list = Array.isArray(emails) ? emails : [emails];

  for (var i = 0; i < list.length; i++) {
    var email = members_externalContactsNormalizeEmail_(list[i]);
    if (!email) continue;
    if (state.emailIndex[email]) return state.emailIndex[email];
  }

  return null;
}

function members_externalContactsEnsureRowId_(state, rowNumber) {
  var cfg = MEMBERS_EXTERNAL_CONTACTS_CFG.idConfig[state.entityType];
  if (!cfg) return { ok: true, created: false };

  if (members_coreHas_(state.entityType === "professors"
    ? "coreEnsureProfessorIdForRow"
    : "coreEnsureExternalIdForRow")) {
    return state.entityType === "professors"
      ? GEAPA_CORE.coreEnsureProfessorIdForRow(rowNumber)
      : GEAPA_CORE.coreEnsureExternalIdForRow(rowNumber);
  }

  var idHeader = cfg.header;
  var idIndex = members_findHeaderIndexByAliases_(state.headerMap, [idHeader], { notFoundValue: -1 });
  if (idIndex < 0) return { ok: false, created: false, reason: "id_header_missing" };

  var currentId = String(state.sheet.getRange(rowNumber, idIndex + 1).getValue() || "").trim();
  if (currentId) {
    return { ok: true, created: false, id: currentId };
  }

  var nextId = members_externalContactsGetNextId_(state.sheet, idHeader, cfg.prefix, cfg.padLength);
  state.sheet.getRange(rowNumber, idIndex + 1).setValue(nextId);
  return { ok: true, created: true, id: nextId };
}

function members_externalContactsApplyIdResultToRecord_(state, record, idResult) {
  if (!idResult || !idResult.id) return;

  var cfg = MEMBERS_EXTERNAL_CONTACTS_CFG.idConfig[state.entityType];
  if (!cfg || !cfg.header) return;

  record[cfg.header] = idResult.id;
}

function members_externalContactsGetNextId_(sheet, idHeader, prefix, padLength) {
  var headers = members_externalContactsGetSheetHeaders_(sheet);
  var headerMap = members_buildHeaderMapCompat_(headers, {
    normalize: true,
    oneBased: false
  });
  var idIndex = members_findHeaderIndexByAliases_(headerMap, [idHeader], { notFoundValue: -1 });
  if (idIndex < 0) {
    throw new Error("Cabecalho de ID nao encontrado: " + idHeader);
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return prefix + String(1).padStart(padLength, "0");

  var values = sheet.getRange(2, idIndex + 1, lastRow - 1, 1).getValues();
  var maxSequence = 0;

  values.forEach(function(row) {
    var value = String(row[0] || "").trim().toUpperCase();
    var match = value.match(new RegExp("^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").toUpperCase() + "(\\d+)$"));
    if (!match) return;
    var sequence = Number(match[1] || 0);
    if (sequence > maxSequence) maxSequence = sequence;
  });

  return prefix + String(maxSequence + 1).padStart(padLength, "0");
}

function members_externalContactsRefreshStateAfterWrite_(state, record) {
  var refreshed = {};

  state.headers.forEach(function(header) {
    refreshed[header] = Object.prototype.hasOwnProperty.call(record, header)
      ? record[header]
      : "";
  });
  refreshed.__rowNumber = record.__rowNumber;

  var foundIndex = -1;
  for (var i = 0; i < state.records.length; i++) {
    if (state.records[i].__rowNumber === refreshed.__rowNumber) {
      foundIndex = i;
      break;
    }
  }

  if (foundIndex >= 0) {
    state.records[foundIndex] = refreshed;
  } else {
    state.records.push(refreshed);
  }

  [refreshed.EMAIL, refreshed.EMAIL_PREFERENCIAL].forEach(function(email) {
    var normalized = members_externalContactsNormalizeEmail_(email);
    if (!normalized) return;
    state.emailIndex[normalized] = refreshed;
  });
}

function members_externalContactsBuildRowFromRecord_(headers, record) {
  return (headers || []).map(function(header) {
    return Object.prototype.hasOwnProperty.call(record || {}, header) ? record[header] : "";
  });
}

function members_externalContactsDiffHeaders_(headers, currentRecord, nextRecord) {
  if (!currentRecord) return headers.slice();

  return (headers || []).filter(function(header) {
    return !members_externalContactsValuesEqual_(currentRecord[header], nextRecord[header]);
  });
}

function members_externalContactsValuesEqual_(left, right) {
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime();
  }

  if (left instanceof Date || right instanceof Date) {
    var leftDate = left instanceof Date ? left : new Date(left);
    var rightDate = right instanceof Date ? right : new Date(right);
    if (!isNaN(leftDate) && !isNaN(rightDate)) {
      return leftDate.getTime() === rightDate.getTime();
    }
  }

  return String(left == null ? "" : left) === String(right == null ? "" : right);
}

function members_externalContactsGetBaseAliasMap_(entityType) {
  var merged = {};

  Object.keys(MEMBERS_EXTERNAL_CONTACTS_CFG.commonBaseHeaderAliases).forEach(function(header) {
    merged[header] = MEMBERS_EXTERNAL_CONTACTS_CFG.commonBaseHeaderAliases[header];
  });

  var specific = entityType === "professors"
    ? MEMBERS_EXTERNAL_CONTACTS_CFG.professorsBaseHeaderAliases
    : MEMBERS_EXTERNAL_CONTACTS_CFG.participantsBaseHeaderAliases;

  Object.keys(specific).forEach(function(header) {
    merged[header] = specific[header];
  });

  return merged;
}

function members_externalContactsExpandPayloadToExistingAliases_(state, payload) {
  var expanded = {};
  var aliasMap = members_externalContactsGetBaseAliasMap_(state.entityType);

  Object.keys(payload || {}).forEach(function(header) {
    expanded[header] = payload[header];
  });

  Object.keys(aliasMap).forEach(function(canonical) {
    if (!Object.prototype.hasOwnProperty.call(payload || {}, canonical)) return;

    var aliases = aliasMap[canonical] || [];
    var normalizedAliases = aliases.map(members_externalContactsNormalizeCompare_);

    state.headers.forEach(function(existingHeader) {
      if (existingHeader === canonical) return;
      if (normalizedAliases.indexOf(members_externalContactsNormalizeCompare_(existingHeader)) >= 0) {
        expanded[existingHeader] = payload[canonical];
      }
    });
  });

  return expanded;
}

function members_externalContactsEnsureHeadersInSheet_(sheet, expectedHeaders, aliasMap) {
  var lastCol = sheet.getLastColumn();

  if (lastCol < 1) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders.slice()]);
    return {
      sheetName: sheet.getName(),
      created: true,
      renamed: [],
      appended: expectedHeaders.slice(),
      finalHeaders: expectedHeaders.slice()
    };
  }

  var headers = members_externalContactsGetSheetHeaders_(sheet);
  var renamed = [];
  var appended = [];

  expectedHeaders.forEach(function(canonical) {
    if (members_externalContactsFindHeaderIndexExact_(headers, canonical) >= 0) {
      return;
    }

    var aliases = aliasMap[canonical] || [canonical];
    var aliasIndex = members_externalContactsFindFirstExistingAliasIndex_(headers, aliases);

    if (aliasIndex >= 0) {
      var oldHeader = headers[aliasIndex];
      sheet.getRange(1, aliasIndex + 1).setValue(canonical);
      headers[aliasIndex] = canonical;
      renamed.push({ from: oldHeader, to: canonical });
      return;
    }

    headers.push(canonical);
    appended.push(canonical);
  });

  if (appended.length) {
    sheet.getRange(1, lastCol + 1, 1, appended.length).setValues([appended]);
  }

  return {
    sheetName: sheet.getName(),
    created: false,
    renamed: renamed,
    appended: appended,
    finalHeaders: members_externalContactsGetSheetHeaders_(sheet)
  };
}

function members_externalContactsDiagnoseSheet_(sheet, expectedHeaders, aliasMap) {
  var headers = members_externalContactsGetSheetHeaders_(sheet);
  var missing = [];
  var recoverableByAlias = [];

  expectedHeaders.forEach(function(header) {
    if (members_externalContactsFindHeaderIndexExact_(headers, header) >= 0) return;

    missing.push(header);
    var aliases = aliasMap[header] || [header];
    if (members_externalContactsFindFirstExistingAliasIndex_(headers, aliases) >= 0) {
      recoverableByAlias.push(header);
    }
  });

  return {
    sheetName: sheet.getName(),
    totalColumns: headers.length,
    missing: missing,
    recoverableByAlias: recoverableByAlias
  };
}

function members_externalContactsGetSheetHeaders_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];

  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(header) {
    return String(header || "").trim();
  });
}

function members_externalContactsFindHeaderIndexExact_(headers, headerName) {
  var normalizedTarget = members_externalContactsNormalizeCompare_(headerName);

  for (var i = 0; i < (headers || []).length; i++) {
    if (members_externalContactsNormalizeCompare_(headers[i]) === normalizedTarget) {
      return i;
    }
  }

  return -1;
}

function members_externalContactsFindFirstExistingAliasIndex_(headers, aliases) {
  var list = Array.isArray(aliases) ? aliases : [aliases];

  for (var i = 0; i < list.length; i++) {
    var found = members_externalContactsFindHeaderIndexExact_(headers, list[i]);
    if (found >= 0) return found;
  }

  return -1;
}

function members_externalContactsGetFormValue_(record, fieldKey) {
  var aliases = MEMBERS_EXTERNAL_CONTACTS_CFG.formFields[fieldKey] || [];
  return members_externalContactsGetRecordValue_(record, aliases);
}

function members_externalContactsGetRecordValue_(record, aliases) {
  var keys = Object.keys(record || {});
  var list = Array.isArray(aliases) ? aliases : [aliases];

  for (var i = 0; i < list.length; i++) {
    var target = members_normalizeOffboardingHeader_(list[i]);
    for (var j = 0; j < keys.length; j++) {
      if (members_normalizeOffboardingHeader_(keys[j]) === target) {
        return members_externalContactsTrimText_(record[keys[j]]);
      }
    }
  }

  return "";
}

function members_externalContactsTrimText_(value) {
  if (value == null) return "";
  if (value instanceof Date) return value;
  return String(value || "").trim();
}

function members_externalContactsNormalizeCompare_(value) {
  return members_normalizeTextCompat_(value, {
    removeAccents: true,
    collapseWhitespace: true,
    caseMode: "lower"
  }).replace(/[\u2010-\u2015-]+/g, " ");
}

function members_externalContactsNormalizeEmail_(value) {
  var email = members_normalizeEmailCompat_(value);
  if (!email) return "";
  if (members_coreHas_("coreIsValidEmail") && !GEAPA_CORE.coreIsValidEmail(email)) return "";
  return email;
}

function members_externalContactsNormalizeInstagram_(value) {
  var handle = members_normalizeInstagramHandle_(value);
  return handle ? ("@" + handle) : String(value || "").trim();
}

function members_externalContactsNormalizeBirthDateValue_(value) {
  if (value == null || value === "") {
    return {
      ok: false,
      value: "",
      date: null,
      rawText: ""
    };
  }

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return {
      ok: true,
      value: new Date(value.getFullYear(), value.getMonth(), value.getDate()),
      date: new Date(value.getFullYear(), value.getMonth(), value.getDate()),
      rawText: ""
    };
  }

  if (typeof value === "number" && isFinite(value)) {
    var serialDate = new Date(1899, 11, 30);
    serialDate.setDate(serialDate.getDate() + Math.floor(Number(value)));
    if (!isNaN(serialDate.getTime())) {
      return {
        ok: true,
        value: new Date(serialDate.getFullYear(), serialDate.getMonth(), serialDate.getDate()),
        date: new Date(serialDate.getFullYear(), serialDate.getMonth(), serialDate.getDate()),
        rawText: String(value)
      };
    }
  }

  var rawText = String(value || "").trim();
  if (!rawText) {
    return {
      ok: false,
      value: "",
      date: null,
      rawText: ""
    };
  }

  var ddmmyyyy = rawText.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (ddmmyyyy) {
    return members_externalContactsBuildBirthDateResult_(
      Number(ddmmyyyy[3]),
      Number(ddmmyyyy[2]),
      Number(ddmmyyyy[1]),
      rawText
    );
  }

  var iso = rawText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return members_externalContactsBuildBirthDateResult_(
      Number(iso[1]),
      Number(iso[2]),
      Number(iso[3]),
      rawText
    );
  }

  var fallback = new Date(rawText);
  if (!isNaN(fallback.getTime())) {
    return {
      ok: true,
      value: new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate()),
      date: new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate()),
      rawText: rawText
    };
  }

  return {
    ok: false,
    value: rawText,
    date: null,
    rawText: rawText
  };
}

function members_externalContactsBuildBirthDateResult_(year, month, day, rawText) {
  var date = new Date(year, month - 1, day);
  var isSame =
    date &&
    !isNaN(date.getTime()) &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  return {
    ok: !!isSame,
    value: isSame ? date : rawText,
    date: isSame ? date : null,
    rawText: rawText
  };
}

function members_externalContactsNormalizeYesNo_(value) {
  var text = members_externalContactsNormalizeCompare_(value);
  if (!text) return "";

  var yesTokens = ["sim", "s", "yes", "y", "true", "quero", "aceito", "autorizo"];
  var noTokens = ["nao", "n", "no", "false", "nao quero", "nao autorizo"];

  if (yesTokens.indexOf(text) >= 0) return MEMBERS_EXTERNAL_CONTACTS_CFG.values.yes;
  if (noTokens.indexOf(text) >= 0) return MEMBERS_EXTERNAL_CONTACTS_CFG.values.no;

  if (text.indexOf("sim") === 0) return MEMBERS_EXTERNAL_CONTACTS_CFG.values.yes;
  if (text.indexOf("nao") === 0) return MEMBERS_EXTERNAL_CONTACTS_CFG.values.no;

  return String(value || "").trim().toUpperCase();
}

function members_externalContactsIsYes_(value) {
  return members_externalContactsNormalizeYesNo_(value) === MEMBERS_EXTERNAL_CONTACTS_CFG.values.yes;
}

function members_externalContactsUniqueEmails_(values) {
  var seen = Object.create(null);
  var out = [];

  (Array.isArray(values) ? values : [values]).forEach(function(value) {
    var email = members_externalContactsNormalizeEmail_(value);
    if (!email || seen[email]) return;
    seen[email] = true;
    out.push(email);
  });

  return out;
}

function members_externalContactsJoinDistinct_(values, separator) {
  var sep = separator || " | ";
  var seen = Object.create(null);
  var out = [];

  (values || []).forEach(function(value) {
    var text = members_externalContactsTrimText_(value);
    var normalized = members_externalContactsNormalizeCompare_(text);
    if (!normalized || seen[normalized]) return;
    seen[normalized] = true;
    out.push(String(text));
  });

  return out.join(sep);
}

function members_externalContactsBuildManagedObservation_(record, items) {
  var parts = [];
  var sourceRow = record && record.__rowNumber ? ("LINHA_FORM=" + record.__rowNumber) : "";
  if (sourceRow) parts.push(sourceRow);

  (items || []).forEach(function(item) {
    var label = String((item && item.label) || "").trim();
    var value = members_externalContactsTrimText_(item && item.value);
    if (!label || value === "") return;
    parts.push(label + "=" + value);
  });

  return parts.join(" | ");
}

function members_externalContactsExtractFormsEmailFromObservation_(observation) {
  var text = String(observation || "");
  var match = text.match(/EMAIL_FORMS=([^\s|]+)/);
  return match ? members_externalContactsNormalizeEmail_(match[1]) : "";
}

function members_externalContactsExtractCargoFromObservation_(observation) {
  var text = String(observation || "");
  var match = text.match(/CARGO_OU_ATUACAO=([^|\n\r]+)/);
  return match ? String(match[1] || "").trim() : "";
}

function members_externalContactsNormalizeExistingEmailFields_(record) {
  var formsEmail = members_externalContactsExtractFormsEmailFromObservation_(record.OBSERVACOES);
  var email = members_externalContactsNormalizeEmail_(record.EMAIL);
  var preferred = members_externalContactsNormalizeEmail_(record.EMAIL_PREFERENCIAL);

  if (formsEmail) {
    var effectivePreferred = preferred && preferred !== formsEmail ? preferred : "";
    return {
      EMAIL: effectivePreferred || formsEmail,
      EMAIL_PREFERENCIAL: effectivePreferred
    };
  }

  if (preferred && preferred === email) {
    preferred = "";
  }

  if (!email && preferred) {
    email = preferred;
  }

  return {
    EMAIL: email,
    EMAIL_PREFERENCIAL: preferred
  };
}

function members_externalContactsGetPreferredNonEmpty_(values) {
  var list = Array.isArray(values) ? values : [values];

  for (var i = 0; i < list.length; i++) {
    var value = members_externalContactsTrimText_(list[i]);
    if (value !== "") return value;
  }

  return "";
}

function members_externalContactsMergeManagedObservation_(existingObservation, managedObservation) {
  var existing = String(existingObservation || "").trim();
  var marker = "[" + MEMBERS_EXTERNAL_CONTACTS_CFG.observationMarker + "]";
  var managedLine = managedObservation ? (marker + " " + managedObservation) : "";
  var base = existing.split(/\r?\n/).filter(function(line) {
    return String(line || "").trim().indexOf(marker) !== 0;
  }).join("\n").trim();

  if (!managedLine) return base;
  if (!base) return managedLine;
  return base + "\n" + managedLine;
}

function members_externalContactsSameValue_(left, right) {
  return members_externalContactsNormalizeCompare_(left) === members_externalContactsNormalizeCompare_(right);
}

function members_externalContactsWriteRowValue_(sheet, rowNumber, headerMap, headerName, value) {
  members_writeCellByHeaderCompat_(sheet, rowNumber, headerMap, headerName, value, {
    oneBased: false,
    normalize: true
  });
}

function members_externalContactsFinalizeRowPresentation_(state, rowNumber, record) {
  members_externalContactsApplyBirthDatePresentationToRow_(state, rowNumber, record);
  members_externalContactsApplyContactLinksToRow_(state, rowNumber, record);
}

function members_externalContactsApplyBirthDatePresentationToRow_(state, rowNumber, record) {
  var birthDateInfo = members_externalContactsNormalizeBirthDateValue_(record.DATA_NASCIMENTO);
  var birthHeaderIndex = members_findHeaderIndexByAliases_(state.headerMap, ["DATA_NASCIMENTO"], { notFoundValue: -1 });
  if (birthHeaderIndex < 0) return;

  var cell = state.sheet.getRange(rowNumber, birthHeaderIndex + 1);

  if (birthDateInfo.ok && birthDateInfo.date) {
    cell.setValue(birthDateInfo.date);
    cell.setNumberFormat(MEMBERS_EXTERNAL_CONTACTS_CFG.defaultDateNumberFormat);
    record.DATA_NASCIMENTO = birthDateInfo.date;
    return;
  }

  if (birthDateInfo.value !== record.DATA_NASCIMENTO) {
    cell.setValue(birthDateInfo.value);
    record.DATA_NASCIMENTO = birthDateInfo.value;
  }
  if (birthDateInfo.value !== "") {
    cell.setNumberFormat("@");
  }
}

function members_externalContactsApplyContactLinksToRow_(state, rowNumber, record) {
  members_externalContactsApplyCellLinkByHeader_(
    state,
    rowNumber,
    "EMAIL",
    members_externalContactsNormalizeEmail_(record.EMAIL),
    function(value) {
      return members_externalContactsBuildMailtoLink_(value);
    }
  );
  members_externalContactsApplyCellLinkByHeader_(
    state,
    rowNumber,
    "EMAIL_PREFERENCIAL",
    members_externalContactsNormalizeEmail_(record.EMAIL_PREFERENCIAL),
    function(value) {
      return members_externalContactsBuildMailtoLink_(value);
    }
  );
  members_externalContactsApplyCellLinkByHeader_(
    state,
    rowNumber,
    "TELEFONE",
    members_externalContactsTrimText_(record.TELEFONE),
    function(value) {
      return members_externalContactsBuildPhoneLink_(value);
    }
  );
  members_externalContactsApplyCellLinkByHeader_(
    state,
    rowNumber,
    "INSTAGRAM",
    members_externalContactsTrimText_(record.INSTAGRAM),
    function(value) {
      return members_externalContactsBuildInstagramLink_(value);
    }
  );
}

function members_externalContactsApplyCellLinkByHeader_(state, rowNumber, headerName, displayText, linkBuilder) {
  var headerIndex = members_findHeaderIndexByAliases_(state.headerMap, [headerName], { notFoundValue: -1 });
  if (headerIndex < 0) return;

  var range = state.sheet.getRange(rowNumber, headerIndex + 1);
  var text = String(displayText || "").trim();
  if (!text) {
    range.setValue("");
    return;
  }

  var url = typeof linkBuilder === "function" ? linkBuilder(text) : "";
  if (!url) {
    range.setValue(text);
    return;
  }

  var richText = SpreadsheetApp.newRichTextValue()
    .setText(text)
    .setLinkUrl(url)
    .build();
  range.setRichTextValue(richText);
}

function members_externalContactsBuildMailtoLink_(email) {
  var normalized = members_externalContactsNormalizeEmail_(email);
  return normalized ? ("mailto:" + normalized) : "";
}

function members_externalContactsBuildPhoneLink_(phone) {
  var digits = members_onlyDigitsCompat_(phone);
  if (!digits) return "";

  if (digits.length >= 10) {
    var br = digits.indexOf("55") === 0 ? digits : ("55" + digits);
    return "https://wa.me/" + br;
  }

  return "tel:" + digits;
}

function members_externalContactsBuildInstagramLink_(instagram) {
  var handle = members_normalizeInstagramHandle_(instagram);
  return handle ? ("https://instagram.com/" + handle) : "";
}

function members_externalContactsWriteValueToAliasFamily_(sheet, rowNumber, headers, headerMap, entityType, canonicalHeader, value) {
  var aliasMap = members_externalContactsGetBaseAliasMap_(entityType);
  var aliases = aliasMap[canonicalHeader] || [canonicalHeader];
  var normalizedTargets = aliases.map(members_externalContactsNormalizeCompare_);

  (headers || []).forEach(function(existingHeader, index) {
    if (normalizedTargets.indexOf(members_externalContactsNormalizeCompare_(existingHeader)) >= 0) {
      sheet.getRange(rowNumber, index + 1).setValue(value);
    }
  });
}
