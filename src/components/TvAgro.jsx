import { useEffect, useRef, useState } from "react";
import { ExternalLink, History, Radio } from "lucide-react";
import { CANAIS_AGRO, PLAYER_YOUTUBE, urlAoVivo, urlDoVideo, urlNoYouTube, urlRecentes } from "../canaisAgro";

// Aba "TV Agro": canais do agro ao vivo, pelo player oficial do YouTube. O servidor do site consulta
// o YouTube (/api/market?type=tv) e diz, de cada canal, se há transmissão no ar e qual é o vídeo: com
// isso o player abre direto na transmissão, e canal fora do ar já aparece com os vídeos recentes
// (plano B) e o motivo. O botão "Ver vídeos recentes" faz a mesma troca à mão.
// Se a consulta falha, a aba se vira com o player: abre o endereço "ao vivo pelo canal" e passa para
// os vídeos recentes quando o player avisa erro. Esse endereço às vezes chega do YouTube sem a
// transmissão pronta (player preto, que dá erro no play e não responde ao site): nesse caso a tela
// carrega o player de novo, até 3 vezes.
const VERDE = "#166534";
const VERMELHO = "#dc2626";
const COM_YOUTUBE = CANAIS_AGRO.filter(c => c.channelId);
const SEM_YOUTUBE = CANAIS_AGRO.filter(c => !c.channelId);
// "sexta-feira, 09/10, 10:00"
const quando = inicio => new Date(inicio).toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const Aviso = ({ children }) => (
  <div role="status" className="rounded-lg p-2.5 mt-3 text-xs sm:text-sm" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#78350f" }}>{children}</div>
);
const NoAr = ({ claro }) => <span aria-hidden="true" className="inline-block shrink-0 rounded-full" style={{ width: 8, height: 8, background: VERMELHO, boxShadow: claro ? "0 0 0 2px rgba(255,255,255,0.85)" : "none" }} />;
const BOTAO = "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs sm:text-sm font-bold";
const CONTORNO = { border: "1px solid #bbf7d0", color: VERDE, background: "#fff" };

