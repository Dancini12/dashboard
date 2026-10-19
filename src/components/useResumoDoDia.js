import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CHICAGO } from "../catalogo";
import { sacaPorChicago } from "../calculos";
import { avisosDaPrevisao, buscarClima, cidadeGuardada, climaGuardado, guardarCidade, procurarCidade, resumoDaChuva } from "../clima";
import { estadoLembrado, estadoPorSigla, lembrarEstado } from "../estados";
import { frasesDoDia, operacoesEmAndamento, precosDoEstado, referenciaDoEstado } from "../inicio";

// Dados do dia usados pelo "Resumo do dia" e pelo "Jornal do dia": cotações (Chicago, preços do
// estado escolhido, diesel), o tempo da cidade que o visitante escolheu (lembrada neste navegador), o
// andamento das lavouras e as manchetes. O estado é o mesmo da aba Cotações Cooperativas (lembrado
// neste navegador); no Paraná, os preços são os da região de Cornélio Procópio. Cada parte carrega sozinha: { dados, em } quando chega
// (em = hora da resposta), { erro } se a fonte falhar.
export const REGIAO = "Cornélio Procópio";
const SOJA_EM_CHICAGO = CHICAGO.find(item => item.key === "soja");
// Previsão que não veio é pedida de novo sozinha: 6 vezes, de 20 em 20 segundos.
const NOVAS_TENTATIVAS_DO_CLIMA = 6;
const ESPERA_DO_CLIMA = 20000;
// O resumo se atualiza sozinho: pede tudo de novo a cada 10 minutos e quando a pessoa volta à página
// depois de mais de 5 minutos fora; a previsão do tempo, a cada hora. Assim o Jornal impresso sai com
// os dados da hora, mesmo com a página aberta desde cedo.
const MINUTOS_ENTRE_RODADAS = 10;
const MINUTOS_PARA_QUEM_VOLTA = 5;
const MINUTOS_ENTRE_PREVISOES = 60;
const MINUTO = 60000;

// Uma fonte do resumo, pedida de novo a cada rodada. Enquanto a resposta nova não chega (ou se ela
// falhar), fica na tela o que já tinha chegado. Nas rodadas automáticas vale a cópia que o servidor
// guarda por alguns minutos; na pedida pelo botão ("fresca"), o endereço leva a hora, o que faz o
// servidor ir de novo às fontes. "fim" é a hora em que a última tentativa terminou, com ou sem sucesso.
// Quando o endereço muda (outro estado), o que era do endereço anterior não aparece mais.
function useConsulta(url, rodada) {
  const [estado, setEstado] = useState({});
  useEffect(() => {
    let ativo = true;
    const endereco = rodada.fresca ? `${url}${url.includes("?") ? "&" : "?"}agora=${Date.now()}` : url;
    fetch(endereco, { signal: AbortSignal.timeout(45000), cache: "no-store" })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("indisponível"))))
      .then(dados => { if (ativo) setEstado({ dados, em: Date.now(), fim: Date.now(), de: url }); })
      .catch(() => { if (ativo) setEstado(anterior => (anterior.dados && anterior.de === url ? { ...anterior, fim: Date.now() } : { erro: true, fim: Date.now(), de: url })); });
    return () => { ativo = false; };
  }, [url, rodada]);
  return estado.de === url ? estado : {};
}

