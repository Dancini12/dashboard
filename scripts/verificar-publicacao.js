import { readFileSync, existsSync } from 'node:fs';

// Verifica o artefato final, não somente os arquivos de origem.
const html = readFileSync('dist/index.html', 'utf8');
const conta = html.match(/name="google-adsense-account" content="ca-(pub-\d{16})"/)?.[1];
if (!conta) throw new Error('Metatag do editor ausente ou inválida.');
const ads = readFileSync('dist/ads.txt', 'utf8').trim();
if (ads !== `google.com, ${conta}, DIRECT, f08c47fec0942fa0`) {
  throw new Error('ads.txt não corresponde à conta de editor do site.');
}
const guias = readFileSync('src/editorial/guias.html', 'utf8');
if (!html.includes(guias)) throw new Error('Conteúdo educativo ausente no HTML inicial.');
for (const [, caminho] of guias.matchAll(/href="\/(?!#)([^"#]+)"/g)) {
  if (!existsSync(`dist/${caminho}.html`)) throw new Error(`Página ausente: ${caminho}`);
}
console.log('Publicação conferida: ads.txt, metatag, conteúdo inicial e links dos guias.');
