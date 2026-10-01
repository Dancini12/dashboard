// Listas de produtos usadas pelas abas e pela busca do topo do site.

// Cotações do Painel (widgets do Notícias Agrícolas): [id do widget, nome, mercado].
export const COMMODITIES = [
  ['26', 'Soja · Paraná', 'Brasil'], ['121', 'Soja · Paranaguá', 'Brasil'],
  ['91', 'Milho · ESALQ/B3', 'Brasil'], ['12', 'Boi gordo · ESALQ/B3', 'Brasil'],
  ['29', 'Café arábica · CEPEA', 'Brasil'], ['31', 'Café robusta · CEPEA', 'Brasil'],
  ['211', 'Trigo · CEPEA', 'Brasil'], ['210', 'Suíno vivo · CEPEA', 'Brasil'],
  ['155', 'Leite · produtor', 'Brasil'], ['84', 'Algodão · CEPEA', 'Brasil'],
  ['288', 'Feijão carioca · CEPEA/CNA', 'Brasil'], ['201', 'Laranja · indústria', 'Brasil'],
  ['23', 'Soja · Chicago', 'Internacional'], ['10', 'Milho · Chicago', 'Internacional'],
  ['78', 'Trigo · Chicago', 'Internacional'], ['4', 'Café · Nova Iorque', 'Internacional'],
  ['5', 'Café · Londres', 'Internacional'], ['55', 'Algodão · Nova Iorque', 'Internacional'],
  ['53', 'Cacau · Nova Iorque', 'Internacional'], ['13', 'Suco de laranja · Nova Iorque', 'Internacional'],
];

