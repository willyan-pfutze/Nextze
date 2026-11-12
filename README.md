# NEXTZE — Site institucional
**Processos inteligentes. Negócios eficientes.**

Landing page comercial em React + Vite + TypeScript + Tailwind CSS + Lucide Icons. Sem backend ou armazenamento de dados.

## Central de Suporte
A página `/suporte/` foi adicionada sem substituir a landing page. Inclui base de conhecimento sem artigos inventados, formulário e política de primeira resposta. O formulário fica **desabilitado** até que o backend Supabase, o antispam e os controles de segurança sejam configurados e testados. Para implantação, documentação técnica, dependências e pendências, leia [docs/CENTRAL-DE-SUPORTE.md](docs/CENTRAL-DE-SUPORTE.md).

A página `/privacidade/` contém informações preliminares e precisa de revisão antes da ativação da coleta de dados reais.

## Instalação local
Requer Node.js 22+.
```bash
npm install
npm run dev
npm run build
npm run preview
```

## Contatos comerciais
O site usa temporariamente dois números de WhatsApp autorizados pelo responsável:
- DDD 51: `5551995068708`
- DDD 11: `5511933620498`

Eles aparecem como duas opções na seção Contato. Os botões das demais seções direcionam para o primeiro canal (DDD 51).

Ao criar canais corporativos, defina as **Variables** em **Settings → Secrets and variables → Actions → Variables**:
- `VITE_WHATSAPP_NUMBER_51` — substitui o WhatsApp DDD 51 (somente dígitos, com DDI 55).
- `VITE_WHATSAPP_NUMBER_11` — substitui o WhatsApp DDD 11.
- `VITE_CONTACT_EMAIL` — insere o e-mail comercial após sua criação.

Os contatos temporários são valores padrão do código e, por isso, públicos no repositório e na página. Para desativar um canal, configure a variável correspondente como string vazia. Ajuste também os rótulos e números exibidos no componente `src/App.tsx` ao substituí-los.

## Publicação no GitHub Pages e domínio
O site usa caminhos relativos (`base: './'`) para funcionar no endereço temporário e no domínio personalizado, sem mudar os caminhos das aplicações a cada deploy.

1. O workflow de GitHub Actions faz build e deploy a cada push em `main`.
2. Acesse **Settings → Pages → Custom domain** e salve `nextze.com.br`.
3. **Após salvar o domínio no GitHub**, configure o DNS do domínio no provedor: crie quatro registros `A` com host `@` e valores `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`. Para `www`, crie `CNAME` com host `www` apontando para `willyan-pfutze.github.io` (sem `/Nextze`).
4. Opcional: registros IPv6 `AAAA` para `@`: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.
5. Aguarde propagação e emissão do certificado. Em **Settings → Pages**, ative **Enforce HTTPS** quando disponível. Não apague registros MX ou TXT de e-mail.
6. Acesse `https://nextze.com.br` e `https://www.nextze.com.br` para conferir o redirecionamento.

**Observação importante:** o arquivo `public/CNAME` está incluído como referência, mas para deploy via **GitHub Actions** o GitHub não usa o arquivo para vincular o domínio. O vínculo efetivo é feito em **Settings → Pages → Custom domain**. Registros DNS não são modificados pelo repositório. Consulte a [documentação oficial](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

## Estrutura
- `src/App.tsx` — componentes, seções e conteúdo
- `src/styles.css` — estilos e responsividade
- `public/favicon.svg` — ícone da marca
- `.github/workflows/deploy.yml` — build/deploy automatizado
- `public/CNAME` — registro informativo do domínio (GitHub Actions exige configuração em Settings → Pages)

## SEO e revisão final
Atualize links e metadados canônicos ao ativar o domínio; confirme os canais de contato antes de divulgar comercialmente. O site não usa analytics, cookies de rastreamento, formulários nem depoimentos fictícios.

## Nota sobre identidade visual
O símbolo geométrico e wordmark são reconstruções vetoriais compatíveis com a marca aprovada. Substitua pelo arquivo mestre vetorial oficial caso haja um disponível; não foram usados gradientes.
