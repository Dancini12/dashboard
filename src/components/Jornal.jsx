import { useEffect, useRef, useState } from "react";
import { Download, Image, MapPin, Printer, RefreshCw, Search, Share2, X } from "lucide-react";
import { getWmo, WEEK } from "../clima";
import { diaDoBoletim, horaDaCotacao, organizarNoticias, textosDoJornal } from "../inicio";
import Enfeite from "./Enfeite";
import useResumoDoDia, { REGIAO } from "./useResumoDoDia";

// Aba "Jornal do dia": o Resumo do dia diagramado como a primeira página de um jornal clássico, em
// preto e branco e em uma folha só, para imprimir, salvar em PDF (pela impressão do navegador) ou
// guardar como imagem. De cima para baixo: título do jornal, manchete, o corpo em três colunas (texto
// corrido, quadro de cotações e notícias) e o quadro cinza com a previsão do tempo de 7 dias da cidade
// escolhida. Os dados são os do Resumo do dia (useResumoDoDia); a cidade é a lembrada neste navegador
// e pode ser trocada aqui. Na impressão, o resto do site some (classes print: no App) e sai só a folha.
const TITULO = '"Times New Roman", Times, Georgia, serif';
const TEXTO = 'Georgia, "Times New Roman", Times, serif';
const SEM_SERIFA = "system-ui, sans-serif";
const PRETO = "#111111";
const FIO = `1px solid ${PRETO}`;
const UNIDADES = { "sc 60 kg": "saca", arroba: "arroba", kg: "kg", tonelada: "tonelada" };

