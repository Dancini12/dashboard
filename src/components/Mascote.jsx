import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import corpo from "./mascote/corpo.webp";
import cabeca from "./mascote/cabeca.webp";
import olhosMeio from "./mascote/olhos-meio.webp";
import olhosFechados from "./mascote/olhos-fechados.webp";
import rosto from "./mascote/rosto.webp";
import sentado from "./mascote/acoes/sentado.webp";
import agua from "./mascote/acoes/agua.webp";
import maca from "./mascote/acoes/maca.webp";
import cafe from "./mascote/acoes/cafe.webp";
import violao from "./mascote/acoes/violao.webp";
import cochilo from "./mascote/acoes/cochilo.webp";
import "./Mascote.css";

// Quadros do piscar: [estado dos olhos, duração em ms]. 0 aberto, 1 meio, 2 fechado.
const PISCADA = [[1, 45], [2, 90], [1, 45], [0, 0]];
const LS_POS = "agroinfo_mascote_pos";
const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

// Poses de ação. w = largura em % do quadro do mascote (mesma escala do castor em pé);
// ar = proporção da imagem; esq = recuo à esquerda (poses em pé, alinhadas à pose base);
// lado = pose mais larga que o quadro, alinhada ao lado de dentro da tela (violão e
// cochilo um pouco reduzidos para caber na margem lateral); ms = duração.
const ACOES = {
  sentar: { rotulo: "Sentar", emoji: "🌾", img: sentado, w: 114.17, ar: "411 / 572", lado: true, ms: 9000 },
  agua: { rotulo: "Beber água", emoji: "💧", img: agua, w: 100, ar: "360 / 614", esq: 0.23, ms: 6000 },
  fruta: { rotulo: "Comer uma fruta", emoji: "🍎", img: maca, w: 91.67, ar: "330 / 613", esq: 0.23, ms: 7000 },
  cafe: { rotulo: "Tomar um café", emoji: "☕", img: cafe, w: 89.72, ar: "323 / 608", esq: 1.97, ms: 8000, efeito: "vapor" },
  violao: { rotulo: "Tocar violão", emoji: "🎸", img: violao, w: 115, ar: "461 / 599", lado: true, ms: 11000, efeito: "notas" },
  cochilo: { rotulo: "Tirar um cochilo", emoji: "😴", img: cochilo, w: 118, ar: "618 / 244", lado: true, ms: 14000, efeito: "zzz" },
};
const EFEITOS = { vapor: ["", "", ""], notas: ["♪", "♫", "♪"], zzz: ["z", "z", "Z"] };

const espera = (min, max) => min + Math.random() * (max - min);
const sortear = (evitar) => {
  const nomes = Object.keys(ACOES).filter(n => n !== evitar);
  return nomes[Math.floor(Math.random() * nomes.length)];
};

// Lado da tela em que o mascote está: poses largas e o menu abrem para dentro.
function lados(el) {
  const r = el?.getBoundingClientRect();
  const { clientWidth: vw, clientHeight: vh } = document.documentElement;
  return r ? { direita: r.left + r.width / 2 > vw / 2, embaixo: r.top + r.height / 2 > vh / 2 } : { direita: true, embaixo: false };
}

function lerPosicao() {
  try {
    const p = JSON.parse(localStorage.getItem(LS_POS));
    if (Number.isFinite(p?.fx) && Number.isFinite(p?.fy)) return p;
  } catch { /* sem storage ou valor inválido: canto padrão */ }
  return null;
}

