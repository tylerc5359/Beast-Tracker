/**
 * Beast Media Tracker - Application Script
 */

// --- Constants & Grid Configuration ---
// Tile sizes are "<columns>x<rows>" (e.g. '3x2'), plus two that adapt to the window.
const SIZE_SPECIAL = {
  row: { c: 'all', r: 1 },
  full: { c: 'all', r: 'page' }
};
const MAX_COLS = 8; // columns shown in the size picker
const MAX_ROWS = 6; // rows shown in the size picker

const OKEY = 'beast-order';
const BGKEY = 'beast-bgfx'; // single-background settings from before multiple backgrounds existed
const BGS_KEY = 'beast-bgs';
const BG_DEFAULTS = { blur: 0, bright: 100, sat: 100 };
const MAX_GIF_BYTES = 20 * 1024 * 1024; // GIF covers are kept as-is, so they must fit in storage
const CKEY = 'beast-cats';
const KEY = 'shelf-v1';
const LKEY = 'beast-layout';
const SORTKEY = 'beast-sort';

const RM = matchMedia('(prefers-reduced-motion:reduce)');
const $ = (id) => document.getElementById(id);

// --- Application State ---
let gridCols = 1;
let pageRows = 3;
let dragId = null;
let lastSig = '';
let animT = 0;
let noAnim = false;
let catFilter = '';
let typeFilter = '';
let cover = '';
let frame = { z: 1, x: 50, y: 50, ar: null, nx: null, ny: null, ns: 1 }; // zoom, pan and name position of the cover being edited
let editing = null;
let selMode = false;
let editMode = false; // Edit mode: tiles can be moved and empty cells show a "+"
let addAnchor = null; // [column, row] the new tile will start at
let visibleIds = [];
const sel = new Set();
let dragMoved = false;

// --- Persistence Helpers ---
let customOrder = (() => {
  try {
    return JSON.parse(localStorage.getItem(OKEY)) || {};
  } catch (e) {
    return {};
  }
})();

function saveOrder() {
  try {
    localStorage.setItem(OKEY, JSON.stringify(customOrder));
  } catch (e) {}
}

let layouts = (() => {
  try {
    return JSON.parse(localStorage.getItem(LKEY)) || {};
  } catch (e) {
    return {};
  }
})();

function saveLayouts() {
  try {
    localStorage.setItem(LKEY, JSON.stringify(layouts));
  } catch (e) {}
}

function loadCats() {
  try {
    const raw = localStorage.getItem(CKEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      parsed.forEach((k) => (k.subs = k.subs || []));
      return parsed;
    }
  } catch (e) {}
  return [];
}

function saveCats() {
  try {
    localStorage.setItem(CKEY, JSON.stringify(cats));
  } catch (e) {}
}

let cats = loadCats();

function loadItems() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch (e) {
    alert('Couldn’t save — storage is full. Try smaller cover images or export a backup.');
  }
}

let items = loadItems() || [
  {
    id: 1,
    title: 'Spirited Away',
    type: '',
    status: '',
    rating: 5,
    prog: 100,
    pnote: '',
    color: '#9a9a9a',
    desc: 'A girl wanders into a world of spirits and has to work her way home.',
    cover: '',
    t: 3
  },
  {
    id: 2,
    title: 'Hades',
    type: '',
    status: '',
    rating: 4,
    prog: 60,
    pnote: 'Heat 8 clears',
    color: '#7a7a7a',
    desc: 'Fight out of the underworld, one run at a time.',
    cover: '',
    t: 2
  },
  {
    id: 3,
    title: 'Piranesi',
    type: '',
    status: '',
    rating: 0,
    prog: 0,
    pnote: '',
    color: '#b0b0b0',
    desc: 'A man lives in a house of endless halls and tides.',
    cover: '',
    t: 1
  }
];

// --- Helpers ---
const catName = (id) => (cats.find((c) => c.id === id) || {}).name || '';

const subName = (c, s) => {
  const parent = cats.find((x) => x.id === c);
  return ((parent && parent.subs.find((y) => y.id === s)) || {}).name || '';
};

function sizeOf(key) {
  if (SIZE_SPECIAL[key]) return SIZE_SPECIAL[key];
  const m = /^(\d+)x(\d+)$/.exec(key || '');
  return m ? { c: Math.max(1, +m[1]), r: Math.max(1, +m[2]) } : { c: 1, r: 1 };
}

function viewKey() {
  return catFilter ? (typeFilter ? `${catFilter}|${typeFilter}` : catFilter) : 'all';
}

function inView(i) {
  return (!catFilter || i.status === catFilter) && (!catFilter || !typeFilter || i.type === typeFilter);
}

function customSorted(list) {
  const ord = customOrder[viewKey()] || [];
  const pos = (id) => {
    const k = ord.indexOf(id);
    return k < 0 ? 1e9 : k;
  };
  return list.slice().sort((a, b) => pos(a.id) - pos(b.id) || b.t - a.t);
}

function measure() {
  const grid = $('grid');
  const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean);
  gridCols = cols.length || 1;
  const w = parseFloat(cols[0]) || 190; // current tile width in px (8 columns share the window)
  const rh = Math.round(w * 1.5); // tiles keep a 2:3 shape
  const gap = parseFloat(getComputedStyle(grid).rowGap) || 22;
  grid.style.setProperty('--rh', `${rh}px`);
  grid.style.setProperty('--ts', Math.max(0.65, Math.min(1.4, 0.4 + (0.6 * w) / 190)).toFixed(3)); // text scale (gentler than the tile)
  pageRows = Math.max(2, Math.round((innerHeight * 0.85) / (rh + gap)));
  // Row height and text scale update live; only a change in rows per screen needs a re-render
  return `${gridCols}|${pageRows}`;
}

// --- Layout Calculation ---
const fp = (i) => {
  const z = sizeOf(i.size);
  return {
    w: z.c === 'all' ? gridCols : Math.min(z.c, gridCols),
    h: z.r === 'page' ? pageRows : z.r
  };
};

const freeAt = (occ, c, r, w, h) => {
  if (c < 0 || c + w > gridCols) return false;
  for (let y = r; y < r + h; y++) {
    for (let x = c; x < c + w; x++) {
      if (occ.has(`${x},${y}`)) return false;
    }
  }
  return true;
};

const mark = (occ, c, r, w, h, id) => {
  for (let y = r; y < r + h; y++) {
    for (let x = c; x < c + w; x++) {
      occ.set(`${x},${y}`, id);
    }
  }
};

const unmark = (occ, c, r, w, h) => {
  for (let y = r; y < r + h; y++) {
    for (let x = c; x < c + w; x++) {
      occ.delete(`${x},${y}`);
    }
  }
};

function firstFit(occ, w, h, r0) {
  for (let r = r0; ; r++) {
    for (let c = 0; c <= gridCols - w; c++) {
      if (freeAt(occ, c, r, w, h)) return [c, r];
    }
  }
}

function computeLayout(list) {
  const L = layouts[viewKey()] || {};
  const occ = new Map();
  const pos = new Map();

  list
    .filter((i) => L[i.id])
    .sort((a, b) => L[a.id][1] - L[b.id][1] || L[a.id][0] - L[b.id][0])
    .forEach((i) => {
      const { w, h } = fp(i);
      let c = Math.max(0, Math.min(L[i.id][0], gridCols - w));
      let r = L[i.id][1];
      if (!freeAt(occ, c, r, w, h)) [c, r] = firstFit(occ, w, h, r);
      mark(occ, c, r, w, h, i.id);
      pos.set(i.id, [c, r]);
    });

  let row = 0;
  pos.forEach((p) => {
    row = Math.max(row, p[1]);
  });

  customSorted(list.filter((i) => !L[i.id])).forEach((i) => {
    const { w, h } = fp(i);
    const [c, r] = firstFit(occ, w, h, row);
    mark(occ, c, r, w, h, i.id);
    pos.set(i.id, [c, r]);
  });

  return { pos, occ };
}

// --- Drag & Drop Mechanics ---
document.addEventListener('click', (e) => {
  if (dragMoved) {
    e.stopPropagation();
    e.preventDefault();
    dragMoved = false;
  }
}, true);

