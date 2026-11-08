// Lookups for the current view: category names, filters, custom sort, grid measuring.
import { SIZE_SPECIAL } from './config.js';
import { $ } from './dom.js';
import { state } from './state.js';

const catName = (id) => (state.cats.find((c) => c.id === id) || {}).name || '';

export const subName = (c, s) => {
  const parent = state.cats.find((x) => x.id === c);
  return ((parent && parent.subs.find((y) => y.id === s)) || {}).name || '';
};

// { c, r } columns and rows of the tile's box, plus cells ([x, y] squares) for a custom shape
export function sizeOf(key) {
  if (SIZE_SPECIAL[key]) return SIZE_SPECIAL[key];
  const m = /^(\d+)x(\d+)(?::([01]+))?$/.exec(key || '');
  if (!m) return { c: 1, r: 1 };
  const z = { c: Math.max(1, +m[1]), r: Math.max(1, +m[2]) };
  if (m[3] && m[3].length === z.c * z.r && m[3].includes('1')) {
    z.cells = [];
    [...m[3]].forEach((bit, n) => bit === '1' && z.cells.push([n % z.c, Math.floor(n / z.c)]));
  }
  return z;
}

export function viewKey() {
  return state.catFilter ? (state.typeFilter ? `${state.catFilter}|${state.typeFilter}` : state.catFilter) : 'all';
}

export function inView(i) {
  return (!state.catFilter || i.status === state.catFilter) && (!state.catFilter || !state.typeFilter || i.type === state.typeFilter);
}

export function customSorted(list) {
  const ord = state.customOrder[viewKey()] || [];
  const pos = (id) => {
    const k = ord.indexOf(id);
    return k < 0 ? 1e9 : k;
  };
  return list.slice().sort((a, b) => pos(a.id) - pos(b.id) || b.t - a.t);
}

export function measure() {
  const grid = $('grid');
  const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean);
  state.gridCols = cols.length || 1;
  const w = parseFloat(cols[0]) || 190; // current tile width in px (8 columns share the window)
  const rh = Math.round(w * 1.5); // tiles keep a 2:3 shape
  const gap = parseFloat(getComputedStyle(grid).rowGap) || 22;
  grid.style.setProperty('--rh', `${rh}px`);
  grid.style.setProperty('--ts', Math.max(0.65, Math.min(1.4, 0.4 + (0.6 * w) / 190)).toFixed(3)); // text scale (gentler than the tile)
  state.pageRows = Math.max(2, Math.round((innerHeight * 0.85) / (rh + gap)));
  // Row height and text scale update live; only a change in rows per screen needs a re-render
  return `${state.gridCols}|${state.pageRows}`;
}
