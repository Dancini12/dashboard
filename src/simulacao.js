// Simulação "Uma safra na prática" da aba Aprender: o aluno é produtor de soja em Santa Mariana e
// decide, situação por situação, o que fazer. Clima e mercado são sorteados no começo da partida.
// Aqui ficam as contas e os textos; a tela está em components/Aprender.jsx.
import { financiamento, hedge, sacaPorChicago } from './calculos.js';

const ALQUEIRES = 50;
const HA_POR_ALQUEIRE = 2.42;
const AREA = ALQUEIRES * HA_POR_ALQUEIRE; // 121 ha
const CAIXA = 300000;
const PRECO_DA_SEMENTE = 600;      // R$ por saca, 1 saca por hectare
const ADUBO_POR_HA = 0.3;          // toneladas
const PRECO_DO_ADUBO = 3900;       // R$ por tonelada
const OUTROS_CUSTOS_POR_HA = 4230; // defensivos, máquinas, colheita, arrendamento
const PRODUTIVIDADE = 60;          // sacas por hectare em ano normal
const SOJA_NO_PLANTIO = 130;       // R$ por saca
const MESES_ATE_A_COLHEITA = 8;
const MESES_DE_ARMAZEM = 4;
const ARMAZENAGEM = 1.5;           // R$ por saca por mês
const BASE_NA_COLHEITA = 4;        // R$ por saca abaixo da referência, com todo mundo vendendo
const MERCADO = { chicago: 1200, premio: 40, dolar: 5.2, frete: 12, kgDoBushel: 27.21554 };
const TAXAS = { rural: { aoAno: 8 }, pessoal: { aoMes: 2.5 } }; // de exemplo

const reais = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const centavos = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const inteiro = v => Math.round(v).toLocaleString('pt-BR');
const umaCasa = v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

// Clima, preço na colheita e preço na entressafra: sorteados uma vez por partida.
export function sortear(aleatorio = Math.random) {
  return { clima: aleatorio() < 0.35 ? 'seca' : 'normal', mercado: aleatorio() < 0.5 ? 'queda' : 'alta', entressafra: aleatorio() < 0.6 ? 'sobe' : 'cai' };
}

const jurosDe = (custeio, valor, meses) => (custeio === 'rural' ? financiamento({ valor, taxaAoAno: TAXAS.rural.aoAno, meses }).juros
  : custeio === 'pessoal' ? valor * ((1 + TAXAS.pessoal.aoMes / 100) ** meses - 1) : 0);

