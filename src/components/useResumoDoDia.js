import { useEffect, useState } from "react";
import { CHICAGO } from "../catalogo";
import { sacaPorChicago } from "../calculos";
import { avisosDaPrevisao, buscarClima, cidadeGuardada, guardarCidade, procurarCidade, resumoDaChuva } from "../clima";
import { frasesDoDia, operacoesEmAndamento, precoNaRegiao } from "../inicio";

// Dados do dia usados pelo "Resumo do dia" e pelo "Jornal do dia": cotações (Chicago, preços da
// região, diesel), o tempo da cidade que o visitante escolheu (lembrada neste navegador), o
// andamento das lavouras e as manchetes. Cada parte carrega sozinha: { dados } quando chega,
// { erro } se a fonte falhar.
export const REGIAO = "Cornélio Procópio";
const SOJA_EM_CHICAGO = CHICAGO.find(item => item.key === "soja");

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

// dolar e variacaoDoDolar vêm do App, que já consulta as moedas a cada minuto.
export default function useResumoDoDia({ dolar, variacaoDoDolar }) {
  const chicago = useConsulta("/api/market?type=bolsas");
  const parana = useConsulta("/api/market?type=pr");
  const combustiveis = useConsulta("/api/market?type=combustiveis");
  const safra = useConsulta("/api/market?type=safra");
  const noticias = useConsulta("/api/news?feed=agro");
  const mercado = useConsulta("/api/news?feed=mercado");
  // A cidade do tempo é a última que o visitante digitou neste navegador; sem nenhuma, a tela pede uma.
  const [cidade, setCidade] = useState(cidadeGuardada);
  const [busca, setBusca] = useState(cidade?.nome ?? "");
  const [erroDaBusca, setErroDaBusca] = useState("");
  const [clima, setClima] = useState({}); // { dados, de } quando chega; { erro, de } se falhar
  useEffect(() => {
    if (!cidade) return;
    let ativo = true;
    buscarClima(cidade).then(dados => { if (ativo) setClima({ dados, de: cidade.nome }); }).catch(() => { if (ativo) setClima({ erro: true, de: cidade.nome }); });
    return () => { ativo = false; };
  }, [cidade]);
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
  const daRegiao = ["Soja", "Milho", "Boi"].map(produto => ({ produto, preco: precoNaRegiao(parana.dados, produto, REGIAO) }));
  const diesel = combustiveis.dados?.produtos.find(p => p.nome === "Diesel S10");
  // o tempo só vale se for da cidade que está escolhida agora
  const doTempo = cidade && clima.de === cidade.nome ? clima : {};
  const iHoje = doTempo.dados ? doTempo.dados.dias.findIndex(d => d.data === doTempo.dados.hoje) : -1;
  const hoje = iHoje >= 0 ? doTempo.dados.dias[iHoje] : null;
  const proximosDias = hoje ? doTempo.dados.dias.slice(iHoje + 1, iHoje + 5) : [];
  const chuva = doTempo.dados && resumoDaChuva(doTempo.dados.dias, doTempo.dados.hoje);
  const avisos = doTempo.dados && avisosDaPrevisao(doTempo.dados.dias, doTempo.dados.hoje);
  const noCampo = safra.dados?.parana ? operacoesEmAndamento(safra.dados.parana.culturas).slice(0, 4) : [];
  const frases = frasesDoDia({ dolar, variacaoDoDolar, variacaoDaSoja: sojaNaBolsa?.change, cidade: hoje ? cidade.nome : null, hoje, avisos });

  return {
    chicago, parana, combustiveis, safra, noticias, mercado,
    cidade, busca, setBusca, procurar, erroDaBusca,
    sojaNaBolsa, sojaEmReais, daRegiao, diesel, doTempo, hoje, proximosDias, chuva, avisos, noCampo, frases,
  };
}
