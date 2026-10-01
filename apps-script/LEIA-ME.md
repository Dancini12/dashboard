# Assistente de dúvidas do AgroInfo (Castor responde)

O castor do painel responde dúvidas dos alunos em um balão de diálogo. A pergunta vai
para um **Web App do Google Apps Script** (`Assistente.gs`), que consulta o **Gemini no
nível gratuito** (modelo definido na constante `MODELO`, hoje `gemini-3.8-flash`) e devolve
uma explicação baseada nas cotações do painel. Se o modelo principal estiver sobrecarregado,
lento, sem cota ou indisponível, o script tenta na hora o **modelo reserva**
(`MODELO_RESERVA`, hoje `gemini-flash-lite-latest`, mais leve e com cota própria).

**Situação atual:** implantado no projeto do Apps Script da planilha do AgroInfo, arquivo
`Assistente.gs`, com a chave do projeto "AgroInfo Gratuito" (nível gratuito, sem
faturamento). A URL do Web App já está configurada em `src/App.jsx`.

```
Aluno ── pergunta ──> Castor (site) ── pergunta + cotações do painel ──> Apps Script ──> Gemini
                           ^                                                  │
                           └──────────────── { resposta } ou { erro } ────────┘
```

- **Custo zero:** use uma chave do Google AI Studio em um projeto **sem faturamento**.
  Se o limite gratuito acabar, o Gemini recusa (erro 429) e o aluno vê
  "Muitas perguntas agora. Aguarde alguns segundos e tente de novo." Nada é cobrado.
- **A chave nunca aparece no site:** ela fica nas Propriedades do Script.
- **Sem busca na internet:** o assistente só usa os dados enviados pelo painel.
  Notícias do dia ele não sabe; nesse caso indica o Notícias Agrícolas ou o CEPEA.

## Memória do Castor: ele aprende com as perguntas

O Castor guarda na planilha o que os alunos perguntam e as respostas. Quando alguém repete
uma pergunta, ou faz uma muito parecida, ele responde pela memória, sem gastar o Gemini.
No balão, essas respostas aparecem com a marca **💾 Da memória do Castor**.

As duas abas são criadas sozinhas na primeira pergunta:

| Aba | O que tem |
|---|---|
| **Perguntas dos alunos** | Toda pergunta feita, com data e a origem da resposta: `memória`, `Gemini` ou `erro`. É o retrato do que os alunos pesquisam. |
| **Memória do Castor** | Uma linha por pergunta diferente: Pergunta, Resposta, Data, Situação e quantas vezes a memória foi usada. |

Como o Castor decide:

- Só a **primeira pergunta de cada conversa** usa e alimenta a memória. As seguintes
  ("e o milho?") dependem do que foi dito antes e vão sempre ao Gemini.
- Ele compara as palavras que importam, ignorando acentos, pontuação e palavras como
  "o", "que", "de". Reaproveita quando a pergunta é igual ou tem pelo menos 75% das
  palavras em comum.
- A coluna **Situação** diz por quanto tempo uma resposta vale:
  - `automática` (padrão): vale **só no mesmo dia**, porque a resposta pode citar números
    do dia, como o dólar. No dia seguinte, a primeira pessoa que perguntar recebe uma
    resposta nova do Gemini, que substitui a antiga.
  - `aprovada`: vale **sempre**. Use nas respostas de conceito (CEPEA, safra e entressafra,
    Chicago…). Antes de aprovar, apague da resposta números que envelhecem.
  - `não usar`: a memória ignora essa pergunta e ela vai sempre ao Gemini.

O que você pode fazer na aba **Memória do Castor**:

- **Aprovar** boas respostas, trocando a Situação para `aprovada`.
- **Corrigir** o texto de uma resposta. O Castor passa a usar a sua versão.
- **Ensinar outro jeito de perguntar:** copie a linha e reescreva a coluna Pergunta
  (por exemplo, "O que quer dizer CEPEA?"), mantendo a mesma resposta.
- **Bloquear** uma resposta ruim com `não usar`.
- Não apague a primeira linha (cabeçalho) nem mude a ordem das colunas.

Para acompanhar o aprendizado, esta fórmula em qualquer célula mostra a parcela das
perguntas respondidas pela memória:

```
=CONT.SE('Perguntas dos alunos'!C:C;"memória")/(CONT.VALORES('Perguntas dos alunos'!C:C)-1)
```

**Privacidade:** as perguntas ficam na planilha da escola, e o balão avisa os alunos
("As perguntas ficam guardadas para o Castor aprender").

## Online agora

O quadro de visitantes (canto inferior direito) mostra quantas pessoas estão com o site
aberto. Enquanto a aba está visível, cada navegador manda um sinal de presença a cada
45 s para este mesmo Web App (`{ acao: "presenca", sessao }`); quem ficou 90 s sem sinal
sai da contagem, e quem fecha o site avisa na hora. Várias abas no mesmo navegador contam
como uma pessoa. A contagem fica no cache do Apps Script, sem gravar nada na planilha.
Enquanto o Apps Script não tiver essa função, a linha "Online agora" simplesmente não
aparece.

