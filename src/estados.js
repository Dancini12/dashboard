// Estados das Cotações Cooperativas, na ordem do seletor. Usados pela aba de cotações, pelo Resumo do dia
// e pelo Jornal do dia (preços e diesel do estado escolhido) e pela busca do topo.
// no / de: preposições ("soja no Paraná", "postos de São Paulo"); anp: nome na planilha de combustíveis;
// endereco: de onde vêm as cotações do estado.
export const ESTADOS = [
  { sigla: 'PR', nome: 'Paraná', no: 'no', de: 'do', frequencia: 'diária', fonte: 'DERAL', anp: 'PARANA', endereco: '/api/market?type=pr' },
  { sigla: 'SP', nome: 'São Paulo', no: 'em', de: 'de', frequencia: 'diária', fonte: 'IEA', anp: 'SAO PAULO', endereco: '/api/market?type=sp' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul', no: 'em', de: 'de', frequencia: 'diária', fonte: 'Famasul', anp: 'MATO GROSSO DO SUL', endereco: '/api/market?type=ms' },
  { sigla: 'MT', nome: 'Mato Grosso', no: 'em', de: 'de', frequencia: 'diária', fonte: 'IMEA', anp: 'MATO GROSSO', endereco: '/api/market?type=mt' },
  { sigla: 'RS', nome: 'Rio Grande do Sul', no: 'no', de: 'do', frequencia: 'semanal', fonte: 'Emater', anp: 'RIO GRANDE DO SUL', endereco: '/dados/precos-rs.json' },
];
export const estadoPorSigla = sigla => ESTADOS.find(e => e.sigla === sigla) ?? ESTADOS[0];

// O estado escolhido fica lembrado neste navegador; sem escolha, o Paraná.
const LS_ESTADO = 'agroinfo.estadoDasCotacoes';
export function estadoLembrado() {
  try {
    const salvo = localStorage.getItem(LS_ESTADO);
    if (ESTADOS.some(e => e.sigla === salvo)) return salvo;
  } catch { /* sem storage: Paraná */ }
  return 'PR';
}
export function lembrarEstado(sigla) {
  try { localStorage.setItem(LS_ESTADO, sigla); } catch { /* ignora */ }
}
