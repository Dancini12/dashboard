import { useState, useEffect, useRef, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts";
import { RefreshCw, BookOpen, BarChart3, Clock, Wheat, DollarSign, Activity, ChevronDown, ChevronUp, Timer, ArrowRight, Pause, Play, Newspaper, ExternalLink } from "lucide-react";

const UPDATE_SEC = 60;
const API_MOEDAS_URL = "https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,GBP-BRL,ARS-BRL";
const API_ACOES_URL = "https://brapi.dev/api/quote/PETR4,VALE3,%5EBVSP";
const TABS = ["painel", "noticias", "historico", "graficos", "glossario"];
const TAB_LABELS = { painel: "Painel", noticias: "Notícias", historico: "Histórico", graficos: "Gráficos", glossario: "Glossário" };
const TAB_ICONS = { painel: Activity, noticias: Newspaper, historico: Clock, graficos: BarChart3, glossario: BookOpen };

const INIT_MOEDAS = [
  { id: "usd", nome: "Dólar Comercial", emoji: "💵", valor: 4.912, var: -1.12 },
  { id: "usd_t", nome: "Dólar Turismo", emoji: "💵", valor: 5.080, var: -1.05 },
  { id: "eur", nome: "Euro", emoji: "💶", valor: 5.786, var: -0.45 },
  { id: "gbp", nome: "Libra Esterlina", emoji: "💷", valor: 6.698, var: -0.38 },
  { id: "ars", nome: "Peso Argentino", emoji: "💴", valor: 0.004, var: 0.12 },
];
const INIT_ACOES = [
  { id: "petr4", nome: "PETR4", sub: "Petrobras", emoji: "⛽", valor: 49.34, var: 0.25 },
  { id: "vale3", nome: "VALE3", sub: "Vale", emoji: "⛏️", valor: 54.80, var: -0.45 },
];
const INIT_INDICES = [
  { id: "ibov", nome: "Ibovespa", emoji: "🇧🇷", valor: 186754, var: 0.62 },
  { id: "sp500", nome: "S&P 500", emoji: "🇺🇸", valor: 7259, var: 0.81 },
];
const INIT_COMM = [
  { id: "boi", nome: "Boi Gordo", emoji: "🐂", valor: 354.20, un: "R$/@", cat: "pecuaria" },
  { id: "suino", nome: "Suíno Vivo", emoji: "🐖", valor: 7.12, un: "R$/Kg", cat: "pecuaria" },
  { id: "milho", nome: "Milho", emoji: "🌽", valor: 67.53, un: "R$/Saca", cat: "graos" },
  { id: "soja", nome: "Soja", emoji: "🌱", valor: 122.50, un: "R$/Saca", cat: "graos" },
  { id: "feijao", nome: "Feijão", emoji: "🥔", valor: 355.00, un: "R$/Saca", cat: "graos" },
  { id: "cana_pr", nome: "Cana (PR)", emoji: "🎋", valor: 130.50, un: "R$/Ton", cat: "outros" },
  { id: "cana_sp", nome: "Cana (SP)", emoji: "🎋", valor: 160.00, un: "R$/Ton", cat: "outros" },
  { id: "trigo", nome: "Trigo", emoji: "🌾", valor: 1280.00, un: "R$/Ton", cat: "graos" },
  { id: "cafe", nome: "Café Arábica", emoji: "☕", valor: 1820.00, un: "R$/Saca", cat: "outros" },
  { id: "leite_pr", nome: "Leite (PR)", emoji: "🥛", valor: 2.25, un: "R$/Litro", cat: "pecuaria" },
  { id: "leite_sp", nome: "Leite (SP)", emoji: "🥛", valor: 2.40, un: "R$/Litro", cat: "pecuaria" },
  { id: "laranja", nome: "Laranja", emoji: "🍊", valor: 33.50, un: "R$/Cx 40,8Kg", cat: "frutas" },
  { id: "abacate", nome: "Abacate", emoji: "🥑", valor: 32.00, un: "R$/Cx 20Kg", cat: "frutas" },
  { id: "tomate", nome: "Tomate", emoji: "🍅", valor: 4.25, un: "R$/Kg", cat: "hortifruti" },
  { id: "pepino", nome: "Pepino", emoji: "🥒", valor: 55.00, un: "R$/Cx 22Kg", cat: "hortifruti" },
  { id: "ouro", nome: "Ouro", emoji: "🥇", valor: 760.00, un: "R$/Grama", cat: "metal" },
];
const INDICADORES = [
  { nome: "IPCA", periodo: "", valor: "+0,70%", desc: "Inflação oficial (IBGE)" },
  { nome: "INPC", periodo: "", valor: "+0,56%", desc: "Cesta básica (IBGE)" },
  { nome: "IGP-M", periodo: "", valor: "-0,73%", desc: "Aluguéis (FGV)" },
  { nome: "Selic", periodo: "", valor: "14,75% a.a.", desc: "Meta BC" },
  { nome: "CDI", periodo: "", valor: "14,65% a.a.", desc: "Referência renda fixa" },
  { nome: "Poupança", periodo: "", valor: "0,67% a.m.", desc: "0,50% + TR" },
];
const HISTORICO = [
  { ano: "2020", boi: 220, soja: 105, milho: 52, cafe: 530, trigo: 1050, feijao: 180, cana: 78, leite: 1.50 },
  { ano: "2021", boi: 297, soja: 165, milho: 85, cafe: 950, trigo: 1500, feijao: 200, cana: 100, leite: 2.05 },
  { ano: "2022", boi: 310, soja: 190, milho: 87, cafe: 1310, trigo: 2100, feijao: 280, cana: 130, leite: 2.60 },
  { ano: "2023", boi: 240, soja: 149, milho: 66, cafe: 900, trigo: 1550, feijao: 260, cana: 140, leite: 2.20 },
  { ano: "2024", boi: 260, soja: 132, milho: 64, cafe: 1100, trigo: 1350, feijao: 230, cana: 145, leite: 2.10 },
  { ano: "2025", boi: 320, soja: 118, milho: 68, cafe: 2100, trigo: 1300, feijao: 300, cana: 150, leite: 2.15 },
  { ano: "Mar/26", boi: 343.69, soja: 115.49, milho: 55.26, cafe: 1750, trigo: 1263.33, feijao: 350, cana: 157.14, leite: 2.17 },
];
const GLOSSARIO = [
  { termo: "Commodity", def: "Produto primário padronizado negociado em bolsa (soja, milho, café, boi gordo).", icon: "🌾" },
  { termo: "CEPEA", def: "Centro de Estudos Avançados em Economia Aplicada (ESALQ/USP). Referência de preços agro.", icon: "📊" },
  { termo: "Selic", def: "Taxa básica de juros, definida pelo COPOM do Banco Central.", icon: "🏦" },
  { termo: "IPCA", def: "Inflação oficial (IBGE). Mede aumento de preços ao consumidor.", icon: "📉" },
  { termo: "R$/@", def: "Reais por arroba (15 kg). Unidade padrão do boi gordo.", icon: "🐂" },
  { termo: "R$/Saca", def: "Reais por saca (60 kg). Unidade para grãos: soja, milho, café.", icon: "🌱" },
  { termo: "Hedge", def: "Proteção contra variação de preço. Produtor trava preço futuro na bolsa.", icon: "🛡️" },
  { termo: "Volatilidade", def: "Grau de oscilação dos preços. Café arábica é muito volátil.", icon: "⚡" },
];
const NEWS_LINKS = [
  { secao: "agro", titulo: "🌾 NOTÍCIAS DO AGRONEGÓCIO", cor: "#166534", bg: "#f0fdf4", items: [
    { nome: "Google News — Agronegócio", url: "https://news.google.com/search?q=agronegócio+brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419", icon: "📰" },
    { nome: "AgroTimes — MoneyTimes", url: "https://www.moneytimes.com.br/agrotimes/", icon: "🌾" },
    { nome: "Canal Rural", url: "https://www.canalrural.com.br", icon: "📺" },
    { nome: "Notícias Agrícolas", url: "https://www.noticiasagricolas.com.br", icon: "📊" },
    { nome: "CEPEA/ESALQ", url: "https://www.cepea.org.br", icon: "🎓" },
    { nome: "Farmnews", url: "https://www.farmnews.com.br", icon: "📈" },
  ]},
  { secao: "mercado", titulo: "💰 MERCADO & ECONOMIA", cor: "#1a5276", bg: "#f0f7ff", items: [
    { nome: "Google News — Economia", url: "https://news.google.com/search?q=economia+brasil+selic+dólar&hl=pt-BR&gl=BR&ceid=BR:pt-419", icon: "🏛️" },
    { nome: "MoneyTimes", url: "https://www.moneytimes.com.br/", icon: "💰" },
    { nome: "Google News — Dólar", url: "https://news.google.com/search?q=dólar+cotação+hoje&hl=pt-BR&gl=BR&ceid=BR:pt-419", icon: "💵" },
    { nome: "Google News — Petróleo", url: "https://news.google.com/search?q=petróleo+brent+diesel&hl=pt-BR&gl=BR&ceid=BR:pt-419", icon: "🛢️" },
  ]},
  { secao: "clima", titulo: "🌤️ CLIMA — SANTA MARIANA", cor: "#1e40af", bg: "#dbeafe", items: [
    { nome: "IPMET Radar", url: "https://www.ipmetradar.com.br/2prevcid.php", icon: "📡" },
    { nome: "Climatempo — 15 dias", url: "https://www.climatempo.com.br/previsao-do-tempo/15-dias/cidade/2906/santamariana-pr", icon: "🌡️" },
    { nome: "Climatempo — Agora", url: "https://www.climatempo.com.br/previsao-do-tempo/agora/cidade/2906/santamariana-pr", icon: "⏱️" },
    { nome: "CPTEC/INPE", url: "http://tempo.cptec.inpe.br/cidades/tempo/4614", icon: "🛰️" },
  ]},
];

const fmt = (v, d = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtInt = (v) => v.toLocaleString("pt-BR");
const simVar = (val, pct = 0.4) => parseFloat((val + val * (Math.random() * pct * 2 - pct) / 100).toFixed(val < 1 ? 4 : 2));

function VarBadge({ val }) {
  const p = val >= 0;
  return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-bold" style={{ background: p ? "#dcfce7" : "#fee2e2", color: p ? "#166534" : "#991b1b", fontSize: 10 }}>{p ? "▲+" : "▼"}{fmt(val)}%</span>;
}
function Card({ children, className = "", style = {} }) {
  return <div className={`rounded-xl border shadow-sm ${className}`} style={{ background: "rgba(255,255,255,0.9)", borderColor: "rgba(0,0,0,0.06)", ...style }}>{children}</div>;
}
function SecTitle({ icon: I, title, color = "#1a3a5c" }) {
  return <div className="flex items-center gap-2 mb-3"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: color }}><I size={13} color="#fff" /></div><h2 className="text-sm font-bold" style={{ color }}>{title}</h2></div>;
}

