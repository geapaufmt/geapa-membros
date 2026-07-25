/** Cadastro administrativo de pessoas cujo ingresso ja foi formalmente aprovado. */

var MEMBERS_INGRESS_PERMISSION = 'membros:cadastrar_novos_membros';
var MEMBERS_INGRESS_OPEN_STATUSES = Object.freeze(['RECEBIDO','VALIDANDO','EXECUTANDO','ERRO_EXECUCAO']);
var MEMBERS_INGRESS_FORMS = Object.freeze(['PROCESSO_SELETIVO','CONVITE_DIRETORIA','TRANSFERENCIA_INTERNA','OUTRO']);

function membersIngressFeatureEnabled_(context) {
  var environment = membersVinculoEnvironment_(context || {}); var flags = context && context.featureFlags || {};
  if (environment !== 'DEV' || flags.ENABLE_MEMBER_REGISTRATION !== true) throw membersVinculoError_('CADASTRO_MEMBRO_INDISPONIVEL', 'O cadastro administrativo de membros nao esta disponivel.', {});
  return environment;
}

function membersIngressDependencies_(context) {
  var base = membersVinculoDependencies_(context || {}); var injected = context && context.__deps || {};
  base.validateCourse = injected.validateCourse || function(payload, rows) {
    if (!GEAPA_CORE || typeof GEAPA_CORE.geapaCoreValidarCursoV2 !== 'function') throw membersVinculoError_('CORE_CURSO_INDISPONIVEL', 'A validacao de curso esta indisponivel.', {});
    return GEAPA_CORE.geapaCoreValidarCursoV2(payload, rows);
  };
  base.calculateAcademicSemester = injected.calculateAcademicSemester || function(rga, rows, date) {
    if (!GEAPA_CORE || typeof GEAPA_CORE.geapaCoreCalcularSemestreCursoV2 !== 'function') throw membersVinculoError_('CORE_SEMESTRE_CURSO_INDISPONIVEL', 'O calculo academico esta indisponivel.', {});
    return GEAPA_CORE.geapaCoreCalcularSemestreCursoV2(rga, rows, date);
  };
  base.validateOrigin = injected.validateOrigin || function(payload) {
    if (!GEAPA_CORE || typeof GEAPA_CORE.geapaCoreValidarOrigemV2 !== 'function') throw membersVinculoError_('CORE_ORIGEM_INDISPONIVEL', 'A validacao de origem esta indisponivel.', {});
    return GEAPA_CORE.geapaCoreValidarOrigemV2(payload);
  };
  base.queueIngressMail = injected.queueIngressMail || membersIngressQueueMail_;
  return base;
}

function membersIngressNormalizeEmail_(value) {
  var email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw membersVinculoError_('EMAIL_PRINCIPAL_INVALIDO', 'Informe um e-mail principal valido.', {});
  return email;
}

function membersIngressNormalizeRga_(value) {
  var rga = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (rga.length < 5 || rga.length > 30) throw membersVinculoError_('RGA_INVALIDO', 'Informe um RGA valido.', {}); return rga;
}

function membersIngressNormalizeKey_(value) {
  var key = String(value || '').trim(); if (!/^[A-Za-z0-9._:-]{8,120}$/.test(key)) throw membersVinculoError_('CHAVE_IDEMPOTENCIA_INVALIDA', 'A chave de idempotencia e invalida.', {}); return key;
}

function membersIngressRejectActor_(payload) {
  var forbidden = ['ID_PESSOA','idPessoa','ID_VINCULO','idVinculo','CRIADO_POR','criadoPor','EXECUTADO_POR','executadoPor','ATOR','ator','SEMESTRE_ATUAL','semestreAtual','SEMESTRE_ATUAL_CURSO_CALCULADO','semestreAtualCursoCalculado','PERIODO_INGRESSO_CURSO','periodoIngressoCurso'];
  var found = forbidden.filter(function(key) { return payload && Object.prototype.hasOwnProperty.call(payload, key); });
  if (found.length) throw membersVinculoError_('ATOR_OU_IDS_NAO_PERMITIDOS', 'O navegador nao pode definir ator ou IDs internos.', { camposRejeitados: found });
}

