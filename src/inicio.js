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

const reais = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const minuscula = texto => texto.charAt(0).toLowerCase() + texto.slice(1);
const POR_UNIDADE = { 'sc 60 kg': 'a saca', arroba: 'a arroba', kg: 'o quilo', tonelada: 'a tonelada' };

// Textos corridos do Jornal do dia, montados com os mesmos números do Resumo do dia. Devolve
// { mercado: [frases], campo: frase ou null, economia: [frases] }; o que ainda não chegou fica de fora.
// Quando foi a cotação de Chicago (segundos desde 1970), dito em relação à hora de referência (ms):
// "às 14:09" se foi no mesmo dia, "em 13/10, às 15:20" se foi antes (bolsa fechada, fim de semana).
export function horaDaCotacao(segundos, referencia) {
  if (!Number.isFinite(segundos)) return null;
  const quando = new Date(segundos * 1000), base = new Date(referencia);
  const hora = quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return quando.toDateString() === base.toDateString() ? `às ${hora}` : `em ${quando.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, às ${hora}`;
}
// "14/10/2026" → "14/10": data do boletim do DERAL, para a folha dizer de quando são os preços da região.
export const diaDoBoletim = data => (typeof data === 'string' && /^\d{2}\/\d{2}/.test(data) ? data.slice(0, 5) : null);

export function textosDoJornal({ dolar, variacaoDoDolar, sojaEmReais, variacaoDaSoja, daRegiao = [], regiao, diesel, noCampo = [], moedas = [], indicadores = [] }) {
  const mercado = [];
  if (dolar != null) mercado.push(`O dólar comercial vale ${reais(dolar)}${variacaoDoDolar != null ? `, ${rumo(variacaoDoDolar)} no dia` : ''}.`);
  if (sojaEmReais != null) mercado.push(`Na Bolsa de Chicago, a soja equivale a ${reais(sojaEmReais)} por saca no porto${variacaoDaSoja != null ? `, ${rumo(variacaoDaSoja)}` : ''}.`);
  const precos = daRegiao.filter(item => item.preco).map(({ produto, preco }) => `${produto.toLowerCase()}, ${reais(preco.valor)} ${POR_UNIDADE[preco.unidade.toLowerCase()] ?? `por ${preco.unidade}`}${preco.daRegiao ? '' : ' (média do Paraná)'}`);
  if (precos.length) mercado.push(`Na região de ${regiao}, os preços do dia são: ${precos.join('; ')}.`);
  if (diesel) mercado.push(`O diesel S10 custa em média ${reais(diesel.parana.medio)} o litro nos postos do Paraná.`);
  const campo = noCampo.length
    ? `Nas lavouras do Paraná: ${noCampo.map(o => `${o.operacao.toLowerCase()} de ${minuscula(o.cultura)} ${o.safra} em ${o.pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% até ${o.mes}`).join('; ')}.` : null;
  const outras = moedas.filter(m => m.id !== 'usd' && m.valor != null).map(m => `${m.nome.toLowerCase()} a R$ ${m.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: m.valor < 1 ? 4 : 2 })}`);
  const taxas = indicadores.filter(i => i.valor && !/carregando|indispon/i.test(i.valor)).map(i => `${i.nome}${i.periodo ? ` (${i.periodo})` : ''}, ${i.valor}`);
  const economia = [outras.length ? `Outras moedas: ${outras.join('; ')}.` : null, taxas.length ? `Indicadores: ${taxas.join('; ').replace(/\.$/, '')}.` : null].filter(Boolean); // "a.a." no fim não ganha outro ponto
  return { mercado, campo, economia };
}
