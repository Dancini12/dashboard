import { useEffect, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Plus, X } from "lucide-react";
import { ACOES_LIVRES, CHICAGO, FUTURES } from "../catalogo";
import { mediasAnuais, ranking, variacaoDesde } from "../comparar";

// Comparação "qual subiu mais" da aba Histórico: o visitante escolhe em cascata onde procurar
// (Chicago, Nova Iorque, commodities do Brasil ou ações) e qual item, e pode incluir mais campos, um abaixo
// do outro. Como cada item tem a sua unidade e moeda, compara-se a variação em % da média de
// cada ano contra a média do ano inicial.
const CORES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"]; // ordem fixa, conferida para daltonismo
const MAX_CAMPOS = CORES.length;
const PRIMEIRO_ANO = 2020;
const LOCAL = { CBOT: "Chicago", CME: "Chicago", "ICE US": "Nova Iorque" };
const ERRO_GENERICO = "Não foi possível buscar o histórico agora.";

const pct = v => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
// "2020" → 2020; "Mar/26" → 2026
const anoDe = texto => Number(texto) || 2000 + Number(texto.slice(-2));
const futuro = f => ({
  chave: `f:${f.symbol}`, simbolo: f.symbol,
  nome: f.name.includes("(") ? `${f.emoji} ${f.name}` : `${f.emoji} ${f.name} · ${LOCAL[f.exchange]}`,
  opcao: `${f.emoji} ${f.name}`,
});

