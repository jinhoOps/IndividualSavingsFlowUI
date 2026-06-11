# Phase 1: Design System & Core Typography - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-11
**Phase:** 1-Design System & Core Typography
**Areas discussed:** Cream Canvas 배경색 스펙, Serif(Display) + Sans(Body) 폰트 스택, Glassmorphism 패널과의 조화, 디자인 토큰 및 변수 관리

---

## Cream Canvas 배경색 스펙

| Option | Description | Selected |
|--------|-------------|----------|
| Anthropic 스타일의 웜톤 크림색 도입 | Anthropic 스타일의 따뜻하고 고급스러운 웜톤 크림색 (#fbfaf7 또는 #f9f6f0) 도입 | ✓ |
| 기존 ISF Pearl 색상 유지 | 기존 ISF Pearl (#f3f4ef) 색상 유지 (안정적인 그린/그레이 톤) | |
| 사용자 정의 | 직접 입력 | |

**User's choice:** Anthropic 스타일의 따뜻하고 고급스러운 웜톤 크림색 (#fbfaf7 또는 #f9f6f0) 도입
**Notes:** 더 부드럽고 가독성이 높은 백그라운드 구성을 선호함.

---

## Serif(Display) + Sans(Body) 폰트 스택

| Option | Description | Selected |
|--------|-------------|----------|
| Display: Gowun Batang + Body: Gowun Dodum | Display: Gowun Batang (구글 폰트 국문 Serif) + Body: Gowun Dodum (기본 Sans) 유지 | ✓ |
| Display: Noto Serif KR + Body: Pretendard | Display: Noto Serif KR (클래식 Serif) + Body: Pretendard (현대적 Sans) 조합 | |
| Display: Playfair Display + Body: Noto Sans KR | Display: Playfair Display (영문 Serif) & Noto Serif KR + Body: Noto Sans KR 조합 | |
| 사용자 정의 | 직접 입력 | |

**User's choice:** Display: Gowun Batang (구글 폰트 국문 Serif) + Body: Gowun Dodum (기본 Sans) 유지
**Notes:** Serif 타이틀과 기존의 Sans-serif 본문 조화가 가장 안정적이라고 판단함.

---

## Glassmorphism 패널과의 조화

| Option | Description | Selected |
|--------|-------------|----------|
| 혼합 스타일 | 기본 카드는 테두리가 얇은 에디토리얼 플랫 패널로 하되, 모달/플로팅 요소에는 Glassmorphism을 유지하여 깊이감 부여 | |
| 전면 개편 | Glassmorphism을 모두 제거하고, 얇은 실선(Hairline border)과 넓은 여백 중심의 Anthropic 플랫 에디토리얼 스타일로 전환 | ✓ |
| 기존 유지 | Glass Panel 스타일을 그대로 유지하고 폰트/색상만 변경 | |

**User's choice:** 전면 개편: Glassmorphism을 모두 제거하고, 얇은 실선(Hairline border)과 넓은 여백 중심의 Anthropic 플랫 에디토리얼 스타일로 전환
**Notes:** 에디토리얼 감성을 극대화하기 위해 글래스 효과를 덜어내고 완전히 미니멀하고 정갈한 플랫 아키텍처로 개편하기로 결정.

---

## 디자인 토큰 및 변수 관리

| Option | Description | Selected |
|--------|-------------|----------|
| CSS 변수 관리 | CSS 변수 (--bg, --panel, --font-display 등)로 정의하여 Tailwind v4와 기존 CSS가 공유하도록 설정 | |
| Tailwind config 선언 | Tailwind v4 theme config (CSS-first configuration) 내에 전적으로 선언하여 클래스로만 제어 | ✓ |
| globals.css 직접 갱신 | 기존 style.css 에 하드코딩된 스타일을 인라인 또는 선택자 기반으로 직접 갱신 | |

**User's choice:** Tailwind v4 theme config (CSS-first configuration) 내에 전적으로 선언하여 클래스로만 제어
**Notes:** 빌드 최적화 및 스타일 통일성 유지를 위해 Tailwind v4 테마 컴포지션을 적극 활용하기로 결정.

---

## the agent's Discretion

- 플랫 에디토리얼 패널로의 전환 시 발생하는 실선(Hairline border)의 구체적인 불투명도 및 세부 두께, 패널 간의 여백(gap, padding)의 구체적인 픽셀 값 매핑은 에이전트의 판단에 위임함.

## Deferred Ideas

- None — discussion stayed within phase scope
