# Letter Launch → add to Lucid Winds (hand this to the studio coordinator)

## Where to point the click (the game's home)
https://stephenuffugus.github.io/letter_launch/

## The one line to add
Add to the `G[]` array's `studio` block (next to `glyphforge` / `sweetspot` /
`tarotrun` / `sixfold`, around `index.html:62705`). Keep the trailing comma:

    {id:'letterlaunch',n:'Letter Launch',i:'🔤',r:'Plink letter tiles through bumpers, then trace words to score.',cat:'studio',ext:'https://stephenuffugus.github.io/letter_launch/',thumb:'https://stephenuffugus.github.io/letter_launch/icon-512.png'},

That's the whole embed:
- Shows as a card in GAME tab → SKY WOLF STUDIOS 🐺
- Opens the game in an `<iframe>`
- Thumbnail reuses the live icon (no asset to add)

Then per the usual rules: `node --check index.html`, bump `LW_VERSION`.

## Important: embed-only
Letter Launch fires NO `Sunbeam.earn()` calls, so it can't touch the sunbeam /
plant economy. When YOU decide to wire sunbeams (your call — fragile economy),
tell the Letter Launch repo and that side will add the SDK to your spec.

## Verified
- Live, HTTP 200, no X-Frame-Options / frame CSP → embeds fine.
- Origin `https://stephenuffugus.github.io` already in your `STUDIO_ORIGINS`.
- Not yet in `G[]` (no duplicate). `studio` category already exists.

Full details: https://raw.githubusercontent.com/Stephenuffugus/letter_launch/main/LUCID_WINDS_HANDOFF.md
