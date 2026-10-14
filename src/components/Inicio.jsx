import { Calculator, ChevronRight, GitCompareArrows, GraduationCap, MapPin, MessageCircleQuestion, Search } from "lucide-react";
import { getWmo, WEEK } from "../clima";
import useResumoDoDia, { REGIAO } from "./useResumoDoDia";

// "Resumo do dia", a página que abre o site, montada como a primeira página de um jornal: a manchete
// (a notícia mais recente do agronegócio), a coluna de notícias à esquerda, o quadro das cotações no
// lugar da foto, as notícias de mercado e as lavouras abaixo dele, o quadro cinza da previsão do tempo
// da cidade que o visitante escolher (lembrada neste navegador), os atalhos para a aula e, no fim, os
// cartões de moedas e de indicadores da economia (children). Cada número leva à aba com o detalhe. Os
// dados vêm de useResumoDoDia, o mesmo do Jornal do dia: cada parte carrega sozinha e, se a fonte
// falhar, avisa sem travar o resto.
const UNIDADES = { "sc 60 kg": "saca", arroba: "arroba", kg: "kg", tonelada: "tonelada" };
const TITULO = '"Times New Roman", Times, Georgia, serif';
const SEM_SERIFA = "system-ui, -apple-system, sans-serif";
const TINTA = "#111111";

