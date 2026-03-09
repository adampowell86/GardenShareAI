import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plants } from "../api.js";
import { useUser } from "../experience/UserContext.jsx";
import { useToast } from "../components/ToastProvider.jsx";

const PAGE_SIZE = 50;
const MAX_NAME_LENGTH = 70;
const MAX_TAGS_LENGTH = 140;
const MAX_TEXT_LENGTH = 80;
const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function buildPlantPayload(values) {
  const commonName = values.commonName?.trim() || "";
  const tags = values.tags?.trim() || "";
  const season = values.season?.trim() || "";
  const frostSensitivity = values.frostSensitivity?.trim() || "";
  return {
    commonName: commonName || null,
    tags: tags || null,
    season: season || null,
    daysToMaturity: toNumber(values.daysToMaturity),
    frostSensitivity: frostSensitivity || null,
  };
}

function validatePlantForm(values) {
  const payload = buildPlantPayload(values);
  if (!payload.commonName) {
    return { isValid: false, message: "Common name is required.", payload };
  }
  if (payload.commonName.length < 2) {
    return { isValid: false, message: "Common name should be at least 2 characters.", payload };
  }
  if (payload.commonName.length > MAX_NAME_LENGTH) {
    return {
      isValid: false,
      message: `Common name should be ${MAX_NAME_LENGTH} characters or fewer.`,
      payload,
    };
  }
  if (payload.tags && payload.tags.length > MAX_TAGS_LENGTH) {
    return {
      isValid: false,
      message: `Tags should be ${MAX_TAGS_LENGTH} characters or fewer.`,
      payload,
    };
  }
  if (payload.season && payload.season.length > MAX_TEXT_LENGTH) {
    return {
      isValid: false,
      message: `Season should be ${MAX_TEXT_LENGTH} characters or fewer.`,
      payload,
    };
  }
  if (payload.frostSensitivity && payload.frostSensitivity.length > MAX_TEXT_LENGTH) {
    return {
      isValid: false,
      message: `Frost sensitivity should be ${MAX_TEXT_LENGTH} characters or fewer.`,
      payload,
    };
  }
  if (payload.daysToMaturity !== null && payload.daysToMaturity < 1) {
    return { isValid: false, message: "Days to maturity must be 1 or greater.", payload };
  }
  return { isValid: true, message: "", payload };
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "--";
  return numberFormatter.format(value);
}

