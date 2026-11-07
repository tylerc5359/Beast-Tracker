# BEAST MEDIA TRACKER
<img width="350" height="350" alt="bear-head-logo-illustration-free-vector-removebg-preview" src="https://github.com/user-attachments/assets/4af9f3b0-589c-4824-a600-cbbcc78cf0e5" />

Keep track of everything you're watching, reading and playing on one shelf of cover art. Movies, shows, anime, manga,
books, albums and games all go on one grid you arrange however you like.

**[Download the latest version](https://github.com/tylerc5359/Beast-Tracker/releases/latest)** for Windows or Mac. It's free.

## Installing

### Windows
1. Download `Beast-Media-Tracker-Setup-<version>.exe` from the [latest release](https://github.com/tylerc5359/Beast-Tracker/releases/latest).
2. Run it. The app installs and opens by itself, and adds a Start menu shortcut.

If Windows says **"Windows protected your PC"**, click **More info**, then **Run anyway**. This appears because the app
isn't signed with a paid certificate yet; you only need to do it once.

### Mac
1. Download `Beast-Media-Tracker-<version>-mac.dmg` from the [latest release](https://github.com/tylerc5359/Beast-Tracker/releases/latest).
   It works on both Apple Silicon and Intel Macs.
2. Open it and drag **Beast Media Tracker** into **Applications**.
3. Open the app from Applications.

The first time, macOS will say it can't check the app for malicious software. To allow it:
1. Click **Done** (or **OK**) on the warning.
2. Open **System Settings → Privacy & Security**, scroll down and click **Open Anyway** next to Beast Media Tracker.
3. Confirm with your password. From then on it opens normally.

If macOS instead says the app **"is damaged and can't be opened"**, open the **Terminal** app, paste this line and press Return, then open the app again:
```
xattr -cr "/Applications/Beast Media Tracker.app"
```

## Getting started
1. Press **Edit** (top right). Empty spots on the shelf show a **+**.
2. Click a **+** to add a title. Give it a name, and add cover art if you like.
3. Press **Done** when you're finished arranging.

Click any tile to open it again and change it.

## What you can do

**Cover art**
- **Search free cover art** finds covers for movies, TV shows, anime, manga, books, albums and games.
- Or upload your own picture, paste one (Ctrl+V / Cmd+V), drag one in, or use **Find on Google Images**.
- Zoom with the slider or your mouse wheel, and drag the picture to choose which part shows. Animated GIFs keep moving.

**Tracking**
- Rate a title by clicking the stars on its tile.
- Drag along the bar at the bottom of a tile to set your progress, and add a note like "Season 2, ep 5".

**Arranging your shelf**
- In **Edit** mode, drag tiles anywhere. Other tiles move out of the way.
- Make a tile bigger or smaller with the **Tile size** grid when editing it.
- Drop image files from your computer onto empty spots to make picture tiles in one go.
- Turn on **Basic image tile** for a tile that shows only a picture and a title.

**Organizing**
- **Categories** (in the ☰ menu) lets you make groups like *Watching* or *Backlog*, each with its own
  sub-categories (*Movies*, *Series*…). Click a category at the top of the shelf to show only that group.
- Use the search box to find a title, and the sort menu to order by title, rating, progress or date added.
  **Custom** keeps your own arrangement.
- **Select** (in the ☰ menu) lets you move, resize or delete many tiles at once.

**Making it yours**
- **Theme** switches between light and dark.
- In **Edit** mode, **Backgrounds** lets you put your own images or GIFs behind the shelf. Use several and they fade
  into each other as you scroll.

## Your library and backups
Everything is saved automatically on your own computer, in a folder called **Beast Media Tracker** inside your
**Documents** folder. Choose **Data folder** in the ☰ menu to open it. Nothing is uploaded anywhere.

- **Back up:** choose **Export** in the ☰ menu to save your whole library (tiles, categories, layout and backgrounds)
  as one file. Keep a copy somewhere safe, like a USB stick or cloud drive.
- **Restore or move to another computer:** choose **Import** and pick that file. This replaces the current library.
- The app also keeps a copy of your previous session. If the library file ever gets damaged, the app restores it
  automatically and tells you.

## Updating
Download the newest version from the [releases page](https://github.com/tylerc5359/Beast-Tracker/releases/latest) and
install it the same way. Your library stays where it is.

## Uninstalling
- **Windows:** Settings → Apps → Installed apps → Beast Media Tracker → Uninstall.
- **Mac:** drag Beast Media Tracker from Applications to the Trash.

Your library folder in Documents is kept in both cases. Delete it yourself if you want it gone too.

---
Want to change the code or build it yourself? See [DEVELOPING.md](DEVELOPING.md).
