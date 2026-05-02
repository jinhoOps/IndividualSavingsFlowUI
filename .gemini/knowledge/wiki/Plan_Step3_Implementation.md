# Plan: 디자인 시스템 고도화 및 Step 3 착수 (v0.8.0)

## 1. 디자인 시스템 감사 및 수정 목록 (Audit & Fix)
`DESIGN.md`의 Glassmorphism 및 Typography 원칙을 기준으로 기존 Step 1, 2의 불일치 항목을 수정합니다.

### A. Glassmorphism 강화 (Surface & Depth)
- **수정 사항**: `apps/step1/styles.css` 및 `apps/step2/styles.css` 내의 하드코딩된 `#fff` 배경을 `var(--panel)`로 교체합니다.
- **대상**: `.card`, `.sankey-wrap`, `.controls-block`, `.sim-chart-wrap`.
- **추가**: 모든 `.panel` 및 `.card` 클래스에 `backdrop-filter: blur(10px);`를 적용하여 배경(Ambient)과의 깊이감을 형성합니다.
- **보완**: `step-theme.css`의 `--panel` 값을 `rgba(255, 255, 255, 0.8)`로 소폭 조정하여 유리 질감을 극대화합니다.

### B. Typography 일관성 (Black Han Sans 적용)
- **수정 사항**: 주요 수치 데이터에 `var(--font-display)`가 누락된 곳을 보완합니다.
- **대상**: 
    - Step 1: `.card .value`, `.summary-invalid`.
    - Step 2: `.sync-banner__text`, 시뮬레이션 최종 자산 수치.
    - 공통: `modal-title`.

### C. 반응형 무결성 (Mobile First)
- **수정 사항**: 760px 이하 모바일에서 `app-header`의 네비게이션이 가로 스크롤 시 절삭되어 보이지 않도록 `mask-image`를 활용한 그라데이션 페이드 효과를 추가합니다.
- **수정 사항**: Step 2 시뮬레이션 차트가 모바일 세로 모드에서 최소 높이(280px)를 확보하도록 강제합니다.

---

## 2. Step 3: 포트폴리오 에디터 및 리밸런싱 가이드 기획
Step 2에서 분리된 '자산 관리' 기능을 고도화하여 Step 3로 독립시킵니다.

### A. 개념적 모델 (Conceptual Model)
- **목적**: 사용자가 목표 비중(Target)을 설정하고, 현재 보유(Actual)와의 격차를 확인하여 "이번 달 얼마를 어디에 더 사야 하는지" 알려줍니다.
- **데이터 브리지**: Step 1의 `totalInvestCapacity` (월 투자 여력)를 자동으로 가져와 '투자 가이드'의 예산으로 활용합니다.

### B. UI 구조 설계 (HCD 4단계 흐름)
1. **Summary (요약)**: 총 자산 규모 및 현재 포트폴리오의 기대 수익률/배당률 요약.
2. **Visualization (시각화)**: 
    - **도넛 차트**: 현재 비중 vs 목표 비중 비교.
    - **격차 차트**: 목표 대비 과매수/과매도 상태를 막대 그래프로 표시.
3. **Controls (에디터)**: 
    - 종목/계좌별 비중 설정. 
    - UI는 **만원** 단위 입력, 내부 계산은 **원** 단위 (SSOT 원칙).
4. **Projection (실행 가이드)**: 
    - "이번 달 투자금 [N]만원 중 [종목A]에 [X]만원, [종목B]에 [Y]만원 매수 추천" 메시지 노출.

---

## 3. Onboarding UX 전략: '처음 접속 시 가이드'
사용자가 데이터가 없는 상태에서 막막함을 느끼지 않도록 디자인 시스템 내에 가이드를 녹여냅니다.

### A. 시각적 유도 (Signifiers)
- **Empty State 고도화**: 데이터가 없을 때 표시되는 `.empty` 메시지에 단순히 "데이터 없음" 대신, Step 1으로 이동하는 유도 버튼(Primary CTA)과 간단한 스텝 아이콘을 배치합니다.
- **Skeleton Loader**: 초기 로딩 시 Glassmorphism 형태의 스켈레톤을 노출하여 사용자에게 구조적 기대감을 부여합니다.

### B. 신규 사용자 오버레이 (Onboarding Overlay)
- `TODO.md`의 '데이터 없어도 공유받아 쓰는 사람'을 배려한 전략.
- **구현**: `IsfStorageHub`에 `hasSeenGuide` 플래그를 저장합니다.
- **UX**: 첫 접속 시, 화면 중앙이 아닌 `app-header`와 `controls-panel`을 순차적으로 비추는 투명 하이라이트(Spotlight) 가이드를 제공합니다.
- **옵션**: "다시 보지 않기" 체크박스를 포함한 Glassmorphism 토스트를 하단에 배치합니다.

---

## 4. 파일 구조 설계 (Step 3)
기존 모듈화 아키텍처를 계승하여 `apps/step3/`를 구성합니다.

```text
apps/step3/
├── index.html          # 포트폴리오 관리 메인 레이아웃
├── styles.css          # Step 3 전용 스타일 (Glassmorphism 적용)
├── app.js              # Entry point
└── modules/
    ├── state.js        # 포트폴리오 비중 및 보유 현황 상태
    ├── calculator.js   # 리밸런싱 매수액 계산 로직 (IsfUtils 활용)
    ├── dom.js          # 에디터 및 가이드 렌더링
    ├── chart-builder.js # 도넛 차트 및 격차 분석 시각화
    └── storage.js      # IsfStorageHub 연동 (portfolio-settings 키 사용)
```

---

## 5. 실행 로드맵
1. **Phase 1 (Fix)**: Step 1, 2의 Glassmorphism 및 Typography 수정 (1-2 Turn).
2. **Phase 2 (Foundation)**: Step 3 기본 파일 구조 생성 및 Step 1 데이터 연동 테스트 (2 Turn).
3. **Phase 3 (UI/UX)**: 포트폴리오 에디터 및 리밸런싱 가이드 로직 구현 (3-4 Turn).
4. Phase 4 (Onboarding): 전역 가이드 시스템(Spotlight) 구현 및 마감 (2 Turn).

---
*연결 노드:* [[Plan_Step3]], [[Architecture_Reference]], [[UI_Standards_Reference]], [[Data_Model_Reference]]

