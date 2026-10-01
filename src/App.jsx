import VisitorCounter from "./components/VisitorCounter";
import Mascote, { BotaoMascote } from "./components/Mascote";
import useMascote from "./components/useMascote";
import CotacoesCooperativas from "./components/CotacoesCooperativas";
import BolsaChicago from "./components/BolsaChicago";
import CompararHistorico from "./components/CompararHistorico";
import ClimaAgricola from "./components/ClimaAgricola";
import Calculadoras from "./components/Calculadoras";
import Aprender from "./components/Aprender";
import SafraTab from "./components/SafraTab";
import Exportacoes from "./components/Exportacoes";
import Combustiveis from "./components/Combustiveis";
import { getWmo, WEEK } from "./clima";
import { StockQuotes, CommodityQuotes, FuturesQuotes, TICKER_RE } from "./components/MarketQuotes";
import { COMMODITIES, FUTURES, CHICAGO, CALCULADORAS, APELIDOS_FUTUROS, PRODUTOS_PARANA } from "./catalogo";
import BuscaAgro from "./components/BuscaAgro";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { RefreshCw, BookOpen, BarChart3, Clock, Wheat, DollarSign, Activity, ChevronDown, ChevronUp, Timer, ArrowRight, Pause, Play, Newspaper, ExternalLink, Search, MapPin, Warehouse, TrendingUp, Landmark, CloudRain, Calculator, GraduationCap, Sprout, Ship } from "lucide-react";

const UPDATE_SEC = 60;
const DOCENTE = "Marcel Dancini Rodrigues";
const ALUNOS_PARTICIPANTES = ["Pietra Sanguini"]; // para incluir mais alunos, acrescente os nomes aqui
// URL do App da Web do assistente (Apps Script, termina em /exec). Passo a passo em apps-script/LEIA-ME.md.
const ASSISTENTE_URL = import.meta.env.VITE_ASSISTENTE_URL
  || "https://script.google.com/macros/s/AKfycbyDYcrR3XX5bqo0rKCp1c1ZgDHf4GCHsJv7jesNPo5PEtJT6qYMLCyUV6OGmB1ur-jrBA/exec";
const API_MOEDAS_URL = "https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,GBP-BRL,ARS-BRL";
const TABS = ["painel", "futuros", "chicago", "cooperativas", "safra", "exportacoes", "clima", "calculadoras", "aprender", "noticias", "historico", "graficos", "glossario"];
const TAB_LABELS = { painel: "Painel", futuros: "Futuros", chicago: "Chicago", cooperativas: "Cotações Cooperativas", safra: "Safra", exportacoes: "Exportações", clima: "Clima", calculadoras: "Calculadoras", aprender: "Aprender", noticias: "Notícias", historico: "Histórico", graficos: "Gráficos", glossario: "Glossário" };
const TAB_ICONS = { painel: Activity, futuros: TrendingUp, chicago: Landmark, cooperativas: Warehouse, safra: Sprout, exportacoes: Ship, clima: CloudRain, calculadoras: Calculator, aprender: GraduationCap, noticias: Newspaper, historico: Clock, graficos: BarChart3, glossario: BookOpen };

const INIT_MOEDAS = [
  { id: "usd", nome: "Dólar Comercial", emoji: "💵", valor: 4.912, var: -1.12 },
  { id: "usd_t", nome: "Dólar Turismo", emoji: "💵", valor: 5.080, var: -1.05 },
  { id: "eur", nome: "Euro", emoji: "💶", valor: 5.786, var: -0.45 },
  { id: "gbp", nome: "Libra Esterlina", emoji: "💷", valor: 6.698, var: -0.38 },
  { id: "ars", nome: "Peso Argentino", emoji: "💴", valor: 0.004, var: 0.12 },
];
// Indicadores do Painel. "chave" liga cada um à série do Banco Central em /api/market?type=indicadores;
// a Selic tem consulta própria.
const INDICADORES = [
  { nome: "IPCA", chave: "ipca", sufixo: "%", sinal: true, desc: "Inflação oficial (IBGE)" },
  { nome: "INPC", chave: "inpc", sufixo: "%", sinal: true, desc: "Cesta básica (IBGE)" },
  { nome: "IGP-M", chave: "igpm", sufixo: "%", sinal: true, desc: "Aluguéis (FGV)" },
  { nome: "Selic", desc: "Meta BC" },
  { nome: "CDI", chave: "cdi", sufixo: "% a.a.", desc: "Referência renda fixa" },
  { nome: "Poupança", chave: "poupanca", sufixo: "% a.m.", desc: "0,50% + TR" },
];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
// "01/08/2026" → "ago/26" nos índices mensais; nas taxas diárias, a própria data
const periodoDe = (data, mensal) => (mensal ? `${MESES_CURTOS[Number(data.slice(3, 5)) - 1]}/${data.slice(-2)}` : data.slice(0, 5));

