# Roadmap: Individual Savings Flow (ISF)

**Milestones:** v1.0~v1.7 (Completed) | **Current:** v1.8 (Active)

---

## Active Roadmap: v1.8 적립식 포트폴리오 관리 (Step 3 고도화)

**Goal:** 나만의 적립식 포트폴리오 만들기 화면을 구현하고, 매일/매주/매달 주기별 투자 금액 및 종목 비중을 편집·추가·영속화하는 서비스를 완성한다.

**2 phases** | **3 requirements mapped** | All covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 5 | Portfolio Creation & Target Allocation UI | 나만의 포트폴리오 만들기 화면, 종목명 입력, 주기 선택 및 종목 비중 실시간 편집 UI 구현 | PORT-01, PORT-02 | 2 |
| 6 | Confirmation & Portfolio Storage Hub | 포트폴리오 추가 최종 확인 모달 구현 및 IndexedDB 영속화 저장소 연동 | PORT-03 | 2 |

### Phase Details

### Phase 5: Portfolio Creation & Target Allocation UI
- **Goal:** 나만의 포트폴리오 만들기 화면, 종목명 입력, 주기 선택 및 종목 비중 실시간 편집 UI 구현
- **Requirements:** PORT-01, PORT-02
- **Success Criteria**:
  1. 최소 2개 이상 종목 선택 및 포트폴리오 이름 지정 폼이 정상 동작하는지 확인
  2. 비중 편집 팝업에서 총금액 대비 각 종목의 비중 %가 실시간 계산되어 정확히 노출되는지 확인

### Phase 6: Confirmation & Portfolio Storage Hub
- **Goal:** 포트폴리오 추가 최종 확인 모달 구현 및 IndexedDB 영속화 저장소 연동
- **Requirements:** PORT-03
- **Success Criteria**:
  1. 추가 확인 모달에 종목 개수, 구매 금액, 설정일, 주기가 정확히 요약 표시되는지 확인
  2. 확인 버튼 클릭 시 IndexedDB에 안전하게 영속화되고, 포트폴리오 목록에 정상 리스팅되는지 확인
