# GEAPA – Módulo de Gestão de Membros

Este módulo faz parte do sistema automatizado do GEAPA e é responsável por gerenciar o fluxo de entrada de novos membros a partir da lista de **Membros em Espera**, incluindo a importação de candidatos aprovados vindos do processo seletivo.

O módulo depende da library **GEAPA-CORE**.

---

# Visão geral do módulo

O módulo atualmente realiza:

- controle de candidatos em `Membros em Espera`
- envio automático de convite de ingresso por e-mail
- processamento de respostas `ACEITO` / `RECUSO`
- integração automática em `Membros Atuais`
- encerramento de convites por prazo expirado
- importação de aprovados do processo seletivo para `MEMBERS_FUTURO`

---

# Arquitetura geral

O fluxo completo do módulo é:

```text
Processo seletivo
→ Resultado final na avaliação
→ Importação para Membros em Espera
→ Convite por e-mail
→ Resposta do candidato
→ Integração em Membros Atuais
```

---

# Integração com o processo seletivo

O módulo de membros se integra com o módulo de seletivo usando duas fontes.

## 1. SELETIVO_AVALIACAO

Usada para decidir o destino do candidato.

Resultados aceitos:

- `Aprovado imediato`
- `Aprovado em espera`

## 2. SELETIVO_INSCRICAO

Usada como fonte dos dados cadastrais completos do candidato.

Os dados da inscrição são utilizados para preencher `MEMBERS_FUTURO`.

---

# Regras de importação do seletivo

## Se `Resultado = Aprovado imediato`

O candidato é inserido em `MEMBERS_FUTURO` com:

- `Status = Em Espera`
- `Status do processo = Enviar e-mail`

Logo após a inserção, o sistema dispara diretamente o envio do convite, sem depender de edição manual da planilha.

## Se `Resultado = Aprovado em espera`

O candidato é inserido em `MEMBERS_FUTURO` com:

- `Status = Em Espera`
- `Status do processo = Aguardando vaga`

Nesse caso, o convite não é enviado automaticamente.

---

# Normalização de dados

Na importação do seletivo, o módulo normaliza vários campos antes de gravar em `MEMBERS_FUTURO`.

## Campos tratados

- CPF
- Telefone
- Email
- Instagram
- Data de nascimento
- Naturalidade

## Campos clicáveis

Alguns campos são gravados como fórmulas clicáveis no Google Sheets:

- `TELEFONE` → link para WhatsApp
- `EMAIL` → link `mailto:`
- `@ Instagram` → link para o perfil

---

# Planilhas utilizadas

## 1. MEMBERS_FUTURO

Controle de candidatos em espera e do processo de convite.

Campos relevantes:

- Nome
- EMAIL
- RGA
- Status
- Status do processo
- Data envio convite
- Data resposta
- ThreadId convite
- MessageId resposta
- Observações do processo
- Semestre de entrada

## 2. MEMBERS_ATUAIS

Recebe automaticamente novos membros integrados.

Campos relevantes:

- MEMBRO
- RGA
- EMAIL
- TELEFONE
- DATA DE NASCIMENTO
- Semestre de entrada
- Status
- Cargo/função atual
- Data integração

## 3. MEMBERS_HIST

Histórico de membros desligados ou encerrados.

---

# Fluxo funcional

## 1. Importação do seletivo

Função principal:

```text
members_importFromSeletivoResults()
```

Ela:

- lê candidatos pendentes em `SELETIVO_AVALIACAO`
- busca dados completos em `SELETIVO_INSCRICAO`
- monta a linha para `MEMBERS_FUTURO`
- evita duplicidade por RGA / EMAIL
- marca a avaliação como processada

---

## 2. Convite por e-mail

Quando `Status do processo = Enviar e-mail`, o sistema:

- envia o convite
- registra a data de envio
- salva o `ThreadId do convite`
- altera o status do processo para `E-mail enviado`

Esse fluxo pode acontecer:

- manualmente via onEdit
- automaticamente logo após a importação do seletivo em casos de `Aprovado imediato`

---

## 3. Resposta do candidato

O candidato pode responder ao e-mail com:

- `ACEITO`
- `RECUSO`

