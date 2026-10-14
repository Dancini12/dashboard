import { useRef, useState } from "react";
import { Search } from "lucide-react";
import { buscar } from "../busca";
import { TICKER_RE } from "./MarketQuotes";

const CORES = {
  Cooperativas: ["#efefef", "#111111"], "Resumo do dia": ["#efefef", "#111111"], Bolsas: ["#efefef", "#111111"],
  "Evolução": ["#efefef", "#111111"], Calculadoras: ["#efefef", "#111111"], Clima: ["#efefef", "#111111"], Safra: ["#efefef", "#111111"], "Exportações": ["#efefef", "#111111"], Aprender: ["#efefef", "#111111"], "Glossário": ["#efefef", "#111111"], Abas: ["#efefef", "#111111"],
  "Notícias": ["#efefef", "#111111"], "TV Agro": ["#efefef", "#111111"], "Ações": ["#efefef", "#111111"], Castor: ["#efefef", "#111111"],
};

// Busca do topo: o visitante digita o que procura (produto, moeda, termo ou dúvida) e vai direto
// para o lugar do site que mostra aquilo. Sem resultado no site, oferece notícias, ações e o Castor.
export default function BuscaAgro({ itens, onEscolher, comCastor }) {
  const [consulta, setConsulta] = useState("");
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const campo = useRef(null);

  const termo = consulta.trim().slice(0, 60);
  const pesquisa = termo.length >= 2;
  const achados = pesquisa ? buscar(itens, termo, 10) : [];
  const ehCodigo = TICKER_RE.test(termo.toUpperCase());
  const ehPergunta = termo.includes("?") || /^(como|qual|quais|quanto|quando|onde|por ?que|o que|pra que|para que)\b/i.test(termo);
  const acoes = { titulo: `Procurar "${termo}" nas ações da B3`, detalhe: "Empresas e fundos da Bolsa", grupo: "Ações", acao: { aba: "bolsas", acao: termo, ancora: "consultar-acao" } };
  const opcoes = !pesquisa ? [] : [
    ...(ehCodigo ? [acoes] : []),
    ...achados,
    { titulo: `Notícias sobre "${termo}"`, detalhe: "Últimos 30 dias", grupo: "Notícias", acao: { aba: "noticias", busca: termo } },
    ...(!achados.length && !ehCodigo && !ehPergunta ? [acoes] : []),
    ...(comCastor ? [{ titulo: `Perguntar ao Castor: "${termo}"`, detalhe: "O assistente do AgroInfo responde", grupo: "Castor", acao: { castor: termo } }] : []),
  ];

  const escolher = (opcao) => {
    setConsulta(""); setAberto(false); setAtivo(0);
    campo.current?.blur();
    onEscolher(opcao.acao);
  };

  return (
    <div className="flex-1 min-w-0 sm:relative sm:max-w-md sm:mx-auto">
      <div className="flex items-center gap-1.5 rounded-lg border px-2" style={{ background: "#f6f6f6", borderColor: aberto ? "#111111" : "#e0e0e0" }}>
        <Search size={14} className="shrink-0" style={{ color: "#666666" }} aria-hidden="true" />
        <input ref={campo} type="search" value={consulta} maxLength={60} placeholder="Buscar: soja, dólar, hedge…"
          aria-label="Buscar no AgroInfo" role="combobox" aria-expanded={aberto && pesquisa} aria-controls="busca-resultados" aria-autocomplete="list"
          onChange={e => { setConsulta(e.target.value); setAberto(true); setAtivo(0); }}
          onFocus={() => setAberto(true)} onBlur={() => setAberto(false)}
          onKeyDown={e => {
            if (e.key === "ArrowDown") { e.preventDefault(); setAtivo(i => Math.min(i + 1, opcoes.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo(i => Math.max(i - 1, 0)); }
            else if (e.key === "Enter" && opcoes[ativo]) { e.preventDefault(); escolher(opcoes[ativo]); }
            else if (e.key === "Escape") { e.preventDefault(); setAberto(false); } // sem apagar o texto (campo de busca do navegador)
          }}
          className="w-full min-w-0 bg-transparent py-1.5 text-base sm:text-sm outline-none" />
      </div>
      {aberto && (
        <div id="busca-resultados" role="listbox" className="absolute left-3 right-3 sm:left-0 sm:right-0 mt-1 overflow-auto rounded-xl border bg-white shadow-lg"
          style={{ maxHeight: "70vh", borderColor: "#cccccc" }}>
          {!pesquisa && <p className="px-3 py-2.5 text-xs text-neutral-600">Digite um produto (soja, boi, café), uma moeda (dólar), um termo (hedge) ou a sua dúvida.</p>}
          {pesquisa && !achados.length && <p className="px-3 pt-2.5 pb-1 text-xs text-neutral-500">Nada no site com esse nome. Veja outras opções:</p>}
          {opcoes.map((o, i) => {
            const [fundo, cor] = CORES[o.grupo] ?? CORES.Abas;
            return (
              <button key={`${o.grupo}-${o.titulo}`} type="button" role="option" aria-selected={i === ativo}
                onMouseDown={e => e.preventDefault()} onMouseEnter={() => setAtivo(i)} onClick={() => escolher(o)}
                className="flex w-full items-start gap-2 border-b px-3 py-2 text-left last:border-b-0"
                style={{ background: i === ativo ? "#f2f2f2" : "#fff", borderColor: "#efefef" }}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-neutral-900">{o.titulo}</span>
                  {o.detalhe && <span className="block truncate text-xs text-neutral-500">{o.detalhe}</span>}
                </span>
                <span className="shrink-0 rounded px-1.5 py-0.5 font-bold uppercase" style={{ background: fundo, color: cor, fontSize: 10 }}>{o.grupo}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
