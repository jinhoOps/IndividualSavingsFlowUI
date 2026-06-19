## Milestone v1.7 Requirements

### Design System (Editorial UI)
- [x] **UI-01**: DESIGN.md 개편 (ISF 기존 컬러 팔레트 유지 + Anthropic 에디토리얼 스타일 도입)
- [x] **UI-02**: Cream Canvas 배경, Serif(Display) + Sans(Body) 조합 of 폰트 스택 적용
- [x] **UI-03**: Button, Input, Card 등 핵심 컴포넌트 신규 디자인 룰 적용

### Core Features
- [x] **CORE-01**: 다중 계좌 매핑 기능(입출금, 예적금, 투자 계좌 등) 데이터 모델 확장
- [x] **CORE-02**: Sankey Chart 노드에 다중 계좌 데이터 연동 로직 추가
- [x] **CORE-03**: 계좌별 잔고 분배 및 이체 내역 관리 UI 구현

### User Experience
- [x] **UX-01**: 입력 폼 전면 개편(가독성 향상 및 여백, 타이포그래피 개선)
- [x] **UX-02**: Step 별 화면 전환 시 부드러운 트랜지션 애니메이션 적용

---

## Milestone v1.8 Requirements (적립식 포트폴리오 관리)

### Portfolio Creation
- [x] **PORT-01**: 나만의 포트폴리오 만들기 화면 구현 (추가하기 버튼, 종목명 입력, 최소 2개 이상 종목 선택 강제, 포트폴리오 이름 지정)
- [x] **PORT-02**: 적립식 주기(매일/매주/매달) 및 매수 금액 설정 (주식당 최소 1,000원 제한, 상단에 총금액 및 종목 개수 표기, 각 종목별 % 비중 실시간 표기 및 비중 편집 팝업/토글 제공)

### Confirmation & Storage
- [x] **PORT-03**: 포트폴리오 추가 확인 창 및 IndexedDB 영속화 (추가 확인 모달 제공: 종목 개수, 구매 금액, 설정일, 주기 요약 표출, 확인 시 저장 및 목록 반영)
