// Contas do resumo da página inicial (aba "Início").
import { APELIDOS_PARANA } from './catalogo.js';

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
