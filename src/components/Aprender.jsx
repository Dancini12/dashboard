import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { hedge } from "../calculos";
import { ETAPAS, contas, resultado, sortear } from "../simulacao";

// Aba "Aprender": a simulação de uma safra (o aluno decide, situação por situação, como um
// produtor) e o simulador de hedge (trava um preço e vê o que acontece se o mercado subir ou cair).
const COR_SEM_HEDGE = "#2a78d6";
const COR_COM_HEDGE = "#eb6834";
const NIVEIS = {
  boa: { rotulo: "Boa prática", marca: "✓", fundo: "#f0fdf4", borda: "#86efac", cor: "#14532d" },
  aceitavel: { rotulo: "Dá para melhorar", marca: "≈", fundo: "#fffbeb", borda: "#fde68a", cor: "#78350f" },
  arriscada: { rotulo: "Decisão arriscada", marca: "!", fundo: "#fef2f2", borda: "#fecaca", cor: "#7f1d1d" },
};
const CLIMA = { normal: "choveu na hora certa", seca: "houve um veranico em dezembro" };
const MERCADO = { queda: "o preço caiu até a colheita", alta: "o preço subiu até a colheita" };

const numero = texto => {
  const limpo = String(texto ?? "").trim();
  return limpo ? Number(limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo) : NaN;
};
const reais = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const porSaca = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Campo({ rotulo, valor, onChange, sufixo }) {
  return (
    <label className="block text-xs text-slate-600">{rotulo}
      <span className="flex items-center gap-1.5 mt-1">
        <input value={valor} onChange={e => onChange(e.target.value)} inputMode="decimal" className="block w-full min-w-0 rounded-lg border bg-white p-2 text-sm text-slate-900" />
        <span className="shrink-0 text-slate-500">{sufixo}</span>
      </span>
    </label>
  );
}

