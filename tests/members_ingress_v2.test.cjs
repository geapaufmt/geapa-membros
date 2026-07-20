'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const sandbox = { console };
vm.createContext(sandbox);
['10_members_vinculo_v2_config.gs','11_members_vinculo_v2_engine.gs','12_members_vinculo_v2_service.gs','16_members_ingress_v2.gs']
  .forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file }));

const queueHeaders = ['ID_INGRESSO','CHAVE_IDEMPOTENCIA','STATUS_INGRESSO','MODALIDADE_CADASTRO','ID_PESSOA','ID_VINCULO','ID_EVENTO_INGRESSO','EMAIL','RGA','CURSO_ID','DATA_INGRESSO','SEMESTRE_ENTRADA','FORMA_INGRESSO','DOCUMENTO_REFERENCIA','OBS_ADMINISTRATIVA','ETAPA_EXECUCAO','ERRO_EXECUCAO','CRIADO_EM','CRIADO_POR','EXECUTADO_EM','EXECUTADO_POR','ATUALIZADO_EM','AUDITORIA_JSON'];
const baseHeaders = ['ID_PESSOA','NOME_COMPLETO','NOME_EXIBICAO','NOME_CIVIL','CPF','DATA_NASCIMENTO','EMAIL_PRINCIPAL','TELEFONE_PRINCIPAL','INSTAGRAM','CIDADE_NATAL','UF_ORIGEM','PAIS_ORIGEM_CODIGO','PAIS_ORIGEM_NOME','MUNICIPIO_ORIGEM_CODIGO','REGIAO_ORIGEM','SEXO','STATUS_CADASTRAL','OBS_INTERNA','CRIADO_EM','ATUALIZADO_EM','ATIVO'];
const identifierHeaders = ['ID_IDENTIFICADOR','ID_PESSOA','TIPO_IDENTIFICADOR','VALOR_IDENTIFICADOR','PRINCIPAL','ATIVO','OBS'];
const detailHeaders = ['ID_PESSOA','RGA','SEMESTRE_ENTRADA','SEMESTRE_ATUAL','CURSO_ID','CURSO_NOME_SNAPSHOT','INSTITUICAO_ENSINO','CAMPUS','NIVEL_CURSO','PERIODO_INGRESSO_CURSO','SEMESTRE_ATUAL_CURSO_CALCULADO','SEMESTRE_ATUAL_CURSO_CALCULADO_EM','STATUS_COMPLETUDE_CADASTRAL','COMPLETUDE_CADASTRAL_ATUALIZADA_EM','DATA_INTEGRACAO_ORIGINAL','HISTORICO_ATIVIDADES_ACADEMICAS','OBS_MEMBRO','ATUALIZADO_EM'];
const linkHeaders = ['ID_VINCULO','ID_PESSOA','TIPO_VINCULO','STATUS_VINCULO','DATA_INICIO','DATA_FIM','MOTIVO_INICIO','MOTIVO_FIM','FONTE','LINK_ATA_OU_PROCESSO','OBS_PUBLICA','OBS_INTERNA','ATIVO'];
const eventHeaders = ['ID_EVENTO_MEMBRO','RGA','ID_PESSOA','ID_VINCULO','TIPO_EVENTO','DATA_EVENTO','STATUS_EVENTO','MODULO_ORIGEM','CHAVE_ORIGEM','OBSERVACOES','ATUALIZADO_EM','PROCESSADO_POR_MODULO','DATA_PROCESSAMENTO','ERRO_PROCESSAMENTO'];
const courseHeaders = ['CURSO_ID','NOME_CURSO','INSTITUICAO','CAMPUS','NIVEL','AREA_GERAL','ATIVO','ORDEM_EXIBICAO','PERMITE_CADASTRO','CRIADO_EM','ATUALIZADO_EM','OBSERVACOES'];
const semesterHeaders = ['ID_SEMESTRE','ANO','SEMESTRE','DATA_INICIO','DATA_FIM','STATUS'];

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function source(headers, records = []) {
  const output = { headers: headers.slice(), records: records.map((row, index) => Object.assign({ __rowNumber: index + 2 }, clone(row))) };
  output.sheet = {
    getLastRow: () => output.records.length + 1,
    getRange: () => ({ setValues: () => output.sheet })
  };
  return output;
}

