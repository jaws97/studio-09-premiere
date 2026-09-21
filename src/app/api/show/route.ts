import { store } from "@/server/store";

/** Polled by /screen, /host and /join. `?rev=` lets unchanged polls stay tiny. */
export async function GET(req: Request) {
  const show = await store.getShow();
  const rev = new URL(req.url).searchParams.get("rev");
  const body = rev !== null && Number(rev) === show.rev ? { rev: show.rev } : show;
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
