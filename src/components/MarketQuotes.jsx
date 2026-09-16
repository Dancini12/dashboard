import { useEffect, useState } from 'react';

async function fetchMarket(type, symbol = '', signal) {
  const response = await fetch(`/api/market?${new URLSearchParams({ type, symbol })}`, { signal });
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

export function StockQuotes({ refresh }) {
  const [symbol, setSymbol] = useState(() => {
    const saved = readPreference('agroinfo.stock.v1', 'PETR4');
    return typeof saved === 'string' && /^[A-Z]{4}\d{1,2}$/.test(saved) ? saved : 'PETR4';
  });
  const [input, setInput] = useState(symbol);
  const [validation, setValidation] = useState('');
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState({});
  useEffect(() => {
    const controller = new AbortController();
    fetchMarket('stock', symbol, controller.signal).then(quote => {
      setState({ quote, symbol, error: '' });
    }).catch(error => {
      if (!controller.signal.aborted) setState(previous => ({ ...previous, symbol, error: error.message }));
    });
    return () => controller.abort();
  }, [symbol, refresh, retry]);
  const quote = state.quote?.symbol === symbol ? state.quote : null;
  return <section className="rounded-xl border bg-white p-3 shadow-sm">
    <h2 className="text-sm font-bold text-blue-900 mb-3">Consultar ação ou ETF da B3</h2>
    <form onSubmit={event => {
      event.preventDefault();
      const value = input.trim().toUpperCase();
      if (!/^[A-Z]{4}\d{1,2}$/.test(value)) { setValidation('Use um código como PETR4, VALE3 ou BOVA11.'); return; }
      setValidation(''); setSymbol(value); setInput(value); setRetry(n => n + 1); savePreference('agroinfo.stock.v1', value);
    }} className="flex flex-wrap gap-2">
      <label className="flex-1 min-w-0 text-xs">Código da ação
        <input className="block w-full border rounded-lg p-2 mt-1 uppercase text-sm" value={input} onChange={e => setInput(e.target.value)} placeholder="Ex.: PETR4" maxLength={12} list="stock-examples" />
      </label>
      <datalist id="stock-examples">{['PETR4', 'VALE3', 'ITUB4', 'MGLU3', 'BBAS3', 'BOVA11'].map(code => <option key={code} value={code} />)}</datalist>
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
      </div>}
    </div>
    <p className="mt-2 text-xs text-slate-500">Cotações podem ter atraso. A disponibilidade de cada ativo depende do acesso à fonte.</p>
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

export function CommodityQuotes({ refresh }) {
  const [selected, setSelected] = useState(() => {
    const saved = readPreference('agroinfo.commodities.v1', ['26', '23']);
    return Array.isArray(saved) ? saved.filter(id => COMMODITIES.some(row => row[0] === id)) : ['26', '23'];
  });
  const [search, setSearch] = useState('');
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return <section className="rounded-xl border bg-white p-3 shadow-sm">
    <h2 className="text-sm font-bold text-green-800">Escolha suas commodities</h2>
    <p className="text-xs text-slate-600 mt-1">Preços no Brasil e contratos internacionais. Confira a unidade, a praça, o vencimento e a data de fechamento em cada tabela.</p>
    <label className="block text-xs mt-3">Buscar commodity
      <input className="block border rounded-lg p-2 mt-1 w-full text-sm" placeholder="Ex.: soja, café, Chicago" value={search} onChange={e => setSearch(e.target.value)} />
    </label>
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">{COMMODITIES.filter(row => selected.includes(row[0])).map(([id, name, market]) => {
      const url = `https://www.noticiasagricolas.com.br/widgets/cotacoes?id=${id}&fonte=Arial&largura=100%25`;
      return <article key={id} className="border rounded-lg p-2 min-w-0">
        <h3 className="font-semibold text-sm mb-2">{name} <span className="text-xs text-slate-500">· {market}</span></h3>
        <iframe key={`${id}-${refresh}`} src={url} title={`Cotação de ${name}`} className="w-full border-0 h-80 bg-white" loading="lazy" />
        <a className="text-xs text-blue-800 underline" href={url} target="_blank" rel="noopener noreferrer">Ver cotação na fonte / abrir se a tabela não carregar</a>
      </article>;
    })}</div>
    <p className="text-xs text-slate-500 mt-2">Fonte: Notícias Agrícolas e provedores indicados nas tabelas. Publicação conforme cada mercado; a consulta periódica não implica preço em tempo real.</p>
  </section>;
}
