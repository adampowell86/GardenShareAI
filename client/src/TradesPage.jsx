import React, { useEffect, useState } from "react";
import { Trades, emitInventoryChanged } from "./api.js";
import MatchExplanation from "./components/MatchExplanation.jsx";
import { useUser } from "./experience/UserContext.jsx";

function statusColor(status) {
  switch (status) {
    case "ACCEPTED":
      return "var(--forest)";
    case "REJECTED":
    case "CANCELLED":
      return "var(--terracotta)";
    case "PENDING":
    default:
      return "#b8860b";
  }
}

function TradeCard({ trade, updatingId, onAction }) {
  const isIncoming = !trade.initiatedByYou;

  return (
    <li className="card" style={{ marginTop: 10 }}>
      <div style={{ marginBottom: 6 }}>
        <strong>Trade:</strong> {trade.haveItemName} for {trade.needItemName}
      </div>
      <div style={{ marginBottom: 4 }}>
        <strong>Your role:</strong>{" "}
        {trade.role === "you-have" ? "You are the giver (HAVE)" : "You are the receiver (NEED)"}
      </div>
      <div style={{ marginBottom: 4 }}>
        <strong>Other gardener:</strong>{" "}
        <span>{trade.otherUserEmail || "Unknown"}</span>
      </div>
      <div style={{ marginBottom: 8 }}>
        <strong>Status:</strong>{" "}
        <span style={{ color: statusColor(trade.status) }}>{trade.status}</span>
      </div>
      {trade.insights?.highlights && trade.insights.highlights.length > 0 && (
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
          Signals: {trade.insights.highlights.slice(0, 3).join(" | ")}
        </div>
      )}

      {trade.insights && (
        <MatchExplanation
          score={trade.insights.score}
          breakdown={trade.insights.breakdown || []}
          compact
        />
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {isIncoming && trade.status === "PENDING" && (
          <button
            disabled={updatingId === trade.id}
            onClick={() => onAction(trade.id, "ACCEPTED")}
          >
            {updatingId === trade.id ? "Updating..." : "Accept"}
          </button>
        )}
        {isIncoming && trade.status === "PENDING" && (
          <button
            disabled={updatingId === trade.id}
            className="secondary"
            style={{ color: "var(--terracotta)", borderColor: "var(--terracotta)" }}
            onClick={() => onAction(trade.id, "REJECTED")}
          >
            Reject
          </button>
        )}
        {trade.initiatedByYou && trade.status === "PENDING" && (
          <button
            disabled={updatingId === trade.id}
            className="secondary"
            onClick={() => onAction(trade.id, "CANCELLED")}
          >
            Cancel
          </button>
        )}
      </div>
    </li>
  );
}

export default function TradesPage() {
  const { user, loadingUser, refreshUser } = useUser();
  const [trades, setTrades] = useState([]);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadTrades({ silent = false } = {}) {
    if (!silent) {
      setError("");
      setLoading(true);
    }
    try {
      const data = await Trades.list();
      setTrades(data);
    } catch (e) {
      setError(e.message || "Failed to load trades");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      loadTrades();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    const id = setInterval(() => {
      loadTrades({ silent: true });
    }, 5000);
    return () => clearInterval(id);
  }, [user]);

  async function changeStatus(id, action) {
    setUpdatingId(id);
    setError("");
    try {
      let updated;
      if (action === "ACCEPTED") updated = await Trades.accept(id);
      else if (action === "REJECTED") updated = await Trades.reject(id);
      else updated = await Trades.cancel(id);

      setTrades((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
      refreshUser();
      if (action === "ACCEPTED") {
        emitInventoryChanged();
      }
    } catch (e) {
      setError(e.message || "Failed to update trade");
    } finally {
      setUpdatingId(null);
    }
  }

  const outgoing = trades.filter((t) => t.initiatedByYou);
  const incoming = trades.filter((t) => !t.initiatedByYou);

  if (loadingUser) {
    return (
      <div className="page">
        <div className="card">
          <h2>Your Trades</h2>
          <p className="muted">Checking your session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <div className="card">
          <h2>Your Trades</h2>
          <p className="muted">Log in to track and respond to trades.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h2>Your Trades</h2>
      <p className="muted" style={{ marginBottom: "0.75rem" }}>
        Track trades you've started or that involve your garden.
      </p>

      {error && <p className="error">Error: {error}</p>}
      {loading && <p className="muted">Loading trades...</p>}

      {trades.length === 0 && !error && !loading && (
        <p className="muted">No trades yet. Try creating one from the Suggestions tab.</p>
      )}

      <ul className="list-plain">
        {incoming.length > 0 && <li style={{ fontWeight: 700, marginTop: 8 }}>Incoming trades</li>}
        {incoming.map((t) => (
          <TradeCard key={t.id} trade={t} updatingId={updatingId} onAction={changeStatus} />
        ))}
        {outgoing.length > 0 && <li style={{ fontWeight: 700, marginTop: 18 }}>Outgoing trades</li>}
        {outgoing.map((t) => (
          <TradeCard key={t.id} trade={t} updatingId={updatingId} onAction={changeStatus} />
        ))}
      </ul>
    </div>
  );
}