Navegadores controlados por automação (testes, robôs) não somam no total de visitantes.

## Dados que o painel envia junto com cada pergunta

| Dado | Origem |
|---|---|
| Dólar, euro, libra e peso (só quando a cotação é real, não estimada) | AwesomeAPI |
| Meta Selic | Banco Central |
| IPCA, INPC, IGP-M, CDI e poupança | valores de referência fixos do painel |
| Tabela Histórico 2020–2026 | tabela do painel |

**Preços do dia das commodities não vão para o assistente.** No painel eles aparecem em
tabelas do Notícias Agrícolas, e tanto o Notícias Agrícolas quanto o CEPEA bloqueiam a
leitura automática (proteção Cloudflare). O painel avisa isso ao assistente, que explica o
conceito e pede ao aluno que confira o preço e a variação na seção "Consultar commodity".

## Passo a passo

### 1. Criar a chave do Gemini (gratuita)

1. Acesse <https://aistudio.google.com/apikey> com a conta Google da escola.
2. Clique em **Criar chave de API** e escolha (ou crie) um projeto.
3. Confira que o projeto está no **nível gratuito (Free tier)**, sem faturamento ativado.
   Não ative o faturamento: é isso que garante custo zero.
4. Copie a chave. Não publique essa chave em lugar nenhum.

### 2. Colar o código no Apps Script

1. Abra a planilha do AgroInfo no Google Sheets.
2. Menu **Extensões → Apps Script**.
3. O `Código.gs` do projeto guarda outro script da planilha: não mexa nele. Crie um arquivo
   novo em **Arquivos → + → Script**, chamado **Assistente**, e cole nele todo o conteúdo de
   [`Assistente.gs`](Assistente.gs). Se o projeto estiver vazio, pode usar o próprio
   `Código.gs`.
4. Clique em **Salvar projeto** (ícone de disquete).

### 3. Salvar a chave em Propriedades do Script (item a)

1. No editor do Apps Script, clique em **Configurações do projeto** (ícone de engrenagem,
   na barra da esquerda).
2. Role até **Propriedades do script** e clique em **Adicionar propriedade do script**.
3. Preencha:
   - **Propriedade:** `GEMINI_API_KEY`
   - **Valor:** a chave copiada no passo 1
4. Clique em **Salvar propriedades do script**.

### 4. Testar pelo editor

1. Volte ao editor (ícone `< >`).
2. Na barra de cima, escolha a função **testarGemini** e clique em **Executar**.
3. Na primeira vez o Google pede autorização: **Revisar permissões** → escolha a conta →
   **Avançado** → **Acessar (não seguro)** → **Permitir**. O aviso aparece porque o
   script é seu e não passou por verificação do Google; é esperado.
4. No **Registro de execução** deve aparecer `Funcionou! Resposta do Gemini:` e a explicação.
   Se aparecer `Falhou: ...`, veja "Se algo der errado" no fim desta página.
5. Selecione **testarMemoria** e clique em **Executar**. Ele faz a mesma pergunta duas vezes;
   deve aparecer `Memória funcionando!`, e as abas "Memória do Castor" e "Perguntas dos
   alunos" surgem na planilha. Na primeira vez o Google pede autorização para o script
   acessar a planilha.
6. Selecione **testarReserva** e clique em **Executar**. Deve aparecer `Reserva (...)
   funcionando:` e uma frase. Se falhar, rode **listarModelos**: ele mostra os modelos que a
   chave pode usar; troque `MODELO_RESERVA` por um modelo "flash-lite" da lista.
7. Selecione **testarPresenca** e clique em **Executar**. Deve aparecer
   `Online: 1 → 2 → depois que as duas saem: 0` (os números podem ser maiores se houver
   gente com o site aberto).

### 5. Implantar como App da Web (item b)

1. Clique em **Implantar → Nova implantação**.
2. Em **Selecionar tipo** (engrenagem), escolha **App da Web**.
3. Preencha:
   - **Descrição:** Assistente AgroInfo
   - **Executar como:** **Eu** (seu e-mail)
   - **Quem pode acessar:** **Qualquer pessoa**
4. Clique em **Implantar** (autorize de novo, se pedir).

### 6. Copiar a URL do Web App (item c)

- Ao terminar a implantação aparece a **URL do app da Web**, que termina em `/exec`.
  Clique em **Copiar**.
- Para achar de novo depois: **Implantar → Gerenciar implantações**.

### 7. Testar a URL (item d)

1. Abra a URL no navegador. Deve aparecer:
   `{"status":"ok","mensagem":"Assistente AgroInfo no ar. Envie as perguntas por POST."}`
2. Teste uma pergunta pelo Terminal (troque `URL_DO_WEB_APP`):

   ```sh
   curl -L -H "Content-Type: text/plain;charset=utf-8" \
     -d '{"pergunta":"O que é o indicador CEPEA?","dadosDashboard":{},"historico":[]}' \
     "URL_DO_WEB_APP"
   ```

   A saída deve ser `{"resposta":"..."}`.

