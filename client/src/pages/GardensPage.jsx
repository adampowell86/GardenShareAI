import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Gardens } from "../api.js";
import { useUser } from "../experience/UserContext.jsx";
import { useToast } from "../components/ToastProvider.jsx";

const ZONE_PATTERN = /^\d{1,2}[a-c]?$/i;
const MAX_NAME_LENGTH = 60;
const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function buildGardenPayload(values) {
  const name = values.name?.trim() || "";
  const usdaZone = values.usdaZone?.trim() || "";
  return {
    name: name || null,
    usdaZone: usdaZone || null,
    bedAreaSqFt: toNumber(values.bedAreaSqFt),
  };
}

function validateGardenForm(values) {
  const payload = buildGardenPayload(values);
  if (!payload.name && !payload.usdaZone && payload.bedAreaSqFt === null) {
    return { isValid: false, message: "Add at least a name, USDA zone, or bed area.", payload };
  }
  if (payload.name && payload.name.length < 2) {
    return { isValid: false, message: "Name should be at least 2 characters.", payload };
  }
  if (payload.name && payload.name.length > MAX_NAME_LENGTH) {
    return {
      isValid: false,
      message: `Name should be ${MAX_NAME_LENGTH} characters or fewer.`,
      payload,
    };
  }
  if (payload.usdaZone && !ZONE_PATTERN.test(payload.usdaZone)) {
    return { isValid: false, message: "USDA zone format should look like 6b.", payload };
  }
  if (payload.bedAreaSqFt !== null && payload.bedAreaSqFt < 0) {
    return { isValid: false, message: "Bed area must be 0 or greater.", payload };
  }
  return { isValid: true, message: "", payload };
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "--";
  return numberFormatter.format(value);
}

