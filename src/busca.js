// Busca do topo: encontra no índice do site os itens que combinam com o que o visitante digitou.

export const normalizar = texto => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const palavrasDe = texto => normalizar(texto).split(/[^a-z0-9]+/).filter(Boolean);

// Palavras de pergunta ("qual o preço do dólar hoje?") que não ajudam a achar nada.
const IGNORAR = new Set(['o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'e', 'que', 'qual', 'quais', 'quanto', 'quanta',
  'como', 'esta', 'hoje', 'em', 'no', 'na', 'um', 'uma', 'para', 'pra', 'por', 'sobre', 'ver', 'valor', 'preco', 'precos', 'cotacao']);

// Nomes do dia a dia para o nome usado no site.
const SINONIMOS = {
  porco: 'suino', gado: 'boi', bovino: 'boi', bezerro: 'boi', novilho: 'boi', aipim: 'mandioca', macaxeira: 'mandioca',
  chimarrao: 'erva', chocolate: 'cacau', racao: 'farelo', cambio: 'dolar', juros: 'selic', inflacao: 'ipca',
  clima: 'tempo', chuva: 'tempo', previsao: 'tempo',
};

const alternativas = palavra => [palavra, SINONIMOS[palavra], palavra.length > 3 && palavra.endsWith('s') ? palavra.slice(0, -1) : null].filter(Boolean);

// Cada palavra digitada precisa ser o começo de alguma palavra do título ou dos termos do item.
// Título que começa com a busca vem primeiro; empate fica na ordem do índice.
export function buscar(itens, consulta, limite = 8) {
  const digitadas = palavrasDe(consulta).filter(p => !IGNORAR.has(p));
  if (!digitadas.length) return [];
  return itens
    .map((item, ordem) => {
      const titulo = palavrasDe(item.titulo);
      const texto = [...titulo, ...palavrasDe(item.termos ?? '')];
      const combina = p => alternativas(p).some(a => texto.some(w => w.startsWith(a)));
      if (!digitadas.every(combina)) return null;
      const comeca = alternativas(digitadas[0]).some(a => titulo[0]?.startsWith(a));
      const noTitulo = digitadas.some(p => alternativas(p).some(a => titulo.some(w => w.startsWith(a))));
      return { item, pontos: comeca ? 3 : noTitulo ? 2 : 1, ordem };
    })
    .filter(Boolean)
    .sort((a, b) => b.pontos - a.pontos || a.ordem - b.ordem)
    .slice(0, limite)
    .map(r => r.item);
}
