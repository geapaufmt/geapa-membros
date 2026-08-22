/** Cadastro administrativo de pessoas cujo ingresso ja foi formalmente aprovado. */

var MEMBERS_INGRESS_PERMISSION = 'membros:cadastrar_novos_membros';
var MEMBERS_INGRESS_OPEN_STATUSES = Object.freeze([
  'RECEBIDO','VALIDADO','PESSOA_RESOLVIDA','DADOS_MEMBRO_ATUALIZADOS','VINCULO_CRIADO',
  'EVENTO_REGISTRADO','RESUMO_RECALCULADO','CONVITE_ENFILEIRADO','EXECUTANDO','ERRO_EXECUCAO'
]);
var MEMBERS_INGRESS_FORMS = Object.freeze(['PROCESSO_SELETIVO']);
var MEMBERS_INGRESS_ORIGINS = Object.freeze(['CADASTRO_INTERESSE','CADASTRO_MANUAL','SELETIVO_FECHADO']);
var MEMBERS_INGRESS_INTEREST_LINKS = Object.freeze(['INTERESSADO_ATIVIDADES','INTERESSADO','ACOMPANHANTE','PARTICIPANTE_EXTERNO']);
var MEMBERS_INGRESS_REGULAR_PERSON_SEQUENCE_LIMIT = 900000;

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

function membersIngressCanonicalRgaValue_(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Mantem o mesmo formato canonico adotado pelo perfil editavel do Core.
// A biblioteca Core atualmente consumida por Membros nao expoe estes normalizadores.
function membersIngressNormalizePhone_(value) {
  var raw = String(value == null ? '' : value).trim();
  if (!raw) return '';
  var digits = raw.replace(/\D+/g, '');
  if ((digits.length === 12 || digits.length === 13) && digits.indexOf('55') === 0) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) throw membersVinculoError_('TELEFONE_INVALIDO', 'Informe um telefone valido com DDD.', {});
  if (digits.length === 11 && digits.charAt(2) !== '9') throw membersVinculoError_('TELEFONE_INVALIDO', 'Informe um telefone celular valido com DDD.', {});
  return '+55' + digits;
}

function membersIngressNormalizeInstagram_(value) {
  var text = String(value == null ? '' : value).trim().replace(/^@+/, '').replace(/\s+/g, '');
  if (!text) return '';
  if (!/^[A-Za-z0-9._]{1,30}$/.test(text) || /\.\./.test(text)) throw membersVinculoError_('INSTAGRAM_INVALIDO', 'Informe somente o usuario valido do Instagram.', {});
  return text;
}

function membersIngressNormalizeBirthDate_(value) {
  if (value == null || String(value).trim() === '') return '';
  var parsed = membersVinculoCivilDate_(value, 'DATA_NASCIMENTO_INVALIDA');
  var today = membersVinculoToday_(new Date());
  if (parsed.year < 1900 || parsed.iso > today.iso) throw membersVinculoError_('DATA_NASCIMENTO_INVALIDA', 'Informe uma data de nascimento valida.', {});
  return parsed.iso;
}

