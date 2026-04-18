# Análise técnica — geapa-membros vs geapa-core

## Escopo e limitação

Esta análise foi feita sobre o repositório `geapa-membros`, identificando pontos de acoplamento com `GEAPA_CORE` e checando onde existem sinais de:

- dependências frágeis,
- duplicação de função,
- lógica que deveria estar centralizada no core,
- ineficiências.

> Observação: o código-fonte do `geapa-core` não está presente neste workspace. Então a comparação é **inferida** pelos pontos de integração e pelos fallbacks locais.

---

## 1) Dependências frágeis

### 1.1 Acoplamento por nomes de cabeçalho (strings literais)

O módulo depende fortemente de nomes de colunas em português, muitos deles longos e suscetíveis a pequenas variações de planilha (acento, maiúscula/minúscula, pontuação, espaços).

Exemplos:

- matching por textos de cabeçalho no import do seletivo (inclusive campos muito extensos),
- avaliação de registros por `"RGA"`, `"EMAIL"`, `"Resultado"`, etc.

Impacto: qualquer ajuste de formulário/aba pode quebrar o fluxo silenciosamente ou gerar falso negativo de matching.

### 1.2 Dependência progressiva de APIs opcionais do core

Existe uma camada de adaptação que tenta usar `coreReadRecordsByKey` e `coreFindFirstRecordByField`, mas faz fallback manual se essas funções não existirem.

Isso é bom para retrocompatibilidade, mas também indica que o módulo convive com múltiplas “versões lógicas” de API ao mesmo tempo — aumentando superfície de divergência comportamental entre ambientes.

### 1.3 Dependência operacional de Gmail baseada em busca por assunto + janela de tempo

O envio de convite usa `MailApp.sendEmail` e depois tenta recuperar thread com `GmailApp.search(... newer_than:7d ...)`. Esse mecanismo depende de indexação do Gmail, tempo, e potencial colisão de assunto/reenvios.

Mesmo com mitigação por `threadId/messageId`, ainda é uma área sensível a inconsistências em alto volume.

---

## 2) Funções duplicadas ou redundantes

### 2.1 Redefinição da mesma função no mesmo arquivo

Em `06_members_offboarding.gs`, `members_getSemesterFromDate_` aparece duas vezes. A segunda definição sobrescreve a primeira em runtime.

- Risco: comportamento implícito/difícil de manter.
- Indício de refatoração incompleta.

### 2.2 Fluxo antigo e fluxo v2 coexistindo com lógica quase igual

O import do seletivo tem implementação “clássica” e `v2`, com funções equivalentes (`findInscricao`, `findPendentes`, `futureHasRgaOrEmail`) em dois estilos diferentes (manual vs records adapter).

- Risco: drift funcional ao evoluir somente um caminho.
- Custo de manutenção duplicado.

### 2.3 Múltiplos utilitários de mapeamento/normalização parcialmente sobrepostos

Há mais de um utilitário de mapa de cabeçalho (`members_getHeaderMap_`, `getMembersHeaderIndexMap_`, `members_getHeaderMap1Based_`), com contratos diferentes (lowercase, 0-based, 1-based, nomes semânticos).

- Risco: inconsistência sutil.
- Candidato claro à centralização no core.

---

## 3) Pontos que deveriam estar centralizados/integrados no geapa-core

### 3.1 Camada de records/tabular

Leitura de planilha em formato objeto, busca por campo, normalização de header, rowNumber e filtros são operações genéricas e repetidas. Já existe direção para isso na adapter layer.

**Sugestão:** promover oficialmente no core uma API estável para:

- `readRecordsByKey` (com cache opcional),
- `findByField` com normalizadores,
- `appendByHeaders` / `updateByHeaders`.

### 3.2 Normalização de identidade (RGA, email, nome)

Comparação por chaves de identidade aparece em vários fluxos (aceite, seletivo, desligamento, chapas).

**Sugestão:** centralizar normalizadores e comparadores canônicos no core (`normalizeRga`, `normalizeEmail`, `normalizePersonName`, `sameIdentity`).

### 3.3 Regras de semestre

Há chamadas diretas para `coreGetSemesterForDate` espalhadas e lógica local adicional de formatação/plain text.

**Sugestão:** core expor helpers prontos para output padronizado (ex.: `semesterIdPlain`, `semesterFromAnyInput`).

### 3.4 Pipeline de mensageria

Construção de email HTML, parsing de resposta (`ACEITO/RECUSO`) e persistência de IDs de thread/message são padrões reaproveitáveis.

**Sugestão:** componente no core para “solicitação + tracking + parser de resposta” configurável por módulo.

---

## 4) Ineficiências observadas

### 4.1 Leitura linha a linha dentro de loop após bulk read

No processamento de aceites, o código já lê `futureValues` em bloco, mas dentro do loop faz novo `getRange(...).getValues()[0]` por linha.

- Isso multiplica round-trips na API de planilha.
- Pode degradar em planilhas maiores.

### 4.2 Releituras recorrentes de cabeçalho dentro de loops de importação

No import `v2`, para cada candidato importado o código volta a ler cabeçalho completo de `MEMBERS_FUTURO` antes de enviar convite.

- Cabeçalho pode ser lido 1x fora do loop, exceto se houver mutação estrutural de colunas.

### 4.3 Reprocessamento sem cache em buscas repetidas

Funções de busca por inscrição/futuro são chamadas repetidamente e sempre fazem leitura integral das abas.

- Melhorias: cache por execução (`CacheService` ou objeto local por função principal), índices em memória por RGA/email.

### 4.4 Escrita célula a célula em vários trechos

Em diversos fluxos há `setValue` em colunas individuais na mesma linha.

- Quando possível, usar batch update (`setValues` em range contíguo) reduz custo de IO.

---

## 5) Quick wins (ordem de execução sugerida)

1. **Eliminar duplicidade de função** `members_getSemesterFromDate_` no offboarding.
2. **Refatorar `members_processAcceptanceReplies`** para usar `futureValues[i]` em vez de reler linha da planilha.
3. **Padronizar um único helper local de header map** (temporário) até mover para core.
4. **Encapsular matching RGA/email em utilitário único** e reutilizar em seletivo/offboarding/chapas.
5. **Concluir migração do import antigo -> v2** e remover o caminho legado após validação.

---

## 6) Conclusão

O módulo já mostra uma transição correta para abstrações de core (records adapter), mas ainda mantém muito comportamento local, com duplicação de lógica e custos de manutenção.

A melhor estratégia é transformar o que hoje é “utilitário de módulo” em **contratos estáveis do geapa-core** (records, normalização, matching, semestre e mensageria), reduzindo acoplamento a estrutura de planilha e diminuindo risco de drift funcional.