function startDrag(e, b) {
  if (e.button !== 0 || e.pointerType === 'touch' || e.target.closest('.stars b, .bar2')) return;

  const g = $('grid');
  const id = b._id;
  const x0 = e.clientX;
  const y0 = e.clientY;
  const base = new Map();
  const sizes = new Map();
  const elOf = new Map();
  const guides = new Map();

  let on = false;
  let cx = x0;
  let cy = y0;
  let gx = 0;
  let gy = 0;
  let oc = 0;
  let orr = 0;
  let raf = 0;
  let pl = 0;
  let pt = 0;
  let pX = 1;
  let pY = 1;
  let P = [0, 0];
  let applied = '';
  let hov = null;
  let curPos = base;
  let gr = 0;
  let lim = 0;

  const tl = () => [...g.querySelectorAll('.tile')];
  const tr = (o) => {
    const t = getComputedStyle(o).translate;
    if (!t || t === 'none') return [0, 0];
    const q = t.split(' ').map(parseFloat);
    return [q[0] || 0, q[1] || 0];
  };

  const mp = () => {
    const r = g.getBoundingClientRect();
    return [cx - r.left, cy - r.top];
  };

  const area = (k) => sizes.get(k).w * sizes.get(k).h;

  const ensure = (n) => {
    while (gr < n) {
      for (let c = 0; c < gridCols; c++) {
        const d = document.createElement('div');
        d.className = 'gap';
        d.style.gridColumn = `${c + 1} / span 1`;
        d.style.gridRow = `${gr + 1} / span 1`;
        g.append(d);
        guides.set(`${c},${gr}`, d);
      }
      gr++;
    }
  };

  const resolve = (T) => {
    const out = new Map();
    const occ = new Map();
    const H = sizes.get(id);
    const vic = [];

    base.forEach((p, k) => {
      if (k === id) return;
      const s = sizes.get(k);
      if (p[0] < T[0] + H.w && p[0] + s.w > T[0] && p[1] < T[1] + H.h && p[1] + s.h > T[1]) {
        vic.push(k);
      } else {
        mark(occ, p[0], p[1], s.w, s.h, k);
        out.set(k, p);
      }
    });

    mark(occ, T[0], T[1], H.w, H.h, id);
    out.set(id, T);

    let mr = 0;
    base.forEach((p, k) => {
      mr = Math.max(mr, p[1] + sizes.get(k).h);
    });
    mr += H.h + 4;

    const fixed = new Set([id]);
    const q = vic.slice();

    while (q.length) {
      q.sort((a, b) => area(b) - area(a));
      const k = q.shift();
      const s = sizes.get(k);
      const o = base.get(k);
      const pc = Math.max(0, Math.min(o[0] - T[0] + P[0], gridCols - s.w));
      const pr = Math.max(0, o[1] - T[1] + P[1]);
      let best = null;
      let bc = 1e9;

      for (let r = 0; r <= mr; r++) {
        for (let c = 0; c <= gridCols - s.w; c++) {
          const d = Math.abs(c - pc) + Math.abs(r - pr);
          if (d >= bc) continue;
          const bl = new Set();
          let ok = true;

          for (let y = r; y < r + s.h && ok; y++) {
            for (let x = c; x < c + s.w; x++) {
              const v = occ.get(`${x},${y}`);
              if (v !== undefined) {
                if (fixed.has(v) || area(v) >= area(k)) {
                  ok = false;
                  break;
                }
                bl.add(v);
              }
            }
          }

          if (ok && d + bl.size * 2 < bc) {
            bc = d + bl.size * 2;
            best = [c, r, bl];
          }
        }
      }

      const [c, r, bl] = best;
      bl.forEach((v) => {
        const vs = sizes.get(v);
        const vp = out.get(v);
        unmark(occ, vp[0], vp[1], vs.w, vs.h);
        q.push(v);
      });

      mark(occ, c, r, s.w, s.h, k);
      out.set(k, [c, r]);
      fixed.add(k);
    }
    return out;
  };

  const flip = (out) => {
    const els = tl().filter((o) => o !== b);
    const first = new Map(
      els.map((o) => {
        const c = tr(o);
        return [o, [o.offsetLeft + c[0], o.offsetTop + c[1]]];
      })
    );

    out.forEach((p, k) => {
      const o = elOf.get(k);
      const s = sizes.get(k);
      o.style.gridColumn = `${p[0] + 1} / span ${s.w}`;
      o.style.gridRow = `${p[1] + 1} / span ${s.h}`;
    });

    first.forEach((f, o) => {
      const dx = f[0] - o.offsetLeft;
      const dy = f[1] - o.offsetTop;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      o.style.transition = 'none';
      o.style.translate = `${dx}px ${dy}px`;
    });

    void g.offsetWidth;
    first.forEach((f, o) => {
      o.style.transition = '';
      o.style.translate = '0px 0px';
    });
  };

  const follow = () => {
    const [px, py] = mp();
    b.style.translate = `${px - gx - b.offsetLeft}px ${py - gy - b.offsetTop}px`;
  };

  const place = () => {
    follow();
    const [px, py] = mp();
    const H = sizes.get(id);
    const hc = Math.max(0, Math.floor((px - pl) / pX));
    const hr = Math.max(0, Math.floor((py - pt) / pY));
    const T = [Math.max(0, Math.min(hc - oc, gridCols - H.w)), Math.min(lim, Math.max(0, hr - orr))];
    const key = T.join();

    if (key === applied) return;

    const out = resolve(T);
    const moved = [...out].some(([k, p]) => k !== id && (base.get(k)[0] !== p[0] || base.get(k)[1] !== p[1]));
    const now = performance.now();

    if (moved) {
      if (!hov || hov.k !== key) hov = { k: key, s: now };
      if (now - hov.s < 100) return;
    }

    hov = null;
    applied = key;
    curPos = out;
    flip(out);
    follow();

    guides.forEach((d) => d.classList.remove('drop'));
    for (let y = T[1]; y < T[1] + H.h; y++) {
      for (let x = T[0]; x < T[0] + H.w; x++) {
        const d = guides.get(`${x},${y}`);
        if (d) d.classList.add('drop');
      }
    }
  };

  const loop = () => {
    if (!on) return;
    if (cy < 80) scrollBy(0, -14);
    else if (cy > innerHeight - 80) scrollBy(0, 14);

    try {
      place();
    } catch (err) {
      console.error(err);
    }
    raf = requestAnimationFrame(loop);
  };

  const begin = () => {
    on = true;
    dragMoved = true;
    const cs = getComputedStyle(g);
    const cols = cs.gridTemplateColumns.split(' ').map(parseFloat);

    pl = parseFloat(cs.paddingLeft);
    pt = parseFloat(cs.paddingTop);
    pX = cols[0] + (parseFloat(cs.columnGap) || 22);
    pY =
      (parseFloat(cs.gridAutoRows) || parseFloat(g.style.getPropertyValue('--rh')) || 300) +
      (parseFloat(cs.rowGap) || 22);

    const ts = tl().map((o) => ({
      o,
      f: fp(o._it),
      c: Math.round((o.offsetLeft - pl) / pX),
      r: Math.round((o.offsetTop - pt) / pY)
    }));

    let mr = 0;
    ts.forEach(({ o, f, c, r }) => {
      elOf.set(o._id, o);
      sizes.set(o._id, f);
      base.set(o._id, [c, r]);
      mr = Math.max(mr, r + f.h);
      o.style.gridColumn = `${c + 1} / span ${f.w}`;
      o.style.gridRow = `${r + 1} / span ${f.h}`;
    });

    P = base.get(id);
    applied = P.join();
    document.body.classList.add('dragging');
    lim = mr + 2;
    ensure(lim + sizes.get(id).h);

    const [px, py] = mp();
    gx = px - b.offsetLeft;
    gy = py - b.offsetTop;
    oc = Math.min(sizes.get(id).w - 1, Math.max(0, Math.floor(gx / pX)));
    orr = Math.min(sizes.get(id).h - 1, Math.max(0, Math.floor(gy / pY)));

    b.classList.remove('in');
    b.classList.add('held');
    loop();
  };

  const mv = (ev) => {
    cx = ev.clientX;
    cy = ev.clientY;
    if (!on) {
      if (Math.hypot(cx - x0, cy - y0) > 6) begin();
    } else {
      follow();
    }
  };

  const up = () => {
    b.removeEventListener('pointermove', mv);
    b.removeEventListener('pointerup', up);
    b.removeEventListener('pointercancel', up);

    if (!on) return;
    on = false;
    cancelAnimationFrame(raf);
    setTimeout(() => {
      dragMoved = false;
    }, 0);

    document.body.classList.remove('dragging');
    guides.forEach((d) => d.classList.remove('drop'));

    const changed = [...curPos].some(([k, p]) => base.get(k)[0] !== p[0] || base.get(k)[1] !== p[1]);
    if (changed) {
      const key = viewKey();
      const L = layouts[key] || (layouts[key] = {});
      curPos.forEach((p, k) => {
        L[k] = p;
      });
      saveLayouts();
      $('sort').value = 'custom';
      g.classList.add('free');
    }

    renderAddCells(); // the cells the tile left are free again
    b.classList.remove('held');
    b.style.translate = '0px 0px';
    setTimeout(() => guides.forEach((d) => d.remove()), 340);
  };

  b.setPointerCapture(e.pointerId);
  b.addEventListener('pointermove', mv);
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
}

