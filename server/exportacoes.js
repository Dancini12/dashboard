// Exportações do agro da aba "Exportações": Comex Stat (Ministério do Desenvolvimento, Indústria,
// Comércio e Serviços). A fonte recusa pedidos seguidos (diz aceitar um a cada 10 segundos; na
// prática, um a cada 13 ou mais); por isso são só duas consultas (produtos e destinos), cada uma
// guardada por um dia, mais duas por país que o visitante consultar (o que o Brasil vende para ele e
// o que compra dele).
import { PAISES } from '../src/paises.js';

const COMEX = 'https://api-comexstat.mdic.gov.br/general?language=pt';
const UA_AGROINFO = 'Mozilla/5.0 (compatible; AgroInfo-CEEPA/1.0; +https://agroinfo-dashboard.vercel.app)';

// Posições do Sistema Harmonizado (4 dígitos) de cada produto, na ordem em que aparecem na aba.
export const PRODUTOS_EXPORTADOS = [
  { chave: 'soja', nome: 'Soja em grão', posicoes: ['1201'] },
  { chave: 'farelo', nome: 'Farelo de soja', posicoes: ['2304'] },
  { chave: 'oleo', nome: 'Óleo de soja', posicoes: ['1507'] },
  { chave: 'milho', nome: 'Milho', posicoes: ['1005'] },
  { chave: 'trigo', nome: 'Trigo', posicoes: ['1001'] },
  { chave: 'cafe', nome: 'Café', posicoes: ['0901'] },
  { chave: 'acucar', nome: 'Açúcar', posicoes: ['1701'] },
  { chave: 'algodao', nome: 'Algodão', posicoes: ['5201'] },
  { chave: 'bovina', nome: 'Carne bovina', posicoes: ['0201', '0202'] },
  { chave: 'frango', nome: 'Carne de frango', posicoes: ['0207'] },
  { chave: 'suina', nome: 'Carne suína', posicoes: ['0203'] },
];
const POSICOES = PRODUTOS_EXPORTADOS.flatMap(p => p.posicoes);
const produtoDa = posicao => PRODUTOS_EXPORTADOS.find(p => p.posicoes.includes(posicao));
const ESTADOS_NA_LISTA = 5;
const DESTINOS_NA_LISTA = 8;

export class LimiteDePedidos extends Error {}

// Ano passado inteiro e o ano atual até o último mês publicado. fluxo: 'export' ou 'import'.
async function consultar({ fluxo = 'export', filtros = [{ filter: 'heading', values: POSICOES }], detalhes, porMes, podeVirVazia = false }) {
  const ano = new Date().getUTCFullYear();
  const response = await fetch(COMEX, {
    method: 'POST', signal: AbortSignal.timeout(40000),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': UA_AGROINFO },
    body: JSON.stringify({ flow: fluxo, monthDetail: porMes, period: { from: `${ano - 1}-01`, to: `${ano}-12` },
      filters: filtros, details: detalhes, metrics: ['metricFOB', 'metricKG'] }),
  });
  if (response.status === 429) throw new LimiteDePedidos('limite de pedidos');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const lista = (await response.json())?.data?.list;
  if (!Array.isArray(lista) || (!lista.length && !podeVirVazia)) throw new Error('consulta vazia');
  return lista;
}

const soma = (alvo, linha) => { alvo.kg += Number(linha.metricKG) || 0; alvo.fob += Number(linha.metricFOB) || 0; };

// Linhas por produto, estado e mês → série mensal do Brasil e do Paraná e os estados que mais exportam no ano.
export function lerProdutos(lista) {
  const meses = [...new Set(lista.map(l => `${l.year}-${l.monthNumber}`))].sort();
  const ultimo = meses.at(-1);
  const ano = ultimo.slice(0, 4);
  const produtos = PRODUTOS_EXPORTADOS.map(({ chave, nome }) => ({ chave, nome, brasil: {}, parana: {}, estados: {} }));
  for (const linha of lista) {
    const produto = produtos.find(p => p.chave === produtoDa(linha.headingCode)?.chave);
    if (!produto) continue;
    const mes = `${linha.year}-${linha.monthNumber}`;
    soma((produto.brasil[mes] ??= { kg: 0, fob: 0 }), linha);
    if (linha.state === 'Paraná') soma((produto.parana[mes] ??= { kg: 0, fob: 0 }), linha);
    if (linha.year === ano) soma((produto.estados[linha.state] ??= { kg: 0, fob: 0 }), linha);
  }
  const serie = porMes => meses.map(mes => ({ mes, kg: porMes[mes]?.kg ?? 0, fob: porMes[mes]?.fob ?? 0 }));
  return {
    ultimoMes: ultimo,
    produtos: produtos.map(p => ({
      chave: p.chave, nome: p.nome, brasil: serie(p.brasil), parana: serie(p.parana),
      estados: Object.entries(p.estados).map(([estado, total]) => ({ estado, ...total })).sort((a, b) => b.kg - a.kg).slice(0, ESTADOS_NA_LISTA),
    })).filter(p => p.brasil.some(m => m.kg > 0)),
    fonte: 'Comex Stat · MDIC',
  };
}

