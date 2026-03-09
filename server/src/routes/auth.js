// server/src/routes/auth.js
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import fetch from "node-fetch"; // ensure node-fetch v3 if using ESM
import * as jose from "jose";
import { prisma } from "../db.js";
import { encryptValue } from "../lib/crypto.js";
import { authCookieOptions } from "../lib/cookies.js";
import { loginSchema, signupSchema } from "../validation/schemas.js";

const router = Router();

const clientOrigin = process.env.CLIENT_ORIGIN;
const serverBaseUrl = process.env.SERVER_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
const storeOAuthTokens = process.env.STORE_OAUTH_TOKENS === "true";

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false
});

const oauthProviders = {
  google: {
    label: "Google",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authParams: { access_type: "offline", prompt: "consent" }
  },
  microsoft: {
    label: "Microsoft",
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scope: "offline_access openid email profile User.Read",
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET
  },
  discord: {
    label: "Discord",
    authUrl: "https://discord.com/api/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    scope: "identify email",
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET
  },
  apple: {
    label: "Apple",
    authUrl: "https://appleid.apple.com/auth/authorize",
    tokenUrl: "https://appleid.apple.com/auth/token",
    scope: "name email",
    responseMode: "form_post",
    clientId: process.env.APPLE_CLIENT_ID,
    teamId: process.env.APPLE_TEAM_ID,
    keyId: process.env.APPLE_KEY_ID,
    privateKey: process.env.APPLE_PRIVATE_KEY
  },
  whatsapp: {
    label: "WhatsApp",
    authUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scope: "public_profile,email",
    clientId: process.env.WHATSAPP_CLIENT_ID,
    clientSecret: process.env.WHATSAPP_CLIENT_SECRET
  }
};

function describeProvider(providerKey) {
  const provider = oauthProviders[providerKey];
  if (!provider) return { key: providerKey, label: providerKey, enabled: false, missing: ["unknown provider"] };

  const missing = [];
  if (!provider.clientId) missing.push("clientId");
  if (["google", "microsoft", "discord", "whatsapp"].includes(providerKey) && !provider.clientSecret) {
    missing.push("clientSecret");
  }
  if (providerKey === "apple") {
    if (!provider.teamId) missing.push("teamId");
    if (!provider.keyId) missing.push("keyId");
    if (!provider.privateKey) missing.push("privateKey");
  }

  return {
    key: providerKey,
    label: provider.label,
    enabled: missing.length === 0,
    missing,
    authPath: `/auth/oauth/${providerKey}/start`
  };
}

function listProviderStatuses() {
  return Object.keys(oauthProviders).map((key) => describeProvider(key));
}

function normalizeEmail(email) {
  return email ? email.trim().toLowerCase() : email;
}

function signTokens(user) {
  const accessToken = jwt.sign(
    { email: user.email },
    process.env.JWT_SECRET,
    { subject: user.id, expiresIn: `${process.env.TOKEN_TTL_MINUTES || 15}m` }
  );
  const refreshToken = jwt.sign(
    { email: user.email, type: "refresh" },
    process.env.JWT_SECRET,
    { subject: user.id, expiresIn: `${process.env.REFRESH_TTL_DAYS || 7}d` }
  );
  return { accessToken, refreshToken };
}

function setAuthCookies(res, tokens) {
  res
    .cookie("access_token", tokens.accessToken, { ...authCookieOptions(), path: "/" })
    .cookie("refresh_token", tokens.refreshToken, { ...authCookieOptions(), path: "/auth/refresh" });
}

function sanitizeRedirect(uri) {
  if (!uri) return clientOrigin;
  try {
    const parsed = new URL(uri);
    if (clientOrigin && parsed.origin !== clientOrigin) {
      return clientOrigin;
    }
    return parsed.origin;
  } catch {
    return clientOrigin;
  }
}

function createState(providerKey, redirectOrigin) {
  return jwt.sign(
    { provider: providerKey, redirect: redirectOrigin },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );
}

