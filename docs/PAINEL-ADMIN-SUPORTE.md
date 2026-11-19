# NEXTZE — Painel administrativo de suporte (18/11/2026)

## Funcionalidades implantadas
- Interface estática: https://nextze.com.br/suporte/admin/ (noindex; não é uma fronteira de segurança).
- API: `https://jqeonloeyvdapwmafnkm.supabase.co/functions/v1/support-admin`.
- Login: Supabase Auth com e-mail/senha; sessão mantida somente na memória da aba.
- Autorização **obrigatória no servidor**: acesso apenas a `auth.users.id` cadastrado em `public.support_agents` com `active=true`. A autorização é verificada em toda requisição.
- Listar 100 chamados mais recentes, filtrar por status/pesquisar, consultar detalhes e histórico.
- Alterar status (com histórico), criar notas internas e aprovar/rejeitar revisão de mensagens recebidas.
- **Sem** resposta automática por e-mail, sem edição de dados do solicitante, sem acesso a anexos, sem exposição direta das tabelas ao navegador.
- `support-admin` usa a service role **somente no Supabase Edge Function**; a interface pública contém exclusivamente chave `sb_publishable`.

## Habilitar primeiro agente (ação humana, obrigatória)
1. Abra https://supabase.com/dashboard/project/jqeonloeyvdapwmafnkm/auth/users e use **Add user** para criar o usuário administrativo com e-mail controlado pela NEXTZE, senha forte e e-mail confirmado. Não use senha compartilhada e não envie credenciais por chats.
2. Copie o UUID gerado para esse usuário. Não utilize UUID de cliente ou de outra pessoa.
3. Execute no SQL Editor, substituindo os dois valores de exemplo:
```sql
insert into public.support_agents(user_id,display_name,active)
values ('UUID_DO_USUARIO_ADMIN'::uuid,'Administrador NEXTZE',true)
on conflict (user_id) do update
set display_name=excluded.display_name,active=true;
```
4. Visite https://nextze.com.br/suporte/admin/ e entre com o e-mail e senha do usuário criado.
5. Caso o agente não esteja cadastrado, a API retorna HTTP 403 e não apresenta dados de chamados.
6. Para revogar acesso: `update public.support_agents set active=false where user_id='UUID'::uuid;`. O token de autenticação sozinho nunca autoriza a administração.

## Segurança e limites atuais
- Chave publicável no frontend **não é segredo**; `SUPABASE_SERVICE_ROLE_KEY` permanece somente no servidor.
- CORS permite apenas `https://nextze.com.br` e `https://www.nextze.com.br`. CORS não substitui autenticação; toda operação valida a identidade na API e consulta `support_agents`.
- O backend não concede permissões REST diretas a `anon` ou `authenticated`; o RLS das tabelas permanece restritivo.
- Mensagens de e-mail entram como conteúdo não confiável, pendente de revisão; a interface as apresenta como texto simples e não executa HTML ou instruções.
- Aprovar uma mensagem significa **somente concluir a revisão interna**, não publicar automaticamente nem enviar mensagem ao cliente.
- O painel não é um sistema completo de suporte ainda: faltam atribuição de agente, notificações de mudanças, SLA calculado, paginação acima de 100 itens, encerramento e resposta pública com trilha de entrega.
- A lista de mensagens e o histórico de cada chamado exibem no máximo 200 registros; expandir paginação antes de volume elevado.
- A sessão do painel não é persistida: recarregar a página exigirá novo login.
- **Produção do formulário:** manter `VITE_SUPPORT_ENABLED=false` e `SUPPORT_INTAKE_ENABLED=false` até o teste controlado de Turnstile, envio Resend, privacidade, abuso e anexos. Nunca habilitar anexos sem scanner antimalware.
- Recomendado ativar MFA e controles de tentativas no Supabase Auth antes de cadastrar outros agentes.

## Testes de aceite
1. Acesso sem login: painel exibe somente formulário; API retorna HTTP 401 sem bearer token.
2. Usuário autenticado não cadastrado em `support_agents`: HTTP 403.
3. Agente ativo: visualiza `NXZ-2026-000002`, incluindo mensagem aprovada/rejeitada apenas depois de decisão deliberada.
4. Troca de status: a alteração aparece em `support_tickets` e é registrada em `support_history`.
5. Nota interna: aparece em `support_messages` com `is_internal=true`; nenhuma mensagem é enviada ao cliente.
6. Desativação do agente: próxima requisição retorna HTTP 403.
7. Regressão da central pública: `/suporte/` permanece com formulário desligado até autorização de abertura comercial.

## Formulário público já existente
A tela `/suporte/` foi previamente implementada, e a função `support-intake` exige validação Cloudflare Turnstile, controles de origem, validação de campos, limite por e-mail e envio de confirmação opcional via Resend. Ainda não está ativada ao público. Para validar o formulário, utilize ambiente separado ou janela de testes controlada, confirme backend e só então ative frontend, sem anexos.
