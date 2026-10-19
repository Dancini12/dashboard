import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { BarChart3, BookOpen, Clock } from "lucide-react";
import CompararHistorico from "./CompararHistorico";
import { TICKER_RE } from "./MarketQuotes";
import { Card, SecTitle, VarBadge } from "./Cartao";
import { fmt } from "../formatos";
import { ANO_CORRENTE_DO_HISTORICO, ATE_DO_HISTORICO, HISTORICO, NOMES_CURTOS_DO_HISTORICO as CL, NOMES_DO_HISTORICO, SERIES_DO_HISTORICO, rotuloDoAno } from "../historico";

// Aba "Evolução", carregada só quando alguém a abre (o código dos gráficos é o que mais pesa no site):
// o comparador, o gráfico e a tabela das commodities do Brasil (médias anuais do CEPEA), o histórico
// das ações e o guia de leitura dos gráficos.
function TabelaDoHistorico() {
  const cols = Object.keys(NOMES_DO_HISTORICO);
  const lb = NOMES_DO_HISTORICO;
  return (
    <Card className="p-3 overflow-x-auto">
      <SecTitle icon={Clock} title={`Os números, ano a ano · ${HISTORICO[0].ano}–${HISTORICO.at(-1).ano}`} color="#166534" />
      <p className="text-xs text-slate-500 mb-2">Média de cada ano, em R$ da época. * {ANO_CORRENTE_DO_HISTORICO}: média de 1º de janeiro até {ATE_DO_HISTORICO}. Fonte: CEPEA/ESALQ.</p>
      <table className="w-full text-xs" style={{ minWidth: 550 }}>
        <thead><tr style={{ background: "#166534", color: "#fff" }}><th className="py-1.5 px-1 text-left">Commodity</th>{HISTORICO.map(h => <th key={h.ano} className="py-1.5 px-1 text-center">{rotuloDoAno(h.ano)}</th>)}<th className="py-1.5 px-1 text-center">Var%</th></tr></thead>
        <tbody>{cols.map((c, i) => { const pct = ((HISTORICO.at(-1)[c] - HISTORICO[0][c]) / HISTORICO[0][c] * 100); return (
          <tr key={c} style={{ background: i % 2 === 0 ? "#f0fdf4" : "#fff" }}><td className="py-1 px-1 font-semibold whitespace-nowrap">{lb[c]}<span className="block font-normal text-slate-500" style={{ fontSize: 10 }}>{SERIES_DO_HISTORICO[c].unidade} · em {ATE_DO_HISTORICO}: R$ {fmt(SERIES_DO_HISTORICO[c].ultimo.valor)}</span></td>{HISTORICO.map(h => <td key={h.ano} className="py-1 px-1 text-center font-mono" style={{ color: h === HISTORICO.at(-1) ? "#166534" : "#333", fontWeight: h === HISTORICO.at(-1) ? 700 : 400 }}>{fmt(h[c])}</td>)}<td className="py-1 px-1 text-center"><VarBadge val={parseFloat(pct.toFixed(1))} /></td></tr>); })}</tbody>
      </table>
    </Card>
  );
}