function membersIngressAppend_(source, record) {
  var missing = Object.keys(record).filter(function(header) { return header !== '__rowNumber' && source.headers.indexOf(header) < 0; });
  if (missing.length) throw membersVinculoError_('INGRESSO_CABECALHOS_AUSENTES', 'A fonte V2 ainda nao esta preparada.', { cabecalhosAusentes: missing });
  var row = source.headers.map(function(header) { return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : ''; });
  source.sheet.getRange(source.sheet.getLastRow() + 1, 1, 1, source.headers.length).setValues([row]);
  record.__rowNumber = source.sheet.getLastRow(); source.records.push(record); return record;
}

function membersIngressFind_(records, field, value) {
  return (records || []).filter(function(row) { return String(row[field] || '').trim().toLowerCase() === String(value || '').trim().toLowerCase(); });
}

function membersIngressValidatePayload_(payload) {
  var source = payload || {}; membersIngressRejectActor_(source);
  var modality = membersVinculoToken_(source.modalidadeCadastro || 'RAPIDO');
  if (['RAPIDO','COMPLETO'].indexOf(modality) < 0) throw membersVinculoError_('MODALIDADE_CADASTRO_INVALIDA', 'Selecione cadastro rapido ou completo.', {});
  var name = String(source.nomeCompleto || '').trim().replace(/\s+/g, ' '); if (name.length < 5 || name.length > 180) throw membersVinculoError_('NOME_COMPLETO_INVALIDO', 'Informe o nome completo.', {});
  var ingressForm = membersVinculoToken_(source.formaIngresso); if (MEMBERS_INGRESS_FORMS.indexOf(ingressForm) < 0) throw membersVinculoError_('FORMA_INGRESSO_INVALIDA', 'Selecione uma forma de ingresso valida.', {});
  var date = membersVinculoCivilDate_(source.dataIngresso, 'DATA_INGRESSO_INVALIDA').iso;
  var geapaSemester = String(source.semestreEntrada || '').trim(); if (!geapaSemester) throw membersVinculoError_('SEMESTRE_ENTRADA_OBRIGATORIO', 'Informe o semestre de entrada no GEAPA.', {});
  return {
    chave: membersIngressNormalizeKey_(source.chaveIdempotencia), modalidade: modality, nome: name,
    nomeExibicao: String(source.nomeExibicao || '').trim().slice(0, 100), email: membersIngressNormalizeEmail_(source.emailPrincipal),
    telefone: String(source.telefone || '').replace(/[^0-9+]/g, '').slice(0, 20), rga: membersIngressNormalizeRga_(source.rga),
    cursoId: membersVinculoToken_(source.cursoId), cursoNomeOutro: String(source.cursoNomeOutro || '').trim(),
    instituicaoEnsino: String(source.instituicaoEnsino || '').trim(), campus: String(source.campus || '').trim(), nivelCurso: String(source.nivelCurso || '').trim(),
    dataIngresso: date, semestreEntrada: geapaSemester, formaIngresso: ingressForm,
    documentoReferencia: String(source.documentoReferencia || '').trim().slice(0, 300), observacao: String(source.observacaoAdministrativa || '').trim().slice(0, 1500),
    complementares: source.dadosComplementares && typeof source.dadosComplementares === 'object' ? source.dadosComplementares : {}
  };
}

