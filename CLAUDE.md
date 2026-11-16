# ModuBOX Finder: context for Claude

An unofficial, static, searchable index of the **ModuBOX Master set** by Alexander Chapel
(https://www.alch.shop/). It's published with GitHub Pages and tells people *which file to use and
where it is* inside the Master set download. Live: https://balexandre.github.io/alch-shop-modubox-finder/

## Hard rules
- **No proprietary files in this repo.** Never commit STL/3MF/PDF/PNG files from the Master set, and never
  commit geometry or text extracted from them. Allowed: folder names, file names, sizes, attributes parsed
  from names, small rendered style pictures (`img/styles/`), and a title plus a 1–2 sentence description of
  each PDF that says what *kind* of information it has (never its cut lists, dimensions or steps).
- **Don't assume hardware facts.** Printer bed sizes and similar specs must come from published specs; note
  the source in a comment. (The H2D preset was once wrong for this reason.)
- **Workflow:** personal repo. Commit directly to `master` (no PRs), and push. Pages deploys from `master`, root.
  Only commit after `node tools/check_site.mjs` prints `NO ERRORS`.

## Layout
- `index.html`: the whole site (Tailwind CDN, Alpine.js 3.14, three.js r128) and its main script.
  Tabs: Find a box, Plan a drawer, Search, Browse, Changes. The detail panel (3D preview, path, details, label
  hint, how-to) is on the right and hidden on Plan a drawer. The footer is at the bottom of every page.
- `js/planner.js`: pure drawer-planner logic (`planDrawer`, `PRINTERS` bed presets, `PLAN` constants). It has no DOM, so Node can test it.
- `data/versions.json` + `data/versions/<date>.json`: the index per Master set release (newest first).
- `data/guides.json`: hand-written how-to notes keyed by folder-path prefix (longest prefix wins). `draft: true` = not
  verified against Alexander's docs. `warn` can be version-keyed: `{"2026-05-26": "..."}`.
- `data/docs.json`: title, pages, description and tags per PDF/PNG (relative path key). Included in search.
- `docs/catalog-<date>.md`: compact catalogue grouped by name pattern. **Read this first** to understand a release.
- `docs/naming-issues-<date>.md` / `.csv`: verified list of mislabelled files (161 in 2026-05-26).
- `changes/<date>.md`: automatic file diff against the previous release. `CHANGELOG.md`: human summary.
- `img/styles/<style>{,-under,-section}.png`: style pictures (top, underside, cut-away). `favicon.svg` matches the header logo.
- `tools/build_index.py`: scans a local Master set, writes `data/versions/*`, `docs/catalog-*`, `changes/*`.
- `tools/render_thumbs.mjs`: dependency-free STL renderer for the style pictures (`PICKS` map = representative files).
- `tools/check_site.mjs`: headless Chromium smoke test (Playwright). Clicks through every tab and the planner, and
  reports console/page errors. The file header explains running it on WSL without sudo.
- `.github/`: PR template (first rule: no Master set files) and issue forms (bug, wrong file info / naming issue, idea).
  Labels used: `bug`, `enhancement`, `data`.

## Site behaviour worth knowing
- **Find a box:** `styles` array (folder prefix, matrix axes, texts). Choosing a style or height calls
  `finderAutoSelect()`: it keeps the current footprint if it exists, otherwise 2×2, otherwise the nearest size, so the preview always follows.
- **3D preview:** a box generated from the file name (`drawPreview`), never the real model. You can tilt from
  −1.2 to 1.45 rad (drag up to see the underside). There's a fill light from below.
- **Plan a drawer:** tiles are split into the fewest near-equal parts that fit the bed (max 10 cells; BaseGrid files exist only as
  AxB with A ≤ B, so tiles are rotated). Edgegrids are N×55 mm long and exactly gap-mm wide. Where two strips meet,
  an optional corner filler is cut from `Edgegrid_1 Grid + <side gap>mm` (55 mm long). Corner lengths are packed first-fit (1 mm kerf),
  so one piece usually covers both corners on a side. Height advice is deliberately conservative (ignores nesting).
  The drawing is an SVG built with `x-html`. Every piece has an invisible wider outline for clicking, and the clicked piece shows inline.
- **Label generator:** https://label.alch.shop (types Regular / Stackable / ALEX, width in grid units) has no URL
  parameters, so `labelHint()` tells the user what to pick. Assumption still to verify: label width = W in WxD.
- **Public-site notice:** "index, not a download" banner with "I understand". Hidden on localhost.
- **Hearts:** `love()` on "Buy the files" and the footer alch.shop link. Hearts float down when the button is near the top. Disabled with reduced motion.
- **`.md` links** point to the GitHub blob view (`REPO` constant), because Pages serves Markdown as raw text.
- **Saved in the browser (localStorage):** `theme`, `localRoot` (Copy path prefix), `plan`, `printers` (custom), `ackIndex`.
  Renamed printer presets are migrated in `init()` (see `renamed`).

## URL routing
`#<view>[&f=<file>][&q=<search>][&d=<folder>]`, built by `routeHash()` and read by `applyRoute()`. Tab changes
`pushState`; selection, search and folder changes `replaceState`. The `ROUTING` flag stops watchers from writing back
while a URL is being applied. Old `#f=` / `#q=` links infer the view. A route without `f` clears the selection. Switching
to Browse with a file selected opens its folder.

## Domain facts (measured from the STLs)
- Grid unit = 55 mm (1x1 box 54.8 mm, base grid 1x1 54.9 mm). Height nH = 21 + 18·(n−1) mm: 21/39/57/75/93/111.
- HalfGrid = 0.5-unit steps. Base grid 3.85 mm thick. Edgegrid 4 mm thick.
- Stackable = Regular plus a chamfered inner lip at the top. Split 4H 2x2 is vertex-identical to Regular 4H 2x2:
  Split only means "use the ModuBOX_Split Bambu print profile".
- Folder height/size is authoritative, and the builder flags disagreements with `a.warn`. In 2026-05-26: `Stack_4H75mm/` holds
  `ModuBOX_Stack_5H93_*` (75 mm tall), `Stack_5H93mm/` holds `ModuBOX_Stack_6H93_*` (93 mm), and
  `organizers/four cup 2x3/…Bottom 2x2.STL` is really the 2x3 bottom (164.5 mm wide).
- `Regular/4H_75mm/` files have no height in the name (`ModuBOX_WxD.STL`). In `Wood Case_v2`, `_NNmm` is plywood thickness, not height.

## Index record format (`data/versions/<date>.json`)
`{version,label,generated,gridMm,stats,folders:[{p:"rel/folder",files:[{n:name,k:kind,s:bytes,a:attrs}]}]}`
`attrs` may include: `w,d` (grid units), `h` (1–6), `hRange`, `dia`, `len`, `taper` (MT1–5, R8), `paper`,
`cells`+`plus` (edgegrids), `thick` (wood panel mm), `printer` (Bambu model), `default`, `shape`
(box|blank|bowl|grid|edge, used by the 3D preview), `warn`.

## Releasing a new iteration (when Alexander updates the set)
1. Download the new Master set and unzip it somewhere.
2. `python3 -I tools/build_index.py --src "<path>" --version YYYY-MM-DD --label "<Month Dth release>"`.
3. Read `changes/YYYY-MM-DD.md` and the new `docs/catalog-YYYY-MM-DD.md`.
4. Naming issues: list files with `a.warn` in the new index, measure their STL bounding boxes, and write
   `docs/naming-issues-YYYY-MM-DD.md/.csv`. (No script in the repo yet. In 2026-05-26 this was done ad hoc.)
5. Add new PDFs to `data/docs.json` (title and short description only). Version-key any new guide warnings.
6. Update `data/guides.json` for new or renamed folders and the parsing rules in `build_index.py` for new names.
   Re-run `tools/render_thumbs.mjs` if a style's geometry changed.
7. Add a section to `CHANGELOG.md` (index changes + site changes).
8. `python3 -m http.server 8765`, then `node tools/check_site.mjs`: it must print `NO ERRORS`. Look at the screenshots.

## Alpine gotchas (learned the hard way)
- Computed helpers run before the index has loaded. Return empty values then, never `null`.
- `memo()` keys include `items.length`, so results computed before the data arrived are never reused.
- Don't wrap the detail panel in `x-if`: a fast null→item switch broke Alpine's `x-for` cleanup. Use `x-show` with the
  safe getters (`sel`, `doc`, `lh`, `fguide`, `sguide`).
- `<template x-for>` doesn't work inside `<svg>`. Build SVG markup and use `x-html`.
- SVG attributes need `.camel` (`:view-box.camel`): the HTML parser lowercases `:viewBox` and SVG ignores `viewbox`.
- Keep big data frozen (`Object.freeze`), and keep caches and three.js objects outside the Alpine object.
- Inline `//` comments in one-line handlers swallow the rest of the line. Put them at the end.
