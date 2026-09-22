#!/usr/bin/env node
/**
 * Dress rehearsal without the crowd: simulates guests arriving, tearing
 * tickets, leaving messages and hammering the bravo button, so you can watch
 * /screen react and see how the server copes before the real night.
 *
 *   node scripts/rehearse.mjs                       # 100 guests over ~40s, then a 15s ovation
 *   node scripts/rehearse.mjs --guests 150 --arrive 20 --ovation 25
 *   node scripts/rehearse.mjs --url https://your-deploy.vercel.app
 *
 * Uses only the public guest endpoints (no PIN). Reset afterwards from /host.
 */
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const BASE = String(arg("url", "http://127.0.0.1:3000")).replace(/\/$/, "");
const GUESTS = Number(arg("guests", 100));
const ARRIVE_S = Number(arg("arrive", 40));
const OVATION_S = Number(arg("ovation", 15));
const CAST_SHARE = 0.2; // roughly how many arrivals are tonight's cast

const first = ["Asha", "Vikram", "Meera", "Rohan", "Divya", "Karthik", "Neha", "Arjun", "Pooja", "Imran", "Lakshmi", "Sameer", "Tanvi", "Nikhil", "Farah", "Harish"];
const last = ["Iyer", "Menon", "Shah", "Reddy", "Kapoor", "Nair", "Das", "Joshi", "Pillai", "Khan", "Rao", "Bose"];
const wishes = ["Happy birthday, superstars!", "Oscar-worthy, every one of you.", "Sequel when?", "Best cast in the building.", "Cake first, credits later.", "Five stars. Would attend again.", "👏", "🔥", "🎉", "👏👏👏"];

const lat = [];
let failed = 0;
async function post(path, body) {
  const t = performance.now();
  try {
    const res = await fetch(BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    lat.push(performance.now() - t);
    if (!res.ok) failed++;
    return res.ok ? res.json() : null;
  } catch {
    failed++;
    return null;
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (a) => a[Math.floor(Math.random() * a.length)];

async function castNames() {
  // the ticket page ships the cast list for its name suggestions; reuse it
  const html = await fetch(BASE + "/ticket").then((r) => r.text()).catch(() => "");
  const m = html.match(/\\?"cast\\?":\[(.*?)\]/);
  if (!m) return [];
  return [...m[1].matchAll(/\\?"([^"\\]+)\\?"/g)].map((x) => x[1]);
}

async function guest(i, name) {
  await sleep(Math.random() * ARRIVE_S * 1000);
  const ticket = await post("/api/ticket", { name });
  if (!ticket) return null;
  await sleep(1500 + Math.random() * 4000); // queueing for the usher
  await post("/api/admit", { id: ticket.id });
  if (Math.random() < 0.15) await post("/api/message", { name, text: pick(wishes) });
  return ticket;
}

async function ovation(n) {
  const end = Date.now() + OVATION_S * 1000;
  let sent = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      await sleep(Math.random() * 1500);
      while (Date.now() < end) {
        // crowd swells then tires: more taps per second in the middle
        const phase = 1 - Math.abs((end - Date.now()) / (OVATION_S * 1000) - 0.5) * 2;
        const taps = Math.round(1 + phase * 6 * Math.random());
        sent += taps;
        await post("/api/clap", { n: taps });
        await sleep(1000);
      }
    }),
  );
  return sent;
}

const pct = (p) => {
  const s = [...lat].sort((a, b) => a - b);
  return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(s.length * p))]) : 0;
};

console.log(`Rehearsal against ${BASE}: ${GUESTS} guests arriving over ${ARRIVE_S}s`);
const cast = await castNames();
console.log(cast.length ? `Found ${cast.length} cast names` : "No cast list found; everyone arrives as a plain guest");
const castPool = [...cast].sort(() => Math.random() - 0.5);

const t0 = Date.now();
const tickets = (
  await Promise.all(
    Array.from({ length: GUESTS }, (_, i) => {
      const name = castPool.length && Math.random() < CAST_SHARE ? castPool.pop() : `${pick(first)} ${pick(last)} ${i + 1}`;
      return guest(i, name);
    }),
  )
).filter(Boolean);

const seats = tickets.map((t) => t.seat);
const dupes = seats.length - new Set(seats).size;
console.log(`Doors: ${tickets.length}/${GUESTS} admitted in ${((Date.now() - t0) / 1000).toFixed(1)}s · cast tickets ${tickets.filter((t) => t.star).length} · duplicate seats ${dupes}`);

console.log(`Ovation: ${tickets.length} phones for ${OVATION_S}s — watch the needle on /screen (curtain call phase)`);
const claps = await ovation(tickets.length);

const show = await fetch(BASE + "/api/show").then((r) => r.json());
console.log(`Server now reports: ${show.seated.length} seated · ${show.applause} bravos (sent ${claps} this run)`);
console.log(`Requests: ${lat.length} · failed ${failed} · latency p50 ${pct(0.5)}ms · p95 ${pct(0.95)}ms · max ${pct(1)}ms`);
if (dupes || failed) process.exitCode = 1;
