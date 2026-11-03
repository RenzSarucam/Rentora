// Render the shared Rentora vector to browser and installed-app assets.
// Usage: npm run icons
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { BRAND_GROUND, BRAND_INK, BRAND_MARK_PATH, BRAND_VIEW_BOX } from "../src/lib/brand-artwork";

const icons = join(process.cwd(), "public", "icons");
const brand = join(process.cwd(), "public", "brand");
mkdirSync(icons, { recursive: true });
mkdirSync(brand, { recursive: true });

function mark() {
  return `<path d="${BRAND_MARK_PATH}" fill="${BRAND_INK}" fill-rule="evenodd"/>`;
}

function appIcon({ scale = 1, rounded = true }: { scale?: number; rounded?: boolean } = {}) {
  const offset = (64 - 64 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_VIEW_BOX}">
  <rect width="64" height="64" rx="${rounded ? 14 : 0}" fill="${BRAND_GROUND}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">${mark()}</g>
</svg>`;
}

const jobs: [string, number, string][] = [
  ["icon-192.png", 192, appIcon()],
  ["icon-512.png", 512, appIcon()],
  // All corners of the artwork stay within the maskable icon's central safe circle.
  ["maskable-512.png", 512, appIcon({ scale: 0.7, rounded: false })],
  ["apple-touch-icon.png", 180, appIcon({ scale: 0.9, rounded: false })],
];

async function writeFavicon() {
  const sizes = [16, 32, 48];
  const frames = await Promise.all(sizes.map((size) =>
    sharp(Buffer.from(appIcon()), { density: 576 }).resize(size, size).png().toBuffer(),
  ));
  // ICO directory followed by PNG frames for standard browser-tab sizes.
  const directory = Buffer.alloc(6 + 16 * frames.length);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(frames.length, 4);
  let offset = directory.length;
  frames.forEach((frame, i) => {
    const entry = 6 + 16 * i;
    directory.writeUInt8(sizes[i], entry);
    directory.writeUInt8(sizes[i], entry + 1);
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(frame.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += frame.length;
  });
  writeFileSync(join(process.cwd(), "public", "favicon.ico"), Buffer.concat([directory, ...frames]));
}

async function main() {
  for (const [name, size, svg] of jobs) {
    await sharp(Buffer.from(svg), { density: 576 }).resize(size, size).png().toFile(join(icons, name));
    console.info(`Wrote public/icons/${name}`);
  }

  writeFileSync(join(icons, "favicon.svg"), appIcon());
  await writeFavicon();
  writeFileSync(join(brand, "rentora-mark.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_VIEW_BOX}" role="img" aria-labelledby="title"><title id="title">Rentora boarding house</title>${mark()}</svg>\n`);
  console.info("Wrote SVG/ICO favicons and transparent brand mark");
}

main().catch(() => { console.error("Icon generation failed"); process.exitCode = 1; });
