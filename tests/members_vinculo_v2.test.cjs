'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const files = [
  '10_members_vinculo_v2_config.gs',
  '11_members_vinculo_v2_engine.gs',
  '12_members_vinculo_v2_service.gs',
  '13_members_vinculo_v2_admin.gs',
  '14_members_vinculo_v2_jobs.gs',
  '51_members_vinculo_v2_setup.gs'
];
const sandbox = { console };
vm.createContext(sandbox);
files.forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file }));

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const code = (fn, expected) => assert.throws(fn, (error) => error && error.code === expected, expected);
const clone = (value) => JSON.parse(JSON.stringify(value));

function normative(minimum = 6, presentationBlock = 4, suffix = 'A', requiresMinutes = true) {
  const item = (id, value) => ({
    parametroId: id,
    valor: value,
    unidade: 'DIAS',
    baseLegal: `NORMA-TESTE-${suffix}-${id}`,
    moduloSistema: 'GEAPA_MEMBROS',
    vigente: true,
    ambiente: 'DEV'
  });
  return {
    SUSPENSAO_MINIMA: item('SUSPENSAO_MINIMA', minimum),
    BLOQUEIO_DESLIGAMENTO_ANTES_APRESENTACAO: item('BLOQUEIO_DESLIGAMENTO_ANTES_APRESENTACAO', presentationBlock),
    DESLIGAMENTO_VOLUNTARIO_DECISAO_FINAL_EXIGE_ATA: {
      parametroId: 'DESLIGAMENTO_VOLUNTARIO_DECISAO_FINAL_EXIGE_ATA',
      valor: requiresMinutes,
      tipoValor: 'BOOLEANO',
      unidade: 'NAO_APLICAVEL',
      baseLegal: requiresMinutes ? 'NC01-2025-ART16-IV' : `NORMA-TESTE-${suffix}-DISPENSA-ATA`,
      moduloSistema: 'GEAPA_MEMBROS', vigente: true, ambiente: 'DEV'
    }
  };
}

function source(headers, records = []) {
  const output = { headers: headers.slice(), records: records.map((record, index) => Object.assign({ __rowNumber: index + 2 }, clone(record))) };
  output.sheet = {
    getLastRow: () => output.records.length + 1,
    getLastColumn: () => output.headers.length,
    getMaxRows: () => 100,
    getFilter: () => null,
    setFrozenRows: () => output.sheet,
    getRange: () => ({
      setValues: () => output.sheet,
      setValue: () => output.sheet,
      setFontWeight: () => ({ setBackground: () => output.sheet }),
      setDataValidation: () => output.sheet,
      createFilter: () => output.sheet,
      getValues: () => [output.headers]
    })
  };
  return output;
}

const queueHeaders = Array.from(sandbox.MEMBERS_VINCULO_HEADERS);
const linkHeaders = ['ID_VINCULO','ID_PESSOA','TIPO_VINCULO','STATUS_VINCULO','DATA_INICIO','DATA_FIM','MOTIVO_FIM','LINK_ATA_OU_PROCESSO','ATIVO'];
const eventHeaders = ['ID_EVENTO_MEMBRO','ID_PESSOA','ID_VINCULO','TIPO_EVENTO','DATA_EVENTO','STATUS_EVENTO','MODULO_ORIGEM','CHAVE_ORIGEM','OBSERVACOES','ATUALIZADO_EM','PROCESSADO_POR_MODULO','DATA_PROCESSAMENTO','ERRO_PROCESSAMENTO'];
const semesterHeaders = ['ID_SEMESTRE','DATA_INICIO','DATA_FIM','STATUS'];

function activeSemester(overrides = {}) {
  return Object.assign({ ID_SEMESTRE: 'SEM-TESTE', DATA_INICIO: '2026-01-05', DATA_FIM: '2026-06-25', STATUS: 'ATIVO' }, overrides);
}

function baseRequest(overrides = {}, parameters = normative()) {
  const requestType = overrides.TIPO_SOLICITACAO || 'DESLIGAMENTO_VOLUNTARIO';
  const snapshot = sandbox.membersVinculoSnapshotParameters_(parameters, new Date(2026, 2, 10, 12), requestType);
  return Object.assign({
    ID_SOLICITACAO: 'SVI-TESTE', ID_PESSOA: 'P-1', ID_VINCULO: 'V-1',
    TIPO_SOLICITACAO: 'DESLIGAMENTO_VOLUNTARIO', MODALIDADE_SOLICITADA: 'DESLIGAMENTO_APOS_HOMOLOGACAO',
    DATA_SOLICITACAO: '2026-03-10', CHAVE_IDEMPOTENCIA: 'idem-teste-0001', STATUS_SOLICITACAO: 'EM_ANALISE', ATIVO: 'SIM',
    ID_SEMESTRE_REFERENCIA: 'SEM-TESTE', DATA_INICIO_SEMESTRE_SNAPSHOT: '2026-01-05', DATA_FIM_SEMESTRE_SNAPSHOT: '2026-06-25',
    MOTIVO_CATEGORIA: 'VOLUNTARIO', VALIDACAO_APRESENTACAO: 'SEM_CONFLITO', VALIDACAO_ARQUIVOS_PENDENTES: 'SEM_PENDENCIA',
    VALIDACAO_OBRIGACOES: 'SEM_PENDENCIA', VALIDACAO_FUNCAO_ATIVA: 'SEM_FUNCAO',
    HISTORICO_STATUS_JSON: '[]', AUDITORIA_JSON: '[]'
  }, snapshot, overrides);
}

function storeFactory(options = {}) {
  const parameters = options.parameters || normative();
  const store = {
    'PESSOAS:SOLICITACOES_VINCULO': source(queueHeaders, options.requests || []),
    'PESSOAS:VINCULOS': source(linkHeaders, options.links || [{ ID_VINCULO: 'V-1', ID_PESSOA: 'P-1', TIPO_VINCULO: 'MEMBRO_EFETIVO', STATUS_VINCULO: 'ATIVO', DATA_INICIO: '2025-01-01', DATA_FIM: '', ATIVO: 'SIM' }]),
    'PESSOAS:EVENTOS': source(eventHeaders, options.events || []),
    'PESSOAS:BASE': source(['ID_PESSOA','NOME_COMPLETO','EMAIL_PRINCIPAL'], [{ ID_PESSOA: 'P-1', NOME_COMPLETO: 'Pessoa Teste', EMAIL_PRINCIPAL: 'pessoa@example.invalid' }]),
    'PESSOAS:MEMBROS_DETALHES': source(['ID_PESSOA','RGA'], [{ ID_PESSOA: 'P-1', RGA: 'RGA-TESTE' }]),
    'VIGENCIAS:SEMESTRES': source(semesterHeaders, options.semesters || [activeSemester()]),
    'ATIVIDADES:APRESENTACOES': source(['ID_PESSOA','DATA_APRESENTACAO','STATUS'], options.presentations || []),
    'ATIVIDADES:ARQUIVOS': source(['ID_PESSOA','STATUS'], options.files || [])
  };
  const access = [];
  let uuid = 0;
  let summaries = 0;
  const session = options.session || { autenticado: true, idPessoa: 'P-1', email: 'pessoa@example.invalid', permissoes: ['membros:solicitar_alteracao_vinculo'] };
  const deps = {
    now: () => options.now || new Date(2026, 2, 10, 12),
    uuid: () => `uuid-${++uuid}-abcdefghijklmnopqrstuvwxyz`,
    withLock: (_key, callback) => callback(),
    resolveSession: () => session,
    resolveParameters: (environment) => { access.push({ kind: 'parameter', environment }); return parameters; },
    openSource: (domain, logical, environment, forWrite) => {
      access.push({ kind: 'source', domain, logical, environment, forWrite: forWrite === true });
      const found = store[`${domain}:${logical}`];
      if (!found) throw sandbox.membersVinculoError_('TEST_SOURCE_MISSING', 'Fonte ausente no teste.', { domain, logical });
      return found;
    },
    assessExternal: options.assessExternal,
    notify: options.notify || (() => ({ ok: true })),
    recalculateSummary: options.recalculateSummary || (() => { summaries += 1; return { ok: true }; })
  };
  return { store, deps, access, parameters, get summaries() { return summaries; } };
}

