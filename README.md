# Letter Launch

A physics word game: lob letter tiles from a top launcher, let them fall through
plinko bumpers into a 7×6 gravity-stacked grid, then drag across touching tiles
(Boggle-style, 8 directions) to trace words. Valid words clear, the stack
collapses, and clearing words back-to-back builds a streak multiplier.

Vanilla HTML/CSS/JS — **no framework, no build step, no dependencies, no server.**
Because it's 100% static client-side code, it runs anywhere you can serve files
and **does not depend on this codespace being open** — once it's on a static host
(see *Deploy*), the codespace can close and the game keeps running.

> "SlingSpell" is the legacy codename; the game is branded **Letter Launch**. The
> name survives only in `localStorage` fallbacks and old folder names.

---

## Repository layout

| Path | What it is |
|------|------------|
| **`docs/`** | **The game.** The complete, self-contained, copyable unit — and the folder GitHub Pages serves. Copy this folder (or just `docs/letter-launch-standalone.html`) anywhere to run the game. |
| `docs/index.html` | Markup + HUD + overlays. Loads `dict → rng → audio → share → game`. |
| `docs/game.js` | All game logic. **A `CONFIG` block at the top holds every tunable.** |
| `docs/dict.js` | Word list — defines `window.DICT` (a `Set`). ENABLE list, 3–15 letters. |
| `docs/rng.js` | Seeded PRNG (`window.LL_RNG`) — drives the deterministic daily challenge. |
| `docs/audio.js` | Synthesized Web Audio SFX (`window.LL_Audio`). No asset files. Mute persists. |
| `docs/share.js` | Share card (`window.LL_Share`) — 1080×1350 PNG + text, via Web Share / clipboard. |
| `docs/manifest.webmanifest` | PWA manifest for installable full-screen. |
| `docs/letter-launch-standalone.html` | **Everything inlined into one file** — the drop-in artifact for embedding. Rebuilt by `tools/build.js`. |
| `tools/build.js` | Inlines `docs/` into the single-file standalone. `node tools/build.js`. |
| `tools/sim.js` | Reachability check — brute-forces the aim space; must print **7/7**. |
| `MASTER_PLAN.md` | The phased roadmap (the source of truth for what's next). |
| `_archive/` | Pre-restructure snapshots, kept for safety. Gitignored, not shipped. |

---

## Run it locally

No build needed. Any static server works:

```bash
python3 -m http.server 8000 --directory docs
# open http://localhost:8000
```

(Opening `docs/index.html` directly works too, since all scripts are local
`<script src>` includes — but a server is closer to production.)

---

## Deploy (so it runs when the codespace is closed)

The game is static, so hosting = "put `docs/` on a static host." Recommended:
**GitHub Pages**, serving the `docs/` folder of this repo — free, permanent, and
already on GitHub. Once enabled, the live URL is:

```
https://stephenuffugus.github.io/letter_launch/
```

That URL is the single source of truth. Both websites and the studio embed *it*
(see *Embed*), so updating the game in one place updates it everywhere.

> GitHub Pages on a **private** repo requires a paid plan; on the free plan the
> repo must be public. Alternatives that keep the source private: deploy `docs/`
> to a separate public Pages repo, or host on Netlify / Cloudflare Pages.

---

## Embed in a website

**Option A — iframe the live deploy** (recommended; one source of truth):

```html
<iframe
  src="https://stephenuffugus.github.io/letter_launch/"
  title="Letter Launch"
  style="width:100%; max-width:460px; aspect-ratio:9/16; border:0; border-radius:16px;"
  loading="lazy" allow="fullscreen"></iframe>
```

**Option B — self-host the single file:** copy `docs/letter-launch-standalone.html`
into the site and link or iframe it. No other files needed (fonts load from Google
Fonts over the network).

---

## Standing conventions (don't break these)

- After editing `BUMPERS` in `docs/game.js`, run `node tools/sim.js` → must print **7/7**.
- All tunables live in the `CONFIG` block at the top of `docs/game.js`.
- Rebuild the standalone with `node tools/build.js` after editing any `docs/` source.
- Dictionary = ENABLE list; the game only uses `DICT.has(word)`.
- Script load order in `docs/index.html` matters: `dict → rng → audio → share → game`.
- New helpers attach to `window.LL_*`.

---

## What's shipped vs. next

**Shipped:** core loop, synthesized sound + mute, seeded daily challenge, share
card, PWA manifest. **Blocked on you:** the haiku engine (`window.makeHaiku`
integration point is live in `game.js`). **Next per `MASTER_PLAN.md`:** permanent
hosting → daily leaderboard (Supabase) → cosmetic store. See `MASTER_PLAN.md`.

### Design notes (why it plays the way it does)
- Launcher fires **down** from top-center so every tile traverses the bumpers (true
  plinko). Aiming is **direct** (drag the way you fire) and can start anywhere — phone-friendly.
- Cleared cells collapse downward, which is what makes the **streak** meaningful: a
  good clear can drop letters into a second word.
- The core was kept deliberately small; mechanics were added one at a time and
  playtested before the next. Keep that discipline.
