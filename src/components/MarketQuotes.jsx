import { useEffect, useState } from 'react';

async function fetchMarket(params, signal) {
  const response = await fetch(`/api/market?${new URLSearchParams(params)}`, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Fonte indisponível.');
  return data;
}

function readPreference(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function savePreference(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* armazenamento opcional */ }
}

export const TICKER_RE = /^[A-Z]{4}\d{1,2}$/;

// Nomes de commodities digitados no campo de ações: a busca da Bolsa devolveria empresas
// e fundos com esse nome (ex.: "soja" → SOJA3), não o preço da commodity.
const COMMODITY_RE = /\b(soja|milho|cafe|boi|trigo|feijao|algodao|leite|laranja|cacau|acucar|etanol|suino|arroz|mandioca|sorgo|commodit)/;
const semAcento = texto => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const EVENTO_BUSCAR_COMMODITY = 'agroinfo:buscar-commodity';

export function StockQuotes({ refresh, onViewChart }) {
  const [symbol, setSymbol] = useState(() => {
    const saved = readPreference('agroinfo.stock.v1', 'PETR4');
    return typeof saved === 'string' && TICKER_RE.test(saved) ? saved : 'PETR4';
  });
  const [input, setInput] = useState(symbol);
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [validation, setValidation] = useState('');
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState({});

  useEffect(() => {
    const controller = new AbortController();
    fetchMarket({ type: 'stock', symbol }, controller.signal).then(quote => {
      setState({ quote, symbol, error: '' });
    }).catch(error => {
      if (!controller.signal.aborted) setState(previous => ({ ...previous, symbol, error: error.message }));
    });
    return () => controller.abort();
  }, [symbol, refresh, retry]);

  const term = input.trim();
  const showDropdown = term.length >= 2 && !TICKER_RE.test(term.toUpperCase());
  const commodityDigitada = showDropdown ? semAcento(term).match(COMMODITY_RE)?.[1] : null;
  const irParaCommodity = () => {
    window.dispatchEvent(new CustomEvent(EVENTO_BUSCAR_COMMODITY, { detail: term }));
    document.getElementById('consultar-commodity')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (!showDropdown) return;
    const controller = new AbortController();
    const t = setTimeout(() => {
      setSearching(true);
      fetchMarket({ type: 'search', q: term }, controller.signal)
        .then(data => setSuggestions(data.results || []))
        .catch(() => { if (!controller.signal.aborted) setSuggestions([]); })
        .finally(() => setSearching(false));
    }, 350);
    return () => { clearTimeout(t); controller.abort(); };
  }, [term, showDropdown]);

  const pick = (sym, name) => {
    setSuggestions([]); setValidation('');
    setInput(name ? `${sym} · ${name}` : sym);
    setSymbol(sym); setRetry(n => n + 1);
    savePreference('agroinfo.stock.v1', sym);
  };

  const quote = state.quote?.symbol === symbol ? state.quote : null;

  return <section className="rounded-xl border bg-white p-3 shadow-sm">
    <h2 className="text-sm font-bold text-blue-900 mb-3">Consultar ação ou ETF da B3</h2>
    <form onSubmit={event => {
      event.preventDefault();
      const raw = input.trim();
      const upper = raw.toUpperCase();
      if (TICKER_RE.test(upper)) { pick(upper, ''); return; }
      if (commodityDigitada) { irParaCommodity(); return; } // preço de commodity não é ação
      if (suggestions.length) { pick(suggestions[0].symbol, suggestions[0].name); return; }
      setValidation('Digite o nome da empresa (ex.: Petrobras) e escolha uma sugestão, ou informe o código (ex.: PETR4).');
    }} className="flex flex-wrap gap-2 relative">
      <label className="flex-1 min-w-0 text-xs">Empresa ou código
        <input
          className="block w-full border rounded-lg p-2 mt-1 text-sm"
          value={input}
          onChange={e => { setInput(e.target.value); setValidation(''); }}
          placeholder="Ex.: Petrobras ou PETR4"
          autoComplete="off"
        />
        {showDropdown && (searching || suggestions.length > 0 || commodityDigitada) && (
          <div className="absolute left-0 right-0 mt-1 bg-white border rounded-lg shadow-md z-10 max-h-72 overflow-auto">
            {commodityDigitada && (
              <div className="p-2 text-xs border-b" style={{ background: '#fffbeb', color: '#78350f' }}>
                Procurando o preço de <strong>{term}</strong>? Este campo é para ações e fundos da Bolsa; a busca mostra
                empresas com esse nome, não o preço da commodity. O preço está em "Consultar commodity", logo abaixo, e
                na aba "Cotações Cooperativas".
                <button type="button" onClick={irParaCommodity} className="mt-1.5 block rounded-lg bg-green-800 px-2 py-1 font-bold text-white">
                  Ver {term} em Consultar commodity
                </button>
              </div>
            )}
            {searching && <div className="p-2 text-xs text-slate-500">Buscando…</div>}
            {!searching && suggestions.map(s => (
              <button key={s.symbol} type="button" onClick={() => pick(s.symbol, s.name)}
                className="block w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 border-b last:border-b-0">
                <span className="font-bold">{s.symbol}</span> · {s.name}
                {s.restrito && <span className="ml-1 rounded bg-slate-100 px-1 text-slate-500">precisa de chave</span>}
              </button>
            ))}
          </div>
        )}
      </label>
      <button className="self-end rounded-lg bg-blue-900 text-white p-2 text-sm" type="submit">Consultar</button>
    </form>

    <div aria-live="polite" className="mt-3 text-sm">
      {validation && <p role="alert" className="text-red-700">{validation}</p>}
      {state.symbol !== symbol && <p>Buscando {symbol}…</p>}
      {state.symbol === symbol && state.error && <p role="alert" className="text-amber-800">{state.error}{quote ? ' Última cotação recebida mantida abaixo; atualização pendente.' : ''}</p>}
      {quote && <div className="mt-2 rounded-lg bg-blue-50 p-3">
        <p className="font-semibold">{quote.symbol} · {quote.name}</p>
        <p className="text-xl font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: quote.currency }).format(quote.value)}</p>
        {Number.isFinite(quote.change) && <p>Variação: {quote.change.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</p>}
        <p className="text-xs text-slate-600">{quote.source} · Cotação de {new Date(quote.date).toLocaleString('pt-BR')}</p>
        {onViewChart && <button type="button" onClick={() => onViewChart({ type: 'stock', symbol: quote.symbol, name: quote.name })}
          className="mt-2 text-xs font-bold text-blue-900 underline">Ver gráfico desde 2020</button>}
      </div>}
    </div>
    <p className="mt-2 text-xs text-slate-500">Digite o nome da empresa e escolha uma sugestão da lista, ou informe o código diretamente.</p>
  </section>;
}

const COMMODITIES = [
  ['26', 'Soja · Paraná', 'Brasil'], ['121', 'Soja · Paranaguá', 'Brasil'],
  ['91', 'Milho · ESALQ/B3', 'Brasil'], ['12', 'Boi gordo · ESALQ/B3', 'Brasil'],
  ['29', 'Café arábica · CEPEA', 'Brasil'], ['31', 'Café robusta · CEPEA', 'Brasil'],
  ['211', 'Trigo · CEPEA', 'Brasil'], ['210', 'Suíno vivo · CEPEA', 'Brasil'],
  ['155', 'Leite · produtor', 'Brasil'], ['84', 'Algodão · CEPEA', 'Brasil'],
  ['288', 'Feijão carioca · CEPEA/CNA', 'Brasil'], ['201', 'Laranja · indústria', 'Brasil'],
  ['23', 'Soja · Chicago', 'Internacional'], ['10', 'Milho · Chicago', 'Internacional'],
  ['78', 'Trigo · Chicago', 'Internacional'], ['4', 'Café · Nova Iorque', 'Internacional'],
  ['5', 'Café · Londres', 'Internacional'], ['55', 'Algodão · Nova Iorque', 'Internacional'],
  ['53', 'Cacau · Nova Iorque', 'Internacional'], ['13', 'Suco de laranja · Nova Iorque', 'Internacional'],
];

// Liga cada commodity da lista de cotação à série histórica anual (2020-2026) exibida em Gráficos.
const COMMODITY_HISTORY_KEY = {
  '26': 'soja', '121': 'soja', '91': 'milho', '12': 'boi',
  '29': 'cafe', '31': 'cafe', '211': 'trigo', '155': 'leite', '288': 'feijao',
};

const FUTURES = [
  { key: 'milho', name: 'Milho', emoji: '🌽', symbol: 'ZC=F', exchange: 'CBOT', unit: 'US¢/bushel', b3: 'CCM — Milho B3', explanation: 'O CCM brasileiro é cotado em reais por saca de 60 kg. Chicago é uma referência internacional e pode divergir conforme região, safra, câmbio e frete.' },
  { key: 'soja', name: 'Soja', emoji: '🌱', symbol: 'ZS=F', exchange: 'CBOT', unit: 'US¢/bushel', b3: 'SJC — Soja CME/B3', explanation: 'Câmbio, prêmio portuário, localização e frete explicam a diferença entre Chicago e o preço em reais por saca.' },
  { key: 'cafe', name: 'Café arábica', emoji: '☕', symbol: 'KC=F', exchange: 'ICE US', unit: 'US¢/libra-peso', b3: 'ICF — Café Arábica B3', explanation: 'Tipo, bebida, peneira, certificação, câmbio e praça de entrega alteram o valor recebido pelo produtor.' },
  { key: 'boi', name: 'Boi gordo', emoji: '🐂', symbol: 'LE=F', exchange: 'CME', unit: 'US¢/libra-peso', b3: 'BGI — Boi Gordo B3', explanation: 'O contrato americano reflete outro mercado. No Brasil, use o BGI e o preço da sua praça como referências principais.' },
  { key: 'trigo', name: 'Trigo', emoji: '🌾', symbol: 'ZW=F', exchange: 'CBOT', unit: 'US¢/bushel', b3: 'Referência física regional', explanation: 'Qualidade, origem, câmbio e importações influenciam fortemente o preço brasileiro.' },
  { key: 'acucar', name: 'Açúcar', emoji: '🧊', symbol: 'SB=F', exchange: 'ICE US', unit: 'US¢/libra-peso', b3: 'Referência internacional', explanation: 'A cotação é do açúcar bruto internacional; não equivale diretamente ao preço da cana ou do açúcar doméstico.' },
  { key: 'algodao', name: 'Algodão', emoji: '☁️', symbol: 'CT=F', exchange: 'ICE US', unit: 'US¢/libra-peso', b3: 'Referência internacional', explanation: 'Qualidade da pluma, câmbio, prêmio ou deságio e custos de exportação determinam o preço local.' },
];

export function FuturesQuotes() {
  const [query, setQuery] = useState('milho');
  const [selected, setSelected] = useState(FUTURES[0]);
  const [state, setState] = useState({ loading: true });
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const choose = item => { setState({ loading: true }); setSelected(item); };

  const search = event => {
    event?.preventDefault();
    const term = normalize(query);
    const match = FUTURES.find(item => normalize(item.name).includes(term) || term.includes(normalize(item.key)));
    if (!match) { setState({ error: 'Produto não encontrado. Tente soja, milho, café, trigo, boi gordo, açúcar ou algodão.' }); return; }
    choose(match);
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchMarket({ type: 'future', symbol: selected.symbol }, controller.signal)
      .then(quote => setState({ quote }))
      .catch(error => { if (!controller.signal.aborted) setState({ error: error.message }); });
    return () => controller.abort();
  }, [selected]);

  const quote = state.quote;
  const up = (quote?.change ?? 0) >= 0;
  return <section className="space-y-4">
    <div className="rounded-2xl p-5 text-white shadow-sm" style={{ background: 'linear-gradient(135deg,#0c2340 0%,#14532d 100%)' }}>
      <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#bef264' }}>Mercado futuro</div>
      <h2 className="text-2xl font-black mt-1">Consulte pelo nome do produto</h2>
      <p className="text-sm mt-1 max-w-2xl" style={{ color: 'rgba(255,255,255,.68)' }}>Compare a referência internacional com o contrato brasileiro correspondente. Os valores são indicativos e podem ter atraso.</p>
      <form onSubmit={search} className="flex flex-col sm:flex-row gap-2 mt-4">
        <label className="flex-1 text-xs font-semibold">Produto agrícola
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Digite: soja, milho, café…" className="block w-full rounded-xl border-0 p-3 mt-1 text-sm text-slate-900" />
        </label>
        <button className="self-stretch sm:self-end rounded-xl px-5 py-3 text-sm font-black" style={{ background: '#d9f99d', color: '#14532d' }}>Consultar</button>
      </form>
      <div className="flex flex-wrap gap-1.5 mt-3">{FUTURES.slice(0, 5).map(item => <button type="button" key={item.key} onClick={() => { setQuery(item.name); choose(item); }} className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: selected.key === item.key ? '#fff' : 'rgba(255,255,255,.12)', color: selected.key === item.key ? '#14532d' : '#fff' }}>{item.emoji} {item.name}</button>)}</div>
    </div>
    {state.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.error}</div>}
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
      <article className="md:col-span-3 rounded-2xl p-5 text-white shadow-sm" style={{ background: '#16382a' }}>
        <div className="flex justify-between items-start gap-3"><div><div className="text-xs uppercase tracking-wider opacity-60">Futuro internacional</div><h3 className="text-xl font-black mt-1">{selected.emoji} {selected.name}</h3></div><span className="rounded-lg px-2 py-1 text-xs font-bold" style={{ background: 'rgba(255,255,255,.12)' }}>{selected.exchange}</span></div>
        {state.loading ? <div className="animate-pulse h-20 rounded-xl mt-5" style={{ background: 'rgba(255,255,255,.1)' }} /> : quote && <>
          <div className="flex items-baseline gap-2 mt-5"><strong className="text-5xl font-black">{quote.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><span className="text-sm opacity-60">{selected.unit}</span></div>
          <div className="inline-block rounded-lg px-2 py-1 mt-2 text-xs font-bold" style={{ background: up ? 'rgba(190,242,100,.16)' : 'rgba(254,202,202,.14)', color: up ? '#d9f99d' : '#fecaca' }}>{up ? '▲' : '▼'} {Math.abs(quote.change).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</div>
          <p className="text-xs mt-4 opacity-50">Contrato contínuo {selected.symbol} · atualização {new Date(quote.date * 1000).toLocaleString('pt-BR')} · fonte: {quote.source}</p>
        </>}
      </article>
      <article className="md:col-span-2 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="text-xs uppercase tracking-wider text-green-800">Referência no Brasil</div>
        <h3 className="text-xl font-black text-slate-900 mt-2">{selected.b3}</h3>
        <p className="text-sm text-slate-600 mt-3 leading-relaxed">{selected.explanation}</p>
        <a href="https://www.b3.com.br/pt_br/solucoes/plataformas/puma-trading-system/para-participantes-e-traders/calendario-de-negociacao/vencimentos/calendario-de-vencimentos-de-contratos-agropecuarios/" target="_blank" rel="noopener noreferrer" className="inline-block text-xs font-bold text-green-800 underline mt-4">Ver contratos na B3 ↗</a>
      </article>
    </div>
    <div className="rounded-xl border bg-amber-50 border-amber-200 p-4"><h3 className="font-bold text-amber-900 text-sm">Preço estimado ao produtor</h3><p className="text-sm text-amber-800 mt-1"><strong>Futuro ± base regional − frete − armazenagem e descontos</strong>. A bolsa não informa exatamente quanto a cooperativa pagará.</p></div>
  </section>;
}

export function CommodityQuotes({ refresh, onViewChart }) {
  const [selected, setSelected] = useState(() => {
    const saved = readPreference('agroinfo.commodities.v1', ['26', '23']);
    return Array.isArray(saved) ? saved.filter(id => COMMODITIES.some(row => row[0] === id)) : ['26', '23'];
  });
  const [search, setSearch] = useState('');
  const [notFound, setNotFound] = useState(false);
  const normalize = value => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // quem digitou uma commodity no campo de ações é trazido para cá com a busca preenchida
  useEffect(() => {
    const receber = e => { setSearch(String(e.detail || '')); setNotFound(false); };
    window.addEventListener(EVENTO_BUSCAR_COMMODITY, receber);
    return () => window.removeEventListener(EVENTO_BUSCAR_COMMODITY, receber);
  }, []);

  const addFirstMatch = () => {
    const term = search.trim();
    if (!term) return;
    const match = COMMODITIES.find(row => normalize(row[1]).includes(normalize(term)));
    if (!match) { setNotFound(true); return; }
    if (!selected.includes(match[0])) {
      const next = [...selected, match[0]];
      setSelected(next); savePreference('agroinfo.commodities.v1', next);
    }
    setSearch(''); setNotFound(false);
  };

  return <section id="consultar-commodity" className="rounded-xl border bg-white p-3 shadow-sm" style={{ scrollMarginTop: 90 }}>
    <h2 className="text-sm font-bold text-green-800">Consultar commodity</h2>
    <p className="text-xs text-slate-600 mt-1">Digite o nome (ex.: soja, café, boi) e aperte Enter ou clique em Adicionar para ver o valor. Também dá pra escolher direto na lista abaixo.</p>
    <div className="flex gap-2 mt-3">
      <label className="flex-1 min-w-0 text-xs">Nome da commodity
        <input
          className="block border rounded-lg p-2 mt-1 w-full text-sm"
          placeholder="Ex.: soja, café, Chicago"
          value={search}
          onChange={e => { setSearch(e.target.value); setNotFound(false); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFirstMatch(); } }}
        />
      </label>
      <button type="button" onClick={addFirstMatch} className="self-end rounded-lg bg-green-800 text-white p-2 text-xs font-bold">Adicionar</button>
    </div>
    {notFound && <p role="alert" className="text-red-700 text-xs mt-1">Nenhuma commodity encontrada com esse nome. Veja as opções abaixo.</p>}
    {['Brasil', 'Internacional'].map(market => <fieldset key={market} className="mt-3">
      <legend className="font-semibold text-sm">{market}</legend>
      <div className="flex flex-wrap gap-2 mt-1">{COMMODITIES.filter(row => row[2] === market && normalize(row[1]).includes(normalize(search))).map(([id, name]) =>
        <label key={id} className="text-xs rounded-lg border p-2 cursor-pointer bg-green-50 flex gap-2 items-center">
          <input type="checkbox" checked={selected.includes(id)} onChange={() => {
            const next = selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id];
            setSelected(next); savePreference('agroinfo.commodities.v1', next);
          }} />{name}
        </label>)}</div>
    </fieldset>)}
    {!selected.length && <p className="text-sm mt-4">Selecione uma ou mais commodities para consultar.</p>}
    <div className="flex flex-col gap-3 mt-4">{COMMODITIES.filter(row => selected.includes(row[0])).map(([id, name, market]) => {
      const siteFont = 'system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif';
      const url = `https://www.noticiasagricolas.com.br/widgets/cotacoes?id=${id}&fonte=${encodeURIComponent(siteFont)}&largura=420`;
      const historyKey = COMMODITY_HISTORY_KEY[id];
      return <article key={id} className="rounded-xl border shadow-sm bg-white p-3 min-w-0" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
        <div className="flex items-center justify-between gap-2 mb-2 pb-2" style={{ borderBottom: '1px solid #e5e7eb' }}>
          <h3 className="font-semibold text-sm">{name} <span className="text-xs text-slate-500">· {market}</span></h3>
          {onViewChart && historyKey && (
            <button type="button" onClick={() => onViewChart({ type: 'commodity', id, key: historyKey, name })}
              className="text-xs font-bold text-green-800 underline shrink-0">Ver gráfico</button>
          )}
        </div>
        <div className="w-full overflow-x-auto overflow-y-auto rounded-lg border" style={{ maxHeight: 260, borderColor: '#e5e7eb' }}>
          <iframe key={`${id}-${refresh}`} src={url} title={`Cotação de ${name}`} className="border-0 bg-white block" style={{ width: 440, height: 320 }} loading="lazy" />
        </div>
        <a className="text-xs text-blue-800 underline mt-2 inline-block" href={url} target="_blank" rel="noopener noreferrer">Ver cotação na fonte / abrir se a tabela não carregar</a>
      </article>;
    })}</div>
    <p className="text-xs text-slate-500 mt-2">Fonte: Notícias Agrícolas e provedores indicados nas tabelas. Publicação conforme cada mercado; a consulta periódica não implica preço em tempo real.</p>
  </section>;
}
