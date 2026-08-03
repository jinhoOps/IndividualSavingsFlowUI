/// <reference types="node" />

import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Portfolio legacy isolation', () => {
  it('keeps current runtime free of legacy Portfolio contracts', async () => {
    const source = await readTree(resolve(process.cwd(), 'src/portfolio'));
    const entry = await readFile(resolve(process.cwd(), 'apps/portfolio/index.html'), 'utf8');
    const runtime = `${source}\n${entry}`;
    for (const forbidden of [
      'apps/portfolio/app.js',
      'apps/portfolio/modules',
      'src/entries/step3.ts',
      'isf-step3-portfolios-v2',
      'isf-step3-snapshots-v1',
      'IsfStorageHub',
      'isf-rebuild-v1',
    ]) {
      expect(runtime).not.toContain(forbidden);
    }
  });
});

async function readTree(directory: string): Promise<string> {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? readTree(path) : readFile(path, 'utf8');
  }));
  return contents.join('\n');
}
