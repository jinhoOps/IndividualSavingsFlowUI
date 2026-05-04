---
type: node
created: 2026-05-04
status: evergreen
tags: [governance, versioning, pwa, build, cicd]
---

# 📌 Version Management Principles (버전 관리 원칙)

v1.1.0-alpha.1 이후의 현대화된 버전 관리 및 배포 지침입니다.

## 1. 버전 번호 체계 (SemVer)

- **Major (X.0.0)**: 아키텍처의 근본적 변화 (예: 프레임워크 전면 교체).
- **Minor (0.X.0)**: 새로운 기능 추가 또는 대규모 리팩터링.
- **Patch (0.0.X)**: 버그 수정, 스타일 미세 조정, 캐시 갱신용 버전 범프.

## 2. SSOT 버전 관리 (Single Source of Truth)

- **package.json**: 프로젝트의 중심 버전은 오직 `package.json`의 `version` 필드에서 관리합니다.
- **Automated Sync**: 빌드 도구(Vite)가 `package.json`의 버전을 읽어 `sw.js` 및 PWA 매니페스트에 주입하거나 캐시 이름을 결정합니다. 더 이상 수동으로 여러 파일의 문자열을 고치지 않습니다.

## 3. Triple Sync 자동화 (v1.1+)

과거에는 3개 파일의 버전을 수동으로 맞추는 'Triple Sync'가 필수였으나, 이제는 **빌드 시스템**이 이를 수행합니다.
1. `package.json` 버전 변경.
2. `npm run build` 실행.
3. Vite PWA 플러그인이 신규 버전의 Service Worker를 생성하여 브라우저 캐시를 강제 갱신.

## 4. 배포 프로토콜 (GitHub Actions)

GitHub 리포지토리의 설정은 **GitHub Actions** 배포 모드로 고정되어야 합니다.
- **브랜치 규칙**: 
  - `main`: 프로덕션 안정 버전.
  - `feat/modern-poc`: 현대화 및 POC 실험 브랜치.
- **트리거**: 해당 브랜치에 `push` 발생 시 Actions가 돌아가며 `npm run build` 후 `dist/` 폴더를 GitHub Pages에 자동 게시합니다.

## 5. 특이 사항 (Modern Invariant)
본 프로젝트는 현대적 개발 환경을 지향하지만, 결과물은 여전히 **서버 없이도 동작 가능한 정적 파일(Static Assets)** 형태를 유지해야 합니다. 이는 PWA의 오프라인 우선(Offline-first) 철학을 계승하기 위함입니다.

---
*연결 노드:* [[Operating_Principles]], [[Project_History]], [[Architecture_Reference]]
