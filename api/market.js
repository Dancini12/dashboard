/* global process */

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function stripTags(value = '') {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ccedil;/g, 'ç')
    .replace(/&atilde;/g, 'ã').replace(/&otilde;/g, 'õ').replace(/&ecirc;/g, 'ê')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extrai só os campos de texto do widget de cotações (Notícias Agrícolas/CEPEA);
// nunca repassamos o HTML bruto ao cliente, então não há risco de injeção.
function parseCommodityWidget(html) {
  if (!html.includes('na-cotacoes') || html.includes('challenge-error-text')) return null;
  const tituloMatch = html.match(/<div class="na-titulo">([\s\S]*?)<\/div>/);
  let titulo = '', fonte = '';
  if (tituloMatch) {
    const block = tituloMatch[1];
    const fonteMatch = block.match(/<span class="na-fonte">([\s\S]*?)<\/span>/);
    fonte = fonteMatch ? stripTags(fonteMatch[1]).replace(/^Fonte:\s*/i, '') : '';
    titulo = stripTags(block.replace(/<span class="na-fonte">[\s\S]*?<\/span>/, ''));
  }
  const headerRowMatch = html.match(/<tr class="na-rotulo">([\s\S]*?)<\/tr>/);
  const headers = headerRowMatch
    ? [...headerRowMatch[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(m => stripTags(m[1]))
    : [];
  const bodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  const rows = [];
  if (bodyMatch) {
    for (const rowMatch of bodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => stripTags(m[1]));
      if (cells.length) rows.push(cells);
    }
  }
  const fechMatch = html.match(/Fech\.\s*([\d/]+)/);
  if (!headers.length || !rows.length) return null;
  return { titulo, fonte, headers, rows, fechamento: fechMatch ? fechMatch[1] : null };
}

export default async function handler(req, res) {
  const { type, symbol = '', q = '', id = '' } = req.query ?? {};

  if (type === 'commodity') {
    if (!/^\d{1,6}$/.test(id)) return res.status(400).json({ error: 'Identificador inválido.' });
    try {
      const response = await fetch(`https://www.noticiasagricolas.com.br/widgets/cotacoes?id=${id}&fonte=Arial&largura=100%25`, {
        signal: AbortSignal.timeout(12000),
        headers: { 'User-Agent': BROWSER_UA },
      });
      if (!response.ok) throw new Error('widget fetch failed');
      const parsed = parseCommodityWidget(await response.text());
      if (!parsed) return res.status(502).json({ error: 'Fonte indisponível ou tabela em formato inesperado.' });
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=120');
      return res.status(200).json(parsed);
    } catch {
      return res.status(502).json({ error: 'Não foi possível obter a cotação. Tente novamente.' });
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
