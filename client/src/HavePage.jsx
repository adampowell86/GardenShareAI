import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Auth, Inventory, API_BASE, INVENTORY_EVENT, Plants, emitInventoryChanged } from "./api.js";
import { useUser } from "./experience/UserContext.jsx";
import { useToast } from "./components/ToastProvider.jsx";

function toNumber(value, fallback = 1) {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 1) return fallback;
  return parsed;
}

export default function HavePage() {
  const { user, refreshUser, loadingUser, providerStatus, socialError, setSocialError } = useUser();
  const toast = useToast();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [items, setItems] = useState([]);
  const [plants, setPlants] = useState([]);
  const [form, setForm] = useState({ name: "", qty: 1, notes: "", plantId: "" });
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState({ name: "", qty: 1, notes: "", plantId: "" });
  const [plantQuery, setPlantQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingPlants, setLoadingPlants] = useState(false);
  const [error, setError] = useState("");
  const [plantError, setPlantError] = useState("");

  const refreshItems = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await Inventory.list("HAVE");
      setItems(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const refreshPlants = useCallback(async () => {
    setPlantError("");
    setLoadingPlants(true);
    try {
      const data = await Plants.list();
      setPlants(data);
    } catch (e) {
      setPlantError(e.message || "Failed to load plant catalog");
    } finally {
      setLoadingPlants(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      refreshItems();
      refreshPlants();
    } else {
      setItems([]);
      setPlants([]);
    }
  }, [user, refreshItems, refreshPlants]);

  useEffect(() => {
    if (!user) return undefined;
    const handler = () => refreshItems();
    window.addEventListener(INVENTORY_EVENT, handler);
    return () => window.removeEventListener(INVENTORY_EVENT, handler);
  }, [user, refreshItems]);

  async function handleAuth(e) {
    e.preventDefault();
    setError("");
    setSocialError("");
    try {
      const cleanEmail = email.trim();
      if (mode === "signup") await Auth.signup(cleanEmail, password);
      else await Auth.login(cleanEmail, password);

      await refreshUser();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const created = await Inventory.createHave({
        name: form.name.trim(),
        qty: toNumber(form.qty),
        notes: form.notes || undefined,
        plantId: form.plantId || null,
      });
      setItems((prev) => [created, ...prev]);
      setForm({ name: "", qty: 1, notes: "", plantId: "" });
      refreshUser();
      emitInventoryChanged();
      toast.success("Have item added.");
    } catch (e) {
      const message = e.message || "Could not add have item";
      setError(message);
      toast.error(message);
    }

    setLoading(false);
  }

  function startSocial(provider) {
    const status = providerStatus.find((p) => p.key === provider);
    if (status && !status.enabled) {
      setSocialError(`${status.label} is disabled until credentials are added on the server`);
      return;
    }
    setSocialError("");
    const url = `${API_BASE}/auth/oauth/${provider}/start?redirect=${encodeURIComponent(window.location.origin)}`;
    window.open(url, `_blank`, "width=520,height=650");
  }

  const availableProviders = useMemo(
    () => providerStatus.filter((p) => p.enabled),
    [providerStatus]
  );
  const disabledProviders = useMemo(
    () => providerStatus.filter((p) => !p.enabled),
    [providerStatus]
  );
  const missingProviders = useMemo(
    () =>
      disabledProviders
        .filter((p) => p.missing && p.missing.length > 0)
        .map((p) => `${p.label} (${p.missing.join(", ")})`),
    [disabledProviders]
  );

  const filteredPlants = useMemo(() => {
    if (!plantQuery.trim()) return plants;
    const query = plantQuery.trim().toLowerCase();
    return plants.filter((plant) => plant.commonName.toLowerCase().includes(query));
  }, [plants, plantQuery]);

  const formPlantOptions = useMemo(() => {
    if (!form.plantId) return filteredPlants;
    if (filteredPlants.some((plant) => plant.id === form.plantId)) return filteredPlants;
    const selected = plants.find((plant) => plant.id === form.plantId);
    return selected ? [selected, ...filteredPlants] : filteredPlants;
  }, [filteredPlants, form.plantId, plants]);

  const editPlantOptions = useMemo(() => {
    if (!editForm.plantId) return filteredPlants;
    if (filteredPlants.some((plant) => plant.id === editForm.plantId)) return filteredPlants;
    const selected = plants.find((plant) => plant.id === editForm.plantId);
    return selected ? [selected, ...filteredPlants] : filteredPlants;
  }, [filteredPlants, editForm.plantId, plants]);

  async function updateItem(id, patch, options = {}) {
    const { notify = false, message = "Have item updated." } = options;
    setError("");
    try {
      const updated = await Inventory.update(id, patch);
      setItems((prev) => prev.map((it) => (it.id === id ? updated : it)));
      emitInventoryChanged();
      if (notify) toast.success(message);
      return true;
    } catch (e) {
      const errorMessage = e.message || "Could not update item";
      setError(errorMessage);
      toast.error(errorMessage);
      return false;
    }
  }

  async function handleDelete(id) {
    setError("");
    try {
      await Inventory.delete(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      refreshUser();
      emitInventoryChanged();
      toast.success("Have item deleted.");
    } catch (e) {
      const message = e.message || "Could not delete item";
      setError(message);
      toast.error(message);
    }
  }

  function beginEdit(item) {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      qty: item.qty,
      notes: item.notes || "",
      plantId: item.plantId || "",
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editingId) return;
    if (!editForm.name.trim()) {
      setError("Name required");
      return;
    }
    const success = await updateItem(editingId, {
      name: editForm.name.trim(),
      qty: toNumber(editForm.qty),
      notes: editForm.notes || null,
      plantId: editForm.plantId || null,
    }, { notify: true });
    if (success) setEditingId("");
  }

  if (loadingUser) {
    return (
      <div className="page">
        <div className="card">
          <p className="muted">Checking your session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page auth-grid">
        <div className="card" style={{ maxWidth: 520 }}>
          <h2>{mode === "signup" ? "Create Account" : "Sign In"}</h2>
          <p className="muted" style={{ marginBottom: 16 }}>
            Sign in to keep your trading inventory in sync.
          </p>
          {error && <p className="error">Error: {error}</p>}
          {socialError && <p className="error">Social login: {socialError}</p>}

          <form onSubmit={handleAuth} className="stack">
            <label>
              Email<br />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>

            <label>
              Password<br />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>

            <button type="submit">{mode === "signup" ? "Create account" : "Login"}</button>
          </form>

          <button
            className="secondary"
            style={{ marginTop: 12 }}
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
          >
            {mode === "signup" ? "Already have an account?" : "Create account"}
          </button>
        </div>

        <div className="card" style={{ maxWidth: 420 }}>
          <h3 style={{ marginTop: 0 }}>Social sign-in</h3>
          <p className="muted" style={{ marginTop: 4 }}>
            Choose a provider configured on the server. Disabled providers stay hidden until credentials are set.
          </p>
          <div className="social-grid">
            {availableProviders.length === 0 && (
              <p className="muted">No social providers are configured yet.</p>
            )}
            {availableProviders.map((provider) => (
              <button
                key={provider.key}
                className="secondary"
                onClick={() => startSocial(provider.key)}
              >
                Continue with {provider.label}
              </button>
            ))}
          </div>
          {disabledProviders.length > 0 && (
            <div className="muted" style={{ marginTop: 12, fontSize: 13 }}>
              Disabled: {disabledProviders.map((p) => p.label).join(", ")}
              {missingProviders.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  Configure env vars to enable: {missingProviders.join("; ")}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Have Items</h2>
        <span className="pill">Field ready</span>
      </div>
      <p className="muted" style={{ marginTop: 4, marginBottom: 18 }}>
        Signed in as <strong>{user?.email}</strong>
      </p>

      {error && <p className="error">Error: {error}</p>}
      {plantError && <p className="error">Plant catalog: {plantError}</p>}

      <div className="card" style={{ marginBottom: 16 }}>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}
        >
          <div style={{ flex: "1 1 200px" }}>
            <label>
              Name<br />
              <input
                placeholder="Heirloom tomatoes"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
          </div>
          <div style={{ width: 120 }}>
            <label>
              Qty<br />
              <input
                type="number"
                value={form.qty}
                min={1}
                onChange={(e) => setForm({ ...form, qty: e.target.value })}
              />
            </label>
          </div>
          <div style={{ flex: "1 1 220px" }}>
            <label>
              Plant profile<br />
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
          <div style={{ flex: "1 1 220px" }}>
            <label>
              Notes<br />
              <input
                placeholder="Growing conditions, variety..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
          </div>
          <button type="submit">{loading ? "Adding..." : "Add"}</button>
        </form>
      </div>

      {loadingList && <p className="muted">Loading your garden inventory...</p>}

      <ul className="list-plain" style={{ marginTop: 12 }}>
        {!loadingList && items.length === 0 && <li>No have items yet.</li>}
        {items.map((it) => (
          <li key={it.id} className="card">
            {editingId === it.id ? (
              <form onSubmit={saveEdit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                  style={{ minWidth: 140 }}
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
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="submit">Save</button>
                  <button type="button" className="secondary" onClick={() => setEditingId("")}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{it.name}</div>
                  <div className="muted" style={{ fontSize: 14 }}>
                    Qty {it.qty}
                    {it.plant?.commonName ? ` | ${it.plant.commonName}` : ""}
                    {it.notes && <em> ({it.notes})</em>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <button onClick={() => updateItem(it.id, { qty: it.qty + 1 })}>+1</button>
                  {it.qty > 1 && (
                    <button onClick={() => updateItem(it.id, { qty: it.qty - 1 })}>-1</button>
                  )}
                  <button onClick={() => beginEdit(it)}>Edit</button>
                  <button
                    onClick={() => handleDelete(it.id)}
                    className="secondary"
                    style={{ color: "var(--terracotta)", borderColor: "var(--terracotta)" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
