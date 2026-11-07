// Edit mode: the "+" slots and the Edit / Done switch.
import { $ } from './dom.js';
import { computeLayout } from './layout.js';
import { inView } from './helpers.js';
import { openDlg } from './tile-editor.js';
import { wireImageDrop } from './image-drop.js';
import { setMode } from './selection.js';
import { saveSort } from './toolbar.js';
import { render } from './render.js';
import { state } from './state.js';

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
  if (on && state.selMode) setMode(false);
  if (on) {
    $('sort').value = 'custom';
    saveSort();
  }
  $('sort').disabled = on;
  $('bgedit').hidden = !on;
  if (!on && $('bgdlg').open) $('bgdlg').close(); // backgrounds are only edited in Edit mode
  $('editbtn').textContent = on ? 'Done' : 'Edit';
  $('editbtn').setAttribute('aria-pressed', on);
  render();
}

// Connects this module's buttons and events to the page (called once at start-up)
export function initEditMode() {
  $('editbtn').onclick = () => setEdit(!state.editMode);
}
