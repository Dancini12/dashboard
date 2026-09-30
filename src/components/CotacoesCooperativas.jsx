import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";

// Aba "Cotações Cooperativas", por enquanto só com o Paraná: cotação diária do SIMA
// (DERAL/SEAB-PR), o preço de compra pago pelos atacadistas (cooperativas, cerealistas
// e indústrias) em cada região do estado. Para incluir outros estados no futuro, a API
// ganha uma fonte por estado e esta aba, um seletor.
const ATUALIZAR_MS = 30 * 60 * 1000; // o DERAL publica uma vez por dia útil
const REGIAO_DA_ESCOLA = "Cornélio Procópio";
const PAGINA_DERAL = "https://www.agricultura.pr.gov.br/Cotacao-Diaria-SIMA";

// Nomes curtos para os botões, na ordem em que aparecem.
const APELIDOS = [
  [/^soja/i, "Soja"], [/^milho/i, "Milho"], [/^trigo/i, "Trigo"],
  [/^caf[ée] beneficiado/i, "Café beneficiado"], [/^caf[ée] em coco/i, "Café em coco"],
  [/^feij[ãa]o carioca/i, "Feijão carioca"], [/^feij[ãa]o preto/i, "Feijão preto"],
  [/^mandioca/i, "Mandioca"], [/^arroz/i, "Arroz"], [/^boi/i, "Boi"], [/^vaca/i, "Vaca"],
  [/^su[íi]no/i, "Suíno"], [/^erva/i, "Erva-mate"],
];
const apelido = nome => APELIDOS.find(([re]) => re.test(nome))?.[1] ?? nome.split(" ").slice(0, 2).join(" ");
const ordem = nome => { const i = APELIDOS.findIndex(([re]) => re.test(nome)); return i < 0 ? 99 : i; };
const UNIDADES = { "sc 60 kg": "saca de 60 kg", "kg renda": "kg (renda)" };
const unidadeLegivel = u => UNIDADES[u.toLowerCase()] ?? u.toLowerCase();

const reais = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const SITUACAO = { sinf: "s/ inf.", aus: "ausente" };
const valorDa = v => (typeof v === "number" ? reais(v) : SITUACAO[v] ?? "—");

// Cooperativas paranaenses acompanhadas. Cada uma divulga o próprio preço aos cooperados
// (aplicativo ou área do cooperado). "regiao": região do DERAL com o nome da cidade-sede.
const COOPERATIVAS_PR = [
  { nome: "Coamo", sede: "Campo Mourão", regiao: "Campo Mourão", produtos: "soja, milho, trigo e café", site: "https://www.coamo.com.br/" },
  { nome: "C.Vale", sede: "Palotina", produtos: "soja, milho, trigo e mandioca", site: "https://www.cvale.com.br/" },
  { nome: "Lar", sede: "Medianeira", produtos: "soja, milho e trigo", site: "https://www.lar.ind.br/" },
  { nome: "Cocamar", sede: "Maringá", regiao: "Maringá", produtos: "soja, milho, trigo, café e laranja", site: "https://www.cocamar.com.br/" },
  { nome: "Integrada", sede: "Londrina", regiao: "Londrina", produtos: "soja, milho, trigo, café e laranja", site: "https://www.integrada.coop.br/" },
];

