# NEXTZE — Recebimento de e-mails do Resend e associação a chamados

## Estado da integração (13/11/2026)
- Supabase: Edge Function `support-inbound` implantada, projeto `nextze-support`.
- Resend: webhook `email.received` cadastrado para:
  `https://jqeonloeyvdapwmafnkm.supabase.co/functions/v1/support-inbound`
- Segurança: **desativada por padrão** até configurar segredos e habilitar `SUPPORT_INBOUND_ENABLED=true` manualmente.
- Resend informou domínio `nextze.com.br` **partially_failed**, com MX de recebimento `@` ainda pendente. O envio de e-mails tem DKIM/SPF verificados; CNAME `rsend` ainda pendente.
- Nenhum recebimento real foi processado/testado ponta a ponta até aqui.

## DNS do Registro.br para recebimento
O modo de recebimento para o domínio principal `nextze.com.br` encaminha **todo** o e-mail desse domínio ao Resend, e pode substituir o uso de outras caixas postais.
O usuário optou pelo Resend; configure no Registro.br o MX **apenas após conferir que não existe outro servidor de correio ativo**:

| Tipo | Nome | Prioridade | Valor |
|---|---|---|---|
| MX | *(vazio = @)* | 10 | `receive-sae1.forge.rmta.net` |

Esse registro MX de `@` é **diferente** do MX `send` (`feedback-smtp.sa-east-1.amazonses.com`), que serve ao envio de e-mails.
Os registros A do site e CNAME `www` continuam inalterados. Nenhum DNS foi alterado automaticamente.

## Segredos e ativação do webhook

1. Em [Resend Webhooks](https://resend.com/webhooks), abra o webhook registrado para `support-inbound` e copie o **Signing Secret**.
2. Em [Supabase Edge Function Secrets](https://supabase.com/dashboard/project/jqeonloeyvdapwmafnkm/settings/functions), adicione **apenas no Supabase**:
   - `RESEND_WEBHOOK_SECRET`: Signing Secret do webhook
   - `RESEND_API_KEY`: API key com permissão suficiente para recuperar e-mails recebidos
   - `SUPPORT_INBOUND_ENABLED`: `false` inicialmente
   - `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`: valores internos do projeto (podem ser providos automaticamente pelo Supabase)
3. **Nunca coloque segredos em variáveis `VITE_*` ou no GitHub público.**
4. Antes de ativar, teste assinaturas inválidas, e-mails com protocolos inexistentes, remetentes não associados, tentativas duplicadas, limitação por chamado e falhas temporárias da API.
5. Apenas com DNS verificado e testes completos, altere `SUPPORT_INBOUND_ENABLED=true`.

## Comportamento de segurança
- Eventos aceitos: apenas `email.received` via POST.
- Validação HMAC SHA256 Svix sobre o **corpo bruto**; timestamp máximo de 5 minutos.
- Recuperação do e-mail via API do Resend após validação do webhook (a chave de API nunca é exposta ao visitante).
- Vínculo apenas a protocolo `NXZ-AAAA-NNNNNN` existente no **assunto** e remetente idêntico ao e-mail do solicitante original.
- Mensagens HTML sem versão texto, anexos e e-mails sem protocolo são mantidos no Resend para avaliação manual, **não são incorporados automaticamente**.
- O e-mail é entrada **não confiável**, não executa comandos, não modifica status, não cria chamados novos nem envia respostas automáticas.
- Mensagens vinculadas são inseridas em `support_messages`, com `is_internal=true` e `moderation_status='pending_review'`. Apenas um administrador autenticado no painel do Supabase poderá vê-las até que exista área administrativa com controle de acesso.
- Cada ID de e-mail possui índice único (`source_email_id`): eventos repetidos não criam múltiplas mensagens.
- Limite de até 30 respostas recebidas por chamado em 24 horas; mensagens maiores são truncadas a 12.000 caracteres; dados de outros clientes não são expostos.
- Falhas transitórias retornam HTTP 503 para o Resend tentar novamente.
- **Validação de remetente baseada no cabeçalho From não equivale a identidade autenticada**; não usar esse mecanismo para liberar visualização de chamados ou conceder permissões.

## Fluxo de retorno por e-mail
A confirmação inicial do chamado já inclui o protocolo no assunto, por exemplo `NEXTZE — Solicitação recebida: NXZ-2026-000123`.
Para facilitar as respostas, configurar os e-mails enviados pelo suporte com `reply_to: 'suporte@nextze.com.br'` assim que o recebimento estiver operacional.
Se um cliente responder ao e-mail, a mensagem será anexada **para moderação** ao respectivo ticket, desde que corresponda ao endereço do solicitante e contenha o protocolo no assunto.

## Testes e pendências
- Confirmar MX `@` no Resend e recebimento de um e-mail real autorizado.
- Configurar o secret do webhook no Supabase, testar HMAC e resiliência a replays.
- Verificar versão de e-mail recebida via Resend API.
- Testar vínculo a chamado real de ambiente controlado e deduplicação.
- Implantar gestão autenticada de mensagens, auditoria e moderação.
- Definir política LGPD, retenção e descarte de e-mails no Resend e no Supabase.
- Registrar falhas de entregabilidade de e-mails enviados e oferecer visualização interna com autorização real.
- Não habilitar anexos via site nem e-mail sem varredura antimalware.

O backend foi preparado, mas **não está apto a receber dados reais em produção** até a conclusão desses controles.
