/***************************************
 * 00_members_operational_control.gs
 *
 * Camada leve de integracao do modulo
 * GEAPA-MEMBROS com MODULOS_CONFIG e
 * MODULOS_STATUS do GEAPA-CORE.
 ***************************************/

const MEMBERS_OPERATIONAL_CONTROL = Object.freeze({
  moduleName: "MEMBROS",
  flows: Object.freeze({
    general: "GERAL",
    invites: "CONVITES_INGRESSO",
    acceptance: "ACEITE_RECUSA",
    invitationTimeouts: "TIMEOUT_CONVITES",
    seletivoImport: "IMPORTACAO_SELETIVO",
    offboarding: "OFFBOARDING",
    chapas: "CHAPAS",
    governance: "GOVERNANCA_TRANSICAO",
    councilors: "CONSELHEIROS",
    governanceDriveSync: "SYNC_DRIVE_GOVERNANCA",
    externalContactsImport: "IMPORTACAO_CONTATOS_EXTERNOS",
    dismissalByAbsenceEvents: "DESLIGAMENTO_POR_FALTAS_EVENTOS",
    voluntaryLinkRequests: "SOLICITACOES_VINCULO_V2"
  }),
  capabilities: Object.freeze({
    trigger: "TRIGGER",
    email: "EMAIL",
    inbox: "INBOX",
    sync: "SYNC",
    drive: "DRIVE"
  })
});

var MEMBERS_OPERATIONAL_CONTEXT_STACK = [];

/**
 * Normaliza um token operacional para o padrao do core.
 *
 * @param {*} value
 * @return {string}
 */
function members_normalizeOperationalKey_(value) {
  return members_normalizeTextCompat_(value, {
    removeAccents: true,
    collapseWhitespace: true,
    caseMode: "upper"
  }).replace(/\s+/g, "_");
}

/**
 * Retorna o e-mail do usuario ativo, quando o contexto disponibiliza essa informacao.
 *
 * @return {string}
 */
function members_getOperationalActiveUserEmail_() {
  try {
    return members_normalizeEmailCompat_(Session.getActiveUser().getEmail());
  } catch (err) {
    return "";
  }
}

/**
 * Detecta se a execucao atual aparenta ser manual ou disparada por trigger.
 *
 * @param {*=} eventOrOpts
 * @param {string=} fallbackType
 * @return {string}
 */
function members_detectOperationalExecutionType_(eventOrOpts, fallbackType) {
  var fallback = members_normalizeOperationalKey_(fallbackType || MEMBERS_OPERATIONAL_CONTROL.capabilities.trigger);
  var eventLike = eventOrOpts && typeof eventOrOpts === "object" ? eventOrOpts : null;

  if (eventLike && eventLike.executionType) {
    return members_normalizeOperationalKey_(eventLike.executionType);
  }

  if (
    eventLike &&
    (
      eventLike.range ||
      eventLike.triggerUid ||
      eventLike.authMode ||
      eventLike.namedValues ||
      eventLike.response
    )
  ) {
    return MEMBERS_OPERATIONAL_CONTROL.capabilities.trigger;
  }

  if (members_getOperationalActiveUserEmail_()) {
    return "MANUAL";
  }

  return fallback || "MANUAL";
}

/**
 * Informa se a API publica de controle operacional do core esta disponivel.
 *
 * @return {boolean}
 */
function members_hasOperationalControlApi_() {
  return (
    members_coreHas_("coreGetModuleConfig") &&
    members_coreHas_("coreAssertModuleExecutionAllowed")
  );
}

/**
 * Informa se a API publica de status operacional do core esta disponivel.
 *
 * @return {boolean}
 */
function members_hasOperationalStatusApi_() {
  return (
    members_coreHas_("coreModuleStatusMarkExecution") &&
    members_coreHas_("coreModuleStatusMarkSuccess") &&
    members_coreHas_("coreModuleStatusMarkError") &&
    members_coreHas_("coreModuleStatusMarkBlocked")
  );
}

/**
 * Retorna o contexto operacional corrente do modulo.
 *
 * @return {?Object}
 */
function members_getOperationalContext_() {
  return MEMBERS_OPERATIONAL_CONTEXT_STACK.length
    ? MEMBERS_OPERATIONAL_CONTEXT_STACK[MEMBERS_OPERATIONAL_CONTEXT_STACK.length - 1]
    : null;
}

/**
 * Empilha um contexto operacional ativo.
 *
 * @param {Object} ctx
 * @return {Object}
 */
function members_pushOperationalContext_(ctx) {
  MEMBERS_OPERATIONAL_CONTEXT_STACK.push(ctx);
  return ctx;
}

/**
 * Remove o contexto operacional mais recente da pilha.
 *
 * @return {?Object}
 */
function members_popOperationalContext_() {
  return MEMBERS_OPERATIONAL_CONTEXT_STACK.length
    ? MEMBERS_OPERATIONAL_CONTEXT_STACK.pop()
    : null;
}

/**
 * Informa se o fluxo corrente esta rodando em DRY_RUN.
 *
 * @return {boolean}
 */
