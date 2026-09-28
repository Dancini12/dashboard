/**
 * Assistente de dúvidas do AgroInfo (Castor responde).
 *
 * Web App do Google Apps Script que recebe a pergunta do aluno e os dados de
 * cotação exibidos no painel, consulta o Gemini (nível gratuito do Google AI
 * Studio) e devolve uma explicação didática.
 *
 * Memória do Castor: as perguntas e respostas ficam na planilha. Uma pergunta
 * igual ou muito parecida a outra já respondida é atendida pela memória, sem
 * gastar o Gemini: respostas automáticas valem no mesmo dia (podem citar números
 * do dia); as que o professor marcar como "aprovada" valem sempre.
 *
 * - A chave fica em Propriedades do Script com o nome GEMINI_API_KEY.
 * - Sem a ferramenta google_search: a resposta se baseia só nos dados enviados.
 * - Entrada (POST, corpo JSON em text/plain): { pergunta, dadosDashboard, historico }
 * - Saída: { resposta, origem: 'memoria' | 'gemini' } ou { erro }
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

// Memória do Castor (abas criadas automaticamente na planilha)
const ABA_MEMORIA = 'Memória do Castor';
const ABA_PERGUNTAS = 'Perguntas dos alunos';
const SITUACOES_MEMORIA = ['automática', 'aprovada', 'não usar'];
const SIMILARIDADE_MINIMA = 0.75; // parcela de palavras em comum para reaproveitar
const FUSO_CASTOR = 'America/Sao_Paulo';
const PALAVRAS_VAZIAS = {};
('o a os as um uma uns umas de da do das dos em no na nos nas num numa por pelo pela pelos pelas ' +
  'para pra pro pros com e ou que qual quais quem como onde quando porque pq se me mim te ti lhe eu tu ' +
  'voce voces ele ela eles elas isso isto esse essa esses essas este esta estes estas aquele aquela ' +
  'ao aos sao ser foi era sobre entre ja tambem so mas meu minha seu sua oi ola castor favor')
  .split(' ').forEach(function (p) { PALAVRAS_VAZIAS[p] = true; });

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

/**
 * Valida a entrada e responde: primeiro pela memória (só perguntas que abrem a
 * conversa, porque as seguintes dependem do contexto), senão pelo Gemini.
 * Registra tudo na planilha; falhas na planilha nunca impedem a resposta.
 */
function responderPergunta(corpo) {
  const pergunta = String((corpo && corpo.pergunta) || '').trim().slice(0, MAX_PERGUNTA);
  if (!pergunta) return { erro: 'Digite uma pergunta.' };

  const avulsa = !(corpo && Array.isArray(corpo.historico) && corpo.historico.length);
  const chave = avulsa ? chaveDaPergunta(pergunta) : '';

  let lembrada = null;
  if (chave) {
    try {
      lembrada = buscarNaMemoria(chave);
    } catch (err) {
      console.warn('Memória indisponível: ' + err);
    }
  }
  if (lembrada) {
    registrarNaMemoria({ pergunta: pergunta, origem: 'memória', linhaUsada: lembrada.linha });
    return { resposta: lembrada.resposta, origem: 'memoria' };
  }

  const resultado = consultarGemini(pergunta, corpo);
  if (resultado.resposta) {
    registrarNaMemoria({ pergunta: pergunta, origem: 'Gemini', chave: chave, resposta: resultado.resposta });
    return { resposta: resultado.resposta, origem: 'gemini' };
  }
  registrarNaMemoria({ pergunta: pergunta, origem: 'erro', detalhe: resultado.erro });
  return resultado;
}

/** Monta a conversa e consulta o Gemini. Devolve { resposta } ou { erro }. */
function consultarGemini(pergunta, corpo) {
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

// ---------------------------------------------------------------- memória

/** Palavras que importam na pergunta: sem acentos, pontuação, palavras vazias e plural simples. */
function palavrasDaPergunta(texto) {
  const vistas = {};
  String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').split(' ')
    .forEach(function (p) {
      if (!p || PALAVRAS_VAZIAS[p]) return;
      vistas[p.length > 4 && /s$/.test(p) ? p.slice(0, -1) : p] = true;
    });
  return Object.keys(vistas).sort();
}

function chaveDaPergunta(texto) {
  return palavrasDaPergunta(texto).join(' ');
}

/** Palavras em comum sobre o total (Jaccard); só compara perguntas com 2+ palavras. */
function similaridadeDasPerguntas(a, b) {
  if (a.length < 2 || b.length < 2) return 0;
  const emB = {};
  b.forEach(function (p) { emB[p] = true; });
  const comuns = a.filter(function (p) { return emB[p]; }).length;
  return comuns / (a.length + b.length - comuns);
}

function diaEmSaoPaulo(data) {
  return Utilities.formatDate(data, FUSO_CASTOR, 'yyyy-MM-dd');
}

/**
 * Procura na memória uma pergunta igual ou parecida. Vale se estiver "aprovada"
 * ou se for "automática" de hoje. A chave é recalculada a partir da coluna
 * Pergunta, então o professor pode reescrever a pergunta para ampliar o uso.
 */
function buscarNaMemoria(chave) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_MEMORIA);
  if (!aba || aba.getLastRow() < 2) return null;
  const hoje = diaEmSaoPaulo(new Date());
  const alvo = chave.split(' ');
  let melhor = null;
  aba.getRange(2, 1, aba.getLastRow() - 1, 4).getValues().forEach(function (linha, i) {
    const resposta = String(linha[1] || '').trim();
    const situacao = linha[3];
    if (!resposta || situacao === 'não usar') return;
    const aprovada = situacao === 'aprovada';
    if (!aprovada && !(linha[2] instanceof Date && diaEmSaoPaulo(linha[2]) === hoje)) return;
    const outra = chaveDaPergunta(linha[0]);
    if (!outra) return;
    const sim = outra === chave ? 1 : similaridadeDasPerguntas(alvo, outra.split(' '));
    if (sim < SIMILARIDADE_MINIMA) return;
    if (!melhor || sim > melhor.sim || (sim === melhor.sim && aprovada && !melhor.aprovada)) {
      melhor = { linha: i + 2, resposta: resposta, sim: sim, aprovada: aprovada };
    }
  });
  return melhor;
}

