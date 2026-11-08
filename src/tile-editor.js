// The add / edit tile dialog: opening, filling, saving, deleting.
import { $, fill } from './dom.js';
import { frameOf, paintCover, setCover } from './cover-editor.js';
import { findLink } from './cover-art.js';
import { lockSizesForSpot, setTileSize } from './size-picker.js';
import { pinCurrentLayout } from './layout.js';
import { clamp } from './utils.js';
import { save, saveLayouts } from './storage.js';
import { updateBar } from './edit-mode.js';
import { render } from './render.js';
import { sel, state } from './state.js';

function subOpts(selectedVal) {
  fill($('type'), [
    ['', 'None'],
    ...((state.cats.find((c) => c.id === $('status').value) || { subs: [] }).subs.map((s) => [s.id, s.name]))
  ]);
  $('type').value = selectedVal || '';
}

export function catOpts() {
  fill($('status'), [['', 'No category'], ...state.cats.map((c) => [c.id, c.name])]);
  subOpts();
}

// Basic image tile: hide the fields it doesn't use (the title stays)
function syncBasic() {
  const on = $('basic').checked;
  $('f').classList.toggle('is-basic', on);
  paintCover();
}

export function openDlg(i, anchor = null) {
  state.editing = i;
  state.addAnchor = i ? null : anchor;
  const d = i || {
    title: '',
    type: state.typeFilter, // new tiles start in the category you are looking at
    status: state.catFilter,
    rating: 0,
    prog: 0,
    pnote: '',
    color: '#6b6b6b',
    desc: '',
    cover: ''
  };

  $('title').value = d.title;
  $('basic').checked = !!d.basic;
  syncBasic();
  findLink();
  $('status').value = d.status;
  subOpts(d.type);
  $('rating').value = d.rating;
  $('color').value = d.color;
  $('prog').value = d.prog;
  setTileSize(d.size || '1x1');
  lockSizesForSpot(i);
  $('pnote').value = d.pnote;
  $('desc').value = d.desc;
  state.frame = frameOf(d);
  setCover(d.cover, true);

  $('del').style.display = i ? '' : 'none';
  $('del').textContent = 'Delete';
  $('del').dataset.armed = '';
  $('dlg').showModal();
  paintCover(); // sizes can only be measured once the dialog is on screen
  $('title').focus();
}

// Connects this module's buttons and events to the page (called once at start-up)
export function initTileEditor() {
  catOpts();

  $('basic').onchange = syncBasic;

  $('cancel').onclick = () => $('dlg').close();

  // Save (add or update) and delete
  $('f').onsubmit = (e) => {
    e.preventDefault();
    const d = {
      title: $('title').value.trim(),
      basic: $('basic').checked,
      type: $('type').value,
      status: $('status').value,
      rating: +$('rating').value,
      color: $('color').value,
      prog: clamp(+$('prog').value || 0, 0, 100),
      pnote: $('pnote').value,
      desc: $('desc').value,
      size: $('tsize').value,
      u: Date.now(),
      cover: state.cover,
      coverZ: state.frame.z,
      coverX: state.frame.x,
      coverY: state.frame.y,
      coverAR: state.frame.ar,
      nameX: state.frame.nx,
      nameY: state.frame.ny,
      nameS: state.frame.ns
    };

    if (state.editing) {
      Object.assign(state.editing, d);
    } else {
      const id = Date.now();
      if (state.addAnchor) {
        const { L } = pinCurrentLayout();
        L[id] = state.addAnchor;
        saveLayouts();
      }
      state.items.push({ id, t: id, ...d });
    }

    save();
    render();
    $('dlg').close();
  };

  $('del').onclick = () => {
    const b = $('del');
    if (!state.editing) return;
    if (!b.dataset.armed) {
      b.dataset.armed = '1';
      b.textContent = 'Click again to delete';
      setTimeout(() => {
        b.dataset.armed = '';
        b.textContent = 'Delete';
      }, 3000);
      return;
    }
    sel.delete(state.editing.id);
    state.items = state.items.filter((i) => i !== state.editing);
    save();
    if (state.editMode) updateBar();
    render();
    $('dlg').close();
  };

  $('status').onchange = () => subOpts();
}
