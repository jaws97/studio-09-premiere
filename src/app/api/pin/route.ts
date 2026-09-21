import { signIn } from "@/server/auth";

export async function POST(req: Request) {
  const { pin } = (await req.json().catch(() => ({}))) as { pin?: unknown };
  // slow guessing down a little; the PIN is a party lock, not a vault
  await new Promise((r) => setTimeout(r, 400));
  const ok = typeof pin === "string" && (await signIn(pin));
  return Response.json({ ok }, { status: ok ? 200 : 401 });
}
