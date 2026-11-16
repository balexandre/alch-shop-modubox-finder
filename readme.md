# ModuBOX Finder

An unofficial, searchable map of the **ModuBOX Master set** by Alexander Chapel. Use it to find which
file to print and where it is in the download.

**Live site:** https://balexandre.github.io/alch-shop-modubox-finder/

## About this repository

I'm a proud owner of the ModuBOX Master set. I built this because the set holds more than 7,000 files,
and I wanted a quick way to find the right one and know how to use it.

**This repository doesn't share any of the design files.** It has no STL, 3MF or PDF files from the set.
It only contains:

- an index of folder names, file names and file sizes
- short notes on how the pieces fit together
- one-line descriptions of what each PDF covers (never its contents)
- small pictures of each box style

To use the files, you need your own copy of the Master set. Please buy it from Alexander at
**https://www.alch.shop/**. His work is worth supporting.

## What it does

- Find a box: pick a style, height and footprint to get the exact file path.
- Plan a drawer: enter your drawer size and printer to get base grids split to fit your bed, edge strips, which box heights fit, and the full list of files to print.
- Search: try `stack 2x3 4h`, `mt3 ø55`, `edgegrid 5 grid 25mm`, or `wood case 9mm`.
- Browse: the folder tree, with short how-to notes and PDF descriptions.
- Label generator: each box shows the settings to use in Alexander's https://label.alch.shop.
- Naming issues: a verified list of files whose names don't match their real size
  ([2026-05-26 list](docs/naming-issues-2026-05-26.md)).

## Contributing

Fixes and ideas are welcome. Fork the repo, make your change and open a pull request, or open an issue.
The rules are in the pull request template, but the main one is: **never commit files from the Master set**
(no STL, 3MF or PDF). Only names, sizes and short descriptions.

## Running it locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. See `CLAUDE.md` for how to index a new release and `CHANGELOG.md` for the release history.
