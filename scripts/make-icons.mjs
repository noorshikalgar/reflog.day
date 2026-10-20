#!/usr/bin/env node
// Draws the reflog app icon (a git branch: trunk + one side branch) as PNG and SVG.
// No dependencies. Run: node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../web/public/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const BG = [0x0b, 0x0d, 0x12];
const GREEN = [0x3d, 0xdc, 0x97];
const CYAN = [0x4c, 0xc9, 0xf0];

// Geometry on a 22×22 grid (same as the notification mockup).
function shapes(size, scale) {
  const k = (size * scale) / 22, o = (size - 22 * k) / 2;
  const P = (x, y) => [o + x * k, o + y * k];
  const curve = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48, u = 1 - t;
    const [x0, y0] = [6, 8], [x1, y1] = [6, 12], [x2, y2] = [16, 10], [x3, y3] = [16, 15];
    curve.push(P(u ** 3 * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * x3, u ** 3 * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y3));
  }
  return [
    { kind: 'line', pts: curve, w: 0.85 * k, color: CYAN },
    { kind: 'line', pts: [P(6, 5), P(6, 19)], w: 0.85 * k, color: GREEN },
    { kind: 'dot', c: P(6, 5), r: 2.4 * k, color: GREEN },
    { kind: 'dot', c: P(16, 16), r: 2.4 * k, color: CYAN },
  ];
}

function segDist(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

function inside(s, x, y) {
  if (s.kind === 'dot') return Math.hypot(x - s.c[0], y - s.c[1]) <= s.r;
  for (let i = 1; i < s.pts.length; i++) if (segDist(x, y, s.pts[i - 1], s.pts[i]) <= s.w) return true;
  return false;
}

function renderRGB(size, scale) {
  const list = shapes(size, scale);
  const SS = 3;
  const px = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const fx = x + (sx + .5) / SS, fy = y + (sy + .5) / SS;
        let c = BG;
        for (const s of list) if (inside(s, fx, fy)) c = s.color;
        r += c[0]; g += c[1]; b += c[2];
      }
      const n = SS * SS, i = (y * size + x) * 3;
      px[i] = r / n; px[i + 1] = g / n; px[i + 2] = b / n;
    }
  }
  return px;
}
const render = (size, scale) => png(size, renderRGB(size, scale));

const png = (size, rgb) => pngWH(size, size, rgb);
function pngWH(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcT[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

for (const [name, size, scale] of [['180.png', 180, .78], ['192.png', 192, .78], ['512.png', 512, .78], ['maskable.png', 512, .6]]) {
  writeFileSync(new URL(name, OUT), render(size, scale));
  console.log('icons/' + name);
}

// Launch screens: theme background with the icon in the middle (iOS shows them while the app opens).
const SPLASH = new URL('../web/public/splash/', import.meta.url);
mkdirSync(SPLASH, { recursive: true });
const SIZES = [[750, 1334], [828, 1792], [1125, 2436], [1170, 2532], [1179, 2556], [1206, 2622], [1284, 2778], [1290, 2796], [1320, 2868]];
for (const [w, h] of SIZES) {
  const box = Math.round(w * 0.24);
  const icon = renderRGB(box, 0.78);
  const px = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) { px[i * 3] = BG[0]; px[i * 3 + 1] = BG[1]; px[i * 3 + 2] = BG[2]; }
  const ox = Math.round((w - box) / 2), oy = Math.round((h - box) / 2);
  for (let y = 0; y < box; y++) icon.copy(px, ((oy + y) * w + ox) * 3, y * box * 3, (y + 1) * box * 3);
  writeFileSync(new URL(`${w}x${h}.png`, SPLASH), pngWH(w, h, px));
  console.log(`splash/${w}x${h}.png`);
}

writeFileSync(new URL('icon.svg', OUT), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22">
<rect width="22" height="22" rx="5" fill="#0b0d12"/>
<g fill="none" stroke-width="1.7" stroke-linecap="round" transform="translate(2.42 2.42) scale(.78)">
<path d="M6 8c0 4 10 2 10 7" stroke="#4cc9f0"/><path d="M6 5v14" stroke="#3ddc97"/>
<circle cx="6" cy="5" r="2.4" fill="#3ddc97" stroke="none"/><circle cx="16" cy="16" r="2.4" fill="#4cc9f0" stroke="none"/>
</g></svg>
`);
console.log('icons/icon.svg');
