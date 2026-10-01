import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buscar } from '../src/busca.js';
import { COMMODITIES, FUTURES, CHICAGO, APELIDOS_FUTUROS, PRODUTOS_PARANA } from '../src/catalogo.js';
import handler from '../api/news.js';

// Mesmo formato do índice montado no App.jsx.
const itens = [
  { titulo: 'Chicago · cotações da bolsa (CBOT e CME)', grupo: 'Chicago', termos: 'indices internacional vencimento' },
  ...PRODUTOS_PARANA.map(nome => ({ titulo: `${nome} · preço por região do PR`, grupo: 'Cooperativas', termos: `cooperativa produtor ${nome === 'Suíno' ? 'porco' : ''}` })),
  ...COMMODITIES.map(([, nome]) => ({ titulo: nome, grupo: 'Painel' })),
  ...FUTURES.map(f => ({ titulo: `${f.name} · mercado futuro`, grupo: 'Futuros', termos: `${f.key} ${APELIDOS_FUTUROS[f.key] ?? ''}` })),
  ...CHICAGO.map(f => ({ titulo: `${f.name} · Bolsa de Chicago`, grupo: 'Chicago', termos: `${f.key} ${APELIDOS_FUTUROS[f.key] ?? ''} ${f.exchange} vencimento` })),
  { titulo: 'Hedge', grupo: 'Glossário', termos: 'Proteção contra variação de preço' },
  { titulo: 'Selic', grupo: 'Glossário', termos: 'Taxa básica de juros' },
  { titulo: 'Dólar Comercial', grupo: 'Painel', termos: 'moeda' },
  { titulo: 'Peso Argentino', grupo: 'Painel', termos: 'moeda' },
];
const titulos = consulta => buscar(itens, consulta).map(i => i.titulo);

test('busca: produto traz primeiro o que começa com o nome e respeita o limite', () => {
  const r = titulos('soja');
  assert.ok(r.length > 3 && r.length <= 8);
  assert.ok(r.every(t => /soja/i.test(t)));
  assert.match(r[0], /^Soja/);
});
test('busca: aceita acento, maiúscula, sinônimos e plural', () => {
  assert.deepEqual(titulos('CAFÉ'), titulos('cafe'));
  assert.ok(titulos('porco').some(t => /Suíno/.test(t)));
  assert.ok(titulos('gado').some(t => /Boi/.test(t)));
  assert.ok(titulos('chocolate').some(t => /Cacau/.test(t)));
  assert.ok(titulos('bois').some(t => /Boi/.test(t)));
});
test('busca: "chicago" leva primeiro à aba da bolsa e o produto acha a cotação de Chicago', () => {
  assert.match(titulos('chicago')[0], /^Chicago · cotações da bolsa/);
  assert.match(titulos('índices da bolsa de chicago')[0], /^Chicago · cotações da bolsa/);
  assert.ok(titulos('soja').includes('Soja · Bolsa de Chicago'));
  assert.ok(titulos('gado chicago').includes('Boi gordo · Bolsa de Chicago'));
});
test('busca: perguntas em linguagem natural acham o termo', () => {
  assert.equal(titulos('o que é hedge?')[0], 'Hedge');
  assert.equal(titulos('qual o preço do dólar hoje')[0], 'Dólar Comercial');
  assert.equal(titulos('juros')[0], 'Selic');
});
test('busca: pedaço no meio da palavra não conta e nada inventado aparece', () => {
  assert.ok(!titulos('so').includes('Peso Argentino'));
  assert.deepEqual(titulos('xyzabc'), []);
  assert.deepEqual(titulos('o que é'), []);
});
test('notícias: busca exige termo de 2 a 60 letras e consulta o Google News com ele', async t => {
  const chamar = async query => {
    const res = { code: 200, status(c) { this.code = c; return this; }, setHeader() {}, json(d) { this.data = d; return this; } };
    await handler({ query }, res); return res;
  };
  assert.equal((await chamar({ feed: 'busca', q: 'a' })).code, 400);
  assert.equal((await chamar({ feed: 'busca', q: 'x'.repeat(61) })).code, 400);
  t.mock.method(globalThis, 'fetch', async url => {
    assert.match(url, /q=soja%20chicago%20when%3A30d/);
    return { ok: true, text: async () => '<item><title>Soja sobe em Chicago - Canal Rural</title><link>https://x</link><pubDate>Thu, 01 Oct 2026 10:00:00 GMT</pubDate></item>' };
  });
  const res = await chamar({ feed: 'busca', q: ' soja chicago ' });
  assert.equal(res.code, 200);
  assert.equal(res.data.items[0].title, 'Soja sobe em Chicago');
});
