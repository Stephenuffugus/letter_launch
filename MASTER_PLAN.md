# Letter Launch — Master Plan

The single source of truth for what we're building and in what order. When you're
ready, just say **"let's get started"** and we work top-down from Phase 1.

> Game: physics word game — launch letter tiles through plinko bumpers into a 7×6
> gravity-stacked grid, drag across touching tiles (Boggle-style) to spell words,
> build streak multipliers. Vanilla HTML/CSS/JS, no framework, no build step to run.

---

## ✅ Already done

**Foundation:**
- Renamed everything to **Letter Launch** (storage migrated to `letterlaunch.*`).
- **Sound** (`audio.js`) — synthesized Web Audio SFX + persistent mute toggle.
- **Seeded daily challenge** (`rng.js`) — Free/Daily pill; deterministic letter
  stream per date; per-day best saved.
- **Share card** (`share.js`) — 1080×1350 PNG + text; Web Share / clipboard.
- `build.js` rebuilds the single-file standalone.

**Shipped + deployed (this session):**
- **Hosting — Phase 2.1 ✅** — restructured to `docs/` (the game) + `tools/` (dev
  scripts), deployed to **GitHub Pages**. Live: <https://stephenuffugus.github.io/letter_launch/>
  (root redirects to `/docs/`; optional: set Pages folder to `/docs` for a clean root).
  `SHARE_URL` is set. Studio + both websites embed the live URL via iframe — see `EMBED.md`.
- **Daily streak — Phase 2.3 ✅** — consecutive-day counter for the Daily (pill `Daily 🔥N`,
  end-screen line, share text + card). Keys: `streak.count` / `streak.last`.
- **Cosmetic store — Phase 3.1–3.2 ✅** — `store.js` (`window.LL_Store`): tile / felt /
  launcher / trajectory skins; buy / equip / persist; LL_Store is the coin authority.
  Topbar coin pill opens it; renderer reads `getStyle()` each frame. Pure cosmetic.
- **Charger bumper — Phase 3.3 (partial) ✅** — gold ★ bumper charges a tile to 2× its
  letter value (bonus flag rides ball→drop→cell). Identical physics, so **sim stays 7/7**.
  Still open: one-shot "pop", score-pad, gate bumpers.
- **Real PWA icons ✅** — `tools/make-icons.js` generates them dependency-free (felt + L tile).
- **Levels mode (Phase 3) ✅** — **40** fixed, pre-verified word-list puzzles
  (`tools/make-levels.js` → `docs/levels.js`); each level is dealt the *exact* letters
  for its words, so it's never impossible (challenge is placement). Checklist bar +
  level-cleared overlay; +10 coins per clear; progress at `letterlaunch.level`.
- **Daily Climb / daily ascension ✅** — `mode==='climb'`: a **3-stage** seeded daily
  puzzle generated in-browser from `LL_WORDPOOL` + the date seed (same for everyone,
  always solvable, real words). Feeds the day-streak + share. Pill cycles Free→Daily→Climb→Levels.
- **Playability fixes ✅** — a full column no longer ends the game; tiles **spill to the
  nearest open column**, and it ends only when the *whole* board fills. Stuck-ball failsafe.

**Word-list-forward rework (this session):**
- **Home menu + Levels at the forefront ✅** — the old blind cycle-pill is gone. The game
  now boots into a **home menu** (`#menu`) with mode cards: **Levels** is the featured/
  default mode, then Daily Climb, Daily, Free. The topbar `☰` pill and a `☰` in the level
  bar reopen it any time, in any mode → **also resolves the in-game BACK/home TODO**.
- **Aiming is skill, not luck ✅** — removed the moving bumper (field is fully **static**),
  restitution lowered to ≤1 (`peg .82, bouncer/charger 1.0`), so the trajectory preview is
  an **exact** prediction. Render now draws a glowing **predicted-landing-column** highlight
  (uses the equipped Clear-Burst colour). `sim.js` re-verified **7/7** (single static pass).
- **Soft-lock fix ✅** — word-list modes detect "out of tiles" and surface a hint + `↻` retry
  (also a `↻` always in the level bar).
- **Store greatly expanded ✅** — ~**57** cosmetics across Tiles / Felt / Launcher / Aim-Trail
  **plus a new Clear-Burst (`fx`) category**. Ownership moved to collision-safe `type:id`
  keys (+ legacy-save migration). Coins remain **in-game-only** (no sunbeam calls).
- **Audited ✅** — 5-dimension adversarial review (physics/state/store/UI/regression) + headless
  boot/gameplay/regression harnesses; 6 confirmed findings fixed, standalone rebuilt.

**Tap-to-spell + mechanics batch (this session):**
- **Click-to-spell ✅** — tap tiles one at a time (great for diagonals) with a `✓`/`✕` bar,
  *or* drag-trace as before; a slip mid-tap extends instead of wiping.
- **Aiming bugfixes ✅** — removed the bumper that sat **dead-center under the launcher**
  (sim still 7/7); **misfire fix**: fire from the per-axis **median of the last few drag
  samples** (rejects lift-off jerk), shared by preview *and* launch so the glow can't lie.
- **Power-ups ✅** (`#itembar`, coins spent per use, in-game only): 🔀 Shuffle (40), 🔁 Swap
  (30), 💣 Bomb (50). Tools intercept taps; engaging one drops any in-progress word.
- **Blockers ✅** — black `✕` cells occupy space, can't be spelled through, and break when a
  cleared word is adjacent. `dropBlocker`/`clearAdjacentBlockers`/`drawBlocker`.
- **Word Hunt mode ✅** — stock the board, then it offers a real word your letters can make
  (`findHuntTarget` now requires the word be **traceable**, not just present); spell it.
  `＋ letter` Help hands a letter; 2nd+ help drops a blocker penalty (gated to idle launcher).
- **Audited ✅** — 5-dimension adversarial review (aiming/power-ups/blockers/Word-Hunt/regression);
  **11 confirmed findings fixed** (incl. a bomb+collapse stale-chain crash); 5 headless harness
  suites pass; standalone rebuilt.

---

## ⚠️ Top of the list when we resume

- **Filler letters in Levels** *(deferred from the mechanics batch)* — add extra/“decoy”
  letters to word-list levels that aren’t part of any target, used only for spacing/positioning
  so you arrange the board to make targets traceable. Needs a `tools/make-levels.js` change
  (deal = target letters + N fillers; re-verify solvability) + a tweak so traced fillers don’t
  count. The Word Hunt + blocker tension already delivers some of this puzzle feel.
- *(cleared)* The in-game BACK/home gap is now covered by the home menu (`☰` pill + level-bar
  `☰`, reachable in every mode). If the Lucid Winds `ext` wrapper later adds its own back
  header, de-dupe then.

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

Hosting is live and the depth layer (store + streak + charger) is in. The biggest
remaining levers, in rough priority:
- **(A) Leaderboard — Phase 2.2** (the next real retention win). Seeding is done;
  stand up a tiny Supabase table `{day_key, name, score}` and post on daily game-over.
  *Needs your Supabase project + anon key.*
- **(B) Haiku engine — Phase 1.1.** Integration point is live (`window.makeHaiku`);
  paste your engine as `docs/haiku.js` and the end card + share image pick it up.
- **(C) More store content / bumper types** — both systems are built; adding items is cheap.
- **(D) Real-device playtest pass** — tune the charger frequency/value and `CONFIG` feel.
