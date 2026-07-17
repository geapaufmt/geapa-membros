# Gestao V2 de solicitacoes voluntarias de vinculo

O dominio pertence ao GEAPA Membros. O Portal apenas encaminha a sessao
oficial e o ambiente de dados resolvido no backend. O navegador nunca escolhe
`ID_PESSOA`, `ID_VINCULO`, RGA, e-mail, planilha ou ambiente.

## Parametros normativos

Os valores sao lidos da key `NORMAS_PARAMETROS_OPERACIONAIS` pelos IDs
`SUSPENSAO_MINIMA` e `BLOQUEIO_DESLIGAMENTO_ANTES_APRESENTACAO`. Nao ha valor
numerico de fallback. Ausencia, inatividade, unidade diferente de `DIAS`, valor
nao positivo, modulo incompativel ou `BASE_LEGAL` vazia bloqueiam a operacao.

Cada pedido salva snapshots. Antes da decisao, os valores vigentes sao relidos.
Mudanca de regra sem nova `BASE_LEGAL` bloqueia. Mudanca normativa valida exige
tratamento de transicao, justificativa reforcada, permissao de override e
auditoria; snapshot e valor vigente permanecem visiveis.

## Ata e decisao

- suspensao: decisao humana, observacao quando necessaria, data e responsavel;
  ata e opcional;
- segunda suspensao excepcional: justificativa reforcada, responsavel e
  auditoria; documento e opcional;
- desligamento voluntario: ata ou `ID_ATA_DELIBERACAO` e obrigatorio somente na
  decisao final, inclusive indeferimento; nao e exigido no pedido ou analise
  preliminar.

`GESTAO_ATAS_DELIBERACOES` e o destino preferencial de integracao futura. No
MVP, `ATA_REFERENCIA` aceita referencia oficial validada pela Diretoria. Log
tecnico nunca e tratado como ata.

## Ambientes

HOMOLOG usa DEV e nunca consulta PROD como fallback. Se a key normativa possuir
somente PROD, o fluxo HOMOLOG fica bloqueado ate entrada DEV explicita ou fonte
institucional compartilhada, somente leitura, registrada nos dois ambientes.
Nenhuma mudanca de Registry faz parte desta entrega.

## Cutover futuro

Inventariar pedidos antigos, decidir migracao/encerramento, homologar o novo
fluxo, bloquear Forms, desligar triggers, manter dados historicos e rollback.
O repositorio legado nao e dependencia runtime e nao e alterado nesta fase.

## Arquitetura e fontes oficiais

`SOLICITACOES_VINCULO` guarda intenção, validações, análise, decisão e etapas
recuperáveis. Apenas efeitos homologados criam linhas em
`MEMBROS_EVENTOS_VINCULO`. O vínculo atual é atualizado na própria linha de
`VINCULOS_GEAPA`; suspensão não encerra nem recria vínculo.

As fontes são abertas pelo resolvedor de domínios do Core, sempre com ambiente
explícito:

- Pessoas: `SOLICITACOES_VINCULO`, `VINCULOS_GEAPA`,
  `MEMBROS_EVENTOS_VINCULO`, `PESSOAS_BASE`, `MEMBROS_DETALHES` e resumo;
- Vigências: `SEMESTRES` por `VIGENCIAS_V2_SEMESTRES`;
- Atividades: apresentações e arquivos V2 quando a integração estiver
  disponível. Indisponibilidade produz `NAO_VERIFICADO`, nunca “sem pendência”.

Nenhuma função deste fluxo chama `GEAPA_DESLIGAMENTOS`, Forms, filas ou abas do
offboarding legado.

## Cabeçalhos estáveis

O contrato completo está em `MEMBERS_VINCULO_HEADERS`, organizado em:

- identidade: `ID_SOLICITACAO`, `ID_PESSOA`, `ID_VINCULO`, tipos, modalidade,
  chave idempotente, status e ativo;
- calendário: semestre, snapshots, datas pretendidas e data efetiva;
- pedido: motivo, justificativa, observações, documento e ciência;
- parâmetros: os nove snapshots exigidos, valor vigente serializado,
  divergência e tratamento de transição;
- validações: vínculo, semestre, período, suspensão anterior, apresentação,
  arquivos, obrigações, função e override auditável;
- análise e decisão: resultado preliminar, decisão, observação, ata opcional ou
  obrigatória conforme o tipo, data e responsável;
- execução: etapa, IDs dos eventos, executor, erro e run ID;
- auditoria: criação, atualização, cancelamento, histórico de status e trilha
  JSON sem dados pessoais completos.

Nome, CPF, RGA, e-mail e telefone não são duplicados na fila.

## Registry recomendado para inserção manual posterior

As duas linhas usam a mesma key, mas jamais fazem fallback entre ambientes:

| KEY | SPREADSHEET_ID | SHEET_NAME | DISPLAY_NAME | ATIVO | TYPE | AMBIENTE |
|---|---|---|---|---|---|---|
| `PESSOAS_V2_SOLICITACOES_VINCULO` | `<PESSOAS_V2_DB_DEV_SPREADSHEET_ID>` | `SOLICITACOES_VINCULO` | `PESSOAS v2 - DEV` | `SIM` | `BASE` | `DEV` |
| `PESSOAS_V2_SOLICITACOES_VINCULO` | `<PESSOAS_V2_DB_PROD_SPREADSHEET_ID>` | `SOLICITACOES_VINCULO` | `PESSOAS v2 - PROD` | `SIM` | `BASE` | `PROD` |

