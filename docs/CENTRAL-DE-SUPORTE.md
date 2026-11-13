# NEXTZE — Central de Suporte (implantação segura)

## Status real
- **Portal visual e rota pública**: desenvolvido em `/suporte/`, integrado ao site.
- **KB**: estrutura de categorias e pesquisa, sem artigos inventados; a gestão segura dos artigos ainda requer API, autorização e cadastro editorial.
- **Abertura de chamados**: interface e backend preparados, **desabilitados** até configurar/validar dependências.
- **Protocolo**: banco gera sequência segura `NXZ-AAAA-NNNNNN` (apenas após a gravação).
- **Evidências**: armazenamento privado; recomenda-se um scanner antimalware adicional antes da operação comercial.
- **Notificações**: integração Resend no backend preparada; depende de chave, domínio verificado e remetente real.
- **Consulta de chamados**: não publicada, pois exige identidade verificada/link assinado.
- **Administração interna**: não publicada; nenhuma interface administrativa desprotegida foi criada.

## Arquitetura
React/Vite/TypeScript → GitHub Pages (somente estático)
→ Cloudflare Turnstile → Supabase Edge Function (servidor)
→ Postgres com RLS deny-by-default + Supabase Storage privado
→ Resend (envio transacional apenas se configurado)

O número de protocolo, a gravação, os uploads e a entrega de resposta ao cliente **não** podem depender apenas do navegador. A função publica protocolo somente após a persistência. O retorno expõe `email_sent` de forma explícita; falha na notificação não implica falha no registro.

## Preparação externa obrigatória
1. Criar um projeto Supabase sob controle da NEXTZE. Revisar custos e a região de dados.
2. Instalar a CLI do Supabase e autenticar sua conta (`supabase login`); vincular ao projeto (`supabase link --project-ref <PROJECT_REF>`).
3. Revisar e aplicar `supabase/migrations/202611120001_support.sql`. A migration cria tabelas, sequência, histórico, RLS, bucket privado e configurações de SLA. Não rode em um banco com dados preexistentes sem revisão.
4. Configurar Cloudflare Turnstile para `nextze.com.br` e `www.nextze.com.br`, obtendo site key pública e secret privada.
5. Verificar domínio de e-mail em um provedor transacional (Resend, por exemplo), sem presumir que `suporte@nextze.com.br` já existe. Criar o endereço remetente ou alias verdadeiro.
6. Configurar as variáveis secretas da Edge Function via `supabase secrets set`:
   - `SUPABASE_URL` (normalmente fornecida pelo ambiente)
   - `SUPABASE_SERVICE_ROLE_KEY` (segredo **nunca** no GitHub Pages)
   - `TURNSTILE_SECRET_KEY`
   - `SUPPORT_ALLOWED_ORIGINS=https://nextze.com.br,https://www.nextze.com.br`
   - `RESEND_API_KEY` e `SUPPORT_FROM_EMAIL` (quando habilitar e-mail).
7. Revisar requisitos LGPD, autorização dos titulares, política de retenção, backups, monitoramento, limites de abuso e scanner antimalware para anexos. Validar prazos/horários contratuais e feriados; a mensagem de prazo é apenas referência de primeira resposta.
8. Implantar `supabase functions deploy support-intake --no-verify-jwt` **somente** após validação de segurança. O endpoint precisa permanecer protegido por Turnstile, origem permitida e limitação de requisições.
9. Em **GitHub → Settings → Secrets and variables → Actions → Variables**, configurar:
   - `VITE_SUPPORT_ENABLED=false` (alterar para `true` apenas após testes completos e liberação expressa)\n   - `VITE_SUPPORT_ENDPOINT=https://<PROJECT_REF>.supabase.co/functions/v1/support-intake`
   - `VITE_TURNSTILE_SITE_KEY=<site_key_publica>`
   - `VITE_SUPPORT_SYSTEMS=` com os nomes verdadeiros dos sistemas, separados por vírgula (ou vazio).\n   - `VITE_SUPPORT_ENABLED=true` **somente após os testes de banco, anexos, envio e segurança**.
10. Reexecutar o deploy do GitHub Pages. Somente com endpoint HTTPS, site key e ativação explícita a interface libera o formulário. Configure também `SUPPORT_INTAKE_ENABLED=true` no backend **apenas após os testes**; a função exige Resend configurado antes de aceitar novos registros.

### Limitação importante
Os controles atuais de anexos fazem checagem de tipo/assinatura e tamanho, mas **não** substituem varredura antimalware especializada. Antes de abrir uploads a clientes externos, contratar e integrar scanner, configurar retenção e testar arquivos maliciosos em ambiente isolado. Não compartilhe anexos por URLs públicas.

## Testes antes da produção
- Formulário desabilitado sem variáveis ou backend.
- Campos obrigatórios, e-mail, comprimento de texto e prioridade.
- Turnstile faltante, expirado, inválido, de outro host ou reutilizado.
- Arquivos JPG/PNG/PDF/TXT válidos e inválidos; rejeição de executáveis disfarçados.
- Limites 3 arquivos, 5 MB por arquivo e 12 MB total.
- Protocolo único em envios simultâneos, sem gerar sucesso em falha de banco/upload.
- Exclusão/compensação em falha de upload e tratamento de eventuais registros órfãos.
- Teste de RLS como `anon` e `authenticated`; nenhum acesso a chamados ou anexos.
- Notificação com domínio verificado, erros do provedor, bounce e limites de envio.
- Dados pessoais, logs, exclusão, retenção, auditoria e backups.
- SLA em dias úteis, horários e feriados, incluindo exceções contratuais.

