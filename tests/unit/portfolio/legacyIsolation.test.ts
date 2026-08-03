/// <reference types="node" />

import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Portfolio legacy isolation', () => {
  it('keeps current runtime free of legacy Portfolio contracts', async () => {
    const portfolioEntry = resolve(process.cwd(), 'src/portfolio/main.tsx');
    const mainSource = resolve(process.cwd(), 'src/portfolio/infrastructure/mainSourceRepository.ts');
    const mainValidation = resolve(process.cwd(), 'src/main/domain/validation.ts');
    const graph = await readRuntimeGraph(portfolioEntry);

    expect(graph.has(mainSource)).toBe(true);
    expect(graph.has(mainValidation)).toBe(true);

    const entry = await readFile(resolve(process.cwd(), 'apps/portfolio/index.html'), 'utf8');
    const runtime = `${[...graph.values()].join('\n')}\n${entry}`;
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

async function readRuntimeGraph(entryPath: string): Promise<Map<string, string>> {
  const graph = new Map<string, string>();

  async function visit(modulePath: string): Promise<void> {
    const resolvedPath = resolve(modulePath);
    if (graph.has(resolvedPath)) return;

    const source = await readFile(resolvedPath, 'utf8');
    graph.set(resolvedPath, source);

    for (const specifier of readStaticRelativeImports(source)) {
      const importedPath = await resolveStaticImport(resolvedPath, specifier);
      if (importedPath !== null) await visit(importedPath);
    }
  }

  await visit(entryPath);
  return graph;
}

function readStaticRelativeImports(source: string): string[] {
  const specifiers: string[] = [];
  const fromImport = /\b(?:import|export)\s+(?:type\s+)?[^;]*?\bfrom\s*['"](\.[^'"]+)['"]/g;
  const sideEffectImport = /\bimport\s*['"](\.[^'"]+)['"]/g;

  for (const pattern of [fromImport, sideEffectImport]) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
}

async function resolveStaticImport(importerPath: string, specifier: string): Promise<string | null> {
  const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx'];
  const basePath = resolve(dirname(importerPath), specifier);
  const extension = extname(basePath);
  if (extension !== '' && !supportedExtensions.includes(extension)) return null;

  const candidates = extension === ''
    ? [
      ...supportedExtensions.map((candidateExtension) => `${basePath}${candidateExtension}`),
      ...supportedExtensions.map((candidateExtension) => join(basePath, `index${candidateExtension}`)),
    ]
    : [basePath];

  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }
  return null;
}
