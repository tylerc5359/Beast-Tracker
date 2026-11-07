// Start-up: load saved data, wire every module to the page, draw the first render.
import { initDisk, diskInfo } from './disk.js';
import { initImageDrop, toast } from './image-drop.js';
import { loadStorageState } from './storage.js';
import { loadBgstoreState } from './backgrounds/store.js';
import { initDrag } from './drag.js';
import { initEditMode } from './edit-mode.js';
import { initSizePicker } from './size-picker.js';
import { initTileEditor } from './tile-editor.js';
import { initCoverEditor } from './cover-editor.js';
import { initCoverArt } from './cover-art.js';
import { initToolbar } from './toolbar.js';
import { initMenu } from './menu.js';
import { initBackup } from './backup.js';
import { initCategories } from './categories.js';
import { initSelection } from './selection.js';
import { initDevTools } from './dev-tools.js';
import { initBgManage } from './backgrounds/manage.js';
import { initBackgrounds } from './backgrounds/index.js';
import { measure } from './helpers.js';
import { render } from './render.js';
import { $ } from './dom.js';

// 1. Read saved data (in the Electron app, first load the library folder into memory)
addEventListener('beast-disk-error', (e) => toast(e.detail));
await initDisk();
if (diskInfo.notice) toast(diskInfo.notice);
loadStorageState();
loadBgstoreState();

// 2. Connect each module to the page
initDrag();
initImageDrop();
initSizePicker();
initTileEditor();
initCoverEditor();
initCoverArt();
initEditMode();
initToolbar();
initMenu();
initBackup();
initCategories();
initSelection();
initDevTools();
initBgManage();
initBackgrounds();

// 3. Draw
let lastM = '';

new ResizeObserver(() => {
  const k = measure();
  if (k !== lastM && !document.body.classList.contains('dragging')) {
    lastM = k;
    render();
  }
}).observe($('grid'));

render();