// --- Edit Mode: "+" cells ---
// Draws a dashed "+" button over every empty cell (plus two spare rows) while editing.
// Clicking one opens the add dialog for a tile whose top-left corner is that cell.
function renderAddCells() {
  const g = $('grid');
  g.querySelectorAll('.addcell').forEach((el) => el.remove());
  if (!editMode || selMode || $('sort').value !== 'custom') return;

  const { occ } = computeLayout(items.filter(inView));
  let rows = 0;
  occ.forEach((_, key) => {
    rows = Math.max(rows, +key.split(',')[1] + 1);
  });
  rows = Math.max(rows + 2, 3);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (occ.has(`${c},${r}`)) continue;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'addcell';
      cell.textContent = '+';
      cell.setAttribute('aria-label', `Add media at column ${c + 1}, row ${r + 1}`);
      cell.style.gridColumn = `${c + 1} / span 1`;
      cell.style.gridRow = `${r + 1} / span 1`;
      cell.onclick = () => openDlg(null, [c, r]);
      wireImageDrop(cell, c, r);
      g.append(cell);
    }
  }
}

// --- Edit Mode: drop images onto empty slots ---
// Dragging image files from the computer onto an empty slot fills that slot, then the free slots after it
// (left to right, then the next row), with basic image tiles that have no title.
const isFileDrag = (e) => [...(e.dataTransfer?.types || [])].includes('Files');

function wireImageDrop(cell, c, r) {
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

// A file dropped anywhere else shouldn't make the browser navigate away from the app
window.addEventListener('dragover', (e) => {
  if (isFileDrag(e)) e.preventDefault();
});
window.addEventListener('drop', (e) => {
  if (isFileDrag(e)) e.preventDefault();
});

let toastTimer = 0;
function toast(msg) {
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
        im.onload = () => resolve({ src: r.result, ar: +(im.naturalWidth / im.naturalHeight).toFixed(4) });
        im.onerror = () => resolve(null);
        im.src = r.result;
      };
      r.readAsDataURL(file);
      return;
    }

    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        const sc = Math.min(1, 1000 / im.width);
        const cv = document.createElement('canvas');
        cv.width = im.width * sc;
        cv.height = im.height * sc;
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        resolve({ src: cv.toDataURL('image/jpeg', 0.85), ar: +(im.naturalWidth / im.naturalHeight).toFixed(4) });
      };
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
    // Pin every current tile first so adding these can't shuffle the others
    const key = viewKey();
    const L = layouts[key] || (layouts[key] = {});
    const { pos, occ } = computeLayout(items.filter(inView));
    pos.forEach((p, k) => {
      L[k] = p;
    });

    let c = c0;
    let r = r0;
    const stamp = Date.now();
    covers.forEach((pic, n) => {
      while (occ.has(`${c},${r}`)) {
        c++;
        if (c >= gridCols) {
          c = 0;
          r++;
        }
      }
      const id = stamp + n;
      occ.set(`${c},${r}`, id);
      L[id] = [c, r];
      items.push({
        id,
        t: id,
        u: id,
        title: '',
        basic: true,
        type: typeFilter, // new tiles start in the category you are looking at
        status: catFilter,
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

// Edit mode on/off. Turning it on switches to Custom sort (the only sort with fixed cells).
function setEdit(on) {
  editMode = on;
  if (on && selMode) setMode(false);
  if (on) {
    $('sort').value = 'custom';
    saveSort();
  }
  $('sort').disabled = on;
  $('bgedit').hidden = !on;
  if (!on && $('bgdlg').open) $('bgdlg').close(); // backgrounds are only edited in Edit mode
  $('editbtn').textContent = on ? 'Done' : 'Edit';
  $('editbtn').setAttribute('aria-pressed', on);
  render();
}

// --- Main Render Function ---
function render() {
  measure();
  const q = $('q').value.toLowerCase();
  const s = $('sort').value;

  let list = items.filter(
    (i) =>
      (!catFilter || !typeFilter || i.type === typeFilter) &&
      (!catFilter || i.status === catFilter) &&
      (i.title + i.desc).toLowerCase().includes(q)
  );

  const cmp = {
    new: (a, b) => b.t - a.t,
    old: (a, b) => a.t - b.t,
    edited: (a, b) => (b.u || b.t) - (a.u || a.t),
    title: (a, b) => a.title.localeCompare(b.title),
    titlez: (a, b) => b.title.localeCompare(a.title),
    rating: (a, b) => b.rating - a.rating,
    ratinglow: (a, b) => (a.rating || 9) - (b.rating || 9),
    progress: (a, b) => b.prog - a.prog
  }[s];

  if (s !== 'custom') list.sort(cmp);
  visibleIds = list.map((i) => i.id);

  const lay = s === 'custom' ? computeLayout(list) : null;
  $('grid').classList.toggle('free', s === 'custom');

  const canDrag = editMode && !selMode; // moving tiles only works in Edit mode
  document.body.classList.toggle('customsort', canDrag);
  document.body.classList.toggle('editing', editMode);

  const g = $('grid');
  g.textContent = '';

  if (!list.length && !editMode) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = items.length
      ? 'Nothing matches. Try another search or type.'
      : 'Your library is empty. Press Edit, then click + to add your first title.';
    g.append(empty);
  }

  const sig = list.map((x) => x.id).join();
  const now = performance.now();
  const animate = !noAnim && (sig !== lastSig || now - animT < 700);

  if (sig !== lastSig && !noAnim) animT = now;
  lastSig = sig;
  noAnim = false;

  list.forEach((i, ix) => {
    const b = document.createElement('div');
    b.setAttribute('role', 'button');
    b.tabIndex = 0;
    b.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        b.click();
      }
    };
    b.className = i.basic ? 'tile basic' : 'tile';
    b.style.setProperty('--tc', i.color);

    const sz = sizeOf(i.size);
    b.style.gridColumn = sz.c === 'all' ? '1/-1' : `span ${Math.min(sz.c, gridCols)}`;
    b.style.gridRow = `span ${sz.r === 'page' ? pageRows : sz.r}`;
    if (sz.c === 'all' || (sz.c >= 2 && sz.r >= 2)) b.classList.add('big');

    if (!i.basic) b.style.background = `linear-gradient(155deg, ${i.color}, #1a1a1a)`; // basic tiles: no gradient

    if (i.cover) {
      const a = document.createElement('div');
      a.className = 'art';
      artStyle(a, i.cover, frameOf(i));
      ensureAR(i, a);
      b.append(a);
    } else if (i.basic) {
      b.classList.add('noimg'); // basic tile without a picture yet: plain tile with an image icon
    } else {
      const p = document.createElement('div');
      p.className = 'ph';
      p.textContent = i.title.trim().charAt(0).toUpperCase();
      b.append(p);
    }

    // Media tiles get the gradient, title, rating and progress.
    // Basic image tiles show only the picture and the title (see the else branch).
    if (!i.basic) {
      const sh = document.createElement('div');
      sh.className = 'shade';
      b.append(sh);

      const inf = document.createElement('div');
      inf.className = 'info';

      const n = document.createElement('h2');
      n.className = 'name';
      n.textContent = i.title;

      const m = document.createElement('div');
      m.className = 'meta';
      m.textContent = [subName(i.status, i.type), i.pnote].filter(Boolean).join(' – ');
      inf.append(n, m);

      if (i.desc) {
        const d = document.createElement('div');
        d.className = 'desc';
        d.textContent = i.desc;
        inf.append(d);
      }

      const qa = document.createElement('div');
      qa.className = 'qa';
      const st = document.createElement('div');
      const pc = document.createElement('span');
      pc.className = 'pct';

      const bar = document.createElement('div');
      bar.className = 'bar2';
      const bf = document.createElement('i');
      bar.append(bf);

      const paint = (r = i.rating) => {
        st.className = `stars${i.rating ? '' : ' none'}`;
        [...st.children].forEach((x, k) => (x.textContent = k < r ? '★' : '☆'));
        bf.style.width = `${i.prog}%`;
        bar.classList.toggle('on', i.prog > 0 && i.prog < 100);
        pc.textContent = i.prog > 0 ? `${i.prog}%` : '';
      };

      for (let v = 1; v <= 5; v++) {
        const star = document.createElement('b');
        star.setAttribute('role', 'button');
        star.setAttribute('aria-label', `Rate ${v}`);
        star.textContent = '☆';
        star.onmouseenter = () => paint(v);
        star.onclick = (e) => {
          e.stopPropagation();
          i.rating = i.rating === v ? 0 : v;
          i.u = Date.now();
          save();
          paint();
          st.classList.remove('pop');
          void st.offsetWidth;
          st.classList.add('pop');
        };
        st.append(star);
      }

      st.onmouseleave = () => paint();
      qa.append(st, pc);

      const setP = (e) => {
        const r = bar.getBoundingClientRect();
        i.prog = Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * 20) * 5;
        paint();
      };

      bar.onpointerdown = (e) => {
        e.stopPropagation();
        bar.setPointerCapture(e.pointerId);
        bar._d = 1;
        setP(e);
      };
      bar.onpointermove = (e) => {
        if (bar._d) setP(e);
      };
      bar.onpointerup = bar.onpointercancel = () => {
        if (bar._d) {
          bar._d = 0;
          i.u = Date.now();
          save();
        }
      };
      bar.onclick = (e) => e.stopPropagation();

      paint();
      inf.append(qa, bar);
      b.append(inf);
    } else {
      if (i.title.trim()) {
        const bt = document.createElement('h2');
        bt.className = 'title';
        bt.textContent = i.title;
        placeName(bt, i.nameX, i.nameY);
        bt.style.setProperty('--ns', i.nameS || 1);
        b.append(bt);
      }
    }

    if (selMode) {
      const ck = document.createElement('div');
      ck.className = 'chk';
      ck.textContent = sel.has(i.id) ? '✓' : '';
      b.append(ck);
      b.classList.toggle('sel', sel.has(i.id));
      b.setAttribute('aria-pressed', sel.has(i.id));
    }

    b.onclick = () => (selMode ? toggle(i.id) : openDlg(i));
    b._id = i.id;
    b._it = i;

    if (lay) {
      const qPos = lay.pos.get(i.id);
      const f = fp(i);
      b.style.gridColumn = `${qPos[0] + 1} / span ${f.w}`;
      b.style.gridRow = `${qPos[1] + 1} / span ${f.h}`;
    }

    if (canDrag) b.onpointerdown = (e) => startDrag(e, b);
    if (animate) {
      b.classList.add('in');
      b.style.setProperty('--i', Math.min(ix, 20));
    }

    g.append(b);
  });

  renderAddCells();

  // Render Sub-category Chips
  const t = $('types');
  t.textContent = '';
  const currentCat = cats.find((k) => k.id === catFilter);
  t.style.display = currentCat ? '' : 'none';

  if (currentCat) {
    [{ id: '', name: 'All' }, ...currentCat.subs].forEach((x) => {
      const c = document.createElement('button');
      c.className = 'chip';
      c.textContent = x.name;
      c.setAttribute('aria-pressed', x.id === typeFilter);
      c.onclick = () => {
        typeFilter = x.id;
        render();
      };
      t.append(c);
    });
  }

  // Render Category Chips
  const st = $('stats');
  st.textContent = '';
  cats.forEach((k) => {
    const c = document.createElement('button');
    c.className = 'chip';
    c.textContent = `${k.name} ${items.filter((i) => i.status === k.id).length}`;
    c.setAttribute('aria-pressed', catFilter === k.id);
    c.onclick = () => {
      catFilter = catFilter === k.id ? '' : k.id;
      typeFilter = '';
      render();
    };
    st.append(c);
  });
}

