// Export and import of the whole library.
import { $ } from './dom.js';
import { exportBackgrounds, importBackgrounds } from './backgrounds/transfer.js';
import { save, saveCats, saveLayouts, saveOrder } from './storage.js';
import { catOpts } from './tile-editor.js';
import { selOpts, updateBar } from './edit-mode.js';
import { render } from './render.js';
import { sel, state } from './state.js';

// Connects this module's buttons and events to the page (called once at start-up)
export function initBackup() {
  $('exp').onclick = async () => {
    const backgrounds = await exportBackgrounds();
    const data = { items: state.items, cats: state.cats, order: state.customOrder, layout: state.layouts, backgrounds };
    // A Blob link (not a data: URL) so large backgrounds and GIFs still download
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'beast-media-backup.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  $('imp').onclick = () => $('impf').click();

  $('impf').onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then(async (t) => {
      try {
        const d = JSON.parse(t);
        const arr = Array.isArray(d) ? d : d.items;
        if (Array.isArray(arr)) {
          state.items = arr;
          sel.clear();
          if (d.cats) {
            state.cats = d.cats;
            state.cats.forEach((k) => (k.subs = k.subs || []));
            saveCats();
            catOpts();
            if (state.editMode) selOpts();
          }
          if (d.order) {
            state.customOrder = d.order;
            saveOrder();
          }
          if (d.layout) {
            state.layouts = d.layout;
            saveLayouts();
          }
          if (Array.isArray(d.backgrounds)) await importBackgrounds(d.backgrounds);
          save();
          if (state.editMode) updateBar();
          render();
        }
      } catch (x) {
        alert('That file isn’t a valid Beast Media Tracker backup.');
      }
    });
  };
}
