// Países da consulta "comércio com um país" da aba Exportações: [código no Comex Stat, nome]. Vem da
// tabela de países da própria fonte (api-comexstat.mdic.gov.br/tables/countries, lida em 08/10/2026),
// sem o Brasil, sem os códigos que não são país ("não declarados", "provisão de navios"…) e sem
// países que deixaram de existir. Alguns nomes foram postos na ordem em que se fala (República Tcheca).
import { normalizar } from './busca.js';

export const PAISES = [
  ['013', 'Afeganistão'], ['756', 'África do Sul'], ['015', 'Aland, Ilhas'], ['017', 'Albânia'], ['020', 'Alboran-Perejil, Ilhas'],
  ['023', 'Alemanha'], ['037', 'Andorra'], ['040', 'Angola'], ['041', 'Anguilla'], ['042', 'Antártica'], ['043', 'Antígua e Barbuda'],
  ['053', 'Arábia Saudita'], ['059', 'Argélia'], ['063', 'Argentina'], ['064', 'Armênia'], ['065', 'Aruba'], ['069', 'Austrália'],
  ['072', 'Áustria'], ['073', 'Azerbaijão'], ['077', 'Bahamas'], ['081', 'Bangladesh'], ['083', 'Barbados'], ['080', 'Barein'], ['085', 'Belarus'],
  ['087', 'Bélgica'], ['088', 'Belize'], ['229', 'Benin'], ['090', 'Bermudas'], ['097', 'Bolívia'], ['099', 'Bonaire, Saint Eustatius e Saba'],
  ['098', 'Bósnia-Herzegovina'], ['101', 'Botsuana'], ['102', 'Bouvet, Ilha'], ['108', 'Brunei'], ['111', 'Bulgária'], ['031', 'Burkina Faso'],
  ['115', 'Burundi'], ['119', 'Butão'], ['127', 'Cabo Verde'], ['145', 'Camarões'], ['141', 'Camboja'], ['149', 'Canadá'],
  ['151', 'Canárias, Ilhas'], ['154', 'Catar'], ['137', 'Cayman, Ilhas'], ['153', 'Cazaquistão'], ['788', 'Chade'], ['158', 'Chile'],
  ['160', 'China'], ['163', 'Chipre'], ['511', 'Christmas (Navidad), Ilha'], ['165', 'Cocos (Keeling), Ilhas'], ['169', 'Colômbia'],
  ['173', 'Comores'], ['177', 'Congo'], ['183', 'Cook, Ilhas'], ['187', 'Coreia do Norte'], ['190', 'Coreia do Sul'], ['193', 'Costa do Marfim'],
  ['196', 'Costa Rica'], ['195', 'Croácia'], ['199', 'Cuba'], ['200', 'Curaçao'], ['232', 'Dinamarca'], ['783', 'Djibuti'], ['235', 'Dominica'],
  ['240', 'Egito'], ['687', 'El Salvador'], ['244', 'Emirados Árabes Unidos'], ['239', 'Equador'], ['243', 'Eritreia'], ['247', 'Eslováquia'],
  ['246', 'Eslovênia'], ['245', 'Espanha'], ['249', 'Estados Unidos'], ['251', 'Estônia'], ['253', 'Etiópia'], ['255', 'Falkland (Malvinas)'],
  ['259', 'Faroe, Ilhas'], ['870', 'Fiji'], ['267', 'Filipinas'], ['271', 'Finlândia'], ['275', 'França'], ['281', 'Gabão'], ['285', 'Gâmbia'],
  ['289', 'Gana'], ['291', 'Geórgia'], ['292', 'Geórgia do Sul e Sandwich do Sul, Ilhas'], ['293', 'Gibraltar'], ['297', 'Granada'],
  ['301', 'Grécia'], ['305', 'Groenlândia'], ['309', 'Guadalupe'], ['313', 'Guam'], ['317', 'Guatemala'], ['321', 'Guernsey'], ['337', 'Guiana'],
  ['325', 'Guiana Francesa'], ['329', 'Guiné'], ['331', 'Guiné Equatorial'], ['334', 'Guiné-Bissau'], ['341', 'Haiti'],
  ['343', 'Heard e ilhas mcdonald, Ilha'], ['345', 'Honduras'], ['351', 'Hong Kong'], ['355', 'Hungria'], ['357', 'Iêmen'], ['359', 'Ilha de Man'],
  ['361', 'Índia'], ['365', 'Indonésia'], ['372', 'Irã'], ['369', 'Iraque'], ['375', 'Irlanda'], ['379', 'Islândia'], ['383', 'Israel'],
  ['386', 'Itália'], ['391', 'Jamaica'], ['399', 'Japão'], ['393', 'Jersey'], ['396', 'Johnston, Ilhas'], ['403', 'Jordânia'], ['411', 'Kiribati'],
  ['198', 'Kuwait'], ['420', 'Laos'], ['423', 'Lebuan, Ilhas'], ['426', 'Lesoto'], ['427', 'Letônia'], ['431', 'Líbano'], ['434', 'Libéria'],
  ['438', 'Líbia'], ['440', 'Liechtenstein'], ['442', 'Lituânia'], ['445', 'Luxemburgo'], ['447', 'Macau'], ['449', 'Macedônia'],
  ['450', 'Madagascar'], ['452', 'Madeira, Ilha da'], ['455', 'Malásia'], ['458', 'Malavi'], ['461', 'Maldivas'], ['464', 'Mali'], ['467', 'Malta'],
  ['472', 'Marianas do Norte, Ilhas'], ['474', 'Marrocos'], ['476', 'Marshall, Ilhas'], ['477', 'Martinica'], ['485', 'Maurício'],
  ['488', 'Mauritânia'], ['489', 'Mayotte'], ['493', 'México'], ['093', 'Mianmar'], ['499', 'Micronésia'], ['490', 'Midway, Ilhas'],
  ['505', 'Moçambique'], ['494', 'Moldávia'], ['495', 'Mônaco'], ['497', 'Mongólia'], ['498', 'Montenegro'], ['501', 'Montserrat'],
  ['507', 'Namíbia'], ['508', 'Nauru'], ['517', 'Nepal'], ['521', 'Nicarágua'], ['525', 'Níger'], ['528', 'Nigéria'], ['531', 'Niue'],
  ['535', 'Norfolk, Ilha'], ['538', 'Noruega'], ['542', 'Nova Caledônia'], ['548', 'Nova Zelândia'], ['556', 'Omã'],
  ['573', 'Países Baixos (Holanda)'], ['575', 'Palau'], ['578', 'Palestina'], ['580', 'Panamá'], ['545', 'Papua Nova Guiné'], ['576', 'Paquistão'],
  ['586', 'Paraguai'], ['589', 'Peru'], ['593', 'Pitcairn'], ['599', 'Polinésia Francesa'], ['603', 'Polônia'], ['611', 'Porto Rico'],
  ['607', 'Portugal'], ['623', 'Quênia'], ['625', 'Quirguistão'], ['628', 'Reino Unido'], ['640', 'República Centro-Africana'],
  ['888', 'República Democrática do Congo'], ['647', 'República Dominicana'], ['791', 'República Tcheca'], ['660', 'Reunião'], ['670', 'Romênia'],
  ['675', 'Ruanda'], ['676', 'Rússia'], ['685', 'Saara Ocidental'], ['678', 'Saint Kitts e Nevis'], ['677', 'Salomão, Ilhas'], ['690', 'Samoa'],
  ['691', 'Samoa Americana'], ['697', 'San Marino'], ['710', 'Santa Helena'], ['715', 'Santa Lúcia'], ['693', 'São Bartolomeu'],
  ['695', 'São Cristóvão e Névis'], ['698', 'São Martinho, Ilha de (parte francesa)'], ['700', 'São Pedro e Miquelon'],
  ['720', 'São Tomé e Príncipe'], ['705', 'São Vicente e Granadinas'], ['731', 'Seicheles'], ['728', 'Senegal'], ['735', 'Serra Leoa'],
  ['737', 'Sérvia'], ['741', 'Singapura'], ['699', 'Sint Maarten'], ['744', 'Síria'], ['748', 'Somália'], ['750', 'Sri Lanka'],
  ['754', 'Suazilândia'], ['759', 'Sudão'], ['760', 'Sudão do Sul'], ['764', 'Suécia'], ['767', 'Suíça'], ['770', 'Suriname'],
  ['755', 'Svalbard e Jan Mayen'], ['772', 'Tadjiquistão'], ['776', 'Tailândia'], ['161', 'Taiwan'], ['780', 'Tanzânia'],
  ['781', 'Terras Austrais Francesas'], ['786', 'Território Antártico Britânico'], ['782', 'Território Britânico do Oceano Índico'],
  ['795', 'Timor Leste'], ['800', 'Togo'], ['810', 'Tonga'], ['805', 'Toquelau'], ['815', 'Trinidad e Tobago'], ['820', 'Tunísia'],
  ['823', 'Turcas e Caicos, Ilhas'], ['824', 'Turcomenistão'], ['827', 'Turquia'], ['828', 'Tuvalu'], ['831', 'Ucrânia'], ['833', 'Uganda'],
  ['845', 'Uruguai'], ['847', 'Uzbequistão'], ['551', 'Vanuatu'], ['848', 'Vaticano'], ['850', 'Venezuela'], ['858', 'Vietnã'],
  ['866', 'Virgens, Ilhas (Americanas)'], ['863', 'Virgens, Ilhas (Britânicas)'], ['873', 'Wake, Ilha'], ['875', 'Wallis e Futuna, Ilhas'],
  ['890', 'Zâmbia'], ['665', 'Zimbábue'],
];

// Outros jeitos de escrever que não estão no nome oficial.
const APELIDOS = { eua: '249', usa: '249', 'estados unidos da america': '249', inglaterra: '628', 'gra-bretanha': '628', 'gra bretanha': '628', holanda: '573', coveite: '198' };
const palavras = texto => normalizar(texto).split(/[^a-z0-9]+/).filter(Boolean);

// O que a pessoa digitou → { pais: [código, nome] } se deu para saber qual é, ou { opcoes: [...] } com os
// países que combinam (lista vazia: nenhum). Vale o nome inteiro ou o começo das palavras, sem acento.
export function acharPais(texto) {
  const digitado = normalizar(texto).trim().replace(/\s+/g, ' ');
  if (!digitado) return { opcoes: [] };
  const exato = PAISES.find(([id, nome]) => id === APELIDOS[digitado] || normalizar(nome) === digitado);
  if (exato) return { pais: exato };
  const pedidas = palavras(digitado);
  const opcoes = PAISES.filter(([, nome]) => { const doNome = palavras(nome); return pedidas.every(p => doNome.some(n => n.startsWith(p))); });
  return opcoes.length === 1 ? { pais: opcoes[0] } : { opcoes };
}
