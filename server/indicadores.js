// Reservas para os indicadores da economia quando a API de séries do Banco Central (SGS) falha, como
// aconteceu em outubro de 2026 (respostas vazias ou "Internal error"): IPCA e INPC direto do IBGE (SIDRA)
// e a meta da Selic pela lista de decisões do Copom no site do Banco Central. Para IGP-M, CDI e poupança
// não há fonte aberta equivalente; o navegador mostra o último valor que recebeu. Fonte e reserva são
// consultadas ao mesmo tempo: quando o SGS trava (chegou a ficar 30 s sem responder), a página não espera.
const IBGE = 'https://apisidra.ibge.gov.br/values';
const COPOM = 'https://www.bcb.gov.br/api/servico/sitebcb/historicotaxasjuros';
const SGS = codigo => `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados/ultimos/1?formato=json`;
// indicador → tabela e variável do SIDRA (variação mensal; 2265 = acumulado em 12 meses)
const NO_IBGE = { ipca: [1737, 63], ipca12: [1737, 2265], inpc: [1736, 44] };

const pedirJson = (url, limite = 10000) => fetch(url, { signal: AbortSignal.timeout(limite) })
  .then(r => (r.ok ? r.json() : Promise.reject(new Error(`resposta ${r.status}`))));

// Linha mais recente de uma variável no formato do SIDRA: "202609" → { valor, data: "01/09/2026" }, no
// mesmo formato que o SGS devolve.
export function lerSidra(linhas, variavel) {
  const validas = (Array.isArray(linhas) ? linhas.slice(1) : [])
    .filter(l => String(l.D2C) === String(variavel) && /^\d{6}$/.test(l.D3C ?? '') && Number.isFinite(Number(l.V)));
  if (!validas.length) return null;
  const ultima = validas.reduce((a, l) => (l.D3C > a.D3C ? l : a));
  return { valor: Number(ultima.V), data: `01/${ultima.D3C.slice(4)}/${ultima.D3C.slice(0, 4)}` };
}

// Meta da Selic em vigor: a decisão do Copom sem fim de vigência (ou a de início mais recente).
export function lerCopom(resposta) {
  const decisoes = (resposta?.conteudo ?? []).filter(d => Number.isFinite(d.MetaSelic) && d.DataInicioVigencia);
  if (!decisoes.length) return null;
  const vigente = decisoes.find(d => !d.DataFimVigencia) ?? decisoes.reduce((a, d) => (d.DataInicioVigencia > a.DataInicioVigencia ? d : a));
  const dia = new Date(vigente.DataInicioVigencia).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return { value: vigente.MetaSelic, date: dia, source: `Banco Central · Copom (reunião ${vigente.NumeroReuniaoCopom})` };
}

// Último valor de uma série do SGS. O serviço às vezes devolve resposta vazia na hora: aí tenta mais uma
// vez. Se demorar, desiste em 6 s (a reserva já está a caminho).
export async function serieDoBancoCentral(codigo) {
  for (let tentativa = 0; ; tentativa++) {
    const inicio = Date.now();
    try {
      const linha = (await pedirJson(SGS(codigo), 6000))?.at?.(-1);
      const valor = Number(linha?.valor);
      if (!linha?.data || linha.valor === '' || !Number.isFinite(valor)) throw new Error('série vazia');
      return { valor, data: linha.data };
    } catch (erro) {
      if (tentativa >= 1 || Date.now() - inicio > 3000) throw erro;
    }
  }
}

// Todas as séries pedidas ({ chave: código no SGS }), com IPCA e INPC do IBGE quando o SGS falha.
export async function indicadoresDaEconomia(series) {
  const chaves = Object.keys(series);
  const [doBancoCentral, doIbge] = await Promise.all([
    Promise.allSettled(chaves.map(chave => serieDoBancoCentral(series[chave]))),
    reservasDoIbge(chaves).catch(() => ({})),
  ]);
  return Object.fromEntries(chaves.map((chave, i) => [chave, doBancoCentral[i].status === 'fulfilled' ? doBancoCentral[i].value : doIbge[chave] ?? null]));
}

// Os indicadores pedidos que o IBGE também publica (IPCA e INPC); os outros ficam de fora.
export async function reservasDoIbge(faltando) {
  const pedidos = faltando.filter(chave => NO_IBGE[chave]);
  const tabelas = [...new Set(pedidos.map(chave => NO_IBGE[chave][0]))];
  const respostas = await Promise.allSettled(tabelas.map(tabela => {
    const variaveis = pedidos.filter(c => NO_IBGE[c][0] === tabela).map(c => NO_IBGE[c][1]).join(',');
    return pedirJson(`${IBGE}/t/${tabela}/n1/all/v/${variaveis}/p/last%201`);
  }));
  const porTabela = Object.fromEntries(tabelas.map((t, i) => [t, respostas[i].status === 'fulfilled' ? respostas[i].value : null]));
  return Object.fromEntries(pedidos.map(chave => {
    const [tabela, variavel] = NO_IBGE[chave];
    const dado = porTabela[tabela] && lerSidra(porTabela[tabela], variavel);
    return [chave, dado ? { ...dado, fonte: 'IBGE' } : null];
  }));
}

export async function selicAtual() {
  const [sgs, copom] = await Promise.allSettled([serieDoBancoCentral(432), pedirJson(COPOM).then(lerCopom)]);
  if (sgs.status === 'fulfilled') return { value: sgs.value.valor, date: sgs.value.data, source: 'Banco Central · SGS 432' };
  if (copom.status === 'fulfilled' && copom.value) return copom.value;
  throw new Error('Selic indisponível');
}