function members_isOperationalDryRun_() {
  var ctx = members_getOperationalContext_();
  return !!(ctx && ctx.dryRun);
}

/**
 * Registra a ultima execucao de um fluxo em MODULOS_STATUS, quando possivel.
 *
 * @param {string} flowName
 * @param {string} capability
 * @param {Object} opts
 */
function members_markOperationalExecutionStatus_(flowName, capability, opts) {
  if (!members_hasOperationalStatusApi_()) return;
  GEAPA_CORE.coreModuleStatusMarkExecution(
    MEMBERS_OPERATIONAL_CONTROL.moduleName,
    flowName,
    capability,
    opts || {}
  );
}

/**
 * Registra sucesso operacional de um fluxo em MODULOS_STATUS, quando possivel.
 *
 * @param {string} flowName
 * @param {string} capability
 * @param {Object} opts
 */
function members_markOperationalSuccessStatus_(flowName, capability, opts) {
  if (!members_hasOperationalStatusApi_()) return;
  GEAPA_CORE.coreModuleStatusMarkSuccess(
    MEMBERS_OPERATIONAL_CONTROL.moduleName,
    flowName,
    capability,
    opts || {}
  );
}

/**
 * Registra erro operacional de um fluxo em MODULOS_STATUS, quando possivel.
 *
 * @param {string} flowName
 * @param {*=} errorOrMessage
 * @param {string=} capability
 * @param {Object=} opts
 */
function members_markOperationalErrorStatus_(flowName, errorOrMessage, capability, opts) {
  if (!members_hasOperationalStatusApi_()) return;
  GEAPA_CORE.coreModuleStatusMarkError(
    MEMBERS_OPERATIONAL_CONTROL.moduleName,
    flowName,
    errorOrMessage,
    capability || "",
    opts || {}
  );
}

/**
 * Registra bloqueio por configuracao em MODULOS_STATUS, quando possivel.
 *
 * @param {string} flowName
 * @param {string} reasonCode
 * @param {string} reasonMessage
 * @param {string} capability
 * @param {string} modeRead
 * @param {Object=} opts
 */
function members_markOperationalBlockedStatus_(flowName, reasonCode, reasonMessage, capability, modeRead, opts) {
  if (!members_hasOperationalStatusApi_()) return;
  GEAPA_CORE.coreModuleStatusMarkBlocked(
    MEMBERS_OPERATIONAL_CONTROL.moduleName,
    flowName,
    reasonCode,
    reasonMessage,
    capability || "",
    modeRead || "",
    opts || {}
  );
}

/**
 * Extrai uma mensagem curta de um erro operacional.
 *
 * @param {*} errorOrMessage
 * @return {string}
 */
function members_getOperationalErrorMessage_(errorOrMessage) {
  if (!errorOrMessage) return "";
  if (errorOrMessage && errorOrMessage.message) {
    return String(errorOrMessage.message || "").trim();
  }
  return String(errorOrMessage || "").trim();
}

/**
 * Executa um entrypoint sob controle de MODULOS_CONFIG e MODULOS_STATUS.
 *
 * @param {string} flowName
 * @param {string} capability
 * @param {Object} opts
 * @param {Function} callback
 * @return {*}
 */
function members_runOperationalFlow_(flowName, capability, opts, callback) {
  members_assertCore_();
  opts = opts || {};

  var normalizedFlow = String(flowName || MEMBERS_OPERATIONAL_CONTROL.flows.general).trim() || MEMBERS_OPERATIONAL_CONTROL.flows.general;
  var normalizedCapability = members_normalizeOperationalKey_(capability || "");
  var executionType = members_detectOperationalExecutionType_(
    opts.eventOrOpts,
    opts.executionType || opts.executionTypeFallback || "MANUAL"
  );
  var coreOpts = Object.freeze({
    executionType: executionType
  });
  var config = null;
  var modeRead = "ON";
  var decision = {
    allowed: true,
    dryRun: false,
    reason: "PERMITIDO",
    config: null
  };

  if (members_hasOperationalControlApi_()) {
    try {
      config = GEAPA_CORE.coreGetModuleConfig(
        MEMBERS_OPERATIONAL_CONTROL.moduleName,
        normalizedFlow,
        coreOpts
      );
      modeRead = String((config && config.mode) || modeRead).trim() || modeRead;
      decision = GEAPA_CORE.coreAssertModuleExecutionAllowed(
        MEMBERS_OPERATIONAL_CONTROL.moduleName,
        normalizedFlow,
        normalizedCapability,
        coreOpts
      ) || decision;
      if (decision && decision.config && decision.config.mode) {
        modeRead = String(decision.config.mode || modeRead).trim() || modeRead;
      }
    } catch (err) {
      var blockMessage = members_getOperationalErrorMessage_(err);
      members_markOperationalBlockedStatus_(
        normalizedFlow,
        "CONFIG_BLOCKED",
        blockMessage,
        normalizedCapability,
        modeRead,
        {
          modeRead: modeRead,
          executionType: executionType
        }
      );
      Logger.log(
        "[geapa-membros][operacional][BLOQUEADO] " +
        JSON.stringify({
          flow: normalizedFlow,
          capability: normalizedCapability,
          executionType: executionType,
          modeRead: modeRead,
          reason: blockMessage
        })
      );
      return {
        ok: false,
        blocked: true,
        flow: normalizedFlow,
        capability: normalizedCapability,
        executionType: executionType,
        modeRead: modeRead,
        reason: blockMessage
      };
    }
  }

  members_markOperationalExecutionStatus_(normalizedFlow, normalizedCapability, {
    modeRead: modeRead,
    executionType: executionType
  });

  var context = members_pushOperationalContext_({
    moduleName: MEMBERS_OPERATIONAL_CONTROL.moduleName,
    flowName: normalizedFlow,
    capability: normalizedCapability,
    executionType: executionType,
    dryRun: !!(decision && decision.dryRun),
    modeRead: modeRead,
    capabilityDecisions: {}
  });

  try {
    var result = callback(context);
    members_markOperationalSuccessStatus_(normalizedFlow, normalizedCapability, {
      modeRead: modeRead,
      executionType: executionType
    });
    return result;
  } catch (err) {
    members_markOperationalErrorStatus_(normalizedFlow, err, normalizedCapability, {
      modeRead: modeRead,
      executionType: executionType
    });
    throw err;
  } finally {
    members_popOperationalContext_();
  }
}

