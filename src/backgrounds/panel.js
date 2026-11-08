// Backgrounds: the Backgrounds panel in Edit mode.
import { bgUrls, saveBgs } from './store.js';
import { applyLayerStyle, updateBackgrounds } from './crossfade.js';
import { gridMetrics, viewRow } from '../layout.js';
import { $ } from '../dom.js';
import { pickBg, removeBg } from './manage.js';
import { state } from '../state.js';

function bgSlider(bg, key, label, min, max, unit, step = 1) {
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
  input.step = step;
  input.oninput = () => {
    bg[key] = +input.value;
    saveBgs();
    applyLayerStyle(bg);
    updateBackgrounds(); // blend strength changes the fade straight away
    state.bgSyncs.forEach((fn) => fn());
  };

  wrap.append(row, input);
  const sync = () => {
    input.value = bg[key] ?? 100;
    val.textContent = blendText(bg[key] ?? 100, key, unit);
  };
  return { el: wrap, sync };
}

// The blend slider reads "Hard cut" at 0 instead of "0%"
const blendText = (v, key, unit) => (key === 'blend' && v === 0 ? 'Hard cut' : `${v}${unit}`);

// True when another background starts below this one (so its blend setting has something to fade into)
const hasNext = (bg) => state.bgs.some((o) => o !== bg && (o.topRow > bg.topRow || (o.topRow === bg.topRow && o.bottomRow > bg.bottomRow)));

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
    state.bgSyncs.forEach((fn) => fn());
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

export function renderBgPanel() {
  const list = $('bglist');
  list.textContent = '';
  state.bgSyncs = [];

  if (!state.bgs.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'No backgrounds yet. Add one below.';
    list.append(p);
    return;
  }

  state.bgs.forEach((bg, n) => {
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

    // How strongly this background fades into the next one down (only when there is one)
    const blend = bgSlider(bg, 'blend', 'Blend into next background', 0, 300, '%', 5);
    const blendSync = blend.sync;
    blend.sync = () => {
      blendSync();
      blend.el.hidden = !hasNext(bg);
    };

    const fx = document.createElement('details');
    const sum = document.createElement('summary');
    sum.textContent = 'Effects';
    const blur = bgSlider(bg, 'blur', 'Blur', 0, 40, 'px');
    const bright = bgSlider(bg, 'bright', 'Brightness', 20, 150, '%');
    const sat = bgSlider(bg, 'sat', 'Saturation', 0, 200, '%');
    fx.append(sum, blur.el, bright.el, sat.el);

    card.append(head, top.el, bottom.el, blend.el, fx);
    list.append(card);

    [top, bottom, blend, blur, bright, sat].forEach((s) => {
      s.sync();
      state.bgSyncs.push(s.sync);
    });
  });
}
