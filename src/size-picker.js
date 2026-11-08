// The square-grid tile size picker: rectangles or custom shapes.
import { MAX_COLS, MAX_ROWS } from './config.js';
import { inView, sizeOf } from './helpers.js';
import { $ } from './dom.js';
import { paintCover } from './cover-editor.js';
import { computeLayout, fp, unmark } from './layout.js';
import { shapeKey, shapeProblem } from './shape.js';
import { state } from './state.js';

// Two ways to pick: Rectangle (hover to preview, click the bottom-right square) or Custom shape
// (click or drag over squares to add or remove them). onPick(key, shift) gets the size key and, for shapes,
// how far the shape's box sits from the picker's top-left square ([columns, rows]).
export function buildSizePicker(host, onPick, start = '1x1') {
  host.textContent = '';
  let current = start;
  let mode = 'rect';
  let mask = new Set(); // custom shape squares, "c,r" (1-based like the picker)
  let free = null; // free(c, r) -> may this square be used? (null = all)

  const modes = document.createElement('div');
  modes.className = 'sizemodes';
  const mk = (m, label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sizemode';
    b.textContent = label;
    b.onclick = () => setMode(m);
    modes.append(b);
    return b;
  };
  const rectBtn = mk('rect', 'Rectangle');
  const shapeBtn = mk('shape', 'Custom shape');

  const grid = document.createElement('div');
  grid.className = 'sizegrid';
  grid.style.gridTemplateColumns = `repeat(${MAX_COLS}, 1fr)`;

  const hint = document.createElement('div');
  hint.className = 'sizehint';

  const cells = [];
  const at = (el) => [+el.dataset.c, +el.dataset.r];

  // How many columns/rows a size covers inside the picker (adaptive sizes fill it)
  const dims = (key) => {
    if (!key) return { c: 0, r: 0 };
    const z = sizeOf(key);
    return {
      c: z.c === 'all' ? MAX_COLS : Math.min(z.c, MAX_COLS),
      r: z.r === 'page' ? MAX_ROWS : Math.min(z.r, MAX_ROWS)
    };
  };

  // The squares a key covers, as "c,r" (1-based)
  const keyCells = (key) => {
    const out = new Set();
    if (!key) return out;
    const z = sizeOf(key);
    if (z.cells) {
      z.cells.forEach(([x, y]) => out.add(`${x + 1},${y + 1}`));
    } else {
      const d = dims(key);
      for (let r = 1; r <= d.r; r++) for (let c = 1; c <= d.c; c++) out.add(`${c},${r}`);
    }
    return out;
  };

  // A rectangle up to c, r fits when every square in it is free
  const rectFits = (c, r) => {
    if (!free) return true;
    for (let y = 1; y <= r; y++) for (let x = 1; x <= c; x++) if (!free(x, y)) return false;
    return true;
  };

  const paintLocks = () => {
    cells.forEach((el) => {
      const [c, r] = at(el);
      const locked = mode === 'rect' ? !rectFits(c, r) : !!free && !free(c, r) && !mask.has(`${c},${r}`);
      el.classList.toggle('locked', locked);
      el.setAttribute('aria-disabled', locked);
      el.tabIndex = locked ? -1 : 0;
      el.title = locked ? "Doesn't fit here" : '';
    });
  };

  // Chosen size: solid squares
  const paintChosen = () => {
    const on = mode === 'shape' ? mask : keyCells(current);
    cells.forEach((el) => {
      const [c, r] = at(el);
      el.classList.toggle('sel', on.has(`${c},${r}`));
      if (mode === 'shape') el.setAttribute('aria-pressed', on.has(`${c},${r}`));
      else el.removeAttribute('aria-pressed');
    });
    rectBtn.classList.toggle('on', mode === 'rect');
    shapeBtn.classList.toggle('on', mode === 'shape');
    rectBtn.setAttribute('aria-pressed', mode === 'rect');
    shapeBtn.setAttribute('aria-pressed', mode === 'shape');
    grid.classList.toggle('shape', mode === 'shape');
  };

  // Hover preview: rectangle from the top-left square to the pointer, or just that square in shape mode
  const paintPreview = (c, r) => {
    cells.forEach((el) => {
      const [x, y] = at(el);
      el.classList.toggle('on', c > 0 && (mode === 'shape' ? x === c && y === r : x <= c && y <= r));
    });
  };

  const pulse = (els) => {
    els.forEach((el) => el.classList.add('pop'));
    setTimeout(() => els.forEach((el) => el.classList.remove('pop')), 300);
  };

  const pick = (key) => {
    current = key;
    paintChosen();
    paintPreview(0, 0);
    pulse(cells.filter((el) => el.classList.contains('sel'))); // so the click is visible
    onPick(key, [0, 0]);
  };

  // Shape mode: use the squares if they make a valid tile, otherwise say why
  const commitShape = () => {
    const list = [...mask].map((id) => id.split(',').map((n) => +n - 1));
    const problem = shapeProblem(list);
    hint.textContent = problem || 'Click or drag over squares to add or remove them.';
    hint.classList.toggle('bad', !!problem);
    if (problem) return;
    const { key, shift } = shapeKey(list);
    current = key;
    onPick(key, shift);
  };

  function setMode(m) {
    if (m === mode) return;
    mode = m;
    hint.classList.remove('bad');
    if (m === 'shape') {
      mask = keyCells(current);
      hint.textContent = 'Click or drag over squares to add or remove them.';
      paintLocks();
      paintChosen();
      return;
    }
    // Back to a rectangle: the shape's whole box if it fits, otherwise 1x1
    hint.textContent = '';
    paintLocks();
    const d = dims(current);
    if (current && sizeOf(current).cells) pick(rectFits(d.c, d.r) ? `${d.c}x${d.r}` : '1x1');
    else paintChosen();
  }

  // Dragging across squares in shape mode turns them all on (or all off, if the first one was on)
  let painting = null;
  const paintCell = (el) => {
    if (el.classList.contains('locked')) return;
    const [c, r] = at(el);
    if (painting === 'add') mask.add(`${c},${r}`);
    else mask.delete(`${c},${r}`);
    paintChosen();
    pulse([el]);
  };
  const endPaint = () => {
    if (!painting) return;
    painting = null;
    commitShape();
    paintLocks();
  };
  document.addEventListener('pointerup', endPaint);
  document.addEventListener('pointercancel', endPaint);

  for (let r = 1; r <= MAX_ROWS; r++) {
    for (let c = 1; c <= MAX_COLS; c++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sizecell';
      b.dataset.c = c;
      b.dataset.r = r;
      b.setAttribute('aria-label', `Column ${c}, row ${r}`);
      const open = () => !b.classList.contains('locked'); // locked = would not fit
      b.onmouseenter = () => (open() ? paintPreview(c, r) : paintPreview(0, 0));
      b.onfocus = () => (open() ? paintPreview(c, r) : paintPreview(0, 0));
      b.onpointerdown = (e) => {
        if (mode !== 'shape' || e.button !== 0 || !open()) return;
        e.preventDefault();
        b.releasePointerCapture?.(e.pointerId); // so pointerenter fires on the other squares
        painting = mask.has(`${c},${r}`) ? 'remove' : 'add';
        paintCell(b);
      };
      b.onpointerenter = () => painting && paintCell(b);
      b.onclick = (e) => {
        if (mode === 'rect') {
          if (open()) pick(`${c}x${r}`);
          return;
        }
        if (e.detail === 0 && open()) {
          // keyboard: Enter / Space toggles the square
          painting = mask.has(`${c},${r}`) ? 'remove' : 'add';
          paintCell(b);
          endPaint();
        }
      };
      cells.push(b);
      grid.append(b);
    }
  }
  grid.onmouseleave = () => paintPreview(0, 0);
  grid.addEventListener('focusout', () => paintPreview(0, 0));

  host.append(modes, grid, hint);
  paintChosen();

  return {
    set(key) {
      current = key || '';
      mode = current && sizeOf(current).cells ? 'shape' : 'rect';
      mask = mode === 'shape' ? keyCells(current) : new Set();
      hint.textContent = '';
      hint.classList.remove('bad');
      paintLocks();
      paintChosen();
      paintPreview(0, 0);
    },
    // free(column, row) -> boolean, for the picker's 1-based squares. Squares that aren't free are greyed
    // out: no rectangle can cover them and no shape can use them.
    lock(fn) {
      free = fn || null;
      paintLocks();
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
    unmark(occ, at[0], at[1], fp(tile)); // the tile's own cells don't count
  }
  tilePicker.lock((c, r) => at[0] + c <= state.gridCols && !occ.has(`${at[0] + c - 1},${at[1] + r - 1}`));
}

// How far the picked shape's box sits from where the tile's box was ([columns, rows]), applied on save
let tileShift = [0, 0];
export const sizeShift = () => tileShift;

export function setTileSize(key) {
  $('tsize').value = key;
  tileShift = [0, 0];
  tilePicker.set(key);
}

// Connects this module's buttons and events to the page (called once at start-up)
export function initSizePicker() {
  tilePicker = buildSizePicker($('tsizepick'), (key, shift) => {
    $('tsize').value = key;
    tileShift = shift;
    paintCover(); // the cover preview follows the tile's shape
  });
}