// --- Tile Size Picker ---
function buildSizePicker(host, onPick, start = '1x1') {
  host.textContent = '';
  let current = start;

  const grid = document.createElement('div');
  grid.className = 'sizegrid';
  grid.style.gridTemplateColumns = `repeat(${MAX_COLS}, 1fr)`;

  const cells = [];

  // How many columns/rows a size covers inside the picker (adaptive sizes fill it)
  const dims = (key) => {
    if (!key) return { c: 0, r: 0 };
    const z = sizeOf(key);
    return {
      c: z.c === 'all' ? MAX_COLS : Math.min(z.c, MAX_COLS),
      r: z.r === 'page' ? MAX_ROWS : Math.min(z.r, MAX_ROWS)
    };
  };

  // Chosen size: solid squares
  const paintChosen = () => {
    const d = dims(current);
    cells.forEach((el) => el.classList.toggle('sel', +el.dataset.c <= d.c && +el.dataset.r <= d.r));
  };

  // Hover preview: lighter squares from the top-left corner to the pointer
  const paintPreview = (c, r) => {
    cells.forEach((el) => el.classList.toggle('on', c > 0 && +el.dataset.c <= c && +el.dataset.r <= r));
  };

  const pick = (key) => {
    current = key;
    paintChosen();
    paintPreview(0, 0);
    // Quick pulse on the chosen squares so the click is visible
    const chosen = cells.filter((el) => el.classList.contains('sel'));
    chosen.forEach((el) => el.classList.add('pop'));
    setTimeout(() => chosen.forEach((el) => el.classList.remove('pop')), 300);
    onPick(key);
  };

  for (let r = 1; r <= MAX_ROWS; r++) {
    for (let c = 1; c <= MAX_COLS; c++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sizecell';
      b.dataset.c = c;
      b.dataset.r = r;
      b.setAttribute('aria-label', `${c} columns by ${r} rows`);
      const open = () => !b.classList.contains('locked'); // locked = would not fit
      b.onmouseenter = () => (open() ? paintPreview(c, r) : paintPreview(0, 0));
      b.onfocus = () => (open() ? paintPreview(c, r) : paintPreview(0, 0));
      b.onclick = () => open() && pick(`${c}x${r}`);
      cells.push(b);
      grid.append(b);
    }
  }
  grid.onmouseleave = () => paintPreview(0, 0);
  grid.addEventListener('focusout', () => paintPreview(0, 0));

  host.append(grid);
  paintChosen();

  return {
    set(key) {
      current = key || '';
      paintChosen();
      paintPreview(0, 0);
    },
    // fits(columns, rows) -> boolean. Sizes that don't fit are greyed out and can't be picked.
    lock(fits) {
      cells.forEach((el) => {
        const locked = !!fits && !fits(+el.dataset.c, +el.dataset.r);
        el.classList.toggle('locked', locked);
        el.setAttribute('aria-disabled', locked);
        el.tabIndex = locked ? -1 : 0;
        el.title = locked ? "Doesn't fit here" : '';
      });
    }
  };
}

const tilePicker = buildSizePicker($('tsizepick'), (key) => {
  $('tsize').value = key;
  paintCover(); // the cover preview follows the tile's shape
});

// Lock every size that would run off the grid or overlap another tile when the tile's
// top-left corner stays where it is (new tile: the clicked "+" cell).
function lockSizesForSpot(tile) {
  if ((!tile && !addAnchor) || $('sort').value !== 'custom') return tilePicker.lock(null);
  const { pos, occ } = computeLayout(items.filter(inView));
  let at = addAnchor;
  if (tile) {
    at = pos.get(tile.id);
    if (!at) return tilePicker.lock(null);
    const f = fp(tile);
    unmark(occ, at[0], at[1], f.w, f.h); // the tile's own cells don't count
  }
  tilePicker.lock((c, r) => freeAt(occ, at[0], at[1], c, r));
}

function setTileSize(key) {
  $('tsize').value = key;
  tilePicker.set(key);
}

// --- Select Menus & Modal Helpers ---
function fill(selEl, opts) {
  selEl.innerHTML = '';
  opts.forEach(([v, l]) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = l;
    selEl.append(o);
  });
}

function subOpts(selectedVal) {
  fill($('type'), [
    ['', 'None'],
    ...((cats.find((c) => c.id === $('status').value) || { subs: [] }).subs.map((s) => [s.id, s.name]))
  ]);
  $('type').value = selectedVal || '';
}

function catOpts() {
  fill($('status'), [['', 'No category'], ...cats.map((c) => [c.id, c.name])]);
  subOpts();
}
catOpts();

function setCover(c, keepFrame = false) {
  cover = c;
  if (!keepFrame) frame = { z: 1, x: 50, y: 50, ar: null, nx: frame.nx, ny: frame.ny, ns: frame.ns }; // a new picture starts unzoomed
  $('covermsg').textContent = '';

  if (c && !frame.ar) {
    const im = new Image();
    im.onload = () => {
      if (cover !== c) return; // the cover changed again meanwhile
      frame.ar = +(im.naturalWidth / im.naturalHeight).toFixed(4);
      paintCover();
    };
    im.src = c;
  }
  paintCover();
}

// Basic image tile: hide the fields it doesn't use (the title stays)
function syncBasic() {
  const on = $('basic').checked;
  $('f').classList.toggle('is-basic', on);
  paintCover();
}
$('basic').onchange = syncBasic;

