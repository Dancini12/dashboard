import { useEffect, useRef, useState } from "react";
import { ExternalLink, History, Radio } from "lucide-react";
import { CANAIS_AGRO, PLAYER_YOUTUBE, urlAoVivo, urlNoYouTube, urlRecentes } from "../canaisAgro";

// Aba "TV Agro": canais do agro ao vivo, pelo player oficial do YouTube. O site não tem como saber
// antes se o canal está no ar (isso exigiria chave de API): quem avisa é o próprio player. Quando ele
// avisa que não tem transmissão para mostrar, a tela passa para os vídeos recentes do canal (plano B)
// e explica o motivo. O botão "Ver vídeos recentes" faz a mesma troca à mão.
// O endereço do ao vivo pelo canal às vezes chega do YouTube sem a transmissão pronta (player preto,
// que dá erro no play e não responde ao site): nesse caso a tela carrega o player de novo, até 3 vezes.
const VERDE = "#166534";
const COM_YOUTUBE = CANAIS_AGRO.filter(c => c.channelId);
const SEM_YOUTUBE = CANAIS_AGRO.filter(c => !c.channelId);

const Aviso = ({ children }) => (
  <div role="status" className="rounded-lg p-2.5 mt-3 text-xs sm:text-sm" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#78350f" }}>{children}</div>
);
const BOTAO = "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs sm:text-sm font-bold";
const CONTORNO = { border: "1px solid #bbf7d0", color: VERDE, background: "#fff" };

