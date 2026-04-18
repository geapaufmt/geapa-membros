# Contrato de integração proposto para GEAPA-CORE (compatível com geapa-membros)

Este documento descreve as funções de `GEAPA_CORE` que o módulo `geapa-membros` já passou a consumir de forma progressiva.

## Funções novas sugeridas no core

1. `coreNormalizeEmail(value): string`
   - Normaliza e-mail (`trim + lowerCase`).

2. `coreNormalizeIdentityKey(value): string`
   - Normaliza chave de identificação (`NFD`, remove acento, colapsa espaços, uppercase).

3. `coreGetSemesterIdForDate(value): string`
   - Retorna diretamente o `id` de semestre (ex.: `2026/1`) a partir de data/valor.

4. `coreSendTrackedEmail({ to, subject, htmlBody, newerThanDays }): { threadId, messageId }`
   - Envia email e retorna metadados de rastreio.

## Estratégia de rollout sem quebra

- Fase 1 (atual): `geapa-membros` usa adapters e fallback local.
- Fase 2: implementar as funções no `geapa-core` com mesma assinatura.
- Fase 3: remover polyfills de compatibilidade no membros após validação.

## Observação

No momento, este repositório não contém o código-fonte do `geapa-core`; por isso a implementação definitiva das funções acima deve ser aplicada no repositório do core.