function parseState(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

function requireProviderConfig(providerKey) {
  const provider = oauthProviders[providerKey];
  if (!provider) {
    throw Object.assign(new Error("Unsupported provider"), { status: 400 });
  }
  const status = describeProvider(providerKey);
  if (!status.enabled) {
    const msg = `${provider.label} OAuth is not configured: missing ${status.missing.join(", ")}`;
    throw Object.assign(new Error(msg), { status: 500 });
  }
  return provider;
}

async function buildOnboardingState(userId, socialCount = 0, providerStatuses = []) {
  const hasEnabledProvider = providerStatuses.some((p) => p.enabled);
  const socialStepDone = socialCount > 0 || !hasEnabledProvider;

  const [haveCount, needCount, tradeCount] = await Promise.all([
    prisma.inventoryItem.count({ where: { userId, status: "HAVE", qty: { gt: 0 } } }),
    prisma.inventoryItem.count({ where: { userId, status: "NEED", qty: { gt: 0 } } }),
    prisma.trade.count({ where: { OR: [{ userAId: userId }, { userBId: userId }] } }),
  ]);

  const steps = [
    { key: "add-have", label: "Add what you can share", done: haveCount > 0 },
    { key: "add-need", label: "Add what you need", done: needCount > 0 },
    { key: "review-suggestions", label: "Review smart matches", done: haveCount > 0 && needCount > 0 },
    { key: "start-trade", label: "Start your first trade", done: tradeCount > 0 },
    {
      key: "connect-social",
      label: hasEnabledProvider ? "Connect a social login" : "Connect a social login (optional)",
      done: socialStepDone
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const progress = Math.round((completed / steps.length) * 100);

  return {
    steps,
    progress,
    completed: completed === steps.length,
    stats: { haveCount, needCount, tradeCount, socialCount },
  };
}

async function buildAppleClientSecret(provider) {
  const pk = provider.privateKey.replace(/\\n/g, "\n");
  const key = await jose.importPKCS8(pk, "ES256");
  const now = Math.floor(Date.now()/1000);
  return new jose.SignJWT({})
    .setProtectedHeader({ alg:"ES256", kid: provider.keyId })
    .setIssuedAt(now)
    .setIssuer(provider.teamId)
    .setAudience("https://appleid.apple.com")
    .setSubject(provider.clientId)
    .setExpirationTime(now + 600)
    .sign(key);
}

function buildAuthUrl(providerKey, redirectUri, state) {
  const provider = oauthProviders[providerKey];
  const urlObj = new URL(provider.authUrl);
  urlObj.searchParams.set("client_id", provider.clientId);
  urlObj.searchParams.set("redirect_uri", redirectUri);
  urlObj.searchParams.set("response_type", "code");
  urlObj.searchParams.set("scope", provider.scope);
  urlObj.searchParams.set("state", state);
  if (provider.responseMode) {
    urlObj.searchParams.set("response_mode", provider.responseMode);
  }
  if (provider.authParams) {
    for (const [k,v] of Object.entries(provider.authParams)) {
      urlObj.searchParams.set(k, v);
    }
  }
  return urlObj.toString();
}

async function exchangeCodeForTokens(providerKey, code, redirectUri) {
  const provider = oauthProviders[providerKey];
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: provider.clientId
  });
  if (providerKey === "apple") {
    params.set("client_secret", await buildAppleClientSecret(provider));
  } else {
    params.set("client_secret", provider.clientSecret);
  }

  const res = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg = data.error_description || data.error || "Token exchange failed";
    const err = new Error(errMsg);
    err.status = 400;
    throw err;
  }
  return data;
}

