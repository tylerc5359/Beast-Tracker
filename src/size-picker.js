// The square-grid tile size picker.
import { MAX_COLS, MAX_ROWS } from './config.js';
import { inView, sizeOf } from './helpers.js';
import { $ } from './dom.js';
import { paintCover } from './cover-editor.js';
import { computeLayout, fp, freeAt, unmark } from './layout.js';
import { state } from './state.js';

export function buildSizePicker(host, onPick, start = '1x1') {
  host.textContent = '';
  let current = start;

  const grid = document.createElement('div');
  grid.className = 'sizegrid';
  grid.style.gridTemplateColumns = `repeat(${MAX_COLS}, 1fr)`;

  const cells = [];

  // How many columns/rows a size covers inside the picker (adaptive sizes fill it)
  const dims = (key) => {
    if (!key) return { c: 0, r: 0 };
    const z = sizeOf(key);
    return {
      c: z.c === 'all' ? MAX_COLS : Math.min(z.c, MAX_COLS),
      r: z.r === 'page' ? MAX_ROWS : Math.min(z.r, MAX_ROWS)
    };
  };

  // Chosen size: solid squares
  const paintChosen = () => {
    const d = dims(current);
    cells.forEach((el) => el.classList.toggle('sel', +el.dataset.c <= d.c && +el.dataset.r <= d.r));
  };

  // Hover preview: lighter squares from the top-left corner to the pointer
  const paintPreview = (c, r) => {
    cells.forEach((el) => el.classList.toggle('on', c > 0 && +el.dataset.c <= c && +el.dataset.r <= r));
  };

  const pick = (key) => {
    current = key;
    paintChosen();
    paintPreview(0, 0);
    // Quick pulse on the chosen squares so the click is visible
    const chosen = cells.filter((el) => el.classList.contains('sel'));
    chosen.forEach((el) => el.classList.add('pop'));
    setTimeout(() => chosen.forEach((el) => el.classList.remove('pop')), 300);
    onPick(key);
  };

  for (let r = 1; r <= MAX_ROWS; r++) {
    for (let c = 1; c <= MAX_COLS; c++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sizecell';
      b.dataset.c = c;
      b.dataset.r = r;
      b.setAttribute('aria-label', `${c} columns by ${r} rows`);
      const open = () => !b.classList.contains('locked'); // locked = would not fit
      b.onmouseenter = () => (open() ? paintPreview(c, r) : paintPreview(0, 0));
      b.onfocus = () => (open() ? paintPreview(c, r) : paintPreview(0, 0));
      b.onclick = () => open() && pick(`${c}x${r}`);
      cells.push(b);
      grid.append(b);
    }
  }
  grid.onmouseleave = () => paintPreview(0, 0);
  grid.addEventListener('focusout', () => paintPreview(0, 0));

  host.append(grid);
  paintChosen();

  return {
    set(key) {
      current = key || '';
      paintChosen();
      paintPreview(0, 0);
    },
    // fits(columns, rows) -> boolean. Sizes that don't fit are greyed out and can't be picked.
    lock(fits) {
      cells.forEach((el) => {
        const locked = !!fits && !fits(+el.dataset.c, +el.dataset.r);
        el.classList.toggle('locked', locked);
        el.setAttribute('aria-disabled', locked);
        el.tabIndex = locked ? -1 : 0;
        el.title = locked ? "Doesn't fit here" : '';
      });
    }
  };
}

let tilePicker;

// Lock every size that would run off the grid or overlap another tile when the tile's
// top-left corner stays where it is (new tile: the clicked "+" cell).
export function lockSizesForSpot(tile) {
  if ((!tile && !state.addAnchor) || $('sort').value !== 'custom') return tilePicker.lock(null);
  const { pos, occ } = computeLayout(state.items.filter(inView));
  let at = state.addAnchor;
  if (tile) {
    at = pos.get(tile.id);
    if (!at) return tilePicker.lock(null);
    const f = fp(tile);
    unmark(occ, at[0], at[1], f.w, f.h); // the tile's own cells don't count
  }
  tilePicker.lock((c, r) => freeAt(occ, at[0], at[1], c, r));
}

export function setTileSize(key) {
  $('tsize').value = key;
  tilePicker.set(key);
}

// Connects this module's buttons and events to the page (called once at start-up)
export function initSizePicker() {
  tilePicker = buildSizePicker($('tsizepick'), (key) => {
    $('tsize').value = key;
    paintCover(); // the cover preview follows the tile's shape
  });
}