const memberContext = (deps, extra = {}) => Object.assign({ ambienteDadosV2: 'DEV', sessaoOficial: { email: 'pessoa@example.invalid' }, requestId: 'req-teste', __deps: deps }, extra);
const suspensionPayload = (extra = {}) => Object.assign({ chaveIdempotencia: 'idem-susp-0001', motivoCategoria: 'PESSOAL', justificativa: 'Justificativa suficiente para teste.', dataInicioPretendida: '2026-04-01', dataFimPretendida: '2026-04-06', cienciaRegras: true, cienciaRegrasVersao: 'TESTE' }, extra);
const dismissalPayload = (extra = {}) => Object.assign({ chaveIdempotencia: 'idem-desl-0001', motivoCategoria: 'PESSOAL', modalidadeSolicitada: 'DESLIGAMENTO_APOS_HOMOLOGACAO', cienciaRegras: true, observacoes: 'Teste controlado.' }, extra);
const adminSession = () => ({ autenticado: true, idPessoa: 'P-ADMIN', email: 'admin@example.invalid', permissoes: ['membros:analisar_solicitacoes_vinculo','membros:homologar_solicitacoes_vinculo','membros:executar_solicitacoes_vinculo','membros:override_validacoes_vinculo'] });

test('01 exatamente um semestre ATIVO valido', () => assert.equal(sandbox.membersVinculoResolveActiveSemester_([activeSemester()], new Date(2026, 2, 10, 12)).idSemestre, 'SEM-TESTE'));
test('02 nenhum semestre ATIVO', () => code(() => sandbox.membersVinculoResolveActiveSemester_([], new Date(2026, 2, 10, 12)), 'SEMESTRE_ATIVO_AUSENTE'));
test('03 dois semestres ATIVOS', () => code(() => sandbox.membersVinculoResolveActiveSemester_([activeSemester(), activeSemester({ ID_SEMESTRE: 'SEM-2' })], new Date(2026, 2, 10, 12)), 'SEMESTRE_ATIVO_DUPLICADO'));
test('04 DATA_FIM vazia', () => code(() => sandbox.membersVinculoResolveActiveSemester_([activeSemester({ DATA_FIM: '' })], new Date(2026, 2, 10, 12)), 'SEMESTRE_DATA_FIM_INVALIDA'));
test('05 DATA_FIM anterior a DATA_INICIO', () => code(() => sandbox.membersVinculoResolveActiveSemester_([activeSemester({ DATA_FIM: '2025-12-31' })], new Date(2026, 2, 10, 12)), 'SEMESTRE_INTERVALO_INVALIDO'));
test('06 DEV permanece DEV em todas as fontes', () => { const f = storeFactory(); sandbox.membersMeuVinculoOpcoesSolicitacao(memberContext(f.deps)); assert(f.access.length > 0); assert(f.access.every((item) => item.environment === 'DEV')); });
test('07 ausencia de fallback PROD', () => { const f = storeFactory({ semesters: [] }); sandbox.membersMeuVinculoSolicitarSuspensao(suspensionPayload(), memberContext(f.deps)); assert(!f.access.some((item) => item.environment === 'PROD')); });
test('08 alteracao da DATA_FIM e detectada', () => { const p = normative(); const comparison = sandbox.membersVinculoCompareNormativeSnapshots_(baseRequest({}, p), p); assert.equal(comparison.divergent, false); const f = storeFactory({ semesters: [activeSemester({ DATA_FIM: '2026-06-28' })] }); assert.equal(sandbox.membersVinculoResolveSemesterById_(f.deps, 'DEV', 'SEM-TESTE').dataFim, '2026-06-28'); });
test('09 semestre civil nao e inventado', () => code(() => sandbox.membersVinculoResolveActiveSemester_([activeSemester({ STATUS: 'INATIVO' })], new Date(2026, 2, 10, 12)), 'SEMESTRE_ATIVO_AUSENTE'));
test('10 timezone nao desloca data civil', () => assert.equal(sandbox.membersVinculoCivilDate_('2026-03-10').iso, '2026-03-10'));

