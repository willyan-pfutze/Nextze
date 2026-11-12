import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({plugins:[react()],base:process.env.VITE_BASE_PATH||'./',build:{rollupOptions:{input:{main:resolve(process.cwd(),'index.html'),suporte:resolve(process.cwd(),'suporte/index.html'),privacidade:resolve(process.cwd(),'privacidade/index.html')}}}});
