#!/usr/bin/env python3
"""Build a metadata-only index of the ModuBOX Master set.

Only folder names, file names, sizes and attributes parsed from the names are
written out. No 3D geometry or PDF content leaves your machine.

Usage:
  python3 -I tools/build_index.py --src "/mnt/c/Users/<you>/Downloads/01_ModuBOX - Master set" \
      --version 2026-05-26 [--label "May 26th release"]

Writes:
  data/versions/<version>.json   full index used by index.html
  data/versions.json             list of known versions (newest first)
  docs/catalog-<version>.md      compact catalogue for feeding to Claude
  changes/<version>.md           diff against the previous version (if any)
"""
import argparse
import json
import os
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GRID_MM = 55          # one grid unit, measured from ModuBOX_1H21_1x1.STL (54.8 mm + clearance)
IGNORE = {".DS_Store", "Thumbs.db", "desktop.ini"}
PRINTERS = ["A1", "Mini", "H2D", "H2S", "H2C", "X1C", "P1P", "P1S"]

RE_SIZE = re.compile(r"(?<![\d.])(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)(?![\d.])", re.I)
RE_HEIGHT = re.compile(r"(?<![A-Za-z\d])([1-6])H(?:[ _]?(\d{2,3})(?:mm)?)?(?![a-z])", re.I)
RE_HEIGHT_RANGE = re.compile(r"([1-6])H-([1-6])H", re.I)
RE_DIAM = re.compile(r"Ø\s*(\d+(?:\.\d+)?)")
RE_LEN = re.compile(r"(?<![A-Za-z])X(\d+)(?![\d.x])")
RE_MT = re.compile(r"\bMT([1-5])\b")
RE_THICK = re.compile(r"_(\d{1,2})mm(?:\.|$|_)")
RE_PLUS = re.compile(r"\+\s*(\d+)mm")


def kind_of(name):
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    return {"stl": "stl", "3mf": "3mf", "pdf": "pdf", "png": "image", "jpg": "image",
            "jpeg": "image", "step": "step", "stp": "step", "f3d": "cad"}.get(ext, ext or "other")


def parse(name, folder):
    """Pull searchable attributes out of a file name (and its folder as fallback)."""
    stem = re.sub(r"(\.stl)+$|\.3mf$|\.pdf$|\.png$", "", name, flags=re.I)
    a = {}
    m = RE_SIZE.search(stem)
    if m:
        a["w"], a["d"] = float(m.group(1)), float(m.group(2))
    if "w" in a and (a["w"] > 20 or a["d"] > 20):      # e.g. sandpaper 70x200 is mm, not grid units
        a["paper"] = f"{a.pop('w'):g}x{a.pop('d'):g}mm"
    m = RE_HEIGHT_RANGE.search(stem)
    if m:
        a["hRange"] = [int(m.group(1)), int(m.group(2))]
    else:
        # The folder is authoritative: in the May 2026 set Stack_4H75mm/ holds files named
        # ModuBOX_Stack_5H93_* that measure 75 mm tall. Flag such disagreements.
        mf = RE_HEIGHT.search(folder.split("/")[-1])
        mn = RE_HEIGHT.search(stem)
        if mf:
            a["h"] = int(mf.group(1))
            if mn and int(mn.group(1)) != a["h"]:
                a["warn"] = f"Name says {mn.group(1)}H but folder (and real height) is {a['h']}H"
        elif mn:
            a["h"] = int(mn.group(1))
    if m := RE_DIAM.search(stem):
        a["dia"] = float(m.group(1))
    if m := RE_LEN.search(stem):
        a["len"] = int(m.group(1))
    if m := RE_MT.search(stem):
        a["taper"] = "MT" + m.group(1)
    elif "R8" in stem:
        a["taper"] = "R8"
    if m := RE_PLUS.search(stem):
        a["plus"] = int(m.group(1))
        if g := re.search(r"_(\d+) Grid", stem):
            a["cells"] = int(g.group(1))
    elif "Case v2" in folder or "Wood Case_v2" in folder:
        if m := RE_THICK.search(stem + "."):
            a["thick"] = int(m.group(1))
    if "Default" in stem:
        a["default"] = True
    for p in PRINTERS:
        if re.search(rf"(?<![A-Za-z0-9]){p}(?![A-Za-z0-9])", stem):
            a["printer"] = p
            break
    # Shape hint for the 3D preview
    low = (folder + "/" + stem).lower()
    if "basegrid" in low or "base grids" in low:
        a["shape"] = "grid"
    elif "edgegrid" in low:
        a["shape"] = "edge"
    elif "blank" in low:
        a["shape"] = "blank"
    elif "modubox" in low and "w" in a and ("h" in a) and "taper" not in a:
        a["shape"] = "box"
    elif "bowl" in low and "w" in a:
        a["shape"] = "bowl"
    elif "bitholder" in low and "w" in a:
        a["shape"] = "blank"
    return a


