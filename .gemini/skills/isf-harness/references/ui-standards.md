# UI & Feedback Standards

### 테마 시스템
- `shared/styles/step-theme.css`에 정의된 CSS Variables를 사용하여 일관된 색상과 타이포그래피를 유지합니다.
- 주요 변수: `--primary-color`, `--bg-color`, `--card-bg`, `--text-main` 등.

### 피드백 시스템 (`feedback-manager.js`)
- 모든 사용자 알림(성공, 오류, 안내)은 `FeedbackManager`를 통해 일관되게 제공합니다.
- **오류 안내 표준화**: 공유 실패, 백업 충돌 시 사용자가 취할 수 있는 구체적인 행동(Action)을 메시지에 포함합니다.

### 시각화 (Sankey Diagram)
- D3.js 또는 관련 라이브러리를 사용하여 현금 흐름을 시각화합니다.
- 모바일 환경에서의 가독성을 위해 '화면 맞춤' 및 '배율 리셋' 기능이 필수적입니다.
