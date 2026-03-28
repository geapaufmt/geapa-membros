# GEAPA - Módulo de Gestão de Membros

Módulo responsável pelo fluxo de entrada, integração, histórico de saída e rotinas auxiliares de membros do GEAPA. O projeto depende da Library `GEAPA-CORE`.

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
- envia o convite por e-mail;
- grava `Data envio convite`;
- grava `ThreadId convite`;
- marca `Status do processo = E-mail enviado`.

### 3. Processamento de respostas

Arquivo principal:

- `02_members_acceptance_processing.gs`

Fluxo:

- lê respostas do Gmail a partir do `ThreadId convite`;
- identifica a última mensagem válida do candidato;
- trata `ACEITO` e `RECUSO`;
- registra `Data resposta` e `MessageId resposta`;
- envia os e-mails de confirmação correspondentes.

Se `ACEITO`:

- calcula `Semestre de entrada`;
- integra em `MEMBERS_ATUAIS`;
- sincroniza campos derivados via `GEAPA_CORE`;
- envia e-mail final com link do grupo.

Se `RECUSO`:

- marca `Status = Desclassificado`;
- marca `Status do processo = Recusou`;
- registra motivo em `Observações do processo`, quando houver;
- envia e-mail confirmando a recusa.

### 4. Timeout de convites

Função principal:

- `members_processInvitationTimeouts()`

Fluxo:

- identifica convites sem resposta além de `timeoutDays`;
- marca `Status = Desclassificado`;
- marca `Status do processo = Prazo expirado`;
- registra observação;
- envia e-mail de encerramento.

### 5. Offboarding homologado

Arquivo principal:

- `06_members_offboarding.gs`

Fluxo:

- recebe payload de desligamento homologado vindo de outro módulo;
- localiza o membro em `MEMBERS_ATUAIS`;
- registra a saída em `MEMBERS_HIST`;
- preserva dados como solicitação, homologação, semestre de saída e motivo;
- remove o membro de `MEMBERS_ATUAIS`;
- executa sincronização de campos derivados após a remoção.

### 6. Chapas e diretoria

Arquivo principal:

- `06_members_chapas.gs`

Fluxo:

- valida elegibilidade de presidente e vice em `MEMBERS_ATUAIS`;
- analisa inscrição de chapa;
- registra resultados;
- envia comunicações de deferimento/indeferimento/eleição;
- apoia o registro da diretoria vigente.

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

## Dependência no GEAPA-CORE

O módulo depende do core para:

- localizar planilhas por `KEY`;
- normalizar textos, e-mails e identidades;
- construir/usar mapas de cabeçalho;
- append e leitura por registros;
- envio HTML e envio rastreado de e-mails;
- cálculo de semestre e sincronizações derivadas em `MEMBERS_ATUAIS`.

---

## Observações operacionais

- mudanças feitas por script não disparam `onEdit`; por isso o convite do `Aprovado imediato` é enviado diretamente na importação;
- a integração em `MEMBERS_ATUAIS` só acontece após aceite explícito, exceto nos fluxos administrativos de offboarding;
- quando a Library `GEAPA-CORE` for atualizada com novas APIs consumidas por este módulo, é necessário atualizar a versão da Library no Apps Script se o projeto estiver preso em versão fixa.