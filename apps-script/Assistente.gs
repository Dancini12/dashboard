/**
 * Assistente de dúvidas do AgroInfo (Castor responde).
 *
 * Web App do Google Apps Script que recebe a pergunta do aluno e os dados de
 * cotação exibidos no painel, consulta o Gemini (nível gratuito do Google AI
 * Studio) e devolve uma explicação didática.
 *
 * - A chave fica em Propriedades do Script com o nome GEMINI_API_KEY.
 * - Sem a ferramenta google_search: a resposta se baseia só nos dados enviados.
 * - Entrada (POST, corpo JSON em text/plain): { pergunta, dadosDashboard, historico }
 * - Saída: { resposta } ou { erro }
 *
 * Passo a passo de implantação: apps-script/LEIA-ME.md no repositório do AgroInfo.
 */

const MODELO = 'gemini-3.8-flash';
const URL_GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODELO + ':generateContent';

const MAX_PERGUNTA = 500;          // caracteres
const MAX_HISTORICO = 6;           // últimas mensagens da conversa
const MAX_TEXTO_HISTORICO = 1500;  // caracteres por mensagem do histórico
const MAX_DADOS = 12000;           // caracteres do JSON de cotações
const MAX_TOKENS_RESPOSTA = 600;

const MSG_LIMITE = 'Muitas perguntas agora. Aguarde alguns segundos e tente de novo.';
const MSG_INDISPONIVEL = 'O assistente está indisponível agora. Tente de novo em instantes.';
const MSG_CONFIGURACAO = 'O assistente está com um problema de configuração. Avise o professor.';
const MSG_BLOQUEADA = 'Não consigo responder a essa pergunta. Que tal perguntar sobre as cotações do painel?';

const INSTRUCAO_SISTEMA = [
  'Você é um professor de agronegócio que explica cotações agrícolas para alunos de um curso técnico em agropecuária no norte do Paraná. Regras:',
  '- Responda em português do Brasil, com linguagem simples, didática e respostas curtas (até 3 parágrafos).',
  '- Use os dados de cotação fornecidos como fonte principal e cite os números quando for relevante.',
  '- Explique conceitos: oferta e demanda, câmbio, Bolsa de Chicago (CBOT), indicador CEPEA/ESALQ, safra e entressafra, preço físico x preço futuro, praças regionais.',
  '- Se a pergunta depender de uma notícia recente que não está nos dados, diga que não tem essa informação e sugira consultar o Notícias Agrícolas ou o CEPEA.',
  '- Nunca invente números nem notícias.',
  '- Não faça recomendação de compra, venda ou investimento; o foco é educativo.',
  '- Recuse com educação perguntas fora do tema de agronegócio e economia agrícola.',
  '',
  'Sobre os dados: eles chegam em JSON junto com a pergunta e são os que o aluno vê no painel AgroInfo.',
  'Cada cotação traz a data do fechamento; ao citar um preço, diga a que data ele se refere.',
  'Se a commodity perguntada não estiver nos dados, diga que ela não aparece no painel agora.',
  'Escreva em texto corrido; use no máximo **negrito** para destacar números, sem títulos nem tabelas.',
].join('\n');

/** Recebe a pergunta do painel e devolve { resposta } ou { erro }. */
function doPost(e) {
  let corpo;
  try {
    corpo = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return responderJson({ erro: 'Requisição inválida.' });
  }
  return responderJson(responderPergunta(corpo));
}

/** Abrir a URL do Web App no navegador mostra que ele está no ar. */
function doGet() {
  return responderJson({ status: 'ok', mensagem: 'Assistente AgroInfo no ar. Envie as perguntas por POST.' });
}

