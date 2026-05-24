import { createHmac, timingSafeEqual } from "node:crypto";

if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error("[FATAL] SESSION_SECRET est absent en production — définir cette variable d'environnement avant de démarrer le serveur");
}

const secret = process.env.SESSION_SECRET ?? "torquepilot-local-dev-secret-change-later";

function sign(value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function makeSession(userId: number) {
  const value = String(userId);
  return `${value}.${sign(value)}`;
}

export function readSession(token?: string | null) {
  if (!token) return null;
  const [value, sig] = token.split(".");
  if (!value || !sig) return null;
  const expected = sign(value);
  if (sig.length !== expected.length) return null;
  const ok = timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  return ok ? Number(value) : null;
}
