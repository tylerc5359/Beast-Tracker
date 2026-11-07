// Where the app's data lives.
//
// In the Electron app everything is saved to real files in the library folder (see disk-store.js).
// Opened as a plain web page (no Electron) it falls back to the browser's own storage, as before.
//
//   kvGet / kvSet     small saved values (tiles, categories, layouts, sort…). Reads are instant because
//                     everything is loaded into memory once at start-up; writes are saved shortly after.
//   blobGet/Set/Del   background images (files on disk, or IndexedDB in the browser)
import { BGKEY, BGS_KEY, CKEY, KEY, LKEY, OKEY, SORTKEY, bgKey } from './config.js';

let api = window.beastApi && window.beastApi.disk;
const kv = new Map();
const WRITE_DELAY = 300; // ms to wait for more changes before writing

export const diskInfo = { onDisk: false, dir: '', notice: '' };

const reportError = (message) => window.dispatchEvent(new CustomEvent('beast-disk-error', { detail: message }));

// ---- Cover images: the tile data keeps them as data URLs, the files on disk as "covers/<hash>.<ext>" ----
const COVER_REF_RE = /^covers\/[0-9a-f]{40}\.[a-z]+$/;
const refByUrl = new Map(); // data URL → file reference, so unchanged covers aren't sent again

// Calls fn on every string inside a value and replaces it with what fn returns
async function mapStrings(value, fn) {
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) {
    for (let n = 0; n < value.length; n++) value[n] = await mapStrings(value[n], fn);
  } else if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) value[k] = await mapStrings(value[k], fn);
  }
  return value;
}

// Copies a value, passing every string through fn (the original is left alone)
async function copyStrings(value, fn) {
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) return Promise.all(value.map((v) => copyStrings(v, fn)));
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = await copyStrings(value[k], fn);
    return out;
  }
  return value;
}

// Before saving: covers become file references. This works on the live data (not on a JSON copy of it),
// so a cover that was already saved is recognised instantly instead of being re-read and re-hashed.
async function externalizeCovers(value) {
  const copy = await copyStrings(value, async (s) => {
    if (!s.startsWith('data:image/')) return s;
    if (!refByUrl.has(s)) refByUrl.set(s, await api.putCover(s));
    return refByUrl.get(s);
  });
  return JSON.stringify(copy);
}

// After loading: file references become data URLs again (a missing file leaves the cover empty)
async function internalizeCovers(text, covers) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (e) {
    return text;
  }
  value = await mapStrings(value, (s) => {
    if (!COVER_REF_RE.test(s)) return s;
    if (!covers[s]) return '';
    refByUrl.set(covers[s], s);
    return covers[s];
  });
  return JSON.stringify(value);
}

// ---- Writing: changes are collected and saved in order ----
const pending = new Map(); // key → latest text, or a function that returns the latest value
let timer = null;
let chain = Promise.resolve();

export function flushDisk() {
  clearTimeout(timer);
  const jobs = [...pending];
  pending.clear();
  chain = chain.then(async () => {
    for (const [key, text] of jobs) {
      try {
        await api.set(key, typeof text === 'function' ? await externalizeCovers(text()) : text);
      } catch (e) {
        reportError('Couldn’t save to your library folder. Check that it still exists and has free space.');
      }
    }
  });
  return chain;
}

export const kvGet = (key) => {
  if (!api) return localStorage.getItem(key);
  return kv.has(key) ? kv.get(key) : null;
};

// Throws in the browser when storage is full (callers decide what to tell the person)
export function kvSet(key, text) {
  if (!api) return localStorage.setItem(key, text);
  kv.set(key, text);
  pending.set(key, text);
  clearTimeout(timer);
  timer = setTimeout(flushDisk, WRITE_DELAY);
}

// Like kvSet, but for the tiles: gives a function that returns the data instead of its text, so the (large)
// text is only built once, when the save actually happens, however many changes came before it.
export function kvSetTiles(key, getValue) {
  if (!api) return localStorage.setItem(key, JSON.stringify(getValue()));
  pending.set(key, getValue);
  clearTimeout(timer);
  timer = setTimeout(flushDisk, WRITE_DELAY);
}

// ---- Background images ----
function idbRun(mode, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('beast-media', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('files');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('files', mode);
      const req = fn(tx.objectStore('files'));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
    };
  });
}

export async function blobGet(key) {
  if (!api) return idbRun('readonly', (s) => s.get(key));
  const f = await api.getFile(key);
  return f ? new Blob([f.bytes], { type: f.type }) : undefined;
}

export async function blobSet(key, blob) {
  if (!api) return idbRun('readwrite', (s) => s.put(blob, key));
  await api.putFile(key, await blob.arrayBuffer(), blob.type);
}

export async function blobDel(key) {
  if (!api) return idbRun('readwrite', (s) => s.delete(key));
  await api.delFile(key);
}

export const openDataFolder = () => api && api.openFolder();

// ---- First run in the Electron app: bring over what the browser storage already holds ----
async function migrateFromBrowserStorage() {
  if (localStorage.getItem('beast-migrated')) return;
  for (const key of [KEY, CKEY, OKEY, LKEY, SORTKEY, BGS_KEY, BGKEY]) {
    const text = localStorage.getItem(key);
    if (text === null) continue;
    kv.set(key, text); // so the start-up load below finds it
    if (key === KEY) kvSetTiles(KEY, () => JSON.parse(text)); // covers still need to become files
    else kvSet(key, text);
  }
  const keys = ['bg'];
  try {
    for (const bg of JSON.parse(localStorage.getItem(BGS_KEY)) || []) keys.push(bgKey(bg.id));
  } catch (e) {}
  for (const key of keys) {
    const blob = await idbRun('readonly', (s) => s.get(key));
    if (blob) await blobSet(key, blob);
  }
  await flushDisk();
  localStorage.setItem('beast-migrated', '1'); // the old copy stays where it is, but is never copied again
}

// Reads the library folder into memory (called once at start-up, before anything reads saved data)
export async function initDisk() {
  if (!api) return;
  try {
    const res = await api.load();
    for (const [key, text] of Object.entries(res.kv)) {
      kv.set(key, key === KEY ? await internalizeCovers(text, res.covers) : text);
    }
    diskInfo.onDisk = true;
    diskInfo.dir = res.dir;
    diskInfo.notice = res.notice;
    if (res.fresh) await migrateFromBrowserStorage();
  } catch (e) {
    console.error(e);
    kv.clear();
    api = null; // keep working with the browser's storage instead
    diskInfo.onDisk = false;
    reportError('Couldn’t open your library folder, so this session is using temporary browser storage.');
  }
}

// Make sure the last changes are written when the window closes or is hidden
if (api) {
  addEventListener('pagehide', flushDisk);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushDisk());
}
