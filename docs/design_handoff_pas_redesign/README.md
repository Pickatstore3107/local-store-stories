# Handoff: Pick at Store — Local Stores & Their Stories redesign

## Overview
Redesign of the mobile web app (Next.js, repo `Pickatstore3107/local-store-stories`). Covers: Home feed, bottom bar (3 variants), Post page, Map, Add Place (3 steps), Saved, Me, Activity, Loading splash, 404, Offline.

## About the design files
`Local Stores Prototype.dc.html` is a **high-fidelity HTML prototype** — the single source of truth. Open it in a browser (keep `support.js` and `assets/` next to it). It is NOT production code: recreate it inside the existing Next.js app using its components, routing, Firebase data and hooks (`use-saved`, `use-likes`, `use-my-follows`, etc.).

## Fidelity: HIGH — match exactly
Rules for the implementer:
1. **Every style in the prototype is inline.** Copy values literally: px sizes, hex colours, font shorthand (`font: 600 21px 'Playfair Display'`), radii, shadows, gradients, transition timings and easings. Do not round, "tidy" or substitute tokens with nearby values.
2. Copy SVG icon paths verbatim from the prototype (`ICON` object in the script + inline `<svg>`s).
3. Copy copywriting verbatim, including punctuation and case.
4. Build screen-by-screen and compare side by side with the prototype at **390 × 844** (iPhone 14) before moving on. Use the prototype's iOS/Android toggle to check both.
5. Sample data (`POSTS` array) is placeholder — wire to real Firestore data, keeping the same fields and formatting rules (e.g. likes text: 0 → "Be the first to like this", 1 → "1 like", n → "n likes").
6. Striped boxes labelled `PHOTO · …` = real photos (object-fit: cover) at the same aspect ratios (feed/post 4:5, trending bag body 750:625).
7. When anything is ambiguous, the prototype's behaviour wins over this README.

## Design tokens
Colours
- Red (primary) `#A3171B` · Deep red (text on yellow) `#7D1114`
- Yellow `#FFC000` · Butter fills `#FFF0C4`, `#FFF3D1`, `#FFE7A3`, `#FFEFC2`
- Ink `#2B1D1A` · Soft text `#6E5A55` · Placeholder text `#8C7670`
- Hairline `#F1E6E2` · Border `#E7D9D4` · Input fill `#F7F2EF` · Bar track `#EFE6E2`
- Map paper `#FBF5EA`, dots `#E9DFD0`, water `#D3E4EC` (label `#5B8AA3`), park `#E4EDD6` (label `#6F8A55`), area labels `#B3A29B`
- Saved illustration card `#F2C8B9` (matches clip background exactly)
- Page backdrop (outside phone) `#EFEAE6`

Fonts (Google Fonts): `Playfair Display` 500/600 + italics (headings) · `Plus Jakarta Sans` 400–700 (UI) · `Kalam` 400 (handwritten captions/notes) · `Anton` 400 (years, numbers).

Radii: pills 999px · cards 14/16/18/20/22px · post sheet 26px top · bag/pin from image masks.
Shadows: card `0 10px 26px rgb(120 70 30 / .16)` · strong `0 12px 28px rgb(120 70 30 / .18)` · chip `0 4px 12px rgb(120 70 30 / .12)`.
Strong rule: `2px solid #2B1D1A` (section dividers).

## Keyframes (copy exactly from `<helmet><style>`)
`pasBurst` (double-tap heart, .9s), `pasBob` (map pin, 1.8s), `pasRing` (pulse ring, 1.8–2s), `pasMarch` (trail dashes, 1.1s linear), plus `prefers-reduced-motion` rule that disables transitions/animations.

## Screens
All screens: 52px sticky blurred white header (logo 26px tall, "Hyderabad" yellow pill, bell with red dot) except Post. Content padding 18px sides. Bottom bar fixed, 60px + safe area.

**Home** — greeting (Playfair italic 15px) → H1 "Discover local *{kind}*" (33px, kind word italic red with yellow highlighter band 62–92%) → search pill 44px → kind tabs (underline active red 2px) → yellow band "This week / Most loved" with walker animation sitting on the 2px rule → horizontal bag cards (178px wide, bag handle image + masked photo body, rank inside yellow pin top-right, store + area + likes) → "Just shared" (pin icon) feed of posts: author row + follow pill, 4:5 photo r16 with big Anton year bottom-left, action row (like/comment/share/save 42px), likes, store (Playfair 22), area caps red, Kalam 18 caption. Title word follows selected kind (no auto-rotation). Removed sections: poster, ticker, streak banner, map card, popular areas, Instagram feed.

**Bottom bar** — 5 tabs Home/Map/Add Place/Saved/Me. Three variants (prop `navStyle`): `notch` (red pill slides under active icon, `left .38s cubic-bezier(.3,1.3,.5,1)`), `dot` (icons only + yellow 5px dot), `pill` (butter `#FFF0C4` 56×32 pill behind active). Pick one with the product owner; default `notch`.

