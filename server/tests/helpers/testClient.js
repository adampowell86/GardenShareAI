const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function parseSetCookie(setCookie) {
  if (!setCookie) return [];
  if (Array.isArray(setCookie)) return setCookie;
  if (typeof setCookie === "string") {
    return setCookie.split(/,(?=[^;]+=)/);
  }
  return [];
}

export function createTestClient(baseUrl) {
  const jar = new Map();

  function storeCookies(res) {
    const setCookieHeader = res.headers.getSetCookie
      ? res.headers.getSetCookie()
      : res.headers.get("set-cookie");
    const cookies = parseSetCookie(setCookieHeader);
    cookies.forEach((cookie) => {
      const [pair] = cookie.split(";");
      const [name, value] = pair.split("=");
      if (name && value !== undefined) {
        jar.set(name.trim(), value.trim());
      }
    });
  }

  function cookieHeader() {
    return Array.from(jar.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  function getCookie(name) {
    return jar.get(name);
  }

  async function request(path, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    if (!SAFE_METHODS.has(method)) {
      const csrfToken = getCookie("csrf_token");
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
    }
    if (jar.size > 0) {
      headers.Cookie = cookieHeader();
    }
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });
    storeCookies(res);
    return res;
  }

  async function requestJson(path, options = {}) {
    const res = await request(path, options);
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    return { res, data };
  }

  return { request, requestJson, getCookie };
}
