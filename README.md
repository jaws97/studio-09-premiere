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
| `/screen` | projector laptop (PIN) | The show. Click once to arm sound + fullscreen. `←` `→` / space step the show if the remote dies. |
| `/host` | organiser's phone (PIN) | Remote: next/back, jump to phase or premiere, approve messages and photos, mute, rehearsal tools, reset. |
| `/ticket` | guests | Box office → ticket → the usher swipes along the perforation to tear it. Seats the guest on `/screen`. |
| `/join` | guests, after admission | Bravo button (drives the applause meter), a line for the end credits, paparazzi photo. |

**PIN:** set `HOST_PIN` in `.env.local` (required in production). In development it falls back to `0909`.

**Rehearse without a crowd:** `npm run rehearse` simulates 100 guests arriving, tearing tickets, leaving messages and applauding (open `/screen` first; try `-- --guests 150 --arrive 60`). Reset from `/host` afterwards.

**Announcer:** lines live in `src/data/vo.ts`; `/host/script` is the recording sheet. Drop takes into `public/media/vo/<id>.mp3` — until then the browser voice stands in.

**Rehearse on real phones:** run the dev server, then open `http://<laptop-ip>:3000/ticket` on a phone on the same Wi-Fi.

## How it fits together

- `src/data/` — all event content (people, titles, copy). Re-skin here for next month's theme.
- `src/lib/show-core.ts` — show state + phase machine shared by server and client. Nothing secret lives in it.
- `src/server/store.ts` — `ShowStore` seam. File-backed today (`.data/`, single Node process); a Supabase store slots in behind the same interface for Vercel.
- `src/app/api/` — guests only ever POST (ticket, admit, clap, message, photo). Only `/screen` and `/host` poll `/api/show`.
- `src/lib/sfx.ts`, `src/lib/rip.ts` — all sound is synthesised with WebAudio; swap individual cues for recorded files later.
- Guest messages and photos never reach the screen until approved on `/host`.
