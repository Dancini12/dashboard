import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerProdutos, lerDestinos, lerComercioComPais } from '../server/exportacoes.js';
import { PAISES, acharPais } from '../src/paises.js';
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
test('comércio com um país: produtos do maior para o menor volume, por ano, com nome do dia a dia', () => {
  const posicao = (year, headingCode, heading, kg, fob) => ({ year, headingCode, heading, metricKG: String(kg), metricFOB: String(fob) });
  const [atual, anterior] = lerComercioComPais([
    posicao('2025', '1201', 'Soja, mesmo triturada', 900, 450),
    posicao('2026', '1201', 'Soja, mesmo triturada', 700, 300),
    posicao('2026', '0201', 'Carnes de animais da espécie bovina, frescas ou refrigeradas', 10, 60), posicao('2026', '0202', 'Carnes de animais da espécie bovina, congeladas', 30, 140),
    posicao('2026', '3104', 'Adubos (fertilizantes) minerais ou químicos, potássicos', 500, 200),
    posicao('2026', '5201', 'Algodão, não cardado nem penteado', 20, 40), posicao('2026', '5208', 'Tecidos de algodão', 999, 999), // tecido é indústria
    posicao('2026', '0508', 'Coral e matérias semelhantes, em bruto ou simplesmente preparados, mas não trabalhados de outro modo; conchas e carapaças', 5, 1), // sem nome do dia a dia
    posicao('2026', '1005', 'Milho', 0, 0), // sem movimento não entra
  ]);
  assert.deepEqual([atual.ano, anterior.ano], [2026, 2025], 'o ano mais recente primeiro');
  assert.deepEqual(atual.produtos.map(p => [p.nome, p.kg]), [['Soja em grão', 700], ['Adubos potássicos', 500], ['Carne bovina', 40], ['Algodão', 20],
    ['Coral e matérias semelhantes, em bruto ou simplesmente…', 5]], 'nome oficial comprido é cortado em até 60 letras');
  assert.deepEqual(atual.total, { kg: 1265, fob: 741 });
  assert.deepEqual(atual.outros, { quantos: 0, kg: 0, fob: 0 });
  assert.deepEqual(anterior.produtos, [{ nome: 'Soja em grão', kg: 900, fob: 450 }]);
  assert.deepEqual(lerComercioComPais([]), [], 'país sem comércio do agro');
});
test('comércio com um país: além dos 12 maiores, o resto vai somado', () => {
  const lista = Array.from({ length: 15 }, (_, i) => ({ year: '2026', headingCode: `07${String(i + 20)}`, heading: `Produto ${i}`, metricKG: String(100 - i), metricFOB: '1' }));
  const [ano] = lerComercioComPais(lista);
  assert.equal(ano.produtos.length, 12);
  assert.deepEqual(ano.outros, { quantos: 3, kg: 88 + 87 + 86, fob: 3 });
  assert.equal(ano.total.kg, lista.reduce((t, l) => t + Number(l.metricKG), 0));
});
test('comércio com um país: acha o país pelo nome, sem acento, pelo começo ou por apelido', () => {
  const nome = texto => acharPais(texto).pais?.[1];
  assert.equal(nome('china'), 'China'); assert.equal(nome('  Rússia '), 'Rússia'); assert.equal(nome('russia'), 'Rússia');
  assert.equal(nome('EUA'), 'Estados Unidos'); assert.equal(nome('holanda'), 'Países Baixos (Holanda)'); assert.equal(nome('inglaterra'), 'Reino Unido');
  assert.equal(nome('republica tcheca'), 'República Tcheca'); assert.equal(nome('argent'), 'Argentina');
  assert.equal(nome('guine'), 'Guiné', 'nome inteiro vence os que só começam igual');
  assert.deepEqual(acharPais('coreia').opcoes.map(p => p[1]), ['Coreia do Norte', 'Coreia do Sul']);
  assert.deepEqual(acharPais('atlantida'), { opcoes: [] }); assert.deepEqual(acharPais('  '), { opcoes: [] });
  assert.equal(new Set(PAISES.map(p => p[0])).size, PAISES.length, 'código repetido');
  assert.ok(PAISES.every(([codigo, n]) => /^\d{3}$/.test(codigo) && n) && !PAISES.some(p => p[1] === 'Brasil'));
});
test('comércio com um país: a consulta pede o país e o fluxo certos e aceita lista vazia', async t => {
  const chamar = async query => { const res = { code: 200, status(c) { this.code = c; return this; }, setHeader() {}, json(d) { this.data = d; return this; } }; await handler({ query }, res); return res; };
  assert.equal((await chamar({ type: 'exportacoes', parte: 'pais', pais: '160' })).code, 400, 'sem fluxo');
  assert.equal((await chamar({ type: 'exportacoes', parte: 'pais', pais: '105', fluxo: 'export' })).code, 400, 'o Brasil não é parceiro de si mesmo');
  assert.equal((await chamar({ type: 'exportacoes', parte: 'pais', pais: 'china', fluxo: 'import' })).code, 400, 'código, não nome');
  const pedidos = [];
  t.mock.method(globalThis, 'fetch', async (url, opcoes) => { pedidos.push(JSON.parse(opcoes.body)); return { ok: true, status: 200, json: async () => ({ data: { list: [] } }) }; });
  const res = await chamar({ type: 'exportacoes', parte: 'pais', pais: '160', fluxo: 'import' });
  assert.equal(res.code, 200);
  assert.deepEqual(res.data, { pais: { id: '160', nome: 'China' }, fluxo: 'import', anos: [], fonte: 'Comex Stat · MDIC' });
  assert.equal(pedidos[0].flow, 'import');
  assert.deepEqual(pedidos[0].filters[0], { filter: 'country', values: ['160'] });
  assert.deepEqual(pedidos[0].filters[1].values.slice(0, 2).concat(pedidos[0].filters[1].values.slice(-2)), ['01', '02', '31', '52']);
});
test('exportações: limite de pedidos da fonte vira aviso para tentar de novo', async t => {
  const chamar = async query => { const res = { code: 200, status(c) { this.code = c; return this; }, setHeader() {}, json(d) { this.data = d; return this; } }; await handler({ query }, res); return res; };
  assert.equal((await chamar({ type: 'exportacoes' })).code, 400);
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 429 }));
  const res = await chamar({ type: 'exportacoes', parte: 'produtos' });
  assert.equal(res.code, 503);
  assert.equal(res.data.tentarEm, 14);
});
