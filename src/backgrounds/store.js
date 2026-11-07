// Backgrounds: saved settings.
// (The images themselves are saved with blobGet/blobSet/blobDel in ../disk.js)
import { BGS_KEY } from '../config.js';
import { kvGet, kvSet } from '../disk.js';
import { state } from '../state.js';

export const bgUrls = {}; // background id → blob: URL of its image

function loadBgs() {
  try {
    const l = JSON.parse(kvGet(BGS_KEY));
    if (Array.isArray(l)) return l;
  } catch (e) {}
  return null; // null = first run with multiple backgrounds
}

export function saveBgs() {
  try {
    kvSet(BGS_KEY, JSON.stringify(state.bgs));
  } catch (e) {}
}

// Reads saved data into `state` (called once at start-up)
export function loadBgstoreState() {
  // Several backgrounds can be stacked down the shelf. Each covers a Top row to a Bottom row of the
  // tile grid. Scrolling crossfades slowly from one background to the next.
  state.bgs = loadBgs();
}
