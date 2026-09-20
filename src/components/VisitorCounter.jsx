import { useEffect, useState } from "react";

const GOAL = 1000;

export default function VisitorCounter() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/visitor-count", { method: "POST" })
      .then(r => r.json())
      .then(d => { if (!cancelled && d?.ok && typeof d.count === "number") setCount(d.count); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (count === null) return null;
  const progress = Math.min(100, Math.round((count / GOAL) * 100));

  return (
    <div style={{ position: "fixed", bottom: 12, right: 12, zIndex: 40, background: "rgba(12,35,64,0.95)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 12, padding: "8px 12px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", maxWidth: 210 }}>
      <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>
        Você é o(a) visitante número <strong style={{ color: "#fbbf24" }}>{count.toLocaleString("pt-BR")}</strong>
      </p>
      <p style={{ margin: "4px 0 6px", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Meta: {GOAL.toLocaleString("pt-BR")} acessos 🎯</p>
      <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#1e8449,#fbbf24)", transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}
