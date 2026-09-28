import { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import "./AssistenteAgro.css";

const SUGESTOES = ["Como o dólar influencia o preço da soja?", "O que é o indicador CEPEA?", "O que significa a variação percentual?"];
const AVISO = "Não digite dados pessoais. As conversas podem ser usadas pelo Google para melhorar seus produtos. "
  + "As perguntas ficam guardadas para o Castor aprender.";
const MAX_PERGUNTA = 500;
const MAX_HISTORICO = 6;
// Mesma mensagem do Assistente.gs para Gemini sobrecarregado (503): vale uma nova tentativa.
const MSG_INDISPONIVEL = "O assistente está indisponível agora. Tente de novo em instantes.";
// As tabelas de commodities do painel vêm do Notícias Agrícolas, que bloqueia leitura automática
// (Cloudflare); o assistente não recebe esses números e orienta o aluno a conferir a tabela.
const AVISO_COMMODITIES = "Os preços do dia das commodities (soja, milho, boi, café etc.) não chegam ao assistente: "
  + "eles aparecem no painel, na seção \"Consultar commodity\", em tabelas do Notícias Agrícolas. "
  + "Se o aluno perguntar sobre o preço ou a variação de hoje, explique o conceito e peça que ele confira o número nessa tabela.";

// Negrito (**texto**) e listas simples da resposta, sem HTML vindo de fora.
function negrito(linha) {
  return linha.split(/\*\*(.+?)\*\*/g).map((parte, i) => (i % 2 ? <strong key={i}>{parte}</strong> : parte.replace(/\*(\S[^*]*?)\*/g, "$1")));
}

function TextoFormatado({ texto }) {
  const marcadores = { ul: /^\s*[-*•]\s+/, ol: /^\s*\d+[.)]\s+/ };
  const trechos = []; // parágrafos e listas, na ordem em que aparecem
  texto.split(/\n{2,}/).forEach(bloco => {
    let atual = null;
    bloco.split("\n").filter(l => l.trim()).forEach(linha => {
      const tipo = marcadores.ul.test(linha) ? "ul" : marcadores.ol.test(linha) ? "ol" : "p";
      if (!atual || atual.tipo !== tipo) trechos.push(atual = { tipo, linhas: [] });
      atual.linhas.push(tipo === "p" ? linha : linha.replace(marcadores[tipo], ""));
    });
  });
  return trechos.map(({ tipo, linhas }, i) => {
    if (tipo === "p") return <p key={i}>{linhas.map((l, j) => <span key={j}>{j > 0 && <br />}{negrito(l)}</span>)}</p>;
    const Lista = tipo;
    return <Lista key={i}>{linhas.map((l, j) => <li key={j}>{negrito(l)}</li>)}</Lista>;
  });
}

const SAUDACAO = "Oi! Eu sou o Castor do AgroInfo. Pergunte sobre as cotações do painel que eu explico. 🤠";
const MS_POR_LETRA = 28;

// Tempo até a próxima letra, como alguém digitando: pausas depois de fim de frase,
// vírgula e parágrafo (só se vier espaço, para não parar no meio de "154,38"),
// com uma variação no ritmo para não soar robótico.
function atraso(texto, i) {
  const anterior = texto[i - 1];
  const proxima = texto[i];
  let base = MS_POR_LETRA;
  if (anterior === "\n") base = 450;
  else if (!proxima || /\s/.test(proxima)) base = /[.!?…]/.test(anterior) ? 380 : /[,;:]/.test(anterior) ? 150 : MS_POR_LETRA;
  return base * (0.7 + Math.random() * 0.6);
}

// Avança uma letra, pulando de uma vez os marcadores de negrito.
function proximaPosicao(texto, i) {
  let j = i;
  while (texto.startsWith("**", j)) j += 2;
  return Math.min(texto.length, j + 1);
}

