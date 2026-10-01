import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { APELIDOS_FUTUROS, FUTURES, UNIDADE_BRASIL } from "../catalogo";

// Aba "Bolsas": todos os contratos agrícolas das bolsas de Chicago (CBOT e CME) e de Nova Iorque (ICE)
// de uma vez, com o valor convertido para a unidade usada no Brasil e os próximos vencimentos do
// produto escolhido. Cotações em /api/market?type=bolsas (Yahoo Finance, com atraso).
const ATUALIZAR_MS = 2 * 60 * 1000; // mesmo tempo que o servidor guarda a resposta
const GRUPOS = [...new Set(FUTURES.map(item => item.group))];
const NOME_DA_BOLSA = { CBOT: "Chicago (CBOT)", CME: "Chicago (CME)", "ICE US": "Nova Iorque (ICE)" };
const BOLSA_DO_GRUPO = Object.fromEntries(FUTURES.map(item => [item.group, NOME_DA_BOLSA[item.exchange]]));
const semAcento = texto => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const numero = (v, casas = 3) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: casas });
const reais = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dolares = v => v.toLocaleString("pt-BR", { style: "currency", currency: "USD" });
const vencimentoCurto = v => `${MESES[v.mes - 1]}/${String(v.ano).slice(-2)}`;
// "01/10 às 14:04", no horário de Brasília
const quando = segundos => {
  const d = new Date(segundos * 1000);
  const dia = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
  const hora = d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  return `${dia} às ${hora}`;
};
// preço da bolsa → dólares por kg e por unidade brasileira (saca, arroba, tonelada, kg ou litro)
const porKg = (item, valor) => (item.unit.startsWith("US¢") ? valor / 100 : valor) / item.kg;
const naUnidadeBrasil = (item, valor) => porKg(item, valor) * UNIDADE_BRASIL[item.key].kg;