function membersIngressAssertNoDuplicates_(sources, data, currentIngress) {
  var currentIngressId = currentIngress && currentIngress.ID_INGRESSO; var currentPersonId = currentIngress && currentIngress.ID_PESSOA;
  var peopleByEmail = sources.base.records.filter(function(row) { return String(row.ID_PESSOA || '') !== String(currentPersonId || '') && String(row.EMAIL_PRINCIPAL || row.EMAIL || '').trim().toLowerCase() === data.email; });
  if (peopleByEmail.length) throw membersVinculoError_('PESSOA_EXISTENTE_REQUER_FLUXO_REINGRESSO', 'A pessoa ja existe; utilize futuramente o fluxo de reingresso ou novo vinculo.', {});
  if (sources.identifiers.records.some(function(row) { return String(row.ID_PESSOA || '') !== String(currentPersonId || '') && membersVinculoToken_(row.TIPO_IDENTIFICADOR) === 'EMAIL' && String(row.VALOR_IDENTIFICADOR || '').trim().toLowerCase() === data.email && membersVinculoIsYes_(row.ATIVO); })) throw membersVinculoError_('EMAIL_DUPLICADO', 'O e-mail ja esta associado a outra pessoa.', {});
  if (sources.identifiers.records.some(function(row) { return String(row.ID_PESSOA || '') !== String(currentPersonId || '') && membersVinculoToken_(row.TIPO_IDENTIFICADOR) === 'RGA' && membersIngressNormalizeRga_(row.VALOR_IDENTIFICADOR) === data.rga && membersVinculoIsYes_(row.ATIVO); })) throw membersVinculoError_('RGA_DUPLICADO', 'O RGA ja esta associado a outra pessoa.', {});
  if (sources.details.records.some(function(row) { return String(row.ID_PESSOA || '') !== String(currentPersonId || '') && row.RGA && membersIngressNormalizeRga_(row.RGA) === data.rga; })) throw membersVinculoError_('RGA_DUPLICADO', 'O RGA ja esta associado a outra pessoa.', {});
  if (sources.queue.records.some(function(row) {
    return String(row.ID_INGRESSO || '') !== String(currentIngressId || '') && MEMBERS_INGRESS_OPEN_STATUSES.indexOf(membersVinculoToken_(row.STATUS_INGRESSO)) >= 0 && (String(row.EMAIL || '').trim().toLowerCase() === data.email || membersIngressNormalizeRga_(row.RGA) === data.rga);
  })) throw membersVinculoError_('INGRESSO_ABERTO_DUPLICADO', 'Ja existe um ingresso em andamento para este e-mail ou RGA.', {});
}

function membersIngressOpenSources_(deps, environment, forWrite) {
  return {
    queue: deps.openSource('PESSOAS', 'INGRESSOS_MEMBROS', environment, forWrite),
    base: deps.openSource('PESSOAS', 'BASE', environment, forWrite), identifiers: deps.openSource('PESSOAS', 'IDENTIFICADORES', environment, forWrite),
    details: deps.openSource('PESSOAS', 'MEMBROS_DETALHES', environment, forWrite), links: deps.openSource('PESSOAS', 'VINCULOS', environment, forWrite),
    events: deps.openSource('PESSOAS', 'EVENTOS', environment, forWrite), courses: deps.openSource('PESSOAS', 'CURSOS_CATALOGO', environment, false),
    semesters: deps.openSource('VIGENCIAS', 'SEMESTRES', environment, false)
  };
}

function membersIngressEnsureEntity_(source, idField, idValue, record) {
  var matches = membersIngressFind_(source.records, idField, idValue); if (matches.length > 1) throw membersVinculoError_('INGRESSO_ENTIDADE_DUPLICADA', 'A retomada encontrou entidade duplicada.', { campo: idField });
  return matches[0] || membersIngressAppend_(source, record);
}

function membersIngressQueueMail_(ingress, data, environment) {
  if (!GEAPA_CORE || typeof GEAPA_CORE.coreMailQueueOutgoing !== 'function' || typeof GEAPA_CORE.coreMailGetConfigList !== 'function') throw membersVinculoError_('MAIL_HUB_INDISPONIVEL', 'O Mail Hub esta indisponivel.', {});
  var urls = GEAPA_CORE.coreMailGetConfigList('PORTAL_HOMOLOG_URL') || []; var url = String(urls[0] || '').trim();
  if (!url) throw membersVinculoError_('PORTAL_HOMOLOG_URL_INDISPONIVEL', 'A URL do Portal HOMOLOG nao esta configurada.', {});
  return GEAPA_CORE.coreMailQueueOutgoing({ module: 'GEAPA_MEMBROS', eventType: 'CONVITE_NOVO_MEMBRO', entityId: ingress.ID_INGRESSO, idempotencyKey: ingress.ID_INGRESSO + ':CONVITE', to: [data.email], subject: 'Seu vinculo com o GEAPA foi registrado', textBody: 'Seu vinculo de membro efetivo ja esta ativo. Entre no Portal GEAPA com a mesma conta Google deste e-mail e complete seu perfil: ' + url });
}