function factory(options = {}) {
  const store = {
    'PESSOAS:INGRESSOS_MEMBROS': source(queueHeaders, options.ingressos || []),
    'PESSOAS:BASE': source(baseHeaders, options.people || []),
    'PESSOAS:IDENTIFICADORES': source(identifierHeaders, options.identifiers || []),
    'PESSOAS:MEMBROS_DETALHES': source(detailHeaders, options.details || []),
    'PESSOAS:VINCULOS': source(linkHeaders, options.links || []),
    'PESSOAS:EVENTOS': source(eventHeaders, options.events || []),
    'PESSOAS:CURSOS_CATALOGO': source(courseHeaders, [{ CURSO_ID: 'AGRONOMIA_UFMT_SINOP', NOME_CURSO: 'Agronomia', INSTITUICAO: 'UFMT', CAMPUS: 'Sinop', NIVEL: 'GRADUACAO', ATIVO: 'SIM', PERMITE_CADASTRO: 'SIM' }, { CURSO_ID: 'OUTRO', NOME_CURSO: 'Outro', ATIVO: 'SIM', PERMITE_CADASTRO: 'SIM' }]),
    'VIGENCIAS:SEMESTRES': source(semesterHeaders, [{ ID_SEMESTRE: '2023/1', ANO: 2023, SEMESTRE: 1, DATA_INICIO: '2023-03-01', DATA_FIM: '2023-07-15', STATUS: 'ENCERRADO' }, { ID_SEMESTRE: '2026/1', ANO: 2026, SEMESTRE: 1, DATA_INICIO: '2026-03-01', DATA_FIM: '2026-07-15', STATUS: 'ATIVO' }])
  };
  let uuid = 0; let summaries = 0; let mails = 0;
  const session = options.session || { autenticado: true, idPessoa: 'P-ADMIN', email: 'admin@example.invalid', permissoes: ['membros:cadastrar_novos_membros'] };
  const deps = {
    now: () => new Date(2026, 2, 10, 12), uuid: () => `uuid-${++uuid}-abcdefghijklmnopqrstuvwxyz`, withLock: (_key, callback) => callback(), resolveSession: () => session,
    openSource: (domain, logical, environment) => { assert.equal(environment, options.environment || 'DEV'); const found = store[`${domain}:${logical}`]; if (!found) throw new Error(`SOURCE_MISSING:${domain}:${logical}`); return found; },
    validateCourse: options.validateCourse || ((payload, rows) => {
      const row = rows.find((item) => item.CURSO_ID === payload.cursoId); if (!row || row.ATIVO !== 'SIM') throw Object.assign(new Error('Curso invalido'), { code: 'CURSO_ID_INVALIDO' });
      if (payload.cursoId === 'OUTRO' && !payload.cursoNomeOutro) throw Object.assign(new Error('Descricao obrigatoria'), { code: 'CURSO_OUTRO_EXIGE_DESCRICAO' });
      return { CURSO_ID: payload.cursoId, CURSO_NOME_SNAPSHOT: payload.cursoId === 'OUTRO' ? payload.cursoNomeOutro : row.NOME_CURSO, INSTITUICAO_ENSINO: row.INSTITUICAO || payload.instituicaoEnsino, CAMPUS: row.CAMPUS || payload.campus, NIVEL_CURSO: row.NIVEL || payload.nivelCurso };
    }),
    calculateAcademicSemester: options.calculateAcademicSemester || (() => ({ periodoIngressoCurso: '2023/1', semestreAtualCalculado: 7 })),
    validateOrigin: options.validateOrigin || (() => ({ PAIS_ORIGEM_CODIGO: 'BR', PAIS_ORIGEM_NOME: 'Brasil', UF_ORIGEM: 'MT', CIDADE_NATAL: 'Cuiabá', MUNICIPIO_ORIGEM_CODIGO: '5103403', REGIAO_ORIGEM: '' })),
    recalculateSummary: options.recalculateSummary || (() => { summaries += 1; return { ok: true }; }),
    queueIngressMail: options.queueIngressMail || (() => { mails += 1; return { ok: true }; })
  };
  return { store, deps, get summaries() { return summaries; }, get mails() { return mails; } };
}

function payload(extra = {}) {
  return Object.assign({ chaveIdempotencia: 'ingresso-teste-0001', modalidadeCadastro: 'RAPIDO', nomeCompleto: 'Pessoa Nova Teste', emailPrincipal: 'nova@example.invalid', telefone: '+5566999999999', rga: '20231ABC', cursoId: 'AGRONOMIA_UFMT_SINOP', dataIngresso: '2026-03-10', semestreEntrada: '2026/1', formaIngresso: 'CONVITE_DIRETORIA' }, extra);
}
function context(deps, extra = {}) { return Object.assign({ ambienteDadosV2: 'DEV', sessaoOficial: { email: 'admin@example.invalid' }, featureFlags: { ENABLE_MEMBER_REGISTRATION: true }, requestId: 'req-ingresso', __deps: deps }, extra); }

const tests = []; const test = (name, fn) => tests.push({ name, fn });

