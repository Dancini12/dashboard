import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerSidra, lerCopom } from '../server/indicadores.js';

const CABECALHO = { NC: 'Nível Territorial (Código)', V: 'Valor', D2C: 'Variável (Código)', D3C: 'Mês (Código)' };
const linha = (D2C, D3C, V) => ({ NC: '1', V, D2C, D3C });

test('IBGE (SIDRA): o mês mais recente da variável pedida, no formato de data do Banco Central', () => {
  const linhas = [CABECALHO, linha('63', '202608', '-0.32'), linha('63', '202609', '0.82'), linha('2265', '202609', '4.58'), linha('63', '202610', '...')];
  assert.deepEqual(lerSidra(linhas, 63), { valor: 0.82, data: '01/09/2026' }, 'mês sem valor ("...") fica de fora');
  assert.deepEqual(lerSidra(linhas, 2265), { valor: 4.58, data: '01/09/2026' });
  assert.equal(lerSidra([CABECALHO], 63), null);
  assert.equal(lerSidra(null, 63), null);
});

test('Copom: a meta da Selic em vigor, com a data de início no horário de Brasília', () => {
  const resposta = { conteudo: [
    { NumeroReuniaoCopom: 281, DataInicioVigencia: '2026-09-17T03:00:00Z', DataFimVigencia: null, MetaSelic: 13.75 },
    { NumeroReuniaoCopom: 280, DataInicioVigencia: '2026-07-30T03:00:00Z', DataFimVigencia: '2026-09-16T03:00:00Z', MetaSelic: 14.25 },
  ] };
  assert.deepEqual(lerCopom(resposta), { value: 13.75, date: '17/09/2026', source: 'Banco Central · Copom (reunião 281)' });
  assert.equal(lerCopom({ conteudo: [] }), null);
});
