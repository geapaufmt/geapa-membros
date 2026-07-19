/** Regras puras da Gestao V2 de Solicitacoes Voluntarias de Vinculo. */

function membersVinculoError_(code, message, details, fieldErrors) {
  var error = new Error(message);
  error.code = code;
  error.errorCode = code;
  error.details = details || {};
  error.fieldErrors = fieldErrors || {};
  return error;
}

function membersVinculoToken_(value) {
  return String(value == null ? '' : value).trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s-]+/g, '_');
}

function membersVinculoIsYes_(value) {
  return ['SIM', 'TRUE', '1'].indexOf(membersVinculoToken_(value)) >= 0 || value === true;
}

function membersVinculoCivilDate_(value, code) {
  if (!value) throw membersVinculoError_(code || 'DATA_OBRIGATORIA', 'Data obrigatoria.', {});
  var year, month, day;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    year = value.getFullYear(); month = value.getMonth() + 1; day = value.getDate();
  } else {
    var text = String(value).trim();
    var iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    var br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
    if (iso) { year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]); }
    else if (br) { day = Number(br[1]); month = Number(br[2]); year = Number(br[3]); }
    else throw membersVinculoError_(code || 'DATA_FORMATO_INVALIDO', 'Data invalida. Use DD/MM/AAAA.', {});
  }
  var local = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (local.getFullYear() !== year || local.getMonth() !== month - 1 || local.getDate() !== day) {
    throw membersVinculoError_(code || 'DATA_INEXISTENTE', 'Data civil inexistente.', {});
  }
  return Object.freeze({
    year: year, month: month, day: day, date: local,
    iso: [String(year).padStart(4, '0'), String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-'),
    br: [String(day).padStart(2, '0'), String(month).padStart(2, '0'), String(year).padStart(4, '0')].join('/')
  });
}

function membersVinculoToday_(now) {
  return membersVinculoCivilDate_(now || new Date(), 'DATA_ATUAL_INVALIDA');
}

function membersVinculoCivilDaysInclusive_(start, end) {
  var a = Date.UTC(start.year, start.month - 1, start.day);
  var b = Date.UTC(end.year, end.month - 1, end.day);
  return Math.floor((b - a) / 86400000) + 1;
}

function membersVinculoResolveActiveSemester_(records, now) {
  var active = (records || []).filter(function(record) {
    return membersVinculoToken_(record.STATUS) === 'ATIVO';
  });
  if (!active.length) throw membersVinculoError_('SEMESTRE_ATIVO_AUSENTE', 'Nenhum semestre letivo ATIVO foi encontrado.', {});
  if (active.length > 1) throw membersVinculoError_('SEMESTRE_ATIVO_DUPLICADO', 'Existe mais de um semestre letivo ATIVO.', { quantidade: active.length });
  var record = active[0];
  var id = String(record.ID_SEMESTRE || '').trim();
  if (!id) throw membersVinculoError_('SEMESTRE_ID_AUSENTE', 'O semestre ATIVO nao possui ID_SEMESTRE.', {});
  var start = membersVinculoCivilDate_(record.DATA_INICIO, 'SEMESTRE_DATA_INICIO_INVALIDA');
  var end = membersVinculoCivilDate_(record.DATA_FIM, 'SEMESTRE_DATA_FIM_INVALIDA');
  if (end.iso < start.iso) throw membersVinculoError_('SEMESTRE_INTERVALO_INVALIDO', 'DATA_FIM e anterior a DATA_INICIO.', { idSemestre: id });
  var today = membersVinculoToday_(now);
  if (today.iso < start.iso || today.iso > end.iso) {
    throw membersVinculoError_('SEMESTRE_ATIVO_FORA_DO_INTERVALO', 'O semestre marcado ATIVO nao contem a data atual.', { idSemestre: id, hoje: today.iso, inicio: start.iso, fim: end.iso });
  }
  return Object.freeze({ idSemestre: id, dataInicio: start.iso, dataFim: end.iso, dataFimExibicao: end.br });
}

