---
type: node
created: 2026-05-04
updated: 2026-05-07
status: evergreen
tags: [governance, versioning, pwa, build, cicd]
---

# 📌 Version Management Principles (버전 관리 원칙)

프로젝트의 일관성 있는 버전 관리와 PWA 캐시 갱신 무결성을 보장하기 위한 지침입니다.

## 1. 버전 번호 체계 (SemVer)

본 프로젝트는 **Semantic Versioning (SemVer)** 표준을 엄격히 준수합니다.

- **Major (X.0.0)**: 하위 호환성이 깨지는 아키텍처의 근본적 변화.
- **Minor (0.X.0)**: 하위 호환성을 유지하면서 새로운 기능 추가.
- **Patch (0.0.X)**: 하위 호환성을 유지하면서 버그 수정 및 최적화.

**원칙**: 대외적 명칭, 로드맵, 기술적 명세(`package.json`)의 버전을 하나로 통일하여 혼선을 방지합니다.

## 2. SSOT 버전 관리 (Single Source of Truth)

- **Source of Truth**: 모든 버전 정보의 원천은 오직 **`package.json`**의 `version` 필드입니다.
- **Runtime Injection**: 빌드 도구(Vite)가 빌드 타임에 `package.json`의 버전을 읽어 전역 상수(`__APP_VERSION__`)로 주입합니다.
- **UI Display**: 앱 헤더 및 각종 알림 UI는 `IsfUtils.APP_VERSION`을 참조하며, 이 값은 빌드 시 자동 주입된 값을 우선 사용합니다.

## 3. Triple Sync 자동화 (Vite Build)

과거 수동으로 맞추던 'Triple Sync'(package.json, sw.js, manifest)는 이제 빌드 시스템에 의해 자동화됩니다.

1. **Vite Define**: `vite.config.ts`에서 `define` 설정을 통해 JS 코드 내에 버전을 주입합니다.
2. **PWA Manifest**: `vite-plugin-pwa`가 `package.json`의 버전을 읽어 `manifest.webmanifest`에 자동으로 반영합니다.
3. **Service Worker**: PWA 플러그인이 신규 버전에 맞는 Service Worker를 생성하여 캐시를 강제 갱신합니다.

## 4. 버전 업데이트 워크플로우

1. **Bump Version**: 작업 완료 후 `npm version patch` (또는 minor/major) 명령을 통해 `package.json` 버전을 올립니다.
2. **Static Sync (Optional)**: No-build 환경(Vite 없이 직접 index.html 실행)에서의 정합성을 위해, `shared/core/utils.js` 등 정적 파일의 폴백 버전도 `package.json`과 동일하게 유지합니다.
3. **Build & Deploy**: GitHub Actions를 통해 빌드 시 최신 버전이 모든 아티팩트에 주입되어 배포됩니다.

---
*연결 노드:* [[Operating_Principles]], [[Project_History]], [[Architecture_Reference]]
