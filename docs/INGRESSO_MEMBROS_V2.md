# Ingresso de membros aprovados V2

O Portal inicia este fluxo somente depois da aprovacao institucional. Nao existem inscricao, avaliacao, entrevista, nota, classificacao ou decisao de processo seletivo.

Cadastro rapido e completo usam `membersAdminIngressosMembrosCadastrar`. A fila `INGRESSOS_MEMBROS` registra IDs e etapa; retries usam a mesma chave e retomam as entidades ausentes sem duplicar pessoa, identificadores, vinculo ou evento. E-mail/RGA existentes e pessoas ja conhecidas bloqueiam o cadastro e exigem futuro fluxo de reingresso.

O backend exige `membros:cadastrar_novos_membros`, que o setup DEV recomenda apenas para ADMIN e DIRETORIA. SECRETARIA nao recebe automaticamente. O navegador nao informa ator nem IDs internos.

O convite usa o Mail Hub e `PORTAL_HOMOLOG_URL`. Falha de e-mail nao reverte pessoa ou vinculo. O snapshot `portalUsers/{uid}` nao e criado; o primeiro login autenticado continua responsável pelo provisionamento.

`ENABLE_MEMBER_REGISTRATION` deve estar true somente em HOMOLOG. O backend recusa PROD mesmo com a flag enviada.