test('11 periodo atende minimo normativo dinamico', () => assert.equal(sandbox.membersVinculoValidateSuspensionPeriod_('2026-04-01', '2026-04-06', { dataFim: '2026-06-25' }, normative().SUSPENSAO_MINIMA).quantidadeDias, normative().SUSPENSAO_MINIMA.valor));
test('12 periodo abaixo do minimo normativo', () => code(() => sandbox.membersVinculoValidateSuspensionPeriod_('2026-04-01', '2026-04-05', { dataFim: '2026-06-25' }, normative().SUSPENSAO_MINIMA), 'SUSPENSAO_PERIODO_INFERIOR_AO_NORMATIVO'));
test('13 fim apos semestre', () => code(() => sandbox.membersVinculoValidateSuspensionPeriod_('2026-06-20', '2026-06-26', { dataFim: '2026-06-25' }, normative().SUSPENSAO_MINIMA), 'SUSPENSAO_APOS_FIM_SEMESTRE'));
test('14 opcao indisponivel perto do fim', () => { const f = storeFactory({ now: new Date(2026, 5, 22, 12) }); const r = sandbox.membersMeuVinculoOpcoesSolicitacao(memberContext(f.deps)); assert.equal(r.data.opcoes.suspensaoDisponivel, false); });
test('15 apresentacao dentro do periodo', () => { const f = storeFactory({ presentations: [{ ID_PESSOA: 'P-1', DATA_APRESENTACAO: '2026-04-03', STATUS: 'AGENDADA' }] }); const r = sandbox.membersMeuVinculoSolicitarSuspensao(suspensionPayload(), memberContext(f.deps)); assert.equal(r.ok, true); assert.equal(f.store['PESSOAS:SOLICITACOES_VINCULO'].records[0].VALIDACAO_APRESENTACAO, 'CONFLITO'); });
test('16 suspensao anterior na permanencia atual', () => { const f = storeFactory({ events: [{ ID_VINCULO: 'V-1', TIPO_EVENTO: 'SUSPENSAO', STATUS_EVENTO: 'HOMOLOGADO' }] }); sandbox.membersMeuVinculoSolicitarSuspensao(suspensionPayload(), memberContext(f.deps)); assert.equal(f.store['PESSOAS:SOLICITACOES_VINCULO'].records[0].VALIDACAO_SUSPENSAO_ANTERIOR, 'CONFIRMADA'); });
test('17 suspensao historica em vinculo anterior', () => { const f = storeFactory({ events: [{ ID_VINCULO: 'V-ANTERIOR', TIPO_EVENTO: 'SUSPENSAO', STATUS_EVENTO: 'HOMOLOGADO' }] }); sandbox.membersMeuVinculoSolicitarSuspensao(suspensionPayload(), memberContext(f.deps)); assert.equal(f.store['PESSOAS:SOLICITACOES_VINCULO'].records[0].VALIDACAO_SUSPENSAO_ANTERIOR, 'SEM_SUSPENSAO'); });
test('18 override de segunda suspensao sem ata obrigatoria', () => { const r = sandbox.membersVinculoAssertSecondSuspensionOverride_({ justificativaAdministrativaReforcada: 'Justificativa administrativa reforcada suficiente.' }, 'admin'); assert.equal(r.documentoOpcional, ''); });
test('19 membro sem vinculo ativo', () => { const f = storeFactory({ links: [] }); const r = sandbox.membersMeuVinculoSolicitarSuspensao(suspensionPayload(), memberContext(f.deps)); assert.equal(r.code, 'VINCULO_EFETIVO_ATIVO_NAO_ENCONTRADO'); });
test('20 suspensao futura aguarda inicio', () => { const req = baseRequest({ TIPO_SOLICITACAO: 'SUSPENSAO_VOLUNTARIA', MODALIDADE_SOLICITADA: 'SUSPENSAO_TEMPORARIA', DATA_INICIO_PRETENDIDA: '2026-04-01', DATA_FIM_PRETENDIDA: '2026-04-06' }); const f = storeFactory({ requests: [req], session: adminSession() }); const r = sandbox.membersAdminSolicitacaoVinculoHomologarSuspensao({ idSolicitacao: 'SVI-TESTE' }, memberContext(f.deps)); assert.equal(r.data.status, 'HOMOLOGADO_AGUARDANDO_INICIO'); });
test('21 job aplica suspensao na data', () => { const req = baseRequest({ TIPO_SOLICITACAO: 'SUSPENSAO_VOLUNTARIA', STATUS_SOLICITACAO: 'HOMOLOGADO_AGUARDANDO_INICIO', DATA_INICIO_PRETENDIDA: '2026-03-10', DATA_FIM_PRETENDIDA: '2026-03-20' }); const f = storeFactory({ requests: [req] }); const r = sandbox.membersVinculoJobProcessar({ ambiente: 'DEV', runId: 'RUN-1', __deps: f.deps }); assert.equal(r.suspensoesIniciadas, 1); assert.equal(f.store['PESSOAS:VINCULOS'].records[0].STATUS_VINCULO, 'SUSPENSO'); });
test('22 job processa retorno na data', () => { const req = baseRequest({ TIPO_SOLICITACAO: 'SUSPENSAO_VOLUNTARIA', STATUS_SOLICITACAO: 'SUSPENSAO_ATIVA', DATA_INICIO_PRETENDIDA: '2026-03-01', DATA_FIM_PRETENDIDA: '2026-03-10' }); const f = storeFactory({ requests: [req], links: [{ ID_VINCULO: 'V-1', ID_PESSOA: 'P-1', TIPO_VINCULO: 'MEMBRO_EFETIVO', STATUS_VINCULO: 'SUSPENSO', ATIVO: 'SIM' }] }); const r = sandbox.membersVinculoJobProcessar({ ambiente: 'DEV', runId: 'RUN-2', __deps: f.deps }); assert.equal(r.retornos, 1); assert.equal(f.store['PESSOAS:VINCULOS'].records[0].STATUS_VINCULO, 'ATIVO'); });
test('23 job repetido nao duplica evento', () => { const req = baseRequest({ TIPO_SOLICITACAO: 'SUSPENSAO_VOLUNTARIA', STATUS_SOLICITACAO: 'HOMOLOGADO_AGUARDANDO_INICIO', DATA_INICIO_PRETENDIDA: '2026-03-10', DATA_FIM_PRETENDIDA: '2026-03-20' }); const f = storeFactory({ requests: [req] }); sandbox.membersVinculoJobProcessar({ ambiente: 'DEV', runId: 'RUN-A', __deps: f.deps }); sandbox.membersVinculoJobProcessar({ ambiente: 'DEV', runId: 'RUN-B', __deps: f.deps }); assert.equal(f.store['PESSOAS:EVENTOS'].records.filter((e) => e.TIPO_EVENTO === 'SUSPENSAO').length, 1); });

test('24 pedido de desligamento imediato valido', () => { const f = storeFactory(); const r = sandbox.membersMeuVinculoSolicitarDesligamento(dismissalPayload(), memberContext(f.deps)); assert.equal(r.ok, true); });
test('25 bloqueio de apresentacao usa parametro dinamico', () => { const f = storeFactory({ presentations: [{ ID_PESSOA: 'P-1', DATA_APRESENTACAO: '2026-03-13', STATUS: 'AGENDADA' }] }); sandbox.membersMeuVinculoSolicitarDesligamento(dismissalPayload(), memberContext(f.deps)); assert.equal(f.store['PESSOAS:SOLICITACOES_VINCULO'].records[0].VALIDACAO_APRESENTACAO, 'CONFLITO'); });
test('26 arquivo pendente', () => { const f = storeFactory({ files: [{ ID_PESSOA: 'P-1', STATUS: 'PENDENTE' }] }); sandbox.membersMeuVinculoSolicitarDesligamento(dismissalPayload(), memberContext(f.deps)); assert.equal(f.store['PESSOAS:SOLICITACOES_VINCULO'].records[0].VALIDACAO_ARQUIVOS_PENDENTES, 'PENDENTE'); });
test('27 obrigacao pendente', () => { const f = storeFactory({ assessExternal: () => ({ apresentacao: 'SEM_CONFLITO', arquivos: 'SEM_PENDENCIA', obrigacoes: 'PENDENTE', funcao: 'SEM_FUNCAO', mensagem: '' }) }); sandbox.membersMeuVinculoSolicitarDesligamento(dismissalPayload(), memberContext(f.deps)); assert.equal(f.store['PESSOAS:SOLICITACOES_VINCULO'].records[0].VALIDACAO_OBRIGACOES, 'PENDENTE'); });
test('28 funcao ativa', () => { const f = storeFactory({ assessExternal: () => ({ apresentacao: 'SEM_CONFLITO', arquivos: 'SEM_PENDENCIA', obrigacoes: 'SEM_PENDENCIA', funcao: 'ATIVA', mensagem: '' }) }); sandbox.membersMeuVinculoSolicitarDesligamento(dismissalPayload(), memberContext(f.deps)); assert.equal(f.store['PESSOAS:SOLICITACOES_VINCULO'].records[0].VALIDACAO_FUNCAO_ATIVA, 'ATIVA'); });
test('29 homologacao exige e aceita ata', () => { const f = storeFactory({ requests: [baseRequest()], session: adminSession() }); const r = sandbox.membersAdminSolicitacaoVinculoHomologarEfetivarDesligamento({ idSolicitacao: 'SVI-TESTE', ataReferencia: 'ATA-TESTE', confirmacaoReforcada: true }, memberContext(f.deps)); assert.equal(r.ok, true); });
test('30 indeferimento final de desligamento exige ata', () => { const f = storeFactory({ requests: [baseRequest()], session: adminSession() }); const denied = sandbox.membersAdminSolicitacaoVinculoIndeferir({ idSolicitacao: 'SVI-TESTE', obsDecisao: 'Motivo do indeferimento.', ataReferencia: 'ATA-TESTE' }, memberContext(f.deps)); assert.equal(denied.data.status, 'INDEFERIDO'); });
test('31 cancelamento antes da decisao', () => { const f = storeFactory({ requests: [baseRequest({ STATUS_SOLICITACAO: 'RECEBIDO' })] }); const r = sandbox.membersMeuVinculoCancelarSolicitacao({ idSolicitacao: 'SVI-TESTE', motivo: 'Desistencia.' }, memberContext(f.deps)); assert.equal(r.data.status, 'CANCELADO_PELO_MEMBRO'); });
test('32 cancelamento depois da execucao e bloqueado', () => { const f = storeFactory({ requests: [baseRequest({ STATUS_SOLICITACAO: 'EXECUTADO', ATIVO: 'NAO' })] }); const r = sandbox.membersMeuVinculoCancelarSolicitacao({ idSolicitacao: 'SVI-TESTE' }, memberContext(f.deps)); assert.equal(r.code, 'SOLICITACAO_VINCULO_NAO_CANCELAVEL'); });
test('33 vinculo e encerrado', () => { const f = storeFactory({ requests: [baseRequest()], session: adminSession() }); sandbox.membersAdminSolicitacaoVinculoHomologarEfetivarDesligamento({ idSolicitacao: 'SVI-TESTE', ataReferencia: 'ATA-TESTE', confirmacaoReforcada: true }, memberContext(f.deps)); assert.equal(f.store['PESSOAS:VINCULOS'].records[0].ATIVO, 'NAO'); });
test('34 evento de desligamento e criado', () => { const f = storeFactory({ requests: [baseRequest()], session: adminSession() }); sandbox.membersAdminSolicitacaoVinculoHomologarEfetivarDesligamento({ idSolicitacao: 'SVI-TESTE', ataReferencia: 'ATA-TESTE', confirmacaoReforcada: true }, memberContext(f.deps)); assert.equal(f.store['PESSOAS:EVENTOS'].records[0].TIPO_EVENTO, 'DESLIGAMENTO_VOLUNTARIO'); });
test('35 resumo operacional e recalculado', () => { const f = storeFactory({ requests: [baseRequest()], session: adminSession() }); sandbox.membersAdminSolicitacaoVinculoHomologarEfetivarDesligamento({ idSolicitacao: 'SVI-TESTE', ataReferencia: 'ATA-TESTE', confirmacaoReforcada: true }, memberContext(f.deps)); assert.equal(f.summaries, 1); });

