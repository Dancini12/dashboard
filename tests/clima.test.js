import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumoDaChuva, avisosDaPrevisao, lerPrevisao, periodosDoDia, emojiDoTempo } from '../src/clima.js';

const dia = (data, chuva, extra = {}) => ({ data, chuva, et0: 4, ...extra });

test('clima: chuva acumulada antes de hoje e prevista de hoje em diante', () => {
  const dias = [
    dia('2026-09-20', 12), dia('2026-09-28', 30), dia('2026-09-29', 0.4), dia('2026-09-30', 0),
    dia('2026-10-01', 5), dia('2026-10-02', 0), dia('2026-10-03', 0.2),
    dia('2026-10-04', 8), dia('2026-10-05', null), dia('2026-10-06', 20),
  ];
  const r = resumoDaChuva(dias, '2026-10-04');
  assert.equal(r.ultimos7.toFixed(1), '47.6');
  assert.equal(r.ultimos30.toFixed(1), '47.6');
  assert.equal(r.noMes.toFixed(1), '5.2', 'só os dias de outubro antes de hoje');
  assert.equal(r.proximos7, 28);
  assert.equal(r.diasSemChuva, 2, 'dias 2 e 3 de outubro: 0,2 mm não conta como chuva');
  assert.equal(r.evapotranspiracao30, 28);
});
test('clima: sem nenhuma chuva no período, todos os dias contam como secos', () => {
  assert.equal(resumoDaChuva([dia('2026-10-01', 0), dia('2026-10-02', 0.5)], '2026-10-03').diasSemChuva, 2);
});
test('clima: avisos de geada, calor e chuva forte só olham a previsão', () => {
  const dias = [
    dia('2026-07-01', 80, { minima: 1, maxima: 12 }), // já passou
    dia('2026-07-02', 0, { minima: 2.5, maxima: 15 }), dia('2026-07-03', 55, { minima: 10, maxima: 36 }), dia('2026-07-04', 0, { minima: 8, maxima: 22 }),
  ];
  const avisos = avisosDaPrevisao(dias, '2026-07-02');
  assert.deepEqual(avisos.geada.map(d => d.data), ['2026-07-02']);
  assert.deepEqual(avisos.calor.map(d => d.data), ['2026-07-03']);
  assert.deepEqual(avisos.chuvaForte.map(d => d.data), ['2026-07-03']);
});
test('clima: previsão por hora separada por dia, com o tempo de agora', () => {
  const horas = ['2026-10-09T22:00', '2026-10-09T23:00', '2026-10-10T00:00'];
  const r = lerPrevisao({
    current: { time: '2026-10-09T22:15', temperature_2m: 21.4, apparent_temperature: 22.9, relative_humidity_2m: 81, wind_speed_10m: 6.2, weather_code: 2, is_day: 0 },
    hourly: { time: horas, temperature_2m: [21, 20, 19], precipitation: [0, 0.4, 1.2], precipitation_probability: [10, 40, 70], weather_code: [2, 61, 63], wind_speed_10m: [6, 8, 12], relative_humidity_2m: [80, 85, 90], is_day: [0, 0, 0] },
  });
  assert.deepEqual(r.agora, { hora: '2026-10-09T22:15', temperatura: 21.4, sensacao: 22.9, umidade: 81, vento: 6.2, tempo: 2, deDia: false });
  assert.deepEqual(Object.keys(r.horasPorDia), ['2026-10-09', '2026-10-10']);
  assert.deepEqual(r.horasPorDia['2026-10-10'], [{ hora: '2026-10-10T00:00', temperatura: 19, chuva: 1.2, probabilidade: 70, tempo: 63, vento: 12, umidade: 90, deDia: false }]);
});
test('clima: o dia dividido em madrugada, manhã, tarde e noite', () => {
  const hora = (h, temperatura, chuva, probabilidade, tempo, deDia) => ({ hora: `2026-10-10T${String(h).padStart(2, '0')}:00`, temperatura, chuva, probabilidade, tempo, vento: h, umidade: 60, deDia });
  const dia = [
    hora(0, 18, 0, 5, 0, false), hora(5, 16, 0, 10, 1, false),
    hora(6, 17, 0, 10, 2, true), hora(11, 25, 0, null, 3, true),
    hora(12, 28, 2.5, 60, 80, true), hora(15, 30, 6, 90, 65, true), hora(17, 26, 0.5, 70, 95, true), // pancada leve, chuva forte e trovoada
  ];
  const [madrugada, manha, tarde, ...resto] = periodosDoDia(dia);
  assert.deepEqual(resto, [], 'sem horas da noite, a noite não aparece');
  assert.deepEqual(madrugada, { nome: 'Madrugada', de: 0, ate: 6, minima: 16, maxima: 18, chuva: 0, probabilidade: 10, vento: 5, tempo: 1, deDia: false });
  assert.deepEqual([manha.minima, manha.maxima, manha.probabilidade, manha.tempo, manha.deDia], [17, 25, 10, 3, true], 'chance de chuva sem valor não conta');
  assert.deepEqual([tarde.chuva, tarde.probabilidade, tarde.vento, tarde.tempo], [9, 90, 17, 95], 'a trovoada pesa mais que a chuva');
  assert.equal(periodosDoDia([hora(13, 28, 1, 50, 80, true), hora(14, 28, 5, 80, 65, true)])[0].tempo, 65, 'chuva forte pesa mais que pancada leve');
  assert.deepEqual(periodosDoDia([]), []);
});
test('clima: à noite o céu limpo não mostra sol', () => {
  assert.equal(emojiDoTempo(0), '☀️'); assert.equal(emojiDoTempo(0, false), '🌙'); assert.equal(emojiDoTempo(2, false), '☁️');
  assert.equal(emojiDoTempo(63, false), '🌧️', 'chuva é igual de dia e de noite');
});
