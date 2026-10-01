import { useEffect, useState } from "react";
import { Calculator, ChevronRight, GitCompareArrows, GraduationCap, MessageCircleQuestion } from "lucide-react";
import { CHICAGO } from "../catalogo";
import { sacaPorChicago } from "../calculos";
import { avisosDaPrevisao, buscarClima, getWmo, resumoDaChuva, SANTA_MARIANA } from "../clima";
import { operacoesEmAndamento, precoNaRegiao } from "../inicio";

// Aba "Início": o resumo do dia. Poucos números, cada um levando à aba onde está o detalhe:
// mercado (dólar, Chicago, preços da região, diesel), campo (clima e safra), atalhos para a aula,
// manchetes e, no fim, os cartões de moedas e de indicadores da economia (children). Cada parte carrega sozinha e, se a fonte falhar, avisa sem travar o resto.
const REGIAO = "Cornélio Procópio";
const UNIDADES = { "sc 60 kg": "saca", arroba: "arroba", kg: "kg", tonelada: "tonelada" };
const SOJA_EM_CHICAGO = CHICAGO.find(item => item.key === "soja");

const reais = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const decimal = (v, casas = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });
const mm = v => `${decimal(v)} mm`;
const diaMes = data => `${data.slice(8, 10)}/${data.slice(5, 7)}`;
function haQuanto(data) {
  const minutos = Math.floor((Date.now() - new Date(data).getTime()) / 60000);
  if (!Number.isFinite(minutos)) return "";
  return minutos < 60 ? `há ${Math.max(1, minutos)} min` : minutos < 1440 ? `há ${Math.floor(minutos / 60)} h` : new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
const hojePorExtenso = () => new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

// Busca uma parte do resumo; devolve { dados } ou { erro }.
function useConsulta(url) {
  const [estado, setEstado] = useState({});
  useEffect(() => {
    let ativo = true;
    fetch(url, { signal: AbortSignal.timeout(45000) })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("indisponível"))))
      .then(dados => { if (ativo) setEstado({ dados }); })
      .catch(() => { if (ativo) setEstado({ erro: true }); });
    return () => { ativo = false; };
  }, [url]);
  return estado;
}

function Variacao({ valor, sufixo, altaERuim }) {
  if (valor == null || !Number.isFinite(valor)) return null;
  const parado = Math.abs(valor) < 0.005;
  const cor = parado ? "#64748b" : (valor > 0) !== Boolean(altaERuim) ? "#15803d" : "#b91c1c";
  return <span className="font-semibold whitespace-nowrap" style={{ color: cor }}>{parado ? "" : valor > 0 ? "▲ +" : "▼ −"}{decimal(Math.abs(valor), 2)}%{sufixo}</span>;
}

// Um número do dia. Toque leva à aba com o detalhe.
function Quadro({ rotulo, valor, unidade, estado, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="rounded-xl border bg-white p-3 text-left shadow-sm transition-colors hover:bg-green-50" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <span className="flex items-center justify-between gap-1 text-xs text-slate-500">{rotulo}<ChevronRight size={13} className="shrink-0" aria-hidden="true" /></span>
      {valor != null
        ? <span className="block mt-1 text-xl sm:text-2xl font-black text-slate-900 leading-tight">{valor}{unidade && <span className="text-xs font-normal text-slate-500">/{unidade}</span>}</span>
        : estado === "erro" ? <span className="block mt-1 text-sm text-slate-500">indisponível agora</span>
          : <span className="block mt-1.5 h-6 w-24 rounded animate-pulse" style={{ background: "#e2e8f0" }} aria-label="carregando" />}
      {valor != null && children && <span className="block mt-1 text-xs text-slate-600">{children}</span>}
    </button>
  );
}
const Titulo = ({ children }) => <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">{children}</h2>;
const VerMais = ({ onClick, children }) => (
  <button type="button" onClick={onClick} className="mt-2 inline-flex items-center gap-0.5 text-xs font-bold text-green-800">{children}<ChevronRight size={13} aria-hidden="true" /></button>
);