test('cadastro rapido cria todas as entidades, vinculo e evento oficiais', () => {
  const f = factory(); const result = sandbox.membersAdminIngressosMembrosCadastrar(payload(), context(f.deps));
  assert.equal(result.ok, true); assert.equal(f.store['PESSOAS:BASE'].records.length, 1); assert.equal(f.store['PESSOAS:IDENTIFICADORES'].records.length, 2);
  assert.equal(f.store['PESSOAS:MEMBROS_DETALHES'].records[0].PERIODO_INGRESSO_CURSO, '2023/1');
  assert.equal(f.store['PESSOAS:VINCULOS'].records[0].TIPO_VINCULO, 'MEMBRO_EFETIVO'); assert.equal(f.store['PESSOAS:VINCULOS'].records[0].ATIVO, 'SIM');
  assert.equal(f.store['PESSOAS:EVENTOS'].records[0].TIPO_EVENTO, 'INGRESSO_MEMBRO'); assert.equal(f.store['PESSOAS:EVENTOS'].records[0].STATUS_EVENTO, 'HOMOLOGADO');
  assert.equal(f.summaries, 1); assert.equal(f.mails, 1);
});

test('cadastro completo usa o mesmo backend e valida origem', () => {
  let originCalls = 0; const f = factory({ validateOrigin: () => { originCalls += 1; return { PAIS_ORIGEM_CODIGO: 'BR', PAIS_ORIGEM_NOME: 'Brasil', UF_ORIGEM: 'MT', CIDADE_NATAL: 'Cuiabá', MUNICIPIO_ORIGEM_CODIGO: '5103403', REGIAO_ORIGEM: '' }; } });
  const result = sandbox.membersAdminIngressosMembrosCadastrar(payload({ modalidadeCadastro: 'COMPLETO', dadosComplementares: { paisOrigemCodigo: 'BR', dataNascimento: '2000-01-01' } }), context(f.deps));
  assert.equal(result.ok, true); assert.equal(originCalls, 1); assert.equal(f.store['PESSOAS:BASE'].records[0].DATA_NASCIMENTO, '2000-01-01');
});

test('e-mail existente, identificador e RGA duplicados sao bloqueados', () => {
  let f = factory({ people: [{ ID_PESSOA: 'P-OLD', EMAIL_PRINCIPAL: 'nova@example.invalid' }] });
  assert.equal(sandbox.membersAdminIngressosMembrosCadastrar(payload(), context(f.deps)).code, 'PESSOA_EXISTENTE_REQUER_FLUXO_REINGRESSO');
  f = factory({ identifiers: [{ ID_IDENTIFICADOR: 'I-1', ID_PESSOA: 'P-X', TIPO_IDENTIFICADOR: 'EMAIL', VALOR_IDENTIFICADOR: 'nova@example.invalid', ATIVO: 'SIM' }] });
  assert.equal(sandbox.membersAdminIngressosMembrosCadastrar(payload(), context(f.deps)).code, 'EMAIL_DUPLICADO');
  f = factory({ details: [{ ID_PESSOA: 'P-X', RGA: '20231ABC' }] });
  assert.equal(sandbox.membersAdminIngressosMembrosCadastrar(payload(), context(f.deps)).code, 'RGA_DUPLICADO');
});

test('clique duplo retorna o ingresso original sem duplicar entidades', () => {
  const f = factory(); const first = sandbox.membersAdminIngressosMembrosCadastrar(payload(), context(f.deps)); const second = sandbox.membersAdminIngressosMembrosCadastrar(payload(), context(f.deps));
  assert.equal(first.ok, true); assert.equal(second.data.idempotente, true); assert.equal(f.store['PESSOAS:BASE'].records.length, 1); assert.equal(f.store['PESSOAS:EVENTOS'].records.length, 1);
});

test('nome semelhante gera aviso e nao bloqueia automaticamente', () => {
  const f = factory({ people: [{ ID_PESSOA: 'P-OLD', NOME_COMPLETO: 'Pessoa Nova Teste', EMAIL_PRINCIPAL: 'diferente@example.invalid', ATIVO: 'SIM' }] });
  const result = sandbox.membersAdminIngressosMembrosCadastrar(payload(), context(f.deps));
  assert.equal(result.ok, true); assert.equal(result.warnings[0].code, 'NOME_SEMELHANTE_ENCONTRADO');
});

test('chave idempotente nao pode ser reutilizada para outra identidade', () => {
  const f = factory(); sandbox.membersAdminIngressosMembrosCadastrar(payload(), context(f.deps));
  assert.equal(sandbox.membersAdminIngressosMembrosCadastrar(payload({ emailPrincipal: 'outra@example.invalid' }), context(f.deps)).code, 'CHAVE_IDEMPOTENCIA_REUTILIZADA');
});

