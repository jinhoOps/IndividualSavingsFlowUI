---
type: node
created: 2026-04-16
tags: [ux, overhaul, v0.3, hcd]
---

# [ARCHIVED] UI/UX 통합 개편 및 v0.3 격상 (HCD 원칙 적용)

> [!NOTE]
> 본 문서는 v0.3 대규모 UI/UX 개편 당시의 기록입니다. 현재의 최신 디자인 표준 및 아키텍처는 **[[Architecture_Reference]]** 및 **[[UI_Standards_Reference]]**를 참조하십시오.

이 문서는 Step1과 Step2의 이질적인 사용자 경험을 통합하고, Donald Norman의 인간 중심 디자인(HCD) 원칙을 실무에 적용한 v0.3 대규모 개편 내용을 기록합니다.

## 🏛️ 개편 배경 및 목적
- **UX 파편화 해결:** Step1(가계 흐름)과 Step2(포트폴리오)가 서로 다른 앱처럼 느껴지는 현상 제거.
- **HCD 원칙 내재화:** 발견가능성, 피드백, 개념모델 등을 강화하여 사용자 인지 부하 감소.
- **데이터 정합성:** 모든 단위를 '만원'으로 통일하여 Step 간 브리징 시 혼란 방지.

## 📐 적용된 HCD 6대 원칙

1. **발견가능성 (Discoverability)**
   - `AppHeader` 공통 컴포넌트 도입: 모든 페이지 최상단에서 주요 메뉴 이동 가능.
   - 불필요한 Hero 섹션 슬림화: 실제 데이터와 조작부가 상단에 더 가깝게 배치됨.

2. **피드백 (Feedback)**
   - `pending-bar` 표준화: 변경사항 발생 시 하단에 경고 아이콘과 함께 일관된 버튼 구조 제공.
   - `FeedbackManager` 통합: 저장, 취소, 오류 등의 피드백을 토스트와 바 형태로 양쪽 앱 동일하게 렌더링.

3. **개념모델 (Conceptual Model)**
   - **단위 통일 (만원):** "나의 자산 관리는 만원 단위로 이루어진다"는 단일한 멘탈 모델 구축.
   - **레이아웃 동기화:** [Intro -> Summary/Chart -> Editor -> Status]로 이어지는 정보 위상 통일.

4. **매핑 (Mapping)**
   - 입력값 수정 시 차트가 즉각 반응하는 직접 조작(Direct Manipulation) 감각 유지.
   - 탭 UI의 시각적 형태를 밑줄(Underline)형으로 통일하여 현재 상태와의 연결성 강화.

5. **제약 (Constraints)**
   - Step2의 월 투자 가능 금액 입력을 Step1과 동일하게 1단위(만원)로 제한.
   - 잘못된 값 입력 시 즉각적인 시각적 경고 제공.

6. **기표 (Signifiers)**
   - `step-theme.css`를 통한 버튼 및 탭 스타일 통합: 어떤 것이 클릭 가능한 요소인지 직관적으로 인지.
   - 중요 종목에 별표(★) 기표를 도입하여 시각적 강조 기능 부여.

## 🛠️ 주요 기술 변경 사항
- **디자인 토큰 정립:** `shared/styles/step-theme.css`에 Spacing, Radius, Shadow 토큰 정의.
- **네비게이션 컴포넌트:** `shared/components/app-header.js` 커스텀 엘리먼트 구현.
- **데이터 마이그레이션:** Step2 로드 시 '원' 단위 데이터를 감지하여 '만원'으로 자동 변환하는 로직 도입.

## 🔗 관련 링크
- [[Architecture_Reference]]
- [[UI_Standards_Reference]]
- [[Data_Model_Reference]]
