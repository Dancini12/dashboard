import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Search } from "lucide-react";
import { PAISES, acharPais } from "../paises";

// Aba "Exportações": quanto o Brasil e o Paraná embarcam dos principais produtos do agro, mês a
// mês, contra o ano anterior, e para onde vai; e, para o país que o visitante digitar, o que o Brasil
// vende para ele e compra dele (Comex Stat, /api/market?type=exportacoes). A fonte recusa pedidos
// seguidos: a aba faz um de cada vez, com intervalo, e tenta de novo sozinha quando é recusada.
const AZUL = "#2a78d6";
const CINZA = "#94a3b8"; // ano anterior, para comparação
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const TENTATIVAS = 8;
// A fonte diz aceitar um pedido a cada 10 segundos; medido em 08/10/2026, recusa os que chegam com
// menos de uns 13 segundos de intervalo.
const INTERVALO_DA_FONTE = 14000;

const decimal = (v, casas = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });
const toneladas = kg => { const t = kg / 1000; return t >= 1e6 ? `${decimal(t / 1e6, t >= 1e7 ? 1 : 2)} milhões de t` : t >= 1000 ? `${decimal(t / 1000, t >= 1e5 ? 0 : 1)} mil t` : t >= 1 ? `${decimal(t, t < 10 ? 1 : 0)} t` : `${decimal(kg, 0)} kg`; };
const dolares = v => (v >= 1e9 ? `US$ ${decimal(v / 1e9, 2)} bilhões` : v >= 1e6 ? `US$ ${decimal(v / 1e6, v >= 1e8 ? 0 : 1)} milhões` : v >= 1000 ? `US$ ${decimal(v / 1000, 0)} mil` : `US$ ${decimal(v, 0)}`);
const comSinal = v => `${v > 0 ? "+" : v < 0 ? "−" : ""}${decimal(Math.abs(v))}%`;
const variacao = (atual, anterior) => (anterior > 0 ? (atual - anterior) / anterior * 100 : null);

const esperar = (ms, sinal) => new Promise((seguir, parar) => {
  if (sinal.aborted) { parar(new Error("cancelado")); return; }
  const espera = setTimeout(seguir, Math.max(0, ms));
  sinal.addEventListener("abort", () => { clearTimeout(espera); parar(new Error("cancelado")); }, { once: true });
});
// Todos os pedidos da aba passam por uma fila só, um de cada vez. Depois de um pedido que foi mesmo
// até a fonte, o seguinte espera o intervalo; resposta guardada pelo site (cache) não conta.
const fila = [];
let atendendo = false;
let fonteLivreEm = 0;

// Um pedido ("parte=produtos", "parte=pais&pais=160&fluxo=export"…); se a fonte pedir para aguardar
// (503), espera e tenta de novo.
async function pedir(consulta, sinal) {
  for (let tentativa = 1; ; tentativa++) {
    await esperar(fonteLivreEm - Date.now(), sinal);
    const response = await fetch(`/api/market?type=exportacoes&${consulta}`, { signal: sinal });
    if (response.headers.get("x-vercel-cache") !== "HIT") fonteLivreEm = Date.now() + INTERVALO_DA_FONTE;
    if (response.ok) return response.json();
    const corpo = await response.json().catch(() => ({}));
    if (response.status !== 503 || tentativa >= TENTATIVAS) throw new Error(corpo.error || "indisponível");
  }
}
async function atender() {
  if (atendendo) return;
  atendendo = true;
  while (fila.length) {
    const { consulta, sinal, entregar, falhar } = fila.shift();
    await pedir(consulta, sinal).then(entregar, falhar); // pedido que falhou não trava os seguintes
  }
  atendendo = false;
}
// Põe o pedido na fila. naFrente: o que o visitante acabou de pedir passa à frente do que a aba
// carrega sozinha.
function buscar(consulta, sinal, naFrente = false) {
  return new Promise((entregar, falhar) => {
    fila[naFrente ? "unshift" : "push"]({ consulta, sinal, entregar, falhar });
    atender();
  });
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

// Produtos de um fluxo (o que o Brasil vende ou compra), do maior para o menor volume: o peso ao lado
// do nome e, embaixo, a barra proporcional ao maior da lista e o valor em dólares.
function Volumes({ ano }) {
  const maior = Math.max(...ano.produtos.map(p => p.kg), 1);
  return (
    <ol className="mt-2 space-y-2">
      {ano.produtos.map(p => (
        <li key={p.nome} className="text-xs">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-slate-800">{p.nome}</span>
            <strong className="whitespace-nowrap text-slate-900" style={{ fontVariantNumeric: "tabular-nums" }}>{toneladas(p.kg)}</strong>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="block flex-1 overflow-hidden rounded-full" style={{ height: 6, background: "#e2e8f0" }}><span className="block" style={{ height: "100%", width: `${Math.max(1, p.kg / maior * 100)}%`, background: AZUL }} /></span>
            <span className="whitespace-nowrap text-slate-500" style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}>{dolares(p.fob)}</span>
          </div>
        </li>
      ))}
      {ano.outros.quantos > 0 && <li className="text-xs text-slate-500">Mais {ano.outros.quantos} {ano.outros.quantos > 1 ? "produtos" : "produto"}: {toneladas(ano.outros.kg)} · {dolares(ano.outros.fob)}</li>}
    </ol>
  );
}

