#!/usr/bin/env node
/**
 * Derives everything the show needs from each poster in public/posters/NN.webp:
 *   NN-sm.webp  thumbnail for the lobby wall and review page
 *   NN-bg.webp  pre-blurred ambient backdrop for that film's premiere (blurring
 *               here keeps a heavy CSS blur off the projector laptop's GPU)
 *   src/data/poster-colors.json  one accent colour per film
 * Re-run after adding or replacing a poster:  node scripts/poster-assets.mjs
 */
import { readdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const DIR = "public/posters";
const posters = readdirSync(DIR).filter((f) => /^\d\d\.webp$/.test(f)).sort();

function toHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

const colors = {};
for (const file of posters) {
  const n = file.slice(0, 2);
  const src = sharp(`${DIR}/${file}`);
  const { width, height } = await src.metadata();
  // the art lives in the top ~62%; the rest is the dark band kept clear for the title
  const art = { left: 0, top: 0, width, height: Math.round(height * 0.62) };

  await sharp(`${DIR}/${file}`).resize(400, 600, { fit: "cover" }).webp({ quality: 78 }).toFile(`${DIR}/${n}-sm.webp`);

  await sharp(`${DIR}/${file}`)
    .extract(art)
    // down to a handful of pixels and back up: only the palette survives, no recognisable shapes
    .resize(14, 8, { fit: "cover" })
    .resize(960, 540, { kernel: "cubic" })
    .blur(18)
    .modulate({ brightness: 0.85, saturation: 1.7 })
    .webp({ quality: 70 })
    .toFile(`${DIR}/${n}-bg.webp`);

  // accent: the most saturated of a coarse grid of samples, pushed to a readable lightness
  const { data } = await sharp(`${DIR}/${file}`).extract(art).resize(12, 8, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let best = [40, 0.5, 0.7], score = -1;
  for (let i = 0; i < data.length; i += 3) {
    const [h, s, l] = toHsl(data[i], data[i + 1], data[i + 2]);
    const sc = s * (1 - Math.abs(l - 0.55)); // vivid mid-tones win over near-black or blown-out pixels
    if (sc > score) (score = sc), (best = [h, s, l]);
  }
  colors[n] = `hsl(${Math.round(best[0])} ${Math.round(Math.max(0.6, best[1]) * 100)}% 74%)`;
  process.stdout.write(`${n} `);
}
writeFileSync("src/data/poster-colors.json", JSON.stringify(colors, null, 2) + "\n");
console.log(`\n${posters.length} posters processed`);