**Post** — full-bleed 4:5 swipe carousel (scroll-snap, 3 slides) with story-style progress bars (3px), frosted back button / kind chip / "1/3" counter; double-tap = like + `pasBurst` white heart. White sheet overlaps photo by 26px, radius 26 top. Blocks fade/slide in staggered (opacity .5s, transform .6s cubic-bezier(.2,.8,.2,1), delays .05/.14/.22/.30/.38/.46/.54s, from translateY(18px)). Contents: Anton 76px year + store (Playfair 32 caps) + pin/area; rotated dashed "N years ago" stamp (86px circle, -10deg); author row between 2px ink rule and hairline; action row with heart spring `scale(1.3)` for 200ms (`.28s cubic-bezier(.3,1.8,.5,1)`); Kalam 23px caption with red quotes; tilted (-1deg) yellow ticket "What I always ordered" with punched side notches; mini map card 156px with bobbing pin + pulse ring → opens Map centred on the store; "More stories nearby" row; comments as bubbles (radius 4 16 16 16); comment input border turns red while typing, Post button springs in.

**Map** — illustrated paper map layer 820×1100 panned with `transform` (`.75s cubic-bezier(.3,.8,.2,1)`, none while dragging). Drag to pan (clamped). Photo pins (44px, active 62px, white/red ring, tail, year tag; active tag yellow). Year slider "Since {year}" (1970–2026) with tiny walker: pins outside range scale to 0. Story trail = dotted red polyline oldest→newest with `pasMarch`, toggle button. Near-me red dot with pulse. Bottom swipeable cards (318px) synced both ways with pins. In production use the real map (OpenFreeMap/MapLibre in `src/components/map/*`) with a custom style using these colours; keep pins/cards/slider/trail exactly.

**Add Place** — "New post" + mini walker, "Step n of 3" + 3 progress bars. Step 1 photos/video tiles; step 2 store search list; step 3 caption (Kalam on butter), kind chips, Year (Anton) + "I always ordered", visibility segmented, rights checkbox. Sticky Next/Post button disabled at 40% opacity until valid.

**Saved** — grid 2 cols 4:5; empty state = pink card `#F2C8B9` 316px with the "saved" illustration (plays once, holds 2.2s, repeats).

**Me** — 84px avatar with yellow ring, streak pill, 3-column stats between 2px rules, Edit/Invite, Posts / On the map tabs, 3-col grid.

**Loading splash** — full-screen `#FFC000`, walker 250px, greeting words fade/blur in staggered (.15s + .16s·i), logo fades in at .9s, red progress bar 3.6s linear; whole splash slides up `translateY(-100%) .7s cubic-bezier(.7,0,.2,1)`. Tap to skip. Starts its clock only when the sprite is loaded (max 2.5s wait).

**404 / Offline** — Anton 72px red code, walker 190px, 2px rule, title (Playfair 30), buttons ("Back to Home" | "Try again" + "Open Saved").

## Illustrations (sprite sheets — not videos)
Render with a `<canvas>` sized ×devicePixelRatio (max 2), drawing one frame per tick via `drawImage` (see `Walker` function in the prototype — port it as a React component as-is).
- `assets/walker-sprite.webp` — 8 cols × 6 rows, frame 390×613, 48 frames, 17 fps, loops. Transparent ink.
- `assets/saved-sprite.webp` — 12 cols × 7 rows, frame 300×474, 84 frames, 11.3 fps, play once then hold 2.2s. Pink bg baked in.
Reduced motion: show a still frame (walker frame 6, saved frame 83).

## Other assets
- `assets/pas-logo-horizontal.webp`, `assets/pas-emblem.png` — from `public/brand/`
- `assets/bag-handle.png`, `assets/bag-body-mask.png` — emblem split at y=163 (handle image / CSS mask for photo)
- `assets/pas-pin.png` — yellow pin cut from the emblem

## Screen → repo files
Home `src/app/page.tsx`, `src/components/home/*` · Bottom bar `src/components/bottom-bar.tsx` · Post `src/app/memories/[id]/*`, `src/components/post/*` · Map `src/components/map/*` · Add Place `src/app/share/*` · Saved `src/app/saved/*` · Me `src/app/people/[uid]/*` · Activity `src/app/activity/*` · Splash `src/components/splash.tsx` · 404 `src/app/not-found.tsx`.

## Suggested prompt for Claude Code
"Implement the redesign in `design_handoff_pas_redesign/`. Treat `Local Stores Prototype.dc.html` as the pixel-exact source of truth: copy every inline style value, SVG path, copy string, animation timing and easing literally. Work one screen at a time in this order: tokens/fonts → bottom bar → Home → Post → Map → Add Place → Saved/Me/Activity → Splash/404/Offline. Keep existing Firebase data, auth and moderation logic. After each screen, run the app at 390×844 next to the prototype and fix any difference before continuing. Open one PR per screen."
