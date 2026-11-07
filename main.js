// Electron main process: the window, saving to the library folder, and cover search.
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { createStore } = require('./disk-store');

// ---- The library folder: Documents/Beast Media Tracker (set BEAST_DATA_DIR to put it somewhere else) ----
let store = null;
const dataDir = () => process.env.BEAST_DATA_DIR || path.join(app.getPath('documents'), 'Beast Media Tracker');

// Saving and loading for the page (see src/disk.js). Each handler is small and checks its input again
// inside disk-store.js.
function initDiskIpc() {
  ipcMain.handle('disk:load', () => {
    store = createStore(dataDir());
    return store.load();
  });
  ipcMain.handle('disk:set', (_, key, text) => store.setKey(key, text));
  ipcMain.handle('disk:putCover', (_, dataUrl) => store.putCover(dataUrl));
  ipcMain.handle('disk:putFile', (_, name, bytes, mime) => store.putFile(name, bytes, mime));
  ipcMain.handle('disk:getFile', (_, name) => store.getFile(name));
  ipcMain.handle('disk:delFile', (_, name) => store.delFile(name));
  ipcMain.handle('disk:openFolder', () => shell.openPath(store ? store.dir : dataDir()));
}
initDiskIpc();

// ---- The window ----
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    backgroundColor: '#121212',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');

  // Links that open a new window (like "Find on Google Images") go to the normal browser instead
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // The app window itself should never navigate away from the app
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) e.preventDefault();
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

// ---- Cover search. All sources below are free and need no API key. ----
async function getJson(url, opt) {
  const r = await fetch(url, opt);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// iTunes Search: movies, TV seasons and albums
async function searchItunes(kind, e) {
  const params = {
    movie: 'media=movie&entity=movie',
    tv: 'media=tvShow&entity=tvSeason',
    album: 'media=music&entity=album'
  }[kind];
  const d = await getJson(`https://itunes.apple.com/search?term=${e}&${params}&limit=18`);
  return d.results
    .filter((x) => x.artworkUrl100)
    .map((x) => ({
      title: x.trackName || x.collectionName,
      thumb: x.artworkUrl100.replace('100x100bb', '300x300bb'),
      full: x.artworkUrl100.replace('100x100bb', '1000x1000bb')
    }));
}

// AniList: anime and manga
async function searchAnilist(kind, q) {
  const body = JSON.stringify({
    query:
      'query($s:String,$t:MediaType){Page(perPage:18){media(search:$s,type:$t){title{romaji english}coverImage{large extraLarge}}}}',
    variables: { s: q, t: kind === 'anime' ? 'ANIME' : 'MANGA' }
  });
  const d = await getJson('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body
  });
  return d.data.Page.media.map((m) => ({
    title: m.title.english || m.title.romaji,
    thumb: m.coverImage.large,
    full: m.coverImage.extraLarge
  }));
}

// Open Library: books
async function searchOpenLibrary(e) {
  const d = await getJson(`https://openlibrary.org/search.json?q=${e}&limit=18&fields=title,cover_i`);
  return d.docs
    .filter((x) => x.cover_i)
    .map((x) => ({
      title: x.title,
      thumb: `https://covers.openlibrary.org/b/id/${x.cover_i}-M.jpg`,
      full: `https://covers.openlibrary.org/b/id/${x.cover_i}-L.jpg`
    }));
}

// Steam store art: games
async function searchSteam(e) {
  const d = await getJson(`https://store.steampowered.com/api/storesearch/?term=${e}&l=english&cc=us`);
  return d.items.slice(0, 18).map((x) => {
    const u = `https://cdn.cloudflare.steamstatic.com/steam/apps/${x.id}/library_600x900.jpg`;
    return { title: x.name, thumb: u, full: u };
  });
}

ipcMain.handle('search', async (_, kind, q) => {
  q = String(q).slice(0, 100);
  const e = encodeURIComponent(q);
  if (kind === 'movie' || kind === 'tv' || kind === 'album') return searchItunes(kind, e);
  if (kind === 'anime' || kind === 'manga') return searchAnilist(kind, q);
  if (kind === 'book') return searchOpenLibrary(e);
  if (kind === 'game') return searchSteam(e);
  return [];
});

// Downloads a cover picked from the results. Only the sites above are allowed.
const IMAGE_HOSTS = ['mzstatic.com', 'openlibrary.org', 'archive.org', 'anilist.co', 'steamstatic.com'];

ipcMain.handle('image', async (_, u) => {
  const h = new URL(u);
  const allowed = IMAGE_HOSTS.some((d) => h.hostname === d || h.hostname.endsWith(`.${d}`));
  if (h.protocol !== 'https:' || !allowed) throw new Error('Blocked host');
  const r = await fetch(u);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const t = r.headers.get('content-type') || 'image/jpeg';
  return `data:${t};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`;
});