// dolar e variacaoDoDolar vêm do App, que já consulta as moedas a cada minuto.
export default function useResumoDoDia({ dolar, variacaoDoDolar }) {
  const [rodada, setRodada] = useState({ n: 0, fresca: false });
  const [rodadaDoClima, setRodadaDoClima] = useState(0);
  const ultimas = useRef({ dados: 0, clima: 0 }); // hora das últimas rodadas
  useEffect(() => {
    ultimas.current = { dados: Date.now(), clima: Date.now() };
    const novaRodada = () => { ultimas.current.dados = Date.now(); setRodada(r => ({ n: r.n + 1, fresca: false })); };
    const novaPrevisao = () => { ultimas.current.clima = Date.now(); setRodadaDoClima(r => r + 1); };
    const relogio = setInterval(novaRodada, MINUTOS_ENTRE_RODADAS * MINUTO);
    const relogioDoClima = setInterval(novaPrevisao, MINUTOS_ENTRE_PREVISOES * MINUTO);
    // a página que ficou escondida (outra aba, computador dormindo) se atualiza quando volta à tela
    const aoVoltar = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - ultimas.current.dados > MINUTOS_PARA_QUEM_VOLTA * MINUTO) novaRodada();
      if (Date.now() - ultimas.current.clima > MINUTOS_ENTRE_PREVISOES * MINUTO) novaPrevisao();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      clearInterval(relogio); clearInterval(relogioDoClima);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, []);
  // botão "Atualizar agora": pede tudo na hora, direto nas fontes, e a previsão também
  const atualizar = useCallback(() => {
    ultimas.current = { dados: Date.now(), clima: Date.now() };
    setRodada(r => ({ n: r.n + 1, fresca: true }));
    setRodadaDoClima(r => r + 1);
  }, []);
  const [sigla, setSigla] = useState(estadoLembrado);
  const escolherEstado = useCallback(nova => { setSigla(nova); lembrarEstado(nova); }, []);
  const estado = estadoPorSigla(sigla);
  const chicago = useConsulta("/api/market?type=bolsas", rodada);
  const doEstado = useConsulta(estado.endereco, rodada);
  const combustiveis = useConsulta("/api/market?type=combustiveis", rodada);
  const safra = useConsulta("/api/market?type=safra", rodada);
  const noticias = useConsulta("/api/news?feed=agro", rodada);
  const mercado = useConsulta("/api/news?feed=mercado", rodada);
  // A cidade do tempo é a última que o visitante digitou neste navegador; sem nenhuma, a tela pede uma.
  const [cidade, setCidade] = useState(cidadeGuardada);
  const [busca, setBusca] = useState(cidade?.nome ?? "");
  const [erroDaBusca, setErroDaBusca] = useState("");
  const [clima, setClima] = useState({}); // { dados, de } quando chega; { erro, de, desistiu } se falhar
  // O serviço de clima passa por momentos sobrecarregado: a previsão que falhou é pedida de novo
  // sozinha, e a folha se completa quando ela chega. "desistiu" marca que as tentativas acabaram.
  // Na atualização de hora em hora, a previsão que já estava na tela fica até a nova chegar.
  useEffect(() => {
    if (!cidade) return;
    let ativo = true, espera;
    const buscar = tentativa => buscarClima(cidade)
      .then(dados => { if (ativo) setClima({ dados, de: cidade.nome }); })
      .catch(() => {
        if (!ativo) return;
        const desistiu = tentativa >= NOVAS_TENTATIVAS_DO_CLIMA;
        setClima(anterior => (anterior.de === cidade.nome && anterior.dados ? anterior : { erro: true, de: cidade.nome, desistiu }));
        if (!desistiu) espera = setTimeout(() => buscar(tentativa + 1), ESPERA_DO_CLIMA);
      });
    buscar(0);
    return () => { ativo = false; clearTimeout(espera); };
  }, [cidade, rodadaDoClima]);
  // a previsão de hoje que este navegador já recebeu vale enquanto a nova não chega (ou se ela não vier)
  const guardado = useMemo(() => (cidade ? climaGuardado(cidade) : null), [cidade]);
  const procurar = async (evento) => {
    evento.preventDefault();
    if (!busca.trim()) return;
    setErroDaBusca("");
    try {
      const achada = await procurarCidade(busca);
      if (!achada) { setErroDaBusca("Cidade não encontrada. Confira o nome."); return; }
      guardarCidade(achada);
      setCidade(achada);
      setBusca(achada.nome);
    } catch { setErroDaBusca("Não foi possível procurar a cidade agora."); }
  };

  const sojaNaBolsa = chicago.dados?.contratos.find(c => c.symbol === SOJA_EM_CHICAGO.symbol);
  const sojaEmReais = sojaNaBolsa && dolar ? sacaPorChicago({ chicago: sojaNaBolsa.value, dolar, kgDoBushel: SOJA_EM_CHICAGO.kg }).noPorto : null;
  const daRegiao = precosDoEstado(estado.sigla, doEstado.dados, REGIAO);
  const referencia = referenciaDoEstado(estado.sigla, doEstado.dados);
  // diesel S10 do estado escolhido: no Paraná, o resumo do estado; nos outros, a média da planilha da ANP
  const dieselDaAnp = combustiveis.dados?.produtos.find(p => p.nome === "Diesel S10");
  const diesel = !dieselDaAnp ? null : estado.sigla === "PR" ? { medio: dieselDaAnp.parana.medio, semanaAnterior: dieselDaAnp.semanaAnterior }
    : dieselDaAnp.estados?.[estado.anp] != null ? { medio: dieselDaAnp.estados[estado.anp], semanaAnterior: dieselDaAnp.estadosAnterior?.[estado.anp] ?? null } : null;
  // o tempo só vale se for da cidade que está escolhida agora
  const daCidade = cidade && clima.de === cidade.nome ? clima : {};
  const doTempo = daCidade.dados || !guardado ? daCidade : { dados: guardado };
  const iHoje = doTempo.dados ? doTempo.dados.dias.findIndex(d => d.data === doTempo.dados.hoje) : -1;
  const hoje = iHoje >= 0 ? doTempo.dados.dias[iHoje] : null;
  const proximosDias = hoje ? doTempo.dados.dias.slice(iHoje + 1, iHoje + 5) : [];
  const semana = hoje ? doTempo.dados.dias.slice(iHoje, iHoje + 7) : []; // hoje e os seis dias seguintes
  const chuva = doTempo.dados && resumoDaChuva(doTempo.dados.dias, doTempo.dados.hoje);
  const avisos = doTempo.dados && avisosDaPrevisao(doTempo.dados.dias, doTempo.dados.hoje);
  const noCampo = safra.dados?.parana ? operacoesEmAndamento(safra.dados.parana.culturas).slice(0, 4) : [];
  // hora da resposta mais recente entre as fontes do resumo (null enquanto nenhuma chegou) e hora em
  // que a última delas terminou a tentativa mais recente (para saber quando a atualização acabou)
  const fontes = [chicago, doEstado, combustiveis, safra, noticias, mercado];
  const atualizadoEm = Math.max(0, ...fontes.map(c => c.em ?? 0)) || null;
  const respondidoEm = Math.min(...fontes.map(c => c.fim ?? 0)) || null;
  const frases = frasesDoDia({ dolar, variacaoDoDolar, variacaoDaSoja: sojaNaBolsa?.change, cidade: hoje ? cidade.nome : null, hoje, avisos });

  return {
    chicago, doEstado, estado, escolherEstado, referencia, combustiveis, safra, noticias, mercado,
    cidade, busca, setBusca, procurar, erroDaBusca, atualizadoEm, respondidoEm, atualizar,
    sojaNaBolsa, sojaEmReais, daRegiao, diesel, doTempo, hoje, proximosDias, semana, chuva, avisos, noCampo, frases,
  };
}