// Comércio do agro com um país: o visitante digita o país e vê o que o Brasil vende para ele e o que
// compra dele. São duas consultas na fonte (parte=pais), uma depois da outra.
const FLUXOS = [["export", "O Brasil vende", "exportações", "O Brasil não vendeu produtos do agro para este país"], ["import", "O Brasil compra", "importações", "O Brasil não comprou produtos do agro deste país"]];

function ComercioComPais({ ultimoMes }) {
  const [texto, setTexto] = useState("");
  const [consulta, setConsulta] = useState(null); // { pais: [código, nome] }; objeto novo a cada pedido, para consultar de novo
  const [opcoes, setOpcoes] = useState(null); // países que combinam com o texto, quando não deu para saber qual é
  const [dados, setDados] = useState({}); // { export, import }: a resposta de cada fluxo, ou { erro: true }
  const [anoEscolhido, setAnoEscolhido] = useState(null);

  useEffect(() => {
    if (!consulta) return;
    const controle = new AbortController();
    const fluxo = nome => buscar(`parte=pais&pais=${consulta.pais[0]}&fluxo=${nome}`, controle.signal, true)
      .then(resposta => { if (!controle.signal.aborted) setDados(d => ({ ...d, [nome]: resposta })); })
      .catch(() => { if (!controle.signal.aborted) setDados(d => ({ ...d, [nome]: { erro: true } })); });
    // um fluxo depois do outro: a fonte não aceita dois pedidos juntos
    fluxo("export").then(() => fluxo("import"));
    return () => controle.abort();
  }, [consulta]);

  const consultar = (pais) => { setConsulta({ pais }); setTexto(pais[1]); setOpcoes(null); setDados({}); setAnoEscolhido(null); };
  const procurar = (evento) => {
    evento.preventDefault();
    const achado = acharPais(texto);
    if (achado.pais) consultar(achado.pais); else setOpcoes(achado.opcoes);
  };

  const pais = consulta?.pais;
  const anos = [...new Set(FLUXOS.flatMap(([fluxo]) => dados[fluxo]?.anos?.map(a => a.ano) ?? []))].sort((a, b) => b - a);
  const ano = anos.includes(anoEscolhido) ? anoEscolhido : anos[0];
  // o ano do último mês publicado ainda está pela metade
  const rotuloDoAno = (a) => {
    if (!ultimoMes) return String(a);
    const mes = Number(ultimoMes.slice(5, 7));
    return a === Number(ultimoMes.slice(0, 4)) && mes < 12 ? `${a} · ${mes > 1 ? `jan a ${MESES[mes - 1]}` : "jan"}` : `${a} · ano inteiro`;
  };
  const totalDe = fluxo => dados[fluxo]?.anos?.find(a => a.ano === ano)?.total ?? { kg: 0, fob: 0 };
  const completo = FLUXOS.every(([fluxo]) => dados[fluxo]?.anos);
  const saldo = totalDe("export").fob - totalDe("import").fob;

  return (
    <section id="comercio-pais" className="rounded-xl border bg-white p-3 shadow-sm" style={{ scrollMarginTop: 100 }}>
      <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>Comércio do agro com um país</h3>
      <p className="text-xs text-slate-600 mt-1">Digite um país para ver quanto o Brasil vende para ele e quanto compra dele, produto por produto.</p>
      <form onSubmit={procurar} className="flex gap-1.5 mt-3">
        <label className="flex-1 min-w-0">
          <span className="sr-only">País</span>
          <input list="paises-do-comex" value={texto} onChange={e => { setTexto(e.target.value); setOpcoes(null); }} placeholder="País (ex.: China)" autoComplete="off"
            className="block w-full rounded-lg border bg-white p-2 text-base sm:text-sm text-slate-900" />
        </label>
        <datalist id="paises-do-comex">{PAISES.map(([codigo, nome]) => <option key={codigo} value={nome} />)}</datalist>
        <button type="submit" className="flex items-center gap-1 rounded-lg px-3 text-xs font-bold text-white" style={{ background: "#166534" }}><Search size={12} aria-hidden="true" />Ver</button>
      </form>
      {opcoes && (opcoes.length ? (
        <div className="mt-2">
          <p className="text-xs text-slate-600">Mais de um país combina com esse nome. Qual deles?</p>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {opcoes.slice(0, 12).map(opcao => <button key={opcao[0]} type="button" onClick={() => consultar(opcao)} className="rounded-full border px-3 py-1 text-xs font-bold" style={{ background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}>{opcao[1]}</button>)}
          </div>
        </div>
      ) : <p role="alert" className="text-xs text-amber-800 mt-2">Não achei esse país. Confira o nome (ex.: China, Estados Unidos, Argentina).</p>)}

      {pais && <>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
          <h4 className="text-sm font-bold text-slate-900">Brasil e {pais[1]}</h4>
          {anos.length > 1 ? <Botoes rotulo="Período" opcoes={anos.map(a => [a, rotuloDoAno(a)])} ativo={ano} onEscolher={setAnoEscolhido} />
            : ano && <span className="text-xs text-slate-500">{rotuloDoAno(ano)}</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mt-3">
          {FLUXOS.map(([fluxo, titulo, tipo, vazio]) => {
            const resposta = dados[fluxo];
            const doAno = resposta?.anos?.find(a => a.ano === ano);
            return (
              <div key={fluxo}>
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">{titulo} <span className="font-normal normal-case tracking-normal">({tipo})</span></h5>
                {!resposta ? <p className="text-xs text-slate-500 mt-1.5">Buscando na fonte oficial, que só aceita um pedido de cada vez. Costuma levar meio minuto; na primeira consulta do dia, até dois minutos…</p>
                  : resposta.erro ? <p role="alert" className="text-xs text-amber-800 mt-1.5">Não foi possível buscar as {tipo} agora. Toque em “Ver” para tentar de novo.</p>
                    : !doAno ? <p className="text-xs text-slate-500 mt-1.5">{vazio}{ano ? ` em ${ano}` : " neste ano nem no anterior"}.</p>
                      : <>
                        <p className="mt-1"><strong className="text-lg font-black text-slate-900">{toneladas(doAno.total.kg)}</strong> <span className="text-xs text-slate-500">· {dolares(doAno.total.fob)}</span></p>
                        <Volumes ano={doAno} />
                      </>}
              </div>
            );
          })}
        </div>
        {completo && ano && (
          <p className="rounded-lg p-2.5 mt-3 text-xs text-slate-700" style={{ background: "#f8fafc" }}>
            Saldo do agro neste comércio em {ano}: <strong style={{ color: saldo >= 0 ? "#15803d" : "#b91c1c" }}>{saldo >= 0 ? "+" : "−"}{dolares(Math.abs(saldo))}</strong>{" "}
            ({saldo >= 0 ? "o Brasil vendeu mais do que comprou" : "o Brasil comprou mais do que vendeu"}).
          </p>
        )}
        <p className="text-xs text-slate-500 mt-2">
          Entram os produtos da agropecuária e os alimentos (capítulos 1 a 24 do Sistema Harmonizado), o algodão em pluma e os adubos; minério, petróleo e
          produtos da indústria ficam de fora. Peso líquido embarcado; os dólares são o valor da mercadoria no embarque (FOB).
        </p>
      </>}
    </section>
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
    buscar("parte=produtos", controle.signal).then(setProdutos).catch(() => { if (!controle.signal.aborted) setErro(e => ({ ...e, produtos: true })); })
      .then(() => buscar("parte=destinos", controle.signal)).then(setDestinos).catch(() => { if (!controle.signal.aborted) setErro(e => ({ ...e, destinos: true })); });
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

      <ComercioComPais ultimoMes={produtos?.ultimoMes} />

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
