// Developer helper: add / remove test tiles.
import { $ } from './dom.js';
import { save } from './storage.js';
import { render } from './render.js';
import { state } from './state.js';

function testBtn() {
  $('testbtn').textContent = state.items.some((i) => i.test) ? 'Remove test tiles' : 'Add test tiles';
}

// Connects this module's buttons and events to the page (called once at start-up)
export function initDevTools() {
  $('testbtn').onclick = () => {
    if (state.items.some((i) => i.test)) {
      state.items = state.items.filter((i) => !i.test);
    } else {
      const now = Date.now();
      const grays = ['#6b6b6b', '#7a7a7a', '#8a8a8a', '#9a9a9a', '#5e5e5e', '#b0b0b0'];
      for (let n = 1; n <= 60; n++) {
        state.items.push({
          id: now + n,
          t: now + n,
          title: `Test tile ${n}`,
          type: state.catFilter ? state.typeFilter : '',
          status: state.catFilter,
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
}
