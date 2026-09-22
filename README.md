# Studio 09 · The Premiere

Movie-premiere themed show for the September birthdays (event night: 7 Oct 2026). The big screen is the stage; phones are props. Full plan and decisions: [PLAN.md](PLAN.md).

## Run it

```bash
npm install
npm run dev
```

| Route | Who | What |
|---|---|---|
| `/` | everyone, before the night | Teaser lobby. Titles and cast stay sealed until `revealAt` in `src/data/event.ts` (`NEXT_PUBLIC_REVEAL=1` previews the reveal). |
| `/screen` | projector laptop (PIN) | The show. Always opens on the doors (QR) screen. Click once to arm sound + fullscreen. `←` `→` / space step the show if the remote dies; `Home` returns to doors; `i` toggles the popcorn intermission. After a mid-show refresh, jump back from `/host`. |
| `/host` | organiser's phone (PIN) | Remote: next/back, popcorn break (an intermission snipe over the current phase), jump to phase or premiere, mute, rehearsal tools, reset. |
| `/ticket` | guests | Box office → ticket → the usher swipes along the perforation to tear it. Seats the guest on `/screen`. |
| `/join` | guests, after admission | Bravo button (drives the applause meter), shout-outs and emoji reactions that appear live on the big screen, paparazzi photo. |

**PIN:** set `HOST_PIN` in `.env.local` (required in production). In development it falls back to `0909`.

**Local data:** `npm run dev` always uses the file store in `.data/`, even when `.env.local` holds Supabase credentials, so rehearsals and test tickets never land in the live database. To point local dev at the live database on purpose, run it with `STORE=supabase` in the environment (PowerShell: `$env:STORE="supabase"; npm run dev`). `/api/health` tells you which store is active.

**Rehearse without a crowd:** `npm run rehearse` simulates 100 guests arriving, tearing tickets, leaving messages and applauding (open `/screen` first; try `-- --guests 150 --arrive 60`). Reset from `/host` afterwards.

**Announcer:** lines live in `src/data/vo.ts`; `/host/script` is the recording sheet. Drop takes into `public/media/vo/<id>.mp3` — until then the browser voice stands in.

**Rehearse on real phones:** run the dev server, then open `http://<laptop-ip>:3000/ticket` on a phone on the same Wi-Fi.

## Deploy to Vercel

Vercel functions share no memory or disk, so the deployed app must use the Supabase store (it switches on automatically in production when the credentials are present).

1. **Supabase → SQL editor:** paste and run [supabase/schema.sql](supabase/schema.sql).
2. **Supabase → Storage:** create a bucket named `s09-photos` and leave it **private**.
3. **Vercel → Project → Settings → Environment Variables:**
   - `HOST_PIN` — your own PIN for `/screen` and `/host` (required; the app refuses to run staff pages without it).
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — already present if the Supabase integration is connected to this Vercel project. The service-role key is server-only; never prefix it with `NEXT_PUBLIC_`.
4. Deploy, then open `/api/health`. You want `{"ok":true,"store":"supabase","pin":true}`. Anything else tells you what is missing.
5. Load-test the real thing: `npm run rehearse -- --url https://<your-app>.vercel.app`, then **Reset show** from `/host`.

The titles stay sealed on `/` until `revealAt` in `src/data/event.ts`; `/screen` and `/host` are PIN-gated. Keep the repo private: it contains the cast list and the surprise.

## How it fits together

- `src/data/` — all event content (people, titles, copy). Re-skin here for next month's theme.
- `src/lib/show-core.ts` — show state + phase machine shared by server and client. Nothing secret lives in it.
- `src/server/store.ts` — `ShowStore` seam: file-backed locally (`.data/`), `src/server/supabase-store.ts` on Vercel. Racy writes (bravos, seating, approvals) are single SQL statements or compare-and-swap.
- `src/app/api/` — guests only ever POST (ticket, admit, clap, message, photo). Only `/screen` and `/host` poll `/api/show`.
- `src/lib/sfx.ts`, `src/lib/rip.ts` — all sound is synthesised with WebAudio; swap individual cues for recorded files later.
- Nothing is moderated. Messages pop up on the big screen as they arrive (emoji float up, text shows as a card) and text ones roll again in the credits; photos go straight to the paparazzi wall.
