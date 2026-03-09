import React, { useEffect, useMemo, useState } from "react";
import { Geo, Profile } from "../api.js";
import { useUser } from "../experience/UserContext.jsx";
import { useToast } from "../components/ToastProvider.jsx";

function toInputNumber(value) {
  if (value === null || value === undefined) return "";
  if (Number.isNaN(value)) return "";
  return String(value);
}

function kmToMiles(km) {
  if (typeof km !== "number") return null;
  return km * 0.621371;
}

function milesToKm(miles) {
  if (typeof miles !== "number") return null;
  return miles / 0.621371;
}

function roundTo(value, decimals = 1) {
  if (typeof value !== "number") return value;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatStat(value) {
  if (typeof value === "number") return value;
  return "--";
}

export default function ProfilePage() {
  const { user, loadingUser, refreshUser } = useUser();
  const toast = useToast();
  const [form, setForm] = useState({
    displayName: "",
    location: "",
    bio: "",
    interests: "",
    zip: "",
    radiusMiles: "",
    latitude: "",
    longitude: "",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [geoStatus, setGeoStatus] = useState("");

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      displayName: user.displayName || "",
      location: user.location || "",
      bio: user.bio || "",
      interests: user.interests || "",
      zip: user.zip || "",
      radiusMiles: toInputNumber(roundTo(kmToMiles(user.radiusKm))),
      latitude: toInputNumber(user.latitude),
      longitude: toInputNumber(user.longitude),
    }));
    if (user.latitude !== null || user.longitude !== null) {
      setShowAdvanced(true);
    }
  }, [user]);

  useEffect(() => {
    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const data = await Profile.me();
        const profile = data.profile || {};
        setForm({
          displayName: profile.displayName || "",
          location: profile.location || "",
          bio: profile.bio || "",
          interests: profile.interests || "",
          zip: profile.zip || "",
          radiusMiles: toInputNumber(roundTo(kmToMiles(profile.radiusKm))),
          latitude: toInputNumber(profile.latitude),
          longitude: toInputNumber(profile.longitude),
        });
        if (profile.latitude !== null || profile.longitude !== null) {
          setShowAdvanced(true);
        }
        setStats(data.stats || null);
      } catch (e) {
        const message = e.message || "Failed to load profile";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, toast]);

  const statSummary = useMemo(() => ({
    have: stats?.haveCount,
    need: stats?.needCount,
    trades: stats?.tradeCount,
    pending: stats?.pendingTradeCount,
  }), [stats]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    setGeoStatus("");
    try {
      const payload = {
        displayName: form.displayName,
        location: form.location,
        bio: form.bio,
        interests: form.interests,
        zip: form.zip || null,
        radiusKm: form.radiusMiles === ""
          ? null
          : Math.round(milesToKm(Number(form.radiusMiles))),
        latitude: form.latitude === "" ? null : Number(form.latitude),
        longitude: form.longitude === "" ? null : Number(form.longitude),
      };
      const result = await Profile.update(payload);
      await refreshUser();
      setSuccess("Profile updated");
      toast.success("Profile updated.");
      if (result?.geo?.applied) {
        setGeoStatus("Coordinates updated from your zip.");
      } else if (result?.geo && result.geo.applied === false) {
        setGeoStatus("Zip lookup failed. Add coordinates manually.");
      }
    } catch (e) {
      const message = e.message || "Could not update profile";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLookup() {
    setError("");
    setGeoStatus("");
    if (!form.zip.trim()) {
      const message = "Enter a zip code first.";
      setError(message);
      toast.error(message);
      return;
    }
    try {
      const result = await Geo.lookup(form.zip.trim());
      setForm((prev) => ({
        ...prev,
        latitude: String(result.latitude),
        longitude: String(result.longitude),
      }));
      setGeoStatus("Coordinates filled from zip lookup.");
      toast.success("Coordinates updated from zip.");
    } catch (e) {
      const message = e.message || "Zip lookup failed";
      setError(message);
      toast.error(message);
    }
  }

  if (loadingUser) {
    return (
      <div className="page">
        <div className="card">
          <h2>Profile</h2>
          <p className="muted">Checking your session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <div className="card">
          <h2>Profile</h2>
          <p className="muted">Log in to edit your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-hero">
        <div className="page-title">
          <h2 style={{ margin: 0 }}>Profile</h2>
          <span className="pill pill-ghost">Social & garden info</span>
        </div>
        <div className="page-actions">
          <button type="submit" form="profile-form" disabled={saving}>
            {saving ? "Saving..." : "Save profile"}
          </button>
        </div>
      </div>
      <p className="muted" style={{ marginTop: 4, marginBottom: 12 }}>
        Share who you are, what you grow, and how to trade with you.
      </p>

      {error && (
        <p className="error" role="alert">
          Error: {error}
        </p>
      )}
      {success && <p className="success">{success}</p>}
      {geoStatus && <p className="muted">{geoStatus}</p>}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Have Items</div>
          <div className="stat-value">{formatStat(statSummary.have)}</div>
          <div className="stat-meta muted">Listed for trade</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Need Items</div>
          <div className="stat-value">{formatStat(statSummary.need)}</div>
          <div className="stat-meta muted">What you are seeking</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Trades</div>
          <div className="stat-value">{formatStat(statSummary.trades)}</div>
          <div className="stat-meta muted">Completed + active</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending</div>
          <div className="stat-value">{formatStat(statSummary.pending)}</div>
          <div className="stat-meta muted">Awaiting response</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <form id="profile-form" className="stack" onSubmit={handleSave}>
          <label>
            Display name
            <input
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder="Pat the Pepper Grower"
            />
          </label>

          <label>
            Location
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Austin, TX (78701)"
            />
          </label>

          <label>
            Zip / postal code
            <input
              value={form.zip}
              onChange={(e) => setForm({ ...form, zip: e.target.value })}
              placeholder="78701"
            />
          </label>
          <div>
            <button type="button" className="secondary" onClick={handleLookup}>
              Lookup coordinates
            </button>
          </div>

          <label>
            Trading radius (miles)
            <input
              type="number"
              min={1}
              max={500}
              step="0.1"
              value={form.radiusMiles}
              onChange={(e) => setForm({ ...form, radiusMiles: e.target.value })}
              placeholder="15"
            />
          </label>

          <div>
            <button
              type="button"
              className="secondary"
              onClick={() => setShowAdvanced((prev) => !prev)}
            >
              {showAdvanced ? "Hide advanced location" : "Show advanced location"}
            </button>
          </div>

          {showAdvanced && (
            <>
              <label>
                Latitude
                <input
                  type="number"
                  min={-90}
                  max={90}
                  step="0.0001"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  placeholder="30.2672"
                />
              </label>

              <label>
                Longitude
                <input
                  type="number"
                  min={-180}
                  max={180}
                  step="0.0001"
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  placeholder="-97.7431"
                />
              </label>
            </>
          )}

          <label>
            About you
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="What you grow, gardening style, pickup preferences..."
              rows={4}
            />
          </label>

          <label>
            Interests / crops
            <input
              value={form.interests}
              onChange={(e) => setForm({ ...form, interests: e.target.value })}
              placeholder="Peppers, tomatoes, pollinator plants"
            />
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save profile"}
            </button>
            <span className="muted" style={{ fontSize: 13 }}>
              Visible to matched neighbors when you propose or accept trades.
            </span>
          </div>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Your garden stats</h3>
        {loading && <p className="muted">Loading stats...</p>}
        {!loading && stats && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div className="pill pill-ghost">Have: {stats.haveCount}</div>
            <div className="pill pill-ghost">Need: {stats.needCount}</div>
            <div className="pill pill-ghost">Trades: {stats.tradeCount}</div>
            <div className="pill pill-ghost">Pending: {stats.pendingTradeCount}</div>
          </div>
        )}
        {!loading && !stats && <p className="muted">No stats yet.</p>}
      </div>
    </div>
  );
}
