// Draws the grid of tiles and the filter chips.
import { inView, measure, sizeOf, subName } from './helpers.js';
import { $ } from './dom.js';
import { computeLayout, fp } from './layout.js';
import { artStyle, ensureAR, frameOf, placeName } from './cover-editor.js';
import { save } from './storage.js';
import { sel, state } from './state.js';
import { openDlg } from './tile-editor.js';
import { startDrag } from './drag.js';
import { renderAddCells, toggle } from './edit-mode.js';

export function render() {
  measure();
  const q = $('q').value.toLowerCase();
  const s = $('sort').value;

  let list = state.items.filter((i) => inView(i) && (i.title + i.desc).toLowerCase().includes(q));

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
  state.visibleIds = list.map((i) => i.id);

  const lay = s === 'custom' ? computeLayout(list) : null;
  $('grid').classList.toggle('free', s === 'custom');

  const canDrag = state.editMode; // moving tiles only works in Edit mode (selecting too)
  document.body.classList.toggle('customsort', canDrag);
  document.body.classList.toggle('editing', state.editMode);

  const g = $('grid');
  g.textContent = '';

  if (!list.length && !state.editMode) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = state.items.length
      ? 'Nothing matches. Try another search or type.'
      : 'Your library is empty. Press Edit, then click + to add your first title.';
    g.append(empty);
  }

  const sig = list.map((x) => x.id).join();
  const now = performance.now();
  const animate = !state.noAnim && (sig !== state.lastSig || now - state.animT < 700);

  if (sig !== state.lastSig && !state.noAnim) state.animT = now;
  state.lastSig = sig;
  state.noAnim = false;

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
    b.style.gridColumn = sz.c === 'all' ? '1/-1' : `span ${Math.min(sz.c, state.gridCols)}`;
    b.style.gridRow = `span ${sz.r === 'page' ? state.pageRows : sz.r}`;
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

    if (state.selMode) {
      const ck = document.createElement('div');
      ck.className = 'chk';
      ck.textContent = sel.has(i.id) ? '✓' : '';
      b.append(ck);
      b.classList.toggle('sel', sel.has(i.id));
      b.setAttribute('aria-pressed', sel.has(i.id));
    }

    b.onclick = () => (state.selMode ? toggle(i.id) : openDlg(i));
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

  // Sub-category chips (only while a category is picked)
  const t = $('types');
  t.textContent = '';
  const currentCat = state.cats.find((k) => k.id === state.catFilter);
  t.style.display = currentCat ? '' : 'none';

  if (currentCat) {
    [{ id: '', name: 'All' }, ...currentCat.subs].forEach((x) => {
      const c = document.createElement('button');
      c.className = 'chip';
      c.textContent = x.name;
      c.setAttribute('aria-pressed', x.id === state.typeFilter);
      c.onclick = () => {
        state.typeFilter = x.id;
        render();
      };
      t.append(c);
    });
  }

  // Category chips, each with its tile count
  const st = $('stats');
  st.textContent = '';
  state.cats.forEach((k) => {
    const c = document.createElement('button');
    c.className = 'chip';
    c.textContent = `${k.name} ${state.items.filter((i) => i.status === k.id).length}`;
    c.setAttribute('aria-pressed', state.catFilter === k.id);
    c.onclick = () => {
      state.catFilter = state.catFilter === k.id ? '' : k.id;
      state.typeFilter = '';
      render();
    };
    st.append(c);
  });
}
