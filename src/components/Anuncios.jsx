import { useEffect, useRef, useState } from "react";

// A presença do código de editor não autoriza veiculação. Manter bloqueado até aprovação.
const ADSENSE_APROVADO = import.meta.env.VITE_ADSENSE_APPROVED === "true";
const CLIENTE_ADSENSE = import.meta.env.VITE_ADSENSE_CLIENT || "";
const BLOCO_ADSENSE = import.meta.env.VITE_ADSENSE_SLOT || "";
const ESCOLHA_GUARDADA = "agroinfo_cookies"; // "todos" ou "necessarios"

function escolhaGuardada() {
  try { return localStorage.getItem(ESCOLHA_GUARDADA); } catch { return null; }
}

let carregado = false;
function carregarAdsense(personalizados) {
  if (!ADSENSE_APROVADO || carregado || !CLIENTE_ADSENSE) return;
  carregado = true;
  window.adsbygoogle = window.adsbygoogle || [];
  if (!personalizados) window.adsbygoogle.requestNonPersonalizedAds = 1;
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENTE_ADSENSE}`;
  document.head.appendChild(script);
}

export function AvisoDeCookies() {
  const [escolha, setEscolha] = useState(escolhaGuardada);
  useEffect(() => { if (escolha) carregarAdsense(escolha === "todos"); }, [escolha]);
  if (!ADSENSE_APROVADO || !CLIENTE_ADSENSE || escolha) return null;
  const escolher = valor => {
    try { localStorage.setItem(ESCOLHA_GUARDADA, valor); } catch { /* sem armazenamento: vale só nesta visita */ }
    setEscolha(valor);
  };
  return (
    <div role="dialog" aria-label="Aviso de cookies" className="fixed inset-x-0 bottom-0 print:hidden" style={{ zIndex: 60, background: "#ffffff", borderTop: "2px solid #166534", fontFamily: 'Georgia, "Times New Roman", serif', color: "#0f172a" }}>
      <div className="max-w-4xl mx-auto px-3 py-3 flex flex-wrap items-center gap-3 text-sm">
        <p className="flex-1" style={{ minWidth: 240 }}>Este site mostra anúncios do Google, que usam cookies para escolher o que aparece. Você decide se aceita anúncios personalizados. <a href="/privacidade" className="underline">Saiba mais</a>.</p>
        <button type="button" onClick={() => escolher("necessarios")} className="px-3 py-2 text-xs font-bold" style={{ border: "1px solid #bbf7d0", background: "#ffffff", color: "#166534" }}>Só os necessários</button>
        <button type="button" onClick={() => escolher("todos")} className="px-3 py-2 text-xs font-bold" style={{ background: "#166534", color: "#ffffff" }}>Aceitar</button>
      </div>
    </div>
  );
}

// Um espaço de anúncio com a etiqueta "Publicidade", para o leitor distinguir anúncio de notícia.
export function Anuncio() {
  const espaco = useRef(null);
  useEffect(() => {
    if (!ADSENSE_APROVADO || !CLIENTE_ADSENSE || !BLOCO_ADSENSE || !espaco.current || espaco.current.dataset.pedido) return;
    espaco.current.dataset.pedido = "1";
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* bloqueador de anúncios: o espaço fica vazio */ }
  }, []);
  if (!ADSENSE_APROVADO || !CLIENTE_ADSENSE || !BLOCO_ADSENSE) return null;
  return (
    <aside className="my-5 print:hidden" aria-label="Publicidade">
      <p className="text-center uppercase" style={{ fontSize: 9, letterSpacing: "0.12em", color: "#64748b", fontFamily: "system-ui, sans-serif" }}>Publicidade</p>
      <ins ref={espaco} className="adsbygoogle" style={{ display: "block" }} data-ad-client={CLIENTE_ADSENSE} data-ad-slot={BLOCO_ADSENSE} data-ad-format="auto" data-full-width-responsive="true" />
    </aside>
  );
}
