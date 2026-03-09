import fetch from "node-fetch";

const DEFAULT_WEATHER_BASE = "https://api.open-meteo.com/v1/forecast";

export async function fetchFrostForecast({ latitude, longitude }) {
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;

  const base = process.env.WEATHER_API_BASE || DEFAULT_WEATHER_BASE;
  const url = new URL(base);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("daily", "temperature_2m_min");
  url.searchParams.set("forecast_days", "10");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url.toString(), { headers: { "User-Agent": "GardenShareAI/1.0" } });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const temps = data?.daily?.temperature_2m_min;
  const dates = data?.daily?.time;
  if (!Array.isArray(temps) || temps.length === 0) return null;

  const threshold = Number.parseFloat(process.env.WEATHER_FROST_TEMP_C ?? "2");
  let coldest = null;
  let coldestDate = null;

  temps.forEach((temp, idx) => {
    if (typeof temp !== "number") return;
    if (coldest === null || temp < coldest) {
      coldest = temp;
      coldestDate = Array.isArray(dates) ? dates[idx] : null;
    }
  });

  if (coldest === null) return null;

  return {
    minTempC: coldest,
    minDate: coldestDate,
    frostLikely: coldest <= threshold,
    thresholdC: threshold,
  };
}
