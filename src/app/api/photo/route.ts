import { store } from "@/server/store";

const MAX = 1_500_000;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  const name = String(form?.get("name") ?? "").trim().slice(0, 48) || "A guest";
  if (!(file instanceof File) || !TYPES.has(file.type) || file.size > MAX)
    return Response.json({ error: "photo must be a jpeg/png/webp under 1.5MB" }, { status: 400 });
  await store.addPhoto(name, file.type, new Uint8Array(await file.arrayBuffer()));
  return Response.json({ ok: true });
}
