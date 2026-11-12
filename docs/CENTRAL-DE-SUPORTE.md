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
   - `VITE_SUPPORT_ENDPOINT=https://<PROJECT_REF>.supabase.co/functions/v1/support-intake`
   - `VITE_TURNSTILE_SITE_KEY=<site_key_publica>`
   - `VITE_SUPPORT_SYSTEMS=Sistema 1,Sistema 2` com nomes reais (ou vazio).
10. Reexecutar o deploy do GitHub Pages. Somente com endpoint **e** site key preenchidos a interface libera o formulário.

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
