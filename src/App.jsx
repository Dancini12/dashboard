import VisitorCounter from "./components/VisitorCounter";
import Mascote, { BotaoMascote } from "./components/Mascote";
import { EM_CONSTRUCAO as CASTOR_EM_CONSTRUCAO } from "./components/AssistenteAgro";
import useMascote from "./components/useMascote";
import Combustiveis from "./components/Combustiveis";
import Inicio from "./components/Inicio";
import { StockQuotes, CommodityQuotes } from "./components/MarketQuotes";
import { COMMODITIES, FUTURES, CALCULADORAS, APELIDOS_FUTUROS, PRODUTOS_PARANA } from "./catalogo";
import { CANAIS_AGRO } from "./canaisAgro";
import { ANO_CORRENTE_DO_HISTORICO, HISTORICO, NOMES_CURTOS_DO_HISTORICO as CL, SERIES_DO_HISTORICO, historicoCepea } from "./historico";
import { Card, SecTitle, VarBadge } from "./components/Cartao";
import { fmt, fmtInt } from "./formatos";
import BuscaAgro from "./components/BuscaAgro";
import Enfeite from "./components/Enfeite";
import { Anuncio, AvisoDeCookies } from "./components/Anuncios";
import { lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { RefreshCw, BookOpen, BarChart3, Wheat, DollarSign, ChevronDown, ChevronUp, ArrowRight, Newspaper, ExternalLink, Warehouse, Landmark, CloudRain, Calculator, GraduationCap, Sprout, Ship, House, Tv, Printer } from "lucide-react";

// O código de cada aba só é baixado quando ela é aberta: a primeira página chega mais rápido, e os
// gráficos (a parte mais pesada) vêm só com as abas que os usam.
const CotacoesCooperativas = lazy(() => import("./components/CotacoesCooperativas"));
const Bolsas = lazy(() => import("./components/Bolsas"));
const ClimaAgricola = lazy(() => import("./components/ClimaAgricola"));
const Calculadoras = lazy(() => import("./components/Calculadoras"));
const Aprender = lazy(() => import("./components/Aprender"));
const SafraTab = lazy(() => import("./components/SafraTab"));
const Exportacoes = lazy(() => import("./components/Exportacoes"));
const Jornal = lazy(() => import("./components/Jornal"));
const TvAgro = lazy(() => import("./components/TvAgro"));
const EvolucaoTab = lazy(() => import("./components/Evolucao"));

const UPDATE_SEC = 60;
// URL do App da Web do assistente (Apps Script, termina em /exec). Passo a passo em apps-script/LEIA-ME.md.
const ASSISTENTE_URL = import.meta.env.VITE_ASSISTENTE_URL
  || "https://script.google.com/macros/s/AKfycbyDYcrR3XX5bqo0rKCp1c1ZgDHf4GCHsJv7jesNPo5PEtJT6qYMLCyUV6OGmB1ur-jrBA/exec";
const API_MOEDAS_URL = "https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,GBP-BRL,ARS-BRL";
const TABS = ["inicio", "jornal", "bolsas", "cooperativas", "safra", "exportacoes", "clima", "calculadoras", "aprender", "noticias", "tv", "evolucao", "glossario"];
const TAB_LABELS = { inicio: "Resumo do dia", jornal: "Jornal do dia", bolsas: "Bolsas", cooperativas: "Cotações Cooperativas", safra: "Safra", exportacoes: "Exportações", clima: "Clima", calculadoras: "Calculadoras", aprender: "Aprender", noticias: "Notícias", tv: "TV Agro", evolucao: "Evolução", glossario: "Glossário" };
const TAB_ICONS = { inicio: House, jornal: Printer, bolsas: Landmark, cooperativas: Warehouse, safra: Sprout, exportacoes: Ship, clima: CloudRain, calculadoras: Calculator, aprender: GraduationCap, noticias: Newspaper, tv: Tv, evolucao: BarChart3, glossario: BookOpen };

const INIT_MOEDAS = [
  // valor e variação só existem depois que a fonte responde: nada de número inventado
  { id: "usd", nome: "Dólar Comercial", emoji: "💵", valor: null, var: null },
  { id: "usd_t", nome: "Dólar Turismo", emoji: "💵", valor: null, var: null },
  { id: "eur", nome: "Euro", emoji: "💶", valor: null, var: null },
  { id: "gbp", nome: "Libra Esterlina", emoji: "💷", valor: null, var: null },
  { id: "ars", nome: "Peso Argentino", emoji: "💴", valor: null, var: null },
];
// Indicadores da economia da página inicial. "chave" liga cada um à série do Banco Central em /api/market?type=indicadores;
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

// Últimos indicadores recebidos, guardados neste navegador: quando a fonte falha (como a API do Banco Central
// em outubro de 2026), o quadro mostra o último valor que chegou, avisando, em vez de "Indisponível".
const LS_INDICADORES = "agroinfo.indicadores.v1";
function indicadoresGuardados() {
  try {
    const g = JSON.parse(localStorage.getItem(LS_INDICADORES));
    if (!g || typeof g !== "object") return {};
    const antigos = Object.fromEntries(Object.entries(g.dados ?? {}).map(([k, v]) => [k, { ...v, antigo: true }]));
    return { dados: Object.keys(antigos).length ? antigos : undefined, selic: g.selic ? { ...g.selic, antigo: true } : undefined };
  } catch { return {}; }
}
function guardarIndicadores(parte) {
  try {
    const atual = JSON.parse(localStorage.getItem(LS_INDICADORES)) ?? {};
    localStorage.setItem(LS_INDICADORES, JSON.stringify({ ...atual, ...parte }));
  } catch { /* sem storage: só não guarda */ }
}
// para guardar: tira a marca de antigo (o valor guardado continua valendo como o último recebido)
const semAntigo = dados => Object.fromEntries(Object.entries(dados).filter(([, v]) => v).map(([k, v]) => [k, { valor: v.valor, data: v.data, ...(v.fonte && { fonte: v.fonte }) }]));

// Junta a lista acima com o que chegou do Banco Central (bcb.dados) e com a Selic.
function indicadoresAtuais(bcb, selic) {
  return INDICADORES.map(ind => {
    if (ind.nome === "Selic") return {
      ...ind, valor: selic.value != null ? `${fmt(selic.value)}% a.a.` : selic.error ? "Indisponível" : "Carregando…",
      periodo: selic.date, desc: selic.error || selic.antigo ? (selic.value != null ? "Último valor recebido; nova tentativa automática" : "Banco Central indisponível; nova tentativa automática") : "Meta BC · atualização automática",
    };
    const dado = bcb.dados?.[ind.chave];
    if (!dado) return { ...ind, periodo: "", valor: bcb.dados || bcb.erro ? "Indisponível" : "Carregando…" };
    const em12Meses = ind.chave === "ipca" && bcb.dados.ipca12 ? ` · 12 meses: ${fmt(bcb.dados.ipca12.valor)}%` : "";
    const aviso = dado.antigo ? " · último valor recebido" : dado.fonte === "IBGE" ? " · direto do IBGE" : "";
    return { ...ind, periodo: periodoDe(dado.data, ind.sinal), valor: `${ind.sinal && dado.valor > 0 ? "+" : ""}${fmt(dado.valor)}${ind.sufixo}`, desc: `${ind.desc}${em12Meses}${aviso}` };
  });
}
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



function PriceRow({ emoji, nome, sub, valor, prev, varPct, unidade, flash, alt, semValor = "…" }) {
  if (valor == null) return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: alt ? "#f0f7ff" : "transparent" }}>
      <div className="flex items-center gap-1.5 min-w-0"><span className="text-sm shrink-0">{emoji}</span><span className="text-sm font-semibold truncate">{nome}</span></div>
      <span className="text-xs opacity-50">{semValor}</span>
    </div>
  );
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

