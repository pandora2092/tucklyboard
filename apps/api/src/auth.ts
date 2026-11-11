import { createHmac, timingSafeEqual } from "node:crypto";
export function verifyTelegram(
  data: string,
  token: string,
  now = Date.now(),
): { id: number; first_name: string } {
  const params = new URLSearchParams(data);
  const hash = params.get("hash");
  if (!hash || !/^[a-f0-9]{64}$/.test(hash))
    throw new Error("Invalid signature");
  params.delete("hash");
  const check = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const expected = createHmac("sha256", secret).update(check).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, "hex")))
    throw new Error("Invalid signature");
  const age = now / 1000 - Number(params.get("auth_date"));
  if (!Number.isFinite(age) || age < -30 || age > 3600)
    throw new Error("Expired authorization");
  const user = JSON.parse(params.get("user") || "{}");
  if (!Number.isSafeInteger(user.id) || user.id <= 0)
    throw new Error("Invalid user");
  return user;
}
