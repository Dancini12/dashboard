import { useEffect, useState } from "react";
import { APELIDOS_PARANA, CALCULADORAS, CHICAGO } from "../catalogo";
import { UNIDADES, converter, financiamento, pontoDeEquilibrio, relacaoDeTroca, sacaPorChicago } from "../calculos";

// Aba "Calculadoras": contas do dia a dia do produtor, com o passo a passo à mostra. Onde o
// site já tem o número (Chicago, dólar, preço médio do Paraná), ele vem preenchido e pode ser trocado.

// aceita "1275,50", "1.275,50" e "1275.50"
const numero = texto => {
  const limpo = String(texto ?? "").trim();
  if (!limpo) return NaN;
  return Number(limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo);
};
const reais = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dolares = v => v.toLocaleString("pt-BR", { style: "currency", currency: "USD" });
const decimal = (v, casas = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });
const paraCampo = v => String(Math.round(v * 100) / 100).replace(".", ",");

function Campo({ rotulo, valor, onChange, ajuda, sufixo }) {
  return (
    <label className="block text-xs text-slate-600">{rotulo}
      <span className="flex items-center gap-1.5 mt-1">
        <input value={valor} onChange={e => onChange(e.target.value)} inputMode="decimal" className="block w-full min-w-0 rounded-lg border bg-white p-2 text-sm text-slate-900" />
        {sufixo && <span className="shrink-0 text-slate-500">{sufixo}</span>}
      </span>
      {ajuda && <span className="block mt-0.5 text-slate-500" style={{ fontSize: 10.5 }}>{ajuda}</span>}
    </label>
  );
}
function Resultado({ rotulo, valor, detalhe, destaque }) {
  return (
    <div className="rounded-lg p-2.5" style={{ background: destaque ? "#f0fdf4" : "#f8fafc" }}>
      <div className="text-xs text-slate-500">{rotulo}</div>
      <div className={destaque ? "text-xl font-black" : "text-base font-bold"} style={{ color: destaque ? "#166534" : "#0f172a" }}>{valor}</div>
      {detalhe && <div className="text-xs text-slate-500">{detalhe}</div>}
    </div>
  );
}
const Falta = ({ children = "Preencha os campos com números para ver o resultado." }) => <p className="text-sm text-slate-500 mt-3">{children}</p>;
const Seletor = ({ rotulo, valor, onChange, children }) => (
  <label className="block text-xs text-slate-600">{rotulo}
    <select value={valor} onChange={e => onChange(e.target.value)} className="block w-full rounded-lg border bg-white p-2 mt-1 text-sm text-slate-900">{children}</select>
  </label>
);

const GRAOS_EM_BUSHEL = CHICAGO.filter(item => item.unit === "US¢/bushel");

