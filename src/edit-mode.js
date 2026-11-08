// Edit mode: the "+" slots, the Edit / Done switch, and bulk tile selection.
import { $, fill } from './dom.js';
import { computeLayout } from './layout.js';
import { inView } from './helpers.js';
import { openDlg } from './tile-editor.js';
import { wireImageDrop } from './image-drop.js';
import { buildSizePicker } from './size-picker.js';
import { saveSort } from './toolbar.js';
import { render } from './render.js';
import { save } from './storage.js';
import { sel, state } from './state.js';

let bulkPicker;

function selSub() {
  const k = state.cats.find((c) => c.id === $('selcat').value);
  fill($('selsub'), [['', 'No sub-category'], ...(k ? k.subs.map((s) => [s.id, s.name]) : [])]);
  $('selsub').hidden = !k;
}

export function selOpts() {
  fill($('selcat'), [['__', 'Move to…'], ['', 'No category'], ...state.cats.map((c) => [c.id, c.name])]);
  selSub();
  $('selmove').disabled = true;
}

function closeSizePop() {
  $('selsizepop').hidden = true;
  $('selsizebtn').setAttribute('aria-expanded', 'false');
}

export function updateBar() {
  $('selbar').hidden = !state.editMode;
  document.body.classList.toggle('selecting', state.editMode && state.selMode);
  $('selcount').textContent = `${sel.size} selected`;
  $('selbtn').textContent = state.selMode ? 'Selecting' : 'Select';
  $('selbtn').setAttribute('aria-pressed', state.selMode);
  $('selbtn').classList.toggle('primary', state.selMode);
  $('selmove').disabled = !sel.size || $('selcat').value === '__';
  $('selsizebtn').disabled = !sel.size;
  $('seldel').disabled = !sel.size;
  if (!sel.size) {
    $('seldel').dataset.armed = '';
    $('seldel').textContent = 'Delete';
  }
  if (!state.editMode || !state.selMode || !sel.size) closeSizePop();
}

export function setMode(on) {
  if (on && !state.editMode) setEdit(true);
  state.selMode = on;
  sel.clear();
  updateBar();
  render();
}

export function toggle(id) {
  sel.has(id) ? sel.delete(id) : sel.add(id);
  updateBar();
  render();
}

// Draws a dashed "+" button over every empty cell (plus two spare rows) while editing.
// Clicking one opens the add dialog for a tile whose top-left corner is that cell.
export function renderAddCells() {
  const g = $('grid');
  g.querySelectorAll('.addcell').forEach((el) => el.remove());
  if (!state.editMode || state.selMode || $('sort').value !== 'custom') return;

  const { occ } = computeLayout(state.items.filter(inView));
  let rows = 0;
  occ.forEach((_, key) => {
    rows = Math.max(rows, +key.split(',')[1] + 1);
  });
  rows = Math.max(rows + 2, 3);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < state.gridCols; c++) {
      if (occ.has(`${c},${r}`)) continue;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'addcell';
      cell.textContent = '+';
      cell.setAttribute('aria-label', `Add media at column ${c + 1}, row ${r + 1}`);
      cell.style.gridColumn = `${c + 1} / span 1`;
      cell.style.gridRow = `${r + 1} / span 1`;
      cell.onclick = () => openDlg(null, [c, r]);
      wireImageDrop(cell, c, r);
      g.append(cell);
    }
  }
}

// Edit mode on/off. Turning it on switches to Custom sort (the only sort with fixed cells).
export function setEdit(on) {
  state.editMode = on;
  state.selMode = false;
  sel.clear();
  if (on) {
    $('sort').value = 'custom';
    saveSort();
    selOpts();
  }
  $('sort').disabled = on;
  $('bgedit').hidden = !on;
  if (!on && $('bgdlg').open) $('bgdlg').close(); // backgrounds are only edited in Edit mode
  $('editbtn').textContent = on ? 'Done' : 'Edit';
  $('editbtn').setAttribute('aria-pressed', on);
  updateBar();
  render();
}

// Connects this module's buttons and events to the page (called once at start-up)
export function initEditMode() {
  $('editbtn').onclick = () => setEdit(!state.editMode);

  $('selbtn').onclick = () => setMode(!state.selMode);

  $('selall').onclick = () => {
    if (!state.selMode) state.selMode = true;
    const all = state.visibleIds.length > 0 && state.visibleIds.every((id) => sel.has(id));
    state.visibleIds.forEach((id) => (all ? sel.delete(id) : sel.add(id)));
    updateBar();
    render();
  };

  $('selcat').onchange = () => {
    selSub();
    $('selmove').disabled = !sel.size || $('selcat').value === '__';
  };

  $('selmove').onclick = () => {
    if (!sel.size || $('selcat').value === '__') return;
    state.items.forEach((i) => {
      if (sel.has(i.id)) {
        i.status = $('selcat').value;
        i.type = $('selsub').value;
      }
    });
    sel.clear();
    save();
    updateBar();
    render();
  };

  bulkPicker = buildSizePicker(
    $('selsizepick'),
    (key) => {
      if (!sel.size) return;
      state.items.forEach((i) => {
        if (sel.has(i.id)) i.size = key;
      });
      save();
      closeSizePop();
      bulkPicker.set('');
      render();
    },
    ''
  );

  $('selsizebtn').onclick = (e) => {
    e.stopPropagation();
    const open = $('selsizepop').hidden;
    $('selsizepop').hidden = !open;
    $('selsizebtn').setAttribute('aria-expanded', open);
  };

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.popwrap')) closeSizePop();
  });

  $('seldel').onclick = () => {
    const b = $('seldel');
    if (!sel.size) return;
    if (!b.dataset.armed) {
      b.dataset.armed = '1';
      b.textContent = `Click again to delete ${sel.size}`;
      setTimeout(() => {
        b.dataset.armed = '';
        b.textContent = 'Delete';
      }, 3000);
      return;
    }
    state.items = state.items.filter((i) => !sel.has(i.id));
    sel.clear();
    b.dataset.armed = '';
    b.textContent = 'Delete';
    save();
    updateBar();
    render();
  };
}
