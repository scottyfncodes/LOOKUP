// Renders the PNG icons from a tiny software rasteriser, so the build needs no
// image toolchain. Run `npm run icons` after editing the design below.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const STARS = [[120, 120, 5], [392, 96, 4], [440, 200, 3], [80, 260, 3], [300, 70, 3], [180, 200, 3.5], [420, 320, 3], [90, 380, 4], [350, 160, 2.5]];
const STAR = [[256, 128], [278, 190], [344, 194], [292, 234], [310, 298], [256, 262], [202, 298], [220, 234], [168, 194], [234, 190]];

function inPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function hillY(x, lift) { // quadratic bezier through (0,420)->(120,340)->(256,372) then (256,372)->(392,404)->(512,350)
  const seg = x < 256 ? [[0, 420], [120, 340], [256, 372]] : [[256, 372], [392, 404], [512, 350]];
  const t = x < 256 ? x / 256 : (x - 256) / 256;
  const y = (1 - t) ** 2 * seg[0][1] + 2 * (1 - t) * t * seg[1][1] + t * t * seg[2][1];
  return y + lift;
}

function render(size, maskable) {
  const buf = Buffer.alloc(size * size * 4);
  const s = 512 / size;
  const r = maskable ? 0 : 112;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = (x + 0.5) * s, py = (y + 0.5) * s;
    // rounded-rect mask
    let a = 255;
    if (!maskable) {
      const dx = Math.max(r - px, 0, px - (512 - r)), dy = Math.max(r - py, 0, py - (512 - r));
      if (dx * dx + dy * dy > r * r) a = 0;
    }
    // sky gradient
    const d = Math.hypot(px - 256, py - 180) / 380;
    const mix = Math.min(1, d);
    let R = Math.round(26 + (7 - 26) * mix), G = Math.round(37 + (10 - 37) * mix), B = Math.round(71 + (18 - 71) * mix);
    for (const [sx, sy, sr] of STARS) if (Math.hypot(px - sx, py - sy) < sr) { R = 244; G = 236; B = 216; }
    if (inPoly(px, py, STAR)) { R = 255; G = 216; B = 107; }
    if (py > hillY(px, 0)) { R = 11; G = 15; B = 28; }
    if (py > hillY(px, 10)) { R = 17; G = 23; B = 42; }
    const i = (y * size + x) * 4;
    buf[i] = R; buf[i + 1] = G; buf[i + 2] = B; buf[i + 3] = a;
  }
  return png(size, size, buf);
}

writeFileSync('public/icon-192.png', render(192, false));
writeFileSync('public/icon-512.png', render(512, false));
writeFileSync('public/icon-maskable-512.png', render(512, true));
writeFileSync('public/apple-touch-icon.png', render(180, true));
console.log('icons written');