function membersVinculoValidateNormativeParameter_(parameter, expectedId) {
  var id = membersVinculoToken_(parameter && (parameter.parametroId || parameter.PARAMETRO_ID));
  if (id !== membersVinculoToken_(expectedId)) throw membersVinculoError_('PARAMETRO_NORMATIVO_ID_INCOMPATIVEL', 'Parametro normativo inesperado.', { esperado: expectedId, recebido: id });
  var vigente = parameter && (parameter.vigente != null ? parameter.vigente : parameter.VIGENTE);
  if (!(vigente === true || membersVinculoToken_(vigente) === 'SIM')) throw membersVinculoError_('PARAMETRO_NORMATIVO_NAO_VIGENTE', 'O parametro normativo esta indisponivel.', { parametroId: id });
  var value = Number(parameter && (parameter.valor != null ? parameter.valor : parameter.VALOR));
  if (!isFinite(value) || value <= 0) throw membersVinculoError_('PARAMETRO_NORMATIVO_VALOR_INVALIDO', 'O parametro normativo esta indisponivel.', { parametroId: id });
  if (membersVinculoToken_(parameter.unidade || parameter.UNIDADE) !== 'DIAS') throw membersVinculoError_('PARAMETRO_NORMATIVO_UNIDADE_INVALIDA', 'O parametro normativo deve usar DIAS.', { parametroId: id });
  if (!String(parameter.baseLegal || parameter.BASE_LEGAL || '').trim()) throw membersVinculoError_('PARAMETRO_NORMATIVO_BASE_LEGAL_AUSENTE', 'O parametro normativo nao possui BASE_LEGAL.', { parametroId: id });
  var moduleSystem = String(parameter.moduloSistema || parameter.MODULO_SISTEMA || '').split(/[;,|]/).map(membersVinculoToken_).filter(Boolean);
  if (!moduleSystem.some(function(token) { return ['GEAPA_MEMBROS', 'MEMBROS', 'VINCULOS_GEAPA', 'TODOS', 'SISTEMA_GEAPA'].indexOf(token) >= 0; })) {
    throw membersVinculoError_('PARAMETRO_NORMATIVO_MODULO_INCOMPATIVEL', 'O parametro normativo esta indisponivel para o GEAPA Membros.', { parametroId: id });
  }
  return parameter;
}

function membersVinculoNormativeBoolean_(value, parameterId) {
  if (value === true || value === false) return value;
  var token = membersVinculoToken_(value);
  if (['SIM', 'TRUE', '1'].indexOf(token) >= 0) return true;
  if (['NAO', 'FALSE', '0'].indexOf(token) >= 0) return false;
  throw membersVinculoError_('PARAMETRO_NORMATIVO_VALOR_BOOLEANO_INVALIDO', 'O parametro normativo booleano esta indisponivel.', { parametroId: parameterId });
}