### 8. Ligar o assistente no site

A URL atual já está como valor padrão de `ASSISTENTE_URL` em `src/App.jsx`. A variável
`VITE_ASSISTENTE_URL`, se definida, tem prioridade. Sem nenhuma URL, o botão
"Tire sua dúvida" não aparece. Para usar outra URL (por exemplo, depois de uma nova
implantação, que muda o endereço):

- **Na Vercel:** projeto *agroinfo-dashboard* → **Settings → Environment Variables** →
  adicione `VITE_ASSISTENTE_URL` com a URL do Web App (ambiente *Production*) → salve →
  em **Deployments**, faça **Redeploy** do último deploy. A variável entra no site na hora
  do build, por isso o redeploy é necessário.
- **Ou no código:** cole a URL como valor padrão de `ASSISTENTE_URL` em `src/App.jsx`.
- **Para testar no computador:** crie `.env.local` com `VITE_ASSISTENTE_URL=URL_DO_WEB_APP`
  e rode `npm run dev`.

## Como o componente se encaixa no painel

O balão é o componente `src/components/AssistenteAgro.jsx` (estilos em
`AssistenteAgro.css`). O mascote o abre quando o aluno clica no castor ou em
"Tire sua dúvida". O `App.jsx` passa a URL e os dados que estão na tela:

```jsx
<Mascote
  onFechar={() => setMascote(false)}
  assistenteUrl={ASSISTENTE_URL}
  dadosPainel={{
    moedas: dataSource === "real"
      ? moedas.map(m => ({ nome: m.nome, valorReais: m.valor, variacaoPct: m.var, fonte: "AwesomeAPI" }))
      : "indisponíveis no momento",
    selic: selic.value != null ? { metaPctAoAno: selic.value, data: selic.date, fonte: selic.source } : "indisponível",
    indicadores: indicadores.filter(i => i.nome !== "Selic").map(i => ({ nome: i.nome, valor: i.valor, periodo: i.periodo, descricao: i.desc, fonte: "Banco Central" })),
    historicoAnual: { descricao: "Tabela Histórico 2020–2026 do painel (CEPEA/ESALQ, Farmnews; R$ nominais)", linhas: HISTORICO },
  }}
/>
```

Dentro do mascote:

```jsx
<AssistenteAgro url={assistenteUrl} dadosDashboard={dadosPainel} aberto={conversa}
  onFechar={alternarConversa} onPensando={setPensando} />
```

No momento da pergunta, o `AssistenteAgro` envia `{ pergunta, dadosDashboard, historico }`
com `Content-Type: text/plain;charset=utf-8`, o que evita o preflight de CORS que o Apps
Script não atende. Se o Gemini estiver sobrecarregado (503), o site tenta de novo uma vez.

## Atualizar o código do Apps Script depois

Depois de mudar o `Assistente.gs`, a URL só passa a usar o código novo com uma nova versão:
**Implantar → Gerenciar implantações** → lápis (**Editar**) → **Versão: Nova versão** →
**Implantar**. Assim a URL continua a mesma. Se o código novo usar algo que ainda não foi
autorizado (como a planilha, na versão com memória), rode antes `testarMemoria` pelo editor
para dar a autorização.

Para trocar de modelo (por exemplo, se o Google aposentar o modelo atual), mude a
constante `MODELO` no início do arquivo e publique uma nova versão. O `gemini-2.5-flash`
já não está disponível para projetos novos; por isso o modelo atual é o `gemini-3.8-flash`.

## Se algo der errado

| O aluno vê | Causa provável | O que fazer |
|---|---|---|
| "Muitas perguntas agora…" | Limite gratuito por minuto ou por dia atingido | Esperar. Os limites atuais aparecem no AI Studio. |
| "…problema de configuração. Avise o professor." | Chave ausente, com nome errado ou inválida; modelo indisponível | Confira `GEMINI_API_KEY` (passo 3) e rode `testarGemini`. Veja o erro em **Execuções**, na barra da esquerda. |
| "O assistente está indisponível agora…" | Principal e reserva sobrecarregados ao mesmo tempo (erro 503, comum em horários de pico) ou falha de rede | Tentar de novo em instantes. Em **Execuções** aparece o código de erro de cada modelo. |
| "Não consegui falar com o assistente…" | URL errada, implantação sem acesso "Qualquer pessoa" ou sem internet | Abra a URL no navegador (passo 7). |

**Privacidade:** no nível gratuito, o Google pode usar as conversas para melhorar seus
produtos. Por isso o balão mostra o aviso para não digitar dados pessoais.

**Uso da cota:** a URL do Web App é pública. Quem tiver a URL consegue fazer perguntas e
gastar a cota gratuita (nunca dinheiro). Se houver abuso, crie uma nova implantação (a URL
muda) ou gere outra chave no AI Studio.
