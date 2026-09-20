import VisitorCounter from "./components/VisitorCounter";
import { StockQuotes, CommodityQuotes, TICKER_RE } from "./components/MarketQuotes";
import { useState, useEffect, useRef, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { RefreshCw, BookOpen, BarChart3, Clock, Wheat, DollarSign, Activity, ChevronDown, ChevronUp, Timer, ArrowRight, Pause, Play, Newspaper, ExternalLink, Search, MapPin } from "lucide-react";

const UPDATE_SEC = 60;
const API_MOEDAS_URL = "https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,GBP-BRL,ARS-BRL";
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
const INDICADORES = [
  { nome: "IPCA", periodo: "", valor: "+0,70%", desc: "Inflação oficial (IBGE)" },
  { nome: "INPC", periodo: "", valor: "+0,56%", desc: "Cesta básica (IBGE)" },
  { nome: "IGP-M", periodo: "", valor: "-0,73%", desc: "Aluguéis (FGV)" },
  { nome: "Selic", periodo: "", valor: "Carregando…", desc: "Meta BC" },
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
const WMO = {
  0:  { label: "Céu limpo",            emoji: "☀️"  },
  1:  { label: "Principalmente limpo", emoji: "🌤️"  },
  2:  { label: "Parcialmente nublado", emoji: "⛅"  },
  3:  { label: "Nublado",              emoji: "☁️"  },
  45: { label: "Névoa",                emoji: "🌫️"  },
  48: { label: "Névoa com geada",      emoji: "🌫️"  },
  51: { label: "Garoa leve",           emoji: "🌦️"  },
  53: { label: "Garoa moderada",       emoji: "🌦️"  },
  55: { label: "Garoa intensa",        emoji: "🌦️"  },
  61: { label: "Chuva leve",           emoji: "🌧️"  },
  63: { label: "Chuva moderada",       emoji: "🌧️"  },
  65: { label: "Chuva forte",          emoji: "🌧️"  },
  71: { label: "Neve leve",            emoji: "🌨️"  },
  73: { label: "Neve moderada",        emoji: "🌨️"  },
  75: { label: "Neve forte",           emoji: "🌨️"  },
  80: { label: "Pancadas leves",       emoji: "🌦️"  },
  81: { label: "Pancadas moderadas",   emoji: "🌧️"  },
  82: { label: "Pancadas violentas",   emoji: "⛈️"  },
  95: { label: "Trovoada",             emoji: "⛈️"  },
  96: { label: "Trovoada c/ granizo",  emoji: "⛈️"  },
  99: { label: "Trovoada forte",       emoji: "⛈️"  },
};
const getWmo = (code) => WMO[code] || { label: "Variável", emoji: "🌡️" };
const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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

function CountdownBar({ sec, total, paused, onToggle, onRefresh, count, last, source }) {
  const pct = ((total - sec) / total) * 100;
  const m = Math.floor(sec / 60), s = sec % 60;
  return (
    <Card className="p-3 mb-4">
      <div className="flex items-center gap-2">
        <Timer size={13} style={{ color: sec <= 10 ? "#dc2626" : "#166534" }} />
        <div className="flex-1"><div className="h-2 rounded-full overflow-hidden" style={{ background: "#e5e7eb" }}><div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, background: sec <= 10 ? "#ef4444" : "#22c55e" }} /></div></div>
        <span className="font-mono font-bold px-2 py-0.5 rounded text-xs" style={{ background: sec <= 10 ? "#fef3c7" : "#f0fdf4", color: sec <= 10 ? "#92400e" : "#166534" }}>{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>
        <button aria-label={paused ? "Retomar atualização" : "Pausar atualização"} onClick={onToggle} className="p-1 rounded-md" style={{ background: "#f1f5f9" }}>{paused ? <Play size={12} /> : <Pause size={12} />}</button>
        <button aria-label="Atualizar cotações agora" onClick={onRefresh} className="p-1 rounded-md" style={{ background: "#f1f5f9" }}><RefreshCw size={12} /></button>
      </div>
      <div className="flex justify-between mt-1 text-xs opacity-40"><span>{paused ? "⏸ Pausado" : source === "real" ? "🟢 Consulta automática a cada 60s" : source === "simulado" ? "🟡 Fonte de moedas indisponível — moedas simuladas" : "⏳ Buscando cotações..."}</span><span>Ciclos: {count}{last ? ` • ${last}` : ""}</span></div>
    </Card>
  );
}

function WeatherWidget() {
  const [input, setInput] = useState("Santa Mariana");
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWeather = async (loc) => {
    if (!loc.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(loc)}&count=1&language=pt&format=json`);
      const geoData = await geoRes.json();
      if (!geoData.results?.length) throw new Error("Localidade não encontrada");
      const { latitude, longitude, name, admin1 } = geoData.results[0];
      const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone=auto&forecast_days=5&wind_speed_unit=kmh`);
      const wData = await wRes.json();
      setWeather({ name: `${name}${admin1 ? `, ${admin1}` : ""}`, current: wData.current, daily: wData.daily });
    } catch (e) {
      setError(e.message || "Erro ao buscar previsão");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent("Santa Mariana")}&count=1&language=pt&format=json`, { signal: controller.signal });
        const geoData = await geoRes.json();
        if (!geoData.results?.length) throw new Error("Localidade não encontrada");
        const { latitude, longitude, name, admin1 } = geoData.results[0];
        const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone=auto&forecast_days=5&wind_speed_unit=kmh`, { signal: controller.signal });
        const wData = await wRes.json();
        setWeather({ name: `${name}${admin1 ? `, ${admin1}` : ""}`, current: wData.current, daily: wData.daily });
      } catch (e) {
        if (!controller.signal.aborted) setError(e.message || "Erro ao buscar previsão");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  return (
    <Card className="p-3" style={{ borderLeft: "4px solid #1e40af", background: "linear-gradient(135deg,#dbeafe 0%,#eff6ff 100%)" }}>
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#1e40af" }}>
          <span style={{ fontSize: 15 }}>🌤️</span>
        </div>
        <h2 className="text-sm font-bold" style={{ color: "#1e40af" }}>Previsão do Tempo</h2>
      </div>

      <div className="flex gap-1.5 mb-3">
        <div className="flex-1 relative">
          <MapPin size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#93c5fd" }} />
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && fetchWeather(input)}
            placeholder="Digite a localidade..."
            className="w-full rounded-lg border text-sm"
            style={{ paddingLeft: 26, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderColor: "#93c5fd", outline: "none", background: "rgba(255,255,255,0.8)", fontSize: 13 }}
          />
        </div>
        <button
          onClick={() => fetchWeather(input)}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{ background: "#1e40af", color: "#fff", opacity: loading ? 0.7 : 1 }}
        >
          <Search size={12} />{loading ? "..." : "Buscar"}
        </button>
      </div>

      {error && <div className="text-xs px-2 py-1 rounded-lg mb-2" style={{ background: "#fee2e2", color: "#991b1b" }}>{error}</div>}

      {loading && !weather && (
        <div className="text-center py-4 text-sm opacity-40">Buscando previsão do tempo...</div>
      )}

      {weather && (
        <>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <div style={{ fontSize: 44, lineHeight: 1 }}>{getWmo(weather.current.weather_code).emoji}</div>
            <div>
              <div className="text-3xl font-black" style={{ color: "#1e3a8a", lineHeight: 1 }}>{Math.round(weather.current.temperature_2m)}°C</div>
              <div className="text-xs font-semibold mt-0.5" style={{ color: "#3b82f6" }}>{getWmo(weather.current.weather_code).label}</div>
              <div className="text-xs mt-0.5 opacity-50">{weather.name}</div>
            </div>
            <div className="ml-auto text-xs space-y-1 text-right shrink-0">
              <div className="font-semibold" style={{ color: "#1e40af" }}>💨 {Math.round(weather.current.wind_speed_10m)} km/h</div>
              <div className="font-semibold" style={{ color: "#1e40af" }}>💧 {weather.current.relative_humidity_2m}%</div>
            </div>
          </div>

          <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
            {weather.daily.time.slice(0, 5).map((date, i) => {
              const d = new Date(date + "T12:00:00");
              const rain = weather.daily.precipitation_probability_max[i];
              return (
                <div key={i} className="flex flex-col items-center rounded-xl py-2 px-1" style={{ background: i === 0 ? "rgba(30,64,175,0.12)" : "rgba(255,255,255,0.55)" }}>
                  <div className="text-xs font-bold mb-1" style={{ color: i === 0 ? "#1e3a8a" : "#64748b" }}>{i === 0 ? "Hoje" : WEEK[d.getDay()]}</div>
                  <div style={{ fontSize: 22, lineHeight: 1 }}>{getWmo(weather.daily.weather_code[i]).emoji}</div>
                  <div className="text-xs font-black mt-1" style={{ color: "#1e3a8a" }}>{Math.round(weather.daily.temperature_2m_max[i])}°</div>
                  <div className="text-xs opacity-40">{Math.round(weather.daily.temperature_2m_min[i])}°</div>
                  {rain > 20 && <div className="text-xs font-semibold mt-0.5" style={{ color: "#2563eb" }}>☂ {rain}%</div>}
                </div>
              );
            })}
          </div>

          <div className="mt-2 text-xs opacity-25 text-right">Fonte: Open-Meteo.com (dados gratuitos, sem API key)</div>
        </>
      )}
    </Card>
  );
}