// Texto que aparece letra a letra. Clicar mostra tudo de uma vez. O leitor de tela
// recebe o texto completo, sem ouvir cada letra.
function Digitado({ texto, animar, pausado, onFim, onAvanco }) {
  const [mostrados, setMostrados] = useState(animar ? 0 : texto.length);
  const posicao = useRef(animar ? 0 : texto.length);
  const avisos = useRef({ onFim, onAvanco });
  useEffect(() => {
    avisos.current = { onFim, onAvanco };
  });

  useEffect(() => {
    if (!animar || pausado) return;
    let timer;
    const passo = () => {
      if (posicao.current >= texto.length) return avisos.current.onFim?.();
      posicao.current = proximaPosicao(texto, posicao.current);
      setMostrados(posicao.current);
      avisos.current.onAvanco?.();
      timer = setTimeout(passo, atraso(texto, posicao.current));
    };
    timer = setTimeout(passo, 250);
    return () => clearTimeout(timer);
  }, [animar, pausado, texto]);

  const completo = !animar || mostrados >= texto.length;
  const parcial = completo ? texto : texto.slice(0, mostrados);
  const negritoAberto = (parcial.match(/\*\*/g) || []).length % 2 === 1;
  const mostrarTudo = () => {
    posicao.current = texto.length;
    setMostrados(texto.length);
    avisos.current.onFim?.();
  };
  return (
    <>
      <span className="assistente-sr">{texto}</span>
      <div aria-hidden="true" className={completo ? undefined : "digitando"}
        onClick={completo ? undefined : mostrarTudo} title={completo ? undefined : "Clique para mostrar tudo"}>
        <TextoFormatado texto={negritoAberto ? parcial + "**" : parcial} />
      </div>
    </>
  );
}

