import { isHost } from "@/server/auth";
import { store } from "@/server/store";

export async function POST(req: Request) {
  if (!(await isHost())) return Response.json({ error: "host only" }, { status: 401 });
  const { kind, id, approve } = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if ((kind !== "wish" && kind !== "photo") || typeof id !== "string") return Response.json({ error: "bad request" }, { status: 400 });
  await store.moderate(kind, id, approve === true);
  return Response.json(await store.queue());
}
