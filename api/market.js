/* global process, Buffer */
import lerPlanilha from 'read-excel-file/node';
import { dadosDeSafra } from '../server/safra.js';
import { combustiveisDoParana } from '../server/combustiveis.js';
import { canaisAoVivo } from '../server/tv.js';
import { exportacoesPorProduto, destinosDasExportacoes, LimiteDePedidos } from '../server/exportacoes.js';

// Ativos liberados sem chave na BRAPI; com BRAPI_TOKEN no servidor, o plano define o resto.
const ATIVOS_LIVRES = ['PETR4', 'VALE3', 'ITUB4', 'MGLU3'];
const MSG_ATIVO_RESTRITO = 'Este ativo não está liberado no plano gratuito da nossa fonte de cotações da Bolsa (BRAPI). '
  + 'Sem chave, dá para consultar PETR4, VALE3, ITUB4 e MGLU3.';
const FONTE_FUTUROS = 'Yahoo Finance · cotação indicativa';

// Contratos agrícolas das bolsas de Chicago (CBOT e CME) e de Nova Iorque (ICE): contrato contínuo →
// raiz do código, sufixo da bolsa no Yahoo, letras dos meses em que há vencimento e, quando o
// contrato termina antes de o mês começar (açúcar), quantos meses pular. Deve acompanhar a lista
// FUTURES do src/catalogo.js.
const LETRAS_DOS_MESES = 'FGHJKMNQUVXZ'; // janeiro a dezembro
const BOLSAS = {
  'ZS=F': ['ZS', 'CBT', 'FHKNQUX'], 'ZC=F': ['ZC', 'CBT', 'HKNUZ'], 'ZW=F': ['ZW', 'CBT', 'HKNUZ'],
  'KE=F': ['KE', 'CBT', 'HKNUZ'], 'ZM=F': ['ZM', 'CBT', 'FHKNQUVZ'], 'ZL=F': ['ZL', 'CBT', 'FHKNQUVZ'],
  'ZO=F': ['ZO', 'CBT', 'HKNUZ'], 'ZR=F': ['ZR', 'CBT', 'FHKNUX'],
  'KC=F': ['KC', 'NYB', 'HKNUZ'], 'SB=F': ['SB', 'NYB', 'HKNV', 1], 'CT=F': ['CT', 'NYB', 'HKNVZ'],
  'CC=F': ['CC', 'NYB', 'HKNUZ'], 'OJ=F': ['OJ', 'NYB', 'FHKNUX'],
  'LE=F': ['LE', 'CME', 'GJMQVZ'], 'GF=F': ['GF', 'CME', 'FHJKQUVX'], 'HE=F': ['HE', 'CME', 'GJKMNQVZ'],
  'DC=F': ['DC', 'CME', LETRAS_DOS_MESES],
};
const FUTUROS_AGRO = new Set(Object.keys(BOLSAS));
const VENCIMENTOS_EXIBIDOS = 4;
const DIAS_SEM_NEGOCIO = 3; // vencimento parado há mais tempo que isso (em relação ao mais recente) fica de fora
const MESES_EM_INGLES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Último preço de um contrato no Yahoo, com a variação contra o pregão anterior.
async function cotacaoFutura(symbol) {
  const response = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`, {
    signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'Mozilla/5.0 AgroInfo/1.0' },
  });
  if (!response.ok) throw new Error('future source failed');
  const data = await response.json();
  const result = data?.chart?.result?.[0];
  const meta = result?.meta;
  const value = meta?.regularMarketPrice;
  if (!Number.isFinite(value) || !Number.isFinite(meta?.regularMarketTime)) throw new Error('invalid future quote');
  // variação do dia: a da própria fonte, que compara com o pregão anterior do mesmo vencimento.
  // Sem ela, usa os fechamentos (chartPreviousClose é o de antes dos 5 dias); no contrato contínuo,
  // o fechamento anterior pode ser de outro vencimento no dia da troca de mês.
  const fechamentos = (result?.indicators?.quote?.[0]?.close ?? []).filter(Number.isFinite);
  const previous = fechamentos.length >= 2 ? fechamentos.at(-2) : meta?.previousClose;
  const change = Number.isFinite(meta.regularMarketChangePercent) ? meta.regularMarketChangePercent
    : Number.isFinite(previous) && previous !== 0 ? ((value - previous) / previous) * 100 : 0;
  return { symbol, value, change, date: meta.regularMarketTime, currency: meta.currency, exchange: meta.fullExchangeName || meta.exchangeName,
    high: meta.regularMarketDayHigh ?? null, low: meta.regularMarketDayLow ?? null, nome: meta.shortName ?? '' };
}

// Fechamentos mensais do contrato contínuo desde 2020, no mesmo formato do histórico das ações.
async function historicoFuturo(symbol) {
  const response = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1mo&period1=${Date.UTC(2020, 0, 1) / 1000}&period2=${Math.floor(Date.now() / 1000)}`, {
    signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0 AgroInfo/1.0' },
  });
  if (!response.ok) throw new Error('future history failed');
  const result = (await response.json())?.chart?.result?.[0];
  const fechamentos = result?.indicators?.quote?.[0]?.close ?? [];
  const points = (result?.timestamp ?? [])
    .map((t, i) => ({ date: new Date(t * 1000).toISOString().slice(0, 10), close: fechamentos[i] }))
    .filter(p => Number.isFinite(p.close) && p.date >= '2020-01-01');
  if (!points.length) throw new Error('no points since 2020');
  return { symbol, name: result.meta?.shortName || symbol, currency: result.meta?.currency ?? 'USD', points, source: 'Yahoo Finance' };
}

