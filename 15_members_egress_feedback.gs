/** Avaliacao voluntaria e separada do egresso, habilitada somente em DEV/HOMOLOG. */

var MEMBERS_EGRESS_INVITES_HEADERS = Object.freeze([
  'ID_CONVITE','ID_EVENTO_DESLIGAMENTO','ID_SOLICITACAO','ID_PESSOA',
  'EMAIL_DESTINO_SNAPSHOT','TOKEN_HASH','STATUS_CONVITE','CONVITE_GERADO_EM',
  'CONVITE_ENVIADO_EM','EXPIRA_EM','RESPONDIDO_EM','REENVIOS','ULTIMO_REENVIO_EM',
  'CRIADO_EM','ATUALIZADO_EM','AUDITORIA_JSON'
]);
var MEMBERS_EGRESS_RESPONSES_HEADERS = Object.freeze([
  'ID_RESPOSTA','ID_CONVITE','NOTA_GERAL','ASPECTOS_POSITIVOS','ASPECTOS_A_MELHORAR',
  'SUGESTOES','MOTIVO_DESLIGAMENTO_COMPLEMENTAR','AUTORIZA_USO_ANONIMO',
  'DEPOIMENTO_AUTORIZADO','RESPONDIDO_EM','VERSAO_FORMULARIO','CRIADO_EM','AUDITORIA_JSON'
]);

function membersEgressFeatureEnabled_(context) {
  var environment = membersVinculoEnvironment_(context || {});
  var flags = context && context.featureFlags || {};
  if (environment !== 'DEV' || flags.ENABLE_EGRESS_FEEDBACK !== true) {
    throw membersVinculoError_('AVALIACAO_EGRESSO_INDISPONIVEL', 'A avaliacao de egresso nao esta disponivel.', {});
  }
  return environment;
}

function membersEgressHash_(value, deps) {
  if (deps && typeof deps.hash === 'function') return String(deps.hash(String(value || '')));
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value || ''), Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '');
}

function membersEgressToken_(deps) {
  var first = String(deps.uuid()).replace(/-/g, '');
  var second = String(deps.uuid()).replace(/-/g, '');
  return first + second;
}

function membersEgressConstantTimeEqual_(left, right) {
  var a = String(left || ''); var b = String(right || '');
  var mismatch = a.length ^ b.length; var length = Math.max(a.length, b.length);
  for (var i = 0; i < length; i++) mismatch |= (a.charCodeAt(i % (a.length || 1)) || 0) ^ (b.charCodeAt(i % (b.length || 1)) || 0);
  return mismatch === 0;
}

function membersEgressAppend_(source, headers, record) {
  membersVinculoRequireHeaders_(source, headers);
  if (source.records && !source.sheet.appendRow) {
    var copy = Object.assign({ __rowNumber: source.records.length + 2 }, record); source.records.push(copy); return copy;
  }
  source.sheet.appendRow(source.headers.map(function(header) { return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : ''; }));
  return record;
}

function membersEgressUpdate_(source, record, changes) {
  if (source.records && !source.sheet.getRange) { Object.assign(record, changes); return record; }
  return membersVinculoUpdate_(source, record, changes);
}

function membersEgressExpiry_(now) {
  var expires = new Date(now.getTime()); expires.setDate(expires.getDate() + 30); return expires;
}

function membersEgressBuildMailContract_(invite, rawToken, recipient, environment) {
  var baseUrl = '';
  if (typeof GEAPA_CORE !== 'undefined' && GEAPA_CORE && typeof GEAPA_CORE.coreMailGetConfigList === 'function') {
    var configured = GEAPA_CORE.coreMailGetConfigList('MEMBROS_EGRESS_FEEDBACK_BASE_URL_' + environment) || [];
    baseUrl = String(configured[0] || '').trim();
  }
  if (!baseUrl) throw membersVinculoError_('AVALIACAO_EGRESSO_URL_INDISPONIVEL', 'A URL institucional da avaliacao nao esta configurada.', {});
  return {
    module: 'GEAPA_MEMBROS', eventType: 'CONVITE_AVALIACAO_EGRESSO',
    entityId: invite.ID_CONVITE, idempotencyKey: invite.ID_CONVITE + ':ENVIO:' + String(invite.REENVIOS || 0),
    to: [recipient], subject: 'Convite voluntario para avaliar sua experiencia no GEAPA',
    textBody: 'Seu desligamento foi concluido. Agradecemos sua participacao no GEAPA. Caso se sinta confortavel, conte-nos como foi sua experiencia no grupo. A resposta e voluntaria e nao interfere em qualquer registro ou direito.\n\n' + baseUrl.replace(/\/$/, '') + '/#/avaliacao-egresso?token=' + encodeURIComponent(rawToken)
  };
}

