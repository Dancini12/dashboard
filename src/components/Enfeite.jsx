// Enfeite do alto das páginas no estilo de jornal: dois fios com três losangos no meio. Os losangos são
// desenhados, porque o símbolo de fonte falta em alguns aparelhos, e feitos só de borda, porque a
// impressão costuma sair sem as cores de fundo.
const Losango = ({ lado, cor }) => <span className="block shrink-0" style={{ width: 0, height: 0, border: `${lado / 2}px solid ${cor}`, transform: "rotate(45deg)" }} />;

export default function Enfeite({ cor = "#111111" }) {
  return (
    <div className="flex items-center gap-2" style={{ height: 14 }} aria-hidden="true">
      <span className="flex-1" style={{ borderTop: `1px solid ${cor}` }} />
      <Losango lado={5} cor={cor} /><Losango lado={9} cor={cor} /><Losango lado={5} cor={cor} />
      <span className="flex-1" style={{ borderTop: `1px solid ${cor}` }} />
    </div>
  );
}
