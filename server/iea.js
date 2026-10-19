// Aba "Cotações Cooperativas", São Paulo: "Preços recebidos" do banco de dados do IEA (Instituto de Economia
// Agrícola), o preço médio pago ao produtor em cada EDR (escritório regional da Secretaria de Agricultura).
// A consulta é um formulário: abre-se a página (que dá a chave do formulário e o cookie) e pede-se um dia
// por vez, porque o intervalo de datas só traz o primeiro dia. Cada dia só tem as regionais que informaram
// (às vezes uma ou duas por produto); por isso ficam os últimos 5 dias úteis e, de cada regional, o preço
// mais recente, com a data. O IEA não publica média do estado nessa consulta.
const PAGINA = 'https://infoiea.agricultura.sp.gov.br/BancoDeDados/PrecosDiarios/Recebidos';
const UA_AGROINFO = 'Mozilla/5.0 (compatible; AgroInfo/1.0; +https://agronahora.com.br)';
// código do produto no IEA, nome no botão, nome na tabela do IEA (o resultado não traz o código) e, se
// for diferente do botão, o nome por extenso no título; na ordem dos botões
export const PRODUTOS_IEA = [
  ['1126', 'Soja', 'Soja'], ['1124', 'Milho', 'Milho'], ['1130', 'Trigo', 'Trigo'],
  ['1053', 'Café', 'Café benef. tipo 6 duro', 'Café beneficiado tipo 6 duro'],
  ['1311', 'Laranja', 'Laranja para industria', 'Laranja para indústria'], ['1411', 'Boi gordo', 'Boi gordo'], ['1412', 'Vaca gorda', 'Vaca gorda'],
];
const comparavel = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const UNIDADES = { 'sc.60 kg': 'saca de 60 kg', '@': 'arroba', 'cx.40,8 kg': 'caixa de 40,8 kg' };
const DIAS_UTEIS = 5;

const texto = celula => celula.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const isoDe = dia => (/^\d{2}\/\d{2}\/\d{4}$/.test(dia) ? `${dia.slice(6)}-${dia.slice(3, 5)}-${dia.slice(0, 2)}` : null);

// Linhas da tabela de resultado: Grupo | Produto | EDR | Data | Preço Médio (R$) | Unidade | Obs
export function lerResultado(html) {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    .map(m => [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c => texto(c[1])))
    .filter(c => c.length >= 6)
    .map(([, produto, edr, dia, preco, unidade]) => ({ produto, edr, data: isoDe(dia), valor: Number(preco.replace(/\./g, '').replace(',', '.')), unidade }))
    .filter(l => l.data && l.edr && Number.isFinite(l.valor) && l.valor > 0);
}

// De várias linhas (vários dias), o preço mais recente de cada regional, por produto.
export function juntarDias(linhas) {
  return PRODUTOS_IEA.map(([, nome, noIea, descricao]) => {
    const doProduto = linhas.filter(l => comparavel(l.produto) === comparavel(noIea));
    if (!doProduto.length) return null;
    const porRegional = new Map();
    for (const l of doProduto) if (!porRegional.has(l.edr) || l.data > porRegional.get(l.edr).data) porRegional.set(l.edr, l);
    const locais = [...porRegional.values()].map(l => ({ nome: l.edr, valor: l.valor, data: l.data })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const unidade = doProduto[0].unidade;
    return {
      nome, descricao: descricao ?? nome, unidade: UNIDADES[unidade] ?? unidade, tipoLocal: 'Regional (EDR)',
      data: locais.reduce((a, l) => (l.data > a ? l.data : a), ''), desde: locais.reduce((a, l) => (l.data < a ? l.data : a), '9999'),
      mediaEstado: null, variacaoEstado: null, regioes: [], locais,
    };
  }).filter(Boolean);
}

// Os últimos dias úteis (segunda a sexta) até hoje, no horário de Brasília, no formato do formulário.
export function diasUteis(hoje = new Date(), quantos = DIAS_UTEIS) {
  const dias = [];
  const d = new Date(new Date(hoje).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  while (dias.length < quantos) {
    if (d.getDay() !== 0 && d.getDay() !== 6) dias.push(d.toLocaleDateString('pt-BR'));
    d.setDate(d.getDate() - 1);
  }
  return dias;
}

export async function cotacaoSaoPaulo() {
  const pagina = await fetch(PAGINA, { headers: { 'User-Agent': UA_AGROINFO }, signal: AbortSignal.timeout(20000) });
  if (!pagina.ok) throw new Error(`IEA respondeu ${pagina.status}`);
  const html = await pagina.text();
  const chave = html.match(/name="__RequestVerificationToken" type="hidden" value="([^"]+)"/)?.[1];
  const regionais = [...html.matchAll(/name="edrs"\s*v-model="selecionados" value="(\d+)"/g)].map(m => m[1]);
  if (!chave || !regionais.length) throw new Error('formulário do IEA mudou');
  const cookie = pagina.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  const pedirDia = async dia => {
    const corpo = new URLSearchParams([...PRODUTOS_IEA.map(([codigo]) => ['produtos', codigo]), ...regionais.map(r => ['edrs', r]),
      ['startDate', dia], ['endDate', dia], ['__RequestVerificationToken', chave]]);
    const r = await fetch(PAGINA, { method: 'POST', body: corpo, signal: AbortSignal.timeout(20000),
      headers: { 'User-Agent': UA_AGROINFO, Cookie: cookie, 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (!r.ok) throw new Error(`IEA respondeu ${r.status}`);
    return lerResultado(await r.text());
  };
  const respostas = await Promise.allSettled(diasUteis().map(pedirDia));
  const produtos = juntarDias(respostas.flatMap(r => (r.status === 'fulfilled' ? r.value : [])));
  if (!produtos.length) throw new Error('IEA sem preços nos últimos dias');
  return { fonte: 'IEA', pagina: PAGINA, consultadoEm: new Date().toISOString(), produtos };
}
