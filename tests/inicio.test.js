import { test } from 'node:test';
import assert from 'node:assert/strict';
import { precoNaRegiao, operacoesEmAndamento } from '../src/inicio.js';

const cotacao = {
  regioes: ['Apucarana', 'Cornélio Procópio'],
  produtos: [
    { nome: 'Soja industrial tipo 1', unidade: 'sc 60 Kg', precos: [{ comum: 139 }, { comum: 139.5 }], mediaEstado: 139.41, variacaoPct: -0.43 },
    { nome: 'Boi em pé', unidade: 'arroba', precos: [{ comum: 320 }, { comum: 'sinf' }], mediaEstado: 318.2, variacaoPct: 0.1 },
    { nome: 'Arroz Agulhinha em casca tipo 1', unidade: 'sc 60 Kg', precos: [{ comum: null }, { comum: null }], mediaEstado: null, variacaoPct: null },
  ],
};
test('início: preço do produto na região da escola; sem preço na região, a média do estado', () => {
  assert.deepEqual(precoNaRegiao(cotacao, 'Soja', 'Cornélio Procópio'), { unidade: 'sc 60 Kg', mediaEstado: 139.41, variacaoPct: -0.43, valor: 139.5, daRegiao: true });
  const boi = precoNaRegiao(cotacao, 'Boi', 'Cornélio Procópio');
  assert.equal(boi.valor, 318.2); assert.equal(boi.daRegiao, false);
  assert.equal(precoNaRegiao(cotacao, 'Arroz', 'Cornélio Procópio'), null);
  assert.equal(precoNaRegiao(cotacao, 'Milho', 'Cornélio Procópio'), null, 'produto fora do boletim');
  assert.equal(precoNaRegiao(null, 'Soja', 'Cornélio Procópio'), null);
});
test('início: só entram plantio e colheita começados, não concluídos e com levantamento recente', () => {
  const culturas = [
    { nome: 'Soja (1ª safra)', andamento: [
      { safra: '25/26', operacao: 'Plantio', meses: [{ mes: '2025-12', pct: 100 }] },
      { safra: '26/27', operacao: 'Plantio', meses: [{ mes: '2026-08', pct: 0 }, { mes: '2026-09', pct: 15 }] },
      { safra: '26/27', operacao: 'Comercialização', meses: [{ mes: '2026-09', pct: 10.2 }] },
    ] },
    { nome: 'Trigo', andamento: [{ safra: '25/26', operacao: 'Plantio', meses: [{ mes: '2026-07', pct: 100 }] }, { safra: '25/26', operacao: 'Colheita', meses: [{ mes: '2026-08', pct: 1 }, { mes: '2026-09', pct: 46 }] }] },
    { nome: 'Café', andamento: [{ safra: '24/25', operacao: 'Colheita', meses: [{ mes: '2025-08', pct: 97 }] }] }, // parado há mais de um ano
  ];
  assert.deepEqual(operacoesEmAndamento(culturas, new Date('2026-10-01T12:00:00Z')), [
    { cultura: 'Soja (1ª safra)', safra: '26/27', operacao: 'Plantio', pct: 15, mes: 'set/26' },
    { cultura: 'Trigo', safra: '25/26', operacao: 'Colheita', pct: 46, mes: 'set/26' },
  ]);
});
