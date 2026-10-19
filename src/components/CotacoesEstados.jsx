import { useEffect, useMemo, useState } from "react";
import { Clock, Search } from "lucide-react";
import { FAIXAS_DE_PRECO as FAIXAS, faixaDePreco } from "../calculos";

// Cotações de outros estados na aba "Cotações Cooperativas", cada um pela fonte oficial dele:
// Rio Grande do Sul pelo boletim semanal da Emater/RS-Ascar (lido do PDF por scripts/precos-rs.py, que
// grava public/dados/precos-rs.json); Mato Grosso (IMEA), Mato Grosso do Sul (Famasul) e São Paulo (IEA)
// com cotação diária, por /api/market?type=mt|ms|sp.
// O Paraná continua em CotacoesCooperativas, com o mapa das regiões do DERAL.
const ATUALIZAR_MS = 30 * 60 * 1000;
const ORDEM_RS = ["Soja", "Milho", "Trigo", "Arroz", "Feijão", "Boi", "Vaca", "Suíno", "Cordeiro", "Búfalo", "Leite"];
const UNIDADES_RS = { "60 kg": "saca de 60 kg", "50 kg": "saca de 50 kg", "kg vivo": "kg vivo", litro: "litro" };
const MUITOS_LOCAIS = 25; // a partir disso a tabela ganha um campo de busca

