import { store } from "@/server/store";

/** A phone asks once, when its page opens, whether its ticket still exists (a show reset voids them all). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ticket = await store.getTicket(id);
  return ticket
    ? Response.json(ticket, { headers: { "Cache-Control": "no-store" } })
    : Response.json({ error: "unknown ticket" }, { status: 404 });
}