function openDlg(i, anchor = null) {
  editing = i;
  addAnchor = i ? null : anchor;
  const d = i || {
    title: '',
    type: typeFilter, // new tiles start in the category you are looking at
    status: catFilter,
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
  frame = frameOf(d);
  setCover(d.cover, true);

  $('del').style.display = i ? '' : 'none';
  $('del').textContent = 'Delete';
  $('del').dataset.armed = '';
  $('dlg').showModal();
  paintCover(); // sizes can only be measured once the dialog is on screen
  $('title').focus();
}

// --- Cover Editor (zoom, pan, name position) ---
// A cover can be zoomed and moved inside its tile. Basic image tiles can also place their name anywhere.
function frameOf(d) {
  return {
    z: d.coverZ || 1,
    x: d.coverX ?? 50,
    y: d.coverY ?? 50,
    ar: d.coverAR || null,
    nx: d.nameX ?? null,
    ny: d.nameY ?? null,
    ns: d.nameS || 1
  };
}

// Zoom 1 behaves like "cover"; higher zooms scale from there. x/y work like background-position (0-100%).
function artStyle(el, src, f) {
  el.style.backgroundImage = src ? `url(${src})` : '';
  el.style.backgroundRepeat = 'no-repeat';
  el.style.backgroundSize = f.ar ? `calc(max(100cqw, 100cqh * ${f.ar}) * ${f.z}) auto` : 'cover';
  el.style.backgroundPosition = `${f.x}% ${f.y}%`;
}

// Name position as % of the tile; 0% = flush to that edge, 100% = flush to the opposite edge
function placeName(el, nx, ny) {
  if (nx == null || ny == null) {
    ['left', 'top', 'right', 'bottom', 'width', 'maxWidth', 'transform'].forEach((k) => (el.style[k] = ''));
    return;
  }
  Object.assign(el.style, {
    left: `${nx}%`,
    top: `${ny}%`,
    right: 'auto',
    bottom: 'auto',
    width: 'max-content',
    maxWidth: '100%',
    transform: `translate(-${nx}%, -${ny}%)`
  });
}

// Covers saved before zooming existed: measure the picture once so it can be zoomed
const arPending = new Set();
function ensureAR(i, el) {
  if (!i.cover || i.coverAR || arPending.has(i.id)) return;
  arPending.add(i.id);
  const im = new Image();
  im.onload = () => {
    i.coverAR = +(im.naturalWidth / im.naturalHeight).toFixed(4);
    save();
    if (el.isConnected) artStyle(el, i.cover, frameOf(i));
  };
  im.src = i.cover;
}

// Width, height and text scale of a real tile at the size currently picked
function tileShape() {
  const z = sizeOf($('tsize').value);
  const cs = getComputedStyle($('grid'));
  const cols = cs.gridTemplateColumns.split(' ').filter(Boolean);
  const cw = parseFloat(cols[0]) || 190;
  const gap = parseFloat(cs.columnGap) || 22;
  const rh = parseFloat(cs.gridAutoRows) || 285;
  const c = z.c === 'all' ? cols.length || 1 : Math.min(z.c, cols.length || 1);
  const r = z.r === 'page' ? pageRows : z.r;
  return {
    w: c * cw + (c - 1) * gap,
    h: r * rh + (r - 1) * gap,
    ts: parseFloat(cs.getPropertyValue('--ts')) || 1 // the text scale every tile uses
  };
}

const MAX_TEXT = 10; // largest name size: 10x (the Text slider's 1000%)
const round1 = (v) => Math.round(v * 10) / 10;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function paintCover() {
  const has = !!cover;
  // The preview is a scaled copy of the real tile, so the name has the same size relative to the picture
  const t = tileShape();
  $('cv').style.aspectRatio = clamp(t.w / t.h, 0.5, 2.2);
  $('cv').style.setProperty('--pv', ((t.ts * $('cv').clientWidth) / t.w).toFixed(4));
  artStyle($('cvart'), cover, frame);
  $('cvart').style.cursor = has ? 'grab' : 'default';
  $('cvempty').hidden = has;
  $('czoom').disabled = !has;
  $('czoom').value = Math.round(frame.z * 100);

  // Name overlay: only for basic image tiles that have a picture
  const name = $('cvname');
  name.hidden = !(has && $('basic').checked && $('title').value.trim()); // no title, no text to place
  name.textContent = $('title').value;
  name.style.setProperty('--ns', frame.ns);
  placeName(name, frame.nx ?? 0, frame.ny ?? 100);
  $('textrow').hidden = name.hidden;
  $('ctext').value = Math.round(frame.ns * 100);
}

// How far the zoomed picture overhangs the preview box, in px
function coverOverhang() {
  const W = $('cv').clientWidth;
  const H = $('cv').clientHeight;
  const ar = frame.ar || W / H;
  const w = Math.max(W, H * ar) * frame.z;
  return { ox: w - W, oy: w / ar - H };
}

// Drag the picture to move it
let panDrag = null;
$('cvart').onpointerdown = (e) => {
  if (!cover) return;
  panDrag = { sx: e.clientX, sy: e.clientY, x0: frame.x, y0: frame.y, ...coverOverhang() };
  $('cvart').setPointerCapture(e.pointerId);
  $('cvart').style.cursor = 'grabbing';
};
$('cvart').onpointermove = (e) => {
  if (!panDrag) return;
  if (panDrag.ox > 0.5) frame.x = round1(clamp(panDrag.x0 - ((e.clientX - panDrag.sx) / panDrag.ox) * 100, 0, 100));
  if (panDrag.oy > 0.5) frame.y = round1(clamp(panDrag.y0 - ((e.clientY - panDrag.sy) / panDrag.oy) * 100, 0, 100));
  paintCover();
};
$('cvart').onpointerup = $('cvart').onpointercancel = () => {
  panDrag = null;
  paintCover();
};

// Drag the name to place it anywhere on the picture (basic image tiles)
let nameDrag = null;
$('cvname').onpointerdown = (e) => {
  const el = $('cvname');
  nameDrag = {
    sx: e.clientX,
    sy: e.clientY,
    x0: frame.nx ?? 0,
    y0: frame.ny ?? 100,
    rx: $('cv').clientWidth - el.offsetWidth,
    ry: $('cv').clientHeight - el.offsetHeight
  };
  el.setPointerCapture(e.pointerId);
};
$('cvname').onpointermove = (e) => {
  if (!nameDrag) return;
  frame.nx = round1(clamp(nameDrag.rx > 0.5 ? nameDrag.x0 + ((e.clientX - nameDrag.sx) / nameDrag.rx) * 100 : nameDrag.x0, 0, 100));
  frame.ny = round1(clamp(nameDrag.ry > 0.5 ? nameDrag.y0 + ((e.clientY - nameDrag.sy) / nameDrag.ry) * 100 : nameDrag.y0, 0, 100));
  paintCover();
};
$('cvname').onpointerup = $('cvname').onpointercancel = () => {
  nameDrag = null;
};

// Zoom: slider or mouse wheel over the picture
$('czoom').oninput = () => {
  frame.z = clamp(+$('czoom').value / 100, 1, 4);
  paintCover();
};
$('cv').addEventListener(
  'wheel',
  (e) => {
    if (!cover) return;
    e.preventDefault();
    frame.z = round1(clamp(frame.z * (e.deltaY < 0 ? 1.08 : 1 / 1.08), 1, 4) * 100) / 100;
    paintCover();
  },
  { passive: false }
);

// Text size: slider, or mouse wheel over the name itself
$('ctext').oninput = () => {
  frame.ns = clamp(+$('ctext').value / 100, 0.5, MAX_TEXT);
  paintCover();
};
$('cvname').addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    e.stopPropagation(); // don't also zoom the picture
    frame.ns = Math.round(clamp(frame.ns * (e.deltaY < 0 ? 1.08 : 1 / 1.08), 0.5, MAX_TEXT) * 100) / 100;
    paintCover();
  },
  { passive: false }
);

$('title').addEventListener('input', paintCover);

// --- Image & Cover Art Handling ---
function readCover(file) {
  if (!file || !file.type.startsWith('image/')) return;

  // GIFs are stored untouched so they keep animating (resizing would flatten them)
  if (file.type === 'image/gif') {
    if (file.size > MAX_GIF_BYTES) {
      $('covermsg').textContent = `That GIF is ${(file.size / 1048576).toFixed(1)} MB. GIF covers can be up to ${(MAX_GIF_BYTES / 1048576).toFixed(1)} MB.`;
      return;
    }
    const gr = new FileReader();
    gr.onload = () => setCover(gr.result);
    gr.readAsDataURL(file);
    return;
  }

  const r = new FileReader();
  r.onload = () => {
    const im = new Image();
    im.onload = () => {
      const sc = Math.min(1, 1000 / im.width);
      const c = document.createElement('canvas');
      c.width = im.width * sc;
      c.height = im.height * sc;
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      setCover(c.toDataURL('image/jpeg', 0.82));
    };
    im.src = r.result;
  };
  r.readAsDataURL(file);
}

