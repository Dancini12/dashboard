// Tempo e clima: códigos do tempo (WMO) usados na previsão e as contas da aba Clima.

export const WMO = {
  0:  { label: "Céu limpo",            emoji: "☀️"  },
  1:  { label: "Principalmente limpo", emoji: "🌤️"  },
  2:  { label: "Parcialmente nublado", emoji: "⛅"  },
  3:  { label: "Nublado",              emoji: "☁️"  },
  45: { label: "Névoa",                emoji: "🌫️"  },
  48: { label: "Névoa com geada",      emoji: "🌫️"  },
  51: { label: "Garoa leve",           emoji: "🌦️"  },
  53: { label: "Garoa moderada",       emoji: "🌦️"  },
  55: { label: "Garoa intensa",        emoji: "🌦️"  },
  61: { label: "Chuva leve",           emoji: "🌧️"  },
  63: { label: "Chuva moderada",       emoji: "🌧️"  },
  65: { label: "Chuva forte",          emoji: "🌧️"  },
  71: { label: "Neve leve",            emoji: "🌨️"  },
  73: { label: "Neve moderada",        emoji: "🌨️"  },
  75: { label: "Neve forte",           emoji: "🌨️"  },
  80: { label: "Pancadas leves",       emoji: "🌦️"  },
  81: { label: "Pancadas moderadas",   emoji: "🌧️"  },
  82: { label: "Pancadas violentas",   emoji: "⛈️"  },
  95: { label: "Trovoada",             emoji: "⛈️"  },
  96: { label: "Trovoada c/ granizo",  emoji: "⛈️"  },
  99: { label: "Trovoada forte",       emoji: "⛈️"  },
};
export const getWmo = (code) => WMO[code] || { label: "Variável", emoji: "🌡️" };
export const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
// À noite, sol não combina: céu limpo vira lua e "parcialmente nublado" vira nuvem.
const EMOJI_DA_NOITE = { 0: "🌙", 1: "🌙", 2: "☁️" };
export const emojiDoTempo = (codigo, deDia = true) => (!deDia && EMOJI_DA_NOITE[codigo]) || getWmo(codigo).emoji;

const CHUVA_QUE_CONTA = 1; // mm: abaixo disso o dia conta como seco
const soma = valores => valores.reduce((total, v) => total + (v ?? 0), 0);

// dias: [{ data: 'AAAA-MM-DD', chuva, et0 }] em ordem; hoje: 'AAAA-MM-DD'.
// Os dias antes de hoje são o que já choveu; hoje e os seguintes, a previsão.
export function resumoDaChuva(dias, hoje) {
  const passados = dias.filter(d => d.data < hoje);
  const futuros = dias.filter(d => d.data >= hoje);
  const ultimos30 = passados.slice(-30);
  const ultimoComChuva = passados.findLastIndex(d => (d.chuva ?? 0) >= CHUVA_QUE_CONTA);
  return {
    ultimos7: soma(passados.slice(-7).map(d => d.chuva)),
    ultimos30: soma(ultimos30.map(d => d.chuva)),
    noMes: soma(passados.filter(d => d.data.slice(0, 7) === hoje.slice(0, 7)).map(d => d.chuva)),
    proximos7: soma(futuros.slice(0, 7).map(d => d.chuva)),
    proximos15: soma(futuros.slice(0, 15).map(d => d.chuva)),
    diasSemChuva: ultimoComChuva < 0 ? passados.length : passados.length - 1 - ultimoComChuva,
    evapotranspiracao30: soma(ultimos30.map(d => d.et0)),
  };
}

// Avisos da previsão: geada (mínima de 3 °C ou menos), calor forte (35 °C ou mais) e chuva forte (50 mm ou mais no dia).
export function avisosDaPrevisao(dias, hoje) {
  const futuros = dias.filter(d => d.data >= hoje);
  return {
    geada: futuros.filter(d => d.minima != null && d.minima <= 3),
    calor: futuros.filter(d => d.maxima != null && d.maxima >= 35),
    chuvaForte: futuros.filter(d => (d.chuva ?? 0) >= 50),
  };
}

