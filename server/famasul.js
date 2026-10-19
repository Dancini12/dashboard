// Aba "Cotações Cooperativas", Mato Grosso do Sul: "Cotações online" do Sistema Famasul, uma página com
// uma tabela por produto (@Boi, @Vaca, Saca - Milho, Saca - Soja) e as cotações dos últimos dias por região
// ou cidade, mais a média do estado. Fica a data mais recente de cada produto; a variação de cada praça é
// calculada sobre a cotação anterior dela na mesma tabela.
const PAGINA = 'https://portal.sistemafamasul.com.br/cotacoes-online';
const UA_AGROINFO = 'Mozilla/5.0 (compatible; AgroInfo/1.0; +https://agronahora.com.br)';
const ESTADO = 'Mato Grosso do Sul';
// título da tabela na página → como aparece no site, na ordem dos botões
const TABELAS = [
  ['Saca - Soja', { nome: 'Soja', descricao: 'Soja', unidade: 'saca de 60 kg', tipoLocal: 'Cidade' }],
  ['Saca - Milho', { nome: 'Milho', descricao: 'Milho', unidade: 'saca de 60 kg', tipoLocal: 'Cidade' }],
  ['@Boi', { nome: 'Boi gordo', descricao: 'Boi gordo', unidade: 'arroba', tipoLocal: 'Região' }],
  ['@Vaca', { nome: 'Vaca gorda', descricao: 'Vaca gorda', unidade: 'arroba', tipoLocal: 'Região' }],
];

const texto = celula => celula.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
// "R$ 363.97" (ponto decimal, como vem na página) ou "R$ 1.363,97"
function numero(celula) {
  const t = texto(celula).replace(/[^\d.,]/g, '');
  const n = Number(/,\d{1,2}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, ''));
  return t && Number.isFinite(n) ? n : null;
}
const isoDe = dia => (/^\d{2}\/\d{2}\/\d{4}$/.test(dia) ? `${dia.slice(6)}-${dia.slice(3, 5)}-${dia.slice(0, 2)}` : null);
const variacao = (atual, anterior) => (anterior ? Math.round((atual / anterior - 1) * 10000) / 100 : null);

export function lerFamasul(html) {
  const tabelas = Object.fromEntries([...html.matchAll(/<table[^>]*>\s*<caption>([^<]*)<\/caption>([\s\S]*?)<\/table>/g)].map(m => [m[1].trim(), m[2]]));
  return TABELAS.map(([titulo, produto]) => {
    if (!tabelas[titulo]) return null;
    const linhas = [...tabelas[titulo].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
      .map(m => [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c => c[1]))
      .filter(c => c.length >= 3)
      .map(([dia, praca, valor, comFunrural]) => ({ data: isoDe(texto(dia)), nome: texto(praca), valor: numero(valor), comFunrural: comFunrural ? numero(comFunrural) : null }))
      .filter(l => l.data && l.nome && l.valor != null);
    if (!linhas.length) return null;
    const data = linhas.reduce((a, l) => (l.data > a ? l.data : a), '');
    // a cotação anterior de cada praça: a de data mais recente antes da última
    const anterior = nome => linhas.filter(l => l.nome === nome && l.data < data).reduce((a, l) => (!a || l.data > a.data ? l : a), null)?.valor;
    const doDia = linhas.filter(l => l.data === data);
    const estado = doDia.find(l => l.nome === ESTADO);
    return {
      ...produto, data,
      mediaEstado: estado?.valor ?? null, variacaoEstado: estado ? variacao(estado.valor, anterior(ESTADO)) : null,
      comFunruralEstado: estado?.comFunrural ?? null,
      regioes: [],
      locais: doDia.filter(l => l.nome !== ESTADO)
        .map(l => ({ nome: l.nome, valor: l.valor, variacao: variacao(l.valor, anterior(l.nome)) }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    };
  }).filter(Boolean);
}

export async function cotacaoMatoGrossoDoSul() {
  const r = await fetch(PAGINA, { headers: { 'User-Agent': UA_AGROINFO }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`Famasul respondeu ${r.status}`);
  const produtos = lerFamasul(await r.text());
  if (!produtos.length) throw new Error('página da Famasul sem cotações');
  return { fonte: 'Famasul', pagina: PAGINA, consultadoEm: new Date().toISOString(), produtos };
}
