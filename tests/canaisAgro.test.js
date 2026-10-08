import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CANAIS_AGRO, urlAoVivo, urlNoYouTube, urlRecentes } from '../src/canaisAgro.js';

test('tv agro: todo canal tem os campos da aba, sem id repetido e com site em https', () => {
  assert.equal(new Set(CANAIS_AGRO.map(c => c.id)).size, CANAIS_AGRO.length);
  for (const canal of CANAIS_AGRO) {
    assert.deepEqual(Object.keys(canal).filter(campo => campo !== 'videoIdAoVivo').sort(), ['channelId', 'descricao', 'id', 'nome', 'playlistId', 'siteUrl']);
    if ('videoIdAoVivo' in canal) assert.match(canal.videoIdAoVivo, /^[\w-]{11}$/, `${canal.id}: código de vídeo do YouTube`);
    assert.ok(canal.nome && canal.descricao, canal.id);
    assert.match(canal.siteUrl, /^https:\/\//, canal.id);
  }
  assert.ok(CANAIS_AGRO.some(c => c.channelId), 'pelo menos um canal para assistir');
});
test('tv agro: ID do YouTube no formato certo, ou os dois campos vazios', () => {
  for (const canal of CANAIS_AGRO) {
    if (!canal.channelId) { assert.equal(canal.playlistId, '', canal.id); continue; }
    assert.match(canal.channelId, /^UC[\w-]{22}$/, canal.id);
    assert.equal(canal.playlistId, `UULF${canal.channelId.slice(2)}`, `${canal.id}: a lista do plano B é a de envios do próprio canal`);
  }
  const ids = CANAIS_AGRO.map(c => c.channelId).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length, 'dois canais com o mesmo ID');
});
test('tv agro: endereços do player oficial do YouTube', () => {
  const canal = { channelId: 'UCaaaaaaaaaaaaaaaaaaaaaa', playlistId: 'UULFaaaaaaaaaaaaaaaaaaaaaa' };
  assert.equal(urlAoVivo(canal), 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(urlRecentes(canal), 'https://www.youtube-nocookie.com/embed/videoseries?list=UULFaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(urlNoYouTube(canal), 'https://www.youtube.com/channel/UCaaaaaaaaaaaaaaaaaaaaaa/live');
  assert.equal(urlAoVivo({ ...canal, videoIdAoVivo: 'abcdefghijk' }), 'https://www.youtube-nocookie.com/embed/abcdefghijk', 'transmissão fixa tem preferência');
});