// Um pedido ao Open-Meteo (previsão ou busca de cidade). O serviço às vezes responde "sobrecarregado"
// (503) por alguns segundos e aceita o mesmo pedido logo depois: insiste 4 vezes, com espera
// crescente (uns 9 segundos ao todo), antes de desistir.
const ESPERAS_DO_OPEN_METEO = [1000, 2500, 5000];
async function pedirAoOpenMeteo(url, prazo = 30000) {
  for (let tentativa = 0; ; tentativa++) {
    let erro;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(prazo) });
      if (response.ok) return await response.json();
      erro = new Error("indisponível");
    } catch (falha) { erro = falha; }
    if (tentativa >= ESPERAS_DO_OPEN_METEO.length) throw erro;
    await new Promise(seguir => setTimeout(seguir, ESPERAS_DO_OPEN_METEO[tentativa]));
  }
}

// Procura uma cidade pelo nome: { nome: "Londrina, Paraná", latitude, longitude }, ou null se não
// achar. "Londrina, Paraná" vale como "Londrina", porque o serviço procura só pelo nome.
export async function procurarCidade(texto) {
  const nome = texto.split(",")[0].trim();
  if (!nome) return null;
  const achado = (await pedirAoOpenMeteo(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nome)}&count=1&language=pt&format=json`, 15000)).results?.[0];
  return achado ? { nome: `${achado.name}${achado.admin1 ? `, ${achado.admin1}` : ""}`, latitude: achado.latitude, longitude: achado.longitude } : null;
}

// A cidade do Resumo do dia fica lembrada neste navegador, para o resumo abrir completo no dia seguinte.
const CIDADE_GUARDADA = "agroinfo_cidade";
export function cidadeGuardada() {
  try {
    const cidade = JSON.parse(localStorage.getItem(CIDADE_GUARDADA));
    return cidade && typeof cidade.nome === "string" && Number.isFinite(cidade.latitude) && Number.isFinite(cidade.longitude) ? cidade : null;
  } catch { return null; }
}
export function guardarCidade(cidade) {
  try { localStorage.setItem(CIDADE_GUARDADA, JSON.stringify(cidade)); } catch { /* sem armazenamento: vale só nesta visita */ }
}

// A última previsão que chegou também fica neste navegador. Enquanto for do dia, ela aparece na hora
// na visita seguinte e cobre os momentos em que o serviço de clima não responde.
const CLIMA_GUARDADO = "agroinfo_clima";
const lugarDe = ({ latitude, longitude }) => `${latitude},${longitude}`;
const dataDeHoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); // AAAA-MM-DD
export function climaGuardado(cidade) {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLIMA_GUARDADO));
    return guardado?.lugar === lugarDe(cidade) && guardado.dados?.hoje === dataDeHoje() && Array.isArray(guardado.dados.dias) ? guardado.dados : null;
  } catch { return null; }
}
function guardarClima(cidade, dados) {
  try { localStorage.setItem(CLIMA_GUARDADO, JSON.stringify({ lugar: lugarDe(cidade), dados })); } catch { /* sem armazenamento: vale só nesta visita */ }
}

const doOpenMeteo = parametros => pedirAoOpenMeteo(`https://api.open-meteo.com/v1/forecast?${parametros}`);

// Consulta ao Open-Meteo usada pela aba Clima, pelo Resumo do dia e pelo Jornal do dia: 92 dias
// passados, 16 de previsão e a umidade do solo em três profundidades.
const DIAS_PASSADOS = 92;
const CAMADAS = [["soil_moisture_0_to_7cm", "0 a 7 cm", "onde a semente germina"], ["soil_moisture_7_to_28cm", "7 a 28 cm", "onde está a maior parte das raízes"], ["soil_moisture_28_to_100cm", "28 a 100 cm", "reserva para os dias secos"]];

export async function buscarClima({ latitude, longitude }) {
  const parametros = new URLSearchParams({
    latitude, longitude, timezone: "America/Sao_Paulo", past_days: DIAS_PASSADOS, forecast_days: 16,
    daily: "precipitation_sum,temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration,precipitation_probability_max,weather_code",
    hourly: CAMADAS.map(([chave]) => chave).join(","),
  });
  const { daily, hourly } = await doOpenMeteo(parametros);
  const dias = daily.time.map((data, i) => ({
    data, chuva: daily.precipitation_sum[i], et0: daily.et0_fao_evapotranspiration[i], maxima: daily.temperature_2m_max[i],
    minima: daily.temperature_2m_min[i], probabilidade: daily.precipitation_probability_max[i], tempo: daily.weather_code[i],
  }));
  const hoje = dias[DIAS_PASSADOS].data;
  // umidade do solo: a leitura mais recente até agora e a de 7 dias antes
  const agora = `${hoje}T${String(new Date().getHours()).padStart(2, "0")}:00`;
  const iAgora = Math.max(0, hourly.time.findLastIndex(t => t <= agora));
  const solo = CAMADAS.map(([chave, camada, papel]) => ({ camada, papel, agora: hourly[chave][iAgora], semanaPassada: hourly[chave][Math.max(0, iAgora - 7 * 24)] }));
  const clima = { dias, hoje, solo };
  guardarClima({ latitude, longitude }, clima);
  return clima;
}

// Previsão hora a hora da aba Clima: o tempo de agora e os próximos 7 dias, de hora em hora.
const DIAS_POR_HORA = 7;
// horas: { 'AAAA-MM-DD': [{ hora: 'AAAA-MM-DDTHH:00', temperatura, chuva, probabilidade, tempo, vento, umidade, deDia }] }
export function lerPrevisao({ current, hourly }) {
  const horasPorDia = {};
  hourly.time.forEach((hora, i) => {
    (horasPorDia[hora.slice(0, 10)] ??= []).push({
      hora, temperatura: hourly.temperature_2m[i], chuva: hourly.precipitation[i], probabilidade: hourly.precipitation_probability[i],
      tempo: hourly.weather_code[i], vento: hourly.wind_speed_10m[i], umidade: hourly.relative_humidity_2m[i], deDia: hourly.is_day[i] === 1,
    });
  });
  return {
    agora: { hora: current.time, temperatura: current.temperature_2m, sensacao: current.apparent_temperature, umidade: current.relative_humidity_2m,
      vento: current.wind_speed_10m, tempo: current.weather_code, deDia: current.is_day === 1 },
    horasPorDia,
  };
}
export async function buscarPrevisao({ latitude, longitude }) {
  const parametros = new URLSearchParams({
    latitude, longitude, timezone: "America/Sao_Paulo", forecast_days: DIAS_POR_HORA,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day",
    hourly: "temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,relative_humidity_2m,is_day",
  });
  return lerPrevisao(await doOpenMeteo(parametros));
}

// Entre os tempos de um período, vale o que mais pesa no dia: trovoada, depois chuva e pancada (pela
// força), garoa, névoa e, por último, as nuvens. Os códigos já vêm quase nessa ordem; só as pancadas
// (80 a 82) precisam entrar junto das chuvas de mesma força.
const PESO_DAS_PANCADAS = { 80: 61.5, 81: 63.5, 82: 65.5 };
const pesoDoTempo = codigo => PESO_DAS_PANCADAS[codigo] ?? codigo;
const PERIODOS = [["Madrugada", 0], ["Manhã", 6], ["Tarde", 12], ["Noite", 18]];

// Horas de um dia → madrugada, manhã, tarde e noite, cada um com a temperatura mínima e máxima, a
// chuva somada, a maior chance de chuva, o vento mais forte e o tempo que mais pesa. Período sem
// nenhuma hora fica de fora.
export function periodosDoDia(horas) {
  return PERIODOS.map(([nome, inicio]) => {
    const doPeriodo = horas.filter(h => { const hora = Number(h.hora.slice(11, 13)); return hora >= inicio && hora < inicio + 6; });
    if (!doPeriodo.length) return null;
    const valores = campo => doPeriodo.map(h => h[campo]).filter(v => v != null);
    const maior = campo => (valores(campo).length ? Math.max(...valores(campo)) : null);
    return {
      nome, de: inicio, ate: inicio + 6,
      minima: valores("temperatura").length ? Math.min(...valores("temperatura")) : null, maxima: maior("temperatura"),
      chuva: soma(valores("chuva")), probabilidade: maior("probabilidade"), vento: maior("vento"),
      tempo: valores("tempo").reduce((a, b) => (pesoDoTempo(b) > pesoDoTempo(a) ? b : a), valores("tempo")[0] ?? null),
      deDia: doPeriodo.filter(h => h.deDia).length * 2 >= doPeriodo.length,
    };
  }).filter(Boolean);
}
