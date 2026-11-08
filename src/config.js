// Constants: storage keys, grid limits and size options.

// ---- Saved-data keys (names in library.json, or in browser storage) ----
export const KEY = 'shelf-v1'; // tiles
export const CKEY = 'beast-cats'; // categories
export const OKEY = 'beast-order'; // custom order per view
export const LKEY = 'beast-layout'; // tile positions per view
export const SORTKEY = 'beast-sort'; // chosen sort option
export const BGS_KEY = 'beast-bgs'; // backgrounds
export const BGKEY = 'beast-bgfx'; // single-background settings from before multiple backgrounds existed

// Name of a background's image file (the first background used to be saved as just "bg")
export const bgKey = (id) => (id === 'legacy' ? 'bg' : `bg:${id}`);

// ---- Tile sizes ----
// Sizes are "<columns>x<rows>" (e.g. '3x2'), plus two that adapt to the window.
export const SIZE_SPECIAL = {
  row: { c: 'all', r: 1 },
  full: { c: 'all', r: 'page' }
};

export const MAX_COLS = 10; // columns shown in the size picker
export const MAX_ROWS = 6; // rows shown in the size picker

// ---- Covers and backgrounds ----
export const MAX_GIF_BYTES = 25 * 1024 * 1024; // GIF covers are kept as-is, so they must fit in storage
export const MAX_TEXT = 10; // largest name size: 10x (the Text slider's 1000%)
// blend = how strongly this background fades into the next one down: 0 is a hard cut, 100 the standard
// slow fade (one screen tall at least), 300 a very long fade
export const BG_DEFAULTS = { blur: 0, bright: 100, sat: 100, blend: 100 };
