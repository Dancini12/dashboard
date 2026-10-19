// Estados das Cotações Cooperativas, na ordem do seletor. Usados pela aba de cotações, pelo Resumo do dia
// e pelo Jornal do dia (preços e diesel do estado escolhido) e pela busca do topo.
// no / de: preposições ("soja no Paraná", "postos de São Paulo"); anp: nome na planilha de combustíveis;
// endereco: de onde vêm as cotações do estado; gentilico e produtos: para a busca do topo (os produtos
// são os botões da aba naquele estado; o Paraná usa a lista do DERAL, em PRODUTOS_PARANA).
export const ESTADOS = [
  { sigla: 'PR', nome: 'Paraná', no: 'no', de: 'do', frequencia: 'diária', fonte: 'DERAL', anp: 'PARANA', endereco: '/api/market?type=pr', gentilico: 'paranaense', produtos: [] },
  { sigla: 'SP', nome: 'São Paulo', no: 'em', de: 'de', frequencia: 'diária', fonte: 'IEA', anp: 'SAO PAULO', endereco: '/api/market?type=sp', gentilico: 'paulista',
    produtos: ['Soja', 'Milho', 'Trigo', 'Café', 'Laranja', 'Boi gordo', 'Vaca gorda'] },
  { sigla: 'MS', nome: 'Mato Grosso do Sul', no: 'em', de: 'de', frequencia: 'diária', fonte: 'Famasul', anp: 'MATO GROSSO DO SUL', endereco: '/api/market?type=ms', gentilico: 'sul-mato-grossense',
    produtos: ['Soja', 'Milho', 'Boi gordo', 'Vaca gorda'] },
  { sigla: 'MT', nome: 'Mato Grosso', no: 'em', de: 'de', frequencia: 'diária', fonte: 'IMEA', anp: 'MATO GROSSO', endereco: '/api/market?type=mt', gentilico: 'mato-grossense',
    produtos: ['Soja', 'Milho', 'Boi gordo', 'Vaca gorda'] },
  { sigla: 'RS', nome: 'Rio Grande do Sul', no: 'no', de: 'do', frequencia: 'semanal', fonte: 'Emater', anp: 'RIO GRANDE DO SUL', endereco: '/dados/precos-rs.json', gentilico: 'gaúcho riograndense',
    produtos: ['Soja', 'Milho', 'Trigo', 'Arroz', 'Feijão', 'Boi', 'Vaca', 'Suíno', 'Cordeiro', 'Búfalo'] },
];
export const estadoPorSigla = sigla => ESTADOS.find(e => e.sigla === sigla) ?? ESTADOS[0];

// Itens da busca do topo com as cotações de cada estado (fora o Paraná, que tem os seus no App): um para
// abrir o estado e um por produto. Só aparecem quando a pessoa digita o estado ("exige"). Mato Grosso vem
// antes de Mato Grosso do Sul, para "soja mato grosso" achar primeiro o estado de nome exato.
export function itensDeBuscaDosEstados(sinonimos = {}) {
  const ordem = ['SP', 'MT', 'MS', 'RS'];
  return ordem.map(estadoPorSigla).flatMap(e => {
    const exige = `${e.sigla} ${e.nome} ${e.gentilico}`;
    const detalhe = `${e.frequencia === 'semanal' ? 'Boletim semanal' : 'Cotação diária'} ${e.fonte === 'Emater' ? 'da' : 'do'} ${e.fonte} · Cotações Cooperativas`;
    return [
      { titulo: `Cotações ${e.no} ${e.nome}`, detalhe, grupo: 'Cooperativas', termos: `${exige} cooperativa produtor preco`, exige, acao: { aba: 'cooperativas', estado: e.sigla } },
      ...e.produtos.map(produto => ({ titulo: `${produto} · preço ${e.no} ${e.nome}`, detalhe, grupo: 'Cooperativas',
        termos: `${exige} cooperativa produtor ${sinonimos[produto] ?? ''}`, exige, acao: { aba: 'cooperativas', estado: e.sigla, produto } })),
    ];
  });
}

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
