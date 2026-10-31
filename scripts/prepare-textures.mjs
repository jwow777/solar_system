import sharp from 'sharp';
import { readFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const sources = JSON.parse(await readFile(path.join(root, 'src/constants/textureSources.json'), 'utf8'));
let generated = 0;
// Sequential processing bounds memory usage when decoding 8K source maps.
for (const [key, filename] of Object.entries(sources)) {
  const source = path.join(root, 'src/assets/maps', filename);
  const sourceStat = await stat(source);
  for (const [quality, width] of [['2k', 2048], ['4k', 4096]]) {
    const destination = path.join(root, 'public/textures', quality, key + '.webp');
    const outputStat = await stat(destination).catch(() => undefined);
    if (outputStat && outputStat.mtimeMs >= sourceStat.mtimeMs) continue;
    await mkdir(path.dirname(destination), { recursive: true });
    await sharp(source).resize({ width, withoutEnlargement: true })
      .webp({ quality: 82, alphaQuality: 100 }).toFile(destination);
    generated++;
  }
}
console.log('Texture variants prepared: ' + generated + ' new, 2K overview / 4K detail.');