// kg = quanto pesa a unidade de cotação; serve para converter o preço em US$ por tonelada e por kg.
// Unidades começando com US¢ são cotadas em centavos de dólar.
export const FUTURES = [
  { key: 'milho', name: 'Milho', emoji: '🌽', group: 'Grãos e oleaginosas', symbol: 'ZC=F', exchange: 'CBOT', unit: 'US¢/bushel', kg: 25.40117, cotacao: 'centavos de dólar por bushel (1 bushel de milho = 25,4 kg)', b3: 'CCM — Milho B3', explanation: 'O CCM brasileiro é cotado em reais por saca de 60 kg. Chicago é uma referência internacional e pode divergir conforme região, safra, câmbio e frete.' },
  { key: 'soja', name: 'Soja', emoji: '🌱', group: 'Grãos e oleaginosas', symbol: 'ZS=F', exchange: 'CBOT', unit: 'US¢/bushel', kg: 27.21554, cotacao: 'centavos de dólar por bushel (1 bushel de soja = 27,2 kg)', b3: 'SJC — Soja CME/B3', explanation: 'Câmbio, prêmio portuário, localização e frete explicam a diferença entre Chicago e o preço em reais por saca.' },
  { key: 'farelo', name: 'Farelo de soja', emoji: '🫘', group: 'Grãos e oleaginosas', symbol: 'ZM=F', exchange: 'CBOT', unit: 'US$/tonelada curta', kg: 907.18474, cotacao: 'dólares por tonelada curta (1 tonelada curta = 2.000 libras = 907 kg)', b3: 'Referência internacional', explanation: 'O farelo vai para a ração animal. No Brasil, o preço depende do câmbio, do frete e da oferta das indústrias esmagadoras.' },
  { key: 'oleo', name: 'Óleo de soja', emoji: '🫗', group: 'Grãos e oleaginosas', symbol: 'ZL=F', exchange: 'CBOT', unit: 'US¢/libra-peso', kg: 0.45359237, cotacao: 'centavos de dólar por libra-peso (1 libra-peso = 0,454 kg)', b3: 'Referência internacional', explanation: 'Acompanha a demanda por óleo de cozinha e biodiesel. No Brasil, câmbio e a mistura obrigatória de biodiesel pesam no preço.' },
  { key: 'trigo', name: 'Trigo (Chicago · SRW)', emoji: '🌾', group: 'Grãos e oleaginosas', symbol: 'ZW=F', exchange: 'CBOT', unit: 'US¢/bushel', kg: 27.21554, cotacao: 'centavos de dólar por bushel (1 bushel de trigo = 27,2 kg)', b3: 'Referência física regional', explanation: 'Trigo mole de inverno (SRW). Qualidade, origem, câmbio e importações influenciam fortemente o preço brasileiro.' },
  { key: 'trigo-hrw', name: 'Trigo (Kansas · HRW)', emoji: '🌾', group: 'Grãos e oleaginosas', symbol: 'KE=F', exchange: 'CBOT', unit: 'US¢/bushel', kg: 27.21554, cotacao: 'centavos de dólar por bushel (1 bushel de trigo = 27,2 kg)', b3: 'Referência física regional', explanation: 'Trigo duro de inverno (HRW), mais usado para pão. No Brasil, o preço segue a qualidade do grão, o câmbio e o trigo importado.' },
  { key: 'aveia', name: 'Aveia', emoji: '🥣', group: 'Grãos e oleaginosas', symbol: 'ZO=F', exchange: 'CBOT', unit: 'US¢/bushel', kg: 14.51495, cotacao: 'centavos de dólar por bushel (1 bushel de aveia = 14,5 kg)', b3: 'Referência física regional', explanation: 'No Sul do Brasil a aveia é cotada em reais por saca e depende muito da safra de inverno local.' },
  { key: 'arroz', name: 'Arroz em casca', emoji: '🍚', group: 'Grãos e oleaginosas', symbol: 'ZR=F', exchange: 'CBOT', unit: 'US$/cwt', kg: 45.359237, cotacao: 'dólares por cwt (1 cwt = 100 libras = 45,4 kg)', b3: 'Referência física regional', explanation: 'No Brasil, o arroz em casca é cotado em reais por saca de 50 kg, principalmente no Rio Grande do Sul. Clima e câmbio influenciam.' },
  { key: 'cafe', name: 'Café arábica', emoji: '☕', group: 'Café, açúcar, algodão e outros', symbol: 'KC=F', exchange: 'ICE US', unit: 'US¢/libra-peso', kg: 0.45359237, cotacao: 'centavos de dólar por libra-peso (1 libra-peso = 0,454 kg)', b3: 'ICF — Café Arábica B3', explanation: 'Tipo, bebida, peneira, certificação, câmbio e praça de entrega alteram o valor recebido pelo produtor.' },
  { key: 'acucar', name: 'Açúcar', emoji: '🧊', group: 'Café, açúcar, algodão e outros', symbol: 'SB=F', exchange: 'ICE US', unit: 'US¢/libra-peso', kg: 0.45359237, cotacao: 'centavos de dólar por libra-peso (1 libra-peso = 0,454 kg)', b3: 'Referência internacional', explanation: 'A cotação é do açúcar bruto internacional; não equivale diretamente ao preço da cana ou do açúcar doméstico.' },
  { key: 'algodao', name: 'Algodão', emoji: '☁️', group: 'Café, açúcar, algodão e outros', symbol: 'CT=F', exchange: 'ICE US', unit: 'US¢/libra-peso', kg: 0.45359237, cotacao: 'centavos de dólar por libra-peso de pluma (1 libra-peso = 0,454 kg)', b3: 'Referência internacional', explanation: 'Qualidade da pluma, câmbio, prêmio ou deságio e custos de exportação determinam o preço local.' },
  { key: 'cacau', name: 'Cacau', emoji: '🍫', group: 'Café, açúcar, algodão e outros', symbol: 'CC=F', exchange: 'ICE US', unit: 'US$/tonelada', kg: 1000, cotacao: 'dólares por tonelada métrica (1.000 kg)', b3: 'Referência internacional', explanation: 'O cacau da Bahia e do Pará segue Nova Iorque e Londres convertidos pelo câmbio, com prêmio ou desconto pela qualidade da amêndoa.' },
  { key: 'suco', name: 'Suco de laranja', emoji: '🍊', group: 'Café, açúcar, algodão e outros', symbol: 'OJ=F', exchange: 'ICE US', unit: 'US¢/libra-peso', kg: 0.45359237, cotacao: 'centavos de dólar por libra-peso de suco concentrado congelado (1 libra-peso = 0,454 kg)', b3: 'Referência internacional', explanation: 'O Brasil é o maior exportador de suco de laranja. A caixa de laranja paga ao produtor (40,8 kg) acompanha em parte este contrato.' },
  { key: 'boi', name: 'Boi gordo', emoji: '🐂', group: 'Pecuária e leite', symbol: 'LE=F', exchange: 'CME', unit: 'US¢/libra-peso', kg: 0.45359237, cotacao: 'centavos de dólar por libra-peso de peso vivo (1 libra-peso = 0,454 kg)', b3: 'BGI — Boi Gordo B3', explanation: 'O contrato americano reflete outro mercado. No Brasil, o boi é cotado em reais por arroba (15 kg); use o BGI e o preço da sua praça como referências principais.' },
  { key: 'boi-reposicao', name: 'Boi de reposição', emoji: '🐄', group: 'Pecuária e leite', symbol: 'GF=F', exchange: 'CME', unit: 'US¢/libra-peso', kg: 0.45359237, cotacao: 'centavos de dólar por libra-peso de peso vivo (1 libra-peso = 0,454 kg)', b3: 'Referência física regional', explanation: 'São bezerros e garrotes para engorda nos EUA. No Brasil, a referência é o preço do bezerro ou do garrote na sua região.' },
  { key: 'suino', name: 'Suíno', emoji: '🐖', group: 'Pecuária e leite', symbol: 'HE=F', exchange: 'CME', unit: 'US¢/libra-peso', kg: 0.45359237, cotacao: 'centavos de dólar por libra-peso de carcaça (1 libra-peso = 0,454 kg)', b3: 'Referência física regional', explanation: 'O contrato americano é por peso de carcaça. No Brasil, o suíno vivo é cotado em reais por kg, e o custo do milho e do farelo pesa muito.' },
  { key: 'leite', name: 'Leite (Classe III)', emoji: '🥛', group: 'Pecuária e leite', symbol: 'DC=F', exchange: 'CME', unit: 'US$/cwt', kg: 45.359237, cotacao: 'dólares por cwt de leite (1 cwt = 100 libras = 45,4 kg)', b3: 'Referência física regional', explanation: 'Leite para fabricação de queijo nos EUA. No Brasil, o leite é pago ao produtor em reais por litro, com bônus por gordura, proteína e qualidade.' },
];

