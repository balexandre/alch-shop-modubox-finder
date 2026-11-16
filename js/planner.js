// Drawer planner: pure functions, no DOM. Used by index.html and tested in Node.
// Facts measured from the Master set STLs (2026-05-26):
//  - grid pitch 55 mm; BaseGrid_AxB is A*55-0.1 mm, 3.85 mm thick, files exist only for A <= B <= 10
//  - Edgegrid_N Grid + Gmm is exactly N*55 mm long and G mm wide (N 1-10, G 1-54), 4 mm thick
//  - box height nH = 21 + 18*(n-1) mm
const PLAN = { GRID: 55, MAX_CELLS: 10, BASE_T: 3.85, MAX_GAP: 54 };

// Bed sizes are the printable X x Y area in mm. Check your slicer if unsure.
const PRINTERS = [
  { group: 'Bambu Lab', name: 'A1 mini', x: 180, y: 180, bambu: 'Mini' },
  { group: 'Bambu Lab', name: 'A1', x: 256, y: 256, bambu: 'A1' },
  { group: 'Bambu Lab', name: 'P1P', x: 256, y: 256, bambu: 'P1P' },
  { group: 'Bambu Lab', name: 'P1S', x: 256, y: 256, bambu: 'P1S' },
  { group: 'Bambu Lab', name: 'X1 Carbon / X1E', x: 256, y: 256, bambu: 'X1C' },
  // H2D: 325 x 320 with one nozzle, 300 x 320 with both. The 350 mm "total" can't be used by a single nozzle.
  { group: 'Bambu Lab', name: 'H2D, single nozzle (one colour)', x: 325, y: 320, bambu: 'H2D' },
  { group: 'Bambu Lab', name: 'H2D, both nozzles (multi-colour)', x: 300, y: 320, bambu: 'H2D' },
  { group: 'Bambu Lab', name: 'H2S', x: 340, y: 320, bambu: 'H2S' },
  { group: 'Prusa', name: 'MINI+', x: 180, y: 180 },
  { group: 'Prusa', name: 'MK4 / MK4S', x: 250, y: 210 },
  { group: 'Prusa', name: 'CORE One', x: 250, y: 220 },
  { group: 'Prusa', name: 'XL', x: 360, y: 360 },
  { group: 'Creality', name: 'Ender-3 V3', x: 220, y: 220 },
  { group: 'Creality', name: 'K1', x: 220, y: 220 },
  { group: 'Creality', name: 'K1 Max', x: 300, y: 300 },
  { group: 'Voron', name: '2.4 (350)', x: 350, y: 350 },
];

const boxHeight = n => 21 + 18 * (n - 1);

// Split n cells into the fewest near-equal parts of at most L cells each.
function splitCells(n, L) {
  if (n <= 0) return [];
  const k = Math.ceil(n / L), base = Math.floor(n / k), rem = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < rem ? 1 : 0));
}

const baseFile = (a, b) => `01_Boxes and grids/Base grids/BaseGrid_${Math.min(a, b)}x${Math.max(a, b)}.STL`;
const edgeFile = (n, g) => `01_Boxes and grids/Edgegrids/Edgegrid_${n} Grid + ${g}mm.STL`;

function sideGaps(total, mode) {           // mode: 'start' | 'end' | 'split'
  const t = Math.floor(total + 1e-6);
  let a = mode === 'end' ? 0 : mode === 'start' ? t : Math.floor(t / 2);
  let b = t - a;
  return [a >= 1 ? a : 0, b >= 1 ? b : 0];
}

