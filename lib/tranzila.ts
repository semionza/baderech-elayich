import crypto from "crypto";

function makeNonce(length = 80) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

/**
 * Implements Tranzila auth headers per their sample:
 * hash = HMAC_SHA256(message=publicKey, secret=privateKey + time + nonce)
 */
export function tranzilaAuthHeaders() {
  const publicKey = process.env.TRANZILA_APP_PUBLIC_KEY!;
  const privateKey = process.env.TRANZILA_APP_PRIVATE_KEY!;
  if (!publicKey || !privateKey) throw new Error("Missing TRANZILA_APP_PUBLIC_KEY / TRANZILA_APP_PRIVATE_KEY");

  const time = Math.round(Date.now() / 1000).toString();
  const nonce = makeNonce(80);

  const secret = `${privateKey}${time}${nonce}`;
  const accessToken = crypto.createHmac("sha256", secret).update(publicKey).digest("hex");

  return {
    "Content-Type": "application/json",
    "X-tranzila-api-app-key": publicKey,
    "X-tranzila-api-request-time": time,
    "X-tranzila-api-nonce": nonce,
    "X-tranzila-api-access-token": accessToken,
  } as Record<string, string>;
}

export async function tranzilaPost<TReq extends object>(
  path: string,
  body: TReq
): Promise<{ ok: boolean; status: number; raw: string }> {
  const base = process.env.TRANZILA_API_BASE ?? "https://api.tranzila.com";
  const url = `${base}${path}`;

  const res = await fetch(url, {
    method: "POST",
    headers: tranzilaAuthHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const raw = await res.text();
  return { ok: res.ok, status: res.status, raw };
}
