import { useState } from "react";

const LS_KEY = "agroinfo_mascote";
// A partir desta largura o mascote cabe na margem lateral, sem cobrir o conteúdo (max-w-4xl).
const CABE_NA_MARGEM = "(min-width: 1150px)";

// Visível por padrão só onde cabe na margem; depois vale a escolha do visitante
// (fechar / chamar), guardada neste navegador.
export default function useMascote() {
  const [visivel, setVisivel] = useState(() => {
    try {
      const salvo = localStorage.getItem(LS_KEY);
      if (salvo) return salvo === "visivel";
    } catch { /* sem storage: usa o padrão */ }
    return window.matchMedia(CABE_NA_MARGEM).matches;
  });

  const alterar = (v) => {
    setVisivel(v);
    try { localStorage.setItem(LS_KEY, v ? "visivel" : "oculto"); } catch { /* ignora */ }
  };

  return [visivel, alterar];
}