// Outros nomes que o aluno pode digitar para achar o produto na lista.
export const APELIDOS_FUTUROS = {
  milho: 'grão de milho', soja: 'grão de soja', farelo: 'ração', oleo: 'óleo de cozinha biodiesel',
  trigo: 'farinha pão', 'trigo-hrw': 'farinha pão', acucar: 'cana-de-açúcar', algodao: 'pluma fibra',
  cacau: 'chocolate', suco: 'laranja citros', boi: 'gado bovino arroba', 'boi-reposicao': 'gado bovino bezerro garrote',
  suino: 'porco carne suína', leite: 'queijo laticínio',
};

// Aba "Chicago": os contratos da lista acima negociados na Bolsa de Chicago (CBOT e CME).
// A lista CHICAGO do api/market.js deve acompanhar esta.
export const CHICAGO = FUTURES.filter(item => item.exchange === 'CBOT' || item.exchange === 'CME');

// Unidade usada no Brasil para cada produto de Chicago e quanto ela pesa em kg; serve para
// converter o preço da bolsa em dólares e em reais. Boi e suíno ficam por kg porque a arroba
// brasileira é de carcaça e o contrato do boi americano é de peso vivo.
const SACA_60 = { nome: 'saca de 60 kg', curto: 'sc', kg: 60 };
const TONELADA = { nome: 'tonelada', curto: 't', kg: 1000 };
const KG = { nome: 'kg', curto: 'kg', kg: 1 };
export const UNIDADE_BRASIL = {
  milho: SACA_60, soja: SACA_60, trigo: SACA_60, 'trigo-hrw': SACA_60, aveia: SACA_60,
  arroz: { nome: 'saca de 50 kg', curto: 'sc', kg: 50 }, farelo: TONELADA, oleo: TONELADA,
  boi: KG, 'boi-reposicao': KG, suino: KG, leite: { nome: 'litro', curto: 'litro', kg: 1.032 },
};

// Produtos da cotação diária do Paraná (DERAL): nome curto dos botões, na ordem em que aparecem.
export const APELIDOS_PARANA = [
  [/^soja/i, "Soja"], [/^milho/i, "Milho"], [/^trigo/i, "Trigo"],
  [/^caf[ée] beneficiado/i, "Café beneficiado"], [/^caf[ée] em coco/i, "Café em coco"],
  [/^feij[ãa]o carioca/i, "Feijão carioca"], [/^feij[ãa]o preto/i, "Feijão preto"],
  [/^mandioca/i, "Mandioca"], [/^arroz/i, "Arroz"], [/^boi/i, "Boi"], [/^vaca/i, "Vaca"],
  [/^su[íi]no/i, "Suíno"], [/^erva/i, "Erva-mate"],
];
export const PRODUTOS_PARANA = APELIDOS_PARANA.map(([, nome]) => nome);
