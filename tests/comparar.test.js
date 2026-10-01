import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediasAnuais, variacaoDesde, ranking } from '../src/comparar.js';
import handler from '../api/market.js';

test('comparar: média de cada ano a partir dos fechamentos mensais', () => {
  const medias = mediasAnuais([
    { date: '2020-01-01', close: 100 }, { date: '2020-02-01', close: 200 }, { date: '2021-01-01', close: 300 }, { date: '2021-02-01', close: null },
  ]);
  assert.deepEqual(medias, { 2020: 150, 2021: 300 });
});
test('comparar: variação em % contra o ano inicial, com lacuna onde falta dado', () => {
  assert.deepEqual(variacaoDesde({ 2020: 100, 2021: 150, 2023: 80 }, [2020, 2021, 2022, 2023], 2020), [0, 50, null, -20]);
  assert.deepEqual(variacaoDesde({ 2020: 100, 2021: 150, 2023: 75 }, [2021, 2022, 2023], 2021), [0, null, -50]);
  assert.equal(variacaoDesde({ 2021: 150 }, [2020, 2021], 2020), null, 'sem preço no ano inicial não há comparação');
});
test('comparar: ranking do que mais subiu para o que mais caiu, pelo último valor conhecido', () => {
  const ordem = ranking([
    { nome: 'Leite', variacoes: [0, 5, -6] }, { nome: 'Café', variacoes: [0, 80, 230] }, { nome: 'Soja', variacoes: [0, 40, null] }, { nome: 'Vazio', variacoes: [null] },
  ]);
  assert.deepEqual(ordem.map(e => [e.nome, e.final]), [['Café', 230], ['Soja', 40], ['Leite', -6]]);
});
test('histórico de contrato futuro: fechamentos mensais desde 2020, sem meses vazios', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    assert.match(url, /chart\/KC%3DF\?interval=1mo&period1=1577836800&period2=\d+/);
    return { ok: true, json: async () => ({ chart: { result: [{
      meta: { currency: 'USX', shortName: 'Coffee Dec 26' }, timestamp: [1577854800, 1580533200, 1583038800],
      indicators: { quote: [{ close: [102.65, null, 119.55] }] },
    }] } }) };
  });
  const res = { code: 200, status(c) { this.code = c; return this; }, setHeader() {}, json(d) { this.data = d; return this; } };
  await handler({ query: { type: 'history', symbol: 'KC=F' } }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.data.points, [{ date: '2020-01-01', close: 102.65 }, { date: '2020-03-01', close: 119.55 }]);
  assert.equal(res.data.currency, 'USX');
});