function SacaPorChicago({ dolar }) {
  const [produto, setProduto] = useState("soja");
  const [cotacoes, setCotacoes] = useState(null);
  const [digitado, setDigitado] = useState({}); // o que o visitante trocou; o resto vem do site
  const [premio, setPremio] = useState("0");
  const [frete, setFrete] = useState("0");

  useEffect(() => {
    let ativo = true;
    fetch("/api/market?type=chicago", { signal: AbortSignal.timeout(30000) })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("indisponível"))))
      .then(d => { if (ativo) setCotacoes(d.contratos); })
      .catch(() => { if (ativo) setCotacoes([]); });
    return () => { ativo = false; };
  }, []);

  const item = GRAOS_EM_BUSHEL.find(g => g.key === produto);
  const deChicago = cotacoes?.find(c => c.symbol === item.symbol)?.value;
  const chicago = digitado[produto] ?? (deChicago != null ? paraCampo(deChicago) : "");
  const cambio = digitado.dolar ?? (dolar ? paraCampo(dolar) : "");
  const r = sacaPorChicago({ chicago: numero(chicago), premio: numero(premio), dolar: numero(cambio), frete: numero(frete), kgDoBushel: item.kg });
  const pronto = Number.isFinite(r.naRegiao);

  return (
    <>
      <p className="text-xs text-slate-600">Quanto vale a saca de 60 kg quando se parte do preço de Chicago. É a conta que as tradings fazem para formar o preço de exportação.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <Seletor rotulo="Produto" valor={produto} onChange={setProduto}>
          {GRAOS_EM_BUSHEL.map(g => <option key={g.key} value={g.key}>{g.emoji} {g.name}</option>)}
        </Seletor>
        <Campo rotulo="Cotação em Chicago" valor={chicago} onChange={v => setDigitado(d => ({ ...d, [produto]: v }))} sufixo="US¢/bushel"
          ajuda={digitado[produto] != null ? "Valor digitado por você." : deChicago != null ? "Cotação de agora, da aba Chicago. Pode trocar." : cotacoes ? "Cotação indisponível agora: digite o valor." : "Buscando a cotação…"} />
        <Campo rotulo="Prêmio no porto" valor={premio} onChange={setPremio} sufixo="US¢/bushel" ajuda="Quanto o comprador paga acima (ou abaixo, com sinal de menos) de Chicago em Paranaguá. Varia todo dia." />
        <Campo rotulo="Dólar" valor={cambio} onChange={v => setDigitado(d => ({ ...d, dolar: v }))} sufixo="R$"
          ajuda={digitado.dolar != null ? "Valor digitado por você." : dolar ? "Dólar comercial de agora, do Painel. Pode trocar." : "Dólar indisponível agora: digite o valor."} />
        <Campo rotulo="Frete e custos até o porto" valor={frete} onChange={setFrete} sufixo="R$/saca" ajuda="Frete, armazenagem e taxas descontados do produtor." />
      </div>
      {pronto ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
            <Resultado rotulo="Em dólares, no porto" valor={`${dolares(r.dolaresPorSaca)}/saca`} />
            <Resultado rotulo="Em reais, no porto" valor={`${reais(r.noPorto)}/saca`} />
            <Resultado destaque rotulo="Em reais, na sua região" valor={`${reais(r.naRegiao)}/saca`} detalhe="depois do frete e dos custos" />
          </div>
          <ol className="mt-3 space-y-1 pl-5 text-xs text-slate-600" style={{ listStyle: "decimal" }}>
            <li>Chicago + prêmio: {decimal(numero(chicago))} + {decimal(numero(premio))} = <strong>{decimal(numero(chicago) + numero(premio))} US¢/bushel</strong>, ou {dolares((numero(chicago) + numero(premio)) / 100)} por bushel.</li>
            <li>Uma saca de 60 kg tem {decimal(60 / item.kg, 3)} bushels de {item.name.toLowerCase()} (1 bushel = {decimal(item.kg, 1)} kg): <strong>{dolares(r.dolaresPorSaca)} por saca</strong>.</li>
            <li>Vezes o dólar de {reais(numero(cambio))}: <strong>{reais(r.noPorto)} por saca</strong> no porto.</li>
            <li>Menos {reais(numero(frete))} de frete e custos: <strong>{reais(r.naRegiao)} por saca</strong> na região.</li>
          </ol>
        </>
      ) : <Falta />}
      <p className="text-xs text-slate-500 mt-3">É uma conta de referência: o preço pago de verdade depende do comprador, da qualidade do grão e do dia. Compare com a aba Cotações Cooperativas.</p>
    </>
  );
}

