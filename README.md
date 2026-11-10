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
Preencha os valores reais no arquivo `.env.local` (não commitado) ou nas **Variables** do repositório em **Settings → Secrets and variables → Actions → Variables**:
- `VITE_WHATSAPP_NUMBER`: número com DDI e DDD, somente dígitos. Ex.: 5511999999999 (exemplo ilustrativo, NÃO é um contato da NEXTZE).
- `VITE_CONTACT_EMAIL`: e-mail comercial real.
Os botões só aparecem quando o respectivo canal estiver configurado. Nenhum canal de contato fictício foi publicado.

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
