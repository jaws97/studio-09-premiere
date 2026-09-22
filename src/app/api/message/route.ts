import { store } from "@/server/store";

export async function POST(req: Request) {
  const { name, text } = (await req.json().catch(() => ({}))) as { name?: unknown; text?: unknown };
  if (typeof name !== "string" || typeof text !== "string") return Response.json({ error: "bad message" }, { status: 400 });
  // count characters, not UTF-16 units, so a cut never splits an emoji
  const clean = Array.from(text.trim().replace(/\s+/g, " ")).slice(0, 80).join("");
  if (!clean) return Response.json({ error: "too short" }, { status: 400 });
  // straight onto the big screen: no moderation
  await store.addWish(name.trim().slice(0, 48) || "A guest", clean);
  return Response.json({ ok: true });
}
