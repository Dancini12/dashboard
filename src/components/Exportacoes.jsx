import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Aba "Exportações": quanto o Brasil e o Paraná embarcam dos principais produtos do agro, mês a
// mês, contra o ano anterior, e para onde vai (Comex Stat, /api/market?type=exportacoes). A fonte
// aceita um pedido a cada 10 segundos: quando ela pede para esperar, a aba tenta de novo sozinha.
const AZUL = "#2a78d6";
const CINZA = "#94a3b8"; // ano anterior, para comparação
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const TENTATIVAS = 6;

const decimal = (v, casas = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });
const toneladas = kg => { const t = kg / 1000; return t >= 1e6 ? `${decimal(t / 1e6, t >= 1e7 ? 1 : 2)} milhões de t` : t >= 1000 ? `${decimal(t / 1000, t >= 1e5 ? 0 : 1)} mil t` : `${decimal(t, 0)} t`; };
const dolares = v => (v >= 1e9 ? `US$ ${decimal(v / 1e9, 2)} bilhões` : `US$ ${decimal(v / 1e6, v >= 1e8 ? 0 : 1)} milhões`);
const comSinal = v => `${v > 0 ? "+" : v < 0 ? "−" : ""}${decimal(Math.abs(v))}%`;
const variacao = (atual, anterior) => (anterior > 0 ? (atual - anterior) / anterior * 100 : null);

// Busca uma parte dos dados; se a fonte pedir para aguardar (503), espera e tenta de novo.
async function buscar(parte, sinal) {
  for (let tentativa = 1; ; tentativa++) {
    const response = await fetch(`/api/market?type=exportacoes&parte=${parte}`, { signal: sinal });
    if (response.ok) return response.json();
    const corpo = await response.json().catch(() => ({}));
    if (response.status !== 503 || tentativa >= TENTATIVAS) throw new Error(corpo.error || "indisponível");
    await new Promise((seguir, parar) => {
      const espera = setTimeout(seguir, (corpo.tentarEm ?? 11) * 1000);
      sinal.addEventListener("abort", () => { clearTimeout(espera); parar(new Error("cancelado")); }, { once: true });
    });
  }
}

function Variacao({ valor }) {
  if (valor == null) return null;
  return <span className="font-semibold" style={{ color: valor > 0 ? "#15803d" : valor < 0 ? "#b91c1c" : "#64748b" }}>{valor > 0 ? "▲ " : valor < 0 ? "▼ " : ""}{comSinal(valor)}</span>;
}
function Numero({ rotulo, valor, children }) {
  return (
    <div className="rounded-lg p-2.5" style={{ background: "#f8fafc" }}>
      <div className="text-xs text-slate-500">{rotulo}</div>
      <div className="text-lg font-black text-slate-900">{valor}</div>
      {children && <div className="text-xs text-slate-500">{children}</div>}
    </div>
  );
}
const Botoes = ({ opcoes, ativo, onEscolher, rotulo }) => (
  <div className="flex flex-wrap gap-2" role="group" aria-label={rotulo}>
    {opcoes.map(([id, nome]) => (
      <button key={id} type="button" onClick={() => onEscolher(id)} aria-pressed={ativo === id} className="rounded-full border px-3 py-1 text-xs font-bold"
        style={ativo === id ? { background: "#166534", borderColor: "#166534", color: "#fff" } : { background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}>{nome}</button>
    ))}
  </div>
);
function Dica({ active, payload, label }) {
  const linhas = (payload ?? []).filter(p => p.value != null);
  if (!active || !linhas.length) return null;
  return (
    <div className="rounded-lg border bg-white px-2.5 py-2 text-xs shadow-md" style={{ borderColor: "#e2e8f0" }}>
      <div className="font-semibold text-slate-500">{label}</div>
      {linhas.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mt-1">
          <span className="shrink-0 rounded-full" style={{ width: 12, height: 3, background: p.color }} />
          <strong className="text-slate-900">{toneladas(p.value)}</strong><span className="text-slate-600">{p.name}</span>
        </div>
      ))}
    </div>
  );
}
// Barras horizontais de participação (destinos e estados): um só tom, valor escrito ao lado.
function Participacoes({ itens }) {
  const maior = Math.max(...itens.map(i => i.partePct), 1);
  return (
    <ol className="mt-2 space-y-1.5">
      {itens.map(item => (
        <li key={item.nome} className="grid items-center gap-x-2 text-xs" style={{ gridTemplateColumns: "minmax(0, 9rem) minmax(0, 1fr) 3.2rem" }} title={`${item.nome}: ${toneladas(item.kg)}`}>
          <span className="truncate text-slate-700">{item.nome}</span>
          <span className="block" style={{ height: 14 }}><span className="block" style={{ height: "100%", width: `${Math.max(1, item.partePct / maior * 100)}%`, background: AZUL, borderRadius: "0 4px 4px 0" }} /></span>
          <strong className="text-right text-slate-900" style={{ fontVariantNumeric: "tabular-nums" }}>{decimal(item.partePct)}%</strong>
        </li>
      ))}
    </ol>
  );
}

