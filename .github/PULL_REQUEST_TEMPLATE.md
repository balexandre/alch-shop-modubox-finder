## What does this change?

<!-- A short description of the change and why it's useful. -->

## Type of change

- [ ] Site feature or fix (`index.html`, `js/`)
- [ ] Index data (`data/`, `tools/build_index.py`)
- [ ] How-to notes or PDF descriptions (`data/guides.json`, `data/docs.json`)
- [ ] Naming issue or Master set release update
- [ ] Docs only

## Checklist

- [ ] **No Master set files are included.** No STL, 3MF, PDF or images from the set, and no copied PDF content (cut lists, dimensions, steps). Only names, sizes and short descriptions.
- [ ] Tested locally (`python3 -m http.server 8765`, then open http://localhost:8765)
- [ ] `node tools/check_site.mjs` prints `NO ERRORS` (if you have Playwright installed)
- [ ] `CHANGELOG.md` updated if users will notice the change

## Screenshots

<!-- For visual changes, add a before/after screenshot. -->
