import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. package.json 버전 읽기
const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

console.log(`[Sync-Version] Detected version: v${version}`);

// 2. 동기화 대상 파일 및 패턴 정의
const targets = [
  {
    path: 'public/manifest.webmanifest',
    pattern: /"version":\s*"[^"]*"/,
    replacement: `"version": "${version}"`
  },
  {
    path: 'shared/legacy/sw.js',
    pattern: /const APP_VERSION = "[^"]*";/,
    replacement: `const APP_VERSION = "${version}";`
  },
  {
    path: 'shared/core/utils.js',
    pattern: /APP_VERSION:\s*\(typeof __APP_VERSION__ !== "undefined"\) \? __APP_VERSION__ : "[^"]*"/,
    replacement: `APP_VERSION: (typeof __APP_VERSION__ !== "undefined") ? __APP_VERSION__ : "${version}"`
  }
];

// 3. 파일 업데이트 실행
targets.forEach(target => {
  const filePath = path.join(rootDir, target.path);
  if (!fs.existsSync(filePath)) {
    console.warn(`[Sync-Version] Skip: File not found - ${target.path}`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (target.pattern.test(content)) {
    const updatedContent = content.replace(target.pattern, target.replacement);
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    console.log(`[Sync-Version] Updated: ${target.path}`);
  } else {
    console.warn(`[Sync-Version] Warning: Pattern match failed in ${target.path}`);
  }
});

console.log('[Sync-Version] Done.');