function membersEgressQueueMail_(invite, rawToken, environment, deps) {
  if (deps && typeof deps.queueEgressMail === 'function') return deps.queueEgressMail(invite, rawToken, environment);
  if (typeof GEAPA_CORE === 'undefined' || !GEAPA_CORE || typeof GEAPA_CORE.coreMailQueueOutgoing !== 'function') {
    throw membersVinculoError_('MAIL_HUB_INDISPONIVEL', 'O Mail Hub esta indisponivel.', {});
  }
  return GEAPA_CORE.coreMailQueueOutgoing(membersEgressBuildMailContract_(invite, rawToken, invite.EMAIL_DESTINO_SNAPSHOT, environment));
}

function membersEgressRegisterInvitationBestEffort_(ctx, request, deps) {
  try {
    if (!ctx || ctx.environment !== 'DEV') throw membersVinculoError_('AVALIACAO_EGRESSO_INDISPONIVEL', 'A avaliacao de egresso nao esta disponivel.', {});
    if (membersVinculoToken_(request.STATUS_SOLICITACAO) !== 'EXECUTADO') throw membersVinculoError_('AVALIACAO_EGRESSO_DESLIGAMENTO_NAO_EXECUTADO', 'O convite exige desligamento executado.', {});
    var links = deps.openSource('PESSOAS', 'VINCULOS', ctx.environment, false).records.filter(function(row) { return String(row.ID_VINCULO || '') === String(request.ID_VINCULO || ''); });
    if (links.length !== 1 || membersVinculoToken_(links[0].STATUS_VINCULO) !== 'DESLIGADO') throw membersVinculoError_('AVALIACAO_EGRESSO_VINCULO_NAO_DESLIGADO', 'O vinculo ainda nao esta desligado.', {});
    var events = deps.openSource('PESSOAS', 'EVENTOS', ctx.environment, false).records.filter(function(row) {
      return String(row.ID_EVENTO_MEMBRO || '') === String(request.ID_EVENTO_DESLIGAMENTO || '') && membersVinculoToken_(row.TIPO_EVENTO) === 'DESLIGAMENTO_VOLUNTARIO' && membersVinculoToken_(row.STATUS_EVENTO) === 'HOMOLOGADO';
    });
    if (events.length !== 1) throw membersVinculoError_('AVALIACAO_EGRESSO_EVENTO_INDISPONIVEL', 'O evento homologado de desligamento nao foi localizado.', {});
    var source = deps.openSource('PESSOAS', 'CONVITES_AVALIACAO_EGRESSOS', ctx.environment, true);
    var existing = source.records.filter(function(row) { return String(row.ID_EVENTO_DESLIGAMENTO || '') === String(request.ID_EVENTO_DESLIGAMENTO || ''); });
    if (existing.length) return { ok: true, idempotente: true, convite: existing[0] };
    var people = deps.openSource('PESSOAS', 'BASE', ctx.environment, false).records.filter(function(row) { return String(row.ID_PESSOA || '') === String(request.ID_PESSOA || ''); });
    var recipient = String(people[0] && (people[0].EMAIL_PRINCIPAL || people[0].EMAIL) || '').trim().toLowerCase();
    if (!recipient) throw membersVinculoError_('AVALIACAO_EGRESSO_EMAIL_AUSENTE', 'E-mail oficial do egresso indisponivel.', {});
    var rawToken = membersEgressToken_(deps); var now = ctx.now;
    var invite = membersEgressAppend_(source, MEMBERS_EGRESS_INVITES_HEADERS, {
      ID_CONVITE: 'CVE-' + String(deps.uuid()).replace(/-/g, '').toUpperCase(),
      ID_EVENTO_DESLIGAMENTO: request.ID_EVENTO_DESLIGAMENTO, ID_SOLICITACAO: request.ID_SOLICITACAO,
      ID_PESSOA: request.ID_PESSOA, EMAIL_DESTINO_SNAPSHOT: recipient, TOKEN_HASH: membersEgressHash_(rawToken, deps),
      STATUS_CONVITE: 'PENDENTE_ENVIO', CONVITE_GERADO_EM: now, CONVITE_ENVIADO_EM: '', EXPIRA_EM: membersEgressExpiry_(now),
      RESPONDIDO_EM: '', REENVIOS: 0, ULTIMO_REENVIO_EM: '', CRIADO_EM: now, ATUALIZADO_EM: now,
      AUDITORIA_JSON: JSON.stringify([{ acao: 'CONVITE_GERADO', em: now, por: ctx.actor }])
    });
    try {
      var queued = membersEgressQueueMail_(invite, rawToken, ctx.environment, deps);
      if (!queued || queued.ok !== true) throw membersVinculoError_('MAIL_HUB_NAO_CONFIRMOU', 'O Mail Hub nao confirmou o convite.', {});
      membersEgressUpdate_(source, invite, { STATUS_CONVITE: 'ENVIADO', CONVITE_ENVIADO_EM: now, ATUALIZADO_EM: now });
    } catch (mailError) {
      membersEgressUpdate_(source, invite, { STATUS_CONVITE: 'ERRO_ENVIO', ATUALIZADO_EM: now, AUDITORIA_JSON: JSON.stringify([{ acao: 'ERRO_ENVIO', em: now, codigo: mailError.code || 'ERRO_ENVIO' }]) });
    }
    return { ok: true, idempotente: false, convite: invite };
  } catch (error) {
    return { ok: false, code: error.code || 'CONVITE_AVALIACAO_EGRESSO_NAO_CRIADO', message: error.message };
  }
}

