# Letter Launch — Master Plan

The single source of truth for what we're building and in what order. When you're
ready, just say **"let's get started"** and we work top-down from Phase 1.

> Game: physics word game — launch letter tiles through plinko bumpers into a 7×6
> gravity-stacked grid, drag across touching tiles (Boggle-style) to spell words,
> build streak multipliers. Vanilla HTML/CSS/JS, no framework, no build step to run.

---

## ✅ Already done (this session)

- Renamed everything to **Letter Launch** (storage migrated to `letterlaunch.*`).
- **Sound** (`audio.js`) — synthesized Web Audio SFX + persistent mute toggle.
- **Seeded daily challenge** (`rng.js`) — Free/Daily pill; deterministic letter
  stream per date; per-day best saved. *Foundation for the leaderboard.*
- **Share card** (`share.js`) — 1080×1350 PNG + text; Web Share / clipboard.
- `build.js` rebuilds the single-file `letter-launch-standalone.html`.

---

## 🎯 The strategy in one line

Cheapest path to "addicting + viral" = **feel (done) → a reason to return (daily +
leaderboard) → a reason to share (card, done) → depth (progression/store) → growth
loops → monetize.** Do NOT build real-time multiplayer until the daily + leaderboard
prove people care. Keep the project's discipline: one mechanic at a time, playtest,
then the next.

---

## PHASE 1 — Land the loop (do first)

Goal: a complete, sticky single-player loop you'd play daily and share.

1. **Haiku engine wire-up** *(blocked on you — bring the engine from your other game)*
   - Integration point is live: define `window.makeHaiku(seedWords)` →
     `string | {lines:[a,b,c]}`. It feeds both the end-screen card AND the share image.
   - I need: does it take the run's words or a theme? Is 5-7-5 guaranteed? Sync or async?
   - Then: load it as `haiku.js` before `game.js`, shape the card, handle the slow/async case.

2. **Real device pass** *(15 min, you)*
   - Serve, Add to Home Screen, play on a phone. Confirm SFX feel + share *image*
     (file-share is mobile-only; desktop copies text — expected).
   - Note anything that feels off; we tune `CONFIG` in `game.js`.

3. **Art & polish** *(Midjourney + me)*
   - Real `icon-192.png` / `icon-512.png` (currently placeholders).
   - Optional: tile / felt / launcher art direction. Decide the visual identity now
     before a store exists to theme.

4. **Music** *(Suno + me)*
   - One short ambient loop. Wire an `<audio loop>` gated on `window.LL_Audio.isMuted()`.

**Exit criteria:** haiku shows on the card, icons are real, it feels good on a phone.

---

## PHASE 2 — Reason to return (daily competition)

Goal: turn the seeded daily into a shared competition. Low infra, big retention.

1. **Hosting** — deploy the static site (Netlify/Vercel/Cloudflare Pages). Set
   `SHARE_URL` in `share.js` so shares carry a link. (~30 min)
2. **Leaderboard** — Supabase (free tier). One table: `{day_key, name, score, created_at}`.
   On daily game-over, submit; show today's top N + your rank. Seeding is already done.
   - Anti-cheat is a *later* concern; start trusting-client, add validation if it matters.
3. **Streak/return mechanics** — "played today?" state, day-streak counter ("🔥 5 days"),
   optional local reminder. Make missing a day feel like a small loss.

**Exit criteria:** you can play today's daily, see a leaderboard, and a friend on a
different device gets the same letters.

---

## PHASE 3 — Depth & progression (the store)

Goal: give coins a purpose; add session-to-session goals. Coins already accrue +
persist (`letterlaunch.coins`).

1. **Cosmetic store** — tile skins, felt themes, launcher skins, trajectory styles.
   Pure cosmetic first (no balance risk). Render hooks already centralized in `game.js`.
2. **Currency design** — keep **score** (per-run) and **coins** (persistent, spendable)
   separate so spending never lowers a high score. Tune `COIN_RATE` once run scores settle.
3. **Bumper variety** — system already supports it; add one-shot "pop", score-pad, gate
   bumpers. **Re-run `node sim.js` after any layout change (want 7/7).**
4. **Optional pressure mechanic** — only if playtests say the board stalls (timers/blockers).

**Exit criteria:** a player can earn and spend coins on something they want.

---

## PHASE 4 — Growth loops

1. Lean harder on the share card (it's your Wordle-grid moment) — make Daily results
   one-tap shareable with the rank included.
2. Invite/challenge-a-friend on a specific day seed.
3. Light SEO/landing page; App Store / Play via PWA wrapper (Capacitor/TWA) if wanted.

---

## PHASE 5 — Multiplayer (only after Phase 2 validates demand)

1. **Async leaderboard = the cheap "multiplayer"** (that's Phase 2 — already the win).
2. **Live random matchmaking** — real-time opponent boards. Needs a realtime backend
   (PartyKit/Ably/Supabase realtime) + matchmaking. Heaviest lift; deliberately last.

---

## 💰 Monetization (revisit once the loop is solid — not before)

Menu to choose from later, lowest-friction first:
- **Cosmetics** (Phase 3 store) sold for real money in addition to coins.
- **Remove-ads / supporter** one-time unlock.
- **Rewarded ads** (optional continue, coin doubler) — keep non-coercive.
- **Daily-pass / season** of cosmetic unlocks once retention is proven.
Principle: never sell power that hurts the leaderboard's integrity.

---

## 🔧 Standing conventions (don't break these)

- After editing `BUMPERS`, run `node sim.js` → must print **7/7**.
- All tunables live in the `CONFIG` block at the top of `game.js`.
- Rebuild the standalone with `node build.js` after source changes.
- Dictionary = ENABLE list; game only uses `DICT.has(word)`.
- New helpers attach to `window.LL_*`; load order in `index.html` matters
  (`dict → rng → audio → share → game`).

---

## ▶️ When we resume — likely first move

Either: **(A)** you paste the haiku engine and we finish Phase 1, or **(B)** we
deploy + stand up the Supabase leaderboard (Phase 2.1–2.2). Tell me which and we go.
