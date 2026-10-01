import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ETAPAS, contas, resultado, sortear } from '../src/simulacao.js';

const perto = (a, b) => assert.ok(Math.abs(a - b) < 1, `${a} ≠ ${b}`);
const NORMAL_QUEDA = { clima: 'normal', mercado: 'queda', entressafra: 'sobe' };
const SECA_ALTA = { clima: 'seca', mercado: 'alta', entressafra: 'cai' };

test('simulação: com as boas práticas e o preço em queda, a trava garante o lucro', () => {
  const c = contas({ semente: '121', adubo: 'agora', custeio: 'rural', preco: 'conta', vencimento: 'marco', trava: 'metade', colheita: 'tudo' }, NORMAL_QUEDA);
  assert.equal(c.area, 121); assert.equal(c.custoDeProducao, 726000); assert.equal(c.divida, 426000);
  perto(c.juros, 426000 * (1.08 ** (8 / 12) - 1));
  perto(c.paridade.naRegiao, 130.15);
  assert.equal(c.colhidas, 7260); assert.equal(c.travadas, 3630);
  assert.equal(c.ajuste, 3630 * (129 - 104));
  assert.equal(c.receita, 7260 * 100, 'preço da região: R$ 4 abaixo da referência');
  perto(c.lucro, 726000 + 90750 - 726000 - c.juros);
  const r = resultado(c.e, NORMAL_QUEDA);
  assert.equal(r.boas, 6, 'vender tudo na colheita é aceitável, não a boa prática');
  assert.ok(r.comparacao[2].lucro > r.comparacao[1].lucro && r.comparacao[1].lucro > r.comparacao[0].lucro, 'na queda, quanto mais travado, melhor');
  perto(r.linhas.reduce((t, [, v]) => t + v, 0), r.lucro);
  perto(r.comOMercadoAoContrario, contas(c.e, { ...NORMAL_QUEDA, mercado: 'alta' }).lucro);
});
test('simulação: quem arrisca tudo ganha na alta e perde na queda; as boas práticas dão lucro nos dois casos', () => {
  const arriscado = { semente: '50', adubo: 'esperar', custeio: 'pessoal', preco: 'aceitar', vencimento: 'novembro', trava: 'nada', colheita: 'guardar' };
  const naAlta = resultado(arriscado, { clima: 'normal', mercado: 'alta', entressafra: 'sobe' });
  assert.ok(naAlta.lucro > 0 && naAlta.comOMercadoAoContrario < 0, 'o mesmo jogo vira prejuízo se o preço cair');
  assert.ok(naAlta.comBoasPraticas > naAlta.lucro, 'mesmo na alta, as boas práticas rendem mais que o conjunto de erros');
  for (const mercado of ['queda', 'alta']) for (const entressafra of ['sobe', 'cai']) assert.ok(resultado({}, { clima: 'normal', mercado, entressafra }).comBoasPraticas > 0);
});
test('simulação: erros de unidade, juros ao mês e trava total com seca e alta custam caro', () => {
  const c = contas({ semente: '50', adubo: 'esperar', custeio: 'pessoal', preco: 'aceitar', vencimento: 'novembro', trava: 'tudo', colheita: 'guardar' }, SECA_ALTA);
  assert.equal(c.produtividade, 44, 'seca (46) e plantio atrasado (−2)');
  assert.equal(c.colhidas, 121 * 44);
  assert.equal(c.ajuste, 7260 * (118 - 150), 'travou sacas que não colheu e o preço subiu');
  assert.equal(c.custoDoContrato, 7260 * 2);
  perto(c.juros, c.divida * (1.025 ** 8 - 1));
  perto(c.jurosDaRolagem, c.divida * (1.025 ** 12 - 1.025 ** 8));
  assert.equal(c.vendidasEmJulho, c.colhidas);
  assert.equal(c.emJulho, 144);
  assert.ok(c.lucro < 0);
  assert.equal(resultado(c.e, SECA_ALTA).boas, 0);
});
test('simulação: sem dívida planta só o que o caixa paga; com dívida, vende na colheita o bastante para quitá-la', () => {
  const semDivida = contas({ custeio: 'menos', colheita: 'parcial' }, NORMAL_QUEDA);
  assert.equal(semDivida.area, 50); assert.equal(semDivida.divida, 0); assert.equal(semDivida.juros, 0);
  assert.equal(semDivida.vendidasNaColheita, semDivida.colhidas / 2);
  assert.equal(contas({ semente: '242', custeio: 'menos' }, NORMAL_QUEDA).divida, 0, 'semente a mais reduz a área que o caixa paga, sem criar dívida');
  const comDivida = contas({ trava: 'nada', colheita: 'parcial' }, NORMAL_QUEDA);
  assert.equal(comDivida.vendidasNaColheita, Math.ceil(comDivida.aPagar / 100));
  perto(comDivida.receita, comDivida.vendidasNaColheita * 100 + comDivida.vendidasEmJulho * 114);
  assert.equal(comDivida.armazenagem, comDivida.vendidasEmJulho * 6);
});
test('simulação: toda opção de toda situação tem retorno completo, em qualquer sorteio', () => {
  const sorteios = ['normal', 'seca'].flatMap(clima => ['queda', 'alta'].flatMap(mercado => ['sobe', 'cai'].map(entressafra => ({ clima, mercado, entressafra }))));
  assert.equal(ETAPAS.length, 7);
  for (const sorteio of sorteios) for (const etapa of ETAPAS) {
    const antes = contas({}, sorteio);
    const situacao = etapa.situacao(antes, sorteio);
    assert.ok(situacao.texto.length > 40 && situacao.dados.length >= 3, etapa.id);
    const opcoes = etapa.opcoes(antes, sorteio);
    assert.equal(opcoes.length, 3, etapa.id);
    const niveis = opcoes.map(([id]) => {
      const r = etapa.retorno(contas({ [etapa.id]: id }, sorteio), sorteio);
      assert.ok(r && r.titulo && r.texto.length > 40, `${etapa.id}/${id}`);
      assert.doesNotMatch(`${situacao.texto} ${r.texto} ${opcoes.flat().join(' ')}`, /undefined|NaN|null/, `${etapa.id}/${id}`);
      return r.nivel;
    });
    assert.equal(niveis.filter(n => n === 'boa').length, 1, `${etapa.id}: uma boa prática por situação`);
    assert.ok(niveis.every(n => ['boa', 'aceitavel', 'arriscada'].includes(n)));
  }
});
test('simulação: sorteio depende só do gerador recebido', () => {
  const fixo = valores => { let i = 0; return () => valores[i++]; };
  assert.deepEqual(sortear(fixo([0.1, 0.2, 0.3])), { clima: 'seca', mercado: 'queda', entressafra: 'sobe' });
  assert.deepEqual(sortear(fixo([0.9, 0.9, 0.9])), { clima: 'normal', mercado: 'alta', entressafra: 'cai' });
});
