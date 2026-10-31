import sharp from 'sharp';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const sources = JSON.parse(await readFile(path.join(root, 'src/constants/moonTextureCredits.json'), 'utf8'));
const directory = path.join(root, 'src/assets/maps/moons');
await mkdir(directory, { recursive: true });
for (const source of sources) {
  const destination = path.join(directory, source.id + '.jpg');
  if (await stat(destination).catch(() => null)) { console.log(source.id + ': already downloaded'); continue; }
  const response = await fetch(source.url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(source.id + ': HTTP ' + response.status);
  let image = sharp(Buffer.from(await response.arrayBuffer()), { limitInputPixels: 300_000_000 });
  if (source.crop) image = image.extract(source.crop);
  image = image.resize({ width: 4096, withoutEnlargement: true }).removeAlpha().toColourspace('srgb');
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  if (info.width !== info.height * 2) throw new Error(source.id + ': expected equirectangular 2:1 map');
  if (source.fillMissing) {
    // Black in these mosaics denotes missing coverage, not black surface material.
    // Use a featureless neutral patch; never clone terrain into unobserved regions.
    for (let i = 0; i < data.length; i += info.channels) {
      const value = Math.max(data[i], data[i + 1], data[i + 2]);
      if (value < 12) {
        const blend = Math.min(1, value / 12);
        for (let c = 0; c < 3; c++) data[i + c] = Math.round(110 * (1 - blend) + data[i + c] * blend);
      }
    }
  }
  const output = await sharp(data, { raw: info }).jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toBuffer();
  await writeFile(destination, output);
  console.log(source.id + ': ' + info.width + '×' + info.height + ', ' + (output.length / 1024).toFixed(0) + ' KB');
}
