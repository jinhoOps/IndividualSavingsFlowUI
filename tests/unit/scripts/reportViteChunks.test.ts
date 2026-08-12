import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const reporterPath = resolve(process.cwd(), 'scripts/report-vite-chunks.mjs');
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('report-vite-chunks', () => {
  it('reports root HTML bytes separately from the four JavaScript entry baselines', () => {
    const workingDirectory = mkdtempSync(resolve(tmpdir(), 'isf-vite-chunks-'));
    temporaryDirectories.push(workingDirectory);
    const distDirectory = resolve(workingDirectory, 'dist');
    const assetsDirectory = resolve(distDirectory, 'assets');
    mkdirSync(resolve(distDirectory, '.vite'), { recursive: true });
    mkdirSync(assetsDirectory, { recursive: true });

    writeFileSync(resolve(distDirectory, 'index.html'), 'root-html');
    writeFileSync(resolve(assetsDirectory, 'shared.js'), 'shared');
    writeFileSync(resolve(assetsDirectory, 'account-map.js'), 'account');
    writeFileSync(resolve(assetsDirectory, 'main.js'), 'main');
    writeFileSync(resolve(assetsDirectory, 'portfolio.js'), 'portfolio');
    writeFileSync(resolve(assetsDirectory, 'simulation.js'), 'simulation');
    writeFileSync(
      resolve(distDirectory, '.vite/manifest.json'),
      JSON.stringify({
        '_shared.js': { file: 'assets/shared.js' },
        'apps/account-map/index.html': {
          file: 'assets/account-map.js',
          name: 'accountMap',
          isEntry: true,
          imports: ['_shared.js'],
        },
        'apps/main/index.html': {
          file: 'assets/main.js',
          name: 'mainApp',
          isEntry: true,
          imports: ['_shared.js'],
        },
        'apps/portfolio/index.html': {
          file: 'assets/portfolio.js',
          name: 'portfolio',
          isEntry: true,
          imports: ['_shared.js'],
        },
        'apps/simulation/index.html': {
          file: 'assets/simulation.js',
          name: 'simulation',
          isEntry: true,
          imports: ['_shared.js'],
        },
      }),
    );

    const output = execFileSync(process.execPath, [reporterPath], {
      cwd: workingDirectory,
      encoding: 'utf8',
    });

    expect(JSON.parse(output)).toEqual({
      rootHtmlBytes: 9,
      accountMap: {
        entryBytes: 7,
        initialBytes: 13,
        files: ['assets/account-map.js', 'assets/shared.js'],
      },
      mainApp: {
        entryBytes: 4,
        initialBytes: 10,
        files: ['assets/main.js', 'assets/shared.js'],
      },
      portfolio: {
        entryBytes: 9,
        initialBytes: 15,
        files: ['assets/portfolio.js', 'assets/shared.js'],
      },
      simulation: {
        entryBytes: 10,
        initialBytes: 16,
        files: ['assets/shared.js', 'assets/simulation.js'],
      },
    });
  });
});
