# Phase 1: Design System & Core Typography - Research Report

## 1. 개요 및 목적
본 조사의 목적은 **Milestone v1.7 Phase 1: Design System & Core Typography**를 성공적으로 계획하고 구현하기 위해 필요한 디자인 사양, 영향이 미치는 코드베이스의 범위, 그리고 기술적 제약 사항을 식별하는 것입니다. 
이를 통해 Anthropic 에디토리얼 스타일의 따뜻하고 고급스러운 웜톤 UI와 타이포그래피를 프로젝트 전반에 안정적으로 이식하고자 합니다.

---

## 2. 핵심 요구사항 분석 (UI-01, UI-02)

| 요구사항 ID | 세부 내용 | 구현 방향 |
|---|---|---|
| **UI-01** | `DESIGN.md` 개편 (ISF 기존 컬러 팔레트 유지 + Anthropic 에디토리얼 스타일 도입) | 기존 브랜드의 주요 컬러인 Sunset `#ea5b2a` 및 Deep Sea `#1e8b7c`는 그대로 보존하되, 글래스모피즘 관련 규칙을 에디토리얼 플랫 패널 및 웜톤 캔버스 규칙으로 대체하여 `DESIGN.md` 문서를 갱신합니다. |
| **UI-02** | Cream Canvas 배경, Serif(Display) + Sans(Body) 조합의 폰트 스택 적용 | 웜톤 크림색 배경 도입 및 구글 웹폰트 `Gowun Batang`(Serif)과 `Gowun Dodum`(Sans-serif) 조합의 타이포그래피 환경을 구성하고 기존 `Black Han Sans`를 완전히 제거합니다. |

---

## 3. 핵심 조사 결과

### 3.1. 타이포그래피 및 웹 폰트 임포트 사양
*   **구글 폰트 통합 임포트**: 
    기존 `globals.css` 및 `step-theme.css` 상단의 `@import` 주소에서 `Black Han Sans`를 제거하고, `Gowun Batang`을 병합하여 한 번의 네트워크 요청으로 렌더링하도록 최적화합니다.
    *   *기존 주소*: `https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Gowun+Dodum:wght@400;700&display=swap`
    *   *신규 주소*: `https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Gowun+Dodum:wght@400;700&display=swap`
*   **디자인 토큰 스택**:
    *   `Display (주요 타이틀 및 숫자)`: `Gowun Batang`, serif
    *   `Body (일반 텍스트 및 입력 필드)`: `Gowun Dodum`, "Nanum Gothic", sans-serif (기존 유지)

### 3.2. Cream Canvas 배경색 및 실선(Hairline Border) 디자인 토큰
*   **웜톤 크림색**: `#fbfaf7` (현대적인 웜 크림) 또는 `#f9f6f0` (더 깊은 미색) 중, Anthropic의 서정적이고 단정한 에디토리얼 분위기에 더 적합한 **`#f9f6f0`**을 캔버스 기본 배경색(`--color-canvas` / `--bg`)으로 선정합니다.
*   **플랫 패널 배경**: 기존의 반투명 백그라운드를 지양하고, 완전히 불투명한 흰색 `#ffffff` 또는 캔버스 대비를 위한 초경량 밝은 톤을 적용하여 에디토리얼 지면의 플랫함을 극대화합니다.
*   **Hairline Border**: 박스 섀도우를 걷어내는 대신, 얇고 정교한 실선 테두리(`border: 1px solid rgba(16, 34, 32, 0.12)`)를 정의하여 웜톤 크림 배경 위에 가독성 있게 패널을 배치합니다.

### 3.3. Glassmorphism 제거 및 Anthropic 에디토리얼 패널
*   **제거 대상**:
    *   `backdrop-filter: blur(...)` 속성 전면 삭제.
    *   `rgba(255, 255, 255, 0.9)`와 같이 배경이 반투명하게 투과되던 surface 스타일 삭제.
    *   무거운 `box-shadow` (예: 기존 `--sh-float` 등) 최소화 또는 제거.
