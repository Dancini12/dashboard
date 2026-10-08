# AgroInfo — Painel de cotações agrícolas

**Acesse: https://agroinfo-dashboard.vercel.app**

Painel educacional gratuito do **C.E.E.P.A. Fernando Costa** (Santa Mariana, PR) para alunos e produtores acompanharem o mercado agrícola:

- **Busca no topo:** digite um produto, moeda, termo ou dúvida (ex.: "soja", "porco", "dólar", "o que é hedge") e vá direto à cotação, ao gráfico, ao glossário, às notícias ou ao Castor.
- **Início:** resumo do dia, com dólar, soja em Chicago, preços da região, diesel, tempo, andamento da safra, manchetes, atalhos para as atividades, todas as moedas e os indicadores do Banco Central (Selic, IPCA, INPC, IGP-M, CDI, poupança).
- **Bolsas:** os 17 contratos agrícolas de Chicago (CBOT e CME) e de Nova Iorque (ICE) em tabelas, com variação do dia, próximos vencimentos e o valor convertido para saca, arroba, tonelada ou kg, em dólares e em reais; e a consulta de ações e fundos da B3.
- **Cotações Cooperativas:** cotação diária do Paraná (DERAL/SEAB), por região, com mapa de onde se paga mais e menos; indicadores de preço do Brasil (CEPEA) e preço dos combustíveis no Paraná (ANP).
- **Safra:** produção, área e rendimento por safra no Paraná e na região de Cornélio Procópio, andamento de plantio e colheita, calendário agrícola (DERAL), produção de Santa Mariana e safra do Brasil (IBGE).
- **Exportações:** volume, valor e preço médio dos principais produtos do agro, mês a mês, no Brasil e no Paraná, com países de destino e estados de origem; e a consulta por país, que mostra o que o Brasil vende para ele e compra dele, produto por produto (Comex Stat).
- **Clima:** chuva dos últimos 30 dias e prevista para 15, água no solo e avisos de geada, calor e chuva forte (Open-Meteo).
- **Calculadoras:** saca a partir de Chicago, conversor de unidades, relação de troca, ponto de equilíbrio e financiamento.
- **Aprender:** simulação de uma safra, em que o aluno decide como um produtor (comprar insumos, financiar, negociar o preço, travar na bolsa, vender ou guardar), e simulador de hedge.
- **Notícias:** agronegócio, mercado e mercado internacional.
- **TV Agro:** canais do agro ao vivo pelo player oficial do YouTube (Canal Rural, Canal do Boi, Notícias Agrícolas e Embrapa), com a marcação de quem está no ar e os vídeos recentes de cada um quando não há transmissão. A lista de canais fica em `src/canaisAgro.js`.
- **Evolução:** comparação de qual item subiu mais (o visitante escolhe em cascata entre Chicago, Nova Iorque, commodities do Brasil e ações, até 6 itens), gráficos e tabela de preços de 2020 a 2026 e histórico de ações.
- **Glossário** com os termos do mercado.
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

## TV Agro

- `/api/market?type=tv` (`server/tv.js`) lê a página pública `youtube.com/channel/<id>/live` de cada canal e devolve a situação (no ar, agendado ou fora do ar) e o código do vídeo da transmissão; não usa chave de API e a resposta fica 1 minuto em cache.
- Com o código do vídeo, a aba abre o player direto na transmissão. Se a consulta falhar, usa o endereço "ao vivo pelo canal" do YouTube (ou o `videoIdAoVivo` de reserva do canal) e passa para os vídeos recentes quando o player avisa erro.
- Os players usam `youtube-nocookie.com`, o endereço do YouTube sem cookies.

## Assistente de dúvidas (Castor responde)

- Clicar no castor (ou em "Tire sua dúvida") abre um balão onde o aluno pergunta sobre as cotações. A resposta vem do Gemini (nível gratuito) por meio de um Web App do Google Apps Script.
- Memória do Castor: perguntas e respostas ficam na planilha do AgroInfo; perguntas repetidas são respondidas pela memória, sem gastar o Gemini (automáticas valem no dia; aprovadas pelo professor valem sempre). Detalhes em `apps-script/LEIA-ME.md`.
- Código do Apps Script e passo a passo de implantação: `apps-script/Assistente.gs` e `apps-script/LEIA-ME.md`.
- A URL do Web App fica em `ASSISTENTE_URL` (`src/App.jsx`); a variável `VITE_ASSISTENTE_URL`, se definida, tem prioridade.
- Preços do dia das commodities não vão para o assistente: o Notícias Agrícolas e o CEPEA bloqueiam leitura automática; o castor orienta o aluno a conferir a tabela do painel.
