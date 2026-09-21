import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * One shared PIN guards /host, /screen and the host API. Set HOST_PIN in the
 * environment; the fallback only exists so local development works out of the box.
 */
const COOKIE = "s09_host";
const DEV_PIN = "0909";

function pin() {
  const p = process.env.HOST_PIN;
  if (p) return p;
  if (process.env.NODE_ENV === "production") throw new Error("HOST_PIN is not set");
  return DEV_PIN;
}

const token = () => createHmac("sha256", pin()).update("studio09-host").digest("base64url");

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export async function isHost() {
  const c = (await cookies()).get(COOKIE)?.value;
  return !!c && same(c, token());
}

export async function signIn(attempt: string) {
  if (!same(attempt, pin())) return false;
  (await cookies()).set(COOKIE, token(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return true;
}
