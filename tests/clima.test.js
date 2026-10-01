import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumoDaChuva, avisosDaPrevisao } from '../src/clima.js';

const dia = (data, chuva, extra = {}) => ({ data, chuva, et0: 4, ...extra });

test('clima: chuva acumulada antes de hoje e prevista de hoje em diante', () => {
  const dias = [
    dia('2026-09-20', 12), dia('2026-09-28', 30), dia('2026-09-29', 0.4), dia('2026-09-30', 0),
    dia('2026-10-01', 5), dia('2026-10-02', 0), dia('2026-10-03', 0.2),
    dia('2026-10-04', 8), dia('2026-10-05', null), dia('2026-10-06', 20),
  ];
  const r = resumoDaChuva(dias, '2026-10-04');
  assert.equal(r.ultimos7.toFixed(1), '47.6');
  assert.equal(r.ultimos30.toFixed(1), '47.6');
  assert.equal(r.noMes.toFixed(1), '5.2', 'só os dias de outubro antes de hoje');
  assert.equal(r.proximos7, 28);
  assert.equal(r.diasSemChuva, 2, 'dias 2 e 3 de outubro: 0,2 mm não conta como chuva');
  assert.equal(r.evapotranspiracao30, 28);
});
test('clima: sem nenhuma chuva no período, todos os dias contam como secos', () => {
  assert.equal(resumoDaChuva([dia('2026-10-01', 0), dia('2026-10-02', 0.5)], '2026-10-03').diasSemChuva, 2);
});
test('clima: avisos de geada, calor e chuva forte só olham a previsão', () => {
  const dias = [
    dia('2026-07-01', 80, { minima: 1, maxima: 12 }), // já passou
    dia('2026-07-02', 0, { minima: 2.5, maxima: 15 }), dia('2026-07-03', 55, { minima: 10, maxima: 36 }), dia('2026-07-04', 0, { minima: 8, maxima: 22 }),
  ];
  const avisos = avisosDaPrevisao(dias, '2026-07-02');
  assert.deepEqual(avisos.geada.map(d => d.data), ['2026-07-02']);
  assert.deepEqual(avisos.calor.map(d => d.data), ['2026-07-03']);
  assert.deepEqual(avisos.chuvaForte.map(d => d.data), ['2026-07-03']);
});