async function fetchProviderProfile(providerKey, tokens) {
  const expiresAt = tokens.expires_in ? Math.floor(Date.now()/1000) + Number(tokens.expires_in) : undefined;

  if (providerKey === "google") {
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const data = await profileRes.json();
    if (!profileRes.ok) throw new Error(data.error || "Failed fetching Google profile");
    return {
      provider: "google",
      providerAccountId: data.sub,
      email: data.email,
      name: data.name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt
    };
  }
  if (providerKey === "microsoft") {
    const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const data = await profileRes.json();
    if (!profileRes.ok) throw new Error(data.error?.message || "Failed fetching Microsoft profile");
    return {
      provider: "microsoft",
      providerAccountId: data.id,
      email: data.mail || data.userPrincipalName,
      name: data.displayName,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt
    };
  }
  if (providerKey === "discord") {
    const profileRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const data = await profileRes.json();
    if (!profileRes.ok) throw new Error(data.message || "Failed fetching Discord profile");
    return {
      provider: "discord",
      providerAccountId: data.id,
      email: data.email,
      name: data.global_name || data.username,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt
    };
  }
  if (providerKey === "apple") {
    if (!tokens.id_token) throw new Error("Missing Apple id_token");
    const jwks = jose.createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
    const { payload } = await jose.jwtVerify(tokens.id_token, jwks, {
      audience: oauthProviders.apple.clientId,
      issuer: "https://appleid.apple.com"
    });
    return {
      provider: "apple",
      providerAccountId: payload.sub,
      email: payload.email,
      name: payload.name || payload.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt
    };
  }
  if (providerKey === "whatsapp") {
    const profileRes = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(tokens.access_token)}`);
    const data = await profileRes.json();
    if (!profileRes.ok) throw new Error(data.error?.message || "Failed fetching WhatsApp/Meta profile");
    return {
      provider: "whatsapp",
      providerAccountId: data.id,
      email: data.email,
      name: data.name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt
    };
  }
  throw new Error("Unsupported provider");
}

async function linkOrCreateUser(profile) {
  const email = normalizeEmail(profile.email);
  if (!email) {
    const err = new Error("Provider did not return an email; cannot create account");
    err.status = 400;
    throw err;
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: { email, name: profile.name || undefined } });
  } else if (!user.name && profile.name) {
    user = await prisma.user.update({ where: { id: user.id }, data: { name: profile.name } });
  }

  const accessToken = storeOAuthTokens ? encryptValue(profile.accessToken) : null;
  const refreshToken = storeOAuthTokens ? encryptValue(profile.refreshToken) : null;

  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: profile.provider,
        providerAccountId: profile.providerAccountId
      }
    },
    update: {
      providerEmail: email,
      providerName: profile.name,
      accessToken,
      refreshToken,
      expiresAt: profile.expiresAt || null,
      userId: user.id
    },
    create: {
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
      providerEmail: email,
      providerName: profile.name,
      accessToken,
      refreshToken,
      expiresAt: profile.expiresAt || null,
      userId: user.id
    }
  });

  return user;
}

router.get("/providers", (_req, res) => {
  res.json(listProviderStatuses());
});

router.get("/csrf", (_req, res) => {
  res.json({ ok: true });
});

// --- Email/password routes ---
router.post("/signup", asyncHandler(async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const email = normalizeEmail(parsed.data.email);
  const password = parsed.data.password;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Account already exists" });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { email, passwordHash } });

  const tokens = signTokens(user);
  setAuthCookies(res, tokens);

  res.status(201).json({ id: user.id, email: user.email });
}));

router.post("/login", loginLimiter, asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const email = normalizeEmail(parsed.data.email);
  const password = parsed.data.password;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  if (!user.passwordHash) return res.status(400).json({ error: "This account uses social login only" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const tokens = signTokens(user);
  setAuthCookies(res, tokens);

  res.json({ id: user.id, email: user.email });
}));

router.post("/logout", (_req, res) => {
  res
    .clearCookie("access_token", { path: "/", ...authCookieOptions() })
    .clearCookie("refresh_token", { path: "/auth/refresh", ...authCookieOptions() })
    .json({ ok: true });
});

router.post("/refresh", asyncHandler(async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (payload.type !== "refresh") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const tokens = signTokens(user);
  setAuthCookies(res, tokens);
  return res.json({ ok: true });
}));

router.get("/me", asyncHandler(async (req, res) => {
  const token =
    req.cookies?.access_token ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null);

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      displayName: true,
      location: true,
      zip: true,
      radiusKm: true,
      latitude: true,
      longitude: true,
      bio: true,
      interests: true,
      accounts: true,
    }
  });
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const pendingTradeCount = await prisma.trade.count({
    where: {
      status: "PENDING",
      OR: [{ userAId: user.id }, { userBId: user.id }],
    },
  });

  const providerStatus = listProviderStatuses();
  const onboarding = await buildOnboardingState(user.id, user.accounts.length, providerStatus);

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    displayName: user.displayName,
    location: user.location,
    bio: user.bio,
    interests: user.interests,
    providers: user.accounts.map(a => a.provider),
    pendingTrades: pendingTradeCount,
    providerStatus,
    onboarding,
  });
}));

// --- OAuth start endpoint ---
router.get("/oauth/:provider/start", asyncHandler(async (req, res) => {
  const providerKey = req.params.provider;
  const provider = requireProviderConfig(providerKey);

  const redirectOrigin = sanitizeRedirect(req.query.redirect || clientOrigin);
  const redirectUri = `${serverBaseUrl}/auth/oauth/${providerKey}/callback`;
  const state = createState(providerKey, redirectOrigin);

  const url = buildAuthUrl(providerKey, redirectUri, state);
  return res.redirect(url);
}));

// --- OAuth callback handler ---
router.all("/oauth/:provider/callback", asyncHandler(async (req, res) => {
  const providerKey = req.params.provider;
  const provider = requireProviderConfig(providerKey);

  const code = req.method === "POST" ? req.body.code : req.query.code;
  const stateToken = req.method === "POST" ? req.body.state : req.query.state;
  if (!code || !stateToken) {
    return res.status(400).send("Missing code or state");
  }

  const parsedState = parseState(stateToken);
  if (!parsedState || parsedState.provider !== providerKey) {
    return res.status(400).send("Invalid state");
  }

  const redirectOrigin = sanitizeRedirect(parsedState.redirect);
  const redirectUri = `${serverBaseUrl}/auth/oauth/${providerKey}/callback`;

  try {
    const tokens = await exchangeCodeForTokens(providerKey, code, redirectUri);
    const profile = await fetchProviderProfile(providerKey, tokens);
    const user = await linkOrCreateUser(profile);

    const authTokens = signTokens(user);
    setAuthCookies(res, authTokens);

    const payload = { type: "oauth-success", provider: providerKey };
    const html = `
      <!doctype html>
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage(${JSON.stringify(payload)}, ${JSON.stringify(redirectOrigin)});
            }
            window.close();
          </script>
          <p>Login successful. You can close this window.</p>
        </body>
      </html>
    `;
    res.status(200).type("html").send(html);

  } catch (err) {
    console.error(`OAuth callback failed for provider=${providerKey}`, err);
    const payload = { type: "oauth-error", provider: providerKey, message: err.message };
    const html = `
      <!doctype html>
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage(${JSON.stringify(payload)}, ${JSON.stringify(redirectOrigin)});
            }
            window.close();
          </script>
          <p>Login failed. You can close this window.</p>
        </body>
      </html>
    `;
    res.status(400).type("html").send(html);
  }
}));

export default router;
