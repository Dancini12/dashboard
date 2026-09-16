# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Cotações e Selic

- `npm run dev`: inclui `/api/market` no Vite para testar localmente.
- A Selic vem da série SGS 432 do Banco Central, em % ao ano, com data de referência. A consulta ocorre ao abrir e nos ciclos de 60 segundos do painel; o servidor permite cache de 5 minutos. Em falhas, mantém a última taxa recebida e sinaliza a atualização pendente.
- Ações/ETFs: digite o nome da empresa (ex.: "Petrobras") e escolha uma sugestão da busca na BRAPI, ou informe o código direto (ex.: PETR4) e clique em Consultar. PETR4, VALE3, ITUB4 e MGLU3 são exemplos sem autenticação na BRAPI. Para outros ativos, configure `BRAPI_TOKEN` no `.env.local` e no ambiente do servidor Vercel, conforme seu plano. A chave nunca é enviada ao navegador.
- Commodities: digite o nome (ex.: "soja", "café", "boi") e aperte Enter ou clique em Adicionar para exibir o valor; também é possível navegar pela lista de indicadores brasileiros e contratos internacionais abaixo. As tabelas oficiais de incorporação do Notícias Agrícolas exibem sua própria fonte, unidade e data. As seleções ficam neste navegador. As tabelas dependem da disponibilidade e das restrições do provedor; há link direto se a incorporação for bloqueada.
- Pausar interrompe os ciclos automáticos do painel. Consultar uma ação e o botão de atualização continuam disponíveis.
- As demais taxas econômicas e o histórico preexistente continuam sendo referências fixas. Moedas ainda usam a lógica anterior de estimativa/simulação em falhas.
- `npm run build` gera o frontend; a hospedagem precisa executar também `api/market.js`. Um servidor apenas estático (inclusive `vite preview`) não fornece essa API.

Fontes: https://dadosabertos.bcb.gov.br/dataset/432-taxa-de-juros---meta-selic-definida-pelo-copom, https://brapi.dev/docs/acoes e https://www.noticiasagricolas.com.br/widgets/.
