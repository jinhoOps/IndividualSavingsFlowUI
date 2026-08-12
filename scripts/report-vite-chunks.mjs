import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const distDirectory = resolve('dist');
const manifestPath = resolve(distDirectory, '.vite/manifest.json');

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (error) {
  console.error(`Unable to read Vite manifest at ${manifestPath}: ${error.message}`);
  process.exitCode = 1;
}

if (manifest) {
  const collectInitialFiles = (manifestKey, collected = new Set()) => {
    if (collected.has(manifestKey)) return collected;

    const chunk = manifest[manifestKey];
    if (!chunk) throw new Error(`Manifest import is missing: ${manifestKey}`);

    collected.add(manifestKey);
    for (const importedKey of chunk.imports ?? []) {
      collectInitialFiles(importedKey, collected);
    }
    return collected;
  };

  const report = {
    rootHtmlBytes: statSync(resolve(distDirectory, 'index.html')).size,
  };
  const entries = Object.entries(manifest)
    .filter(([, chunk]) => chunk.isEntry)
    .sort(([, left], [, right]) => left.name.localeCompare(right.name));

  for (const [manifestKey, entry] of entries) {
    const files = [...collectInitialFiles(manifestKey)]
      .map((key) => manifest[key].file)
      .sort();
    const entryBytes = statSync(resolve(distDirectory, entry.file)).size;
    const initialBytes = files.reduce(
      (total, file) => total + statSync(resolve(distDirectory, file)).size,
      0,
    );

    report[entry.name] = { entryBytes, initialBytes, files };
  }

  console.log(JSON.stringify(report, null, 2));
}
