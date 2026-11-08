// Grid layout: which cells a tile occupies, where it fits, and where rows sit on the page.
import { customSorted, inView, sizeOf, viewKey } from './helpers.js';
import { $ } from './dom.js';
import { state } from './state.js';

// A tile's footprint: its box (w x h squares) and the squares it covers inside it ([x, y] each).
// shaped = a custom shape rather than the whole box.
export const fp = (i) => {
  const z = sizeOf(i.size);
  const w = z.c === 'all' ? state.gridCols : Math.min(z.c, state.gridCols);
  const h = z.r === 'page' ? state.pageRows : z.r;
  let cells = z.cells && z.cells.filter(([x]) => x < w); // a narrow window cuts off the right side
  const shaped = !!cells && cells.length > 0 && cells.length < w * h;
  if (!shaped) {
    cells = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push([x, y]);
  }
  return { w, h, cells, shaped };
};

// Can footprint f sit with its box's top-left square at column c, row r?
export const freeAt = (occ, c, r, f) =>
  c >= 0 && c + f.w <= state.gridCols && f.cells.every(([x, y]) => !occ.has(`${c + x},${r + y}`));

export const mark = (occ, c, r, f, id) => {
  f.cells.forEach(([x, y]) => occ.set(`${c + x},${r + y}`, id));
};

export const unmark = (occ, c, r, f) => {
  f.cells.forEach(([x, y]) => occ.delete(`${c + x},${r + y}`));
};

function firstFit(occ, f, r0) {
  for (let r = r0; ; r++) {
    for (let c = 0; c <= state.gridCols - f.w; c++) {
      if (freeAt(occ, c, r, f)) return [c, r];
    }
  }
}

export function computeLayout(list) {
  const L = state.layouts[viewKey()] || {};
  const occ = new Map();
  const pos = new Map();

  list
    .filter((i) => L[i.id])
    .sort((a, b) => L[a.id][1] - L[b.id][1] || L[a.id][0] - L[b.id][0])
    .forEach((i) => {
      const f = fp(i);
      let c = Math.max(0, Math.min(L[i.id][0], state.gridCols - f.w));
      let r = L[i.id][1];
      if (!freeAt(occ, c, r, f)) [c, r] = firstFit(occ, f, r);
      mark(occ, c, r, f, i.id);
      pos.set(i.id, [c, r]);
    });

  let row = 0;
  pos.forEach((p) => {
    row = Math.max(row, p[1]);
  });

  customSorted(list.filter((i) => !L[i.id])).forEach((i) => {
    const f = fp(i);
    const [c, r] = firstFit(occ, f, row);
    mark(occ, c, r, f, i.id);
    pos.set(i.id, [c, r]);
  });

  return { pos, occ };
}

// Saves every tile's current cell in this view's layout, so adding a tile can't shuffle the others.
// Returns the view's layout and the occupied cells.
export function pinCurrentLayout() {
  const key = viewKey();
  const L = state.layouts[key] || (state.layouts[key] = {});
  const { pos, occ } = computeLayout(state.items.filter(inView));
  pos.forEach((p, k) => {
    L[k] = p;
  });
  return { L, occ };
}

export function gridMetrics() {
  const g = $('grid');
  const cs = getComputedStyle(g);
  const rh = parseFloat(cs.gridAutoRows) || 300;
  const gap = parseFloat(cs.rowGap) || 22;
  const padT = parseFloat(cs.paddingTop) || 0;
  const padB = parseFloat(cs.paddingBottom) || 0;
  const top = g.getBoundingClientRect().top + scrollY + padT; // page position of row 1
  const rows = Math.max(1, Math.round((g.clientHeight - padT - padB + gap) / (rh + gap)));
  return { top, rh, pitch: rh + gap, rows };
}

export const rowTopY = (m, r) => m.top + (r - 1) * m.pitch;

export const rowBottomY = (m, r) => rowTopY(m, r) + m.rh;

// The row in the middle of the screen: the reference point for every transition
export function viewRow(m) {
  const y = scrollY + innerHeight / 2;
  return Math.min(m.rows, Math.max(1, Math.floor((y - m.top) / m.pitch) + 1));
}
