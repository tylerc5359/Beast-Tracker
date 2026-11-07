// Backgrounds: including them in Export and Import.
import { bgUrls, saveBgs } from './store.js';
import { blobDel, blobGet, blobSet } from '../disk.js';
import { BG_DEFAULTS, bgKey } from '../config.js';
import { dataUrlToBlob } from '../utils.js';
import { migrateBgRows } from './manage.js';
import { syncLayers } from './crossfade.js';
import { renderBgPanel } from './panel.js';
import { state } from '../state.js';

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

// Each background's settings plus its image (as a data URL)
export async function exportBackgrounds() {
  const out = [];
  for (const bg of state.bgs || []) {
    try {
      const blob = await blobGet(bgKey(bg.id));
      out.push({ ...bg, image: blob ? await blobToDataUrl(blob) : null });
    } catch (e) {
      out.push({ ...bg, image: null });
    }
  }
  return out;
}

// Replaces the current backgrounds with the ones in the backup
export async function importBackgrounds(list) {
  for (const bg of state.bgs || []) {
    try {
      await blobDel(bgKey(bg.id));
    } catch (e) {}
    if (bgUrls[bg.id]) URL.revokeObjectURL(bgUrls[bg.id]);
    delete bgUrls[bg.id];
  }

  state.bgs = [];
  for (const entry of list) {
    const { image, ...bg } = entry;
    if (!bg.id) continue;
    if (image) {
      try {
        const blob = dataUrlToBlob(image, 'image/png');
        await blobSet(bgKey(bg.id), blob);
        bgUrls[bg.id] = URL.createObjectURL(blob);
      } catch (e) {}
    }
    state.bgs.push({ ...BG_DEFAULTS, ...bg });
  }

  migrateBgRows();
  saveBgs();
  syncLayers();
  renderBgPanel();
}