*   **도입 대상**:
    *   `border: 1px solid var(--line)` 형태의 초경량 실선 테두리.
    *   에디토리얼 레이아웃 특유의 넓은 여백(Padding)을 제공하여 가독성 증대.
    *   헤더(`.app-header`), 모달 컨텐츠(`.modal-content`), 플로팅 바(`.pending-bar`) 등 핵심 컴포넌트에 일괄 적용.

---

## 4. 코드베이스 영향도 및 수정 범위 매핑

구현을 시작하기 전, 다음 파일들의 수정을 반영할 계획을 수립해야 합니다.

1.  **`DESIGN.md` (루트)**
    *   Glassmorphism 테마 관련 설명(21라인, 69라인, 81라인, 103라인 등) 전면 개편.
    *   폰트 스택 정의에서 Black Han Sans 삭제 및 Gowun Batang + Gowun Dodum 조합 추가.
    *   배경색 토큰 `#f3f4ef`를 `#f9f6f0`으로 갱신.
2.  **`src/styles/globals.css`**
    *   구글 웹폰트 `@import` 주소 변경.
    *   Tailwind v4 `@theme` 블록 내 폰트 스택 및 색상 토큰 수정 (`--color-canvas`, `--font-display` 등).
3.  **`shared/styles/step-theme.css`**
    *   `:root` 레벨 변수 업데이트 (`--bg`, `--panel`, `--font-display`).
    *   `.panel`, `.card`, `.app-header`, `.launcher-menu`, `.pending-bar`, `.modal-overlay`, `.modal-content`의 `backdrop-filter` 및 불필요한 그림자 제거 및 보더 스타일 조정.
4.  **`apps/step1/styles.css`, `apps/step2/styles.css`, `apps/step3/styles.css`**
    *   스텝별 개별 스타일 파일 내 잔존하는 `backdrop-filter` 및 반투명 배경 코드(예: 툴팁, 커스텀 카드 영역)를 공통 에디토리얼 사양으로 대체하거나 삭제.
5.  **`shared/components/data-hub-modal.js`**
    *   쉐도우 돔 내부에 하드코딩된 `#modalOverlay` 및 `.modal-content`의 `backdrop-filter: blur(...)` 스타일 제거 및 플랫 에디토리얼 테마 변수 활용 구조로 갱신.
6.  **`vite.config.ts`**
    *   PWA manifest 설정의 `background_color` 및 `theme_color`를 새 크림색 `#f9f6f0`에 맞춰 업데이트.
7.  **`index.html` 및 각 Step의 `index.html`**
    *   `<meta name="theme-color" content="#ea5b2a" />` 등의 메타 태그가 있을 때 배경 톤과의 조화를 고려하여 갱신 검토 (또는 주황색 아이덴티티 유지).

---

## 5. 계획 수립 시 주의사항 & 성공 기준 (DoD)

1.  **반응형 무결성 수호 (GEMINI.md 준수)**:
    *   `styles.css` 파일들의 최하단에 선언되어 있는 `@media (max-width: 768px)` 혹은 모바일 쿼리가 훼손되거나 절삭되지 않도록 수정 시 철저히 전후 라인 크기를 대조해야 합니다.
    *   모바일 환경(760px 이하)에서의 폰트 크기 비율 및 패널 여백이 깨지지 않고 정상 작동함을 에뮬레이터 또는 시각적 감사를 통해 입증해야 합니다.
2.  **PWA 및 빌드 안정성**:
    *   Vite 빌드 파이프라인에서 에러 없이 `npm run build`가 완수되어야 합니다.
    *   PWA 매니페스트 테마 컬러 불일치로 인한 모바일 설치 에러를 방지하도록 설정 값을 일치시킵니다.
3.  **동작 무결성 보존**:
    *   디자인 및 폰트 변경 작업 중, 기존 스텝별 핵심 Javascript 로직(`app.js`, `markDirty` 등의 14종 필수 헬퍼 함수, 데이터 연동 흐름)이 손상되지 않아야 합니다.

---

## RESEARCH COMPLETE
본 단계의 조사가 성공적으로 끝났습니다. 이제 도출된 파일 수정 범위와 디자인 스펙을 바탕으로 세부 구현 계획(PLAN.md)을 수립할 준비가 되었습니다.
