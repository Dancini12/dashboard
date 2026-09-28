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
