import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNIDADES, converter, sacaPorChicago, relacaoDeTroca, pontoDeEquilibrio, financiamento, hedge, faixaDePreco } from '../src/calculos.js';

const u = (grupo, id) => UNIDADES[grupo].find(x => x.id === id);
const perto = (a, b, casas = 2) => assert.equal(a.toFixed(casas), b.toFixed(casas));

test('calculadoras: conversão de quantidade e de preço (que se inverte)', () => {
  assert.equal(converter(10, u('peso', 'saca60'), u('peso', 'kg')), 600);
  assert.equal(converter(3000, u('peso', 'kg'), u('peso', 'arroba')), 200);
  perto(converter(130, u('peso', 'saca60'), u('peso', 't'), true), 2166.67); // R$ 130/saca = R$ 2.166,67/t
  perto(converter(10, u('area', 'alq-paulista'), u('area', 'ha')), 24.2);
  perto(converter(150, u('area', 'alq-paulista'), u('area', 'ha'), true), 61.98); // 150 sc/alqueire = 61,98 sc/ha
});
test('calculadoras: saca de soja a partir de Chicago, prêmio, dólar e frete', () => {
  const r = sacaPorChicago({ chicago: 1275.5, premio: 50, dolar: 5.2, frete: 12, kgDoBushel: 27.21554 });
  perto(r.dolaresPorSaca, 13.255 * 60 / 27.21554);
  perto(r.noPorto, r.dolaresPorSaca * 5.2);
  perto(r.naRegiao, r.noPorto - 12);
  perto(sacaPorChicago({ chicago: 1275.5, dolar: 5.2, kgDoBushel: 27.21554 }).noPorto, 146.22);
});
test('calculadoras: relação de troca, ponto de equilíbrio e financiamento', () => {
  assert.equal(relacaoDeTroca(3900, 130), 30); // 30 sacas pagam a tonelada de adubo
  const pe = pontoDeEquilibrio({ custoPorArea: 6000, produtividade: 60, preco: 130, area: 50 });
  assert.equal(pe.precoDeEquilibrio, 100);
  perto(pe.produtividadeDeEquilibrio, 46.15);
  assert.equal(pe.lucroPorArea, 1800);
  assert.equal(pe.lucroTotal, 90000);
  perto(pe.margemPct, 23.08);
  const f = financiamento({ valor: 100000, taxaAoAno: 8, meses: 12 });
  perto(f.total, 108000); perto(f.juros, 8000);
  perto(financiamento({ valor: 100000, taxaAoAno: 8, meses: 6 }).total, 103923.05);
});
test('hedge: com o preço travado a receita não muda, suba ou caia o mercado', () => {
  const caiu = hedge({ sacas: 1000, travado: 130, naColheita: 100, custoPorSaca: 90 });
  assert.equal(caiu.semHedge, 100000);
  assert.equal(caiu.comHedge, 130000);
  assert.equal(caiu.ajusteDaBolsa, 30000);
  assert.equal(caiu.lucroComHedge, 40000);
  const subiu = hedge({ sacas: 1000, travado: 130, naColheita: 160 });
  assert.equal(subiu.semHedge, 160000);
  assert.equal(subiu.comHedge, 130000, 'quem travou não ganha a alta');
  assert.equal(subiu.ajusteDaBolsa, -30000);
});
test('mapa de preços: terço de baixo é barato, terço de cima é caro, o resto fica no meio', () => {
  const faixas = valores => valores.map(v => faixaDePreco(v, Math.min(...valores), Math.max(...valores)));
  assert.deepEqual(faixas([138, 139, 140, 140.3, 141, 141.2]), ['barato', 'barato', 'meio', 'caro', 'caro', 'caro']);
  assert.deepEqual(faixas([100, 110, 120, 130]), ['barato', 'meio', 'meio', 'caro']);
  assert.deepEqual(faixas([139, 139, 139]), ['meio', 'meio', 'meio'], 'todos iguais: ninguém é mais caro nem mais barato');
  assert.deepEqual(faixas([7.5, 9]), ['barato', 'caro']);
});
