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
test('tv: pedido de login no lugar dos dados do vídeo (acesso por servidor) ainda dá a transmissão no ar', () => {
  const html = `<html><head><title>Mercado &amp; Cia - YouTube</title><meta name="title" content="Mercado &amp; Cia &quot;ao vivo&quot;"><link rel="canonical" href="https://www.youtube.com/watch?v=abcdefghijk"></head>`
    + `<body><script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"LOGIN_REQUIRED","reason":"Faça login para confirmar que você não é um bot"}};</script><script>var ytInitialData = {"browseId":"${CANAL}"};</script></body></html>`;
  assert.deepEqual(lerPaginaAoVivo(html, CANAL), { situacao: 'aoVivo', videoId: 'abcdefghijk', titulo: 'Mercado & Cia "ao vivo"' });
  assert.equal(lerPaginaAoVivo(html.replace(/<meta name="title"[^>]*>/, ''), CANAL).titulo, 'Mercado & Cia', 'sem a meta, vale o título da página');
  const semCanonico = html.replace(/<link rel="canonical"[^>]*>/, '').replace('{"browseId"', '{"currentVideoEndpoint":{"commandMetadata":{"webCommandMetadata":{"url":"/watch?v=abcdefghijk"}},"watchEndpoint":{"videoId":"abcdefghijk"}},"browseId"');
  assert.equal(lerPaginaAoVivo(semCanonico, CANAL).videoId, 'abcdefghijk', 'sem o endereço canônico, vale o vídeo atual da página');
  assert.throws(() => lerPaginaAoVivo(html, 'UCbbbbbbbbbbbbbbbbbbbbbb'), /sem dados do vídeo: LOGIN_REQUIRED/, 'página que nem cita o canal');
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
  assert.deepEqual(lerPaginaAoVivo(doCanal, CANAL), { situacao: 'fora', motivo: 'sem transmissão aberta' });
  assert.equal(lerPaginaAoVivo(pagina({ playabilityStatus: { status: 'OK' }, videoDetails: video({}) }), CANAL).situacao, 'fora', 'gravação de transmissão encerrada');
  assert.equal(lerPaginaAoVivo(pagina({ playabilityStatus: { status: 'OK', playableInEmbed: false }, videoDetails: video({ isLive: true }) }), CANAL).situacao, 'fora');
  assert.equal(lerPaginaAoVivo(pagina({ playabilityStatus: { status: 'LOGIN_REQUIRED' }, videoDetails: video({ isLive: true }) }), CANAL).situacao, 'fora');
});
test('tv: página que não é a do canal é erro, não "fora do ar"', () => {
  assert.throws(() => lerPaginaAoVivo('<html><head><title>Antes de continuar</title></head><body></body></html>', CANAL), /inesperada: Antes de continuar/);
  assert.throws(() => lerPaginaAoVivo(pagina({ playabilityStatus: { status: 'LOGIN_REQUIRED', reason: 'Faça login' }, videoDetails: {} }), CANAL), /sem dados do vídeo: LOGIN_REQUIRED Faça login/);
  assert.throws(() => lerPaginaAoVivo(pagina({ playabilityStatus: { status: 'OK' }, videoDetails: video({ isLive: true, channelId: 'UCbbbbbbbbbbbbbbbbbbbbbb' }) }), CANAL), /outro canal/);
  assert.throws(() => lerPaginaAoVivo('<script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"abc', CANAL), /incompletos/);
});