// Todas as contas da partida a partir das escolhas feitas até agora (as que faltam usam a opção de referência).
export function contas(escolhas, sorteio) {
  const e = { semente: '121', adubo: 'agora', custeio: 'rural', preco: 'conta', vencimento: 'marco', trava: 'metade', colheita: 'tudo', ...escolhas };

  const custoDaSemente = { 121: AREA * PRECO_DA_SEMENTE, 50: 50 * PRECO_DA_SEMENTE + (AREA - 50) * PRECO_DA_SEMENTE * 1.15, 242: 242 * PRECO_DA_SEMENTE }[e.semente];
  const adubo = AREA * ADUBO_POR_HA * PRECO_DO_ADUBO;
  const custoDoAdubo = adubo * { agora: 1, metade: 1.05, esperar: 1.1 }[e.adubo];
  const custoCheio = custoDaSemente + custoDoAdubo + AREA * OUTROS_CUSTOS_POR_HA; // para os 121 hectares

  const areaSemDivida = Math.floor(CAIXA / (custoCheio / AREA)); // hectares que o caixa paga
  const area = e.custeio === 'menos' ? areaSemDivida : AREA;
  const custoDeProducao = custoCheio * area / AREA;
  const divida = Math.max(0, custoDeProducao - CAIXA);
  const caixaDepoisDoPlantio = CAIXA - (custoDeProducao - divida);
  const juros = jurosDe(e.custeio, divida, MESES_ATE_A_COLHEITA);

  const paridade = sacaPorChicago(MERCADO);
  const precoTravado = { aceitar: 118, conta: 129, alto: 126 }[e.preco];
  const esperada = area * PRODUTIVIDADE;
  const travadas = esperada * { nada: 0, metade: 0.5, tudo: 1 }[e.trava];
  const custoDoContrato = travadas * { marco: 0, novembro: 2, julho: 1.5 }[e.vencimento];

  const produtividade = (sorteio.clima === 'seca' ? 46 : PRODUTIVIDADE) - (e.semente === '50' ? 2 : 0);
  const colhidas = area * produtividade;
  const naColheita = sorteio.mercado === 'queda' ? 104 : 150;
  const precoLocal = naColheita - BASE_NA_COLHEITA;
  const emJulho = naColheita + (sorteio.entressafra === 'sobe' ? 10 : -6);
  const guardada = emJulho - ARMAZENAGEM * MESES_DE_ARMAZEM; // o que sobra por saca vendida em julho
  const ajuste = hedge({ sacas: travadas, travado: precoTravado, naColheita }).ajusteDaBolsa;

  // sacas vendidas na colheita: tudo, nada, ou o bastante para quitar a dívida (sem dívida, metade)
  const aPagar = divida + juros;
  const faltaParaADivida = Math.max(0, aPagar - caixaDepoisDoPlantio - (ajuste - custoDoContrato));
  const vendidasNaColheita = e.colheita === 'tudo' ? colhidas : e.colheita === 'guardar' ? 0
    : aPagar > 0 ? Math.min(colhidas, Math.ceil(faltaParaADivida / precoLocal)) : colhidas / 2;
  const vendidasEmJulho = colhidas - vendidasNaColheita;
  const jurosDaRolagem = e.colheita === 'guardar' ? jurosDe(e.custeio, divida, MESES_ATE_A_COLHEITA + MESES_DE_ARMAZEM) - juros : 0;
  const receita = vendidasNaColheita * precoLocal + vendidasEmJulho * emJulho;
  const armazenagem = vendidasEmJulho * ARMAZENAGEM * MESES_DE_ARMAZEM;
  const lucro = receita + ajuste - custoDoContrato - custoDeProducao - juros - jurosDaRolagem - armazenagem;

  return { e, custoDaSemente, custoDoAdubo, adubo, custoCheio, area, areaSemDivida, custoDeProducao, custoPorSaca: custoDeProducao / esperada, divida, caixaDepoisDoPlantio, juros,
    paridade, precoTravado, esperada, travadas, custoDoContrato, produtividade, colhidas, naColheita, precoLocal, emJulho, guardada, ajuste, aPagar,
    vendidasNaColheita, vendidasEmJulho, jurosDaRolagem, receita, armazenagem, lucro, lucroPorAlqueire: lucro / ALQUEIRES };
}