const CC = { boi: "#1a5276", soja: "#27ae60", milho: "#f39c12", cafe: "#6f4e37", trigo: "#c0392b" };
const normalize = (v) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function GraficosCommoditiesPanel({ target }) {
  const [sel, setSel] = useState(() => (target?.type === "commodity" && target.key ? [target.key] : ["boi", "soja", "milho"]));
  const [search, setSearch] = useState("");
  const opts = Object.keys(CL).filter(k => normalize(CL[k]).includes(normalize(search)));
  return (
    <Card className="p-3">
      <SecTitle icon={BarChart3} title={`Commodities · Evolução ${HISTORICO[0].ano}–${HISTORICO.at(-1).ano}`} color="#1a5276" />
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Digite a commodity (ex.: soja, boi, café)"
        className="block w-full border rounded-lg p-2 mb-3 text-sm" />
      <div className="flex flex-wrap gap-1 mb-3">{opts.map(k => <button key={k} onClick={() => setSel(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k])} className="px-2 py-1 rounded-full text-xs font-semibold" style={{ background: sel.includes(k) ? CC[k] : "#f1f5f9", color: sel.includes(k) ? "#fff" : "#64748b" }}>{CL[k]}</button>)}
        {!opts.length && <span className="text-xs opacity-40">Nenhuma commodity encontrada com esse nome.</span>}</div>
      {sel.length > 0 ? (
        <div style={{ height: 300 }}><ResponsiveContainer><LineChart data={HISTORICO} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="ano" tickFormatter={rotuloDoAno} tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip formatter={v => `R$ ${fmt(v)}`} contentStyle={{ borderRadius: 8, fontSize: 11 }} /><Legend wrapperStyle={{ fontSize: 10 }} />{sel.map(k => <Line key={k} type="monotone" dataKey={k} name={CL[k]} stroke={CC[k]} strokeWidth={2.5} dot={{ r: 3 }} />)}</LineChart></ResponsiveContainer></div>
      ) : <p className="text-sm opacity-50 py-8 text-center">Selecione ao menos uma commodity para ver o gráfico.</p>}
      <p className="text-xs text-slate-500 mt-2">Média de cada ano, em R$ da época; * {ANO_CORRENTE_DO_HISTORICO} até {ATE_DO_HISTORICO}. Fonte: CEPEA/ESALQ (boi gordo em São Paulo, soja no Paraná, milho em Campinas, café arábica e trigo no Paraná).</p>
      <p className="text-xs text-slate-500 mt-1">Os contratos de Chicago e de Nova Iorque e as ações têm histórico no comparador acima. Feijão, cana, leite, algodão, suíno e laranja não têm série anual do CEPEA desde 2020 que o site consiga atualizar sozinho: veja o valor atual na aba Cotações Cooperativas.</p>
    </Card>
  );
}

function StockHistoryChart({ symbol }) {
  const [state, setState] = useState({ loading: true, error: "", points: [], currency: "BRL", name: symbol });
  useEffect(() => {
    if (!symbol) return;
    const controller = new AbortController();
    fetch(`/api/market?type=history&symbol=${encodeURIComponent(symbol)}`, { signal: controller.signal })
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Histórico indisponível."); return data; })
      .then(data => setState({ loading: false, error: "", points: data.points || [], currency: data.currency || "BRL", name: data.name || symbol }))
      .catch(error => { if (!controller.signal.aborted) setState(s => ({ ...s, loading: false, error: error.message })); });
    return () => controller.abort();
  }, [symbol]);

  if (state.loading) return <p className="text-sm opacity-50 py-8 text-center">Carregando histórico de {symbol}…</p>;
  if (state.error) return <p role="alert" className="text-amber-800 text-sm py-8 text-center">{state.error}</p>;
  if (!state.points.length) return <p className="text-sm opacity-50 py-8 text-center">Sem dados históricos disponíveis para {symbol} desde 2020.</p>;
  return (
    <>
      <div style={{ height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={state.points} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 9 }} minTickGap={40} />
            <YAxis tick={{ fontSize: 9 }} domain={["auto", "auto"]} />
            <Tooltip formatter={v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: state.currency }).format(v)} labelFormatter={d => new Date(d).toLocaleDateString("pt-BR")} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
            <Line type="monotone" dataKey="close" name={state.name} stroke="#1a5276" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs opacity-25 mt-2 text-right">Fonte: BRAPI · fechamento mensal desde 2020</p>
    </>
  );
}

