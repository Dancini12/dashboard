import { useEffect, useState } from "react";

const BASE = "https://abacus.jasoncameron.dev";
const KEY = "agroinfo-dashboard-vercel-app/visitantes";
const LS_KEY = "agroinfo_visitante_numero";

// Cada navegador conta uma vez: no primeiro acesso soma 1 no contador
// externo e guarda o número; nos seguintes só mostra o total atual.
export default function VisitorCounter() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let first = true;
    try { first = !localStorage.getItem(LS_KEY); } catch { /* sem storage: conta como novo */ }

    fetch(`${BASE}/${first ? "hit" : "get"}/${KEY}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled || typeof d?.value !== "number") return;
        if (first) { try { localStorage.setItem(LS_KEY, String(d.value)); } catch { /* ignora */ } }
        setCount(d.value);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (count === null) return null;

  return (
    <div style={{ position: "fixed", bottom: 12, right: 12, zIndex: 40, background: "rgba(12,35,64,0.95)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 12, padding: "8px 12px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
      <div>👥 Visitantes: <strong style={{ color: "#fbbf24" }}>{count.toLocaleString("pt-BR")}</strong></div>
      <div style={{ marginTop: 2, fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Nossa meta é chegar a 1.000 visitantes 🎯</div>
    </div>
  );
}
