// Números no formato brasileiro: fmt(1234.5) → "1.234,50"; fmtInt(1234) → "1.234".
export const fmt = (v, d = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtInt = (v) => v.toLocaleString("pt-BR");
