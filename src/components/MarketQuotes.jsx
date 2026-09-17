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
        {showDropdown && (searching || suggestions.length > 0) && (
          <div className="absolute left-0 right-0 mt-1 bg-white border rounded-lg shadow-md z-10 max-h-56 overflow-auto">
            {searching && <div className="p-2 text-xs text-slate-500">Buscando…</div>}
            {!searching && suggestions.map(s => (
              <button key={s.symbol} type="button" onClick={() => pick(s.symbol, s.name)}
                className="block w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 border-b last:border-b-0">
                <span className="font-bold">{s.symbol}</span> · {s.name}
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

export function CommodityQuotes({ refresh, onViewChart }) {
  const [selected, setSelected] = useState(() => {
    const saved = readPreference('agroinfo.commodities.v1', ['26', '23']);
    return Array.isArray(saved) ? saved.filter(id => COMMODITIES.some(row => row[0] === id)) : ['26', '23'];
  });
  const [search, setSearch] = useState('');
  const [notFound, setNotFound] = useState(false);
  const normalize = value => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

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

  return <section className="rounded-xl border bg-white p-3 shadow-sm">
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
      const url = `https://www.noticiasagricolas.com.br/widgets/cotacoes?id=${id}&fonte=Arial&largura=100%25`;
      const historyKey = COMMODITY_HISTORY_KEY[id];
      return <article key={id} className="border rounded-lg p-2 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="font-semibold text-sm">{name} <span className="text-xs text-slate-500">· {market}</span></h3>
          {onViewChart && historyKey && (
            <button type="button" onClick={() => onViewChart({ type: 'commodity', id, key: historyKey, name })}
              className="text-xs font-bold text-green-800 underline shrink-0">Ver gráfico</button>
          )}
        </div>
        <div className="w-full overflow-x-auto rounded-lg">
          <iframe key={`${id}-${refresh}`} src={url} title={`Cotação de ${name}`} className="border-0 h-80 bg-white" style={{ width: '100%', minWidth: 480 }} loading="lazy" />
        </div>
        <a className="text-xs text-blue-800 underline" href={url} target="_blank" rel="noopener noreferrer">Ver cotação na fonte / abrir se a tabela não carregar</a>
      </article>;
    })}</div>
    <p className="text-xs text-slate-500 mt-2">Fonte: Notícias Agrícolas e provedores indicados nas tabelas. Publicação conforme cada mercado; a consulta periódica não implica preço em tempo real.</p>
  </section>;
}
