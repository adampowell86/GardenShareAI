const API = import.meta.env.VITE_API_URL || "http://localhost:4000";


export async function api(path, { method = "GET", body, auth = true } = {}) {
const res = await fetch(`${API}${path}`, {
method,
headers: { "Content-Type": "application/json" },
credentials: "include", // send httpOnly cookie
body: body ? JSON.stringify(body) : undefined
});
if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
return res.json();
}


export const Auth = {
signup: (email, password) => api("/auth/signup", { method: "POST", body: { email, password }, auth: false }),
login: (email, password) => api("/auth/login", { method: "POST", body: { email, password }, auth: false }),
me: () => api("/auth/me", { method: "GET" })
};


export const Inventory = {
list: () => api("/inventory"),
createHave: (payload) => api("/inventory/have", { method: "POST", body: payload }),
update: (id, payload) => api(`/inventory/${id}`, { method: "PUT", body: payload })
};