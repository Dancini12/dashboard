import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ultimoBoletim } from '../server/emater.js';

test('Emater: o boletim mais recente da página, mesmo fora de ordem e virando o ano', () => {
  const html = ['preco_08102026', 'preco_15102026', 'preco_24122025', 'preco_01102026']
    .map(n => `<a href="https://www.emater.tche.br/site/arquivos_pdf/precos/${n}.pdf">x</a>`).join('');
  assert.equal(ultimoBoletim(html), 'https://www.emater.tche.br/site/arquivos_pdf/precos/preco_15102026.pdf');
  assert.equal(ultimoBoletim('<p>sem boletins</p>'), null);
});
