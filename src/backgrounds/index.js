// Backgrounds: loading and wiring up the panel.
import { bgUrls, saveBgs } from './store.js';
import { BGKEY, BG_DEFAULTS, bgKey } from '../config.js';
import { blobGet, kvGet } from '../disk.js';
import { migrateBgRows, pickBg } from './manage.js';
import { scheduleBgUpdate, syncLayers } from './crossfade.js';
import { renderBgPanel } from './panel.js';
import { $ } from '../dom.js';
import { state } from '../state.js';

async function loadBackgrounds() {
  if (state.bgs === null) {
    // First run with multiple backgrounds: bring over the single background from before
    state.bgs = [];
    try {
      if (await blobGet('bg')) {
        let fx = {};
        try {
          fx = JSON.parse(kvGet(BGKEY)) || {};
        } catch (e) {}
        state.bgs.push({ id: 'legacy', top: 0, bottom: 100, ...BG_DEFAULTS, ...fx });
      }
    } catch (e) {}
    saveBgs();
  }
  for (const bg of state.bgs) {
    try {
      const blob = await blobGet(bgKey(bg.id));
      if (blob) bgUrls[bg.id] = URL.createObjectURL(blob);
    } catch (e) {}
  }
  migrateBgRows();
  syncLayers();
  renderBgPanel();
}

const toggleBgPanel = () => {
  if ($('bgdlg').open) return $('bgdlg').close();
  $('bgdlg').show();
  state.bgSyncs.forEach((fn) => fn()); // the number of rows may have changed
};

// Connects this module's buttons and events to the page (called once at start-up)
export function initBackgrounds() {
  $('bgedit').onclick = toggleBgPanel;

  $('bgdone').onclick = () => $('bgdlg').close();

  $('bgadd').onclick = () => pickBg(null);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('bgdlg').open) $('bgdlg').close();
  });

  addEventListener('scroll', scheduleBgUpdate, { passive: true });

  addEventListener('resize', scheduleBgUpdate);

  new ResizeObserver(scheduleBgUpdate).observe(document.body); // the page grows/shrinks as tiles change

  loadBackgrounds();
}
