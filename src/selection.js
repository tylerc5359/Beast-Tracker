// Select mode: move, resize or delete several tiles at once.
import { $, fill } from './dom.js';
import { sel, state } from './state.js';
import { setEdit } from './edit-mode.js';
import { render } from './render.js';
import { save } from './storage.js';
import { buildSizePicker } from './size-picker.js';

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

function updateBar() {
  $('selbar').hidden = !state.selMode;
  document.body.classList.toggle('selecting', state.selMode);
  $('selcount').textContent = `${sel.size} selected`;
  $('selbtn').textContent = state.selMode ? 'Selecting' : 'Select';
  $('selsizebtn').disabled = !sel.size;
  if (!state.selMode || !sel.size) closeSizePop();
}

export function setMode(on) {
  if (on && state.editMode) setEdit(false);
  state.selMode = on;
  sel.clear();
  if (on) selOpts();
  updateBar();
  render();
}

export function toggle(id) {
  sel.has(id) ? sel.delete(id) : sel.add(id);
  updateBar();
  render();
}

function closeSizePop() {
  $('selsizepop').hidden = true;
  $('selsizebtn').setAttribute('aria-expanded', 'false');
}

let bulkPicker;

// Connects this module's buttons and events to the page (called once at start-up)
export function initSelection() {
  $('selbtn').onclick = () => setMode(!state.selMode);

  $('seldone').onclick = () => setMode(false);

  $('selall').onclick = () => {
    const all = state.visibleIds.every((id) => sel.has(id));
    state.visibleIds.forEach((id) => (all ? sel.delete(id) : sel.add(id)));
    updateBar();
    render();
  };

  $('selcat').onchange = () => {
    selSub();
    $('selmove').disabled = $('selcat').value === '__';
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
