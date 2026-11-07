// The library folder on disk (runs in Electron's main process, but needs nothing from Electron,
// so it can also be tested with plain Node).
//
//   <folder>/library.json        tiles, categories, layouts, sort, background settings (readable JSON)
//   <folder>/library.json.bak    copy of the previous session's library.json (made once per launch)
//   <folder>/covers/<hash>.<ext> cover images (identical images are stored once)
//   <folder>/backgrounds/<name>.<ext>  background images and GIFs
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Only these kinds of images are ever written, and the mime type decides the file extension
const EXT_BY_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg'
};
const MIME_BY_EXT = Object.fromEntries(Object.entries(EXT_BY_MIME).map(([m, e]) => [e, m]));

const KEY_RE = /^[A-Za-z0-9_-]{1,40}$/; // names of saved values, like "shelf-v1" or "beast-cats"
const NAME_RE = /^[A-Za-z0-9_-]{1,80}$/; // names of background files (without extension)
const COVER_REF_RE = /^covers\/[0-9a-f]{40}\.(png|jpg|gif|webp|avif|bmp|svg)$/;
const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/i;
const MAX_VALUE_CHARS = 200 * 1024 * 1024;

// Writes to a temporary file first, then swaps it in, so a crash never leaves half a file
function writeAtomic(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

function createStore(dir) {
  const libFile = path.join(dir, 'library.json');
  const bakFile = `${libFile}.bak`;
  const coversDir = path.join(dir, 'covers');
  const bgDir = path.join(dir, 'backgrounds');
  let data = {}; // saved values: objects stay objects, everything else is a string
  let backedUp = false;

  const ensureDirs = () => [dir, coversDir, bgDir].forEach((d) => fs.mkdirSync(d, { recursive: true }));

  function readLibrary(file) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) throw new Error('Not a library file');
    return parsed.data;
  }

  // Reads everything the page needs at start-up. Never throws for a damaged library: it recovers from the
  // backup and keeps the damaged file next to it.
  function load() {
    ensureDirs();
    let fresh = false;
    let notice = '';
    data = {};
    if (fs.existsSync(libFile)) {
      try {
        data = readLibrary(libFile);
      } catch (e) {
        const saved = path.join(dir, `library.damaged-${Date.now()}.json`);
        try {
          fs.renameSync(libFile, saved);
        } catch (err) {}
        notice = `library.json was damaged (kept as ${path.basename(saved)}). `;
        try {
          data = readLibrary(bakFile);
          notice += 'Restored from the backup.';
        } catch (err) {
          notice += 'No usable backup was found, so the library starts empty.';
        }
      }
    } else if (fs.existsSync(bakFile)) {
      try {
        data = readLibrary(bakFile);
        notice = 'library.json was missing. Restored from the backup.';
      } catch (e) {}
    } else {
      fresh = true;
    }

    const kv = {};
    const covers = {};
    for (const [key, value] of Object.entries(data)) {
      if (!KEY_RE.test(key)) continue;
      kv[key] = typeof value === 'string' ? value : JSON.stringify(value);
      collectCoverRefs(value, covers);
    }
    return { dir, fresh, notice, kv, covers };
  }

  // Finds cover references inside a saved value and reads their image files
  function collectCoverRefs(value, covers) {
    if (typeof value === 'string') {
      if (COVER_REF_RE.test(value) && !(value in covers)) {
        const url = readCover(value);
        if (url) covers[value] = url;
      }
    } else if (value && typeof value === 'object') {
      for (const v of Object.values(value)) collectCoverRefs(v, covers);
    }
  }

  function readCover(ref) {
    if (!COVER_REF_RE.test(ref)) return null;
    try {
      const bytes = fs.readFileSync(path.join(dir, ref));
      const mime = MIME_BY_EXT[path.extname(ref).slice(1)];
      return `data:${mime};base64,${bytes.toString('base64')}`;
    } catch (e) {
      return null;
    }
  }

  // Saves one value (the text the page would have put in localStorage) and rewrites library.json
  function setKey(key, text) {
    if (!KEY_RE.test(key)) throw new Error('Bad key');
    if (typeof text !== 'string' || text.length > MAX_VALUE_CHARS) throw new Error('Bad value');
    let value = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') value = parsed;
    } catch (e) {}
    data[key] = value;
    ensureDirs();
    if (!backedUp && fs.existsSync(libFile)) {
      try {
        fs.copyFileSync(libFile, bakFile);
      } catch (e) {}
    }
    backedUp = true;
    writeAtomic(libFile, JSON.stringify({ version: 1, data }, null, 2));
  }

  // Saves a cover image (given as a data URL) and returns its reference, like "covers/ab12….png"
  function putCover(dataUrl) {
    const m = DATA_URL_RE.exec(String(dataUrl));
    const ext = m && EXT_BY_MIME[m[1].toLowerCase()];
    if (!ext) throw new Error('Not a supported image');
    const bytes = Buffer.from(m[2], 'base64');
    const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 40);
    const ref = `covers/${hash}.${ext}`;
    ensureDirs();
    if (!fs.existsSync(path.join(dir, ref))) writeAtomic(path.join(dir, ref), bytes);
    return ref;
  }

  // Background images: the page's names look like "bg" or "bg:b123", so anything odd becomes "_"
  const cleanName = (name) => String(name).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
  const bgFiles = (name) => fs.readdirSync(bgDir).filter((f) => f.slice(0, f.lastIndexOf('.')) === name);

  function delFile(name) {
    name = cleanName(name);
    if (!NAME_RE.test(name)) throw new Error('Bad name');
    ensureDirs();
    for (const f of bgFiles(name)) fs.unlinkSync(path.join(bgDir, f));
  }

  function putFile(name, bytes, mime) {
    name = cleanName(name);
    const ext = EXT_BY_MIME[String(mime).toLowerCase()];
    if (!NAME_RE.test(name) || !ext) throw new Error('Bad file');
    delFile(name); // replacing a background may change its type (png → gif)
    writeAtomic(path.join(bgDir, `${name}.${ext}`), Buffer.from(bytes));
  }

  function getFile(name) {
    name = cleanName(name);
    if (!NAME_RE.test(name)) throw new Error('Bad name');
    ensureDirs();
    const f = bgFiles(name)[0];
    if (!f) return null;
    return { type: MIME_BY_EXT[path.extname(f).slice(1)], bytes: fs.readFileSync(path.join(bgDir, f)) };
  }

  return { dir, load, setKey, putCover, putFile, getFile, delFile };
}

module.exports = { createStore };
