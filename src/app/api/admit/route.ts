import { store } from "@/server/store";

export async function POST(req: Request) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: unknown };
  const ticket = typeof id === "string" ? await store.admit(id) : null;
  return ticket ? Response.json(ticket) : Response.json({ error: "unknown ticket" }, { status: 404 });
}
