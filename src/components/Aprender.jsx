import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { hedge } from "../calculos";
import { PERGUNTAS } from "../quiz";

// Aba "Aprender": o simulador de hedge (o aluno trava um preço e vê o que acontece se o
// mercado subir ou cair) e o quiz dos termos do mercado.
const COR_SEM_HEDGE = "#2a78d6";
const COR_COM_HEDGE = "#eb6834";
const PERGUNTAS_POR_RODADA = 10;

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

function Quiz({ onPerguntar }) {
  const [rodada, setRodada] = useState(null); // { ordem, atual, escolhida, acertos }
  const comecar = () => {
    const ordem = PERGUNTAS.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, PERGUNTAS_POR_RODADA);
    setRodada({ ordem, atual: 0, escolhida: null, acertos: 0 });
  };
  const fim = rodada && rodada.atual >= rodada.ordem.length;
  const p = rodada && !fim ? PERGUNTAS[rodada.ordem[rodada.atual]] : null;
  const responder = i => setRodada(r => (r.escolhida != null ? r : { ...r, escolhida: i, acertos: r.acertos + (i === p.certa ? 1 : 0) }));

  return (
    <section id="quiz" className="rounded-xl border bg-white p-3 shadow-sm" style={{ scrollMarginTop: 100 }}>
      <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>Quiz do mercado agrícola</h3>
      {!rodada && <>
        <p className="text-xs text-slate-600 mt-1">{PERGUNTAS_POR_RODADA} perguntas sobre unidades, bolsa, câmbio e os termos do Glossário. A cada resposta você vê a explicação.</p>
        <button type="button" onClick={comecar} className="rounded-lg px-4 py-2 mt-3 text-sm font-bold text-white" style={{ background: "#166534" }}>Começar o quiz</button>
      </>}
      {p && <>
        <div className="flex items-center justify-between text-xs text-slate-500 mt-1"><span>Pergunta {rodada.atual + 1} de {rodada.ordem.length}</span><span>{rodada.acertos} certa{rodada.acertos === 1 ? "" : "s"} até agora</span></div>
        <p className="text-sm font-semibold text-slate-900 mt-2">{p.pergunta}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
          {p.opcoes.map((opcao, i) => {
            const respondida = rodada.escolhida != null;
            const certa = respondida && i === p.certa;
            const errada = respondida && i === rodada.escolhida && i !== p.certa;
            return (
              <button key={opcao} type="button" onClick={() => responder(i)} disabled={respondida} className="rounded-lg border p-2.5 text-left text-sm"
                style={certa ? { background: "#dcfce7", borderColor: "#16a34a", color: "#14532d", fontWeight: 700 } : errada ? { background: "#fee2e2", borderColor: "#dc2626", color: "#7f1d1d" } : { background: "#f8fafc", borderColor: "#e2e8f0", color: "#0f172a" }}>
                {certa ? "✓ " : errada ? "✗ " : ""}{opcao}
              </button>
            );
          })}
        </div>
        {rodada.escolhida != null && <>
          <p className="rounded-lg p-2.5 mt-2 text-xs" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#78350f" }}>
            <strong>{rodada.escolhida === p.certa ? "Certo!" : "Não foi dessa vez."}</strong> {p.explicacao}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <button type="button" onClick={() => setRodada(r => ({ ...r, atual: r.atual + 1, escolhida: null }))} className="rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ background: "#166534" }}>
              {rodada.atual + 1 < rodada.ordem.length ? "Próxima pergunta" : "Ver o resultado"}
            </button>
            {onPerguntar && <button type="button" onClick={() => onPerguntar(`Explique melhor: ${p.pergunta}`)} className="rounded-lg border px-3 py-2 text-xs font-bold" style={{ borderColor: "#fde68a", background: "#fffbeb", color: "#78350f" }}>Pedir ao Castor para explicar melhor</button>}
          </div>
        </>}
      </>}
      {fim && <>
        <p className="text-2xl font-black mt-2" style={{ color: "#166534" }}>{rodada.acertos} de {rodada.ordem.length}</p>
        <p className="text-sm text-slate-600">{rodada.acertos === rodada.ordem.length ? "Gabaritou! Você domina os termos do mercado." : rodada.acertos >= rodada.ordem.length * 0.7 ? "Muito bem! Faltou pouco para gabaritar." : "Vale revisar o Glossário e tentar de novo: as perguntas mudam a cada rodada."}</p>
        <button type="button" onClick={comecar} className="rounded-lg px-4 py-2 mt-3 text-sm font-bold text-white" style={{ background: "#166534" }}>Jogar de novo</button>
      </>}
    </section>
  );
}

export default function Aprender({ onPerguntar }) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-white p-3 shadow-sm">
        <h2 className="text-sm font-bold text-green-800">Aprender na prática</h2>
        <p className="text-xs text-slate-600 mt-1">Duas atividades para a sala de aula: simular a proteção de preço de uma safra e testar o que você sabe sobre o mercado.</p>
      </section>
      <SimuladorDeHedge />
      <Quiz onPerguntar={onPerguntar} />
    </div>
  );
}
