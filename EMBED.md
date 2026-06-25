# Embedding Letter Launch

The game lives at one permanent URL and everything else points at it. Update the
game once (push to `docs/`) and **every** embed updates automatically — your two
websites and the studio included. Nothing depends on a codespace being open.

**Live URL:**

```
https://stephenuffugus.github.io/letter_launch/
```

---

## Drop it into a page (recommended)

Paste this wherever you want the game to appear. It's a responsive portrait frame
that scales down on phones:

```html
<iframe
  src="https://stephenuffugus.github.io/letter_launch/"
  title="Letter Launch"
  style="width:100%; max-width:460px; aspect-ratio:9/16; border:0;
         border-radius:16px; box-shadow:0 14px 40px rgba(0,0,0,.35); display:block; margin:0 auto;"
  loading="lazy" allow="fullscreen; autoplay"></iframe>
```

**Full-bleed variant** (fills its container, good for a dedicated game page):

```html
<iframe
  src="https://stephenuffugus.github.io/letter_launch/"
  title="Letter Launch"
  style="width:100%; height:100vh; border:0; display:block;"
  loading="lazy" allow="fullscreen; autoplay"></iframe>
```

### Where to paste it, by platform
The iframe is plain HTML and works in any site builder's "Embed / Custom HTML" block:
- **Plain HTML site:** paste directly into the page.
- **WordPress:** add a *Custom HTML* block.
- **Wix / Squarespace:** add an *Embed* (HTML) element.
- **Webflow:** add an *Embed* component.
- **Shopify:** paste into a page's HTML, or a *Custom Liquid* / custom-HTML section.

---

## Studio integration

You chose **embed the live URL everywhere**, so the studio uses the *same* iframe
snippet above — no game files need to live in the studio repo, and the studio
codespace can be closed without affecting anything. If a studio page just lists
games, link to the URL; if it showcases them inline, use the iframe.

---

## Offline / self-hosted fallback

If a site must serve the game itself (no external URL), copy the single file
`docs/letter-launch-standalone.html` into that site and link or iframe it. It's
fully self-contained (fonts still load from Google Fonts over the network). Trade-off:
that copy won't auto-update — you'd re-copy the file after changes.

---

## Notes
- Sound unlocks on the first tap/click (browser autoplay policy) — works the same inside an iframe.
- "Add to Home Screen" full-screen PWA install works from the **direct URL**, not from inside an iframe (expected).
- To rebuild the standalone after editing the game: `node tools/build.js`.
