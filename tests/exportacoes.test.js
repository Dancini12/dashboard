import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerProdutos, lerDestinos } from '../server/exportacoes.js';
import handler from '../api/market.js';

const linha = (year, monthNumber, headingCode, state, kg, fob) => ({ year, monthNumber, headingCode, state, metricKG: String(kg), metricFOB: String(fob) });

test('exportações: série mensal do Brasil e do Paraná e estados que mais exportam no ano', () => {
  const r = lerProdutos([
    linha('2025', '08', '1201', 'Paraná', 100, 40), linha('2025', '08', '1201', 'Mato Grosso', 300, 120),
    linha('2026', '07', '1201', 'Mato Grosso', 500, 200),
    linha('2026', '08', '1201', 'Paraná', 150, 60), linha('2026', '08', '1201', 'Mato Grosso', 250, 100),
    linha('2026', '08', '0201', 'São Paulo', 10, 50), linha('2026', '08', '0202', 'São Paulo', 30, 150), // carne fresca + congelada
    linha('2026', '08', '9999', 'São Paulo', 1, 1), // produto fora da lista
  ]);
  assert.equal(r.ultimoMes, '2026-08');
  assert.deepEqual(r.produtos.map(p => p.chave), ['soja', 'bovina']);
  const [soja, bovina] = r.produtos;
  assert.deepEqual(soja.brasil, [{ mes: '2025-08', kg: 400, fob: 160 }, { mes: '2026-07', kg: 500, fob: 200 }, { mes: '2026-08', kg: 400, fob: 160 }]);
  assert.deepEqual(soja.parana.map(m => m.kg), [100, 0, 150]);
  assert.deepEqual(soja.estados.map(e => [e.estado, e.kg]), [['Mato Grosso', 750], ['Paraná', 150]], 'só o ano mais recente');
  assert.deepEqual(bovina.brasil.at(-1), { mes: '2026-08', kg: 40, fob: 200 });
});
test('exportações: destinos do ano mais recente, do maior para o menor, com a parte de cada um', () => {
  const pais = (year, country, kg) => ({ year, headingCode: '1201', country, metricKG: String(kg), metricFOB: String(kg / 2) });
  const r = lerDestinos([pais('2025', 'China', 999), pais('2026', 'Espanha', 100), pais('2026', 'China', 700), pais('2026', 'Tailândia', 200)]);
  assert.equal(r.ano, 2026);
  const [soja] = r.produtos;
  assert.equal(soja.totalKg, 1000);
  assert.deepEqual(soja.destinos.map(d => [d.pais, d.partePct]), [['China', 70], ['Tailândia', 20], ['Espanha', 10]]);
});
test('exportações: limite de pedidos da fonte vira aviso para tentar de novo', async t => {
  const chamar = async query => { const res = { code: 200, status(c) { this.code = c; return this; }, setHeader() {}, json(d) { this.data = d; return this; } }; await handler({ query }, res); return res; };
  assert.equal((await chamar({ type: 'exportacoes' })).code, 400);
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 429 }));
  const res = await chamar({ type: 'exportacoes', parte: 'produtos' });
  assert.equal(res.code, 503);
  assert.equal(res.data.tentarEm, 11);
});
