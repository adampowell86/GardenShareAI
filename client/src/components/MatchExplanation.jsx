import React, { useMemo } from "react";

export default function MatchExplanation({ score, breakdown = [], compact = false }) {
  const rows = useMemo(
    () => breakdown.filter((b) => b.label !== "Baseline compatibility"),
    [breakdown]
  );

  if (!rows.length && score === undefined) return null;

  const visible = compact ? rows.slice(0, 4) : rows;

  return (
    <div className={`match-explanation ${compact ? "compact" : ""}`}>
      <div className="match-explanation__header">
        <span className="pill">Score {score ?? "?"}</span>
        {!compact && <span className="muted" style={{ fontSize: 13 }}>Why this match is recommended</span>}
      </div>
      <ul className="list-plain match-explanation__list">
        {visible.map((item, idx) => (
          <li key={`${item.label}-${idx}`}>
            <span>{item.label}</span>
            <span className={item.delta >= 0 ? "delta-positive" : "delta-negative"}>
              {item.delta > 0 ? `+${item.delta}` : item.delta}
            </span>
          </li>
        ))}
      </ul>
      {!compact && rows.length > visible.length && (
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {rows.length - visible.length} additional signals
        </div>
      )}
    </div>
  );
}
