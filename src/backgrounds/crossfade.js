// Backgrounds: the slow crossfade between backgrounds as you scroll.
import { gridMetrics, rowBottomY, rowTopY, viewRow } from '../layout.js';
import { $ } from '../dom.js';
import { bgUrls } from './store.js';
import { state } from '../state.js';

const smooth = (t) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x); // smoothstep: gentle start and finish
};

// Two backgrounds blend centred between them. At the standard strength (100%) the blend is at least one
// screen height; the upper background's own "blend" setting scales that (0% = hard cut).
function blendZone(a, b) {
  const gap = b.top - a.bottom;
  const c = (a.bottom + b.top) / 2;
  const strength = Math.max(0, (a.bg.blend ?? 100) / 100);
  const h = Math.max((Math.max(gap, innerHeight) * strength) / 2, 0.5);
  return [c - h, c + h];
}

function bgWeights(m) {
  const y = scrollY + innerHeight / 2;
  const edge = innerHeight / 4; // outer edges fade to the plain page more quickly
  const sorted = state.bgs
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

export function updateBackgrounds() {
  const m = gridMetrics();
  const weights = bgWeights(m);
  let total = 0;
  state.bgs.forEach((bg) => {
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

export function scheduleBgUpdate() {
  if (bgRaf) return;
  bgRaf = requestAnimationFrame(() => {
    bgRaf = 0;
    updateBackgrounds();
  });
}

export function applyLayerStyle(bg) {
  const el = layerFor(bg);
  el.style.backgroundImage = bgUrls[bg.id] ? `url("${bgUrls[bg.id]}")` : '';
  el.style.filter = `blur(${bg.blur}px) brightness(${bg.bright}%) saturate(${bg.sat}%)`;
}

export function syncLayers() {
  [...$('bgstack').children].forEach((el) => {
    if (!state.bgs.some((b) => b.id === el.dataset.id)) el.remove();
  });
  state.bgs.forEach(applyLayerStyle);
  document.body.classList.toggle('has-bg', state.bgs.length > 0);
  updateBackgrounds();
}