function membersEgressFindByToken_(source, rawToken, deps) {
  var hash = membersEgressHash_(rawToken, deps); var matches = source.records.filter(function(row) { return membersEgressConstantTimeEqual_(row.TOKEN_HASH, hash); });
  if (matches.length !== 1) throw membersVinculoError_('CONVITE_AVALIACAO_INVALIDO', 'Convite invalido ou indisponivel.', {});
  return matches[0];
}

function membersAvaliacaoEgressoConsultarPorToken(payload, contexto) {
  var deps = membersVinculoDependencies_(contexto || {}); var requestId = membersVinculoRequestId_(contexto || {}, deps);
  try {
    var environment = membersEgressFeatureEnabled_(contexto || {});
    var token = String(payload && payload.token || '').trim(); if (token.length < 32) throw membersVinculoError_('CONVITE_AVALIACAO_INVALIDO', 'Convite invalido ou indisponivel.', {});
    var invite = membersEgressFindByToken_(deps.openSource('PESSOAS', 'CONVITES_AVALIACAO_EGRESSOS', environment, false), token, deps);
    var status = membersVinculoToken_(invite.STATUS_CONVITE);
    if (status === 'RESPONDIDO') throw membersVinculoError_('CONVITE_AVALIACAO_RESPONDIDO', 'Esta avaliacao ja foi respondida.', {});
    if (status === 'CANCELADO') throw membersVinculoError_('CONVITE_AVALIACAO_INVALIDO', 'Convite invalido ou indisponivel.', {});
    if (invite.EXPIRA_EM && new Date(invite.EXPIRA_EM).getTime() < deps.now().getTime()) throw membersVinculoError_('CONVITE_AVALIACAO_EXPIRADO', 'Este convite expirou.', {});
    return membersVinculoEnvelopeOk_('CONVITE_AVALIACAO_VALIDO', 'Convite valido.', { versaoFormulario: '1' }, requestId);
  } catch (error) { return membersVinculoEnvelopeError_(error, requestId); }
}

