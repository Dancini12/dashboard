// Deixa prontas as consultas da aba Exportações: busca na fonte oficial (Comex Stat) e grava em
// public/dados/exportacoes/ os dados da aba e o comércio com os países da lista abaixo. O site lê
// esses arquivos antes de ir à fonte, que é lenta e recusa pedidos seguidos; país fora da lista
// continua sendo buscado na hora.
//
// Uso: node scripts/dados-exportacoes.mjs
// A fonte publica um mês novo por mês. Cada arquivo guarda de que mês é: o script só refaz os que
// faltam ou são de um mês anterior, então rodar de novo depois de uma falha continua de onde parou,
// e rodar sem novidade na fonte não mexe em nada. Com tudo por fazer, leva de 15 a 30 minutos.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { comercioComPais, destinosDasExportacoes, exportacoesPorProduto, LimiteDePedidos, ultimoMesPublicado } from '../server/exportacoes.js';
import { PAISES } from '../src/paises.js';

// Países que ficam prontos (nome como está em src/paises.js). Para incluir outro, acrescente o nome aqui.
const PAISES_PRONTOS = ['China', 'Estados Unidos', 'Argentina', 'Paraguai', 'Uruguai', 'Chile', 'México', 'Canadá', 'Rússia', 'Alemanha',
  'Países Baixos (Holanda)', 'Espanha', 'Japão', 'Índia', 'Vietnã', 'Indonésia', 'Emirados Árabes Unidos', 'Arábia Saudita', 'Egito', 'Irã'];

const PASTA = new URL('../public/dados/exportacoes/', import.meta.url);
const INTERVALO = 15000; // a fonte recusa pedidos com menos de uns 13 segundos de intervalo
const dormir = ms => new Promise(seguir => setTimeout(seguir, ms));

let ultimoPedido = 0;
// Um pedido à fonte, respeitando o intervalo. A fonte às vezes passa minutos recusando tudo: a espera
// cresce a cada recusa, até 3 minutos.
async function daFonte(rotulo, consulta) {
  for (let tentativa = 1; ; tentativa++) {
    await dormir(Math.max(0, ultimoPedido + INTERVALO - Date.now()));
    try {
      const dados = await consulta();
      ultimoPedido = Date.now();
      console.log(`ok   ${rotulo}`);
      return dados;
    } catch (erro) {
      ultimoPedido = Date.now();
      if (tentativa >= 20) throw new Error(`${rotulo}: ${erro.message}`);
      const espera = Math.min(30 * tentativa, 180);
      console.log(`     ${rotulo}: ${erro instanceof LimiteDePedidos ? 'a fonte pediu para esperar' : erro.message}; nova tentativa em ${espera} s`);
      await dormir(espera * 1000);
    }
  }
}

const consultas = [['produtos', 'produtos', exportacoesPorProduto], ['destinos', 'destinos', destinosDasExportacoes]];
for (const nome of PAISES_PRONTOS) {
  const pais = PAISES.find(p => p[1] === nome);
  if (!pais) throw new Error(`"${nome}" não está em src/paises.js`);
  for (const fluxo of ['export', 'import']) consultas.push([`pais-${pais[0]}-${fluxo}`, `${nome} (${fluxo})`, () => comercioComPais(pais[0], fluxo)]);
}

await mkdir(PASTA, { recursive: true });
const mes = await daFonte('último mês publicado', ultimoMesPublicado);
let feitos = 0;
for (const [arquivo, rotulo, consulta] of consultas) {
  const destino = new URL(`${arquivo}.json`, PASTA);
  const atual = await readFile(destino, 'utf8').then(JSON.parse, () => null);
  if (atual?.mesDaFonte === mes) continue;
  await writeFile(destino, `${JSON.stringify({ ...(await daFonte(rotulo, consulta)), mesDaFonte: mes, geradoEm: new Date().toISOString() })}\n`);
  feitos++;
}
console.log(feitos ? `Pronto: ${feitos} arquivos gerados, com dados até ${mes}.` : `Sem novidade: a fonte continua em ${mes} e os ${consultas.length} arquivos estão em dia.`);
