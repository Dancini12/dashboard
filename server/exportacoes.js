// Exportações do agro da aba "Exportações": Comex Stat (Ministério do Desenvolvimento, Indústria,
// Comércio e Serviços). A fonte aceita cerca de um pedido a cada 10 segundos; por isso são só
// duas consultas (produtos e destinos), cada uma guardada por um dia.
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

async function consultar(detalhes, porMes) {
  const ano = new Date().getUTCFullYear();
  const response = await fetch(COMEX, {
    method: 'POST', signal: AbortSignal.timeout(40000),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': UA_AGROINFO },
    body: JSON.stringify({ flow: 'export', monthDetail: porMes, period: { from: `${ano - 1}-01`, to: `${ano}-12` },
      filters: [{ filter: 'heading', values: POSICOES }], details: detalhes, metrics: ['metricFOB', 'metricKG'] }),
  });
  if (response.status === 429) throw new LimiteDePedidos('limite de pedidos');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const lista = (await response.json())?.data?.list;
  if (!Array.isArray(lista) || !lista.length) throw new Error('consulta vazia');
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

export const exportacoesPorProduto = async () => lerProdutos(await consultar(['heading', 'state'], true));
export const destinosDasExportacoes = async () => lerDestinos(await consultar(['heading', 'country'], false));
