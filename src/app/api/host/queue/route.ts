import { isHost } from "@/server/auth";
import { store } from "@/server/store";

export async function GET() {
  if (!(await isHost())) return Response.json({ error: "host only" }, { status: 401 });
  return Response.json(await store.queue(), { headers: { "Cache-Control": "no-store" } });
}
