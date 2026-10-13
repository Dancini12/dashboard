import { test } from 'node:test';
import assert from 'node:assert/strict';
import { precoNaRegiao, operacoesEmAndamento, frasesDoDia, textosDoJornal } from '../src/inicio.js';

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
test('resumo do dia: frases de abertura com o que já chegou, na ordem dólar, soja e tempo', () => {
  const semEspacoDuro = frases => frases.map(f => f.replace(/\u00a0/g, ' '));
  const hoje = { data: '2026-10-13', tempo: 63, minima: 18.4, maxima: 30.6, chuva: 12.34 };
  const semAvisos = { geada: [], chuvaForte: [], calor: [] };
  assert.deepEqual(semEspacoDuro(frasesDoDia({ dolar: 5.4321, variacaoDoDolar: 0.42, variacaoDaSoja: -0.81, cidade: 'Londrina, Paraná', hoje, avisos: semAvisos })), [
    'Dólar em alta de 0,4%, a R$ 5,43.', 'Soja em Chicago em queda de 0,8%.', 'Em Londrina, chuva moderada, de 18° a 31°, com 12,3 mm de chuva previstos para hoje.',
  ]);
  assert.deepEqual(frasesDoDia({ dolar: null, variacaoDoDolar: null, variacaoDaSoja: 0.01, cidade: null, hoje: null, avisos: null }), ['Soja em Chicago estável.'], 'sem dólar e sem cidade');
  const seco = frasesDoDia({ cidade: 'Sorriso, Mato Grosso', hoje: { ...hoje, tempo: 0, chuva: 0.4 }, avisos: { geada: [], chuvaForte: [{ data: '2026-10-15' }, { data: '2026-10-16' }], calor: [{ data: '2026-10-14' }] } });
  assert.deepEqual(seco, ['Em Sorriso, céu limpo, de 18° a 31°, sem chuva prevista para hoje.', 'Atenção: chuva forte prevista em 15/10, 16/10.'], 'menos de 1 mm não conta; só o aviso mais sério');
  assert.deepEqual(frasesDoDia({}), []);
});
test('jornal do dia: textos corridos do mercado, do campo e da economia', () => {
  const limpo = texto => texto.replace(/\u00a0/g, ' ');
  const r = textosDoJornal({
    dolar: 5.004, variacaoDoDolar: 0.27, sojaEmReais: 142.88, variacaoDaSoja: -0.66, regiao: 'Cornélio Procópio',
    daRegiao: [{ produto: 'Soja', preco: { valor: 134, unidade: 'sc 60 Kg', daRegiao: true } }, { produto: 'Milho', preco: null }, { produto: 'Boi', preco: { valor: 367.51, unidade: 'arroba', daRegiao: false } }],
    diesel: { parana: { medio: 7.41 } },
    noCampo: [{ operacao: 'Plantio', cultura: 'Soja (1ª safra)', safra: '26/27', pct: 15, mes: 'set/26' }, { operacao: 'Colheita', cultura: 'Trigo', safra: '25/26', pct: 46.5, mes: 'set/26' }],
    moedas: [{ id: 'usd', nome: 'Dólar Comercial', valor: 5.004 }, { id: 'eur', nome: 'Euro', valor: 5.62 }, { id: 'ars', nome: 'Peso Argentino', valor: 0.0033 }, { id: 'gbp', nome: 'Libra Esterlina', valor: null }],
    indicadores: [{ nome: 'IPCA', periodo: 'set/26', valor: '+0,82%' }, { nome: 'Selic', periodo: '', valor: '13,75% a.a.' }, { nome: 'CDI', periodo: '', valor: 'Carregando…' }],
  });
  assert.deepEqual(r.mercado.map(limpo), [
    'O dólar comercial vale R$ 5,00, em alta de 0,3% no dia.', 'Na Bolsa de Chicago, a soja equivale a R$ 142,88 por saca no porto, em queda de 0,7%.',
    'Na região de Cornélio Procópio, os preços do dia são: soja, R$ 134,00 a saca; boi, R$ 367,51 a arroba (média do Paraná).', 'O diesel S10 custa em média R$ 7,41 o litro nos postos do Paraná.',
  ]);
  assert.equal(r.campo, 'Nas lavouras do Paraná: plantio de soja (1ª safra) 26/27 em 15% até set/26; colheita de trigo 25/26 em 46,5% até set/26.');
  assert.deepEqual(r.economia, ['Outras moedas: euro a R$ 5,62; peso argentino a R$ 0,0033.', 'Indicadores: IPCA (set/26), +0,82%; Selic, 13,75% a.a.'], 'sem moeda nem indicador que ainda não chegou');
  assert.deepEqual(textosDoJornal({}), { mercado: [], campo: null, economia: [] }, 'sem dados, nada');
});
