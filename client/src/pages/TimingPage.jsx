import React, { useEffect, useState } from "react";
import { Timing } from "../api.js";
import { useUser } from "../experience/UserContext.jsx";

export default function TimingPage() {
  const { user, loadingUser } = useUser();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!user) {
        setData(null);
        setLoading(false);
        return;
      }
      setError("");
      setLoading(true);
      try {
        const payload = await Timing.flags();
        setData(payload);
      } catch (e) {
        setError(e.message || "Failed to load timing flags");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  if (loadingUser) {
    return (
      <div className="page">
        <div className="card">
          <h2>Timing Advisor</h2>
          <p className="muted">Checking your session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <div className="card">
          <h2>Timing Advisor</h2>
          <p className="muted">Log in to view planting and harvest timing.</p>
        </div>
      </div>
    );
  }

  const flags = data?.flags || [];
  const flaggedItems = flags.filter((item) => item.flags.length > 0);
  const zone = data?.meta?.zone;
  const forecast = data?.meta?.forecast;
  const forecastF = typeof forecast?.minTempC === "number"
    ? Math.round((forecast.minTempC * 9) / 5 + 32)
    : null;

  return (
    <div className="page">
      <h2>Timing Advisor</h2>
      <p className="muted" style={{ marginBottom: "0.75rem" }}>
        Season-aware hints based on your current inventory.
      </p>
      {(zone || forecast) && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            {zone && <span className="pill pill-ghost">Zone {zone}</span>}
            {forecast && (
              <span className="muted">
                Forecast low: {forecastF !== null ? `${forecastF}F` : `${forecast.minTempC}C`}
                {forecastF !== null ? ` (${forecast.minTempC}C)` : ""}
                {forecast.minDate ? ` on ${forecast.minDate}` : ""}
              </span>
            )}
          </div>
        </div>
      )}

      {error && <p className="error">Error: {error}</p>}
      {loading && <p className="muted">Loading timing flags...</p>}

      {!loading && flaggedItems.length === 0 && (
        <p className="muted">No timing flags yet. Add more items or plant metadata.</p>
      )}

      <ul className="list-plain">
        {flags.map((item) => (
          <li key={item.itemId} className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <strong>{item.name}</strong>
              <span className="pill pill-ghost">{item.status}</span>
              <span className="muted">Qty {item.qty}</span>
            </div>
            {item.plant && (
              <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                Plant profile: {item.plant.commonName}
                {item.plant.season ? ` | ${item.plant.season}` : ""}
                {item.plant.daysToMaturity ? ` | ${item.plant.daysToMaturity} days` : ""}
              </div>
            )}
            {item.flags.length > 0 ? (
              <ul className="list-plain" style={{ marginTop: 8 }}>
                {item.flags.map((flag, idx) => (
                  <li key={`${item.itemId}-${idx}`} className="muted">
                    <strong>{flag.type}</strong>
                    {flag.detail ? ` - ${flag.detail}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="muted" style={{ marginTop: 8 }}>
                No timing flags for this item yet.
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

