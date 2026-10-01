import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerCombustiveis, planilhasDaPagina } from '../server/combustiveis.js';

const CABECALHO = ['DATA INICIAL', 'DATA FINAL', 'X', 'Y', 'PRODUTO', 'NÚMERO DE POSTOS PESQUISADOS', 'UNIDADE DE MEDIDA', 'PREÇO MÉDIO REVENDA', 'DESVIO PADRÃO REVENDA', 'PREÇO MÍNIMO REVENDA', 'PREÇO MÁXIMO REVENDA'];
const de = new Date('2026-09-20T00:00:00Z'), ate = new Date('2026-09-26T00:00:00Z');
const aba = (sheet, colunas, linhas) => ({ sheet, data: [['TIPO RELATÓRIO', null, null, null, 'OBS: ATUALMENTE, O PRODUTO...'], [], CABECALHO.map((c, i) => colunas[i] ?? c), ...linhas] });
const abas = [
  { sheet: 'BRASIL', data: [['TIPO'], [], ['DATA INICIAL', 'DATA FINAL', 'BRASIL', 'PRODUTO', 'NÚMERO DE POSTOS PESQUISADOS', 'UNIDADE DE MEDIDA', 'PREÇO MÉDIO REVENDA'],
    [de, ate, 'BRASIL', 'OLEO DIESEL S10', 3147, 'R$/l', 7.33], [de, ate, 'BRASIL', 'GLP', 3301, 'R$/13kg', 114.8]] },
  aba('ESTADOS', { 2: 'REGIAO', 3: 'ESTADOS' }, [[de, ate, 'SUL', 'PARANA', 'OLEO DIESEL S10', 197, 'R$/l', 7.28, 0.3, 6.49, 8.4], [de, ate, 'SUL', 'SANTA CATARINA', 'OLEO DIESEL S10', 90, 'R$/l', 7.5, 0.3, 7, 8]]),
  aba('MUNICIPIOS', { 2: 'ESTADO', 3: 'MUNICÍPIO' }, [
    [de, ate, 'PARANA', 'LONDRINA', 'OLEO DIESEL S10', 8, 'R$/l', 7.43, 0.4, 6.87, 7.99],
    [de, ate, 'PARANA', 'CORNELIO PROCOPIO', 'OLEO DIESEL S10', 2, 'R$/l', 7.81, 0.03, 7.79, 7.84],
    [de, ate, 'SAO PAULO', 'OURINHOS', 'OLEO DIESEL S10', 5, 'R$/l', 7.1, 0.2, 6.9, 7.3],
  ]),
];

test('combustíveis: preço do Paraná, do Brasil e das cidades paranaenses, com o nome acentuado', () => {
  const r = lerCombustiveis(abas);
  assert.equal(r.de, '2026-09-20'); assert.equal(r.ate, '2026-09-26');
  assert.deepEqual(r.produtos.map(p => p.nome), ['Diesel S10'], 'só os produtos pesquisados no Paraná');
  const [diesel] = r.produtos;
  assert.deepEqual(diesel.parana, { medio: 7.28, minimo: 6.49, maximo: 8.4, postos: 197 });
  assert.equal(diesel.brasil, 7.33);
  assert.deepEqual(diesel.cidades.map(c => [c.cidade, c.medio]), [['Cornélio Procópio', 7.81], ['Londrina', 7.43]]);
});
test('combustíveis: escolhe na página as planilhas mais recentes, sem repetir', () => {
  const base = 'https://www.gov.br/anp/pt-br/assuntos/precos/arquivos-lpc/2026/';
  const html = `<a href="${base}resumo_semanal_lpc_2026-09-13_2026-09-19.xlsx">a</a><a href="${base}revendas_lpc_2026-09-20_2026-09-26.xlsx">b</a>`
    + `<a href="${base}resumo_semanal_lpc_2026-09-20_2026-09-26.xlsx">c</a><a href="${base}resumo_semanal_lpc_2026-09-20_2026-09-26.xlsx">c</a>`;
  assert.deepEqual(planilhasDaPagina(html), [`${base}resumo_semanal_lpc_2026-09-20_2026-09-26.xlsx`, `${base}resumo_semanal_lpc_2026-09-13_2026-09-19.xlsx`]);
});
