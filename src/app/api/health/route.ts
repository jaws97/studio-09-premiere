import { store, storeKind } from "@/server/store";

/** Deploy check: which store is live, can it be reached, is the PIN configured. Reveals no secrets. */
export async function GET() {
  const pin = !!process.env.HOST_PIN;
  // names only, never values: enough to see how the Supabase integration named its variables
  const env = Object.keys(process.env)
    .filter((k) => /SUPABASE|POSTGRES/.test(k))
    .sort();
  try {
    const show = await store.getShow();
    const warn =
      storeKind === "file" && process.env.VERCEL
        ? "File store on Vercel: state will not survive between requests. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
        : undefined;
    return Response.json({ ok: !warn && pin, store: storeKind, pin, phase: show.phase, rev: show.rev, warn, env });
  } catch (e) {
    return Response.json({ ok: false, store: storeKind, pin, error: String((e as Error).message), env }, { status: 500 });
  }
}
