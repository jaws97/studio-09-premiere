import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { films } from "@/data/season";
import { initialShow, SEATS, stepShow, type HostAction, type ShowState } from "@/lib/show-core";

/**
 * Storage seam. Everything the routes need goes through `ShowStore`, so the
 * file-backed store below (one Node process: `next dev` / `next start` on the
 * projector laptop or any single-instance host) can be swapped for a Supabase
 * store on Vercel without touching routes or UI.
 */
export type Ticket = { id: string; name: string; seat: number; star: boolean; admittedAt?: number };
export type PendingWish = { id: string; name: string; text: string; at: number; status: Review };
export type PendingPhoto = { id: string; name: string; type: string; at: number; status: Review };
type Review = "pending" | "approved" | "rejected";

export interface ShowStore {
  getShow(): Promise<ShowState>;
  host(action: HostAction): Promise<ShowState>;
  issueTicket(name: string): Promise<Ticket>;
  admit(ticketId: string): Promise<Ticket | null>;
  clap(n: number): Promise<void>;
  addWish(name: string, text: string): Promise<void>;
  addPhoto(name: string, type: string, bytes: Uint8Array): Promise<void>;
  readPhoto(id: string, includeUnapproved: boolean): Promise<{ type: string; bytes: Uint8Array } | null>;
  queue(): Promise<{ wishes: PendingWish[]; photos: PendingPhoto[] }>;
  moderate(kind: "wish" | "photo", id: string, approve: boolean): Promise<void>;
}

const newId = (n = 9) => randomBytes(n).toString("base64url");
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

type Data = { show: ShowState; tickets: Ticket[]; wishes: PendingWish[]; photos: PendingPhoto[] };

const DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "show.json");
const PHOTO_DIR = path.join(DIR, "photos");
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

class FileStore implements ShowStore {
  private data: Data | null = null;
  private loading: Promise<Data> | null = null;
  private saveTimer: NodeJS.Timeout | null = null;

  private load(): Promise<Data> {
    if (this.data) return Promise.resolve(this.data);
    this.loading ??= (async () => {
      let d: Data = { show: initialShow, tickets: [], wishes: [], photos: [] };
      try {
        const raw = JSON.parse(await readFile(FILE, "utf8")) as Partial<Data>;
        d = { ...d, ...raw, show: { ...initialShow, ...raw.show } };
      } catch {}
      return (this.data = d);
    })();
    return this.loading;
  }

  /** bump rev and persist soon; a crash loses at most ~300ms of bravos */
  private touch(d: Data, show: ShowState = d.show) {
    d.show = { ...show, rev: d.show.rev + 1 };
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(async () => {
      this.saveTimer = null;
      try {
        await mkdir(DIR, { recursive: true });
        await writeFile(FILE + ".tmp", JSON.stringify(this.data));
        await rename(FILE + ".tmp", FILE);
      } catch (e) {
        console.error("[store] save failed", e);
      }
    }, 300);
  }

  async getShow() {
    return (await this.load()).show;
  }

  async host(action: HostAction) {
    const d = await this.load();
    if (action.type === "reset") {
      await Promise.all(d.photos.map((p) => unlink(this.photoPath(p)).catch(() => {})));
      d.tickets = [];
      d.wishes = [];
      d.photos = [];
      this.touch(d, { ...initialShow });
    } else if (action.type === "simulate") {
      const seat = this.freeSeat(d, false);
      if (seat) {
        const star = seat <= films.length;
        const name = star ? films[seat - 1].star : `Guest ${String(seat).padStart(2, "0")}`;
        d.tickets.push({ id: newId(), name, seat, star, admittedAt: Date.now() });
        this.touch(d, { ...d.show, seated: [...d.show.seated, { seat, name, star, at: Date.now() }] });
      }
    } else {
      const next = stepShow(d.show, action, films.length);
      if (next !== d.show) this.touch(d, next);
    }
    return d.show;
  }

