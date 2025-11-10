import React from "react";
import { useEffect, useState } from "react";
import { Auth, Inventory } from "./api.js";


export default function HavePage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [me, setMe] = useState(null);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: "", qty: 1, notes: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function ensureAuth() {
    try {
      const user = await Auth.me();
      setMe(user);
    } catch {
      // not logged in yet
    }
  }

  useEffect(() => {
    ensureAuth();
  }, []);

  useEffect(() => {
    if (me) refresh();
  }, [me]);

  async function refresh() {
    const data = await Inventory.list();
    setItems(data);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    try {
      await Auth.login(email, password);
      const user = await Auth.me();
      setMe(user);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (!form.name.trim()) throw new Error("Name is required");
      const created = await Inventory.createHave({
        name: form.name.trim(),
        qty: Number(form.qty) || 1,
        notes: form.notes || undefined,
      });
      setItems((prev) => [created, ...prev]);
      setForm({ name: "", qty: 1, notes: "" });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateItem(id, patch) {
    try {
      const updated = await Inventory.update(id, patch);
      setItems((prev) => prev.map((it) => (it.id === id ? updated : it)));
    } catch (e) {
      setError(e.message);
    }
  }

  if (!me) {
    return (
      <div style={{ maxWidth: 420, margin: "3rem auto", fontFamily: "system-ui, sans-serif" }}>
        <h2>Login</h2>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <form onSubmit={handleLogin}>
          <label>
            Email
            <br />
            <input value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <br />
          <label>
            Password
            <br />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <br />
          <button type="submit">Sign in</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "2rem auto", fontFamily: "system-ui, sans-serif" }}>
      <h2>Have Items</h2>
      <p>
        Signed in as <strong>{me.email}</strong>
      </p>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <label>
            Name
            <br />
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
        </div>
        <div>
          <label>
            Qty
            <br />
            <input
              type="number"
              min={1}
              value={form.qty}
              onChange={(e) => setForm({ ...form, qty: e.target.value })}
            />
          </label>
        </div>
        <div style={{ flex: 1 }}>
          <label>
            Notes
            <br />
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
        </div>
        <button type="submit" disabled={loading}>{loading ? "Adding..." : "Add"}</button>
      </form>

      <ul>
        {items.length === 0 && <li>No items yet.</li>}
        {items.map((it) => (
          <li key={it.id} style={{ marginTop: 8, borderBottom: "1px solid #ddd", paddingBottom: 8 }}>
            <strong>{it.name}</strong> — qty {it.qty}
            {it.notes ? <em> ({it.notes})</em> : null}
            <button style={{ marginLeft: 8 }} onClick={() => updateItem(it.id, { qty: it.qty + 1 })}>+1</button>
            {it.qty > 1 && (
              <button onClick={() => updateItem(it.id, { qty: it.qty - 1 })}>-1</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
