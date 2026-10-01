import { useEffect, useState } from "react";
import { Fuel } from "lucide-react";

// Card "Combustíveis no Paraná", no fim da aba Cotações Cooperativas: preço médio da semana nos postos, pelo levantamento
// da ANP (/api/market?type=combustiveis). O diesel é um dos maiores custos da lavoura.
const CIDADE_DA_REGIAO = "Cornélio Procópio";
const reais = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const diaMes = data => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

export default function Combustiveis() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    fetch("/api/market?type=combustiveis", { signal: AbortSignal.timeout(45000) })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("indisponível"))))
      .then(d => { if (ativo) setDados(d); })
      .catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, []);

  const cidades = dados ? [...new Set(dados.produtos.flatMap(p => p.cidades.map(c => c.cidade)))].sort((a, b) => a.localeCompare(b, "pt-BR")) : [];
  return (
    <section id="card-combustiveis" className="rounded-xl border shadow-sm p-3" style={{ background: "rgba(255,255,255,0.9)", borderColor: "rgba(0,0,0,0.06)", scrollMarginTop: 100 }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#9a3412" }}><Fuel size={13} color="#fff" /></div>
        <h2 className="text-sm font-bold" style={{ color: "#9a3412" }}>Combustíveis no Paraná{dados && <span className="font-normal opacity-60"> · semana de {diaMes(dados.de)} a {diaMes(dados.ate)}</span>}</h2>
      </div>
      {!dados && !erro && <p className="text-xs opacity-50">Buscando os preços da ANP…</p>}
      {erro && <p role="alert" className="text-xs text-amber-800">Os preços da ANP não estão disponíveis agora.</p>}
      {dados && <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {dados.produtos.map((p, i) => {
            const variou = p.semanaAnterior ? (p.parana.medio - p.semanaAnterior) / p.semanaAnterior * 100 : null;
            const naRegiao = p.cidades.find(c => c.cidade === CIDADE_DA_REGIAO);
            return (
              <div key={p.nome} className="rounded-lg p-2" style={{ background: i % 2 === 0 ? "#fff7ed" : "#ffedd5" }}>
                <div className="text-xs font-semibold opacity-60">{p.nome}</div>
                <div className="text-base font-bold" style={{ color: "#9a3412" }}>{reais(p.parana.medio)}<span className="text-xs font-normal opacity-60">/litro</span></div>
                {variou != null && <div className="text-xs font-semibold" style={{ color: variou > 0.05 ? "#b91c1c" : variou < -0.05 ? "#15803d" : "#64748b" }}>
                  {Math.abs(variou) < 0.05 ? "igual à semana anterior" : `${variou > 0 ? "▲ +" : "▼ −"}${Math.abs(variou).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% na semana`}
                </div>}
                <div className="text-xs opacity-60 mt-0.5">{naRegiao && <>{CIDADE_DA_REGIAO}: {reais(naRegiao.medio)} · </>}Brasil: {p.brasil != null ? reais(p.brasil) : "—"}</div>
              </div>
            );
          })}
        </div>
        <details className="mt-2 text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold" style={{ color: "#9a3412" }}>Ver o preço em cada cidade pesquisada</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr style={{ background: "#9a3412", color: "#fff" }}><th className="py-1.5 px-2 text-left">Cidade</th>{dados.produtos.map(p => <th key={p.nome} className="py-1.5 px-2 text-right">{p.nome}</th>)}</tr></thead>
              <tbody>{cidades.map((cidade, i) => (
                <tr key={cidade} style={{ background: cidade === CIDADE_DA_REGIAO ? "#fef9c3" : i % 2 ? "#fff" : "#f8fafc" }}>
                  <td className="py-1 px-2 font-semibold whitespace-nowrap">{cidade}{cidade === CIDADE_DA_REGIAO && <span className="font-normal text-amber-800"> · a mais próxima de Santa Mariana</span>}</td>
                  {dados.produtos.map(p => { const c = p.cidades.find(x => x.cidade === cidade); return <td key={p.nome} className="py-1 px-2 text-right font-mono">{c?.medio != null ? reais(c.medio) : "—"}</td>; })}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </details>
        <div className="mt-2 text-xs opacity-25 text-right">Fonte: ANP · preço médio nos postos pesquisados na semana · atualização semanal</div>
      </>}
    </section>
  );
}
