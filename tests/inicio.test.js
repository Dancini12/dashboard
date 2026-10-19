import { test } from 'node:test';
import assert from 'node:assert/strict';
import { precoNaRegiao, operacoesEmAndamento, frasesDoDia, textosDoJornal, horaDaCotacao, diaDoBoletim, organizarNoticias, rubricaDe, precosDoEstado, rotuloDoPreco, referenciaDoEstado } from '../src/inicio.js';
import { estadoPorSigla } from '../src/estados.js';

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
    diesel: { medio: 7.41 },
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

test('jornal do dia: de quando são a cotação de Chicago e o boletim do DERAL', () => {
  const referencia = new Date(2026, 9, 14, 15, 0).getTime();
  assert.equal(horaDaCotacao(new Date(2026, 9, 14, 14, 9).getTime() / 1000, referencia), 'às 14:09');
  assert.equal(horaDaCotacao(new Date(2026, 9, 13, 15, 20).getTime() / 1000, referencia), 'em 13/10, às 15:20', 'de outro dia, leva a data');
  assert.equal(horaDaCotacao(undefined, referencia), null);
  assert.equal(diaDoBoletim('14/10/2026'), '14/10');
  assert.equal(diaDoBoletim(undefined), null);
});

test('jornal do dia: notícias por assunto, sem repetir tema e, na economia, só o que mexe com o agro', () => {
  const n = (title, link = title) => ({ title, link, author: 'Fonte', pubDate: 'Wed, 14 Oct 2026 12:00:00 GMT' });
  const agro = [
    n('Preço do boi gordo no físico e futuro na máxima'),
    n('Boi gordo, frango e suíno: confira cotações para esta quarta-feira'),
    n('Exportações de carne bovina recuam na parcial de outubro'),
    n('Boi gordo: arroba segue em alta com escalas de abate apertadas'),
    n('Mercado de feijão no Brasil apresenta cotações divergentes'),
  ];
  assert.deepEqual(organizarNoticias(agro, 'agro').map(i => i.rubrica), ['Pecuária', 'Exportação', 'Grãos'], 'uma notícia por assunto');
  assert.equal(organizarNoticias(agro.slice(0, 2), 'agro').length, 2, 'com poucos assuntos, completa com o que tiver');
  assert.equal(organizarNoticias([n('Preço do boi gordo no físico e futuro na máxima', 'a'), n('Preço do boi gordo no físico e futuro na máxima hoje', 'b')], 'agro').length, 1, 'notícia parecida não se repete');
  const economia = [n('Anvisa proíbe canetas emagrecedoras sem registro'), n('Dólar sobe a R$ 5,05 e Bolsa cai'), n('Copom mantém a Selic em 13,75%'), n('Prazo pra bancos devolverem dinheiro de bets acaba hoje')];
  assert.deepEqual(organizarNoticias(economia, 'economia').map(i => i.rubrica), ['Câmbio', 'Juros'], 'assunto sem ligação com o agro fica de fora');
  assert.equal(organizarNoticias([n('Dólar sobe a R$ 5,05')], 'economia', 3, [n('Dólar sobe a R$ 5,05')]).length, 0, 'não repete o que já saiu na outra coluna');
  assert.equal(rubricaDe('Geada atinge lavouras de trigo no Paraná', 'agro'), 'Clima');
  assert.equal(rubricaDe('Cooperativa inaugura nova unidade', 'agro'), 'Geral');
  assert.equal(rubricaDe('Custo do confinamento amplia diferença de lucro', 'agro'), 'Pecuária');
});

test('resumo do dia em outros estados: média do estado, média das regionais em SP e média da semana no RS', () => {
  const mt = { produtos: [
    { nome: 'Soja', unidade: 'saca de 60 kg', data: '2026-10-16', mediaEstado: 135.78, variacaoEstado: -0.39, locais: [] },
    { nome: 'Boi gordo', unidade: 'arroba', data: '2026-10-16', mediaEstado: 348.11, variacaoEstado: 0.63, locais: [] },
  ] };
  const [soja, milho, boi] = precosDoEstado('MT', mt);
  assert.deepEqual(soja, { produto: 'Soja', nomeNaFonte: 'Soja', preco: { valor: 135.78, unidade: 'saca', daRegiao: false, variacaoPct: -0.39 } });
  assert.equal(milho.preco, null, 'produto que a fonte não trouxe');
  assert.equal(boi.nomeNaFonte, 'Boi gordo'); assert.equal(boi.preco.unidade, 'arroba');
  assert.equal(rotuloDoPreco('Soja', soja.preco, estadoPorSigla('MT')), 'Soja em Mato Grosso (média)');
  assert.equal(rotuloDoPreco('Soja', soja.preco, estadoPorSigla('MT'), '', true), 'Soja em MT');
  assert.equal(referenciaDoEstado('MT', mt), '16/10');

  const sp = { produtos: [{ nome: 'Soja', unidade: 'saca de 60 kg', data: '2026-10-16', desde: '2026-10-14', mediaEstado: null, locais: [{ valor: 139.75 }, { valor: 145 }, { valor: 156.5 }] }] };
  const [sojaSp] = precosDoEstado('SP', sp);
  assert.deepEqual(sojaSp.preco, { valor: 147.08, unidade: 'saca', daRegiao: false, variacaoPct: null, regionais: 3, minimo: 139.75, maximo: 156.5 });
  assert.equal(rotuloDoPreco('Soja', sojaSp.preco, estadoPorSigla('SP')), 'Soja em São Paulo (média das regionais)');
  assert.equal(referenciaDoEstado('SP', sp), 'de 14/10 a 16/10');

  const rs = { semana: { de: '12/10/2026', ate: '16/10/2026' }, produtos: [{ nome: 'Soja', unidade: '60 kg', medio: 138.32, semanaAnterior: 139.71 }, { nome: 'Boi', unidade: 'kg vivo', medio: 12.61, semanaAnterior: 12.44 }] };
  const [sojaRs, , boiRs] = precosDoEstado('RS', rs);
  assert.equal(sojaRs.preco.valor, 138.32); assert.equal(sojaRs.preco.variacaoPct, -0.99); assert.equal(boiRs.preco.unidade, 'kg vivo');
  assert.equal(referenciaDoEstado('RS', rs), 'semana de 12/10 a 16/10');
  assert.equal(referenciaDoEstado('PR', { data: '16/10/2026 11:25' }), 'boletim de 16/10');

  const textos = textosDoJornal({ estado: estadoPorSigla('RS'), daRegiao: [sojaRs, boiRs], diesel: { medio: 6.9 } });
  assert.deepEqual(textos.mercado.map(t => t.replace(/\u00a0/g, ' ')), [
    'No Rio Grande do Sul, as médias da semana são: soja, R$ 138,32 a saca; boi, R$ 12,61 o quilo vivo.',
    'O diesel S10 custa em média R$ 6,90 o litro nos postos do Rio Grande do Sul.',
  ]);
});
