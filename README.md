# AgroInfo — Painel de cotações agrícolas

**Acesse: https://agronahora.com.br**

O endereço antigo, `agroinfo-dashboard.vercel.app`, e o `www.agronahora.com.br` redirecionam para `agronahora.com.br` (regras em `vercel.json`). As chamadas `/api` no endereço antigo continuam respondendo sem redirecionar. A chave do contador de visitantes (`src/components/VisitorCounter.jsx`) mantém o nome antigo de propósito, para a contagem não zerar.

Painel gratuito para estudantes e produtores acompanharem o mercado agrícola:

- **Link direto para cada aba:** o endereço muda com a aba (`…/#tv`, `…/#exportacoes`, `…/#clima`), então dá para mandar o link de uma aba e usar o botão "voltar" do navegador entre elas.
- **Busca no topo:** digite um produto, moeda, termo ou dúvida (ex.: "soja", "porco", "dólar", "o que é hedge") e vá direto à cotação, ao gráfico, ao glossário, às notícias ou ao Castor. Com o estado junto ("soja mato grosso", "milho gaúcho", "boi sp"), a busca abre as Cotações Cooperativas no estado e no produto; os itens dos estados só aparecem quando o estado é digitado (`exige` em `src/busca.js`) (enquanto o Castor está em construção, a busca não oferece perguntar a ele).
- **Resumo do dia** (a página que abre o site, montada como a primeira página de um jornal): a manchete (a notícia mais recente do agronegócio com assunto definido), a coluna de notícias organizadas por assunto (uma por tema, como no Jornal do dia), o quadro das cotações do dia (dólar, soja em Chicago, preços da região e diesel), notícias de mercado, andamento da safra, o quadro azul-claro da previsão do tempo de 7 dias da cidade que o visitante digitar (o site lembra a cidade naquele aparelho), atalhos para as atividades, todas as moedas e os indicadores do Banco Central (Selic, IPCA, INPC, IGP-M, CDI, poupança).
- **Estado do Resumo e do Jornal:** o quadro "Hoje no mercado" e a folha do Jornal mostram soja, milho, boi e diesel do estado escolhido (seletor ao lado do título; é o mesmo da aba Cotações Cooperativas, lembrado no navegador; lista em `src/estados.js`). No Paraná, os preços da região de Cornélio Procópio; nos outros, a média do estado (em São Paulo, a média simples das regionais que informaram, com o menor e o maior preço). O diesel de cada estado vem da mesma planilha semanal da ANP. Tocar num preço abre a aba Cotações Cooperativas no estado e no produto.
- **Jornal do dia:** o resumo do dia diagramado como a primeira página de um jornal clássico, em preto e branco e em uma folha só (manchete, texto em colunas, quadro de cotações, notícias e a previsão do tempo de 7 dias da cidade escolhida), para imprimir, salvar em PDF ou guardar como imagem (PNG) e compartilhar.
- **Bolsas:** os 17 contratos agrícolas de Chicago (CBOT e CME) e de Nova Iorque (ICE) em tabelas, com variação do dia, próximos vencimentos e o valor convertido para saca, arroba, tonelada ou kg, em dólares e em reais; e a consulta de ações e fundos da B3.
- **Cotações Cooperativas:** o preço pago ao produtor em cinco estados, cada um pela fonte oficial: Paraná (cotação diária do DERAL/SEAB, por região, com mapa de onde se paga mais e menos), São Paulo (preços diários do IEA por regional), Mato Grosso do Sul (cotações diárias da Famasul por cidade e região), Mato Grosso (IMEA, soja e milho disponíveis por cidade, boi e vaca gordos por município e macrorregião) e Rio Grande do Sul (boletim semanal da Emater/RS-Ascar, com o preço por município e a comparação com a semana, o mês e o ano anteriores); indicadores de preço do Brasil (CEPEA) e preço dos combustíveis no Paraná (ANP).
- **Safra:** produção, área e rendimento por safra no Paraná e na região de Cornélio Procópio, andamento de plantio e colheita, calendário agrícola (DERAL), produção de Santa Mariana e safra do Brasil (IBGE).
- **Exportações:** volume, valor e preço médio dos principais produtos do agro, mês a mês, no Brasil e no Paraná, com países de destino e estados de origem, e a opção "Todos os produtos", que soma tudo e lista produto por produto; e a consulta por país, que mostra o que o Brasil vende para ele e compra dele, produto por produto (Comex Stat).
- **Clima:** para a cidade que o visitante digitar (a aba abre sem cidade escolhida), previsão do tempo (agora, os próximos 7 dias e cada dia por período e hora a hora), chuva dos últimos 30 dias e prevista para 15, água no solo e avisos de geada, calor e chuva forte (Open-Meteo).
- **Calculadoras:** saca a partir de Chicago, conversor de unidades, relação de troca, ponto de equilíbrio e financiamento.
- **Aprender:** simulação de uma safra, em que o aluno decide como um produtor (comprar insumos, financiar, negociar o preço, travar na bolsa, vender ou guardar), e simulador de hedge.
- **Notícias:** agronegócio, mercado e mercado internacional.
- **TV Agro:** canais do agro ao vivo pelo player oficial do YouTube (Canal Rural, Canal do Boi, Notícias Agrícolas e Embrapa), com a marcação de quem está no ar e os vídeos recentes de cada um quando não há transmissão. A lista de canais fica em `src/canaisAgro.js`.
- **Evolução:** comparação de qual item subiu mais (o visitante escolhe em cascata entre Chicago, Nova Iorque, commodities do Brasil e ações, até 6 itens), gráficos e tabela de preços de 2020 a 2026 e histórico de ações.
- **Glossário** com os termos do mercado.
- **Castor:** assistente que responde dúvidas dos alunos sobre o mercado. Por enquanto está em construção (`EM_CONSTRUCAO` em `src/components/AssistenteAgro.jsx`): responde só que está em construção, sem chamar o Apps Script, e os atalhos para perguntar a ele ficam escondidos.


