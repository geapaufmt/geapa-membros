# GEAPA – Módulo de Gestão de Membros

Este módulo faz parte do sistema automatizado do GEAPA e é responsável por gerenciar o fluxo de entrada de novos membros a partir da lista de **Membros em Espera**.

Ele realiza automaticamente o envio de convites, processamento de respostas por email, integração de membros aprovados e encerramento de convites não respondidos.

O módulo depende da library **GEAPA-CORE**.

---

# Estrutura do fluxo

O processo de entrada de membros segue as etapas abaixo.

## 1. Membro em espera

Os candidatos ficam inicialmente na planilha:

`Membros em Espera`

Quando o campo **Status do processo** é alterado para:

`Enviar e-mail`

o sistema:

- envia automaticamente um email de convite
- registra a **Data envio convite**
- salva o **ThreadId do convite**
- altera o status do processo para:

`E-mail enviado`

---

## 2. Resposta do candidato

O candidato pode responder ao email com:

`ACEITO`

ou

`RECUSO`

O sistema monitora automaticamente as respostas.

### Se responder ACEITO

O sistema:

- registra **Data resposta**
- registra **MessageId resposta**
- calcula o **Semestre de entrada**
- integra o membro na planilha:

`Membros Atuais`

- grava **Data integração**
- define **Status = Ativo**
- envia email final com link do grupo.

### Se responder RECUSO

O sistema:

- registra **Data resposta**
- registra **MessageId resposta**
- extrai o motivo da recusa (se houver)
- salva o motivo em **Observações do processo**
- altera:

`Status = Desclassificado`
`Status do processo = Recusou`

- envia email confirmando a recusa.

## 3. Prazo de resposta

Se o candidato **não responder em até 7 dias**, o sistema:

- marca

`Status = Desclassificado`
`Status do processo = Prazo expirado`

- registra observação sobre expiração de prazo
- envia email informando o encerramento do convite.

Essa verificação é feita por um **trigger periódico**.

---

# Segurança contra reprocessamento

O sistema utiliza:

`MessageId resposta`

para evitar que uma mesma mensagem seja processada mais de uma vez.

Se o `MessageId` já estiver registrado na planilha, a resposta é ignorada.

---

# Triggers utilizados

O módulo utiliza três tipos de trigger.

### 1. onEdit

Função:

`members_onEditProcessStatus`

Responsável por detectar quando o status é alterado para **Enviar e-mail**.

### 2. Monitoramento de respostas

Função:

`members_processAcceptanceReplies`

Executada periodicamente para verificar respostas de email.

### 3. Verificação de prazo

Função:

`members_processInvitationTimeouts`

Executada periodicamente para identificar convites não respondidos após o prazo definido.

---

# Dependência

Este módulo depende da library:

`GEAPA-CORE`

Responsável por:

- localizar planilhas por chave
- gerenciamento do registry
- utilidades compartilhadas do sistema.

---

# Planilhas utilizadas

O módulo utiliza as seguintes abas:

### Membros em Espera
Controle do processo seletivo e convites.

Campos relevantes:

- Nome
- EMAIL
- Status
- Status do processo
- Data envio convite
- Data resposta
- ThreadId convite
- MessageId resposta
- Observações do processo
- Semestre de entrada

### Membros Atuais

Recebe automaticamente novos membros integrados.

Campos adicionais podem incluir:

- Data integração
- Semestre de entrada
- Número de semestres no grupo

---

# Status utilizados

Status principais:

`Em espera`
`Ativo`
`Suspenso`
`Desligado`
`Desclassificado`

Status do processo:

`Enviar e-mail`
`E-mail enviado`
`Aceitou`
`Recusou`
`Integrado`
`Prazo expirado`

---

# Autor

Sistema desenvolvido para o **GEAPA – Grupo de Estudos e Apoio à Produção Agrícola**.

UFMT – Sinop