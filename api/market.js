/* global process */
export default async function handler(req, res) {
  const { type, symbol = '', q = '' } = req.query ?? {};

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

  if (type === 'commodity') {
    // Mesma tabela exibida no painel (widget do Notícias Agrícolas), em JSON para o assistente.
    const { id = '' } = req.query ?? {};
    if (!/^\d{1,4}$/.test(id)) {
      return res.status(400).json({ error: 'Commodity inválida.' });
    }
    try {
      const response = await fetch(`https://www.noticiasagricolas.com.br/widgets/cotacoes?id=${id}`, {
        signal: AbortSignal.timeout(10000),
        // o site recusa o agente padrão do Node; identifica o AgroInfo de forma explícita
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AgroInfo-CEEPA/1.0; +https://agroinfo-dashboard.vercel.app)' },
      });
      if (!response.ok) throw new Error('widget failed');
      const tabela = lerTabelaCotacao(await response.text());
      if (!tabela.titulo || !tabela.linhas.length) throw new Error('empty widget');
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
      return res.status(200).json({ id, ...tabela, source: 'Notícias Agrícolas' });
    } catch {
      return res.status(502).json({ error: 'Cotação da commodity indisponível no momento.' });
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

const ENTIDADES = { amp: '&', nbsp: ' ', quot: '"', '#39': "'", lt: '<', gt: '>' };
const textoLimpo = html => html
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&(amp|nbsp|quot|#39|lt|gt);/g, (_, e) => ENTIDADES[e])
  .replace(/\s+/g, ' ')
  .trim();

// Lê a tabela do widget de cotações: título, fonte, colunas, linhas e rodapé (data do fechamento).
export function lerTabelaCotacao(html) {
  const cabecalho = html.match(/<div class="na-titulo">([\s\S]*?)<\/div>/)?.[1] ?? '';
  const fonte = textoLimpo(cabecalho.match(/<span class="na-fonte">([\s\S]*?)<\/span>/)?.[1] ?? '').replace(/^Fonte:\s*/i, '');
  const titulo = textoLimpo(cabecalho.replace(/<span class="na-fonte">[\s\S]*?<\/span>/, ''));
  const rotulos = html.match(/<tr class="na-rotulo">([\s\S]*?)<\/tr>/)?.[1] ?? '';
  const colunas = [...rotulos.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(m => textoLimpo(m[1]));
  const corpo = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
  const linhas = [...corpo.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    .map(m => [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c => textoLimpo(c[1])))
    .filter(celulas => celulas.some(Boolean));
  const rodape = textoLimpo(html.match(/<tfoot>([\s\S]*?)<\/tfoot>/)?.[1] ?? '');
  return { titulo, fonte, colunas, linhas, rodape };
}