// Cartões de moedas e de indicadores da economia, mostrados no fim da página inicial.
function MoedasCard({ moedas, pm, flash, situacao, atualizadoEm }) {
  return (
    <Card id="card-moedas" className="p-3"><SecTitle icon={DollarSign} title="Moedas" color="#1a5276" />{moedas.map((m, i) => <PriceRow key={m.id} emoji={m.emoji} nome={m.nome} valor={m.valor} prev={pm[m.id]} varPct={m.var} flash={flash.has(m.id)} alt={i % 2 === 0} semValor={situacao === "indisponivel" ? "indisponível agora" : "buscando…"} />)}<div className="mt-2 text-xs opacity-50 text-right">{situacao === "desatualizado" ? `🟡 A fonte não respondeu agora: valores das ${atualizadoEm}` : situacao === "indisponivel" ? "🟡 Fonte das moedas indisponível agora" : atualizadoEm ? `Atualizado às ${atualizadoEm} · nova consulta a cada 60 segundos` : "Buscando as cotações…"} · Fonte: AwesomeAPI</div></Card>
  );
}
function IndicadoresCard({ indicadores }) {
  return (
    <Card id="card-indicadores" className="p-3"><SecTitle icon={BarChart3} title="Indicadores Econômicos" color="#6b21a8" /><div className="grid grid-cols-2 md:grid-cols-3 gap-2">{indicadores.map((ind, i) => (<div key={i} className="rounded-lg p-2 text-center" style={{ background: i % 2 === 0 ? "#faf5ff" : "#f5f3ff" }}><div className="text-xs font-semibold opacity-60">{ind.nome} {ind.periodo && `(${ind.periodo})`}</div><div className="text-base font-bold" style={{ color: "#6b21a8" }}>{ind.valor}</div><div className="text-xs opacity-40">{ind.desc}</div></div>))}</div><div className="mt-2 text-xs opacity-50 text-right">Fonte: Banco Central (SGS e decisões do Copom), com dados do IBGE e da FGV; IPCA e INPC direto do IBGE quando o Banco Central não responde · atualização automática</div></Card>
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

  // primeira busca logo depois de montar (fora do corpo do efeito, que não deve mudar estado direto)
  useEffect(() => {
    const t = setTimeout(fetchNews, 0);
    return () => clearTimeout(t);
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
  inicio: "O dia em uma página: cotações, tempo da sua cidade, lavouras, notícias, moedas, indicadores da economia e atalhos para a aula",
  jornal: "O resumo do dia em formato de jornal, em uma folha só, para imprimir, salvar em PDF ou guardar como imagem",
  bolsas: "Soja, milho, café, boi e mais nas bolsas de Chicago e Nova Iorque, com vencimentos e valor em reais, e as ações da B3",
  safra: "Produção do Paraná, da região e de Santa Mariana, andamento do plantio e calendário agrícola",
  exportacoes: "Quanto o Brasil e o Paraná exportam de soja, milho, carnes e outros, para quais países, e o que o Brasil vende e compra de cada país",
  clima: "Previsão do tempo de agora e dos próximos dias, chuva que caiu e que vai cair, água no solo e risco de geada", calculadoras: "Preço da saca, conversor de unidades, relação de troca, ponto de equilíbrio e financiamento",
  aprender: "Simulação de uma safra com decisões do produtor e simulador de hedge",
  cooperativas: "Preço pago ao produtor nas regiões do Paraná, indicadores de preço do Brasil e combustíveis", noticias: "Agronegócio, mercado e mercado internacional",
  tv: "Canais de TV do agro ao vivo e os vídeos recentes de cada um, pelo YouTube",
  evolucao: "Comparação de qual item subiu mais, gráficos e tabela de preços de 2020 a 2026", glossario: "Significado dos termos do mercado",
};
const INDICE_BUSCA = [
  { titulo: "Chicago e Nova Iorque · cotações das bolsas", detalhe: DESCRICAO_ABA.bolsas, grupo: "Bolsas", termos: "indices internacional vencimento cbot cme ice mercado futuro futuros contratos", acao: { aba: "bolsas" } },
  ...PRODUTOS_PARANA.map(nome => ({ titulo: `${nome} · preço por região do PR`, detalhe: "Quanto cooperativas e cerealistas pagam ao produtor (DERAL)", grupo: "Cooperativas",
    termos: `cooperativa produtor parana regiao deral ${SINONIMOS_PARANA[nome] ?? ""}`, acao: { aba: "cooperativas", produto: nome } })),
  ...COMMODITIES.map(([id, nome, mercado]) => ({ titulo: nome, detalhe: mercado === "Brasil" ? "Indicador de preço no Brasil · Cotações Cooperativas" : "Cotação internacional · Cotações Cooperativas", grupo: "Cooperativas",
    termos: mercado === "Brasil" ? "brasil indicador cepea" : "internacional exterior bolsa", acao: { aba: "cooperativas", commodity: id, ancora: `commodity-${id}` } })),
  ...FUTURES.map(f => ({ titulo: `${f.name} · ${f.exchange === "ICE US" ? "Bolsa de Nova Iorque" : "Bolsa de Chicago"}`, detalhe: `Cotado em ${f.unit} · preço, vencimentos e valor em reais`, grupo: "Bolsas",
    termos: `${f.key} ${APELIDOS_FUTUROS[f.key] ?? ""} ${f.exchange} contrato internacional mercado futuro vencimento`, acao: { aba: "bolsas", contrato: f.key, ancora: "bolsa-detalhe" } })),
  ...Object.keys(CL).map(k => ({ titulo: `Gráfico de ${CL[k]}`, detalhe: `Evolução do preço de ${HISTORICO[0].ano} a ${HISTORICO.at(-1).ano}`, grupo: "Evolução",
    termos: `${k} historico evolucao`, acao: { grafico: k } })),
  ...GLOSSARIO.map((g, i) => ({ titulo: g.termo, detalhe: g.def, grupo: "Glossário", termos: `${g.def} significado`, acao: { aba: "glossario", termo: i, ancora: `glossario-${i}` } })),
  ...INIT_MOEDAS.map(m => ({ titulo: m.nome, detalhe: "Cotação em reais · Resumo do dia", grupo: "Resumo do dia", termos: "moeda cambio", acao: { aba: "inicio", ancora: "card-moedas" } })),
  ...INDICADORES.map(ind => ({ titulo: ind.nome, detalhe: ind.desc, grupo: "Resumo do dia", termos: "indicador economia juros", acao: { aba: "inicio", ancora: "card-indicadores" } })),
  ...CALCULADORAS.map(c => ({ titulo: `Calculadora: ${c.nome}`, detalhe: "Faça a conta com os seus números · Calculadoras", grupo: "Calculadoras",
    termos: `calcular conta ${c.termos}`, acao: { aba: "calculadoras", calculadora: c.id, ancora: "calculadora" } })),
  { titulo: "Safra do Paraná e de Santa Mariana", detalhe: DESCRICAO_ABA.safra, grupo: "Safra", termos: "producao area rendimento produtividade colheita plantio deral ibge brasil estimativa", acao: { aba: "safra" } },
  { titulo: "Calendário agrícola do Paraná", detalhe: "Meses de plantio e colheita de cada cultura · Safra", grupo: "Safra", termos: "quando plantar colher epoca janela meses", acao: { aba: "safra" } },
  { titulo: "Exportações do agro", detalhe: DESCRICAO_ABA.exportacoes, grupo: "Exportações", termos: "exportacao embarque china destino comercio exterior porto paranagua vendas externas", acao: { aba: "exportacoes" } },
  { titulo: "Comércio do agro com um país", detalhe: "Digite o país e veja o que o Brasil vende para ele e compra dele · Exportações", grupo: "Exportações",
    termos: "pais importacao importa importacoes compra vende parceiro comercial balanca saldo adubo fertilizante china estados unidos argentina russia", acao: { aba: "exportacoes", ancora: "comercio-pais" } },
  { titulo: "Chuva e clima para a lavoura", detalhe: DESCRICAO_ABA.clima, grupo: "Clima", termos: "clima geada solo umidade previsao 15 dias seca estiagem", acao: { aba: "clima" } },
  { titulo: "Simulador de hedge", detalhe: "Trave um preço e veja o resultado se o mercado subir ou cair · Aprender", grupo: "Aprender", termos: "protecao travar preco futuro simular", acao: { aba: "aprender", ancora: "simulador-hedge" } },
  { titulo: "Simulação: uma safra na prática", detalhe: "Decida como um produtor, da semente à venda · Aprender", grupo: "Aprender", termos: "jogo atividade simulador decisao bolsa produtor quiz", acao: { aba: "aprender", ancora: "simulacao-safra" } },
  { titulo: "Comparar qual subiu mais", detalhe: "Chicago, Nova Iorque, commodities do Brasil e ações no mesmo gráfico · Evolução", grupo: "Evolução",
    termos: "comparacao valorizou alta queda grafico historico", acao: { aba: "evolucao", ancora: "comparar-historico" } },
  { titulo: "Diesel e combustíveis no Paraná", detalhe: "Preço médio da semana nos postos (ANP) · Cotações Cooperativas", grupo: "Cooperativas", termos: "gasolina etanol alcool oleo diesel posto litro custo", acao: { aba: "cooperativas", ancora: "card-combustiveis" } },
  { titulo: "Previsão do tempo", detalhe: "O tempo agora, os próximos 7 dias e cada dia por período · Clima", grupo: "Clima", termos: "temperatura hoje amanha semana hora vento umidade sensacao cidade", acao: { aba: "clima" } },
  { titulo: "Ações e fundos da B3", detalhe: "Consultar empresas da Bolsa brasileira · Bolsas", grupo: "Bolsas", termos: "acoes bolsa empresa etf investimento b3", acao: { aba: "bolsas", ancora: "consultar-acao" } },
  ...CANAIS_AGRO.filter(c => c.channelId).map(c => ({ titulo: `${c.nome} · ao vivo`, detalhe: `${c.descricao} · TV Agro`, grupo: "TV Agro",
    termos: "tv televisao canal assistir video programa transmissao youtube", acao: { aba: "tv", canal: c.id } })),
  ...TABS.map(t => ({ titulo: `Aba ${TAB_LABELS[t]}`, detalhe: DESCRICAO_ABA[t], grupo: "Abas", termos: `${DESCRICAO_ABA[t]}${t === "inicio" ? " inicio pagina inicial" : t === "jornal" ? " impressao foto captura de tela compartilhar" : ""}`, acao: { aba: t } })),
];

// Cada aba tem endereço próprio (…/#tv, …/#exportacoes), para mandar o link de uma aba e para o
// botão "voltar" do navegador andar entre as abas. A página inicial fica sem nada depois do endereço.
const abaDoEndereco = () => { const nome = window.location.hash.slice(1); return TABS.includes(nome) ? nome : "inicio"; };
const TITULO_DO_SITE = document.title;

export default function App() {
  const [tab, setTab] = useState(abaDoEndereco);
  const [clock, setClock] = useState(new Date());
  const [count, setCount] = useState(0);
  const [moedasEm, setMoedasEm] = useState(null); // hora da última resposta da fonte das moedas
  const [flash, setFlash] = useState(new Set());
  // começam com o último valor guardado neste navegador (marcado como antigo) até a fonte responder
  const [selic, setSelic] = useState(() => indicadoresGuardados().selic ?? {});
  const [bcb, setBcb] = useState(() => ({ dados: indicadoresGuardados().dados })); // IPCA, INPC, IGP-M, CDI e poupança
  const [dataSource, setDataSource] = useState("aguardando");
  const [mascote, setMascote] = useMascote();

  const [moedas, setMoedas] = useState(INIT_MOEDAS);
  const [pm, setPm] = useState({});
  const [chartTarget, setChartTarget] = useState(null);
  const [alvo, setAlvo] = useState(null); // destino escolhido na busca do topo ou em um atalho
  const viewChart = useCallback((target) => {
    setChartTarget(target); setTab("evolucao");
    setAlvo({ ancora: target.type === "stock" ? "grafico-acoes" : "grafico-commodities", n: Date.now() });
  }, []);
  const [perguntaCastor, setPerguntaCastor] = useState(null);
  const irPara = (acao) => {
    if (acao.castor) { setMascote(true); setPerguntaCastor({ texto: acao.castor, n: Date.now() }); return; }
    if (acao.grafico) { viewChart({ type: "commodity", key: acao.grafico, name: CL[acao.grafico] }); return; }
    setTab(acao.aba);
    setAlvo({ ...acao, n: Date.now() });
  };
  const trocarAba = (t) => { setTab(t); setAlvo(null); };
  // a aba aberta vai para o endereço e para o título da página…
  useEffect(() => {
    if (abaDoEndereco() !== tab) window.history.pushState(null, "", tab === "inicio" ? window.location.pathname + window.location.search : `#${tab}`);
    document.title = tab === "inicio" ? TITULO_DO_SITE : `${TAB_LABELS[tab]} · AgroInfo`;
  }, [tab]);
  // …e "voltar", "avançar" ou um link para outra aba trocam a aba
  useEffect(() => {
    const aoMudarOEndereco = () => { setTab(abaDoEndereco()); setAlvo(null); };
    window.addEventListener("popstate", aoMudarOEndereco);
    window.addEventListener("hashchange", aoMudarOEndereco);
    return () => { window.removeEventListener("popstate", aoMudarOEndereco); window.removeEventListener("hashchange", aoMudarOEndereco); };
  }, []);
  const mostrarMascote = (v) => { setMascote(v); if (!v) setPerguntaCastor(null); };

  // leva a tela até o item escolhido na busca (ou ao começo da aba)
  useEffect(() => {
    if (!alvo) return;
    const ir = () => document.getElementById(alvo.ancora ?? "conteudo")?.scrollIntoView({ behavior: "smooth", block: "start" });
    const primeira = setTimeout(ir, 150);
    if (!alvo.ancora) return () => clearTimeout(primeira);
    // as tabelas acima do destino chegam depois e o empurram para baixo: acompanha por alguns
    // segundos, até a pessoa mexer na tela
    const observador = new ResizeObserver(ir);
    observador.observe(document.getElementById("conteudo"));
    const parar = () => observador.disconnect();
    const limite = setTimeout(parar, 8000);
    const gestos = ["wheel", "touchstart", "keydown", "mousedown"];
    gestos.forEach(gesto => window.addEventListener(gesto, parar, { passive: true }));
    return () => { clearTimeout(primeira); clearTimeout(limite); parar(); gestos.forEach(gesto => window.removeEventListener(gesto, parar)); };
  }, [alvo]);

  // os índices saem uma vez por mês e as taxas uma vez por dia: conferir a cada meia hora basta
  useEffect(() => {
    let ativo = true;
    const carregar = () => fetch("/api/market?type=indicadores", { signal: AbortSignal.timeout(30000) })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("indisponível"))))
      .then(d => {
        if (!ativo) return;
        // o que não veio agora fica com o último valor recebido, avisando
        const guardados = indicadoresGuardados().dados ?? {};
        const novos = Object.fromEntries(Object.entries(d.indicadores ?? {}).filter(([, v]) => v));
        guardarIndicadores({ dados: { ...semAntigo(guardados), ...novos } });
        setBcb({ dados: { ...guardados, ...novos } });
      })
      .catch(() => { if (ativo) setBcb(anterior => ({ ...anterior, erro: true })); });
    carregar();
    const t = setInterval(carregar, 30 * 60 * 1000);
    return () => { ativo = false; clearInterval(t); };
  }, []);
  const indicadores = indicadoresAtuais(bcb, selic);

  // último dólar comercial recebido da fonte (null enquanto ela não respondeu): usado nas conversões das outras abas
  const dolar = moedas.find(m => m.id === "usd")?.valor ?? null;

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
      if (sRes.status === 'fulfilled') { setSelic({ ...sRes.value, error: false }); guardarIndicadores({ selic: sRes.value }); }
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
    } catch { /* sem resposta: ficam os valores da última consulta, se houver */ }

    // "real": acabou de chegar; "desatualizado": a fonte falhou agora, mas já respondeu antes; "indisponivel": nunca respondeu
    setDataSource(anterior => (realM ? "real" : anterior === "real" || anterior === "desatualizado" ? "desatualizado" : "indisponivel"));
    if (realM) setMoedas(curM.map(m => {
      const r = realM[m.id];
      if (!r) return m;
      if (m.valor != null && Math.abs(r.valor - m.valor) > 0.0001) fl.add(m.id);
      return { ...m, valor: r.valor, var: r.var };
    }));
    setFlash(fl);
    setTimeout(() => setFlash(new Set()), 2500);
    setCount(c => c + 1);
    if (realM) setMoedasEm(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    updating.current = false;
  }, []);

  useEffect(() => { doUpdate(); }, [doUpdate]);

  // moedas e Selic: nova consulta a cada minuto; o relógio do topo anda a cada segundo
  useEffect(() => {
    const t = setInterval(doUpdate, UPDATE_SEC * 1000);
    return () => clearInterval(t);
  }, [doUpdate]);
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // data do cabeçalho, como na primeira página de um jornal: "Quarta-feira, 14 de outubro de 2026"
  const dataPorExtenso = clock.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).replace(/^./, letra => letra.toUpperCase());

  return (
    <div className="min-h-screen print:min-h-0 print:!bg-none print:!bg-white" style={{ background: "linear-gradient(180deg,#f8fafc 0%,#ecfdf5 50%,#f0f9ff 100%)", color: "#0f172a" }}>
      {/* Formato de jornal (classe "jornal", regras em src/index.css) com as cores do campo: cabeçalho como o
          título de um jornal, em verde, com o enfeite (losango do meio cor de trigo), o nome em letras grandes
          e a data entre dois fios.
          Na impressão (aba Jornal do dia) sai só o conteúdo: cabeçalho, menu, rodapé, mascote e contador ficam de fora. */}
      <header className="jornal max-w-4xl mx-auto px-3 pt-4 print:hidden">
        <Enfeite cor="#166534" destaque="#d4a017" />
        <h1 className="text-center font-bold uppercase" style={{ fontSize: "min(64px, 6.9vw)", lineHeight: 1.2, padding: "2px 0 4px", color: "#14532d" }}>Informativo Agrícola</h1>
        <div className="flex items-center justify-center gap-2 py-1.5 text-xs sm:text-sm" style={{ borderTop: "1px solid #166534", borderBottom: "4px solid #166534", color: "#14532d" }}><Wheat size={14} color="#ca8a04" aria-hidden="true" />{dataPorExtenso}<Wheat size={14} color="#ca8a04" aria-hidden="true" /></div>
      </header>
      <nav className="jornal sticky top-0 z-50 print:hidden" style={{ background: "rgba(255,255,255,0.94)", backdropFilter: "blur(12px)", borderBottom: "1px solid #bbf7d0" }}>
        <div className="relative max-w-4xl mx-auto px-3">
          <div className="flex items-center gap-2 sm:gap-3 py-2">
            <span className="shrink-0 font-bold" style={{ fontFamily: '"Times New Roman", Times, Georgia, serif', fontSize: 18, letterSpacing: "-0.01em", color: "#166534" }}>AgroInfo</span>
            <BuscaAgro itens={INDICE_BUSCA} onEscolher={irPara} comCastor={!!ASSISTENTE_URL && !CASTOR_EM_CONSTRUCAO} />
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-2 text-xs" style={{ color: "#64748b" }}>{count > 0 && <span className="hidden sm:flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#22c55e" }} />Ao vivo</span>}<span>{clock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div>
              <BotaoMascote visivel={mascote} onClick={() => mostrarMascote(!mascote)} />
            </div>
          </div>
          <div className="-mb-px overflow-x-auto"><div className="flex gap-0.5 w-max sm:w-auto sm:flex-wrap sm:justify-center">{TABS.map(t => { const I = TAB_ICONS[t]; return (<button key={t} onClick={() => trocarAba(t)} className="flex items-center gap-1 px-2.5 py-2 text-xs whitespace-nowrap" style={{ color: tab === t ? "#166534" : "#475569", fontWeight: 700, borderBottom: tab === t ? "3px solid #166534" : "3px solid transparent" }}><I size={12} />{TAB_LABELS[t]}</button>); })}</div></div>
        </div>
      </nav>
      <div id="conteudo" className="jornal max-w-4xl mx-auto px-3 py-4 print:max-w-none print:p-0" style={{ scrollMarginTop: 100 }}>
        <Suspense fallback={<p className="py-12 text-center text-sm text-slate-500">Carregando a aba…</p>}>
        {tab === "inicio" && <Inicio onIr={irPara} onCastor={ASSISTENTE_URL && !CASTOR_EM_CONSTRUCAO ? () => mostrarMascote(true) : null}
          dolar={dolar ?? (dataSource === "indisponivel" ? null : undefined)} variacaoDoDolar={dataSource === "real" ? moedas.find(m => m.id === "usd")?.var : null}>
          <MoedasCard moedas={moedas} pm={pm} flash={flash} situacao={dataSource} atualizadoEm={moedasEm} />
          <IndicadoresCard indicadores={indicadores} />
        </Inicio>}
        {tab === "jornal" && <Jornal dolar={dolar ?? (dataSource === "indisponivel" ? null : undefined)} variacaoDoDolar={dataSource === "real" ? moedas.find(m => m.id === "usd")?.var : null}
          moedas={moedas} indicadores={indicadores} />}
        {tab === "bolsas" && <Bolsas key={alvo?.contrato ? alvo.n : "bolsas"} inicial={alvo?.contrato} dolar={dolar}>
          <StockQuotes key={alvo?.acao ? alvo.n : "acoes"} buscaInicial={alvo?.acao} refresh={count} onViewChart={viewChart} onCommodity={termo => irPara({ aba: "cooperativas", buscaCommodity: termo, ancora: "consultar-commodity" })} />
        </Bolsas>}
        {tab === "safra" && <SafraTab />}
        {tab === "exportacoes" && <Exportacoes />}
        {tab === "clima" && <ClimaAgricola key={alvo?.cidade ? alvo.n : "clima"} cidadeInicial={alvo?.cidade ?? null} />}
        {tab === "calculadoras" && <Calculadoras key={alvo?.calculadora ? alvo.n : "calculadoras"} inicial={alvo?.calculadora} dolar={dolar} />}
        {tab === "aprender" && <Aprender onPerguntar={ASSISTENTE_URL && !CASTOR_EM_CONSTRUCAO ? (texto => irPara({ castor: texto })) : null} />}
        {tab === "cooperativas" && <CotacoesCooperativas key={alvo?.produto ? alvo.n : "pr"} produtoInicial={alvo?.produto}>
          <CommodityQuotes key={alvo?.commodity || alvo?.buscaCommodity ? alvo.n : "commodities"} adicionar={alvo?.commodity} buscaInicial={alvo?.buscaCommodity} refresh={count} onViewChart={viewChart} />
          <Combustiveis />
        </CotacoesCooperativas>}
        {tab === "noticias" && <NoticiasTab key={alvo?.busca ? alvo.n : "noticias"} busca={alvo?.busca} />}
        {tab === "tv" && <TvAgro key={alvo?.canal ? alvo.n : "tv"} inicial={alvo?.canal} />}
        {tab === "evolucao" && <EvolucaoTab target={chartTarget} />}
        {tab === "glossario" && <GlossarioTab key={alvo?.termo != null ? alvo.n : "glossario"} inicial={alvo?.termo} />}
        </Suspense>
        {/* espaço de anúncio no fim da aba (fora da TV, que é só vídeo, e da folha do Jornal, que é para imprimir) */}
        {tab !== "tv" && tab !== "jornal" && <Anuncio key={tab} />}
      </div>
      <footer className="jornal max-w-4xl mx-auto px-3 print:hidden">
        <p className="text-center py-3 text-xs" style={{ borderTop: "1px solid #166534", color: "#64748b" }}>Informativo Agrícola · agronahora.com.br · <a href="/sobre" className="underline">Sobre e contato</a> · <a href="/privacidade" className="underline">Política de privacidade</a></p>
      </footer>
      {/* o mascote e o contador continuam com a letra e o visual de antes */}
      <div className="print:hidden" style={{ fontFamily: "system-ui, sans-serif" }}>
        {mascote && <Mascote onFechar={() => mostrarMascote(false)} assistenteUrl={ASSISTENTE_URL} pergunta={perguntaCastor} dadosPainel={{
          moedas: dataSource === "real"
            ? moedas.map(m => ({ nome: m.nome, valorReais: m.valor, variacaoPct: m.var, fonte: "AwesomeAPI" }))
            : "indisponíveis no momento",
          selic: selic.value != null ? { metaPctAoAno: selic.value, data: selic.date, fonte: selic.source } : "indisponível",
          indicadores: indicadores.filter(i => i.nome !== "Selic").map(i => ({ nome: i.nome, valor: i.valor, periodo: i.periodo, descricao: i.desc, fonte: "Banco Central" })),
          historicoAnual: {
            descricao: `Médias anuais dos indicadores do CEPEA/ESALQ em R$ nominais; ${ANO_CORRENTE_DO_HISTORICO} é a média de 1º de janeiro até ${historicoCepea.ultimoDia}`,
            unidades: Object.fromEntries(Object.entries(SERIES_DO_HISTORICO).map(([chave, serie]) => [chave, `${serie.nome}, ${serie.unidade}`])),
            ultimoPreco: Object.fromEntries(Object.entries(SERIES_DO_HISTORICO).map(([chave, serie]) => [chave, serie.ultimo])),
            linhas: HISTORICO,
          },
        }} />}
        <VisitorCounter presencaUrl={ASSISTENTE_URL} />
        <AvisoDeCookies />
      </div>
    </div>
  );
}
