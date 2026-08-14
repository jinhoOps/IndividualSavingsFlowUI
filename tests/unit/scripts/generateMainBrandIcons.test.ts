import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDirectory = resolve(import.meta.dirname, '../../..');

function readPngSize(path: string) {
  const png = readFileSync(path);
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

function parseSvg(path: string) {
  const svg = readFileSync(path, 'utf8');
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
  const trend = svg.match(/data-brand-trend="([^"]*)"/)?.[1];
  const trendBounds = svg.match(/<polyline[^>]*data-brand-essential-bounds="([^"]+)"/)?.[1]
    .split(' ')
    .map(Number);
  const colors = svg.match(/data-brand-colors="([^"]+)"/)?.[1];
  const essentialBounds = [...svg.matchAll(/data-brand-essential-bounds="([^"]+)"/g)]
    .map((match) => match[1].split(' ').map(Number));

  return { viewBox, trend, trendBounds, colors, essentialBounds };
}

describe('generate-main-brand-icons', () => {
  it('keeps the committed manifest icons derived from one maskable brand source', () => {
    execFileSync(process.execPath, ['scripts/generate-main-brand-icons.mjs', '--check'], {
      cwd: rootDirectory,
      stdio: 'pipe',
    });

    const manifest = JSON.parse(readFileSync(resolve(rootDirectory, 'public/manifest.webmanifest'), 'utf8'));
    expect(manifest.icons.map(({ src }: { src: string }) => src)).toEqual([
      'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-192.svg', 'icons/icon-512.svg',
    ]);
    expect(manifest.icons.map(({ purpose }: { purpose: string }) => purpose)).toEqual([
      'any maskable', 'any maskable', 'any maskable', 'any maskable',
    ]);
    expect(readPngSize(resolve(rootDirectory, 'public/icons/icon-192.png'))).toEqual({ width: 192, height: 192 });
    expect(readPngSize(resolve(rootDirectory, 'public/icons/icon-512.png'))).toEqual({ width: 512, height: 512 });

    const source = parseSvg(resolve(rootDirectory, 'public/icons/icon-source.svg'));
    const icon192 = parseSvg(resolve(rootDirectory, 'public/icons/icon-192.svg'));
    const icon512 = parseSvg(resolve(rootDirectory, 'public/icons/icon-512.svg'));
    expect([source.viewBox, icon192.viewBox, icon512.viewBox]).toEqual([
      '0 0 512 512', '0 0 512 512', '0 0 512 512',
    ]);
    expect([source.trend, icon192.trend, icon512.trend]).toEqual([
      '174,236 215,264 256,204 297,216 338,132',
      '174,236 215,264 256,204 297,216 338,132',
      '174,236 215,264 256,204 297,216 338,132',
    ]);
    expect([source.trendBounds, icon192.trendBounds, icon512.trendBounds]).toEqual([
      [167, 125, 178, 146],
      [167, 125, 178, 146],
      [167, 125, 178, 146],
    ]);
    expect([source.colors, icon192.colors, icon512.colors]).toEqual([
      '#ea5b2a #1e8b7c #173a3a',
      '#ea5b2a #1e8b7c #173a3a',
      '#ea5b2a #1e8b7c #173a3a',
    ]);

    for (const svg of [source, icon192, icon512]) {
      expect(svg.essentialBounds).not.toHaveLength(0);
      for (const [x, y, width, height] of svg.essentialBounds) {
        expect(x).toBeGreaterThanOrEqual(102.4);
        expect(y).toBeGreaterThanOrEqual(102.4);
        expect(x + width).toBeLessThanOrEqual(409.6);
        expect(y + height).toBeLessThanOrEqual(409.6);
      }
    }
  });
});
