import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/market.js';

async function call(query) {
  const res = { code: 200, status(code) { this.code = code; return this; }, setHeader() {}, json(data) { this.data = data; return this; } };
  await handler({ query }, res);
  return res;
}
test('rejeita ticker inválido antes de acessar a fonte', async () => {
  const res = await call({ type: 'stock', symbol: '../secret' });
  assert.equal(res.code, 400);
});
test('consulta a meta Selic anual, preservando a data da fonte', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    assert.match(url, /sgs\.432\/dados\/ultimos\/1/);
    return { ok: true, json: async () => [{ data: '16/09/2026', valor: '14.00' }] };
  });
  const res = await call({ type: 'selic' });
  assert.equal(res.data.value, 14);
  assert.equal(res.data.date, '16/09/2026');
});
test('rejeita respostas vazias em vez de fabricar preços', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => [] }));
  assert.equal((await call({ type: 'selic' })).code, 502);
  assert.equal((await call({ type: 'stock', symbol: 'PETR4' })).code, 502);
});
test('sinaliza autorização ausente para ações restritas', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 401 }));
  const res = await call({ type: 'stock', symbol: 'BBAS3' });
  assert.equal(res.code, 403);
  assert.match(res.data.error, /BRAPI_TOKEN/);
});
test('mantém preço, moeda e horário informados pela BRAPI', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ results: [{ symbol: 'PETR4', regularMarketPrice: 50.43, currency: 'BRL', regularMarketTime: '2026-09-15T20:00:00Z' }] }) }));
  const res = await call({ type: 'stock', symbol: 'PETR4' });
  assert.equal(res.code, 200);
  assert.equal(res.data.value, 50.43);
  assert.equal(res.data.currency, 'BRL');
});
test('lê a tabela de cotação de commodity do widget', async t => {
  const html = `<div class="na-cotacoes"><table class="na-tabela"><thead><tr class="linhapar"><th colspan="3">
    <div class="na-titulo">Indicador da Soja Cepea/Esalq - Paraná<br /><span class="na-fonte">Fonte: Cepea/Esalq</span></div></th></tr>
    <tr class="na-rotulo"><th>Data</th><th>Valor R$/ Saca de 60 kg</th><th>Variação (%)</th></tr></thead>
    <tbody><tr ><td class="na-pri" > 25/09/2026 </td><td > 154,38 </td><td > -0,47% </td></tr></tbody>
    <tfoot><tr><td colspan="3"><a href="#"><img src="x.png" /></a><div style="float:left"> Fech. 25/09/2026 </div></td></tr></tfoot></table></div>`;
  t.mock.method(globalThis, 'fetch', async url => {
    assert.match(url, /widgets\/cotacoes\?id=26$/);
    return { ok: true, text: async () => html };
  });
  const res = await call({ type: 'commodity', id: '26' });
  assert.equal(res.code, 200);
  assert.equal(res.data.titulo, 'Indicador da Soja Cepea/Esalq - Paraná');
  assert.equal(res.data.fonte, 'Cepea/Esalq');
  assert.deepEqual(res.data.colunas, ['Data', 'Valor R$/ Saca de 60 kg', 'Variação (%)']);
  assert.deepEqual(res.data.linhas, [['25/09/2026', '154,38', '-0,47%']]);
  assert.equal(res.data.rodape, 'Fech. 25/09/2026');
});
test('rejeita commodity inválida e widget vazio', async t => {
  assert.equal((await call({ type: 'commodity', id: '../x' })).code, 400);
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, text: async () => '<html></html>' }));
  assert.equal((await call({ type: 'commodity', id: '26' })).code, 502);
});