export default function PlantsPage() {
  const { user, loadingUser } = useUser();
  const toast = useToast();
  const [plants, setPlants] = useState([]);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [filterWithSeason, setFilterWithSeason] = useState(false);
  const [filterWithMaturity, setFilterWithMaturity] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [lastLoaded, setLastLoaded] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [form, setForm] = useState({
    commonName: "",
    tags: "",
    season: "",
    daysToMaturity: "",
    frostSensitivity: "",
  });
  const [formAttempted, setFormAttempted] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState({
    commonName: "",
    tags: "",
    season: "",
    daysToMaturity: "",
    frostSensitivity: "",
  });
  const [editSnapshot, setEditSnapshot] = useState(null);
  const [editAttempted, setEditAttempted] = useState(false);

  const fetchPlants = useCallback(async ({ append = false, searchTerm = "", offsetOverride } = {}) => {
    if (append && loadingMore) return;
    const currentOffset = append ? (offsetOverride ?? offset) : 0;
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setHasMore(true);
      setOffset(0);
    }
    setError("");
    try {
      const data = await Plants.list({ q: searchTerm, limit: PAGE_SIZE, offset: currentOffset });
      const list = Array.isArray(data) ? data : data?.plants || [];
      setPlants((prev) => (append ? [...prev, ...list] : list));
      const nextOffset = currentOffset + list.length;
      setOffset(nextOffset);
      setHasMore(list.length === PAGE_SIZE);
      setLastLoaded(new Date());
      if (!append) setPendingDeleteId(null);
    } catch (e) {
      const message = e.message || "Failed to load plants";
      setError(message);
      toast.error(message);
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, [offset, loadingMore, toast]);

  useEffect(() => {
    if (!user) return;
    const handle = setTimeout(() => {
      fetchPlants({ append: false, searchTerm: query });
    }, 300);
    return () => clearTimeout(handle);
  }, [user, query, fetchPlants]);

  const addValidation = useMemo(() => validatePlantForm(form), [form]);
  const editValidation = useMemo(() => {
    if (!editingId) return { isValid: true, message: "", payload: null };
    return validatePlantForm(editForm);
  }, [editForm, editingId]);

  const hasEditChanges = useMemo(() => {
    if (!editSnapshot) return false;
    return (
      editForm.commonName !== editSnapshot.commonName ||
      editForm.tags !== editSnapshot.tags ||
      editForm.season !== editSnapshot.season ||
      String(editForm.daysToMaturity) !== String(editSnapshot.daysToMaturity) ||
      editForm.frostSensitivity !== editSnapshot.frostSensitivity
    );
  }, [editForm, editSnapshot]);

  const filteredPlants = useMemo(() => {
    const term = query.trim().toLowerCase();
    let result = plants;
    if (term) {
      result = result.filter((plant) => {
        const name = plant.commonName || "";
        const tags = plant.tags || "";
        const season = plant.season || "";
        const frost = plant.frostSensitivity || "";
        return `${name} ${tags} ${season} ${frost}`.toLowerCase().includes(term);
      });
    }
    if (filterWithSeason) {
      result = result.filter((plant) => plant.season);
    }
    if (filterWithMaturity) {
      result = result.filter((plant) => {
        const days = Number(plant.daysToMaturity);
        return Number.isFinite(days) && days > 0;
      });
    }
    if (sortBy !== "recent") {
      result = [...result].sort((a, b) => {
        if (sortBy === "name") {
          const nameA = a.commonName || "";
          const nameB = b.commonName || "";
          if (!nameA) return 1;
          if (!nameB) return -1;
          return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
        }
        if (sortBy === "season") {
          const seasonA = a.season || "";
          const seasonB = b.season || "";
          if (!seasonA) return 1;
          if (!seasonB) return -1;
          return seasonA.localeCompare(seasonB, undefined, { sensitivity: "base" });
        }
        if (sortBy === "maturity") {
          const daysA = Number.isFinite(Number(a.daysToMaturity)) ? Number(a.daysToMaturity) : Infinity;
          const daysB = Number.isFinite(Number(b.daysToMaturity)) ? Number(b.daysToMaturity) : Infinity;
          return daysA - daysB;
        }
        return 0;
      });
    }
    return result;
  }, [plants, query, filterWithSeason, filterWithMaturity, sortBy]);

  const stats = useMemo(() => {
    let totalDays = 0;
    let maturityCount = 0;
    let withFrost = 0;
    const seasons = new Set();
    plants.forEach((plant) => {
      const season = typeof plant.season === "string" ? plant.season.trim() : "";
      if (season) seasons.add(season);
      const days = Number(plant.daysToMaturity);
      if (Number.isFinite(days)) {
        totalDays += days;
        maturityCount += 1;
      }
      if (plant.frostSensitivity) withFrost += 1;
    });
    const avgMaturity = maturityCount ? totalDays / maturityCount : null;
    return {
      totalPlants: plants.length,
      seasonsCount: seasons.size,
      avgMaturity,
      withFrost,
    };
  }, [plants]);

  const showAddValidation =
    !addValidation.isValid &&
    (formAttempted || form.commonName || form.tags || form.season || form.daysToMaturity || form.frostSensitivity);
  const showEditValidation =
    !editValidation.isValid &&
    (editAttempted ||
      editForm.commonName ||
      editForm.tags ||
      editForm.season ||
      editForm.daysToMaturity ||
      editForm.frostSensitivity);
  const canSubmit = addValidation.isValid && !saving;
  const canSaveEdit = editValidation.isValid && hasEditChanges && !editSaving;
  const isRefreshing = loading && plants.length > 0 && !loadingMore;
  const hasFilters =
    Boolean(query.trim()) ||
    filterWithSeason ||
    filterWithMaturity ||
    sortBy !== "name";

  async function handleSubmit(e) {
    e.preventDefault();
    setFormAttempted(true);
    if (!addValidation.isValid) return;
    setError("");
    setSaving(true);
    try {
      const payload = addValidation.payload;
      const created = await Plants.create(payload);
      setPlants((prev) => [created, ...prev]);
      setForm({ commonName: "", tags: "", season: "", daysToMaturity: "", frostSensitivity: "" });
      setFormAttempted(false);
      toast.success("Plant added.");
    } catch (e) {
      const message = e.message || "Could not add plant";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(plant) {
    setEditingId(plant.id);
    const snapshot = {
      commonName: plant.commonName || "",
      tags: plant.tags || "",
      season: plant.season || "",
      daysToMaturity: plant.daysToMaturity ?? "",
      frostSensitivity: plant.frostSensitivity || "",
    };
    setEditSnapshot(snapshot);
    setEditForm(snapshot);
    setEditAttempted(false);
    setPendingDeleteId(null);
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editingId) return;
    setEditAttempted(true);
    if (!editValidation.isValid || !hasEditChanges) return;
    setError("");
    setEditSaving(true);
    try {
      const payload = editValidation.payload;
      const updated = await Plants.update(editingId, payload);
      setPlants((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
      setEditingId("");
      setEditSnapshot(null);
      toast.success("Plant updated.");
    } catch (e) {
      const message = e.message || "Could not update plant";
      setError(message);
      toast.error(message);
    } finally {
      setEditSaving(false);
    }
  }

  function cancelEdit() {
    setEditingId("");
    setEditSnapshot(null);
    setEditAttempted(false);
  }

  async function handleDelete(id) {
    setError("");
    try {
      setDeletingId(id);
      await Plants.delete(id);
      setPlants((prev) => prev.filter((p) => p.id !== id));
      setPendingDeleteId(null);
      toast.success("Plant deleted.");
    } catch (e) {
      const message = e.message || "Could not delete plant";
      setError(message);
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  }

  function clearFilters() {
    setQuery("");
    setSortBy("name");
    setFilterWithSeason(false);
    setFilterWithMaturity(false);
  }

  function handleLoadMore() {
    if (!hasMore || loadingMore) return;
    fetchPlants({ append: true, searchTerm: query, offsetOverride: offset });
  }

  if (loadingUser) {
    return (
      <div className="page">
        <div className="card">
          <h2>Plants</h2>
          <p className="muted">Checking your session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <div className="card">
          <h2>Plants</h2>
          <p className="muted">Log in to manage the plant catalog.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-hero">
        <div className="page-title">
          <h2 style={{ margin: 0 }}>Plant Catalog</h2>
          <span className="muted">Use these profiles for matching and timing.</span>
        </div>
        <div className="page-actions">
          <button type="button" className="secondary" onClick={() => fetchPlants({ append: false, searchTerm: query })} disabled={loading}>
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
          <div className="stat-label">Total Plants</div>
          <div className="stat-value">{stats.totalPlants}</div>
          <div className="stat-meta muted">{stats.seasonsCount} seasons tracked</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Maturity</div>
          <div className="stat-value">{formatNumber(stats.avgMaturity)}</div>
          <div className="stat-meta muted">Days to harvest</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Frost Notes</div>
          <div className="stat-value">{stats.withFrost}</div>
          <div className="stat-meta muted">Plants with sensitivity info</div>
        </div>
      </div>

      <div className="card" style={{ margin: "16px 0" }}>
        <form onSubmit={handleSubmit} className="stack">
          <label>
            Common name
            <input
              required
              value={form.commonName}
              onChange={(e) => setForm({ ...form, commonName: e.target.value })}
              placeholder="Tomato"
              maxLength={MAX_NAME_LENGTH}
            />
          </label>
          <label>
            Tags
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="nightshade, fruit"
              maxLength={MAX_TAGS_LENGTH}
            />
          </label>
          <label>
            Season
            <input
              value={form.season}
              onChange={(e) => setForm({ ...form, season: e.target.value })}
              placeholder="summer"
              maxLength={MAX_TEXT_LENGTH}
            />
          </label>
          <label>
            Days to maturity
            <input
              type="number"
              min={1}
              value={form.daysToMaturity}
              onChange={(e) => setForm({ ...form, daysToMaturity: e.target.value })}
              placeholder="70"
            />
          </label>
          <label>
            Frost sensitivity
            <input
              value={form.frostSensitivity}
              onChange={(e) => setForm({ ...form, frostSensitivity: e.target.value })}
              placeholder="tender"
              maxLength={MAX_TEXT_LENGTH}
            />
          </label>
          <button type="submit" disabled={!canSubmit}>
            {saving ? "Saving..." : "Add Plant"}
          </button>
        </form>
        {showAddValidation && <p className="error">{addValidation.message}</p>}
        <p className="muted" style={{ marginTop: 6 }}>
          Tip: Add tags for search and matching. Days to maturity should be a positive number.
        </p>
      </div>

      <div className="card toolbar-card">
        <div className="toolbar-row">
          <label className="grow">
            Search
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name, tag, or season"
            />
          </label>
          <label>
            Sort
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="name">Name</option>
              <option value="season">Season</option>
              <option value="maturity">Days to maturity</option>
              <option value="recent">Most recent</option>
            </select>
          </label>
          <div className="toolbar-row">
            <button
              type="button"
              className={`pill-toggle ${filterWithSeason ? "active" : ""}`}
              aria-pressed={filterWithSeason}
              onClick={() => setFilterWithSeason((prev) => !prev)}
            >
              With season
            </button>
            <button
              type="button"
              className={`pill-toggle ${filterWithMaturity ? "active" : ""}`}
              aria-pressed={filterWithMaturity}
              onClick={() => setFilterWithMaturity((prev) => !prev)}
            >
              With maturity
            </button>
            <button type="button" className="ghost" onClick={clearFilters} disabled={!hasFilters}>
              Reset
            </button>
          </div>
        </div>
        <div className="toolbar-summary">
          <span>
            Showing {filteredPlants.length} of {plants.length} plants
          </span>
          <span>
            {isRefreshing && "Refreshing..."}
            {!isRefreshing && lastLoaded && `Updated ${lastLoaded.toLocaleString()}`}
          </span>
        </div>
      </div>

      {loading && plants.length === 0 && <p className="muted">Loading plants...</p>}

      <ul className="list-plain">
        {!loading && plants.length === 0 && (
          <li className="card">
            <h3>No plants yet</h3>
            <p className="muted">Add your first plant profile to support timing and matching.</p>
          </li>
        )}
        {!loading && plants.length > 0 && filteredPlants.length === 0 && (
          <li className="card">
            <h3>No matches</h3>
            <p className="muted">Try clearing your filters or adjusting the search term.</p>
          </li>
        )}
        {filteredPlants.map((plant) => {
          const days = Number(plant.daysToMaturity);
          const showDays = Number.isFinite(days) && days > 0;
          return (
            <li key={plant.id} className="card" style={{ marginBottom: 10 }}>
              {editingId === plant.id ? (
                <form onSubmit={saveEdit} className="stack">
                  <input
                    value={editForm.commonName}
                    onChange={(e) => setEditForm({ ...editForm, commonName: e.target.value })}
                    required
                    placeholder="Common name"
                    maxLength={MAX_NAME_LENGTH}
                  />
                  <input
                    value={editForm.tags}
                    onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                    placeholder="Tags"
                    maxLength={MAX_TAGS_LENGTH}
                  />
                  <input
                    value={editForm.season}
                    onChange={(e) => setEditForm({ ...editForm, season: e.target.value })}
                    placeholder="Season"
                    maxLength={MAX_TEXT_LENGTH}
                  />
                  <input
                    type="number"
                    min={1}
                    value={editForm.daysToMaturity}
                    onChange={(e) => setEditForm({ ...editForm, daysToMaturity: e.target.value })}
                    placeholder="Days to maturity"
                  />
                  <input
                    value={editForm.frostSensitivity}
                    onChange={(e) => setEditForm({ ...editForm, frostSensitivity: e.target.value })}
                    placeholder="Frost sensitivity"
                    maxLength={MAX_TEXT_LENGTH}
                  />
                  <div className="inline-actions">
                    <button type="submit" disabled={!canSaveEdit}>
                      {editSaving ? "Saving..." : "Save"}
                    </button>
                    <button type="button" className="secondary" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                  {showEditValidation && <p className="error">{editValidation.message}</p>}
                </form>
              ) : (
                <div className="item-row">
                  <div>
                    <div className="item-title">{plant.commonName || "Plant"}</div>
                    <div className="item-subtitle">
                      {plant.season ? `Season ${plant.season}` : "Season N/A"}
                      {showDays ? ` | ${plant.daysToMaturity} days` : ""}
                      {plant.frostSensitivity ? ` | ${plant.frostSensitivity}` : ""}
                    </div>
                    {plant.tags && (
                      <div className="muted" style={{ fontSize: 13 }}>
                        Tags: {plant.tags}
                      </div>
                    )}
                  </div>
                  {pendingDeleteId === plant.id ? (
                    <div className="item-delete-confirm">
                      <span className="muted">Delete this plant?</span>
                      <button
                        type="button"
                        className="danger"
                        disabled={deletingId === plant.id}
                        onClick={() => handleDelete(plant.id)}
                      >
                        {deletingId === plant.id ? "Deleting..." : "Confirm"}
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={deletingId === plant.id}
                        onClick={() => setPendingDeleteId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="item-actions">
                      <button
                        type="button"
                        onClick={() => beginEdit(plant)}
                        disabled={Boolean(editingId) || deletingId !== null}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(plant.id)}
                        className="danger"
                        disabled={Boolean(editingId) || deletingId !== null}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {hasMore && !loading && (
        <div className="list-actions">
          <button type="button" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
