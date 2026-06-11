import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. package.json 로드
const packageJsonPath = path.join(rootDir, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error(`[Bump-Version] Error: package.json not found at ${packageJsonPath}`);
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;

// 2. 버전 파싱 및 패치 버전 범프 (x.y.z -> x.y.(z+1))
const versionParts = currentVersion.split('.').map(Number);

if (versionParts.length === 3 && versionParts.every(n => !isNaN(n))) {
  versionParts[2] += 1; // 패치 버전 1 증가
  const nextVersion = versionParts.join('.');
  packageJson.version = nextVersion;
  
  // 변경된 내용을 package.json에 쓰기 (포맷 유지)
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
  console.log(`[Bump-Version] Successfully bumped version from ${currentVersion} to ${nextVersion}`);
} else {
  console.error(`[Bump-Version] Error: Invalid version format in package.json - "${currentVersion}"`);
  process.exit(1);
}
