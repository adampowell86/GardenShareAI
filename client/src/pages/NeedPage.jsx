import React, { useCallback, useEffect, useMemo, useState } from "react";
import { INVENTORY_EVENT, Inventory, Plants, emitInventoryChanged } from "../api.js";
import { useUser } from "../experience/UserContext.jsx";
import { useToast } from "../components/ToastProvider.jsx";

const PAGE_SIZE = 40;
const MAX_NAME_LENGTH = 70;
const MAX_NOTES_LENGTH = 140;

function toPositiveInt(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return 1;
  return Math.round(num);
}

function buildNeedPayload(values) {
  const name = values.name?.trim() || "";
  const notes = values.notes?.trim() || "";
  return {
    name: name || null,
    qty: toPositiveInt(values.qty),
    notes: notes || null,
    plantId: values.plantId || null,
  };
}

function validateNeedForm(values) {
  const payload = buildNeedPayload(values);
  if (!payload.name) {
    return { isValid: false, message: "Name is required.", payload };
  }
  if (payload.name.length < 2) {
    return { isValid: false, message: "Name should be at least 2 characters.", payload };
  }
  if (payload.name.length > MAX_NAME_LENGTH) {
    return {
      isValid: false,
      message: `Name should be ${MAX_NAME_LENGTH} characters or fewer.`,
      payload,
    };
  }
  if (payload.qty < 1) {
    return { isValid: false, message: "Quantity must be at least 1.", payload };
  }
  if (payload.notes && payload.notes.length > MAX_NOTES_LENGTH) {
    return {
      isValid: false,
      message: `Notes should be ${MAX_NOTES_LENGTH} characters or fewer.`,
      payload,
    };
  }
  return { isValid: true, message: "", payload };
}

