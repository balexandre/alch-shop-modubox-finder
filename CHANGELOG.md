# Changelog

Each entry covers one Master set release (index changes) and any site changes made with it.
The full per-file diff is in `changes/<version>.md`.

## 2026-05-26 · May 26th release (first index)

**Master set contents:** 7,303 files in 136 folders (7,206 STL, 81 3MF, 15 PDF, 1 PNG).

**Known quirks in the source files**
- Stackable 4H and 5H files have the wrong height in their names. The folder is correct (verified by measuring).
- `organizers/four cup 2x3` contains a bottom named `2x2`. It measures 164.5 mm wide, so it is really the 2x3 bottom.
- Full verified rename list (161 files): `docs/naming-issues-2026-05-26.md` / `.csv`.

**Site**
- First mockup: Find a box (style → height → footprint matrix), Search (sizes like `2x3`, heights like `4h`, `ø55`, free text), Browse (folder tree with guides), and a 3D preview generated from the file name.
- Find a box now has picture cards for each style: top, underside and cut-away views rendered from one STL per style. Added the Filler blank and Edgegrid styles; the Edgegrid matrix is grid count × gap in mm.
- A theme button cycles system → light → dark, and the choice is saved in the browser.
- Each PDF/PNG has a title, page count, description and tags (`data/docs.json`), and these are searchable.
- The Stackable naming warning only shows for this release.
- Links to Alexander's label generator (label.alch.shop): in the header, and as a card on each box that says which Box type and Width to pick. The generator has no URL parameters, so it can't be pre-filled.
- Public site shows a one-time "this is an index, not a download" notice with an "I understand" button (hidden on localhost), and Browse explains that files aren't hosted.
- The theme button is now the rightmost header control.
- Fixed: Browse crashed on load (tree read before the index loaded), the detail panel threw Alpine x-for errors, and Find a box could show 0 files from a stale cache. Shared links now open Browse at the file's folder. Added `tools/check_site.mjs` (headless smoke test).
- The preview placeholder now depends on the file type (PDF → browser or PDF reader, PNG → image viewer, 3MF → Bambu Studio, STL → slicer).
- Favicon matching the header logo. The Changes tab and the file warnings link to the naming-issues list, and the .md links open on GitHub.
- New **Plan a drawer** tab: enter the drawer size (and optionally height) and pick a printer, or add your own. It gives base grid tiles split to fit the bed, edge strips placed left/right/split and front/back/split, which box heights and stacks fit, and a printable file list (copy or CSV). Clicking a piece shows its file.
- Plan a drawer: the layout now uses the full page width and up to 75% of the screen height. It was drawn at 1 px per mm because `viewBox` wasn't applied. Thin strips have a wider invisible click area, and the clicked piece shows under the drawing with Copy path and Show in Browse. Corners can be filled: the plan adds a 1-grid edge piece per side and says what lengths to cut in the slicer. The file list shows these notes, and Copy and CSV include them.
- Printer presets: the H2D is now listed twice, "H2D, single nozzle" (325 × 320 mm) and "H2D, both nozzles" (300 × 320 mm), from Bambu's specs. The old "H2D (both nozzles)" entry had the single-nozzle size and moves to the single-nozzle option.
- Shareable views: the URL is `#<view>` (`#find`, `#plan`, `#search`, `#browse`, `#changes`), plus `&f=<file>`, `&q=<search>` or `&d=<folder>`. Tab changes add a history entry, so Back and Forward work. Old `#f=` and `#q=` links still open.
- The footer moved out of the side panel to the bottom of every page (it was missing on Plan a drawer). Clicking "Buy the files" or the footer alch.shop link releases a few red hearts that fade away; none appear if the system is set to reduce motion.
- Find a box: choosing a style or height now also selects a box (same footprint when it exists, otherwise 2×2 or the nearest size), so the 3D preview and details always follow. Before, only the size squares did.
- 3D preview: you can tilt below the model (drag up) to see the underside, with a soft light from below.
- Footer invites contributions (fork, PR, issues). Added a PR template and issue forms.
- Optional local Master set path: "Copy path" then gives the full path on your computer.
- Guides in `data/guides.json` are drafts written from the folder structure. They still need checking against Alexander's videos and PDFs.
