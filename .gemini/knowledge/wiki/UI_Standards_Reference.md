---
type: node
created: 2026-04-16
tags: [ui, feedback, theme, visualization, reference]
---

# UI Standards Reference (UI 표준 참조)

## 테마 시스템

- `shared/styles/step-theme.css`에 정의된 CSS Variables를 사용하여 일관된 색상과 타이포그래피를 유지합니다.
- 주요 변수: `--tone-primary`, `--tone-accent`, `--ink`, `--bg`, `--panel` 등.
- 상세 Brand Identity 및 색상 체계는 프로젝트 루트의 `DESIGN.md`를 참조하십시오.

## 피드백 시스템 (`feedback-manager.js`)

- 모든 사용자 알림(성공, 오류, 안내)은 `shared/components/feedback-manager.js`의 `FeedbackManager`를 통해 일관되게 제공합니다.
- 오류 안내 표준화: 공유 실패, 백업 충돌 시 사용자가 취할 수 있는 구체적인 행동(Action)을 메시지에 포함합니다.

## 시각화

### Sankey Diagram (Step1)
- 현금 흐름을 시각화합니다.
- 모바일 환경에서의 가독성을 위해 '화면 맞춤' 및 '배율 리셋' 기능이 필수적입니다.

### Donut Chart (Step2)
- 1% 이하의 작은 비중은 '기타'로 그룹화하거나 라벨 처리하여 가독성을 유지합니다.
- 모바일 환경에서 viewBox 및 반응형 CSS가 적용되어야 합니다.

## 타이포그래피

- Display: `Black Han Sans` (숫자 및 제목 강조용)
- Body: `Gowun Dodum` (가독성 중심의 본문용)

---
*연결 노드:* [[Architecture_Reference]], [[Data_Model_Reference]], [[Operating_Principles]]