function membersVinculoValidateFinalMinutesParameter_(parameter) {
  var expectedId = MEMBERS_VINCULO_CFG.normativeIds.dismissalFinalMinutes;
  var id = membersVinculoToken_(parameter && (parameter.parametroId || parameter.PARAMETRO_ID));
  if (id !== expectedId) throw membersVinculoError_('PARAMETRO_NORMATIVO_ID_INCOMPATIVEL', 'Parametro normativo inesperado.', { esperado: expectedId, recebido: id });
  var vigente = parameter && (parameter.vigente != null ? parameter.vigente : parameter.VIGENTE);
  if (!(vigente === true || membersVinculoToken_(vigente) === 'SIM')) throw membersVinculoError_('PARAMETRO_NORMATIVO_NAO_VIGENTE', 'O parametro normativo esta indisponivel.', { parametroId: id });
  var tipo = membersVinculoToken_(parameter.tipoValor || parameter.TIPO_VALOR);
  if (tipo !== 'BOOLEANO') throw membersVinculoError_('PARAMETRO_NORMATIVO_TIPO_INVALIDO', 'O parametro normativo deve possuir TIPO_VALOR BOOLEANO.', { parametroId: id, tipoValor: tipo });
  var unidade = membersVinculoToken_(parameter.unidade || parameter.UNIDADE || 'NAO_APLICAVEL');
  if (unidade !== 'NAO_APLICAVEL') throw membersVinculoError_('PARAMETRO_NORMATIVO_UNIDADE_INVALIDA', 'O parametro normativo booleano deve usar NAO_APLICAVEL.', { parametroId: id });
  var baseLegal = String(parameter.baseLegal || parameter.BASE_LEGAL || '').trim();
  if (!baseLegal) throw membersVinculoError_('PARAMETRO_NORMATIVO_BASE_LEGAL_AUSENTE', 'O parametro normativo nao possui BASE_LEGAL.', { parametroId: id });
  var moduleSystem = String(parameter.moduloSistema || parameter.MODULO_SISTEMA || '').split(/[;,|]/).map(membersVinculoToken_).filter(Boolean);
  if (!moduleSystem.some(function(token) { return ['GEAPA_MEMBROS', 'MEMBROS', 'VINCULOS_GEAPA', 'TODOS', 'SISTEMA_GEAPA'].indexOf(token) >= 0; })) {
    throw membersVinculoError_('PARAMETRO_NORMATIVO_MODULO_INCOMPATIVEL', 'O parametro normativo esta indisponivel para o GEAPA Membros.', { parametroId: id });
  }
  var value = membersVinculoNormativeBoolean_(parameter.valor != null ? parameter.valor : parameter.VALOR, id);
  if (value === false && baseLegal === 'NC01-2025-ART16-IV') {
    throw membersVinculoError_('PARAMETRO_NORMATIVO_BASE_LEGAL_INCOMPATIVEL', 'A dispensa de ata exige nova BASE_LEGAL compativel com a alteracao normativa.', { parametroId: id, baseLegal: baseLegal });
  }
  return { parametroId: id, valor: value, tipoValor: 'BOOLEANO', unidade: 'NAO_APLICAVEL', baseLegal: baseLegal, vigente: true, moduloSistema: parameter.moduloSistema || parameter.MODULO_SISTEMA };
}

function membersVinculoSnapshotParameters_(parameters, now, requestType) {
  var suspension = membersVinculoValidateNormativeParameter_(parameters.SUSPENSAO_MINIMA, MEMBERS_VINCULO_CFG.normativeIds.suspensionMinimum);
  var block = membersVinculoValidateNormativeParameter_(parameters.BLOQUEIO_DESLIGAMENTO_ANTES_APRESENTACAO, MEMBERS_VINCULO_CFG.normativeIds.dismissalPresentationBlock);
  var snapshot = {
    PARAMETRO_SUSPENSAO_MINIMA_ID: suspension.parametroId,
    SUSPENSAO_MINIMA_VALOR_SNAPSHOT: Number(suspension.valor),
    SUSPENSAO_MINIMA_UNIDADE_SNAPSHOT: suspension.unidade,
    SUSPENSAO_MINIMA_BASE_LEGAL_SNAPSHOT: suspension.baseLegal,
    PARAMETRO_BLOQUEIO_DESLIGAMENTO_ID: block.parametroId,
    BLOQUEIO_DESLIGAMENTO_VALOR_SNAPSHOT: Number(block.valor),
    BLOQUEIO_DESLIGAMENTO_UNIDADE_SNAPSHOT: block.unidade,
    BLOQUEIO_DESLIGAMENTO_BASE_LEGAL_SNAPSHOT: block.baseLegal,
    PARAMETROS_APLICADOS_EM: now || new Date()
  };
  if (membersVinculoToken_(requestType) === MEMBERS_VINCULO_CFG.types.dismissal) {
    var minutes = membersVinculoValidateFinalMinutesParameter_(parameters.DESLIGAMENTO_VOLUNTARIO_DECISAO_FINAL_EXIGE_ATA);
    snapshot.PARAMETRO_ATA_DESLIGAMENTO_ID = minutes.parametroId;
    snapshot.ATA_DESLIGAMENTO_OBRIGATORIA_SNAPSHOT = minutes.valor ? 'SIM' : 'NAO';
    snapshot.ATA_DESLIGAMENTO_BASE_LEGAL_SNAPSHOT = minutes.baseLegal;
    snapshot.ATA_DESLIGAMENTO_TIPO_VALOR_SNAPSHOT = minutes.tipoValor;
    snapshot.ATA_DESLIGAMENTO_PARAMETRO_APLICADO_EM = now || new Date();
  }
  return snapshot;
}

