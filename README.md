# BEAST MEDIA TRACKER
<img width="350" height="350" alt="bear-head-logo-illustration-free-vector-removebg-preview" src="https://github.com/user-attachments/assets/4af9f3b0-589c-4824-a600-cbbcc78cf0e5" />


Desktop app (Electron) built from plain ES modules. No build step: you edit the files and reload.

## Run it
1. Install Node.js (LTS) from nodejs.org.
2. In this folder:
   ```
   npm install
   npm run setup      # downloads Electron's engine (newer npm skips Electron's own install script)
   npm start
   ```

## While you work
- Edited `index.html`, `styles/` or `src/`? Press **Ctrl+R** in the app window.
- Edited `main.js` or `preload.js`? Close the app and run `npm start` again.
- **Ctrl+Shift+I** opens the developer tools (errors show in the Console).

## Make an installer
```
npm run dist
```
The installer appears in `dist/`. On Windows, turn on Developer Mode first (Settings > For developers), or run the
terminal as administrator, otherwise the build stops with a "symbolic link" error.

## Where things are
```
index.html          page structure
main.js             Electron main process (window, cover search)
preload.js          the small bridge the page can use
styles/             one CSS file per area, imported by styles/main.css
src/
  main.js           start-up: load saved data, connect every module, first draw
  state.js          the shared `state` object (tiles, categories, layouts, mode flags)
  storage.js        saving and loading tiles, categories, layouts
  disk.js           where data lives: library folder in Electron, browser storage in a plain web page
  layout.js         grid cells and row positions
  render.js         draws the tiles
  drag.js           drag a tile to move it
  edit-mode.js, image-drop.js, tile-editor.js, cover-editor.js, cover-art.js,
  size-picker.js, categories.js, selection.js, toolbar.js, menu.js, backup.js, dev-tools.js
  backgrounds/      store, crossfade, panel, manage, transfer, index
```
Each module with buttons or events exports an `init...()` function; `src/main.js` calls them once.
Anything shared between modules lives on `state` (for example `state.items`).

## Where your data is saved
The desktop app keeps your library in a normal folder you can see and back up:

    Documents/Beast Media Tracker/
      library.json         tiles, categories, layouts, sort, background settings (readable JSON)
      library.json.bak     the previous session's copy (made once each time the app starts)
      covers/              cover images and GIFs, one file each (identical images are stored once)
      backgrounds/         background images and GIFs

- There is no 5 MB limit, so large GIFs work.
- Use "Data folder" in the menu to open it. To keep it somewhere else, set the `BEAST_DATA_DIR` environment variable before starting.
- First start: anything already saved by an older version is copied into the folder automatically (the old copy is left untouched).
- If `library.json` is ever damaged, the app keeps it as `library.damaged-<time>.json`, restores from the backup and tells you.
- Covers you replace or delete stay in `covers/` (they're small); you can delete files there yourself, but only when the app is closed and only ones you no longer use.
- Opened as a plain web page (no Electron), it still uses the browser's own storage as before.

## Moving your data from the old version
Your tiles live in the browser/app storage of whichever version created them. In the old version use
**Export** (burger menu), then **Import** here. Export includes tiles, categories, order, layouts and backgrounds.
