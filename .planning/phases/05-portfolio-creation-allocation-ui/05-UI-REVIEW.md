# Phase 05 — UI Review

**Audited:** 2026-06-16
**Baseline:** abstract standards (Abstract 6-pillar standards)
**Screenshots:** captured (Desktop, Mobile, Tablet screenshots captured using Playwright)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | 빈 상태 및 한글 힌트는 훌륭하나, 브라우저 기본 alert를 이용한 예외 처리가 아쉬움 |
| 2. Visuals | 2/4 | 세련된 카드 디자인과 모달 차트가 돋보이지만, 극심한 인라인 스타일 의존 및 웹 접근성(aria-label) 누락이 존재함 |
| 3. Color | 2/4 | 테마 변수를 기본적으로 쓰지만, 모달 배경 등 다수의 색상이 하드코딩되어 다크모드 대응에 한계가 있음 |
| 4. Typography | 3/4 | 타이포 계층은 깔끔하나, 폰트 크기 스케일이 비체계적이며 인라인 스타일로 개별 지정됨 |
| 5. Spacing | 2/4 | grid 기반 반응형은 작동하나, 8px 스케일을 벗어난 임의 간격(2px, 6px, 10px, 30px 등)이 남발됨 |
| 6. Experience Design | 3/4 | 1,000원 단위 +/- 증감 버튼 및 플로팅 펜딩 바 등 인터랙션은 훌륭하나, 투박한 네이티브 confirm/alert가 아쉬움 |

**Overall: 15/24**

---

## Top 3 Priority Fixes

