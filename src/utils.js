// Small pure helpers.

export const round1 = (v) => Math.round(v * 10) / 10;

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Width ÷ height of a loaded picture, rounded to 4 decimals
export const aspectOf = (im) => +(im.naturalWidth / im.naturalHeight).toFixed(4);

// A loaded picture as a JPEG data URL, at most 1000px wide
export function shrinkImage(im, quality) {
  const sc = Math.min(1, 1000 / im.width);
  const c = document.createElement('canvas');
  c.width = im.width * sc;
  c.height = im.height * sc;
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

// Turns a base64 data: URL back into a Blob (throws if it isn't base64)
export function dataUrlToBlob(url, fallbackType) {
  const [head, body] = url.split(',');
  const type = (head.match(/data:([^;]+)/) || [])[1] || fallbackType;
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let n = 0; n < bin.length; n++) bytes[n] = bin.charCodeAt(n);
  return new Blob([bytes], { type });
}