function Conversor() {
  const [grupo, setGrupo] = useState("peso");
  const [valor, setValor] = useState("1");
  const [de, setDe] = useState("saca60");
  const [para, setPara] = useState("kg");
  const [ehPreco, setEhPreco] = useState(false);
  const unidades = UNIDADES[grupo];
  const origem = unidades.find(u => u.id === de) ?? unidades[0];
  const destino = unidades.find(u => u.id === para) ?? unidades[1];
  const v = numero(valor);
  const trocarGrupo = g => { setGrupo(g); setDe(UNIDADES[g][0].id); setPara(UNIDADES[g][1].id); };

  return (
    <>
      <p className="text-xs text-slate-600">Passa de uma unidade para outra: sacas, arrobas, toneladas, bushels, hectares e alqueires. Serve para quantidade e também para preço ou produtividade.</p>
      <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="O que converter">
        {[["peso", "Peso"], ["area", "Área"]].map(([id, nome]) => (
          <button key={id} type="button" onClick={() => trocarGrupo(id)} aria-pressed={grupo === id} className="rounded-full border px-3 py-1 text-xs font-bold"
            style={grupo === id ? { background: "#166534", borderColor: "#166534", color: "#fff" } : { background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}>{nome}</button>
        ))}
        <label className="flex items-center gap-1.5 text-xs text-slate-700">
          <input type="checkbox" checked={ehPreco} onChange={e => setEhPreco(e.target.checked)} />
          O número é um preço ou produtividade por unidade (ex.: R$ por saca, sacas por alqueire)
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        <Campo rotulo={ehPreco ? "Valor por unidade" : "Quantidade"} valor={valor} onChange={setValor} />
        <Seletor rotulo={ehPreco ? "Por" : "De"} valor={origem.id} onChange={setDe}>{unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</Seletor>
        <Seletor rotulo={ehPreco ? "Passar para: por" : "Para"} valor={destino.id} onChange={setPara}>{unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</Seletor>
      </div>
      {Number.isFinite(v) ? (
        <>
          <div className="mt-3"><Resultado destaque rotulo={ehPreco ? `${decimal(v, 4)} por ${origem.nome} equivale a` : `${decimal(v, 4)} × ${origem.nome} equivale a`}
            valor={`${decimal(converter(v, origem, destino, ehPreco), 4)}${ehPreco ? " por " : " × "}${destino.nome}`} /></div>
          <table className="w-full text-xs mt-3">
            <thead><tr style={{ background: "#166534", color: "#fff" }}><th className="py-1.5 px-2 text-left">Nas outras unidades</th><th className="py-1.5 px-2 text-right">{ehPreco ? "Valor por unidade" : "Quantidade"}</th></tr></thead>
            <tbody>{unidades.filter(u => u.id !== origem.id).map((u, i) => (
              <tr key={u.id} style={{ background: i % 2 ? "#fff" : "#f8fafc" }}><td className="py-1 px-2">{u.nome}</td><td className="py-1 px-2 text-right font-mono">{decimal(converter(v, origem, u, ehPreco), 4)}</td></tr>
            ))}</tbody>
          </table>
        </>
      ) : <Falta />}
    </>
  );
}

const INSUMOS = [["Adubo", "tonelada"], ["Diesel", "litro"], ["Bezerro", "cabeça"], ["Semente", "saca"], ["Ração", "saca"], ["Outro insumo", "unidade"]];
const UNIDADE_DERAL = { "sc 60 kg": "saca", arroba: "arroba", kg: "kg", t: "tonelada" };

function RelacaoDeTroca() {
  const [parana, setParana] = useState(null);
  const [diesel, setDiesel] = useState(null); // preço médio do diesel S10 no Paraná (ANP)
  const [produto, setProduto] = useState("Soja");
  const [precoDigitado, setPrecoDigitado] = useState({});
  const [insumo, setInsumo] = useState(0);
  const [insumoDigitado, setInsumoDigitado] = useState({});

  useEffect(() => {
    let ativo = true;
    fetch("/api/market?type=pr", { signal: AbortSignal.timeout(30000) })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("indisponível"))))
      .then(d => { if (ativo) setParana(d); })
      .catch(() => { if (ativo) setParana({ produtos: [] }); });
    fetch("/api/market?type=combustiveis", { signal: AbortSignal.timeout(45000) })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("indisponível"))))
      .then(d => { if (ativo) setDiesel(d.produtos.find(p => p.nome === "Diesel S10")?.parana.medio ?? null); })
      .catch(() => { /* sem o preço da ANP, o visitante digita */ });
    return () => { ativo = false; };
  }, []);

  // preço médio do Paraná hoje (DERAL) para os produtos mais comuns; sem ele, o visitante digita
  const doDeral = Object.fromEntries((parana?.produtos ?? []).filter(p => p.mediaEstado != null)
    .map(p => [APELIDOS_PARANA.find(([re]) => re.test(p.nome))?.[1], p]).filter(([nome]) => nome));
  const opcoes = ["Soja", "Milho", "Trigo", "Boi", "Suíno", "Café beneficiado"];
  const referencia = doDeral[produto];
  const unidade = UNIDADE_DERAL[referencia?.unidade.toLowerCase()] ?? referencia?.unidade.toLowerCase() ?? (produto === "Boi" ? "arroba" : produto === "Suíno" ? "kg" : "saca");
  const preco = precoDigitado[produto] ?? (referencia ? paraCampo(referencia.mediaEstado) : "");
  const [nomeDoInsumo, unidadeDoInsumo] = INSUMOS[insumo];
  const dieselDaAnp = nomeDoInsumo === "Diesel" && diesel != null;
  const precoDoInsumo = insumoDigitado[insumo] ?? (dieselDaAnp ? paraCampo(diesel) : "");
  const troca = relacaoDeTroca(numero(precoDoInsumo), numero(preco));
  const pronto = Number.isFinite(troca) && numero(preco) > 0;

  return (
    <>
      <p className="text-xs text-slate-600">Quantas sacas (ou arrobas) do seu produto são precisas para pagar um insumo. Quanto menor o número, melhor o momento de comprar.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <Seletor rotulo="Meu produto" valor={produto} onChange={setProduto}>{opcoes.map(nome => <option key={nome}>{nome}</option>)}</Seletor>
        <Campo rotulo={`Preço do meu produto`} valor={preco} onChange={v => setPrecoDigitado(d => ({ ...d, [produto]: v }))} sufixo={`R$/${unidade}`}
          ajuda={precoDigitado[produto] != null ? "Valor digitado por você." : referencia ? `Média do Paraná em ${parana.data} (DERAL). Pode trocar pelo preço da sua região.` : parana ? "Sem preço do DERAL agora: digite o valor." : "Buscando o preço médio do Paraná…"} />
        <Seletor rotulo="Insumo que quero comprar" valor={insumo} onChange={v => setInsumo(Number(v))}>{INSUMOS.map(([nome, un], i) => <option key={nome} value={i}>{nome} ({un})</option>)}</Seletor>
        <Campo rotulo={`Preço do insumo`} valor={precoDoInsumo} onChange={v => setInsumoDigitado(d => ({ ...d, [insumo]: v }))} sufixo={`R$/${unidadeDoInsumo}`}
          ajuda={insumoDigitado[insumo] != null ? "Valor digitado por você." : dieselDaAnp ? "Preço médio do diesel S10 no Paraná nesta semana (ANP). Pode trocar pelo do seu posto." : "Digite o preço do orçamento ou da loja: o site não tem fonte aberta de preço para este insumo."} />
      </div>
      {pronto ? (
        <div className="mt-3"><Resultado destaque rotulo={`Para pagar 1 ${unidadeDoInsumo} de ${nomeDoInsumo.toLowerCase()}`}
          valor={`${decimal(troca, 1)} ${unidade}${troca >= 2 && unidade !== "kg" ? "s" : ""} de ${produto.toLowerCase()}`}
          detalhe={`${reais(numero(precoDoInsumo))} ÷ ${reais(numero(preco))} por ${unidade}`} /></div>
      ) : <Falta>Digite o preço do insumo para ver quantas unidades do produto ele custa.</Falta>}
    </>
  );
}