function membersIngressExecute_(payload, contexto) {
  var deps = membersIngressDependencies_(contexto || {}); var requestId = membersVinculoRequestId_(contexto || {}, deps);
  try {
    var environment = membersIngressFeatureEnabled_(contexto || {}); var session = membersVinculoResolveSession_(contexto || {}, deps, MEMBERS_INGRESS_PERMISSION); var data = membersIngressValidatePayload_(payload || {});
    return deps.withLock('CADASTRAR_NOVO_MEMBRO_V2', function() {
      var sources = membersIngressOpenSources_(deps, environment, true);
      var idempotent = membersIngressFind_(sources.queue.records, 'CHAVE_IDEMPOTENCIA', data.chave);
      if (idempotent.length > 1) throw membersVinculoError_('INGRESSO_IDEMPOTENCIA_DUPLICADA', 'A fila possui chave de idempotencia duplicada.', {});
      var ingress = idempotent[0];
      if (ingress && (String(ingress.EMAIL || '').toLowerCase() !== data.email || membersIngressNormalizeRga_(ingress.RGA) !== data.rga)) throw membersVinculoError_('CHAVE_IDEMPOTENCIA_REUTILIZADA', 'A chave ja foi usada com outros dados.', {});
      if (ingress && membersVinculoToken_(ingress.STATUS_INGRESSO) === 'EXECUTADO') return membersVinculoEnvelopeOk_('INGRESSO_MEMBRO_JA_EXECUTADO', 'O cadastro ja havia sido concluido.', { idIngresso: ingress.ID_INGRESSO, idPessoa: ingress.ID_PESSOA, idempotente: true }, requestId);
      membersIngressAssertNoDuplicates_(sources, data, ingress);
      var warnings = sources.base.records.some(function(row) {
        return membersVinculoToken_(row.NOME_COMPLETO || row.NOME_EXIBICAO) === membersVinculoToken_(data.nome);
      }) ? [{ code: 'NOME_SEMELHANTE_ENCONTRADO', message: 'Existe cadastro com nome semelhante; confirme a identidade antes de prosseguir.' }] : [];
      var course = deps.validateCourse({ cursoId: data.cursoId, cursoNomeOutro: data.cursoNomeOutro, instituicaoEnsino: data.instituicaoEnsino, campus: data.campus, nivelCurso: data.nivelCurso }, sources.courses.records);
      var academic = deps.calculateAcademicSemester(data.rga, sources.semesters.records, deps.now());
      var origin = null; if (data.modalidade === 'COMPLETO' && data.complementares.paisOrigemCodigo) origin = deps.validateOrigin(data.complementares);
      var now = deps.now();
      if (!ingress) {
        var suffix = String(deps.uuid()).replace(/-/g, '').toUpperCase();
        ingress = membersIngressAppend_(sources.queue, {
          ID_INGRESSO: 'ING-' + suffix, CHAVE_IDEMPOTENCIA: data.chave, STATUS_INGRESSO: 'RECEBIDO', MODALIDADE_CADASTRO: data.modalidade,
          ID_PESSOA: 'PES-' + suffix, ID_VINCULO: 'VIN-' + suffix, ID_EVENTO_INGRESSO: 'EVM-' + suffix,
          EMAIL: data.email, RGA: data.rga, CURSO_ID: course.CURSO_ID, DATA_INGRESSO: data.dataIngresso, SEMESTRE_ENTRADA: data.semestreEntrada,
          FORMA_INGRESSO: data.formaIngresso, DOCUMENTO_REFERENCIA: data.documentoReferencia, OBS_ADMINISTRATIVA: data.observacao,
          ETAPA_EXECUCAO: 'RECEBIDO', ERRO_EXECUCAO: '', CRIADO_EM: now, CRIADO_POR: session.idPessoa,
          EXECUTADO_EM: '', EXECUTADO_POR: '', ATUALIZADO_EM: now, AUDITORIA_JSON: JSON.stringify([{ acao: 'INGRESSO_RECEBIDO', em: now, por: session.idPessoa, requestId: requestId }])
        });
      }
      try {
        membersVinculoUpdate_(sources.queue, ingress, { STATUS_INGRESSO: 'EXECUTANDO', ETAPA_EXECUCAO: 'CRIANDO_ENTIDADES', ERRO_EXECUCAO: '', ATUALIZADO_EM: now });
        var baseRecord = Object.assign({ ID_PESSOA: ingress.ID_PESSOA, NOME_COMPLETO: data.nome, NOME_EXIBICAO: data.nomeExibicao, EMAIL_PRINCIPAL: data.email, TELEFONE_PRINCIPAL: data.telefone, STATUS_CADASTRAL: 'PARCIAL', CRIADO_EM: now, ATUALIZADO_EM: now, ATIVO: 'SIM' }, origin || {});
        if (data.modalidade === 'COMPLETO') { baseRecord.DATA_NASCIMENTO = data.complementares.dataNascimento || ''; baseRecord.INSTAGRAM = data.complementares.instagram || ''; }
        membersIngressEnsureEntity_(sources.base, 'ID_PESSOA', ingress.ID_PESSOA, baseRecord);
        membersIngressEnsureEntity_(sources.identifiers, 'ID_IDENTIFICADOR', ingress.ID_INGRESSO + '-EMAIL', { ID_IDENTIFICADOR: ingress.ID_INGRESSO + '-EMAIL', ID_PESSOA: ingress.ID_PESSOA, TIPO_IDENTIFICADOR: 'EMAIL', VALOR_IDENTIFICADOR: data.email, PRINCIPAL: 'SIM', ATIVO: 'SIM', OBS: 'INGRESSO_MEMBRO_V2' });
        membersIngressEnsureEntity_(sources.identifiers, 'ID_IDENTIFICADOR', ingress.ID_INGRESSO + '-RGA', { ID_IDENTIFICADOR: ingress.ID_INGRESSO + '-RGA', ID_PESSOA: ingress.ID_PESSOA, TIPO_IDENTIFICADOR: 'RGA', VALOR_IDENTIFICADOR: data.rga, PRINCIPAL: 'SIM', ATIVO: 'SIM', OBS: 'INGRESSO_MEMBRO_V2' });
        membersIngressEnsureEntity_(sources.details, 'ID_PESSOA', ingress.ID_PESSOA, Object.assign({ ID_PESSOA: ingress.ID_PESSOA, RGA: data.rga, SEMESTRE_ENTRADA: data.semestreEntrada, PERIODO_INGRESSO_CURSO: academic.periodoIngressoCurso, SEMESTRE_ATUAL_CURSO_CALCULADO: academic.semestreAtualCalculado, SEMESTRE_ATUAL_CURSO_CALCULADO_EM: now, STATUS_COMPLETUDE_CADASTRAL: data.modalidade === 'COMPLETO' ? 'PARCIAL' : 'PENDENTE', COMPLETUDE_CADASTRAL_ATUALIZADA_EM: now, DATA_INTEGRACAO_ORIGINAL: now, ATUALIZADO_EM: now }, course));
        membersIngressEnsureEntity_(sources.links, 'ID_VINCULO', ingress.ID_VINCULO, { ID_VINCULO: ingress.ID_VINCULO, ID_PESSOA: ingress.ID_PESSOA, TIPO_VINCULO: 'MEMBRO_EFETIVO', STATUS_VINCULO: 'ATIVO', DATA_INICIO: data.dataIngresso, DATA_FIM: '', MOTIVO_INICIO: data.formaIngresso, MOTIVO_FIM: '', FONTE: 'GEAPA_MEMBROS_INGRESSO_V2', LINK_ATA_OU_PROCESSO: data.documentoReferencia, OBS_PUBLICA: '', OBS_INTERNA: data.observacao, ATIVO: 'SIM' });
        membersIngressEnsureEntity_(sources.events, 'ID_EVENTO_MEMBRO', ingress.ID_EVENTO_INGRESSO, { ID_EVENTO_MEMBRO: ingress.ID_EVENTO_INGRESSO, RGA: data.rga, ID_PESSOA: ingress.ID_PESSOA, ID_VINCULO: ingress.ID_VINCULO, TIPO_EVENTO: 'INGRESSO_MEMBRO', DATA_EVENTO: data.dataIngresso, STATUS_EVENTO: 'HOMOLOGADO', MODULO_ORIGEM: 'GEAPA_MEMBROS_INGRESSO_V2', CHAVE_ORIGEM: ingress.ID_INGRESSO, OBSERVACOES: data.observacao, ATUALIZADO_EM: now, PROCESSADO_POR_MODULO: session.idPessoa, DATA_PROCESSAMENTO: now, ERRO_PROCESSAMENTO: '' });
        deps.recalculateSummary(environment);
        membersVinculoUpdate_(sources.queue, ingress, { STATUS_INGRESSO: 'EXECUTADO', ETAPA_EXECUCAO: 'ENTIDADES_E_RESUMO_CONCLUIDOS', EXECUTADO_EM: now, EXECUTADO_POR: session.idPessoa, ATUALIZADO_EM: now });
        try {
          var mail = deps.queueIngressMail(ingress, data, environment);
          membersVinculoUpdate_(sources.queue, ingress, { ETAPA_EXECUCAO: mail && mail.ok === true ? 'CONVITE_ENFILEIRADO' : 'CONVITE_ERRO_ENVIO', ATUALIZADO_EM: now });
        } catch (mailError) { membersVinculoUpdate_(sources.queue, ingress, { ETAPA_EXECUCAO: 'CONVITE_ERRO_ENVIO', ERRO_EXECUCAO: 'CONVITE:' + (mailError.code || 'ERRO_ENVIO'), ATUALIZADO_EM: now }); }
        return membersVinculoEnvelopeOk_('INGRESSO_MEMBRO_EXECUTADO', 'O novo membro foi cadastrado e o vinculo esta ativo.', { idIngresso: ingress.ID_INGRESSO, idPessoa: ingress.ID_PESSOA, idVinculo: ingress.ID_VINCULO, status: 'EXECUTADO', conviteEnfileirado: ingress.ETAPA_EXECUCAO === 'CONVITE_ENFILEIRADO', avisos: warnings }, requestId, warnings);
      } catch (executionError) {
        membersVinculoUpdate_(sources.queue, ingress, { STATUS_INGRESSO: 'ERRO_EXECUCAO', ETAPA_EXECUCAO: ingress.ETAPA_EXECUCAO || 'ERRO', ERRO_EXECUCAO: (executionError.code || 'ERRO') + ': ' + executionError.message, ATUALIZADO_EM: deps.now() }); throw executionError;
      }
    });
  } catch (error) { return membersVinculoEnvelopeError_(error, requestId); }
}

