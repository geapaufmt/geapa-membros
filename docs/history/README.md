# GEAPA - Módulo de Gestão de Membros

Módulo responsável pelo fluxo de entrada, integração, histórico de saída e rotinas auxiliares de membros do GEAPA. O projeto depende da Library `GEAPA-CORE`.

> A Gestão V2 de solicitações voluntárias de vínculo está documentada em
> [docs/solicitacoes-vinculo-v2.md](docs/solicitacoes-vinculo-v2.md). Nesta
> branch, todos os setups permanecem em dry-run e não há dependência runtime do
> módulo legado de desligamentos e suspensões.

---

## O que o módulo faz hoje

- controla candidatos em `MEMBERS_FUTURO`;
- envia convites de ingresso por e-mail;
- processa respostas `ACEITO` e `RECUSO`;
- integra membros aceitos em `MEMBERS_ATUAIS`;
- encerra convites por prazo expirado;
- importa aprovados do processo seletivo para `MEMBERS_FUTURO`;
- registra saídas homologadas em `MEMBERS_HIST` e remove de `MEMBERS_ATUAIS`;
- valida e registra fluxos de chapas/diretoria.
- conclui a composicao da diretoria eleita por formulario oficial, com elegibilidade temporal proporcional por dias;
- envia devolutivas das nomeacoes da diretoria pelo Mail Hub central;
- convida ex-diretores para adesao como conselheiros por formulario oficial;
- registra conselheiros aceitos e sincroniza acessos institucionais de Drive para diretoria, transicao e conselho;
- importa o formulario de pessoas externas / contatos academicos para `PROFS_BASE` e `PESSOAS_EXTERNAS_BASE`, usando `EIXOS_TEMATICOS_OFICIAIS` como fonte oficial dos eixos.

---

## Fluxos principais

### 1. Importação do seletivo

Entrada pública:

- `members_importFromSeletivoResults()`

Fluxo:

1. lê pendências em `SELETIVO_AVALIACAO`;
2. busca dados cadastrais em `SELETIVO_INSCRICAO`;
3. monta a linha de `MEMBERS_FUTURO`;
4. evita duplicidade por `RGA` e `EMAIL`;
5. marca a avaliação como processada;
6. se o resultado for `Aprovado imediato`, dispara o convite automaticamente;
7. se o resultado for `Aprovado em espera`, mantém `Status do processo = Aguardando vaga`.

Observação estrutural:

- o fluxo do seletivo foi consolidado em `05_members_seletivo_import.gs`;
- `07_members_seletivo_import_v2.gs` não define mais funções globais de importação.

### 2. Convite de ingresso

Arquivo principal:

- `01_members_waiting_invites.gs`

Fluxo:

- reage a `Status do processo = Enviar e-mail` em `MEMBERS_FUTURO`;
- monta uma `correlationKey` do fluxo de convite;
- enfileira o convite na `MAIL_SAIDA` central;
- o `GEAPA-CORE` renderiza o HTML institucional, monta o assunto final em `[GEAPA][CHAVE]` e envia tecnicamente;
- grava `Data envio convite`;
- grava `ThreadId convite`;
- marca `Status do processo = E-mail enviado`.

Piloto atual:

- o convite inicial de ingresso agora nasce na `MAIL_SAIDA` e passa a ter saida oficial no Mail Hub;
- o modulo continua dono do conteudo de negocio do convite;
- o layout, o assunto final, a assinatura institucional e o slogan vigente da diretoria passam a ser montados pelo `GEAPA-CORE`;
- processamento de respostas `ACEITO` e `RECUSO` segue no modulo, mas ja pode consumir `MAIL_EVENTOS` quando a central estiver alimentada.

### 3. Processamento de respostas

Arquivo principal:

- `02_members_acceptance_processing.gs`

Fluxo:

- lê respostas do Gmail a partir do `ThreadId convite`;
- quando o Mail Hub central já tiver ingerido a resposta, prefere consumir `MAIL_EVENTOS` por `threadId`;
- se não houver evento pendente suficiente na central, faz fallback seguro para a leitura direta do Gmail;
- identifica a última mensagem válida do candidato;
- trata `ACEITO` e `RECUSO`;
- registra `Data resposta` e `MessageId resposta`;
- enfileira na `MAIL_SAIDA` os e-mails de confirmação correspondentes.