// Séries do Banco Central (SGS) dos indicadores do Painel: variação mensal em % (IPCA, INPC, IGP-M),
// IPCA acumulado em 12 meses, CDI em % ao ano e rendimento mensal da poupança.
const SERIES_BCB = { ipca: 433, ipca12: 13522, inpc: 188, igpm: 189, cdi: 4389, poupanca: 195 };

// Último valor de uma série. O serviço às vezes devolve resposta vazia: tenta mais uma vez.
async function serieDoBancoCentral(codigo) {
  for (let tentativa = 0; ; tentativa++) {
    try {
      const response = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados/ultimos/1?formato=json`, { signal: AbortSignal.timeout(8000) });
      const linha = response.ok ? (await response.json())?.at?.(-1) : null;
      const valor = Number(linha?.valor);
      if (!linha?.data || linha.valor === '' || !Number.isFinite(valor)) throw new Error('série vazia');
      return { valor, data: linha.data };
    } catch (erro) {
      if (tentativa >= 1) throw erro;
    }
  }
}

// O contrato contínuo traz o vencimento no nome ("Soybean Futures,Nov-2026"). Quando o ano
// vem cortado ("…,Dec-2"), vale o próximo mês com esse nome a partir de hoje.
function vencimentoDoNome(nome, hoje) {
  const [, abreviado, ano] = nome.match(/,\s*([A-Za-z]{3})-(\d{4})?/) ?? [];
  const mes = MESES_EM_INGLES.indexOf(abreviado?.toLowerCase()) + 1;
  if (!mes) return null;
  return { mes, ano: ano ? Number(ano) : hoje.getUTCFullYear() + (mes < hoje.getUTCMonth() + 1 ? 1 : 0) };
}

// Próximos meses de vencimento de um produto, a partir do mês atual.
function proximosVencimentos([raiz, bolsa, letras, pular = 0], hoje, quantos) {
  const lista = [];
  for (let i = pular; lista.length < quantos && i < 36; i++) {
    const data = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + i, 1));
    const letra = LETRAS_DOS_MESES[data.getUTCMonth()];
    if (!letras.includes(letra)) continue;
    const contrato = `${raiz}${letra}${String(data.getUTCFullYear()).slice(-2)}`;
    lista.push({ contrato, simbolo: `${contrato}.${bolsa}`, mes: data.getUTCMonth() + 1, ano: data.getUTCFullYear() });
  }
  return lista;
}

async function cotacoesDasBolsas(symbol) {
  const hoje = new Date();
  if (symbol) {
    // um candidato a mais: o contrato do mês atual pode já ter vencido e sumido da fonte
    const candidatos = proximosVencimentos(BOLSAS[symbol], hoje, VENCIMENTOS_EXIBIDOS + 1);
    const respostas = await Promise.allSettled(candidatos.map(c => cotacaoFutura(c.simbolo)));
    const comCotacao = candidatos
      .map(({ contrato, mes, ano }, i) => (respostas[i].status === 'fulfilled'
        ? { contrato, mes, ano, value: respostas[i].value.value, change: respostas[i].value.change, date: respostas[i].value.date }
        : null))
      .filter(Boolean);
    // contrato em fim de vida, sem negócio há dias, traz preço velho: fica de fora
    const maisRecente = Math.max(...comCotacao.map(v => v.date));
    const vencimentos = comCotacao.filter(v => maisRecente - v.date <= DIAS_SEM_NEGOCIO * 86400).slice(0, VENCIMENTOS_EXIBIDOS);
    if (!vencimentos.length) throw new Error('sem vencimentos');
    return { symbol, vencimentos, source: FONTE_FUTUROS };
  }
  const respostas = await Promise.allSettled(Object.keys(BOLSAS).map(cotacaoFutura));
  const contratos = respostas.filter(r => r.status === 'fulfilled')
    .map(({ value: { symbol, value, change, date, high, low, nome } }) => ({ symbol, value, change, date, high, low, vencimento: vencimentoDoNome(nome, hoje) }));
  if (!contratos.length) throw new Error('sem cotações');
  return { contratos, source: FONTE_FUTUROS, consultadoEm: hoje.toISOString() };
}

export default async function handler(req, res) {
  const { type, symbol = '', q = '', parte = '' } = req.query ?? {};

  if (type === 'future') {
    if (!FUTUROS_AGRO.has(symbol)) return res.status(400).json({ error: 'Contrato futuro não reconhecido.' });
    try {
      const { value, change, date, currency, exchange } = await cotacaoFutura(symbol);
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
      return res.status(200).json({ symbol, value, change, date, currency, exchange, source: FONTE_FUTUROS });
    } catch {
      return res.status(502).json({ error: 'Cotação futura temporariamente indisponível. Tente novamente em alguns minutos.' });
    }
  }

  if (type === 'bolsas' || type === 'chicago') { // "chicago": nome antigo, de páginas ainda abertas
    if (symbol && !FUTUROS_AGRO.has(symbol)) return res.status(400).json({ error: 'Contrato futuro não reconhecido.' });
    try {
      const cotacoes = await cotacoesDasBolsas(symbol);
      res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
      return res.status(200).json(cotacoes);
    } catch {
      return res.status(502).json({ error: 'Cotações das bolsas temporariamente indisponíveis. Tente novamente em alguns minutos.' });
    }
  }

  if (type === 'indicadores') {
    const respostas = await Promise.allSettled(Object.values(SERIES_BCB).map(serieDoBancoCentral));
    const indicadores = Object.fromEntries(Object.keys(SERIES_BCB).map((nome, i) => [nome, respostas[i].status === 'fulfilled' ? respostas[i].value : null]));
    if (!Object.values(indicadores).some(Boolean)) return res.status(502).json({ error: 'Indicadores do Banco Central indisponíveis no momento.' });
    // completo: vale por 6 horas; faltando algum, tenta de novo em 5 minutos
    res.setHeader('Cache-Control', Object.values(indicadores).every(Boolean) ? 's-maxage=21600, stale-while-revalidate=86400' : 's-maxage=300');
    return res.status(200).json({ indicadores, source: 'Banco Central · SGS' });
  }

  if (type === 'exportacoes') {
    if (parte !== 'produtos' && parte !== 'destinos') return res.status(400).json({ error: 'Informe a parte: produtos ou destinos.' });
    try {
      const dados = await (parte === 'produtos' ? exportacoesPorProduto() : destinosDasExportacoes());
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800'); // a fonte atualiza uma vez por mês
      return res.status(200).json(dados);
    } catch (erro) {
      // a fonte aceita um pedido a cada 10 segundos: o site tenta de novo sozinho
      if (erro instanceof LimiteDePedidos) return res.status(503).json({ error: 'A fonte das exportações pediu para aguardar alguns segundos.', tentarEm: 11 });
      return res.status(502).json({ error: 'Dados de exportação indisponíveis no momento.' });
    }
  }

  if (type === 'combustiveis') {
    try {
      const combustiveis = await combustiveisDoParana();
      res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400'); // a ANP publica uma vez por semana
      return res.status(200).json(combustiveis);
    } catch {
      return res.status(502).json({ error: 'Preços da ANP indisponíveis no momento.' });
    }
  }

  if (type === 'tv') {
    try {
      const tv = await canaisAoVivo();
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120'); // transmissão começa e acaba a qualquer hora
      return res.status(200).json(tv);
    } catch {
      return res.status(502).json({ error: 'Programação do YouTube indisponível no momento.' });
    }
  }

  if (type === 'safra') {
    try {
      const safra = await dadosDeSafra();
      // completo: vale por 12 horas (as fontes mudam uma vez por mês); faltando alguma, tenta de novo em 10 minutos
      res.setHeader('Cache-Control', safra.parana && safra.municipio && safra.brasil ? 's-maxage=43200, stale-while-revalidate=86400' : 's-maxage=600');
      return res.status(200).json(safra);
    } catch {
      return res.status(502).json({ error: 'Dados de safra indisponíveis no momento.' });
    }
  }

  if (type === 'pr') {
    try {
      const cotacao = await cotacaoDiariaParana();
      res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
      return res.status(200).json(cotacao);
    } catch {
      return res.status(502).json({ error: 'Cotação do DERAL indisponível no momento.' });
    }
  }

  if (type === 'search') {
    const term = q.trim();
    if (!term || term.length > 40) {
      return res.status(400).json({ error: 'Digite ao menos 2 letras do nome da empresa.' });
    }
    try {
      const response = await fetch(`https://brapi.dev/api/quote/list?search=${encodeURIComponent(term)}&limit=15`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('search failed');
      const data = await response.json();
      const seen = new Set();
      const results = (data?.stocks ?? [])
        .filter(item => item.stock && !item.stock.endsWith('F'))
        .filter(item => {
          if (seen.has(item.stock)) return false;
          seen.add(item.stock);
          return true;
        })
        .slice(0, 6)
        .map(item => ({ symbol: item.stock, name: item.name, restrito: !process.env.BRAPI_TOKEN && !ATIVOS_LIVRES.includes(item.stock) }))
        .sort((a, b) => a.restrito - b.restrito);
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
      return res.status(200).json({ results });
    } catch {
      return res.status(502).json({ error: 'Busca indisponível. Tente novamente.' });
    }
  }

  if (type === 'history' && FUTUROS_AGRO.has(symbol)) {
    try {
      const historico = await historicoFuturo(symbol);
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');
      return res.status(200).json(historico);
    } catch {
      return res.status(502).json({ error: 'Não foi possível obter o histórico desde 2020 deste contrato. Tente novamente.' });
    }
  }

  if (type === 'history') {
    if (!/^[A-Z]{4}[0-9]{1,2}$/.test(symbol)) {
      return res.status(400).json({ error: 'Informe um código válido, como PETR4 ou BOVA11.' });
    }
    try {
      const response = await fetch(`https://brapi.dev/api/quote/${encodeURIComponent(symbol)}?range=10y&interval=1mo`, {
        signal: AbortSignal.timeout(15000),
        headers: process.env.BRAPI_TOKEN ? { Authorization: `Bearer ${process.env.BRAPI_TOKEN}` } : {},
      });
      if (!response.ok) {
        const restricted = [401, 403].includes(response.status);
        return res.status(restricted ? 403 : 502).json({ error: restricted
          ? MSG_ATIVO_RESTRITO
          : 'Histórico indisponível ou ativo não encontrado. Tente novamente.' });
      }
      const data = await response.json();
      const row = data?.results?.find(item => item.symbol === symbol);
      const series = row?.historicalDataPrice;
      if (!Array.isArray(series) || !series.length || !row?.currency) throw new Error('Invalid history');
      const points = series
        .filter(p => Number.isFinite(p.close) && Number.isFinite(p.date))
        .map(p => ({ date: new Date(p.date * 1000).toISOString().slice(0, 10), close: p.close }))
        .filter(p => p.date >= '2020-01-01')
        .sort((a, b) => a.date.localeCompare(b.date));
      if (!points.length) throw new Error('No points since 2020');
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');
      return res.status(200).json({ symbol, name: row.longName || row.shortName || symbol, currency: row.currency, points, source: 'BRAPI' });
    } catch {
      return res.status(502).json({ error: 'Não foi possível obter o histórico desde 2020 para este ativo. Tente novamente.' });
    }
  }

  if (type !== 'selic' && (type !== 'stock' || !/^[A-Z]{4}[0-9]{1,2}$/.test(symbol))) {
    return res.status(400).json({ error: 'Informe um código válido, como PETR4 ou BOVA11.' });
  }
  const url = type === 'selic'
    ? 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json'
    : `https://brapi.dev/api/quote/${encodeURIComponent(symbol)}`;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: type === 'stock' && process.env.BRAPI_TOKEN ? { Authorization: `Bearer ${process.env.BRAPI_TOKEN}` } : {},
    });
    if (!response.ok) {
      const restricted = type === 'stock' && [401, 403].includes(response.status);
      return res.status(restricted ? 403 : 502).json({ error: restricted
        ? MSG_ATIVO_RESTRITO
        : 'Fonte indisponível ou ativo não encontrado. Tente novamente.' });
    }
    const data = await response.json();
    let result;
    if (type === 'selic') {
      const row = data?.[0];
      if (!row?.data || !row.valor || !Number.isFinite(Number(row.valor))) throw new Error('Invalid Selic');
      result = { value: Number(row.valor), date: row.data, source: 'Banco Central · SGS 432' };
    } else {
      const row = data?.results?.find(item => item.symbol === symbol);
      if (!Number.isFinite(row?.regularMarketPrice) || !row?.regularMarketTime || !row?.currency) throw new Error('Invalid quote');
      result = { symbol, name: row.longName || row.shortName || symbol, value: row.regularMarketPrice,
        change: row.regularMarketChangePercent, currency: row.currency, date: row.regularMarketTime, source: 'BRAPI' };
    }
    res.setHeader('Cache-Control', `s-maxage=${type === 'selic' ? 300 : 60}, stale-while-revalidate=60`);
    return res.status(200).json(result);
  } catch {
    return res.status(502).json({ error: 'Não foi possível obter uma cotação válida. Tente novamente.' });
  }
}

