import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { aiConnector } from './server/ai.mjs';
import { chatConnector } from './server/chat.mjs';
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const middleware = aiConnector(env);
  const chat = chatConnector(env);
  return {
    plugins: [react(), { name: 'riceguard-ai', configureServer(server) { server.middlewares.use(middleware); server.middlewares.use(chat); }, configurePreviewServer(server) { server.middlewares.use(middleware); server.middlewares.use(chat); } }],
    server: { port: 5173, strictPort: true },
    build: { rollupOptions: { output: { manualChunks: { charts: ['recharts'], geography: ['d3-geo'] } } } },
  };
});
