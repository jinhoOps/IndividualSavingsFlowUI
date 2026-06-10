# Roadmap: Individual Savings Flow (ISF)

**Milestones:** v1.0~v1.4 (Completed) | **Current:** v1.6 (Active)

---

## Active Roadmap: v1.6 코드 리팩터링, UX 개선 및 안정성 강화

**Goal:** 기존 시스템의 물리적/로직적 안정성을 강화하고, DESIGN.md 가이드라인을 기반으로 UX를 고도화하며 내부 코드를 리팩터링한다. (Sankey Chart 개선 및 공유기능 포함)

**4 phases** | **10 requirements mapped** | All covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| ✅ 13 | Core Refactoring & Stability | 핵심 로직 3계층 모듈화 및 단위/무결성 오류 수정 | REF-01, REF-02, STAB-01, STAB-02 | 4 |
| ✅ 14 | Foundation UX & Branding | DESIGN.md 가이드라인의 시각적 테마와 반응형 뼈대 구축 | UX-01, UX-02, UX-04 | 3 |
| ✅ 15 | Chart Enhancement & Responsive | Sankey Chart 데이터 라벨링 및 모바일 레이아웃 고도화 | UX-03, UX-05 | 3 |
| 16 | Export Feature | 사용자가 결과물을 이미지로 저장하고 공유할 수 있는 수단 확보 | FEAT-01 | 2 |
| ✅ 17 | Step 1 Income Flow & Wallet Partitioning | 수입/지출 통장 쪼개기 및 자금 흐름 시각화 개선 | FEAT-02, UX-06 | 3 |

### Phase Details

**Phase 13: Core Refactoring & Stability (Completed)**
- Goal: 핵심 로직 3계층 모듈화 및 단위/무결성 오류 수정
- Requirements: REF-01, REF-02, STAB-01, STAB-02
- Success criteria:
  1. app.js 내의 로직이 3계층(상태/헬퍼/UI)으로 분리되어 정상 동작한다.
  2. 불필요한 변수와 임포트가 모두 제거되었다.
  3. 모든 저장소 데이터는 원, UI 데이터는 만원 단위로 일관성 있게 표시된다.
  4. 과세 경고(1,900만 원 초과 등)가 정상적으로 표시되며 파일 사이즈/반응형 코드가 유실되지 않는다.

**Phase 14: Foundation UX & Branding (Completed)**
- Goal: DESIGN.md 가이드라인의 시각적 테마와 반응형 뼈대 구축
- Requirements: UX-01, UX-02, UX-04
- Success criteria:
  1. 전체 캔버스 배경에 ISF Pearl 톤이 적용된다.
  2. 주요 패널에 Glass Panel 스타일이 적용된다.
  3. 브랜드 포인트 컬러(Sunset/Deep Sea) 및 버튼 클릭 인터랙션이 일관되게 작동한다.

**Phase 15: Chart Enhancement & Responsive (Completed)**
- Goal: Sankey Chart 데이터 라벨링 및 모바일 레이아웃 고도화
- Requirements: UX-03, UX-05
- Success criteria:
  1. 768px 이하 모바일 환경에서 요소 겹침/깨짐 현상이 없다.
  2. Sankey Chart 노드 및 링크 컬러가 테마에 맞게 조정된다.
  3. 차트 라벨 가독성이 이전 대비 명확하게 향상된다.

**Phase 16: Export Feature**
- Goal: 사용자가 결과물을 이미지로 저장하고 공유할 수 있는 수단 확보
- Requirements: FEAT-01
- Success criteria:
  1. "이미지로 내보내기" 버튼이 제공된다.
  2. 캔버스 영역이 깨짐 없이 `.png` (또는 적절한 포맷) 파일로 다운로드된다.

**Phase 17: Step 1 Income Flow & Wallet Partitioning (Completed)**
- Goal: 수입/지출 통장 쪼개기 및 자금 흐름 시각화 개선
- Requirements: FEAT-02, UX-06
- Success criteria:
  1. 수입 입력 시 단순 금액 입력 외에 '입금/급여 계좌' 매핑 기능이 지원된다.
  2. 중간 계좌(통장 쪼개기) 레이어가 도입되어 수입 -> 급여계좌 -> 생활비/저축/투자계좌 -> 지출/저축/투자 항목으로 이어지는 Sankey 흐름이 렌더링된다.
  3. 잉여현금의 자동/수동 이체 경로(예: 주식계좌로의 흐름)를 설정할 수 있다.

---

## Completed Milestones

- ✅ **v1.0 MVP — 템플릿 기반 자산 흐름 시각화** (Shipped 2026-05-03)
- ✅ **v1.1 ~ v1.3 시뮬레이션 고도화 및 온보딩** (Shipped 2026-05-12)
- ✅ **v1.4 코어 안정화 및 UX 고도화** (Shipped 2026-05-20)

---

## Future Milestones & Backlog

### 📋 v1.5 포트폴리오(계좌/종목) 고도화 (Paused/Deferred)
**Goal:** Step 3 포트폴리오 구성을 본격화하고, Target vs Actual 비중 분석과 배당 성장 예측 엔진의 확장팩을 개발한다.
- 계좌 및 종목별 비중 관리 고도화
- 포트폴리오 실시간 격차 분석(Target vs Actual) 알림
- 리밸런싱 전략 연산 엔진 고도화