function membersAdminIngressosMembrosCadastrar(payload, contexto) { return membersIngressExecute_(payload, contexto); }
function membersAdminIngressosMembrosReprocessar(payload, contexto) { return membersIngressExecute_(payload, contexto); }

function membersAdminIngressosMembrosCatalogos(payload, contexto) {
  var deps = membersIngressDependencies_(contexto || {}); var requestId = membersVinculoRequestId_(contexto || {}, deps);
  try {
    var environment = membersIngressFeatureEnabled_(contexto || {});
    membersVinculoResolveSession_(contexto || {}, deps, MEMBERS_INGRESS_PERMISSION);
    var source = deps.openSource('PESSOAS', 'CURSOS_CATALOGO', environment, false);
    var courses = (source.records || []).filter(function(row) {
      return membersVinculoIsYes_(row.ATIVO) && membersVinculoIsYes_(row.PERMITE_CADASTRO);
    }).map(function(row) {
      return {
        cursoId: String(row.CURSO_ID || '').trim(), nomeCurso: String(row.NOME_CURSO || '').trim(),
        instituicao: String(row.INSTITUICAO || '').trim(), campus: String(row.CAMPUS || '').trim(),
        nivel: String(row.NIVEL || '').trim(), ordemExibicao: Number(row.ORDEM_EXIBICAO || 9999)
      };
    }).filter(function(row) { return row.cursoId && row.nomeCurso; }).sort(function(a, b) {
      return a.ordemExibicao - b.ordemExibicao || a.nomeCurso.localeCompare(b.nomeCurso);
    });
    return membersVinculoEnvelopeOk_('CATALOGOS_INGRESSO_MEMBRO_OK', 'Catalogos disponiveis.', { cursos: courses }, requestId);
  } catch (error) { return membersVinculoEnvelopeError_(error, requestId); }
}