test('36 fim de semestre referencia ID oficial', () => { const f = storeFactory(); sandbox.membersMeuVinculoSolicitarDesligamento(dismissalPayload({ modalidadeSolicitada: 'DESLIGAMENTO_FIM_SEMESTRE' }), memberContext(f.deps)); assert.equal(f.store['PESSOAS:SOLICITACOES_VINCULO'].records[0].ID_SEMESTRE_REFERENCIA, 'SEM-TESTE'); });
test('37 data efetiva pretendida vem do semestre oficial', () => { const f = storeFactory(); sandbox.membersMeuVinculoSolicitarDesligamento(dismissalPayload({ modalidadeSolicitada: 'DESLIGAMENTO_FIM_SEMESTRE' }), memberContext(f.deps)); assert.equal(f.store['PESSOAS:SOLICITACOES_VINCULO'].records[0].DATA_EFETIVA_PRETENDIDA, '2026-06-25'); });
test('38 analise preliminar nao homologa', () => { const req = baseRequest({ MODALIDADE_SOLICITADA: 'DESLIGAMENTO_FIM_SEMESTRE' }); const f = storeFactory({ requests: [req], session: adminSession() }); const r = sandbox.membersAdminSolicitacaoVinculoRegistrarAnalisePreliminar({ idSolicitacao: 'SVI-TESTE', observacao: 'Conferencia preliminar registrada.' }, memberContext(f.deps)); assert.equal(r.data.status, 'AGENDADO_PARA_ANALISE_FINAL'); assert.equal(f.store['PESSOAS:EVENTOS'].records.length, 0); });
test('39 homologacao antecipada e bloqueada', () => { const req = baseRequest({ MODALIDADE_SOLICITADA: 'DESLIGAMENTO_FIM_SEMESTRE', STATUS_SOLICITACAO: 'PRONTO_PARA_ANALISE_FINAL' }); const f = storeFactory({ requests: [req], session: adminSession() }); const r = sandbox.membersAdminSolicitacaoVinculoHomologarEfetivarDesligamento({ idSolicitacao: 'SVI-TESTE', ataReferencia: 'ATA-TESTE', confirmacaoReforcada: true }, memberContext(f.deps)); assert.equal(r.code, 'HOMOLOGACAO_FINAL_ANTECIPADA_BLOQUEADA'); });
test('40 job marca pronto para analise final', () => { const req = baseRequest({ MODALIDADE_SOLICITADA: 'DESLIGAMENTO_FIM_SEMESTRE', STATUS_SOLICITACAO: 'AGENDADO_PARA_ANALISE_FINAL' }); const f = storeFactory({ requests: [req], now: new Date(2026, 5, 25, 12) }); const r = sandbox.membersVinculoJobProcessar({ ambiente: 'DEV', __deps: f.deps }); assert.equal(r.prontosAnaliseFinal, 1); });
test('41 job nao desliga automaticamente', () => { const req = baseRequest({ MODALIDADE_SOLICITADA: 'DESLIGAMENTO_FIM_SEMESTRE', STATUS_SOLICITACAO: 'AGENDADO_PARA_ANALISE_FINAL' }); const f = storeFactory({ requests: [req], now: new Date(2026, 5, 25, 12) }); sandbox.membersVinculoJobProcessar({ ambiente: 'DEV', __deps: f.deps }); assert.equal(f.store['PESSOAS:VINCULOS'].records[0].STATUS_VINCULO, 'ATIVO'); });
test('42 homologacao humana na data oficial', () => { const req = baseRequest({ MODALIDADE_SOLICITADA: 'DESLIGAMENTO_FIM_SEMESTRE', STATUS_SOLICITACAO: 'PRONTO_PARA_ANALISE_FINAL' }); const f = storeFactory({ requests: [req], session: adminSession(), now: new Date(2026, 5, 25, 12) }); const r = sandbox.membersAdminSolicitacaoVinculoHomologarEfetivarDesligamento({ idSolicitacao: 'SVI-TESTE', ataReferencia: 'ATA-TESTE', confirmacaoReforcada: true }, memberContext(f.deps)); assert.equal(r.ok, true); });
test('43 cancelamento antes da homologacao final', () => { const req = baseRequest({ MODALIDADE_SOLICITADA: 'DESLIGAMENTO_FIM_SEMESTRE', STATUS_SOLICITACAO: 'PRONTO_PARA_ANALISE_FINAL' }); const f = storeFactory({ requests: [req] }); const r = sandbox.membersMeuVinculoCancelarSolicitacao({ idSolicitacao: 'SVI-TESTE' }, memberContext(f.deps)); assert.equal(r.ok, true); });
test('44 alteracao de calendario fica auditada', () => { const req = baseRequest({ MODALIDADE_SOLICITADA: 'DESLIGAMENTO_FIM_SEMESTRE', STATUS_SOLICITACAO: 'AGENDADO_PARA_ANALISE_FINAL', DATA_FIM_SEMESTRE_SNAPSHOT: '2026-06-20' }); const f = storeFactory({ requests: [req], now: new Date(2026, 5, 25, 12) }); sandbox.membersVinculoJobProcessar({ ambiente: 'DEV', __deps: f.deps }); assert.match(f.store['PESSOAS:SOLICITACOES_VINCULO'].records[0].AUDITORIA_JSON, /calendarioAlterado/); });
test('45 execucao usa data oficial atualizada', () => { const req = baseRequest({ MODALIDADE_SOLICITADA: 'DESLIGAMENTO_FIM_SEMESTRE', STATUS_SOLICITACAO: 'PRONTO_PARA_ANALISE_FINAL', DATA_FIM_SEMESTRE_SNAPSHOT: '2026-06-20' }); const f = storeFactory({ requests: [req], session: adminSession(), now: new Date(2026, 5, 25, 12) }); sandbox.membersAdminSolicitacaoVinculoHomologarEfetivarDesligamento({ idSolicitacao: 'SVI-TESTE', ataReferencia: 'ATA-TESTE', confirmacaoReforcada: true }, memberContext(f.deps)); assert.equal(f.store['PESSOAS:VINCULOS'].records[0].DATA_FIM, '2026-06-25'); });

