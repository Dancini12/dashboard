// Aba "Cotações Cooperativas", Mato Grosso: preços do IMEA (Instituto Mato-grossense de Economia
// Agropecuária), lidos do mesmo endereço que as páginas de indicadores do IMEA usam para montar as
// tabelas (imea.com.br/imea-site/indicador-soja etc.). Soja e milho disponíveis por cidade e boi e vaca
// gordos à vista por município e macrorregião. Cada cadeia vem com o histórico; fica só a data mais recente de cada
// indicador.
const API = 'https://api1.imea.com.br/api/v2/mobile/cadeias';
const UA_AGROINFO = 'Mozilla/5.0 (compatible; AgroInfo/1.0; +https://agronahora.com.br)';
// produto → cadeia no IMEA e código do indicador (os mesmos das páginas de indicadores do IMEA)
export const INDICADORES_IMEA = [
  { nome: 'Soja', descricao: 'Soja disponível', cadeia: 4, id: '708192508838936580', local: 'Cidade' },
  { nome: 'Milho', descricao: 'Milho disponível', cadeia: 3, id: '708192508838936581', local: 'Cidade' },
  { nome: 'Boi gordo', descricao: 'Boi gordo à vista', cadeia: 2, id: '708192508809576456', local: 'Município' },
  { nome: 'Vaca gorda', descricao: 'Vaca gorda à vista', cadeia: 2, id: '708192508809576457', local: 'Município' },
];
const UNIDADES = { 'R$/sc': 'saca de 60 kg', 'R$/@': 'arroba' };
const ESTADO = 'Mato Grosso';
// as sete macrorregiões do IMEA, que vêm junto com os municípios nos indicadores do boi
const MACRORREGIOES = new Set(['Centro-Sul', 'Médio-Norte', 'Nordeste', 'Noroeste', 'Norte', 'Oeste', 'Sudeste']);
const numero = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Cotação mais recente de um indicador: a média do estado, as macrorregiões (quando houver) e a lista de
// cidades.
export function ultimaCotacao(cotacoes, indicador) {
  const doIndicador = cotacoes.filter(c => c.IndicadorFinalId === indicador.id && c.DataPublicacao && numero(c.Valor) != null);
  if (!doIndicador.length) return null;
  const data = doIndicador.reduce((a, c) => (c.DataPublicacao > a ? c.DataPublicacao : a), '');
  const vistos = new Set();
  const locais = [], regioes = [];
  let estado = null;
  for (const c of doIndicador.filter(c => c.DataPublicacao === data)) {
    const nome = (c.Localidade ?? '').trim();
    if (!nome || vistos.has(nome)) continue;
    vistos.add(nome);
    const item = { nome, valor: c.Valor, variacao: numero(c.Variacao) };
    if (nome === ESTADO) estado = item;
    else if (MACRORREGIOES.has(nome)) regioes.push(item);
    else locais.push(item);
  }
  const sigla = doIndicador[0].UnidadeSigla;
  return {
    nome: indicador.nome, descricao: indicador.descricao, tipoLocal: indicador.local,
    unidade: UNIDADES[sigla] ?? sigla, data: data.slice(0, 10),
    mediaEstado: estado?.valor ?? null, variacaoEstado: estado?.variacao ?? null,
    regioes, locais: locais.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  };
}

export async function cotacaoMatoGrosso() {
  const cadeias = [...new Set(INDICADORES_IMEA.map(i => i.cadeia))];
  const respostas = await Promise.allSettled(cadeias.map(async cadeia => {
    const r = await fetch(`${API}/${cadeia}/cotacoes`, { headers: { 'User-Agent': UA_AGROINFO }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`IMEA respondeu ${r.status}`);
    return [cadeia, await r.json()];
  }));
  const porCadeia = Object.fromEntries(respostas.filter(r => r.status === 'fulfilled' && Array.isArray(r.value[1])).map(r => r.value));
  const produtos = INDICADORES_IMEA.map(i => (porCadeia[i.cadeia] ? ultimaCotacao(porCadeia[i.cadeia], i) : null)).filter(Boolean);
  if (!produtos.length) throw new Error('IMEA indisponível');
  return { fonte: 'IMEA', pagina: 'https://www.imea.com.br/', consultadoEm: new Date().toISOString(), produtos };
}