function PainelTab({ moedas, pm, flash, selic, refresh, onViewChart }) {
  const indicadores = INDICADORES.map(ind => ind.nome === 'Selic' ? {
    ...ind, valor: selic.value != null ? `${fmt(selic.value)}% a.a.` : selic.error ? 'Indisponível' : 'Carregando…',
    periodo: selic.date, desc: selic.error ? (selic.value != null ? 'Falha na atualização; última taxa recebida' : 'Banco Central indisponível; nova tentativa automática') : 'Meta BC · atualização automática',
  } : ind);
  return (
    <div className="space-y-4">
      <WeatherWidget />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="p-3"><SecTitle icon={DollarSign} title="Moedas" color="#1a5276" />{moedas.map((m, i) => <PriceRow key={m.id} emoji={m.emoji} nome={m.nome} valor={m.valor} prev={pm[m.id]} varPct={m.var} flash={flash.has(m.id)} alt={i % 2 === 0} />)}<div className="mt-2 text-xs opacity-25 text-right">Fonte: AwesomeAPI (tempo real)</div></Card>
        <StockQuotes refresh={refresh} onViewChart={onViewChart} />
      </div>
      <CommodityQuotes refresh={refresh} onViewChart={onViewChart} />
      <Card className="p-3"><SecTitle icon={BarChart3} title="Indicadores Econômicos" color="#6b21a8" /><div className="grid grid-cols-2 md:grid-cols-3 gap-2">{indicadores.map((ind, i) => (<div key={i} className="rounded-lg p-2 text-center" style={{ background: i % 2 === 0 ? "#faf5ff" : "#f5f3ff" }}><div className="text-xs font-semibold opacity-60">{ind.nome} {ind.periodo && `(${ind.periodo})`}</div><div className="text-base font-bold" style={{ color: "#6b21a8" }}>{ind.valor}</div><div className="text-xs opacity-40">{ind.desc}</div></div>))}</div><div className="mt-2 text-xs opacity-25 text-right">Fonte: BCB / IBGE / FGV</div></Card>
      <div className="text-xs opacity-25 text-center">📌 Selic: Banco Central (SGS 432) • Demais indicadores: valores de referência fixos. Moedas podem conter estimativas ou simulação quando a fonte falha.</div>
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
    } catch { setHasError(true); }
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
const normalize = (v) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function GraficosCommoditiesPanel({ target }) {
  const [sel, setSel] = useState(() => (target?.type === "commodity" && target.key ? [target.key] : ["boi", "soja", "milho"]));
  const [search, setSearch] = useState("");
  const opts = Object.keys(CL).filter(k => normalize(CL[k]).includes(normalize(search)));
  return (
    <Card className="p-3">
      <SecTitle icon={BarChart3} title="Commodities · Evolução 2020–2026" color="#1a5276" />
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Digite a commodity (ex.: soja, boi, café)"
        className="block w-full border rounded-lg p-2 mb-3 text-sm" />
      <div className="flex flex-wrap gap-1 mb-3">{opts.map(k => <button key={k} onClick={() => setSel(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k])} className="px-2 py-1 rounded-full text-xs font-semibold" style={{ background: sel.includes(k) ? CC[k] : "#f1f5f9", color: sel.includes(k) ? "#fff" : "#64748b" }}>{CL[k]}</button>)}
        {!opts.length && <span className="text-xs opacity-40">Nenhuma commodity encontrada com esse nome.</span>}</div>
      {sel.length > 0 ? (
        <div style={{ height: 300 }}><ResponsiveContainer><LineChart data={HISTORICO} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="ano" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip formatter={v => `R$ ${fmt(v)}`} contentStyle={{ borderRadius: 8, fontSize: 11 }} /><Legend wrapperStyle={{ fontSize: 10 }} />{sel.map(k => <Line key={k} type="monotone" dataKey={k} name={CL[k]} stroke={CC[k]} strokeWidth={2.5} dot={{ r: 3 }} />)}</LineChart></ResponsiveContainer></div>
      ) : <p className="text-sm opacity-50 py-8 text-center">Selecione ao menos uma commodity para ver o gráfico.</p>}
      <p className="text-xs opacity-25 mt-2 text-right">Fonte: CEPEA/ESALQ-USP, Farmnews · série anual</p>
      <p className="text-xs opacity-40 mt-1">Para outras commodities da lista de cotação (algodão, suíno, laranja, contratos internacionais), ainda não há série histórica diária disponível — consulte o valor atual no Painel.</p>
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

function GraficosTab({ target }) {
  const [mode, setMode] = useState(() => (target?.type === "stock" ? "acoes" : "commodities"));
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setMode("commodities")} className="px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: mode === "commodities" ? "#166534" : "#f1f5f9", color: mode === "commodities" ? "#fff" : "#64748b" }}>🌾 Commodities</button>
        <button onClick={() => setMode("acoes")} className="px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: mode === "acoes" ? "#1a5276" : "#f1f5f9", color: mode === "acoes" ? "#fff" : "#64748b" }}>📈 Ações / ETFs</button>
      </div>
      {mode === "commodities" ? <GraficosCommoditiesPanel key={target?.type === "commodity" ? target.key : "default"} target={target} /> : <GraficosAcoesPanel key={target?.type === "stock" ? target.symbol : "default"} target={target} />}
      <ComoLerGraficoCard />
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
  const [selic, setSelic] = useState({});
  const [dataSource, setDataSource] = useState("aguardando");

  const [moedas, setMoedas] = useState(INIT_MOEDAS);
  const [pm, setPm] = useState({});
  const [chartTarget, setChartTarget] = useState(null);
  const viewChart = useCallback((target) => { setChartTarget(target); setTab("graficos"); }, []);

  const updating = useRef(false);
  const moedasRef = useRef(moedas);
  useEffect(() => { moedasRef.current = moedas; }, [moedas]);

  const doUpdate = useCallback(async () => {
    if (updating.current) return;
    updating.current = true;
    const fl = new Set();
    const sv = (arr) => { const m = {}; arr.forEach(x => m[x.id] = x.valor); return m; };

    const curM = moedasRef.current;

    const prevM = sv(curM); setPm(prevM);

    let realM = null;
    try {
      const [mRes, sRes] = await Promise.allSettled([
        fetch(API_MOEDAS_URL, { signal: AbortSignal.timeout(12000) }).then(r => { if (!r.ok) throw new Error("Moedas indisponíveis"); return r.json(); }),
        fetch('/api/market?type=selic', { signal: AbortSignal.timeout(15000) }).then(async r => {
          if (!r.ok) throw new Error('Selic indisponível');
          return r.json();
        }),
      ]);
      if (sRes.status === 'fulfilled') setSelic({ ...sRes.value, error: false });
      else setSelic(previous => ({ ...previous, error: true }));
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
    } catch { /* fallback para simulação */ }

    setDataSource(realM ? "real" : "simulado");

    setMoedas(curM.map(m => {
      const r = realM?.[m.id];
      const nv = r ? r.valor : simVar(m.valor, 0.3);
      if (Math.abs(nv - m.valor) > 0.0001) fl.add(m.id);
      return { ...m, valor: nv, var: r ? r.var : parseFloat(((nv - prevM[m.id]) / prevM[m.id] * 100).toFixed(2)) };
    }));
    setFlash(fl);
    setTimeout(() => setFlash(new Set()), 2500);
    setCount(c => c + 1);
    setLast(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    setCd(UPDATE_SEC);
    updating.current = false;
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
      <div className="max-w-4xl mx-auto px-3 pt-3 pb-2">
        <div className="rounded-xl overflow-hidden" style={{ background: "linear-gradient(135deg,#0c2340 0%,#1a5276 40%,#1e8449 100%)" }}>
          <div className="px-4 py-4">
            <div className="flex items-center gap-1.5 mb-0.5"><Wheat size={14} color="#fbbf24" /><span style={{ fontSize: 10, color: "#fbbf24", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Informativo Diário</span></div>
            <h1 className="text-base font-bold text-white">Mercado Agrícola</h1>
            <div className="flex items-center gap-3 mt-3">
              <div className="rounded-full border-2 border-white flex items-center justify-center shrink-0" style={{ width: 56, height: 56, background: "radial-gradient(circle, #2E7D32 60%, #1B5E20 100%)" }}>
                <div className="text-center leading-none"><div style={{ fontSize: 6.5, color: "#fff", fontWeight: 700 }}>C.E.E.P.A.</div><div style={{ fontSize: 8, color: "#fbbf24", fontWeight: 900, marginTop: 1 }}>FERNANDO</div><div style={{ fontSize: 8, color: "#fbbf24", fontWeight: 900 }}>COSTA</div></div>
              </div>
              <div>
                <div className="text-sm font-bold text-white">C.E.E.P.A. Fernando Costa</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>Santa Mariana, PR • Docente: <strong style={{ color: "rgba(255,255,255,0.8)" }}>Marcel Dancini Rodrigues</strong> • {new Date().toLocaleDateString("pt-BR")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="sticky top-0 z-50 border-b" style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderColor: "rgba(0,0,0,0.06)" }}>
        <div className="max-w-4xl mx-auto px-3">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2"><div className="rounded-full flex items-center justify-center" style={{ width: 26, height: 26, background: "#2E7D32" }}><span style={{ fontSize: 7, color: "#fff", fontWeight: 900 }}>CEEP</span></div><span className="text-sm font-bold" style={{ color: "#166534" }}>AgroInfo</span></div>
            <div className="flex items-center gap-2 text-xs opacity-40">{count > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#22c55e" }} />Ao vivo</span>}<span>{clock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div>
          </div>
          <div className="flex sm:justify-center gap-0.5 -mb-px overflow-x-auto">{TABS.map(t => { const I = TAB_ICONS[t]; return (<button key={t} onClick={() => setTab(t)} className="flex items-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-t-lg whitespace-nowrap" style={{ background: tab === t ? "#fff" : "transparent", color: tab === t ? "#166534" : "#94a3b8", borderBottom: tab === t ? "2px solid #166534" : "2px solid transparent" }}><I size={12} />{TAB_LABELS[t]}</button>); })}</div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-3 py-4">
        {tab === "painel" && <CountdownBar sec={cd} total={UPDATE_SEC} paused={paused} onToggle={() => setPaused(p => !p)} onRefresh={doUpdate} count={count} last={last} source={dataSource} />}
        {tab === "painel" && <PainelTab moedas={moedas} pm={pm} flash={flash} selic={selic} refresh={count} onViewChart={viewChart} />}
        {tab === "noticias" && <NoticiasTab />}
        {tab === "historico" && <HistoricoTab />}
        {tab === "graficos" && <GraficosTab target={chartTarget} />}
        {tab === "glossario" && <GlossarioTab />}
      </div>
      <div className="text-center py-3 text-xs opacity-20">🎓 C.E.E.P.A. Fernando Costa — Santa Mariana, PR • Docente: Marcel Dancini Rodrigues</div>
      <VisitorCounter />
    </div>
  );
}