def scan(src):
    src = Path(src)
    folders = []
    for dirpath, dirnames, filenames in os.walk(src):
        dirnames.sort(key=str.lower)
        rel = Path(dirpath).relative_to(src).as_posix()
        rel = "" if rel == "." else rel
        files = []
        for fn in sorted(filenames, key=str.lower):
            if fn in IGNORE or fn.startswith("._"):
                continue
            size = (Path(dirpath) / fn).stat().st_size
            files.append({"n": fn, "k": kind_of(fn), "s": size, "a": parse(fn, rel)})
        folders.append({"p": rel, "files": files})
    return folders


def pattern_of(name):
    """Collapse numbers so related files group together in the Claude catalogue."""
    p = re.sub(r"\d+(?:\.\d+)?x\d+(?:\.\d+)?", "{WxD}", name)
    p = re.sub(r"Ø\d+(?:\.\d+)?", "Ø{dia}", p)
    p = re.sub(r"(?<![A-Za-z])X\d+(?![A-Za-z])", "X{len}", p)
    p = re.sub(r"_\d+ Grid", "_{N} Grid", p)
    p = re.sub(r"\d+mm", "{n}mm", p)
    return p


def catalogue_md(index):
    out = [f"# ModuBOX Master set – file catalogue ({index['version']})", "",
           f"Source label: {index['label']}. Generated {index['generated']}.",
           f"{index['stats']['files']} files in {index['stats']['folders']} folders. "
           f"Grid unit = {GRID_MM} mm; box height nH = 21 + 18·(n−1) mm.", "",
           "Each folder lists its file-name patterns with counts and example names.", ""]
    for f in index["folders"]:
        if not f["files"]:
            continue
        out.append(f"## `{f['p'] or '/'}` ({len(f['files'])})")
        groups = defaultdict(list)
        for x in f["files"]:
            groups[pattern_of(x["n"])].append(x)
        for pat, xs in groups.items():
            sizes = sorted({f"{x['a']['w']:g}x{x['a']['d']:g}" for x in xs if "w" in x["a"]},
                           key=lambda s: tuple(map(float, s.split("x"))))
            line = f"- `{pat}` ×{len(xs)}"
            if sizes:
                line += f" — sizes {', '.join(sizes) if len(sizes) <= 12 else ', '.join(sizes[:6]) + ' … ' + ', '.join(sizes[-3:])}"
            elif len(xs) > 1:
                line += f" — e.g. `{xs[0]['n']}`, `{xs[-1]['n']}`"
            out.append(line)
        out.append("")
    return "\n".join(out)


def diff_md(prev, cur):
    def paths(ix):
        return {f"{f['p']}/{x['n']}": x["s"] for f in ix["folders"] for x in f["files"]}
    a, b = paths(prev), paths(cur)
    added = sorted(set(b) - set(a))
    removed = sorted(set(a) - set(b))
    changed = sorted(p for p in set(a) & set(b) if a[p] != b[p])
    out = [f"# Changes {prev['version']} → {cur['version']}", "",
           f"Added {len(added)} · removed {len(removed)} · size changed {len(changed)}", ""]
    for title, items in (("Added", added), ("Removed", removed), ("Changed (file size differs)", changed)):
        if items:
            out += [f"## {title}", ""] + [f"- `{p}`" for p in items] + [""]
    return "\n".join(out), (len(added), len(removed), len(changed))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--version", required=True, help="e.g. 2026-05-26")
    ap.add_argument("--label", default=None)
    args = ap.parse_args()

    folders = scan(args.src)
    n_files = sum(len(f["files"]) for f in folders)
    index = {
        "version": args.version,
        "label": args.label or args.version,
        "generated": date.today().isoformat(),
        "gridMm": GRID_MM,
        "stats": {"files": n_files, "folders": len(folders)},
        "folders": folders,
    }

    vdir = ROOT / "data" / "versions"
    vdir.mkdir(parents=True, exist_ok=True)
    vlist_path = ROOT / "data" / "versions.json"
    vlist = json.loads(vlist_path.read_text()) if vlist_path.exists() else []
    vlist = [v for v in vlist if v["version"] != args.version]
    prev = max((v["version"] for v in vlist if v["version"] < args.version), default=None)

    (vdir / f"{args.version}.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")))
    vlist.append({"version": args.version, "label": index["label"], "files": n_files})
    vlist.sort(key=lambda v: v["version"], reverse=True)
    vlist_path.write_text(json.dumps(vlist, ensure_ascii=False, indent=2))

    (ROOT / "docs").mkdir(exist_ok=True)
    (ROOT / "docs" / f"catalog-{args.version}.md").write_text(catalogue_md(index))

    (ROOT / "changes").mkdir(exist_ok=True)
    if prev:
        md, counts = diff_md(json.loads((vdir / f"{prev}.json").read_text()), index)
        summary = f"+{counts[0]} / −{counts[1]} / ~{counts[2]} files vs {prev}"
    else:
        md, summary = f"# {args.version}\n\nFirst indexed version ({n_files} files).\n", f"first indexed version, {n_files} files"
    (ROOT / "changes" / f"{args.version}.md").write_text(md)
    print(f"{args.version}: {n_files} files in {len(folders)} folders — {summary}")


if __name__ == "__main__":
    sys.exit(main())
