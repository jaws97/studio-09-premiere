import { store } from "@/server/store";

export async function POST(req: Request) {
  const { name, text } = (await req.json().catch(() => ({}))) as { name?: unknown; text?: unknown };
  if (typeof name !== "string" || typeof text !== "string") return Response.json({ error: "bad message" }, { status: 400 });
  const clean = text.trim().replace(/\s+/g, " ").slice(0, 80);
  if (clean.length < 2) return Response.json({ error: "too short" }, { status: 400 });
  // every message waits for the host's approval before it reaches the screen
  await store.addWish(name.trim().slice(0, 48) || "A guest", clean);
  return Response.json({ ok: true });
}
