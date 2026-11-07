// Backgrounds: adding, replacing and removing.
import { $ } from '../dom.js';
import { gridMetrics } from '../layout.js';
import { BG_DEFAULTS, bgKey } from '../config.js';
import { bgUrls, saveBgs } from './store.js';
import { blobDel, blobSet } from '../disk.js';
import { syncLayers } from './crossfade.js';
import { renderBgPanel } from './panel.js';
import { state } from '../state.js';

export function pickBg(id) {
  state.bgTarget = id;
  $('bgfile').click();
}

// New backgrounds start where the last one ends (or split it in half if it already runs to the bottom)
function newBg(id) {
  const rows = gridMetrics().rows;
  if (!state.bgs.length) return { id, topRow: 1, bottomRow: rows, ...BG_DEFAULTS };
  const tail = [...state.bgs].sort((a, b) => b.bottomRow - a.bottomRow)[0];
  if (tail.bottomRow >= rows && tail.bottomRow > tail.topRow) {
    tail.bottomRow = Math.floor((tail.topRow + tail.bottomRow) / 2);
  }
  return { id, topRow: Math.min(rows, tail.bottomRow + 1), bottomRow: rows, ...BG_DEFAULTS };
}

// Backgrounds saved with percentages (earlier version) are converted to rows
export function migrateBgRows() {
  const rows = gridMetrics().rows;
  let changed = false;
  state.bgs.forEach((bg) => {
    if (bg.topRow != null) return;
    changed = true;
    const t = bg.top ?? 0;
    const b = bg.bottom ?? 100;
    bg.topRow = Math.max(1, Math.min(rows, Math.floor((t / 100) * rows) + 1));
    bg.bottomRow = Math.max(bg.topRow, Math.min(rows, Math.ceil((b / 100) * rows) || 1));
    delete bg.top;
    delete bg.bottom;
  });
  if (changed) saveBgs();
}

export async function removeBg(bg) {
  try {
    await blobDel(bgKey(bg.id));
  } catch (e) {}
  if (bgUrls[bg.id]) URL.revokeObjectURL(bgUrls[bg.id]);
  delete bgUrls[bg.id];
  state.bgs = state.bgs.filter((b) => b !== bg);
  saveBgs();
  syncLayers();
  renderBgPanel();
}

// Connects this module's buttons and events to the page (called once at start-up)
export function initBgManage() {
  $('bgfile').onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f || !f.type.startsWith('image/')) return;

    const id = state.bgTarget || `b${Date.now()}`;
    try {
      await blobSet(bgKey(id), f); // stored untouched, so GIFs keep animating
    } catch (err) {
      $('bgmsg').textContent = 'Couldn’t save that image. Try a smaller one.';
      return;
    }
    if (bgUrls[id]) URL.revokeObjectURL(bgUrls[id]);
    bgUrls[id] = URL.createObjectURL(f);
    if (!state.bgTarget) state.bgs.push(newBg(id));

    $('bgmsg').textContent = '';
    saveBgs();
    syncLayers();
    renderBgPanel();
  };
}
