# Technology Stack

**Analysis Date:** 2026-06-16

## Languages

**Primary:**
- TypeScript 5.5 - 현대적인 핵심 로직, 스토리지 서비스, PWA 엔트리 포인트(`src/entries/`) 작성에 사용.
- JavaScript (ES Modules) - `apps/` 및 `shared/` 하위의 레거시 애플리케이션 로직, 컴포넌트, UI 컨트롤러 구현에 사용.

**Secondary:**
- Node.js (JavaScript) - 빌드 프로세스 고도화 및 유틸리티 스크립트 작성에 사용 (`scripts/bump-version.js`, `scripts/sync-version.js`).

## Runtime

**Environment:**
- Browser (Modern Evergreen Browsers) - 웹 크립토, 클립보드, IndexedDB 등 최신 웹 API 지원 브라우저.
- Node.js (Build-time & Development) - 로컬 개발 서버 구동 및 정적 에셋 빌드 타임 환경.

**Package Manager:**
- npm (Lockfile: `package-lock.json`을 사용하여 의존성 트리 고정)

## Frameworks

**Core:**
- React 19 - UI 라이브러리. 점진적인 현대적 대시보드 도입을 위해 `react` (v19.2.5), `react-dom` (v19.2.5) 탑재.
- Vanilla JS - Step 1, 2, 3 애플리케이션(`apps/step*/app.js`)의 비즈니스 로직 및 UI 제어.

**Testing:**
- Vitest 4.1 - 핵심 유틸리티 및 클립보드 파서 등의 단위/통합 테스트 프레임워크 (`shared/core/clipboard-parser.test.js`).
- Playwright 1.60 - 브라우저 기반 E2E(End-to-End) 테스트 프레임워크 (`tests/step1.spec.ts`).

**Build/Dev:**
- Vite 5 - 빌드 도구 및 초고속 로컬 개발 서버 (`vite.config.ts`).
- Tailwind CSS v4 (Alpha) - `@tailwindcss/vite` 플러그인을 활용한 Vite 네이티브 CSS 컴파일 환경 구성.

## Key Dependencies

**Critical:**
- `react` / `react-dom` (v19.2.5) - 현대적 UI 점진적 도입.
- `vite-plugin-pwa` (v0.21.1) - 오프라인 가용성을 보장하는 Service Worker 및 PWA 환경 제어.

**Infrastructure:**
- `@tailwindcss/vite` - 스타일 빌드 플러그인.
- `typescript` (v5.5.2) - 타입 안전성 강화.
- `@playwright/test` - E2E 테스트 오케스트레이션.

## Configuration

**Environment:**
- 로컬 퍼스트(Local-First) 아키텍처로, 별도의 서버 연동이나 환경 변수 설정 없음.
- 빌드 프로세스 실행 시 `scripts/bump-version.js`와 `scripts/sync-version.js`가 구동되어 `package.json`의 버전 정보를 정적 자산(`public/manifest.webmanifest`, `shared/legacy/sw.js`, `shared/core/utils.js`)에 동기화.

**Build:**
- [vite.config.ts](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/vite.config.ts): 메인 페이지 및 각 단계를 나타내는 Multi-Entry 빌드 구성, PWA Workbox 캐싱 정책 및 Manifest 설정 관리.
- [tsconfig.json](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/tsconfig.json): ESNext 빌드 타겟 지정, `allowJs` 활성화로 Vanilla JS 혼용 지원, `@/*` 및 `@shared/*` 절대 경로 에일리어스 정의.

## Platform Requirements

**Development:**
- Node.js 20+
- Modern Web Browser (E2E 테스트 구동용)

**Production:**
- Static Hosting (GitHub Pages 등 정적 서버 환경 배포)
- PWA와 Service Worker 구동을 위해 반드시 HTTPS 환경 필요 (로컬 개발 시 localhost 예외 허용)

---

*Stack analysis: 2026-06-16*