function membersAvaliacaoEgressoResponder(payload, contexto) {
  var deps = membersVinculoDependencies_(contexto || {}); var requestId = membersVinculoRequestId_(contexto || {}, deps);
  try {
    var environment = membersEgressFeatureEnabled_(contexto || {});
    return deps.withLock('RESPONDER_AVALIACAO_EGRESSO', function() {
      var invites = deps.openSource('PESSOAS', 'CONVITES_AVALIACAO_EGRESSOS', environment, true);
      var invite = membersEgressFindByToken_(invites, String(payload && payload.token || '').trim(), deps);
      if (membersVinculoToken_(invite.STATUS_CONVITE) === 'RESPONDIDO') throw membersVinculoError_('CONVITE_AVALIACAO_RESPONDIDO', 'Esta avaliacao ja foi respondida.', {});
      if (invite.EXPIRA_EM && new Date(invite.EXPIRA_EM).getTime() < deps.now().getTime()) throw membersVinculoError_('CONVITE_AVALIACAO_EXPIRADO', 'Este convite expirou.', {});
      var note = Number(payload && payload.notaGeral); if (note < 1 || note > 5 || Math.floor(note) !== note) throw membersVinculoError_('NOTA_GERAL_INVALIDA', 'Informe uma nota de 1 a 5.', {});
      var responses = deps.openSource('PESSOAS', 'RESPOSTAS_AVALIACAO_EGRESSOS', environment, true);
      if (responses.records.some(function(row) { return String(row.ID_CONVITE || '') === String(invite.ID_CONVITE || ''); })) throw membersVinculoError_('CONVITE_AVALIACAO_RESPONDIDO', 'Esta avaliacao ja foi respondida.', {});
      var now = deps.now();
      membersEgressAppend_(responses, MEMBERS_EGRESS_RESPONSES_HEADERS, {
        ID_RESPOSTA: 'RAE-' + String(deps.uuid()).replace(/-/g, '').toUpperCase(), ID_CONVITE: invite.ID_CONVITE,
        NOTA_GERAL: note, ASPECTOS_POSITIVOS: String(payload.aspectosPositivos || '').trim().slice(0, 3000),
        ASPECTOS_A_MELHORAR: String(payload.aspectosAMelhorar || '').trim().slice(0, 3000), SUGESTOES: String(payload.sugestoes || '').trim().slice(0, 3000),
        MOTIVO_DESLIGAMENTO_COMPLEMENTAR: String(payload.motivoDesligamentoComplementar || '').trim().slice(0, 1500),
        AUTORIZA_USO_ANONIMO: payload.autorizaUsoAnonimo === true ? 'SIM' : 'NAO', DEPOIMENTO_AUTORIZADO: String(payload.depoimentoAutorizado || '').trim().slice(0, 3000),
        RESPONDIDO_EM: now, VERSAO_FORMULARIO: '1', CRIADO_EM: now,
        AUDITORIA_JSON: JSON.stringify([{ acao: 'RESPOSTA_REGISTRADA', em: now }])
      });
      membersEgressUpdate_(invites, invite, { STATUS_CONVITE: 'RESPONDIDO', RESPONDIDO_EM: now, ATUALIZADO_EM: now });
      return membersVinculoEnvelopeOk_('AVALIACAO_EGRESSO_REGISTRADA', 'Obrigado por compartilhar sua experiencia.', {}, requestId);
    });
  } catch (error) { return membersVinculoEnvelopeError_(error, requestId); }
}

function membersAdminAvaliacoesEgressosResumo(payload, contexto) {
  var deps = membersVinculoDependencies_(contexto || {}); var requestId = membersVinculoRequestId_(contexto || {}, deps);
  try {
    var environment = membersEgressFeatureEnabled_(contexto || {});
    var session = membersVinculoResolveSession_(contexto || {}, deps, MEMBERS_VINCULO_CFG.permissions.feedbackRead);
    var rows = deps.openSource('PESSOAS', 'RESPOSTAS_AVALIACAO_EGRESSOS', environment, false).records;
    var notes = rows.map(function(row) { return Number(row.NOTA_GERAL); }).filter(function(note) { return note >= 1 && note <= 5; });
    var authorized = rows.filter(function(row) { return membersVinculoIsYes_(row.AUTORIZA_USO_ANONIMO); }).map(function(row) {
      return { depoimento: String(row.DEPOIMENTO_AUTORIZADO || '').trim(), aspectosPositivos: String(row.ASPECTOS_POSITIVOS || '').trim(), sugestoes: String(row.SUGESTOES || '').trim() };
    });
    return membersVinculoEnvelopeOk_('AVALIACOES_EGRESSOS_RESUMO', 'Resultados agregados carregados.', {
      totalRespostas: rows.length, notaMedia: notes.length ? notes.reduce(function(sum, note) { return sum + note; }, 0) / notes.length : null,
      distribuicaoNotas: [1,2,3,4,5].map(function(note) { return { nota: note, quantidade: notes.filter(function(item) { return item === note; }).length }; }),
      trechosAutorizadosAnonimos: authorized, acessoIdentificado: membersVinculoHasPermission_(session, MEMBERS_VINCULO_CFG.permissions.feedbackIdentify)
    }, requestId);
  } catch (error) { return membersVinculoEnvelopeError_(error, requestId); }
}