test('46 frontend nao escolhe ID_PESSOA', () => { const f = storeFactory(); const r = sandbox.membersMeuVinculoSolicitarDesligamento(dismissalPayload({ idPessoa: 'P-TERCEIRO' }), memberContext(f.deps)); assert.equal(r.code, 'ALVO_VINCULO_NAO_PERMITIDO'); });
test('47 membro nao cancela solicitacao de terceiro', () => { const f = storeFactory({ requests: [baseRequest({ ID_PESSOA: 'P-OUTRA', STATUS_SOLICITACAO: 'RECEBIDO' })] }); const r = sandbox.membersMeuVinculoCancelarSolicitacao({ idSolicitacao: 'SVI-TESTE' }, memberContext(f.deps)); assert.equal(r.code, 'SOLICITACAO_VINCULO_DE_TERCEIRO'); });
test('48 administrador sem permissao', () => { const f = storeFactory({ requests: [baseRequest()], session: { autenticado: true, idPessoa: 'P-X', email: 'x@example.invalid', permissoes: [] } }); const r = sandbox.membersAdminSolicitacoesVinculoListar({}, memberContext(f.deps)); assert.equal(r.code, 'ACESSO_NEGADO'); });
test('49 clique duplo gera uma linha', () => { const f = storeFactory(); const first = sandbox.membersMeuVinculoSolicitarDesligamento(dismissalPayload(), memberContext(f.deps)); const second = sandbox.membersMeuVinculoSolicitarDesligamento(dismissalPayload(), memberContext(f.deps)); assert.equal(first.ok, true); assert.equal(second.data.idempotente, true); assert.equal(f.store['PESSOAS:SOLICITACOES_VINCULO'].records.length, 1); });
test('50 mesma chave retorna protocolo original', () => { const f = storeFactory(); const first = sandbox.membersMeuVinculoSolicitarDesligamento(dismissalPayload(), memberContext(f.deps)); const second = sandbox.membersMeuVinculoSolicitarDesligamento(dismissalPayload(), memberContext(f.deps)); assert.equal(first.data.idSolicitacao, second.data.idSolicitacao); });
test('51 duas solicitacoes abertas sao bloqueadas', () => { const f = storeFactory({ requests: [baseRequest({ STATUS_SOLICITACAO: 'RECEBIDO' })] }); const r = sandbox.membersMeuVinculoSolicitarDesligamento(dismissalPayload({ chaveIdempotencia: 'outra-chave-0002' }), memberContext(f.deps)); assert.equal(r.code, 'SOLICITACAO_VINCULO_ABERTA_EXISTENTE'); });
test('52 suspensao e desligamento concorrentes sao bloqueados', () => { const f = storeFactory({ requests: [baseRequest({ TIPO_SOLICITACAO: 'SUSPENSAO_VOLUNTARIA', STATUS_SOLICITACAO: 'EM_ANALISE' })] }); const r = sandbox.membersMeuVinculoSolicitarDesligamento(dismissalPayload({ chaveIdempotencia: 'outra-chave-0003' }), memberContext(f.deps)); assert.equal(r.code, 'SOLICITACAO_VINCULO_ABERTA_EXISTENTE'); });
test('53 codigo e respostas nao registram dados sensiveis', () => { const text = files.map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n'); assert(!/console\.(log|error|warn)/.test(text)); assert(!/CPF_COMPLETO|SENHA|TOKEN_FIREBASE/.test(text)); });
test('54 fluxo DEV nao acessa PROD', () => { const f = storeFactory(); sandbox.membersMeuVinculoSolicitarDesligamento(dismissalPayload(), memberContext(f.deps)); assert(f.access.every((item) => item.environment === 'DEV')); });
test('55 nenhuma dependencia do modulo legado', () => { const text = files.map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n'); ['GEAPA_DESLIGAMENTOS','OFFBOARD_RESPONSES','OFFBOARD_QUEUE_SUSPENSIONS','OFFBOARD_QUEUE_DISMISSALS','PEDIDOS_SUSPENSAO','PEDIDOS_DESLIGAMENTO'].forEach((legacy) => assert(!text.includes(legacy), legacy)); });

test('56 falha depois de atualizar vinculo preserva etapa recuperavel', () => { const req = baseRequest({ TIPO_SOLICITACAO: 'SUSPENSAO_VOLUNTARIA', STATUS_SOLICITACAO: 'HOMOLOGADO_AGUARDANDO_INICIO', DATA_INICIO_PRETENDIDA: '2026-03-10', DATA_FIM_PRETENDIDA: '2026-03-20' }); const f = storeFactory({ requests: [req] }); f.store['PESSOAS:EVENTOS'].sheet.getRange = () => ({ setValues: () => { throw Object.assign(new Error('falha evento'), { code: 'TEST_EVENT_FAIL' }); } }); assert.throws(() => sandbox.membersVinculoExecuteEffect_({ environment: 'DEV', queue: f.store['PESSOAS:SOLICITACOES_VINCULO'], now: new Date(2026, 2, 10, 12), actor: 'JOB' }, f.store['PESSOAS:SOLICITACOES_VINCULO'].records[0], 'SUSPENSAO', {}, f.deps)); assert.equal(f.store['PESSOAS:VINCULOS'].records[0].STATUS_VINCULO, 'SUSPENSO'); assert.equal(f.store['PESSOAS:SOLICITACOES_VINCULO'].records[0].STATUS_SOLICITACAO, 'ERRO_EXECUCAO'); });
test('57 falha depois de criar evento nao o duplica', () => { let fail = true; const req = baseRequest({ TIPO_SOLICITACAO: 'SUSPENSAO_VOLUNTARIA', STATUS_SOLICITACAO: 'HOMOLOGADO_AGUARDANDO_INICIO', DATA_INICIO_PRETENDIDA: '2026-03-10', DATA_FIM_PRETENDIDA: '2026-03-20' }); const f = storeFactory({ requests: [req], recalculateSummary: () => { if (fail) throw Object.assign(new Error('falha resumo'), { code: 'TEST_SUMMARY_FAIL' }); } }); assert.throws(() => sandbox.membersVinculoExecuteEffect_({ environment: 'DEV', queue: f.store['PESSOAS:SOLICITACOES_VINCULO'], now: new Date(2026, 2, 10, 12), actor: 'JOB' }, f.store['PESSOAS:SOLICITACOES_VINCULO'].records[0], 'SUSPENSAO', {}, f.deps)); fail = false; sandbox.membersVinculoExecuteEffect_({ environment: 'DEV', queue: f.store['PESSOAS:SOLICITACOES_VINCULO'], now: new Date(2026, 2, 10, 12), actor: 'JOB' }, f.store['PESSOAS:SOLICITACOES_VINCULO'].records[0], 'SUSPENSAO', {}, f.deps); assert.equal(f.store['PESSOAS:EVENTOS'].records.length, 1); });
test('58 falha depois do resumo mantem efeitos para retomada', () => { const req = baseRequest(); const f = storeFactory({ requests: [req], session: adminSession() }); const original = sandbox.membersVinculoUpdate_; let summaryDone = false; let thrown = false; f.deps.recalculateSummary = () => { summaryDone = true; }; sandbox.membersVinculoUpdate_ = function(src, record, changes) { if (summaryDone && changes.STATUS_SOLICITACAO === 'EXECUTADO' && !thrown) { thrown = true; throw Object.assign(new Error('falha final'), { code: 'TEST_FINAL_WRITE' }); } return original(src, record, changes); }; try { const r = sandbox.membersAdminSolicitacaoVinculoHomologarEfetivarDesligamento({ idSolicitacao: 'SVI-TESTE', ataReferencia: 'ATA-TESTE', confirmacaoReforcada: true }, memberContext(f.deps)); assert.equal(r.code, 'TEST_FINAL_WRITE'); assert.equal(f.store['PESSOAS:VINCULOS'].records[0].STATUS_VINCULO, 'DESLIGADO'); assert.equal(f.store['PESSOAS:EVENTOS'].records.length, 1); } finally { sandbox.membersVinculoUpdate_ = original; } });
test('59 falha de e-mail nao desfaz solicitacao', () => { const f = storeFactory({ notify: () => ({ ok: false, message: 'indisponivel' }) }); const r = sandbox.membersMeuVinculoSolicitarDesligamento(dismissalPayload(), memberContext(f.deps)); assert.equal(r.ok, true); assert.equal(f.store['PESSOAS:SOLICITACOES_VINCULO'].records.length, 1); assert.equal(r.warnings[0].code, 'NOTIFICACAO_NAO_ENVIADA'); });
test('60 retomada de erro de retorno nao cria novo retorno', () => { const req = baseRequest({ TIPO_SOLICITACAO: 'SUSPENSAO_VOLUNTARIA', STATUS_SOLICITACAO: 'ERRO_EXECUCAO', DATA_INICIO_PRETENDIDA: '2026-03-01', DATA_FIM_PRETENDIDA: '2026-03-10', ID_EVENTO_SUSPENSAO: 'EV-S', ID_EVENTO_RETORNO: 'EV-R', ETAPA_EXECUCAO: 'EVENTO_RETORNO_REGISTRADO' }); const f = storeFactory({ requests: [req], links: [{ ID_VINCULO: 'V-1', ID_PESSOA: 'P-1', TIPO_VINCULO: 'MEMBRO_EFETIVO', STATUS_VINCULO: 'ATIVO', ATIVO: 'SIM' }], events: [{ ID_EVENTO_MEMBRO: 'EV-R', ID_VINCULO: 'V-1', TIPO_EVENTO: 'RETORNO', STATUS_EVENTO: 'HOMOLOGADO', OBSERVACOES: 'SOLICITACAO=SVI-TESTE' }], session: adminSession() }); const r = sandbox.membersAdminSolicitacaoVinculoReprocessar({ idSolicitacao: 'SVI-TESTE' }, memberContext(f.deps)); assert.equal(r.ok, true); assert.equal(f.store['PESSOAS:EVENTOS'].records.filter((e) => e.TIPO_EVENTO === 'RETORNO').length, 1); });

test('61 parametro inativo bloqueia', () => { const p = normative(); p.SUSPENSAO_MINIMA.vigente = false; code(() => sandbox.membersVinculoValidateNormativeParameter_(p.SUSPENSAO_MINIMA, 'SUSPENSAO_MINIMA'), 'PARAMETRO_NORMATIVO_NAO_VIGENTE'); });
test('62 modulo normativo incompativel bloqueia', () => { const p = normative(); p.SUSPENSAO_MINIMA.moduloSistema = 'OUTRO_MODULO'; code(() => sandbox.membersVinculoValidateNormativeParameter_(p.SUSPENSAO_MINIMA, 'SUSPENSAO_MINIMA'), 'PARAMETRO_NORMATIVO_MODULO_INCOMPATIVEL'); });
test('63 mudanca de regra sem nova base legal bloqueia', () => { const before = normative(); const after = normative(before.SUSPENSAO_MINIMA.valor + 1, before.BLOQUEIO_DESLIGAMENTO_ANTES_APRESENTACAO.valor); after.SUSPENSAO_MINIMA.baseLegal = before.SUSPENSAO_MINIMA.baseLegal; code(() => sandbox.membersVinculoCompareNormativeSnapshots_(baseRequest({}, before), after), 'PARAMETRO_NORMATIVO_SEM_ATUALIZACAO_BASE_LEGAL'); });
test('64 divergencia normativa exige tratamento administrativo', () => { const before = normative(); const after = normative(before.SUSPENSAO_MINIMA.valor + 1, before.BLOQUEIO_DESLIGAMENTO_ANTES_APRESENTACAO.valor, 'B'); const comparison = sandbox.membersVinculoCompareNormativeSnapshots_(baseRequest({}, before), after); code(() => sandbox.membersVinculoRequireTransitionTreatment_(comparison, {}, 'admin', true), 'PARAMETRO_NORMATIVO_DIVERGENTE'); });
test('65 suspensao nao exige ata', () => assert.equal(sandbox.membersVinculoAssertFinalDecisionDocument_({ TIPO_SOLICITACAO: 'SUSPENSAO_VOLUNTARIA' }, {}), true));
test('66 desligamento final sem ata bloqueia', () => code(() => sandbox.membersVinculoAssertFinalDecisionDocument_({ TIPO_SOLICITACAO: 'DESLIGAMENTO_VOLUNTARIO' }, {}, { exigeAta: true }), 'ATA_DECISAO_FINAL_OBRIGATORIA'));
test('67 setup permanece dry-run por padrao', () => { const spreadsheet = { getSheetByName: () => null }; const report = sandbox.membersVinculoSetupSolicitacoesV2({ ambiente: 'DEV', spreadsheet }); assert.equal(report.dryRun, true); assert.equal(report.writes, 0); });
test('68 reenvio de notificacao e idempotente por solicitacao e evento', () => { const f = storeFactory({ requests: [baseRequest({ STATUS_SOLICITACAO: 'INDEFERIDO' })], session: adminSession() }); const r = sandbox.membersAdminSolicitacaoVinculoReenviarNotificacao({ idSolicitacao: 'SVI-TESTE' }, memberContext(f.deps)); assert.equal(r.ok, true); assert.equal(r.data.tipoEvento, 'SOLICITACAO_VINCULO_INDEFERIDA'); });

test('69 parametro booleano SIM exige ata', () => { const p = normative(); const req = baseRequest({}, p); const comparison = sandbox.membersVinculoCompareNormativeSnapshots_(req, p); const rule = sandbox.membersVinculoResolveFinalMinutesRequirement_(req, comparison, { divergent: false }); assert.equal(rule.exigeAta, true); assert.equal(rule.baseLegal, 'NC01-2025-ART16-IV'); });
test('70 parametro booleano NAO dispensa ata com nova base legal', () => { const p = normative(6, 4, 'B', false); const req = baseRequest({}, p); const comparison = sandbox.membersVinculoCompareNormativeSnapshots_(req, p); const rule = sandbox.membersVinculoResolveFinalMinutesRequirement_(req, comparison, { divergent: false }); assert.equal(rule.exigeAta, false); assert.match(rule.baseLegal, /DISPENSA-ATA/); });
test('71 valor booleano invalido bloqueia', () => { const p = normative(); p.DESLIGAMENTO_VOLUNTARIO_DECISAO_FINAL_EXIGE_ATA.valor = 'TALVEZ'; code(() => sandbox.membersVinculoValidateFinalMinutesParameter_(p.DESLIGAMENTO_VOLUNTARIO_DECISAO_FINAL_EXIGE_ATA), 'PARAMETRO_NORMATIVO_VALOR_BOOLEANO_INVALIDO'); });
test('72 dispensa com base legal atual e bloqueada', () => { const p = normative(); p.DESLIGAMENTO_VOLUNTARIO_DECISAO_FINAL_EXIGE_ATA.valor = false; code(() => sandbox.membersVinculoValidateFinalMinutesParameter_(p.DESLIGAMENTO_VOLUNTARIO_DECISAO_FINAL_EXIGE_ATA), 'PARAMETRO_NORMATIVO_BASE_LEGAL_INCOMPATIVEL'); });
test('73 solicitacao grava snapshot da regra de ata', () => { const f = storeFactory(); const r = sandbox.membersMeuVinculoSolicitarDesligamento(dismissalPayload(), memberContext(f.deps)); const saved = f.store['PESSOAS:SOLICITACOES_VINCULO'].records[0]; assert.equal(r.ok, true); assert.equal(saved.PARAMETRO_ATA_DESLIGAMENTO_ID, 'DESLIGAMENTO_VOLUNTARIO_DECISAO_FINAL_EXIGE_ATA'); assert.equal(saved.ATA_DESLIGAMENTO_OBRIGATORIA_SNAPSHOT, 'SIM'); assert.equal(saved.ATA_DESLIGAMENTO_TIPO_VALOR_SNAPSHOT, 'BOOLEANO'); });
test('74 detalhe administrativo informa requisito efetivo', () => { const req = baseRequest(); const f = storeFactory({ requests: [req], session: adminSession() }); const r = sandbox.membersAdminSolicitacaoVinculoDetalhe({ idSolicitacao: 'SVI-TESTE' }, memberContext(f.deps)); assert.equal(r.ok, true); assert.equal(r.data.requisitosDecisaoFinal.exigeAta, true); assert.equal(r.data.requisitosDecisaoFinal.origemRegra, 'VIGENTE'); });
test('75 desligamento imediato pode ir de RECEBIDO para EXECUTADO', () => { const req = baseRequest({ STATUS_SOLICITACAO: 'RECEBIDO' }); const f = storeFactory({ requests: [req], session: adminSession() }); const r = sandbox.membersAdminSolicitacaoVinculoHomologarEfetivarDesligamento({ idSolicitacao: 'SVI-TESTE', ataReferencia: 'ATA-TESTE', confirmacaoReforcada: true }, memberContext(f.deps)); assert.equal(r.ok, true); assert.equal(r.data.status, 'EXECUTADO'); assert.equal(f.store['PESSOAS:EVENTOS'].records.length, 1); });
test('76 transicao direta nao e liberada para modalidade errada', () => { const req = baseRequest({ STATUS_SOLICITACAO: 'RECEBIDO', MODALIDADE_SOLICITADA: 'DESLIGAMENTO_FIM_SEMESTRE' }); const f = storeFactory({ requests: [req], session: adminSession(), now: new Date(2026, 5, 25, 12) }); const r = sandbox.membersAdminSolicitacaoVinculoHomologarEfetivarDesligamento({ idSolicitacao: 'SVI-TESTE', ataReferencia: 'ATA-TESTE', confirmacaoReforcada: true }, memberContext(f.deps)); assert.equal(r.code, 'TRANSICAO_STATUS_INVALIDA'); assert.equal(f.store['PESSOAS:SOLICITACOES_VINCULO'].records[0].STATUS_SOLICITACAO, 'RECEBIDO'); });
test('77 analise preliminar de fim de semestre parte de RECEBIDO', () => { const req = baseRequest({ STATUS_SOLICITACAO: 'RECEBIDO', MODALIDADE_SOLICITADA: 'DESLIGAMENTO_FIM_SEMESTRE' }); const f = storeFactory({ requests: [req], session: adminSession() }); const r = sandbox.membersAdminSolicitacaoVinculoRegistrarAnalisePreliminar({ idSolicitacao: 'SVI-TESTE', observacao: 'Analise preliminar suficiente.' }, memberContext(f.deps)); assert.equal(r.ok, true); assert.equal(r.data.status, 'AGENDADO_PARA_ANALISE_FINAL'); assert.equal(f.store['PESSOAS:EVENTOS'].records.length, 0); });
test('78 indeferimento direto exige ata quando regra SIM', () => { const req = baseRequest({ STATUS_SOLICITACAO: 'RECEBIDO' }); const f = storeFactory({ requests: [req], session: adminSession() }); const r = sandbox.membersAdminSolicitacaoVinculoIndeferir({ idSolicitacao: 'SVI-TESTE', obsDecisao: 'Motivo suficiente do indeferimento.' }, memberContext(f.deps)); assert.equal(r.code, 'ATA_DECISAO_FINAL_OBRIGATORIA'); assert.equal(f.store['PESSOAS:SOLICITACOES_VINCULO'].records[0].STATUS_SOLICITACAO, 'RECEBIDO'); });
test('79 indeferimento direto dispensa ata quando regra NAO', () => { const p = normative(6, 4, 'C', false); const req = baseRequest({ STATUS_SOLICITACAO: 'RECEBIDO' }, p); const f = storeFactory({ requests: [req], session: adminSession(), parameters: p }); const r = sandbox.membersAdminSolicitacaoVinculoIndeferir({ idSolicitacao: 'SVI-TESTE', obsDecisao: 'Motivo suficiente do indeferimento.' }, memberContext(f.deps)); assert.equal(r.ok, true); assert.equal(r.data.status, 'INDEFERIDO'); });
test('80 execucao direta repetida e idempotente', () => { let notifications = 0; const req = baseRequest({ STATUS_SOLICITACAO: 'RECEBIDO' }); const f = storeFactory({ requests: [req], session: adminSession(), notify: () => { notifications += 1; return { ok: true }; } }); const payload = { idSolicitacao: 'SVI-TESTE', ataReferencia: 'ATA-TESTE', confirmacaoReforcada: true }; const first = sandbox.membersAdminSolicitacaoVinculoHomologarEfetivarDesligamento(payload, memberContext(f.deps)); const second = sandbox.membersAdminSolicitacaoVinculoHomologarEfetivarDesligamento(payload, memberContext(f.deps)); assert.equal(first.ok, true); assert.equal(second.data.idempotente, true); assert.equal(f.store['PESSOAS:EVENTOS'].records.length, 1); assert.equal(f.summaries, 1); assert.equal(notifications, 1); });
test('81 confirmacao ausente nao altera RECEBIDO', () => { const req = baseRequest({ STATUS_SOLICITACAO: 'RECEBIDO' }); const f = storeFactory({ requests: [req], session: adminSession() }); const r = sandbox.membersAdminSolicitacaoVinculoHomologarEfetivarDesligamento({ idSolicitacao: 'SVI-TESTE', ataReferencia: 'ATA-TESTE' }, memberContext(f.deps)); assert.equal(r.code, 'CONFIRMACAO_REFORCADA_OBRIGATORIA'); assert.equal(f.store['PESSOAS:SOLICITACOES_VINCULO'].records[0].STATUS_SOLICITACAO, 'RECEBIDO'); });
test('82 conflito revalidado nao altera RECEBIDO', () => { const req = baseRequest({ STATUS_SOLICITACAO: 'RECEBIDO' }); const f = storeFactory({ requests: [req], session: adminSession(), assessExternal: () => ({ apresentacao: 'CONFLITO', arquivos: 'SEM_PENDENCIA', obrigacoes: 'SEM_PENDENCIA', funcao: 'SEM_FUNCAO', mensagem: 'Conflito.' }) }); const r = sandbox.membersAdminSolicitacaoVinculoHomologarEfetivarDesligamento({ idSolicitacao: 'SVI-TESTE', ataReferencia: 'ATA-TESTE', confirmacaoReforcada: true }, memberContext(f.deps)); assert.equal(r.code, 'CONFLITO_APRESENTACAO_BLOQUEANTE'); assert.equal(f.store['PESSOAS:SOLICITACOES_VINCULO'].records[0].STATUS_SOLICITACAO, 'RECEBIDO'); assert.equal(f.store['PESSOAS:EVENTOS'].records.length, 0); });
test('83 divergencia normativa sem tratamento preserva RECEBIDO', () => { const snapshotParams = normative(); const currentParams = normative(6, 4, 'NOVA', false); const req = baseRequest({ STATUS_SOLICITACAO: 'RECEBIDO' }, snapshotParams); const f = storeFactory({ requests: [req], session: adminSession(), parameters: currentParams }); const r = sandbox.membersAdminSolicitacaoVinculoHomologarEfetivarDesligamento({ idSolicitacao: 'SVI-TESTE', confirmacaoReforcada: true }, memberContext(f.deps)); assert.equal(r.code, 'PARAMETRO_NORMATIVO_DIVERGENTE'); assert.equal(f.store['PESSOAS:SOLICITACOES_VINCULO'].records[0].STATUS_SOLICITACAO, 'RECEBIDO'); });
test('84 setup dry-run recomenda cabecalhos e linha normativa tipada', () => { const spreadsheet = { getSheetByName: () => ({ getLastColumn: () => queueHeaders.length, getRange: () => ({ getValues: () => [queueHeaders] }) }) }; const r = sandbox.membersVinculoSetupSolicitacoesV2({ ambiente: 'DEV', spreadsheet }); const audit = sandbox.membersVinculoAuditarRegistryV2({ ambiente: 'DEV' }); assert.equal(r.writes, 0); assert.equal(audit.normativeRecommendation.requiredRow.TIPO_VALOR, 'BOOLEANO'); assert.equal(audit.normativeRecommendation.requiredRow.VALOR, 'SIM'); });
test('85 execucao direta exige permissoes de homologar e executar', () => { const req = baseRequest({ STATUS_SOLICITACAO: 'RECEBIDO' }); const f = storeFactory({ requests: [req], session: { autenticado: true, idPessoa: 'P-ADMIN', email: 'admin@example.invalid', permissoes: ['membros:analisar_solicitacoes_vinculo'] } }); const r = sandbox.membersAdminSolicitacaoVinculoHomologarEfetivarDesligamento({ idSolicitacao: 'SVI-TESTE', ataReferencia: 'ATA-TESTE', confirmacaoReforcada: true }, memberContext(f.deps)); assert.equal(r.code, 'ACESSO_NEGADO'); assert.equal(f.store['PESSOAS:SOLICITACOES_VINCULO'].records[0].STATUS_SOLICITACAO, 'RECEBIDO'); });
test('86 suspensao nao usa atalho de execucao direta', () => { const req = baseRequest({ STATUS_SOLICITACAO: 'RECEBIDO', TIPO_SOLICITACAO: 'SUSPENSAO_VOLUNTARIA', MODALIDADE_SOLICITADA: 'SUSPENSAO_TEMPORARIA' }); code(() => sandbox.membersVinculoAssertRequestTransition_(req, 'EXECUTADO', 'HOMOLOGAR_E_EFETIVAR_DESLIGAMENTO'), 'TRANSICAO_STATUS_INVALIDA'); });
test('87 regra NAO permite homologacao sem ata', () => { const p = normative(6, 4, 'D', false); const req = baseRequest({ STATUS_SOLICITACAO: 'RECEBIDO' }, p); const f = storeFactory({ requests: [req], session: adminSession(), parameters: p }); const r = sandbox.membersAdminSolicitacaoVinculoHomologarEfetivarDesligamento({ idSolicitacao: 'SVI-TESTE', confirmacaoReforcada: true }, memberContext(f.deps)); assert.equal(r.ok, true); assert.equal(r.data.status, 'EXECUTADO'); });
test('88 solicitacao antiga exige tratamento vigente e continua detalhavel', () => { const req = baseRequest({ STATUS_SOLICITACAO: 'RECEBIDO', PARAMETRO_ATA_DESLIGAMENTO_ID: '', ATA_DESLIGAMENTO_OBRIGATORIA_SNAPSHOT: '', ATA_DESLIGAMENTO_BASE_LEGAL_SNAPSHOT: '', ATA_DESLIGAMENTO_TIPO_VALOR_SNAPSHOT: '' }); const f = storeFactory({ requests: [req], session: adminSession() }); const detail = sandbox.membersAdminSolicitacaoVinculoDetalhe({ idSolicitacao: 'SVI-TESTE' }, memberContext(f.deps)); assert.equal(detail.ok, true); assert.equal(detail.data.requisitosDecisaoFinal.exigeTratamentoTransicao, true); assert.equal(detail.data.requisitosDecisaoFinal.snapshot.disponivel, false); });
test('89 solicitacao antiga nao permite inventar snapshot', () => { const req = baseRequest({ STATUS_SOLICITACAO: 'RECEBIDO', PARAMETRO_ATA_DESLIGAMENTO_ID: '', ATA_DESLIGAMENTO_OBRIGATORIA_SNAPSHOT: '', ATA_DESLIGAMENTO_BASE_LEGAL_SNAPSHOT: '', ATA_DESLIGAMENTO_TIPO_VALOR_SNAPSHOT: '' }); const f = storeFactory({ requests: [req], session: adminSession() }); const r = sandbox.membersAdminSolicitacaoVinculoHomologarEfetivarDesligamento({ idSolicitacao: 'SVI-TESTE', tratamentoTransicao: 'APLICAR_SNAPSHOT', justificativaAdministrativaReforcada: 'Justificativa administrativa reforcada suficiente.', ataReferencia: 'ATA-TESTE', confirmacaoReforcada: true }, memberContext(f.deps)); assert.equal(r.code, 'PARAMETRO_ATA_DESLIGAMENTO_SNAPSHOT_AUSENTE'); assert.equal(f.store['PESSOAS:SOLICITACOES_VINCULO'].records[0].STATUS_SOLICITACAO, 'RECEBIDO'); });
test('90 solicitacao antiga pode adotar regra vigente auditavelmente', () => { const req = baseRequest({ STATUS_SOLICITACAO: 'RECEBIDO', PARAMETRO_ATA_DESLIGAMENTO_ID: '', ATA_DESLIGAMENTO_OBRIGATORIA_SNAPSHOT: '', ATA_DESLIGAMENTO_BASE_LEGAL_SNAPSHOT: '', ATA_DESLIGAMENTO_TIPO_VALOR_SNAPSHOT: '' }); const f = storeFactory({ requests: [req], session: adminSession() }); const r = sandbox.membersAdminSolicitacaoVinculoHomologarEfetivarDesligamento({ idSolicitacao: 'SVI-TESTE', tratamentoTransicao: 'APLICAR_VIGENTE', justificativaAdministrativaReforcada: 'Justificativa administrativa reforcada suficiente.', ataReferencia: 'ATA-TESTE', confirmacaoReforcada: true }, memberContext(f.deps)); assert.equal(r.ok, true); assert.equal(f.store['PESSOAS:SOLICITACOES_VINCULO'].records[0].TRATAMENTO_TRANSICAO, 'APLICAR_VIGENTE'); });
test('91 ausencia da regra de ata nao bloqueia suspensao', () => { const p = normative(); delete p.DESLIGAMENTO_VOLUNTARIO_DECISAO_FINAL_EXIGE_ATA; const f = storeFactory({ parameters: p }); const r = sandbox.membersMeuVinculoSolicitarSuspensao(suspensionPayload(), memberContext(f.deps)); assert.equal(r.ok, true); assert.equal(f.store['PESSOAS:SOLICITACOES_VINCULO'].records.length, 1); });

let passed = 0;
for (const item of tests) {
  try {
    item.fn();
    passed += 1;
    process.stdout.write(`ok ${passed} - ${item.name}\n`);
  } catch (error) {
    process.stderr.write(`not ok ${passed + 1} - ${item.name}\n${error.stack}\n`);
    process.exitCode = 1;
    break;
  }
}
if (!process.exitCode) process.stdout.write(`# ${passed}/${tests.length} testes passaram\n`);
