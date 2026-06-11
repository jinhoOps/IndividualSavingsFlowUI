## Proposed Roadmap

**4 phases** | **7 requirements mapped** | All covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Design System & Core Typography | DESIGN.md 개편 및 Anthropic 에디토리얼 스타일의 기본 폰트 스택, 타이포그래피 적용 | UI-01, UI-02 | 2 |
| 2 | Core Components & Layout | 주요 컴포넌트(버튼, 폼, 카드 등) 신규 디자인 규칙 적용 및 레이아웃 개편 | UI-03, UX-01 | 2 |
| 3 | Multi-account Data Model | 다중 계좌 데이터 모델 확장 및 Sankey 차트 다중 노드 연동 | CORE-01, CORE-02 | 2 |
| 4 | Account Transfer UI & UX Polish | 계좌 간 이체/분배 UI 구현 및 단계 전환 부드러운 애니메이션 적용 | CORE-03, UX-02 | 2 |

### Phase Details

**Phase 1: Design System & Core Typography**
Goal: DESIGN.md 개편 및 Anthropic 에디토리얼 스타일의 기본 폰트 스택, 타이포그래피 적용
Requirements: UI-01, UI-02
Success criteria:
1. DESIGN.md 문서 갱신 확인
2. 전역 캔버스 배경색 및 기본 폰트(Serif/Sans) 적용 여부 확인

**Phase 2: Core Components & Layout**
Goal: 주요 컴포넌트(버튼, 폼, 카드 등) 신규 디자인 규칙 적용 및 레이아웃 개편
Requirements: UI-03, UX-01
Success criteria:
1. 개선된 입력 폼의 렌더링 및 입력 편의성 확인
2. Anthropic 스타일의 신규 Card/Button 적용 확인

**Phase 3: Multi-account Data Model**
Goal: 다중 계좌 데이터 모델 확장 및 Sankey 차트 다중 노드 연동
Requirements: CORE-01, CORE-02
Success criteria:
1. 다중 계좌 데이터의 상태 저장 및 복원 정상 동작 확인
2. Sankey 차트에 다중 계좌 노드가 정상적으로 렌더링되는지 확인

**Phase 4: Account Transfer UI & UX Polish**
Goal: 계좌 간 이체/분배 UI 구현 및 단계 전환 부드러운 애니메이션 적용
Requirements: CORE-03, UX-02
Success criteria:
1. 계좌 간 잔고 이체 로직 및 UI가 문제없이 동작하는지 확인
2. Step 화면 전환 시 부자연스러운 끊김 없이 트랜지션 애니메이션 실행 확인