function planDrawer({ W, D, H = 0, clear = 1, topClear = 2, bedX, bedY, edgeX = 'split', edgeY = 'split', fillCorners = true }) {
  const G = PLAN.GRID;
  W = +W; D = +D; H = +H || 0; clear = +clear || 0; topClear = +topClear || 0; bedX = +bedX; bedY = +bedY;
  if (!(W > 0 && D > 0)) return { error: 'Enter the inside width and depth of your drawer.' };
  if (!(bedX > 0 && bedY > 0)) return { error: 'Pick a printer or enter a bed size.' };
  const nx = Math.floor((W - clear + 0.1) / G), ny = Math.floor((D - clear + 0.1) / G);
  if (nx < 1 || ny < 1) return { error: `The drawer must be at least ${G + clear} mm in both directions to fit one grid cell.` };
  const Lbig = Math.min(PLAN.MAX_CELLS, Math.floor((Math.max(bedX, bedY) + 0.1) / G));
  const Lsmall = Math.min(PLAN.MAX_CELLS, Math.floor((Math.min(bedX, bedY) + 0.1) / G));
  if (Lsmall < 1) return { error: `The print bed must be at least ${G} mm in both directions.` };

  // Base tiles: try the long bed axis along the drawer width, then along the depth. Keep the fewer tiles.
  const optA = [splitCells(nx, Lbig), splitCells(ny, Lsmall)], optB = [splitCells(nx, Lsmall), splitCells(ny, Lbig)];
  const [px, py] = optA[0].length * optA[1].length <= optB[0].length * optB[1].length ? optA : optB;

  const [left, right] = sideGaps(W - clear - nx * G, edgeX === 'left' ? 'start' : edgeX === 'right' ? 'end' : 'split');
  const [back, front] = sideGaps(D - clear - ny * G, edgeY === 'back' ? 'start' : edgeY === 'front' ? 'end' : 'split');
  const x0 = left, y0 = back;                                     // y grows from the back (top of the drawing) to the front

  const tiles = [];
  let yy = y0;
  for (const b of py) {
    let xx = x0;
    for (const a of px) { tiles.push({ x: xx, y: yy, w: a * G, d: b * G, a, b, path: baseFile(a, b) }); xx += a * G; }
    yy += b * G;
  }

  const edges = [], Le = Lbig;
  const strip = (side, cells, gap, horizontal, fixed, start) => {
    if (!gap) return;
    let pos = start;
    for (const n of splitCells(cells, Le)) {
      edges.push(horizontal ? { side, x: pos, y: fixed, w: n * G, d: gap, n, gap, path: edgeFile(n, gap) }
                            : { side, x: fixed, y: pos, w: gap, d: n * G, n, gap, path: edgeFile(n, gap) });
      pos += n * G;
    }
  };
  strip('left', ny, left, false, 0, y0);
  strip('right', ny, right, false, x0 + nx * G, y0);
  strip('back', nx, back, true, 0, x0);
  strip('front', nx, front, true, y0 + ny * G, x0);
  // Corners where a side strip meets a back/front strip. No file is that small, so we cut them from
  // Edgegrid_1 Grid + <side gap>mm (55 mm long): one piece can give both corners on a side if they fit.
  const corners = [], fillers = [], KERF = 1;
  for (const [side, cx, cw] of [['left', 0, left], ['right', x0 + nx * G, right]]) {
    const mine = [];
    for (const [cy, cd] of [[0, back], [y0 + ny * G, front]]) if (cw && cd) { const c = { side, x: cx, y: cy, w: cw, d: cd, filled: !!fillCorners }; corners.push(c); mine.push(c); }
    if (!fillCorners || !mine.length) continue;
    const pieces = [];                                 // first-fit packing of corner lengths into 55 mm pieces
    for (const c of mine) { const pc = pieces.find(p => p.used + KERF + c.d <= G); if (pc) { pc.cuts.push(c.d); pc.used += KERF + c.d; } else pieces.push({ cuts: [c.d], used: c.d }); }
    for (const pc of pieces) fillers.push({ side, gap: cw, cuts: pc.cuts, path: edgeFile(1, cw) });
  }

  // Heights: conservative, it assumes boxes don't nest into the grid or into each other.
  let heights = null;
  if (H > 0) {
    const avail = H - topClear - PLAN.BASE_T;
    heights = { avail: Math.round(avail * 10) / 10, rows: [1, 2, 3, 4, 5, 6].map(n => ({ n, h: boxHeight(n), stack: Math.max(0, Math.floor(avail / boxHeight(n))) })) };
    heights.tallest = heights.rows.filter(r => r.stack >= 1).map(r => r.n).pop() || 0;
  }

  const count = {};
  for (const p of [...tiles, ...edges]) count[p.path] = (count[p.path] || 0) + 1;
  const list = Object.entries(count).map(([path, qty]) => ({ path, qty, note: '' })).sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
  const fcount = {};
  for (const f of fillers) { const note = `corner filler: cut into ${f.cuts.map(c => c + ' mm').join(' + ')} long pieces`; const k = f.path + '|' + note; (fcount[k] ??= { path: f.path, qty: 0, note }).qty++; }
  list.push(...Object.values(fcount));

  return { W, D, nx, ny, gridW: nx * G, gridD: ny * G, gaps: { left, right, back, front }, slackX: +(W - clear - nx * G - left - right).toFixed(1),
    slackY: +(D - clear - ny * G - back - front).toFixed(1), tiles, edges, corners, fillers, heights, list, cellsPerTile: [Lbig, Lsmall] };
}

if (typeof module !== 'undefined') module.exports = { planDrawer, splitCells, PRINTERS, PLAN };