function PriceRow({ emoji, nome, sub, valor, prev, varPct, unidade, flash, alt }) {
  const diff = prev != null ? valor - prev : 0;
  const up = diff >= 0;
  const changed = prev != null && Math.abs(diff) > 0.0001;
  const dec = valor < 1 ? 4 : 2;
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg transition-all duration-700" style={{ background: flash ? (up ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)") : alt ? "#f0f7ff" : "transparent" }}>
      <div className="flex items-center gap-1.5 min-w-0"><span className="text-sm shrink-0">{emoji}</span><span className="text-sm font-semibold truncate">{nome}</span>{sub && <span className="text-xs opacity-40 hidden sm:inline">{sub}</span>}</div>
      <div className="flex items-center gap-2 shrink-0">
        {changed && <span className="hidden sm:flex items-center gap-1 text-xs opacity-35"><span className="line-through">R$ {fmt(prev, dec)}</span><ArrowRight size={9} /></span>}
        <span className="text-sm font-bold" style={{ color: "#1a3a5c" }}>{unidade === "pts" ? `${fmtInt(valor)} pts` : `R$ ${fmt(valor, dec)}`}</span>
        {changed && <span className="font-bold" style={{ color: up ? "#16a34a" : "#dc2626", fontSize: 10 }}>{up ? "▲" : "▼"}</span>}
        {varPct != null && <VarBadge val={varPct} />}
      </div>
    </div>
  );
}

