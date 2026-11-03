// Renders the Rentora mark (see src/components/app/brand.tsx) to the PWA icon PNGs in public/icons.
// Usage: node scripts/generate-icons.mjs
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const out = join(process.cwd(), "public", "icons");
mkdirSync(out, { recursive: true });

// The mark on a 24-unit grid. `pad` shrinks it inside a full-bleed navy square (for maskable icons).
function svg({ pad = 0, rounded = true } = {}) {
  const s = 24 - pad * 2;
  const k = s / 24;
  const t = (x, y) => `${pad + x * k} ${pad + y * k}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <rect width="24" height="24" rx="${rounded ? 6 : 0}" fill="#172a46"/>
  <path d="M${t(7.5, 19)}V${pad + 11 * k}a${4.5 * k} ${4.5 * k} 0 0 1 ${9 * k} 0v${8 * k}" fill="none" stroke="#fff" stroke-width="${1.8 * k}" stroke-linecap="round"/>
  <path d="M${t(5.5, 19)}h${13 * k}" stroke="#fff" stroke-width="${1.8 * k}" stroke-linecap="round"/>
  <circle cx="${pad + 14 * k}" cy="${pad + 14.5 * k}" r="${1.3 * k}" fill="#5fb3c6"/>
</svg>`;
}

const jobs = [
  ["icon-192.png", 192, svg()],
  ["icon-512.png", 512, svg()],
  ["maskable-512.png", 512, svg({ pad: 4.8, rounded: false })], // keeps the mark inside the 80% safe zone
  ["apple-touch-icon.png", 180, svg({ pad: 2.4, rounded: false })],
];

for (const [name, size, source] of jobs) {
  await sharp(Buffer.from(source), { density: 512 }).resize(size, size).png().toFile(join(out, name));
  console.log(`wrote public/icons/${name}`);
}