// Junta a lista acima com o que chegou do Banco Central (bcb.dados) e com a Selic.
function indicadoresAtuais(bcb, selic) {
  return INDICADORES.map(ind => {
    if (ind.nome === "Selic") return {
      ...ind, valor: selic.value != null ? `${fmt(selic.value)}% a.a.` : selic.error ? "Indisponível" : "Carregando…",
      periodo: selic.date, desc: selic.error ? (selic.value != null ? "Falha na atualização; última taxa recebida" : "Banco Central indisponível; nova tentativa automática") : "Meta BC · atualização automática",
    };
    const dado = bcb.dados?.[ind.chave];
    if (!dado) return { ...ind, periodo: "", valor: bcb.dados || bcb.erro ? "Indisponível" : "Carregando…" };
    const em12Meses = ind.chave === "ipca" && bcb.dados.ipca12 ? ` · 12 meses: ${fmt(bcb.dados.ipca12.valor)}%` : "";
    return { ...ind, periodo: periodoDe(dado.data, ind.sinal), valor: `${ind.sinal && dado.valor > 0 ? "+" : ""}${fmt(dado.valor)}${ind.sufixo}`, desc: `${ind.desc}${em12Meses}` };
  });
}
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

const fmt = (v, d = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtInt = (v) => v.toLocaleString("pt-BR");
const simVar = (val, pct = 0.4) => parseFloat((val + val * (Math.random() * pct * 2 - pct) / 100).toFixed(val < 1 ? 4 : 2));

function VarBadge({ val }) {
  const p = val >= 0;
  return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-bold" style={{ background: p ? "#dcfce7" : "#fee2e2", color: p ? "#166534" : "#991b1b", fontSize: 10 }}>{p ? "▲+" : "▼"}{fmt(val)}%</span>;
}
function Card({ children, className = "", style = {}, id }) {
  return <div id={id} className={`rounded-xl border shadow-sm ${className}`} style={{ scrollMarginTop: 100, background: "rgba(255,255,255,0.9)", borderColor: "rgba(0,0,0,0.06)", ...style }}>{children}</div>;
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
    <Card id="card-tempo" className="p-3" style={{ borderLeft: "4px solid #1e40af", background: "linear-gradient(135deg,#dbeafe 0%,#eff6ff 100%)" }}>
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

function PainelTab({ moedas, pm, flash, indicadores, refresh, onViewChart, alvo }) {
  return (
    <div className="space-y-4">
      <WeatherWidget />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card id="card-moedas" className="p-3"><SecTitle icon={DollarSign} title="Moedas" color="#1a5276" />{moedas.map((m, i) => <PriceRow key={m.id} emoji={m.emoji} nome={m.nome} valor={m.valor} prev={pm[m.id]} varPct={m.var} flash={flash.has(m.id)} alt={i % 2 === 0} />)}<div className="mt-2 text-xs opacity-25 text-right">Fonte: AwesomeAPI (tempo real)</div></Card>
        <StockQuotes key={alvo?.acao ? alvo.n : "acoes"} buscaInicial={alvo?.acao} refresh={refresh} onViewChart={onViewChart} />
      </div>
      <CommodityQuotes key={alvo?.commodity ? alvo.n : "commodities"} adicionar={alvo?.commodity} refresh={refresh} onViewChart={onViewChart} />
      <Card id="card-indicadores" className="p-3"><SecTitle icon={BarChart3} title="Indicadores Econômicos" color="#6b21a8" /><div className="grid grid-cols-2 md:grid-cols-3 gap-2">{indicadores.map((ind, i) => (<div key={i} className="rounded-lg p-2 text-center" style={{ background: i % 2 === 0 ? "#faf5ff" : "#f5f3ff" }}><div className="text-xs font-semibold opacity-60">{ind.nome} {ind.periodo && `(${ind.periodo})`}</div><div className="text-base font-bold" style={{ color: "#6b21a8" }}>{ind.valor}</div><div className="text-xs opacity-40">{ind.desc}</div></div>))}</div><div className="mt-2 text-xs opacity-25 text-right">Fonte: Banco Central (SGS), com dados do IBGE e da FGV · atualização automática</div></Card>
      <Combustiveis />
      <div className="text-xs opacity-25 text-center">📌 Indicadores: último valor publicado pelo Banco Central. Moedas podem conter estimativas ou simulação quando a fonte falha.</div>
    </div>
  );
}

const NEWS_FEEDS = {
  agro:    { label: "🌾 Agronegócio", cor: "#166534", bg: "#f0fdf4" },
  mercado: { label: "💰 Mercado",      cor: "#1a5276", bg: "#f0f7ff" },
  internacional: { label: "🌎 Mercado internacional", cor: "#0f766e", bg: "#f0fdfa",
    desc: "O que acontece nos maiores mercados do mundo (Bolsa de Chicago, USDA, China, Estados Unidos, Argentina, Europa e Índia) e mexe com o preço do produto aqui no Brasil." },
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

function NoticiasTab({ busca }) {
  // quem buscou um assunto no topo do site vê primeiro as notícias sobre ele
  const feeds = useMemo(() => (busca ? {
    busca: { label: `🔎 ${busca}`, cor: "#9a3412", bg: "#fff7ed", desc: `Notícias dos últimos 30 dias sobre "${busca}".`, url: `/api/news?feed=busca&q=${encodeURIComponent(busca)}` },
    ...NEWS_FEEDS,
  } : NEWS_FEEDS), [busca]);
  const [feed, setFeed] = useState(busca ? "busca" : "agro");
  const [news, setNews] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [hasError, setHasError] = useState(false);
  const [cd, setCd] = useState(NEWS_INTERVAL);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setHasError(false);
    try {
      const chaves = Object.keys(feeds);
      const results = await Promise.allSettled(chaves.map(k => fetch(feeds[k].url ?? `/api/news?feed=${k}`).then(r => r.json())));
      setNews(Object.fromEntries(chaves.map((k, i) => [k,
        results[i].status === "fulfilled" && results[i].value?.status === "ok" ? results[i].value.items : []])));
      setLastUpdate(new Date());
    } catch { setHasError(true); }
    setLoading(false);
    setCd(NEWS_INTERVAL);
  }, [feeds]);

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

  const cfg = feeds[feed];
  const items = news[feed] ?? [];
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {Object.entries(feeds).map(([k, v]) => (
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
        {cfg.desc && <p className="text-xs mt-2" style={{ color: cfg.cor }}>{cfg.desc}</p>}
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
    <div className="space-y-4">
    <CompararHistorico historico={HISTORICO} nomes={lb} />
    <Card className="p-3 overflow-x-auto">
      <SecTitle icon={Clock} title="Histórico 2020–2026" color="#166534" />
      <p className="text-xs opacity-40 mb-2">Fonte: CEPEA/ESALQ, Farmnews • R$ nominais</p>
      <table className="w-full text-xs" style={{ minWidth: 550 }}>
        <thead><tr style={{ background: "#166534", color: "#fff" }}><th className="py-1.5 px-1 text-left">Commodity</th>{HISTORICO.map(h => <th key={h.ano} className="py-1.5 px-1 text-center">{h.ano}</th>)}<th className="py-1.5 px-1 text-center">Var%</th></tr></thead>
        <tbody>{cols.map((c, i) => { const pct = ((HISTORICO[6][c] - HISTORICO[0][c]) / HISTORICO[0][c] * 100); return (
          <tr key={c} style={{ background: i % 2 === 0 ? "#f0fdf4" : "#fff" }}><td className="py-1 px-1 font-semibold whitespace-nowrap">{lb[c]}</td>{HISTORICO.map(h => <td key={h.ano} className="py-1 px-1 text-center font-mono" style={{ color: h.ano === "Mar/26" ? "#166534" : "#333", fontWeight: h.ano === "Mar/26" ? 700 : 400 }}>{fmt(h[c])}</td>)}<td className="py-1 px-1 text-center"><VarBadge val={parseFloat(pct.toFixed(1))} /></td></tr>); })}</tbody>
      </table>
    </Card>
    </div>
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

function GlossarioTab({ inicial }) {
  const [open, setOpen] = useState(inicial ?? null);
  return (
    <Card className="p-3"><SecTitle icon={BookOpen} title="Glossário" color="#b45309" /><div className="space-y-1">{GLOSSARIO.map((g, i) => (
      <div key={i} id={`glossario-${i}`} style={{ scrollMarginTop: 100 }}><button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between py-2 px-3 rounded-lg text-sm text-left" style={{ background: open === i ? "#fef3c7" : i % 2 === 0 ? "#fffbeb" : "#fff", border: "1px solid #fde68a" }}><span className="font-semibold">{g.icon} {g.termo}</span>{open === i ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>{open === i && <div className="px-4 py-2 text-sm rounded-b-lg" style={{ background: "#fefce8", borderLeft: "3px solid #f59e0b", color: "#78350f" }}>{g.def}</div>}</div>
    ))}</div></Card>
  );
}

// Tudo o que a busca do topo encontra: título, onde fica (grupo e detalhe), palavras extras e o destino.
const SINONIMOS_PARANA = { "Suíno": "porco", Boi: "gado arroba", Vaca: "gado arroba", "Erva-mate": "chimarrão", Mandioca: "aipim macaxeira", "Café em coco": "café", "Café beneficiado": "café" };
const DESCRICAO_ABA = {
  painel: "Moedas, ações, commodities, indicadores, combustíveis e previsão do tempo", futuros: "Contratos agrícolas nas bolsas internacionais",
  chicago: "Soja, milho, trigo e boi na Bolsa de Chicago, com vencimentos e valor em reais",
  safra: "Produção do Paraná, da região e de Santa Mariana, andamento do plantio e calendário agrícola",
  exportacoes: "Quanto o Brasil e o Paraná exportam de soja, milho, carnes e outros, e para quais países",
  clima: "Chuva que caiu e que vai cair, água no solo e risco de geada", calculadoras: "Preço da saca, conversor de unidades, relação de troca, ponto de equilíbrio e financiamento",
  aprender: "Simulação de uma safra com decisões do produtor e simulador de hedge",
  cooperativas: "Preço pago ao produtor nas regiões do Paraná, com mapa de onde está mais caro", noticias: "Agronegócio, mercado e mercado internacional",
  historico: "Comparação de qual item subiu mais e tabela de preços de 2020 a 2026", graficos: "Evolução dos preços em gráficos", glossario: "Significado dos termos do mercado",
};
const INDICE_BUSCA = [
  { titulo: "Chicago · cotações da bolsa (CBOT e CME)", detalhe: DESCRICAO_ABA.chicago, grupo: "Chicago", termos: "indices internacional vencimento", acao: { aba: "chicago" } },
  ...PRODUTOS_PARANA.map(nome => ({ titulo: `${nome} · preço por região do PR`, detalhe: "Quanto cooperativas e cerealistas pagam ao produtor (DERAL)", grupo: "Cooperativas",
    termos: `cooperativa produtor parana regiao deral ${SINONIMOS_PARANA[nome] ?? ""}`, acao: { aba: "cooperativas", produto: nome } })),
  ...COMMODITIES.map(([id, nome, mercado]) => ({ titulo: nome, detalhe: mercado === "Brasil" ? "Cotação no Brasil · Painel" : "Cotação internacional · Painel", grupo: "Painel",
    termos: mercado === "Brasil" ? "brasil" : "internacional exterior bolsa", acao: { aba: "painel", commodity: id, ancora: `commodity-${id}` } })),
  ...FUTURES.map(f => ({ titulo: `${f.name} · mercado futuro`, detalhe: `${f.exchange} · cotado em ${f.unit}`, grupo: "Futuros",
    termos: `${f.key} ${APELIDOS_FUTUROS[f.key] ?? ""} bolsa contrato internacional`, acao: { aba: "futuros", futuro: f.key, ancora: "cotacao-futuro" } })),
  ...Object.keys(CL).map(k => ({ titulo: `Gráfico de ${CL[k]}`, detalhe: "Evolução do preço de 2020 a 2026", grupo: "Gráficos",
    termos: `${k} historico evolucao`, acao: { grafico: k } })),
  ...CHICAGO.map(f => ({ titulo: `${f.name} · Bolsa de Chicago`, detalhe: "Preço, próximos vencimentos e valor em reais", grupo: "Chicago",
    termos: `${f.key} ${APELIDOS_FUTUROS[f.key] ?? ""} ${f.exchange} vencimento`, acao: { aba: "chicago", chicago: f.key, ancora: "chicago-detalhe" } })),
  ...GLOSSARIO.map((g, i) => ({ titulo: g.termo, detalhe: g.def, grupo: "Glossário", termos: `${g.def} significado`, acao: { aba: "glossario", termo: i, ancora: `glossario-${i}` } })),
  ...INIT_MOEDAS.map(m => ({ titulo: m.nome, detalhe: "Cotação em reais · Painel", grupo: "Painel", termos: "moeda", acao: { aba: "painel", ancora: "card-moedas" } })),
  ...INDICADORES.map(ind => ({ titulo: ind.nome, detalhe: ind.desc, grupo: "Painel", termos: "indicador economia juros", acao: { aba: "painel", ancora: "card-indicadores" } })),
  ...CALCULADORAS.map(c => ({ titulo: `Calculadora: ${c.nome}`, detalhe: "Faça a conta com os seus números · Calculadoras", grupo: "Calculadoras",
    termos: `calcular conta ${c.termos}`, acao: { aba: "calculadoras", calculadora: c.id, ancora: "calculadora" } })),
  { titulo: "Safra do Paraná e de Santa Mariana", detalhe: DESCRICAO_ABA.safra, grupo: "Safra", termos: "producao area rendimento produtividade colheita plantio deral ibge brasil estimativa", acao: { aba: "safra" } },
  { titulo: "Calendário agrícola do Paraná", detalhe: "Meses de plantio e colheita de cada cultura · Safra", grupo: "Safra", termos: "quando plantar colher epoca janela meses", acao: { aba: "safra" } },
  { titulo: "Exportações do agro", detalhe: DESCRICAO_ABA.exportacoes, grupo: "Exportações", termos: "exportacao embarque china destino comercio exterior porto paranagua vendas externas", acao: { aba: "exportacoes" } },
  { titulo: "Chuva e clima para a lavoura", detalhe: DESCRICAO_ABA.clima, grupo: "Clima", termos: "clima geada solo umidade previsao 15 dias seca estiagem", acao: { aba: "clima" } },
  { titulo: "Simulador de hedge", detalhe: "Trave um preço e veja o resultado se o mercado subir ou cair · Aprender", grupo: "Aprender", termos: "protecao travar preco futuro simular", acao: { aba: "aprender", ancora: "simulador-hedge" } },
  { titulo: "Simulação: uma safra na prática", detalhe: "Decida como um produtor, da semente à venda · Aprender", grupo: "Aprender", termos: "jogo atividade simulador decisao bolsa produtor quiz", acao: { aba: "aprender", ancora: "simulacao-safra" } },
  { titulo: "Comparar qual subiu mais", detalhe: "Chicago, commodities, futuros e ações no mesmo gráfico · Histórico", grupo: "Histórico",
    termos: "comparacao valorizou alta queda grafico historico", acao: { aba: "historico", ancora: "comparar-historico" } },
  { titulo: "Diesel e combustíveis no Paraná", detalhe: "Preço médio da semana nos postos (ANP) · Painel", grupo: "Painel", termos: "gasolina etanol alcool oleo diesel posto litro custo", acao: { aba: "painel", ancora: "card-combustiveis" } },
  { titulo: "Previsão do tempo", detalhe: "Temperatura e chuva dos próximos 5 dias", grupo: "Painel", termos: "temperatura", acao: { aba: "painel", ancora: "card-tempo" } },
  { titulo: "Ações e fundos da B3", detalhe: "Consultar empresas da Bolsa · Painel", grupo: "Painel", termos: "acoes bolsa empresa etf investimento", acao: { aba: "painel", ancora: "consultar-acao" } },
  ...TABS.map(t => ({ titulo: `Aba ${TAB_LABELS[t]}`, detalhe: DESCRICAO_ABA[t], grupo: "Abas", termos: DESCRICAO_ABA[t], acao: { aba: t } })),
];

export default function App() {
  const [tab, setTab] = useState("painel");
  const [clock, setClock] = useState(new Date());
  const [cd, setCd] = useState(UPDATE_SEC);
  const [paused, setPaused] = useState(false);
  const [count, setCount] = useState(0);
  const [last, setLast] = useState(null);
  const [flash, setFlash] = useState(new Set());
  const [selic, setSelic] = useState({});
  const [bcb, setBcb] = useState({}); // IPCA, INPC, IGP-M, CDI e poupança
  const [dataSource, setDataSource] = useState("aguardando");
  const [mascote, setMascote] = useMascote();

  const [moedas, setMoedas] = useState(INIT_MOEDAS);
  const [pm, setPm] = useState({});
  const [chartTarget, setChartTarget] = useState(null);
  const viewChart = useCallback((target) => { setChartTarget(target); setTab("graficos"); }, []);
  const [alvo, setAlvo] = useState(null); // destino escolhido na busca do topo
  const [perguntaCastor, setPerguntaCastor] = useState(null);
  const irPara = (acao) => {
    if (acao.castor) { setMascote(true); setPerguntaCastor({ texto: acao.castor, n: Date.now() }); return; }
    if (acao.grafico) viewChart({ type: "commodity", key: acao.grafico, name: CL[acao.grafico] });
    else setTab(acao.aba);
    setAlvo({ ...acao, n: Date.now() });
  };
  const trocarAba = (t) => { setTab(t); setAlvo(null); };
  const mostrarMascote = (v) => { setMascote(v); if (!v) setPerguntaCastor(null); };

  // leva a tela até o item escolhido na busca (ou ao começo da aba)
  useEffect(() => {
    if (!alvo) return;
    const t = setTimeout(() => document.getElementById(alvo.ancora ?? "conteudo")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    return () => clearTimeout(t);
  }, [alvo]);

  // os índices saem uma vez por mês e as taxas uma vez por dia: conferir a cada meia hora basta
  useEffect(() => {
    let ativo = true;
    const carregar = () => fetch("/api/market?type=indicadores", { signal: AbortSignal.timeout(30000) })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("indisponível"))))
      .then(d => { if (ativo) setBcb({ dados: d.indicadores }); })
      .catch(() => { if (ativo) setBcb(anterior => ({ ...anterior, erro: true })); });
    carregar();
    const t = setInterval(carregar, 30 * 60 * 1000);
    return () => { ativo = false; clearInterval(t); };
  }, []);
  const indicadores = indicadoresAtuais(bcb, selic);

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
          <div className="px-4 py-4 flex flex-col items-center text-center">
            <div className="flex items-center justify-center gap-1.5 mb-0.5"><Wheat size={14} color="#fbbf24" /><span style={{ fontSize: 10, color: "#fbbf24", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Informativo Diário</span></div>
            <h1 className="text-base font-bold text-white">Mercado Agrícola</h1>
            <div className="rounded-full border-2 border-white flex items-center justify-center shrink-0 mt-3" style={{ width: 56, height: 56, background: "radial-gradient(circle, #2E7D32 60%, #1B5E20 100%)" }}>
              <div className="text-center leading-none"><div style={{ fontSize: 6.5, color: "#fff", fontWeight: 700 }}>C.E.E.P.A.</div><div style={{ fontSize: 8, color: "#fbbf24", fontWeight: 900, marginTop: 1 }}>FERNANDO</div><div style={{ fontSize: 8, color: "#fbbf24", fontWeight: 900 }}>COSTA</div></div>
            </div>
            <div className="text-sm font-bold text-white mt-2">C.E.E.P.A. Fernando Costa</div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>Santa Mariana, PR • {new Date().toLocaleDateString("pt-BR")}</div>
            <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>Docente: <strong style={{ color: "rgba(255,255,255,0.8)" }}>{DOCENTE}</strong></div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>{ALUNOS_PARTICIPANTES.length > 1 ? "Estudantes participantes" : "Estudante participante"}: <strong style={{ color: "rgba(255,255,255,0.8)" }}>{ALUNOS_PARTICIPANTES.join(", ")}</strong></div>
          </div>
        </div>
      </div>
      <div className="sticky top-0 z-50 border-b" style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderColor: "rgba(0,0,0,0.06)" }}>
        <div className="relative max-w-4xl mx-auto px-3">
          <div className="flex items-center gap-2 sm:gap-3 py-2">
            <div className="flex items-center gap-2 shrink-0"><div className="rounded-full flex items-center justify-center" style={{ width: 26, height: 26, background: "#2E7D32" }}><span style={{ fontSize: 7, color: "#fff", fontWeight: 900 }}>CEEP</span></div><span className="text-sm font-bold" style={{ color: "#166534" }}>AgroInfo</span></div>
            <BuscaAgro itens={INDICE_BUSCA} onEscolher={irPara} comCastor={!!ASSISTENTE_URL} />
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-2 text-xs opacity-40">{count > 0 && <span className="hidden sm:flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#22c55e" }} />Ao vivo</span>}<span>{clock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div>
              <BotaoMascote visivel={mascote} onClick={() => mostrarMascote(!mascote)} />
            </div>
          </div>
          <div className="-mb-px overflow-x-auto"><div className="flex gap-0.5 w-max sm:w-auto sm:flex-wrap sm:justify-center">{TABS.map(t => { const I = TAB_ICONS[t]; return (<button key={t} onClick={() => trocarAba(t)} className="flex items-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-t-lg whitespace-nowrap" style={{ background: tab === t ? "#fff" : "transparent", color: tab === t ? "#166534" : "#94a3b8", borderBottom: tab === t ? "2px solid #166534" : "2px solid transparent" }}><I size={12} />{TAB_LABELS[t]}</button>); })}</div></div>
        </div>
      </div>
      <div id="conteudo" className="max-w-4xl mx-auto px-3 py-4" style={{ scrollMarginTop: 100 }}>
        {tab === "painel" && <CountdownBar sec={cd} total={UPDATE_SEC} paused={paused} onToggle={() => setPaused(p => !p)} onRefresh={doUpdate} count={count} last={last} source={dataSource} />}
        {tab === "painel" && <PainelTab moedas={moedas} pm={pm} flash={flash} indicadores={indicadores} refresh={count} onViewChart={viewChart} alvo={alvo} />}
        {tab === "futuros" && <FuturesQuotes key={alvo?.futuro ? alvo.n : "futuros"} inicial={alvo?.futuro} />}
        {tab === "chicago" && <BolsaChicago key={alvo?.chicago ? alvo.n : "chicago"} inicial={alvo?.chicago} dolar={dataSource === "real" ? moedas.find(m => m.id === "usd")?.valor : null} />}
        {tab === "safra" && <SafraTab />}
        {tab === "exportacoes" && <Exportacoes />}
        {tab === "clima" && <ClimaAgricola />}
        {tab === "calculadoras" && <Calculadoras key={alvo?.calculadora ? alvo.n : "calculadoras"} inicial={alvo?.calculadora} dolar={dataSource === "real" ? moedas.find(m => m.id === "usd")?.valor : null} />}
        {tab === "aprender" && <Aprender onPerguntar={ASSISTENTE_URL ? (texto => irPara({ castor: texto })) : null} />}
        {tab === "cooperativas" && <CotacoesCooperativas key={alvo?.produto ? alvo.n : "pr"} produtoInicial={alvo?.produto} />}
        {tab === "noticias" && <NoticiasTab key={alvo?.busca ? alvo.n : "noticias"} busca={alvo?.busca} />}
        {tab === "historico" && <HistoricoTab />}
        {tab === "graficos" && <GraficosTab target={chartTarget} />}
        {tab === "glossario" && <GlossarioTab key={alvo?.termo != null ? alvo.n : "glossario"} inicial={alvo?.termo} />}
      </div>
      <div className="text-center py-3 text-xs opacity-20">🎓 C.E.E.P.A. Fernando Costa — Santa Mariana, PR • Docente: {DOCENTE} • {ALUNOS_PARTICIPANTES.length > 1 ? "Estudantes participantes" : "Estudante participante"}: {ALUNOS_PARTICIPANTES.join(", ")}</div>
      {mascote && <Mascote onFechar={() => mostrarMascote(false)} assistenteUrl={ASSISTENTE_URL} pergunta={perguntaCastor} dadosPainel={{
        moedas: dataSource === "real"
          ? moedas.map(m => ({ nome: m.nome, valorReais: m.valor, variacaoPct: m.var, fonte: "AwesomeAPI" }))
          : "indisponíveis no momento",
        selic: selic.value != null ? { metaPctAoAno: selic.value, data: selic.date, fonte: selic.source } : "indisponível",
        indicadores: indicadores.filter(i => i.nome !== "Selic").map(i => ({ nome: i.nome, valor: i.valor, periodo: i.periodo, descricao: i.desc, fonte: "Banco Central" })),
        historicoAnual: { descricao: "Tabela Histórico 2020–2026 do painel (CEPEA/ESALQ, Farmnews; R$ nominais)", linhas: HISTORICO },
      }} />}
      <VisitorCounter presencaUrl={ASSISTENTE_URL} />
    </div>
  );
}
