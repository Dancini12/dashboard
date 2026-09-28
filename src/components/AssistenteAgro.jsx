import { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import "./AssistenteAgro.css";

const SUGESTOES = ["Como o dólar influencia o preço da soja?", "O que é o indicador CEPEA?", "O que significa a variação percentual?"];
const AVISO = "Não digite dados pessoais. As conversas podem ser usadas pelo Google para melhorar seus produtos.";
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

// Balão de diálogo do mascote: o aluno pergunta e o assistente (Apps Script + Gemini)
// explica com base nas cotações do painel. Fica montado enquanto o mascote existe,
// para a conversa continuar quando o balão é fechado e aberto de novo.
export default function AssistenteAgro({ url, dadosDashboard, aberto, onFechar, onPensando, className = "" }) {
  const [mensagens, setMensagens] = useState([]); // { autor: "aluno" | "assistente", texto }
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState("");
  const lista = useRef(null);
  const campo = useRef(null);

  useEffect(() => {
    if (aberto) campo.current?.focus();
  }, [aberto]);

  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight, behavior: "smooth" });
  }, [mensagens, pensando, erro]);

  const enviar = async (entrada) => {
    const pergunta = entrada.trim().slice(0, MAX_PERGUNTA);
    if (!pergunta || pensando || !url) return;
    const historico = mensagens.slice(-MAX_HISTORICO);
    setMensagens(m => [...m, { autor: "aluno", texto: pergunta }]);
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
      if (dados.resposta) setMensagens(m => [...m, { autor: "assistente", texto: dados.resposta }]);
      else setErro(dados.erro || "Não consegui responder agora. Tente de novo.");
    } catch {
      setErro("Não consegui falar com o assistente. Verifique a internet e tente de novo.");
    } finally {
      setPensando(false);
      onPensando?.(false);
    }
  };

  return (
    <section className={`assistente ${className}`} hidden={!aberto} aria-label="Tire sua dúvida com o Castor">
      <header className="assistente-topo">
        <span>Tire sua dúvida</span>
        <button type="button" onClick={onFechar} aria-label="Fechar conversa" title="Fechar conversa"><X size={16} /></button>
      </header>
      <div className="assistente-lista" ref={lista} aria-live="polite">
        <div className="assistente-msg assistente-castor">
          <p>Oi! Eu sou o Castor do AgroInfo. Pergunte sobre as cotações do painel que eu explico. 🤠</p>
        </div>
        {mensagens.map((m, i) => m.autor === "aluno"
          ? <div key={i} className="assistente-msg assistente-aluno"><p>{m.texto}</p></div>
          : <div key={i} className="assistente-msg assistente-castor"><TextoFormatado texto={m.texto} /></div>)}
        {!mensagens.length && url && (
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
