// Canais da aba "TV Agro", na ordem dos botões. Tudo passa pelo player oficial do YouTube: nada de
// sinal capturado do site das emissoras.
//
// channelId: ID do canal no YouTube (começa com "UC"), conferido em 07/10/2026; ao lado de cada um
//   está de onde veio a confirmação. Não vale o primeiro canal que aparece com o nome:
//   youtube.com/@canalrural é o Canal Rural da Argentina e youtube.com/@agrocanaltv é do Chile.
// playlistId: vídeos enviados pelo canal, para o plano B ("Ver vídeos recentes"). É o channelId com
//   "UULF" no lugar de "UC": os envios sem as transmissões ao vivo e os Shorts. A lista com tudo
//   ("UU" + o resto) começa pela transmissão agendada, que ainda não toca.
// Canal sem channelId aparece desabilitado na tela, com o link para o site.
export const CANAIS_AGRO = [
  {
    id: 'canal-rural', nome: 'Canal Rural',
    descricao: 'Notícias do agronegócio, mercado, previsão do tempo e leilões, 24 horas por dia.',
    channelId: 'UCcmbSgSpK0dQhw3IBaBGo-g', // youtube.com/@CanalruralBr: Brasil, desde 2015, com os links do canalrural.com.br
    playlistId: 'UULFcmbSgSpK0dQhw3IBaBGo-g',
    siteUrl: 'https://www.canalrural.com.br/',
  },
  {
    id: 'canal-do-boi', nome: 'Canal do Boi',
    descricao: 'Pecuária, leilões e o telejornal Bom Dia Produtor, do Sistema Brasileiro do Agronegócio (SBA).',
    channelId: 'UCumKvcgpO2MCQ45pi-fXf_g', // youtube.com/@CanaldoBoiSBA: é o link do YouTube no sba1.com
    playlistId: 'UULFumKvcgpO2MCQ45pi-fXf_g',
    siteUrl: 'https://sba1.com/aovivo/canaldoboi',
  },
  {
    id: 'agro-canal', nome: 'Agro Canal',
    descricao: 'Leilões rurais, entrevistas e notícias da agropecuária, também do SBA.',
    // TODO: o Agro Canal não tem canal próprio no YouTube (conferido em 07/10/2026): o sba1.com só o
    // transmite por player próprio, que não entra aqui. Preencher os dois campos se o canal for criado.
    channelId: '',
    playlistId: '',
    siteUrl: 'https://sba1.com/aovivo/agrocanal',
  },
  {
    id: 'noticias-agricolas', nome: 'Notícias Agrícolas',
    descricao: 'Análises de mercado, cotações e a previsão de tempo e clima para o produtor.',
    channelId: 'UCyHK5OwqtBksa0ItQRG1uVA', // youtube.com/@NoticiasAgricolasOficial: é o link do YouTube no noticiasagricolas.com.br
    playlistId: 'UULFyHK5OwqtBksa0ItQRG1uVA',
    siteUrl: 'https://www.noticiasagricolas.com.br/',
  },
  {
    id: 'embrapa', nome: 'Embrapa',
    descricao: 'Pesquisas, tecnologias e boas práticas da Empresa Brasileira de Pesquisa Agropecuária.',
    channelId: 'UCW0ZdZjp_1NjVi7FQeuvOZw', // youtube.com/@embrapa: é o link do YouTube no embrapa.br/youtube
    playlistId: 'UULFW0ZdZjp_1NjVi7FQeuvOZw',
    siteUrl: 'https://www.embrapa.br/',
  },
];

// Endereços do player oficial e da página do canal no YouTube.
export const urlAoVivo = canal => `https://www.youtube.com/embed/live_stream?channel=${canal.channelId}`;
export const urlRecentes = canal => `https://www.youtube.com/embed/videoseries?list=${canal.playlistId}`;
// O YouTube leva este endereço para a transmissão que estiver no ar, se houver.
export const urlNoYouTube = canal => `https://www.youtube.com/channel/${canal.channelId}/live`;
