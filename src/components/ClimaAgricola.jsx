import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MapPin, Search } from "lucide-react";
import { avisosDaPrevisao, buscarClima, getWmo, resumoDaChuva, SANTA_MARIANA, WEEK } from "../clima";

// Aba "Clima": chuva que já caiu, chuva prevista, umidade do solo e avisos para a lavoura,
// a partir do Open-Meteo (o mesmo serviço da previsão do Painel). Os valores passados são
// estimativas do modelo para o ponto escolhido, não a leitura de um pluviômetro.
const AZUL = "#2a78d6";      // o que já choveu
const AZUL_CLARO = "#86b6ef"; // previsão (mesmo tom, mais claro)
const mm = v => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} mm`;
const diaMes = data => `${data.slice(8, 10)}/${data.slice(5, 7)}`;
const diaDaSemana = data => WEEK[new Date(`${data}T12:00:00`).getDay()];
const listaDeDias = dias => dias.map(d => diaMes(d.data)).join(", ");

function Dica({ active, payload }) {
  const dia = payload?.[0]?.payload;
  if (!active || !dia) return null;
  return (
    <div className="rounded-lg border bg-white px-2.5 py-2 text-xs shadow-md" style={{ borderColor: "#e2e8f0" }}>
      <div className="font-semibold text-slate-500">{diaDaSemana(dia.data)}, {diaMes(dia.data)} · {dia.previsto != null ? "previsão" : "já choveu"}</div>
      <div className="mt-1"><strong className="text-slate-900">{mm(dia.chuva ?? 0)}</strong>{dia.previsto != null && dia.probabilidade != null && <span className="text-slate-600"> · {dia.probabilidade}% de chance</span>}</div>
    </div>
  );
}
function Numero({ rotulo, valor, detalhe, destaque }) {
  return (
    <div className="rounded-lg p-2.5" style={{ background: destaque ? "#eff6ff" : "#f8fafc" }}>
      <div className="text-xs text-slate-500">{rotulo}</div>
      <div className="text-lg font-black" style={{ color: destaque ? "#1e3a8a" : "#0f172a" }}>{valor}</div>
      {detalhe && <div className="text-xs text-slate-500">{detalhe}</div>}
    </div>
  );
}
const Aviso = ({ tom, icone, titulo, children }) => (
  <div className="flex gap-2 rounded-lg p-2.5 text-xs" style={tom === "alerta" ? { background: "#fef2f2", border: "1px solid #fecaca", color: "#7f1d1d" } : { background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#14532d" }}>
    <span aria-hidden="true">{icone}</span><div><strong>{titulo}</strong> {children}</div>
  </div>
);

export default function ClimaAgricola() {
  const [local, setLocal] = useState(SANTA_MARIANA);
  const [busca, setBusca] = useState("");
  const [estado, setEstado] = useState({}); // { clima, de } quando chega; { erro } se falhar
  const [erroDaBusca, setErroDaBusca] = useState("");

  useEffect(() => {
    let ativo = true;
    buscarClima(local)
      .then(clima => { if (ativo) setEstado({ clima, de: local.nome }); })
      .catch(() => { if (ativo) setEstado(anterior => ({ ...anterior, erro: true })); });
    return () => { ativo = false; };
  }, [local]);

  const procurar = async (evento) => {
    evento.preventDefault();
    if (!busca.trim()) return;
    setErroDaBusca("");
    try {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(busca.trim())}&count=1&language=pt&format=json`, { signal: AbortSignal.timeout(15000) });
      const achado = (await response.json()).results?.[0];
      if (!achado) { setErroDaBusca("Cidade não encontrada. Confira o nome."); return; }
      setLocal({ nome: `${achado.name}${achado.admin1 ? `, ${achado.admin1}` : ""}`, latitude: achado.latitude, longitude: achado.longitude });
      setBusca("");
    } catch { setErroDaBusca("Não foi possível procurar a cidade agora."); }
  };

  const { clima } = estado;
  const carregando = estado.de !== local.nome && !estado.erro;
  const resumo = clima && resumoDaChuva(clima.dias, clima.hoje);
  const avisos = clima && avisosDaPrevisao(clima.dias, clima.hoje);
  const iHoje = clima ? clima.dias.findIndex(d => d.data === clima.hoje) : 0;
  const grafico = clima ? clima.dias.slice(iHoje - 30, iHoje + 15).map(d => ({ ...d, rotulo: diaMes(d.data), ...(d.data < clima.hoje ? { choveu: d.chuva ?? 0 } : { previsto: d.chuva ?? 0 }) })) : [];
  const previsao = clima ? clima.dias.slice(iHoje, iHoje + 15) : [];
  const saldo = resumo ? resumo.ultimos30 - resumo.evapotranspiracao30 : 0;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-white p-3 shadow-sm">
        <h2 className="text-sm font-bold text-green-800">Clima para a lavoura · {estado.de ?? local.nome}</h2>
        <p className="text-xs text-slate-600 mt-1">Quanto choveu, quanto deve chover, como está a água no solo e se há risco de geada ou calor forte nos próximos 15 dias.</p>
        <form onSubmit={procurar} className="flex gap-1.5 mt-3">
          <label className="relative flex-1 min-w-0">
            <span className="sr-only">Outra cidade</span>
            <MapPin size={13} className="absolute" style={{ left: 9, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} aria-hidden="true" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Ver outra cidade (ex.: Londrina)" className="block w-full rounded-lg border bg-white text-sm" style={{ padding: "7px 10px 7px 28px" }} />
          </label>
          <button type="submit" className="flex items-center gap-1 rounded-lg px-3 text-xs font-bold text-white" style={{ background: "#166534" }}><Search size={12} aria-hidden="true" />Buscar</button>
          {local !== SANTA_MARIANA && <button type="button" onClick={() => setLocal(SANTA_MARIANA)} className="rounded-lg border px-3 text-xs font-bold" style={{ borderColor: "#bbf7d0", color: "#166534" }}>Santa Mariana</button>}
        </form>
        {erroDaBusca && <p role="alert" className="text-xs text-amber-800 mt-1.5">{erroDaBusca}</p>}
        {carregando && <p className="text-xs text-slate-500 mt-2">Buscando o clima de {local.nome}…</p>}
        {estado.erro && <p role="alert" className="text-xs text-amber-800 mt-2">{clima ? "Não foi possível atualizar agora; os dados abaixo são os últimos recebidos." : "O serviço de clima não respondeu. Tente novamente em alguns minutos."}</p>}
      </section>

      {clima && <>
        <section className="rounded-xl border bg-white p-3 shadow-sm space-y-2">
          <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>Avisos para os próximos 15 dias</h3>
          {avisos.geada.length
            ? <Aviso tom="alerta" icone="❄️" titulo="Risco de geada:">mínima de 3 °C ou menos em {listaDeDias(avisos.geada)} (menor: {Math.min(...avisos.geada.map(d => d.minima)).toLocaleString("pt-BR")} °C).</Aviso>
            : <Aviso icone="✅" titulo="Sem risco de geada:">a menor mínima prevista é de {Math.min(...previsao.map(d => d.minima)).toLocaleString("pt-BR")} °C.</Aviso>}
          {avisos.calor.length > 0 && <Aviso tom="alerta" icone="🌡️" titulo="Calor forte:">máxima de 35 °C ou mais em {listaDeDias(avisos.calor)}.</Aviso>}
          {avisos.chuvaForte.length > 0 && <Aviso tom="alerta" icone="⛈️" titulo="Chuva forte:">50 mm ou mais em um só dia em {listaDeDias(avisos.chuvaForte)}.</Aviso>}
        </section>

        <section className="rounded-xl border bg-white p-3 shadow-sm">
          <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>Chuva</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            <Numero rotulo="Últimos 7 dias" valor={mm(resumo.ultimos7)} />
            <Numero rotulo="Últimos 30 dias" valor={mm(resumo.ultimos30)} />
            <Numero rotulo="Neste mês, até ontem" valor={mm(resumo.noMes)} />
            <Numero destaque rotulo="Previsão: próximos 7 dias" valor={mm(resumo.proximos7)} />
            <Numero destaque rotulo="Previsão: próximos 15 dias" valor={mm(resumo.proximos15)} />
            <Numero rotulo="Dias seguidos sem chuva" valor={resumo.diasSemChuva} detalhe="menos de 1 mm no dia conta como seco" />
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-4 mb-1 text-xs text-slate-700">
            <li className="flex items-center gap-1.5"><span className="rounded-sm" style={{ width: 10, height: 10, background: AZUL }} aria-hidden="true" />Já choveu (últimos 30 dias)</li>
            <li className="flex items-center gap-1.5"><span className="rounded-sm" style={{ width: 10, height: 10, background: AZUL_CLARO }} aria-hidden="true" />Previsão (hoje e próximos 14 dias)</li>
            <li className="text-slate-500">Milímetros por dia</li>
          </ul>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={grafico} margin={{ top: 14, right: 8, bottom: 4, left: 0 }} barCategoryGap={2}>
                <CartesianGrid stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="rotulo" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} interval={4} />
                <YAxis width={30} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} content={<Dica />} />
                <ReferenceLine x={diaMes(clima.hoje)} stroke="#94a3b8" label={{ value: "hoje", position: "top", fontSize: 10, fill: "#64748b" }} />
                <Bar dataKey="choveu" stackId="chuva" fill={AZUL} radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive={false} />
                <Bar dataKey="previsto" stackId="chuva" fill={AZUL_CLARO} radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-600 mt-2">
            <strong>Balanço dos últimos 30 dias:</strong> choveu {mm(resumo.ultimos30)} e o ar retirou cerca de {mm(resumo.evapotranspiracao30)} do solo e das plantas (evapotranspiração de referência).
            {saldo >= 0 ? ` Sobrou ${mm(saldo)}: o período repôs água no solo.` : ` Faltaram ${mm(-saldo)}: o solo perdeu mais água do que recebeu.`}
          </p>
        </section>

        <section className="rounded-xl border bg-white p-3 shadow-sm">
          <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>Água no solo</h3>
          <p className="text-xs text-slate-600 mt-1">Parte do volume do solo ocupada por água, em três profundidades. Compare com a semana passada para ver se o solo está secando ou enchendo.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
            {clima.solo.map(s => {
              const mudou = (s.agora - s.semanaPassada) * 100;
              return (
                <div key={s.camada} className="rounded-lg p-2.5" style={{ background: "#f8fafc" }}>
                  <div className="text-xs text-slate-500">{s.camada} · {s.papel}</div>
                  <div className="text-lg font-black text-slate-900">{(s.agora * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%</div>
                  <div className="rounded-full overflow-hidden mt-1" style={{ height: 6, background: "#cde2fb" }}><div style={{ height: "100%", width: `${Math.min(100, s.agora * 200)}%`, background: AZUL }} /></div>
                  <div className="text-xs text-slate-500 mt-1">{Math.abs(mudou) < 0.5 ? "igual à semana passada" : `${mudou > 0 ? "▲" : "▼"} ${Math.abs(mudou).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ponto${Math.abs(mudou) >= 1.5 ? "s" : ""} ${mudou > 0 ? "acima" : "abaixo"} da semana passada`}</div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-2">A barra vai de 0 a 50%. O ponto em que a planta começa a sofrer depende do tipo de solo: o argiloso segura mais água que o arenoso.</p>
        </section>

        <section className="rounded-xl border bg-white p-3 shadow-sm">
          <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>Previsão dia a dia</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr style={{ background: "#166534", color: "#fff" }}>
                <th className="py-1.5 px-2 text-left">Dia</th><th className="py-1.5 px-2 text-left">Tempo</th><th className="py-1.5 px-2 text-right">Mín. / máx.</th><th className="py-1.5 px-2 text-right">Chuva</th><th className="py-1.5 px-2 text-right">Chance</th>
              </tr></thead>
              <tbody>{previsao.map((d, i) => (
                <tr key={d.data} style={{ background: i % 2 ? "#fff" : "#f8fafc" }}>
                  <td className="py-1 px-2 font-semibold whitespace-nowrap">{i === 0 ? "Hoje" : diaDaSemana(d.data)} <span className="font-normal text-slate-500">{diaMes(d.data)}</span></td>
                  <td className="py-1 px-2 whitespace-nowrap">{getWmo(d.tempo).emoji} <span className="hidden sm:inline">{getWmo(d.tempo).label}</span></td>
                  <td className="py-1 px-2 text-right font-mono whitespace-nowrap">{Math.round(d.minima)}° / {Math.round(d.maxima)}°</td>
                  <td className="py-1 px-2 text-right font-mono font-bold whitespace-nowrap">{mm(d.chuva ?? 0)}</td>
                  <td className="py-1 px-2 text-right font-mono">{d.probabilidade != null ? `${d.probabilidade}%` : "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      </>}

      <p className="text-xs text-slate-500">
        Fonte: Open-Meteo.com. A chuva e a umidade do solo são estimativas de modelo para o ponto da cidade, não a medição de um pluviômetro: na sua
        propriedade o valor pode ser diferente. A previsão perde precisão depois do sétimo dia.
      </p>
    </div>
  );
}
