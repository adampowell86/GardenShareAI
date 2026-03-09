export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
export const API_ORIGIN = new URL(API_BASE).origin;
export const AUTH_EVENT = "auth:unauthorized";
export const INVENTORY_EVENT = "inventory:changed";

// Helper to verify postMessage origins from the API host.
export function isApiOrigin(origin) {
  if (!API_ORIGIN) return false;
  try {
    return new URL(origin).host === new URL(API_ORIGIN).host;
  } catch {
    return false;
  }
}

const REFRESH_PATH = "/auth/refresh";
const NO_REFRESH_PATHS = ["/auth/login", "/auth/signup", "/auth/logout", REFRESH_PATH];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function getCookie(name) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function ensureCsrfToken() {
  if (getCookie("csrf_token")) return;
  try {
    await fetch(`${API_BASE}/auth/csrf`, {
      method: "GET",
      credentials: "include",
    });
  } catch {
    // Ignore CSRF refresh failures; request will error if token remains missing.
  }
}

function emitUnauthorized() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_EVENT));
}

export function emitInventoryChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(INVENTORY_EVENT));
}

async function tryRefresh() {
  try {
    const res = await fetch(`${API_BASE}${REFRESH_PATH}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });
    return res.ok;
  } catch {
    return false;
  }
}

function formatErrorMessage(error) {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    if (typeof error.message === "string") return error.message;
    const fieldErrors = error.fieldErrors || error.fielderrors;
    const formErrors = error.formErrors || error.formerrors;
    if (fieldErrors && typeof fieldErrors === "object") {
      const parts = Object.entries(fieldErrors)
        .flatMap(([field, messages]) => {
          if (Array.isArray(messages) && messages.length > 0) {
            return `${field}: ${messages.join(", ")}`;
          }
          return [];
        });
      if (parts.length > 0) return parts.join(" | ");
    }
    if (Array.isArray(formErrors) && formErrors.length > 0) {
      return formErrors.join(" | ");
    }
    try {
      return JSON.stringify(error);
    } catch {
      return "Request failed";
    }
  }
  return String(error);
}

async function request(path, options = {}) {
  const { _retry, headers, ...rest } = options;
  const method = (rest.method || "GET").toUpperCase();
  const needsCsrf = !SAFE_METHODS.has(method);
  if (needsCsrf) {
    await ensureCsrfToken();
  }
  const csrfToken = needsCsrf ? getCookie("csrf_token") : null;
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...(headers || {})
    },
    ...rest
  });

  if (
    res.status === 401 &&
    !_retry &&
    !NO_REFRESH_PATHS.some((noRefresh) => path.startsWith(noRefresh))
  ) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request(path, { ...options, _retry: true });
    }
  }

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    if (
      res.status === 401 &&
      !NO_REFRESH_PATHS.some((noAuth) => path.startsWith(noAuth))
    ) {
      emitUnauthorized();
    }
    const message = formatErrorMessage(data?.error) || `Request failed: ${res.status}`;
    throw new Error(message);
  }

  return data;
}

// Lightweight helper to make authenticated JSON requests.
export function api(path, options) {
  return request(path, options);
}

export const Auth = {
  async signup(email, password) {
    return request("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },

  async login(email, password) {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },

  async logout() {
    return request("/auth/logout", { method: "POST" });
  },

  async me() {
    try {
      const me = await request("/auth/me");
      return me || null;
    } catch (err) {
      if (err?.message?.toLowerCase().includes("unauthorized")) return null;
      throw err;
    }
  },

  async providers() {
    return request("/auth/providers");
  },

  async csrf() {
    return request("/auth/csrf");
  }
};

export const Experience = {
  async onboarding() {
    return request("/auth/me");
  },

  async providerStatus() {
    return request("/auth/providers");
  },
};

export const Inventory = {
  async list(status, { limit, offset } = {}) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (limit) params.set("limit", String(limit));
    if (offset) params.set("offset", String(offset));
    const query = params.toString() ? `?${params.toString()}` : "";
    return request(`/inventory${query}`);
  },
  async createHave(item) {
    return request("/inventory/have", {
      method: "POST",
      body: JSON.stringify(item)
    });
  },
  async createNeed(item) {
    return request("/inventory/need", {
      method: "POST",
      body: JSON.stringify(item)
    });
  },
  async update(id, patch) {
    return request(`/inventory/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch)
    });
  },
  async delete(id) {
    return request(`/inventory/${id}`, {
      method: "DELETE"
    });
  }
};

export const Matching = {
  async suggestions({ limit = 25, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    if (offset) params.set("offset", String(offset));
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request(`/matching/suggestions${suffix}`);
  }
};

export const Profile = {
  async me() {
    return request("/users/me");
  },
  async update(patch) {
    return request("/users/me", {
      method: "PUT",
      body: JSON.stringify(patch)
    });
  }
};

export const Timing = {
  async flags() {
    return request("/timing/flags");
  }
};

export const Gardens = {
  async list({ limit = 50, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    if (offset) params.set("offset", String(offset));
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request(`/gardens${suffix}`);
  },
  async create(payload) {
    return request("/gardens", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async update(id, payload) {
    return request(`/gardens/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  async delete(id) {
    return request(`/gardens/${id}`, {
      method: "DELETE"
    });
  }
};

export const Plants = {
  async list({ q = "", limit = 200, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (limit) params.set("limit", String(limit));
    if (offset) params.set("offset", String(offset));
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request(`/plants${suffix}`);
  },
  async create(payload) {
    return request("/plants", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async update(id, payload) {
    return request(`/plants/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  async delete(id) {
    return request(`/plants/${id}`, {
      method: "DELETE"
    });
  }
};

export const Geo = {
  async lookup(zip) {
    const encoded = encodeURIComponent(zip);
    return request(`/geo/lookup?zip=${encoded}`);
  }
};

export const Trades = {
  async create(haveItemId, needItemId) {
    return request("/trades", {
      method: "POST",
      body: JSON.stringify({ haveItemId, needItemId })
    });
  },
  async list({ status, limit, offset } = {}) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (limit) params.set("limit", String(limit));
    if (offset) params.set("offset", String(offset));
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request(`/trades${suffix}`);
  },
  async updateStatus(id, status) {
    return request(`/trades/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status })
    });
  },
  async accept(id) {
    return request(`/trades/${id}/accept`, { method: "POST" });
  },
  async reject(id) {
    return request(`/trades/${id}/reject`, { method: "POST" });
  },
  async cancel(id) {
    return request(`/trades/${id}/cancel`, { method: "POST" });
  }
};