export default function Inicio({ dolar, variacaoDoDolar, onIr, onCastor, children }) {
  const chicago = useConsulta("/api/market?type=bolsas");
  const parana = useConsulta("/api/market?type=pr");
  const combustiveis = useConsulta("/api/market?type=combustiveis");
  const safra = useConsulta("/api/market?type=safra");
  const noticias = useConsulta("/api/news?feed=agro");
  const [clima, setClima] = useState({});
  useEffect(() => {
    let ativo = true;
    buscarClima(SANTA_MARIANA).then(dados => { if (ativo) setClima({ dados }); }).catch(() => { if (ativo) setClima({ erro: true }); });
    return () => { ativo = false; };
  }, []);
  const estadoDe = consulta => (consulta.erro ? "erro" : "carregando");

  const sojaNaBolsa = chicago.dados?.contratos.find(c => c.symbol === SOJA_EM_CHICAGO.symbol);
  const sojaEmReais = sojaNaBolsa && dolar ? sacaPorChicago({ chicago: sojaNaBolsa.value, dolar, kgDoBushel: SOJA_EM_CHICAGO.kg }).noPorto : null;
  const daRegiao = ["Soja", "Milho", "Boi"].map(produto => ({ produto, preco: precoNaRegiao(parana.dados, produto, REGIAO) }));
  const diesel = combustiveis.dados?.produtos.find(p => p.nome === "Diesel S10");
  const hoje = clima.dados?.dias.find(d => d.data === clima.dados.hoje);
  const chuva = clima.dados && resumoDaChuva(clima.dados.dias, clima.dados.hoje);
  const avisos = clima.dados && avisosDaPrevisao(clima.dados.dias, clima.dados.hoje);
  const noCampo = safra.dados?.parana ? operacoesEmAndamento(safra.dados.parana.culturas).slice(0, 4) : [];
  const manchetes = noticias.dados?.items?.slice(0, 3) ?? [];

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">Resumo de <strong className="text-slate-900">{hojePorExtenso()}</strong>. Toque em um quadro para ver o detalhe.</p>

      <section>
        <Titulo>Hoje no mercado</Titulo>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
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
      </section>

      <section>
        <Titulo>No campo</Titulo>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
          <div className="rounded-xl border bg-white p-3 shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
            <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>Tempo em Santa Mariana</h3>
            {hoje ? <>
              <div className="flex items-center gap-3 mt-2">
                <span style={{ fontSize: 34, lineHeight: 1 }} aria-hidden="true">{getWmo(hoje.tempo).emoji}</span>
                <div>
                  <div className="text-sm font-bold text-slate-900">{getWmo(hoje.tempo).label}, {Math.round(hoje.minima)}° a {Math.round(hoje.maxima)}°</div>
                  <div className="text-xs text-slate-600">Chuva hoje: {mm(hoje.chuva ?? 0)} · próximos 7 dias: <strong>{mm(chuva.proximos7)}</strong></div>
                  <div className="text-xs text-slate-600">Últimos 30 dias: {mm(chuva.ultimos30)}</div>
                </div>
              </div>
              <p className="rounded-lg px-2 py-1.5 mt-2 text-xs" style={avisos.geada.length || avisos.calor.length || avisos.chuvaForte.length ? { background: "#fef2f2", border: "1px solid #fecaca", color: "#7f1d1d" } : { background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#14532d" }}>
                {avisos.geada.length ? <><strong>❄️ Risco de geada</strong> em {avisos.geada.map(d => diaMes(d.data)).join(", ")}.</>
                  : avisos.chuvaForte.length ? <><strong>⛈️ Chuva forte</strong> prevista em {avisos.chuvaForte.map(d => diaMes(d.data)).join(", ")}.</>
                    : avisos.calor.length ? <><strong>🌡️ Calor forte</strong> previsto em {avisos.calor.map(d => diaMes(d.data)).join(", ")}.</>
                      : <><strong>✅ Sem avisos</strong> de geada, calor forte ou chuva forte para os próximos 15 dias.</>}
              </p>
            </> : <p className="text-xs text-slate-500 mt-2">{clima.erro ? "Previsão indisponível agora." : "Buscando a previsão…"}</p>}
            <VerMais onClick={() => onIr({ aba: "clima" })}>Ver o clima completo</VerMais>
          </div>
          <div className="rounded-xl border bg-white p-3 shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
            <h3 className="text-sm font-bold" style={{ color: "#14532d" }}>Lavouras do Paraná</h3>
            {noCampo.length ? (
              <ul className="mt-2 space-y-2">
                {noCampo.map(item => (
                  <li key={`${item.cultura}-${item.operacao}`} className="text-xs">
                    <div className="flex justify-between gap-2"><span className="text-slate-700">{item.operacao} · {item.cultura} {item.safra}</span><span className="text-slate-600 whitespace-nowrap"><strong className="text-slate-900">{decimal(item.pct)}%</strong> até {item.mes}</span></div>
                    <span className="block rounded-full overflow-hidden mt-0.5" style={{ height: 6, background: "#cde2fb" }}><span className="block" style={{ height: "100%", width: `${item.pct}%`, background: "#2a78d6" }} /></span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-slate-500 mt-2">{safra.erro ? "Andamento da safra indisponível agora." : safra.dados ? "Nenhum plantio ou colheita em andamento no último levantamento." : "Buscando o andamento da safra…"}</p>}
            <VerMais onClick={() => onIr({ aba: "safra" })}>Ver a safra e o calendário agrícola</VerMais>
          </div>
        </div>
      </section>

      <section>
        <Titulo>Para a aula</Titulo>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
          {[
            [GraduationCap, "Simulação: uma safra na prática", "Decida como um produtor, da semente à venda.", () => onIr({ aba: "aprender", ancora: "simulacao-safra" })],
            [Calculator, "Calculadoras", "Preço da saca, unidades, relação de troca, custo e crédito.", () => onIr({ aba: "calculadoras" })],
            [GitCompareArrows, "Comparar: qual subiu mais?", "Chicago, Nova Iorque, commodities do Brasil e ações no mesmo gráfico.", () => onIr({ aba: "evolucao", ancora: "comparar-historico" })],
            ...(onCastor ? [[MessageCircleQuestion, "Perguntar ao Castor", "O assistente do AgroInfo tira dúvidas sobre o mercado.", onCastor]] : []),
          ].map(([Icone, nome, descricao, abrir]) => (
            <button key={nome} type="button" onClick={abrir} className="flex items-center gap-3 rounded-xl border bg-white p-3 text-left shadow-sm transition-colors hover:bg-green-50" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: "#166534" }}><Icone size={17} color="#fff" aria-hidden="true" /></span>
              <span className="min-w-0"><span className="block text-sm font-bold text-slate-900">{nome}</span><span className="block text-xs text-slate-600">{descricao}</span></span>
              <ChevronRight size={15} className="ml-auto shrink-0 text-slate-400" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      <section>
        <Titulo>Notícias do agro</Titulo>
        <div className="rounded-xl border bg-white p-3 mt-2 shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          {manchetes.length ? (
            <ul className="divide-y">
              {manchetes.map(item => (
                <li key={item.link} className="py-2 first:pt-0">
                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="block text-sm font-semibold text-slate-900 hover:underline">{item.title}</a>
                  <span className="text-xs text-slate-500">{item.author}{item.pubDate && ` · ${haQuanto(item.pubDate)}`}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-slate-500">{noticias.erro || noticias.dados ? "Notícias indisponíveis agora." : "Buscando as notícias…"}</p>}
          <VerMais onClick={() => onIr({ aba: "noticias" })}>Ver todas as notícias</VerMais>
        </div>
      </section>

      <section>
        <Titulo>Moedas e indicadores da economia</Titulo>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">{children}</div>
      </section>

      <p className="text-xs text-slate-500">
        Fontes: AwesomeAPI (dólar), Yahoo Finance (Chicago, com atraso), DERAL/SEAB-PR (preços e safra), ANP (diesel), Open-Meteo (tempo), Google Notícias e Banco Central.
        As ações da B3 estão na aba Bolsas; os combustíveis e os indicadores de preço do Brasil, em Cotações Cooperativas.
      </p>
    </div>
  );
}
