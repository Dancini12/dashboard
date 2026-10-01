/* global process */
import { defineConfig, loadEnv } from 'vite'
import marketHandler from './api/market.js'
import newsHandler from './api/news.js'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), 'BRAPI_'));
  return {
  plugins: [react(), {
    name: 'market-api',
    configureServer(server) {
      // no computador, as funções de /api rodam dentro do próprio servidor de desenvolvimento
      for (const [rota, funcao] of [['/api/market', marketHandler], ['/api/news', newsHandler]]) {
        server.middlewares.use(rota, (req, res) => {
          req.query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
          res.status = code => { res.statusCode = code; return res; };
          res.json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
          funcao(req, res);
        });
      }
    },
  }],
  };
})
