// Saving and loading tiles, categories, layouts, custom order (see disk.js for where they end up).
import { CKEY, KEY, LKEY, OKEY } from './config.js';
import { kvGet, kvSet, kvSetTiles } from './disk.js';
import { state } from './state.js';

export function saveOrder() {
  try {
    kvSet(OKEY, JSON.stringify(state.customOrder));
  } catch (e) {}
}

export function saveLayouts() {
  try {
    kvSet(LKEY, JSON.stringify(state.layouts));
  } catch (e) {}
}

function loadCats() {
  try {
    const raw = kvGet(CKEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      parsed.forEach((k) => (k.subs = k.subs || []));
      return parsed;
    }
  } catch (e) {}
  return [];
}

export function saveCats() {
  try {
    kvSet(CKEY, JSON.stringify(state.cats));
  } catch (e) {}
}

function loadItems() {
  try {
    const raw = kvGet(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

export function save() {
  try {
    kvSetTiles(KEY, () => state.items);
  } catch (e) {
    alert('Couldn’t save — storage is full. Try smaller cover images or export a backup.');
  }
}

// Reads saved data into `state` (called once at start-up)
export function loadStorageState() {
  state.customOrder = (() => {
    try {
      return JSON.parse(kvGet(OKEY)) || {};
    } catch (e) {
      return {};
    }
  })();

  state.layouts = (() => {
    try {
      return JSON.parse(kvGet(LKEY)) || {};
    } catch (e) {
      return {};
    }
  })();

  state.cats = loadCats();

  state.items = loadItems() || [
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
}
