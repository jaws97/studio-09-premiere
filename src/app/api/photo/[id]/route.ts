import { isHost } from "@/server/auth";
import { store } from "@/server/store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  // unapproved photos are visible to the host only (moderation queue)
  const photo = await store.readPhoto(id, await isHost());
  if (!photo) return new Response(null, { status: 404 });
  return new Response(photo.bytes as BodyInit, {
    headers: { "Content-Type": photo.type, "Cache-Control": "private, max-age=3600" },
  });
}
