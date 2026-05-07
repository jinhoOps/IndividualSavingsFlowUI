<!-- generated-by: gsd-doc-writer -->
# 기술 스택 (Technology Stack)

이 프로젝트는 전통적인 웹 기술(Vanilla JS)과 현대적인 프론트엔드 도구(React, Tailwind CSS v4)를 결합한 **Modern Hybrid** 아키텍처를 채택하고 있습니다.

## Core Languages
- **TypeScript**: 안정적인 개발과 타입 정의를 위한 주력 언어.
- **JavaScript (ES6+)**: ES Modules(ESM) 기반의 비즈니스 로직 및 레거시 앱 구현.
- **HTML5 & CSS3**: 시맨틱 마크업과 현대적인 CSS(Flexbox, Grid, Custom Properties) 활용.

## Frameworks & Libraries
- **React 19**: `step4` 및 최신 컴포넌트 라이브러리 개발에 사용.
- **Tailwind CSS v4 (Alpha)**: `@tailwindcss/vite` 기반의 차세대 스타일링 도구.
- **Vite**: 초고속 개발 서버 및 프로덕션 빌드 도구.
- **PWA (Vite PWA Plugin)**: 오프라인 지원 및 모바일 설치 경험 제공.
- **Vitest**: 단위 테스트 및 컴포넌트 테스트 프레임워크.

## Visualization (시각화)
- **Custom SVG Engine**: 무거운 외부 라이브러리(D3.js, Chart.js) 없이 순수 SVG와 Vanilla JS/React를 사용하여 Sankey 다이어그램, 도넛 차트, 시계열 차트 등을 직접 구현.
- **Responsive Design**: SVG `viewBox` 속성을 활용한 유연한 차트 스케일링 지원.

## Build & Deployment
- **Modern Hybrid Architecture**: `apps/` 디렉토리의 빌드가 필요 없는 레거시 앱과 `src/` 디렉토리의 Vite 기반 현대적 앱이 공존하는 구조.
- **GitHub Actions**: 코드 변경 시 `.github/workflows/deploy.yml`을 통한 자동 배포 프로세스.
- **GitHub Pages**: `jinhoops.github.io`를 통한 프로젝트 호스팅.

## Domain Knowledge (도메인 지식)
- **Financial Simulation**: 복리 계산, 배당 시뮬레이션, 현금흐름 모델링, 자산 리밸런싱 로직.
- **Taxation Engine**: 국내 금융 과세 체계(배당소득세 등) 및 ISA 절세 전략 반영.
