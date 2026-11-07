// Shared app state. Every module reads and writes the same `state` object.

// Everything that more than one module reads or changes lives on this one object.
export const state = {
  gridCols: 1,
  pageRows: 3,
  lastSig: '',
  animT: 0,
  noAnim: false,
  catFilter: '',
  typeFilter: '',
  cover: '',
  frame: { z: 1, x: 50, y: 50, ar: null, nx: null, ny: null, ns: 1 }, // zoom, pan and name position of the cover being edited
  editing: null,
  selMode: false,
  editMode: false, // Edit mode: tiles can be moved and empty cells show a "+"
  addAnchor: null, // [column, row] the new tile will start at
  visibleIds: [],
  dragMoved: false,
  customOrder: null,
  layouts: null,
  cats: null,
  items: null,
  bgs: null,
  bgTarget: null, // id being replaced, or null when adding a new one
  bgSyncs: [] // functions that refresh each card in the Backgrounds panel
};

export const sel = new Set();