function DicaDoHedge({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white px-2.5 py-2 text-xs shadow-md" style={{ borderColor: "#e2e8f0" }}>
      <div className="font-semibold text-slate-500">Saca a {porSaca(label)} na colheita</div>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mt-1">
          <span className="shrink-0 rounded-full" style={{ width: 12, height: 3, background: p.color }} />
          <strong className="text-slate-900">{reais(p.value)}</strong><span className="text-slate-600">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

function SimuladorDeHedge() {
  const [sacas, setSacas] = useState("1000");
  const [travado, setTravado] = useState("130");
  const [custo, setCusto] = useState("100");
  const [mudanca, setMudanca] = useState(-20); // % do preço na colheita em relação ao travado
  const qtd = numero(sacas), precoTravado = numero(travado), custoPorSaca = numero(custo);
  const pronto = qtd > 0 && precoTravado > 0 && custoPorSaca >= 0;
  const naColheita = precoTravado * (1 + mudanca / 100);
  const r = pronto ? hedge({ sacas: qtd, travado: precoTravado, naColheita, custoPorSaca }) : null;
  const curva = pronto ? Array.from({ length: 11 }, (_, i) => {
    const preco = Math.round(precoTravado * (0.5 + i * 0.1) * 100) / 100;
    const ponto = hedge({ sacas: qtd, travado: precoTravado, naColheita: preco });
    return { preco, semHedge: ponto.semHedge, comHedge: ponto.comHedge };
  }) : [];
  const diferenca = r ? r.comHedge - r.semHedge : 0;

  return (
    <section id="simulador-hedge" className="rounded-xl border bg-white p-3 shadow-sm" style={{ scrollMarginTop: 100 }}>
      <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>Simulador de hedge</h3>
      <p className="text-xs text-slate-600 mt-1">
        Você é produtor e trava hoje, no mercado futuro, o preço de venda da sua safra. Mova a barra para ver o que acontece
        com a sua receita se, na colheita, o preço tiver caído ou subido.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        <Campo rotulo="Tamanho da safra" valor={sacas} onChange={setSacas} sufixo="sacas" />
        <Campo rotulo="Preço travado hoje" valor={travado} onChange={setTravado} sufixo="R$/saca" />
        <Campo rotulo="Custo de produção" valor={custo} onChange={setCusto} sufixo="R$/saca" />
      </div>
      {!pronto ? <p className="text-sm text-slate-500 mt-3">Preencha os três campos com números para simular.</p> : <>
        <label className="block mt-4 text-xs text-slate-600">
          Preço no dia da colheita: <strong className="text-sm text-slate-900">{porSaca(naColheita)} por saca</strong> ({mudanca > 0 ? "+" : ""}{mudanca}% em relação ao preço travado)
          <input type="range" min={-50} max={50} step={5} value={mudanca} onChange={e => setMudanca(Number(e.target.value))} className="block w-full mt-2" style={{ accentColor: "#166534" }} />
          <span className="flex justify-between text-slate-500"><span>caiu pela metade</span><span>igual</span><span>subiu 50%</span></span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          <div className="rounded-lg p-2.5" style={{ background: "#f8fafc" }}>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700"><span className="rounded-full" style={{ width: 14, height: 4, background: COR_SEM_HEDGE }} aria-hidden="true" />Sem hedge</div>
            <div className="text-xl font-black text-slate-900 mt-1">{reais(r.semHedge)}</div>
            <div className="text-xs text-slate-500">vende tudo pelo preço do dia</div>
            <div className="text-xs mt-1.5 font-semibold" style={{ color: r.lucroSemHedge >= 0 ? "#15803d" : "#b91c1c" }}>{r.lucroSemHedge >= 0 ? "Lucro" : "Prejuízo"} de {reais(Math.abs(r.lucroSemHedge))}</div>
          </div>
          <div className="rounded-lg p-2.5" style={{ background: "#f8fafc" }}>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700"><span className="rounded-full" style={{ width: 14, height: 4, background: COR_COM_HEDGE }} aria-hidden="true" />Com hedge</div>
            <div className="text-xl font-black text-slate-900 mt-1">{reais(r.comHedge)}</div>
            <div className="text-xs text-slate-500">{reais(r.fisico)} da venda {r.ajusteDaBolsa >= 0 ? "+" : "−"} {reais(Math.abs(r.ajusteDaBolsa))} {r.ajusteDaBolsa >= 0 ? "recebidos da" : "pagos à"} bolsa</div>
            <div className="text-xs mt-1.5 font-semibold" style={{ color: r.lucroComHedge >= 0 ? "#15803d" : "#b91c1c" }}>{r.lucroComHedge >= 0 ? "Lucro" : "Prejuízo"} de {reais(Math.abs(r.lucroComHedge))}</div>
          </div>
        </div>
        <p className="rounded-lg p-2.5 mt-2 text-xs" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#78350f" }}>
          {diferenca > 0 && <><strong>O preço caiu e o hedge protegeu:</strong> você recebeu {reais(diferenca)} a mais do que receberia sem a trava.</>}
          {diferenca < 0 && <><strong>O preço subiu e o hedge custou:</strong> você deixou de ganhar {reais(-diferenca)}. É o preço da segurança: a receita já estava garantida antes de plantar.</>}
          {diferenca === 0 && <><strong>O preço ficou igual:</strong> com ou sem hedge, a receita é a mesma.</>}
        </p>

        <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-4 mb-1 text-xs text-slate-700">
          <li className="flex items-center gap-1.5"><span className="rounded-full" style={{ width: 14, height: 3, background: COR_SEM_HEDGE }} aria-hidden="true" />Receita sem hedge</li>
          <li className="flex items-center gap-1.5"><span className="rounded-full" style={{ width: 14, height: 3, background: COR_COM_HEDGE }} aria-hidden="true" />Receita com hedge</li>
          <li className="text-slate-500">Em reais</li>
        </ul>
        <div style={{ height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={curva} margin={{ top: 14, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="preco" type="number" domain={["dataMin", "dataMax"]} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} tickFormatter={v => `R$ ${Math.round(v)}`} />
              <YAxis width={50} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={v => (v ? `${Math.round(v / 1000)} mil` : "0")} />
              <Tooltip cursor={{ stroke: "#94a3b8" }} content={<DicaDoHedge />} />
              <ReferenceLine x={Math.round(naColheita * 100) / 100} stroke="#64748b" label={{ value: "colheita", position: "top", fontSize: 10, fill: "#64748b" }} />
              <Line type="linear" dataKey="semHedge" name="sem hedge" stroke={COR_SEM_HEDGE} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="linear" dataKey="comHedge" name="com hedge" stroke={COR_COM_HEDGE} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Eixo de baixo: preço da saca no dia da colheita. A linha do hedge é reta porque a receita não depende mais do mercado.
          Simulação simplificada: não inclui a diferença entre o preço da região e o da bolsa (base), a corretagem nem o depósito de garantia que a bolsa exige.
        </p>
      </>}
    </section>
  );
}

function Marca({ nivel }) {
  const n = NIVEIS[nivel];
  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap" style={{ background: n.fundo, border: `1px solid ${n.borda}`, color: n.cor }}><span aria-hidden="true">{n.marca}</span>{n.rotulo}</span>;
}

function SimulacaoDaSafra({ onPerguntar }) {
  const [partida, setPartida] = useState(null); // { sorteio, escolhas, etapa, respondida }
  const comecar = () => {
    setPartida({ sorteio: sortear(), escolhas: {}, etapa: 0, respondida: false });
    requestAnimationFrame(() => document.getElementById("simulacao-safra")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const avancar = () => {
    setPartida(p => ({ ...p, etapa: p.etapa + 1, respondida: false }));
    requestAnimationFrame(() => document.getElementById("simulacao-safra")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const etapa = partida && ETAPAS[partida.etapa];
  const c = partida && contas(partida.escolhas, partida.sorteio);
  const feito = id => partida.escolhas[id] != null;
  const final = partida && !etapa ? resultado(partida.escolhas, partida.sorteio) : null;

  return (
    <section id="simulacao-safra" className="rounded-xl border bg-white p-3 shadow-sm" style={{ scrollMarginTop: 100 }}>
      <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>Simulação: uma safra na prática</h3>

      {!partida && <>
        <p className="text-xs text-slate-600 mt-1">
          Você é produtor de soja em Santa Mariana, com 50 alqueires e R$ 300.000 em caixa. Do pedido da semente à venda da colheita, são {ETAPAS.length} situações
          em que é você quem decide: comprar, financiar, negociar o preço, travar na bolsa, vender ou guardar. Cada decisão mexe no seu resultado.
        </p>
        <p className="text-xs text-slate-600 mt-1">O clima e o mercado são sorteados a cada partida: a mesma decisão pode dar resultados diferentes, como na vida real.</p>
        <button type="button" onClick={comecar} className="rounded-lg px-4 py-2 mt-3 text-sm font-bold text-white" style={{ background: "#166534" }}>Começar a safra</button>
      </>}

      {etapa && (() => {
        const situacao = etapa.situacao(c, partida.sorteio);
        const retorno = partida.respondida ? etapa.retorno(c, partida.sorteio) : null;
        const escolhida = partida.escolhas[etapa.id];
        return <>
          <div className="flex items-center gap-2 mt-2" aria-label={`Situação ${partida.etapa + 1} de ${ETAPAS.length}`}>
            {ETAPAS.map((e, i) => <span key={e.id} className="h-1.5 flex-1 rounded-full" style={{ background: i < partida.etapa || (i === partida.etapa && partida.respondida) ? "#166534" : i === partida.etapa ? "#86efac" : "#e2e8f0" }} />)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
            <span>Situação {partida.etapa + 1} de {ETAPAS.length} · {etapa.quando}</span>
            <span className="flex flex-wrap gap-x-3">
              {feito("custeio") && <span>Lavoura: <strong className="text-slate-700">{Math.round(c.area)} ha</strong></span>}
              {feito("custeio") && <span>Dívida: <strong className="text-slate-700">{c.divida > 0 ? reais(c.divida) : "nenhuma"}</strong></span>}
              {feito("trava") && <span>Travado: <strong className="text-slate-700">{Math.round(c.travadas).toLocaleString("pt-BR")} sacas a {reais(c.precoTravado)}</strong></span>}
            </span>
          </div>
          <h4 className="text-base font-bold text-slate-900 mt-2">{etapa.titulo}</h4>
          <p className="text-sm text-slate-700 mt-1 leading-relaxed">{situacao.texto}</p>
          <dl className="grid grid-cols-2 gap-2 mt-3">
            {situacao.dados.map(([rotulo, valor]) => (
              <div key={rotulo} className="rounded-lg p-2" style={{ background: "#f8fafc" }}><dt className="text-xs text-slate-500">{rotulo}</dt><dd className="text-sm font-bold text-slate-900">{valor}</dd></div>
            ))}
          </dl>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-4">O que você faz?</p>
          <div className="grid grid-cols-1 gap-2 mt-1.5">
            {etapa.opcoes(c, partida.sorteio).map(([id, texto]) => {
              const esta = partida.respondida && id === escolhida;
              return (
                <button key={id} type="button" disabled={partida.respondida} aria-pressed={esta}
                  onClick={() => setPartida(p => ({ ...p, escolhas: { ...p.escolhas, [etapa.id]: id }, respondida: true }))}
                  className="rounded-lg border p-2.5 text-left text-sm"
                  style={esta ? { background: "#14532d", borderColor: "#14532d", color: "#fff", fontWeight: 700 } : { background: "#f8fafc", borderColor: "#e2e8f0", color: partida.respondida ? "#94a3b8" : "#0f172a" }}>
                  {texto}
                </button>
              );
            })}
          </div>
          {retorno && <>
            <div className="rounded-lg p-3 mt-3 text-sm" style={{ background: NIVEIS[retorno.nivel].fundo, border: `1px solid ${NIVEIS[retorno.nivel].borda}`, color: NIVEIS[retorno.nivel].cor }} role="status">
              <div className="flex flex-wrap items-center gap-2"><Marca nivel={retorno.nivel} /><strong>{retorno.titulo}</strong></div>
              <p className="mt-1.5 leading-relaxed">{retorno.texto}</p>
              <p className="mt-1.5 text-xs"><strong>O que fica de lição:</strong> {etapa.licao}</p>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <button type="button" onClick={avancar} className="rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ background: "#166534" }}>
                {partida.etapa + 1 < ETAPAS.length ? "Próxima situação" : "Ver o resultado da safra"}
              </button>
              {onPerguntar && <button type="button" onClick={() => onPerguntar(`Explique melhor para um aluno: ${etapa.licao}`)} className="rounded-lg border px-3 py-2 text-xs font-bold" style={{ borderColor: "#fde68a", background: "#fffbeb", color: "#78350f" }}>Pedir ao Castor para explicar melhor</button>}
            </div>
          </>}
        </>;
      })()}

      {final && <>
        <p className="text-xs text-slate-500 mt-2">Resultado da safra</p>
        <p className="text-3xl font-black" style={{ color: final.lucro >= 0 ? "#166534" : "#b91c1c" }}>{final.lucro >= 0 ? "Lucro" : "Prejuízo"} de {reais(Math.abs(final.lucro))}</p>
        <p className="text-sm text-slate-600">{reais(Math.abs(final.lucroPorAlqueire))} de {final.lucro >= 0 ? "lucro" : "prejuízo"} por alqueire · {final.boas} de {ETAPAS.length} decisões seguiram a boa prática</p>
        <p className="rounded-lg p-2.5 mt-2 text-xs" style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a" }}>
          Nesta safra {CLIMA[partida.sorteio.clima]} e {MERCADO[partida.sorteio.mercado]}. Isso foi sorteado: decisão boa não garante resultado bom, mas protege quando a sorte não ajuda.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">As contas da safra</h4>
            <table className="w-full text-xs mt-1.5">
              <tbody>
                {final.linhas.map(([nome, valor], i) => (
                  <tr key={nome} style={{ background: i % 2 ? "#fff" : "#f8fafc" }}><td className="py-1 px-2">{nome}</td><td className="py-1 px-2 text-right font-mono" style={{ color: valor < 0 ? "#b91c1c" : "#0f172a" }}>{valor < 0 ? "−" : "+"} {reais(Math.abs(valor))}</td></tr>
                ))}
                <tr style={{ borderTop: "2px solid #166534" }}><td className="py-1.5 px-2 font-bold">{final.lucro >= 0 ? "Lucro" : "Prejuízo"}</td><td className="py-1.5 px-2 text-right font-mono font-bold">{reais(Math.abs(final.lucro))}</td></tr>
              </tbody>
            </table>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-3">E se a trava fosse outra?</h4>
            <table className="w-full text-xs mt-1.5">
              <tbody>{final.comparacao.map((linha, i) => (
                <tr key={linha.trava} style={{ background: linha.trava === final.e.trava ? "#fef9c3" : i % 2 ? "#fff" : "#f8fafc" }}>
                  <td className="py-1 px-2">{linha.nome}{linha.trava === final.e.trava && <span className="text-amber-800"> · a sua escolha</span>}</td>
                  <td className="py-1 px-2 text-right font-mono font-bold" style={{ color: linha.lucro < 0 ? "#b91c1c" : "#0f172a" }}>{linha.lucro < 0 ? "−" : ""}{reais(Math.abs(linha.lucro))}</td>
                </tr>
              ))}</tbody>
            </table>
            <p className="text-xs text-slate-500 mt-1">Com as mesmas outras decisões, no mesmo clima e no mesmo mercado.</p>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-3">Sorte ou boa decisão?</h4>
            <table className="w-full text-xs mt-1.5">
              <tbody>
                {[[`As suas decisões, se o preço tivesse ${partida.sorteio.mercado === "alta" ? "caído" : "subido"}`, final.comOMercadoAoContrario],
                  ["As sete boas práticas, neste mesmo clima e mercado", final.comBoasPraticas]].map(([nome, valor], i) => (
                  <tr key={nome} style={{ background: i % 2 ? "#fff" : "#f8fafc" }}>
                    <td className="py-1 px-2">{nome}</td>
                    <td className="py-1 px-2 text-right font-mono font-bold whitespace-nowrap" style={{ color: valor < 0 ? "#b91c1c" : "#0f172a" }}>{valor < 0 ? "−" : ""}{reais(Math.abs(valor))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-500 mt-1">
              {final.boas === ETAPAS.length ? "Você seguiu todas as boas práticas."
                : final.lucro > final.comBoasPraticas ? "Você ficou acima das boas práticas porque arriscou e o mercado ajudou. Veja na primeira linha como a conta muda com o mercado ao contrário."
                  : `Seguindo as boas práticas, o resultado seria ${reais(final.comBoasPraticas - final.lucro)} melhor.`}
            </p>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">As suas decisões</h4>
            <ol className="mt-1.5 space-y-1.5">
              {ETAPAS.map(e => {
                const retorno = e.retorno(final, partida.sorteio);
                const [, texto] = e.opcoes(final, partida.sorteio).find(([id]) => id === final.e[e.id]);
                return (
                  <li key={e.id} className="rounded-lg p-2 text-xs" style={{ background: "#f8fafc" }}>
                    <div className="flex flex-wrap items-center justify-between gap-1"><strong className="text-slate-800">{e.titulo}</strong><Marca nivel={retorno.nivel} /></div>
                    <div className="text-slate-600 mt-0.5">{texto}</div>
                    {retorno.nivel !== "boa" && <div className="text-slate-500 mt-0.5">{e.licao}</div>}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
        <button type="button" onClick={comecar} className="rounded-lg px-4 py-2 mt-3 text-sm font-bold text-white" style={{ background: "#166534" }}>Plantar outra safra</button>
        <p className="text-xs text-slate-500 mt-2">Valores, juros e custos de exemplo, para estudo; seguro agrícola e impostos não entram na conta. O sorteio muda a cada partida: experimente decisões diferentes e compare.</p>
      </>}
    </section>
  );
}

export default function Aprender({ onPerguntar }) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-white p-3 shadow-sm">
        <h2 className="text-sm font-bold text-green-800">Aprender na prática</h2>
        <p className="text-xs text-slate-600 mt-1">Duas atividades para a sala de aula: tocar uma safra inteira tomando as decisões do produtor e, abaixo, treinar só a proteção de preço.</p>
      </section>
      <SimulacaoDaSafra onPerguntar={onPerguntar} />
      <SimuladorDeHedge />
    </div>
  );
}
