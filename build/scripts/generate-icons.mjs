/**
 * Renders the PWA raster assets from `public/icons/icon.svg`.
 *
 *   node scripts/generate-icons.mjs
 *
 * The manifest needs real PNG files at fixed URLs (an install prompt that
 * 404s on its icon is an install prompt Chrome refuses), so the outputs are
 * committed rather than generated at build time. Re-run this after editing
 * the SVG.
 *
 * `sharp` ships with Next.js; it is not a direct dependency because nothing at
 * runtime needs it.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(join(root, "public/icons/icon.svg"));

/**
 * `public/icons/*` is what the manifest points at; `src/app/*` is the Next.js
 * file convention that emits the <link rel="icon"> tags. Both are rendered
 * from the one SVG so the home-screen icon and the browser-tab icon cannot
 * drift apart — which is exactly what would happen if the head icons were a
 * separate `ImageResponse` drawing in JSX.
 */
const TARGETS = [
  { size: 192, out: "public/icons/icon-192.png" },
  { size: 512, out: "public/icons/icon-512.png" },
  { size: 192, out: "src/app/icon.png" },
  { size: 180, out: "src/app/apple-icon.png" },
];

for (const { size, out } of TARGETS) {
  await sharp(source, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(root, out));
  console.log(`wrote ${out}`);
}

// Placeholder install-dialog screenshot. Chrome only shows the richer install
// UI when the manifest lists one, and a listed-but-missing file is worse than
// none — so ship a plain branded card until real product shots exist.
const screenshot = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
  <rect width="1280" height="720" fill="#ffffff"/>
  <rect x="0" y="0" width="1280" height="96" fill="#18181b"/>
  <text x="48" y="60" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="700">SlimRuimte</text>
  <text x="48" y="300" fill="#18181b" font-family="Arial, Helvetica, sans-serif" font-size="56" font-weight="700">Scan je ruimte.</text>
  <text x="48" y="372" fill="#18181b" font-family="Arial, Helvetica, sans-serif" font-size="56" font-weight="700">Zie je verbouwing.</text>
  <text x="48" y="440" fill="#71717a" font-family="Arial, Helvetica, sans-serif" font-size="28">AI renovatievisualisatie voor jouw ruimte</text>
</svg>`;

await mkdir(join(root, "public/screenshots"), { recursive: true });
await writeFile(
  join(root, "public/screenshots/homeowner-dashboard.png"),
  await sharp(Buffer.from(screenshot)).png().toBuffer(),
);
console.log("wrote public/screenshots/homeowner-dashboard.png");