---

Projeto em React + Vite, hospedado na Vercel. Notas técnicas abaixo.

## Cotações e Selic

- `npm run dev`: inclui `/api/market` no Vite para testar localmente.
- A Selic vem da série SGS 432 do Banco Central, em % ao ano, com data de referência. A consulta ocorre ao abrir e nos ciclos de 60 segundos do painel; o servidor permite cache de 5 minutos. Em falhas, mantém a última taxa recebida e sinaliza a atualização pendente.
- Reservas para quando o SGS falha (`server/indicadores.js`; em outubro de 2026 ele chegou a ficar 30 s sem responder): a meta da Selic vem da lista de decisões do Copom no site do Banco Central, e IPCA (mensal e 12 meses) e INPC vêm direto do IBGE (SIDRA). Fonte e reserva são consultadas ao mesmo tempo, com limite de 6 s para o SGS. IGP-M, CDI e poupança não têm reserva aberta.
- O navegador guarda o último valor recebido de cada indicador e da Selic (`agroinfo.indicadores.v1`); quando a fonte falha, o quadro mostra esse valor com o aviso "último valor recebido", em vez de "Indisponível".
- Ações/ETFs: digite o nome da empresa (ex.: "Petrobras") e escolha uma sugestão da busca na BRAPI, ou informe o código direto (ex.: PETR4) e clique em Consultar. PETR4, VALE3, ITUB4 e MGLU3 são exemplos sem autenticação na BRAPI. Para outros ativos, configure `BRAPI_TOKEN` no `.env.local` e no ambiente do servidor Vercel, conforme seu plano. A chave nunca é enviada ao navegador.
- Commodities: digite o nome (ex.: "soja", "café", "boi") e aperte Enter ou clique em Adicionar para exibir o valor; também é possível navegar pela lista de indicadores brasileiros e contratos internacionais abaixo. As tabelas oficiais de incorporação do Notícias Agrícolas exibem sua própria fonte, unidade e data. As seleções ficam neste navegador. As tabelas dependem da disponibilidade e das restrições do provedor; há link direto se a incorporação for bloqueada.
- Pausar interrompe os ciclos automáticos do painel. Consultar uma ação e o botão de atualização continuam disponíveis.
- As demais taxas econômicas e o histórico preexistente continuam sendo referências fixas. Moedas ainda usam a lógica anterior de estimativa/simulação em falhas.
- `npm run build` gera o frontend; a hospedagem precisa executar também `api/market.js`. Um servidor apenas estático (inclusive `vite preview`) não fornece essa API.