function membersVinculoValidateSuspensionPeriod_(startValue, endValue, semester, suspensionParameter) {
  var parameter = membersVinculoValidateNormativeParameter_(suspensionParameter, MEMBERS_VINCULO_CFG.normativeIds.suspensionMinimum);
  var start = membersVinculoCivilDate_(startValue, 'DATA_INICIO_SUSPENSAO_INVALIDA');
  var end = membersVinculoCivilDate_(endValue, 'DATA_FIM_SUSPENSAO_INVALIDA');
  if (end.iso < start.iso) throw membersVinculoError_('SUSPENSAO_INTERVALO_INVALIDO', 'A data final nao pode ser anterior a inicial.', {});
  var days = membersVinculoCivilDaysInclusive_(start, end);
  if (days < Number(parameter.valor)) {
    throw membersVinculoError_('SUSPENSAO_PERIODO_INFERIOR_AO_NORMATIVO', 'O periodo informado e inferior ao minimo normativo vigente.', { diasInformados: days, minimo: Number(parameter.valor), unidade: parameter.unidade, baseLegal: parameter.baseLegal });
  }
  if (semester && end.iso > semester.dataFim) throw membersVinculoError_('SUSPENSAO_APOS_FIM_SEMESTRE', 'A suspensao ultrapassa o fim do semestre letivo.', { fimSolicitado: end.iso, fimSemestre: semester.dataFim });
  return Object.freeze({ dataInicio: start.iso, dataFim: end.iso, quantidadeDias: days, minimoNormativo: Number(parameter.valor), baseLegal: parameter.baseLegal });
}

function membersVinculoAssertTransition_(from, to) {
  var source = membersVinculoToken_(from);
  var target = membersVinculoToken_(to);
  var allowed = MEMBERS_VINCULO_CFG.transitions[source] || [];
  if (allowed.indexOf(target) < 0) throw membersVinculoError_('TRANSICAO_STATUS_INVALIDA', 'Transicao de status nao permitida.', { statusAtual: source, statusPretendido: target });
  return target;
}

function membersVinculoAssertRequestTransition_(request, to, action) {
  var source = membersVinculoToken_(request.STATUS_SOLICITACAO);
  var target = membersVinculoToken_(to);
  var type = membersVinculoToken_(request.TIPO_SOLICITACAO);
  var modality = membersVinculoToken_(request.MODALIDADE_SOLICITADA);
  var operation = membersVinculoToken_(action);
  if (source === MEMBERS_VINCULO_CFG.statuses.received && type === MEMBERS_VINCULO_CFG.types.dismissal) {
    if (target === MEMBERS_VINCULO_CFG.statuses.executed && modality === MEMBERS_VINCULO_CFG.modalities.dismissalImmediate && operation === 'HOMOLOGAR_E_EFETIVAR_DESLIGAMENTO') return target;
    if (target === MEMBERS_VINCULO_CFG.statuses.scheduledFinal && modality === MEMBERS_VINCULO_CFG.modalities.dismissalSemesterEnd && operation === 'ANALISE_PRELIMINAR_REGISTRADA') return target;
  }
  return membersVinculoAssertTransition_(source, target);
}

