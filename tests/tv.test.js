import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerPaginaAoVivo } from '../server/tv.js';

const CANAL = 'UCaaaaaaaaaaaaaaaaaaaaaa';
// página /live como o YouTube manda: os dados do player dentro de um <script>
const pagina = dados => `<html><head><link rel="canonical" href="https://www.youtube.com/watch?v=${dados.videoDetails.videoId}"></head><body>`
  + `<script>var ytInitialPlayerResponse = ${JSON.stringify(dados)};var meta = document.createElement('meta');</script><script>var ytInitialData = {"x":{}};</script></body></html>`;
const video = extra => ({ videoId: 'abcdefghijk', title: 'Jornal do campo', channelId: CANAL, isLiveContent: true, ...extra });

test('tv: transmissão no ar dá o código do vídeo e o título', () => {
  const html = pagina({ playabilityStatus: { status: 'OK', playableInEmbed: true }, videoDetails: video({ isLive: true }) });
  assert.deepEqual(lerPaginaAoVivo(html, CANAL), { situacao: 'aoVivo', videoId: 'abcdefghijk', titulo: 'Jornal do campo' });
});
test('tv: título com chaves e aspas não confunde a leitura', () => {
  const html = pagina({ playabilityStatus: { status: 'OK' }, videoDetails: video({ isLive: true, title: 'Soja } sobe "forte" {hoje} \\' }) });
  assert.equal(lerPaginaAoVivo(html, CANAL).titulo, 'Soja } sobe "forte" {hoje} \\');
});
test('tv: transmissão agendada traz o horário de início', () => {
  const html = pagina({
    playabilityStatus: { status: 'LIVE_STREAM_OFFLINE', playableInEmbed: true,
      liveStreamability: { liveStreamabilityRenderer: { offlineSlate: { liveStreamOfflineSlateRenderer: { scheduledStartTime: '1791550800' } } } } },
    videoDetails: video({ isUpcoming: true }),
  });
  assert.deepEqual(lerPaginaAoVivo(html, CANAL), { situacao: 'agendado', videoId: 'abcdefghijk', titulo: 'Jornal do campo', inicio: '2026-10-09T13:00:00.000Z' });
});
test('tv: sem transmissão, encerrada ou sem permissão de exibir em outros sites conta como fora do ar', () => {
  const doCanal = `<html><head><link rel="canonical" href="https://www.youtube.com/channel/${CANAL}"></head><body>window.ytInitialPlayerResponse,a.b</body></html>`;
  assert.deepEqual(lerPaginaAoVivo(doCanal, CANAL), { situacao: 'fora' });
  assert.deepEqual(lerPaginaAoVivo(pagina({ playabilityStatus: { status: 'OK' }, videoDetails: video({}) }), CANAL), { situacao: 'fora' }, 'gravação de transmissão encerrada');
  assert.deepEqual(lerPaginaAoVivo(pagina({ playabilityStatus: { status: 'OK', playableInEmbed: false }, videoDetails: video({ isLive: true }) }), CANAL), { situacao: 'fora' });
  assert.deepEqual(lerPaginaAoVivo(pagina({ playabilityStatus: { status: 'LOGIN_REQUIRED' }, videoDetails: video({ isLive: true }) }), CANAL), { situacao: 'fora' });
});
test('tv: página que não é a do canal é erro, não "fora do ar"', () => {
  assert.throws(() => lerPaginaAoVivo('<html><body>Antes de continuar no YouTube</body></html>', CANAL), /inesperada/);
  assert.throws(() => lerPaginaAoVivo(pagina({ playabilityStatus: { status: 'OK' }, videoDetails: video({ isLive: true, channelId: 'UCbbbbbbbbbbbbbbbbbbbbbb' }) }), CANAL), /outro canal/);
  assert.throws(() => lerPaginaAoVivo('<script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"abc', CANAL), /incompletos/);
});