export default function Exportacoes() {
  const [produtos, setProdutos] = useState(null);
  const [destinos, setDestinos] = useState(null);
  const [erro, setErro] = useState({});
  const [chave, setChave] = useState("soja");
  const [local, setLocal] = useState("brasil");

  useEffect(() => {
    const controle = new AbortController();
    // uma parte depois da outra: a fonte não aceita dois pedidos juntos
    buscar("produtos", controle.signal).then(setProdutos).catch(() => { if (!controle.signal.aborted) setErro(e => ({ ...e, produtos: true })); })
      .then(() => buscar("destinos", controle.signal)).then(setDestinos).catch(() => { if (!controle.signal.aborted) setErro(e => ({ ...e, destinos: true })); });
    return () => controle.abort();
  }, []);

  const produto = produtos?.produtos.find(p => p.chave === chave) ?? produtos?.produtos[0];
  const ano = produtos ? Number(produtos.ultimoMes.slice(0, 4)) : null;
  const ultimoMes = produtos ? Number(produtos.ultimoMes.slice(5, 7)) : 0;
  const periodo = ultimoMes > 1 ? `jan a ${MESES[ultimoMes - 1]}` : "jan";
  // soma de janeiro até o último mês com dado, no ano atual e nos mesmos meses do ano anterior
  const acumulado = (serie, doAno) => serie.filter(m => m.mes.startsWith(`${doAno}-`) && Number(m.mes.slice(5, 7)) <= ultimoMes).reduce((t, m) => ({ kg: t.kg + m.kg, fob: t.fob + m.fob }), { kg: 0, fob: 0 });
  const serie = produto?.[local] ?? [];
  const agora = produto ? acumulado(serie, ano) : null;
  const antes = produto ? acumulado(serie, ano - 1) : null;
  const doBrasil = produto ? acumulado(produto.brasil, ano) : null;
  const preco = t => (t.kg > 0 ? t.fob / t.kg * 1000 : null);
  const noMes = (doAno, i) => serie.find(m => m.mes === `${doAno}-${String(i + 1).padStart(2, "0")}`)?.kg;
  const grafico = MESES.map((rotulo, i) => ({ rotulo, atual: i < ultimoMes ? noMes(ano, i) ?? 0 : null, anterior: noMes(ano - 1, i) ?? null }));
  const temAnterior = grafico.some(g => g.anterior != null);
  const paises = destinos?.produtos.find(p => p.chave === produto?.chave);
  const totalDosEstados = doBrasil?.kg || 1;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-white p-3 shadow-sm">
        <h2 className="text-sm font-bold text-green-800">Exportações do agro · Brasil e Paraná</h2>
        <p className="text-xs text-slate-600 mt-1">
          Quanto sai do país de cada produto, quanto vale e para onde vai. Quando o mundo compra mais, o preço aqui dentro tende a subir;
          quando um grande comprador sai do mercado, tende a cair.
        </p>
        {produtos && <p className="text-xs text-slate-500 mt-1">Dados oficiais até {MESES[ultimoMes - 1]}/{ano}. O governo publica o mês anterior no começo de cada mês.</p>}
      </section>

      {!produtos && !erro.produtos && <p className="text-sm text-slate-500">Buscando as exportações na fonte oficial. Na primeira consulta do dia pode levar até um minuto…</p>}
      {erro.produtos && <p role="alert" className="rounded-xl border p-3 text-sm text-amber-800 bg-amber-50">Os dados de exportação não estão disponíveis agora. Tente novamente em alguns minutos.</p>}

      {produto && <>
        <section className="rounded-xl border bg-white p-3 shadow-sm">
          <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>Embarques de {ano}</h3>
          <div className="space-y-2 mt-2">
            <Botoes rotulo="Produto" opcoes={produtos.produtos.map(p => [p.chave, p.nome])} ativo={produto.chave} onEscolher={setChave} />
            <Botoes rotulo="Origem" opcoes={[["brasil", "Brasil"], ["parana", "Paraná"]]} ativo={local} onEscolher={setLocal} />
          </div>
          {agora.kg > 0 ? <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
              <Numero rotulo={`Volume, ${periodo}`} valor={toneladas(agora.kg)}>{antes.kg > 0 && <><Variacao valor={variacao(agora.kg, antes.kg)} /> sobre {ano - 1}</>}</Numero>
              <Numero rotulo={`Valor, ${periodo}`} valor={dolares(agora.fob)}>{antes.fob > 0 && <><Variacao valor={variacao(agora.fob, antes.fob)} /> sobre {ano - 1}</>}</Numero>
              <Numero rotulo="Preço médio de venda" valor={`US$ ${decimal(preco(agora), 0)}/t`}>{preco(antes) && <><Variacao valor={variacao(preco(agora), preco(antes))} /> sobre {ano - 1}</>}</Numero>
              {local === "parana"
                ? <Numero rotulo="Parte do Paraná no Brasil" valor={`${decimal(agora.kg / doBrasil.kg * 100)}%`}>do volume embarcado</Numero>
                : <Numero rotulo="Países compradores" valor={paises ? paises.paises : "…"}>em {destinos?.ano ?? ano}</Numero>}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-4 mb-1 text-xs text-slate-700">
              <li className="flex items-center gap-1.5"><span className="rounded-full" style={{ width: 14, height: 3, background: AZUL }} aria-hidden="true" />{ano}</li>
              {temAnterior && <li className="flex items-center gap-1.5"><span className="rounded-full" style={{ width: 14, height: 3, background: CINZA }} aria-hidden="true" />{ano - 1}</li>}
              <li className="text-slate-500">Toneladas embarcadas por mês</li>
            </ul>
            <div style={{ height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={grafico} margin={{ top: 10, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="rotulo" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} padding={{ left: 10, right: 10 }} />
                  <YAxis width={58} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={kg => { const t = kg / 1000; return t >= 1e6 ? `${decimal(t / 1e6)} mi` : t >= 1000 ? `${decimal(t / 1000, 0)} mil` : decimal(t, 0); }} />
                  <Tooltip cursor={{ stroke: "#94a3b8" }} content={<Dica />} />
                  {temAnterior && <Line type="linear" dataKey="anterior" name={String(ano - 1)} stroke={CINZA} strokeWidth={2} dot={{ r: 3, fill: CINZA, stroke: "#fff", strokeWidth: 1.5 }} isAnimationActive={false} />}
                  <Line type="linear" dataKey="atual" name={String(ano)} stroke={AZUL} strokeWidth={2} dot={{ r: 4, fill: AZUL, stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <details className="mt-2 text-xs text-slate-600">
              <summary className="cursor-pointer font-semibold text-green-800">Ver os números em tabela</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr style={{ background: "#166534", color: "#fff" }}><th className="py-1.5 px-2 text-left">Mês</th><th className="py-1.5 px-2 text-right">{ano}</th><th className="py-1.5 px-2 text-right">{ano - 1}</th><th className="py-1.5 px-2 text-right">Diferença</th></tr></thead>
                  <tbody>{grafico.filter(g => g.atual != null || g.anterior != null).map((g, i) => (
                    <tr key={g.rotulo} style={{ background: i % 2 ? "#fff" : "#f8fafc" }}>
                      <td className="py-1 px-2 font-semibold">{g.rotulo}</td>
                      <td className="py-1 px-2 text-right font-mono">{g.atual != null ? toneladas(g.atual) : "—"}</td>
                      <td className="py-1 px-2 text-right font-mono">{g.anterior != null ? toneladas(g.anterior) : "—"}</td>
                      <td className="py-1 px-2 text-right">{g.atual != null && g.anterior ? <Variacao valor={variacao(g.atual, g.anterior)} /> : "—"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </details>
          </> : <p className="text-sm text-slate-500 mt-3">{local === "parana" ? `O Paraná não exportou ${produto.nome.toLowerCase()} em ${ano}. Veja o Brasil.` : `Sem embarques de ${produto.nome.toLowerCase()} em ${ano}.`}</p>}
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="rounded-xl border bg-white p-3 shadow-sm">
            <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>Para onde vai · {produto.nome}</h3>
            <p className="text-xs text-slate-600 mt-1">Parte de cada país no volume exportado pelo Brasil{destinos ? ` em ${destinos.ano}` : ""}.</p>
            {paises ? <Participacoes itens={paises.destinos.map(d => ({ nome: d.pais, kg: d.kg, partePct: d.partePct }))} />
              : erro.destinos ? <p role="alert" className="text-xs text-amber-800 mt-2">Os destinos não estão disponíveis agora.</p>
                : <p className="text-xs text-slate-500 mt-2">Buscando os destinos. A fonte libera um pedido a cada 10 segundos…</p>}
          </section>
          <section className="rounded-xl border bg-white p-3 shadow-sm">
            <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>De onde sai · {produto.nome}</h3>
            <p className="text-xs text-slate-600 mt-1">Estados que mais embarcaram em {ano} e a parte de cada um no total do Brasil.</p>
            <Participacoes itens={produto.estados.map(e => ({ nome: e.estado, kg: e.kg, partePct: e.kg / totalDosEstados * 100 }))} />
          </section>
        </div>
      </>}

      <p className="text-xs text-slate-500">
        Fonte: Comex Stat, do Ministério do Desenvolvimento, Indústria, Comércio e Serviços. O estado é o de origem da mercadoria, não o do porto de
        embarque. Preço médio = valor em dólares dividido pelo peso embarcado. Carne bovina soma a fresca e a congelada.
      </p>
    </div>
  );
}