Se `ACEITO`:

- calcula `Semestre de entrada`;
- integra em `MEMBERS_ATUAIS`;
- sincroniza campos derivados via `GEAPA_CORE`;
- enfileira o e-mail final institucional com o link do grupo.

Se `RECUSO`:

- marca `Status = Desclassificado`;
- marca `Status do processo = Recusou`;
- registra motivo em `Observações do processo`, quando houver;
- enfileira e-mail institucional confirmando a recusa.

### 4. Timeout de convites

Função principal:

- `members_processInvitationTimeouts()`

Fluxo:

- identifica convites sem resposta além de `timeoutDays`;
- marca `Status = Desclassificado`;
- marca `Status do processo = Prazo expirado`;
- registra observação;
- enfileira e-mail institucional de encerramento.


Observação institucional:

- o link do grupo do WhatsApp usado no e-mail final de integração passa a ser lido de DADOS_OFICIAIS_GEAPA.LINK_GRUPO_WHATSAPP, com fallback para a configuração local apenas se esse campo oficial estiver vazio.
### 5. Offboarding homologado

Arquivo principal:

- `06_members_offboarding.gs`

Fluxo:

- recebe payload de desligamento homologado vindo de outro módulo;
- localiza o membro em `MEMBERS_ATUAIS`;
- registra a saída em `MEMBERS_HIST`;
- preserva dados como solicitação, homologação, semestre de saída e motivo;
- remove o membro de `MEMBERS_ATUAIS`;
- quando o desligamento homologado vier do fluxo disciplinar por faltas, enfileira um e-mail institucional ao membro pela `MAIL_SAIDA`;
- executa sincronização de campos derivados após a remoção.

### 6. Chapas e diretoria

Arquivo principal:

- `06_members_chapas.gs`

Fluxo:

- valida elegibilidade de presidente e vice em `MEMBERS_ATUAIS`;
- analisa inscrição de chapa;
- registra resultados;
- enfileira na `MAIL_SAIDA` as comunicações de deferimento, indeferimento e eleição;
- quando a chapa é eleita, envia no e-mail de parabenização o link do formulário oficial de nomeações, o link do painel `MEMBERS_ATUAIS`, a pasta de transição e instruções operacionais de uso;
- junto do e-mail da chapa eleita, envia um aviso separado para a coordenação do curso usando `CONFIG_GEAPA.EMAIL_CURSO_MAE`, quando esse endereço estiver disponível;
- apoia o registro da diretoria vigente.

### 7. Cadastro de pessoas externas e contatos academicos

Arquivo principal:

- `09_members_external_contacts_import.gs`

Fluxo:

- le a planilha bruta do formulario por `PARTICIPANTES_EXTERNOS_FORM`;
- usa `EIXOS_TEMATICOS_OFICIAIS` como fonte oficial da aba `Eixos`;
- detecta respostas docentes por perfil e por preenchimento do bloco docente;
- faz upsert por e-mail em `PROFS_BASE` ou `PESSOAS_EXTERNAS_BASE`;
- transforma a escolha `Todos` nos eixos tematicos em `SIM` para todos os `INTERESSE_EIXO_*` da base de externos;
- garante ids (`ID_PROFESSOR` / `ID_PARTICIPANTE_EXTERNO`) sem renumerar registros antigos.
- para participantes externos, a geracao de `ID_PARTICIPANTE_EXTERNO` ocorre localmente no importador sobre `PESSOAS_EXTERNAS_BASE`, evitando dependencia de apontamentos legados do core para a base antiga `PARTICIPANTES_EXTERNOS_BASE`.

### 8. Transicao de diretoria, nomeacoes e conselheiros

Arquivo principal:

- `06_members_governance_transition.gs`

Fluxo:

- reaproveita `VIGENCIA_DIRETORIAS`, `VIGENCIA_MEMBROS_DIRETORIAS`, `VIGENCIA_ASSESSORES`, `VIGENCIA_SEMESTRES_DIRETORIAS`, `VIGENCIA_CONSELHEIROS` e `CARGOS_INSTITUCIONAIS_CONFIG` via `GEAPA-CORE`;
- trata `Ocupacao` como termo preferencial nas interfaces novas, mantendo compatibilidade com o cabecalho legado `Cargo/Função` nas abas oficiais;
- recalcula em `MEMBERS_ATUAIS` o painel de elegibilidade temporal:
- `QTD_DIAS_QUE_CONTAM_PARA_LIMITE_DIRETORIA`
- `LIMITE_DIAS_DIRETORIA`
- `SALDO_DIAS_DIRETORIA`
- `STATUS_ELEGIBILIDADE_DIRETORIA`
- `DATA_LIMITE_ESTIMADA_DIRETORIA`
- processa `DIRETORIA_NOMEACOES_RESPONSES` sem reimplementar o fluxo de Presidente e Vice;
- valida cargo no catalogo oficial, disponibilidade por `ID_Diretoria`, existencia do membro em `MEMBERS_ATUAIS`, compatibilidade entre `RGA` e nome, e elegibilidade temporal;
- le e escreve a ocupacao com compatibilidade entre `Ocupacao` e `Cargo/Função`, sem renomear ainda os cabecalhos oficiais existentes;
- usa `CARGOS_INSTITUCIONAIS_CONFIG.DESTINO_VIGENCIA` como fonte oficial para decidir se o vinculo vai para `VIGENCIA_MEMBROS_DIRETORIAS`, `VIGENCIA_ASSESSORES` ou `VIGENCIA_CONSELHEIROS`, com fallback pelo grupo do cargo;
- registra nomeacoes `APTO` ou `APTO_COM_LIMITE` na aba oficial correspondente ao destino configurado do cargo;
- aceita no formulario a declaracao `Pretende permanecer ate o final do mandato?` e, quando necessario, `Data prevista de saida`;
- define `Data_Fim_previsto` pela menor data entre o limite institucional calculado e a data antecipada declarada no formulario;
- rejeita respostas de nomeacao que informem saida antecipada sem uma data valida ou com data anterior ao inicio do vinculo;
- enfileira pela `MAIL_SAIDA` a devolutiva automatica da analise de nomeacao;
- quando a nomeacao e confirmada com registro novo, envia tambem um e-mail direto ao nomeado com o cargo confirmado e eventual limite temporal;
- sincroniza as opcoes de `DIRETORIA_NOMEACOES_FORM` com base na diretoria alvo e nos cargos vagos permitidos via formulario, e garante as perguntas fixas de permanencia e data prevista de saida;
- identifica diretores de saida, envia convite para `CONSELHEIROS_ADESAO_FORM` e processa `CONSELHEIROS_ADESAO_RESPONSES`;
- o convite para conselho considera apenas diretores com pelo menos 3 meses no cargo e que nao estejam reconduzidos para a proxima gestao;
- reenvios de convite para conselheiros usam contador persistente em `ScriptProperties` para gerar uma `correlationKey` nova no Mail Hub, sem exigir limpeza manual da `MAIL_SAIDA` ou do `MAIL_INDICE`;
- registra conselheiros aceitos em `VIGENCIA_CONSELHEIROS`;
- sincroniza os acessos das pastas `ADMINISTRATIVO_PASTA` e `TRANSICAO_CONSELHEIROS_PASTA` de forma idempotente;
- apenas diretores entram automaticamente no sync de acesso do Drive; assessores ficam fora do acesso automatico e so permanecem quando houver concessao manual excepcional ainda compatível com o vinculo ativo.
- trata `TRANSICAO_CONSELHEIROS_PASTA` como catalogo oficial de leitura: os atalhos dentro dela sao resolvidos para as pastas reais de destino e essas pastas tambem recebem permissao de leitor para diretores em transicao e conselheiros ativos.
- nas pastas reais apontadas pelos atalhos da transicao, a diretoria vigente e reconciliada como editora e transicao/conselheiros sao reconciliados como leitores, restaurando acessos removidos manualmente enquanto o vinculo continuar valido.
- falhas do Drive ao listar ou conceder permissoes nao interrompem mais a rotina inteira e passam a registrar `likelyCause` quando houver indicio de bloqueio por compartilhamento externo ou permissao insuficiente.

---

## Planilhas usadas

### `MEMBERS_FUTURO`

Campos operacionais principais:

- `Nome`
- `EMAIL`
- `RGA`
- `Status`
- `Status do processo`
- `Data envio convite`
- `ThreadId convite`
- `Data resposta`
- `MessageId resposta`
- `Observações do processo`
- `Semestre de entrada`

### `MEMBERS_ATUAIS`