function CommCard({ item, prev, flash, idx }) {
  const diff = prev != null ? item.valor - prev : 0;
  const up = diff >= 0;
  const changed = prev != null && Math.abs(diff) > 0.001;
  const dec = item.valor < 1 ? 4 : 2;
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg border transition-all duration-700" style={{ borderColor: flash ? (up ? "#86efac" : "#fca5a5") : "#e5e7eb", background: flash ? (up ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)") : idx % 2 === 0 ? "#f0fdf4" : "#fff" }}>
      <div className="flex items-center gap-1.5"><span className="text-base">{item.emoji}</span><span className="text-sm font-semibold">{item.nome}</span></div>
      <div className="text-right">
        <div className="flex items-center gap-1.5 justify-end">
          {changed && <span className="text-xs line-through opacity-25 hidden sm:inline">{fmt(prev, dec)}</span>}
          <span className="text-sm font-bold" style={{ color: "#166534" }}>R$ {fmt(item.valor, dec)}</span>
          {changed && <span className="font-bold" style={{ color: up ? "#16a34a" : "#dc2626", fontSize: 10 }}>{up ? "▲" : "▼"}</span>}
        </div>
        <div className="text-xs opacity-40">{item.un}</div>
      </div>
    </div>
  );
}

function CountdownBar({ sec, total, paused, onToggle, onRefresh, count, last, source }) {
  const pct = ((total - sec) / total) * 100;
  const m = Math.floor(sec / 60), s = sec % 60;
  return (
    <Card className="p-3 mb-4">
      <div className="flex items-center gap-2">
        <Timer size={13} style={{ color: sec <= 10 ? "#dc2626" : "#166534" }} />
        <div className="flex-1"><div className="h-2 rounded-full overflow-hidden" style={{ background: "#e5e7eb" }}><div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, background: sec <= 10 ? "#ef4444" : "#22c55e" }} /></div></div>
        <span className="font-mono font-bold px-2 py-0.5 rounded text-xs" style={{ background: sec <= 10 ? "#fef3c7" : "#f0fdf4", color: sec <= 10 ? "#92400e" : "#166534" }}>{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>
        <button onClick={onToggle} className="p-1 rounded-md" style={{ background: "#f1f5f9" }}>{paused ? <Play size={12} /> : <Pause size={12} />}</button>
        <button onClick={onRefresh} className="p-1 rounded-md" style={{ background: "#f1f5f9" }}><RefreshCw size={12} /></button>
      </div>
      <div className="flex justify-between mt-1 text-xs opacity-40"><span>{paused ? "⏸ Pausado" : source === "real" ? "🟢 Moedas/Ações em tempo real — atualiza a cada 60s" : source === "simulado" ? "🟡 API indisponível — usando simulação" : "⏳ Buscando cotações..."}</span><span>Ciclos: {count}{last ? ` • ${last}` : ""}</span></div>
    </Card>
  );
}

