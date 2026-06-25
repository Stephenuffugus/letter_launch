# Letter Launch → Lucid Winds — integration handoff

> **For:** the Lucid Winds coordinator (the Claude Code instance that owns
> `lucid-winds/index.html`).
> **From:** the Letter Launch repo (`Stephenuffugus/letter_launch`).
> **Director's decision (2026-06-25):** **embed only** for now. The **sunbeam
> economy is fragile — the LW coordinator owns it**, so do NOT wire the earn
> bridge as part of this drop. Just register the embed. The earn-bridge is
> spec'd at the bottom for when you choose to do it.

---

## What Letter Launch is

A physics word game (plinko letter tiles → trace words). Vanilla JS, its own
deploy on GitHub Pages, **its own coin/store economy that does NOT touch
sunbeams**. Live + verified embeddable.

- **Live URL (point `ext:` here):** `https://stephenuffugus.github.io/letter_launch/`
- **Origin:** `https://stephenuffugus.github.io` — already in your `STUDIO_ORIGINS`
  allowlist (shared by all of Stephen's github.io games). No allowlist change needed.
- **Framing:** verified `200`, **no `X-Frame-Options`, no frame CSP** → embeds fine.
- **Thumbnail:** reuse the live icon (like `sixfold` does) — no asset to add to
  your repo. Or drop your own at `portal-assets/thumbs/letter-launch.png`.
- Not yet in your `G[]` (no duplicate).

---

## The embed (one line — host side)

Add to the **`studio` block of the `G[]` array** (alongside `glyphforge` /
`sweetspot` / `tarotrun` / `sixfold`, ~`index.html:62702-62705`), **with a
trailing comma** to match its siblings:

```js
{id:'letterlaunch',n:'Letter Launch',i:'🔤',r:'Plink letter tiles through bumpers, then trace words to score.',cat:'studio',ext:'https://stephenuffugus.github.io/letter_launch/',thumb:'https://stephenuffugus.github.io/letter_launch/icon-512.png'},
```

Suggested anchor — insert right after the `sixfold` entry:

```
…{id:'sixfold',…},
+ {id:'letterlaunch',n:'Letter Launch',i:'🔤',r:'Plink letter tiles through bumpers, then trace words to score.',cat:'studio',ext:'https://stephenuffugus.github.io/letter_launch/',thumb:'https://stephenuffugus.github.io/letter_launch/icon-512.png'},
```

Then, per your rules:
- `node --check index.html` (or extract script blocks) before committing.
- Bump `LW_VERSION` (`index.html:~903`).
- `studio` category already exists (`index.html:62622`) — no category change.
- Pi build: `ext:` games are already auto-hidden inside Pi Browser — no action.
- (Optional) add a featured card to `portal/index.html` external list so it also
  shows on `lucidwinds.com/portal/`.

That's the whole embed. It mounts in an `<iframe>` in the GAME tab and plays;
it just won't earn sunbeams until you do the bridge below.

---

## DEFERRED — sunbeam earn bridge (LW coordinator owns; do only when ready)

Letter Launch currently emits **no** `Sunbeam.earn()` calls, so embedding it is
**economy-neutral** — it cannot affect the hash/plant economy. When you want it
to pay sunbeams, tell the Letter Launch repo and **we (the Letter Launch side)**
will wire the game side to your spec:

1. Vendor your canonical `sunbeam-sdk.js` into `letter_launch/docs/` + load it.
2. `Sunbeam.init({ gameId: 'letterlaunch' })` at startup.
3. `Sunbeam.earn(n, '<label>')` on real events. Proposed labels (you set the
   payouts in `STUDIO_RATES`; `n` is only the standalone value):
   - `win` — on game over (a completed run).
   - `milestone` — on a 5+ letter word or reaching a new streak tier (pay-as-you-play, no taper).
4. Host side: `letterlaunch` will fall to `STUDIO_RATES._default` (win=3) unless
   you add a card. Origin is already allowlisted, so no `STUDIO_ORIGINS` change.

Because the economy is fragile, **nothing above is done yet** — it's your call,
your rates, your timing.

---

## Verification after you add the line
- `node --check` passes.
- GAME tab → SKY WOLF STUDIOS 🐺 → Letter Launch card appears → opens the iframe → plays.
- Web/PWA build only (hidden in Pi Browser, as designed).
