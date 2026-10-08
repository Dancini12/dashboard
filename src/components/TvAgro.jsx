import { useEffect, useRef, useState } from "react";
import { ExternalLink, History, Radio } from "lucide-react";
import { CANAIS_AGRO, urlAoVivo, urlNoYouTube, urlRecentes } from "../canaisAgro";

// Aba "TV Agro": canais do agro ao vivo, pelo player oficial do YouTube. O site não tem como saber
// antes se o canal está no ar (isso exigiria chave de API): quem avisa é o próprio player. Quando ele
// avisa que não tem transmissão para mostrar, a tela passa para os vídeos recentes do canal (plano B)
// e explica o motivo. O botão "Ver vídeos recentes" faz a mesma troca à mão.
const YOUTUBE = "https://www.youtube.com";
const VERDE = "#166534";
const COM_YOUTUBE = CANAIS_AGRO.filter(c => c.channelId);
const SEM_YOUTUBE = CANAIS_AGRO.filter(c => !c.channelId);

const Aviso = ({ children }) => (
  <div role="status" className="rounded-lg p-2.5 mt-3 text-xs sm:text-sm" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#78350f" }}>{children}</div>
);
const BOTAO = "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs sm:text-sm font-bold";
const CONTORNO = { border: "1px solid #bbf7d0", color: VERDE, background: "#fff" };

export default function TvAgro({ inicial }) {
  const [escolha, setEscolha] = useState(() => ({ id: (COM_YOUTUBE.find(c => c.id === inicial) ?? COM_YOUTUBE[0])?.id, recentes: false }));
  const [semSinal, setSemSinal] = useState([]); // endereços de player que avisaram erro
  const [carregado, setCarregado] = useState(null); // quadro (elemento) que já terminou de carregar
  const [semResposta, setSemResposta] = useState(null); // endereço do player que ficou 10 segundos sem responder
  const quadro = useRef(null);

  const canal = COM_YOUTUBE.find(c => c.id === escolha.id);
  const assistir = (id) => { setEscolha({ id, recentes: false }); setSemSinal([]); setSemResposta(null); }; // escolher o canal tenta o ao vivo de novo
  const semAoVivo = Boolean(canal) && semSinal.includes(urlAoVivo(canal));
  const aoVivo = Boolean(canal) && !escolha.recentes && !semAoVivo;
  const player = canal ? (aoVivo ? urlAoVivo(canal) : urlRecentes(canal)) : null;
  const semRecentes = !aoVivo && semSinal.includes(player);
  const calado = Boolean(player) && semResposta === player;

  // O player só conta o que acontece nele a quem pede, e só depois de pronto: o pedido se repete até
  // a primeira resposta. Dez segundos sem resposta nenhuma é sinal de que o YouTube nem abriu no
  // quadro (rede que bloqueia o YouTube, como a de muitas escolas).
  useEffect(() => {
    if (!player || carregado !== quadro.current) return;
    let pedidos = 0;
    const pedir = () => {
      if (pedidos++ >= 20) { clearInterval(repeticao); setSemResposta(player); return; }
      quadro.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: "tv-agro", channel: "widget" }), YOUTUBE);
    };
    const ouvir = (evento) => {
      if (evento.origin !== YOUTUBE || evento.source !== quadro.current?.contentWindow) return;
      clearInterval(repeticao);
      setSemResposta(atual => (atual === player ? null : atual));
      let aviso;
      try { aviso = JSON.parse(evento.data); } catch { return; }
      // erro do player: sem transmissão, vídeo fora do ar ou exibição bloqueada em outros sites
      if (aviso?.event === "onError") setSemSinal(lista => (lista.includes(player) ? lista : [...lista, player]));
    };
    const repeticao = setInterval(pedir, 500);
    window.addEventListener("message", ouvir);
    pedir();
    return () => { clearInterval(repeticao); window.removeEventListener("message", ouvir); };
  }, [player, carregado]);

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
          {calado && (
            <Aviso>
              <strong>O player do YouTube não respondeu.</strong> Se o quadro abaixo ficou em branco ou com mensagem de erro, a rede em que você está pode
              estar bloqueando o YouTube (é comum em redes de escola). Tente em outra rede ou use “Abrir no site do canal”.
            </Aviso>
          )}

          <div className="relative mt-3 w-full overflow-hidden rounded-lg aspect-video" style={{ background: "#0f172a" }}>
            <iframe key={player} ref={quadro} onLoad={evento => setCarregado(evento.currentTarget)}
              src={`${player}&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
              title={aoVivo ? `${canal.nome} ao vivo no YouTube` : `Vídeos recentes de ${canal.nome} no YouTube`}
              loading="lazy" allowFullScreen allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin"
              className="absolute inset-0 h-full w-full" style={{ border: 0 }} />
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {aoVivo
              ? <button type="button" onClick={() => setEscolha({ id: canal.id, recentes: true })} className={BOTAO} style={{ background: VERDE, color: "#fff" }}><History size={14} aria-hidden="true" />Ver vídeos recentes</button>
              : <button type="button" onClick={() => assistir(canal.id)} className={BOTAO} style={{ background: VERDE, color: "#fff" }}><Radio size={14} aria-hidden="true" />{semAoVivo ? "Tentar o ao vivo de novo" : "Voltar para o ao vivo"}</button>}
            <a href={canal.siteUrl} target="_blank" rel="noopener noreferrer" className={BOTAO} style={CONTORNO}><ExternalLink size={14} aria-hidden="true" />Abrir no site do canal</a>
          </div>
          {aoVivo && !calado && (
            <p className="text-xs text-slate-500 mt-2">
              Se o player avisar que a transmissão ainda vai começar ou que o vídeo está indisponível, o canal não está ao vivo no momento: toque em “Ver vídeos recentes”.
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