function PainelTab({ moedas, acoes, indices, comm, pm, pa, pi, pc, flash }) {
  const [filter, setFilter] = useState("todos");
  const cats = { todos: "Todos", pecuaria: "Pecuária", graos: "Grãos", outros: "Outros", frutas: "Frutas", hortifruti: "Hortifrúti" };
  const filtered = filter === "todos" ? comm : comm.filter(c => c.cat === filter);
  return (
    <div className="space-y-4">
      <div className="rounded-xl overflow-hidden" style={{ background: "linear-gradient(135deg,#0c2340 0%,#1a5276 40%,#1e8449 100%)" }}>
        <div className="px-4 py-4 flex items-center gap-3">
          <div className="rounded-full border-2 border-white flex items-center justify-center shrink-0" style={{ width: 60, height: 60, background: "radial-gradient(circle, #2E7D32 60%, #1B5E20 100%)" }}>
            <div className="text-center leading-none"><div style={{ fontSize: 7, color: "#fff", fontWeight: 700 }}>C.E.E.P.A.</div><div style={{ fontSize: 9, color: "#fbbf24", fontWeight: 900, marginTop: 1 }}>FERNANDO</div><div style={{ fontSize: 9, color: "#fbbf24", fontWeight: 900 }}>COSTA</div></div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-0.5"><Wheat size={14} color="#fbbf24" /><span style={{ fontSize: 10, color: "#fbbf24", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Informativo Diário</span></div>
            <h1 className="text-base font-bold text-white">Mercado Agrícola</h1>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>Santa Mariana, PR • Docente: <strong style={{ color: "rgba(255,255,255,0.8)" }}>Marcel Dancini Rodrigues</strong> • {new Date().toLocaleDateString("pt-BR")}</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="p-3"><SecTitle icon={DollarSign} title="Moedas" color="#1a5276" />{moedas.map((m, i) => <PriceRow key={m.id} emoji={m.emoji} nome={m.nome} valor={m.valor} prev={pm[m.id]} varPct={m.var} flash={flash.has(m.id)} alt={i % 2 === 0} />)}<div className="mt-2 text-xs opacity-25 text-right">Fonte: AwesomeAPI (tempo real)</div></Card>
        <Card className="p-3"><SecTitle icon={Activity} title="Ações & Índices" color="#1a5276" />{acoes.map((a, i) => <PriceRow key={a.id} emoji={a.emoji} nome={a.nome} sub={a.sub} valor={a.valor} prev={pa[a.id]} varPct={a.var} flash={flash.has(a.id)} alt={i % 2 === 0} />)}<div className="border-t my-2" style={{ borderColor: "rgba(0,0,0,0.06)" }} />{indices.map((x, i) => <PriceRow key={x.id} emoji={x.emoji} nome={x.nome} valor={x.valor} prev={pi[x.id]} varPct={x.var} unidade="pts" flash={flash.has(x.id)} alt={i % 2 === 0} />)}<div className="mt-2 text-xs opacity-25 text-right">Fonte: BRAPI/B3 (tempo real)</div></Card>
      </div>
      <Card className="p-3"><SecTitle icon={BarChart3} title="Indicadores Econômicos" color="#6b21a8" /><div className="grid grid-cols-2 md:grid-cols-3 gap-2">{INDICADORES.map((ind, i) => (<div key={i} className="rounded-lg p-2 text-center" style={{ background: i % 2 === 0 ? "#faf5ff" : "#f5f3ff" }}><div className="text-xs font-semibold opacity-60">{ind.nome} {ind.periodo && `(${ind.periodo})`}</div><div className="text-base font-bold" style={{ color: "#6b21a8" }}>{ind.valor}</div><div className="text-xs opacity-40">{ind.desc}</div></div>))}</div><div className="mt-2 text-xs opacity-25 text-right">Fonte: BCB / IBGE / FGV</div></Card>
      <Card className="p-3"><SecTitle icon={Wheat} title="Commodities Agrícolas" color="#166534" /><div className="flex flex-wrap gap-1 mb-3">{Object.entries(cats).map(([k, v]) => (<button key={k} onClick={() => setFilter(k)} className="px-2 py-1 rounded-full text-xs font-semibold" style={{ background: filter === k ? "#166534" : "#f0fdf4", color: filter === k ? "#fff" : "#166534", border: `1px solid ${filter === k ? "#166534" : "#bbf7d0"}` }}>{v}</button>))}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{filtered.map((c, i) => <CommCard key={c.id} item={c} prev={pc[c.id]} flash={flash.has(c.id)} idx={i} />)}</div><div className="mt-2 text-xs opacity-25 text-right">Fonte: CEPEA/ESALQ-USP • Sicredi</div></Card>
      <div className="text-xs opacity-25 text-center">📌 Moedas: AwesomeAPI (tempo real) • Ações/Ibovespa: BRAPI (tempo real) • Indicadores: BCB/IBGE/FGV (fixos) • Commodities: CEPEA/ESALQ-USP (simulados)</div>
    </div>
  );
}