// ---------------------------------------------------------------- Paraná (DERAL/SEAB)

const DERAL = 'https://www.agricultura.pr.gov.br';
const UA_AGROINFO = 'Mozilla/5.0 (compatible; AgroInfo-CEEPA/1.0; +https://agroinfo-dashboard.vercel.app)';

async function buscar(url, comoArquivo = false) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': UA_AGROINFO } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!comoArquivo) return response.text();
  // a data de modificação do arquivo é a hora em que o DERAL publicou a planilha
  const modificado = Date.parse(response.headers?.get?.('last-modified') ?? '');
  return { conteudo: Buffer.from(await response.arrayBuffer()), publicadoEm: Number.isFinite(modificado) ? new Date(modificado).toISOString() : null };
}

// Cotação diária do SIMA (DERAL/SEAB-PR): boletim mais recente → planilha do dia → tabela.
async function cotacaoDiariaParana() {
  const lista = await buscar(`${DERAL}/Cotacao-Diaria-SIMA`);
  const ids = [...lista.matchAll(/\/Pagina\/Cotacao-Diaria-SIMA-(\d+)/g)].map(m => Number(m[1]));
  if (!ids.length) throw new Error('nenhum boletim');
  const boletim = await buscar(`${DERAL}/Pagina/Cotacao-Diaria-SIMA-${Math.max(...ids)}`);
  const caminho = boletim.match(/href="([^"]+\.xlsx)"/i)?.[1];
  if (!caminho) throw new Error('boletim sem planilha');
  const arquivo = new URL(caminho.replace(/&amp;/g, '&'), DERAL).href;
  const { conteudo, publicadoEm } = await buscar(arquivo, true);
  const abas = await lerPlanilha(conteudo);
  const doArquivo = arquivo.match(/(\d{2}-\d{2}-\d{4})/)?.[1];
  const aba = abas.find(a => a.sheet === doArquivo) || abas.find(a => /^\d{2}-\d{2}-\d{4}$/.test(a.sheet));
  if (!aba) throw new Error('aba do dia não encontrada');
  return { ...lerCotacaoParana(aba.data), arquivo, publicadoEm, consultadoEm: new Date().toISOString() };
}