test('falha intermediaria e recuperavel sem duplicar pessoa, identificadores, vinculo ou evento', () => {
  let fail = true; const f = factory({ recalculateSummary: () => { if (fail) throw Object.assign(new Error('resumo fora'), { code: 'RESUMO_TESTE' }); return { ok: true }; } });
  assert.equal(sandbox.membersAdminIngressosMembrosCadastrar(payload(), context(f.deps)).code, 'RESUMO_TESTE'); assert.equal(f.store['PESSOAS:INGRESSOS_MEMBROS'].records[0].STATUS_INGRESSO, 'ERRO_EXECUCAO');
  fail = false; const retry = sandbox.membersAdminIngressosMembrosReprocessar(payload(), context(f.deps)); assert.equal(retry.ok, true);
  assert.equal(f.store['PESSOAS:BASE'].records.length, 1); assert.equal(f.store['PESSOAS:IDENTIFICADORES'].records.length, 2); assert.equal(f.store['PESSOAS:VINCULOS'].records.length, 1); assert.equal(f.store['PESSOAS:EVENTOS'].records.length, 1);
});

test('falha do convite nao reverte ingresso e permanece registrada', () => {
  const f = factory({ queueIngressMail: () => { throw Object.assign(new Error('mail fora'), { code: 'MAIL_TESTE' }); } }); const result = sandbox.membersAdminIngressosMembrosCadastrar(payload(), context(f.deps));
  assert.equal(result.ok, true); assert.equal(f.store['PESSOAS:INGRESSOS_MEMBROS'].records[0].STATUS_INGRESSO, 'EXECUTADO'); assert.equal(f.store['PESSOAS:INGRESSOS_MEMBROS'].records[0].ETAPA_EXECUCAO, 'CONVITE_ERRO_ENVIO');
});

test('usuario sem permissao e SECRETARIA sem delegacao sao bloqueados', () => {
  const f = factory({ session: { autenticado: true, idPessoa: 'P-SEC', email: 'sec@example.invalid', permissoes: [] } });
  assert.equal(sandbox.membersAdminIngressosMembrosCadastrar(payload(), context(f.deps)).code, 'ACESSO_NEGADO');
});

test('frontend nao define ator, IDs nem semestre calculado', () => {
  const f = factory();
  assert.equal(sandbox.membersAdminIngressosMembrosCadastrar(payload({ criadoPor: 'P-X' }), context(f.deps)).code, 'ATOR_OU_IDS_NAO_PERMITIDOS');
  assert.equal(sandbox.membersAdminIngressosMembrosCadastrar(payload({ semestreAtualCursoCalculado: 8 }), context(f.deps)).code, 'ATOR_OU_IDS_NAO_PERMITIDOS');
});

test('curso inexistente e OUTRO sem descricao sao rejeitados pelo catalogo', () => {
  let f = factory(); assert.equal(sandbox.membersAdminIngressosMembrosCadastrar(payload({ cursoId: 'INEXISTENTE' }), context(f.deps)).code, 'CURSO_ID_INVALIDO');
  f = factory(); assert.equal(sandbox.membersAdminIngressosMembrosCadastrar(payload({ cursoId: 'OUTRO' }), context(f.deps)).code, 'CURSO_OUTRO_EXIGE_DESCRICAO');
});

test('feature permanece bloqueada em PROD sem acessar DEV', () => {
  const f = factory({ environment: 'PROD' }); const result = sandbox.membersAdminIngressosMembrosCadastrar(payload(), context(f.deps, { ambienteDadosV2: 'PROD' })); assert.equal(result.code, 'CADASTRO_MEMBRO_INDISPONIVEL');
});

test('fluxo nao cria portalUsers nem menciona processo seletivo como operacao', () => {
  const f = factory(); sandbox.membersAdminIngressosMembrosCadastrar(payload(), context(f.deps)); assert.equal(Object.keys(f.store).some((key) => key.includes('portalUsers')), false);
  const sourceCode = fs.readFileSync(path.join(root, '16_members_ingress_v2.gs'), 'utf8'); assert.equal(/avaliacao de candidatos|classificacao|lista de espera/i.test(sourceCode), false);
});

let failed = 0;
for (const item of tests) { try { item.fn(); process.stdout.write(`ok - ${item.name}\n`); } catch (error) { failed += 1; process.stderr.write(`not ok - ${item.name}\n${error.stack}\n`); } }
if (failed) process.exitCode = 1; else process.stdout.write(`# ${tests.length}/${tests.length} testes passaram\n`);
