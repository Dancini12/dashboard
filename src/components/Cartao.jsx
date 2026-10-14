import { fmt } from "../formatos";

// Peças comuns das abas montadas no App: o selo de variação (▲/▼ em %), o quadro com fio no alto e o
// título de seção com ícone.
export function VarBadge({ val }) {
  const p = val >= 0;
  return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-bold" style={{ background: p ? "#dcfce7" : "#fee2e2", color: p ? "#166534" : "#991b1b", fontSize: 10 }}>{p ? "▲+" : "▼"}{fmt(val)}%</span>;
}
export function Card({ children, className = "", style = {}, id }) {
  return <div id={id} className={`rounded-xl border shadow-sm ${className}`} style={{ scrollMarginTop: 100, background: "rgba(255,255,255,0.9)", borderColor: "rgba(0,0,0,0.06)", ...style }}>{children}</div>;
}
export function SecTitle({ icon: I, title, color = "#111111" }) {
  return <div className="flex items-center gap-2 mb-3"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: color }}><I size={13} color="#fff" /></div><h2 className="text-sm font-bold" style={{ color }}>{title}</h2></div>;
}