function findLink() {
  const t = $('title').value.trim();
  $('gfind').href = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(t + ' cover art')}`;
}

$('title').addEventListener('input', findLink);
$('editbtn').onclick = () => setEdit(!editMode);
$('cancel').onclick = () => $('dlg').close();
$('pick').onclick = () => $('cf').click();
$('clr').onclick = () => setCover('');

$('dlg').addEventListener('paste', (e) => {
  const f = [...((e.clipboardData && e.clipboardData.files) || [])].find((x) => x.type.startsWith('image/'));
  if (f) {
    e.preventDefault();
    readCover(f);
  }
});

$('cv').addEventListener('dragover', (e) => e.preventDefault());
$('cv').addEventListener('drop', (e) => {
  e.preventDefault();
  readCover(e.dataTransfer.files[0]);
});

$('cf').onchange = (e) => {
  const f = e.target.files[0];
  if (!f) return;
  readCover(f);
  e.target.value = '';
};

// API Cover Art Search
const API = window.beastApi;
if (API) $('sfind').hidden = false;

$('sfind').onclick = () => {
  $('sq').value = $('title').value;
  $('sres').textContent = '';
  $('smsg').textContent = '';
  $('sdlg').showModal();
  if ($('sq').value) runSearch();
};
$('sclose').onclick = () => $('sdlg').close();
$('sgo').onclick = () => runSearch();
$('sq').onkeydown = (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    runSearch();
  }
};

async function runSearch() {
  const q = $('sq').value.trim();
  if (!q) return;
  $('smsg').textContent = 'Searching…';
  $('sres').textContent = '';

  try {
    const results = await API.search($('skind').value, q);
    $('smsg').textContent = results.length ? '' : 'No results. Try a shorter title or another media type.';
    results.forEach((x) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.title = x.title;
      b.style.cssText =
        'border: 0; padding: 0; background: var(--bg); border-radius: 8px; overflow: hidden; cursor: pointer; aspect-ratio: 2/3';

      const im = document.createElement('img');
      im.src = x.thumb;
      im.alt = x.title;
      im.style.cssText = 'width: 100%; height: 100%; object-fit: cover';
      im.onerror = () => b.remove();

      b.append(im);
      b.onclick = () => useCover(x);
      $('sres').append(b);
    });
  } catch (e) {
    $('smsg').textContent = 'Search failed. Check your internet connection.';
  }
}

async function useCover(x) {
  $('smsg').textContent = 'Saving cover…';
  try {
    const d = await API.image(x.full);

    // Keep GIFs animated
    if (d.startsWith('data:image/gif')) {
      if (d.length > MAX_GIF_BYTES * 1.37) {
        $('smsg').textContent = 'That GIF is too large to store. Try another.';
        return;
      }
      setCover(d);
      $('sdlg').close();
      return;
    }

    const im = new Image();
    im.onload = () => {
      const sc = Math.min(1, 1000 / im.width);
      const c = document.createElement('canvas');
      c.width = im.width * sc;
      c.height = im.height * sc;
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      setCover(c.toDataURL('image/jpeg', 0.85));
      $('sdlg').close();
    };
    im.src = d;
  } catch (e) {
    $('smsg').textContent = 'Couldn’t download that image. Try another.';
  }
}

// Form Submission & Deletion
$('f').onsubmit = (e) => {
  e.preventDefault();
  const d = {
    title: $('title').value.trim(),
    basic: $('basic').checked,
    type: $('type').value,
    status: $('status').value,
    rating: +$('rating').value,
    color: $('color').value,
    prog: Math.max(0, Math.min(100, +$('prog').value || 0)),
    pnote: $('pnote').value,
    desc: $('desc').value,
    size: $('tsize').value,
    u: Date.now(),
    cover,
    coverZ: frame.z,
    coverX: frame.x,
    coverY: frame.y,
    coverAR: frame.ar,
    nameX: frame.nx,
    nameY: frame.ny,
    nameS: frame.ns
  };

  if (editing) {
    Object.assign(editing, d);
  } else {
    const id = Date.now();
    if (addAnchor) {
      // Pin every current tile first so adding one can't shuffle the others
      const key = viewKey();
      const L = layouts[key] || (layouts[key] = {});
      computeLayout(items.filter(inView)).pos.forEach((p, k) => {
        L[k] = p;
      });
      L[id] = addAnchor;
      saveLayouts();
    }
    items.push({ id, t: id, ...d });
  }

  save();
  render();
  $('dlg').close();
};

$('del').onclick = () => {
  const b = $('del');
  if (!editing) return;
  if (!b.dataset.armed) {
    b.dataset.armed = '1';
    b.textContent = 'Click again to delete';
    setTimeout(() => {
      b.dataset.armed = '';
      b.textContent = 'Delete';
    }, 3000);
    return;
  }
  items = items.filter((i) => i !== editing);
  save();
  render();
  $('dlg').close();
};

// --- Toolbar & Filter Actions ---
$('q').oninput = render;
// Remember the chosen sort option between sessions
function saveSort() {
  try {
    localStorage.setItem(SORTKEY, $('sort').value);
  } catch (e) {}
}

function restoreSort() {
  try {
    const s = localStorage.getItem(SORTKEY);
    if (s && [...$('sort').options].some((o) => o.value === s)) $('sort').value = s;
  } catch (e) {}
}

restoreSort();
$('sort').onchange = () => {
  saveSort();
  render();
};
$('status').onchange = () => subOpts();

$('theme').onclick = () => {
  const r = document.documentElement;
  const dark = matchMedia('(prefers-color-scheme:dark)').matches;
  const cur = r.dataset.theme || (dark ? 'dark' : 'light');
  r.dataset.theme = cur === 'dark' ? 'light' : 'dark';
};

$('exp').onclick = async () => {
  const backgrounds = await exportBackgrounds();
  const data = { items, cats, order: customOrder, layout: layouts, backgrounds };
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
        items = arr;
        if (d.cats) {
          cats = d.cats;
          cats.forEach((k) => (k.subs = k.subs || []));
          saveCats();
          catOpts();
        }
        if (d.order) {
          customOrder = d.order;
          saveOrder();
        }
        if (d.layout) {
          layouts = d.layout;
          saveLayouts();
        }
        if (Array.isArray(d.backgrounds)) await importBackgrounds(d.backgrounds);
        save();
        render();
      }
    } catch (x) {
      alert('That file isn’t a valid Beast Media Tracker backup.');
    }
  });
};

// --- Category Manager ---
function catsChanged() {
  saveCats();
  catOpts();
  if (selMode) selOpts();
  render();
}

function renderCats() {
  const l = $('clist');
  l.textContent = '';

  cats.forEach((k) => {
    const r = document.createElement('div');
    r.style.cssText = 'display:flex;gap:8px';

    const i = document.createElement('input');
    i.value = k.name;
    i.maxLength = 30;
    i.style.flex = '1';
    i.setAttribute('aria-label', 'Category name');
    i.onchange = () => {
      k.name = i.value.trim() || k.name;
      i.value = k.name;
      catsChanged();
    };

    const d = document.createElement('button');
    d.className = 'btn danger';
    d.textContent = 'Delete';
    d.onclick = () => {
      items.forEach((x) => {
        if (x.status === k.id) x.status = '';
      });
      cats = cats.filter((c) => c !== k);
      if (catFilter === k.id) catFilter = '';
      save();
      catsChanged();
      renderCats();
    };

    r.append(i, d);
    l.append(r);

    const sb = document.createElement('div');
    sb.style.cssText = 'display:grid;gap:6px;margin:0 0 8px 18px';

    k.subs.forEach((s) => {
      const sr = document.createElement('div');
      sr.style.cssText = 'display:flex;gap:6px';

      const si = document.createElement('input');
      si.value = s.name;
      si.maxLength = 30;
      si.style.flex = '1';
      si.setAttribute('aria-label', 'Sub-category name');
      si.onchange = () => {
        s.name = si.value.trim() || s.name;
        si.value = s.name;
        catsChanged();
      };

      const sd = document.createElement('button');
      sd.className = 'btn danger';
      sd.textContent = 'Remove';
      sd.onclick = () => {
        items.forEach((x) => {
          if (x.status === k.id && x.type === s.id) x.type = '';
        });
        k.subs = k.subs.filter((y) => y !== s);
        if (typeFilter === s.id) typeFilter = '';
        save();
        catsChanged();
        renderCats();
      };

      sr.append(si, sd);
      sb.append(sr);
    });

    const ar = document.createElement('div');
    ar.style.cssText = 'display:flex;gap:6px';

    const ai = document.createElement('input');
    ai.placeholder = 'Add a sub-category (e.g. Movies)';
    ai.maxLength = 30;
    ai.style.flex = '1';
    ai.setAttribute('aria-label', 'New sub-category');

    const addSub = () => {
      const v = ai.value.trim();
      if (!v) return;
      k.subs.push({ id: `s${Date.now()}`, name: v });
      catsChanged();
      renderCats();
    };

    ai.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addSub();
      }
    };

    const ab = document.createElement('button');
    ab.className = 'btn';
    ab.textContent = 'Add';
    ab.onclick = addSub;

    ar.append(ai, ab);
    sb.append(ar);
    l.append(sb);
  });

  if (!cats.length) {
    const p = document.createElement('div');
    p.style.color = 'var(--mute)';
    p.textContent = 'No categories yet. Add your first one below.';
    l.append(p);
  }
}

function addCat() {
  const v = $('cnew').value.trim();
  if (!v) return;
  cats.push({ id: `c${Date.now()}`, name: v, subs: [] });
  $('cnew').value = '';
  catsChanged();
  renderCats();
}

$('catbtn').onclick = () => {
  renderCats();
  $('cdlg').showModal();
  $('cnew').focus();
};
$('cadd').onclick = addCat;
$('cnew').onkeydown = (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addCat();
  }
};
$('cdone').onclick = () => $('cdlg').close();

// --- Bulk Selection Mode ---
function selSub() {
  const k = cats.find((c) => c.id === $('selcat').value);
  fill($('selsub'), [['', 'No sub-category'], ...(k ? k.subs.map((s) => [s.id, s.name]) : [])]);
  $('selsub').hidden = !k;
}

function selOpts() {
  fill($('selcat'), [['__', 'Move to…'], ['', 'No category'], ...cats.map((c) => [c.id, c.name])]);
  selSub();
  $('selmove').disabled = true;
}

function updateBar() {
  $('selbar').hidden = !selMode;
  document.body.classList.toggle('selecting', selMode);
  $('selcount').textContent = `${sel.size} selected`;
  $('selbtn').textContent = selMode ? 'Selecting' : 'Select';
  $('selsizebtn').disabled = !sel.size;
  if (!selMode || !sel.size) closeSizePop();
}

function setMode(on) {
  if (on && editMode) setEdit(false);
  selMode = on;
  sel.clear();
  if (on) selOpts();
  updateBar();
  render();
}

function toggle(id) {
  sel.has(id) ? sel.delete(id) : sel.add(id);
  updateBar();
  render();
}

$('selbtn').onclick = () => setMode(!selMode);
$('seldone').onclick = () => setMode(false);
$('selall').onclick = () => {
  const all = visibleIds.every((id) => sel.has(id));
  visibleIds.forEach((id) => (all ? sel.delete(id) : sel.add(id)));
  updateBar();
  render();
};

$('selcat').onchange = () => {
  selSub();
  $('selmove').disabled = $('selcat').value === '__';
};

$('selmove').onclick = () => {
  if (!sel.size || $('selcat').value === '__') return;
  items.forEach((i) => {
    if (sel.has(i.id)) {
      i.status = $('selcat').value;
      i.type = $('selsub').value;
    }
  });
  sel.clear();
  save();
  updateBar();
  render();
};

function closeSizePop() {
  $('selsizepop').hidden = true;
  $('selsizebtn').setAttribute('aria-expanded', 'false');
}

const bulkPicker = buildSizePicker(
  $('selsizepick'),
  (key) => {
    if (!sel.size) return;
    items.forEach((i) => {
      if (sel.has(i.id)) i.size = key;
    });
    save();
    closeSizePop();
    bulkPicker.set('');
    render();
  },
  ''
);

$('selsizebtn').onclick = (e) => {
  e.stopPropagation();
  const open = $('selsizepop').hidden;
  $('selsizepop').hidden = !open;
  $('selsizebtn').setAttribute('aria-expanded', open);
};

document.addEventListener('click', (e) => {
  if (!e.target.closest('.popwrap')) closeSizePop();
});

$('seldel').onclick = () => {
  const b = $('seldel');
  if (!sel.size) return;
  if (!b.dataset.armed) {
    b.dataset.armed = '1';
    b.textContent = `Click again to delete ${sel.size}`;
    setTimeout(() => {
      b.dataset.armed = '';
      b.textContent = 'Delete';
    }, 3000);
    return;
  }
  items = items.filter((i) => !sel.has(i.id));
  sel.clear();
  b.dataset.armed = '';
  b.textContent = 'Delete';
  save();
  updateBar();
  render();
};

// --- Test Tiles Utility ---
function testBtn() {
  $('testbtn').textContent = items.some((i) => i.test) ? 'Remove test tiles' : 'Add test tiles';
}

$('testbtn').onclick = () => {
  if (items.some((i) => i.test)) {
    items = items.filter((i) => !i.test);
  } else {
    const now = Date.now();
    const grays = ['#6b6b6b', '#7a7a7a', '#8a8a8a', '#9a9a9a', '#5e5e5e', '#b0b0b0'];
    for (let n = 1; n <= 60; n++) {
      items.push({
        id: now + n,
        t: now + n,
        title: `Test tile ${n}`,
        type: catFilter ? typeFilter : '',
        status: catFilter,
        rating: 0,
        prog: 0,
        pnote: '',
        color: grays[n % 6],
        desc: '',
        cover: '',
        size: '1x1',
        test: true
      });
    }
  }
  save();
  testBtn();
  render();
};
testBtn();

// --- Custom Backgrounds ---
// Several backgrounds can be stacked down the shelf. Each covers a Top row to a Bottom row of the
// tile grid. Scrolling crossfades slowly from one background to the next.
let bgs = loadBgs();
const bgUrls = {}; // background id -> object URL of its image
let bgTarget = null; // id being replaced, or null when adding a new one
let bgSyncs = []; // functions that refresh each card in the panel

function loadBgs() {
  try {
    const l = JSON.parse(localStorage.getItem(BGS_KEY));
    if (Array.isArray(l)) return l;
  } catch (e) {}
  return null; // null = first run with multiple backgrounds
}

function saveBgs() {
  try {
    localStorage.setItem(BGS_KEY, JSON.stringify(bgs));
  } catch (e) {}
}

// The images live in IndexedDB (localStorage is too small for backgrounds and GIFs)
function idbRun(mode, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('beast-media', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('files');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('files', mode);
      const req = fn(tx.objectStore('files'));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
    };
  });
}

const idbGet = (key) => idbRun('readonly', (s) => s.get(key));
const idbSet = (key, val) => idbRun('readwrite', (s) => s.put(val, key));
const idbDel = (key) => idbRun('readwrite', (s) => s.delete(key));
const bgKey = (id) => (id === 'legacy' ? 'bg' : `bg:${id}`);

// --- Grid rows -> page positions ---
function gridMetrics() {
  const g = $('grid');
  const cs = getComputedStyle(g);
  const rh = parseFloat(cs.gridAutoRows) || 300;
  const gap = parseFloat(cs.rowGap) || 22;
  const padT = parseFloat(cs.paddingTop) || 0;
  const padB = parseFloat(cs.paddingBottom) || 0;
  const top = g.getBoundingClientRect().top + scrollY + padT; // page position of row 1
  const rows = Math.max(1, Math.round((g.clientHeight - padT - padB + gap) / (rh + gap)));
  return { top, rh, pitch: rh + gap, rows };
}

const rowTopY = (m, r) => m.top + (r - 1) * m.pitch;
const rowBottomY = (m, r) => rowTopY(m, r) + m.rh;

// The row in the middle of the screen: the reference point for every transition
function viewRow(m) {
  const y = scrollY + innerHeight / 2;
  return Math.min(m.rows, Math.max(1, Math.floor((y - m.top) / m.pitch) + 1));
}

// --- Slow, eased crossfade ---
const smooth = (t) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x); // smoothstep: gentle start and finish
};

// Two backgrounds blend over at least one screen height, centred between them
function blendZone(a, b) {
  const gap = b.top - a.bottom;
  const c = (a.bottom + b.top) / 2;
  const h = Math.max(gap / 2, innerHeight / 2);
  return [c - h, c + h];
}

function bgWeights(m) {
  const y = scrollY + innerHeight / 2;
  const edge = innerHeight / 4; // outer edges fade to the plain page more quickly
  const sorted = bgs
    .map((bg) => ({ bg, top: rowTopY(m, bg.topRow), bottom: rowBottomY(m, bg.bottomRow) }))
    .sort((a, b) => a.top - b.top);
  const weights = new Map();
  sorted.forEach((s, i) => {
    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    const [a0, a1] = prev ? blendZone(prev, s) : [s.top - edge, s.top + edge];
    const [b0, b1] = next ? blendZone(s, next) : [s.bottom - edge, s.bottom + edge];
    weights.set(s.bg, Math.min(smooth((y - a0) / (a1 - a0)), 1 - smooth((y - b0) / (b1 - b0))));
  });
  return weights;
}

function layerFor(bg) {
  let el = $('bgstack').querySelector(`[data-id="${bg.id}"]`);
  if (!el) {
    el = document.createElement('div');
    el.className = 'bglayer';
    el.dataset.id = bg.id;
    $('bgstack').append(el);
  }
  return el;
}

function updateBackgrounds() {
  const m = gridMetrics();
  const weights = bgWeights(m);
  let total = 0;
  bgs.forEach((bg) => {
    const el = layerFor(bg);
    const w = weights.get(bg) || 0;
    if (w <= 0.001) {
      el.dataset.off = '1';
      el.style.opacity = '0';
      return;
    }
    delete el.dataset.off;
    total += w;
    el.style.opacity = (w / total).toFixed(3); // weighted blend of the layers underneath
  });
  $('bgstack').style.opacity = Math.min(1, total).toFixed(3);
  $('bgpos').textContent = viewRow(m);
}

let bgRaf = 0;
function scheduleBgUpdate() {
  if (bgRaf) return;
  bgRaf = requestAnimationFrame(() => {
    bgRaf = 0;
    updateBackgrounds();
  });
}

function applyLayerStyle(bg) {
  const el = layerFor(bg);
  el.style.backgroundImage = bgUrls[bg.id] ? `url("${bgUrls[bg.id]}")` : '';
  el.style.filter = `blur(${bg.blur}px) brightness(${bg.bright}%) saturate(${bg.sat}%)`;
}

function syncLayers() {
  [...$('bgstack').children].forEach((el) => {
    if (!bgs.some((b) => b.id === el.dataset.id)) el.remove();
  });
  bgs.forEach(applyLayerStyle);
  document.body.classList.toggle('has-bg', bgs.length > 0);
  updateBackgrounds();
}

// --- Panel ---
function bgSlider(bg, key, label, min, max, unit) {
  const wrap = document.createElement('label');
  const row = document.createElement('span');
  row.className = 'bgl';
  const name = document.createElement('span');
  name.textContent = label;
  const val = document.createElement('b');
  row.append(name, val);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = min;
  input.max = max;
  input.step = 1;
  input.oninput = () => {
    bg[key] = +input.value;
    saveBgs();
    applyLayerStyle(bg);
    bgSyncs.forEach((fn) => fn());
  };

  wrap.append(row, input);
  const sync = () => {
    input.value = bg[key];
    val.textContent = `${bg[key]}${unit}`;
  };
  return { el: wrap, sync };
}

// Top / Bottom row picker (a number, plus "Here" for the row in the middle of the screen)
function bgRowField(bg, key, label) {
  const wrap = document.createElement('label');
  const name = document.createElement('span');
  name.className = 'bgl';
  name.textContent = label;

  const box = document.createElement('div');
  box.className = 'bgrange';
  const input = document.createElement('input');
  input.type = 'number';
  input.min = 1;
  input.step = 1;
  const here = document.createElement('button');
  here.type = 'button';
  here.className = 'btn';
  here.textContent = 'Here';
  here.title = 'Use the row in the middle of the screen';
  box.append(input, here);

  const set = (v) => {
    const rows = gridMetrics().rows;
    bg[key] = Math.min(rows, Math.max(1, Math.round(v)));
    // Top can't pass Bottom
    if (key === 'topRow' && bg.topRow > bg.bottomRow) bg.bottomRow = bg.topRow;
    if (key === 'bottomRow' && bg.bottomRow < bg.topRow) bg.topRow = bg.bottomRow;
    saveBgs();
    updateBackgrounds();
    bgSyncs.forEach((fn) => fn());
  };
  input.oninput = () => {
    if (input.value !== '' && !Number.isNaN(+input.value)) set(+input.value);
  };
  here.onclick = (e) => {
    e.preventDefault();
    set(viewRow(gridMetrics()));
  };

  wrap.append(name, box);
  const sync = () => {
    input.max = gridMetrics().rows;
    if (document.activeElement !== input) input.value = bg[key];
  };
  return { el: wrap, sync };
}

function renderBgPanel() {
  const list = $('bglist');
  list.textContent = '';
  bgSyncs = [];

  if (!bgs.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'No backgrounds yet. Add one below.';
    list.append(p);
    return;
  }

  bgs.forEach((bg, n) => {
    const card = document.createElement('div');
    card.className = 'bgcard';

    const head = document.createElement('div');
    head.className = 'bghead';
    const thumb = document.createElement('div');
    thumb.className = 'bgthumb';
    thumb.style.backgroundImage = bgUrls[bg.id] ? `url("${bgUrls[bg.id]}")` : '';
    const title = document.createElement('strong');
    title.textContent = `Background ${n + 1}`;
    const swap = document.createElement('button');
    swap.type = 'button';
    swap.className = 'btn';
    swap.textContent = 'Replace';
    swap.onclick = () => pickBg(bg.id);
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn danger';
    del.textContent = 'Remove';
    del.onclick = () => removeBg(bg);
    head.append(thumb, title, swap, del);

    const top = bgRowField(bg, 'topRow', 'Top row');
    const bottom = bgRowField(bg, 'bottomRow', 'Bottom row');

    const fx = document.createElement('details');
    const sum = document.createElement('summary');
    sum.textContent = 'Effects';
    const blur = bgSlider(bg, 'blur', 'Blur', 0, 40, 'px');
    const bright = bgSlider(bg, 'bright', 'Brightness', 20, 150, '%');
    const sat = bgSlider(bg, 'sat', 'Saturation', 0, 200, '%');
    fx.append(sum, blur.el, bright.el, sat.el);

    card.append(head, top.el, bottom.el, fx);
    list.append(card);

    [top, bottom, blur, bright, sat].forEach((s) => {
      s.sync();
      bgSyncs.push(s.sync);
    });
  });
}

// --- Adding, replacing, removing ---
function pickBg(id) {
  bgTarget = id;
  $('bgfile').click();
}

// New backgrounds start where the last one ends (or split it in half if it already runs to the bottom)
function newBg(id) {
  const rows = gridMetrics().rows;
  if (!bgs.length) return { id, topRow: 1, bottomRow: rows, ...BG_DEFAULTS };
  const tail = [...bgs].sort((a, b) => b.bottomRow - a.bottomRow)[0];
  if (tail.bottomRow >= rows && tail.bottomRow > tail.topRow) {
    tail.bottomRow = Math.floor((tail.topRow + tail.bottomRow) / 2);
  }
  return { id, topRow: Math.min(rows, tail.bottomRow + 1), bottomRow: rows, ...BG_DEFAULTS };
}

// Backgrounds saved with percentages (earlier version) are converted to rows
function migrateBgRows() {
  const rows = gridMetrics().rows;
  let changed = false;
  bgs.forEach((bg) => {
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

$('bgfile').onchange = async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f || !f.type.startsWith('image/')) return;

  const id = bgTarget || `b${Date.now()}`;
  try {
    await idbSet(bgKey(id), f); // stored untouched, so GIFs keep animating
  } catch (err) {
    $('bgmsg').textContent = 'Couldn’t save that image. Try a smaller one.';
    return;
  }
  if (bgUrls[id]) URL.revokeObjectURL(bgUrls[id]);
  bgUrls[id] = URL.createObjectURL(f);
  if (!bgTarget) bgs.push(newBg(id));

  $('bgmsg').textContent = '';
  saveBgs();
  syncLayers();
  renderBgPanel();
};

async function removeBg(bg) {
  try {
    await idbDel(bgKey(bg.id));
  } catch (e) {}
  if (bgUrls[bg.id]) URL.revokeObjectURL(bgUrls[bg.id]);
  delete bgUrls[bg.id];
  bgs = bgs.filter((b) => b !== bg);
  saveBgs();
  syncLayers();
  renderBgPanel();
}

// --- Backgrounds in Export / Import ---
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function dataUrlToBlob(url) {
  const [head, body] = url.split(',');
  const type = (head.match(/data:([^;]+)/) || [])[1] || 'image/png';
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let n = 0; n < bin.length; n++) bytes[n] = bin.charCodeAt(n);
  return new Blob([bytes], { type });
}

// Each background's settings plus its image (as a data URL)
async function exportBackgrounds() {
  const out = [];
  for (const bg of bgs || []) {
    try {
      const blob = await idbGet(bgKey(bg.id));
      out.push({ ...bg, image: blob ? await blobToDataUrl(blob) : null });
    } catch (e) {
      out.push({ ...bg, image: null });
    }
  }
  return out;
}

// Replaces the current backgrounds with the ones in the backup
async function importBackgrounds(list) {
  for (const bg of bgs || []) {
    try {
      await idbDel(bgKey(bg.id));
    } catch (e) {}
    if (bgUrls[bg.id]) URL.revokeObjectURL(bgUrls[bg.id]);
    delete bgUrls[bg.id];
  }

  bgs = [];
  for (const entry of list) {
    const { image, ...bg } = entry;
    if (!bg.id) continue;
    if (image) {
      try {
        const blob = dataUrlToBlob(image);
        await idbSet(bgKey(bg.id), blob);
        bgUrls[bg.id] = URL.createObjectURL(blob);
      } catch (e) {}
    }
    bgs.push({ ...BG_DEFAULTS, ...bg });
  }

  migrateBgRows();
  saveBgs();
  syncLayers();
  renderBgPanel();
}

// --- Loading & wiring ---
async function loadBackgrounds() {
  if (bgs === null) {
    // First run with multiple backgrounds: bring over the single background from before
    bgs = [];
    try {
      if (await idbGet('bg')) {
        let fx = {};
        try {
          fx = JSON.parse(localStorage.getItem(BGKEY)) || {};
        } catch (e) {}
        bgs.push({ id: 'legacy', top: 0, bottom: 100, ...BG_DEFAULTS, ...fx });
      }
    } catch (e) {}
    saveBgs();
  }
  for (const bg of bgs) {
    try {
      const blob = await idbGet(bgKey(bg.id));
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
  bgSyncs.forEach((fn) => fn()); // the number of rows may have changed
};
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

// --- Header & Drawer Behavior ---
function menu(open) {
  $('tray').classList.toggle('open', open);
  $('burger').setAttribute('aria-expanded', open);
}

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

let lastY = scrollY;
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

// --- Responsive Observers & Init ---
let lastM = '';
new ResizeObserver(() => {
  const k = measure();
  if (k !== lastM && !document.body.classList.contains('dragging')) {
    lastM = k;
    render();
  }
}).observe($('grid'));

render();