function Dica({ active, payload, label, base }) {
  const linhas = (payload ?? []).filter(p => p.value != null).sort((a, b) => b.value - a.value);
  if (!active || !linhas.length) return null;
  return (
    <div className="rounded-lg border bg-white px-2.5 py-2 text-xs shadow-md" style={{ borderColor: "#e2e8f0" }}>
      <div className="font-semibold text-slate-500">{label} · variação desde {base}</div>
      {linhas.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mt-1">
          <span className="shrink-0 rounded-full" style={{ width: 12, height: 3, background: p.color }} />
          <strong className="text-slate-900" style={{ fontVariantNumeric: "tabular-nums" }}>{pct(p.value)}</strong>
          <span className="text-slate-600">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

export default function CompararHistorico({ historico, nomes }) {
  const [campos, setCampos] = useState([{ id: 1, cor: 0, tipo: "", item: "" }]);
  const [series, setSeries] = useState({}); // chave do item → { valores: { ano: média } } ou { erro }
  const [base, setBase] = useState(PRIMEIRO_ANO);
  const [tentativa, setTentativa] = useState(0);
  const pedidos = useRef(new Set());

  const tipos = [
    { id: "chicago", nome: "Chicago", itens: CHICAGO.map(futuro) },
    { id: "novaiorque", nome: "Nova Iorque", itens: FUTURES.filter(f => !CHICAGO.includes(f)).map(futuro) },
    { id: "commodities", nome: "Commodities (Brasil)", itens: Object.keys(nomes).map(k => ({
      chave: `c:${k}`, nome: `${nomes[k]} · Brasil`, opcao: nomes[k], valores: Object.fromEntries(historico.map(h => [anoDe(h.ano), h[k]])),
    })) },
    { id: "bolsa", nome: "Ações da B3", itens: ACOES_LIVRES.map(([codigo, empresa]) => ({ chave: `a:${codigo}`, simbolo: codigo, nome: `${codigo} · ${empresa}`, opcao: `${codigo} · ${empresa}` })) },
  ];
  const itemDe = campo => tipos.find(t => t.id === campo.tipo)?.itens.find(i => i.chave === campo.item);

  // busca o histórico dos itens escolhidos que vêm da internet (contratos e ações), uma vez cada
  const aBuscar = campos.map(itemDe).filter(item => item?.simbolo).map(item => `${item.chave}|${item.simbolo}`).join(",");
  useEffect(() => {
    for (const par of aBuscar ? aBuscar.split(",") : []) {
      const [chave, simbolo] = par.split("|");
      if (pedidos.current.has(chave)) continue;
      pedidos.current.add(chave);
      fetch(`/api/market?${new URLSearchParams({ type: "history", symbol: simbolo })}`, { signal: AbortSignal.timeout(30000) })
        .then(async r => ({ ok: r.ok, d: await r.json() }))
        .then(({ ok, d }) => setSeries(s => ({ ...s, [chave]: ok ? { valores: mediasAnuais(d.points) } : { erro: d.error || ERRO_GENERICO } })))
        .catch(() => setSeries(s => ({ ...s, [chave]: { erro: ERRO_GENERICO } })));
    }
  }, [aBuscar, tentativa]);

  const tentarDeNovo = chave => {
    pedidos.current.delete(chave);
    setSeries(s => Object.fromEntries(Object.entries(s).filter(([k]) => k !== chave)));
    setTentativa(n => n + 1);
  };
  const mudar = (id, novo) => setCampos(lista => lista.map(c => (c.id === id ? { ...c, ...novo } : c)));
  const incluir = () => setCampos(lista => [...lista, {
    id: Math.max(...lista.map(c => c.id)) + 1, tipo: "", item: "",
    cor: CORES.findIndex((_, i) => !lista.some(c => c.cor === i)), // a cor fica com o campo: tirar um não repinta os outros
  }]);
  const tirar = id => setCampos(lista => (lista.length > 1 ? lista.filter(c => c.id !== id) : [{ ...lista[0], tipo: "", item: "" }]));

  const ultimoAno = Math.max(new Date().getFullYear(), ...historico.map(h => anoDe(h.ano)));
  const todosOsAnos = Array.from({ length: ultimoAno - PRIMEIRO_ANO + 1 }, (_, i) => PRIMEIRO_ANO + i);
  const anos = todosOsAnos.filter(ano => ano >= base);
  const escolhidos = campos.map(campo => {
    const item = itemDe(campo);
    if (!item) return null;
    const serie = item.valores ? { valores: item.valores } : series[item.chave];
    return { campo, item, serie, nome: item.nome, cor: CORES[campo.cor], variacoes: serie?.valores ? variacaoDesde(serie.valores, anos, base) : null };
  }).filter(Boolean);
  const noGrafico = escolhidos.filter(e => e.variacoes);
  const dados = anos.map((ano, i) => ({ ano: String(ano), ...Object.fromEntries(noGrafico.map(e => [`s${e.campo.id}`, e.variacoes[i]])) }));
  const ordem = ranking(noGrafico);
  const vazio = !noGrafico.length;
  const menor = Math.min(0, ...ordem.map(e => e.final));
  const maior = Math.max(0, ...ordem.map(e => e.final));
  const escala = maior - menor || 1;

  return (
    <section id="comparar-historico" className="rounded-xl border bg-white p-3 shadow-sm" style={{ scrollMarginTop: 100 }}>
      <h2 className="text-sm font-bold text-green-800">Comparar: qual subiu mais?</h2>
      <p className="text-xs text-slate-600 mt-1">
        Escolha onde procurar e depois o item. Para comparar com outro, inclua mais um campo: eles ficam um abaixo do
        outro e o gráfico mostra quanto cada um subiu ou caiu no mesmo período.
      </p>

      <div className="mt-3 space-y-2">
        {campos.map((campo, i) => {
          const tipo = tipos.find(t => t.id === campo.tipo);
          const escolhido = escolhidos.find(e => e.campo.id === campo.id);
          return (
            <div key={campo.id} className="rounded-lg border p-2" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
              <div className="flex items-center gap-2">
                <span className="shrink-0 rounded-full" style={{ width: 14, height: 4, background: CORES[campo.cor] }} aria-hidden="true" />
                <span className="text-xs font-bold text-slate-700">Item {i + 1}</span>
                {(campos.length > 1 || campo.tipo) && (
                  <button type="button" onClick={() => tirar(campo.id)} className="ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-slate-600" style={{ background: "#e2e8f0" }}>
                    <X size={11} aria-hidden="true" />{campos.length > 1 ? "Tirar" : "Limpar"}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                <label className="text-xs text-slate-600">Onde procurar
                  <select value={campo.tipo} onChange={e => mudar(campo.id, { tipo: e.target.value, item: "" })} className="block w-full rounded-lg border bg-white p-2 mt-1 text-sm text-slate-900">
                    <option value="">Escolha…</option>
                    {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </label>
                {tipo && (
                  <label className="text-xs text-slate-600">Qual item
                    <select value={campo.item} onChange={e => mudar(campo.id, { item: e.target.value })} className="block w-full rounded-lg border bg-white p-2 mt-1 text-sm text-slate-900">
                      <option value="">Escolha…</option>
                      {tipo.itens.map(item => {
                        const repetido = campos.some(c => c.id !== campo.id && c.item === item.chave);
                        return <option key={item.chave} value={item.chave} disabled={repetido}>{item.opcao}{repetido ? " (já escolhido)" : ""}</option>;
                      })}
                    </select>
                  </label>
                )}
              </div>
              {escolhido && !escolhido.serie && <p className="text-xs text-slate-500 mt-1.5">Buscando o histórico…</p>}
              {escolhido?.serie?.erro && (
                <p role="alert" className="text-xs text-amber-800 mt-1.5">
                  {escolhido.serie.erro} <button type="button" onClick={() => tentarDeNovo(escolhido.item.chave)} className="font-bold underline">Tentar de novo</button>
                </p>
              )}
              {escolhido?.serie?.valores && !escolhido.variacoes && <p className="text-xs text-amber-800 mt-1.5">Este item não tem preço em {base}. Escolha um ano inicial mais recente.</p>}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
        {campos.length < MAX_CAMPOS
          ? <button type="button" onClick={incluir} className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold" style={{ background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}>
              <Plus size={13} aria-hidden="true" />Incluir mais um item para comparar
            </button>
          : <span className="text-xs text-slate-500">Dá para comparar até {MAX_CAMPOS} itens de uma vez.</span>}
        <label className="flex items-center gap-1.5 text-xs text-slate-600">Comparar desde
          <select value={base} onChange={e => setBase(Number(e.target.value))} className="rounded-lg border bg-white px-2 py-1 text-sm text-slate-900">
            {todosOsAnos.slice(0, -1).map(ano => <option key={ano} value={ano}>{ano}</option>)}
          </select>
        </label>
      </div>

      {ordem.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>
            {ordem.length === 1 ? `${ordem[0].nome}: ${pct(ordem[0].final)} desde ${base}`
              : ordem[0].final > 0 ? `Quem mais subiu desde ${base}: ${ordem[0].nome} (${pct(ordem[0].final)})`
                : `Nenhum subiu desde ${base}. Quem menos caiu: ${ordem[0].nome} (${pct(ordem[0].final)})`}
          </h3>
          {ordem.length > 1 && (
            <ol className="mt-2 space-y-1.5">
              {ordem.map((e, i) => (
                <li key={e.campo.id} className="grid items-center gap-x-2 text-xs" style={{ gridTemplateColumns: "minmax(0, 1fr) 4.5rem" }}>
                  <span className="truncate text-slate-700"><span className="font-bold text-slate-500">{i + 1}º</span> {e.nome}</span>
                  <strong className="text-right text-slate-900" style={{ fontVariantNumeric: "tabular-nums" }}>{pct(e.final)}</strong>
                  <span className="relative col-span-2 block rounded" style={{ height: 14, background: "#f1f5f9" }} title={`${e.nome}: ${pct(e.final)}`}>
                    <span className="absolute inset-y-0" style={{
                      left: `${(Math.min(e.final, 0) - menor) / escala * 100}%`, width: `${Math.abs(e.final) / escala * 100}%`, minWidth: 2,
                      background: e.cor, borderRadius: e.final >= 0 ? "0 4px 4px 0" : "4px 0 0 4px",
                    }} />
                    {menor < 0 && <span className="absolute inset-y-0" style={{ left: `${-menor / escala * 100}%`, width: 1, background: "#64748b" }} />}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div className="mt-4">
        {noGrafico.length > 1 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 mb-1 text-xs text-slate-700">
            {noGrafico.map(e => <li key={e.campo.id} className="flex items-center gap-1.5"><span className="rounded-full" style={{ width: 14, height: 3, background: e.cor }} aria-hidden="true" />{e.nome}</li>)}
          </ul>
        )}
        <div className="relative" style={{ height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={dados} margin={{ top: 10, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="ano" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} padding={{ left: 14, right: 14 }} />
              <YAxis width={50} tick={vazio ? false : { fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} domain={vazio ? [0, 100] : ["auto", "auto"]}
                tickFormatter={v => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v))}%`} />
              {!vazio && <ReferenceLine y={0} stroke="#94a3b8" />}
              {!vazio && <Tooltip cursor={{ stroke: "#94a3b8" }} content={props => <Dica {...props} base={base} />} />}
              {noGrafico.map(e => (
                <Line key={e.campo.id} type="linear" dataKey={`s${e.campo.id}`} name={e.nome} stroke={e.cor} strokeWidth={2} connectNulls isAnimationActive={false}
                  dot={{ r: 4, fill: e.cor, stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
          {vazio && (
            <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-slate-500 pointer-events-none">
              {escolhidos.length ? "O gráfico aparece assim que o histórico chegar." : "O gráfico fica vazio até você escolher o primeiro item acima."}
            </p>
          )}
        </div>
      </div>

      {!vazio && (
        <details className="mt-2 text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold text-green-800">Ver os números em tabela</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
              <thead><tr style={{ background: "#166534", color: "#fff" }}><th className="py-1.5 px-2 text-left">Variação desde {base}</th>{anos.map(ano => <th key={ano} className="py-1.5 px-2 text-right">{ano}</th>)}</tr></thead>
              <tbody>{ordem.map((e, i) => (
                <tr key={e.campo.id} style={{ background: i % 2 ? "#fff" : "#f8fafc" }}>
                  <td className="py-1 px-2 font-semibold whitespace-nowrap">{e.nome}</td>
                  {e.variacoes.map((v, j) => <td key={anos[j]} className="py-1 px-2 text-right">{v == null ? "—" : pct(v)}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </details>
      )}

      <p className="text-xs text-slate-500 mt-3">
        Como a conta é feita: a média dos preços de cada ano é comparada com a média do ano inicial. Chicago e Nova Iorque
        estão em dólar; commodities do Brasil e ações, em reais. Por isso a comparação é da variação em %, não do preço.
        O ponto de {ultimoAno} é a média do ano até agora (nas commodities do Brasil, o último valor da tabela abaixo).
        Fontes: Yahoo Finance (contratos), BRAPI (ações), CEPEA/ESALQ e Farmnews (commodities do Brasil).
      </p>
    </section>
  );
}
