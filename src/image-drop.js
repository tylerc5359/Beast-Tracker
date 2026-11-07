// Edit mode: drop image files onto empty slots to create image tiles.
import { $ } from './dom.js';
import { MAX_GIF_BYTES } from './config.js';
import { pinCurrentLayout } from './layout.js';
import { aspectOf, shrinkImage } from './utils.js';
import { save, saveLayouts } from './storage.js';
import { render } from './render.js';
import { state } from './state.js';

// Dragging image files from the computer onto an empty slot fills that slot, then the free slots after it
// (left to right, then the next row), with basic image tiles that have no title.
const isFileDrag = (e) => [...(e.dataTransfer?.types || [])].includes('Files');

export function wireImageDrop(cell, c, r) {
  cell.addEventListener('dragover', (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    cell.classList.add('dropping');
  });
  cell.addEventListener('dragleave', () => cell.classList.remove('dropping'));
  cell.addEventListener('drop', (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    cell.classList.remove('dropping');
    dropImages([...e.dataTransfer.files], c, r);
  });
}

let toastTimer = 0;

export function toast(msg) {
  $('toast').textContent = msg;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').hidden = true), 5000);
}

// Resize a dropped picture like an uploaded cover (GIFs are kept as-is so they stay animated)
function fileToCover(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onerror = () => resolve(null);

    if (file.type === 'image/gif') {
      if (file.size > MAX_GIF_BYTES) return resolve(null);
      r.onload = () => {
        const im = new Image();
        im.onload = () => resolve({ src: r.result, ar: aspectOf(im) });
        im.onerror = () => resolve(null);
        im.src = r.result;
      };
      r.readAsDataURL(file);
      return;
    }

    r.onload = () => {
      const im = new Image();
      im.onload = () => resolve({ src: shrinkImage(im, 0.85), ar: aspectOf(im) });
      im.onerror = () => resolve(null);
      im.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

async function dropImages(files, c0, r0) {
  const imgs = files.filter((f) => f.type.startsWith('image/'));
  let skipped = files.length - imgs.length;

  const covers = [];
  for (const f of imgs) {
    const res = await fileToCover(f);
    if (res) covers.push(res);
    else skipped++;
  }

  if (covers.length) {
    const { L, occ } = pinCurrentLayout(); // so adding these can't shuffle the others

    let c = c0;
    let r = r0;
    const stamp = Date.now();
    covers.forEach((pic, n) => {
      while (occ.has(`${c},${r}`)) {
        c++;
        if (c >= state.gridCols) {
          c = 0;
          r++;
        }
      }
      const id = stamp + n;
      occ.set(`${c},${r}`, id);
      L[id] = [c, r];
      state.items.push({
        id,
        t: id,
        u: id,
        title: '',
        basic: true,
        type: state.typeFilter, // new tiles start in the category you are looking at
        status: state.catFilter,
        rating: 0,
        prog: 0,
        pnote: '',
        color: '#6b6b6b',
        desc: '',
        size: '1x1',
        cover: pic.src,
        coverAR: pic.ar
      });
    });

    saveLayouts();
    save();
    render();
  }

  if (skipped) toast(`${skipped} file${skipped === 1 ? ' was' : 's were'} skipped (not an image, or a GIF over ${(MAX_GIF_BYTES / 1048576).toFixed(1)} MB).`);
}

// Connects this module's buttons and events to the page (called once at start-up)
export function initImageDrop() {
  // A file dropped anywhere else shouldn't make the browser navigate away from the app
  window.addEventListener('dragover', (e) => {
    if (isFileDrag(e)) e.preventDefault();
  });

  window.addEventListener('drop', (e) => {
    if (isFileDrag(e)) e.preventDefault();
  });
}
