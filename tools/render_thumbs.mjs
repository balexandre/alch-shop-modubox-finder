#!/usr/bin/env node
// Render small PNG pictures of representative STLs (one per style) with no dependencies.
// Only the rendered picture is published, never the STL itself.
//
// Usage: node tools/render_thumbs.mjs "<Master set path>" [outDir=img/styles]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const SRC = process.argv[2];
const OUT = process.argv[3] || 'img/styles';
if (!SRC) { console.error('usage: render_thumbs.mjs <master set dir> [outDir]'); process.exit(1); }

// id -> representative file (relative to the Master set root)
const PICKS = {
  regular:   '01_Boxes and grids/ModuBOXES/Regular/2H_39mm/ModuBOX_2H39_2x2.STL',
  half:      '01_Boxes and grids/ModuBOXES/HalfGrid/HalfGrid_2H_39mm/ModuBOX_HalfGrid_2H39_1x1.5.STL',
  stack:     '01_Boxes and grids/ModuBOXES/Stackable/Stack_2H39mm/ModuBOX_Stack_2H39_2x2.STL',
  stackhalf: '01_Boxes and grids/ModuBOXES/Stackable_Halfgrid/Stack_HalfGrid_2H_39mm/ModuBOX_Stack_HalfGrid_2H39_1x1.5.STL',
  split:     '01_Boxes and grids/ModuBOXES/Split/Split_4H_75mm/ModuBOX_Split_4H75_2x2.STL',
  blank:     'Blanks/2H Blanks/ModuBOX_Blank_HalfGrid_2H39_1x1.STL',
  fbowl:     'organizers/Filler Bowls/Bowl_1x1 2H_39mm.STL',
  fblank:    'organizers/Filler blanks/Blank_1x1 2H_39mm.STL',
  grid:      '01_Boxes and grids/Base grids/BaseGrid_2x2.STL',
  edge:      '01_Boxes and grids/Edgegrids/Edgegrid_3 Grid + 20mm.STL',
};

function readStl(file) {
  const b = fs.readFileSync(file);
  const ascii = b.subarray(0, 5).toString() === 'solid' && b.subarray(0, 400).toString().includes('facet');
  const tris = [];
  if (ascii) {
    const v = [...b.toString().matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)].map(m => [+m[1], +m[2], +m[3]]);
    for (let i = 0; i < v.length; i += 3) tris.push([v[i], v[i + 1], v[i + 2]]);
  } else {
    const n = b.readUInt32LE(80);
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12, t = [];
      for (let k = 0; k < 3; k++) t.push([b.readFloatLE(o + k * 12), b.readFloatLE(o + k * 12 + 4), b.readFloatLE(o + k * 12 + 8)]);
      tris.push(t);
    }
  }
  return tris;
}

// Clip triangles to the half-space y <= cut (cut-away view showing the wall profile).
function clipY(tris, cut) {
  const out = [];
  for (const t of tris) {
    const poly = [];
    for (let i = 0; i < 3; i++) {
      const a = t[i], b = t[(i + 1) % 3], ia = a[1] <= cut, ib = b[1] <= cut;
      if (ia) poly.push(a);
      if (ia !== ib) { const k = (cut - a[1]) / (b[1] - a[1]); poly.push([a[0] + k * (b[0] - a[0]), cut, a[2] + k * (b[2] - a[2])]); }
    }
    for (let i = 1; i + 1 < poly.length; i++) out.push([poly[0], poly[i], poly[i + 1]]);
  }
  return out;
}