// Castor no canto superior direito; pode ser arrastado para qualquer lugar da tela.
// Clicar nele abre o menu de ações; parado, ele também faz uma ação sozinho de vez
// em quando. Balançar corpo e cabeça é CSS; o piscar é aqui, em intervalos
// aleatórios (às vezes uma piscada dupla).
export default function Mascote({ onFechar }) {
  const [olhos, setOlhos] = useState(0);
  const [pos, setPos] = useState(lerPosicao); // null = canto padrão
  const [inclina, setInclina] = useState(null); // graus enquanto arrasta; null = solto
  const [pousando, setPousando] = useState(false);
  const [acao, setAcao] = useState(null); // { nome, direita } ou null (em pé)
  const [menu, setMenu] = useState(null); // { direita, embaixo } ou null (fechado)
  const caixa = useRef(null);
  const arrasto = useRef(null);
  const ultima = useRef(null);

  const fazer = (nome) => {
    ultima.current = nome;
    setAcao({ nome, direita: lados(caixa.current).direita });
    setMenu(null);
  };
  const alternarMenu = () => setMenu(m => (m ? null : lados(caixa.current)));

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
    if (!a.moveu) { setAcao(null); setMenu(null); } // pego no colo: larga o que fazia
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
    if (!a.moveu) return alternarMenu(); // clique simples
    try { localStorage.setItem(LS_POS, JSON.stringify(a.pos)); } catch { /* ignora */ }
    setPousando(true);
  };

  // Termina a ação depois da duração; parado e sem menu, sorteia a próxima.
  useEffect(() => {
    if (acao) {
      const t = setTimeout(() => setAcao(null), ACOES[acao.nome].ms);
      return () => clearTimeout(t);
    }
    if (menu) return;
    const t = setTimeout(() => {
      const nome = sortear(ultima.current);
      ultima.current = nome;
      setAcao({ nome, direita: lados(caixa.current).direita });
    }, espera(25000, 50000));
    return () => clearTimeout(t);
  }, [acao, menu]);

  // Menu fecha ao clicar fora ou com Esc.
  useEffect(() => {
    if (!menu) return;
    const fora = (e) => { if (!caixa.current?.contains(e.target)) setMenu(null); };
    const esc = (e) => { if (e.key === "Escape") setMenu(null); };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  // Pré-carrega as poses para a troca ser instantânea.
  useEffect(() => {
    const t = setTimeout(() => Object.values(ACOES).forEach(a => { new Image().src = a.img; }), 2500);
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

  const A = acao && ACOES[acao.nome];

  return (
    <div ref={caixa}
      className={`mascote${pos ? " posicionado" : ""}${inclina !== null ? " arrastando" : ""}${pousando ? " pousando" : ""}${A ? " em-acao" : ""}`}
      style={pos ? { "--fx": pos.fx, "--fy": pos.fy } : undefined}>
      <div className="mascote-camada mascote-figura" role="button" tabIndex={0}
        aria-label="Mascote: escolher o que ele faz" aria-haspopup="true" aria-expanded={!!menu}
        style={inclina !== null ? { transform: `rotate(${inclina}deg) scale(1.06)` } : undefined}
        onPointerDown={aoPressionar} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoSoltar}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); alternarMenu(); } }}>
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
        {A && (
          <div key={acao.nome} className={`mascote-acao mascote-acao-${acao.nome}`} aria-hidden="true"
            style={{ width: `${A.w}%`, aspectRatio: A.ar, ...(A.lado ? { [acao.direita ? "right" : "left"]: 0 } : { left: `${A.esq}%` }) }}>
            <img src={A.img} alt="" draggable={false} />
            {A.efeito && <span className={`mascote-efeito mascote-${A.efeito}`}>{EFEITOS[A.efeito].map((c, i) => <i key={i}>{c}</i>)}</span>}
          </div>
        )}
      </div>
      {menu && (
        <div className={`mascote-menu ${menu.direita ? "esquerda" : "direita"}${menu.embaixo ? " embaixo" : ""}`} role="group" aria-label="O que o castor faz?">
          <div className="mascote-menu-titulo">O que eu faço?</div>
          {A && <button type="button" onClick={() => { setAcao(null); setMenu(null); }}><span aria-hidden="true">🤠</span>Ficar de pé</button>}
          {Object.entries(ACOES).map(([nome, a]) => (
            <button key={nome} type="button" className={acao?.nome === nome ? "ativa" : undefined} onClick={() => fazer(nome)}>
              <span aria-hidden="true">{a.emoji}</span>{a.rotulo}
            </button>
          ))}
        </div>
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
