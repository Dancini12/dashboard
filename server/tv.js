// Aba "TV Agro": o que cada canal está transmitindo agora no YouTube. A página pública
// youtube.com/channel/<id>/live abre a transmissão que está no ar (ou a próxima agendada) e traz no
// próprio HTML os dados que o player usa; daqui saem o código do vídeo e a situação do canal. Não usa
// chave de API. Com o código do vídeo, a aba abre o player direto na transmissão, o que é mais
// confiável que o endereço "ao vivo pelo canal" do YouTube (ele recusa canais com mais de uma
// transmissão aberta, como o Canal Rural, e às vezes chega sem a transmissão pronta).
import { CANAIS_AGRO } from '../src/canaisAgro.js';

const UA_AGROINFO = 'Mozilla/5.0 (compatible; AgroInfo-CEEPA/1.0; +https://agroinfo-dashboard.vercel.app)';
const DADOS_DO_PLAYER = 'ytInitialPlayerResponse = ';

// O objeto JSON que começa em `inicio`, lido até a chave que o fecha (chaves dentro de texto não contam).
function objetoEm(texto, inicio) {
  let nivel = 0, dentroDeTexto = false;
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i];
    if (dentroDeTexto) { if (c === '\\') i++; else if (c === '"') dentroDeTexto = false; }
    else if (c === '"') dentroDeTexto = true;
    else if (c === '{') nivel++;
    else if (c === '}' && --nivel === 0) return JSON.parse(texto.slice(inicio, i + 1));
  }
  throw new Error('dados do player incompletos');
}

const ENTIDADES = { amp: '&', quot: '"', '#39': "'", lt: '<', gt: '>' };
// Título da transmissão pelo cabeçalho da página, para quando os dados do player não vêm.
function tituloDaPagina(html) {
  const titulo = /<meta name="title" content="([^"]*)"/.exec(html)?.[1] ?? /<title>([^<]*?)(?: - YouTube)?<\/title>/.exec(html)?.[1];
  return titulo ? titulo.replace(/&(amp|quot|#39|lt|gt);/g, (_, nome) => ENTIDADES[nome]).trim() : null;
}

// Código do vídeo da página de uma transmissão, pelos lugares em que o YouTube o repete fora dos dados do player.
const codigoDoVideo = html => /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/.exec(html)?.[1]
  ?? /<meta property="og:url" content="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/.exec(html)?.[1]
  ?? /"currentVideoEndpoint":\{.{0,600}?"videoId":"([\w-]{11})"/s.exec(html)?.[1];

// HTML da página /live do canal → { situacao: 'aoVivo' | 'agendado' | 'fora', videoId, titulo, inicio }.
// Página que não é a do canal (aviso de cookies, bloqueio, erro) dá erro em vez de "fora", para a aba
// não dizer que o canal saiu do ar quando só a consulta falhou.
export function lerPaginaAoVivo(html, channelId) {
  const comeco = html.indexOf(DADOS_DO_PLAYER);
  if (comeco < 0) {
    // sem transmissão no ar nem agendada, o YouTube mostra a página inicial do canal
    if (html.includes(`<link rel="canonical" href="https://www.youtube.com/channel/${channelId}"`)) return { situacao: 'fora', motivo: 'sem transmissão aberta' };
    throw new Error(`página inesperada: ${/<title>([^<]*)/.exec(html)?.[1].slice(0, 60) ?? 'sem título'}`);
  }
  const dados = objetoEm(html, comeco + DADOS_DO_PLAYER.length);
  const video = dados.videoDetails;
  if (!video?.videoId) {
    // A acessos vindos de servidores (como o da Vercel), o YouTube troca os dados do vídeo que está
    // tocando por um pedido de login ("confirme que você não é um bot"). A página continua sendo a da
    // transmissão, com o código do vídeo no endereço canônico; e, como transmissão agendada vem com os
    // dados completos, página assim aberta pelo /live do canal é de transmissão no ar.
    const videoId = codigoDoVideo(html);
    if (dados.playabilityStatus?.status === 'LOGIN_REQUIRED' && videoId && html.includes(channelId)) return { situacao: 'aoVivo', videoId, titulo: tituloDaPagina(html) };
    const canonico = /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1] ?? 'não tem';
    throw new Error(`sem dados do vídeo: ${dados.playabilityStatus?.status} ${dados.playabilityStatus?.reason ?? ''} [vídeo: ${videoId ?? 'não achado'}; canônico: ${canonico}; cita o canal: ${html.includes(channelId) ? 'sim' : 'não'}; ${html.length} caracteres]`);
  }
  if (video.channelId !== channelId) throw new Error('transmissão de outro canal');
  if (video.isUpcoming) {
    const segundos = Number(dados.playabilityStatus?.liveStreamability?.liveStreamabilityRenderer?.offlineSlate?.liveStreamOfflineSlateRenderer?.scheduledStartTime);
    return { situacao: 'agendado', videoId: video.videoId, titulo: video.title, inicio: segundos ? new Date(segundos * 1000).toISOString() : null };
  }
  // transmissão encerrada, restrita ou que o canal não deixa exibir em outros sites conta como fora do ar
  const noAr = video.isLive === true && dados.playabilityStatus?.status === 'OK' && dados.playabilityStatus.playableInEmbed !== false;
  return noAr ? { situacao: 'aoVivo', videoId: video.videoId, titulo: video.title }
    : { situacao: 'fora', motivo: `transmissão que não dá para exibir (${dados.playabilityStatus?.status}${video.isLive ? '' : ', não está ao vivo'})` };
}

async function situacaoDoCanal(canal) {
  const response = await fetch(`https://www.youtube.com/channel/${canal.channelId}/live`, {
    signal: AbortSignal.timeout(12000),
    // SOCS: dispensa a tela de consentimento de cookies que o YouTube mostra a acessos vindos da Europa
    headers: { 'User-Agent': UA_AGROINFO, 'Accept-Language': 'pt-BR,pt;q=0.9', Cookie: 'SOCS=CAI' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return lerPaginaAoVivo(await response.text(), canal.channelId);
}

// Situação de cada canal que tem YouTube. Canal cuja consulta falhou fica de fora de "canais", e a
// aba trata esse canal como trataria todos se esta consulta não existisse; o motivo vai em "falhas".
export async function canaisAoVivo() {
  const canais = CANAIS_AGRO.filter(canal => canal.channelId);
  const respostas = await Promise.allSettled(canais.map(situacaoDoCanal));
  const lidos = canais.flatMap((canal, i) => (respostas[i].status === 'fulfilled' ? [[canal.id, respostas[i].value]] : []));
  const falhas = canais.flatMap((canal, i) => (respostas[i].status === 'rejected' ? [[canal.id, String(respostas[i].reason?.message ?? respostas[i].reason)]] : []));
  if (!lidos.length) throw new Error(`YouTube não respondeu: ${falhas[0]?.[1]}`);
  return { canais: Object.fromEntries(lidos), ...(falhas.length ? { falhas: Object.fromEntries(falhas) } : {}), fonte: 'YouTube' };
}