const NEWS_FEEDS = {
  agro:    { label: "🌾 Agronegócio", cor: "#166534", bg: "#f0fdf4" },
  mercado: { label: "💰 Mercado",      cor: "#1a5276", bg: "#f0f7ff" },
};

function stripHtml(html = "") {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&mdash;/g, "—").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function NewsCard({ item, cor }) {
  const desc = stripHtml(item.description || "").slice(0, 160);
  return (
    <a href={item.link} target="_blank" rel="noopener noreferrer" className="block group">
      <Card className="p-3 transition-shadow group-hover:shadow-md">
        <div className="flex gap-3 items-start">
          {item.thumbnail && (
            <img src={item.thumbnail} alt="" className="w-16 h-16 object-cover rounded-lg shrink-0 bg-gray-100"
              onError={e => { e.target.style.display = "none"; }} />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold leading-snug mb-1 group-hover:underline" style={{ color: cor }}>
              {item.title}
            </div>
            <div className="flex items-center gap-1.5 text-xs opacity-40 mb-1">
              {item.author && <span className="font-medium">{item.author}</span>}
              {item.author && <span>·</span>}
              <span>{timeAgo(item.pubDate)}</span>
            </div>
            {desc && (
              <div className="text-xs opacity-40 leading-relaxed line-clamp-2">{desc}</div>
            )}
          </div>
          <ExternalLink size={11} className="shrink-0 opacity-20 mt-0.5" />
        </div>
      </Card>
    </a>
  );
}

const NEWS_INTERVAL = 5 * 60;

function NoticiasTab() {
  const [feed, setFeed] = useState("agro");
  const [news, setNews] = useState({ agro: [], mercado: [] });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [hasError, setHasError] = useState(false);
  const [cd, setCd] = useState(NEWS_INTERVAL);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setHasError(false);
    try {
      const [aRes, mRes] = await Promise.allSettled([
        fetch("/api/news?feed=agro").then(r => r.json()),
        fetch("/api/news?feed=mercado").then(r => r.json()),
      ]);
      setNews({
        agro:    aRes.status === "fulfilled" && aRes.value?.status === "ok" ? aRes.value.items : [],
        mercado: mRes.status === "fulfilled" && mRes.value?.status === "ok" ? mRes.value.items : [],
      });
      setLastUpdate(new Date());
    } catch (_) { setHasError(true); }
    setLoading(false);
    setCd(NEWS_INTERVAL);
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  useEffect(() => {
    const t = setInterval(() => {
      setCd(prev => {
        if (prev <= 1) { setTimeout(() => fetchNews(), 0); return NEWS_INTERVAL; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [fetchNews]);

  const cfg = NEWS_FEEDS[feed];
  const items = news[feed];
  const pct = ((NEWS_INTERVAL - cd) / NEWS_INTERVAL) * 100;
  const mm = Math.floor(cd / 60), ss = cd % 60;

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Newspaper size={13} style={{ color: "#166534" }} />
          <div className="flex-1">
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "#e5e7eb" }}>
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, background: "#22c55e" }} />
            </div>
          </div>
          <span className="font-mono font-bold px-2 py-0.5 rounded text-xs" style={{ background: "#f0fdf4", color: "#166534" }}>
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </span>
          <button onClick={fetchNews} title="Atualizar agora" className="p-1 rounded-md" style={{ background: "#f1f5f9" }}>
            <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {Object.entries(NEWS_FEEDS).map(([k, v]) => (
              <button key={k} onClick={() => setFeed(k)}
                className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
                style={{ background: feed === k ? v.cor : v.bg, color: feed === k ? "#fff" : v.cor }}>
                {v.label}
              </button>
            ))}
          </div>
          {lastUpdate && (
            <span className="text-xs opacity-30">
              {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </Card>

      {loading && items.length === 0 ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-3">
              <div className="flex gap-3 animate-pulse">
                <div className="w-16 h-16 rounded-lg bg-gray-200 shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 bg-gray-200 rounded w-4/5" />
                  <div className="h-2 bg-gray-200 rounded w-1/3" />
                  <div className="h-2 bg-gray-200 rounded w-full" />
                  <div className="h-2 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : hasError || items.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-3xl mb-3">📡</div>
          <div className="text-sm font-semibold opacity-50 mb-4">Não foi possível carregar as notícias</div>
          <button onClick={fetchNews} className="px-4 py-2 rounded-lg text-xs font-bold text-white"
            style={{ background: cfg.cor }}>Tentar novamente</button>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => <NewsCard key={i} item={item} cor={cfg.cor} />)}
        </div>
      )}
    </div>
  );
}

function HistoricoTab() {
  const cols = ["boi", "soja", "milho", "cafe", "trigo", "feijao", "cana", "leite"];
  const lb = { boi: "🐂 Boi", soja: "🌱 Soja", milho: "🌽 Milho", cafe: "☕ Café", trigo: "🌾 Trigo", feijao: "🥔 Feijão", cana: "🎋 Cana", leite: "🥛 Leite" };
  return (
    <Card className="p-3 overflow-x-auto">
      <SecTitle icon={Clock} title="Histórico 2020–2026" color="#166534" />
      <p className="text-xs opacity-40 mb-2">Fonte: CEPEA/ESALQ, Farmnews • R$ nominais</p>
      <table className="w-full text-xs" style={{ minWidth: 550 }}>
        <thead><tr style={{ background: "#166534", color: "#fff" }}><th className="py-1.5 px-1 text-left">Commodity</th>{HISTORICO.map(h => <th key={h.ano} className="py-1.5 px-1 text-center">{h.ano}</th>)}<th className="py-1.5 px-1 text-center">Var%</th></tr></thead>
        <tbody>{cols.map((c, i) => { const pct = ((HISTORICO[6][c] - HISTORICO[0][c]) / HISTORICO[0][c] * 100); return (
          <tr key={c} style={{ background: i % 2 === 0 ? "#f0fdf4" : "#fff" }}><td className="py-1 px-1 font-semibold whitespace-nowrap">{lb[c]}</td>{HISTORICO.map(h => <td key={h.ano} className="py-1 px-1 text-center font-mono" style={{ color: h.ano === "Mar/26" ? "#166534" : "#333", fontWeight: h.ano === "Mar/26" ? 700 : 400 }}>{fmt(h[c])}</td>)}<td className="py-1 px-1 text-center"><VarBadge val={parseFloat(pct.toFixed(1))} /></td></tr>); })}</tbody>
      </table>
    </Card>
  );
}

const CC = { boi: "#1a5276", soja: "#27ae60", milho: "#f39c12", cafe: "#6f4e37", trigo: "#c0392b", feijao: "#8e44ad", cana: "#16a085", leite: "#2980b9" };
const CL = { boi: "Boi", soja: "Soja", milho: "Milho", cafe: "Café", trigo: "Trigo", feijao: "Feijão", cana: "Cana", leite: "Leite" };

function GraficosTab() {
  const [sel, setSel] = useState(["boi", "soja", "milho"]);
  return (
    <div className="space-y-4">
      <Card className="p-3">
        <SecTitle icon={BarChart3} title="Evolução 2020–2026" color="#1a5276" />
        <div className="flex flex-wrap gap-1 mb-3">{Object.entries(CL).map(([k, v]) => <button key={k} onClick={() => setSel(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k])} className="px-2 py-1 rounded-full text-xs font-semibold" style={{ background: sel.includes(k) ? CC[k] : "#f1f5f9", color: sel.includes(k) ? "#fff" : "#64748b" }}>{v}</button>)}</div>
        <div style={{ height: 300 }}><ResponsiveContainer><LineChart data={HISTORICO} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="ano" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip formatter={v => `R$ ${fmt(v)}`} contentStyle={{ borderRadius: 8, fontSize: 11 }} /><Legend wrapperStyle={{ fontSize: 10 }} />{sel.map(k => <Line key={k} type="monotone" dataKey={k} name={CL[k]} stroke={CC[k]} strokeWidth={2.5} dot={{ r: 3 }} />)}</LineChart></ResponsiveContainer></div>
        <p className="text-xs opacity-25 mt-2 text-right">Fonte: CEPEA/ESALQ-USP, Farmnews</p>
      </Card>
      <Card className="p-3">
        <SecTitle icon={Activity} title="Café Arábica" color="#6f4e37" />
        <div style={{ height: 220 }}><ResponsiveContainer><AreaChart data={HISTORICO} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6f4e37" stopOpacity={0.3} /><stop offset="95%" stopColor="#6f4e37" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="ano" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip formatter={v => `R$ ${fmt(v)}/saca`} contentStyle={{ borderRadius: 8, fontSize: 11 }} /><Area type="monotone" dataKey="cafe" name="Café" stroke="#6f4e37" strokeWidth={3} fill="url(#cg)" dot={{ r: 4, fill: "#6f4e37" }} /></AreaChart></ResponsiveContainer></div>
      </Card>
    </div>
  );
}

function GlossarioTab() {
  const [open, setOpen] = useState(null);
  return (
    <Card className="p-3"><SecTitle icon={BookOpen} title="Glossário" color="#b45309" /><div className="space-y-1">{GLOSSARIO.map((g, i) => (
      <div key={i}><button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between py-2 px-3 rounded-lg text-sm text-left" style={{ background: open === i ? "#fef3c7" : i % 2 === 0 ? "#fffbeb" : "#fff", border: "1px solid #fde68a" }}><span className="font-semibold">{g.icon} {g.termo}</span>{open === i ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>{open === i && <div className="px-4 py-2 text-sm rounded-b-lg" style={{ background: "#fefce8", borderLeft: "3px solid #f59e0b", color: "#78350f" }}>{g.def}</div>}</div>
    ))}</div></Card>
  );
}

export default function App() {
  const [tab, setTab] = useState("painel");
  const [clock, setClock] = useState(new Date());
  const [cd, setCd] = useState(UPDATE_SEC);
  const [paused, setPaused] = useState(false);
  const [count, setCount] = useState(0);
  const [last, setLast] = useState(null);
  const [flash, setFlash] = useState(new Set());
  const [dataSource, setDataSource] = useState("aguardando");

  const [moedas, setMoedas] = useState(INIT_MOEDAS);
  const [acoes, setAcoes] = useState(INIT_ACOES);
  const [indices, setIndices] = useState(INIT_INDICES);
  const [comm, setComm] = useState(INIT_COMM);
  const [pm, setPm] = useState({});
  const [pa, setPa] = useState({});
  const [pi, setPi] = useState({});
  const [pc, setPc] = useState({});

  const moedasRef = useRef(moedas);
  const acoesRef = useRef(acoes);
  const indicesRef = useRef(indices);
  const commRef = useRef(comm);
  useEffect(() => { moedasRef.current = moedas; }, [moedas]);
  useEffect(() => { acoesRef.current = acoes; }, [acoes]);
  useEffect(() => { indicesRef.current = indices; }, [indices]);
  useEffect(() => { commRef.current = comm; }, [comm]);

  const doUpdate = useCallback(async () => {
    const fl = new Set();
    const sv = (arr) => { const m = {}; arr.forEach(x => m[x.id] = x.valor); return m; };

    const curM = moedasRef.current;
    const curA = acoesRef.current;
    const curI = indicesRef.current;
    const curC = commRef.current;

    const prevM = sv(curM); setPm(prevM);
    const prevA = sv(curA); setPa(prevA);
    const prevI = sv(curI); setPi(prevI);
    const prevC = sv(curC); setPc(prevC);

    let realM = null, realA = null, realI = null;
    try {
      const [mRes, aRes] = await Promise.allSettled([
        fetch(API_MOEDAS_URL).then(r => r.json()),
        fetch(API_ACOES_URL).then(r => r.json()),
      ]);
      if (mRes.status === "fulfilled" && mRes.value) {
        const d = mRes.value;
        realM = {
          usd:   d.USDBRL ? { valor: parseFloat(d.USDBRL.bid),  var: parseFloat(d.USDBRL.pctChange)  } : null,
          usd_t: d.USDBRL ? { valor: parseFloat((parseFloat(d.USDBRL.bid) * 1.034).toFixed(3)), var: parseFloat(d.USDBRL.pctChange) } : null,
          eur:   d.EURBRL ? { valor: parseFloat(d.EURBRL.bid),  var: parseFloat(d.EURBRL.pctChange)  } : null,
          gbp:   d.GBPBRL ? { valor: parseFloat(d.GBPBRL.bid),  var: parseFloat(d.GBPBRL.pctChange)  } : null,
          ars:   d.ARSBRL ? { valor: parseFloat(d.ARSBRL.bid),  var: parseFloat(d.ARSBRL.pctChange)  } : null,
        };
      }
      if (aRes.status === "fulfilled" && aRes.value?.results) {
        const byS = {};
        aRes.value.results.forEach(r => { byS[r.symbol] = r; });
        if (byS.PETR4 || byS.VALE3) {
          realA = {
            petr4: byS.PETR4 ? { valor: byS.PETR4.regularMarketPrice, var: parseFloat(byS.PETR4.regularMarketChangePercent.toFixed(2)) } : null,
            vale3: byS.VALE3 ? { valor: byS.VALE3.regularMarketPrice, var: parseFloat(byS.VALE3.regularMarketChangePercent.toFixed(2)) } : null,
          };
        }
        if (byS["^BVSP"]) {
          realI = { ibov: { valor: Math.round(byS["^BVSP"].regularMarketPrice), var: parseFloat(byS["^BVSP"].regularMarketChangePercent.toFixed(2)) } };
        }
      }
    } catch (_) { /* fallback para simulação */ }

    setDataSource(!!(realM || realA) ? "real" : "simulado");

    setMoedas(curM.map(m => {
      const r = realM?.[m.id];
      const nv = r ? r.valor : simVar(m.valor, 0.3);
      if (Math.abs(nv - m.valor) > 0.0001) fl.add(m.id);
      return { ...m, valor: nv, var: r ? r.var : parseFloat(((nv - prevM[m.id]) / prevM[m.id] * 100).toFixed(2)) };
    }));
    setAcoes(curA.map(a => {
      const r = realA?.[a.id];
      const nv = r ? r.valor : simVar(a.valor, 0.5);
      if (Math.abs(nv - a.valor) > 0.001) fl.add(a.id);
      return { ...a, valor: nv, var: r ? r.var : parseFloat(((nv - prevA[a.id]) / prevA[a.id] * 100).toFixed(2)) };
    }));
    setIndices(curI.map(x => {
      const r = realI?.[x.id];
      const nv = r ? r.valor : Math.round(simVar(x.valor, 0.3));
      if (nv !== x.valor) fl.add(x.id);
      return { ...x, valor: nv, var: r ? r.var : parseFloat(((nv - prevI[x.id]) / prevI[x.id] * 100).toFixed(2)) };
    }));
    setComm(curC.map(c => {
      const nv = simVar(c.valor, 0.4);
      if (Math.abs(nv - c.valor) > 0.001) fl.add(c.id);
      return { ...c, valor: nv };
    }));

    setFlash(fl);
    setTimeout(() => setFlash(new Set()), 2500);
    setCount(c => c + 1);
    setLast(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    setCd(UPDATE_SEC);
  }, []);

  useEffect(() => { doUpdate(); }, [doUpdate]);

  useEffect(() => {
    const t = setInterval(() => {
      setClock(new Date());
      if (!paused) {
        setCd(prev => {
          if (prev <= 1) {
            setTimeout(() => doUpdate(), 0);
            return UPDATE_SEC;
          }
          return prev - 1;
        });
      }
    }, 1000);
    return () => clearInterval(t);
  }, [paused, doUpdate]);

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg,#f8fafc 0%,#ecfdf5 50%,#f0f9ff 100%)", fontFamily: "system-ui, sans-serif" }}>
      <div className="sticky top-0 z-50 border-b" style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderColor: "rgba(0,0,0,0.06)" }}>
        <div className="max-w-4xl mx-auto px-3">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2"><div className="rounded-full flex items-center justify-center" style={{ width: 26, height: 26, background: "#2E7D32" }}><span style={{ fontSize: 7, color: "#fff", fontWeight: 900 }}>CEEP</span></div><span className="text-sm font-bold" style={{ color: "#166534" }}>AgroInfo</span></div>
            <div className="flex items-center gap-2 text-xs opacity-40">{count > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#22c55e" }} />Ao vivo</span>}<span>{clock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div>
          </div>
          <div className="flex gap-0.5 -mb-px overflow-x-auto">{TABS.map(t => { const I = TAB_ICONS[t]; return (<button key={t} onClick={() => setTab(t)} className="flex items-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-t-lg whitespace-nowrap" style={{ background: tab === t ? "#fff" : "transparent", color: tab === t ? "#166534" : "#94a3b8", borderBottom: tab === t ? "2px solid #166534" : "2px solid transparent" }}><I size={12} />{TAB_LABELS[t]}</button>); })}</div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-3 py-4">
        {tab === "painel" && <CountdownBar sec={cd} total={UPDATE_SEC} paused={paused} onToggle={() => setPaused(p => !p)} onRefresh={doUpdate} count={count} last={last} source={dataSource} />}
        {tab === "painel" && <PainelTab moedas={moedas} acoes={acoes} indices={indices} comm={comm} pm={pm} pa={pa} pi={pi} pc={pc} flash={flash} />}
        {tab === "noticias" && <NoticiasTab />}
        {tab === "historico" && <HistoricoTab />}
        {tab === "graficos" && <GraficosTab />}
        {tab === "glossario" && <GlossarioTab />}
      </div>
      <div className="text-center py-3 text-xs opacity-20">🎓 C.E.E.P.A. Fernando Costa — Santa Mariana, PR • Docente: Marcel Dancini Rodrigues</div>
    </div>
  );
}
