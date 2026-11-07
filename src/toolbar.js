// Search box and sort menu (the chosen sort is remembered).
import { $ } from './dom.js';
import { render } from './render.js';
import { SORTKEY } from './config.js';
import { kvGet, kvSet } from './disk.js';

// Remember the chosen sort option between sessions
export function saveSort() {
  try {
    kvSet(SORTKEY, $('sort').value);
  } catch (e) {}
}

function restoreSort() {
  try {
    const s = kvGet(SORTKEY);
    if (s && [...$('sort').options].some((o) => o.value === s)) $('sort').value = s;
  } catch (e) {}
}

// Connects this module's buttons and events to the page (called once at start-up)
export function initToolbar() {
  $('q').oninput = render;

  restoreSort();

  $('sort').onchange = () => {
    saveSort();
    render();
  };
}
