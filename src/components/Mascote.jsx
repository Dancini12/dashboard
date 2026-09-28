import { useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import AssistenteAgro from "./AssistenteAgro";
import corpo from "./mascote/corpo.webp";
import cabeca from "./mascote/cabeca.webp";
import olhosMeio from "./mascote/olhos-meio.webp";
import olhosFechados from "./mascote/olhos-fechados.webp";
import rosto from "./mascote/rosto.webp";
import sentado from "./mascote/acoes/sentado.webp";
import cafe from "./mascote/acoes/cafe.webp";
import cochilo from "./mascote/acoes/cochilo.webp";
import "./Mascote.css";

// Quadros do piscar: [estado dos olhos, duração em ms]. 0 aberto, 1 meio, 2 fechado.
const PISCADA = [[1, 45], [2, 90], [1, 45], [0, 0]];
const LS_POS = "agroinfo_mascote_pos";
const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

// Cenas. w = largura em % do quadro do mascote (mesma escala do castor em pé);
// ar = proporção da imagem; esq = recuo à esquerda (pose em pé, alinhada à base);
// lado = pose mais larga que o quadro, alinhada ao lado de dentro da tela (cochilo
// um pouco reduzido para caber na margem lateral); ms = duração da cena sorteada.
const CENAS = {
  sentar: { img: sentado, w: 114.17, ar: "411 / 572", lado: true, ms: 9000 },
  cafe: { img: cafe, w: 89.72, ar: "323 / 608", esq: 1.97, ms: 8000, efeito: "vapor" },
  cochilo: { img: cochilo, w: 118, ar: "618 / 244", lado: true, efeito: "zzz" }, // até o visitante voltar
};
const SORTEAVEIS = ["sentar", "cafe"];
const EFEITOS = { vapor: ["", "", ""], zzz: ["z", "z", "Z"] };
const OCIOSO_MS = 30000; // sem mexer no site por mais que isso: cochila
const ATIVIDADE = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "scroll"];

const espera = (min, max) => min + Math.random() * (max - min);
const escolher = (lista) => lista[Math.floor(Math.random() * lista.length)];

// Poses largas e o balão de diálogo se estendem para o lado de dentro da tela.
function lados(el) {
  const r = el?.getBoundingClientRect();
  const { clientWidth: vw, clientHeight: vh } = document.documentElement;
  return r ? { direita: r.left + r.width / 2 > vw / 2, embaixo: r.top + r.height / 2 > vh / 2 } : { direita: true, embaixo: false };
}
const paraDentro = (el) => lados(el).direita;

function lerPosicao() {
  try {
    const p = JSON.parse(localStorage.getItem(LS_POS));
    if (Number.isFinite(p?.fx) && Number.isFinite(p?.fy)) return p;
  } catch { /* sem storage ou valor inválido: canto padrão */ }
  return null;
}