export default function TvAgro({ inicial }) {
  // recargas: quantas vezes o player ao vivo do canal escolhido já foi carregado de novo sozinho
  const [escolha, setEscolha] = useState(() => ({ id: (COM_YOUTUBE.find(c => c.id === inicial) ?? COM_YOUTUBE[0])?.id, recentes: false, recargas: 0 }));
  const [carga, setCarga] = useState(0); // cada número novo monta o player outra vez
  const [semSinal, setSemSinal] = useState([]); // endereços de player que avisaram erro
  const [carregado, setCarregado] = useState(null); // quadro (elemento) que já terminou de carregar
  const [semYouTube, setSemYouTube] = useState(false); // a rede não deixou chegar ao YouTube
  const quadro = useRef(null);

  const canal = COM_YOUTUBE.find(c => c.id === escolha.id);
  // escolher o canal, mesmo o que já está na tela, tenta o ao vivo de novo
  const assistir = (id) => { setEscolha({ id, recentes: false, recargas: 0 }); setSemSinal([]); setCarga(n => n + 1); };
  const { recargas } = escolha;
  const semAoVivo = Boolean(canal) && semSinal.includes(urlAoVivo(canal));
  const aoVivo = Boolean(canal) && !escolha.recentes && !semAoVivo;
  const player = canal ? (aoVivo ? urlAoVivo(canal) : urlRecentes(canal)) : null;
  const semRecentes = !aoVivo && semSinal.includes(player);

  // Rede que bloqueia o YouTube (comum em escolas): o quadro do player fica com um erro do navegador
  // e o site não enxerga o que há dentro dele. Um pedido simples ao YouTube mostra se a rede deixa
  // chegar lá; a resposta em si não importa (e nem pode ser lida daqui), só se a ligação aconteceu.
  useEffect(() => {
    let ativo = true;
    fetch(`${PLAYER_YOUTUBE}/robots.txt`, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(15000) })
      .catch(() => { if (ativo) setSemYouTube(true); });
    return () => { ativo = false; };
  }, []);

  // O player só conta o que acontece nele a quem pede, e só depois de pronto: o pedido se repete até
  // a primeira resposta, por 4 segundos. Player ao vivo que não responde nesse tempo é carregado de
  // novo, menos quando a pessoa já clicou nele (o foco está no quadro) ou a rede não chega ao YouTube.
  useEffect(() => {
    if (!player || carregado !== quadro.current) return;
    let pedidos = 0;
    const pedir = () => {
      if (++pedidos <= 8) { quadro.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: "tv-agro", channel: "widget" }), PLAYER_YOUTUBE); return; }
      clearInterval(repeticao);
      if (aoVivo && recargas < 3 && !semYouTube && document.activeElement !== quadro.current) {
        setEscolha(atual => ({ ...atual, recargas: atual.recargas + 1 }));
        setCarga(n => n + 1);
      }
    };
    const ouvir = (evento) => {
      if (evento.origin !== PLAYER_YOUTUBE || evento.source !== quadro.current?.contentWindow) return;
      clearInterval(repeticao);
      let aviso;
      try { aviso = JSON.parse(evento.data); } catch { return; }
      // erro do player: sem transmissão, vídeo fora do ar ou exibição bloqueada em outros sites
      if (aviso?.event === "onError") setSemSinal(lista => (lista.includes(player) ? lista : [...lista, player]));
    };
    const repeticao = setInterval(pedir, 500);
    window.addEventListener("message", ouvir);
    pedir();
    return () => { clearInterval(repeticao); window.removeEventListener("message", ouvir); };
  }, [player, carregado, aoVivo, recargas, semYouTube]);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-white p-3 shadow-sm">
        <h2 className="text-sm font-bold text-green-800">TV Agro · canais do agro ao vivo</h2>
        <p className="text-xs text-slate-600 mt-1">Canais gratuitos do agronegócio, exibidos pelo player oficial do YouTube. Escolha o canal e aperte o play: o vídeo não começa sozinho.</p>
        <div role="group" aria-label="Canais" className="flex flex-wrap gap-2 mt-3">
          {CANAIS_AGRO.map(c => {
            const ativo = c.id === canal?.id;
            return (
              <button key={c.id} type="button" disabled={!c.channelId} aria-pressed={ativo} onClick={() => assistir(c.id)}
                title={c.channelId ? c.descricao : "Este canal não transmite pelo YouTube"}
                className="rounded-full px-3.5 py-2 text-xs sm:text-sm font-bold transition-colors disabled:cursor-not-allowed"
                style={!c.channelId ? { background: "#f1f5f9", color: "#94a3b8" } : ativo ? { background: VERDE, color: "#fff" } : { background: "#f0fdf4", color: VERDE }}>
                {c.nome}{!c.channelId && <span className="font-normal"> · indisponível</span>}
              </button>
            );
          })}
        </div>
        {SEM_YOUTUBE.map(c => (
          <p key={c.id} className="text-xs text-slate-500 mt-2">
            {c.nome} não transmite pelo YouTube. <a href={c.siteUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline" style={{ color: VERDE }}>Assistir no site do canal</a>
          </p>
        ))}
      </section>

      {canal ? (
        <section className="rounded-xl border bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-base font-bold" style={{ color: "#14532d" }}>{canal.nome}</h3>
            <span className="rounded px-1.5 py-0.5 font-bold uppercase" style={{ background: "#f1f5f9", color: "#334155", fontSize: 10 }}>{aoVivo ? "Transmissão ao vivo" : "Vídeos recentes"}</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{canal.descricao}</p>

          {semAoVivo && (
            <Aviso>
              <strong>{canal.nome} não está ao vivo aqui no momento.</strong> O YouTube não entregou uma transmissão ao vivo deste canal para o painel
              (o canal pode estar fora do ar ou não liberar a transmissão para outros sites), então o player abaixo mostra os vídeos recentes.{" "}
              <a href={urlNoYouTube(canal)} target="_blank" rel="noopener noreferrer" className="font-bold underline whitespace-nowrap">Conferir no YouTube</a>
            </Aviso>
          )}
          {semRecentes && <Aviso><strong>Os vídeos recentes de {canal.nome} não carregaram aqui.</strong> Abra o site do canal para assistir.</Aviso>}
          {semYouTube && (
            <Aviso>
              <strong>Esta rede não está deixando o YouTube abrir.</strong> É comum em redes de escola: o player abaixo deve ficar em branco ou com
              mensagem de erro. Tente em outra rede (os dados do celular, por exemplo) ou use “Abrir no site do canal”.
            </Aviso>
          )}

          <div className="relative mt-3 w-full overflow-hidden rounded-lg aspect-video" style={{ background: "#0f172a" }}>
            <iframe key={`${player}#${carga}`} ref={quadro} onLoad={evento => setCarregado(evento.currentTarget)}
              src={`${player}${player.includes("?") ? "&" : "?"}enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
              title={aoVivo ? `${canal.nome} ao vivo no YouTube` : `Vídeos recentes de ${canal.nome} no YouTube`}
              loading="lazy" allowFullScreen allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin"
              className="absolute inset-0 h-full w-full" style={{ border: 0 }} />
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {aoVivo
              ? <button type="button" onClick={() => setEscolha({ id: canal.id, recentes: true, recargas: 0 })} className={BOTAO} style={{ background: VERDE, color: "#fff" }}><History size={14} aria-hidden="true" />Ver vídeos recentes</button>
              : <button type="button" onClick={() => assistir(canal.id)} className={BOTAO} style={{ background: VERDE, color: "#fff" }}><Radio size={14} aria-hidden="true" />{semAoVivo ? "Tentar o ao vivo de novo" : "Voltar para o ao vivo"}</button>}
            <a href={canal.siteUrl} target="_blank" rel="noopener noreferrer" className={BOTAO} style={CONTORNO}><ExternalLink size={14} aria-hidden="true" />Abrir no site do canal</a>
          </div>
          {aoVivo && !semYouTube && (
            <p className="text-xs text-slate-500 mt-2">
              O player avisou que a transmissão ainda vai começar, que o vídeo está indisponível ou que ocorreu um erro? Toque em “Ver vídeos recentes”, ou no nome do canal para carregar o ao vivo de novo.
            </p>
          )}
          <p className="text-xs text-slate-500 mt-1">No telão, use o botão de tela cheia no canto do player.</p>
        </section>
      ) : <p className="text-sm text-slate-500">Nenhum canal disponível no YouTube no momento.</p>}

      <p className="text-xs text-slate-500">
        Vídeos e transmissões: YouTube, nos canais oficiais de cada emissora. A programação e os anúncios são de responsabilidade dos canais.
      </p>
    </div>
  );
}
