// Category and sub-category manager.
import { save, saveCats } from './storage.js';
import { catOpts } from './tile-editor.js';
import { selOpts } from './edit-mode.js';
import { render } from './render.js';
import { $ } from './dom.js';
import { state } from './state.js';

function catsChanged() {
  saveCats();
  catOpts();
  if (state.editMode) selOpts();
  render();
}

function renderCats() {
  const l = $('clist');
  l.textContent = '';

  state.cats.forEach((k) => {
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
      state.items.forEach((x) => {
        if (x.status === k.id) x.status = '';
      });
      state.cats = state.cats.filter((c) => c !== k);
      if (state.catFilter === k.id) state.catFilter = '';
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
        state.items.forEach((x) => {
          if (x.status === k.id && x.type === s.id) x.type = '';
        });
        k.subs = k.subs.filter((y) => y !== s);
        if (state.typeFilter === s.id) state.typeFilter = '';
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

  if (!state.cats.length) {
    const p = document.createElement('div');
    p.style.color = 'var(--mute)';
    p.textContent = 'No categories yet. Add your first one below.';
    l.append(p);
  }
}

function addCat() {
  const v = $('cnew').value.trim();
  if (!v) return;
  state.cats.push({ id: `c${Date.now()}`, name: v, subs: [] });
  $('cnew').value = '';
  catsChanged();
  renderCats();
}

// Connects this module's buttons and events to the page (called once at start-up)
export function initCategories() {
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
}
