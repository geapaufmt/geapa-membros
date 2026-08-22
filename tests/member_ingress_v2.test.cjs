'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const sandbox = { console };
vm.createContext(sandbox);
['10_members_vinculo_v2_config.gs', '11_members_vinculo_v2_engine.gs', '12_members_vinculo_v2_service.gs', '16_members_ingress_v2.gs']
  .forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file }));

const headers = {
  INGRESSOS_MEMBROS: ['ID_INGRESSO','CHAVE_IDEMPOTENCIA','STATUS_INGRESSO','MODALIDADE_CADASTRO','ID_PESSOA','ID_VINCULO','ID_EVENTO_INGRESSO','EMAIL','RGA','CURSO_ID','DATA_INGRESSO','SEMESTRE_ENTRADA','FORMA_INGRESSO','DOCUMENTO_REFERENCIA','OBS_ADMINISTRATIVA','ETAPA_EXECUCAO','ERRO_EXECUCAO','CRIADO_EM','CRIADO_POR','EXECUTADO_EM','EXECUTADO_POR','ATUALIZADO_EM','AUDITORIA_JSON'],
  BASE: ['ID_PESSOA','NOME_COMPLETO','NOME_EXIBICAO','EMAIL_PRINCIPAL','TELEFONE_PRINCIPAL','STATUS_CADASTRAL','DATA_NASCIMENTO','INSTAGRAM','CRIADO_EM','ATUALIZADO_EM','ATIVO'],
  IDENTIFICADORES: ['ID_IDENTIFICADOR','ID_PESSOA','TIPO_IDENTIFICADOR','VALOR_IDENTIFICADOR','PRINCIPAL','ATIVO','OBS'],
  MEMBROS_DETALHES: ['ID_PESSOA','RGA','SEMESTRE_ENTRADA','PERIODO_INGRESSO_CURSO','SEMESTRE_ATUAL_CURSO_CALCULADO','SEMESTRE_ATUAL_CURSO_CALCULADO_EM','STATUS_COMPLETUDE_CADASTRAL','COMPLETUDE_CADASTRAL_ATUALIZADA_EM','DATA_INTEGRACAO_ORIGINAL','CURSO_ID','NOME_CURSO','INSTITUICAO','CAMPUS','NIVEL','ATUALIZADO_EM'],
  VINCULOS: ['ID_VINCULO','ID_PESSOA','TIPO_VINCULO','STATUS_VINCULO','DATA_INICIO','DATA_FIM','MOTIVO_INICIO','MOTIVO_FIM','FONTE','LINK_ATA_OU_PROCESSO','OBS_PUBLICA','OBS_INTERNA','ATIVO'],
  EVENTOS: ['ID_EVENTO_MEMBRO','RGA','ID_PESSOA','ID_VINCULO','TIPO_EVENTO','DATA_EVENTO','STATUS_EVENTO','MODULO_ORIGEM','CHAVE_ORIGEM','OBSERVACOES','ATUALIZADO_EM','PROCESSADO_POR_MODULO','DATA_PROCESSAMENTO','ERRO_PROCESSAMENTO'],
  CURSOS_CATALOGO: ['CURSO_ID'],
  SEMESTRES: ['ID_SEMESTRE']
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function source(name, records = []) {
  const output = { headers: headers[name].slice(), records: records.map((record, index) => Object.assign({ __rowNumber: index + 2 }, clone(record))) };
  output.sheet = {
    getLastRow: () => output.records.length + 1,
    getRange: () => ({ setValues: () => output.sheet })
  };
  return output;
}

function person(id = 'PES-EXISTENTE') {
  return {
    base: [{ ID_PESSOA: id, NOME_COMPLETO: 'Pessoa Existente', EMAIL_PRINCIPAL: 'pessoa.nova@example.invalid', ATIVO: 'SIM' }],
    identifiers: [
      { ID_IDENTIFICADOR: 'IDE-E', ID_PESSOA: id, TIPO_IDENTIFICADOR: 'EMAIL', VALOR_IDENTIFICADOR: 'pessoa.nova@example.invalid', PRINCIPAL: 'SIM', ATIVO: 'SIM' },
      { ID_IDENTIFICADOR: 'IDE-R', ID_PESSOA: id, TIPO_IDENTIFICADOR: 'RGA', VALOR_IDENTIFICADOR: '20260001', PRINCIPAL: 'SIM', ATIVO: 'SIM' }
    ],
    details: [{ ID_PESSOA: id, RGA: '20260001', DATA_INTEGRACAO_ORIGINAL: '2025-01-01' }]
  };
}

function payload(extra = {}) {
  return Object.assign({
    chaveIdempotencia: 'ingresso-v2-teste-0001', modalidadeCadastro: 'COMPLETO',
    nomeCompleto: 'Pessoa Nova Teste', nomeExibicao: 'Pessoa Nova', emailPrincipal: 'pessoa.nova@example.invalid',
    telefone: '(65) 99999-1234', rga: '2026.0001', cursoId: 'CURSO-TESTE', dataIngresso: '2026-08-21',
    semestreEntrada: '2026/2', formaIngresso: 'PROCESSO_SELETIVO', origemCadastro: 'SELETIVO_FECHADO',
    documentoReferencia: 'ATA-PS-2026-02', observacaoAdministrativa: 'Aprovacao institucional conferida.', dadosComplementares: {}
  }, extra);
}

function harness(options = {}) {
  const existing = options.existing ? person() : { base: [], identifiers: [], details: [] };
  const sources = {
    INGRESSOS_MEMBROS: source('INGRESSOS_MEMBROS'), BASE: source('BASE', existing.base),
    IDENTIFICADORES: source('IDENTIFICADORES', existing.identifiers), MEMBROS_DETALHES: source('MEMBROS_DETALHES', existing.details),
    VINCULOS: source('VINCULOS', options.links || []), EVENTOS: source('EVENTOS'),
    CURSOS_CATALOGO: source('CURSOS_CATALOGO'), SEMESTRES: source('SEMESTRES')
  };
  let uuid = 0;
  let recalculateCalls = 0;
  const deps = {
    now: () => new Date('2026-08-21T12:00:00Z'),
    uuid: () => `00000000-0000-0000-0000-00000000000${++uuid}`,
    withLock: (_key, callback) => callback(),
    resolveSession: () => ({ ok: true, autenticado: true, idPessoa: 'PES-ADMIN', permissoes: ['membros:cadastrar_novos_membros'] }),
    openSource: (_domain, logical) => sources[logical],
    validateCourse: () => ({ CURSO_ID: 'CURSO-TESTE', NOME_CURSO: 'Curso Teste', INSTITUICAO: 'UFMT', CAMPUS: 'Cuiaba', NIVEL: 'GRADUACAO' }),
    calculateAcademicSemester: () => ({ periodoIngressoCurso: '2026/1', semestreAtualCalculado: 2 }),
    validateOrigin: () => ({}),
    recalculateSummary: () => {
      recalculateCalls += 1;
      if (options.failFirstRecalculation && recalculateCalls === 1) return { ok: false, totalErros: 1 };
      return { ok: true, totalErros: 0 };
    },
    queueIngressMail: () => ({ ok: true })
  };
  const context = {
    ambienteDadosV2: 'DEV', featureFlags: { ENABLE_MEMBER_REGISTRATION: true }, requestId: 'REQ-INGRESSO',
    sessaoOficial: { email: 'admin@example.invalid' }, __deps: deps
  };
  return { sources, context, getRecalculateCalls: () => recalculateCalls };
}

function activeLink(type, id = 'VIN-ANTERIOR') {
  const status = type === 'MEMBRO_EM_ESPERA' ? 'EM_ESPERA' : (type === 'EGRESSO' ? 'EGRESSO' : 'ATIVO');
  return { ID_VINCULO: id, ID_PESSOA: 'PES-EXISTENTE', TIPO_VINCULO: type, STATUS_VINCULO: status, DATA_INICIO: '2025-01-01', ATIVO: 'SIM' };
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('validacao exige processo seletivo, origem e referencia administrativa', () => {
  assert.throws(() => sandbox.membersIngressValidatePayload_(payload({ formaIngresso: 'CONVITE_DIRETORIA' })), (error) => error.code === 'FORMA_INGRESSO_INVALIDA');
  assert.throws(() => sandbox.membersIngressValidatePayload_(payload({ origemCadastro: '' })), (error) => error.code === 'ORIGEM_CADASTRO_INVALIDA');
  assert.throws(() => sandbox.membersIngressValidatePayload_(payload({ documentoReferencia: '', observacaoAdministrativa: 'curta' })), (error) => error.code === 'REFERENCIA_ADMISSAO_OBRIGATORIA');
});

test('novo ID_PESSOA segue a sequencia canonica e ignora IDs UUID legados', () => {
  assert.equal(sandbox.membersIngressNextPersonId_({
    base: { records: [
      { ID_PESSOA: 'PES-000095' },
      { ID_PESSOA: 'PES-900001' },
      { ID_PESSOA: 'PES-1E43DB2F938A4C0CAA0C19510892F493' }
    ] },
    queue: { records: [] }
  }), 'PES-000096');
  assert.equal(sandbox.membersIngressNextPersonId_({
    base: { records: [{ ID_PESSOA: 'PES-000095' }] },
    queue: { records: [{ ID_PESSOA: 'PES-000096' }] }
  }), 'PES-000097');
});

test('pessoa nova gera vinculo ingressante, evento, resumo e auditoria de origem', () => {
  const h = harness();
  const result = sandbox.membersAdmissaoV2AdmitirIngressante(payload(), h.context);
  assert.equal(result.ok, true);
  assert.equal(h.sources.BASE.records.length, 1);
  assert.equal(h.sources.BASE.records[0].ID_PESSOA, 'PES-000001');
  assert.equal(h.sources.VINCULOS.records[0].TIPO_VINCULO, 'MEMBRO_INGRESSANTE');
  assert.equal(h.sources.EVENTOS.records[0].TIPO_EVENTO, 'INGRESSO_COMO_MEMBRO_INGRESSANTE');
  assert.match(h.sources.VINCULOS.records[0].OBS_INTERNA, /origemCadastro=SELETIVO_FECHADO/);
  assert.equal(Object.hasOwn(result.data, 'idPessoa'), false);
  assert.equal(Object.hasOwn(result.data, 'idVinculo'), false);
  assert.equal(h.getRecalculateCalls(), 1);
});

test('repeticao concluida com a mesma chave nao duplica entidades', () => {
  const h = harness();
  assert.equal(sandbox.membersAdmissaoV2AdmitirIngressante(payload(), h.context).ok, true);
  const second = sandbox.membersAdmissaoV2AdmitirIngressante(payload(), h.context);
  assert.equal(second.code, 'INGRESSO_MEMBRO_JA_EXECUTADO');
  assert.equal(h.sources.BASE.records.length, 1);
  assert.equal(h.sources.VINCULOS.records.length, 1);
  assert.equal(h.sources.EVENTOS.records.length, 1);
});

test('interessado existente reutiliza identidade e encerra vinculo anterior', () => {
  const h = harness({ existing: true, links: [activeLink('INTERESSADO_ATIVIDADES')] });
  const result = sandbox.membersAdmissaoV2AdmitirIngressante(payload(), h.context);
  assert.equal(result.ok, true);
  assert.equal(result.data.pessoaReutilizada, true);
  assert.equal(h.sources.BASE.records.length, 1);
  assert.equal(h.sources.VINCULOS.records[0].STATUS_VINCULO, 'ENCERRADO');
  assert.equal(h.sources.VINCULOS.records.filter((row) => row.TIPO_VINCULO === 'MEMBRO_INGRESSANTE').length, 1);
});

test('membro efetivo ativo bloqueia sem criar novo vinculo', () => {
  const h = harness({ existing: true, links: [activeLink('MEMBRO_EFETIVO')] });
  const result = sandbox.membersAdmissaoV2AdmitirIngressante(payload(), h.context);
  assert.equal(result.code, 'BLOQUEADO_JA_MEMBRO');
  assert.equal(h.sources.VINCULOS.records.length, 1);
  assert.equal(h.getRecalculateCalls(), 0);
});

test('membro ingressante ativo retorna sucesso idempotente sem duplicar', () => {
  const h = harness({ existing: true, links: [activeLink('MEMBRO_INGRESSANTE')] });
  const result = sandbox.membersAdmissaoV2AdmitirIngressante(payload(), h.context);
  assert.equal(result.code, 'MEMBRO_INGRESSANTE_JA_EXISTENTE');
  assert.equal(h.sources.VINCULOS.records.length, 1);
  assert.equal(h.sources.EVENTOS.records.length, 0);
});

test('membro em espera e promovido com evento especifico', () => {
  const h = harness({ existing: true, links: [activeLink('MEMBRO_EM_ESPERA')] });
  const result = sandbox.membersAdmissaoV2AdmitirIngressante(payload(), h.context);
  assert.equal(result.ok, true);
  assert.equal(h.sources.VINCULOS.records[0].STATUS_VINCULO, 'ENCERRADO');
  assert.equal(h.sources.EVENTOS.records[0].TIPO_EVENTO, 'PROMOCAO_MEMBRO_EM_ESPERA_PARA_INGRESSANTE');
});

test('egresso reingressa com evento especifico e mesma identidade', () => {
  const h = harness({ existing: true, links: [activeLink('EGRESSO')] });
  const result = sandbox.membersAdmissaoV2AdmitirIngressante(payload(), h.context);
  assert.equal(result.ok, true);
  assert.equal(result.data.pessoaReutilizada, true);
  assert.equal(h.sources.EVENTOS.records[0].TIPO_EVENTO, 'REINGRESSO_COMO_MEMBRO_INGRESSANTE');
});

test('falha apos criar entidades retoma com os mesmos IDs sem duplicacao', () => {
  const h = harness({ existing: true, links: [activeLink('MEMBRO_EM_ESPERA')], failFirstRecalculation: true });
  const first = sandbox.membersAdmissaoV2AdmitirIngressante(payload(), h.context);
  assert.equal(first.code, 'CORE_RECALCULO_RESUMO_FALHOU');
  const linkCount = h.sources.VINCULOS.records.length;
  const eventCount = h.sources.EVENTOS.records.length;
  const second = sandbox.membersAdmissaoV2AdmitirIngressante(payload(), h.context);
  assert.equal(second.ok, true);
  assert.equal(h.sources.VINCULOS.records.length, linkCount);
  assert.equal(h.sources.EVENTOS.records.length, eventCount);
  assert.equal(h.sources.VINCULOS.records[0].STATUS_VINCULO, 'ENCERRADO');
  assert.equal(h.getRecalculateCalls(), 2);
});

test('RGA e email em pessoas distintas exigem revisao humana', () => {
  const h = harness();
  h.sources.IDENTIFICADORES.records.push(
    { __rowNumber: 2, ID_PESSOA: 'PES-A', TIPO_IDENTIFICADOR: 'EMAIL', VALOR_IDENTIFICADOR: 'pessoa.nova@example.invalid', ATIVO: 'SIM' },
    { __rowNumber: 3, ID_PESSOA: 'PES-B', TIPO_IDENTIFICADOR: 'RGA', VALOR_IDENTIFICADOR: '20260001', ATIVO: 'SIM' }
  );
  const result = sandbox.membersAdmissaoV2AdmitirIngressante(payload(), h.context);
  assert.equal(result.code, 'IDENTIDADE_AMBIGUA_REVISAO_HUMANA');
  assert.equal(h.sources.VINCULOS.records.length, 0);
});

let failures = 0;
for (const item of tests) {
  try { item.fn(); process.stdout.write(`ok - ${item.name}\n`); }
  catch (error) { failures += 1; process.stderr.write(`not ok - ${item.name}\n${error.stack}\n`); }
}
if (failures) process.exitCode = 1;
