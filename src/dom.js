// Tiny DOM helpers shared by every module.

export const $ = (id) => document.getElementById(id);

export function fill(selEl, opts) {
  selEl.innerHTML = '';
  opts.forEach(([v, l]) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = l;
    selEl.append(o);
  });
}