function render(tris, { under = false, section = false, W = 480, H = 360, SS = 2 } = {}) {
  if (section) { let a = 1e9, b = -1e9; for (const t of tris) for (const p of t) { a = Math.min(a, p[1]); b = Math.max(b, p[1]); } tris = clipY(tris, (a + b) / 2); }
  const w = W * SS, h = H * SS;
  // centre the model, Z up
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const t of tris) for (const p of t) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p[i]); mx[i] = Math.max(mx[i], p[i]); }
  const c = mn.map((v, i) => (v + mx[i]) / 2);
  // view: rotate around Z by yaw, then tilt by pitch
  const yaw = section ? -0.35 : -0.75, pitch = under ? -0.62 : section ? 0.25 : 0.62;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const view = p => {
    const x = p[0] - c[0], y = p[1] - c[1], z = p[2] - c[2];
    const x1 = x * cy - y * sy, y1 = x * sy + y * cy;      // yaw
    return [x1, z * cp - y1 * sp, z * sp + y1 * cp];       // screen x, screen y (up), depth (towards viewer)
  };
  const vt = tris.map(t => t.map(view));
  let sx0 = 1e9, sx1 = -1e9, sy0 = 1e9, sy1 = -1e9;
  for (const t of vt) for (const p of t) { sx0 = Math.min(sx0, p[0]); sx1 = Math.max(sx1, p[0]); sy0 = Math.min(sy0, p[1]); sy1 = Math.max(sy1, p[1]); }
  const scale = Math.min((w * 0.86) / (sx1 - sx0), (h * 0.86) / (sy1 - sy0));
  const ox = w / 2 - ((sx0 + sx1) / 2) * scale, oy = h / 2 + ((sy0 + sy1) / 2) * scale;
  const zb = new Float32Array(w * h).fill(-1e9);
  const col = new Uint8ClampedArray(w * h * 4);
  const L = (() => { const v = [-0.4, 0.75, 0.55]; const n = Math.hypot(...v); return v.map(x => x / n); })();
  const base = [245, 158, 11]; // amber-500
  for (const t of vt) {
    const [a, b, d] = t;
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const nl = Math.hypot(...n) || 1; n = n.map(x => x / nl);
    if (n[2] < 0) n = n.map(x => -x);                       // two-sided
    const lam = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
    const sh = 0.38 + 0.62 * lam;
    const rgb = base.map(ch => Math.min(255, ch * sh + 18 * lam));
    const P = t.map(p => [p[0] * scale + ox, -p[1] * scale + oy, p[2]]);
    const minx = Math.max(0, Math.floor(Math.min(P[0][0], P[1][0], P[2][0]))), maxx = Math.min(w - 1, Math.ceil(Math.max(P[0][0], P[1][0], P[2][0])));
    const miny = Math.max(0, Math.floor(Math.min(P[0][1], P[1][1], P[2][1]))), maxy = Math.min(h - 1, Math.ceil(Math.max(P[0][1], P[1][1], P[2][1])));
    const area = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1]);
    if (Math.abs(area) < 1e-9) continue;
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((P[1][0] - px) * (P[2][1] - py) - (P[2][0] - px) * (P[1][1] - py)) / area;
      const w1 = ((P[2][0] - px) * (P[0][1] - py) - (P[0][0] - px) * (P[2][1] - py)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * P[0][2] + w1 * P[1][2] + w2 * P[2][2];
      const i = y * w + x;
      if (z <= zb[i]) continue;
      zb[i] = z; col[i * 4] = rgb[0]; col[i * 4 + 1] = rgb[1]; col[i * 4 + 2] = rgb[2]; col[i * 4 + 3] = 255;
    }
  }
  // downsample (box filter) for anti-aliasing
  const out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, bl = 0, al = 0;
    for (let j = 0; j < SS; j++) for (let k = 0; k < SS; k++) {
      const i = ((y * SS + j) * w + x * SS + k) * 4, A = col[i + 3];
      r += col[i] * A; g += col[i + 1] * A; bl += col[i + 2] * A; al += A;
    }
    const o = (y * W + x) * 4;
    if (al) { out[o] = r / al; out[o + 1] = g / al; out[o + 2] = bl / al; out[o + 3] = al / (SS * SS); }
  }
  return png(W, H, out);
}

function png(W, H, rgba) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = buf => { let c = 0xffffffff; for (const x of buf) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, cr]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; Buffer.from(rgba.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[4]?.split(',');
for (const [id, rel] of Object.entries(PICKS)) {
  if (only && !only.includes(id)) continue;
  const f = path.join(SRC, rel);
  if (!fs.existsSync(f)) { console.warn('missing', rel); continue; }
  const tris = readStl(f);
  fs.writeFileSync(path.join(OUT, id + '.png'), render(tris));
  fs.writeFileSync(path.join(OUT, id + '-under.png'), render(tris, { under: true }));
  fs.writeFileSync(path.join(OUT, id + '-section.png'), render(tris, { section: true }));
  console.log(id, tris.length, 'triangles');
}