const REGIOES_ABREVIADAS = { 'C,PROCÓPIO': 'Cornélio Procópio', 'F,BELTRÃO': 'Francisco Beltrão', 'LARANJ, SUL': 'Laranjeiras do Sul' };
const PALAVRAS_MINUSCULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
const nomeDaRegiao = texto => REGIOES_ABREVIADAS[texto] || texto.toLowerCase().split(/\s+/)
  .map((p, i) => (i && PALAVRAS_MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ');
const textoDa = v => (v == null ? '' : String(v)).trim();
// número; "sinf" (sem informação); "aus" (ausente); null (praça não pesquisada)
const celula = v => (typeof v === 'number' ? v : ({ SINF: 'sinf', AUS: 'aus' })[textoDa(v).toUpperCase()] ?? null);
const numero = v => (typeof v === 'number' ? v : null);

// Lê a aba do dia: cabeçalho "PRODUTOS" com as regiões e, para cada produto, as
// linhas MIN, M_C (preço mais comum) e MÁX; na linha M_C, a média do estado de hoje,
// a do dia anterior e a variação.
export function lerCotacaoParana(linhas) {
  const data = linhas.slice(0, 3).flat().map(textoDa).find(v => /^\d{2}\/\d{2}\/\d{4}$/.test(v)) ?? null;
  const iCabecalho = linhas.findIndex(l => /^PRODUTOS/i.test(textoDa(l[0])));
  if (iCabecalho < 0) throw new Error('cabeçalho não encontrado');
  const cabecalho = linhas[iCabecalho].map(textoDa);
  const colunas = [];
  for (let c = 2; c < cabecalho.length && cabecalho[c] && !/^(m[ée]dia|var)/i.test(cabecalho[c]); c++) colunas.push(c);
  const iMedia = cabecalho.findIndex(v => /^m[ée]dia/i.test(v));
  const iVariacao = cabecalho.findIndex(v => /^var/i.test(v));

  const produtos = [];
  for (let i = iCabecalho + 1; i < linhas.length - 2; i++) {
    const [min, comum, max] = [linhas[i], linhas[i + 1], linhas[i + 2]];
    if (textoDa(min[1]).toUpperCase() !== 'MIN' || !textoDa(min[0])) continue;
    if (textoDa(comum[1]).toUpperCase() !== 'M_C' || !/^M[ÁA]X/i.test(textoDa(max[1]))) continue;
    const [nome, unidade = ''] = textoDa(min[0]).split(/\s{2,}/);
    const precos = colunas.map(c => ({ min: celula(min[c]), comum: celula(comum[c]), max: celula(max[c]) }));
    if (!precos.some(p => typeof p.comum === 'number')) continue; // pesquisa descontinuada
    produtos.push({
      nome, unidade, precos,
      mediaEstado: iMedia >= 0 ? numero(comum[iMedia]) : null,
      mediaAnterior: iMedia >= 0 ? numero(comum[iMedia + 1]) : null,
      variacaoPct: iVariacao >= 0 ? numero(comum[iVariacao]) : null,
    });
  }
  if (!produtos.length) throw new Error('nenhum produto');
  return {
    data,
    fonte: 'DERAL/SEAB-PR · SIMA',
    titulo: 'Cotação de compra pelos atacadistas paranaenses',
    regioes: colunas.map(c => nomeDaRegiao(cabecalho[c])),
    produtos,
  };
}