async function consultar(symbol) {
  const response = await fetch(`/api/market?${new URLSearchParams(symbol ? { type: "bolsas", symbol } : { type: "bolsas" })}`, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error("indisponível");
  return response.json();
}

function Variacao({ valor }) {
  const cor = valor > 0 ? "#15803d" : valor < 0 ? "#b91c1c" : "#64748b";
  return <span className="font-bold whitespace-nowrap" style={{ color: cor }}>{valor > 0 ? "▲ +" : valor < 0 ? "▼ " : ""}{numero(valor, 2)}%</span>;
}

export default function Bolsas({ dolar, inicial }) {
  const [quadro, setQuadro] = useState(null);
  const [erro, setErro] = useState(false);
  const [escolhido, setEscolhido] = useState(() => (FUTURES.some(item => item.key === inicial) ? inicial : null));
  const [busca, setBusca] = useState("");
  const [detalhe, setDetalhe] = useState(null); // vencimentos do produto escolhido

  useEffect(() => {
    let ativo = true;
    const carregar = () => consultar()
      .then(d => { if (ativo) { setQuadro(d); setErro(false); } })
      .catch(() => { if (ativo) setErro(true); });
    carregar();
    const t = setInterval(carregar, ATUALIZAR_MS);
    return () => { ativo = false; clearInterval(t); };
  }, []);

  // produto vindo da busca do topo: a tabela chega depois e empurra o detalhe para baixo, então leva até ele
  const levarAoDetalhe = useRef(Boolean(inicial));
  useEffect(() => {
    if (!quadro || !levarAoDetalhe.current) return;
    levarAoDetalhe.current = false;
    document.getElementById("bolsa-detalhe")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [quadro]);

  const produto = FUTURES.find(item => item.key === escolhido);
  const atualizadoEm = quadro?.consultadoEm;
  useEffect(() => {
    if (!produto) return;
    let ativo = true;
    consultar(produto.symbol)
      .then(d => { if (ativo) setDetalhe({ key: produto.key, vencimentos: d.vencimentos }); })
      .catch(() => { if (ativo) setDetalhe(anterior => (anterior?.key === produto.key ? anterior : { key: produto.key, erro: true })); });
    return () => { ativo = false; };
  }, [produto, atualizadoEm]);

  const escolher = (key) => {
    setEscolhido(key);
    requestAnimationFrame(() => document.getElementById("bolsa-detalhe")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const cotacaoDe = item => quadro?.contratos.find(c => c.symbol === item.symbol);
  const ultima = quadro ? Math.max(...quadro.contratos.map(c => c.date)) : null;
  const cotacao = produto && cotacaoDe(produto);
  const unidade = produto && UNIDADE_BRASIL[produto.key];
  const vencimentos = detalhe?.key === escolhido ? detalhe.vencimentos : null;
  const semVencimentos = detalhe?.key === escolhido && detalhe.erro;
  const termo = semAcento(busca);
  const visiveis = FUTURES.filter(item => semAcento(`${item.name} ${item.key} ${APELIDOS_FUTUROS[item.key] ?? ""}`).includes(termo));

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-white p-3 shadow-sm">
        <h2 className="text-sm font-bold text-green-800">Bolsas internacionais · Chicago e Nova Iorque</h2>
        <p className="text-xs text-slate-600 mt-1">
          Chicago é a referência mundial para soja, milho, trigo e carnes; Nova Iorque, para café, açúcar, algodão, cacau e suco de laranja.
          Esses preços influenciam o que o produtor recebe aqui. A tabela mostra o contrato mais próximo de cada produto, na unidade da
          bolsa e convertido para a unidade usada no Brasil. Clique em um produto para ver os próximos vencimentos.
        </p>
        <label className="block text-xs text-slate-600 mt-3">Procurar pelo nome
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Ex.: soja, porco, laranja, gado…"
            onKeyDown={e => { if (e.key === "Enter" && visiveis.length) { e.preventDefault(); escolher(visiveis[0].key); } }}
            className="block w-full rounded-lg border bg-white p-2 mt-1 text-sm text-slate-900" />
        </label>
        {quadro && (
          <div className="mt-3 flex gap-2 rounded-lg p-2.5 text-xs" style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a" }}>
            <Clock size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <div>
                <strong>Última cotação recebida: {quando(ultima)}</strong> (horário de Brasília)
                {dolar ? <> · dólar comercial usado na conversão: {reais(dolar)}</> : <> · dólar indisponível agora: a conversão aparece só em dólares</>}
              </div>
              <div className="mt-0.5">
                Não é em tempo real: as cotações chegam com cerca de 10 minutos de atraso e o site confere a cada 2 minutos.
                Com a bolsa fechada, fica o último preço negociado.
              </div>
            </div>
          </div>
        )}
        <details className="mt-2 text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold text-green-800">Como ler estas cotações</summary>
          <ul className="mt-2 space-y-1 pl-5" style={{ listStyle: "disc" }}>
            <li><strong>As bolsas:</strong> em Chicago, a CBOT (Chicago Board of Trade) negocia grãos e derivados e a CME (Chicago Mercantile Exchange), boi, suíno e leite. Em Nova Iorque, a ICE negocia café, açúcar, algodão, cacau e suco de laranja.</li>
            <li><strong>Vencimento:</strong> o mês em que o contrato termina. Cada mês tem o seu preço; "soja nov/26" é a soja para entrega em novembro de 2026.</li>
            <li><strong>Unidade da bolsa:</strong> grãos em centavos de dólar por bushel (27,2 kg de soja ou trigo; 25,4 kg de milho), farelo em dólares por tonelada curta (907 kg), cacau em dólares por tonelada, e óleo, carnes, café, açúcar, algodão e suco em centavos de dólar por libra-peso (0,454 kg).</li>
            <li><strong>Variação:</strong> diferença do último preço para o fechamento do pregão anterior.</li>
            <li><strong>Valor em reais:</strong> o preço da bolsa convertido para saca, arroba, tonelada, kg ou litro e multiplicado pelo dólar comercial do Painel. É só a conversão: o preço no Brasil ainda depende do prêmio no porto, do frete e da região.</li>
          </ul>
        </details>
      </section>

      {!quadro && !erro && <p className="text-sm text-slate-500">Carregando as cotações das bolsas…</p>}
      {erro && (
        <p role="alert" className="rounded-xl border p-3 text-sm text-amber-800 bg-amber-50">
          {quadro ? "Não foi possível atualizar agora; a tabela mostra a última cotação recebida." : "As cotações das bolsas não estão disponíveis agora. Tente novamente em alguns minutos."}
        </p>
      )}

      {quadro && !visiveis.length && <p className="text-sm text-slate-600">Nenhum produto com esse nome. <button type="button" onClick={() => setBusca("")} className="font-bold text-green-800 underline">Ver a lista completa</button></p>}
      {quadro && GRUPOS.filter(grupo => visiveis.some(item => item.group === grupo)).map(grupo => (
        <section key={grupo} className="rounded-xl border bg-white p-3 shadow-sm">
          <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>{grupo} <span className="text-xs font-normal text-slate-500">· {BOLSA_DO_GRUPO[grupo]}</span></h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "#166534", color: "#fff" }}>
                  <th className="py-1.5 px-2 text-left">Produto</th>
                  <th className="py-1.5 px-2 text-right">Último</th>
                  <th className="py-1.5 px-2 text-right hidden sm:table-cell">Variação</th>
                  <th className="py-1.5 px-2 text-right hidden sm:table-cell">Em dólares</th>
                  <th className="py-1.5 px-2 text-right">{dolar ? "Em reais" : "Em dólares"}</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.filter(item => item.group === grupo).map((item, i) => {
                  const c = cotacaoDe(item);
                  const ativo = item.key === escolhido;
                  const u = UNIDADE_BRASIL[item.key];
                  const emDolar = c && naUnidadeBrasil(item, c.value);
                  return (
                    <tr key={item.key} onClick={() => escolher(item.key)} className="cursor-pointer" style={{ background: ativo ? "#dcfce7" : i % 2 ? "#fff" : "#f8fafc" }}>
                      <td className="py-1.5 px-2">
                        <button type="button" aria-pressed={ativo} className="text-left font-semibold" style={{ color: "#14532d" }}>{item.emoji} {item.name}</button>
                        <span className="block text-slate-500" style={{ fontSize: 10.5 }}>{c?.vencimento && `${vencimentoCurto(c.vencimento)} · `}{item.unit}</span>
                      </td>
                      {c ? <>
                        <td className="py-1.5 px-2 text-right font-mono font-bold">
                          {numero(c.value)}
                          <span className="block sm:hidden font-sans" style={{ fontSize: 10.5 }}><Variacao valor={c.change} /></span>
                        </td>
                        <td className="py-1.5 px-2 text-right hidden sm:table-cell"><Variacao valor={c.change} /></td>
                        <td className="py-1.5 px-2 text-right font-mono hidden sm:table-cell">{dolares(emDolar)}<span className="font-sans text-slate-500">/{u.curto}</span></td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold whitespace-nowrap">{dolar ? reais(emDolar * dolar) : dolares(emDolar)}<span className="font-sans font-normal text-slate-500">/{u.curto}</span></td>
                      </> : <td colSpan={4} className="py-1.5 px-2 text-right text-slate-500">sem cotação agora</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <div id="bolsa-detalhe" style={{ scrollMarginTop: 100 }}>
        {quadro && !produto && <p className="rounded-xl border border-dashed p-4 text-sm text-slate-600 text-center">Clique em um produto da tabela para ver os próximos vencimentos.</p>}
        {produto && (
          <section className="rounded-xl border bg-white p-3 shadow-sm">
            <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>
              {produto.emoji} {produto.name} <span className="text-xs font-normal text-slate-500">· {NOME_DA_BOLSA[produto.exchange]} · cotado em {produto.cotacao}</span>
            </h3>
            {cotacao && <p className="text-xs text-slate-600 mt-1">Equivale a {produto.kg !== 1000 && <><strong>{dolares(porKg(produto, cotacao.value) * 1000)}</strong> por tonelada e </>}<strong>{dolares(porKg(produto, cotacao.value))}</strong> por kg.</p>}
            {cotacao && (
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-lg p-2" style={{ background: "#f0fdf4" }}>
                  <div className="text-slate-500">Último{cotacao.vencimento && ` · ${vencimentoCurto(cotacao.vencimento)}`}</div>
                  <div className="text-base font-bold" style={{ color: "#166534" }}>{numero(cotacao.value)}</div>
                  <div className="text-slate-500">{produto.unit}</div>
                </div>
                <div className="rounded-lg p-2" style={{ background: "#f8fafc" }}>
                  <div className="text-slate-500">Variação no dia</div>
                  <div className="text-base"><Variacao valor={cotacao.change} /></div>
                  <div className="text-slate-500">sobre o pregão anterior</div>
                </div>
                <div className="rounded-lg p-2" style={{ background: "#f8fafc" }}>
                  <div className="text-slate-500">Mínima e máxima do dia</div>
                  <div className="font-bold mt-0.5">{cotacao.low != null && cotacao.high != null ? `${numero(cotacao.low)} a ${numero(cotacao.high)}` : "—"}</div>
                  <div className="text-slate-500">{produto.unit}</div>
                </div>
                <div className="rounded-lg p-2" style={{ background: "#f8fafc" }}>
                  <div className="text-slate-500">Por {unidade.nome}</div>
                  <div className="font-bold mt-0.5">{dolar ? reais(naUnidadeBrasil(produto, cotacao.value) * dolar) : dolares(naUnidadeBrasil(produto, cotacao.value))}</div>
                  {dolar && <div className="text-slate-500">{dolares(naUnidadeBrasil(produto, cotacao.value))}</div>}
                </div>
              </div>
            )}

            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-4">Próximos vencimentos</h4>
            {!vencimentos && !semVencimentos && <p className="text-sm text-slate-500 mt-1">Buscando os vencimentos de {produto.name.toLowerCase()}…</p>}
            {semVencimentos && <p role="alert" className="text-sm text-amber-800 mt-1">Os vencimentos deste produto não estão disponíveis agora.</p>}
            {vencimentos && (
              <div className="mt-1.5 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "#166534", color: "#fff" }}>
                      <th className="py-1.5 px-2 text-left">Vencimento</th>
                      <th className="py-1.5 px-2 text-right">Preço <span className="font-normal">({produto.unit})</span></th>
                      <th className="py-1.5 px-2 text-right">Variação</th>
                      <th className={`py-1.5 px-2 text-right ${dolar ? "hidden sm:table-cell" : ""}`}>Em dólares</th>
                      {dolar && <th className="py-1.5 px-2 text-right">Em reais</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {vencimentos.map((v, i) => {
                      const emDolar = naUnidadeBrasil(produto, v.value);
                      return (
                        <tr key={v.contrato} style={{ background: i % 2 ? "#fff" : "#f8fafc" }}>
                          <td className="py-1 px-2 font-semibold">{MESES[v.mes - 1]}/{v.ano} <span className="font-normal text-slate-500" style={{ fontSize: 10.5 }}>{v.contrato}</span></td>
                          <td className="py-1 px-2 text-right font-mono font-bold">{numero(v.value)}</td>
                          <td className="py-1 px-2 text-right"><Variacao valor={v.change} /></td>
                          <td className={`py-1 px-2 text-right font-mono ${dolar ? "hidden sm:table-cell" : ""}`}>{dolares(emDolar)}<span className="font-sans text-slate-500">/{unidade.curto}</span></td>
                          {dolar && <td className="py-1 px-2 text-right font-mono font-bold whitespace-nowrap">{reais(emDolar * dolar)}<span className="font-sans font-normal text-slate-500">/{unidade.curto}</span></td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-slate-600 mt-3 leading-relaxed"><strong>Referência no Brasil:</strong> {produto.b3}. {produto.explanation}</p>
          </section>
        )}
      </div>

      <div className="rounded-xl border bg-amber-50 border-amber-200 p-3">
        <h3 className="font-bold text-amber-900 text-sm">Do preço da bolsa ao preço do produtor</h3>
        <p className="text-xs text-amber-800 mt-1"><strong>Bolsa ± base da região − frete − armazenagem e descontos.</strong> A bolsa não diz quanto a cooperativa vai pagar: compare com a aba Cotações Cooperativas e faça a conta na aba Calculadoras.</p>
      </div>

      <p className="text-xs text-slate-500">
        Fonte: {quadro?.source ?? "Yahoo Finance · cotação indicativa"}, contratos da CBOT e da CME (Chicago) e da ICE (Nova Iorque); dólar comercial da AwesomeAPI.
        Valores de referência para estudo, com atraso; não servem para fechar negócio.
      </p>
    </div>
  );
}
