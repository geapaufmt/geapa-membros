/***************************************
 * 50_install.gs
 *
 * Instala/Remove triggers do módulo GEAPA - Membros.
 ***************************************/

const MEMBERS_TRIGGERS = Object.freeze([
  { fn: "members_onEditProcessStatus", type: "onEditSpreadsheet" },
  { fn: "members_onFormSubmitChapasSync", type: "onFormSubmitSpreadsheet" },
  { fn: "members_jobMembershipLifecycle_", type: "timeMinutes", minutes: 10 },
  { fn: "members_jobChapas_", type: "timeMinutes", minutes: 10 },
  { fn: "members_jobGovernanceTransition_", type: "timeMinutes", minutes: 15 },
  { fn: "members_jobExternalContacts_", type: "timeHours", hours: 1 }
]);

const MEMBERS_LEGACY_TRIGGER_HANDLERS = Object.freeze([
  "members_processAcceptanceReplies",
  "members_processInvitationTimeouts",
  "members_importFromSeletivoResults",
  "members_processPendingChapas",
  "members_processCancelledChapas",
  "members_processElectedChapas",
  "members_processApprovedDismissalByAbsenceEvents",
  "members_refreshGovernanceEligibilityPanel",
  "members_syncDirectorNominationFormOptions",
  "members_processDirectorNominations",
  "members_sendCouncilorInvitationEmails",
  "members_processCouncilorAdhesions",
  "members_syncGovernanceDriveAccess",
  "members_importExternalContactsFromForm",
  "members_importNewExternalContactsFromTrigger"
]);

/**
 * Executa uma tarefa de job com isolamento de erro para preservar o ciclo.
 *
 * @param {string} name
 * @param {Function} callback
 * @return {Object}
 */
function members_runScheduledTask_(name, callback) {
  try {
    return {
      name: name,
      ok: true,
      result: callback({
        executionType: MEMBERS_OPERATIONAL_CONTROL.capabilities.trigger
      })
    };
  } catch (err) {
    members_markOperationalErrorStatus_(
      "GERAL",
      err,
      "",
      {
        entrypoint: name,
        executionType: MEMBERS_OPERATIONAL_CONTROL.capabilities.trigger
      }
    );
    Logger.log("[geapa-membros][trigger-job][" + name + "] ERRO | " + (err && err.stack ? err.stack : err));
    return {
      name: name,
      ok: false,
      error: err && err.message ? err.message : String(err)
    };
  }
}

/**
 * Orquestra rotinas recorrentes do ciclo de membros e eventos de vinculo.
 *
 * @return {Object}
 */
function members_jobMembershipLifecycle_() {
  const tasks = [
    { name: "members_importFromSeletivoResults", run: members_importFromSeletivoResults },
    { name: "members_processAcceptanceReplies", run: members_processAcceptanceReplies },
    { name: "members_processInvitationTimeouts", run: members_processInvitationTimeouts },
    { name: "members_processApprovedDismissalByAbsenceEvents", run: members_processApprovedDismissalByAbsenceEvents }
  ];

  const results = tasks.map(task => members_runScheduledTask_(task.name, task.run));
  return {
    ok: results.every(item => item.ok),
    job: "members_jobMembershipLifecycle_",
    results: results
  };
}

/**
 * Orquestra o processamento periodico de chapas.
 *
 * @return {Object}
 */
function members_jobChapas_() {
  const tasks = [
    { name: "members_processPendingChapas", run: members_processPendingChapas },
    { name: "members_processCancelledChapas", run: members_processCancelledChapas },
    { name: "members_processElectedChapas", run: members_processElectedChapas }
  ];

  const results = tasks.map(task => members_runScheduledTask_(task.name, task.run));
  return {
    ok: results.every(item => item.ok),
    job: "members_jobChapas_",
    results: results
  };
}

/**
 * Orquestra as rotinas recorrentes de transicao, nomeacoes, conselho e Drive.
 *
 * @return {Object}
 */
function members_jobGovernanceTransition_() {
  const tasks = [
    { name: "members_refreshGovernanceEligibilityPanel", run: members_refreshGovernanceEligibilityPanel },
    { name: "members_syncDirectorNominationFormOptions", run: members_syncDirectorNominationFormOptions },
    { name: "members_processDirectorNominations", run: members_processDirectorNominations },
    { name: "members_sendCouncilorInvitationEmails", run: members_sendCouncilorInvitationEmails },
    { name: "members_processCouncilorAdhesions", run: members_processCouncilorAdhesions },
    { name: "members_syncGovernanceDriveAccess", run: members_syncGovernanceDriveAccess }
  ];

  const results = tasks.map(task => members_runScheduledTask_(task.name, task.run));
  return {
    ok: results.every(item => item.ok),
    job: "members_jobGovernanceTransition_",
    results: results
  };
}

/**
 * Orquestra a importacao recorrente de contatos externos novos.
 *
 * @return {Object}
 */
function members_jobExternalContacts_() {
  const result = members_runScheduledTask_(
    "members_importNewExternalContactsFromTrigger",
    members_importNewExternalContactsFromTrigger
  );
  return {
    ok: result.ok,
    job: "members_jobExternalContacts_",
    results: [result]
  };
}

function members_installTriggers() {
  members_assertCore_();
  members_uninstallTriggers();

  const futureSheet = GEAPA_CORE.coreGetSheetByKey(SETTINGS.futureKey);
  if (!futureSheet) {
    throw new Error("Não foi possível localizar a aba MEMBERS_FUTURO via GEAPA-CORE.");
  }

  const spreadsheet = futureSheet.getParent();

  MEMBERS_TRIGGERS.forEach(t => {
    if (t.type === "onEditSpreadsheet") {
      ScriptApp.newTrigger(t.fn)
        .forSpreadsheet(spreadsheet)
        .onEdit()
        .create();
    }

    if (t.type === "onFormSubmitSpreadsheet") {
      ScriptApp.newTrigger(t.fn)
        .forSpreadsheet(spreadsheet)
        .onFormSubmit()
        .create();
    }

    if (t.type === "timeMinutes") {
      ScriptApp.newTrigger(t.fn)
        .timeBased()
        .everyMinutes(t.minutes)
        .create();
    }

    if (t.type === "timeHours") {
      ScriptApp.newTrigger(t.fn)
        .timeBased()
        .everyHours(t.hours)
        .create();
    }
  });

  Logger.log("Triggers do módulo GEAPA - Membros instalados.");
}

function members_uninstallTriggers() {
  const all = ScriptApp.getProjectTriggers();
  const handlers = MEMBERS_TRIGGERS.map(t => t.fn).concat(MEMBERS_LEGACY_TRIGGER_HANDLERS);

  all.forEach(tr => {
    const fn = tr.getHandlerFunction();
    if (handlers.indexOf(fn) >= 0) {
      ScriptApp.deleteTrigger(tr);
    }
  });

  Logger.log("Triggers do módulo GEAPA - Membros removidos.");
}