// nivel: 'boa' (boa prática), 'aceitavel' ou 'arriscada'. O retorno explica a consequência com os números da partida.
export const ETAPAS = [
  {
    id: 'semente', quando: 'Agosto', titulo: 'Encomendar a semente',
    situacao: () => ({
      texto: 'Você vai plantar soja nos seus 50 alqueires em Santa Mariana. O vendedor quer saber quantas sacas de semente mandar. A recomendação é de 1 saca por hectare.',
      dados: [['Sua área', '50 alqueires paulistas'], ['Semente', '1 saca por hectare'], ['Preço', `${reais(PRECO_DA_SEMENTE)} por saca`], ['Seu caixa', reais(CAIXA)]],
    }),
    opcoes: () => [['50', '50 sacas'], ['121', '121 sacas'], ['242', '242 sacas']],
    retorno: (c) => ({
      121: { nivel: 'boa', titulo: 'Semente na medida.', texto: `Um alqueire paulista tem 2,42 hectares: 50 × 2,42 = 121 hectares, 121 sacas, ${reais(c.custoDaSemente)}.` },
      50: { nivel: 'arriscada', titulo: 'Faltou semente.', texto: `Você pediu como se alqueire e hectare fossem a mesma coisa. São 121 hectares: faltaram 71 sacas, compradas de última hora 15% mais caras (${reais(c.custoDaSemente - AREA * PRECO_DA_SEMENTE)} a mais), e o plantio atrasou. A lavoura deve render 2 sacas a menos por hectare.` },
      242: { nivel: 'arriscada', titulo: 'Sobrou semente.', texto: `Você usou o alqueire mineiro, de 4,84 hectares. No Paraná vale o paulista, de 2,42: são 121 hectares. Sobraram 121 sacas de semente tratada, que não dá para devolver: ${reais(121 * PRECO_DA_SEMENTE)} parados.` },
    }[c.e.semente]),
    licao: 'Antes de comprar qualquer insumo, converta a área: 1 alqueire paulista = 2,42 hectares.',
  },
  {
    id: 'adubo', quando: 'Agosto', titulo: 'Comprar o adubo',
    situacao: () => ({
      texto: `A lavoura pede 300 kg de adubo por hectare: ${umaCasa(AREA * ADUBO_POR_HA)} toneladas. Comprar já ou esperar para ver se baixa?`,
      dados: [['Adubo hoje', `${reais(PRECO_DO_ADUBO)} por tonelada`], ['Soja hoje', `${reais(SOJA_NO_PLANTIO)} por saca`], ['Relação de troca hoje', `${PRECO_DO_ADUBO / SOJA_NO_PLANTIO} sacas por tonelada`], ['Média dos últimos anos', '34 sacas por tonelada']],
    }),
    opcoes: () => [['agora', 'Comprar tudo agora'], ['metade', 'Comprar metade agora e metade em outubro'], ['esperar', 'Esperar outubro: pode baixar']],
    retorno: (c) => ({
      agora: { nivel: 'boa', titulo: 'Comprou na hora certa.', texto: `${reais(PRECO_DO_ADUBO)} ÷ ${reais(SOJA_NO_PLANTIO)} = 30 sacas por tonelada, abaixo da média de 34: o adubo estava barato em relação à soja. Em outubro o dólar subiu e a tonelada foi a ${reais(PRECO_DO_ADUBO * 1.1)}. Você economizou ${reais(c.adubo * 0.1)}.` },
      metade: { nivel: 'aceitavel', titulo: 'Dividiu o risco.', texto: `Em outubro o dólar subiu e a tonelada foi a ${reais(PRECO_DO_ADUBO * 1.1)}. A metade que ficou para depois custou ${reais(c.adubo * 0.05)} a mais. Com a relação de troca em 30 sacas, abaixo da média de 34, dava para ter comprado tudo.` },
      esperar: { nivel: 'arriscada', titulo: 'Ficou mais caro.', texto: `Em outubro o dólar subiu e a tonelada foi a ${reais(PRECO_DO_ADUBO * 1.1)}: ${reais(c.adubo * 0.1)} a mais. Podia ter baixado, mas com a relação de troca em 30 sacas, abaixo da média de 34, o risco maior era de subir.` },
    }[c.e.adubo]),
    licao: 'Compare o insumo em sacas, não em reais. Relação de troca abaixo da média é sinal de compra.',
  },
  {
    id: 'custeio', quando: 'Setembro', titulo: 'Pagar o plantio',
    situacao: (c) => ({
      texto: `Somando semente, adubo, defensivos, máquinas e arrendamento, a lavoura custa ${reais(c.custoCheio)}. Você tem ${reais(CAIXA)}: faltam ${reais(c.custoCheio - CAIXA)}. O dinheiro da colheita só entra daqui a 8 meses.`,
      dados: [['Custo por hectare', reais(c.custoCheio / AREA)], ['Crédito rural de custeio', '8% ao ano'], ['Empréstimo pessoal', '2,5% ao mês'], ['Prazo', '8 meses']],
    }),
    opcoes: (c) => [['rural', 'Crédito rural de custeio: 8% ao ano, pago depois da colheita'], ['pessoal', 'Empréstimo pessoal no banco: 2,5% ao mês, sai na hora'], ['menos', `Não dever nada: plantar só os ${c.areaSemDivida} hectares que o caixa paga`]],
    retorno: (c) => {
      const falta = c.custoCheio - CAIXA;
      const rural = jurosDe('rural', falta, MESES_ATE_A_COLHEITA), pessoal = jurosDe('pessoal', falta, MESES_ATE_A_COLHEITA);
      return {
        rural: { nivel: 'boa', titulo: 'Juros baixos.', texto: `Em 8 meses, ${reais(falta)} a 8% ao ano custam ${reais(rural)} de juros. No empréstimo pessoal seriam ${reais(pessoal)}.` },
        pessoal: { nivel: 'arriscada', titulo: 'Juros caros.', texto: `2,5% ao mês parece pouco, mas dá 34,5% ao ano. Em 8 meses, ${reais(falta)} custam ${reais(pessoal)} de juros, contra ${reais(rural)} no crédito rural.` },
        menos: { nivel: 'aceitavel', titulo: 'Sem dívida, e com menos lavoura.', texto: `Você plantou ${c.areaSemDivida} dos 121 hectares e não paga juros. Mas ${AREA - c.areaSemDivida} hectares ficam parados: com 60 sacas por hectare e a soja a ${reais(SOJA_NO_PLANTIO)}, são cerca de ${reais((AREA - c.areaSemDivida) * (PRODUTIVIDADE * SOJA_NO_PLANTIO - c.custoCheio / AREA))} de lucro que deixam de entrar, bem mais que os ${reais(rural)} de juros do crédito rural.` },
      }[c.e.custeio];
    },
    licao: 'Compare juros sempre na mesma medida: 2,5% ao mês é mais de quatro vezes 8% ao ano. Taxas de exemplo: as do crédito rural mudam a cada Plano Safra.',
  },
  {
    id: 'preco', quando: 'Outubro', titulo: 'Quanto vale a sua saca',
    situacao: (c) => ({
      texto: `A soja está plantada: ${inteiro(c.area)} hectares. A cooperativa oferece um contrato para entregar em março a R$ 118 por saca. Seu custo está em ${centavos(c.custoPorSaca)} por saca. Antes de responder, olhe o mercado.`,
      dados: [['Chicago, contrato de março', `${inteiro(MERCADO.chicago)} US¢ por bushel`], ['Prêmio no porto', `+${MERCADO.premio} US¢ por bushel`], ['Dólar', centavos(MERCADO.dolar)], ['Frete e custos até o porto', `${reais(MERCADO.frete)} por saca`]],
    }),
    opcoes: () => [['aceitar', 'Fechar a R$ 118: já está acima do meu custo'], ['conta', 'Fazer a conta de Chicago e negociar'], ['alto', 'Pedir R$ 150: Chicago está em 1.200']],
    retorno: (c) => {
      const conta = `${inteiro(MERCADO.chicago)} + ${MERCADO.premio} centavos = US$ 12,40 por bushel. Uma saca de 60 kg tem 2,2 bushels: ${centavos(c.paridade.dolaresPorSaca).replace('R$', 'US$')}. Vezes o dólar de ${centavos(MERCADO.dolar)}: ${centavos(c.paridade.noPorto)} no porto. Menos ${reais(MERCADO.frete)} de frete: ${centavos(c.paridade.naRegiao)} na região.`;
      return {
        conta: { nivel: 'boa', titulo: 'Negociou com a conta na mão.', texto: `${conta} A cooperativa subiu a oferta para R$ 129.` },
        aceitar: { nivel: 'arriscada', titulo: 'Deixou dinheiro na mesa.', texto: `${conta} A R$ 118 você entrega cerca de R$ 12 por saca ao comprador.` },
        alto: { nivel: 'arriscada', titulo: 'Pediu demais.', texto: `Os 1.200 de Chicago são centavos de dólar por bushel, não reais por saca. ${conta} O comprador recusou os R$ 150 e, uma semana depois, com o mercado mais fraco, o melhor que você conseguiu foi R$ 126.` },
      }[c.e.preco];
    },
    licao: 'Chicago mais prêmio, convertido em saca e em reais, menos o frete: essa é a régua para saber se a oferta é justa. A aba Calculadoras faz essa conta.',
  },
  {
    id: 'vencimento', quando: 'Outubro', titulo: 'Escolher o vencimento',
    situacao: (c) => ({
      texto: `O preço combinado é de ${reais(c.precoTravado)} por saca. Para travar esse preço usa-se um contrato futuro, e cada contrato termina em um mês. Sua colheita é em março. Em que vencimento você trava?`,
      dados: [['Plantio', 'outubro'], ['Colheita', 'março'], ['Vencimentos disponíveis', 'novembro, março e julho']],
    }),
    opcoes: () => [['novembro', 'Novembro: é o mais próximo'], ['marco', 'Março: o mês da colheita'], ['julho', 'Julho: quanto mais longe, mais tempo para o preço subir']],
    retorno: (c) => ({
      marco: { nivel: 'boa', titulo: 'Vencimento casado com a colheita.', texto: 'O contrato termina quando a soja está pronta para vender: a trava cobre exatamente o período em que o preço pode cair.' },
      novembro: { nivel: 'arriscada', titulo: 'Venceu antes da colheita.', texto: 'Em novembro a soja ainda está no campo. Para continuar protegido é preciso trocar o contrato por um de março (rolagem), e isso custa: cerca de R$ 2 por saca travada.' },
      julho: { nivel: 'aceitavel', titulo: 'Proteção mais longa que o necessário.', texto: 'Você colhe em março, mas o contrato só termina em julho: são quatro meses a mais com a garantia depositada e com o risco da diferença de preço entre os dois meses. Custa cerca de R$ 1,50 por saca travada.' },
    }[c.e.vencimento]),
    licao: 'O vencimento do contrato deve ser o mês em que o produto vai estar pronto para vender.',
  },
  {
    id: 'trava', quando: 'Outubro', titulo: 'Quanto travar',
    situacao: (c) => ({
      texto: `A lavoura deve render 60 sacas por hectare: ${inteiro(c.esperada)} sacas. Travando a ${reais(c.precoTravado)}, cada saca deixa ${centavos(c.precoTravado - c.custoPorSaca)} de lucro garantido. Só que ninguém sabe como vão estar o clima e o preço em março. Quanto da produção esperada você trava?`,
      dados: [['Produção esperada', `${inteiro(c.esperada)} sacas`], ['Custo', `${centavos(c.custoPorSaca)} por saca`], ['Preço travado', `${reais(c.precoTravado)} por saca`]],
    }),
    opcoes: (c) => [['nada', 'Nada: se o preço subir, o ganho é todo meu'], ['metade', `Metade: ${inteiro(c.esperada / 2)} sacas`], ['tudo', `Tudo: ${inteiro(c.esperada)} sacas`]],
    retorno: (c) => ({
      nada: { nivel: 'arriscada', titulo: 'Tudo por conta do mercado.', texto: `Se o preço subir, o ganho é todo seu. Se cair abaixo de ${centavos(c.custoPorSaca)}, a lavoura dá prejuízo e não há proteção nenhuma.` },
      metade: { nivel: 'boa', titulo: 'Metade com preço garantido.', texto: `${inteiro(c.travadas)} sacas já têm preço: sozinhas elas pagam ${Math.round(c.travadas * c.precoTravado / c.custoDeProducao * 100)}% do custo da lavoura, aconteça o que acontecer. A outra metade fica livre para aproveitar uma alta.` },
      tudo: { nivel: 'aceitavel', titulo: 'Preço garantido para a safra esperada inteira.', texto: `Todas as ${inteiro(c.travadas)} sacas esperadas têm preço. O risco agora é o clima: se a lavoura render menos que o previsto, você terá travado sacas que não vai colher.` },
    }[c.e.trava]),
    licao: 'Hedge não serve para ganhar mais, serve para garantir a conta. Travar uma parte protege o custo sem apostar tudo no clima.',
  },
  {
    id: 'colheita', quando: 'Março', titulo: 'Colheita: vender ou guardar',
    situacao: (c, sorteio) => ({
      texto: [
        sorteio.clima === 'seca' ? `Um veranico em dezembro pegou a lavoura no enchimento dos grãos: ela rendeu ${c.produtividade} sacas por hectare, ${inteiro(c.colhidas)} sacas no total.` : `Choveu na hora certa: a lavoura rendeu ${c.produtividade} sacas por hectare, ${inteiro(c.colhidas)} sacas no total.`,
        sorteio.mercado === 'queda' ? `Com safra cheia no Brasil e nos Estados Unidos, a saca caiu para ${reais(c.naColheita)}.` : `Com quebra de safra na Argentina e o dólar em alta, a saca subiu para ${reais(c.naColheita)}.`,
        c.travadas > 0 ? `Nas ${inteiro(c.travadas)} sacas travadas a ${reais(c.precoTravado)}, a bolsa ${c.ajuste >= 0 ? 'paga a você' : 'cobra de você'} ${reais(Math.abs(c.ajuste))}: a diferença entre o preço travado e o preço de hoje, saca por saca.` : '',
        c.travadas > c.colhidas ? 'Você travou mais sacas do que colheu.' : '',
        `Na colheita todo mundo vende ao mesmo tempo e o comprador da região paga ${reais(BASE_NA_COLHEITA)} abaixo da referência: ${reais(c.precoLocal)} por saca.`,
        c.aPagar > 0 ? `A dívida do plantio, de ${reais(c.aPagar)} com os juros, vence agora.` : '',
      ].filter(Boolean).join(' '),
      dados: [['Colhido', `${inteiro(c.colhidas)} sacas`], ['Preço na região hoje', `${reais(c.precoLocal)} por saca`], ['Armazenagem', `${centavos(ARMAZENAGEM)} por saca por mês`], ['Dívida a pagar', c.aPagar > 0 ? reais(c.aPagar) : 'nenhuma']],
    }),
    opcoes: (c) => [['tudo', 'Vender tudo agora'],
      ['parcial', c.aPagar > 0 ? 'Vender o bastante para pagar a dívida e guardar o resto até julho' : 'Vender metade agora e guardar metade até julho'],
      ['guardar', c.aPagar > 0 ? 'Guardar tudo até julho e adiar a dívida' : 'Guardar tudo até julho']],
    retorno: (c, sorteio) => {
      const julho = sorteio.entressafra === 'sobe' ? `Em julho, na entressafra, a saca foi a ${reais(c.emJulho)}.` : `Em julho a saca estava a ${reais(c.emJulho)}: a colheita do milho e a safra americana seguraram o preço.`;
      const porSaca = c.guardada - c.precoLocal; // ganho por saca guardada, já sem a armazenagem
      const saldo = porSaca >= 0 ? `rendeu ${centavos(porSaca)} a mais por saca` : `rendeu ${centavos(-porSaca)} a menos por saca`;
      return {
        tudo: { nivel: 'aceitavel', titulo: 'Dinheiro na mão.', texto: `Você vendeu ${inteiro(c.colhidas)} sacas a ${reais(c.precoLocal)}${c.aPagar > 0 ? ', pagou a dívida' : ''} e não correu mais risco. ${julho} Descontados R$ 6 de armazenagem, guardar teria ${saldo.replace('rendeu', 'rendido')}.` },
        parcial: { nivel: 'boa', titulo: c.aPagar > 0 ? 'Dívida paga, resto guardado.' : 'Metade vendida, metade guardada.', texto: `Você vendeu ${inteiro(c.vendidasNaColheita)} sacas na colheita${c.aPagar > 0 ? (c.ajuste < 0 ? ' para quitar a dívida e pagar a bolsa' : ' para quitar a dívida') : ''} e guardou ${inteiro(c.vendidasEmJulho)}. ${julho} Descontados R$ 6 de armazenagem, a parte guardada ${saldo}.` },
        guardar: { nivel: 'arriscada', titulo: 'Apostou tudo na entressafra.', texto: `Você guardou ${inteiro(c.colhidas)} sacas por 4 meses${c.jurosDaRolagem > 0 ? ` e adiou a dívida, o que custou mais ${reais(c.jurosDaRolagem)} de juros` : ''}. ${julho} Descontados R$ 6 de armazenagem, cada saca ${saldo} do que na colheita.` },
      }[c.e.colheita];
    },
    licao: 'Na colheita o preço da região costuma ser o mais fraco do ano. Guardar pode render, mas custa armazenagem e juros: primeiro a dívida, depois a aposta.',
  },
];

