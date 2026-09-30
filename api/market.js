/* global process, Buffer */
import lerPlanilha from 'read-excel-file/node';

export default async function handler(req, res) {
  const { type, symbol = '', q = '' } = req.query ?? {};

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
        .map(item => ({ symbol: item.stock, name: item.name }));
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
      return res.status(200).json({ results });
    } catch {
      return res.status(502).json({ error: 'Busca indisponível. Tente novamente.' });
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
          ? 'Este ativo exige acesso autorizado na BRAPI. Configure BRAPI_TOKEN no servidor. PETR4, VALE3, ITUB4 e MGLU3 podem ser consultados sem chave.'
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
        ? 'Este ativo exige acesso autorizado na BRAPI. Configure BRAPI_TOKEN no servidor. PETR4, VALE3, ITUB4 e MGLU3 podem ser consultados sem chave.'
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
  return comoArquivo ? Buffer.from(await response.arrayBuffer()) : response.text();
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
  const abas = await lerPlanilha(await buscar(arquivo, true));
  const doArquivo = arquivo.match(/(\d{2}-\d{2}-\d{4})/)?.[1];
  const aba = abas.find(a => a.sheet === doArquivo) || abas.find(a => /^\d{2}-\d{2}-\d{4}$/.test(a.sheet));
  if (!aba) throw new Error('aba do dia não encontrada');
  return { ...lerCotacaoParana(aba.data), arquivo };
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