export default function GardensPage() {
  const { user, loadingUser } = useUser();
  const toast = useToast();
  const [gardens, setGardens] = useState([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [filterWithZone, setFilterWithZone] = useState(false);
  const [filterWithArea, setFilterWithArea] = useState(false);
  const [form, setForm] = useState({ name: "", usdaZone: "", bedAreaSqFt: "" });
  const [formAttempted, setFormAttempted] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState({ name: "", usdaZone: "", bedAreaSqFt: "" });
  const [editSnapshot, setEditSnapshot] = useState(null);
  const [editAttempted, setEditAttempted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [lastLoaded, setLastLoaded] = useState(null);

  const loadGardens = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const data = await Gardens.list();
      setGardens(data);
      setLastLoaded(new Date());
      setPendingDeleteId(null);
    } catch (e) {
      setError(e.message || "Failed to load gardens");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadGardens();
  }, [user, loadGardens]);

  const addValidation = useMemo(() => validateGardenForm(form), [form]);
  const editValidation = useMemo(() => {
    if (!editingId) return { isValid: true, message: "", payload: null };
    return validateGardenForm(editForm);
  }, [editForm, editingId]);

  const hasEditChanges = useMemo(() => {
    if (!editSnapshot) return false;
    return (
      editForm.name !== editSnapshot.name ||
      editForm.usdaZone !== editSnapshot.usdaZone ||
      String(editForm.bedAreaSqFt) !== String(editSnapshot.bedAreaSqFt)
    );
  }, [editForm, editSnapshot]);

  const filteredGardens = useMemo(() => {
    const term = search.trim().toLowerCase();
    let result = gardens;
    if (term) {
      result = result.filter((garden) => {
        const name = garden.name || "";
        const zone = garden.usdaZone || "";
        const area = garden.bedAreaSqFt ?? "";
        return `${name} ${zone} ${area}`.toLowerCase().includes(term);
      });
    }
    if (filterWithZone) {
      result = result.filter((garden) => garden.usdaZone);
    }
    if (filterWithArea) {
      result = result.filter((garden) => {
        const area = Number(garden.bedAreaSqFt);
        return Number.isFinite(area) && area > 0;
      });
    }
    if (sortBy !== "recent") {
      result = [...result].sort((a, b) => {
        if (sortBy === "name") {
          const nameA = a.name || "";
          const nameB = b.name || "";
          if (!nameA) return 1;
          if (!nameB) return -1;
          return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
        }
        if (sortBy === "zone") {
          const zoneA = a.usdaZone || "";
          const zoneB = b.usdaZone || "";
          if (!zoneA) return 1;
          if (!zoneB) return -1;
          return zoneA.localeCompare(zoneB, undefined, { numeric: true, sensitivity: "base" });
        }
        if (sortBy === "area") {
          const areaA = Number.isFinite(Number(a.bedAreaSqFt)) ? Number(a.bedAreaSqFt) : -1;
          const areaB = Number.isFinite(Number(b.bedAreaSqFt)) ? Number(b.bedAreaSqFt) : -1;
          return areaB - areaA;
        }
        return 0;
      });
    }
    return result;
  }, [gardens, search, filterWithZone, filterWithArea, sortBy]);

  const stats = useMemo(() => {
    let totalArea = 0;
    const zones = new Set();
    gardens.forEach((garden) => {
      const zone = typeof garden.usdaZone === "string" ? garden.usdaZone.trim() : "";
      if (zone) zones.add(zone);
      const area = Number(garden.bedAreaSqFt);
      if (Number.isFinite(area)) totalArea += area;
    });
    const totalGardens = gardens.length;
    const avgArea = totalGardens ? totalArea / totalGardens : 0;
    return {
      totalGardens,
      totalArea,
      avgArea,
      zonesCount: zones.size,
    };
  }, [gardens]);

  const showAddValidation =
    !addValidation.isValid &&
    (formAttempted || form.name || form.usdaZone || form.bedAreaSqFt !== "");
  const showEditValidation =
    !editValidation.isValid &&
    (editAttempted || editForm.name || editForm.usdaZone || editForm.bedAreaSqFt !== "");
  const canSubmit = addValidation.isValid && !saving;
  const canSaveEdit = editValidation.isValid && hasEditChanges && !editSaving;
  const isRefreshing = loading && gardens.length > 0;
  const hasFilters =
    Boolean(search.trim()) ||
    filterWithZone ||
    filterWithArea ||
    sortBy !== "recent";

  async function handleSubmit(e) {
    e.preventDefault();
    setFormAttempted(true);
    if (!addValidation.isValid) return;
    setError("");
    setSaving(true);
    try {
      const payload = addValidation.payload;
      const created = await Gardens.create(payload);
      setGardens((prev) => [created, ...prev]);
      setForm({ name: "", usdaZone: "", bedAreaSqFt: "" });
      setFormAttempted(false);
      toast.success("Garden added.");
    } catch (e) {
      setError(e.message || "Could not add garden");
      toast.error(e.message || "Could not add garden");
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(garden) {
    setEditingId(garden.id);
    const snapshot = {
      name: garden.name || "",
      usdaZone: garden.usdaZone || "",
      bedAreaSqFt: garden.bedAreaSqFt ?? "",
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
      const updated = await Gardens.update(editingId, payload);
      setGardens((prev) => prev.map((g) => (g.id === editingId ? updated : g)));
      setEditingId("");
      setEditSnapshot(null);
      toast.success("Garden updated.");
    } catch (e) {
      setError(e.message || "Could not update garden");
      toast.error(e.message || "Could not update garden");
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
      await Gardens.delete(id);
      setGardens((prev) => prev.filter((g) => g.id !== id));
      setPendingDeleteId(null);
      toast.success("Garden deleted.");
    } catch (e) {
      setError(e.message || "Could not delete garden");
      toast.error(e.message || "Could not delete garden");
    } finally {
      setDeletingId(null);
    }
  }

  function clearFilters() {
    setSearch("");
    setSortBy("recent");
    setFilterWithZone(false);
    setFilterWithArea(false);
  }

  if (loadingUser) {
    return (
      <div className="page">
        <div className="card">
          <h2>Gardens</h2>
          <p className="muted">Checking your session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <div className="card">
          <h2>Gardens</h2>
          <p className="muted">Log in to manage your garden spaces.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-hero">
        <div className="page-title">
          <h2 style={{ margin: 0 }}>Gardens</h2>
          <span className="muted">Track beds and zones for timing insights.</span>
        </div>
        <div className="page-actions">
          <button type="button" className="secondary" onClick={loadGardens} disabled={loading}>
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
          <div className="stat-label">Total Gardens</div>
          <div className="stat-value">{stats.totalGardens}</div>
          <div className="stat-meta muted">{stats.zonesCount} zones tracked</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Bed Area</div>
          <div className="stat-value">{formatNumber(stats.totalArea)}</div>
          <div className="stat-meta muted">Sq ft across all gardens</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Average Bed Size</div>
          <div className="stat-value">{formatNumber(stats.avgArea)}</div>
          <div className="stat-meta muted">Sq ft per garden</div>
        </div>
      </div>

      <div className="card" style={{ margin: "16px 0" }}>
        <form onSubmit={handleSubmit} className="form-grid">
          <div className="field">
            <label>
              Name
              <input
                placeholder="Backyard beds"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={MAX_NAME_LENGTH}
              />
            </label>
          </div>
          <div className="field small">
            <label>
              USDA zone
              <input
                placeholder="6b"
                value={form.usdaZone}
                onChange={(e) => setForm({ ...form, usdaZone: e.target.value })}
              />
            </label>
          </div>
          <div className="field small">
            <label>
              Bed area (sq ft)
              <input
                type="number"
                min={0}
                value={form.bedAreaSqFt}
                onChange={(e) => setForm({ ...form, bedAreaSqFt: e.target.value })}
              />
            </label>
          </div>
          <button type="submit" disabled={!canSubmit}>
            {saving ? "Saving..." : "Add Garden"}
          </button>
        </form>
        {showAddValidation && <p className="error">{addValidation.message}</p>}
        <p className="muted" style={{ marginTop: 6 }}>
          Tip: USDA zone format looks like 6b. Area can be left blank if unknown.
        </p>
      </div>

      <div className="card toolbar-card">
        <div className="toolbar-row">
          <label className="grow">
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name, zone, or area"
            />
          </label>
          <label>
            Sort
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="recent">Most recent</option>
              <option value="name">Name</option>
              <option value="zone">USDA zone</option>
              <option value="area">Bed area</option>
            </select>
          </label>
          <div className="toolbar-row">
            <button
              type="button"
              className={`pill-toggle ${filterWithZone ? "active" : ""}`}
              aria-pressed={filterWithZone}
              onClick={() => setFilterWithZone((prev) => !prev)}
            >
              With zone
            </button>
            <button
              type="button"
              className={`pill-toggle ${filterWithArea ? "active" : ""}`}
              aria-pressed={filterWithArea}
              onClick={() => setFilterWithArea((prev) => !prev)}
            >
              With area
            </button>
            <button type="button" className="ghost" onClick={clearFilters} disabled={!hasFilters}>
              Reset
            </button>
          </div>
        </div>
        <div className="toolbar-summary">
          <span>
            Showing {filteredGardens.length} of {gardens.length} gardens
          </span>
          <span>
            {isRefreshing && "Refreshing..."}
            {!isRefreshing && lastLoaded && `Updated ${lastLoaded.toLocaleString()}`}
          </span>
        </div>
      </div>

      {loading && gardens.length === 0 && <p className="muted">Loading gardens...</p>}

      <ul className="list-plain">
        {!loading && gardens.length === 0 && (
          <li className="card">
            <h3>No gardens yet</h3>
            <p className="muted">Add your first garden to start tracking zones and bed sizes.</p>
          </li>
        )}
        {!loading && gardens.length > 0 && filteredGardens.length === 0 && (
          <li className="card">
            <h3>No matches</h3>
            <p className="muted">Try clearing your filters or adjusting the search term.</p>
          </li>
        )}
        {filteredGardens.map((garden) => (
          <li key={garden.id} className="card" style={{ marginBottom: 10 }}>
            {editingId === garden.id ? (
              <form
                onSubmit={saveEdit}
                className="inline-form"
              >
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Garden name"
                  style={{ minWidth: 160 }}
                  maxLength={MAX_NAME_LENGTH}
                />
                <input
                  value={editForm.usdaZone}
                  onChange={(e) => setEditForm({ ...editForm, usdaZone: e.target.value })}
                  placeholder="Zone"
                  style={{ width: 100 }}
                />
                <input
                  type="number"
                  min={0}
                  value={editForm.bedAreaSqFt}
                  onChange={(e) => setEditForm({ ...editForm, bedAreaSqFt: e.target.value })}
                  placeholder="Area"
                  style={{ width: 120 }}
                />
                <div className="inline-actions">
                  <button type="submit" disabled={!canSaveEdit}>
                    {editSaving ? "Saving..." : "Save"}
                  </button>
                  <button type="button" className="secondary" onClick={cancelEdit}>
                    Cancel
                  </button>
                </div>
                {showEditValidation && <span className="error">{editValidation.message}</span>}
              </form>
            ) : (
              <div className="item-row">
                <div>
                  <div className="item-title">{garden.name || "Garden"}</div>
                  <div className="item-subtitle">
                    Zone {garden.usdaZone || "N/A"}
                    {garden.bedAreaSqFt !== null && garden.bedAreaSqFt !== undefined
                      ? ` | ${garden.bedAreaSqFt} sq ft`
                      : ""}
                  </div>
                </div>
                {pendingDeleteId === garden.id ? (
                  <div className="item-delete-confirm">
                    <span className="muted">Delete this garden?</span>
                    <button
                      type="button"
                      className="danger"
                      disabled={deletingId === garden.id}
                      onClick={() => handleDelete(garden.id)}
                    >
                      {deletingId === garden.id ? "Deleting..." : "Confirm"}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={deletingId === garden.id}
                      onClick={() => setPendingDeleteId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="item-actions">
                    <button
                      type="button"
                      onClick={() => beginEdit(garden)}
                      disabled={Boolean(editingId) || deletingId !== null}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(garden.id)}
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
        ))}
      </ul>
    </div>
  );
}