const BOAS_PRATICAS = { semente: '121', adubo: 'agora', custeio: 'rural', preco: 'conta', vencimento: 'marco', trava: 'metade', colheita: 'parcial' };

// Demonstrativo final, com o que teria acontecido travando nada, metade ou tudo no mesmo sorteio,
// seguindo todas as boas práticas e com o mercado indo para o lado contrário.
export function resultado(escolhas, sorteio) {
  const c = contas(escolhas, sorteio);
  const boas = ETAPAS.filter(etapa => etapa.retorno(c, sorteio).nivel === 'boa').length;
  return {
    ...c, boas,
    linhas: [
      ['Venda da soja', c.receita],
      ...(c.travadas > 0 ? [[c.ajuste >= 0 ? 'Recebido da bolsa pela trava' : 'Pago à bolsa pela trava', c.ajuste]] : []),
      ['Custo de produção', -c.custoDeProducao],
      ...(c.juros + c.jurosDaRolagem > 0 ? [['Juros', -(c.juros + c.jurosDaRolagem)]] : []),
      ...(c.armazenagem > 0 ? [['Armazenagem', -c.armazenagem]] : []),
      ...(c.custoDoContrato > 0 ? [['Custo do vencimento escolhido', -c.custoDoContrato]] : []),
    ],
    comBoasPraticas: contas(BOAS_PRATICAS, sorteio).lucro,
    comOMercadoAoContrario: contas(escolhas, { ...sorteio, mercado: sorteio.mercado === 'queda' ? 'alta' : 'queda' }).lucro,
    comparacao: [['nada', 'Sem travar nada'], ['metade', 'Travando metade'], ['tudo', 'Travando tudo']].map(([trava, nome]) => ({ trava, nome, lucro: contas({ ...escolhas, trava }, sorteio).lucro })),
  };
}
