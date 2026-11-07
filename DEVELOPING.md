# Developing Beast Media Tracker

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
- Set the `BEAST_DATA_DIR` environment variable before starting to use a separate library folder for testing.

## Make an installer on your own computer
```
npm run dist
```
The installer appears in `dist/`. On Windows, turn on Developer Mode first (Settings > For developers), or run the
terminal as administrator, otherwise the build stops with a "symbolic link" error. A Mac installer can only be built on a Mac.

## Publish a release
Releases are built by GitHub Actions ([.github/workflows/release.yml](.github/workflows/release.yml)), which makes the
Windows installer and the Mac app (Intel and Apple Silicon in one) on GitHub's machines.

1. Bump `"version"` in `package.json` and commit.
2. Tag and push:
   ```
   git tag v1.2.0
   git push origin main v1.2.0
   ```
3. The release appears under Releases with both installers attached once the build finishes (about 10 minutes;
   progress is in the Actions tab).

The installers aren't code-signed, so Windows SmartScreen and macOS Gatekeeper warn on first launch (the README explains
how users get past it). Signing needs a Windows code-signing certificate and an Apple Developer account.

## Where things are
```
index.html          page structure
main.js             Electron main process (window, cover search)
preload.js          the small bridge the page can use
disk-store.js       reads and writes the library folder
styles/             one CSS file per area, imported by styles/main.css
src/
  main.js           start-up: load saved data, connect every module, first draw
  state.js          the shared `state` object (tiles, categories, layouts, mode flags)
  storage.js        saving and loading tiles, categories, layouts
  disk.js           where data lives: library folder in Electron, browser storage in a plain web page
  layout.js         grid cells and row positions
  render.js         draws the tiles
  drag.js           drag a tile to move it
  config.js, helpers.js, utils.js, dom.js   constants and small shared helpers
  edit-mode.js, image-drop.js, tile-editor.js, cover-editor.js, cover-art.js,
  size-picker.js, categories.js, selection.js, toolbar.js, menu.js, backup.js, dev-tools.js
  backgrounds/      store, crossfade, panel, manage, transfer, index
```
Each module with buttons or events exports an `init...()` function; `src/main.js` calls them once.
Anything shared between modules lives on `state` (for example `state.items`).

## The library folder
```
Documents/Beast Media Tracker/
  library.json         tiles, categories, layouts, sort, background settings (readable JSON)
  library.json.bak     the previous session's copy (made once each time the app starts)
  covers/              cover images and GIFs, one file each (identical images are stored once)
  backgrounds/         background images and GIFs
```
- If `library.json` is damaged, the app keeps it as `library.damaged-<time>.json`, restores from the backup and says so.
- On first start, anything saved by an older (browser-storage) version is copied into the folder; the old copy is left alone.
- Covers that are replaced or deleted stay in `covers/`.
- Opened as a plain web page (no Electron), the app uses the browser's own storage instead.
