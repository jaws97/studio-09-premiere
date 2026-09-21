import { store } from "@/server/store";

export async function POST(req: Request) {
  const { name } = (await req.json().catch(() => ({}))) as { name?: unknown };
  if (typeof name !== "string" || name.trim().length < 2) return Response.json({ error: "name required" }, { status: 400 });
  return Response.json(await store.issueTicket(name));
}
