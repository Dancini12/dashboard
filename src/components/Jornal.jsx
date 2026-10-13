import { useEffect, useRef, useState } from "react";
import { Download, Image, MapPin, Printer, Search, Share2, X } from "lucide-react";
import { getWmo, WEEK } from "../clima";
import useResumoDoDia, { REGIAO } from "./useResumoDoDia";

// Aba "Jornal do dia": o Resumo do dia diagramado como a primeira página de um jornal, em uma folha
// só, para imprimir, salvar em PDF (pela impressão do navegador) ou guardar como imagem. Os dados são
// os mesmos do Resumo do dia (useResumoDoDia); a cidade do tempo é a lembrada neste navegador e pode
// ser trocada aqui. Na impressão, o resto do site some (classes print: no App) e sai só a folha.
const SERIFA = 'Georgia, "Times New Roman", Times, serif';
const VERDE = "#14532d";
const UNIDADES = { "sc 60 kg": "saca", arroba: "arroba", kg: "kg", tonelada: "tonelada" };

const reais = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const decimal = (v, casas = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });
const mm = v => `${decimal(v)} mm`;
const diaMes = data => `${data.slice(8, 10)}/${data.slice(5, 7)}`;
function haQuanto(data) {
  const minutos = Math.floor((Date.now() - new Date(data).getTime()) / 60000);
  if (!Number.isFinite(minutos)) return "";
  return minutos < 60 ? `há ${Math.max(1, minutos)} min` : minutos < 1440 ? `há ${Math.floor(minutos / 60)} h` : new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function Variacao({ valor, sufixo = "", altaERuim }) {
  if (valor == null || !Number.isFinite(valor)) return null;
  const parado = Math.abs(valor) < 0.005;
  const cor = parado ? "#475569" : (valor > 0) !== Boolean(altaERuim) ? "#15803d" : "#b91c1c";
  return <span className="whitespace-nowrap font-bold" style={{ color: cor }}>{parado ? "" : valor > 0 ? "▲ " : "▼ "}{decimal(Math.abs(valor), 2)}%{sufixo}</span>;
}
// Título de seção do jornal: letras pequenas e espaçadas sobre um fio.
const Secao = ({ children }) => <h3 className="border-b font-bold uppercase" style={{ fontSize: 11, lineHeight: 1.3, paddingBottom: 4, letterSpacing: "0.14em", color: VERDE, borderColor: VERDE, fontFamily: "system-ui, sans-serif" }}>{children}</h3>;

export default function Jornal({ dolar, variacaoDoDolar, moedas, indicadores, docente, alunos }) {
  const { chicago, parana, combustiveis, safra, noticias, mercado, cidade, busca, setBusca, procurar, erroDaBusca,
    sojaNaBolsa, sojaEmReais, daRegiao, diesel, doTempo, hoje, proximosDias, chuva, avisos, noCampo, frases } = useResumoDoDia({ dolar, variacaoDoDolar });
  const [fechamento] = useState(() => new Date()); // a edição leva a data e a hora em que a aba foi aberta
  const [imagem, setImagem] = useState(null); // { url, arquivo } da imagem gerada; { erro } se não deu
  const [gerando, setGerando] = useState(false);
  const folha = useRef(null);
  useEffect(() => () => { if (imagem?.url) URL.revokeObjectURL(imagem.url); }, [imagem]);

  const carregando = [chicago, parana, combustiveis, safra, noticias, mercado].some(c => !c.dados && !c.erro) || Boolean(cidade && !hoje && !doTempo.erro);
  const nomeDoArquivo = `agroinfo-jornal-${fechamento.getFullYear()}-${String(fechamento.getMonth() + 1).padStart(2, "0")}-${String(fechamento.getDate()).padStart(2, "0")}.png`;
  // A folha vira imagem com a biblioteca html2canvas, baixada só quando alguém pede. A imagem pronta
  // aparece na tela com os botões de baixar e compartilhar: assim eles agem direto no toque da pessoa
  // (o celular só deixa compartilhar assim) e, se nada mais funcionar, dá para salvar segurando o dedo nela.
  const gerarImagem = async () => {
    setGerando(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const tela = await html2canvas(folha.current, { scale: 2, backgroundColor: "#ffffff", logging: false });
      const blob = await new Promise((entregar, falhar) => tela.toBlob(b => (b ? entregar(b) : falhar(new Error("sem imagem"))), "image/png"));
      setImagem({ url: URL.createObjectURL(blob), arquivo: new File([blob], nomeDoArquivo, { type: "image/png" }) });
    } catch { setImagem({ erro: true }); }
    setGerando(false);
  };
  const podeCompartilhar = Boolean(imagem?.arquivo) && typeof navigator.canShare === "function" && navigator.canShare({ files: [imagem.arquivo] });
  const compartilhar = () => navigator.share({ files: [imagem.arquivo], title: "AgroInfo · Jornal do dia" }).catch(() => { /* a pessoa desistiu de compartilhar */ });

  const [manchete, ...complemento] = frases.length ? frases : ["O dia no campo e no mercado."];
  const temAviso = avisos && (avisos.geada.length || avisos.chuvaForte.length || avisos.calor.length);
  const cotacoes = [
    ["Dólar comercial", dolar ? reais(dolar) : null, <Variacao key="v" valor={variacaoDoDolar} />],
    ["Soja em Chicago", sojaEmReais != null ? `${reais(sojaEmReais)}/saca` : sojaNaBolsa ? `${decimal(sojaNaBolsa.value, 2)} US¢/bushel` : null, sojaNaBolsa && <Variacao key="v" valor={sojaNaBolsa.change} />],
    ...daRegiao.map(({ produto, preco }) => [
      `${produto} ${preco && !preco.daRegiao ? "no Paraná (média)" : "na região"}`,
      preco ? `${reais(preco.valor)}/${UNIDADES[preco.unidade.toLowerCase()] ?? preco.unidade}` : null,
      preco && <Variacao key="v" valor={preco.variacaoPct} />,
    ]),
    ["Diesel S10 no Paraná", diesel ? `${reais(diesel.parana.medio)}/litro` : null, diesel?.semanaAnterior && <Variacao key="v" valor={(diesel.parana.medio - diesel.semanaAnterior) / diesel.semanaAnterior * 100} altaERuim />],
  ];
  const BOTAO = "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs sm:text-sm font-bold disabled:opacity-50";

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-white p-3 shadow-sm print:hidden">
        <h2 className="text-sm font-bold text-green-800">Jornal do dia</h2>
        <p className="text-xs text-slate-600 mt-1">O resumo do dia em uma folha só, em formato de jornal. Imprima, salve em PDF ou guarde como imagem para mandar à turma.</p>
        <form onSubmit={procurar} className="flex gap-1.5 mt-3">
          <label className="relative flex-1 min-w-0">
            <span className="sr-only">Cidade da previsão do tempo</span>
            <MapPin size={13} className="absolute" style={{ left: 9, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} aria-hidden="true" />
            <input value={busca} onChange={e => setBusca(e.target.value)} onFocus={e => e.target.select()} placeholder="Cidade da previsão do tempo (ex.: Londrina)" className="block w-full rounded-lg border bg-white text-base sm:text-sm" style={{ padding: "6px 10px 6px 28px" }} />
          </label>
          <button type="submit" className="flex items-center gap-1 rounded-lg px-3 text-xs font-bold" style={{ border: "1px solid #bbf7d0", color: "#166534", background: "#fff" }}><Search size={12} aria-hidden="true" />Buscar</button>
        </form>
        {erroDaBusca && <p role="alert" className="text-xs text-amber-800 mt-1.5">{erroDaBusca}</p>}
        {!cidade && <p className="text-xs text-slate-500 mt-1.5">Sem cidade escolhida, o jornal sai sem a previsão do tempo.</p>}
        <div className="flex flex-wrap gap-2 mt-3">
          <button type="button" onClick={() => window.print()} disabled={carregando} className={BOTAO} style={{ background: "#166534", color: "#fff" }}><Printer size={14} aria-hidden="true" />Imprimir ou salvar em PDF</button>
          <button type="button" onClick={gerarImagem} disabled={carregando || gerando} className={BOTAO} style={{ border: "1px solid #bbf7d0", color: "#166534", background: "#fff" }}><Image size={14} aria-hidden="true" />{gerando ? "Gerando a imagem…" : "Salvar como imagem"}</button>
        </div>
        <p className="text-xs text-slate-500 mt-2">{carregando ? "Aguarde: os dados do dia ainda estão chegando." : "Para o PDF, escolha “Salvar como PDF” na janela de impressão."}</p>

        {imagem?.erro && <p role="alert" className="rounded-lg p-2.5 mt-3 text-xs sm:text-sm" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#78350f" }}>Não foi possível gerar a imagem neste aparelho. Use a captura de tela do aparelho ou a opção de imprimir.</p>}
        {imagem?.url && (
          <div className="rounded-xl p-3 mt-3" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold" style={{ color: VERDE }}>A imagem está pronta</p>
              <button type="button" onClick={() => setImagem(null)} aria-label="Fechar a imagem" className="rounded-full p-1" style={{ color: "#166534" }}><X size={16} aria-hidden="true" /></button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <a href={imagem.url} download={nomeDoArquivo} className={BOTAO} style={{ background: "#166534", color: "#fff" }}><Download size={14} aria-hidden="true" />Baixar a imagem</a>
              {podeCompartilhar && <button type="button" onClick={compartilhar} className={BOTAO} style={{ border: "1px solid #bbf7d0", color: "#166534", background: "#fff" }}><Share2 size={14} aria-hidden="true" />Compartilhar</button>}
            </div>
            <p className="text-xs text-slate-600 mt-2">No celular, também dá para segurar o dedo na imagem abaixo e escolher salvar nas fotos.</p>
            <img src={imagem.url} alt="Jornal do dia em imagem" className="mt-2 w-full rounded-lg border" style={{ maxWidth: 420, borderColor: "#bbf7d0" }} />
          </div>
        )}
      </section>

      <article ref={folha} className="mx-auto rounded-lg bg-white text-slate-900 shadow-md print:!mt-0 print:max-w-none print:rounded-none print:!p-0 print:shadow-none" style={{ maxWidth: 794, padding: "26px 30px", fontFamily: SERIFA }}>
        <header className="text-center">
          <p className="uppercase text-slate-600" style={{ fontSize: 10, letterSpacing: "0.22em", fontFamily: "system-ui, sans-serif" }}>C.E.E.P.A. Fernando Costa · Informativo Agrícola</p>
          <h2 className="font-black" style={{ fontSize: 52, lineHeight: 1.1, paddingBottom: 6, color: VERDE }}>AgroInfo</h2>
          <div className="flex flex-wrap items-center justify-between gap-x-3 py-1 uppercase" style={{ fontSize: 10.5, letterSpacing: "0.08em", borderTop: "3px double #0f172a", borderBottom: "1px solid #0f172a", fontFamily: "system-ui, sans-serif" }}>
            <span>{fechamento.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
            <span className="font-bold">Jornal do dia</span>
            <span>Fechado às {fechamento.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </header>

        <section className="mt-3 pb-3" style={{ borderBottom: "1px solid #cbd5e1" }}>
          <h3 className="font-black" style={{ fontSize: 27, lineHeight: 1.15 }}>{manchete.replace(/\.$/, "")}</h3>
          {complemento.length > 0 && <p className="mt-1.5 text-slate-700" style={{ fontSize: 15, lineHeight: 1.4 }}>{complemento.join(" ")}</p>}
        </section>

        <div className="grid grid-cols-1 gap-x-6 gap-y-4 mt-3 sm:grid-cols-2 print:grid-cols-2">
          <section>
            <Secao>Mercado</Secao>
            <table className="w-full mt-1" style={{ fontSize: 13 }}>
              <tbody>{cotacoes.map(([nome, valor, variacao]) => (
                <tr key={nome} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td className="py-1.5 pr-2 whitespace-nowrap">{nome}</td>
                  <td className="py-1.5 text-right font-bold whitespace-nowrap">{valor ?? "—"}</td>
                  <td className="py-1.5 pl-2 text-right" style={{ fontSize: 11.5 }}>{valor != null && variacao}</td>
                </tr>
              ))}</tbody>
            </table>
            <p className="mt-1 text-slate-500" style={{ fontSize: 10.5 }}>Região: {REGIAO} (DERAL). Variação do dia; a do diesel é da semana. Chicago convertida para saca de 60 kg no porto.</p>
          </section>

          <div className="space-y-4 sm:border-l sm:pl-6 print:border-l print:pl-6" style={{ borderColor: "#cbd5e1" }}>
            {cidade && (
              <section>
                <Secao>Tempo em {cidade.nome}</Secao>
                {hoje ? <>
                  <p className="mt-1.5" style={{ fontSize: 14 }}><span aria-hidden="true">{getWmo(hoje.tempo).emoji} </span><strong>{getWmo(hoje.tempo).label}</strong>, de {Math.round(hoje.minima)}° a {Math.round(hoje.maxima)}°. Chuva hoje: {mm(hoje.chuva ?? 0)}; nos próximos 7 dias, {mm(chuva.proximos7)}.</p>
                  <table className="w-full mt-1.5 text-center" style={{ fontSize: 12 }}>
                    <tbody>
                      <tr>{proximosDias.map(d => <td key={d.data} className="font-bold" style={{ fontFamily: "system-ui, sans-serif" }}>{WEEK[new Date(`${d.data}T12:00:00`).getDay()]} {diaMes(d.data)}</td>)}</tr>
                      <tr>{proximosDias.map(d => <td key={d.data} style={{ fontSize: 18 }} aria-hidden="true">{getWmo(d.tempo).emoji}</td>)}</tr>
                      <tr>{proximosDias.map(d => <td key={d.data}><strong>{Math.round(d.maxima)}°</strong> {Math.round(d.minima)}°</td>)}</tr>
                      <tr className="text-slate-600">{proximosDias.map(d => <td key={d.data}>{mm(d.chuva ?? 0)}</td>)}</tr>
                    </tbody>
                  </table>
                  <p className="mt-1.5" style={{ fontSize: 12.5, color: temAviso ? "#991b1b" : "#334155" }}>
                    {avisos.geada.length ? <><strong>Risco de geada</strong> em {avisos.geada.map(d => diaMes(d.data)).join(", ")}.</>
                      : avisos.chuvaForte.length ? <><strong>Chuva forte</strong> prevista em {avisos.chuvaForte.map(d => diaMes(d.data)).join(", ")}.</>
                        : avisos.calor.length ? <><strong>Calor forte</strong> previsto em {avisos.calor.map(d => diaMes(d.data)).join(", ")}.</>
                          : "Sem avisos de geada, calor forte ou chuva forte para os próximos 15 dias."}
                  </p>
                </> : <p className="mt-1.5 text-slate-500" style={{ fontSize: 12.5 }}>{doTempo.erro ? "Previsão indisponível agora." : "Buscando a previsão…"}</p>}
              </section>
            )}
            <section>
              <Secao>Lavouras do Paraná</Secao>
              {noCampo.length ? (
                <table className="w-full mt-1" style={{ fontSize: 13 }}>
                  <tbody>{noCampo.map(item => (
                    <tr key={`${item.cultura}-${item.operacao}`} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td className="py-1 pr-2">{item.operacao} · {item.cultura} {item.safra}</td>
                      <td className="py-1 text-right whitespace-nowrap"><strong>{decimal(item.pct)}%</strong> até {item.mes}</td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <p className="mt-1.5 text-slate-500" style={{ fontSize: 12.5 }}>{safra.erro ? "Andamento da safra indisponível agora." : safra.dados ? "Nenhum plantio ou colheita em andamento no último levantamento." : "Buscando o andamento da safra…"}</p>}
            </section>
          </div>
        </div>

        <section className="mt-4">
          <Secao>Notícias para começar o dia</Secao>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 mt-1.5 sm:grid-cols-2 print:grid-cols-2">
            {[["Agronegócio", noticias], ["Mercado", mercado]].map(([assunto, consulta]) => {
              const manchetes = consulta.dados?.items?.slice(0, 3) ?? [];
              return (
                <div key={assunto}>
                  <p className="font-bold uppercase text-slate-500" style={{ fontSize: 10, letterSpacing: "0.12em", fontFamily: "system-ui, sans-serif" }}>{assunto}</p>
                  {manchetes.length ? manchetes.map(item => (
                    <p key={item.link} className="mt-1.5" style={{ fontSize: 13.5, lineHeight: 1.3 }}>
                      <a href={item.link} target="_blank" rel="noopener noreferrer" className="font-bold">{item.title}</a>
                      <span className="block text-slate-500" style={{ fontSize: 10.5, fontFamily: "system-ui, sans-serif" }}>{item.author}{item.pubDate && ` · ${haQuanto(item.pubDate)}`}</span>
                    </p>
                  )) : <p className="mt-1.5 text-slate-500" style={{ fontSize: 12.5 }}>{consulta.erro || consulta.dados ? "Notícias indisponíveis agora." : "Buscando as notícias…"}</p>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-4">
          <Secao>Moedas e indicadores</Secao>
          <p className="mt-1.5" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
            {moedas.filter(m => m.valor != null).map((m, i) => <span key={m.id}>{i > 0 && " · "}{m.nome} <strong>R$ {decimal(m.valor, m.valor < 1 ? 4 : 2)}</strong></span>)}
            {moedas.every(m => m.valor == null) && <span className="text-slate-500">Moedas indisponíveis agora.</span>}
          </p>
          <p className="mt-0.5" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
            {indicadores.map((ind, i) => <span key={ind.nome}>{i > 0 && " · "}{ind.nome}{ind.periodo && ` (${ind.periodo})`} <strong>{ind.valor}</strong></span>)}
          </p>
        </section>

        <footer className="mt-3 pt-2 text-slate-500" style={{ fontSize: 10, lineHeight: 1.45, borderTop: "1px solid #0f172a", fontFamily: "system-ui, sans-serif" }}>
          <p>Fontes: AwesomeAPI (dólar), Yahoo Finance (Chicago, com atraso), DERAL/SEAB-PR (preços e safra), ANP (diesel), Open-Meteo (tempo), Google Notícias e Banco Central.</p>
          <p>Docente: {docente} · {alunos.length > 1 ? "Estudantes participantes" : "Estudante participante"}: {alunos.join(", ")} · agroinfo-dashboard.vercel.app</p>
        </footer>
      </article>
    </div>
  );
}
