// Contas das calculadoras e do simulador de hedge (abas Calculadoras e Aprender).

// Unidades de peso (kg) e de área (hectares) usadas nas conversões.
export const UNIDADES = {
  peso: [
    { id: 'kg', nome: 'quilo (kg)', valor: 1 },
    { id: 'saca60', nome: 'saca de 60 kg', valor: 60 },
    { id: 'saca50', nome: 'saca de 50 kg (arroz)', valor: 50 },
    { id: 'arroba', nome: 'arroba (15 kg)', valor: 15 },
    { id: 't', nome: 'tonelada (1.000 kg)', valor: 1000 },
    { id: 'bushel-soja', nome: 'bushel de soja ou trigo (27,2 kg)', valor: 27.21554 },
    { id: 'bushel-milho', nome: 'bushel de milho (25,4 kg)', valor: 25.40117 },
    { id: 'libra', nome: 'libra-peso (0,454 kg)', valor: 0.45359237 },
    { id: 'cwt', nome: 'cwt (100 libras, 45,4 kg)', valor: 45.359237 },
    { id: 't-curta', nome: 'tonelada curta (907 kg)', valor: 907.18474 },
  ],
  area: [
    { id: 'ha', nome: 'hectare (10.000 m²)', valor: 1 },
    { id: 'alq-paulista', nome: 'alqueire paulista (2,42 ha)', valor: 2.42 },
    { id: 'alq-mineiro', nome: 'alqueire mineiro (4,84 ha)', valor: 4.84 },
    { id: 'm2', nome: 'metro quadrado', valor: 0.0001 },
    { id: 'acre', nome: 'acre (0,405 ha)', valor: 0.40468564 },
  ],
};

// Converte uma quantidade ("10 sacas são quantos kg?") ou um preço por unidade
// ("R$ 130 por saca é quanto por tonelada?"). No preço a conta se inverte.
export function converter(valor, de, para, ehPreco = false) {
  return ehPreco ? valor * para.valor / de.valor : valor * de.valor / para.valor;
}

// Chicago (centavos de dólar por bushel) → reais por saca de 60 kg.
// premio: US¢/bushel pago a mais (ou a menos) no porto; frete: R$/saca do porto até a região.
export function sacaPorChicago({ chicago, premio = 0, dolar, frete = 0, kgDoBushel }) {
  const dolaresPorSaca = (chicago + premio) / 100 * (60 / kgDoBushel);
  const noPorto = dolaresPorSaca * dolar;
  return { dolaresPorSaca, noPorto, naRegiao: noPorto - frete };
}

// Quantas unidades do produto pagam uma unidade do insumo.
export const relacaoDeTroca = (precoDoInsumo, precoDoProduto) => precoDoInsumo / precoDoProduto;

// Lavoura: preço e produtividade que empatam o custo, e o lucro esperado.
export function pontoDeEquilibrio({ custoPorArea, produtividade, preco, area = 1 }) {
  const receitaPorArea = produtividade * preco;
  const lucroPorArea = receitaPorArea - custoPorArea;
  return {
    precoDeEquilibrio: custoPorArea / produtividade,
    produtividadeDeEquilibrio: custoPorArea / preco,
    receitaPorArea, lucroPorArea, lucroTotal: lucroPorArea * area,
    margemPct: receitaPorArea ? lucroPorArea / receitaPorArea * 100 : 0,
  };
}

// Custeio pago de uma vez no vencimento, com juros compostos ao ano.
export function financiamento({ valor, taxaAoAno, meses }) {
  const total = valor * (1 + taxaAoAno / 100) ** (meses / 12);
  return { total, juros: total - valor };
}

// Venda de uma safra com e sem hedge. Com hedge, o produtor vende no físico pelo preço do dia
// e recebe (ou paga) na bolsa a diferença entre o preço travado e o preço do dia.
export function hedge({ sacas, travado, naColheita, custoPorSaca = 0 }) {
  const fisico = sacas * naColheita;
  const ajusteDaBolsa = sacas * (travado - naColheita);
  const custo = sacas * custoPorSaca;
  return { semHedge: fisico, comHedge: fisico + ajusteDaBolsa, fisico, ajusteDaBolsa, lucroSemHedge: fisico - custo, lucroComHedge: fisico + ajusteDaBolsa - custo };
}

// Faixa de um preço entre o menor e o maior do dia: o terço de baixo é "barato", o de cima é
// "caro" e o resto fica no "meio". Com todos os preços iguais, todos ficam no meio.
export function faixaDePreco(valor, menor, maior) {
  if (maior <= menor) return 'meio';
  const posicao = (valor - menor) / (maior - menor);
  return posicao < 1 / 3 ? 'barato' : posicao > 2 / 3 ? 'caro' : 'meio';
}
