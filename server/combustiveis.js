/* global Buffer */
// Preço dos combustíveis no Paraná (card do Painel): levantamento semanal da ANP nos postos,
// planilha "resumo semanal" mais recente e a da semana anterior, para a variação.
import lerPlanilha from 'read-excel-file/node';

const PAGINA_ANP = 'https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/levantamento-de-precos-de-combustiveis-ultimas-semanas-pesquisadas';
const UA_AGROINFO = 'Mozilla/5.0 (compatible; AgroInfo-CEEPA/1.0; +https://agroinfo-dashboard.vercel.app)';
// produto na planilha → nome mostrado, na ordem do card
const PRODUTOS = [['OLEO DIESEL S10', 'Diesel S10'], ['OLEO DIESEL', 'Diesel comum (S500)'], ['GASOLINA COMUM', 'Gasolina comum'], ['ETANOL HIDRATADO', 'Etanol']];
const ESTADO = 'PARANA';
// a planilha vem sem acento
const COM_ACENTO = { ARAUCARIA: 'Araucária', CAMBE: 'Cambé', 'CAMPO MOURAO': 'Campo Mourão', 'CORNELIO PROCOPIO': 'Cornélio Procópio', 'FOZ DO IGUACU': 'Foz do Iguaçu',
  'FRANCISCO BELTRAO': 'Francisco Beltrão', MARINGA: 'Maringá', PARANAGUA: 'Paranaguá', PARANAVAI: 'Paranavaí', 'SANTO ANTONIO DA PLATINA': 'Santo Antônio da Platina',
  'SAO JOSE DOS PINHAIS': 'São José dos Pinhais', 'UNIAO DA VITORIA': 'União da Vitória' };
const MINUSCULAS = new Set(['da', 'de', 'do', 'das', 'dos']);
const nomeDaCidade = v => COM_ACENTO[v] ?? v.toLowerCase().split(' ').map((p, i) => (i && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ');

const texto = v => (v == null ? '' : String(v)).trim();
const dia = v => (v instanceof Date ? v.toISOString().slice(0, 10) : null);
const preco = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Linhas de dados de uma aba, com o nome das colunas no lugar da posição.
function tabela(abas, nome) {
  const dados = abas.find(a => a.sheet === nome)?.data;
  const iCabecalho = dados?.findIndex(l => texto(l[0]) === 'DATA INICIAL') ?? -1;
  if (iCabecalho < 0) throw new Error(`aba ${nome} não encontrada`);
  const colunas = dados[iCabecalho].map(texto);
  return dados.slice(iCabecalho + 1).filter(l => texto(l[0])).map(l => Object.fromEntries(colunas.map((c, i) => [c, l[i]])));
}
const resumo = l => ({ medio: preco(l['PREÇO MÉDIO REVENDA']), minimo: preco(l['PREÇO MÍNIMO REVENDA']), maximo: preco(l['PREÇO MÁXIMO REVENDA']), postos: preco(l['NÚMERO DE POSTOS PESQUISADOS']) });

// Abas BRASIL, ESTADOS e MUNICIPIOS → preços do Paraná, do Brasil e de cada cidade paranaense pesquisada.
export function lerCombustiveis(abas) {
  const [brasil, estados, municipios] = ['BRASIL', 'ESTADOS', 'MUNICIPIOS'].map(nome => tabela(abas, nome));
  const produtos = PRODUTOS.map(([codigo, nome]) => {
    const parana = estados.find(l => texto(l.ESTADOS) === ESTADO && texto(l.PRODUTO) === codigo);
    if (!parana) return null;
    return {
      nome, parana: resumo(parana),
      brasil: preco(brasil.find(l => texto(l.PRODUTO) === codigo)?.['PREÇO MÉDIO REVENDA']),
      cidades: municipios.filter(l => texto(l.ESTADO) === ESTADO && texto(l.PRODUTO) === codigo)
        .map(l => ({ cidade: nomeDaCidade(texto(l['MUNICÍPIO'])), ...resumo(l) })).sort((a, b) => a.cidade.localeCompare(b.cidade, 'pt-BR')),
    };
  }).filter(Boolean);
  if (!produtos.length) throw new Error('sem preços do Paraná');
  return { de: dia(estados[0]['DATA INICIAL']), ate: dia(estados[0]['DATA FINAL']), produtos };
}

async function planilha(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(25000), headers: { 'User-Agent': UA_AGROINFO } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return lerCombustiveis(await lerPlanilha(Buffer.from(await response.arrayBuffer())));
}

// Endereços das planilhas semanais citadas na página da ANP, da mais recente para a mais antiga.
export const planilhasDaPagina = html => [...new Set(html.match(/https:\/\/www\.gov\.br\/anp\/[^"']*resumo_semanal_lpc_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.xlsx/g) ?? [])]
  .sort((a, b) => b.slice(-26).localeCompare(a.slice(-26)));

export async function combustiveisDoParana() {
  const pagina = await fetch(PAGINA_ANP, { signal: AbortSignal.timeout(25000), headers: { 'User-Agent': UA_AGROINFO } });
  if (!pagina.ok) throw new Error(`HTTP ${pagina.status}`);
  const [atual, anterior] = planilhasDaPagina(await pagina.text());
  if (!atual) throw new Error('nenhuma planilha na página');
  const [semana, semanaAnterior] = await Promise.all([planilha(atual), anterior ? planilha(anterior).catch(() => null) : null]);
  return {
    ...semana, arquivo: atual, fonte: 'ANP · Levantamento de Preços de Combustíveis',
    // preço médio do Paraná na semana anterior, para a variação
    produtos: semana.produtos.map(p => ({ ...p, semanaAnterior: semanaAnterior?.produtos.find(a => a.nome === p.nome)?.parana.medio ?? null })),
  };
}
