import "server-only";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { films } from "@/data/season";
import { initialShow, SEATS, stepShow, type HostAction, type ShowState } from "@/lib/show-core";
import type { ShowStore, Ticket } from "./store";

/**
 * ShowStore for serverless hosts (Vercel), where there is no shared memory or
 * disk between requests. Schema and SQL functions: supabase/schema.sql.
 * Every write that can race is a single SQL statement or a compare-and-swap.
 */
const BUCKET = "s09-photos";
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const newId = (n = 9) => randomBytes(n).toString("base64url");
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

type TicketRow = { id: string; name: string; seat: number; star: boolean; admitted_at: string | null };
const toTicket = (r: TicketRow): Ticket => ({
  id: r.id,
  name: r.name,
  seat: r.seat,
  star: r.star,
  admittedAt: r.admitted_at ? Date.parse(r.admitted_at) : undefined,
});

export class SupabaseStore implements ShowStore {
  private db: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  private fail(where: string, error: { message: string } | null): never {
    throw new Error(`[supabase] ${where}: ${error?.message ?? "no row — has supabase/schema.sql been run?"}`);
  }

  async getShow(): Promise<ShowState> {
    const { data, error } = await this.db.from("s09_show").select("state, rev").eq("id", "main").maybeSingle();
    if (error || !data) this.fail("getShow", error);
    return { ...initialShow, ...(data.state as Partial<ShowState>), rev: data.rev as number };
  }

  /** compare-and-swap with a few retries; bravos bump rev constantly, so a host action can lose a race or two */
  private async mutate(fn: (s: ShowState) => ShowState): Promise<ShowState> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const current = await this.getShow();
      const next = fn(current);
      if (next === current) return current;
      const { rev: _rev, ...state } = next;
      const { data, error } = await this.db.rpc("s09_cas", { expected: current.rev, next_state: state });
      if (error) this.fail("mutate", error);
      if (typeof data === "number") return { ...next, rev: data };
    }
    throw new Error("[supabase] mutate: too much contention");
  }

  async host(action: HostAction) {
    if (action.type === "reset") {
      const { data: photos } = await this.db.from("s09_photos").select("id, type");
      const paths = (photos ?? []).map((p) => `${p.id}.${EXT[p.type as string]}`);
      if (paths.length) await this.db.storage.from(BUCKET).remove(paths);
      await Promise.all(
        ["s09_tickets", "s09_wishes", "s09_photos"].map((t) => this.db.from(t).delete().neq("id", "")),
      );
      return this.mutate(() => ({ ...initialShow }));
    }
    if (action.type === "simulate") {
      const seat = await this.freeSeat(false);
      if (seat) {
        const star = seat <= films.length;
        const name = star ? films[seat - 1].star : `Guest ${String(seat).padStart(2, "0")}`;
        const t = await this.insertTicket(name, seat, star);
        if (t) await this.admit(t.id);
      }
      return this.getShow();
    }
    return this.mutate((s) => stepShow(s, action, films.length));
  }

  private async takenSeats() {
    const { data, error } = await this.db.from("s09_tickets").select("seat");
    if (error) this.fail("takenSeats", error);
    return new Set((data ?? []).map((r) => r.seat as number));
  }

  /** cast keep seats 1..27; everyone else gets a random free seat behind them, then the balcony */
  private async freeSeat(reserveCast = true): Promise<number | null> {
    const taken = await this.takenSeats();
    const free: number[] = [];
    for (let s = reserveCast ? films.length + 1 : 1; s <= SEATS; s++) if (!taken.has(s)) free.push(s);
    if (!free.length) return reserveCast ? Math.max(SEATS, ...taken) + 1 : null;
    return free[Math.floor(Math.random() * free.length)];
  }

  /** null when the seat was taken by a concurrent request (unique constraint) */
  private async insertTicket(name: string, seat: number, star: boolean): Promise<Ticket | null> {
    const { data, error } = await this.db
      .from("s09_tickets")
      .insert({ id: newId(), name, seat, star })
      .select()
      .maybeSingle();
    if (error?.code === "23505") return null;
    if (error || !data) this.fail("insertTicket", error);
    return toTicket(data as TicketRow);
  }

  async issueTicket(rawName: string) {
    const name = rawName.trim().replace(/\s+/g, " ").slice(0, 48);
    const i = films.findIndex((f) => norm(f.star) === norm(name));
    if (i >= 0) {
      const cast = await this.insertTicket(films[i].star, i + 1, true);
      if (cast) return cast; // otherwise someone already claimed the cast seat: fall through to a guest seat
    }
    for (let attempt = 0; attempt < 12; attempt++) {
      const t = await this.insertTicket(name, (await this.freeSeat())!, false);
      if (t) return t;
    }
    throw new Error("[supabase] issueTicket: could not find a free seat");
  }

  async getTicket(ticketId: string) {
    const { data, error } = await this.db.from("s09_tickets").select().eq("id", ticketId).maybeSingle();
    if (error) this.fail("getTicket", error);
    return data ? toTicket(data as TicketRow) : null;
  }

  async admit(ticketId: string) {
    // only the request that flips admitted_at from null announces the guest, so double taps seat nobody twice
    const at = new Date();
    const { data: fresh, error } = await this.db
      .from("s09_tickets")
      .update({ admitted_at: at.toISOString() })
      .eq("id", ticketId)
      .is("admitted_at", null)
      .select()
      .maybeSingle();
    if (error) this.fail("admit", error);
    if (fresh) {
      const t = toTicket(fresh as TicketRow);
      const { error: e2 } = await this.db.rpc("s09_push", {
        key: "seated",
        item: { seat: t.seat, name: t.name, star: t.star, at: at.getTime() },
      });
      if (e2) this.fail("admit/push", e2);
      return t;
    }
    const { data: existing } = await this.db.from("s09_tickets").select().eq("id", ticketId).maybeSingle();
    return existing ? toTicket(existing as TicketRow) : null;
  }

  async clap(n: number) {
    const { error } = await this.db.rpc("s09_clap", { n });
    if (error) this.fail("clap", error);
  }

  async addWish(name: string, text: string) {
    const id = newId();
    const { error } = await this.db.from("s09_wishes").insert({ id, name, text, status: "approved" });
    if (error) this.fail("addWish", error);
    const { error: e2 } = await this.db.rpc("s09_push", { key: "wishes", item: { id, name, text, at: Date.now() } });
    if (e2) this.fail("addWish/push", e2);
  }

  async addPhoto(name: string, type: string, bytes: Uint8Array) {
    const id = newId();
    const up = await this.db.storage.from(BUCKET).upload(`${id}.${EXT[type]}`, bytes, { contentType: type });
    if (up.error) this.fail(`addPhoto/upload (is there a private "${BUCKET}" bucket?)`, up.error);
    const { error } = await this.db.from("s09_photos").insert({ id, name, type, status: "approved" });
    if (error) this.fail("addPhoto", error);
    const { error: e2 } = await this.db.rpc("s09_push", { key: "photos", item: id });
    if (e2) this.fail("addPhoto/push", e2);
  }

  async readPhoto(id: string) {
    const { data: p } = await this.db.from("s09_photos").select("type").eq("id", id).maybeSingle();
    if (!p) return null;
    const { data: blob } = await this.db.storage.from(BUCKET).download(`${id}.${EXT[p.type as string]}`);
    return blob ? { type: p.type as string, bytes: new Uint8Array(await blob.arrayBuffer()) } : null;
  }
}
