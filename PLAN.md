# Studio 09 · The Premiere — Plan

Event night: **7 Oct 2026**. 27 September-birthday stars. The big screen is the stage; phones are props.

## Surfaces (Next.js App Router)
| Route | Device | Purpose |
|---|---|---|
| `/` | any | Pre-event teaser: marquee, countdown, "coming soon" poster wall (upgraded mock) |
| `/screen` | projector laptop | The show. Phase-driven, no hover dependencies, big type, keyboard fallback |
| `/host` | host's phone (PIN) | Remote: next/prev phase, pick premiere, approve messages/photos, manual admit, kill-switch |
| `/t/[code]` + `/ticket` | guest phone | Personal ticket (link) or shared-QR name picker → ticket → usher swipes to tear |
| `/join` | guest phone | After admission: Bravo button, leave a credit message, paparazzi upload |

## Run of show (`phase` = one DB row, broadcast to all screens)
1. **doors** — marquee + giant QR + seat map; each tear lights a seat and announces "Now seated…"; paparazzi strip
2. **curtain** — house lights down, velvet curtain parts on a dark screen as the projector lamp strikes; runs on automatically
3. **leader** — 5-4-3-2-1 film leader with beeps and projector whirr; runs on automatically
4. **ident** — the team's own "Party People" ident film (`public/media/ident.mp4`, 15s, with sound); runs on automatically
5. **title** — "Studio 09 presents · The September Season" card + announcer; waits for the host
6. **trailer** — green band ("approved for all birthday audiences by Party People") → 45–60s season trailer
7. **premieres** — 27 × ~25s: clapperboard snap (scene = birthday date) → poster reveal → tagline + announcer line → applause window
8. **curtain-call** — live applause meter from every phone; confetti + "standing ovation" at peak
9. **credits** — cast, joke crew roles, approved guest messages, post-credits "Cake in the lobby"

## Wow factors (ranked, in scope)
1. Seat map + "Now seated" reacting live to ticket tears
2. Drag-to-tear ticket: perforation pivot, fibre edge, haptic ticks, rip audio sprite, confetti, "ADMITTED" stamp
3. Film leader → ident → curtain opening sequence with sound
4. Per-person AI poster (original stylised-3D look, homage composition, title in HTML)
5. Living posters (scope decided after pilot) — fallback: CSS parallax + holo foil
6. Live applause meter (throttled broadcast, aggregated every ~300ms)
7. Paparazzi wall (client compress → Supabase Storage → host approval → flashbulb entrance on screen)
8. End credits with guest messages (80 chars, profanity filter, host approval)
9. Film grain / gate weave / cue marks / fake projector beam with dust motes (baked PNG + CSS, no WebGL)
10. Clapperboard transitions, SplitText title cards, bulb flicker-on with hum

Out of scope: R3F scenes, WebGL cloth/volumetrics, Wallet passes, usher QR scanner, awards voting.

## Stack
Next.js (App Router, TS) on Vercel · Supabase (Postgres + Realtime Broadcast + Storage) · GSAP (+ScrollTrigger, SplitText, Flip) · Motion (drag/tear) · Howler (audio sprites) · canvas-confetti · qr-code-styling.

Principles: local-first interactions (tear always plays, sync queued) · `/screen` polls DB if socket drops · `realtime_enabled` kill-switch · media preloaded on the projector laptop · transform/opacity-only animation · `prefers-reduced-motion` honoured · rehearsal namespace + "simulate 60 guests" script + one-click wipe.

## Data
`guests(id, name, code, row, seat, is_star, device_token, admitted_at)` · `films(guest_id, title, source, release_day, poster_tier, poster_url, clip_url, tagline, credit_role)` · `show(id, phase, premiere_index, realtime_enabled)` · `messages(id, guest_id, text, approved)` · `photos(id, guest_id, path, approved)`. Applause is broadcast-only.

## Higgsfield asset pipeline
Reality: **one photo per person at best, and some people will send none.** Every star lands in one of three poster tiers — all three must look intentional, never like a placeholder.

