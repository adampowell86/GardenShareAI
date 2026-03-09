import fetch from "node-fetch";

const DEFAULT_BASE = "https://api.zippopotam.us";
const DEFAULT_COUNTRY = "us";

export async function lookupZip(zip) {
  if (!zip) return null;
  const base = process.env.GEO_API_BASE || DEFAULT_BASE;
  const country = process.env.GEO_DEFAULT_COUNTRY || DEFAULT_COUNTRY;
  const url = `${base.replace(/\/$/, "")}/${country}/${encodeURIComponent(zip)}`;

  const res = await fetch(url, { headers: { "User-Agent": "GardenShareAI/1.0" } });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data || !Array.isArray(data.places) || data.places.length === 0) return null;

  const place = data.places[0];
  const latitude = Number.parseFloat(place.latitude);
  const longitude = Number.parseFloat(place.longitude);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;

  return {
    latitude,
    longitude,
    city: place["place name"] || null,
    state: place["state"] || null,
    country: data["country"] || null,
  };
}
