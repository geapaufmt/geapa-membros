# Compatibilidade GEAPA

- Repositório histórico: preservar scripts e recuperação; não criar escritor concorrente.
- Regras e contratos atuais: geapaufmt/geapa-core. Frontend: geapaufmt/geapa-portal.
- Sheets/Apps Script descritos em docs/history são arquitetura anterior, não fonte operacional principal.
- Não executar setups, jobs, comunicações ou migrações por interpretar instruções antigas como autorização.
- Não alterar dados reais, permissões ou deploy sem autorização explícita.
- Preservar branches/checkpoints, sem force-push. Mudanças desta convergência são somente documentais.
