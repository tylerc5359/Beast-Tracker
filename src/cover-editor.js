// Cover editor in the dialog: zoom, pan, name position and size.
import { $ } from './dom.js';
import { save } from './storage.js';
import { sizeOf } from './helpers.js';
import { aspectOf, clamp, dataUrlToBlob, round1 } from './utils.js';
import { MAX_TEXT } from './config.js';
import { state } from './state.js';
import { roundClipFor } from './shape.js';

export function setCover(c, keepFrame = false) {
  state.cover = c;
  if (!keepFrame) state.frame = { z: 1, x: 50, y: 50, ar: null, nx: state.frame.nx, ny: state.frame.ny, ns: state.frame.ns }; // a new picture starts unzoomed
  $('covermsg').textContent = '';

  if (c && !state.frame.ar) {
    const im = new Image();
    im.onload = () => {
      if (state.cover !== c) return; // the cover changed again meanwhile
      state.frame.ar = aspectOf(im);
      paintCover();
    };
    im.src = c;
  }
  paintCover();
}

// A cover can be zoomed and moved inside its tile. Basic image tiles can also place their name anywhere.
export function frameOf(d) {
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
// Covers are saved as data URLs (long text). Putting that text in every tile's style makes the browser
// re-read it on each layout and style change, which gets slow with big covers, so each tile uses a short
// blob: link to the same picture instead (made once per cover).
const shownUrls = new Map();

function shortUrl(src) {
  if (!src.startsWith('data:')) return src;
  if (!shownUrls.has(src)) {
    try {
      shownUrls.set(src, URL.createObjectURL(dataUrlToBlob(src)));
    } catch (e) {
      return src; // not base64 or damaged: show it the long way
    }
  }
  return shownUrls.get(src);
}

export function artStyle(el, src, f) {
  el.style.backgroundImage = src ? `url(${shortUrl(src)})` : '';
  el.style.backgroundRepeat = 'no-repeat';
  el.style.backgroundSize = f.ar ? `calc(max(100cqw, 100cqh * ${f.ar}) * ${f.z}) auto` : 'cover';
  el.style.backgroundPosition = `${f.x}% ${f.y}%`;
}

// Name position as % of the tile; 0% = flush to that edge, 100% = flush to the opposite edge
export function placeName(el, nx, ny) {
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

export function ensureAR(i, el) {
  if (!i.cover || i.coverAR || arPending.has(i.id)) return;
  arPending.add(i.id);
  const im = new Image();
  im.onload = () => {
    i.coverAR = aspectOf(im);
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
  const r = z.r === 'page' ? state.pageRows : z.r;
  const cells = z.cells && z.cells.filter(([x]) => x < c);
  return {
    w: c * cw + (c - 1) * gap,
    h: r * rh + (r - 1) * gap,
    c,
    r,
    gap,
    cells: cells && cells.length && cells.length < c * r ? cells : null, // custom shape squares
    ts: parseFloat(cs.getPropertyValue('--ts')) || 1 // the text scale every tile uses
  };
}

export function paintCover() {
  const has = !!state.cover;
  // The preview is a scaled copy of the real tile, so the name has the same size relative to the picture
  const t = tileShape();
  $('cv').style.aspectRatio = clamp(t.w / t.h, 0.5, 2.2);
  $('cv').style.setProperty('--pv', ((t.ts * $('cv').clientWidth) / t.w).toFixed(4));
  // Custom shape: cut the preview the same way (the gap scaled down like everything else)
  const cv = $('cv');
  const k = cv.offsetWidth / t.w;
  cv.style.clipPath =
    t.cells && cv.offsetWidth
      ? roundClipFor(t.cells, t.c, t.r, cv.offsetWidth, cv.offsetHeight, t.gap * k, t.gap * k, parseFloat(getComputedStyle(cv).borderTopLeftRadius) || 0)
      : '';
  artStyle($('cvart'), state.cover, state.frame);
  $('cvart').style.cursor = has ? 'grab' : 'default';
  $('cvempty').hidden = has;
  $('czoom').disabled = !has;
  $('czoom').value = Math.round(state.frame.z * 100);

  // Name overlay: only for basic image tiles that have a picture
  const name = $('cvname');
  name.hidden = !(has && $('basic').checked && $('title').value.trim()); // no title, no text to place
  name.textContent = $('title').value;
  name.style.setProperty('--ns', state.frame.ns);
  placeName(name, state.frame.nx ?? 0, state.frame.ny ?? 100);
  $('textrow').hidden = name.hidden;
  $('ctext').value = Math.round(state.frame.ns * 100);
}

// How far the zoomed picture overhangs the preview box, in px
function coverOverhang() {
  const W = $('cv').clientWidth;
  const H = $('cv').clientHeight;
  const ar = state.frame.ar || W / H;
  const w = Math.max(W, H * ar) * state.frame.z;
  return { ox: w - W, oy: w / ar - H };
}

// Drag the picture to move it
let panDrag = null;

// Drag the name to place it anywhere on the picture (basic image tiles)
let nameDrag = null;

// Connects this module's buttons and events to the page (called once at start-up)
export function initCoverEditor() {
  $('cvart').onpointerdown = (e) => {
    if (!state.cover) return;
    panDrag = { sx: e.clientX, sy: e.clientY, x0: state.frame.x, y0: state.frame.y, ...coverOverhang() };
    $('cvart').setPointerCapture(e.pointerId);
    $('cvart').style.cursor = 'grabbing';
  };

  $('cvart').onpointermove = (e) => {
    if (!panDrag) return;
    if (panDrag.ox > 0.5) state.frame.x = round1(clamp(panDrag.x0 - ((e.clientX - panDrag.sx) / panDrag.ox) * 100, 0, 100));
    if (panDrag.oy > 0.5) state.frame.y = round1(clamp(panDrag.y0 - ((e.clientY - panDrag.sy) / panDrag.oy) * 100, 0, 100));
    paintCover();
  };

  $('cvart').onpointerup = $('cvart').onpointercancel = () => {
    panDrag = null;
    paintCover();
  };

  $('cvname').onpointerdown = (e) => {
    const el = $('cvname');
    nameDrag = {
      sx: e.clientX,
      sy: e.clientY,
      x0: state.frame.nx ?? 0,
      y0: state.frame.ny ?? 100,
      rx: $('cv').clientWidth - el.offsetWidth,
      ry: $('cv').clientHeight - el.offsetHeight
    };
    el.setPointerCapture(e.pointerId);
  };

  $('cvname').onpointermove = (e) => {
    if (!nameDrag) return;
    state.frame.nx = round1(clamp(nameDrag.rx > 0.5 ? nameDrag.x0 + ((e.clientX - nameDrag.sx) / nameDrag.rx) * 100 : nameDrag.x0, 0, 100));
    state.frame.ny = round1(clamp(nameDrag.ry > 0.5 ? nameDrag.y0 + ((e.clientY - nameDrag.sy) / nameDrag.ry) * 100 : nameDrag.y0, 0, 100));
    paintCover();
  };

  $('cvname').onpointerup = $('cvname').onpointercancel = () => {
    nameDrag = null;
  };

  // Zoom: slider or mouse wheel over the picture
  $('czoom').oninput = () => {
    state.frame.z = clamp(+$('czoom').value / 100, 1, 4);
    paintCover();
  };

  $('cv').addEventListener(
    'wheel',
    (e) => {
      if (!state.cover) return;
      e.preventDefault();
      state.frame.z = round1(clamp(state.frame.z * (e.deltaY < 0 ? 1.08 : 1 / 1.08), 1, 4) * 100) / 100;
      paintCover();
    },
    { passive: false }
  );

  // Text size: slider, or mouse wheel over the name itself
  $('ctext').oninput = () => {
    state.frame.ns = clamp(+$('ctext').value / 100, 0.5, MAX_TEXT);
    paintCover();
  };

  $('cvname').addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      e.stopPropagation(); // don't also zoom the picture
      state.frame.ns = Math.round(clamp(state.frame.ns * (e.deltaY < 0 ? 1.08 : 1 / 1.08), 0.5, MAX_TEXT) * 100) / 100;
      paintCover();
    },
    { passive: false }
  );

  $('title').addEventListener('input', paintCover);
}
