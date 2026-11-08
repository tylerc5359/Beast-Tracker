// Custom tile shapes: a tile can cover any connected group of grid squares, not just a rectangle.
// A shaped size is saved as "<columns>x<rows>:<mask>", the mask listing each square of the bounding box
// row by row as 1 (part of the tile) or 0 (free), e.g. "2x2:1011" is an L.

const k = (x, y) => `${x},${y}`;

// cells: array of [x, y] (any offset). Returns the size key, cropped to the shape's bounding box,
// and how far the crop moved it ([dx, dy]). A shape that fills its box is a plain "WxH".
export function shapeKey(cells) {
  const xs = cells.map((p) => p[0]);
  const ys = cells.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const w = Math.max(...xs) - x0 + 1;
  const h = Math.max(...ys) - y0 + 1;
  const on = new Set(cells.map(([x, y]) => k(x - x0, y - y0)));
  let mask = '';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask += on.has(k(x, y)) ? '1' : '0';
  return { key: mask.includes('0') ? `${w}x${h}:${mask}` : `${w}x${h}`, shift: [x0, y0] };
}

// Why a group of squares can't be a tile ('' if it can): it must be one piece with no holes.
export function shapeProblem(cells) {
  if (!cells.length) return 'Pick at least one square.';
  const on = new Set(cells.map(([x, y]) => k(x, y)));
  const step = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // One piece: every square reachable from the first through edge neighbours
  const seen = new Set([k(...cells[0])]);
  const q = [cells[0]];
  while (q.length) {
    const [x, y] = q.pop();
    step.forEach(([dx, dy]) => {
      const n = k(x + dx, y + dy);
      if (on.has(n) && !seen.has(n)) {
        seen.add(n);
        q.push([x + dx, y + dy]);
      }
    });
  }
  if (seen.size !== on.size) return 'The squares need to touch side by side.';

  // No holes: every free square inside the box can reach the outside
  const xs = cells.map((p) => p[0]);
  const ys = cells.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs) - 1, Math.max(...xs) + 1, Math.min(...ys) - 1, Math.max(...ys) + 1];
  const out = new Set([k(x0, y0)]);
  const f = [[x0, y0]];
  while (f.length) {
    const [x, y] = f.pop();
    step.forEach(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      const n = k(nx, ny);
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1 || on.has(n) || out.has(n)) return;
      out.add(n);
      f.push([nx, ny]);
    });
  }
  if (out.size + on.size !== (x1 - x0 + 1) * (y1 - y0 + 1)) return "The shape can't have holes in it.";
  return '';
}

// The shape's outline corners, walked clockwise on screen: [X, Y, inDir, outDir] on the square grid,
// directions being R(ight), D(own), L(eft), U(p).
function corners(cells) {
  const on = new Set(cells.map(([x, y]) => k(x, y)));
  const has = (x, y) => on.has(k(x, y));

  // Outline edges keyed by start point
  const next = new Map();
  cells.forEach(([x, y]) => {
    if (!has(x, y - 1)) next.set(k(x, y), [x + 1, y, 'R']);
    if (!has(x + 1, y)) next.set(k(x + 1, y), [x + 1, y + 1, 'D']);
    if (!has(x, y + 1)) next.set(k(x + 1, y + 1), [x, y + 1, 'L']);
    if (!has(x - 1, y)) next.set(k(x, y + 1), [x, y, 'U']);
  });

  const start = [...next.keys()].sort()[0].split(',').map(Number);
  const pts = [];
  let [x, y] = start;
  let dir = '';
  do {
    const [nx, ny, d] = next.get(k(x, y));
    pts.push([x, y, dir, d]);
    dir = d;
    [x, y] = [nx, ny];
  } while (x !== start[0] || y !== start[1]);
  pts[0][2] = dir;
  return pts.filter(([, , a, b]) => a !== b);
}

// Which side of the gap a corner sits on: a downward edge is a square's right side (the gap is past it),
// a leftward edge a square's bottom side
const side = ([, , a, b]) => [[a, b].includes('D'), [a, b].includes('L')];

// CSS clip-path that cuts a w x h tile down to its squares, with sharp corners. Works at any size
// (percentages), so it is used until the tile is measured. gap: the CSS length of the grid's gap.
export function clipFor(cells, w, h, gap = 'var(--gap)') {
  const px = (X, down) => `calc((100% + ${gap}) * ${X} / ${w}${down ? ` - ${gap}` : ''})`;
  const py = (Y, left) => `calc((100% + ${gap}) * ${Y} / ${h}${left ? ` - ${gap}` : ''})`;
  return `polygon(${corners(cells)
    .map((c) => {
      const [down, left] = side(c);
      return `${px(c[0], down)} ${py(c[1], left)}`;
    })
    .join(', ')})`;
}

// The same cut for a tile measured at W x H px, with every corner rounded by radius px: outer corners
// like a normal tile's, inner (notch) corners curving the other way.
export function roundClipFor(cells, w, h, W, H, gapX, gapY, radius) {
  const pts = corners(cells).map((c) => {
    const [down, left] = side(c);
    return [((W + gapX) * c[0]) / w - (down ? gapX : 0), ((H + gapY) * c[1]) / h - (left ? gapY : 0), c[2], c[3]];
  });
  const dirs = { R: [1, 0], D: [0, 1], L: [-1, 0], U: [0, -1] };
  const n = pts.length;
  const f = (v) => +v.toFixed(2);
  let d = '';
  pts.forEach(([x, y, a, b], i) => {
    const [px0, py0] = pts[(i - 1 + n) % n];
    const [nx, ny] = pts[(i + 1) % n];
    // No more than half of either edge, so neighbouring curves never overlap
    const r = Math.min(radius, Math.hypot(x - px0, y - py0) / 2, Math.hypot(nx - x, ny - y) / 2);
    const [ax, ay] = dirs[a];
    const [bx, by] = dirs[b];
    const convex = ax * by - ay * bx > 0; // a right turn while going clockwise
    d += `${i ? 'L' : 'M'} ${f(x - ax * r)} ${f(y - ay * r)} A ${f(r)} ${f(r)} 0 0 ${convex ? 1 : 0} ${f(x + bx * r)} ${f(y + by * r)} `;
  });
  return `path('${d}Z')`;
}

// Left and right insets (CSS) of the widest run of squares in a row, so text sits on the tile.
export function rowSpan(cells, w, row, gap = 'var(--gap)') {
  const xs = cells.filter((p) => p[1] === row).map((p) => p[0]).sort((a, b) => a - b);
  let best = [xs[0], xs[0]];
  let run = [xs[0], xs[0]];
  for (let i = 1; i < xs.length; i++) {
    run = xs[i] === run[1] + 1 ? [run[0], xs[i]] : [xs[i], xs[i]];
    if (run[1] - run[0] > best[1] - best[0]) best = run;
  }
  return {
    left: `calc((100% + ${gap}) * ${best[0]} / ${w})`,
    right: `calc(100% - (100% + ${gap}) * ${best[1] + 1} / ${w} + ${gap})`
  };
}
