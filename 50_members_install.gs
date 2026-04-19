/***************************************
 * 50_install.gs
 *
 * Instala/Remove triggers do módulo GEAPA - Membros.
 ***************************************/

const MEMBERS_TRIGGERS = Object.freeze([
  { fn: "members_onEditProcessStatus", type: "onEditSpreadsheet" },
  { fn: "members_onFormSubmitChapasSync", type: "onFormSubmitSpreadsheet" },
  { fn: "members_processAcceptanceReplies", type: "timeMinutes", minutes: 5 },
  { fn: "members_processInvitationTimeouts", type: "timeHours", hours: 12 },
  { fn: "members_importFromSeletivoResults", type: "timeMinutes", minutes: 10 },
  { fn: "members_processPendingChapas", type: "timeMinutes", minutes: 5 },
  { fn: "members_processCancelledChapas", type: "timeMinutes", minutes: 5 },
  { fn: "members_processElectedChapas", type: "timeMinutes", minutes: 5 },
  { fn: "members_processApprovedDismissalByAbsenceEvents", type: "timeMinutes", minutes: 15 },
  { fn: "members_refreshGovernanceEligibilityPanel", type: "timeMinutes", minutes: 30 },
  { fn: "members_syncDirectorNominationFormOptions", type: "timeMinutes", minutes: 15 },
  { fn: "members_processDirectorNominations", type: "timeMinutes", minutes: 5 },
  { fn: "members_sendCouncilorInvitationEmails", type: "timeHours", hours: 12 },
  { fn: "members_processCouncilorAdhesions", type: "timeMinutes", minutes: 10 },
  { fn: "members_syncGovernanceDriveAccess", type: "timeMinutes", minutes: 30 }
]);

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

  all.forEach(tr => {
    const fn = tr.getHandlerFunction();
    if (MEMBERS_TRIGGERS.some(t => t.fn === fn)) {
      ScriptApp.deleteTrigger(tr);
    }
  });

  Logger.log("Triggers do módulo GEAPA - Membros removidos.");
}
