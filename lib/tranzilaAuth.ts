import crypto from "crypto";

function makeNonce(length = 80) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

// Tranzila sample:
// hash = HMAC_SHA256(message=publicKey, secret=privateKey + time + nonce)
export function tranzilaHeaders() {
  const key = process.env.TRANZILA_APP_PUBLIC_KEY!;
  const priv = process.env.TRANZILA_APP_PRIVATE_KEY!;
  if (!key || !priv) throw new Error("Missing TRANZILA_APP_PUBLIC_KEY/PRIVATE_KEY");

  const time = Math.round(Date.now() / 1000).toString();
  const nonce = makeNonce(80);
  const secret = `${priv}${time}${nonce}`;

  const hash = crypto.createHmac("sha256", secret).update(key).digest("hex");

  return {
    "Content-Type": "application/json",
    "X-tranzila-api-app-key": key,
    "X-tranzila-api-request-time": time,
    "X-tranzila-api-nonce": nonce,
    "X-tranzila-api-access-token": hash,
  } as Record<string, string>;
}