/** Valida a entrada, monta a conversa e consulta o Gemini. */
function responderPergunta(corpo) {
  const pergunta = String((corpo && corpo.pergunta) || '').trim().slice(0, MAX_PERGUNTA);
  if (!pergunta) return { erro: 'Digite uma pergunta.' };

  const chave = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!chave) {
    console.error('GEMINI_API_KEY não está nas Propriedades do Script.');
    return { erro: MSG_CONFIGURACAO };
  }

  const dados = JSON.stringify((corpo && corpo.dadosDashboard) || {}).slice(0, MAX_DADOS);
  const contents = montarHistorico(corpo && corpo.historico);
  contents.push({
    role: 'user',
    parts: [{ text: 'Dados do painel AgroInfo agora (JSON):\n' + dados + '\n\nPergunta do aluno: ' + pergunta }],
  });

  const payload = {
    systemInstruction: { parts: [{ text: INSTRUCAO_SISTEMA }] },
    contents: contents,
    generationConfig: {
      maxOutputTokens: MAX_TOKENS_RESPOSTA,
      temperature: 0.4,
      // Sem "raciocínio" interno: os tokens vão todos para a resposta e ela sai mais rápido.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  let resposta;
  try {
    resposta = UrlFetchApp.fetch(URL_GEMINI, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-goog-api-key': chave },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
  } catch (err) {
    console.error('Falha de rede ao chamar o Gemini: ' + err);
    return { erro: MSG_INDISPONIVEL };
  }

  const codigo = resposta.getResponseCode();
  const texto = resposta.getContentText();
  if (codigo === 429) return { erro: MSG_LIMITE };
  if (codigo !== 200) {
    console.error('Gemini respondeu HTTP ' + codigo + ': ' + texto.slice(0, 500));
    return { erro: [400, 401, 403, 404].indexOf(codigo) >= 0 ? MSG_CONFIGURACAO : MSG_INDISPONIVEL };
  }

  let json;
  try {
    json = JSON.parse(texto);
  } catch (err) {
    console.error('Resposta do Gemini não é JSON: ' + texto.slice(0, 500));
    return { erro: MSG_INDISPONIVEL };
  }

  const candidato = json.candidates && json.candidates[0];
  const partes = (candidato && candidato.content && candidato.content.parts) || [];
  const respostaTexto = partes.map(function (p) { return p.text || ''; }).join('').trim();
  if (!respostaTexto) {
    console.warn('Sem texto na resposta: ' + JSON.stringify(json.promptFeedback || (candidato && candidato.finishReason)));
    return { erro: MSG_BLOQUEADA };
  }
  return { resposta: respostaTexto };
}

/**
 * Converte o histórico do painel ({ autor: 'aluno' | 'assistente', texto }) para o
 * formato do Gemini, mantendo só as últimas mensagens, começando por uma do aluno
 * e alternando os papéis.
 */
function montarHistorico(historico) {
  const lista = Array.isArray(historico) ? historico.slice(-MAX_HISTORICO) : [];
  const contents = [];
  lista.forEach(function (msg) {
    const texto = String((msg && msg.texto) || '').trim().slice(0, MAX_TEXTO_HISTORICO);
    if (!texto) return;
    const role = msg.autor === 'assistente' ? 'model' : 'user';
    if (!contents.length && role === 'model') return;
    const ultima = contents[contents.length - 1];
    if (ultima && ultima.role === role) ultima.parts[0].text += '\n' + texto;
    else contents.push({ role: role, parts: [{ text: texto }] });
  });
  // a pergunta atual entra como mensagem do aluno; o histórico precisa terminar no assistente
  if (contents.length && contents[contents.length - 1].role === 'user') contents.pop();
  return contents;
}

function responderJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Teste pelo editor: selecione "testarGemini" e clique em Executar.
 * O resultado aparece no Registro de execução.
 */
function testarGemini() {
  const resultado = responderPergunta({
    pergunta: 'O que é o indicador CEPEA e o que significa a variação percentual?',
    dadosDashboard: {
      commodities: [{
        titulo: 'Indicador da Soja Cepea/Esalq - Paraná',
        fonte: 'Cepea/Esalq',
        colunas: ['Data', 'Valor R$/ Saca de 60 kg', 'Variação (%)'],
        linhas: [['25/09/2026', '154,38', '-0,47%']],
        rodape: 'Fech. 25/09/2026',
      }],
      moedas: [{ nome: 'Dólar Comercial', valor: 5.2, variacaoPct: -0.1 }],
    },
    historico: [],
  });
  if (resultado.erro) console.error('Falhou: ' + resultado.erro);
  else console.log('Funcionou! Resposta do Gemini:\n' + resultado.resposta);
  return resultado;
}
