import type { HostAction } from "@/lib/show-core";
import { isHost } from "@/server/auth";
import { store } from "@/server/store";

export async function POST(req: Request) {
  if (!(await isHost())) return Response.json({ error: "host only" }, { status: 401 });
  const action = (await req.json().catch(() => null)) as HostAction | null;
  if (!action || typeof action.type !== "string") return Response.json({ error: "bad action" }, { status: 400 });
  return Response.json(await store.host(action));
}
