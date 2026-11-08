# Glass.skin — image shot list

Store: Glass Skin (xglass.skin) · 1 product · Basic plan · INR

## House style (locked)

Derived from `glass-skin-model.jpg`, the strongest existing asset.

> Photorealistic. A plain **unlabelled** matte white ceramic jar with a matte
> coral-terracotta lid. **No text, lettering, logos or labels anywhere.**
> Soft natural daylight, warm pale pink and cream palette, minimal composition,
> shallow depth of field. Indian subjects, warm brown skin.

**Why unlabelled:** every existing image with a visible label has garbled AI text
(`MAIN / SKIN`, `minisalsad monic urtes`), and the two labelled jars are not even
the same design. Removing the label removes the failure mode and makes the set
internally consistent.

## Current state

| Surface | Images now | Needs |
|---|---|---|
| Product page | 1 (jar, garbled label) | +5 |
| Home / hero | 1 (hero, garbled label) | replace |
| How to use | 2 of 3 steps | +1 |
| About Us | 0 | +2 |
| Shop All collection | 0 | +1 |
| Home page collection | 0 | +1 |
| FAQ / Contact | 0 | +1 |

## Shots

### Product page

1. **Open jar, top-down** — 1:1. Open unlabelled white jar, coral lid resting
   beside it, pale cream surface freshly swirled, shot from directly above.
   Soft window daylight, warm pink-cream background, gentle shadows.

2. **Texture swatch** — 1:1. Macro. Young Indian woman's fingertips with a dab of
   white cream; a soft glossy smear on the back of her hand showing the light
   texture. Warm brown skin, natural daylight, shallow depth of field.

3. **In palm, for scale** — 1:1. Unlabelled jar held in an open palm showing its
   small everyday size. Warm brown skin, cream and pale pink background.

4. **Bathroom shelf** — 1:1. Jar on a clean minimal shelf beside a folded towel
   and a glass of water, warm morning sun on a pale cream wall. Uncluttered.

5. **Jar + lid flat lay** — 1:1. Lid off and set beside the jar on a flat pale
   pink surface, single soft shadow, generous negative space.

### How to use (step 2 of 3 — "cream")

6. **Applying** — 1:1 (686x686 to match existing steps). Fingertip lifting cream
   from the open jar and smoothing it along a cheek. Warm brown skin, soft light.
   Matches `glass-skin-htu-cleanse.jpg` and `glass-skin-htu-fresh.jpg`.

### About Us

7. **Brand still life** — 16:9. Jar with a few simple honest objects — a linen
   cloth, a sprig of green — on warm cream. Calm, premium, unfussy. Carries
   "simplicity over complexity".

8. **Real morning** — 4:5. Candid: a young Indian adult, late teens or early
   twenties, mid morning routine in natural light, unposed, lightly smiling.
   Carries "made for teenagers and young adults".

### Collections

9. **Shop All banner** — 16:9. Jar on a split coral-and-cream background,
   centred, generous space for an overlaid headline.

10. **Home page collection** — 16:9. Soft coral-to-cream gradient with the jar
    off to one side, left two-thirds clear for text.

### FAQ / Contact

11. **Calm support still** — 16:9. Abstract soft coral and cream forms, or a
    clean desk corner in warm light. Quiet, no product, no people.

## Status: generated and published 2026-11-08

Generated with **Cloudflare Workers AI**, free tier, no spend:

- `@cf/black-forest-labs/flux-1-schnell` — all 11 final images, 1024x1024 native.
- `@cf/stabilityai/stable-diffusion-xl-base-1.0` — tried for the wide and portrait
  shots, rejected. It produced bulbous kitchen canisters instead of cosmetic jars,
  and returned a pure-black frame for the About portrait. Everything was redone on
  flux; the 16:9 shots are centre-cropped from square.

Gamma (free plan, 402 Insufficient credits) and fal.ai (valid key, account locked
pending top-up) were both unusable.

### Hosting

Masters live in Cloudflare R2, bucket `glass-skin-assets` (APAC), public base
`https://pub-e4234ac76a374128811bd4a93df93470.r2.dev/`. Total 964 KB of the 10 GB
free allowance. Shopify fetched each file from there once; the storefront serves
from Shopify's own CDN, so r2.dev is not in the hot path and its rate limits do
not matter.

### Placed

| Surface | Images |
|---|---|
| Product page | 5 added (6 total, original jar kept first) |
| How to use | rebuilt as 3 steps — existing cleanse, new apply, existing fresh |
| About Us | 2 — still life after the intro, portrait under "Who it's for" |
| FAQ | 1 header image |
| Shop All collection | 1 |
| Home page collection | 1 |

All 11 carry descriptive alt text. FAQ `[PENDING]` and `[TO VERIFY]` markers were
left untouched.

### Known limits

- 1024 px native, so banners are 1024x576 after cropping. Softer than the existing
  2752x1536 hero on a full-width slot.
- Banner jars sit centred; flux ignored the instruction to clear the left side.
  Overlay text should go above or below, not beside.
- Lid renders slightly more orange than the coral in `glass-skin-model.jpg`.
  Consistent across the new set, just not an exact match to the two older files.

### Not done

- The homepage hero still shows the garbled `ol / minisalsad monic urtes` label.
- `glass-skin-jar.jpg` (`FACE-CREAM / MAIN / SKIN`) is still the product's first
  image.

Both are the remaining garbled-text assets. Replacing them is a separate decision
because the hero is the first thing a visitor sees.

## Hero banner — added 2026-11-08

`13-hero-banner.jpg`, 2048x1152. In Shopify Files, alt text set.

The homepage `image_banner` section had **no image at all** — it was still the
stock Dawn placeholder reading "Browse our latest products". The earlier note
that the homepage showed a garbled label was wrong; `glass-skin-hero.jpg` is
unused and only sits in Files.

### How it was built

Faces were the problem. Four model-led candidates (flux and SDXL-lightning) all
came out over-smoothed and glamour-framed, with bare shoulders that do not suit a
brand aimed at teenagers. SDXL-lightning also put garbled lettering back on the
jar, the exact fault being fixed.

So the hero is product-led: a flux render of the jar on a flat coral sweep, then
the flat background extended horizontally by edge-column replication to a true
2048x1152. No face, no label, nothing for the model to garble, and larger than
flux's 1024 native cap. The jar sits right of centre with the left 55% clear for
a headline.

### Still manual

Setting the banner image needs the theme editor. `themeFilesUpsert` against the
live theme is blocked by the Shopify MCP safety policy:

> This mutation targets the live (published) theme. Duplicate the theme in
> Shopify admin, edit the draft, and a merchant can publish it manually.

Admin -> Online Store -> Themes -> Customize -> Image banner -> Image ->
pick `13-hero-banner.jpg`. Suggested settings: overlay opacity 0, content
position middle-left, and replace the stock "Browse our latest products" copy.

### Product media

The garbled `ljXjZ9...` jar (`FACE-CREAM / MAIN / SKIN`) is still position 1 on
the product. A reorder was proposed and declined, so nothing was changed.