function membersVinculoRequiresFinalMinutes_(request) {
  return membersVinculoToken_(request.TIPO_SOLICITACAO) === MEMBERS_VINCULO_CFG.types.dismissal;
}

function membersVinculoAssertFinalDecisionDocument_(request, payload, requirement) {
  if (!membersVinculoRequiresFinalMinutes_(request) || !requirement || requirement.exigeAta !== true) return true;
  var ata = String((payload && payload.ataReferencia) || request.ATA_REFERENCIA || '').trim();
  var idAta = String((payload && payload.idAtaDeliberacao) || request.ID_ATA_DELIBERACAO || '').trim();
  if (!ata && !idAta) throw membersVinculoError_('ATA_DECISAO_FINAL_OBRIGATORIA', 'A decisao final do desligamento voluntario exige referencia oficial de ata.', {});
  return true;
}

function membersVinculoAssertSecondSuspensionOverride_(payload, actor) {
  var justification = String(payload && payload.justificativaAdministrativaReforcada || '').trim();
  if (justification.length < 20) throw membersVinculoError_('JUSTIFICATIVA_REFORCADA_OBRIGATORIA', 'A segunda suspensao exige justificativa administrativa reforcada.', {});
  if (!String(actor || '').trim()) throw membersVinculoError_('RESPONSAVEL_OVERRIDE_OBRIGATORIO', 'Informe o usuario responsavel pelo override.', {});
  return { justificativa: justification, responsavel: actor, documentoOpcional: String(payload.documentoDecisaoReferencia || payload.ataReferencia || '').trim() };
}

function membersVinculoCurrentParameterView_(parameters) {
  var view = {
    SUSPENSAO_MINIMA: { valor: Number(parameters.SUSPENSAO_MINIMA.valor), unidade: parameters.SUSPENSAO_MINIMA.unidade, baseLegal: parameters.SUSPENSAO_MINIMA.baseLegal },
    BLOQUEIO_DESLIGAMENTO_ANTES_APRESENTACAO: { valor: Number(parameters.BLOQUEIO_DESLIGAMENTO_ANTES_APRESENTACAO.valor), unidade: parameters.BLOQUEIO_DESLIGAMENTO_ANTES_APRESENTACAO.unidade, baseLegal: parameters.BLOQUEIO_DESLIGAMENTO_ANTES_APRESENTACAO.baseLegal }
  };
  if (parameters.DESLIGAMENTO_VOLUNTARIO_DECISAO_FINAL_EXIGE_ATA) view.DESLIGAMENTO_VOLUNTARIO_DECISAO_FINAL_EXIGE_ATA = membersVinculoValidateFinalMinutesParameter_(parameters.DESLIGAMENTO_VOLUNTARIO_DECISAO_FINAL_EXIGE_ATA);
  return view;
}

