// Getting a cover picture: upload, paste, drag, Google link and free cover search.
import { MAX_GIF_BYTES } from './config.js';
import { $ } from './dom.js';
import { setCover } from './cover-editor.js';
import { shrinkImage } from './utils.js';

function readCover(file) {
  if (!file || !file.type.startsWith('image/')) return;

  // GIFs are stored untouched so they keep animating (resizing would flatten them)
  if (file.type === 'image/gif') {
    if (file.size > MAX_GIF_BYTES) {
      $('covermsg').textContent = `That GIF is ${(file.size / 1048576).toFixed(1)} MB. GIF covers can be up to ${(MAX_GIF_BYTES / 1048576).toFixed(1)} MB.`;
      return;
    }
    const gr = new FileReader();
    gr.onload = () => setCover(gr.result);
    gr.readAsDataURL(file);
    return;
  }

  const r = new FileReader();
  r.onload = () => {
    const im = new Image();
    im.onload = () => setCover(shrinkImage(im, 0.82));
    im.src = r.result;
  };
  r.readAsDataURL(file);
}

export function findLink() {
  const t = $('title').value.trim();
  $('gfind').href = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(t + ' cover art')}`;
}

// Free cover search (only in the Electron app, which provides window.beastApi)
const API = window.beastApi;

async function runSearch() {
  const q = $('sq').value.trim();
  if (!q) return;
  $('smsg').textContent = 'Searching…';
  $('sres').textContent = '';

  try {
    const results = await API.search($('skind').value, q);
    $('smsg').textContent = results.length ? '' : 'No results. Try a shorter title or another media type.';
    results.forEach((x) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.title = x.title;
      b.style.cssText =
        'border: 0; padding: 0; background: var(--bg); border-radius: 8px; overflow: hidden; cursor: pointer; aspect-ratio: 2/3';

      const im = document.createElement('img');
      im.src = x.thumb;
      im.alt = x.title;
      im.style.cssText = 'width: 100%; height: 100%; object-fit: cover';
      im.onerror = () => b.remove();

      b.append(im);
      b.onclick = () => useCover(x);
      $('sres').append(b);
    });
  } catch (e) {
    $('smsg').textContent = 'Search failed. Check your internet connection.';
  }
}

async function useCover(x) {
  $('smsg').textContent = 'Saving cover…';
  try {
    const d = await API.image(x.full);

    // Keep GIFs animated
    if (d.startsWith('data:image/gif')) {
      if (d.length > MAX_GIF_BYTES * 1.37) {
        $('smsg').textContent = 'That GIF is too large to store. Try another.';
        return;
      }
      setCover(d);
      $('sdlg').close();
      return;
    }

    const im = new Image();
    im.onload = () => {
      setCover(shrinkImage(im, 0.85));
      $('sdlg').close();
    };
    im.src = d;
  } catch (e) {
    $('smsg').textContent = 'Couldn’t download that image. Try another.';
  }
}

// Connects this module's buttons and events to the page (called once at start-up)
export function initCoverArt() {
  $('title').addEventListener('input', findLink);

  $('pick').onclick = () => $('cf').click();

  $('clr').onclick = () => setCover('');

  $('dlg').addEventListener('paste', (e) => {
    const f = [...((e.clipboardData && e.clipboardData.files) || [])].find((x) => x.type.startsWith('image/'));
    if (f) {
      e.preventDefault();
      readCover(f);
    }
  });

  $('cv').addEventListener('dragover', (e) => e.preventDefault());

  $('cv').addEventListener('drop', (e) => {
    e.preventDefault();
    readCover(e.dataTransfer.files[0]);
  });

  $('cf').onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    readCover(f);
    e.target.value = '';
  };

  if (API) $('sfind').hidden = false;

  $('sfind').onclick = () => {
    $('sq').value = $('title').value;
    $('sres').textContent = '';
    $('smsg').textContent = '';
    $('sdlg').showModal();
    if ($('sq').value) runSearch();
  };

  $('sclose').onclick = () => $('sdlg').close();

  $('sgo').onclick = () => runSearch();

  $('sq').onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runSearch();
    }
  };
}
