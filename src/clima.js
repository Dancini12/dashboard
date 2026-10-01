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

// Consulta ao Open-Meteo usada pela aba Clima e pelo resumo da página inicial: 92 dias passados,
// 16 de previsão e a umidade do solo em três profundidades.
export const SANTA_MARIANA = { nome: "Santa Mariana, Paraná", latitude: -23.15, longitude: -50.52 };
const DIAS_PASSADOS = 92;
const CAMADAS = [["soil_moisture_0_to_7cm", "0 a 7 cm", "onde a semente germina"], ["soil_moisture_7_to_28cm", "7 a 28 cm", "onde está a maior parte das raízes"], ["soil_moisture_28_to_100cm", "28 a 100 cm", "reserva para os dias secos"]];

export async function buscarClima({ latitude, longitude }) {
  const parametros = new URLSearchParams({
    latitude, longitude, timezone: "America/Sao_Paulo", past_days: DIAS_PASSADOS, forecast_days: 16,
    daily: "precipitation_sum,temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration,precipitation_probability_max,weather_code",
    hourly: CAMADAS.map(([chave]) => chave).join(","),
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${parametros}`, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error("indisponível");
  const { daily, hourly } = await response.json();
  const dias = daily.time.map((data, i) => ({
    data, chuva: daily.precipitation_sum[i], et0: daily.et0_fao_evapotranspiration[i], maxima: daily.temperature_2m_max[i],
    minima: daily.temperature_2m_min[i], probabilidade: daily.precipitation_probability_max[i], tempo: daily.weather_code[i],
  }));
  const hoje = dias[DIAS_PASSADOS].data;
  // umidade do solo: a leitura mais recente até agora e a de 7 dias antes
  const agora = `${hoje}T${String(new Date().getHours()).padStart(2, "0")}:00`;
  const iAgora = Math.max(0, hourly.time.findLastIndex(t => t <= agora));
  const solo = CAMADAS.map(([chave, camada, papel]) => ({ camada, papel, agora: hourly[chave][iAgora], semanaPassada: hourly[chave][Math.max(0, iAgora - 7 * 24)] }));
  return { dias, hoje, solo };
}