function membersVinculoCompareNormativeSnapshots_(request, parameters) {
  var current = membersVinculoCurrentParameterView_(parameters);
  var pairs = [
    { id: 'SUSPENSAO_MINIMA', oldValue: Number(request.SUSPENSAO_MINIMA_VALOR_SNAPSHOT), oldUnit: membersVinculoToken_(request.SUSPENSAO_MINIMA_UNIDADE_SNAPSHOT), oldBase: String(request.SUSPENSAO_MINIMA_BASE_LEGAL_SNAPSHOT || '').trim(), now: current.SUSPENSAO_MINIMA },
    { id: 'BLOQUEIO_DESLIGAMENTO_ANTES_APRESENTACAO', oldValue: Number(request.BLOQUEIO_DESLIGAMENTO_VALOR_SNAPSHOT), oldUnit: membersVinculoToken_(request.BLOQUEIO_DESLIGAMENTO_UNIDADE_SNAPSHOT), oldBase: String(request.BLOQUEIO_DESLIGAMENTO_BASE_LEGAL_SNAPSHOT || '').trim(), now: current.BLOQUEIO_DESLIGAMENTO_ANTES_APRESENTACAO }
  ];
  if (membersVinculoToken_(request.TIPO_SOLICITACAO) === MEMBERS_VINCULO_CFG.types.dismissal) {
    var ataSnapshotAvailable = String(request.PARAMETRO_ATA_DESLIGAMENTO_ID || '').trim() && String(request.ATA_DESLIGAMENTO_OBRIGATORIA_SNAPSHOT || '').trim() && String(request.ATA_DESLIGAMENTO_BASE_LEGAL_SNAPSHOT || '').trim();
    if (ataSnapshotAvailable) {
      pairs.push({
        id: MEMBERS_VINCULO_CFG.normativeIds.dismissalFinalMinutes,
        oldValue: membersVinculoNormativeBoolean_(request.ATA_DESLIGAMENTO_OBRIGATORIA_SNAPSHOT, MEMBERS_VINCULO_CFG.normativeIds.dismissalFinalMinutes),
        oldUnit: 'NAO_APLICAVEL',
        oldType: membersVinculoToken_(request.ATA_DESLIGAMENTO_TIPO_VALOR_SNAPSHOT),
        oldBase: String(request.ATA_DESLIGAMENTO_BASE_LEGAL_SNAPSHOT || '').trim(),
        now: current.DESLIGAMENTO_VOLUNTARIO_DECISAO_FINAL_EXIGE_ATA
      });
    }
  }
  var differences = [];
  if (membersVinculoToken_(request.TIPO_SOLICITACAO) === MEMBERS_VINCULO_CFG.types.dismissal && !ataSnapshotAvailable) {
    differences.push({ parametroId: MEMBERS_VINCULO_CFG.normativeIds.dismissalFinalMinutes, snapshot: { disponivel: false }, vigente: current.DESLIGAMENTO_VOLUNTARIO_DECISAO_FINAL_EXIGE_ATA, motivo: 'SNAPSHOT_AUSENTE_SOLICITACAO_ANTERIOR' });
  }
  pairs.forEach(function(pair) {
    var currentValue = typeof pair.now.valor === 'boolean' ? pair.now.valor : Number(pair.now.valor);
    var changedRule = pair.oldValue !== currentValue || pair.oldUnit !== membersVinculoToken_(pair.now.unidade) || (pair.oldType && pair.oldType !== membersVinculoToken_(pair.now.tipoValor));
    var changedBase = pair.oldBase !== String(pair.now.baseLegal || '').trim();
    if (changedRule && !changedBase) throw membersVinculoError_('PARAMETRO_NORMATIVO_SEM_ATUALIZACAO_BASE_LEGAL', 'O valor normativo mudou sem nova BASE_LEGAL.', { parametroId: pair.id, snapshot: { valor: pair.oldValue, unidade: pair.oldUnit, baseLegal: pair.oldBase }, vigente: pair.now });
    if (changedRule || changedBase) differences.push({ parametroId: pair.id, snapshot: { valor: pair.oldValue, unidade: pair.oldUnit, tipoValor: pair.oldType || 'NUMERO', baseLegal: pair.oldBase }, vigente: pair.now });
  });
  return Object.freeze({ divergent: differences.length > 0, differences: differences, current: current });
}

