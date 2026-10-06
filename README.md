# Notgrizy — Minecraft Thumbnail Portfolio

A single-page portfolio for a Minecraft thumbnail designer. Plain HTML5, one
hand-written stylesheet, one small script — no frameworks, no build step, no
dependencies. Open `index.html` and it works, including over `file://`.

```
Portfolio/
├── index.html                  the whole page
├── assets/
│   ├── styles.css              all styling (dark cyan/teal theme)
│   └── main.js                 card rendering, counters, lightbox, nav
├── thumbnails/                 ← put every image here
│   ├── D4viox.png              the logo (never counted as a thumbnail)
│   └── thumbnails.js           generated list of pieces — don't hand-edit the entries
├── tools/
│   ├── scan-thumbnails.mjs     rebuilds thumbnails/thumbnails.js
│   └── check-layout.mjs        dev check for horizontal overflow
└── package.json                just the two npm scripts
```

## Adding thumbnails

1. Drop your images into `thumbnails/`.
2. Run the scan:

   ```bash
   npm run scan
   ```

   That's it — no Node installed? Just open `tools/scan-thumbnails.mjs` with
   Node directly, or add the cards by hand (see below).

3. Refresh the page. The grid, the **Thumbnails** heading count and the
   **Thumbnails Created** stat all update themselves.

The scan **keeps any title you have edited**, so renaming `Nether_Update-2.png`
to `nether_portal_showcase.png` only changes the `src` — your custom title
survives as long as the filename does.

Accepted extensions: `.png` `.jpg` `.jpeg` `.webp` `.gif` `.avif`.
`D4viox.png` is always treated as the logo and never counted as a piece of work.
Filenames with spaces or `#` are handled automatically.

### Editing titles

Titles are derived from the filename (`epic_sword_fight-2.png` → "Epic Sword
Fight 2"). To use your own wording, edit the `title` field in
`thumbnails/thumbnails.js` and re-run `npm run scan` — the edit is preserved.

To give a piece a different tool label, change its `tool` value the same way.

### Adding cards by hand instead

If you'd rather not run anything, drop an `<article class="thumb-card">` block
straight into `<div class="work__grid" id="thumb-grid">` in `index.html`:

```html
<article class="thumb-card">
  <div class="thumb-card__media">
    <img src="thumbnails/my_episode.png" alt="My Episode" loading="lazy">
    <span class="thumb-card__badge">Photoshop</span>
  </div>
  <div class="thumb-card__body">
    <h3 class="thumb-card__title">My Episode</h3>
    <span class="thumb-card__meta">Minecraft Thumbnail</span>
  </div>
</article>
```

`main.js` counts `.thumb-card` elements, so the counters stay correct and no
JavaScript changes are needed. Note that `thumbnails/thumbnails.js` wins when it
contains entries — if you mix the two, delete the generated file or clear its
array and the manual cards take over.

## Changing the details

| What | Where |
| --- | --- |
| Email address | `index.html` — the `mailto:` link and the contact meta list |
| Discord handle | `index.html` — every `data-copy="notgrizy"` attribute |
| Years of experience | `index.html` — `<span data-count="4">` in the first stat card |
| Bio / hero copy | `index.html` — `.hero__bio` |
| Colours | `assets/styles.css` — the `:root` block at the top |
| Section titles | `index.html` |

The **Years of Experience** number animates from `0` to whatever is in
`data-count`, and the thumbnail counters are always derived from the real
number of cards, so you never have to update them by hand.

## Contact links

The Discord buttons **copy** the username `notgrizy` to the clipboard rather
than linking out, because Discord has no public profile URL for a username.
Swap them for real links by replacing the `<button data-copy="...">` with an
`<a href="https://discord.gg/your-invite">` if you have an invite or a numeric
user ID.

## Running it

```bash
npm run serve      # optional local server on http://localhost:5173
npm run scan       # rebuild the thumbnail list
npm run check      # verify no horizontal overflow (needs Chrome or Edge)
```

`npm run check` renders the page in headless Chrome at 320–1600 px and reports
any element that overflows the viewport. It's only a development aid — the site
needs none of `tools/` to run.