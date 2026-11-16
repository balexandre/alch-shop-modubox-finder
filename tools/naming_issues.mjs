#!/usr/bin/env node
// Build the verified naming-issues list for one release.
//
// Reads the index (data/versions/<version>.json), takes every file flagged with `a.warn` by build_index.py
// (name disagrees with its folder on height or footprint), measures the real STL in your local Master set,
// proposes the corrected name and writes:
//   docs/naming-issues-<version>.md   (summary + full list, linked from the site)
//   docs/naming-issues-<version>.csv  (folder, current, proposed, measured_mm, status, reason)
// Only names and measurements are written. Nothing from the STLs themselves.
//
// Usage: node tools/naming_issues.mjs <version> "<path to the Master set folder>"
import fs from 'node:fs';
import path from 'node:path';

const [version, SRC] = process.argv.slice(2);
if (!version || !SRC) { console.error('usage: node tools/naming_issues.mjs <version> "<Master set path>"'); process.exit(1); }
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const GRID = 55, heightMm = n => 21 + 18 * (n - 1), TOL_H = 0.6, TOL_XY = 3;

const RE_SIZE = /(?<![\d.])(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)(?![\d.])/i;
const RE_H = /(?<![A-Za-z\d])([1-6])H(\d{2,3})?/;
const stemOf = n => n.replace(/(\.stl)+$|\.3mf$/i, '');

function bbox(file) {                                          // binary or ASCII STL
  const b = fs.readFileSync(file);
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  const add = v => v.forEach((x, i) => { if (x < mn[i]) mn[i] = x; if (x > mx[i]) mx[i] = x; });
  if (b.subarray(0, 5).toString() === 'solid' && b.subarray(0, 400).toString().includes('facet')) {
    for (const m of b.toString().matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)) add([+m[1], +m[2], +m[3]]);
  } else {
    const n = b.readUInt32LE(80);
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { const o = 84 + i * 50 + 12 + k * 12; add([b.readFloatLE(o), b.readFloatLE(o + 4), b.readFloatLE(o + 8)]); }
  }
  return mx.map((v, i) => Math.round((v - mn[i]) * 10) / 10);
}

const ix = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/versions', version + '.json')));
const rows = [];
for (const f of ix.folders) for (const x of f.files) {
  if (!x.a.warn || x.k !== 'stl') continue;
  const stem = stemOf(x.n), last = f.p.split('/').pop();
  const ext = x.n.slice(stem.length);                         // keep the extension as is (e.g. .STL, .STL.stl)
  let proposed = stem, reason = [], status = 'confirmed';
  const box = bbox(path.join(SRC, f.p, x.n));
  // Height: folder says nH, name says something else -> rewrite the first nH[mm] token.
  const nh = stem.match(RE_H), fh = last.match(RE_H);
  if (nh && fh && (nh[1] !== fh[1] || (nh[2] && +nh[2] !== heightMm(+fh[1])))) {
    const h = +fh[1];
    proposed = proposed.replace(RE_H, nh[2] ? `${h}H${heightMm(h)}` : `${h}H`);
    reason.push(`Name says ${nh[1]}H${nh[2] ? '/' + nh[2] + ' mm' : ''}; folder is ${h}H/${heightMm(h)} mm`);
    if (Math.abs(box[2] - heightMm(h)) > TOL_H) status = 'check';
    else reason.push(`measured ${box[2]} mm tall`);
  }
  // Footprint: folder says WxD, name says another WxD -> rewrite the name's WxD.
  const ns = stem.match(RE_SIZE), fs_ = last.match(RE_SIZE);
  if (ns && fs_ && [ns[1], ns[2]].sort().join() !== [fs_[1], fs_[2]].sort().join()) {
    proposed = proposed.replace(RE_SIZE, `${fs_[1]}x${fs_[2]}`);
    const want = Math.max(+fs_[1], +fs_[2]) * GRID, longest = Math.max(box[0], box[1]);
    reason.push(`Name says ${ns[1]}x${ns[2]}; folder is ${fs_[1]}x${fs_[2]}`);
    if (Math.abs(longest - want) > TOL_XY) status = 'check';
    else reason.push(`measured ${longest} mm long (${Math.max(+fs_[1], +fs_[2])} grid)`);
  }
  proposed += ext;
  if (proposed === x.n) { status = 'check'; reason.push(x.a.warn); }
  rows.push({ folder: f.p, current: x.n, proposed, measured_mm: box.join(' x '), status, reason: reason.join('; ') });
}

const dims = n => (n.match(/_(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)\./) || [0, 0, 0]).slice(1).map(Number);
rows.sort((a, b) => a.folder.localeCompare(b.folder) || dims(a.current)[0] - dims(b.current)[0] || dims(a.current)[1] - dims(b.current)[1] || a.current.localeCompare(b.current));

const csvCell = v => /[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v;
const cols = ['folder', 'current', 'proposed', 'measured_mm', 'status', 'reason'];
fs.writeFileSync(path.join(ROOT, 'docs', `naming-issues-${version}.csv`), [cols.join(','), ...rows.map(r => cols.map(c => csvCell(r[c])).join(','))].join('\n') + '\n');

const pattern = n => n.replace(/_\d+(?:\.\d+)?x\d+(?:\.\d+)?\./, '_<W>x<D>.');
const groups = new Map();
for (const r of rows) { const k = r.folder + '|' + pattern(r.current); (groups.get(k) ?? groups.set(k, []).get(k)).push(r); }
const toCheck = rows.filter(r => r.status === 'check').length;
const md = [
  `# Naming issues in the ${version} Master set`, '',
  "Files whose name doesn't match their folder. Every entry was checked by measuring the STL's bounding box (W × D × H, in mm).",
  `Only the names are wrong; the models themselves are fine. A spreadsheet-friendly copy is in \`naming-issues-${version}.csv\`.`, '',
  `**${rows.length} files**${toCheck ? `, of which **${toCheck} need a manual check** (measurement didn't confirm the folder)` : ', all confirmed by measurement'}.`, '',
  'Generated by `tools/naming_issues.mjs`.', '',
  '## Summary', '', '| Folder | Files | Current name | Should be | Measured |', '|---|---|---|---|---|',
  ...[...groups.values()].map(g => {
    const r = g[0], many = g.length > 1;
    return `| \`${r.folder}/\` | ${g.length} | \`${many ? pattern(r.current) : r.current}\` | \`${many ? pattern(r.proposed) : r.proposed}\` | ${many ? 'height ' + [...new Set(g.map(x => x.measured_mm.split(' x ')[2]))].join(', ') + ' mm' : r.measured_mm + ' mm'} |`;
  }), '',
  '**Rename order matters.** If a corrected name equals a name that exists today in another folder (e.g. the 4H folder\'s files are called',
  'what the 5H folder\'s will be called), rename those first so nothing gets overwritten if both folders end up in one place.', '',
  '## Full list', '',
];
for (const f of [...new Set(rows.map(r => r.folder))]) {
  const g = rows.filter(r => r.folder === f);
  md.push(`### \`${f}/\` (${g.length})`, '', '| Current | Should be | Measured (mm) | Status |', '|---|---|---|---|',
    ...g.map(r => `| \`${r.current}\` | \`${r.proposed}\` | ${r.measured_mm} | ${r.status} |`), '');
}
fs.writeFileSync(path.join(ROOT, 'docs', `naming-issues-${version}.md`), md.join('\n'));
console.log(`${version}: ${rows.length} naming issues (${toCheck} need a manual check) -> docs/naming-issues-${version}.md/.csv`);