export default function NeedPage() {
  const { user, loadingUser, refreshUser } = useUser();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [plants, setPlants] = useState([]);
  const [form, setForm] = useState({ name: "", qty: 1, notes: "", plantId: "" });
  const [formAttempted, setFormAttempted] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState({ name: "", qty: 1, notes: "", plantId: "" });
  const [editSnapshot, setEditSnapshot] = useState(null);
  const [editAttempted, setEditAttempted] = useState(false);
  const [plantQuery, setPlantQuery] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [filterWithPlant, setFilterWithPlant] = useState(false);
  const [filterWithNotes, setFilterWithNotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingPlants, setLoadingPlants] = useState(false);
  const [error, setError] = useState("");
  const [plantError, setPlantError] = useState("");
  const [lastLoaded, setLastLoaded] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const refresh = useCallback(async ({ append = false, offsetOverride } = {}) => {
    if (append && loadingMore) return;
    const currentOffset = append ? (offsetOverride ?? offset) : 0;
    if (append) {
      setLoadingMore(true);
    } else {
      setLoadingList(true);
      setHasMore(true);
      setOffset(0);
    }
    setError("");
    try {
      const data = await Inventory.list("NEED", { limit: PAGE_SIZE, offset: currentOffset });
      const list = Array.isArray(data) ? data : data?.items || [];
      setItems((prev) => (append ? [...prev, ...list] : list));
      const nextOffset = currentOffset + list.length;
      setOffset(nextOffset);
      setHasMore(list.length === PAGE_SIZE);
      setLastLoaded(new Date());
      if (!append) setPendingDeleteId(null);
    } catch (e) {
      const message = e.message || "Failed to load needs";
      setError(message);
      toast.error(message);
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoadingList(false);
      }
    }
  }, [offset, loadingMore, toast]);

  const refreshPlants = useCallback(async () => {
    setPlantError("");
    setLoadingPlants(true);
    try {
      const data = await Plants.list();
      setPlants(data);
    } catch (e) {
      const message = e.message || "Failed to load plant catalog";
      setPlantError(message);
      toast.error(message);
    } finally {
      setLoadingPlants(false);
    }
  }, [toast]);

  const plantOptions = useMemo(() => {
    if (!plantQuery.trim()) return plants;
    const query = plantQuery.trim().toLowerCase();
    return plants.filter((plant) => plant.commonName.toLowerCase().includes(query));
  }, [plants, plantQuery]);
  const formPlantOptions =
    form.plantId && !plantOptions.some((plant) => plant.id === form.plantId)
      ? [plants.find((plant) => plant.id === form.plantId), ...plantOptions].filter(Boolean)
      : plantOptions;
  const editPlantOptions =
    editForm.plantId && !plantOptions.some((plant) => plant.id === editForm.plantId)
      ? [plants.find((plant) => plant.id === editForm.plantId), ...plantOptions].filter(Boolean)
      : plantOptions;

  useEffect(() => {
    if (!user) return;
    refresh({ append: false });
    refreshPlants();
  }, [user, refresh, refreshPlants]);

  useEffect(() => {
    if (!user) return undefined;
    const handler = () => refresh({ append: false });
    window.addEventListener(INVENTORY_EVENT, handler);
    return () => window.removeEventListener(INVENTORY_EVENT, handler);
  }, [user, refresh]);

  const addValidation = useMemo(() => validateNeedForm(form), [form]);
  const editValidation = useMemo(() => {
    if (!editingId) return { isValid: true, message: "", payload: null };
    return validateNeedForm(editForm);
  }, [editForm, editingId]);

  const hasEditChanges = useMemo(() => {
    if (!editSnapshot) return false;
    return (
      editForm.name !== editSnapshot.name ||
      String(editForm.qty) !== String(editSnapshot.qty) ||
      editForm.notes !== editSnapshot.notes ||
      editForm.plantId !== editSnapshot.plantId
    );
  }, [editForm, editSnapshot]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    let result = items;
    if (term) {
      result = result.filter((item) => {
        const plantName = item.plant?.commonName || "";
        const notes = item.notes || "";
        return `${item.name} ${plantName} ${notes}`.toLowerCase().includes(term);
      });
    }
    if (filterWithPlant) {
      result = result.filter((item) => item.plantId || item.plant);
    }
    if (filterWithNotes) {
      result = result.filter((item) => item.notes && item.notes.trim());
    }
    if (sortBy !== "recent") {
      result = [...result].sort((a, b) => {
        if (sortBy === "name") {
          return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        }
        if (sortBy === "qty") {
          return Number(b.qty) - Number(a.qty);
        }
        return 0;
      });
    }
    return result;
  }, [items, search, filterWithPlant, filterWithNotes, sortBy]);

  const stats = useMemo(() => {
    let totalQty = 0;
    let withPlant = 0;
    let withNotes = 0;
    items.forEach((item) => {
      totalQty += Number(item.qty) || 0;
      if (item.plantId || item.plant) withPlant += 1;
      if (item.notes && item.notes.trim()) withNotes += 1;
    });
    return {
      totalItems: items.length,
      totalQty,
      withPlant,
      withNotes,
    };
  }, [items]);

  const showAddValidation =
    !addValidation.isValid &&
    (formAttempted || form.name || form.notes || form.plantId);
  const showEditValidation =
    !editValidation.isValid &&
    (editAttempted || editForm.name || editForm.notes || editForm.plantId);
  const canSubmit = addValidation.isValid && !saving;
  const canSaveEdit = editValidation.isValid && hasEditChanges && !editSaving;
  const isRefreshing = loadingList && items.length > 0 && !loadingMore;
  const hasFilters =
    Boolean(search.trim()) ||
    filterWithPlant ||
    filterWithNotes ||
    sortBy !== "recent";

  async function handleSubmit(e) {
    e.preventDefault();
    setFormAttempted(true);
    if (!addValidation.isValid) return;
    setError("");
    setSaving(true);
    try {
      const created = await Inventory.createNeed(addValidation.payload);
      setItems((prev) => [created, ...prev]);
      setForm({ name: "", qty: 1, notes: "", plantId: "" });
      setFormAttempted(false);
      refreshUser();
      emitInventoryChanged();
      toast.success("Need item added.");
    } catch (e) {
      const message = e.message || "Could not add need item";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function updateItem(id, patch, options = {}) {
    if (updatingId === id) return false;
    const { notify = false, message = "Need item updated." } = options;
    setError("");
    setUpdatingId(id);
    try {
      const updated = await Inventory.update(id, patch);
      setItems((prev) => prev.map((it) => (it.id === id ? updated : it)));
      emitInventoryChanged();
      if (notify) toast.success(message);
      return true;
    } catch (e) {
      const messageText = e.message || "Could not update item";
      setError(messageText);
      toast.error(messageText);
      return false;
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(id) {
    setError("");
    try {
      setDeletingId(id);
      await Inventory.delete(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      refreshUser();
      emitInventoryChanged();
      setPendingDeleteId(null);
      toast.success("Need item deleted.");
    } catch (e) {
      const message = e.message || "Could not delete item";
      setError(message);
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  }

  function beginEdit(item) {
    setEditingId(item.id);
    const snapshot = {
      name: item.name,
      qty: item.qty,
      notes: item.notes || "",
      plantId: item.plantId || "",
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
    setEditSaving(true);
    const success = await updateItem(editingId, editValidation.payload, { notify: true });
    if (success) {
      setEditingId("");
      setEditSnapshot(null);
    }
    setEditSaving(false);
  }

  function cancelEdit() {
    setEditingId("");
    setEditSnapshot(null);
    setEditAttempted(false);
  }

  function clearFilters() {
    setSearch("");
    setSortBy("recent");
    setFilterWithPlant(false);
    setFilterWithNotes(false);
  }

  function handleLoadMore() {
    if (!hasMore || loadingMore) return;
    refresh({ append: true, offsetOverride: offset });
  }

  if (loadingUser) {
    return (
      <div className="page">
        <div className="card">
          <h2>Need Items</h2>
          <p className="muted">Checking your session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <div className="card">
          <h2>Need Items</h2>
          <p className="muted">Please log in to track what you need.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-hero">
        <div className="page-title">
          <h2 style={{ margin: 0 }}>Need Items</h2>
          <span className="muted">Everything you want from the community.</span>
        </div>
        <div className="page-actions">
          <button type="button" className="secondary" onClick={() => refresh({ append: false })} disabled={loadingList}>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <p className="error" role="alert">
          Error: {error}
        </p>
      )}
      {plantError && (
        <p className="error" role="alert">
          Plant catalog: {plantError}
        </p>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Needs</div>
          <div className="stat-value">{stats.totalItems}</div>
          <div className="stat-meta muted">{stats.withPlant} with plant profile</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Quantity</div>
          <div className="stat-value">{stats.totalQty}</div>
          <div className="stat-meta muted">Across all needs</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Notes Added</div>
          <div className="stat-value">{stats.withNotes}</div>
          <div className="stat-meta muted">Items with details</div>
        </div>
      </div>

      <div className="card" style={{ margin: "16px 0" }}>
        <form onSubmit={handleSubmit} className="form-grid">
          <div className="field">
            <label>
              Name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                maxLength={MAX_NAME_LENGTH}
              />
            </label>
          </div>
          <div className="field xs">
            <label>
              Qty
              <input
                type="number"
                min={1}
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: e.target.value })}
              />
            </label>
          </div>
          <div className="field" style={{ flex: "1 1 220px" }}>
            <label>
              Plant profile
              <input
                placeholder="Search plants"
                value={plantQuery}
                onChange={(e) => setPlantQuery(e.target.value)}
                style={{ marginBottom: 6 }}
              />
              <select
                value={form.plantId}
                onChange={(e) => setForm({ ...form, plantId: e.target.value })}
                disabled={loadingPlants}
              >
                <option value="">No profile</option>
                {formPlantOptions.map((plant) => (
                  <option key={plant.id} value={plant.id}>
                    {plant.commonName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="field" style={{ flex: "2 1 280px" }}>
            <label>
              Notes
              <input
                placeholder="Organic, specific variety, etc."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                maxLength={MAX_NOTES_LENGTH}
              />
            </label>
          </div>
          <button type="submit" disabled={!canSubmit}>
            {saving ? "Adding..." : "Add Need"}
          </button>
        </form>
        {showAddValidation && <p className="error">{addValidation.message}</p>}
        <p className="muted" style={{ marginTop: 6 }}>
          Tip: Link a plant profile to improve matching and timing hints.
        </p>
      </div>

      <div className="card toolbar-card">
        <div className="toolbar-row">
          <label className="grow">
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name, plant, or notes"
            />
          </label>
          <label>
            Sort
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="recent">Most recent</option>
              <option value="name">Name</option>
              <option value="qty">Quantity</option>
            </select>
          </label>
          <div className="toolbar-row">
            <button
              type="button"
              className={`pill-toggle ${filterWithPlant ? "active" : ""}`}
              aria-pressed={filterWithPlant}
              onClick={() => setFilterWithPlant((prev) => !prev)}
            >
              With plant
            </button>
            <button
              type="button"
              className={`pill-toggle ${filterWithNotes ? "active" : ""}`}
              aria-pressed={filterWithNotes}
              onClick={() => setFilterWithNotes((prev) => !prev)}
            >
              With notes
            </button>
            <button type="button" className="ghost" onClick={clearFilters} disabled={!hasFilters}>
              Reset
            </button>
          </div>
        </div>
        <div className="toolbar-summary">
          <span>
            Showing {filteredItems.length} of {items.length} needs
          </span>
          <span>
            {isRefreshing && "Refreshing..."}
            {!isRefreshing && lastLoaded && `Updated ${lastLoaded.toLocaleString()}`}
          </span>
        </div>
      </div>

      {loadingList && items.length === 0 && <p className="muted">Loading your wish list...</p>}

      <ul className="list-plain" style={{ marginTop: "1rem" }}>
        {!loadingList && items.length === 0 && (
          <li className="card">
            <h3>No need items yet</h3>
            <p className="muted">Add a need to start matching with nearby growers.</p>
          </li>
        )}
        {!loadingList && items.length > 0 && filteredItems.length === 0 && (
          <li className="card">
            <h3>No matches</h3>
            <p className="muted">Try clearing your filters or adjusting the search term.</p>
          </li>
        )}
        {filteredItems.map((it) => (
          <li key={it.id} className="card" style={{ marginTop: 8 }}>
            {editingId === it.id ? (
              <form onSubmit={saveEdit} className="inline-form">
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                  style={{ minWidth: 160 }}
                  maxLength={MAX_NAME_LENGTH}
                />
                <input
                  type="number"
                  min={1}
                  value={editForm.qty}
                  onChange={(e) => setEditForm({ ...editForm, qty: e.target.value })}
                  style={{ width: 80 }}
                />
                <select
                  value={editForm.plantId}
                  onChange={(e) => setEditForm({ ...editForm, plantId: e.target.value })}
                  style={{ minWidth: 160 }}
                >
                  <option value="">No profile</option>
                  {editPlantOptions.map((plant) => (
                    <option key={plant.id} value={plant.id}>
                      {plant.commonName}
                    </option>
                  ))}
                </select>
                <input
                  value={editForm.notes}
                  placeholder="Notes"
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  style={{ flex: 1, minWidth: 180 }}
                  maxLength={MAX_NOTES_LENGTH}
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
                  <div className="item-title">{it.name}</div>
                  <div className="item-subtitle">
                    Qty {it.qty}
                    {it.plant?.commonName ? ` | ${it.plant.commonName}` : ""}
                    {it.notes ? ` | ${it.notes}` : ""}
                  </div>
                </div>
                {pendingDeleteId === it.id ? (
                  <div className="item-delete-confirm">
                    <span className="muted">Delete this need?</span>
                    <button
                      type="button"
                      className="danger"
                      disabled={deletingId === it.id}
                      onClick={() => handleDelete(it.id)}
                    >
                      {deletingId === it.id ? "Deleting..." : "Confirm"}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={deletingId === it.id}
                      onClick={() => setPendingDeleteId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="item-actions">
                    <div className="qty-controls">
                      <button
                        type="button"
                        onClick={() => updateItem(it.id, { qty: it.qty + 1 })}
                        disabled={Boolean(editingId) || deletingId !== null || updatingId === it.id}
                      >
                        +1
                      </button>
                      {it.qty > 1 && (
                        <button
                          type="button"
                          onClick={() => updateItem(it.id, { qty: it.qty - 1 })}
                          disabled={Boolean(editingId) || deletingId !== null || updatingId === it.id}
                        >
                          -1
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => beginEdit(it)}
                      disabled={Boolean(editingId) || deletingId !== null || updatingId === it.id}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(it.id)}
                      className="danger"
                      disabled={Boolean(editingId) || deletingId !== null || updatingId === it.id}
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

      {hasMore && !loadingList && (
        <div className="list-actions">
          <button type="button" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
