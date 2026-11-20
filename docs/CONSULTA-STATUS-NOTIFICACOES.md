# NEXTZE — Portal de chamados, rastreamento e notificações (20/11/2026)

## Entregue no código e no Supabase
- Portal de abertura em `https://nextze.com.br/suporte/`: campos, consentimento LGPD, Turnstile e anexo **desligado**. A abertura pública permanece bloqueada até teste de aceitação.
- Função `support-intake`: validação Turnstile no servidor, campos/limites, geração de protocolo pelo PostgreSQL e confirmação transacional via Resend. Confirmação agora inclui link para consulta.
- Página de consulta `https://nextze.com.br/suporte/consultar/`: protocolo + e-mail cadastrado + verificação Turnstile; código de 8 dígitos enviado somente ao endereço de abertura, válido por 10 minutos, máximo de cinco tentativas por código. Cada código só permite uma consulta.
- API `support-lookup`: retorna somente protocolo, título, status, prioridade, horários e histórico público. **Nunca** retorna notas internas, mensagens, anexos nem informações de outros solicitantes. O protocolo sozinho não autoriza acesso.
- Painel administrativo `https://nextze.com.br/suporte/admin/`: ao alterar status, grava evento de notificação, envia e-mail para solicitante e apresenta erro de envio sem desfazer a atualização. Permite reenvio da última notificação pendente via botão, com chave de idempotência do Resend.
- E-mails de alteração de status incluem apenas protocolo, status e link para consulta; não divulgam descrição de erro, dados de clientes ou notas internas.

## Supabase
Migração aplicada no projeto `jqeonloeyvdapwmafnkm` com as tabelas:
- `public.support_lookup_challenges`: OTP com hash SHA-256 e salt, expiração, contador de tentativas, hash de IP e consumo único.
- `public.support_status_notifications`: outbox para auditoria do estado de entrega de alertas, tentativas e ID do provedor.
As duas tabelas estão com RLS habilitado e permissões revogadas a `anon` e `authenticated`. Acesso apenas por Edge Functions com verificação apropriada no servidor.

## Implantação real
- Edge Functions `support-lookup`, `support-admin`, `support-intake`: implantadas.
- GitHub Pages é publicado automaticamente pelo GitHub Actions. Verificar conclusão do último build antes de anunciar as páginas.
- **Não habilitado automaticamente:** formulário de abertura público. Os controles existentes `VITE_SUPPORT_ENABLED` e `SUPPORT_INTAKE_ENABLED` precisam estar iguais a `true` somente após teste E2E com Turnstile, email transacional e uma conta de solicitante controlada.
- **Anexos**: `VITE_SUPPORT_ATTACHMENTS_ENABLED=false` e `SUPPORT_ATTACHMENTS_ENABLED=false`; manter desligados sem scanner antimalware.

## Teste de aceitação obrigatório
1. Confirmar resultado success do GitHub Actions, acesso a `/suporte/consultar/` e link na página de suporte.
2. Enviar formulário sem Turnstile: rejeição. Enviar payload de outra origem: rejeição.
3. Criar chamado de teste no portal com e-mail próprio, verificar protocolo e confirmação no Resend e no Supabase. Testar falha proposital de notificação sem perder ticket.
4. Na página de consulta, informar protocolo + e-mail incorreto: resposta genérica, sem dados.
5. Protocolo + e-mail correto + Turnstile: código por e-mail; expiração em 10 min e rejeição após 5 tentativas.
6. Verificar status com código correto: mostrar só dados públicos; reuso do mesmo código deve falhar.
7. Alterar status no painel: conferir linha em `support_status_notifications`, e-mail ao cliente e evento no histórico; conferir no portal com **novo código**.
8. Simular falha de Resend e testar reenvio autorizado. Confirmar que chave de service role nunca é publicada no frontend.
9. Verificar limites de consultas, retenção/limpeza periódica da tabela de códigos e política de privacidade antes do lançamento comercial.

## Pendências conhecidas
- Não existe processo automático de reenvio das notificações que falharam; o agente precisa usar o botão no painel. A fila funciona para registrar falhas e permitir intervenção manual.
- Fluxo de notas internas e revisão não envia mensagens externas nem responde aos clientes.
- Não foi implementado leitor/visualizador de anexos.
- A consulta atualmente retorna histórico de status e mensagens públicas do histórico, não a comunicação completa; isso é intencional.
- Recomenda-se agregar limitação por IP resistente a ataques distribuídos (por exemplo Cloudflare WAF/rate limits), limpeza automática de códigos expirados, e-mail bounce, auditoria de retenção LGPD e testes automatizados.
- Evitar publicidade e produção antes da validação ponta a ponta.
