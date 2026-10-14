import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// src/historicoCepea.json é gerado por scripts/historico-cepea.py e lido pela aba Evolução, pelo
// comparador e pelo assistente: confere que tem a forma que eles esperam.
const historico = JSON.parse(readFileSync(new URL('../src/historicoCepea.json', import.meta.url)));

test('histórico do CEPEA: um ano por linha, de 2020 até o ano do último dia publicado', () => {
  const anos = historico.anos.map(linha => Number(linha.ano));
  assert.equal(anos[0], 2020);
  anos.forEach((ano, i) => i && assert.equal(ano, anos[i - 1] + 1, 'sem ano faltando'));
  assert.match(historico.ultimoDia, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(anos.at(-1), Number(historico.ultimoDia.slice(0, 4)), 'a última linha é o ano corrente');
});

test('histórico do CEPEA: todo produto tem nome, unidade, último preço e média em todos os anos', () => {
  const chaves = Object.keys(historico.series);
  assert.deepEqual(chaves, ['boi', 'soja', 'milho', 'cafe', 'trigo']);
  for (const chave of chaves) {
    const serie = historico.series[chave];
    assert.ok(serie.nome && serie.unidade, chave);
    assert.ok(serie.ultimo.valor > 0 && serie.ultimo.data <= historico.ultimoDia, chave);
    for (const linha of historico.anos) assert.ok(linha[chave] > 0, `${chave} em ${linha.ano}`);
  }
});
