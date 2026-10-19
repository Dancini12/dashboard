import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Aba "Safra": quanto o Paraná e a região de Cornélio Procópio plantam e colhem (DERAL), como
// andam o plantio, a colheita e a venda, o calendário agrícola do estado, a produção de
// Santa Mariana ano a ano e a safra do Brasil (IBGE). Dados em /api/market?type=safra.
const AZUL = "#2a78d6";
const AZUL_CLARO = "#86b6ef"; // safra ainda em previsão
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const TONELADAS_POR_HECTARE = /cana|mandioca/i; // as demais culturas são mostradas em sacas de 60 kg por hectare
const MARCA_NO_CALENDARIO = 5; // pontos percentuais no mês para ele entrar no calendário

const inteiro = v => Math.round(v).toLocaleString("pt-BR");
const decimal = (v, casas = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });
const milToneladas = t => `${decimal(t / 1000, t >= 100000 ? 0 : 1)} mil t`;
const toneladas = t => (t >= 1e6 ? `${decimal(t / 1e6, 1)} milhões de t` : t >= 10000 ? milToneladas(t) : `${inteiro(t)} t`);
const hectares = ha => (ha >= 10000 ? `${decimal(ha / 1000, ha >= 100000 ? 0 : 1)} mil ha` : `${inteiro(ha)} ha`);
const rendimento = (kgPorHa, cultura) => (kgPorHa == null ? "—" : TONELADAS_POR_HECTARE.test(cultura) ? `${decimal(kgPorHa / 1000)} t/ha` : `${decimal(kgPorHa / 60)} sacas/ha`);
const variacao = (atual, anterior) => (anterior > 0 && atual != null ? (atual - anterior) / anterior * 100 : null);
const comSinal = v => `${v > 0 ? "+" : v < 0 ? "−" : ""}${decimal(Math.abs(v))}%`;
const mesAno = mes => `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;
const maiorPct = meses => Math.max(...meses.map(m => m.pct));

function Variacao({ valor, sufixo = "" }) {
  if (valor == null) return null;
  return <span className="font-semibold" style={{ color: valor > 0 ? "#15803d" : valor < 0 ? "#b91c1c" : "#64748b" }}>{valor > 0 ? "▲ " : valor < 0 ? "▼ " : ""}{comSinal(valor)}{sufixo}</span>;
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

function DicaDeProducao({ active, payload }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-lg border bg-white px-2.5 py-2 text-xs shadow-md" style={{ borderColor: "#e2e8f0" }}>
      <div className="font-semibold text-slate-500">{p.rotulo}{p.previsao ? " · previsão" : ""}</div>
      <div className="mt-1"><strong className="text-slate-900">{toneladas(p.producao)}</strong></div>
      {p.detalhe && <div className="text-slate-600">{p.detalhe}</div>}
    </div>
  );
}
function GraficoDeProducao({ dados }) {
  return (
    <div style={{ height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={dados} margin={{ top: 10, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="rotulo" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} />
          <YAxis width={58} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={v => (v >= 1e6 ? `${decimal(v / 1e6)} mi` : v >= 1000 ? `${decimal(v / 1000, 0)} mil` : v)} />
          <Tooltip cursor={{ fill: "#f1f5f9" }} content={<DicaDeProducao />} />
          <Bar dataKey="producao" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
            {dados.map(d => <Cell key={d.rotulo} fill={d.previsao ? AZUL_CLARO : AZUL} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Meses do ano em que cada operação acontece, pela safra completa mais recente da cultura.
function mesesDoCalendario(cultura) {
  const completa = operacao => cultura.andamento.filter(a => a.operacao === operacao && maiorPct(a.meses) >= 100).at(-1);
  return Object.fromEntries(["Plantio", "Colheita"].map(operacao => {
    const serie = completa(operacao);
    const marcados = new Set();
    serie?.meses.forEach((m, i) => { if (m.pct - (serie.meses[i - 1]?.pct ?? 0) >= MARCA_NO_CALENDARIO) marcados.add(Number(m.mes.slice(5, 7)) - 1); });
    return [operacao, marcados];
  }));
}

export default function SafraTab() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(false);
  const [cultura, setCultura] = useState("Soja (1ª safra)");
  const [local, setLocal] = useState("regiao");
  const [doMunicipio, setDoMunicipio] = useState("Soja");

  useEffect(() => {
    let ativo = true;
    fetch("/api/market?type=safra", { signal: AbortSignal.timeout(45000) })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("indisponível"))))
      .then(d => { if (ativo) setDados(d); })
      .catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, []);

  const { parana, municipio, brasil } = dados ?? {};
  const escolhida = parana?.culturas.find(c => c.nome === cultura) ?? parana?.culturas[0];
  const colhida = safra => escolhida.andamento.some(a => a.safra === safra && a.operacao === "Colheita" && maiorPct(a.meses) >= 100);
  const safrasComCalendario = escolhida ? [...new Set(escolhida.andamento.map(a => a.safra))] : [];
  const linhas = escolhida ? escolhida[local].filter(l => l.producao > 0).map(l => ({ ...l, rotulo: l.safra, previsao: safrasComCalendario.includes(l.safra) && !colhida(l.safra),
    detalhe: `${hectares(l.area)} · ${rendimento(l.rendimento, escolhida.nome)}` })) : [];
  const ultima = linhas.at(-1), penultima = linhas.at(-2);
  const mesAtual = new Date().getMonth();
  const cidade = municipio?.culturas.find(c => c.nome === doMunicipio) ?? municipio?.culturas[0];
  const anosDaCidade = cidade ? municipio.anos.map((ano, i) => ({ rotulo: String(ano), producao: cidade.producao[i] ?? 0, area: cidade.area[i], rendimento: cidade.rendimento[i],
    detalhe: cidade.area[i] ? `${hectares(cidade.area[i])} colhidos · ${rendimento(cidade.rendimento[i], cidade.nome)}` : null })) : [];
  const ultimoAno = anosDaCidade.at(-1), anoAnterior = anosDaCidade.at(-2);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-white p-3 shadow-sm">
        <h2 className="text-sm font-bold text-green-800">Safra · do Paraná a Santa Mariana</h2>
        <p className="text-xs text-slate-600 mt-1">
          Quanto se planta e se colhe, como andam o plantio e a colheita e em que meses cada cultura vai para o campo. A oferta mexe
          com o preço: safra grande tende a derrubar a cotação, quebra de safra tende a subir.
        </p>
        {parana?.atualizadoEm && <p className="text-xs text-slate-500 mt-1">Estimativa do DERAL atualizada em {parana.atualizadoEm.split("-").reverse().join("/")}. O DERAL revisa os números uma vez por mês.</p>}
      </section>

      {!dados && !erro && <p className="text-sm text-slate-500">Carregando os dados de safra…</p>}
      {erro && <p role="alert" className="rounded-xl border p-3 text-sm text-amber-800 bg-amber-50">Os dados de safra não estão disponíveis agora. Tente novamente em alguns minutos.</p>}

      {escolhida && <>
        <section className="rounded-xl border bg-white p-3 shadow-sm">
          <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>Produção por safra</h3>
          <div className="space-y-2 mt-2">
            <Botoes rotulo="Cultura" opcoes={parana.culturas.map(c => [c.nome, c.nome])} ativo={escolhida.nome} onEscolher={setCultura} />
            <Botoes rotulo="Lugar" opcoes={[["regiao", `Região de ${parana.regiao}`], ["parana", "Paraná inteiro"]]} ativo={local} onEscolher={setLocal} />
          </div>
          {ultima ? <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
              <Numero rotulo={`Produção ${ultima.safra}${ultima.previsao ? " (previsão)" : ""}`} valor={toneladas(ultima.producao)}>
                {penultima && <><Variacao valor={variacao(ultima.producao, penultima.producao)} /> sobre {penultima.safra}</>}
              </Numero>
              <Numero rotulo="Área plantada" valor={hectares(ultima.area)}>{penultima && <><Variacao valor={variacao(ultima.area, penultima.area)} /> sobre {penultima.safra}</>}</Numero>
              <Numero rotulo="Rendimento" valor={rendimento(ultima.rendimento, escolhida.nome)}>{penultima?.rendimento && <><Variacao valor={variacao(ultima.rendimento, penultima.rendimento)} /> sobre {penultima.safra}</>}</Numero>
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-4 mb-1 text-xs text-slate-700">
              <li className="flex items-center gap-1.5"><span className="rounded-sm" style={{ width: 10, height: 10, background: AZUL }} aria-hidden="true" />Safra colhida</li>
              <li className="flex items-center gap-1.5"><span className="rounded-sm" style={{ width: 10, height: 10, background: AZUL_CLARO }} aria-hidden="true" />Previsão (ainda no campo)</li>
              <li className="text-slate-500">Toneladas</li>
            </ul>
            <GraficoDeProducao dados={linhas} />
            <details className="mt-2 text-xs text-slate-600">
              <summary className="cursor-pointer font-semibold text-green-800">Ver os números em tabela</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr style={{ background: "#166534", color: "#fff" }}><th className="py-1.5 px-2 text-left">Safra</th><th className="py-1.5 px-2 text-right">Produção</th><th className="py-1.5 px-2 text-right">Área</th><th className="py-1.5 px-2 text-right">Rendimento</th></tr></thead>
                  <tbody>{[...linhas].reverse().map((l, i) => (
                    <tr key={l.safra} style={{ background: i % 2 ? "#fff" : "#f8fafc" }}>
                      <td className="py-1 px-2 font-semibold">{l.safra}{l.previsao && <span className="font-normal text-slate-500"> (previsão)</span>}</td>
                      <td className="py-1 px-2 text-right font-mono">{toneladas(l.producao)}</td><td className="py-1 px-2 text-right font-mono">{hectares(l.area)}</td><td className="py-1 px-2 text-right font-mono">{rendimento(l.rendimento, escolhida.nome)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </details>
          </> : <p className="text-sm text-slate-500 mt-3">A região de {parana.regiao} não tem produção registrada de {escolhida.nome.toLowerCase()}. Veja o Paraná inteiro.</p>}
        </section>

        <section className="rounded-xl border bg-white p-3 shadow-sm">
          <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>Plantio, colheita e venda · {escolhida.nome} <span className="text-xs font-normal text-slate-500">· Paraná</span></h3>
          <p className="text-xs text-slate-600 mt-1">Quanto da área já foi plantada e colhida e quanto da produção já foi vendida, no último levantamento mensal.</p>
          {safrasComCalendario.length ? [...safrasComCalendario].reverse().map(safra => (
            <div key={safra} className="mt-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Safra {safra}</div>
              <div className="space-y-1.5 mt-1.5">
                {escolhida.andamento.filter(a => a.safra === safra).map(a => {
                  const pct = maiorPct(a.meses);
                  const quando = a.meses.find(m => m.pct === pct).mes;
                  return (
                    <div key={a.operacao} className="text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-700">{a.operacao === "Comercialização" ? "Venda" : a.operacao}</span>
                        <span className="text-slate-600"><strong className="text-slate-900">{decimal(pct)}%</strong> {pct >= 100 ? `concluído em ${mesAno(quando)}` : `até ${mesAno(quando)}`}</span>
                      </div>
                      <span className="block rounded-full overflow-hidden mt-0.5" style={{ height: 8, background: "#cde2fb" }}><span className="block" style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: AZUL }} /></span>
                    </div>
                  );
                })}
              </div>
            </div>
          )) : <p className="text-sm text-slate-500 mt-2">Sem acompanhamento mensal para esta cultura.</p>}
        </section>

        <section className="rounded-xl border bg-white p-3 shadow-sm">
          <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>Calendário agrícola do Paraná</h3>
          <p className="text-xs text-slate-600 mt-1">Meses em que cada cultura é plantada (P) e colhida (C), conforme a última safra completa. O mês atual está destacado.</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs text-center" style={{ minWidth: 520 }}>
              <thead><tr style={{ background: "#166534", color: "#fff" }}><th className="py-1.5 px-2 text-left">Cultura</th>{MESES.map((m, i) => <th key={m} className="py-1.5 px-1" style={i === mesAtual ? { background: "#14532d", outline: "2px solid #fbbf24", outlineOffset: -2 } : undefined}>{m}</th>)}</tr></thead>
              <tbody>{parana.culturas.map((c, linha) => {
                const calendario = mesesDoCalendario(c);
                if (!calendario.Plantio.size && !calendario.Colheita.size) return null;
                return (
                  <tr key={c.nome} style={{ background: linha % 2 ? "#fff" : "#f8fafc" }}>
                    <td className="py-1 px-2 text-left font-semibold whitespace-nowrap">{c.nome}</td>
                    {MESES.map((m, i) => {
                      const planta = calendario.Plantio.has(i), colhe = calendario.Colheita.has(i);
                      return (
                        <td key={m} className="py-1 px-0.5" style={i === mesAtual ? { background: "#fef9c3" } : undefined}>
                          {planta && <span className="inline-block rounded px-1 font-bold" style={{ background: "#dcfce7", color: "#14532d" }} title={`Plantio de ${c.nome.toLowerCase()} em ${m}`}>P</span>}
                          {colhe && <span className="inline-block rounded px-1 font-bold" style={{ background: "#ffedd5", color: "#7c2d12" }} title={`Colheita de ${c.nome.toLowerCase()} em ${m}`}>C</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">Entra no calendário o mês em que pelo menos {MARCA_NO_CALENDARIO}% da área do estado foi plantada ou colhida. A janela oficial de plantio de cada município é a do zoneamento agrícola (ZARC) do Ministério da Agricultura.</p>
        </section>
      </>}

      {cidade && (
        <section className="rounded-xl border bg-white p-3 shadow-sm">
          <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>Santa Mariana, ano a ano</h3>
          <p className="text-xs text-slate-600 mt-1">Produção do município segundo a pesquisa anual do IBGE.</p>
          <div className="mt-2"><Botoes rotulo="Cultura em Santa Mariana" opcoes={municipio.culturas.map(c => [c.nome, c.nome])} ativo={cidade.nome} onEscolher={setDoMunicipio} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
            <Numero rotulo={`Produção em ${ultimoAno.rotulo}`} valor={toneladas(ultimoAno.producao)}>{anoAnterior && <><Variacao valor={variacao(ultimoAno.producao, anoAnterior.producao)} /> sobre {anoAnterior.rotulo}</>}</Numero>
            <Numero rotulo="Área colhida" valor={ultimoAno.area != null ? hectares(ultimoAno.area) : "—"} />
            <Numero rotulo="Rendimento" valor={rendimento(ultimoAno.rendimento, cidade.nome)} />
          </div>
          <p className="text-xs text-slate-500 mt-4 mb-1">Toneladas produzidas por ano</p>
          <GraficoDeProducao dados={anosDaCidade} />
        </section>
      )}

      {brasil && (
        <section className="rounded-xl border bg-white p-3 shadow-sm">
          <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>Safra {brasil.ano} no Brasil e a parte do Paraná</h3>
          <p className="text-xs text-slate-600 mt-1">Estimativa do IBGE de {brasil.referencia}, comparada com o resultado de {brasil.ano - 1}.</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr style={{ background: "#166534", color: "#fff" }}>
                <th className="py-1.5 px-2 text-left">Cultura</th><th className="py-1.5 px-2 text-right">Brasil</th><th className="py-1.5 px-2 text-right hidden sm:table-cell">Sobre {brasil.ano - 1}</th><th className="py-1.5 px-2 text-right">Paraná</th><th className="py-1.5 px-2 text-right">Parte do PR</th>
              </tr></thead>
              <tbody>{brasil.culturas.map((c, i) => (
                <tr key={c.nome} style={{ background: i % 2 ? "#fff" : "#f8fafc" }}>
                  <td className="py-1 px-2 font-semibold">{c.nome}</td>
                  <td className="py-1 px-2 text-right font-mono whitespace-nowrap">{toneladas(c.brasil.producao)}<span className="block sm:hidden font-sans"><Variacao valor={variacao(c.brasil.producao, c.brasil.anterior)} /></span></td>
                  <td className="py-1 px-2 text-right hidden sm:table-cell"><Variacao valor={variacao(c.brasil.producao, c.brasil.anterior)} /></td>
                  <td className="py-1 px-2 text-right font-mono whitespace-nowrap">{c.parana.producao ? toneladas(c.parana.producao) : "—"}</td>
                  <td className="py-1 px-2 text-right font-mono font-bold">{c.parana.producao ? `${decimal(c.parana.producao / c.brasil.producao * 100)}%` : "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}

      <p className="text-xs text-slate-500">
        Fontes: DERAL/SEAB-PR, previsão de safra por núcleo regional{parana?.arquivo && <> (<a className="underline" href={parana.arquivo} target="_blank" rel="noopener noreferrer">planilha</a>)</>};
        IBGE, Produção Agrícola Municipal e Levantamento Sistemático da Produção Agrícola. As previsões mudam ao longo da safra conforme o clima.
      </p>
    </div>
  );
}