function membersVinculoResolveFinalMinutesRequirement_(request, comparison, treatment) {
  if (!membersVinculoRequiresFinalMinutes_(request)) return { exigeAta: false, origemRegra: 'NAO_APLICAVEL', possuiDivergencia: false };
  var snapshot = {
    disponivel: !!String(request.PARAMETRO_ATA_DESLIGAMENTO_ID || '').trim(),
    valor: String(request.ATA_DESLIGAMENTO_OBRIGATORIA_SNAPSHOT || '').trim() ? membersVinculoNormativeBoolean_(request.ATA_DESLIGAMENTO_OBRIGATORIA_SNAPSHOT, MEMBERS_VINCULO_CFG.normativeIds.dismissalFinalMinutes) : null,
    tipoValor: membersVinculoToken_(request.ATA_DESLIGAMENTO_TIPO_VALOR_SNAPSHOT),
    baseLegal: String(request.ATA_DESLIGAMENTO_BASE_LEGAL_SNAPSHOT || '').trim()
  };
  var current = comparison.current.DESLIGAMENTO_VOLUNTARIO_DECISAO_FINAL_EXIGE_ATA;
  var ataDifference = comparison.differences.filter(function(item) { return item.parametroId === MEMBERS_VINCULO_CFG.normativeIds.dismissalFinalMinutes; })[0] || null;
  if (ataDifference && (!treatment || !treatment.treatment)) {
    return { exigeAta: null, parametroId: MEMBERS_VINCULO_CFG.normativeIds.dismissalFinalMinutes, baseLegal: '', origemRegra: 'TRATAMENTO_TRANSICAO_PENDENTE', possuiDivergencia: true, exigeTratamentoTransicao: true, snapshot: snapshot, vigente: current };
  }
  var useSnapshot = ataDifference && treatment.treatment === 'APLICAR_SNAPSHOT';
  if (useSnapshot && !snapshot.disponivel) throw membersVinculoError_('PARAMETRO_ATA_DESLIGAMENTO_SNAPSHOT_AUSENTE', 'Esta solicitacao anterior nao possui snapshot da regra de ata. A decisao exige adocao explicita da regra vigente.', { parametroId: MEMBERS_VINCULO_CFG.normativeIds.dismissalFinalMinutes });
  var selected = useSnapshot ? snapshot : current;
  return { exigeAta: selected.valor === true, parametroId: MEMBERS_VINCULO_CFG.normativeIds.dismissalFinalMinutes, baseLegal: selected.baseLegal, origemRegra: useSnapshot ? 'SNAPSHOT' : 'VIGENTE', possuiDivergencia: !!ataDifference, exigeTratamentoTransicao: false, snapshot: snapshot, vigente: current };
}

function membersVinculoRequireTransitionTreatment_(comparison, payload, actor, hasOverridePermission) {
  if (!comparison.divergent) return { divergent: false };
  var treatment = membersVinculoToken_(payload && payload.tratamentoTransicao);
  var justification = String(payload && payload.justificativaAdministrativaReforcada || '').trim();
  if (!hasOverridePermission || ['APLICAR_SNAPSHOT', 'APLICAR_VIGENTE'].indexOf(treatment) < 0 || justification.length < 20) {
    throw membersVinculoError_('PARAMETRO_NORMATIVO_DIVERGENTE', 'Os parametros vigentes diferem do snapshot. E necessario tratamento administrativo da transicao.', { diferencas: comparison.differences, valoresAtuais: comparison.current });
  }
  return { divergent: true, treatment: treatment, justification: justification, actor: actor, current: comparison.current };
}

function membersVinculoIsOpenStatus_(status) {
  return MEMBERS_VINCULO_CFG.openStatuses.indexOf(membersVinculoToken_(status)) >= 0;
}

function membersVinculoIsMemberCancellable_(status) {
  return MEMBERS_VINCULO_CFG.memberCancellableStatuses.indexOf(membersVinculoToken_(status)) >= 0;
}

function membersVinculoMaskRga_(value) {
  var text = String(value || '').replace(/\s+/g, '');
  if (text.length <= 3) return text ? '***' : '';
  return text.slice(0, 2) + '*'.repeat(Math.max(2, text.length - 4)) + text.slice(-2);
}

function membersVinculoMaskEmail_(value) {
  var text = String(value || '').trim();
  var parts = text.split('@');
  if (parts.length !== 2) return '';
  return (parts[0].slice(0, 1) || '*') + '***@' + parts[1];
}