// Castor no canto superior direito; pode ser arrastado para qualquer lugar da tela.
// Alterna sozinho, ao acaso, entre ficar em pé, sentar e tomar café. Se o visitante
// passar 30 s sem mexer no site, ele cochila e acorda no próximo movimento. Clicar
// nele (ou em "Tire sua dúvida") abre o balão de diálogo do assistente. Balançar
// corpo e cabeça é CSS; o piscar é aqui, em intervalos aleatórios (às vezes uma
// piscada dupla).
export default function Mascote({ onFechar, assistenteUrl, dadosPainel }) {
  const [olhos, setOlhos] = useState(0);
  const [pos, setPos] = useState(lerPosicao); // null = canto padrão
  const [inclina, setInclina] = useState(null); // graus enquanto arrasta; null = solto
  const [pousando, setPousando] = useState(false);
  const [cena, setCena] = useState(null); // { nome, direita } ou null (em pé)
  const [conversa, setConversa] = useState(false); // balão de diálogo aberto
  const [balao, setBalao] = useState({ direita: true, embaixo: false });
  const [pensando, setPensando] = useState(false);
  const caixa = useRef(null);
  const arrasto = useRef(null);
  const dormindo = useRef(false);
  const conversando = useRef(false);

  // Com o balão aberto ele fica de pé, sem trocar de cena nem cochilar.
  const alternarConversa = () => {
    if (!assistenteUrl) return; // assistente ainda não configurado
    const abrir = !conversando.current;
    conversando.current = abrir;
    if (abrir) {
      setCena(null);
      setBalao(lados(caixa.current));
    }
    setConversa(abrir);
  };

  const aoPressionar = (e) => {
    if (e.button !== 0) return;
    const r = caixa.current.getBoundingClientRect();
    arrasto.current = { id: e.pointerId, ox: e.clientX - r.left, oy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, ux: e.clientX, moveu: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const aoMover = (e) => {
    const a = arrasto.current;
    if (!a || a.id !== e.pointerId) return;
    if (!a.moveu && Math.hypot(e.clientX - a.sx, e.clientY - a.sy) < 5) return;
    if (!a.moveu) setCena(null); // pego no colo: larga o que fazia
    a.moveu = true;
    const r = caixa.current.getBoundingClientRect();
    const { clientWidth: vw, clientHeight: vh } = document.documentElement;
    a.pos = {
      fx: limitar((e.clientX - a.ox) / Math.max(1, vw - r.width), 0, 1),
      fy: limitar((e.clientY - a.oy) / Math.max(1, vh - r.height), 0, 1),
    };
    setPos(a.pos);
    // inclina para o lado do movimento, como se estivesse pendurado; endireita ao parar
    setInclina(limitar((e.clientX - a.ux) * 1.5, -14, 14));
    a.ux = e.clientX;
    clearTimeout(a.parado);
    a.parado = setTimeout(() => setInclina(i => (i === null ? null : 0)), 120);
  };

  const aoSoltar = (e) => {
    const a = arrasto.current;
    if (!a || a.id !== e.pointerId) return;
    arrasto.current = null;
    clearTimeout(a.parado);
    setInclina(null);
    if (!a.moveu) return alternarConversa(); // clique simples
    try { localStorage.setItem(LS_POS, JSON.stringify(a.pos)); } catch { /* ignora */ }
    if (conversando.current) setBalao(lados(caixa.current));
    setPousando(true);
  };

  // Cena sorteada termina depois da duração; em pé, sorteia a próxima.
  useEffect(() => {
    dormindo.current = cena?.nome === "cochilo";
    if (dormindo.current || conversa) return; // dorme até o visitante voltar; conversando, fica de pé
    if (cena) {
      const t = setTimeout(() => setCena(null), CENAS[cena.nome].ms);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCena({ nome: escolher(SORTEAVEIS), direita: paraDentro(caixa.current) }), espera(10000, 20000));
    return () => clearTimeout(t);
  }, [cena, conversa]);

  // Inatividade: sem mouse, toque, teclado ou rolagem por 30 s, cochila; qualquer
  // atividade acorda.
  useEffect(() => {
    let ultimaAtividade = Date.now();
    const ativo = () => {
      ultimaAtividade = Date.now();
      if (!dormindo.current) return;
      dormindo.current = false;
      setCena(null);
    };
    const opcoes = { passive: true, capture: true };
    ATIVIDADE.forEach(ev => window.addEventListener(ev, ativo, opcoes));
    const t = setInterval(() => {
      if (dormindo.current || conversando.current || arrasto.current || Date.now() - ultimaAtividade < OCIOSO_MS) return;
      dormindo.current = true;
      setCena({ nome: "cochilo", direita: paraDentro(caixa.current) });
    }, 1000);
    return () => {
      clearInterval(t);
      ATIVIDADE.forEach(ev => window.removeEventListener(ev, ativo, opcoes));
    };
  }, []);

  // Pré-carrega as cenas para a troca ser instantânea.
  useEffect(() => {
    const t = setTimeout(() => Object.values(CENAS).forEach(c => { new Image().src = c.img; }), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!pousando) return;
    const t = setTimeout(() => setPousando(false), 450);
    return () => clearTimeout(t);
  }, [pousando]);

  useEffect(() => {
    let timer;
    const agendar = () => {
      timer = setTimeout(() => piscar(Math.random() < 0.2 ? 2 : 1), 2200 + Math.random() * 3800);
    };
    const piscar = (vezes) => {
      let i = 0;
      const passo = () => {
        const [estado, ms] = PISCADA[i++];
        setOlhos(estado);
        if (i < PISCADA.length) timer = setTimeout(passo, ms);
        else if (vezes > 1) timer = setTimeout(() => piscar(vezes - 1), 140);
        else agendar();
      };
      passo();
    };
    agendar();
    return () => clearTimeout(timer);
  }, []);

  const C = cena && CENAS[cena.nome];

  return (
    <div ref={caixa}
      className={`mascote${pos ? " posicionado" : ""}${inclina !== null ? " arrastando" : ""}${pousando ? " pousando" : ""}${C ? " em-acao" : ""}${pensando ? " pensando" : ""}`}
      style={pos ? { "--fx": pos.fx, "--fy": pos.fy } : undefined}>
      <div className="mascote-camada mascote-figura" role="button" tabIndex={0} aria-label={assistenteUrl ? "Mascote: tirar uma dúvida" : "Mascote"} aria-expanded={assistenteUrl ? conversa : undefined}
        style={inclina !== null ? { transform: `rotate(${inclina}deg) scale(1.06)` } : undefined}
        onPointerDown={aoPressionar} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoSoltar}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); alternarConversa(); } }}>
        <div className="mascote-sombra" aria-hidden="true" />
        <div className="mascote-camada mascote-corpo" aria-hidden="true">
          <div className="mascote-camada mascote-respira">
            <img src={corpo} alt="" draggable={false} />
            <div className="mascote-camada mascote-cabeca">
              <img src={cabeca} alt="" draggable={false} />
              <img src={olhosMeio} alt="" draggable={false} className={`mascote-olhos${olhos === 1 ? " ativo" : ""}`} />
              <img src={olhosFechados} alt="" draggable={false} className={`mascote-olhos${olhos === 2 ? " ativo" : ""}`} />
            </div>
          </div>
        </div>
        {C && (
          <div key={cena.nome} className={`mascote-acao mascote-acao-${cena.nome}`} aria-hidden="true"
            style={{ width: `${C.w}%`, aspectRatio: C.ar, ...(C.lado ? { [cena.direita ? "right" : "left"]: 0 } : { left: `${C.esq}%` }) }}>
            <img src={C.img} alt="" draggable={false} />
            {C.efeito && <span className={`mascote-efeito mascote-${C.efeito}`}>{EFEITOS[C.efeito].map((c, i) => <i key={i}>{c}</i>)}</span>}
          </div>
        )}
      </div>
      {assistenteUrl && !conversa && (
        <button type="button" className="mascote-duvida" onClick={alternarConversa}>
          <MessageCircle size={13} strokeWidth={2.5} aria-hidden="true" />Tire sua dúvida
        </button>
      )}
      {assistenteUrl && (
        <AssistenteAgro url={assistenteUrl} dadosDashboard={dadosPainel} aberto={conversa}
          onFechar={alternarConversa} onPensando={setPensando}
          className={`${balao.direita ? "lado-esquerda" : "lado-direita"}${balao.embaixo ? " embaixo" : ""}`} />
      )}
      <button type="button" className="mascote-fechar" onClick={onFechar} aria-label="Fechar mascote" title="Fechar mascote">
        <X size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
}

// Botão da barra do topo: chama o mascote de volta (ou o esconde).
export function BotaoMascote({ visivel, onClick }) {
  const rotulo = visivel ? "Esconder mascote" : "Chamar mascote";
  return (
    <button type="button" onClick={onClick} aria-pressed={visivel} aria-label={rotulo} title={rotulo}
      className="flex items-center gap-1 rounded-full py-0.5 pl-0.5 sm:pr-2 text-xs font-semibold transition-colors"
      style={{ color: "#166534", background: visivel ? "transparent" : "#ecfdf5", border: "1px solid rgba(22,101,52,0.25)" }}>
      <img src={rosto} alt="" width={22} height={22} className="rounded-full" style={{ background: "#ecfdf5" }} />
      <span className="hidden sm:inline">{rotulo}</span>
    </button>
  );
}
