/* global Buffer */
// Dados de safra da aba "Safra": estimativa do DERAL/SEAB-PR (planilha pss.xlsx, por núcleo
// regional, com o calendário de plantio e colheita) e do IBGE (produção do município e do Brasil).
import lerPlanilha from 'read-excel-file/node';

const PLANILHA_DERAL = 'https://www.agricultura.pr.gov.br/system/files/publico/Safras/pss.xlsx';
const UA_AGROINFO = 'Mozilla/5.0 (compatible; AgroInfo-CEEPA/1.0; +https://agroinfo-dashboard.vercel.app)';
const REGIAO_DA_ESCOLA = 'CORNÉLIO PROCÓPIO';
const CULTURAS = ['SOJA (1ª SAFRA)', 'MILHO (1ª SAFRA)', 'MILHO (2ª SAFRA)', 'TRIGO', 'FEIJÃO (1ª SAFRA)', 'FEIJÃO (2ª SAFRA)', 'CAFÉ', 'CANA-DE-AÇÚCAR', 'MANDIOCA', 'CEVADA'];
const SAFRAS_NA_TABELA = 10;
const SAFRAS_NO_CALENDARIO = 3; // a mais antiga serve de safra completa para o calendário

const texto = v => (v == null ? '' : String(v)).trim();
const numero = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const maiuscula = v => texto(v).toUpperCase();
// "CORNÉLIO PROCÓPIO (c)" → "CORNÉLIO PROCÓPIO"
const nucleo = v => maiuscula(v).replace(/\s*\([A-Z]\)$/, '');
// "SOJA (1ª SAFRA)" → "Soja (1ª safra)"
const nomeLegivel = v => v.charAt(0) + v.slice(1).toLowerCase();
// "25/26" → 2025
const anoInicial = safra => 2000 + Number(safra.slice(0, 2));

// Abas "BDados" (safra, cultura, núcleo regional, área, área perdida e produção) e "BDadosCal"
// (percentual acumulado de plantio, colheita e comercialização mês a mês, a partir de maio).
export function lerSafraParana(abas) {
  const dados = abas.find(a => a.sheet === 'BDados')?.data;
  const calendario = abas.find(a => a.sheet === 'BDadosCal')?.data;
  if (!dados || !calendario) throw new Error('abas da planilha não encontradas');

  const somas = {}; // cultura → safra → { parana, regiao }
  for (const [safra, cultura, regiao, area, perdida, producao] of dados.slice(1)) {
    const nome = maiuscula(cultura);
    if (!CULTURAS.includes(nome) || !/^\d{2}\/\d{2}$/.test(texto(safra))) continue;
    const daSafra = ((somas[nome] ??= {})[safra] ??= { parana: { area: 0, perdida: 0, producao: 0 }, regiao: { area: 0, perdida: 0, producao: 0 } });
    for (const alvo of nucleo(regiao) === REGIAO_DA_ESCOLA ? [daSafra.parana, daSafra.regiao] : [daSafra.parana]) {
      alvo.area += numero(area); alvo.perdida += numero(perdida); alvo.producao += numero(producao);
    }
  }
  // área em hectares, produção em toneladas, rendimento em kg por hectare colhido
  const linha = (safra, t) => ({ safra, area: t.area, producao: t.producao, rendimento: t.area - t.perdida > 0 ? t.producao / (t.area - t.perdida) * 1000 : null });

  const andamento = {}; // cultura → [{ safra, operacao, meses }]
  for (const [cultura, safra, operacao, ...meses] of calendario.slice(1)) {
    const nome = maiuscula(cultura);
    if (!CULTURAS.includes(nome) || !/^\d{2}\/\d{2}$/.test(texto(safra))) continue;
    const pontos = meses.slice(0, 28)
      .map((pct, i) => (typeof pct === 'number' ? { mes: new Date(Date.UTC(anoInicial(safra), 4 + i, 1)).toISOString().slice(0, 7), pct } : null))
      .filter(Boolean);
    if (pontos.some(p => p.pct > 0)) (andamento[nome] ??= []).push({ safra, operacao: texto(operacao), meses: pontos });
  }

  const culturas = CULTURAS.filter(nome => somas[nome]).map(nome => {
    const safras = Object.keys(somas[nome]).sort().slice(-SAFRAS_NA_TABELA);
    const comCalendario = [...new Set((andamento[nome] ?? []).map(a => a.safra))].sort().slice(-SAFRAS_NO_CALENDARIO);
    return {
      nome: nomeLegivel(nome),
      parana: safras.map(s => linha(s, somas[nome][s].parana)),
      regiao: safras.map(s => linha(s, somas[nome][s].regiao)),
      andamento: (andamento[nome] ?? []).filter(a => comCalendario.includes(a.safra)),
    };
  });
  if (!culturas.length) throw new Error('nenhuma cultura na planilha');

  const atualizacao = abas.find(a => a.sheet === 'Calendário')?.data.flat().find(v => v instanceof Date);
  return { culturas, regiao: 'Cornélio Procópio', atualizadoEm: atualizacao ? atualizacao.toISOString().slice(0, 10) : null, fonte: 'DERAL/SEAB-PR · Previsão de safra' };
}

