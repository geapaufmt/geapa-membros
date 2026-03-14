/***************************************
 * 50_install.gs
 *
 * Instala/Remove triggers do módulo GEAPA - Membros.
 ***************************************/

const MEMBERS_TRIGGERS = Object.freeze([
  { fn: "members_onEditProcessStatus", type: "onEditSpreadsheet" },
  { fn: "members_processAcceptanceReplies", type: "timeMinutes", minutes: 5 }
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

    if (t.type === "timeMinutes") {
      ScriptApp.newTrigger(t.fn)
        .timeBased()
        .everyMinutes(t.minutes)
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