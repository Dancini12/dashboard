import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerSafraParana, lerMunicipio, lerBrasil } from '../server/safra.js';
import handler from '../api/market.js';

const MESES_VAZIOS = Array(28).fill(null);
const meses = valores => MESES_VAZIOS.map((_, i) => valores[i] ?? null); // a partir de maio do primeiro ano da safra
const abas = [
  { sheet: 'BDados', data: [
    ['Safra', 'Cultura', 'Núcleo Regional', 'Area Total', 'Area Perdida', 'Produção', 'Produtv'],
    ['25/26', 'SOJA (1ª SAFRA)', 'CORNÉLIO PROCÓPIO (c)', 1000, null, 3000, 3000],
    ['25/26', 'SOJA (1ª SAFRA)', 'maRINGÁ (c)', 2000, 500, 4500, 3000],
    ['26/27', 'SOJA (1ª SAFRA)', 'CORNÉLIO PROCÓPIO (c)', 1000, null, 3600, 3600],
    ['25/26', 'ALHO', 'CURITIBA (f)', 10, null, 50, 5000], // fora da lista de culturas acompanhadas
    [null, null, null, null, null, null, null],
  ] },
  { sheet: 'BDadosCal', data: [
    ['CULTURA', 'SAFRA', 'OPERAÇÃO', 'mai', 'jun'],
    ['SOJA (1ª SAFRA)', '25/26', 'Plantio', ...meses({ 4: 13, 5: 71, 6: 97, 7: 100 })],
    ['SOJA (1ª SAFRA)', '25/26', 'Colheita', ...meses({ 8: 5, 9: 37 })],
    ['SOJA (1ª SAFRA)', '26/27', 'Plantio', ...meses({ 4: 15 })],
    ['SOJA (1ª SAFRA)', '26/27', 'Colheita', ...MESES_VAZIOS], // ainda não começou: fica de fora
  ] },
  { sheet: 'Calendário', data: [[null, 'Última atualização:', new Date('2026-09-21T00:00:00Z')]] },
];

test('safra do Paraná: soma os núcleos, separa a região da escola e calcula o rendimento na área colhida', () => {
  const r = lerSafraParana(abas);
  assert.equal(r.atualizadoEm, '2026-09-21');
  assert.deepEqual(r.culturas.map(c => c.nome), ['Soja (1ª safra)']);
  const [soja] = r.culturas;
  assert.deepEqual(soja.parana[0], { safra: '25/26', area: 3000, producao: 7500, rendimento: 3000 }); // 7.500 t em 2.500 ha colhidos
  assert.deepEqual(soja.regiao.map(l => [l.safra, l.producao]), [['25/26', 3000], ['26/27', 3600]]);
});
test('safra do Paraná: andamento de plantio e colheita com o mês certo de cada percentual', () => {
  const [soja] = lerSafraParana(abas).culturas;
  assert.deepEqual(soja.andamento.map(a => [a.safra, a.operacao]), [['25/26', 'Plantio'], ['25/26', 'Colheita'], ['26/27', 'Plantio']]);
  assert.deepEqual(soja.andamento[0].meses, [{ mes: '2025-09', pct: 13 }, { mes: '2025-10', pct: 71 }, { mes: '2025-11', pct: 97 }, { mes: '2025-12', pct: 100 }]);
  assert.deepEqual(soja.andamento[1].meses[0], { mes: '2026-01', pct: 5 });
});
test('IBGE: produção do município por ano e estimativa do Brasil contra o ano anterior', () => {
  const pam = [
    { D2C: '214', D3C: '2024', D4C: '40124', V: '57291' }, { D2C: '214', D3C: '2025', D4C: '40124', V: '95670' },
    { D2C: '216', D3C: '2025', D4C: '40124', V: '30000' }, { D2C: '112', D3C: '2025', D4C: '40124', V: '3189' },
    { D2C: '214', D3C: '2024', D4C: '40139', V: '-' }, { D2C: '214', D3C: '2025', D4C: '40139', V: '...' }, // café: zero e sem dado
  ];
  const m = lerMunicipio(pam);
  assert.deepEqual(m.anos, [2024, 2025]);
  assert.deepEqual(m.culturas.map(c => c.nome), ['Soja'], 'cultura sem produção fica de fora');
  assert.deepEqual(m.culturas[0].producao, [57291, 95670]);
  assert.deepEqual(m.culturas[0].area, [null, 30000]);
  const linha = (local, mes, valor) => ({ D1C: local, D2C: '35', D3C: mes, D3N: mes === '202608' ? 'agosto 2026' : 'outro', D4C: '39443', V: valor });
  const b = lerBrasil([linha('1', '202512', '166054076'), linha('1', '202608', '174773080'), linha('41', '202512', '21372600'), linha('41', '202608', '21968600'), linha('1', '202607', '1')]);
  assert.equal(b.referencia, 'agosto 2026');
  assert.deepEqual(b.culturas, [{ nome: 'Soja', brasil: { producao: 174773080, anterior: 166054076 }, parana: { producao: 21968600, anterior: 21372600 } }]);
});
test('safra: sem nenhuma fonte, avisa', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503 }));
  const res = { code: 200, status(c) { this.code = c; return this; }, setHeader() {}, json(d) { this.data = d; return this; } };
  await handler({ query: { type: 'safra' } }, res);
  assert.equal(res.code, 502);
});
