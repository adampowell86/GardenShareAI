import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Matching, Trades } from "../api.js";
import { useUser } from "../experience/UserContext.jsx";
import MatchExplanation from "../components/MatchExplanation.jsx";
import { useToast } from "../components/ToastProvider.jsx";

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function formatMiles(km) {
  if (typeof km !== "number") return null;
  const miles = km * 0.621371;
  return numberFormatter.format(miles);
}

export default function SuggestionsPage() {
  const { user, loadingUser, refreshUser } = useUser();
  const toast = useToast();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startingId, setStartingId] = useState("");
  const [meta, setMeta] = useState(null);
  const [lastLoaded, setLastLoaded] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("score");
  const [hidePending, setHidePending] = useState(false);
  const limit = 25;

  const loadSuggestions = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      if (!user) {
        setSuggestions([]);
        setMeta(null);
        return;
      }
      const data = await Matching.suggestions({ limit });
      if (Array.isArray(data)) {
        setSuggestions(data);
        setMeta({ returned: data.length, totalCandidates: data.length, offset: 0, limit: data.length });
      } else {
        setSuggestions(data?.suggestions || []);
        setMeta(data?.meta || null);
      }
      setLastLoaded(new Date());
    } catch (e) {
      const message = e.message || "Failed to load suggestions";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const filteredSuggestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    let result = suggestions;
    if (term) {
      result = result.filter((s) => {
        const otherName = s.otherUser?.displayName || "";
        return `${s.haveName} ${s.needName} ${otherName}`.toLowerCase().includes(term);
      });
    }
    if (hidePending) {
      result = result.filter((s) => s.status !== "PENDING_SENT");
    }
    if (sortBy === "score") {
      result = [...result].sort((a, b) => Number(b.score) - Number(a.score));
    } else if (sortBy === "distance") {
      result = [...result].sort((a, b) => {
        const distA = typeof a.distanceKm === "number" ? a.distanceKm : Infinity;
        const distB = typeof b.distanceKm === "number" ? b.distanceKm : Infinity;
        return distA - distB;
      });
    }
    return result;
  }, [suggestions, search, hidePending, sortBy]);

  const stats = useMemo(() => {
    const total = suggestions.length;
    const avgScore = total
      ? suggestions.reduce((sum, s) => sum + (Number(s.score) || 0), 0) / total
      : null;
    const distances = suggestions
      .map((s) => (typeof s.distanceKm === "number" ? s.distanceKm : null))
      .filter((value) => value !== null);
    const closestKm = distances.length ? Math.min(...distances) : null;
    const pendingCount = suggestions.filter((s) => s.status === "PENDING_SENT").length;
    return {
      total,
      avgScore,
      closestKm,
      pendingCount,
    };
  }, [suggestions]);

  const hasFilters = Boolean(search.trim()) || hidePending || sortBy !== "score";
  const isRefreshing = loading && suggestions.length > 0;
  const totalCandidates = meta?.totalCandidates ?? suggestions.length;

  async function createTrade(s) {
    setStartingId(s.needItemId);
    setError("");
    try {
      await Trades.create(s.haveItemId, s.needItemId);
      setSuggestions((prev) =>
        prev.map((it) =>
          it.needItemId === s.needItemId && it.haveItemId === s.haveItemId
            ? { ...it, status: "PENDING_SENT" }
            : it
        )
      );
      refreshUser();
      toast.success("Trade request sent.");
    } catch (e) {
      const message = e.message || "Could not start trade";
      setError(message);
      toast.error(message);
    } finally {
      setStartingId("");
    }
  }

  function clearFilters() {
    setSearch("");
    setSortBy("score");
    setHidePending(false);
  }

  if (loadingUser) {
    return (
      <div className="page">
        <div className="card">
          <h2>Trade Suggestions</h2>
          <p className="muted">Checking your session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <div className="card">
          <h2>Trade Suggestions</h2>
          <p className="muted">Log in to see AI-powered matches.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-hero">
        <div className="page-title">
          <h2 style={{ margin: 0 }}>Trade Suggestions</h2>
          <span className="muted">Smart matches for your garden.</span>
        </div>
        <div className="page-actions">
          <button type="button" className="secondary" onClick={loadSuggestions} disabled={loading}>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <p className="error" role="alert">
          Error: {error}
        </p>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Matches</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-meta muted">{stats.pendingCount} pending requests</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Score</div>
          <div className="stat-value">
            {stats.avgScore !== null ? numberFormatter.format(stats.avgScore) : "--"}
          </div>
          <div className="stat-meta muted">Across visible matches</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Closest</div>
          <div className="stat-value">{stats.closestKm !== null ? `${formatMiles(stats.closestKm)} mi` : "--"}</div>
          <div className="stat-meta muted">Nearest match distance</div>
        </div>
      </div>

      <div className="card toolbar-card">
        <div className="toolbar-row">
          <label className="grow">
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by have, need, or neighbor"
            />
          </label>
          <label>
            Sort
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="score">Best score</option>
              <option value="distance">Closest distance</option>
            </select>
          </label>
          <div className="toolbar-row">
            <button
              type="button"
              className={`pill-toggle ${hidePending ? "active" : ""}`}
              aria-pressed={hidePending}
              onClick={() => setHidePending((prev) => !prev)}
            >
              Hide pending
            </button>
            <button type="button" className="ghost" onClick={clearFilters} disabled={!hasFilters}>
              Reset
            </button>
          </div>
        </div>
        <div className="toolbar-summary">
          <span>
            Showing {filteredSuggestions.length} of {totalCandidates} matches
          </span>
          <span>
            {isRefreshing && "Refreshing..."}
            {!isRefreshing && lastLoaded && `Updated ${lastLoaded.toLocaleString()}`}
          </span>
        </div>
      </div>

      {loading && suggestions.length === 0 && <p className="muted">Loading smart matches...</p>}

      <ul className="list-plain" style={{ marginTop: 12 }}>
        {!loading && suggestions.length === 0 && (
          <li className="card">
            <h3>No matches yet</h3>
            <p className="muted">Add more HAVE items to see suggestions.</p>
          </li>
        )}
        {!loading && suggestions.length > 0 && filteredSuggestions.length === 0 && (
          <li className="card">
            <h3>No matches</h3>
            <p className="muted">Try clearing your filters or adjusting the search term.</p>
          </li>
        )}
        {filteredSuggestions.map((s, idx) => (
          <li key={idx} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span className="pill">Score {s.score}</span>
              {s.status === "PENDING_SENT" && <span className="pill pill-ghost">Pending</span>}
            </div>
            <div><b>You have:</b> {s.haveName} (qty {s.haveQty})</div>
            <div><b>They need:</b> {s.needName} (qty {s.needQty})</div>
            {typeof s.distanceKm === "number" && (
              <div>
                <b>Distance:</b> {formatMiles(s.distanceKm)} mi ({numberFormatter.format(s.distanceKm)} km)
              </div>
            )}
            {s.otherUser && (
              <div style={{ marginTop: 8 }} className="card">
                <div style={{ fontWeight: 700 }}>
                  {s.otherUser.displayName || "Neighbor gardener"}
                </div>
                {s.otherUser.location && (
                  <div className="muted" style={{ fontSize: 13 }}>
                    {s.otherUser.location}
                  </div>
                )}
                {s.otherUser.bio && (
                  <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                    {s.otherUser.bio}
                  </div>
                )}
              </div>
            )}
            {s.reasons && s.reasons.length > 0 && (
              <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                Signals: {s.reasons.slice(0, 3).join(" | ")}
              </div>
            )}
            <MatchExplanation score={s.score} breakdown={s.breakdown || []} />
            {s.status === "PENDING_SENT" && (
              <div className="success" style={{ marginTop: 8 }}>
                Trade request sent. Check Trades for updates.
              </div>
            )}
            <button
              style={{ marginTop: 12 }}
              onClick={() => createTrade(s)}
              disabled={startingId === s.needItemId || s.status === "PENDING_SENT"}
            >
              {startingId === s.needItemId ? "Sending..." : s.status === "PENDING_SENT" ? "Request Sent" : "Start Trade"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
