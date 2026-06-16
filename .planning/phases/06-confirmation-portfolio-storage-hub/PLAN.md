# Plan: Phase 6 - Confirmation & Portfolio Storage Hub

이 문서는 **Phase 6: Confirmation & Portfolio Storage Hub**의 구체적인 구현 및 검증 계획을 정의합니다.

## 🎯 Goal
나만의 적립식 포트폴리오 만들기 완료 후 최종 확인 모달을 제공하고, 확인 클릭 시 입력한 데이터를 IndexedDB 영속화 저장소에 연동하여 포트폴리오 목록에 안전하게 리스팅하는 허브 기능을 완성한다.

---

## 🛠️ Tasks & Implementation Steps

```
1. [Setup Modal UI in HTML] → verify: index.html에 최종 확인 모달 마크업이 올바르게 삽입되었는지 검증
2. [Bind Events & Open Modal] → verify: '포트폴리오 생성' 클릭 시 확인 모달이 노출되며 요약 데이터(종목 수, 금액, 주기 등)가 올바르게 바인딩되는지 검증
3. [Integrate IndexedDB Storage] → verify: 모달 내 '최종 확인' 클릭 시 IsfStorageHub를 통해 데이터가 저장되는지 확인
4. [Update Portfolio List Renderer] → verify: 저장 완료 후 목록이 새로고침되어 추가된 포트폴리오 카드가 정상 렌더링되는지 검증
```

### 1단계: 최종 확인 모달 HTML 구조 추가
* **대상 파일:** [apps/step3/index.html](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/index.html)
* **작업 내용:**
  * `#portfolioCreator` 폼 하단에 최종 확인 모달 마크업 추가.
  * 모달 ID: `#portfolioConfirmModal`
  * 요약 표시 정보 영역:
    * 포트폴리오 이름: `#confirmPortfolioName`
    * 적립 주기: `#confirmPortfolioPeriod`
    * 총 종목 개수: `#confirmAssetCount`
    * 총 매수 금액: `#confirmTotalAmount`
    * 각 종목의 비중 분포 리스트: `#confirmAssetList`
  * 액션 버튼: `#confirmSaveBtn` (최종 저장), `#confirmCancelBtn` (취소/뒤로가기)

### 2단계: 모달 오픈 및 요약 바인딩 이벤트 처리
* **대상 파일:** [apps/step3/app.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/app.js)
* **작업 내용:**
  * `#savePortfolioBtn` (포트폴리오 생성 버튼) 클릭 시 즉시 저장하지 않고, `#portfolioConfirmModal`을 오픈하도록 제어 흐름 수정.
  * 사용자가 입력한 `draft` 포트폴리오 상태를 읽어와 요약 정보를 포맷팅(`IsfUtils.formatMoney` 적용) 후 모달 돔에 바인딩.

### 3단계: IndexedDB 영속화 스토어 연동
* **대상 파일:** [apps/step3/app.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/app.js) 및 [apps/step3/modules/storage.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/modules/storage.js) (또는 공통 Bridge 연동 모듈)
* **작업 내용:**
  * `#confirmSaveBtn` 클릭 시 `window.IsfStorageHub`의 포트폴리오 저장 인터페이스 호출.
  * 저장 단위는 **원** 단위를 유지하며, 저장 처리 완료(비동기 대기 완료) 후 모달을 닫고 성공 Toast 메시지 노출.

### 4단계: 포트폴리오 리스팅 갱신
* **대상 파일:** [apps/step3/app.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/app.js)
* **작업 내용:**
  * 저장 완료 시 포트폴리오 목록 데이터(`state.portfolios`)를 로드하여 UI 갱신.
  * 목록 렌더링 함수(`renderPortfolioList`)를 보강하여 저장된 데이터를 카드 형태로 정렬해 노출.

---

## ✅ Verification & DoD (완료 정의)

* **UAT-1: 최종 확인 모달 요약 데이터의 정확성**
  * 포트폴리오 만들기 에디터에서 선택한 종목 개수, 매수 금액의 총합(한글 '만원' 또는 '원' 단위 포맷팅), 설정일, 적립 주기가 최종 확인 모달에 오차 없이 반영되어 출력되는지 검증한다.
* **UAT-2: IndexedDB 영속화 및 리스팅 반영**
  * 모달의 확인 버튼을 클릭했을 때 IndexedDB의 `step3_portfolios` 테이블에 안전하게 트랜잭션이 완료되는지 브라우저 개발자 도구(Application tab)에서 확인한다.
  * 새로고침 시에도 목록에서 카드가 소실되지 않고 그대로 불러와지는지 검증한다.