async function safraParana() {
  const response = await fetch(PLANILHA_DERAL, { signal: AbortSignal.timeout(25000), headers: { 'User-Agent': UA_AGROINFO } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { ...lerSafraParana(await lerPlanilha(Buffer.from(await response.arrayBuffer()))), arquivo: PLANILHA_DERAL };
}

// ---------------------------------------------------------------- IBGE (SIDRA)

const SIDRA = 'https://apisidra.ibge.gov.br/values';
const SANTA_MARIANA = '4123907';
// Produção Agrícola Municipal (tabela 5457): produto → nome mostrado
const PRODUTOS_PAM = [['40124', 'Soja'], ['40122', 'Milho'], ['40127', 'Trigo'], ['40139', 'Café'], ['40106', 'Cana-de-açúcar'], ['40112', 'Feijão'], ['40119', 'Mandioca']];
// Levantamento Sistemático da Produção Agrícola (tabela 6588)
const PRODUTOS_LSPA = [['39443', 'Soja'], ['39441', 'Milho (1ª safra)'], ['39442', 'Milho (2ª safra)'], ['39445', 'Trigo'], ['39436', 'Feijão (1ª safra)'], ['39437', 'Feijão (2ª safra)'], ['39432', 'Arroz'], ['40527', 'Café'], ['39456', 'Cana-de-açúcar'], ['39467', 'Mandioca']];

// "-" é zero; "..", "..." e "X" são dado não disponível
const valorSidra = v => (v === '-' ? 0 : /^-?\d+(\.\d+)?$/.test(v ?? '') ? Number(v) : null);
async function sidra(caminho) {
  const response = await fetch(`${SIDRA}${caminho}`, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const linhas = await response.json();
  if (!Array.isArray(linhas) || linhas.length < 2) throw new Error('tabela vazia');
  return linhas.slice(1); // a primeira linha é o cabeçalho
}

// Produção, área colhida e rendimento do município, ano a ano.
export function lerMunicipio(linhas) {
  const anos = [...new Set(linhas.map(l => l.D3C))].sort();
  const de = (produto, variavel) => anos.map(ano => valorSidra(linhas.find(l => l.D4C === produto && l.D2C === variavel && l.D3C === ano)?.V));
  const culturas = PRODUTOS_PAM
    .map(([codigo, nome]) => ({ nome, producao: de(codigo, '214'), area: de(codigo, '216'), rendimento: de(codigo, '112') }))
    .filter(c => c.producao.some(v => v > 0));
  if (!culturas.length) throw new Error('município sem produção');
  return { nome: 'Santa Mariana', anos: anos.map(Number), culturas, fonte: 'IBGE · Produção Agrícola Municipal' };
}

// Estimativa do mês mais recente para o Brasil e o Paraná, comparada com o fechamento do ano anterior.
export function lerBrasil(linhas) {
  const meses = [...new Set(linhas.map(l => l.D3C))].sort();
  const atual = meses.at(-1);
  const anterior = `${Number(atual.slice(0, 4)) - 1}12`;
  const producao = (local, produto, mes) => valorSidra(linhas.find(l => l.D1C === local && l.D4C === produto && l.D2C === '35' && l.D3C === mes)?.V);
  const culturas = PRODUTOS_LSPA.map(([codigo, nome]) => ({
    nome,
    brasil: { producao: producao('1', codigo, atual), anterior: producao('1', codigo, anterior) },
    parana: { producao: producao('41', codigo, atual), anterior: producao('41', codigo, anterior) },
  })).filter(c => c.brasil.producao > 0);
  if (!culturas.length) throw new Error('estimativa vazia');
  return { referencia: linhas.find(l => l.D3C === atual).D3N, ano: Number(atual.slice(0, 4)), culturas, fonte: 'IBGE · Levantamento Sistemático da Produção Agrícola' };
}

const municipio = async () => lerMunicipio(await sidra(`/t/5457/n6/${SANTA_MARIANA}/v/214,216,112/p/last%2012/c782/${PRODUTOS_PAM.map(([codigo]) => codigo)}`));
const brasil = async () => lerBrasil(await sidra(`/t/6588/n1/all/n3/41/v/35/p/last%2013/c48/${PRODUTOS_LSPA.map(([codigo]) => codigo)}`));

// Cada fonte que falhar vem como null; sem nenhuma, erro.
export async function dadosDeSafra() {
  const [parana, santaMariana, pais] = (await Promise.allSettled([safraParana(), municipio(), brasil()])).map(r => (r.status === 'fulfilled' ? r.value : null));
  if (!parana && !santaMariana && !pais) throw new Error('fontes de safra indisponíveis');
  return { parana, municipio: santaMariana, brasil: pais, consultadoEm: new Date().toISOString() };
}
