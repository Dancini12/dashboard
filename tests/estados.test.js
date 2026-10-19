import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerFamasul } from '../server/famasul.js';
import { lerResultado, juntarDias, diasUteis } from '../server/iea.js';

const tabela = (titulo, linhas) => `<table class="views-table"><caption>${titulo}</caption><thead><tr><th>Data</th><th>Praça</th><th>Valor</th></tr></thead><tbody>${
  linhas.map(l => `<tr>${l.map(c => `<td> ${c} </td>`).join('')}</tr>`).join('')}</tbody></table>`;

test('Famasul: a data mais recente de cada tabela, a média do estado e a variação de cada praça', () => {
  const html = tabela('@Boi', [
    ['15/10/2026', 'Região Centro', 'R$ 363.97', '370.00'], ['15/10/2026', 'Mato Grosso do Sul', 'R$ 363.42', '369.45'],
    ['14/10/2026', 'Região Centro', 'R$ 359.05', '365.00'], ['14/10/2026', 'Mato Grosso do Sul', 'R$ 361.10', '367.00'],
  ]) + tabela('Saca - Soja', [
    ['15/10/2026', 'Dourados', 'R$ 138.00'], ['15/10/2026', 'Campo Grande', 'R$ 140.50'], ['13/10/2026', 'Dourados', 'R$ 137.00'],
  ]);
  const [soja, boi] = lerFamasul(html);
  assert.equal(soja.nome, 'Soja'); assert.equal(soja.data, '2026-10-15'); assert.equal(soja.mediaEstado, null, 'sem linha do estado, sem média');
  assert.deepEqual(soja.locais, [{ nome: 'Campo Grande', valor: 140.5, variacao: null }, { nome: 'Dourados', valor: 138, variacao: 0.73 }]);
  assert.equal(boi.unidade, 'arroba'); assert.equal(boi.mediaEstado, 363.42); assert.equal(boi.comFunruralEstado, 369.45);
  assert.equal(boi.variacaoEstado, 0.64);
  assert.deepEqual(boi.locais.map(l => [l.nome, l.valor, l.variacao]), [['Região Centro', 363.97, 1.37]]);
});

test('IEA: o preço mais recente de cada regional, juntando vários dias', () => {
  const resultado = dia => `<table><tr><th>Grupo</th><th>Produto</th></tr>${dia.map(([produto, edr, data, preco, unidade]) =>
    `<tr><td>VEGETAL</td><td>${produto}</td><td>${edr}</td><td>${data}</td><td class="text-right">${preco}</td><td>${unidade}</td><td></td></tr>`).join('')}</table>`;
  const linhas = [
    ...lerResultado(resultado([['Soja', 'Assis', '15/10/2026', '139,75', 'sc.60 kg'], ['Soja', 'Avar&#xE9;', '16/10/2026', '145,00', 'sc.60 kg']])),
    ...lerResultado(resultado([['Soja', 'Assis', '13/10/2026', '134,00', 'sc.60 kg'], ['Café benef. tipo 6 duro', 'Franca', '13/10/2026', '1.850,00', 'sc.60 kg']])),
  ];
  const [soja, cafe] = juntarDias(linhas);
  assert.equal(soja.unidade, 'saca de 60 kg'); assert.equal(soja.data, '2026-10-16'); assert.equal(soja.desde, '2026-10-15');
  assert.deepEqual(soja.locais, [{ nome: 'Assis', valor: 139.75, data: '2026-10-15' }, { nome: 'Avaré', valor: 145, data: '2026-10-16' }]);
  assert.equal(cafe.nome, 'Café'); assert.equal(cafe.locais[0].valor, 1850, 'milhar com ponto');
});

test('IEA: os últimos dias úteis, sem sábado e domingo', () => {
  assert.deepEqual(diasUteis(new Date('2026-10-19T12:00:00-03:00'), 5), ['19/10/2026', '16/10/2026', '15/10/2026', '14/10/2026', '13/10/2026']);
});