Fontes: https://dadosabertos.bcb.gov.br/dataset/432-taxa-de-juros---meta-selic-definida-pelo-copom, https://brapi.dev/docs/acoes e https://www.noticiasagricolas.com.br/widgets/.

## Visual de jornal

- O site inteiro segue o formato de jornal clássico, com as cores do campo: cabeçalho em verde com o enfeite (`src/components/Enfeite.jsx`, losango do meio cor de trigo), o nome em letras grandes e a data entre dois fios; texto com serifa; cantos retos, sem sombra, e um fio verde no alto de cada quadro; fundo claro em degradê. As regras ficam em `src/index.css`, na classe `jornal`, que o `App.jsx` põe no cabeçalho, no menu, nas abas e no rodapé.
- Os painéis mantêm as cores de cada assunto (moedas em azul, indicadores em roxo, tabelas das bolsas e do histórico em verde, combustíveis em laranja, chuva e safra em azul). No Resumo do dia, cada casa do quadro de cotações tem um fio de cor (dólar azul, Chicago verde, preços da região cor de trigo, diesel laranja) e a previsão do tempo fica num quadro azul-claro. O mapa de preços das Cotações Cooperativas é um semáforo (verde paga mais, vermelho paga menos). Só a folha do Jornal do dia continua em preto e branco, para imprimir.
- O mascote (Castor) e o contador de visitantes ficam fora da classe `jornal` e mantêm o visual próprio.
- A prévia que aparece quando alguém manda o link (WhatsApp, redes sociais) é `public/compartilhar.png`, feita a partir de `scripts/compartilhar.html`.
- Cada aba, menos o Resumo do dia, é baixada só quando é aberta (`lazy` no `App.jsx`); a biblioteca de gráficos vem junto com as abas que a usam.
- A tabela e o gráfico da aba Evolução vêm de `src/historicoCepea.json`: médias anuais dos indicadores do CEPEA/ESALQ desde 2020, geradas por `scripts/historico-cepea.py`. A rotina `.github/workflows/historico-cepea.yml` roda o script toda segunda-feira e publica se algo mudou.

## Anúncios (preparação)

- Páginas exigidas pelo Google AdSense: `public/sobre.html` (o que é o site, fontes, contato) e `public/privacidade.html` (LGPD, cookies e anúncios), servidas em `/sobre` e `/privacidade` (`cleanUrls` no `vercel.json`) e ligadas no rodapé.
- `src/components/Anuncios.jsx`: aviso de cookies e espaços de anúncio. Ficam desligados enquanto não houver `VITE_ADSENSE_CLIENT` (código "ca-pub-…") na hospedagem; com ele, o aviso aparece uma vez e o script do AdSense só carrega depois da escolha ("Só os necessários" → anúncios não personalizados). Os espaços com a etiqueta "Publicidade" aparecem com `VITE_ADSENSE_SLOT`; sem ele, valem os anúncios automáticos. Não há anúncio na TV Agro nem na folha do Jornal.
- Antes de ligar os anúncios: a hospedagem precisa permitir uso comercial (o plano gratuito da Vercel não permite), e as fontes de uso só não comercial (Open-Meteo, feeds do Google Notícias) precisam ser trocadas.

## Jornal do dia

- Usa os mesmos dados do Resumo do dia (`src/components/useResumoDoDia.js`). Esses dados se atualizam sozinhos a cada 10 minutos, quando a página volta à tela depois de mais de 5 minutos escondida e pelo botão "Atualizar agora"; a previsão do tempo, a cada hora. As atualizações automáticas aceitam a cópia que o servidor guarda por alguns minutos; o botão pede com `agora=<hora>` no endereço, o que faz o servidor ir de novo às fontes. A legenda das cotações diz a hora da cotação de Chicago e a data do boletim do DERAL. As notícias da folha são organizadas por `organizarNoticias` (`src/inicio.js`): cada uma ganha uma rubrica pelo título (Pecuária, Grãos, Câmbio…), a folha não repete assunto nem notícia parecida, e a coluna Economia só traz assuntos que mexem com o agro. A folha leva a data e a hora da atualização mais recente. O PDF sai pela impressão do navegador: na impressão, o cabeçalho, o menu, o mascote e o contador somem (classes `print:` do Tailwind) e a folha é A4 (`@page` em `src/index.css`).
- A imagem é gerada no próprio navegador pela biblioteca `html2canvas`, baixada só quando alguém pede, e sai em formato de página inteira também no celular (a folha é desenhada como em tela larga). Em `src/index.css` há uma regra para a imagem de teste que ela usa: sem essa regra, o estilo base do Tailwind faz o texto sair deslocado para baixo na imagem.
- A cidade da previsão é a última escolhida no Resumo do dia, no Jornal ou na aba Clima (fica lembrada no navegador). O Open-Meteo passa por momentos em que responde "sobrecarregado": cada pedido é repetido 4 vezes (`src/clima.js`), o Resumo e o Jornal pedem de novo sozinhos por mais 2 minutos e, enquanto isso, usam a previsão do dia que o navegador já tinha recebido.