// Linhas por produto, país e ano → principais destinos do ano mais recente, com a parte de cada um.
export function lerDestinos(lista) {
  const ano = lista.map(l => l.year).sort().at(-1);
  const produtos = PRODUTOS_EXPORTADOS.map(({ chave, nome }) => ({ chave, nome, paises: {} }));
  for (const linha of lista) {
    if (linha.year !== ano) continue;
    const produto = produtos.find(p => p.chave === produtoDa(linha.headingCode)?.chave);
    if (produto) soma((produto.paises[linha.country] ??= { kg: 0, fob: 0 }), linha);
  }
  return {
    ano: Number(ano),
    produtos: produtos.map(p => {
      const total = Object.values(p.paises).reduce((t, v) => t + v.kg, 0);
      const destinos = Object.entries(p.paises).map(([pais, v]) => ({ pais, ...v, partePct: total ? v.kg / total * 100 : 0 })).sort((a, b) => b.kg - a.kg).slice(0, DESTINOS_NA_LISTA);
      return { chave: p.chave, nome: p.nome, totalKg: total, paises: Object.keys(p.paises).length, destinos };
    }).filter(p => p.totalKg > 0),
    fonte: 'Comex Stat · MDIC',
  };
}

// Último mês que a fonte já publicou ('AAAA-MM'), por uma consulta leve (só a soja, que embarca o ano
// todo): serve para saber se há mês novo sem pedir tudo de novo.
export async function ultimoMesPublicado() {
  const lista = await consultar({ filtros: [{ filter: 'heading', values: ['1201'] }], detalhes: ['heading'], porMes: true });
  return lista.map(l => `${l.year}-${l.monthNumber}`).sort().at(-1);
}

export const exportacoesPorProduto = async () => lerProdutos(await consultar({ detalhes: ['heading', 'state'], porMes: true }));
export const destinosDasExportacoes = async () => lerDestinos(await consultar({ detalhes: ['heading', 'country'], porMes: false }));

