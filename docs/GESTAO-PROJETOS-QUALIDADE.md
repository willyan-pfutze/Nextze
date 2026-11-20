# NEXTZE — Projetos, chamados e melhoria contínua (20/11/2026)

## Funcionalidades implementadas
- No painel `/suporte/admin/`, após autenticação, navegue entre **Chamados de suporte** e **Projetos e indicadores**.
- **Projeto / sistema:** cadastrar nome, empresa cliente, versão, descrição técnica/escopo, status (Planejamento, Desenvolvimento, Testes, Implantação, Produção, Manutenção, Pausado, Encerrado). Editar projetos existentes; nenhuma exclusão destrutiva. Projetos encerrados permanecem no histórico.
- **Abertura pública `/suporte/`:** campo livre para digitar nome do sistema e campo opcional "Área ou módulo afetado". O mesmo formulário continua exigindo Turnstile e bloqueia anexos.
- **Associação automática segura:** na Edge Function `support-intake`, somente se existir um único projeto ativo cujo nome normalizado coincida com o nome de sistema informado **e** a empresa informada coincida com a empresa cliente do projeto. Se não houver correspondência única, preservar o nome digitado e deixar `system_id=null` para triagem.
- **Vínculo manual:** na visualização do chamado, escolha um projeto cadastrado, informe/ajuste a área afetada e salve. O servidor valida a permissão do agente e a existência do projeto. Registra evento interno no histórico. Isso não envia e-mail de status ao cliente.
- **Métricas:** todos os chamados vinculados por sistema, abertos, encerrados/resolvidos, incidentes classificados "Erro ou falha", urgentes, quantidade de chamados sem vínculo, ocorrências por módulo/área.
- **Não confundir volume de chamados com confiabilidade:** sistemas com mais usuários ou mais tempo em produção naturalmente podem gerar mais registros. Indicadores por 100 usuários ou por 1.000 operações exigem dados adicionais de uso.

## Banco e segurança
- Reutilizada `public.support_systems` com campos `client_name`, `description`, `project_status`, `updated_at`.
- `public.support_tickets` ganhou `system_id` (FK ON DELETE SET NULL) e `issue_area`.
- Índice único insensível a maiúsculas por `nome do projeto + nome do cliente`.
- Agregações SQL `support_project_stats()` e `support_project_areas()`, funções `SECURITY INVOKER`; EXECUTE negado a `PUBLIC`, `anon`, `authenticated` e concedido a `service_role`.
- As tabelas continuam protegidas: acesso aos projetos ocorre pela função `support-admin` após autenticação JWT e associação ao agente ativo em `support_agents`.
- Nenhuma listagem pública de projetos/clientes é publicada, evitando expor portfólio confidencial. Formulário aceita digitação livre; vínculo pelo servidor.

## Como validar
1. Acesse https://nextze.com.br/suporte/admin/ com agente autorizado. Entre na aba "Projetos e indicadores".
2. Cadastre um projeto fictício de teste, com empresa fictícia explícita, versão e status "Testes e validação". Valide a edição e mudança de status.
3. No formulário /suporte/, digite **exatamente** o mesmo nome de sistema e empresa do cadastro, detalhe uma área (ex.: "Login") e envie usando e-mail de teste; verifique o protocolo, o vínculo automático em detalhes do chamado e o aumento da contagem dos indicadores.
4. Abra um chamado com nome ligeiramente diferente; confirme que fica "Sem associação". Entre no detalhe e faça vínculo manual.
5. Crie incidentes em duas áreas diferentes; confira ranking por área. Valide que nenhuma nota interna aparece na página pública de consulta.
6. Garanta que mudanças de status do projeto não alteram automaticamente o status dos chamados (dois estados independentes).

## Limitações e próxima fase
- Estatísticas são agregações absolutas, não uma classificação causal de qualidade.
- O cadastro de módulos é texto livre; padronizar categorias (por exemplo "Autenticação", "Inventário", "Relatórios", "Integrações") reduz divisões por nomes diferentes.
- A associação automática pesquisa até 500 registros ativos do portfólio; ao ultrapassar essa escala, implemente correspondência indexada no banco e paginação.
- O painel lista inicialmente 100 chamados e até 500 projetos; paginar em operação de maior porte.
- Recomendação futura: registrar ambientes de produção/homologação, versões nos incidentes, severidade validada, causa raiz, tempo de resolução e base de usuários/volume de transações para comparar confiabilidade em condições equivalentes.