export default function CotacoesCooperativas() {
  const [cotacao, setCotacao] = useState(null);
  const [erro, setErro] = useState(false);
  const [escolhido, setEscolhido] = useState("Soja");
  const [destaque, setDestaque] = useState(null);

  useEffect(() => {
    let ativo = true;
    const carregar = () => fetch("/api/market?type=pr", { signal: AbortSignal.timeout(30000) })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("indisponível"))))
      .then(d => { if (ativo) { setCotacao(d); setErro(false); } })
      .catch(() => { if (ativo) setErro(true); });
    carregar();
    const t = setInterval(carregar, ATUALIZAR_MS);
    return () => { ativo = false; clearInterval(t); };
  }, []);

  const produtos = cotacao ? [...cotacao.produtos].sort((a, b) => ordem(a.nome) - ordem(b.nome)) : [];
  const produto = produtos.find(p => apelido(p.nome) === escolhido) ?? produtos[0];
  const comPreco = produto ? cotacao.regioes.map((r, i) => [r, produto.precos[i].comum]).filter(([, v]) => typeof v === "number") : [];
  const maior = comPreco.reduce((a, b) => (b[1] > (a?.[1] ?? -Infinity) ? b : a), null);
  const menor = comPreco.reduce((a, b) => (b[1] < (a?.[1] ?? Infinity) ? b : a), null);

  const verRegiao = (regiao) => {
    setDestaque(regiao);
    document.getElementById(`regiao-${regiao}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold text-green-800">Cotações Cooperativas · Paraná</h2>
          {cotacao?.data && <span className="text-xs text-slate-500">Cotação do dia {cotacao.data}</span>}
        </div>
        <p className="text-xs text-slate-600 mt-1">
          Quanto quem compra do produtor (cooperativas, cerealistas e indústrias) está pagando em cada região do
          Paraná, segundo o levantamento diário do DERAL, da Secretaria da Agricultura do estado. A região de
          Cornélio Procópio, onde fica Santa Mariana, aparece em destaque.
        </p>
        {produtos.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="Produto">
            {produtos.map(p => {
              const nome = apelido(p.nome);
              const ativo = produto === p;
              return (
                <button key={p.nome} type="button" onClick={() => setEscolhido(nome)} aria-pressed={ativo}
                  className="rounded-full border px-3 py-1 text-xs font-bold"
                  style={ativo ? { background: "#166534", borderColor: "#166534", color: "#fff" } : { background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}>
                  {nome}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {!cotacao && !erro && <p className="text-sm text-slate-500">Carregando a cotação do DERAL…</p>}
      {erro && !cotacao && (
        <p role="alert" className="rounded-xl border p-3 text-sm text-amber-800 bg-amber-50">
          A cotação do DERAL não está disponível agora. Tente mais tarde ou veja direto no{" "}
          <a className="underline" href={PAGINA_DERAL} target="_blank" rel="noopener noreferrer">site do DERAL</a>.
        </p>
      )}

      {produto && (
        <section className="rounded-xl border bg-white p-3 shadow-sm">
          <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>
            {produto.nome} <span className="text-xs font-normal text-slate-500">· R$ por {unidadeLegivel(produto.unidade)}</span>
          </h3>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            {produto.mediaEstado != null && (
              <div className="rounded-lg p-2" style={{ background: "#f0fdf4" }}>
                <div className="text-slate-500">Média do Paraná</div>
                <div className="text-base font-bold" style={{ color: "#166534" }}>{reais(produto.mediaEstado)}</div>
                {produto.variacaoPct != null && (
                  <div style={{ color: produto.variacaoPct > 0 ? "#15803d" : produto.variacaoPct < 0 ? "#b91c1c" : "#64748b" }}>
                    {produto.variacaoPct > 0 ? "+" : ""}{produto.variacaoPct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% sobre o dia anterior
                  </div>
                )}
              </div>
            )}
            {maior && <div className="rounded-lg p-2" style={{ background: "#f8fafc" }}><div className="text-slate-500">Maior preço</div><div className="font-bold">{reais(maior[1])}</div><div className="text-slate-500">{maior[0]}</div></div>}
            {menor && <div className="rounded-lg p-2" style={{ background: "#f8fafc" }}><div className="text-slate-500">Menor preço</div><div className="font-bold">{reais(menor[1])}</div><div className="text-slate-500">{menor[0]}</div></div>}
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "#166534", color: "#fff" }}>
                  <th className="py-1.5 px-2 text-left">Região</th>
                  <th className="py-1.5 px-2 text-right hidden sm:table-cell">Mínimo</th>
                  <th className="py-1.5 px-2 text-right">Mais comum</th>
                  <th className="py-1.5 px-2 text-right hidden sm:table-cell">Máximo</th>
                </tr>
              </thead>
              <tbody>
                {cotacao.regioes.map((regiao, i) => {
                  const p = produto.precos[i];
                  const daEscola = regiao === REGIAO_DA_ESCOLA;
                  const fundo = destaque === regiao ? "#dcfce7" : daEscola ? "#fef9c3" : i % 2 ? "#fff" : "#f8fafc";
                  return (
                    <tr key={regiao} id={`regiao-${regiao}`} style={{ background: fundo }}>
                      <td className="py-1 px-2 font-semibold">
                        {regiao}
                        {daEscola && <span className="block sm:inline sm:ml-1 font-normal text-amber-800" style={{ fontSize: 10.5 }}>região de Santa Mariana</span>}
                      </td>
                      <td className="py-1 px-2 text-right font-mono hidden sm:table-cell">{valorDa(p.min)}</td>
                      <td className="py-1 px-2 text-right font-mono font-bold">
                        {valorDa(p.comum)}
                        {typeof p.min === "number" && typeof p.max === "number" && (
                          <span className="block sm:hidden font-normal text-slate-500" style={{ fontSize: 10.5 }}>{valorDa(p.min)} a {valorDa(p.max)}</span>
                        )}
                      </td>
                      <td className="py-1 px-2 text-right font-mono hidden sm:table-cell">{valorDa(p.max)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">"—" = região não pesquisada para este produto · "s/ inf." = sem informação no dia.</p>
        </section>
      )}

      <section className="rounded-xl border bg-white p-3 shadow-sm">
        <h2 className="text-sm font-bold text-green-800">Cooperativas do Paraná</h2>
        <p className="text-xs text-slate-600 mt-1">
          Cada cooperativa divulga o próprio preço aos cooperados, no aplicativo ou na área do cooperado. Para ter uma
          referência, compare com a região da tabela mais próxima da sede.
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          {COOPERATIVAS_PR.map(c => (
            <li key={c.nome} className="rounded-lg border p-2 text-xs" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm" style={{ color: "#14532d" }}>{c.nome}</strong>
                <a href={c.site} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-800 underline shrink-0">
                  Site <ExternalLink size={11} aria-hidden="true" />
                </a>
              </div>
              <div className="text-slate-600 mt-0.5">Sede: {c.sede} · Recebe: {c.produtos}</div>
              {c.regiao && cotacao && (
                <button type="button" onClick={() => verRegiao(c.regiao)} className="mt-1.5 rounded-full border px-2 py-0.5 font-semibold"
                  style={{ background: "#fff", borderColor: "#86efac", color: "#166534" }}>
                  Ver região de {c.regiao} na tabela
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-slate-500">
        Fonte: DERAL/SEAB-PR, Sistema de Informação de Mercado Agrícola (SIMA), cotação de compra pelos atacadistas
        paranaenses, publicada nos dias úteis.{" "}
        {cotacao?.arquivo && <a className="underline" href={cotacao.arquivo} target="_blank" rel="noopener noreferrer">Planilha do dia</a>}
        {cotacao?.arquivo && " · "}
        <a className="underline" href={PAGINA_DERAL} target="_blank" rel="noopener noreferrer">Boletins do DERAL</a>.
        Valores de referência para estudo; o preço de cada negócio depende do comprador, da qualidade e do prazo.
      </p>
    </div>
  );
}