  /** cast keep seats 1..27 (their billing number); everyone else gets a random free seat behind them */
  private freeSeat(d: Data, reserveCast = true): number | null {
    const taken = new Set(d.tickets.map((t) => t.seat));
    const from = reserveCast ? films.length + 1 : 1;
    const free: number[] = [];
    for (let s = from; s <= SEATS; s++) if (!taken.has(s)) free.push(s);
    // house full: overflow "balcony" seats past the map rather than turning anyone away
    if (!free.length) return reserveCast ? Math.max(SEATS, ...taken) + 1 : null;
    return free[Math.floor(Math.random() * free.length)];
  }

  async issueTicket(rawName: string) {
    const d = await this.load();
    const name = rawName.trim().replace(/\s+/g, " ").slice(0, 48);
    const i = films.findIndex((f) => norm(f.star) === norm(name));
    const castSeatFree = i >= 0 && !d.tickets.some((t) => t.seat === i + 1);
    const ticket: Ticket = castSeatFree
      ? { id: newId(), name: films[i].star, seat: i + 1, star: true }
      : { id: newId(), name, seat: this.freeSeat(d)!, star: false };
    d.tickets.push(ticket);
    this.touch(d);
    return ticket;
  }

  async admit(ticketId: string) {
    const d = await this.load();
    const t = d.tickets.find((x) => x.id === ticketId);
    if (!t) return null;
    if (!t.admittedAt) {
      t.admittedAt = Date.now();
      this.touch(d, {
        ...d.show,
        seated: [...d.show.seated, { seat: t.seat, name: t.name, star: t.star, at: t.admittedAt }],
      });
    }
    return t;
  }

  async clap(n: number) {
    const d = await this.load();
    this.touch(d, { ...d.show, applause: d.show.applause + n });
  }

  async addWish(name: string, text: string) {
    const d = await this.load();
    d.wishes.push({ id: newId(), name, text, at: Date.now(), status: "pending" });
    this.touch(d);
  }

  private photoPath(p: PendingPhoto) {
    return path.join(PHOTO_DIR, `${p.id}.${EXT[p.type]}`);
  }

  async addPhoto(name: string, type: string, bytes: Uint8Array) {
    const d = await this.load();
    const p: PendingPhoto = { id: newId(), name, type, at: Date.now(), status: "pending" };
    await mkdir(PHOTO_DIR, { recursive: true });
    await writeFile(this.photoPath(p), bytes);
    d.photos.push(p);
    this.touch(d);
  }

  async readPhoto(id: string, includeUnapproved: boolean) {
    const d = await this.load();
    const p = d.photos.find((x) => x.id === id);
    if (!p || (p.status !== "approved" && !includeUnapproved)) return null;
    try {
      return { type: p.type, bytes: new Uint8Array(await readFile(this.photoPath(p))) };
    } catch {
      return null;
    }
  }

  async queue() {
    const d = await this.load();
    return {
      wishes: d.wishes.filter((w) => w.status === "pending"),
      photos: d.photos.filter((p) => p.status === "pending"),
    };
  }

  async moderate(kind: "wish" | "photo", id: string, approve: boolean) {
    const d = await this.load();
    const item = (kind === "wish" ? d.wishes : d.photos).find((x) => x.id === id);
    if (!item || item.status !== "pending") return;
    item.status = approve ? "approved" : "rejected";
    if (!approve) return this.touch(d);
    if (kind === "wish") {
      const w = item as PendingWish;
      this.touch(d, { ...d.show, wishes: [...d.show.wishes, { id: w.id, name: w.name, text: w.text }] });
    } else {
      this.touch(d, { ...d.show, photos: [...d.show.photos, id] });
    }
  }
}

// one instance per process, surviving dev HMR
const g = globalThis as unknown as { __studio09Store?: ShowStore };
export const store: ShowStore = (g.__studio09Store ??= new FileStore());
