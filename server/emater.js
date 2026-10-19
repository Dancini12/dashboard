/* global Buffer */
// Boletim semanal de preços da Emater/RS-Ascar (aba Cotações Cooperativas, Rio Grande do Sul). O site da
// Emater não responde a acessos de fora do Brasil, e a rotina do GitHub que lê o PDF
// (scripts/precos-rs.py) roda nos Estados Unidos: ela baixa o PDF por aqui, porque as funções do site
// rodam em São Paulo ("regions" no vercel.json). Só entrega o último boletim da página de preços
// semanais, nada além disso.
const PAGINA = 'https://www.emater.tche.br/site/info-agro/precos_semanais.php';
const UA_AGROINFO = 'Mozilla/5.0 (compatible; AgroInfo/1.0; +https://agronahora.com.br)';

// A página lista os PDFs das últimas semanas (preco_DDMMAAAA.pdf); vale o de data mais recente.
export function ultimoBoletim(html) {
  const achados = [...html.matchAll(/arquivos_pdf\/precos\/preco_(\d{2})(\d{2})(\d{4})\.pdf/g)];
  if (!achados.length) return null;
  const [, dia, mes, ano] = achados.reduce((a, m) => (`${m[3]}${m[2]}${m[1]}` > `${a[3]}${a[2]}${a[1]}` ? m : a));
  return `https://www.emater.tche.br/site/arquivos_pdf/precos/preco_${dia}${mes}${ano}.pdf`;
}

export async function boletimDaEmater() {
  const pedir = url => fetch(url, { headers: { 'User-Agent': UA_AGROINFO }, signal: AbortSignal.timeout(20000) })
    .then(r => (r.ok ? r : Promise.reject(new Error(`Emater respondeu ${r.status}`))));
  const endereco = ultimoBoletim(await (await pedir(PAGINA)).text());
  if (!endereco) throw new Error('nenhum boletim na página da Emater');
  return { endereco, conteudo: Buffer.from(await (await pedir(endereco)).arrayBuffer()) };
}
