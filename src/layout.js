// Grid layout: which cells a tile occupies, where it fits, and where rows sit on the page.
import { customSorted, inView, sizeOf, viewKey } from './helpers.js';
import { $ } from './dom.js';
import { state } from './state.js';

export const fp = (i) => {
  const z = sizeOf(i.size);
  return {
    w: z.c === 'all' ? state.gridCols : Math.min(z.c, state.gridCols),
    h: z.r === 'page' ? state.pageRows : z.r
  };
};

export const freeAt = (occ, c, r, w, h) => {
  if (c < 0 || c + w > state.gridCols) return false;
  for (let y = r; y < r + h; y++) {
    for (let x = c; x < c + w; x++) {
      if (occ.has(`${x},${y}`)) return false;
    }
  }
  return true;
};

export const mark = (occ, c, r, w, h, id) => {
  for (let y = r; y < r + h; y++) {
    for (let x = c; x < c + w; x++) {
      occ.set(`${x},${y}`, id);
    }
  }
};

export const unmark = (occ, c, r, w, h) => {
  for (let y = r; y < r + h; y++) {
    for (let x = c; x < c + w; x++) {
      occ.delete(`${x},${y}`);
    }
  }
};

function firstFit(occ, w, h, r0) {
  for (let r = r0; ; r++) {
    for (let c = 0; c <= state.gridCols - w; c++) {
      if (freeAt(occ, c, r, w, h)) return [c, r];
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
      const { w, h } = fp(i);
      let c = Math.max(0, Math.min(L[i.id][0], state.gridCols - w));
      let r = L[i.id][1];
      if (!freeAt(occ, c, r, w, h)) [c, r] = firstFit(occ, w, h, r);
      mark(occ, c, r, w, h, i.id);
      pos.set(i.id, [c, r]);
    });

  let row = 0;
  pos.forEach((p) => {
    row = Math.max(row, p[1]);
  });

  customSorted(list.filter((i) => !L[i.id])).forEach((i) => {
    const { w, h } = fp(i);
    const [c, r] = firstFit(occ, w, h, row);
    mark(occ, c, r, w, h, i.id);
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