function membersAdminAvaliacaoEgressoDetalheIdentificado(payload, contexto) {
  var deps = membersVinculoDependencies_(contexto || {}); var requestId = membersVinculoRequestId_(contexto || {}, deps);
  try {
    var environment = membersEgressFeatureEnabled_(contexto || {});
    var session = membersVinculoResolveSession_(contexto || {}, deps, MEMBERS_VINCULO_CFG.permissions.feedbackIdentify);
    var responses = deps.openSource('PESSOAS', 'RESPOSTAS_AVALIACAO_EGRESSOS', environment, false).records.filter(function(row) { return String(row.ID_RESPOSTA || '') === String(payload && payload.idResposta || ''); });
    if (responses.length !== 1) throw membersVinculoError_('AVALIACAO_EGRESSO_NAO_ENCONTRADA', 'A avaliacao nao foi localizada.', {});
    var response = responses[0];
    var invites = deps.openSource('PESSOAS', 'CONVITES_AVALIACAO_EGRESSOS', environment, true);
    var invite = invites.records.filter(function(row) { return String(row.ID_CONVITE || '') === String(response.ID_CONVITE || ''); })[0];
    if (!invite) throw membersVinculoError_('CONVITE_AVALIACAO_INVALIDO', 'O vinculo da avaliacao esta indisponivel.', {});
    membersEgressUpdate_(invites, invite, { ATUALIZADO_EM: deps.now(), AUDITORIA_JSON: membersVinculoAuditAppend_(invite, { acao: 'ACESSO_IDENTIFICADO_AVALIACAO_EGRESSO', em: deps.now(), por: session.idPessoa, requestId: requestId }) });
    var safeResponse = Object.assign({}, response); delete safeResponse.__rowNumber; delete safeResponse.AUDITORIA_JSON;
    return membersVinculoEnvelopeOk_('AVALIACAO_EGRESSO_DETALHE_IDENTIFICADO', 'Detalhe autorizado carregado.', {
      resposta: safeResponse, convite: { idConvite: invite.ID_CONVITE, idPessoa: invite.ID_PESSOA, emailMascarado: membersVinculoMaskEmail_(invite.EMAIL_DESTINO_SNAPSHOT) }
    }, requestId);
  } catch (error) { return membersVinculoEnvelopeError_(error, requestId); }
}

function membersAdminAvaliacaoEgressoReenviarConvite(payload, contexto) {
  var deps = membersVinculoDependencies_(contexto || {}); var requestId = membersVinculoRequestId_(contexto || {}, deps);
  try {
    var environment = membersEgressFeatureEnabled_(contexto || {});
    var session = membersVinculoResolveSession_(contexto || {}, deps, MEMBERS_VINCULO_CFG.permissions.feedbackRead);
    return deps.withLock('REENVIAR_CONVITE_AVALIACAO_EGRESSO', function() {
      var source = deps.openSource('PESSOAS', 'CONVITES_AVALIACAO_EGRESSOS', environment, true);
      var matches = source.records.filter(function(row) { return String(row.ID_CONVITE || '') === String(payload && payload.idConvite || ''); });
      if (matches.length !== 1) throw membersVinculoError_('CONVITE_AVALIACAO_INVALIDO', 'Convite invalido ou indisponivel.', {});
      var invite = matches[0];
      if (membersVinculoToken_(invite.STATUS_CONVITE) === 'RESPONDIDO') throw membersVinculoError_('CONVITE_AVALIACAO_RESPONDIDO', 'Esta avaliacao ja foi respondida.', {});
      var token = membersEgressToken_(deps); var now = deps.now(); var retries = Number(invite.REENVIOS || 0) + 1;
      membersEgressUpdate_(source, invite, { TOKEN_HASH: membersEgressHash_(token, deps), STATUS_CONVITE: 'PENDENTE_ENVIO', EXPIRA_EM: membersEgressExpiry_(now), REENVIOS: retries, ULTIMO_REENVIO_EM: now, ATUALIZADO_EM: now });
      var queued = membersEgressQueueMail_(invite, token, environment, deps);
      if (!queued || queued.ok !== true) {
        membersEgressUpdate_(source, invite, { STATUS_CONVITE: 'ERRO_ENVIO', ATUALIZADO_EM: now });
        throw membersVinculoError_('NOTIFICACAO_NAO_ENVIADA', 'O convite nao foi enfileirado; tente o reprocessamento mais tarde.', {});
      }
      membersEgressUpdate_(source, invite, { STATUS_CONVITE: 'ENVIADO', CONVITE_ENVIADO_EM: now, ATUALIZADO_EM: now, AUDITORIA_JSON: membersVinculoAuditAppend_(invite, { acao: 'CONVITE_REENVIADO', em: now, por: session.idPessoa, requestId: requestId }) });
      return membersVinculoEnvelopeOk_('CONVITE_AVALIACAO_REENVIADO', 'Convite reenviado.', { idConvite: invite.ID_CONVITE, reenvios: retries }, requestId);
    });
  } catch (error) { return membersVinculoEnvelopeError_(error, requestId); }
}
