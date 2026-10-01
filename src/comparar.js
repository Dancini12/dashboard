// Contas da comparação "qual subiu mais" da aba Histórico.

// Fechamentos mensais ({ date: 'AAAA-MM-DD', close }) → média de cada ano: { 2020: 12.3, … }.
export function mediasAnuais(pontos) {
  const porAno = {};
  for (const { date, close } of pontos) {
    if (!Number.isFinite(close)) continue;
    (porAno[date.slice(0, 4)] ??= []).push(close);
  }
  return Object.fromEntries(Object.entries(porAno).map(([ano, valores]) => [ano, valores.reduce((a, b) => a + b, 0) / valores.length]));
}

// Variação em % de cada ano contra o ano-base; null onde não há valor. Sem valor no ano-base, devolve null.
export function variacaoDesde(valores, anos, base) {
  const inicial = valores[base];
  if (!Number.isFinite(inicial) || inicial === 0) return null;
  return anos.map(ano => (Number.isFinite(valores[ano]) ? (valores[ano] - inicial) / inicial * 100 : null));
}

// Do que mais subiu para o que mais caiu, pela última variação conhecida de cada item.
export function ranking(itens) {
  return itens
    .map(item => ({ ...item, final: item.variacoes.findLast(v => v != null) ?? null }))
    .filter(item => item.final != null)
    .sort((a, b) => b.final - a.final);
}
