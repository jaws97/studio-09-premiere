import { store } from "@/server/store";

/** Phones batch their bravos and post about once a second. */
export async function POST(req: Request) {
  const { n } = (await req.json().catch(() => ({}))) as { n?: unknown };
  const claps = Math.max(0, Math.min(15, Number(n) | 0)); // nobody claps faster than 15/s
  if (claps) await store.clap(claps);
  return Response.json({ ok: true });
}