/**
 * Consulta se uma capability secundaria esta liberada para o fluxo corrente.
 *
 * @param {string} capability
 * @return {Object}
 */
function members_checkOperationalCapability_(capability) {
  var ctx = members_getOperationalContext_();
  var normalizedCapability = members_normalizeOperationalKey_(capability || "");

  if (!ctx || !normalizedCapability) {
    return Object.freeze({
      allowed: true,
      dryRun: members_isOperationalDryRun_(),
      reason: "SEM_CONTEXTO",
      modeRead: ctx && ctx.modeRead ? ctx.modeRead : "ON"
    });
  }

  if (ctx.capabilityDecisions[normalizedCapability]) {
    return ctx.capabilityDecisions[normalizedCapability];
  }

  var result = {
    allowed: true,
    dryRun: !!ctx.dryRun,
    reason: ctx.dryRun ? "MODO=DRY_RUN" : "PERMITIDO",
    modeRead: ctx.modeRead || "ON"
  };

  if (members_hasOperationalControlApi_()) {
    try {
      var decision = GEAPA_CORE.coreAssertModuleExecutionAllowed(
        ctx.moduleName,
        ctx.flowName,
        normalizedCapability,
        {
          executionType: ctx.executionType
        }
      ) || {};
      result.allowed = true;
      result.dryRun = !!ctx.dryRun || !!decision.dryRun;
      result.reason = String(decision.reason || result.reason).trim() || result.reason;
      result.modeRead = String((decision.config && decision.config.mode) || result.modeRead).trim() || result.modeRead;
    } catch (err) {
      result.allowed = false;
      result.dryRun = false;
      result.reason = members_getOperationalErrorMessage_(err);
      members_markOperationalBlockedStatus_(
        ctx.flowName,
        "CONFIG_BLOCKED",
        result.reason,
        normalizedCapability,
        result.modeRead,
        {
          modeRead: result.modeRead,
          executionType: ctx.executionType
        }
      );
    }
  }

  ctx.capabilityDecisions[normalizedCapability] = Object.freeze(result);
  return ctx.capabilityDecisions[normalizedCapability];
}

/**
 * Decide se um efeito real deve ser pulado por bloqueio ou DRY_RUN.
 *
 * @param {string} capability
 * @param {string} effectName
 * @param {Object=} details
 * @return {Object}
 */
function members_shouldSkipOperationalSideEffect_(capability, effectName, details) {
  var decision = members_checkOperationalCapability_(capability);
  var payload = {
    effect: String(effectName || "").trim(),
    capability: members_normalizeOperationalKey_(capability || ""),
    reason: decision.reason,
    modeRead: decision.modeRead
  };

  if (details && typeof details === "object") {
    Object.keys(details).forEach(function(key) {
      payload[key] = details[key];
    });
  }

  if (!decision.allowed) {
    Logger.log("[geapa-membros][operacional][EFEITO_BLOQUEADO] " + JSON.stringify(payload));
    return Object.freeze({
      skip: true,
      blocked: true,
      dryRun: false,
      reason: decision.reason,
      modeRead: decision.modeRead
    });
  }

  if (decision.dryRun) {
    Logger.log("[geapa-membros][operacional][DRY_RUN] " + JSON.stringify(payload));
    return Object.freeze({
      skip: true,
      blocked: false,
      dryRun: true,
      reason: decision.reason,
      modeRead: decision.modeRead
    });
  }

  return Object.freeze({
    skip: false,
    blocked: false,
    dryRun: false,
    reason: decision.reason,
    modeRead: decision.modeRead
  });
}