## Evolução (não publicada)
Acompanhamento por link temporário assinado enviado ao e-mail **verificado** ou autenticação real; ambiente administrativo com RBAC, auditoria, status e mensagens internas/públicas; histórico do cliente, gestão de KB restrita e gestão de SLA. Não exponha a chave de service role em variáveis `VITE_*`.

## Custos potenciais
- GitHub Pages: de acordo com o plano do GitHub e limites de uso.
- Supabase: limites gratuitos / custo após consumo e capacidade necessária.
- Turnstile: condições de uso aplicáveis.
- Resend: limites gratuitos / custo por envio, domínio verificado.
- Serviço de varredura antimalware, armazenamento e retenção: dependem da solução e dos contratos.

Nenhum contrato, licença, conta de serviços externos ou chave foi criado por esse commit.

## Status de conexão em 12/11/2026
A integração Supabase está conectada ao ChatGPT, porém a conta acessível atualmente **não apresenta projetos existentes**. É necessário selecionar a organização correta e criar um projeto (custos devem ser apresentados e aprovados previamente). Não há migração aplicada, função implantada ou serviço de banco ativo.
O domínio `nextze.com.br` foi cadastrado no Resend, na região São Paulo, mas **ainda não está verificado**. Os DNS de envio estão pendentes. Não foram alterados registros DNS, enviados e-mails, nem configuradas credenciais.

## DNS pendente de verificação Resend (Registro.br)
Adicionar sem remover os registros A/CNAME do GitHub Pages e sem substituir MX da raiz.
- TXT: nome `resend._domainkey`, valor `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDOO/MWum1XbQ8SfyJy0hqAc8RSYUwtCR7s1kETEIcF2y+KXJiKwxmZL/fMY+KPM67YCnZe1ZIvI/YEqg/a//yOt5NYCXPxM3UEr/zBUJKTBuQWB0ff8Ee54Q/I4tUdClCqaUeE2zrBwJMgyW4xPgBW3vuix2cINLunKOEuyYjiTQIDAQAB`
- MX: nome `send`, prioridade `10`, valor `feedback-smtp.sa-east-1.amazonses.com`
- TXT: nome `send`, valor `v=spf1 include:amazonses.com ~all`
- CNAME: nome `rsend`, valor `send.forge.rmta.net`

Os registros são para autenticação de e-mail transacional; **não criam uma caixa postal**. É necessária caixa ou alias para receber respostas em `suporte@nextze.com.br`. Após a propagação, verificar o domínio pelo painel/API Resend.

## Controle de publicação
- GitHub Pages preserva a landing e exibe a página de suporte informativa.
- A abertura online só é liberada após configurar todas as variáveis e ativar explicitamente `VITE_SUPPORT_ENABLED=true`.
- Antes disso, o formulário é intencionalmente desabilitado; não anunciar o fluxo de protocolo como já funcional.

## E-mail NEXTZE — Resend
O domínio `nextze.com.br` já foi cadastrado para envio em `sa-east-1`, mas **a verificação DNS ainda está pendente**. Não foram alterados registros DNS no Registro.br. Configurações exigidas pelo provedor:

| Tipo | Nome | Valor | Prioridade |
|---|---|---|---|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDOO/MWum1XbQ8SfyJy0hqAc8RSYUwtCR7s1kETEIcF2y+KXJiKwxmZL/fMY+KPM67YCnZe1ZIvI/YEqg/a//yOt5NYCXPxM3UEr/zBUJKTBuQWB0ff8Ee54Q/I4tUdClCqaUeE2zrBwJMgyW4xPgBW3vuix2cINLunKOEuyYjiTQIDAQAB` | — |
| MX | `send` | `feedback-smtp.sa-east-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |
| CNAME | `rsend` | `send.forge.rmta.net` | — |

**Atenção:** esses registros são para envio transacional; não substitua os quatro A do GitHub Pages nem o CNAME `www`, e não apague os registros do e-mail de recebimento. O domínio verificado para enviar e-mails não cria, por si só, uma caixa de entrada em `suporte@nextze.com.br`.

## Projeto Supabase criado em 12/11/2026 (etapa posterior)
- Organização: Nextze
- Projeto: `nextze-support`
- Região: `sa-east-1`
- Project ref: `jqeonloeyvdapwmafnkm`
- Custo informado no momento da criação: US$ 0/mês, sujeito a limites e alterações de consumo/plano.
- Migração aplicada: `initial_nextze_support_schema`.
- Edge Function `support-intake`: implantada e ativa, `verify_jwt=false`, com validação Turnstile obrigatória. Na ausência da chave secreta Turnstile, a função recusa solicitações (HTTP 503).
- Endpoint público preparado: `https://jqeonloeyvdapwmafnkm.supabase.co/functions/v1/support-intake`.
- Teste SQL com transação desfeita confirmou geração de protocolo `NXZ-2026-000001` e inserção automática de histórico. Contagem após rollback: zero chamados reais.
- Verificado: nove tabelas `support_*` com RLS, `anon` sem SELECT/INSERT e armazenamento não público.
- Pendências: Turnstile configurado e validado, varredura antimalware de anexos, validação de ponta a ponta, remetente Resend verificado, processamento de falhas de notificações e política de dados revisada. **Não habilitar `VITE_SUPPORT_ENABLED=true` sem resolver essas pendências.**

## Proteção de anexos — 12/11/2026
O envio de evidências está desativado por padrão, tanto no navegador (`VITE_SUPPORT_ATTACHMENTS_ENABLED=false`) quanto na Edge Function (`SUPPORT_ATTACHMENTS_ENABLED` diferente de `true`). O backend responde 422 a arquivos enquanto o scanner antimalware não estiver implementado. Não configure esses dois valores como `true` antes de integrar varredura automática e um fluxo seguro de quarentena, reprovação e exclusão de anexos. O bucket segue privado.
