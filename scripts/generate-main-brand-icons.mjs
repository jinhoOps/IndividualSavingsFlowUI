import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { renderMainBrandSvg } from '../shared/brand/mainBrandGeometry.js';

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDirectory = resolve(rootDirectory, 'public/icons');
const checkOnly = process.argv.includes('--check');

async function createAssets() {
  const sourceSvg = Buffer.from(renderMainBrandSvg(512));
  return [
    { path: resolve(iconsDirectory, 'icon-source.svg'), contents: sourceSvg },
    { path: resolve(iconsDirectory, 'icon-192.svg'), contents: Buffer.from(renderMainBrandSvg(192)) },
    { path: resolve(iconsDirectory, 'icon-512.svg'), contents: Buffer.from(renderMainBrandSvg(512)) },
    { path: resolve(iconsDirectory, 'icon-192.png'), contents: await sharp(sourceSvg).resize(192, 192).png().toBuffer() },
    { path: resolve(iconsDirectory, 'icon-512.png'), contents: await sharp(sourceSvg).resize(512, 512).png().toBuffer() },
  ];
}

async function assertAssetsAreCurrent(assets) {
  const staleAssets = [];
  for (const asset of assets) {
    try {
      const committedContents = await readFile(asset.path);
      if (!committedContents.equals(asset.contents)) staleAssets.push(asset.path);
    } catch {
      staleAssets.push(asset.path);
    }
  }

  if (staleAssets.length > 0) {
    throw new Error(`Main brand assets are stale: ${staleAssets.join(', ')}`);
  }
}

const assets = await createAssets();

if (checkOnly) {
  await assertAssetsAreCurrent(assets);
} else {
  await Promise.all(assets.map((asset) => writeFile(asset.path, asset.contents)));
}
