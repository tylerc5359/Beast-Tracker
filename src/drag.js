// Drag a tile to move it (Edit mode): guides, snapping and dropping.
// While selecting, dragging a selected tile moves every selected tile together, keeping their arrangement.
import { $ } from './dom.js';
import { fp, mark, unmark } from './layout.js';
import { viewKey } from './helpers.js';
import { saveLayouts } from './storage.js';
import { renderAddCells } from './edit-mode.js';
import { sel, state } from './state.js';

export function startDrag(e, b) {
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
  let group = [id]; // the tiles that move together; the grabbed tile is the anchor
  let inGroup = new Set(group);
  const off = new Map(); // each group tile's cell offset from the anchor
  const shift = new Map(); // each group tile's pixel offset from the anchor
  let span = { l: 0, r: 1, t: 0, b: 1 }; // the group's extent in cells, relative to the anchor

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
      for (let c = 0; c < state.gridCols; c++) {
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
    const vic = [];
    const held = group.map((k) => {
      const d = off.get(k);
      return [k, [T[0] + d[0], T[1] + d[1]], sizes.get(k)];
    });

    base.forEach((p, k) => {
      if (inGroup.has(k)) return;
      const s = sizes.get(k);
      const hit = held.some(
        ([, q, H]) => p[0] < q[0] + H.w && p[0] + s.w > q[0] && p[1] < q[1] + H.h && p[1] + s.h > q[1]
      );
      if (hit) {
        vic.push(k);
      } else {
        mark(occ, p[0], p[1], s.w, s.h, k);
        out.set(k, p);
      }
    });

    held.forEach(([k, q, H]) => {
      mark(occ, q[0], q[1], H.w, H.h, k);
      out.set(k, q);
    });

    let mr = 0;
    base.forEach((p, k) => {
      mr = Math.max(mr, p[1] + sizes.get(k).h);
    });
    mr += span.b - span.t + 4;

    const fixed = new Set(group);
    const q = vic.slice();

    while (q.length) {
      q.sort((a, b) => area(b) - area(a));
      const k = q.shift();
      const s = sizes.get(k);
      const o = base.get(k);
      const pc = Math.max(0, Math.min(o[0] - T[0] + P[0], state.gridCols - s.w));
      const pr = Math.max(0, o[1] - T[1] + P[1]);
      let best = null;
      let bc = 1e9;

      for (let r = 0; r <= mr; r++) {
        for (let c = 0; c <= state.gridCols - s.w; c++) {
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
    const els = tl().filter((o) => !inGroup.has(o._id));
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
    group.forEach((k) => {
      const o = elOf.get(k);
      const d = shift.get(k);
      o.style.translate = `${px - gx + d[0] - o.offsetLeft}px ${py - gy + d[1] - o.offsetTop}px`;
    });
  };

  const place = () => {
    follow();
    const [px, py] = mp();
    const hc = Math.max(0, Math.floor((px - pl) / pX));
    const hr = Math.max(0, Math.floor((py - pt) / pY));
    const T = [
      Math.max(-span.l, Math.min(hc - oc, state.gridCols - span.r)),
      Math.min(lim, Math.max(-span.t, hr - orr))
    ];
    const key = T.join();

    if (key === applied) return;

    const out = resolve(T);
    const moved = [...out].some(([k, p]) => !inGroup.has(k) && (base.get(k)[0] !== p[0] || base.get(k)[1] !== p[1]));
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
    group.forEach((k) => {
      const H = sizes.get(k);
      const q = out.get(k);
      for (let y = q[1]; y < q[1] + H.h; y++) {
        for (let x = q[0]; x < q[0] + H.w; x++) {
          const d = guides.get(`${x},${y}`);
          if (d) d.classList.add('drop');
        }
      }
    });
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
    state.dragMoved = true;
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
    if (state.selMode && sel.has(id)) group = [id, ...[...sel].filter((k) => k !== id && base.has(k))];
    inGroup = new Set(group);
    span = { l: 0, r: 0, t: 0, b: 0 };
    group.forEach((k) => {
      const q = base.get(k);
      const s = sizes.get(k);
      const o = elOf.get(k);
      const d = [q[0] - P[0], q[1] - P[1]];
      off.set(k, d);
      shift.set(k, [o.offsetLeft - b.offsetLeft, o.offsetTop - b.offsetTop]);
      span.l = Math.min(span.l, d[0]);
      span.r = Math.max(span.r, d[0] + s.w);
      span.t = Math.min(span.t, d[1]);
      span.b = Math.max(span.b, d[1] + s.h);
    });

    applied = P.join();
    document.body.classList.add('dragging');
    lim = mr + 2;
    ensure(lim + span.b);

    const [px, py] = mp();
    gx = px - b.offsetLeft;
    gy = py - b.offsetTop;
    oc = Math.min(sizes.get(id).w - 1, Math.max(0, Math.floor(gx / pX)));
    orr = Math.min(sizes.get(id).h - 1, Math.max(0, Math.floor(gy / pY)));

    group.forEach((k) => {
      elOf.get(k).classList.remove('in');
      elOf.get(k).classList.add('held');
    });
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
      state.dragMoved = false;
    }, 0);

    const changed = [...curPos].some(([k, p]) => base.get(k)[0] !== p[0] || base.get(k)[1] !== p[1]);
    if (changed) {
      const key = viewKey();
      const L = state.layouts[key] || (state.layouts[key] = {});
      curPos.forEach((p, k) => {
        L[k] = p;
      });
      saveLayouts();
      $('sort').value = 'custom';
      g.classList.add('free');
    }

    renderAddCells(); // the cells the tile left are free again
    void g.offsetWidth;
    document.body.classList.remove('dragging');
    guides.forEach((d) => d.remove());
    group.forEach((k) => {
      elOf.get(k).classList.remove('held');
      elOf.get(k).style.translate = '0px 0px';
    });
  };

  b.setPointerCapture(e.pointerId);
  b.addEventListener('pointermove', mv);
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
}

// Connects this module's buttons and events to the page (called once at start-up)
export function initDrag() {
  document.addEventListener('click', (e) => {
    if (state.dragMoved) {
      e.stopPropagation();
      e.preventDefault();
      state.dragMoved = false;
    }
  }, true);
}
