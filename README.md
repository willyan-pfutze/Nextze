# NEXTZE — Site institucional
**Processos inteligentes. Negócios eficientes.**

Landing page comercial em React + Vite + TypeScript + Tailwind CSS + Lucide Icons. Sem backend ou armazenamento de dados.

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

## Publicação no GitHub Pages
1. Em **Settings → Pages → Build and deployment**, selecione **GitHub Actions**.
2. Faça push na branch `main` ou execute manualmente o workflow em **Actions → Publicar NEXTZE no GitHub Pages**.
3. Durante o uso do endereço temporário `https://willyan-pfutze.github.io/Nextze/`, mantenha `VITE_BASE_PATH=/Nextze/` (é o padrão do workflow).
4. Quando for conectar o domínio, configure o DNS com autorização do proprietário, verifique a titularidade quando solicitado e ajuste `VITE_BASE_PATH=/`.
5. Copie `config/CNAME.pending` para `public/CNAME` somente ao ativar o domínio personalizado; depois configure **Custom domain** nas configurações do Pages e marque **Enforce HTTPS** quando disponível.
A presença de CNAME em `public` antes da ativação pode redirecionar visitantes do endereço temporário; por isso ele está preparado, mas não ativado.
Nenhuma alteração de DNS faz parte deste repositório.

## Estrutura
- `src/App.tsx` — componentes, seções e conteúdo
- `src/styles.css` — estilos e responsividade
- `public/favicon.svg` — ícone da marca
- `.github/workflows/deploy.yml` — build/deploy automatizado
- `config/CNAME.pending` — domínio reservado para ativação futura

## SEO e revisão final
Atualize links e metadados canônicos ao ativar o domínio; confirme os canais de contato antes de divulgar comercialmente. O site não usa analytics, cookies de rastreamento, formulários nem depoimentos fictícios.

## Nota sobre identidade visual
O símbolo geométrico e wordmark são reconstruções vetoriais compatíveis com a marca aprovada. Substitua pelo arquivo mestre vetorial oficial caso haja um disponível; não foram usados gradientes.