function GraficosAcoesPanel({ target }) {
  const [symbol, setSymbol] = useState(() => (target?.type === "stock" && target.symbol ? target.symbol : "PETR4"));
  const [input, setInput] = useState(symbol);
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [validation, setValidation] = useState("");

  const term = input.trim();
  const showDropdown = term.length >= 2 && !TICKER_RE.test(term.toUpperCase());

  useEffect(() => {
    if (!showDropdown) return;
    const controller = new AbortController();
    const t = setTimeout(() => {
      setSearching(true);
      fetch(`/api/market?type=search&q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then(r => r.json()).then(data => setSuggestions(data.results || []))
        .catch(() => { if (!controller.signal.aborted) setSuggestions([]); })
        .finally(() => setSearching(false));
    }, 350);
    return () => { clearTimeout(t); controller.abort(); };
  }, [term, showDropdown]);

  const pick = (sym, name) => { setSuggestions([]); setValidation(""); setInput(name ? `${sym} · ${name}` : sym); setSymbol(sym); };

  return (
    <Card className="p-3">
      <SecTitle icon={BarChart3} title="Ações / ETFs · Histórico desde 2020" color="#1a5276" />
      <form onSubmit={e => {
        e.preventDefault();
        const upper = term.toUpperCase();
        if (TICKER_RE.test(upper)) { pick(upper, ""); return; }
        if (suggestions.length) { pick(suggestions[0].symbol, suggestions[0].name); return; }
        setValidation("Digite o nome da empresa (ex.: Petrobras) e escolha uma sugestão, ou informe o código (ex.: PETR4).");
      }} className="flex flex-wrap gap-2 relative mb-3">
        <label className="flex-1 min-w-0 text-xs">Empresa ou código
          <input className="block w-full border rounded-lg p-2 mt-1 text-sm" value={input}
            onChange={e => { setInput(e.target.value); setValidation(""); }} placeholder="Ex.: Petrobras ou PETR4" autoComplete="off" />
          {showDropdown && (searching || suggestions.length > 0) && (
            <div className="absolute left-0 right-0 mt-1 bg-white border rounded-lg shadow-md z-10 max-h-56 overflow-auto">
              {searching && <div className="p-2 text-xs text-slate-500">Buscando…</div>}
              {!searching && suggestions.map(s => (
                <button key={s.symbol} type="button" onClick={() => pick(s.symbol, s.name)} className="block w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 border-b last:border-b-0">
                  <span className="font-bold">{s.symbol}</span> · {s.name}
                </button>
              ))}
            </div>
          )}
        </label>
        <button className="self-end rounded-lg bg-blue-900 text-white p-2 text-sm" type="submit">Ver gráfico</button>
      </form>
      {validation && <p role="alert" className="text-red-700 text-sm mb-2">{validation}</p>}
      <StockHistoryChart key={symbol} symbol={symbol} />
    </Card>
  );
}

const COMO_LER = [
  { icon: "↔️", titulo: "Eixo horizontal (X)", texto: "O tempo: anos para commodities, meses para ações desde 2020. Da esquerda (mais antigo) para a direita (mais recente)." },
  { icon: "↕️", titulo: "Eixo vertical (Y)", texto: "O preço: R$ por saca/arroba nas commodities, R$ por ação nos papéis da bolsa. Quanto mais alto o ponto, maior o preço." },
  { icon: "📈", titulo: "Linha subindo", texto: "Indica alta de preço (valorização) no período — bom para quem vende, mais caro para quem compra." },
  { icon: "📉", titulo: "Linha descendo", texto: "Indica queda de preço (desvalorização) no período — mais barato para quem compra." },
  { icon: "🖱️", titulo: "Passe o mouse na linha", texto: "Aparece uma caixinha (tooltip) com a data exata e o valor daquele ponto." },
  { icon: "⚖️", titulo: "Comparando linhas", texto: "Ao selecionar mais de um item, compare a inclinação das linhas para ver qual valorizou ou desvalorizou mais no mesmo período." },
];

function ComoLerGraficoCard() {
  return (
    <Card className="p-3">
      <SecTitle icon={BookOpen} title="Como interpretar o gráfico" color="#b45309" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {COMO_LER.map((item, i) => (
          <div key={i} className="rounded-lg p-2" style={{ background: i % 2 === 0 ? "#fffbeb" : "#fefce8", border: "1px solid #fde68a" }}>
            <div className="text-sm font-semibold" style={{ color: "#78350f" }}>{item.icon} {item.titulo}</div>
            <div className="text-xs mt-0.5" style={{ color: "#92400e" }}>{item.texto}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Aba "Evolução": tudo o que mostra preço ao longo do tempo, de 2020 para cá.
export default function EvolucaoTab({ target }) {
  return (
    <div className="space-y-4">
      <CompararHistorico historico={HISTORICO} nomes={NOMES_DO_HISTORICO} />
      <div id="grafico-commodities" style={{ scrollMarginTop: 100 }}><GraficosCommoditiesPanel key={target?.type === "commodity" ? target.key : "default"} target={target} /></div>
      <TabelaDoHistorico />
      <div id="grafico-acoes" style={{ scrollMarginTop: 100 }}><GraficosAcoesPanel key={target?.type === "stock" ? target.symbol : "default"} target={target} /></div>
      <ComoLerGraficoCard />
    </div>
  );
}