// Balão de diálogo do mascote, no estilo de quadrinho: o aluno pergunta e o assistente
// (Apps Script + Gemini) responde digitando, com base nas cotações do painel. Fica
// montado enquanto o mascote existe, para a conversa continuar quando o balão é
// fechado e aberto de novo.
export default function AssistenteAgro({ url, dadosDashboard, aberto, onFechar, onPensando, onFalando, className = "" }) {
  const [reduzMovimento] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [mensagens, setMensagens] = useState([]); // { id, autor: "aluno" | "assistente", texto, origem?, digitar? }
  const [saudou, setSaudou] = useState(reduzMovimento);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState("");
  const lista = useRef(null);
  const campo = useRef(null);
  const ultimoId = useRef(0);

  const falando = aberto && (!saudou || mensagens.some(m => m.digitar));
  useEffect(() => {
    onFalando?.(falando);
  }, [falando, onFalando]);

  useEffect(() => {
    if (aberto) campo.current?.focus();
  }, [aberto]);

  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight, behavior: "smooth" });
  }, [mensagens.length, pensando, erro, saudou]);

  // enquanto digita, acompanha o texto descendo (se o aluno não tiver rolado para cima)
  const acompanhar = () => {
    const l = lista.current;
    if (l && l.scrollHeight - l.scrollTop - l.clientHeight < 90) l.scrollTop = l.scrollHeight;
  };
  const terminouDeDigitar = (id) => setMensagens(m => m.map(x => (x.id === id && x.digitar ? { ...x, digitar: false } : x)));

  const enviar = async (entrada) => {
    const pergunta = entrada.trim().slice(0, MAX_PERGUNTA);
    if (!pergunta || pensando || !url) return;
    const historico = mensagens.slice(-MAX_HISTORICO).map(({ autor, texto }) => ({ autor, texto }));
    // nova pergunta: a resposta anterior aparece inteira
    setMensagens(m => [...m.map(x => (x.digitar ? { ...x, digitar: false } : x)), { id: ++ultimoId.current, autor: "aluno", texto: pergunta }]);
    setSaudou(true);
    setTexto("");
    setErro("");
    setPensando(true);
    onPensando?.(true);
    try {
      const corpo = JSON.stringify({
        pergunta,
        dadosDashboard: { consultadoEm: new Date().toLocaleString("pt-BR"), ...dadosDashboard, cotacoesDeCommodities: AVISO_COMMODITIES },
        historico,
      });
      const perguntar = () => fetch(url, {
        method: "POST",
        // text/plain evita o preflight de CORS, que o Apps Script não atende
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: corpo,
        signal: AbortSignal.timeout(40000),
      }).then(r => r.json());
      let dados = await perguntar();
      if (dados.erro === MSG_INDISPONIVEL) { // pico de demanda no Gemini: tenta de novo uma vez
        await new Promise(r => setTimeout(r, 2500));
        dados = await perguntar();
      }
      if (dados.resposta) {
        setMensagens(m => [...m, { id: ++ultimoId.current, autor: "assistente", texto: dados.resposta, origem: dados.origem, digitar: !reduzMovimento }]);
      } else setErro(dados.erro || "Não consegui responder agora. Tente de novo.");
    } catch {
      setErro("Não consegui falar com o assistente. Verifique a internet e tente de novo.");
    } finally {
      setPensando(false);
      onPensando?.(false);
    }
  };

  return (
    <section className={`assistente ${className}`} hidden={!aberto} aria-label="Tire sua dúvida com o Castor">
      {/* ponta do balão, no traço de quadrinho, apontando para o castor */}
      <svg className="assistente-rabicho" viewBox="0 0 44 48" aria-hidden="true">
        <path className="rabicho-sombra" d="M2 6 L38 37 L2 26 Z" />
        <path className="rabicho-traco" d="M2 6 L38 37 L2 26" />
      </svg>
      <header className="assistente-topo">
        <span>Tire sua dúvida</span>
        <button type="button" onClick={onFechar} aria-label="Fechar conversa" title="Fechar conversa"><X size={18} strokeWidth={2.5} /></button>
      </header>
      <div className="assistente-lista" ref={lista} aria-live="polite">
        <div className="assistente-msg assistente-castor">
          <Digitado texto={SAUDACAO} animar={!saudou} pausado={!aberto} onFim={() => setSaudou(true)} onAvanco={acompanhar} />
        </div>
        {mensagens.map(m => m.autor === "aluno"
          ? <div key={m.id} className="assistente-msg assistente-aluno"><p>{m.texto}</p></div>
          : <div key={m.id} className="assistente-msg assistente-castor">
              <Digitado texto={m.texto} animar={!!m.digitar} pausado={!aberto} onFim={() => terminouDeDigitar(m.id)} onAvanco={acompanhar} />
              {m.origem === "memoria" && !m.digitar && <p className="assistente-origem" title="Resposta que o Castor já tinha aprendido, sem consultar a IA">💾 Da memória do Castor</p>}
            </div>)}
        {!mensagens.length && saudou && url && (
          <div className="assistente-sugestoes">
            {SUGESTOES.map(s => <button key={s} type="button" onClick={() => enviar(s)} disabled={pensando}>{s}</button>)}
          </div>
        )}
        {pensando && <div className="assistente-msg assistente-castor assistente-pensando"><p>Pensando<i>.</i><i>.</i><i>.</i></p></div>}
        {erro && <p className="assistente-erro" role="alert">{erro}</p>}
        {!url && <p className="assistente-erro">O assistente ainda não foi configurado neste site.</p>}
      </div>
      <form className="assistente-form" onSubmit={e => { e.preventDefault(); enviar(texto); }}>
        <textarea ref={campo} rows={2} maxLength={MAX_PERGUNTA} value={texto} disabled={!url}
          placeholder="Digite sua dúvida…" aria-label="Sua dúvida"
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(texto); } }} />
        <button type="submit" disabled={!texto.trim() || pensando || !url} aria-label="Enviar" title="Enviar"><Send size={16} /></button>
      </form>
      <p className="assistente-aviso">{AVISO}</p>
    </section>
  );
}
