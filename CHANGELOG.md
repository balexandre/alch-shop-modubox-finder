# Changelog

Each entry covers one Master set release (index changes) and any site changes made with it.
The full per-file diff is in `changes/<version>.md`.

## 2026-05-26 · May 26th release (first index)

**Master set contents:** 7,303 files in 136 folders (7,206 STL, 81 3MF, 15 PDF, 1 PNG).

**Known quirks in the source files**
- Stackable 4H and 5H files have the wrong height in their names. The folder is correct (verified by measuring).
- `organizers/four cup 2x3` contains a bottom named `2x2`.

**Site**
- First mockup: Find a box (style → height → footprint matrix), Search (sizes like `2x3`, heights like `4h`, `ø55`, free text), Browse (folder tree with guides), and a 3D preview generated from the file name.
- Find a box now has picture cards for each style: top, underside and cut-away views rendered from one STL per style. Added the Filler blank and Edgegrid styles; the Edgegrid matrix is grid count × gap in mm.
- A theme button cycles system → light → dark, and the choice is saved in the browser.
- Each PDF/PNG has a title, page count, description and tags (`data/docs.json`), and these are searchable.
- The Stackable naming warning only shows for this release.
- Links to Alexander's label generator (label.alch.shop): in the header, and as a card on each box that says which Box type and Width to pick. The generator has no URL parameters, so it can't be pre-filled.
- Optional local Master set path: "Copy path" then gives the full path on your computer.
- Guides in `data/guides.json` are drafts written from the folder structure. They still need checking against Alexander's videos and PDFs.