const reais = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const porcento = v => `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const corDaVariacao = v => (v > 0 ? "#15803d" : v < 0 ? "#b91c1c" : "#64748b");
const semAcento = t => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const diaMesAno = iso => iso.split("-").reverse().join("/");

function useDados(endereco, aCada) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let ativo = true;
    const carregar = () => fetch(endereco, { cache: "no-cache", signal: AbortSignal.timeout(30000) })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("indisponível"))))
      .then(d => { if (ativo) { setDados(d); setErro(false); } })
      .catch(() => { if (ativo) setErro(true); });
    carregar();
    const t = aCada ? setInterval(carregar, aCada) : null;
    return () => { ativo = false; clearInterval(t); };
  }, [endereco, aCada]);
  return { dados, erro };
}

function Aviso({ children }) {
  return (
    <div className="mt-3 flex gap-2 rounded-lg p-2.5 text-xs" style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a" }}>
      <Clock size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

function BotoesDeProduto({ nomes, ativo, onEscolher }) {
  return (
    <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="Produto">
      {nomes.map(nome => (
        <button key={nome} type="button" onClick={() => onEscolher(nome)} aria-pressed={ativo === nome}
          className="rounded-full border px-3 py-1 text-xs font-bold"
          style={ativo === nome ? { background: "#166534", borderColor: "#166534", color: "#fff" } : { background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}>
          {nome}
        </button>
      ))}
    </div>
  );
}

// Média do estado e os extremos entre as cidades, nos mesmos quadros da cotação do Paraná.
function Quadros({ media, rotuloMedia, variacao, rotuloVariacao, maior, menor }) {
  return (
    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
      {media != null && (
        <div className="rounded-lg p-2" style={{ background: "#f0fdf4" }}>
          <div className="text-slate-500">{rotuloMedia}</div>
          <div className="text-base font-bold" style={{ color: "#166534" }}>{reais(media)}</div>
          {variacao != null && <div style={{ color: corDaVariacao(variacao) }}>{porcento(variacao)} {rotuloVariacao}</div>}
        </div>
      )}
      {maior && <div className="rounded-lg p-2" style={{ background: "#f8fafc" }}><div className="text-slate-500">Maior preço</div><div className="font-bold">{reais(maior.valor)}</div><div className="text-slate-500">{maior.nome}</div></div>}
      {menor && <div className="rounded-lg p-2" style={{ background: "#f8fafc" }}><div className="text-slate-500">Menor preço</div><div className="font-bold">{reais(menor.valor)}</div><div className="text-slate-500">{menor.nome}</div></div>}
    </div>
  );
}

// Tabela das cidades com o sinal do semáforo (verde paga mais, vermelho paga menos) ao lado do preço; quando
// cada lugar tem a sua data (São Paulo), ela aparece numa coluna.
function TabelaDeLocais({ locais, rotuloLocal, comVariacao, comData }) {
  const [busca, setBusca] = useState("");
  const valores = locais.map(l => l.valor);
  const menor = Math.min(...valores), maior = Math.max(...valores);
  const mostrados = busca ? locais.filter(l => semAcento(l.nome).includes(semAcento(busca))) : locais;
  return (
    <>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-xs text-slate-700">
        {Object.entries(FAIXAS).map(([faixa, f]) => (
          <li key={faixa} className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center rounded" style={{ width: 16, height: 16, background: f.fundo, color: f.cor, fontSize: 9 }} aria-hidden="true">{f.sinal}</span>
            <strong>{f.nome}</strong>
          </li>
        ))}
      </ul>
      {locais.length > MUITOS_LOCAIS && (
        <label className="relative block mt-2">
          <span className="sr-only">Procurar {rotuloLocal.toLowerCase()}</span>
          <Search size={13} className="absolute" style={{ left: 9, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} aria-hidden="true" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder={`Procurar ${rotuloLocal.toLowerCase()} (${locais.length} na lista)`}
            className="block w-full rounded-lg border bg-white text-base sm:text-sm" style={{ padding: "6px 10px 6px 28px" }} />
        </label>
      )}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: "#166534", color: "#fff" }}>
              <th className="py-1.5 px-2 text-left">{rotuloLocal}</th>
              {comData && <th className="py-1.5 px-2 text-right">Data</th>}
              <th className="py-1.5 px-2 text-right">Preço</th>
              {comVariacao && <th className="py-1.5 px-2 text-right">Variação</th>}
            </tr>
          </thead>
          <tbody>
            {mostrados.map((l, i) => {
              const f = FAIXAS[faixaDePreco(l.valor, menor, maior)];
              return (
                <tr key={l.nome} style={{ background: i % 2 ? "#fff" : "#f8fafc" }}>
                  <td className="py-1 px-2 font-semibold">{l.nome}</td>
                  {comData && <td className="py-1 px-2 text-right text-slate-600 whitespace-nowrap">{l.data ? diaMesAno(l.data).slice(0, 5) : "—"}</td>}
                  <td className="py-1 px-2 text-right font-mono font-bold whitespace-nowrap">
                    <span className="inline-flex items-center justify-center rounded mr-1.5 align-middle" style={{ width: 14, height: 14, background: f.fundo, color: f.cor, fontSize: 8 }} title={f.nome} aria-hidden="true">{f.sinal}</span>
                    {reais(l.valor)}
                  </td>
                  {comVariacao && <td className="py-1 px-2 text-right font-mono" style={{ color: l.variacao == null ? "#94a3b8" : corDaVariacao(l.variacao) }}>{l.variacao == null ? "—" : porcento(l.variacao)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!mostrados.length && <p className="text-xs text-slate-500 mt-2">Nenhum lugar com esse nome na lista.</p>}
      </div>
    </>
  );
}

const extremos = locais => locais.length < 2 ? [null, null]
  : [locais.reduce((a, b) => (b.valor > a.valor ? b : a)), locais.reduce((a, b) => (b.valor < a.valor ? b : a))];

function Indisponivel({ children }) {
  return <p role="alert" className="rounded-xl border p-3 text-sm text-amber-800 bg-amber-50">{children}</p>;
}

function CotacaoRioGrandeDoSul({ produtoInicial }) {
  const { dados, erro } = useDados("/dados/precos-rs.json");
  const [escolhido, setEscolhido] = useState(produtoInicial ?? "Soja");
  const produtos = useMemo(() => (dados?.produtos ?? []).slice().sort((a, b) => {
    const ia = ORDEM_RS.indexOf(a.nome), ib = ORDEM_RS.indexOf(b.nome);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  }), [dados]);
  const produto = produtos.find(p => p.nome === escolhido) ?? produtos[0];
  const municipios = produto?.municipios ?? [];
  const [maior, menor] = extremos(municipios);
  const c = dados?.comparacao;
  const daSemana = produto?.semanaAnterior ? (produto.medio - produto.semanaAnterior) / produto.semanaAnterior * 100 : null;

  return (
    <>
      <section className="rounded-xl border bg-white p-3 shadow-sm">
        <h2 className="text-sm font-bold text-green-800">Rio Grande do Sul</h2>
        <p className="text-xs text-slate-600 mt-1">
          Quanto o produtor gaúcho recebeu na semana, segundo o levantamento da Emater/RS-Ascar nos escritórios
          municipais: o preço médio do estado, o menor e o maior, e o preço em cada município que informou.
        </p>
        {dados && (
          <Aviso>
            <div><strong>Semana de {dados.semana?.de} a {dados.semana?.ate}</strong>{dados.boletim && <> · boletim nº {dados.boletim} da Emater/RS-Ascar</>}</div>
            <div className="mt-0.5">Não é diário: a Emater publica um boletim por semana, às quintas-feiras. O site confere todo dia e mostra o boletim novo assim que ele sai.</div>
          </Aviso>
        )}
        <details className="mt-2 text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold text-green-800">Como esta cotação é feita</summary>
          <ul className="mt-2 space-y-1 pl-5" style={{ listStyle: "disc" }}>
            <li><strong>Quem levanta:</strong> a Emater/RS-Ascar, a extensão rural do Rio Grande do Sul, no boletim semanal "Cotações Agropecuárias".</li>
            <li><strong>O que é:</strong> o preço recebido pelo produtor, informado pelos escritórios municipais da Emater, em reais por unidade (saca, kg vivo ou litro).</li>
            <li><strong>Mínimo, médio e máximo:</strong> do estado inteiro, na semana.</li>
            <li><strong>Comparações:</strong> semana anterior e mês anterior em valores da época; ano anterior corrigido pela inflação (IGP-DI), como no boletim.</li>
            <li><strong>Municípios:</strong> só aparecem os que informaram preço do produto naquela semana.</li>
          </ul>
        </details>
        {produtos.length > 0 && <BotoesDeProduto nomes={produtos.map(p => p.nome)} ativo={produto?.nome} onEscolher={setEscolhido} />}
      </section>

      {!dados && !erro && <p className="text-sm text-slate-500">Carregando o boletim da Emater…</p>}
      {erro && !dados && <Indisponivel>O boletim da Emater não está disponível agora. Tente mais tarde ou veja no <a className="underline" href="https://www.emater.tche.br/site/info-agro/precos_semanais.php" target="_blank" rel="noopener noreferrer">site da Emater</a>.</Indisponivel>}

      {produto && (
        <section className="rounded-xl border bg-white p-3 shadow-sm">
          <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>
            {produto.nome} <span className="text-xs font-normal text-slate-500">· R$ por {UNIDADES_RS[produto.unidade.toLowerCase()] ?? produto.unidade}</span>
          </h3>
          <Quadros media={produto.medio} rotuloMedia="Média do RS" variacao={daSemana} rotuloVariacao="sobre a semana anterior"
            maior={maior ?? { valor: produto.maximo, nome: "no estado" }} menor={menor ?? { valor: produto.minimo, nome: "no estado" }} />
          {produto.semanaAnterior != null && c && (
            <p className="mt-2 text-xs text-slate-600">
              Média da semana anterior ({c.semanaAnterior}): <strong>{reais(produto.semanaAnterior)}</strong> ·
              do mês anterior ({c.mesAnterior}): <strong>{reais(produto.mesAnterior)}</strong> ·
              de um ano atrás ({c.anoAnterior}, corrigida pela inflação): <strong>{reais(produto.anoAnterior)}</strong>
            </p>
          )}
          {municipios.length > 0
            ? <TabelaDeLocais key={produto.nome} locais={municipios} rotuloLocal="Município" />
            : <p className="mt-3 text-xs text-slate-500">O boletim desta semana não traz o preço por município para este produto.</p>}
        </section>
      )}

      <p className="text-xs text-slate-500">
        Fonte: Emater/RS-Ascar, Cotações Agropecuárias{dados?.boletim ? ` nº ${dados.boletim}` : ""}, acompanhamento semanal de preços recebidos pelos produtores.{" "}
        {dados?.pdf && <><a className="underline" href={dados.pdf} target="_blank" rel="noopener noreferrer">Boletim da semana (PDF)</a> · </>}
        <a className="underline" href="https://www.emater.tche.br/site/info-agro/precos_semanais.php" target="_blank" rel="noopener noreferrer">Boletins da Emater</a>.
        Valores de referência para estudo; o preço de cada negócio depende do comprador, da qualidade e do prazo.
      </p>
    </>
  );
}

// Estados com cotação diária, cada um com os textos da sua fonte. Os dados vêm de /api/market?type=<sigla>
// no mesmo formato (server/imea.js, server/famasul.js, server/iea.js).
const ESTADOS_DIARIOS = {
  MT: {
    titulo: "Mato Grosso", fonte: "IMEA", siteFonte: "https://www.imea.com.br/imea-site/indicador-soja", rotuloMedia: "Média de Mato Grosso",
    intro: "Quanto o produtor mato-grossense recebe à vista em cada cidade, segundo o IMEA (Instituto Mato-grossense de Economia Agropecuária): soja e milho disponíveis, boi e vaca gordos.",
    quando: "o IMEA publica nos dias úteis",
    comoFeita: [
      ["Quem levanta", "o IMEA, instituto de pesquisa de mercado do agro de Mato Grosso, ligado ao Sistema Famato."],
      ["Soja e milho disponíveis", "o preço pago ao produtor para entrega imediata do grão, em reais por saca de 60 kg, em cada cidade pesquisada."],
      ["Boi e vaca gordos à vista", "o preço da arroba com pagamento à vista, por município e nas sete macrorregiões do IMEA."],
      ["Média de Mato Grosso e variação", "calculadas pelo próprio IMEA; a variação compara com a cotação anterior."],
    ],
    regioes: "Macrorregiões do IMEA",
    rodape: "IMEA, Instituto Mato-grossense de Economia Agropecuária, indicadores de soja, milho e boi",
  },
  MS: {
    titulo: "Mato Grosso do Sul", fonte: "Famasul", siteFonte: "https://portal.sistemafamasul.com.br/cotacoes-online", rotuloMedia: "Média de Mato Grosso do Sul",
    intro: "Quanto o produtor sul-mato-grossense recebe pela soja e pelo milho em cada cidade e pelo boi e pela vaca em cada região, segundo as cotações diárias do Sistema Famasul.",
    quando: "a Famasul publica nos dias úteis",
    comoFeita: [
      ["Quem levanta", "o Sistema Famasul (Federação da Agricultura e Pecuária de Mato Grosso do Sul), nas \"Cotações online\"."],
      ["Soja e milho", "o preço da saca de 60 kg nas principais praças do estado (Dourados, Maracaju, Chapadão do Sul, Campo Grande e outras)."],
      ["Boi e vaca gordos", "o preço da arroba em cada região do estado, sem o Funrural (a contribuição do produtor rural); com ele, o valor fica um pouco maior."],
      ["Média do estado", "a da própria Famasul. A variação de cada praça é calculada pelo site, sobre a cotação anterior dela."],
    ],
    rodape: "Sistema Famasul, cotações online de soja, milho, boi e vaca",
  },
  SP: {
    titulo: "São Paulo", fonte: "IEA", siteFonte: "https://infoiea.agricultura.sp.gov.br/BancoDeDados/PrecosDiarios/Recebidos", rotuloMedia: null,
    intro: "Quanto o produtor paulista recebe em cada regional da Secretaria de Agricultura (os EDRs), segundo os preços diários do IEA (Instituto de Economia Agrícola).",
    quando: "o IEA publica nos dias úteis, só com as regionais que informaram no dia",
    comoFeita: [
      ["Quem levanta", "o IEA, Instituto de Economia Agrícola da Secretaria de Agricultura e Abastecimento de São Paulo, com os escritórios regionais (EDRs)."],
      ["O que é", "o preço médio recebido pelo produtor naquele dia, na regional, em reais por unidade (saca de 60 kg, arroba ou caixa)."],
      ["Quais regionais", "a cada dia só algumas regionais informam cada produto. Por isso a tabela mostra o preço mais recente de cada uma nos últimos cinco dias úteis, com a data."],
      ["Média do estado", "o IEA não publica nesta consulta; ficam o maior e o menor preço entre as regionais."],
    ],
    rodape: "IEA, Instituto de Economia Agrícola de São Paulo, preços diários recebidos pelos produtores",
  },
};

function CotacaoDiaria({ sigla, produtoInicial }) {
  const e = ESTADOS_DIARIOS[sigla];
  const { dados, erro } = useDados(`/api/market?type=${sigla.toLowerCase()}`, ATUALIZAR_MS);
  const [escolhido, setEscolhido] = useState(produtoInicial ?? "Soja");
  const produtos = dados?.produtos ?? [];
  const produto = produtos.find(p => p.nome === escolhido) ?? produtos[0];
  const [maior, menor] = extremos(produto?.locais ?? []);
  const comData = produto?.locais.some(l => l.data);

  return (
    <>
      <section className="rounded-xl border bg-white p-3 shadow-sm">
        <h2 className="text-sm font-bold text-green-800">{e.titulo}</h2>
        <p className="text-xs text-slate-600 mt-1">{e.intro}</p>
        {produto && (
          <Aviso>
            <div><strong>{produto.desde && produto.desde !== produto.data ? `Preços de ${diaMesAno(produto.desde)} a ${diaMesAno(produto.data)}` : `Cotação de ${diaMesAno(produto.data)}`}</strong> · {e.fonte}</div>
            <div className="mt-0.5">Não é em tempo real: {e.quando}. O site confere a cada 30 minutos e mostra a cotação nova assim que ela sai.</div>
          </Aviso>
        )}
        <details className="mt-2 text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold text-green-800">Como esta cotação é feita</summary>
          <ul className="mt-2 space-y-1 pl-5" style={{ listStyle: "disc" }}>
            {e.comoFeita.map(([rotulo, texto]) => <li key={rotulo}><strong>{rotulo}:</strong> {texto}</li>)}
          </ul>
        </details>
        {produtos.length > 0 && <BotoesDeProduto nomes={produtos.map(p => p.nome)} ativo={produto?.nome} onEscolher={setEscolhido} />}
      </section>

      {!dados && !erro && <p className="text-sm text-slate-500">Carregando a cotação do {e.fonte}…</p>}
      {erro && !dados && <Indisponivel>A cotação do {e.fonte} não está disponível agora. Tente mais tarde ou veja no <a className="underline" href={e.siteFonte} target="_blank" rel="noopener noreferrer">site do {e.fonte}</a>.</Indisponivel>}

      {produto && (
        <section className="rounded-xl border bg-white p-3 shadow-sm">
          <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>
            {produto.descricao} <span className="text-xs font-normal text-slate-500">· R$ por {produto.unidade}</span>
          </h3>
          <Quadros media={e.rotuloMedia ? produto.mediaEstado : null} rotuloMedia={e.rotuloMedia} variacao={produto.variacaoEstado} rotuloVariacao="sobre a cotação anterior" maior={maior} menor={menor} />
          {produto.comFunruralEstado != null && <p className="mt-2 text-xs text-slate-600">Com o Funrural, a média do estado fica em <strong>{reais(produto.comFunruralEstado)}</strong> por {produto.unidade}.</p>}
          {produto.regioes?.length > 0 && (
            <>
              <strong className="block text-xs text-slate-700 mt-3">{e.regioes}</strong>
              <ul className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1 text-xs">
                {produto.regioes.map(r => (
                  <li key={r.nome} className="rounded-lg p-2" style={{ background: "#f8fafc" }}>
                    <div className="text-slate-500">{r.nome}</div>
                    <div className="font-bold">{reais(r.valor)}</div>
                    {r.variacao != null && <div style={{ color: corDaVariacao(r.variacao) }}>{porcento(r.variacao)}</div>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {produto.locais.length > 0 && <TabelaDeLocais key={produto.nome} locais={produto.locais} rotuloLocal={produto.tipoLocal} comVariacao={!comData} comData={comData} />}
        </section>
      )}

      <p className="text-xs text-slate-500">
        Fonte: {e.rodape} (<a className="underline" href={e.siteFonte} target="_blank" rel="noopener noreferrer">site do {e.fonte}</a>).
        Valores de referência para estudo; o preço de cada negócio depende do comprador, da qualidade e do prazo.
      </p>
    </>
  );
}

// Rio Grande do Sul (semanal) ou um dos estados com cotação diária.
export function CotacaoDoEstado({ sigla, produtoInicial }) {
  return sigla === "RS" ? <CotacaoRioGrandeDoSul produtoInicial={produtoInicial} /> : <CotacaoDiaria key={sigla} sigla={sigla} produtoInicial={produtoInicial} />;
}