const reais = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const decimal = (v, casas = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });
const mm = v => `${decimal(v)} mm`;
const diaMes = data => `${data.slice(8, 10)}/${data.slice(5, 7)}`;
const comMaiuscula = texto => texto.charAt(0).toUpperCase() + texto.slice(1);
function haQuanto(data) {
  const minutos = Math.floor((Date.now() - new Date(data).getTime()) / 60000);
  if (!Number.isFinite(minutos)) return "";
  return minutos < 60 ? `há ${Math.max(1, minutos)} min` : minutos < 1440 ? `há ${Math.floor(minutos / 60)} h` : new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
// Variação em preto, como o resto da folha: a seta diz se subiu ou caiu.
const variacao = valor => (valor == null || !Number.isFinite(valor) ? "" : Math.abs(valor) < 0.005 ? "estável" : `${valor > 0 ? "▲" : "▼"} ${decimal(Math.abs(valor), 2)}%`);
// Manchete de notícia comprida demais é cortada em palavra inteira, para a folha caber em uma página.
const encurtar = (texto, limite = 110) => (texto.length <= limite ? texto : `${texto.slice(0, limite).replace(/\s+\S*$/, "")}…`);
// Trecho do texto corrido, com o assunto em destaque no começo, como nos jornais.
const Trecho = ({ assunto, children }) => <p style={{ marginBottom: 8 }}><strong className="uppercase" style={{ fontSize: "0.86em", letterSpacing: "0.06em" }}>{assunto} — </strong>{children}</p>;

export default function Jornal({ dolar, variacaoDoDolar, moedas, indicadores }) {
  const { chicago, parana, combustiveis, safra, noticias, mercado, cidade, busca, setBusca, procurar, erroDaBusca, atualizadoEm, respondidoEm, atualizar,
    sojaNaBolsa, sojaEmReais, daRegiao, diesel, doTempo, hoje, semana, chuva, avisos, noCampo, frases } = useResumoDoDia({ dolar, variacaoDoDolar });
  // a edição leva a data e a hora da atualização mais recente dos dados (o resumo se atualiza sozinho)
  const [aberturaDaAba] = useState(() => Date.now());
  const fechamento = new Date(atualizadoEm ?? aberturaDaAba);
  const [pediuEm, setPediuEm] = useState(null); // hora do toque em "Atualizar agora", até os dados novos chegarem
  const atualizando = pediuEm != null && (respondidoEm ?? 0) < pediuEm;
  const concluido = pediuEm != null && !atualizando; // a atualização pedida terminou: o botão confirma
  const temporizador = useRef(null);
  const atualizarAgora = () => {
    setPediuEm(Date.now());
    atualizar();
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setPediuEm(null), 45000); // depois de um tempo (ou se as fontes não responderem), o botão volta ao normal
  };
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
      // windowWidth: a folha é desenhada como em tela larga, e a imagem sai em página inteira até no celular
      const tela = await html2canvas(folha.current, { scale: 2, backgroundColor: "#ffffff", logging: false, windowWidth: 1024 });
      const blob = await new Promise((entregar, falhar) => tela.toBlob(b => (b ? entregar(b) : falhar(new Error("sem imagem"))), "image/png"));
      setImagem({ url: URL.createObjectURL(blob), arquivo: new File([blob], nomeDoArquivo, { type: "image/png" }) });
    } catch { setImagem({ erro: true }); }
    setGerando(false);
  };
  const podeCompartilhar = Boolean(imagem?.arquivo) && typeof navigator.canShare === "function" && navigator.canShare({ files: [imagem.arquivo] });
  const compartilhar = () => navigator.share({ files: [imagem.arquivo], title: "Informativo Agrícola · Jornal do dia" }).catch(() => { /* a pessoa desistiu de compartilhar */ });

  const [manchete, ...complemento] = frases.length ? frases : ["O dia no campo e no mercado."];
  // notícias por assunto: três do agro, sem repetir tema, e três de economia que mexem com o agro
  const doAgro = organizarNoticias(noticias.dados?.items, "agro");
  const colunasDeNoticias = [
    { assunto: "Agronegócio", consulta: noticias, itens: doAgro },
    { assunto: "Economia", consulta: mercado, itens: organizarNoticias(mercado.dados?.items, "economia", 3, doAgro) },
  ];
  const textos = textosDoJornal({ dolar, variacaoDoDolar, sojaEmReais, variacaoDaSoja: sojaNaBolsa?.change, daRegiao, regiao: REGIAO, diesel, noCampo, moedas, indicadores });
  const cotacoes = [
    ["Dólar comercial", dolar ? reais(dolar) : null, "", variacao(variacaoDoDolar)],
    ["Soja em Chicago", sojaEmReais != null ? reais(sojaEmReais) : sojaNaBolsa ? decimal(sojaNaBolsa.value, 2) : null, sojaEmReais != null ? "por saca" : "US¢/bushel", variacao(sojaNaBolsa?.change)],
    ["Diesel S10 no Paraná", diesel ? reais(diesel.parana.medio) : null, "por litro", diesel?.semanaAnterior ? variacao((diesel.parana.medio - diesel.semanaAnterior) / diesel.semanaAnterior * 100) : ""],
    ...daRegiao.map(({ produto, preco }) => [`${produto} ${preco && !preco.daRegiao ? "no Paraná" : "na região"}`, preco ? reais(preco.valor) : null, preco ? `por ${UNIDADES[preco.unidade.toLowerCase()] ?? preco.unidade}` : "", variacao(preco?.variacaoPct)]),
  ];
  const aviso = !avisos ? null : avisos.geada.length ? ["Risco de geada", avisos.geada] : avisos.chuvaForte.length ? ["Chuva forte prevista", avisos.chuvaForte] : avisos.calor.length ? ["Calor forte previsto", avisos.calor] : null;
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
        {!cidade && <p className="text-xs text-amber-800 mt-1.5">Digite a cidade acima para o jornal trazer a previsão do tempo de 7 dias.</p>}
        {cidade && doTempo.erro && <p role="alert" className="text-xs text-amber-800 mt-1.5">{doTempo.desistiu ? "O serviço de clima não respondeu. Toque em “Buscar” para tentar de novo." : "O serviço de clima está demorando a responder. O jornal continua tentando sozinho: a previsão entra na folha assim que chegar."}</p>}
        <div className="flex flex-wrap gap-2 mt-3">
          <button type="button" onClick={() => window.print()} disabled={carregando} className={BOTAO} style={{ background: "#166534", color: "#fff" }}><Printer size={14} aria-hidden="true" />Imprimir ou salvar em PDF</button>
          <button type="button" onClick={gerarImagem} disabled={carregando || gerando} className={BOTAO} style={{ border: "1px solid #bbf7d0", color: "#166534", background: "#fff" }}><Image size={14} aria-hidden="true" />{gerando ? "Gerando a imagem…" : "Salvar como imagem"}</button>
          <button type="button" onClick={atualizarAgora} disabled={carregando || atualizando} className={BOTAO} style={{ border: "1px solid #bdbdbd", color: "#111111", background: "#fff" }}><RefreshCw size={14} className={atualizando ? "animate-spin" : undefined} aria-hidden="true" />{atualizando ? "Atualizando…" : concluido ? "✓ Atualizado" : "Atualizar agora"}</button>
        </div>
        <p className="text-xs text-slate-500 mt-2">{carregando ? "Aguarde: os dados do dia ainda estão chegando." : <>Dados atualizados às {fechamento.toLocaleTimeString("pt-BR")}. O jornal se atualiza sozinho a cada 10 minutos. Para o PDF, escolha “Salvar como PDF” na janela de impressão.</>}</p>

        {imagem?.erro && <p role="alert" className="rounded-lg p-2.5 mt-3 text-xs sm:text-sm" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#78350f" }}>Não foi possível gerar a imagem neste aparelho. Use a captura de tela do aparelho ou a opção de imprimir.</p>}
        {imagem?.url && (
          <div className="rounded-xl p-3 mt-3" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold" style={{ color: "#14532d" }}>A imagem está pronta</p>
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

      {/* na tela, a folha fica sobre um fundo cinza, como papel sobre a mesa; na impressão e na imagem sai só a folha */}
      <div className="bg-neutral-200 p-2 sm:p-6 print:bg-white print:p-0">
      <article ref={folha} className="mx-auto bg-white p-4 [container-type:inline-size] sm:p-8 print:!mt-0 print:max-w-none print:!p-0" style={{ maxWidth: 794, fontFamily: TEXTO, color: PRETO }}>
        <header>
          <Enfeite cor={PRETO} />
          {/* tamanho pela largura da folha (cqw), para caber em uma linha também no celular; vw é a reserva dos navegadores antigos */}
          <h2 className="text-center font-bold uppercase text-[length:min(54px,6.4vw)] supports-[width:1cqw]:text-[length:min(54px,7.4cqw)]" style={{ fontFamily: TITULO, lineHeight: 1.2, paddingBottom: 4 }}>Informativo Agrícola</h2>
          <div className="py-1.5 text-center" style={{ fontSize: 13, borderTop: FIO, borderBottom: `4px solid ${PRETO}` }}>
            {comMaiuscula(fechamento.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}
          </div>
        </header>

        <section className="text-center" style={{ marginTop: 16 }}>
          <h3 className="font-bold" style={{ fontFamily: TITULO, fontSize: manchete.length > 36 ? "min(28px, 6vw)" : "min(42px, 8vw)", lineHeight: 1.1 }}>{manchete.replace(/\.$/, "")}</h3>
          {complemento.length > 0 && <p className="font-bold" style={{ fontSize: 13.5, lineHeight: 1.35, marginTop: 8 }}>{complemento.join(" ")}</p>}
        </section>

        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-3 print:grid-cols-3" style={{ marginTop: 16 }}>
          <section style={{ fontSize: 12.5, lineHeight: 1.42, textAlign: "justify" }}>
            {textos.mercado.length > 0 && <Trecho assunto="Mercado">{textos.mercado.join(" ")}</Trecho>}
            {textos.campo && <Trecho assunto="No campo">{textos.campo}</Trecho>}
            {textos.economia.length > 0 && <Trecho assunto="Economia">{textos.economia.join(" ")}</Trecho>}
            {!textos.mercado.length && !textos.campo && <p style={{ color: "#555" }}>Os dados do dia ainda estão chegando.</p>}
          </section>

          <div className="sm:col-span-2 print:col-span-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 print:grid-cols-3" style={{ border: FIO }}>
              {cotacoes.map(([nome, valor, unidade, mudou]) => (
                <div key={nome} className="p-2 text-center">
                  <div className="uppercase" style={{ fontSize: 9.5, letterSpacing: "0.08em", fontFamily: SEM_SERIFA }}>{nome}</div>
                  <div className="font-bold" style={{ fontFamily: TITULO, fontSize: 23, lineHeight: 1.2 }}>{valor ?? "—"}</div>
                  <div style={{ fontSize: 11 }}>{valor != null ? [unidade, mudou].filter(Boolean).join(" · ") : " "}</div>
                </div>
              ))}
            </div>
            <p className="italic" style={{ fontSize: 11, color: "#555", marginTop: 4 }}>Cotações do dia. Chicago {horaDaCotacao(sojaNaBolsa?.date, fechamento) ?? "com atraso"}; região de {REGIAO} (DERAL{diaDoBoletim(parana.dados?.data) ? `, boletim de ${diaDoBoletim(parana.dados.data)}` : ""}); diesel: variação da semana.</p>

            <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 print:grid-cols-2" style={{ marginTop: 12 }}>
              {colunasDeNoticias.map(({ assunto, consulta, itens }) => (
                <section key={assunto}>
                  <h4 className="font-bold uppercase" style={{ fontSize: 11, letterSpacing: "0.1em", borderBottom: FIO, paddingBottom: 2, fontFamily: SEM_SERIFA }}>{assunto}</h4>
                  {itens.length ? (
                    <ol>
                      {itens.map((item, i) => (
                        <li key={item.link} style={{ padding: "5px 0", borderTop: i ? "1px solid #d4d4d4" : "none" }}>
                          <span className="block uppercase" style={{ fontSize: 9, letterSpacing: "0.1em", color: "#555", fontFamily: SEM_SERIFA }}>{item.rubrica}</span>
                          <a href={item.link} target="_blank" rel="noopener noreferrer" className="block font-bold" style={{ fontSize: 12.5, lineHeight: 1.25 }}>{encurtar(item.title, 95)}</a>
                          <span className="block italic" style={{ fontSize: 10.5, color: "#555" }}>{item.author}{item.pubDate && ` · ${haQuanto(item.pubDate)}`}</span>
                        </li>
                      ))}
                    </ol>
                  ) : <p style={{ fontSize: 12.5, color: "#555", marginTop: 6 }}>{consulta.erro || consulta.dados ? "Notícias indisponíveis agora." : "Buscando as notícias…"}</p>}
                </section>
              ))}
            </div>
          </div>
        </div>

        <section style={{ marginTop: 14, padding: "12px 16px", borderTop: FIO, background: "#e8e8e8", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact", breakInside: "avoid" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-bold" style={{ fontFamily: TITULO, fontSize: "min(34px, 7vw)", lineHeight: 1.1, color: "#6b6b6b" }}>Previsão do tempo</h3>
              {cidade && hoje && (
                <p style={{ fontSize: 13, lineHeight: 1.35, color: "#333", marginTop: 4 }}>
                  <strong>{cidade.nome}.</strong> Hoje, {getWmo(hoje.tempo).label.toLowerCase()}, de {Math.round(hoje.minima)}° a {Math.round(hoje.maxima)}°. Chuva prevista para os próximos 7 dias: {mm(chuva.proximos7)}.
                  {aviso && <strong> {aviso[0]} em {aviso[1].slice(0, 3).map(d => diaMes(d.data)).join(", ")}.</strong>}
                </p>
              )}
            </div>
            {hoje && <span className="shrink-0" style={{ fontSize: 46, lineHeight: 1 }} aria-hidden="true">{getWmo(hoje.tempo).emoji}</span>}
          </div>
          {!cidade ? <p style={{ fontSize: 13, color: "#333", marginTop: 6 }}>Escolha a cidade no campo acima da folha para ver aqui a previsão de 7 dias.</p>
            : !hoje ? <p style={{ fontSize: 13, color: "#333", marginTop: 6 }}>{doTempo.erro && doTempo.desistiu ? `A previsão de ${cidade.nome} não está disponível agora.` : `Buscando a previsão de ${cidade.nome}…`}</p>
              : (
                <ol className="grid grid-cols-4 gap-y-3 text-center sm:grid-cols-7 print:grid-cols-7" style={{ marginTop: 8, fontSize: 12, color: "#222" }} aria-label="Previsão de 7 dias">
                  {semana.map((d, i) => (
                    <li key={d.data} title={getWmo(d.tempo).label}>
                      <span className="block" style={{ fontFamily: SEM_SERIFA }}><strong>{i === 0 ? "Hoje" : WEEK[new Date(`${d.data}T12:00:00`).getDay()]}</strong> <span style={{ fontSize: 10.5, color: "#555" }}>{diaMes(d.data)}</span></span>
                      <span className="block" style={{ fontSize: 22, lineHeight: 1.3 }} aria-hidden="true">{getWmo(d.tempo).emoji}</span>
                      <span className="block"><strong>{Math.round(d.maxima)}°</strong> {Math.round(d.minima)}°</span>
                      <span className="block">{mm(d.chuva ?? 0)}</span>
                      <span className="block" style={{ fontSize: 10.5, color: "#555" }}>{d.probabilidade != null ? `${d.probabilidade}% de chance` : " "}</span>
                    </li>
                  ))}
                </ol>
              )}
        </section>

        <footer style={{ marginTop: 8, fontSize: 9.5, lineHeight: 1.4, color: "#555", fontFamily: SEM_SERIFA, breakInside: "avoid" }}>
          <p>Fontes: AwesomeAPI (dólar), Yahoo Finance (Chicago, com atraso), DERAL/SEAB-PR (preços e safra), ANP (diesel), Open-Meteo (tempo), Google Notícias e Banco Central. Edição fechada às {fechamento.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.</p>
          <p>agronahora.com.br</p>
        </footer>
      </article>
      </div>
    </div>
  );
}