/**
 * Registra a pergunta e, quando veio do Gemini, guarda a resposta na memória:
 * renova a linha automática da mesma pergunta ou cria uma nova. Linhas
 * "aprovada" e "não usar" são decisão do professor e não são alteradas.
 */
function registrarNaMemoria(info) {
  try {
    const trava = LockService.getScriptLock();
    if (!trava.tryLock(10000)) {
      console.warn('Planilha ocupada; registro ignorado.');
      return;
    }
    try {
      const agora = new Date();
      abaPerguntas().appendRow([agora, textoSemFormula(info.pergunta), info.origem, textoSemFormula(info.detalhe || '')]);
      const memoria = abaMemoria();
      if (info.linhaUsada) {
        const usos = memoria.getRange(info.linhaUsada, 5);
        usos.setValue((Number(usos.getValue()) || 0) + 1);
      }
      if (info.chave && info.resposta) {
        const total = memoria.getLastRow() - 1;
        const linhas = total > 0 ? memoria.getRange(2, 1, total, 4).getValues() : [];
        for (let i = 0; i < linhas.length; i++) {
          if (chaveDaPergunta(linhas[i][0]) !== info.chave) continue;
          if (!linhas[i][3] || linhas[i][3] === 'automática') {
            memoria.getRange(i + 2, 2, 1, 3).setValues([[textoSemFormula(info.resposta), agora, 'automática']]);
          }
          return;
        }
        memoria.appendRow([textoSemFormula(info.pergunta), textoSemFormula(info.resposta), agora, 'automática', 0]);
      }
    } finally {
      trava.releaseLock();
    }
  } catch (err) {
    console.warn('Falha ao gravar na planilha: ' + err);
  }
}

/** Texto digitado pelo aluno nunca vira fórmula na planilha. */
function textoSemFormula(texto) {
  const t = String(texto || '');
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

function abaMemoria() {
  return obterAbaDoCastor(ABA_MEMORIA, ['Pergunta', 'Resposta', 'Data', 'Situação', 'Usos da memória'], function (aba) {
    aba.setColumnWidth(1, 280);
    aba.setColumnWidth(2, 560);
    aba.setColumnWidth(3, 140);
    aba.setColumnWidth(4, 110);
    aba.getRange('B:B').setWrap(true);
    aba.getRange('D2:D').setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(SITUACOES_MEMORIA, true).setAllowInvalid(false).build());
  });
}

function abaPerguntas() {
  return obterAbaDoCastor(ABA_PERGUNTAS, ['Data', 'Pergunta', 'Origem da resposta', 'Detalhe'], function (aba) {
    aba.setColumnWidth(1, 140);
    aba.setColumnWidth(2, 420);
    aba.setColumnWidth(3, 130);
  });
}

function obterAbaDoCastor(nome, cabecalho, preparar) {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  let aba = planilha.getSheetByName(nome);
  if (!aba) {
    aba = planilha.insertSheet(nome);
    aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]).setFontWeight('bold');
    aba.setFrozenRows(1);
    preparar(aba);
  }
  return aba;
}

// ---------------------------------------------------------------- utilidades

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
  else console.log('Funcionou! Resposta ' + (resultado.origem === 'memoria' ? 'da memória' : 'do Gemini') + ':\n' + resultado.resposta);
  return resultado;
}

/**
 * Teste da memória: faz a mesma pergunta duas vezes. A segunda deve vir da
 * memória. Cria as abas "Memória do Castor" e "Perguntas dos alunos" se faltarem.
 */
function testarMemoria() {
  const corpo = { pergunta: 'O que é o indicador CEPEA?', dadosDashboard: {}, historico: [] };
  const primeira = responderPergunta(corpo);
  const segunda = responderPergunta(corpo);
  console.log('1ª resposta: ' + (primeira.origem || primeira.erro) + ' | 2ª resposta: ' + (segunda.origem || segunda.erro));
  if (segunda.origem === 'memoria') console.log('Memória funcionando! Veja as abas "' + ABA_MEMORIA + '" e "' + ABA_PERGUNTAS + '".');
  else console.error('A segunda resposta não veio da memória.');
  return segunda;
}
