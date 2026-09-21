#!/usr/bin/env node
/**
 * One-time Supabase setup: runs supabase/schema.sql and makes sure the private
 * photo bucket exists. Reads credentials from .env.local (vercel env pull) and
 * never prints them. Safe to re-run.
 *
 *   vercel env pull .env.local && node scripts/setup-supabase.mjs
 *   node scripts/setup-supabase.mjs --wipe     # also clear all show data (tickets, messages, photos, state)
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map(([, k, v]) => [k, v.replace(/^"(.*)"$/, "$1")]),
);
const need = (k) => env[k] ?? (console.error(`Missing ${k} in .env.local`), process.exit(1));

const db = new pg.Client({ connectionString: need("POSTGRES_URL_NON_POOLING").replace(/\?.*$/, ""), ssl: { rejectUnauthorized: false } });
await db.connect();
await db.query(readFileSync("supabase/schema.sql", "utf8"));
const { rows } = await db.query("select table_name from information_schema.tables where table_name like 's09_%' order by 1");
console.log("tables:", rows.map((r) => r.table_name).join(", "));
const fns = await db.query("select proname from pg_proc where proname like 's09_%' order by 1");
console.log("functions:", fns.rows.map((r) => r.proname).join(", "));
if (process.argv.includes("--wipe")) {
  await db.query("truncate s09_tickets, s09_wishes, s09_photos; update s09_show set state = '{}'::jsonb, rev = rev + 1 where id = 'main'");
  console.log("wiped: tickets, wishes, photos, show state");
}
await db.end();

const sb = createClient(need("SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const { data: buckets, error } = await sb.storage.listBuckets();
if (error) throw error;
if (buckets.some((b) => b.name === "s09-photos")) console.log("bucket: s09-photos already exists");
else {
  const made = await sb.storage.createBucket("s09-photos", { public: false, fileSizeLimit: 1_500_000 });
  if (made.error) throw made.error;
  console.log("bucket: s09-photos created (private)");
}