O sistema monitora essas respostas periodicamente.

### Se responder `ACEITO`

O sistema:

- registra `Data resposta`
- registra `MessageId resposta`
- calcula o `Semestre de entrada`
- integra o membro em `MEMBERS_ATUAIS`
- grava `Data integração`
- define `Status = Ativo`
- define `Cargo/função atual = Membro`
- envia e-mail final com link do grupo

### Se responder `RECUSO`

O sistema:

- registra `Data resposta`
- registra `MessageId resposta`
- extrai o motivo, se houver
- salva em `Observações do processo`
- altera:
  - `Status = Desclassificado`
  - `Status do processo = Recusou`
- envia e-mail confirmando a recusa

---

## 4. Prazo expirado

Se o candidato não responder em até `timeoutDays`, o sistema:

- marca `Status = Desclassificado`
- marca `Status do processo = Prazo expirado`
- registra observação
- envia e-mail informando o encerramento

---

# Estrutura dos arquivos

## `00_config.gs`

Configurações centrais do módulo:

- keys das planilhas
- cabeçalhos
- valores de status
- assuntos de e-mail
- parâmetros do fluxo

## `01_members_waiting_invites.gs`

Envio de convites e trigger `onEdit` de `MEMBERS_FUTURO`.

## `02_members_acceptance_processing.gs`

Processamento de respostas `ACEITO` / `RECUSO` e integração em `MEMBERS_ATUAIS`.

## `03_members_sheet_mapping.gs`

Mapeamento entre `MEMBERS_FUTURO` e `MEMBERS_ATUAIS`.

## `04_members_gmail.gs`

Helpers de Gmail do módulo.

## `05_members_seletivo_import.gs`

Importação de aprovados do seletivo para `MEMBERS_FUTURO`.

## `50_members_install.gs`

Instalação e remoção dos triggers do módulo.

---

# Segurança contra reprocessamento

O sistema utiliza:

- `ThreadId convite`
- `MessageId resposta`

para evitar reprocessamentos indevidos.

Também evita duplicidade por:

- `RGA`
- `EMAIL`

na importação e integração.

---

# Triggers utilizados

## 1. onEdit

Função:

```text
members_onEditProcessStatus
```

Responsável por detectar quando `Status do processo` é alterado para `Enviar e-mail`.

## 2. Monitoramento de respostas

Função:

```text
members_processAcceptanceReplies
```

Executada periodicamente para ler respostas dos candidatos.

## 3. Verificação de prazo

Função:

```text
members_processInvitationTimeouts
```

Executada periodicamente para convites expirados.

## 4. Importação do seletivo (opcional)

Função:

```text
members_importFromSeletivoResults
```

Pode ser executada manualmente ou por trigger temporal, conforme a estratégia adotada.

---

# Dependência

Este módulo depende da library:

```text
GEAPA-CORE
```

Responsável por:

- localizar planilhas por key
- gerenciamento do registry
- utilidades compartilhadas
- sincronizações derivadas em `MEMBERS_ATUAIS`

---

# Observações importantes

## Mudanças feitas por script não disparam onEdit

Esse ponto é central no módulo.

Quando uma linha é inserida via script em `MEMBERS_FUTURO`, o trigger `onEdit` não dispara automaticamente.

Por isso, no caso de `Aprovado imediato`, o envio do convite é chamado diretamente por função logo após a inserção, sem depender de edição manual.

## Estratégia adotada

A arquitetura escolhida foi:

- `SELETIVO_AVALIACAO` decide o destino
- `SELETIVO_INSCRICAO` fornece os dados cadastrais
- `MEMBERS_FUTURO` centraliza o fluxo de entrada
- `MEMBERS_ATUAIS` só recebe membros após aceite

Essa abordagem reaproveita o fluxo já existente do módulo e mantém o sistema consistente.

---

# Versionamento

O sistema usa:

```text
GitHub + CLASP
```

Fluxo típico:

```text
clasp pull / clasp push
git add
git commit
git push
```

---

# Autor

Sistema desenvolvido para o **GEAPA – Grupo de Estudos e Apoio à Produção Agrícola**.  
UFMT – Sinop.