Para `NORMAS_PARAMETROS_OPERACIONAIS`, HOMOLOG exige entrada DEV explícita ou
uma fonte institucional somente leitura registrada explicitamente nos dois
ambientes. Uma linha apenas PROD bloqueia HOMOLOG.

## Permissões propostas

- `membros:solicitar_alteracao_vinculo`;
- `membros:analisar_solicitacoes_vinculo`;
- `membros:homologar_solicitacoes_vinculo`;
- `membros:executar_solicitacoes_vinculo`;
- `membros:override_validacoes_vinculo`.

O Portal pode usar essas permissões para visibilidade, mas cada contrato as
repete no backend e resolve novamente a pessoa pela sessão oficial.

## Máquina de estados

- pedido: `RECEBIDO -> EM_ANALISE`;
- complemento: `EM_ANALISE -> AGUARDANDO_COMPLEMENTO -> EM_ANALISE`;
- suspensão futura: `EM_ANALISE -> HOMOLOGADO_AGUARDANDO_INICIO ->
  SUSPENSAO_ATIVA -> CONCLUIDO`;
- suspensão imediata: `EM_ANALISE -> SUSPENSAO_ATIVA -> CONCLUIDO`;
- fim de semestre: `EM_ANALISE -> AGENDADO_PARA_ANALISE_FINAL ->
  PRONTO_PARA_ANALISE_FINAL -> EXECUTADO`;
- desligamento imediato: `EM_ANALISE -> EXECUTADO`;
- terminais alternativos: `INDEFERIDO`, `CANCELADO_PELO_MEMBRO` e
  `CANCELADO_PELA_DIRETORIA`;
- recuperação: efeitos parciais usam `ERRO_EXECUCAO` e retomam pela etapa
  persistida sem duplicar evento.

Toda transição é validada no backend; o frontend não envia o próximo status.

## Semestre letivo

Suspensão e desligamento de fim de semestre exigem exatamente um semestre
`ATIVO`, ID e intervalo válido que contenha a data atual. Datas são civis em
`America/Cuiaba`, sem conversão UTC. O desligamento imediato pode ser recebido
sem semestre, mas registra aviso e não inventa referência.

Antes da decisão e execução de fim de semestre, o mesmo `ID_SEMESTRE` é relido.
Mudança da data final mantém o snapshot original, usa a data oficial vigente e
registra a divergência em auditoria.

## Jobs

Os handlers futuros são separados por ambiente:

- `membersVinculoJobProcessarDev`;
- `membersVinculoJobProcessarProd`.

Ambos passam por `MODULOS_CONFIG`/`MODULOS_STATUS`, lock e run ID. Iniciam e
encerram suspensões nas datas devidas e marcam desligamentos de fim de semestre
como prontos. Nunca homologam desligamento automaticamente.

## Setups dry-run

Não executar nesta entrega. Para apenas inspecionar o plano futuro:

```javascript
membersVinculoSetupSolicitacoesV2({ ambiente: 'DEV', dryRun: true });
membersVinculoSetupEventoIdVinculoV2({ ambiente: 'DEV', dryRun: true });
membersVinculoSetupJobsV2({ ambiente: 'DEV', dryRun: true });
membersVinculoAuditarRegistryV2({ ambiente: 'DEV', dryRun: true });
membersVinculoInventariarLegadoDryRun({ legacyRecords: [] });
```

A migração `ID_VINCULO` é aditiva. Backfill só deve ocorrer quando a associação
histórica for inequívoca; eventos antigos não são reescritos automaticamente.

## Homologação, cutover e rollback

1. inserir manualmente e auditar Registry DEV e parâmetros normativos DEV;
2. publicar versões imutáveis Core e Membros, depois fixá-las no Portal;
3. executar setups revisados somente em DEV;
4. habilitar a feature somente no Portal HOMOLOG e testar os 60 cenários;
5. inventariar pedidos legados abertos e decidir migração ou encerramento;
6. somente após promoção formal, preparar PROD com a feature inicialmente OFF;
7. após validação, bloquear Forms e triggers legados sem apagar histórico.

Rollback: desligar a feature, manter a nova fila e eventos já persistidos,
restaurar deployments anteriores e reativar temporariamente o legado somente
se o plano institucional autorizar. Nunca apagar efeitos parciais; reprocessar
pela etapa registrada.

## Gaps que impedem publicação imediata

- cadastrar as permissões no catálogo oficial;
- formalizar os enums de vínculo/evento se ainda não estiverem no catálogo;
- criar e auditar a entrada DEV dos parâmetros normativos;
- decidir a política mínima de acesso ao Portal durante suspensão;
- validar as integrações V2 de apresentações, arquivos, obrigações e funções;
- publicar uma versão imutável do Membros antes de qualquer uso fora de
  desenvolvimento. Esta branch já fixa o Core na versão 19 e mantém
  `developmentMode: false`.
