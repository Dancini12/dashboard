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
  assert.match(res.data.error, /BRAPI_TOKEN/);
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
    return { ok: true, arrayBuffer: async () => planilha.buffer.slice(planilha.byteOffset, planilha.byteOffset + planilha.byteLength) };
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
});
test('sinaliza falha do DERAL em vez de inventar cotação', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503 }));
  const res = await call({ type: 'pr' });
  assert.equal(res.code, 502);
  assert.match(res.data.error, /DERAL/);
});