function PontoDeEquilibrio() {
  const [medida, setMedida] = useState("ha");
  const [custo, setCusto] = useState("");
  const [produtividade, setProdutividade] = useState("");
  const [preco, setPreco] = useState("");
  const [area, setArea] = useState("1");
  const nome = medida === "ha" ? "hectare" : "alqueire";
  const r = pontoDeEquilibrio({ custoPorArea: numero(custo), produtividade: numero(produtividade), preco: numero(preco), area: numero(area) });
  const pronto = [r.precoDeEquilibrio, r.produtividadeDeEquilibrio, r.lucroTotal].every(Number.isFinite) && numero(produtividade) > 0 && numero(preco) > 0;

  return (
    <>
      <p className="text-xs text-slate-600">A partir de que preço e de que produtividade a lavoura paga o próprio custo, e quanto sobra com os números que você espera.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <Seletor rotulo="Medida de área" valor={medida} onChange={setMedida}><option value="ha">Hectare</option><option value="alq">Alqueire paulista (2,42 ha)</option></Seletor>
        <Campo rotulo={`Custo de produção por ${nome}`} valor={custo} onChange={setCusto} sufixo={`R$/${medida === "ha" ? "ha" : "alq."}`} ajuda="Sementes, adubo, defensivos, máquinas, mão de obra, arrendamento." />
        <Campo rotulo="Produtividade esperada" valor={produtividade} onChange={setProdutividade} sufixo={`sacas/${medida === "ha" ? "ha" : "alq."}`} />
        <Campo rotulo="Preço de venda esperado" valor={preco} onChange={setPreco} sufixo="R$/saca" />
        <Campo rotulo="Área plantada" valor={area} onChange={setArea} sufixo={medida === "ha" ? "ha" : "alqueires"} />
      </div>
      {pronto ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          <Resultado destaque rotulo="Preço que empata o custo" valor={`${reais(r.precoDeEquilibrio)}/saca`} detalhe="abaixo disso, a lavoura dá prejuízo" />
          <Resultado destaque rotulo="Produtividade que empata o custo" valor={`${decimal(r.produtividadeDeEquilibrio, 1)} sacas por ${nome}`} detalhe="colhendo menos que isso, dá prejuízo" />
          <Resultado rotulo={`${r.lucroPorArea >= 0 ? "Lucro" : "Prejuízo"} por ${nome}`} valor={reais(Math.abs(r.lucroPorArea))} detalhe={`receita de ${reais(r.receitaPorArea)} menos o custo`} />
          <Resultado rotulo={`${r.lucroTotal >= 0 ? "Lucro" : "Prejuízo"} na área toda`} valor={reais(Math.abs(r.lucroTotal))} detalhe={`margem de ${decimal(r.margemPct, 1)}% sobre a receita`} />
        </div>
      ) : <Falta />}
    </>
  );
}

