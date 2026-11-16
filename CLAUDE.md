# ModuBOX Finder: context for Claude

An unofficial, static, searchable index of the **ModuBOX Master set** by Alexander Chapel
(https://www.alch.shop/). It's published with GitHub Pages and tells people *which file to use and
where it is* inside the Master set download.

## Hard rule: no proprietary files in this repo
Never commit STL/3MF/PDF/PNG files from the Master set, and never commit geometry or text extracted
from them. Allowed: folder names, file names, sizes, attributes parsed from names, small rendered
style pictures (`img/styles/`), and a title plus a 1–2 sentence description of each PDF that says what
*kind* of information it has (never its cut lists, dimensions or steps).
The 3D preview in the detail panel is a box generated from the file name, not the real model.

## Layout
- `index.html`: the whole site (Tailwind CDN, Alpine.js, three.js r128). Tabs: Find a box, Search, Browse, Changes.
  The `styles` array in the script defines the Find-a-box styles (folder prefix, matrix axes, descriptions).
  The theme button cycles system → light → dark and saves the choice in `localStorage.theme`.
  The optional local Master set path is saved in `localStorage.localRoot` and used by "Copy path".
- Label generator: https://label.alch.shop has box types Regular / Stackable / ALEX and a width in grid units. It has no URL parameters, so `labelHint()` in index.html tells the user what to pick. Assumption to verify: label width = the first number (W) in WxD.
- `js/planner.js`: pure drawer-planner logic (`planDrawer`, the `PRINTERS` bed presets). Tiles are split into the fewest near-equal parts that fit the bed (max 10 cells, BaseGrid files only exist as AxB with A ≤ B). Edgegrids are N×55 mm long and exactly gap-mm wide, so the corners where two strips meet stay empty. Corner fillers: where two strips meet, the corner is cut from `Edgegrid_1 Grid + <side gap>mm` (55 mm long). Corner lengths are packed first-fit into as few pieces as possible (1 mm kerf), so one piece usually gives both corners on a side. Height advice is deliberately conservative. SVG attributes bound with Alpine need `.camel` (`:view-box.camel`), because the HTML parser lowercases `:viewBox` and SVG then ignores it. The Plan a drawer tab draws its SVG with `x-html`, because `<template x-for>` doesn't work inside `<svg>`. Custom printers are saved in `localStorage.printers` and drawer inputs in `localStorage.plan`.
- `.github/`: PR template (its main rule is no Master set files) and issue forms (bug, wrong file info / naming issue, idea).
- `tools/render_thumbs.mjs`: dependency-free Node STL renderer. It writes `img/styles/<style>{,-under,-section}.png` (top, underside and cut-away views) from the representative files listed in its `PICKS` map. Re-run it when a style changes, then check the pictures.
- `data/docs.json`: title, page count, description and tags for each PDF/PNG, keyed by path relative to the Master set root. Its text is included in search.
- `tools/build_index.py`: scans a local Master set folder and writes everything under `data/`, `docs/`, `changes/`.
- `data/versions.json`: list of indexed releases, newest first. `data/versions/<date>.json` holds the full index for one release.
- `data/guides.json`: hand-written "how to use" notes, keyed by folder-path prefix (the longest prefix wins). `draft: true` means not verified against Alexander's docs.
- `docs/catalog-<date>.md`: a compact catalogue grouped by file-name pattern. **Read this first** to understand a release without loading the 700 KB JSON.
- `changes/<date>.md`: an automatic file diff against the previous release. `CHANGELOG.md` is the human summary per release.

## Domain facts (measured from the STLs)
- Grid unit = 55 mm (a 1x1 box measures 54.8 mm, and the base grid 1x1 measures 54.9 mm).
- Height nH = 21 + 18·(n−1) mm: 1H=21, 2H=39, 3H=57, 4H=75, 5H=93, 6H=111.
- HalfGrid = 0.5-unit steps. Base grid is 3.85 mm thick.
- Folder height is authoritative. In 2026-05-26, `Stack_4H75mm/` holds `ModuBOX_Stack_5H93_*` (actually 75 mm tall)
  and `Stack_5H93mm/` holds `ModuBOX_Stack_6H93_*` (actually 93 mm). The builder flags these with `a.warn`.
- `Regular/4H_75mm/` files have no height in the name (`ModuBOX_WxD.STL`).
- Style differences, verified from the geometry:
  - Stackable = Regular plus a chamfered inner lip at the top. The cut-away picture shows it.
  - Split 4H 2x2 is vertex-identical to Regular 4H 2x2. Split only means "use the ModuBOX_Split Bambu print profile".
- Guide warnings can be version-keyed (`"warn": {"2026-05-26": "..."}`), and they only show for that release.
- `organizers/four cup 2x3/` contains `Four cup_Bottom 2x2.STL`, but it measures 164.5 mm wide: it is the 2x3 bottom (verified). The builder flags folder-vs-name size mismatches too.
- `docs/naming-issues-<version>.md` and `.csv` hold the verified rename list (161 files in 2026-05-26). Regenerate it per release by measuring the flagged STLs' bounding boxes.
- `.md` links on the site point to the GitHub blob view (`REPO` constant), because Pages serves Markdown as raw text.

## Index record format (`data/versions/<date>.json`)
`{version,label,generated,gridMm,stats,folders:[{p:"rel/folder",files:[{n:name,k:kind,s:bytes,a:attrs}]}]}`
`attrs` may include: `w,d` (grid units), `h` (1–6), `hRange`, `dia`, `len`, `taper` (MT1–5, R8), `paper`,
`cells`+`plus` (edgegrids), `thick` (wood panel mm), `printer` (Bambu model), `default`, `shape`
(box|blank|bowl|grid|edge, used by the 3D preview), `warn`.

## Releasing a new iteration (when Alexander updates the set)
1. Download the new Master set and unzip it somewhere.
2. Run `python3 -I tools/build_index.py --src "<path>" --version YYYY-MM-DD --label "<Month Dth release>"`.
3. Read `changes/YYYY-MM-DD.md` and the new `docs/catalog-YYYY-MM-DD.md`.
4. Add a section to `CHANGELOG.md` covering index changes (from step 3) and site changes.
5. Add new PDFs to `data/docs.json` (title and short description only). Check whether the name quirks were fixed, and version-key any new warnings.
6. Update `data/guides.json` for new or renamed folders, and update the parsing rules in `build_index.py` for new naming patterns.
7. Test locally with `python3 -m http.server 8765`, then run `node tools/check_site.mjs` (headless Chromium smoke test; it must print NO ERRORS) and look at its screenshots.

## URL routing
`#<view>[&f=<file>][&q=<search>][&d=<folder>]`, built by `routeHash()` and read by `applyRoute()`. Tab changes `pushState`; selection, search and folder changes `replaceState`. The `ROUTING` flag stops watchers from writing back while a URL is being applied. Old `#f=` and `#q=` links infer the view. A route with no `f` clears the selection.

## Alpine gotchas (learned the hard way)
- Computed helpers run before the index has loaded. Return empty values then, never `null`.
- `memo()` keys include `items.length`, so results computed before the data arrived are never reused.
- Don't wrap the detail panel in `x-if`: a fast null→item switch broke Alpine's `x-for` cleanup. Use `x-show` with the safe getters (`sel`, `doc`, `lh`, `fguide`, `sguide`).
- Keep big data frozen (`Object.freeze`) and keep caches and three.js objects outside the Alpine object.
