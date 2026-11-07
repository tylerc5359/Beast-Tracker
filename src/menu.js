// Header: burger menu, theme switch and hide-on-scroll.
import { $ } from './dom.js';
import { diskInfo, openDataFolder } from './disk.js';

function menu(open) {
  $('tray').classList.toggle('open', open);
  $('burger').setAttribute('aria-expanded', open);
}

let lastY = scrollY;

// Connects this module's buttons and events to the page (called once at start-up)
export function initMenu() {
  // Only the Electron app has a library folder to show
  if (diskInfo.onDisk) {
    $('datadir').hidden = false;
    $('datadir').title = diskInfo.dir;
    $('datadir').onclick = openDataFolder;
  }

  $('theme').onclick = () => {
    const r = document.documentElement;
    const dark = matchMedia('(prefers-color-scheme:dark)').matches;
    const cur = r.dataset.theme || (dark ? 'dark' : 'light');
    r.dataset.theme = cur === 'dark' ? 'light' : 'dark';
  };

  $('burger').onclick = (e) => {
    e.stopPropagation();
    menu(!$('tray').classList.contains('open'));
  };

  $('tray').addEventListener('click', (e) => {
    if (e.target.closest('.btn')) menu(false);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#tray')) menu(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') menu(false);
  });

  addEventListener(
    'scroll',
    () => {
      const h = document.querySelector('header');
      const y = scrollY;
      h.classList.toggle('scrolled', y > 4);
      if (Math.abs(y - lastY) < 6) return;
      const down = y > lastY;
      h.classList.toggle('hide', down && y > h.offsetHeight);
      if (down) menu(false);
      lastY = y;
    },
    { passive: true }
  );
}
