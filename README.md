# AgroInfo — Painel de cotações agrícolas

**Acesse: https://agroinfo-dashboard.vercel.app**

Painel educacional gratuito do **C.E.E.P.A. Fernando Costa** (Santa Mariana, PR) para alunos e produtores acompanharem o mercado agrícola:

- **Busca no topo:** digite um produto, moeda, termo ou dúvida (ex.: "soja", "porco", "dólar", "o que é hedge") e vá direto à cotação, ao gráfico, ao glossário, às notícias ou ao Castor.
- **Painel:** moedas, Selic, ações da B3, cotações de commodities (soja, milho, café, boi, trigo, leite…) e previsão do tempo.
- **Futuros:** os principais contratos agrícolas de Chicago, Nova Iorque e CME, com a unidade em que cada um é cotado e o equivalente em US$ por tonelada e por kg.
- **Chicago:** todos os contratos agrícolas da Bolsa de Chicago (CBOT e CME) em uma tabela, com variação do dia, próximos vencimentos e o valor convertido para saca, tonelada ou kg em dólares e em reais.
- **Cotações Cooperativas:** cotação diária do Paraná (DERAL/SEAB), por região.
- **Notícias:** agronegócio, mercado e mercado internacional.
- **Histórico, Gráficos e Glossário** para estudar a evolução dos preços e os termos do mercado.
- **Castor:** assistente que responde dúvidas dos alunos sobre o mercado.

Docente: Marcel Dancini Rodrigues.

---

Projeto em React + Vite, hospedado na Vercel. Notas técnicas abaixo.

## Cotações e Selic

- `npm run dev`: inclui `/api/market` no Vite para testar localmente.
- A Selic vem da série SGS 432 do Banco Central, em % ao ano, com data de referência. A consulta ocorre ao abrir e nos ciclos de 60 segundos do painel; o servidor permite cache de 5 minutos. Em falhas, mantém a última taxa recebida e sinaliza a atualização pendente.
- Ações/ETFs: digite o nome da empresa (ex.: "Petrobras") e escolha uma sugestão da busca na BRAPI, ou informe o código direto (ex.: PETR4) e clique em Consultar. PETR4, VALE3, ITUB4 e MGLU3 são exemplos sem autenticação na BRAPI. Para outros ativos, configure `BRAPI_TOKEN` no `.env.local` e no ambiente do servidor Vercel, conforme seu plano. A chave nunca é enviada ao navegador.
- Commodities: digite o nome (ex.: "soja", "café", "boi") e aperte Enter ou clique em Adicionar para exibir o valor; também é possível navegar pela lista de indicadores brasileiros e contratos internacionais abaixo. As tabelas oficiais de incorporação do Notícias Agrícolas exibem sua própria fonte, unidade e data. As seleções ficam neste navegador. As tabelas dependem da disponibilidade e das restrições do provedor; há link direto se a incorporação for bloqueada.
- Pausar interrompe os ciclos automáticos do painel. Consultar uma ação e o botão de atualização continuam disponíveis.
- As demais taxas econômicas e o histórico preexistente continuam sendo referências fixas. Moedas ainda usam a lógica anterior de estimativa/simulação em falhas.
- `npm run build` gera o frontend; a hospedagem precisa executar também `api/market.js`. Um servidor apenas estático (inclusive `vite preview`) não fornece essa API.

Fontes: https://dadosabertos.bcb.gov.br/dataset/432-taxa-de-juros---meta-selic-definida-pelo-copom, https://brapi.dev/docs/acoes e https://www.noticiasagricolas.com.br/widgets/.

## Assistente de dúvidas (Castor responde)

- Clicar no castor (ou em "Tire sua dúvida") abre um balão onde o aluno pergunta sobre as cotações. A resposta vem do Gemini (nível gratuito) por meio de um Web App do Google Apps Script.
- Memória do Castor: perguntas e respostas ficam na planilha do AgroInfo; perguntas repetidas são respondidas pela memória, sem gastar o Gemini (automáticas valem no dia; aprovadas pelo professor valem sempre). Detalhes em `apps-script/LEIA-ME.md`.
- Código do Apps Script e passo a passo de implantação: `apps-script/Assistente.gs` e `apps-script/LEIA-ME.md`.
- A URL do Web App fica em `ASSISTENTE_URL` (`src/App.jsx`); a variável `VITE_ASSISTENTE_URL`, se definida, tem prioridade.
- Preços do dia das commodities não vão para o assistente: o Notícias Agrícolas e o CEPEA bloqueiam leitura automática; o castor orienta o aluno a conferir a tabela do painel.