1. **브라우저 네이티브 alert 및 confirm 대체** — 사용자 조작 흐름 차단 및 비시각적 경고 — [app.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/app.js#L83-L111)에 구현된 브라우저 기본 `alert()`와 `confirm()`을 커스텀 Toast 알림 및 확인 모달 컴포넌트로 대체하여 프리미엄 UX 톤앤매너를 일치시킵니다.
2. **인라인 스타일 제거 및 디자인 토큰 이관** — 유지보수성 저하 및 CSS/JS 강결합 — [dom.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/modules/dom.js#L51-L62)와 모달 렌더러에 하드코딩된 `style="..."` 속성들을 모두 제거하고 [styles.css](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/styles.css) 클래스로 정의하며, `var(--sp-md)`, `var(--text-sm)` 등의 표준 CSS 토큰을 준수하도록 Spacing/Typography 스케일을 재정비합니다.
3. **하드코딩 색상 변수화 및 다크모드 지원** — 테마 전환 시 그래픽 파손 위험 — [styles.css](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/styles.css#L416) 및 모달 스타일에 하드코딩된 `#aaa`, `#fff`, `rgba(255, 255, 255, 0.95)` 등의 색상을 `var(--muted)`, `var(--panel-glass)`, `var(--border-color)` 같은 공통 테마 변수로 전환하여 향후 다크모드 대응을 보장합니다.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- **우수 사례**:
  - `portfolioList`가 비어있을 때 노출되는 안내 메시지(`등록된 포트폴리오가 없습니다. 아래에서 첫 포트폴리오를 생성해 보세요.`)가 사용자 친화적이며 다음 액션을 명확히 안내합니다.
  - 한글 금액 변환 힌트(`IsfUtils.convertToKoreanWon`)와 금액 포맷팅(`IsfUtils.formatMoney`)을 적재적소에 제공하여 금융 단위의 가독성을 대폭 향상했습니다.
- **개선 필요 사항**:
  - [app.js:L83-L111](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/app.js#L83-L111) 및 [app.js:L144-L160](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/app.js#L144-L160)에서 빈 값이나 유효하지 않은 금액이 입력되었을 때 브라우저 기본 `alert()` 창을 띄웁니다. 이는 모던 프리미엄 앱에 어울리지 않으며 입력 폼 옆에 적절한 에러 텍스트 피드백을 실시간으로 표시하는 방식으로 개선하는 것이 좋습니다.

### Pillar 2: Visuals (2/4)
- **우수 사례**:
  - 포트폴리오 에디토리얼 카드의 Y축 -2px 부유 애니메이션과 Sunset Orange 광채 효과가 훌륭하게 연출되었습니다.
  - 상세 보기 모달 내의 1년 누적 투자 추이 막대 그래프가 그라데이션 및 CSS 트랜지션을 통해 생동감 있게 렌더링됩니다.
- **개선 필요 사항**:
  - [dom.js:L51-L62](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/modules/dom.js#L51-L62), [dom.js:L120-L138](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/modules/dom.js#L120-L138) 등 동적으로 마크업을 그리는 로직 전체에 `style="..."` 인라인 스타일이 매우 과도하게 지정되어 있어 마크업 구조와 프레젠테이션 계층이 엉켜 있습니다. CSS 클래스로 구조화해야 합니다.
  - 모달 닫기 버튼(&times;)에 시각장애인을 위한 `aria-label="닫기"`가 누락되어 스크린 리더 환경에서 버튼의 의미를 파악하기 어렵습니다.

### Pillar 3: Color (2/4)
- **우수 사례**:
  - `--primary (#ea5b2a)` 브랜드 컬러가 세그먼트 버튼의 활성화 상태 및 모달의 핵심 통계 비중에 효과적으로 사용되었습니다.
- **개선 필요 사항**:
  - [styles.css:L416](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/styles.css#L416)의 모달 백그라운드 색상이 `rgba(255, 255, 255, 0.95)`로 고정되어 있고, 펜딩 바 백그라운드도 [styles.css:L528](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/styles.css#L528)에서 `rgba(255, 255, 255, 0.98)`로 하드코딩되어 있습니다. 다크모드가 적용될 때 이 컴포넌트들만 흰색으로 남아 UI가 완전히 깨질 수 있으므로, 테마 변수(`var(--panel-glass)`)로 묶어야 합니다.
  - `styles.css:L441`, `styles.css:L483` 등 텍스트 컬러에 하드코딩된 `#aaa` 역시 `var(--muted)`로 대체해야 합니다.

### Pillar 4: Typography (3/4)
- **우수 사례**:
  - 포트폴리오 카드의 이름은 `font-weight: 700`, 총합산 금액은 `font-size: 1.1rem; font-weight: 700`을 적용하여 중요한 시각 정보에 대한 강조가 잘 이루어지고 있습니다.
- **개선 필요 사항**:
  - 폰트 크기가 `0.7rem`, `0.75rem`, `0.8rem`, `0.85rem`, `0.9rem`, `0.95rem`, `1.05rem`, `1.15rem`, `1.5rem` 등으로 매우 파편화되어 있습니다. [Operating_Principles](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/.gemini/knowledge/wiki/Operating_Principles) 또는 표준 타이포그래피 스케일(`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`)로 구조화하여 폰트 크기 종류를 4~5개 내외로 단순화해야 합니다.

### Pillar 5: Spacing (2/4)
- **우수 사례**:
  - 미디어 쿼리를 통한 데스크톱 2열 그리드 배치와 모바일 1열 배치가 자연스럽게 작동합니다.
- **개선 필요 사항**:
  - Spacing Scale 원칙을 위배하고 임의의 패딩 및 갭 수치(`2px`, `6px`, `10px`, `12px`, `18px`, `20px`, `24px`, `30px`)가 인라인 스타일에 복잡하게 난무하고 있습니다. 8px(0.5rem) 그리드 배수에 따라 `gap: 4px`, `gap: 8px`, `gap: 16px`, `gap: 24px` 등으로 통일성 있게 간격을 제어해야 균형 잡힌 레이아웃을 형성할 수 있습니다.

### Pillar 6: Experience Design (3/4)
- **우수 사례**:
  - 개별 종목 금액의 1,000원 단위 증감 +/- 버튼 연동이 사용자의 수치 조정을 직관적으로 돕습니다.
  - 변경사항이 모달 내에서 감지될 때 하단에서 다이내믹하게 출현하는 플로팅 펜딩 바(Pending Bar) 디자인이 훌륭하며, 3종의 입체적인 랜덤 애니메이션이 인터랙션의 재미를 더합니다.
  - 금액 오류 시 인풋 창 하단 테두리를 즉시 붉은색(`var(--status-error)`)으로 전환하여 사용자 실수를 시각적으로 바로잡아 줍니다.
- **개선 필요 사항**:
  - 삭제 시 브라우저 네이티브 `confirm()` 팝업을 띄우고 있어, 모달의 우아한 Glassmorphism 테마에 찬물을 끼얹는 느낌을 줍니다. 커스텀 컨펌 UI로 전환하는 것이 권장됩니다.
  - 1,000원 단위 미충족 등 유효성 조건을 위배했을 때 "포트폴리오 생성" 버튼을 비활성화(`disabled`)하는 대신 상시 활성화하여, 클릭 시 시끄러운 경고창(`alert`)을 띄우는 나쁜 UX를 유지하고 있습니다. 유효하지 않은 입력의 경우 버튼을 비활성화하고 입력창 주변에 경고 텍스트를 고정 노출해야 합니다.

---

## Files Audited
- [apps/step3/index.html](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/index.html)
- [apps/step3/modules/calculator.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/modules/calculator.js)
- [apps/step3/modules/dom.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/modules/dom.js)
- [apps/step3/modules/state.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/modules/state.js)
- [apps/step3/app.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/app.js)
- [apps/step3/styles.css](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/styles.css)
