# Avaliacao voluntaria de egressos V2

O fluxo e independente da solicitacao e da decisao de desligamento. Ele somente registra um convite depois de a solicitacao estar `EXECUTADO`, o vinculo estar `DESLIGADO` e existir evento `DESLIGAMENTO_VOLUNTARIO` `HOMOLOGADO`.

O convite nao e condicao do desligamento. Falha de criacao ou Mail Hub nao reverte o vinculo e permanece reprocessavel. O token bruto e entregue apenas ao Mail Hub, nunca e salvo nem registrado em auditoria; a base guarda somente SHA-256, expira em 30 dias e aceita uma resposta.

As respostas nao possuem `ID_PESSOA`. Administradores comuns recebem apenas resumo agregado e trechos cuja utilizacao anonima foi autorizada. A correlacao individual exige `membros:ver_avaliacoes_egressos_identificadas` e registra auditoria no convite.

Em DEV/HOMOLOG, o backend exige `ENABLE_EGRESS_FEEDBACK=true`. PROD e recusado mesmo que a flag seja enviada. A URL do formulario vem de `MEMBROS_EGRESS_FEEDBACK_BASE_URL_DEV`; remetente e fila pertencem ao Mail Hub.

Rollback: desabilitar a flag e retirar as rotas do Portal. Convites e respostas existentes nao devem ser apagados.