## Exportações prontas

- `scripts/dados-exportacoes.mjs` busca no Comex Stat os dados da aba Exportações e o comércio com os 20 países da lista que está no começo do script, e grava tudo em `public/dados/exportacoes/`. A aba lê esses arquivos antes de ir à fonte, então abre na hora; país fora da lista continua sendo buscado na hora, pela API.
- Cada arquivo guarda de que mês é (`mesDaFonte`) e quando foi gerado (`geradoEm`). O script só refaz o que falta ou é de mês anterior; arquivo com mais de 45 dias deixa de valer e a aba volta a consultar a fonte.
- Para atualizar à mão: `node scripts/dados-exportacoes.mjs` e depois enviar a pasta `public/dados` para o repositório.

## Cotações de outros estados

- **Rio Grande do Sul:** a Emater/RS-Ascar publica às quintas o PDF "Cotações Agropecuárias". `scripts/precos-rs.py` (Python + pypdf) acha o boletim mais recente na página de preços semanais, lê o resumo do estado (página 1), a comparação com semana, mês e ano anteriores (página 2) e a tabela por município (páginas seguintes, pela posição das colunas), e grava `public/dados/precos-rs.json`. Conferência: o preço de um município tem de ficar entre o mínimo e o máximo do estado; se muitos ficarem fora, a tabela por município é descartada e fica só o resumo. A rotina `.github/workflows/precos-rs.yml` roda todo dia às 19h e só envia quando sai boletim novo. O site da Emater não responde a acessos de fora do Brasil e a rotina roda nos Estados Unidos, então ela baixa o PDF por `/api/market?type=emater` (`server/emater.js`), que só entrega o último boletim da página da Emater.
- **Mato Grosso:** `server/imea.js` lê os indicadores do IMEA no mesmo endereço que as páginas de indicadores do IMEA usam (`/api/market?type=mt`, guardado por 30 minutos). O IMEA não publica termos de uso; antes de ligar anúncios, confirmar com o instituto se o uso no site é permitido (como o CEPEA).
- As funções do site (`api/`) rodam em São Paulo (`"regions": ["gru1"]` no `vercel.json`; o plano gratuito da Vercel permite uma região só). Antes rodavam nos Estados Unidos, de onde o site da Emater não abre; as outras fontes foram testadas de São Paulo e respondem igual.
- **Mato Grosso do Sul:** `server/famasul.js` lê a página "Cotações online" do Sistema Famasul (uma tabela por produto, com título: @Boi, @Vaca, Saca - Milho, Saca - Soja). Fica a data mais recente; a variação de cada praça é calculada sobre a cotação anterior dela; boi e vaca trazem também o valor com Funrural (`/api/market?type=ms`).
- **São Paulo:** `server/iea.js` consulta os "Preços recebidos" do banco de dados do IEA, que é um formulário: abre a página (chave do formulário e cookie) e pede cada um dos últimos 5 dias úteis (o intervalo de datas só devolve o primeiro dia). Cada dia só traz as regionais (EDRs) que informaram; fica o preço mais recente de cada regional, com a data. O IEA não dá a média do estado nessa consulta (`/api/market?type=sp`).
- O Paraná continua em `src/components/CotacoesCooperativas.jsx`; os outros estados ficam em `src/components/CotacoesEstados.jsx` (Rio Grande do Sul em componente próprio; os de cotação diária num só, com os textos de cada fonte em `ESTADOS_DIARIOS`). O estado escolhido fica lembrado no navegador.

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
