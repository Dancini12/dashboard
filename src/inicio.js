// Contas do Resumo do dia, a página que abre o site.
import { APELIDOS_PARANA } from './catalogo.js';
import { getWmo } from './clima.js';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_DE_VALIDADE = 3; // andamento mais antigo que isso não é notícia

// Preço de um produto ("Soja", "Milho", "Boi"…) na região pedida, a partir da cotação diária do
// DERAL. Sem preço na região naquele dia, vale a média do estado.
export function precoNaRegiao(cotacao, apelido, regiao) {
  const padrao = APELIDOS_PARANA.find(([, nome]) => nome === apelido)?.[0];
  const produto = cotacao?.produtos.find(p => padrao?.test(p.nome));
  if (!produto) return null;
  const daRegiao = produto.precos[cotacao.regioes.indexOf(regiao)]?.comum;
  const base = { unidade: produto.unidade, mediaEstado: produto.mediaEstado, variacaoPct: produto.variacaoPct };
  if (typeof daRegiao === 'number') return { ...base, valor: daRegiao, daRegiao: true };
  return produto.mediaEstado != null ? { ...base, valor: produto.mediaEstado, daRegiao: false } : null;
}

// Plantios e colheitas em andamento no Paraná: a safra mais recente de cada cultura em que a
// operação já começou, ainda não chegou a 100% e teve levantamento nos últimos meses.
export function operacoesEmAndamento(culturas, hoje = new Date()) {
  const limite = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - MESES_DE_VALIDADE, 1)).toISOString().slice(0, 7);
  return culturas.flatMap(cultura => ['Plantio', 'Colheita'].map(operacao => {
    const serie = cultura.andamento.filter(a => a.operacao === operacao).at(-1);
    const ultimo = serie?.meses.at(-1);
    if (!ultimo || ultimo.pct <= 0 || ultimo.pct >= 100 || ultimo.mes < limite) return null;
    return { cultura: cultura.nome, safra: serie.safra, operacao, pct: ultimo.pct, mes: `${MESES[Number(ultimo.mes.slice(5, 7)) - 1]}/${ultimo.mes.slice(2, 4)}` };
  }).filter(Boolean));
}

const umaCasa = v => Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const rumo = v => (Math.abs(v) < 0.05 ? 'estável' : `em ${v > 0 ? 'alta' : 'queda'} de ${umaCasa(v)}%`);
const diaMes = data => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

// Frases de abertura do Resumo do dia, montadas com os números que a página já tem: dólar, soja em
// Chicago e o tempo da cidade escolhida (hoje: o dia da previsão; avisos: os de avisosDaPrevisao).
// O que ainda não chegou ou falhou fica de fora; sem nada, a lista vem vazia.
export function frasesDoDia({ dolar, variacaoDoDolar, variacaoDaSoja, cidade, hoje, avisos }) {
  const frases = [];
  if (dolar != null && variacaoDoDolar != null) frases.push(`Dólar ${rumo(variacaoDoDolar)}, a ${dolar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`);
  if (variacaoDaSoja != null) frases.push(`Soja em Chicago ${rumo(variacaoDaSoja)}.`);
  if (cidade && hoje) {
    const tempo = getWmo(hoje.tempo).label;
    const chuva = hoje.chuva ?? 0;
    frases.push(`Em ${cidade.split(',')[0]}, ${tempo.charAt(0).toLowerCase()}${tempo.slice(1)}, de ${Math.round(hoje.minima)}° a ${Math.round(hoje.maxima)}°, `
      + `${chuva >= 1 ? `com ${chuva.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mm de chuva previstos` : 'sem chuva prevista'} para hoje.`);
    const aviso = avisos?.geada.length ? ['risco de geada', avisos.geada] : avisos?.chuvaForte.length ? ['chuva forte prevista', avisos.chuvaForte]
      : avisos?.calor.length ? ['calor forte previsto', avisos.calor] : null;
    if (aviso) frases.push(`Atenção: ${aviso[0]} em ${aviso[1].slice(0, 3).map(d => diaMes(d.data)).join(', ')}.`);
  }
  return frases;
}