function membersIngressNormalizeComplementary_(value) {
  var source = value && typeof value === 'object' ? value : {};
  return {
    dataNascimento: membersIngressNormalizeBirthDate_(source.dataNascimento || source.DATA_NASCIMENTO),
    instagram: membersIngressNormalizeInstagram_(source.instagram || source.INSTAGRAM),
    paisOrigemCodigo: String(source.paisOrigemCodigo || source.PAIS_ORIGEM_CODIGO || '').trim().toUpperCase(),
    municipioOrigemCodigo: String(source.municipioOrigemCodigo || source.MUNICIPIO_ORIGEM_CODIGO || '').replace(/\D/g, ''),
    cidadeNatal: String(source.cidadeNatal || source.cidadeOrigem || source.CIDADE_NATAL || '').trim().slice(0, 120),
    ufOrigem: String(source.ufOrigem || source.UF_ORIGEM || '').trim().toUpperCase(),
    regiaoOrigem: String(source.regiaoOrigem || source.REGIAO_ORIGEM || '').trim().slice(0, 120)
  };
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

/**
 * Reserva o proximo ID_PESSOA sequencial no padrao canonico PES-000001.
 * A chamada ocorre dentro do lock do ingresso e considera a base e a fila para
 * nao reutilizar um numero reservado por uma execucao parcial.
 */
function membersIngressNextPersonId_(sources) {
  var used = {};
  var max = 0;
  var records = []
    .concat((sources.base && sources.base.records) || [])
    .concat((sources.queue && sources.queue.records) || []);
  records.forEach(function(record) {
    var id = String(record.ID_PESSOA || '').trim().toUpperCase();
    if (id) used[id] = true;
    var match = id.match(/^PES-(\d+)$/);
    if (match && Number(match[1]) < MEMBERS_INGRESS_REGULAR_PERSON_SEQUENCE_LIMIT) {
      max = Math.max(max, Number(match[1]));
    }
  });
  do {
    max++;
    var sequence = String(max);
    while (sequence.length < 6) sequence = '0' + sequence;
    var candidate = 'PES-' + sequence;
  } while (used[candidate]);
  return candidate;
}

function membersIngressValidatePayload_(payload) {
  var source = payload || {}; membersIngressRejectActor_(source);
  var modality = membersVinculoToken_(source.modalidadeCadastro || 'RAPIDO');
  if (['RAPIDO','COMPLETO'].indexOf(modality) < 0) throw membersVinculoError_('MODALIDADE_CADASTRO_INVALIDA', 'Selecione cadastro rapido ou completo.', {});
  var name = String(source.nomeCompleto || '').trim().replace(/\s+/g, ' '); if (name.length < 5 || name.length > 180) throw membersVinculoError_('NOME_COMPLETO_INVALIDO', 'Informe o nome completo.', {});
  var ingressForm = membersVinculoToken_(source.formaIngresso); if (MEMBERS_INGRESS_FORMS.indexOf(ingressForm) < 0) throw membersVinculoError_('FORMA_INGRESSO_INVALIDA', 'Membro ingressante exige ingresso por PROCESSO_SELETIVO.', {});
  var registrationOrigin = membersVinculoToken_(source.origemCadastro); if (MEMBERS_INGRESS_ORIGINS.indexOf(registrationOrigin) < 0) throw membersVinculoError_('ORIGEM_CADASTRO_INVALIDA', 'Informe a origem administrativa do cadastro.', {});
  var date = membersVinculoCivilDate_(source.dataIngresso, 'DATA_INGRESSO_INVALIDA').iso;
  var geapaSemester = String(source.semestreEntrada || '').trim(); if (!geapaSemester) throw membersVinculoError_('SEMESTRE_ENTRADA_OBRIGATORIO', 'Informe o semestre de entrada no GEAPA.', {});
  var reference = String(source.documentoReferencia || '').trim().slice(0, 300);
  var note = String(source.observacaoAdministrativa || '').trim().slice(0, 1500);
  if (!reference && note.length < 20) throw membersVinculoError_('REFERENCIA_ADMISSAO_OBRIGATORIA', 'Informe o documento de aprovacao ou uma justificativa administrativa com ao menos 20 caracteres.', {});
  return {
    chave: membersIngressNormalizeKey_(source.chaveIdempotencia), modalidade: modality, nome: name,
    nomeExibicao: String(source.nomeExibicao || '').trim().slice(0, 100), email: membersIngressNormalizeEmail_(source.emailPrincipal),
    telefone: membersIngressNormalizePhone_(source.telefone), rga: membersIngressNormalizeRga_(source.rga),
    cursoId: membersVinculoToken_(source.cursoId), cursoNomeOutro: String(source.cursoNomeOutro || '').trim(),
    instituicaoEnsino: String(source.instituicaoEnsino || '').trim(), campus: String(source.campus || '').trim(), nivelCurso: String(source.nivelCurso || '').trim(),
    dataIngresso: date, semestreEntrada: geapaSemester, formaIngresso: ingressForm, origemCadastro: registrationOrigin,
    documentoReferencia: reference, observacao: note,
    complementares: membersIngressNormalizeComplementary_(source.dadosComplementares)
  };
}

function membersIngressAssertNoOpenDuplicate_(sources, data, currentIngress) {
  var currentIngressId = currentIngress && currentIngress.ID_INGRESSO;
  if (sources.queue.records.some(function(row) {
    var rowRga = membersIngressCanonicalRgaValue_(row.RGA);
    return String(row.ID_INGRESSO || '') !== String(currentIngressId || '') && MEMBERS_INGRESS_OPEN_STATUSES.indexOf(membersVinculoToken_(row.STATUS_INGRESSO)) >= 0 && (String(row.EMAIL || '').trim().toLowerCase() === data.email || rowRga === data.rga);
  })) throw membersVinculoError_('INGRESSO_ABERTO_DUPLICADO', 'Ja existe um ingresso em andamento para este e-mail ou RGA.', {});
}

function membersIngressResolveIdentity_(sources, data) {
  var candidates = {};
  function add(idPessoa, source) {
    var id = String(idPessoa || '').trim(); if (!id) return;
    if (!candidates[id]) candidates[id] = [];
    if (candidates[id].indexOf(source) < 0) candidates[id].push(source);
  }
  (sources.identifiers.records || []).forEach(function(row) {
    if (!membersVinculoIsYes_(row.ATIVO)) return;
    var type = membersVinculoToken_(row.TIPO_IDENTIFICADOR);
    var value = String(row.VALOR_IDENTIFICADOR || '').trim();
    if (type === 'RGA' && value && membersIngressCanonicalRgaValue_(value) === data.rga) add(row.ID_PESSOA, 'IDENTIFICADOR_RGA');
    if (type === 'EMAIL' && value.toLowerCase() === data.email) add(row.ID_PESSOA, 'IDENTIFICADOR_EMAIL');
  });
  (sources.base.records || []).forEach(function(row) {
    if (String(row.EMAIL_PRINCIPAL || row.EMAIL || '').trim().toLowerCase() === data.email) add(row.ID_PESSOA, 'PESSOAS_BASE_EMAIL');
  });
  (sources.details.records || []).forEach(function(row) {
    if (String(row.RGA || '').trim() && membersIngressCanonicalRgaValue_(row.RGA) === data.rga) add(row.ID_PESSOA, 'MEMBROS_DETALHES_RGA');
  });
  var ids = Object.keys(candidates);
  if (ids.length > 1) throw membersVinculoError_('IDENTIDADE_AMBIGUA_REVISAO_HUMANA', 'RGA e e-mail apontam para pessoas diferentes. Revise a identidade antes de admitir.', { quantidadeCandidatos: ids.length, fontesPorCandidato: candidates });
  return { idPessoa: ids[0] || '', pessoaExistente: ids.length === 1, fontes: ids.length ? candidates[ids[0]] : [] };
}

function membersIngressLinkActive_(row) {
  var status = membersVinculoToken_(row && row.STATUS_VINCULO);
  if (['INATIVO','INATIVA','ENCERRADO','ENCERRADA','CANCELADO','CANCELADA'].indexOf(status) >= 0) return false;
  return status === 'ATIVO' || status === 'ATIVA' || membersVinculoIsYes_(row && row.ATIVO);
}

function membersIngressResolveTransition_(sources, idPessoa) {
  var links = (sources.links.records || []).filter(function(row) { return String(row.ID_PESSOA || '').trim() === String(idPessoa || '').trim(); });
  var active = links.filter(membersIngressLinkActive_);
  var effective = active.filter(function(row) { return membersVinculoToken_(row.TIPO_VINCULO) === 'MEMBRO_EFETIVO'; });
  var incoming = active.filter(function(row) { return membersVinculoToken_(row.TIPO_VINCULO) === 'MEMBRO_INGRESSANTE'; });
  if (effective.length > 1 || incoming.length > 1) throw membersVinculoError_('VINCULO_ATIVO_DUPLICADO_REVISAO_HUMANA', 'A pessoa possui vinculos ativos duplicados e exige revisao humana.', {});
  if (effective.length) return { kind: 'BLOCK_EFFECTIVE', existingLink: effective[0], linksToClose: [] };
  if (incoming.length) return { kind: 'ALREADY_INCOMING', existingLink: incoming[0], linksToClose: [] };
  var waiting = active.filter(function(row) { return membersVinculoToken_(row.TIPO_VINCULO) === 'MEMBRO_EM_ESPERA'; });
  var interest = active.filter(function(row) { return MEMBERS_INGRESS_INTEREST_LINKS.indexOf(membersVinculoToken_(row.TIPO_VINCULO)) >= 0; });
  var former = links.some(function(row) { return membersVinculoToken_(row.TIPO_VINCULO) === 'EGRESSO'; });
  if (waiting.length) return { kind: 'PROMOTE_WAITING', eventType: 'PROMOCAO_MEMBRO_EM_ESPERA_PARA_INGRESSANTE', linksToClose: waiting };
  if (former) return { kind: 'REENTRY', eventType: 'REINGRESSO_COMO_MEMBRO_INGRESSANTE', linksToClose: active.filter(function(row) { return membersVinculoToken_(row.TIPO_VINCULO) === 'EGRESSO'; }) };
  if (interest.length) return { kind: 'FROM_INTEREST', eventType: 'INGRESSO_COMO_MEMBRO_INGRESSANTE', linksToClose: interest };
  return { kind: 'NEW_INCOMING', eventType: 'INGRESSO_COMO_MEMBRO_INGRESSANTE', linksToClose: [] };
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
  if (matches.length) {
    if (record.ID_PESSOA && String(matches[0].ID_PESSOA || '').trim() !== String(record.ID_PESSOA).trim()) {
      throw membersVinculoError_('INGRESSO_ENTIDADE_DIVERGENTE', 'A entidade da retomada pertence a outra pessoa.', { campo: idField });
    }
    if (record.TIPO_VINCULO && membersVinculoToken_(matches[0].TIPO_VINCULO) !== membersVinculoToken_(record.TIPO_VINCULO)) {
      throw membersVinculoError_('INGRESSO_ENTIDADE_DIVERGENTE', 'O vinculo da retomada possui tipo incompatível.', { campo: idField });
    }
    return matches[0];
  }
  return membersIngressAppend_(source, record);
}

function membersIngressAuditAppend_(ingress, action, now, actor, details) {
  var audit = [];
  try { audit = JSON.parse(String(ingress && ingress.AUDITORIA_JSON || '[]')); } catch (ignored) { audit = []; }
  if (!Array.isArray(audit)) audit = [];
  audit.push(Object.assign({ acao: action, em: now, por: actor }, details || {}));
  return JSON.stringify(audit);
}

function membersIngressTransitionFromAudit_(ingress) {
  var audit = [];
  try { audit = JSON.parse(String(ingress && ingress.AUDITORIA_JSON || '[]')); } catch (ignored) { audit = []; }
  for (var i = (Array.isArray(audit) ? audit.length : 0) - 1; i >= 0; i--) {
    if (audit[i] && audit[i].tipoTransicao) {
      return { kind: audit[i].tipoTransicao, eventType: audit[i].tipoEvento || 'INGRESSO_COMO_MEMBRO_INGRESSANTE', linksToClose: [] };
    }
  }
  return null;
}

function membersIngressRestoreTransition_(sources, idPessoa, savedTransition) {
  if (!savedTransition) return null;
  var links = (sources.links.records || []).filter(function(row) {
    return String(row.ID_PESSOA || '').trim() === String(idPessoa || '').trim() && membersIngressLinkActive_(row);
  });
  var kinds = {
    PROMOTE_WAITING: ['MEMBRO_EM_ESPERA'],
    FROM_INTEREST: MEMBERS_INGRESS_INTEREST_LINKS,
    REENTRY: ['EGRESSO']
  };
  var typesToClose = kinds[savedTransition.kind] || [];
  return {
    kind: savedTransition.kind,
    eventType: savedTransition.eventType,
    linksToClose: links.filter(function(row) { return typesToClose.indexOf(membersVinculoToken_(row.TIPO_VINCULO)) >= 0; })
  };
}

function membersIngressUpdateStage_(source, ingress, status, stage, now, actor, details) {
  return membersVinculoUpdate_(source, ingress, {
    STATUS_INGRESSO: status,
    ETAPA_EXECUCAO: stage,
    ERRO_EXECUCAO: '',
    ATUALIZADO_EM: now,
    AUDITORIA_JSON: membersIngressAuditAppend_(ingress, stage, now, actor, details)
  });
}

function membersIngressEnsurePerson_(sources, ingress, data, course, academic, origin, now) {
  var baseMatches = membersIngressFind_(sources.base.records, 'ID_PESSOA', ingress.ID_PESSOA);
  if (baseMatches.length > 1) throw membersVinculoError_('PESSOA_BASE_DUPLICADA', 'A pessoa possui registros duplicados em PESSOAS_BASE.', {});
  var baseRecord = Object.assign({
    ID_PESSOA: ingress.ID_PESSOA, NOME_COMPLETO: data.nome, NOME_EXIBICAO: data.nomeExibicao,
    EMAIL_PRINCIPAL: data.email, TELEFONE_PRINCIPAL: data.telefone, STATUS_CADASTRAL: 'PARCIAL',
    CRIADO_EM: now, ATUALIZADO_EM: now, ATIVO: 'SIM'
  }, origin || {});
  if (data.modalidade === 'COMPLETO') { baseRecord.DATA_NASCIMENTO = data.complementares.dataNascimento || ''; baseRecord.INSTAGRAM = data.complementares.instagram || ''; }
  if (baseMatches.length) {
    var baseChanges = { NOME_COMPLETO: data.nome, EMAIL_PRINCIPAL: data.email, ATUALIZADO_EM: now, ATIVO: 'SIM' };
    if (data.nomeExibicao) baseChanges.NOME_EXIBICAO = data.nomeExibicao;
    if (data.telefone) baseChanges.TELEFONE_PRINCIPAL = data.telefone;
    if (data.modalidade === 'COMPLETO' && data.complementares.dataNascimento) baseChanges.DATA_NASCIMENTO = data.complementares.dataNascimento;
    if (data.modalidade === 'COMPLETO' && data.complementares.instagram) baseChanges.INSTAGRAM = data.complementares.instagram;
    Object.keys(origin || {}).forEach(function(key) { if (origin[key]) baseChanges[key] = origin[key]; });
    membersVinculoUpdate_(sources.base, baseMatches[0], baseChanges);
  } else membersIngressAppend_(sources.base, baseRecord);

  membersIngressEnsureIdentifier_(sources.identifiers, ingress, 'EMAIL', data.email);
  membersIngressEnsureIdentifier_(sources.identifiers, ingress, 'RGA', data.rga);

  var detailsRecord = Object.assign({
    ID_PESSOA: ingress.ID_PESSOA, RGA: data.rga, SEMESTRE_ENTRADA: data.semestreEntrada,
    PERIODO_INGRESSO_CURSO: academic.periodoIngressoCurso,
    SEMESTRE_ATUAL_CURSO_CALCULADO: academic.semestreAtualCalculado,
    SEMESTRE_ATUAL_CURSO_CALCULADO_EM: now,
    STATUS_COMPLETUDE_CADASTRAL: data.modalidade === 'COMPLETO' ? 'PARCIAL' : 'PENDENTE',
    COMPLETUDE_CADASTRAL_ATUALIZADA_EM: now, DATA_INTEGRACAO_ORIGINAL: now, ATUALIZADO_EM: now
  }, course);
  var detailsMatches = membersIngressFind_(sources.details.records, 'ID_PESSOA', ingress.ID_PESSOA);
  if (detailsMatches.length > 1) throw membersVinculoError_('MEMBROS_DETALHES_DUPLICADO', 'A pessoa possui detalhes de membro duplicados.', {});
  if (detailsMatches.length) {
    if (detailsMatches[0].DATA_INTEGRACAO_ORIGINAL) detailsRecord.DATA_INTEGRACAO_ORIGINAL = detailsMatches[0].DATA_INTEGRACAO_ORIGINAL;
    membersVinculoUpdate_(sources.details, detailsMatches[0], detailsRecord);
  } else membersIngressAppend_(sources.details, detailsRecord);
}

function membersIngressEnsureIdentifier_(source, ingress, type, value) {
  var normalizedType = membersVinculoToken_(type);
  var normalizedValue = normalizedType === 'EMAIL' ? String(value || '').trim().toLowerCase() : membersIngressNormalizeRga_(value);
  var matches = (source.records || []).filter(function(row) {
    if (String(row.ID_PESSOA || '') !== String(ingress.ID_PESSOA || '')) return false;
    if (membersVinculoToken_(row.TIPO_IDENTIFICADOR) !== normalizedType) return false;
    var rowValue = normalizedType === 'EMAIL' ? String(row.VALOR_IDENTIFICADOR || '').trim().toLowerCase() : membersIngressCanonicalRgaValue_(row.VALOR_IDENTIFICADOR);
    return rowValue === normalizedValue;
  });
  if (matches.length > 1) throw membersVinculoError_('IDENTIFICADOR_DUPLICADO_REVISAO_HUMANA', 'A pessoa possui identificador duplicado.', { tipo: normalizedType });
  if (matches.length) return membersVinculoUpdate_(source, matches[0], { PRINCIPAL: 'SIM', ATIVO: 'SIM', OBS: 'INGRESSO_MEMBRO_INGRESSANTE_V2' });
  return membersIngressAppend_(source, {
    ID_IDENTIFICADOR: ingress.ID_INGRESSO + '-' + normalizedType,
    ID_PESSOA: ingress.ID_PESSOA, TIPO_IDENTIFICADOR: normalizedType,
    VALOR_IDENTIFICADOR: normalizedValue, PRINCIPAL: 'SIM', ATIVO: 'SIM', OBS: 'INGRESSO_MEMBRO_INGRESSANTE_V2'
  });
}

function membersIngressClosePriorLinks_(sources, transition, data, now) {
  (transition.linksToClose || []).forEach(function(link) {
    membersVinculoUpdate_(sources.links, link, {
      STATUS_VINCULO: 'ENCERRADO', DATA_FIM: data.dataIngresso,
      MOTIVO_FIM: 'Admissao como membro ingressante', ATIVO: 'NAO',
      OBS_INTERNA: [String(link.OBS_INTERNA || '').trim(), 'Encerrado pelo ingresso ' + data.origemCadastro].filter(Boolean).join(' | ')
    });
  });
}

function membersIngressQueueMail_(ingress, data, environment) {
  if (!GEAPA_CORE || typeof GEAPA_CORE.coreMailQueueOutgoing !== 'function' || typeof GEAPA_CORE.coreMailGetConfigList !== 'function') throw membersVinculoError_('MAIL_HUB_INDISPONIVEL', 'O Mail Hub esta indisponivel.', {});
  var urls = GEAPA_CORE.coreMailGetConfigList('PORTAL_HOMOLOG_URL') || []; var url = String(urls[0] || '').trim();
  if (!url) throw membersVinculoError_('PORTAL_HOMOLOG_URL_INDISPONIVEL', 'A URL do Portal HOMOLOG nao esta configurada.', {});
  return GEAPA_CORE.coreMailQueueOutgoing({ module: 'GEAPA_MEMBROS', eventType: 'CONVITE_MEMBRO_INGRESSANTE', entityId: ingress.ID_INGRESSO, idempotencyKey: ingress.ID_INGRESSO + ':CONVITE', to: [data.email], subject: 'Seu ingresso no GEAPA foi registrado', textBody: 'Seu vinculo de membro ingressante esta ativo. Voce esta em periodo de integracao. Entre no Portal GEAPA com a mesma conta Google deste e-mail e complete seu perfil: ' + url });
}

function membersIngressExecute_(payload, contexto) {
  var deps = membersIngressDependencies_(contexto || {}); var requestId = membersVinculoRequestId_(contexto || {}, deps);
  try {
    var environment = membersIngressFeatureEnabled_(contexto || {}); var session = membersVinculoResolveSession_(contexto || {}, deps, MEMBERS_INGRESS_PERMISSION); var data = membersIngressValidatePayload_(payload || {});
    return deps.withLock('ADMITIR_MEMBRO_INGRESSANTE_V2', function() {
      var sources = membersIngressOpenSources_(deps, environment, true);
      var idempotent = membersIngressFind_(sources.queue.records, 'CHAVE_IDEMPOTENCIA', data.chave);
      if (idempotent.length > 1) throw membersVinculoError_('INGRESSO_IDEMPOTENCIA_DUPLICADA', 'A fila possui chave de idempotencia duplicada.', {});
      var ingress = idempotent[0];
      if (ingress && (String(ingress.EMAIL || '').toLowerCase() !== data.email || membersIngressNormalizeRga_(ingress.RGA) !== data.rga)) throw membersVinculoError_('CHAVE_IDEMPOTENCIA_REUTILIZADA', 'A chave ja foi usada com outros dados.', {});
      if (ingress && membersVinculoToken_(ingress.STATUS_INGRESSO) === 'EXECUTADO') return membersVinculoEnvelopeOk_('INGRESSO_MEMBRO_JA_EXECUTADO', 'A admissao como membro ingressante ja havia sido concluida.', { idIngresso: ingress.ID_INGRESSO, tipoVinculo: 'MEMBRO_INGRESSANTE', idempotente: true }, requestId);
      membersIngressAssertNoOpenDuplicate_(sources, data, ingress);
      var warnings = sources.base.records.some(function(row) {
        return membersVinculoToken_(row.NOME_COMPLETO || row.NOME_EXIBICAO) === membersVinculoToken_(data.nome);
      }) ? [{ code: 'NOME_SEMELHANTE_ENCONTRADO', message: 'Existe cadastro com nome semelhante; confirme a identidade antes de prosseguir.' }] : [];
      var course = deps.validateCourse({ cursoId: data.cursoId, cursoNomeOutro: data.cursoNomeOutro, instituicaoEnsino: data.instituicaoEnsino, campus: data.campus, nivelCurso: data.nivelCurso }, sources.courses.records);
      var academic = deps.calculateAcademicSemester(data.rga, sources.semesters.records, deps.now());
      var origin = null; if (data.modalidade === 'COMPLETO' && data.complementares.paisOrigemCodigo) origin = deps.validateOrigin(data.complementares);
      var now = deps.now();
      var identity = membersIngressResolveIdentity_(sources, data);
      if (ingress && ingress.ID_PESSOA) {
        if (identity.idPessoa && String(identity.idPessoa) !== String(ingress.ID_PESSOA)) throw membersVinculoError_('INGRESSO_IDENTIDADE_DIVERGENTE', 'A identidade resolvida difere da retomada registrada.', {});
        if (!identity.idPessoa) identity = { idPessoa: String(ingress.ID_PESSOA), pessoaExistente: false, fontes: ['INGRESSOS_MEMBROS'] };
      }
      var savedTransition = membersIngressTransitionFromAudit_(ingress);
      var liveTransition = membersIngressResolveTransition_(sources, identity.idPessoa);
      if (savedTransition && liveTransition.kind === 'BLOCK_EFFECTIVE') savedTransition = null;
      if (savedTransition && liveTransition.kind === 'ALREADY_INCOMING' && String(liveTransition.existingLink.ID_VINCULO || '') !== String(ingress.ID_VINCULO || '')) {
        throw membersVinculoError_('VINCULO_INGRESSANTE_CONCORRENTE', 'Outro vinculo de membro ingressante foi criado durante a retomada. Revise antes de continuar.', {});
      }
      var transition = savedTransition ? membersIngressRestoreTransition_(sources, identity.idPessoa, savedTransition) : liveTransition;
      if (!ingress) {
        var suffix = String(deps.uuid()).replace(/-/g, '').toUpperCase();
        var idPessoa = identity.idPessoa || membersIngressNextPersonId_(sources);
        var idVinculo = transition.kind === 'ALREADY_INCOMING' ? String(transition.existingLink.ID_VINCULO || '') : 'VIN-' + suffix;
        ingress = membersIngressAppend_(sources.queue, {
          ID_INGRESSO: 'ING-' + suffix, CHAVE_IDEMPOTENCIA: data.chave, STATUS_INGRESSO: 'RECEBIDO', MODALIDADE_CADASTRO: data.modalidade,
          ID_PESSOA: idPessoa, ID_VINCULO: idVinculo, ID_EVENTO_INGRESSO: 'EVM-' + suffix,
          EMAIL: data.email, RGA: data.rga, CURSO_ID: course.CURSO_ID, DATA_INGRESSO: data.dataIngresso, SEMESTRE_ENTRADA: data.semestreEntrada,
          FORMA_INGRESSO: data.formaIngresso, DOCUMENTO_REFERENCIA: data.documentoReferencia, OBS_ADMINISTRATIVA: data.observacao,
          ETAPA_EXECUCAO: 'RECEBIDO', ERRO_EXECUCAO: '', CRIADO_EM: now, CRIADO_POR: session.idPessoa,
          EXECUTADO_EM: '', EXECUTADO_POR: '', ATUALIZADO_EM: now,
          AUDITORIA_JSON: JSON.stringify([{ acao: 'INGRESSO_RECEBIDO', em: now, por: session.idPessoa, requestId: requestId, origemCadastro: data.origemCadastro }])
        });
      }
      if (transition.kind === 'BLOCK_EFFECTIVE') {
        membersIngressUpdateStage_(sources.queue, ingress, 'BLOQUEADO_JA_MEMBRO', 'BLOQUEADO_JA_MEMBRO_EFETIVO', now, session.idPessoa, { tipoTransicao: transition.kind });
        return membersVinculoEnvelopeError_(membersVinculoError_('BLOQUEADO_JA_MEMBRO', 'A pessoa ja possui vinculo ativo de membro efetivo.', {}), requestId);
      }
      if (transition.kind === 'ALREADY_INCOMING') {
        membersVinculoUpdate_(sources.queue, ingress, { ID_VINCULO: transition.existingLink.ID_VINCULO || ingress.ID_VINCULO, EXECUTADO_EM: now, EXECUTADO_POR: session.idPessoa });
        membersIngressUpdateStage_(sources.queue, ingress, 'EXECUTADO', 'VINCULO_INGRESSANTE_JA_EXISTENTE', now, session.idPessoa, { tipoTransicao: transition.kind });
        return membersVinculoEnvelopeOk_('MEMBRO_INGRESSANTE_JA_EXISTENTE', 'A pessoa ja possui vinculo ativo de membro ingressante; nenhum vinculo foi duplicado.', { idIngresso: ingress.ID_INGRESSO, tipoVinculo: 'MEMBRO_INGRESSANTE', idempotente: true }, requestId);
      }
      try {
        membersIngressUpdateStage_(sources.queue, ingress, 'PESSOA_RESOLVIDA', 'PESSOA_RESOLVIDA', now, session.idPessoa, { tipoTransicao: transition.kind, tipoEvento: transition.eventType, pessoaExistente: identity.pessoaExistente, fontesIdentidade: identity.fontes });
        membersIngressEnsurePerson_(sources, ingress, data, course, academic, origin, now);
        membersIngressUpdateStage_(sources.queue, ingress, 'DADOS_MEMBRO_ATUALIZADOS', 'DADOS_MEMBRO_ATUALIZADOS', now, session.idPessoa);
        membersIngressClosePriorLinks_(sources, transition, data, now);
        membersIngressEnsureEntity_(sources.links, 'ID_VINCULO', ingress.ID_VINCULO, {
          ID_VINCULO: ingress.ID_VINCULO, ID_PESSOA: ingress.ID_PESSOA, TIPO_VINCULO: 'MEMBRO_INGRESSANTE', STATUS_VINCULO: 'ATIVO',
          DATA_INICIO: data.dataIngresso, DATA_FIM: '', MOTIVO_INICIO: 'Aprovado para ingresso como membro ingressante no processo seletivo ' + data.semestreEntrada,
          MOTIVO_FIM: '', FONTE: 'PROCESSO_SELETIVO', LINK_ATA_OU_PROCESSO: data.documentoReferencia,
          OBS_PUBLICA: 'Em periodo de integracao', OBS_INTERNA: ['origemCadastro=' + data.origemCadastro, data.observacao].filter(Boolean).join(' | '), ATIVO: 'SIM'
        });
        membersIngressUpdateStage_(sources.queue, ingress, 'VINCULO_CRIADO', 'VINCULO_CRIADO', now, session.idPessoa);
        membersIngressEnsureEntity_(sources.events, 'ID_EVENTO_MEMBRO', ingress.ID_EVENTO_INGRESSO, {
          ID_EVENTO_MEMBRO: ingress.ID_EVENTO_INGRESSO, RGA: data.rga, ID_PESSOA: ingress.ID_PESSOA, ID_VINCULO: ingress.ID_VINCULO,
          TIPO_EVENTO: transition.eventType || 'INGRESSO_COMO_MEMBRO_INGRESSANTE', DATA_EVENTO: data.dataIngresso, STATUS_EVENTO: 'HOMOLOGADO',
          MODULO_ORIGEM: 'MEMBROS', CHAVE_ORIGEM: ingress.ID_INGRESSO,
          OBSERVACOES: 'Admitido como membro ingressante apos processo seletivo', ATUALIZADO_EM: now,
          PROCESSADO_POR_MODULO: session.idPessoa, DATA_PROCESSAMENTO: now, ERRO_PROCESSAMENTO: ''
        });
        membersIngressUpdateStage_(sources.queue, ingress, 'EVENTO_REGISTRADO', 'EVENTO_REGISTRADO', now, session.idPessoa);
        var summary = deps.recalculateSummary(environment);
        if (summary && (summary.ok === false || Number(summary.totalErros || 0) > 0)) throw membersVinculoError_('CORE_RECALCULO_RESUMO_FALHOU', 'O vinculo foi criado, mas o resumo operacional nao foi recalculado.', {});
        membersIngressUpdateStage_(sources.queue, ingress, 'RESUMO_RECALCULADO', 'RESUMO_RECALCULADO', now, session.idPessoa);
        membersVinculoUpdate_(sources.queue, ingress, { STATUS_INGRESSO: 'EXECUTADO', ETAPA_EXECUCAO: 'EXECUTADO', EXECUTADO_EM: now, EXECUTADO_POR: session.idPessoa, ATUALIZADO_EM: now, AUDITORIA_JSON: membersIngressAuditAppend_(ingress, 'EXECUTADO', now, session.idPessoa) });
        try {
          var mail = deps.queueIngressMail(ingress, data, environment);
          membersVinculoUpdate_(sources.queue, ingress, { ETAPA_EXECUCAO: mail && mail.ok === true ? 'CONVITE_ENFILEIRADO' : 'CONVITE_ERRO_ENVIO', ATUALIZADO_EM: now, AUDITORIA_JSON: membersIngressAuditAppend_(ingress, mail && mail.ok === true ? 'CONVITE_ENFILEIRADO' : 'CONVITE_ERRO_ENVIO', now, session.idPessoa) });
        } catch (mailError) { membersVinculoUpdate_(sources.queue, ingress, { ETAPA_EXECUCAO: 'CONVITE_ERRO_ENVIO', ERRO_EXECUCAO: 'CONVITE:' + (mailError.code || 'ERRO_ENVIO'), ATUALIZADO_EM: now, AUDITORIA_JSON: membersIngressAuditAppend_(ingress, 'CONVITE_ERRO_ENVIO', now, session.idPessoa, { code: mailError.code || 'ERRO_ENVIO' }) }); }
        return membersVinculoEnvelopeOk_('MEMBRO_INGRESSANTE_ADMITIDO', 'A pessoa foi admitida como membro ingressante e esta em periodo de integracao.', { idIngresso: ingress.ID_INGRESSO, status: 'EXECUTADO', tipoVinculo: 'MEMBRO_INGRESSANTE', pessoaReutilizada: identity.pessoaExistente, conviteEnfileirado: ingress.ETAPA_EXECUCAO === 'CONVITE_ENFILEIRADO', avisos: warnings }, requestId, warnings);
      } catch (executionError) {
        var failedAt = ingress.ETAPA_EXECUCAO || 'ERRO'; var failedNow = deps.now();
        membersVinculoUpdate_(sources.queue, ingress, { STATUS_INGRESSO: 'ERRO_EXECUCAO', ETAPA_EXECUCAO: failedAt, ERRO_EXECUCAO: (executionError.code || 'ERRO') + ': ' + executionError.message, ATUALIZADO_EM: failedNow, AUDITORIA_JSON: membersIngressAuditAppend_(ingress, 'ERRO_EXECUCAO', failedNow, session.idPessoa, { etapa: failedAt, code: executionError.code || 'ERRO' }) }); throw executionError;
      }
    });
  } catch (error) { return membersVinculoEnvelopeError_(error, requestId); }
}

function membersAdmissaoV2AdmitirIngressante(payload, contexto) { return membersIngressExecute_(payload, contexto); }
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
