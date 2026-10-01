import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/market.js';

async function call(query) {
  const res = { code: 200, status(code) { this.code = code; return this; }, setHeader() {}, json(data) { this.data = data; return this; } };
  await handler({ query }, res);
  return res;
}
test('rejeita ticker inválido antes de acessar a fonte', async () => {
  const res = await call({ type: 'stock', symbol: '../secret' });
  assert.equal(res.code, 400);
});
test('consulta a meta Selic anual, preservando a data da fonte', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    assert.match(url, /sgs\.432\/dados\/ultimos\/1/);
    return { ok: true, json: async () => [{ data: '16/09/2026', valor: '14.00' }] };
  });
  const res = await call({ type: 'selic' });
  assert.equal(res.data.value, 14);
  assert.equal(res.data.date, '16/09/2026');
});
test('rejeita respostas vazias em vez de fabricar preços', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => [] }));
  assert.equal((await call({ type: 'selic' })).code, 502);
  assert.equal((await call({ type: 'stock', symbol: 'PETR4' })).code, 502);
});
test('sinaliza autorização ausente para ações restritas', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 401 }));
  const res = await call({ type: 'stock', symbol: 'BBAS3' });
  assert.equal(res.code, 403);
  assert.match(res.data.error, /plano gratuito/);
  assert.doesNotMatch(res.data.error, /BRAPI_TOKEN/, 'aluno não vê instrução técnica');
});
test('mantém preço, moeda e horário informados pela BRAPI', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ results: [{ symbol: 'PETR4', regularMarketPrice: 50.43, currency: 'BRL', regularMarketTime: '2026-09-15T20:00:00Z' }] }) }));
  const res = await call({ type: 'stock', symbol: 'PETR4' });
  assert.equal(res.code, 200);
  assert.equal(res.data.value, 50.43);
  assert.equal(res.data.currency, 'BRL');
});
test('lê a cotação diária do DERAL (Paraná) a partir do boletim mais recente', async t => {
  const { readFileSync } = await import('node:fs');
  const planilha = readFileSync(new URL('./fixtures/sima-exemplo.xlsx', import.meta.url));
  const pedidos = [];
  t.mock.method(globalThis, 'fetch', async url => {
    pedidos.push(url);
    if (url.endsWith('/Cotacao-Diaria-SIMA')) {
      return { ok: true, text: async () => '<a href="/Pagina/Cotacao-Diaria-SIMA-2701">x</a><a href="/Pagina/Cotacao-Diaria-SIMA-2702">x</a>' };
    }
    if (url.endsWith('/Pagina/Cotacao-Diaria-SIMA-2702')) {
      return { ok: true, text: async () => '<a href="/sites/default/arquivos_restritos/files/documento/2026-09/29-09-2026-impressao.xlsx">planilha</a>' };
    }
    return {
      ok: true,
      headers: { get: nome => (nome === 'last-modified' ? 'Tue, 29 Sep 2026 14:51:57 GMT' : null) },
      arrayBuffer: async () => planilha.buffer.slice(planilha.byteOffset, planilha.byteOffset + planilha.byteLength),
    };
  });
  const res = await call({ type: 'pr' });
  assert.equal(res.code, 200);
  assert.equal(pedidos.length, 3);
  assert.match(pedidos[2], /29-09-2026-impressao\.xlsx$/);
  assert.equal(res.data.data, '29/09/2026');
  assert.deepEqual(res.data.regioes, ['Apucarana', 'Cornélio Procópio', 'Laranjeiras do Sul', 'União da Vitória']);
  assert.deepEqual(res.data.produtos.map(p => p.nome), ['Soja industrial tipo 1', 'Boi em pé'], 'arroz sem preços fica de fora');
  const soja = res.data.produtos[0];
  assert.equal(soja.unidade, 'sc 60 Kg');
  assert.deepEqual(soja.precos[1], { min: 139, comum: 140, max: 141 });
  assert.deepEqual(soja.precos[2], { min: 'sinf', comum: 'sinf', max: 'sinf' });
  assert.deepEqual([soja.mediaEstado, soja.mediaAnterior, soja.variacaoPct], [139.5, 139.2, 0.22]);
  assert.equal(res.data.publicadoEm, '2026-09-29T14:51:57.000Z', 'hora de publicação vem da data do arquivo');
  assert.ok(!Number.isNaN(Date.parse(res.data.consultadoEm)));
});
test('sinaliza falha do DERAL em vez de inventar cotação', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503 }));
  const res = await call({ type: 'pr' });
  assert.equal(res.code, 502);
  assert.match(res.data.error, /DERAL/);
});
test('marca nas sugestões os ativos que precisam de chave, com os livres primeiro', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ stocks: [
    { stock: 'SOJA3', name: 'BOA SAFRA SEMENTES S.A.' }, { stock: 'PETR4', name: 'Petrobras PN' },
  ] }) }));
  const res = await call({ type: 'search', q: 'soja' });
  assert.deepEqual(res.data.results.map(r => [r.symbol, r.restrito]), [['PETR4', false], ['SOJA3', true]]);
});
test('futuros: só contratos agrícolas da lista e variação contra o pregão anterior', async t => {
  assert.equal((await call({ type: 'future', symbol: 'AAPL' })).code, 400);
  t.mock.method(globalThis, 'fetch', async url => {
    assert.match(url, /chart\/ZC%3DF/);
    return { ok: true, json: async () => ({ chart: { result: [{
      meta: { regularMarketPrice: 501.25, regularMarketTime: 1790792399, chartPreviousClose: 528.25, currency: 'USX' },
      indicators: { quote: [{ close: [528.25, 523, 522, null, 501.25] }] },
    }] } }) };
  });
  const res = await call({ type: 'future', symbol: 'ZC=F' });
  assert.equal(res.code, 200);
  assert.equal(res.data.value, 501.25);
  assert.equal(res.data.change.toFixed(2), ((501.25 - 522) / 522 * 100).toFixed(2));
});
test('futuros: na troca de vencimento vale a variação informada pela fonte', async t => {
  // suíno em 01/10/2026: o contínuo passou de outubro (78,725) para dezembro (68,65); a queda real foi de 1,116%
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ chart: { result: [{
    meta: { regularMarketPrice: 68.65, regularMarketTime: 1790874540, regularMarketChangePercent: -1.116 },
    indicators: { quote: [{ close: [78.25, 79.375, 78.725, 68.65] }] },
  }] } }) }));
  assert.equal((await call({ type: 'future', symbol: 'HE=F' })).data.change, -1.116);
});
test('chicago: quadro com todos os contratos, tolerando falha de um deles', async t => {
  const { CHICAGO } = await import('../src/catalogo.js');
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-01T17:00:00Z') });
  const pedidos = [];
  t.mock.method(globalThis, 'fetch', async url => {
    const simbolo = decodeURIComponent(url.match(/chart\/([^?]+)/)[1]);
    pedidos.push(simbolo);
    if (simbolo === 'ZO=F') return { ok: false, status: 404 };
    return { ok: true, json: async () => ({ chart: { result: [{
      meta: { regularMarketPrice: 1275.5, regularMarketTime: 1790874225, regularMarketDayHigh: 1295, regularMarketDayLow: 1273.75,
        shortName: simbolo === 'ZW=F' ? 'Chicago SRW Wheat Futures,Mar-2' : 'Soybean Futures,Nov-2026' },
      indicators: { quote: [{ close: [1288.25, 1297.75, 1293, 1275.5] }] },
    }] } }) };
  });
  const res = await call({ type: 'chicago' });
  assert.equal(res.code, 200);
  assert.deepEqual(pedidos.sort(), CHICAGO.map(item => item.symbol).sort(), 'a API consulta os mesmos contratos da aba');
  assert.equal(res.data.contratos.length, CHICAGO.length - 1);
  const soja = res.data.contratos.find(c => c.symbol === 'ZS=F');
  assert.deepEqual(soja.vencimento, { mes: 11, ano: 2026 });
  assert.equal(soja.change.toFixed(2), ((1275.5 - 1293) / 1293 * 100).toFixed(2));
  assert.equal(soja.high, 1295);
  // ano cortado no nome: março já passou em outubro de 2026, então é março de 2027
  assert.deepEqual(res.data.contratos.find(c => c.symbol === 'ZW=F').vencimento, { mes: 3, ano: 2027 });
});
test('chicago: próximos vencimentos do produto, pulando contrato que já saiu da fonte', async t => {
  assert.equal((await call({ type: 'chicago', symbol: 'KC=F' })).code, 400, 'café é de Nova Iorque');
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-01T17:00:00Z') });
  const pedidos = [];
  t.mock.method(globalThis, 'fetch', async url => {
    const simbolo = decodeURIComponent(url.match(/chart\/([^?]+)/)[1]);
    pedidos.push(simbolo);
    if (simbolo === 'ZSX26.CBT') return { ok: false, status: 404 };
    return { ok: true, json: async () => ({ chart: { result: [{
      meta: { regularMarketPrice: 1292.25, regularMarketTime: 1790874225 }, indicators: { quote: [{ close: [1300, 1292.25] }] },
    }] } }) };
  });
  const res = await call({ type: 'chicago', symbol: 'ZS=F' });
  assert.equal(res.code, 200);
  assert.deepEqual(pedidos, ['ZSX26.CBT', 'ZSF27.CBT', 'ZSH27.CBT', 'ZSK27.CBT', 'ZSN27.CBT']);
  assert.deepEqual(res.data.vencimentos.map(v => [v.contrato, v.mes, v.ano]), [['ZSF27', 1, 2027], ['ZSH27', 3, 2027], ['ZSK27', 5, 2027], ['ZSN27', 7, 2027]]);
});
test('chicago: sem nenhuma cotação, avisa em vez de inventar', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 500 }));
  assert.equal((await call({ type: 'chicago' })).code, 502);
  assert.equal((await call({ type: 'chicago', symbol: 'ZC=F' })).code, 502);
});
test('indicadores: último valor de cada série do Banco Central, tentando de novo a que vier vazia', async t => {
  const pedidos = {};
  t.mock.method(globalThis, 'fetch', async url => {
    const codigo = url.match(/sgs\.(\d+)\//)[1];
    pedidos[codigo] = (pedidos[codigo] ?? 0) + 1;
    if (codigo === '188') return { ok: true, json: async () => { throw new SyntaxError('resposta vazia'); } }; // INPC fora do ar
    if (codigo === '189' && pedidos[codigo] === 1) return { ok: true, json: async () => [] }; // IGP-M só responde na 2ª vez
    return { ok: true, json: async () => [{ data: '01/08/2026', valor: codigo === '433' ? '-0.32' : '4.22' }] };
  });
  const res = await call({ type: 'indicadores' });
  assert.equal(res.code, 200);
  assert.deepEqual(res.data.indicadores.ipca, { valor: -0.32, data: '01/08/2026' });
  assert.equal(res.data.indicadores.inpc, null);
  assert.equal(res.data.indicadores.igpm.valor, 4.22);
  assert.equal(pedidos['188'], 2);
});
test('indicadores: sem nenhuma série, avisa em vez de mostrar número antigo', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503 }));
  assert.equal((await call({ type: 'indicadores' })).code, 502);
});
