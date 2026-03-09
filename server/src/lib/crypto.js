import crypto from "crypto";

let warned = false;

function resolveKey() {
  const raw = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length === 32) return buf;
  return null;
}

export function encryptValue(value) {
  if (!value) return null;
  const key = resolveKey();
  if (!key) {
    if (!warned) {
      warned = true;
      console.warn("OAUTH_TOKEN_ENCRYPTION_KEY missing or invalid; tokens will not be stored.");
    }
    return null;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}
