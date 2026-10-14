import historicoCepea from "./historicoCepea.json";

// Médias anuais dos indicadores do CEPEA/ESALQ desde 2020, calculadas das planilhas do próprio CEPEA por
// scripts/historico-cepea.py (uma rotina do GitHub roda o script todo mês). O ano corrente é a média até o
// último dia publicado (historicoCepea.ultimoDia).
export const HISTORICO = historicoCepea.anos;
export const SERIES_DO_HISTORICO = historicoCepea.series;
export const ANO_CORRENTE_DO_HISTORICO = historicoCepea.ultimoDia.slice(0, 4);
export const ATE_DO_HISTORICO = `${historicoCepea.ultimoDia.slice(8, 10)}/${historicoCepea.ultimoDia.slice(5, 7)}`;
export const rotuloDoAno = ano => (ano === ANO_CORRENTE_DO_HISTORICO ? `${ano}*` : ano);
export const NOMES_DO_HISTORICO = { boi: "🐂 Boi", soja: "🌱 Soja", milho: "🌽 Milho", cafe: "☕ Café", trigo: "🌾 Trigo" };
export const NOMES_CURTOS_DO_HISTORICO = { boi: "Boi", soja: "Soja", milho: "Milho", cafe: "Café", trigo: "Trigo" };
export { historicoCepea };