// Comércio do agro com um país. Entram os capítulos 1 a 24 do Sistema Harmonizado (animais, vegetais,
// alimentos, bebidas e fumo), os adubos (31) e, do capítulo do algodão (52), só a pluma: fios e
// tecidos são indústria.
const CAPITULOS_DO_AGRO = [...Array.from({ length: 24 }, (_, i) => String(i + 1).padStart(2, '0')), '31', '52'];
const ALGODAO_EM_PLUMA = '5201';
const PRODUTOS_NA_LISTA = 12;
// Nome do dia a dia das posições mais negociadas; as demais ficam com o nome oficial, encurtado.
const NOMES_CURTOS = {
  '0102': 'Bovinos vivos', '0105': 'Aves vivas', '0204': 'Carne ovina e caprina', '0206': 'Miúdos bovinos e suínos', '0210': 'Carnes salgadas, secas ou defumadas',
  '0303': 'Peixe congelado', '0304': 'Filés de peixe', '0306': 'Camarão e outros crustáceos',
  '0401': 'Leite e creme de leite', '0402': 'Leite em pó e leite condensado', '0404': 'Soro de leite', '0405': 'Manteiga', '0406': 'Queijos', '0407': 'Ovos', '0409': 'Mel', '0504': 'Tripas e estômagos de animais',
  '0701': 'Batata', '0703': 'Cebola e alho', '0712': 'Hortaliças secas', '0713': 'Feijão e outras leguminosas secas', '0714': 'Mandioca e outras raízes',
  '0801': 'Coco, castanha-do-pará e castanha de caju', '0802': 'Nozes, amêndoas e outras castanhas', '0803': 'Banana', '0804': 'Manga, abacate, abacaxi e outras frutas tropicais',
  '0805': 'Laranja, limão e outros cítricos', '0806': 'Uva', '0807': 'Melão, melancia e mamão', '0808': 'Maçã e pera',
  '0902': 'Chá', '0903': 'Erva-mate', '0904': 'Pimenta', '1003': 'Cevada', '1004': 'Aveia', '1006': 'Arroz', '1007': 'Sorgo', '1101': 'Farinha de trigo', '1107': 'Malte',
  '1202': 'Amendoim', '1207': 'Gergelim e outras sementes oleaginosas', '1209': 'Sementes para plantio',
  '1502': 'Sebo bovino', '1509': 'Azeite de oliva', '1511': 'Óleo de palma', '1512': 'Óleo de girassol e de algodão', '1520': 'Glicerina bruta',
  '1601': 'Embutidos', '1602': 'Carnes preparadas e enlatadas', '1702': 'Glicose, lactose e outros açúcares', '1704': 'Balas e confeitos', '1801': 'Cacau em amêndoa', '1806': 'Chocolate',
  '2002': 'Tomate em conserva', '2008': 'Frutas em conserva', '2009': 'Sucos de frutas (laranja e outros)', '2101': 'Café solúvel', '2106': 'Outras preparações alimentícias',
  '2202': 'Refrigerantes e outras bebidas sem álcool', '2203': 'Cerveja', '2204': 'Vinho', '2207': 'Etanol', '2208': 'Cachaça, uísque e outros destilados',
  '2301': 'Farinhas de carne e de peixe (ração)', '2302': 'Farelos de cereais', '2303': 'Resíduos de amido, cervejaria e destilaria (DDG)', '2306': 'Tortas e farelos de outras oleaginosas', '2309': 'Ração animal',
  '2401': 'Fumo em folha', '2402': 'Cigarros e charutos',
  '0302': 'Peixe fresco', '0305': 'Peixe seco ou salgado (bacalhau)', '0307': 'Lula, polvo e outros moluscos', '0403': 'Iogurte e leites fermentados', '0511': 'Sêmen bovino e outros produtos animais',
  '0602': 'Mudas e plantas vivas', '0603': 'Flores cortadas', '0702': 'Tomate', '0710': 'Hortaliças congeladas', '0711': 'Hortaliças em conserva provisória',
  '0809': 'Pêssego, ameixa e cereja', '0810': 'Morango, kiwi e outras frutas frescas', '0811': 'Frutas congeladas', '0813': 'Frutas secas', '0910': 'Gengibre, açafrão e outras especiarias',
  '1008': 'Alpiste, quinoa e outros cereais', '1108': 'Amido e fécula', '1205': 'Canola (semente)', '1206': 'Girassol (semente)', '1210': 'Lúpulo', '1211': 'Plantas medicinais e aromáticas', '1302': 'Extratos vegetais e pectina',
  '1501': 'Banha e gordura de porco e de aves', '1504': 'Óleo de peixe', '1508': 'Óleo de amendoim', '1513': 'Óleo de coco e de palmiste', '1514': 'Óleo de canola', '1515': 'Outros óleos vegetais (milho, mamona, gergelim)',
  '1516': 'Gorduras e óleos hidrogenados', '1517': 'Margarina', '1604': 'Peixe em conserva', '1703': 'Melaço', '1803': 'Pasta de cacau', '1804': 'Manteiga de cacau', '1805': 'Cacau em pó',
  '1901': 'Misturas e preparações de farinha e malte', '1902': 'Massas alimentícias', '1904': 'Cereais matinais', '1905': 'Pães, biscoitos e bolachas',
  '2004': 'Batata pré-frita e outras hortaliças preparadas, congeladas', '2005': 'Hortaliças em conserva (azeitona, milho, ervilha)', '2007': 'Geleias e doces de fruta',
  '2102': 'Fermentos', '2103': 'Molhos e temperos', '2105': 'Sorvete', '2201': 'Água mineral', '2403': 'Fumo processado',
  '3101': 'Adubos orgânicos', '3102': 'Adubos nitrogenados (ureia e outros)', '3103': 'Adubos fosfatados', '3104': 'Adubos potássicos', '3105': 'Adubos NPK e outros mistos',
};
// Nome oficial até o primeiro ponto e vírgula e, se ainda for comprido, até umas 60 letras.
const encurtar = nome => { const base = String(nome ?? '').split(';')[0].trim(); return base.length <= 60 ? base : `${base.slice(0, base.lastIndexOf(' ', 58))}…`; };
const nomeDaPosicao = linha => produtoDa(linha.headingCode)?.nome ?? NOMES_CURTOS[linha.headingCode] ?? encurtar(linha.heading);

// Linhas por posição e ano → em cada ano (o mais recente primeiro), os produtos do maior para o menor
// volume, o total e a soma dos que ficaram fora da lista. Posições de mesmo nome se somam.
export function lerComercioComPais(lista) {
  const anos = {};
  for (const linha of lista) {
    if (linha.headingCode.startsWith('52') && linha.headingCode !== ALGODAO_EM_PLUMA) continue;
    soma(((anos[linha.year] ??= {})[nomeDaPosicao(linha)] ??= { kg: 0, fob: 0 }), linha);
  }
  const somar = itens => itens.reduce((t, p) => ({ kg: t.kg + p.kg, fob: t.fob + p.fob }), { kg: 0, fob: 0 });
  return Object.keys(anos).sort().reverse().map(ano => {
    const produtos = Object.entries(anos[ano]).map(([nome, v]) => ({ nome, ...v })).filter(p => p.kg > 0 || p.fob > 0).sort((a, b) => b.kg - a.kg);
    const resto = produtos.slice(PRODUTOS_NA_LISTA);
    return { ano: Number(ano), total: somar(produtos), produtos: produtos.slice(0, PRODUTOS_NA_LISTA), outros: { quantos: resto.length, ...somar(resto) } };
  });
}

export const paisDoComex = id => PAISES.find(([codigo]) => codigo === id) ?? null;
// fluxo 'export': o que o Brasil vende para o país; 'import': o que compra dele.
export async function comercioComPais(id, fluxo) {
  const [codigo, nome] = paisDoComex(id);
  const lista = await consultar({ fluxo, filtros: [{ filter: 'country', values: [codigo] }, { filter: 'chapter', values: CAPITULOS_DO_AGRO }], detalhes: ['heading'], porMes: false, podeVirVazia: true });
  return { pais: { id: codigo, nome }, fluxo, anos: lerComercioComPais(lista), fonte: 'Comex Stat · MDIC' };
}
