# Phase 1: Design System & Core Typography - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

- **DESIGN.md 개편** 및 Anthropic 에디토리얼 스타일의 기본 폰트 스택, 타이포그래피 적용.
- 전역 캔버스 배경색 및 기본 폰트(Serif/Sans) 적용 여부 확인.
- 크림 캔버스 배경색 스펙 설정 및 Gowun Batang(Serif) + Gowun Dodum(Sans) 조합 적용.

</domain>

<decisions>
## Implementation Decisions

### Cream Canvas 배경색 스펙
- **D-01:** Anthropic 에디토리얼 스타일의 따뜻하고 고급스러운 웜톤 크림색 (`#fbfaf7` 또는 `#f9f6f0`)을 도입하여 전역 캔버스 배경으로 설정합니다.

### Serif(Display) + Sans(Body) 폰트 스택
- **D-02:** 주요 강조 및 숫자/타이틀용 Display 폰트로 `Gowun Batang` (구글 폰트 국문 Serif)을 적용하고, 가독성을 위한 Body 폰트로 기존의 `Gowun Dodum` (Sans-serif)을 유지하여 Serif-Sans 조합을 구축합니다.

### Glassmorphism 패널 스타일 개편
- **D-03:** 기존의 반투명 Glassmorphism 스타일을 전면 제거합니다. 대신 얇은 실선(Hairline border)과 넓은 여백을 가진 깔끔한 Anthropic 플랫 에디토리얼 스타일 패널로 UI를 전면 개편합니다.

### 디자인 토큰 및 변수 관리
- **D-04:** 신규 색상 및 폰트 스택 토큰을 Tailwind v4 theme config (CSS-first configuration) 내에 전적으로 선언하여 유틸리티 클래스로 제어합니다.

### 에이전트 재량 사항 (the agent's Discretion)
- 크림색 캔버스 배경과 어울리는 실선 테두리의 정확한 불투명도 및 색상 톤 조합.
- 각 카드 컴포넌트의 에디토리얼 스타일에 걸맞은 여백(Margin/Padding) 수치 및 세부 마이크로 간격 조정.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Guidelines & Setup
- `DESIGN.md` — 전체 디자인 시스템 가이드라인.
- `src/styles/globals.css` — 테마와 폰트가 선언되는 공통 CSS 엔트리.
- `vite.config.ts` — Vite 및 Tailwind v4 플러그인 설정 빌드 파이프라인.

### Milestone Specifications
- `.planning/PROJECT.md` — 프로젝트 마스터 계획서 및 v1.7 목표 정의.
- `.planning/REQUIREMENTS.md` — v1.7 마일스톤 상세 요구사항 정의.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/styles/globals.css` 내의 `@theme` 지시자 규칙을 활용해 폰트와 크림색 배경 토큰을 선언 및 관리할 수 있습니다.

### Established Patterns
- `@layer base` 및 `@layer components`를 사용한 공통 유틸리티 스타일링(예: 버튼, 입력 폼 컴포넌트 클래스) 방식 적용.

### Integration Points
- `globals.css`에서 정의한 디자인 토큰이 각 Step별 `index.html` 혹은 리액트 컴포넌트 내의 유틸리티 클래스로 반영됩니다.

</code_context>

<specifics>
## Specific Ideas

- 구글 웹 폰트에서 `Gowun Batang`과 `Gowun Dodum` 폰트 패밀리를 병합해서 임포트하여 최적화 렌더링을 돕습니다.
- Anthropic 에디토리얼 특유의 플랫하면서 정갈한 느낌을 살리기 위해, 불필요한 무거운 박스 섀도우를 배제하고 아주 옅은 보더 스타일을 강조합니다.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 1-Design System & Core Typography*
*Context gathered: 2026-06-11*