export default function TvAgro({ inicial }) {
  // modo: "auto" segue a programação (ao vivo se o canal está no ar, senão vídeos recentes), "aoVivo"
  // insiste no ao vivo e "recentes" é a escolha dos vídeos recentes. recargas: quantas vezes o player
  // ao vivo do canal escolhido já foi carregado de novo sozinho.
  const [escolha, setEscolha] = useState(() => ({ id: (COM_YOUTUBE.find(c => c.id === inicial) ?? COM_YOUTUBE[0])?.id, modo: "auto", recargas: 0 }));
  // Programação: undefined enquanto a primeira consulta não volta, null se ela falhou. "guia" é a mais
  // recente (marca os canais no ar); "base" é a que valia quando o canal foi escolhido e decide o
  // player, para uma consulta nova não trocar o vídeo de quem está assistindo.
  const [guia, setGuia] = useState(undefined);
  const [base, setBase] = useState(undefined);
  const [carga, setCarga] = useState(0); // cada número novo monta o player outra vez
  const [semSinal, setSemSinal] = useState([]); // endereços de player que avisaram erro
  const [carregado, setCarregado] = useState(null); // quadro (elemento) que já terminou de carregar
  const [semYouTube, setSemYouTube] = useState(false); // a rede não deixou chegar ao YouTube
  const quadro = useRef(null);

  const canal = COM_YOUTUBE.find(c => c.id === escolha.id);
  // escolher o canal, mesmo o que já está na tela, vale como "tentar de novo" com a programação mais recente
  const assistir = (id, modo = "auto") => { setEscolha({ id, modo, recargas: 0 }); setSemSinal([]); setCarga(n => n + 1); setBase(guia); };
  const { recargas } = escolha;
  const consultando = base === undefined;
  const info = canal ? base?.[canal.id] : undefined; // o que a programação diz do canal; undefined se não disse nada
  const noAr = info?.situacao === "aoVivo";
  const foraDoAr = Boolean(info) && !noAr; // transmissão só agendada, ou nenhuma
  const enderecoAoVivo = canal ? (noAr ? urlDoVideo(info.videoId) : urlAoVivo(canal)) : null;
  const semAoVivo = Boolean(canal) && (semSinal.includes(enderecoAoVivo) || (foraDoAr && escolha.modo === "auto"));
  const aoVivo = Boolean(canal) && escolha.modo !== "recentes" && !semAoVivo;
  const player = canal && !consultando ? (aoVivo ? enderecoAoVivo : urlRecentes(canal)) : null;
  const semRecentes = !aoVivo && semSinal.includes(player);

  // Programação dos canais, conferida de novo a cada 3 minutos enquanto a aba está aberta.
  useEffect(() => {
    let ativo = true;
    const consultar = () => fetch("/api/market?type=tv", { signal: AbortSignal.timeout(8000) })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("indisponível"))))
      .then(d => { if (ativo) { setGuia(d.canais); setBase(atual => (atual === undefined ? d.canais : atual)); } })
      .catch(() => { if (ativo) { setGuia(atual => atual ?? null); setBase(atual => (atual === undefined ? null : atual)); } });
    consultar();
    const t = setInterval(consultar, 3 * 60 * 1000);
    return () => { ativo = false; clearInterval(t); };
  }, []);

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
            const passando = guia?.[c.id]?.situacao === "aoVivo";
            return (
              <button key={c.id} type="button" disabled={!c.channelId} aria-pressed={ativo} onClick={() => assistir(c.id)}
                title={!c.channelId ? "Este canal não transmite pelo YouTube" : passando ? `Ao vivo agora: ${guia[c.id].titulo}` : c.descricao}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs sm:text-sm font-bold transition-colors disabled:cursor-not-allowed"
                style={!c.channelId ? { background: "#f1f5f9", color: "#94a3b8" } : ativo ? { background: VERDE, color: "#fff" } : { background: "#f0fdf4", color: VERDE }}>
                {passando && <NoAr claro={ativo} />}
                <span>{c.nome}{passando && <span className="sr-only"> (ao vivo agora)</span>}{!c.channelId && <span className="font-normal"> · indisponível</span>}</span>
              </button>
            );
          })}
        </div>
        {guia && <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-2"><NoAr />ao vivo agora no YouTube</p>}
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
            {!consultando && (aoVivo && noAr
              ? <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-bold uppercase" style={{ background: "#fee2e2", color: "#991b1b", fontSize: 10 }}><NoAr />Ao vivo agora</span>
              : <span className="rounded px-1.5 py-0.5 font-bold uppercase" style={{ background: "#f1f5f9", color: "#334155", fontSize: 10 }}>{aoVivo ? "Transmissão ao vivo" : "Vídeos recentes"}</span>)}
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{canal.descricao}</p>
          {aoVivo && noAr && <p className="text-xs sm:text-sm text-slate-900 mt-1"><span className="text-slate-500">No ar:</span> <strong>{info.titulo}</strong></p>}

          {semAoVivo && (
            <Aviso>
              <strong>{canal.nome} não está ao vivo {foraDoAr ? "agora" : "aqui no momento"}.</strong>{" "}
              {foraDoAr
                ? <>{info.situacao === "agendado" ? <>Próxima transmissão: “{info.titulo}”{info.inicio && `, ${quando(info.inicio)}`}.</> : <>O canal não tem transmissão aberta no YouTube neste momento.</>} Enquanto isso, o player abaixo mostra os vídeos recentes.</>
                : <>O YouTube não entregou uma transmissão ao vivo deste canal para o painel (o canal pode estar fora do ar ou não liberar a transmissão para outros sites), então o player abaixo mostra os vídeos recentes.</>}{" "}
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
            {consultando
              ? <p className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: "#cbd5e1" }}>Conferindo o que está no ar…</p>
              : <iframe key={`${player}#${carga}`} ref={quadro} onLoad={evento => setCarregado(evento.currentTarget)}
                  src={`${player}${player.includes("?") ? "&" : "?"}enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
                  title={aoVivo ? `${canal.nome} ao vivo no YouTube` : `Vídeos recentes de ${canal.nome} no YouTube`}
                  loading="lazy" allowFullScreen allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin"
                  className="absolute inset-0 h-full w-full" style={{ border: 0 }} />}
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {aoVivo
              ? <button type="button" onClick={() => setEscolha({ id: canal.id, modo: "recentes", recargas: 0 })} className={BOTAO} style={{ background: VERDE, color: "#fff" }}><History size={14} aria-hidden="true" />Ver vídeos recentes</button>
              // com o canal fora do ar segundo a programação, "tentar de novo" insiste no ao vivo mesmo assim
              : <button type="button" onClick={() => assistir(canal.id, semAoVivo && foraDoAr ? "aoVivo" : "auto")} className={BOTAO} style={{ background: VERDE, color: "#fff" }}><Radio size={14} aria-hidden="true" />{semAoVivo ? "Tentar o ao vivo de novo" : "Voltar para o ao vivo"}</button>}
            <a href={canal.siteUrl} target="_blank" rel="noopener noreferrer" className={BOTAO} style={CONTORNO}><ExternalLink size={14} aria-hidden="true" />Abrir no site do canal</a>
          </div>
          {aoVivo && !noAr && !semYouTube && (
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