const reais = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const decimal = (v, casas = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });
const mm = v => `${decimal(v)} mm`;
const diaMes = data => `${data.slice(8, 10)}/${data.slice(5, 7)}`;
function haQuanto(data) {
  const minutos = Math.floor((Date.now() - new Date(data).getTime()) / 60000);
  if (!Number.isFinite(minutos)) return "";
  return minutos < 60 ? `há ${Math.max(1, minutos)} min` : minutos < 1440 ? `há ${Math.floor(minutos / 60)} h` : new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function Variacao({ valor, sufixo, altaERuim }) {
  if (valor == null || !Number.isFinite(valor)) return null;
  const parado = Math.abs(valor) < 0.005;
  const cor = parado ? "#666666" : (valor > 0) !== Boolean(altaERuim) ? "#15803d" : "#b91c1c";
  return <span className="font-semibold whitespace-nowrap" style={{ color: cor }}>{parado ? "" : valor > 0 ? "▲ +" : "▼ −"}{decimal(Math.abs(valor), 2)}%{sufixo}</span>;
}

// Um número do dia, numa casa do quadro de cotações. Toque leva à aba com o detalhe.
function Quadro({ rotulo, valor, unidade, estado, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="bg-white p-3 text-left transition-colors hover:bg-neutral-100">
      <span className="flex items-start justify-between gap-1 uppercase" style={{ fontSize: 10, lineHeight: 1.4, minHeight: "2.8em", letterSpacing: "0.08em", fontFamily: SEM_SERIFA, color: "#444444" }}>{rotulo}<ChevronRight size={12} className="shrink-0" aria-hidden="true" /></span>
      {valor != null
        ? <span className="block mt-1 font-bold leading-tight" style={{ fontFamily: TITULO, fontSize: "clamp(20px, 3.2vw, 26px)" }}>{valor}{unidade && <span className="font-normal" style={{ fontSize: 12, color: "#555555" }}>/{unidade}</span>}</span>
        : estado === "erro" ? <span className="block mt-1 text-sm text-neutral-500">indisponível agora</span>
          : <span className="block mt-1.5 h-6 w-24 animate-pulse" style={{ background: "#e5e5e5" }} aria-label="carregando" />}
      {valor != null && children && <span className="block mt-1 text-xs text-neutral-600">{children}</span>}
    </button>
  );
}
// Título de seção: letras pequenas e espaçadas sobre um fio, como nas páginas de jornal.
const Titulo = ({ children }) => <h2 className="font-bold uppercase" style={{ fontSize: 11, letterSpacing: "0.12em", fontFamily: SEM_SERIFA, borderBottom: `1px solid ${TINTA}`, paddingBottom: 3 }}>{children}</h2>;
const VerMais = ({ onClick, children }) => (
  <button type="button" onClick={onClick} className="mt-2 inline-flex items-center gap-0.5 text-xs font-bold hover:underline">{children}<ChevronRight size={13} aria-hidden="true" /></button>
);
// Lista de manchetes com a fonte e a hora, como as notas de uma coluna de jornal.
function Notas({ consulta, de = 0, ate = 3 }) {
  const itens = consulta.dados?.items?.slice(de, ate) ?? [];
  if (!itens.length) return <p className="text-xs text-neutral-500 mt-2">{consulta.erro || consulta.dados ? "Notícias indisponíveis agora." : "Buscando as notícias…"}</p>;
  return (
    <ul className="divide-y divide-neutral-300">
      {itens.map(item => (
        <li key={item.link} className="py-2.5">
          <a href={item.link} target="_blank" rel="noopener noreferrer" className="block font-bold leading-snug hover:underline" style={{ fontSize: 15 }}>{item.title}</a>
          <span className="block mt-0.5 italic text-xs text-neutral-500">{item.author}{item.pubDate && ` · ${haQuanto(item.pubDate)}`}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Inicio({ dolar, variacaoDoDolar, onIr, onCastor, children }) {
  const { chicago, parana, combustiveis, safra, noticias, mercado, cidade, busca, setBusca, procurar, erroDaBusca,
    sojaNaBolsa, sojaEmReais, daRegiao, diesel, doTempo, hoje, semana, chuva, avisos, noCampo } = useResumoDoDia({ dolar, variacaoDoDolar });
  const estadoDe = consulta => (consulta.erro ? "erro" : "carregando");
  const manchete = noticias.dados?.items?.[0];
  const aviso = !avisos ? null : avisos.geada.length ? ["❄️ Risco de geada", avisos.geada] : avisos.chuvaForte.length ? ["⛈️ Chuva forte prevista", avisos.chuvaForte] : avisos.calor.length ? ["🌡️ Calor forte previsto", avisos.calor] : null;

  return (
    <div className="space-y-6">
      <h2 className="sr-only">Resumo do dia</h2>

      {/* manchete: a notícia mais recente do agronegócio */}
      <section className="text-center" aria-label="Manchete do dia">
        {manchete ? <>
          <a href={manchete.link} target="_blank" rel="noopener noreferrer" className="block font-bold hover:underline" style={{ fontFamily: TITULO, fontSize: manchete.title.length > 90 ? "clamp(24px, 5vw, 34px)" : "clamp(28px, 6.4vw, 46px)", lineHeight: 1.1 }}>{manchete.title}</a>
          <p className="mt-2 text-sm font-bold">{manchete.author}{manchete.pubDate && ` · ${haQuanto(manchete.pubDate)}`}</p>
        </> : <p className="py-4 text-sm text-neutral-500">{noticias.erro || noticias.dados ? "A manchete do dia não está disponível agora." : "Buscando a manchete do dia…"}</p>}
      </section>

      <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-3" style={{ borderTop: `1px solid ${TINTA}`, paddingTop: 16 }}>
        {/* colunas 2 e 3 (no celular, logo depois da manchete): o quadro das cotações no lugar da foto do modelo */}
        <div className="sm:col-span-2 sm:order-2">
          <section>
            <Titulo>Hoje no mercado</Titulo>
            <div className="grid grid-cols-2 gap-px mt-2 sm:grid-cols-3" style={{ background: "#d4d4d4", border: `1px solid ${TINTA}` }}>
              <Quadro rotulo="Dólar comercial" valor={dolar ? reais(dolar) : null} estado={dolar === null ? "erro" : "carregando"} onClick={() => onIr({ aba: "inicio", ancora: "card-moedas" })}>
                <Variacao valor={variacaoDoDolar} sufixo=" hoje" />
              </Quadro>
              <Quadro rotulo="Soja em Chicago" valor={sojaEmReais != null ? reais(sojaEmReais) : sojaNaBolsa ? decimal(sojaNaBolsa.value, 2) : null} unidade={sojaEmReais != null ? "saca" : sojaNaBolsa ? "bushel (US¢)" : null}
                estado={estadoDe(chicago)} onClick={() => onIr({ aba: "bolsas", contrato: "soja", ancora: "bolsa-detalhe" })}>
                {sojaNaBolsa && <>{sojaEmReais != null && <>{decimal(sojaNaBolsa.value, 2)} US¢/bushel · </>}<Variacao valor={sojaNaBolsa.change} sufixo=" hoje" /></>}
              </Quadro>
              {daRegiao.map(({ produto, preco }) => (
                <Quadro key={produto} rotulo={`${produto} ${preco && !preco.daRegiao ? "no Paraná (média)" : `em ${REGIAO}`}`} valor={preco ? reais(preco.valor) : null} unidade={preco ? UNIDADES[preco.unidade.toLowerCase()] ?? preco.unidade : null}
                  estado={parana.dados ? "erro" : estadoDe(parana)} onClick={() => onIr({ aba: "cooperativas", produto })}>
                  {preco && <>{preco.daRegiao && preco.mediaEstado != null && <>Paraná: {reais(preco.mediaEstado)} · </>}<Variacao valor={preco.variacaoPct} sufixo={preco.daRegiao ? " no estado" : " sobre ontem"} /></>}
                </Quadro>
              ))}
              <Quadro rotulo="Diesel S10 no Paraná" valor={diesel ? reais(diesel.parana.medio) : null} unidade={diesel ? "litro" : null} estado={combustiveis.dados ? "erro" : estadoDe(combustiveis)} onClick={() => onIr({ aba: "cooperativas", ancora: "card-combustiveis" })}>
                {diesel?.semanaAnterior && <Variacao valor={(diesel.parana.medio - diesel.semanaAnterior) / diesel.semanaAnterior * 100} sufixo=" na semana" altaERuim />}
              </Quadro>
            </div>
            <p className="mt-1 italic text-xs text-neutral-500">Cotações do dia: Bolsa de Chicago, preços da região de {REGIAO} (DERAL) e diesel nos postos do Paraná (ANP).</p>
          </section>

          <div className="grid grid-cols-1 gap-x-6 gap-y-6 mt-6 sm:grid-cols-2">
            <section>
              <Titulo>Mercado</Titulo>
              <Notas consulta={mercado} />
            </section>
            <section>
              <Titulo>Lavouras do Paraná</Titulo>
              {noCampo.length ? (
                <ul className="mt-2.5 space-y-2.5">
                  {noCampo.map(item => (
                    <li key={`${item.cultura}-${item.operacao}`} className="text-xs">
                      <div className="flex justify-between gap-2"><span>{item.operacao} · {item.cultura} {item.safra}</span><span className="whitespace-nowrap text-neutral-600"><strong className="text-neutral-900">{decimal(item.pct)}%</strong> até {item.mes}</span></div>
                      <span className="block overflow-hidden mt-1" style={{ height: 5, background: "#e0e0e0" }}><span className="block" style={{ height: "100%", width: `${item.pct}%`, background: TINTA }} /></span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-neutral-500 mt-2">{safra.erro ? "Andamento da safra indisponível agora." : safra.dados ? "Nenhum plantio ou colheita em andamento no último levantamento." : "Buscando o andamento da safra…"}</p>}
              <VerMais onClick={() => onIr({ aba: "safra" })}>Ver a safra e o calendário agrícola</VerMais>
            </section>
          </div>
        </div>

        {/* coluna 1: as notícias do agronegócio, no lugar do texto corrido do modelo */}
        <section className="sm:order-1">
          <Titulo>Agronegócio</Titulo>
          <Notas consulta={noticias} de={1} ate={6} />
          <VerMais onClick={() => onIr({ aba: "noticias" })}>Ver todas as notícias</VerMais>
        </section>
      </div>

      {/* quadro cinza da previsão do tempo, como no modelo */}
      <section className="p-4 sm:p-5" style={{ borderTop: `1px solid ${TINTA}`, background: "#e8e8e8" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-bold" style={{ fontSize: "clamp(26px, 6vw, 38px)", lineHeight: 1.1, color: "#6b6b6b" }}>Previsão do tempo</h2>
            {cidade && hoje && (
              <p className="mt-1.5 text-sm" style={{ color: "#333333" }}>
                <strong>{cidade.nome}.</strong> Hoje, {getWmo(hoje.tempo).label.toLowerCase()}, de {Math.round(hoje.minima)}° a {Math.round(hoje.maxima)}°. Chuva hoje: {mm(hoje.chuva ?? 0)}; nos próximos 7 dias, {mm(chuva.proximos7)}; nos últimos 30 dias, {mm(chuva.ultimos30)}.
              </p>
            )}
          </div>
          {hoje && <span className="shrink-0" style={{ fontSize: 48, lineHeight: 1 }} aria-hidden="true">{getWmo(hoje.tempo).emoji}</span>}
        </div>
        <form onSubmit={procurar} className="flex gap-1.5 mt-3" style={{ maxWidth: 420 }}>
          <label className="relative flex-1 min-w-0">
            <span className="sr-only">Cidade</span>
            <MapPin size={13} className="absolute" style={{ left: 9, top: "50%", transform: "translateY(-50%)", color: "#666666" }} aria-hidden="true" />
            <input value={busca} onChange={e => setBusca(e.target.value)} onFocus={e => e.target.select()} placeholder="Digite sua cidade (ex.: Londrina)" className="block w-full border bg-white text-base sm:text-sm" style={{ padding: "6px 10px 6px 28px", borderColor: "#bdbdbd" }} />
          </label>
          <button type="submit" className="flex items-center gap-1 px-3 text-xs font-bold text-white" style={{ background: TINTA }}><Search size={12} aria-hidden="true" />Buscar</button>
        </form>
        {erroDaBusca && <p role="alert" className="text-xs mt-1.5" style={{ color: "#7f1d1d" }}>{erroDaBusca}</p>}
        {!cidade ? <p className="text-xs mt-2" style={{ color: "#444444" }}>Escolha a cidade para ver o tempo de hoje e dos próximos 7 dias. O site lembra a cidade neste aparelho.</p> : hoje ? <>
          <ol className="grid grid-cols-4 gap-y-3 mt-4 text-center sm:grid-cols-7" style={{ fontSize: 12, color: "#222222" }} aria-label="Previsão de 7 dias">
            {semana.map((d, i) => (
              <li key={d.data} title={getWmo(d.tempo).label}>
                <span className="block" style={{ fontFamily: SEM_SERIFA }}><strong>{i === 0 ? "Hoje" : WEEK[new Date(`${d.data}T12:00:00`).getDay()]}</strong> <span style={{ fontSize: 10.5, color: "#555555" }}>{diaMes(d.data)}</span></span>
                <span className="block" style={{ fontSize: 22, lineHeight: 1.3 }} aria-hidden="true">{getWmo(d.tempo).emoji}</span>
                <span className="block"><strong>{Math.round(d.maxima)}°</strong> {Math.round(d.minima)}°</span>
                <span className="block">{mm(d.chuva ?? 0)}</span>
                <span className="block" style={{ fontSize: 10.5, color: "#555555" }}>{d.probabilidade != null ? `${d.probabilidade}% de chance` : " "}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs" style={{ color: aviso ? "#7f1d1d" : "#333333" }}>
            {aviso ? <><strong>{aviso[0]}</strong> em {aviso[1].map(d => diaMes(d.data)).join(", ")}.</> : <><strong>Sem avisos</strong> de geada, calor forte ou chuva forte para os próximos 15 dias.</>}
          </p>
        </> : <p className="text-xs mt-2" style={{ color: "#444444" }}>{doTempo.erro && doTempo.desistiu ? "Previsão indisponível agora. Toque em “Buscar” para tentar de novo." : doTempo.erro ? `O serviço de clima está demorando a responder. Tentando de novo a previsão de ${cidade.nome}…` : `Buscando a previsão de ${cidade.nome}…`}</p>}
        {cidade && <VerMais onClick={() => onIr({ aba: "clima", cidade })}>Ver o clima completo</VerMais>}
      </section>

      <section>
        <Titulo>Para a aula</Titulo>
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          {[
            [GraduationCap, "Simulação: uma safra na prática", "Decida como um produtor, da semente à venda.", () => onIr({ aba: "aprender", ancora: "simulacao-safra" })],
            [Calculator, "Calculadoras", "Preço da saca, unidades, relação de troca, custo e crédito.", () => onIr({ aba: "calculadoras" })],
            [GitCompareArrows, "Comparar: qual subiu mais?", "Chicago, Nova Iorque, commodities do Brasil e ações no mesmo gráfico.", () => onIr({ aba: "evolucao", ancora: "comparar-historico" })],
            ...(onCastor ? [[MessageCircleQuestion, "Perguntar ao Castor", "O assistente do AgroInfo tira dúvidas sobre o mercado.", onCastor]] : []),
          ].map(([Icone, nome, descricao, abrir]) => (
            <button key={nome} type="button" onClick={abrir} className="flex items-center gap-3 py-3 text-left transition-colors hover:bg-neutral-100" style={{ borderBottom: "1px solid #d4d4d4" }}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center" style={{ background: TINTA }}><Icone size={17} color="#fff" aria-hidden="true" /></span>
              <span className="min-w-0"><span className="block font-bold" style={{ fontFamily: TITULO, fontSize: 16 }}>{nome}</span><span className="block text-xs text-neutral-600">{descricao}</span></span>
              <ChevronRight size={15} className="ml-auto shrink-0 text-neutral-400" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      <section>
        <Titulo>Moedas e indicadores da economia</Titulo>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">{children}</div>
      </section>

      <p className="text-xs text-neutral-500" style={{ borderTop: "1px solid #d4d4d4", paddingTop: 8 }}>
        Fontes: AwesomeAPI (dólar), Yahoo Finance (Chicago, com atraso), DERAL/SEAB-PR (preços e safra), ANP (diesel), Open-Meteo (tempo), Google Notícias e Banco Central.
        As ações da B3 estão na aba Bolsas; os combustíveis e os indicadores de preço do Brasil, em Cotações Cooperativas.
      </p>
    </div>
  );
}
