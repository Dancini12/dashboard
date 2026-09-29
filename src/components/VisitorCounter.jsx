import { useEffect, useState } from "react";

const BASE = "https://abacus.jasoncameron.dev";
const KEY = "agroinfo-dashboard-vercel-app/visitantes";
const LS_KEY = "agroinfo_visitante_numero";
const LS_SESSAO = "agroinfo_sessao";
const SINAL_MS = 45000;

// Identificador deste navegador para o "online agora": várias abas contam como uma pessoa.
function idDaSessao() {
  try {
    let id = localStorage.getItem(LS_SESSAO);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(LS_SESSAO, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

// Cada navegador conta uma vez: no primeiro acesso soma 1 no contador
// externo e guarda o número; nos seguintes só mostra o total atual.
// Navegadores controlados por automação (testes, robôs) só leem o total.
// "Online agora": enquanto a aba está visível, manda um sinal de presença ao
// Apps Script do assistente a cada 45 s; ao sair do site, avisa na hora.
export default function VisitorCounter({ presencaUrl }) {
  const [count, setCount] = useState(null);
  const [online, setOnline] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let first = true;
    try { first = !localStorage.getItem(LS_KEY); } catch { /* sem storage: conta como novo */ }
    if (navigator.webdriver) first = false;

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

  useEffect(() => {
    if (!presencaUrl) return;
    let ativo = true;
    const sessao = idDaSessao();
    const corpo = (saindo) => JSON.stringify(saindo ? { acao: "presenca", sessao, saindo } : { acao: "presenca", sessao });
    const sinal = () => {
      if (document.visibilityState !== "visible") return;
      fetch(presencaUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: corpo(false) })
        .then(r => r.json())
        .then(d => { if (ativo && Number.isFinite(d?.online)) setOnline(Math.max(1, d.online)); })
        .catch(() => {});
    };
    const sair = () => {
      try { navigator.sendBeacon?.(presencaUrl, new Blob([corpo(true)], { type: "text/plain;charset=utf-8" })); } catch { /* ignora */ }
    };
    const aoMudarVisibilidade = () => { if (document.visibilityState === "visible") sinal(); };

    sinal();
    const timer = setInterval(sinal, SINAL_MS);
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    window.addEventListener("pagehide", sair);
    return () => {
      ativo = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      window.removeEventListener("pagehide", sair);
    };
  }, [presencaUrl]);

  if (count === null && online === null) return null;

  return (
    <div style={{ position: "fixed", bottom: 12, right: 12, zIndex: 40, background: "rgba(12,35,64,0.95)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 12, padding: "8px 12px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
      {count !== null && <div>👥 Visitantes: <strong style={{ color: "#fbbf24" }}>{count.toLocaleString("pt-BR")}</strong></div>}
      {online !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: count !== null ? 2 : 0 }}>
          <span className="animate-pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 3px rgba(34,197,94,0.25)", margin: "0 3px" }} />
          Online agora: <strong style={{ color: "#4ade80" }}>{online.toLocaleString("pt-BR")}</strong>
        </div>
      )}
      {count !== null && <div style={{ marginTop: 2, fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Nossa meta é chegar a 100 visitantes 🎯</div>}
    </div>
  );
}
