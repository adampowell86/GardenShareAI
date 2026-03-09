export function cookieBaseOptions() {
  const secureCookies = process.env.NODE_ENV === "production";
  const crossSiteCookies = process.env.CROSS_SITE_COOKIES === "true";
  return {
    sameSite: crossSiteCookies ? "none" : "lax",
    secure: crossSiteCookies || secureCookies,
  };
}

export function authCookieOptions() {
  return { ...cookieBaseOptions(), httpOnly: true };
}

export function csrfCookieOptions() {
  return { ...cookieBaseOptions(), httpOnly: false };
}
