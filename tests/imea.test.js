import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ultimaCotacao, INDICADORES_IMEA } from '../server/imea.js';

const soja = INDICADORES_IMEA.find(i => i.nome === 'Soja');
const boi = INDICADORES_IMEA.find(i => i.nome === 'Boi gordo');
const c = (id, Localidade, Valor, DataPublicacao, Variacao = null, UnidadeSigla = 'R$/sc') => ({ IndicadorFinalId: id, Localidade, Valor, DataPublicacao, Variacao, UnidadeSigla });

test('IMEA: fica só a data mais recente, com a média do estado separada das cidades', () => {
  const r = ultimaCotacao([
    c(soja.id, 'Mato Grosso', 135.78, '2026-10-16 00:00:00', -0.39),
    c(soja.id, 'Sorriso', 135.2, '2026-10-16 00:00:00', -0.37),
    c(soja.id, 'Alta Floresta', 134.55, '2026-10-16 00:00:00', -0.52),
    c(soja.id, 'Sorriso', 136, '2026-10-15 00:00:00'),
    c(soja.id, 'Sorriso', 135.1, '2026-10-16 00:00:00'), // repetida no mesmo dia: vale a primeira
    c(soja.id, 'Sinop', null, '2026-10-16 00:00:00'), // sem valor: fica de fora
    c('outro', 'Sorriso', 999, '2026-10-17 00:00:00'), // outro indicador da mesma cadeia
  ], soja);
  assert.equal(r.data, '2026-10-16');
  assert.equal(r.unidade, 'saca de 60 kg');
  assert.equal(r.mediaEstado, 135.78); assert.equal(r.variacaoEstado, -0.39);
  assert.deepEqual(r.locais.map(l => [l.nome, l.valor]), [['Alta Floresta', 134.55], ['Sorriso', 135.2]], 'em ordem alfabética');
  assert.deepEqual(r.regioes, []);
});

test('IMEA: no boi, as macrorregiões ficam à parte dos municípios', () => {
  const r = ultimaCotacao([
    c(boi.id, 'Mato Grosso', 348.11, '2026-10-16 00:00:00', 0.63, 'R$/@'),
    c(boi.id, 'Médio-Norte', 348.86, '2026-10-16 00:00:00', 0.6, 'R$/@'),
    c(boi.id, 'Norte', 348.36, '2026-10-16 00:00:00', 0.5, 'R$/@'),
    c(boi.id, 'Nortelândia', 350, '2026-10-16 00:00:00', 0.5, 'R$/@'),
  ], boi);
  assert.equal(r.unidade, 'arroba');
  assert.deepEqual(r.regioes.map(l => l.nome), ['Médio-Norte', 'Norte']);
  assert.deepEqual(r.locais.map(l => l.nome), ['Nortelândia'], 'município com nome parecido não vira região');
});

test('IMEA: indicador sem cotação dá null', () => {
  assert.equal(ultimaCotacao([c('outro', 'Sorriso', 1, '2026-10-16 00:00:00')], soja), null);
});