| Tier | Input | Poster approach |
|---|---|---|
| **A · Star portrait** | 1 usable photo (face ≥ ~400px, not heavily filtered, no sunglasses) | Photo → stylised-3D character (single ref) → that output becomes the ref for the 2:3 poster. Hero is face-forward. |
| **B · Soft likeness** | Weak photo (tiny, group crop, side-on, low light) | Upscale/crop first; compose so likeness matters less — mid/long shot, 3/4 back view, dramatic rim light, character small in a big homage scene. |
| **C · Mystery billing** | No photo / no consent | No face at all: silhouette, back-to-camera, or object-led teaser poster (the frog's crown, the lamp, the glass slipper equivalent for their film). Billed as "Introducing…" — reads as a deliberate teaser-poster style. |

- Mix tiers across the wall so C posters look like an art-direction choice, not gaps. Aim for a few C-style posters even if photos exist, if it helps the mix.
- Tier is a field on `films` (`poster_tier`); the premiere engine treats all tiers identically (parallax + foil + VO), so nobody's moment is weaker.
- Living clips only for Tier A (likeness survives motion best); B/C get parallax + light sweeps.
- Photo intake: one shared folder/form, deadline **Sep 28**; anything not in by then → Tier C. Late photos can upgrade a poster until **Oct 3**.

Pilot first: **one Tier-A person end-to-end from a single photo** (photo → character → 2:3 poster → 5s clip) **plus one Tier-C poster**, to measure real credit cost and quality. Then decide clip scope.
- Posters ×27: `nano_banana_pro` 2k, single ref photo, bottom third clear for HTML title. Never name studios/films/characters in prompts.
- Living clips: `kling3_0` start-frame, subtle motion, no audio (3:4 or 9:16 — no 2:3 video).
- Ident: logo (`recraft_v4_1`) → 6–8s reveal with audio (`veo3_1` / `seedance_2_0`). No castle/lamp imitation.
- Announcer: `text2speech_v2`, deep male preset, ~35 lines (27 intros + show cues).
- Trailer: reuse clips + 4–6 hero shots; assemble locally (ffmpeg/Remotion).
- Consent: opt-in per person; non-likeness fallback poster; delete uploaded photos afterwards.

## Timeline
| Dates | Milestone |
|---|---|
| Sep 22–23 | Scaffold, design tokens, port mock to components, Supabase schema, Higgsfield pilot |
| Sep 24–27 | `/screen` phases + `/host` remote + opening sequence + premieres engine (placeholder art) |
| Sep 28–30 | Ticket + tear + seat map; applause; messages; paparazzi |
| Sep 25–Oct 2 | Asset production in parallel (posters → clips → ident → VO → trailer) |
| Oct 1–3 | Sound design, grain/beam polish, teaser page live, send ticket links |
| Oct 4–5 | Full rehearsal on real projector + hotspot + mid-range Android + iPhone; fix list |
| Oct 6 | Freeze. Wake Supabase, preload media, print backup QRs + paper guest list |
| Oct 7 | Opening night |

## Venue (confirmed)
Projector(s) + speakers available; lights can be dimmed (assume dim, not blackout).
- Sound design is fully in scope: leader beeps, projector whirr, curtain swoosh, ident audio, announcer VO, applause swell. Master everything to one loudness; `/host` gets a master volume + mute.
- Resolution unknown → build `/screen` as a fixed 16:9 stage (1920×1080 design size) scaled to fit, safe margins 5% (projector overscan/keystone). Must also survive 1280×720.
- Dim-not-dark room + projector washout → keep contrast high: cream/gold on near-black, avoid subtle dark-red-on-black detail, thicker type weights, grain/vignette kept light on `/screen`.
- Rehearsal checklist: laptop → projector via HDMI at native res, browser fullscreen, audio out through venue speakers (not laptop), autoplay unlocked by the host's first click.

## Audience & format (confirmed)
- Monthly recurring birthday event, new theme each month. The party isn't a surprise; **the theme, titles and posters are** — asking people for "a photo for the birthday event" is fine, never reveal the movie angle. Keep teaser link vague ("Studio 09 · Opening night") with posters hidden until show night.
- **100+ guests.** Guest phones must NOT hold realtime sockets (Supabase free cap = 200). Phones only make HTTP calls: admit POST, applause via Realtime **REST broadcast** in ~1s batches, message/photo uploads. Only `/screen` and `/host` subscribe. Seat map sized for ~120 with overflow "balcony".
- **AI announcer is the emcee**; organiser drives phases from `/host`. VO script ≈ 40 lines (show cues + 27 intros), each premiere intro is its own audio file keyed by guest.
- All event content (people, titles, copy, VO lines) lives in data files / DB, not components, so the shell (tickets, screen phases, host remote, applause, wall) can be re-skinned for future months.

## Build status
**Slice 1 (Sep 21) — done:** Next.js 16 scaffold · tokens + fonts · film data in `src/data/season.ts` · `/` lobby ported from the mock with a server-side title embargo (`src/data/event.ts` → `revealAt`; `NEXT_PUBLIC_REVEAL=1` to preview) · `/screen` 1920×1080 scaled stage with all 8 phases on placeholder art (doors + live seat map + real QR, film leader, ident, curtain, trailer slot, premieres with clapperboard, applause meter + confetti, credits roll) · `/host` remote (next/back, phase jump, premiere jump, rehearsal: simulate arrival / bravos / reset) · show state behind a transport seam in `src/lib/show.ts` (BroadcastChannel today → Supabase later). Keyboard on `/screen`: ←/→/space, `f` fullscreen.

**Slice 2 (Sep 21) — done:** `/ticket` box office (name → ticket; cast names get a gold ★ CAST ticket and their billing seat, others a hashed seat until the guest list is in the DB) · drag-to-tear along the perforation (monotonic tear, commits at 60%, springs back below; stub pivots from the attached end then falls away) · haptic tick per perforation + WebAudio-synthesised rip (`src/lib/rip.ts`, no assets) · confetti + ADMITTED stamp · tear dispatches `seat` so `/screen` lights the seat · "Tear ticket" button as accessible fallback · ticket persists in localStorage.

**Slice 3 (Sep 21) — done:** show state moved server-side behind a `ShowStore` seam (`src/server/store.ts`, file-backed in `.data/`) with route handlers under `/api` · `/screen` + `/host` poll `/api/show` (~450ms, rev-gated); guest phones never subscribe, they only POST · PIN gate (`HOST_PIN`, httpOnly cookie) on `/screen`, `/host` and host APIs — verified the embargoed titles are absent from guest-page bundles · server-assigned unique seats (cast keep 1–27, balcony overflow past 120) · local-first admit with retry · `/join`: batched bravo button, 80-char credit message, client-compressed paparazzi upload · host moderation queue (nothing reaches the screen unapproved) · paparazzi strip on doors, guest wishes in credits · synthesised sound for every phase (`src/lib/sfx.ts`) + "click to arm" overlay + host mute · premiere polish (searchlights, floating foil poster, staggered title words) · production build passes · private repo: github.com/jaws97/studio-09-premiere.

**Slice 4 (Sep 21) — done:** tagline per film (placeholder office humour, pronoun-free — swap in real inside jokes in `src/data/season.ts`) · announcer script in `src/data/vo.ts` (8 show cues + 27 premiere intros) with playback in `src/lib/vo.ts`: plays `public/media/vo/<id>.mp3` when present, otherwise the browser's speech voice reads the line so rehearsals already have an emcee · host-fired announcer cues ("tickets ready", "take your seats", "tonight's premieres") · `/host/script` recording sheet listing every line and its filename · film atmosphere on `/screen`: gate weave, drifting scratches, changeover cue mark on each premiere, projector beam with dust motes (quarter-res canvas) · applause meter now scales to the house (needle pins at ~1.5 claps/s per seated guest) · balcony count when arrivals pass 120 · `npm run rehearse` load/rehearsal script — **100 simulated guests: 0 failures, 0 duplicate seats, p50 30ms / p95 106ms** against the dev server.

**Slice 5 (Sep 21) — done:** walked the organiser through /screen in the browser · run of show reordered so the curtain opens before anything is projected (curtain → leader → ident → title auto-chain) · team ident film wired into the ident phase · first three generated no-face posters (01, 08, 21; `nano_banana_pro` 2k = **2 credits each**, measured) with HTML titles over the lower third · titles: "The Little Mermila", "Inside Anand"; a few taglines now play on name meanings · dev fix: the store singleton keeps only data across hot reloads, not code.

**Not yet seen by human eyes:** the PIN-gated `/screen` and `/host` visuals added in slice 3 (arm overlay, paparazzi strip, foil/searchlights, beam/scratches/cue mark, taglines, moderation queue, announcer buttons, /host/script) — the APIs behind them are tested, the pixels are not. All sound cues and the announcer fallback voice are untested by ear.

**Next:** Supabase `ShowStore` for Vercel (needs `vercel link` + `vercel env pull` by the organiser) · guest list import (so tickets match real names) · Higgsfield pilot (one photo) → posters → VO → ident → trailer · replace synth cues with VO/ident audio · gate weave / cue marks / dust-mote beam on `/screen` · rehearsal script ("simulate 100 guests") · real-device pass (mid-range Android + iPhone).

## Open questions
- Pilot person + their one photo