Planilha oficial de membros ativos, usada tanto para integração quanto para consultas de identidade e governança.

### `MEMBERS_HIST`

Histórico de ex-membros e saídas homologadas.

### Planilhas externas integradas

- `SELETIVO_INSCRICAO`
- `SELETIVO_AVALIACAO`
- `ELEICOES_CHAPAS_INSCRICAO`
- `DIRETORIA_NOMEACOES_RESPONSES`
- `CONSELHEIROS_ADESAO_RESPONSES`
- `PARTICIPANTES_EXTERNOS_FORM`
- `PESSOAS_EXTERNAS_BASE`
- `PROFS_BASE`
- `EIXOS_TEMATICOS_OFICIAIS`
- planilhas de vigência acessadas via `GEAPA-CORE`

---

## Arquivos principais

- `00_config.gs`: configuração central do módulo.
- `01_members_waiting_invites.gs`: convites e `onEdit` de `MEMBERS_FUTURO`.
- `02_members_acceptance_processing.gs`: respostas `ACEITO` / `RECUSO` e integração.
- `03_members_sheet_mapping.gs`: mapeamento entre `MEMBERS_FUTURO` e `MEMBERS_ATUAIS`.
- `04_members_gmail.gs`: adapters e compatibilidade com `GEAPA-CORE`.
- `05_members_seletivo_import.gs`: fluxo consolidado de importação do seletivo.
- `06_members_offboarding.gs`: histórico de desligamento e remoção de atuais.
- `06_members_chapas.gs`: análise e processamento de chapas.
- `50_members_install.gs`: instalação e remoção de triggers.

---

- `09_members_external_contacts_import.gs`: importador de professores e participantes externos a partir do formulario.

## Arquivos adicionados na entrega recente

- `06_members_governance_transition.gs`: transicao da diretoria, nomeacoes, conselheiros e acessos.

## Triggers usados

- `members_onEditProcessStatus`
  - reage a `Status do processo = Enviar e-mail`.

- `members_processAcceptanceReplies`
  - processamento periódico das respostas de e-mail.

- `members_processInvitationTimeouts`
  - verificação periódica de convites expirados.

- `members_importFromSeletivoResults`
  - execução manual ou temporal, conforme a estratégia adotada.

---

## Triggers e jobs agregadores

`members_installTriggers()` instala poucos gatilhos e deixa os fluxos recorrentes em jobs agregadores, seguindo o mesmo desenho operacional usado no modulo de atividades:

- `members_onEditProcessStatus`: gatilho reativo de edicao da planilha operacional.
- `members_onFormSubmitChapasSync`: gatilho reativo de envio de formulario de chapas.
- `members_jobMembershipLifecycle_`: importa seletivo, processa aceite/recusa, timeout de convites e eventos homologados de desligamento por faltas.
- `members_jobChapas_`: processa chapas pendentes, canceladas e eleitas.
- `members_jobGovernanceTransition_`: recalcula elegibilidade, sincroniza formulario de nomeacoes, processa nomeacoes, conselheiros e acessos de Drive.
- `members_jobExternalContacts_`: importa periodicamente novos professores e participantes externos.

O desinstalador tambem remove os handlers time-based antigos para evitar duplicidade apos a migracao.

---

## Dependência no GEAPA-CORE

O módulo depende do core para:

- localizar planilhas por `KEY`;
- normalizar textos, e-mails e identidades;
- construir/usar mapas de cabeçalho;
- append e leitura por registros;
- envio HTML e envio rastreado de e-mails;
- renderer institucional de e-mails e montagem de `correlationKey` no convite de ingresso;
- leitura de respostas via Mail Hub central quando `MAIL_EVENTOS` já estiver alimentada;
- cálculo de semestre e sincronizações derivadas em `MEMBERS_ATUAIS`;
- leitura do Registry bruto para localizar formulários e pastas oficiais;
- fila institucional de e-mails para nomeações da diretoria e convites de conselheiros.

---

## Atualizacao recente

Entrega de 18/04/2026:

- preservado o fluxo ja existente de registro automatico de Presidente e Vice;
- adicionado o fluxo pos-eleicao para completar a composicao da diretoria por formulario;
- elegibilidade temporal agora usa `Semestres_Diretoria` como regua oficial proporcional por dias;
- nomeacoes podem resultar em `APTO`, `APTO_COM_LIMITE` ou `INELEGIVEL`;
- a chapa eleita passa a receber no e-mail de parabenizacao os links operacionais de transicao, consulta e nomeacao;
- ex-diretores podem aderir ao conselho consultivo por formulario, com registro oficial em `VIGENCIA_CONSELHEIROS`, desde que nao tenham sido reconduzidos para a proxima gestao e tenham cumprido pelo menos 3 meses no cargo;
- acessos de Drive passam a ser sincronizados automaticamente para diretores da diretoria vigente, diretores da chapa em transicao e conselheiros ativos, mantendo assessores fora do acesso automatico;
- a pasta `TRANSICAO_CONSELHEIROS_PASTA` passa a funcionar como catalogo de atalhos autorizados: os destinos reais desses atalhos recebem leitura automatica para transicao/conselho e edicao para a diretoria vigente.

---

## Observações operacionais

- mudanças feitas por script não disparam `onEdit`; por isso o convite do `Aprovado imediato` é enviado diretamente na importação;
- a integração em `MEMBERS_ATUAIS` só acontece após aceite explícito, exceto nos fluxos administrativos de offboarding;
- quando a Library `GEAPA-CORE` for atualizada com novas APIs consumidas por este módulo, é necessário atualizar a versão da Library no Apps Script se o projeto estiver preso em versão fixa.

---

## UX operacional das planilhas

O modulo agora possui uma camada reaplicavel de UX para as principais abas operacionais:

- `MEMBERS_FUTURO`
- `MEMBERS_ATUAIS`
- `MEMBERS_HIST`
- `SELETIVO_INSCRICAO`
- `SELETIVO_AVALIACAO`
- `ELEICOES_CHAPAS_INSCRICAO`
- `PESSOAS_EXTERNAS_BASE`
- `PROFS_BASE`

Recursos aplicados, em modo best effort:

- linha 1 congelada;
- filtro na linha 1;
- notas curtas nos cabecalhos;
- agrupamento visual de colunas por cores;
- compactacao visual de colunas longas;
- listas suspensas nas colunas fechadas, quando a aba permitir.

Funcoes publicas:

- `applyMembersSheetUx()`
- `reapplyMembersSheetUx()`
- `applyMembersFutureSheetUx()`
- `applyMembersCurrentSheetUx()`
- `applyMembersHistorySheetUx()`
- `applyMembersSeletivoSheetUx()`
- `applyMembersChapasSheetUx()`
- `applyMembersLifecycleEventsSheetUx()`
- `applyMembersExternalContactsSheetUx()`
- `applyMembersExternalParticipantsSheetUx()`
- `applyMembersExternalProfessorsSheetUx()`

Observacoes:

- a UX nao altera a logica do modulo;
- a UX nao entra automaticamente nos fluxos de convite, integracao, seletivo ou chapas;
- a UX de `MEMBER_EVENTOS_VINCULO` reaproveita a base compartilhada do core, com notas e validacoes leves sem alterar a semantica dos eventos;
- em abas no formato de tabela, operacoes incompatíveis podem ser puladas sem quebrar a execucao.
---

## Desligamento por faltas homologado

Arquivo principal:

- `07_members_lifecycle_consumers.gs`

Fluxo:

- le `MEMBER_EVENTOS_VINCULO` via `GEAPA-CORE`;
- processa apenas `TIPO_EVENTO = DESLIGAMENTO_POR_FALTAS` com `STATUS_EVENTO = HOMOLOGADO`;
- monta payload compativel com `members_offboardApprovedImmediateExit`;
- reaproveita o offboarding oficial para mover de `MEMBERS_ATUAIS` para `MEMBERS_HIST`;
- enfileira um e-mail de confirmação de desligamento homologado por faltas para o membro, quando houver e-mail válido e Mail Hub disponível;
- garante idempotencia verificando status do evento, presenca em `MEMBERS_ATUAIS` e historico equivalente em `MEMBERS_HIST`;
- apos sucesso, atualiza o evento via API publica do `GEAPA-CORE` com `eventStatus = PROCESSADO_MEMBROS`, `notes`, `processedByModule` e `processingDate`;
- em erro, registra via API publica do core `notes`, `processedByModule`, `processingDate` e `processingError`, preservando o caso para retry.

Entradas publicas:

- `members_processApprovedDismissalByAbsenceEvents`
- `members_testDismissalByAbsenceLifecycleConsumer`

Trigger sugerido no modulo:

- `members_processApprovedDismissalByAbsenceEvents` a cada 15 minutos.

---

## Controle operacional central via GEAPA-CORE

Arquivo principal:

- `00_members_operational_control.gs`

O modulo passou a consumir a camada central de `MODULOS_CONFIG` e `MODULOS_STATUS` do `GEAPA-CORE` antes de executar os principais fluxos automatizados.

Fluxos cobertos:

- `GERAL` como fallback automatico do core
- `CONVITES_INGRESSO`
- `ACEITE_RECUSA`
- `TIMEOUT_CONVITES`
- `IMPORTACAO_SELETIVO`
- `OFFBOARDING`
- `CHAPAS`
- `GOVERNANCA_TRANSICAO`
- `CONSELHEIROS`
- `SYNC_DRIVE_GOVERNANCA`
- `IMPORTACAO_CONTATOS_EXTERNOS`
- `DESLIGAMENTO_POR_FALTAS_EVENTOS`

Entry points integrados:

- `members_onEditProcessStatus`
- `members_processAcceptanceReplies`
- `members_processInvitationTimeouts`
- `members_importFromSeletivoResults`
- `members_offboardApprovedImmediateExit`
- `members_onFormSubmitChapasSync`
- `members_processPendingChapas`
- `members_processCancelledChapas`
- `members_processElectedChapas`
- `members_refreshGovernanceEligibilityPanel`
- `members_syncDirectorNominationFormOptions`
- `members_processDirectorNominations`
- `members_sendCouncilorInvitationEmails`
- `members_processCouncilorAdhesions`
- `members_syncGovernanceDriveAccess`
- `members_importExternalContactsFromForm`
- `members_importNewExternalContactsFromTrigger`
- `members_processApprovedDismissalByAbsenceEvents`

Tratamento de modos:

- `ON`: executa normalmente.
- `OFF`: bloqueia o fluxo de forma limpa, com log e registro em `MODULOS_STATUS`.
- `DRY_RUN`: permite leitura, parsing, validacoes e logs, mas bloqueia efeitos reais como envio de e-mail, integracao definitiva em bases oficiais, offboarding efetivo, gravacao de nomeacoes, gravacao de adesoes ao conselho, marcacao persistente de estados idempotentes e concessao/remocao de acessos no Drive.
- `MANUAL`: bloqueia execucoes automaticas detectadas como `TRIGGER`; chamadas manuais continuam permitidas quando o contexto consegue ser identificado como manual.

Capabilities praticas usadas:

- `CONVITES_INGRESSO`: `SYNC` no entrypoint, `EMAIL` nos envios.
- `ACEITE_RECUSA`: `INBOX` no entrypoint, `EMAIL` nos retornos e `SYNC` nas integracoes.
- `TIMEOUT_CONVITES`: `SYNC` no entrypoint, `EMAIL` nos avisos.
- `IMPORTACAO_SELETIVO`: `SYNC`.
- `OFFBOARDING`: `SYNC`.
- `CHAPAS`: `SYNC` no entrypoint, `EMAIL` nos comunicados.
- `GOVERNANCA_TRANSICAO`: `SYNC` no entrypoint, `EMAIL` nos retornos e confirmacoes.
- `CONSELHEIROS`: `SYNC` no entrypoint, `EMAIL` nos convites.
- `SYNC_DRIVE_GOVERNANCA`: `DRIVE`.
- `IMPORTACAO_CONTATOS_EXTERNOS`: `SYNC`.
- `DESLIGAMENTO_POR_FALTAS_EVENTOS`: `SYNC` no entrypoint, `EMAIL` na notificacao ao membro.

Registro operacional em `MODULOS_STATUS`:

- o modulo tenta registrar `ULTIMA_EXECUCAO`, `ULTIMO_SUCESSO`, `ULTIMO_ERRO`, `ULTIMO_BLOQUEIO_CONFIG`, `MOTIVO_ULTIMO_BLOQUEIO`, `ULTIMO_MODO_LIDO` e `ULTIMA_CAPABILITY` via API publica do core;
- quando o `GEAPA-CORE` ainda nao expuser essa API no ambiente publicado, o modulo continua funcionando com fallback silencioso, sem recriar uma camada paralela local.