function Financiamento() {
  const [valor, setValor] = useState("");
  const [taxa, setTaxa] = useState("");
  const [meses, setMeses] = useState("12");
  const [saca, setSaca] = useState("");
  const r = financiamento({ valor: numero(valor), taxaAoAno: numero(taxa), meses: numero(meses) });
  const pronto = Number.isFinite(r.total) && numero(valor) > 0;

  return (
    <>
      <p className="text-xs text-slate-600">Quanto se paga no vencimento de um custeio rural quitado de uma vez, depois da colheita, e quantas sacas isso representa.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <Campo rotulo="Valor financiado" valor={valor} onChange={setValor} sufixo="R$" />
        <Campo rotulo="Juros" valor={taxa} onChange={setTaxa} sufixo="% ao ano" ajuda="A taxa muda conforme a linha (Pronaf, Pronamp e outras) e o Plano Safra do ano. Confira no banco ou na cooperativa de crédito." />
        <Campo rotulo="Prazo até o pagamento" valor={meses} onChange={setMeses} sufixo="meses" />
        <Campo rotulo="Preço esperado da saca (opcional)" valor={saca} onChange={setSaca} sufixo="R$/saca" />
      </div>
      {pronto ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
          <Resultado destaque rotulo="Total a pagar no vencimento" valor={reais(r.total)} />
          <Resultado rotulo="Só de juros" valor={reais(r.juros)} detalhe={`${decimal(r.juros / numero(valor) * 100, 1)}% do valor financiado`} />
          {numero(saca) > 0 && <Resultado rotulo="Em produto" valor={`${decimal(r.total / numero(saca), 0)} sacas`} detalhe="para quitar o financiamento" />}
        </div>
      ) : <Falta />}
      <p className="text-xs text-slate-500 mt-3">Conta com juros compostos ao ano e pagamento único. Não inclui seguro, taxas do banco nem imposto.</p>
    </>
  );
}

export default function Calculadoras({ dolar, inicial }) {
  const [ativa, setAtiva] = useState(() => (CALCULADORAS.some(c => c.id === inicial) ? inicial : "saca"));
  const calculadora = CALCULADORAS.find(c => c.id === ativa);
  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-white p-3 shadow-sm">
        <h2 className="text-sm font-bold text-green-800">Calculadoras do produtor</h2>
        <p className="text-xs text-slate-600 mt-1">Contas rápidas para entender preço, custo e crédito. Escolha a calculadora:</p>
        <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="Calculadora">
          {CALCULADORAS.map(c => (
            <button key={c.id} type="button" onClick={() => setAtiva(c.id)} aria-pressed={ativa === c.id} className="rounded-full border px-3 py-1 text-xs font-bold"
              style={ativa === c.id ? { background: "#166534", borderColor: "#166534", color: "#fff" } : { background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}>{c.nome}</button>
          ))}
        </div>
      </section>
      <section id="calculadora" className="rounded-xl border bg-white p-3 shadow-sm" style={{ scrollMarginTop: 100 }}>
        <h3 className="text-sm font-bold mb-1" style={{ color: "#14532d" }}>{calculadora.nome}</h3>
        {ativa === "saca" && <SacaPorChicago dolar={dolar} />}
        {ativa === "conversor" && <Conversor />}
        {ativa === "troca" && <RelacaoDeTroca />}
        {ativa === "equilibrio" && <PontoDeEquilibrio />}
        {ativa === "financiamento" && <Financiamento />}
      </section>
    </div>
  );
}
