---
title: Newlywed Harmony Hub (신혼부부 통합 허브)
type: feature_spec
status: active
created: 2026-05-11
tags: [harmony-hub, dual-flow, clipboard-parser, v1.2]
---

# Newlywed Harmony Hub (신혼부부 통합 허브)

## 📌 개요
'Newlywed Harmony Hub'는 부부나 동거 파트너가 각자의 자산 흐름을 통합하여 관리하고, 일상적인 지출 입력의 번거로움을 해결하기 위해 고안된 마일스톤 v1.2의 핵심 기능 세트입니다.

## 🧩 주요 구성 요소

### 1. Smart Clipboard Parser (스마트 클립보드 파서)
- **목적**: 은행/카드 결제 문자(SMS)나 앱 알림을 복사하여 붙여넣는 것만으로 지출 내역을 자동 등록.
- **구현 위치**: `shared/core/clipboard-parser.js`
- **핵심 로직**:
    - **Regex 엔진**: 신한, 현대, 토스 등 주요 금융사의 문자 포맷을 분석하는 정규표현식 패턴 보유.
    - **데이터 추출**: 금액(`amount`), 상호명(`merchant`), 날짜(`date`)를 자동으로 파싱.
    - **카테고리 매핑**: 상호명과 기존 지출 항목 간의 유사도를 비교하여 최적의 카테고리를 추천.
- **UI 통합**: Step 1 '생활비 상세 항목' 섹션의 [스마트 등록] 버튼을 통해 모달 진입.

### 2. Dual-Flow Merge (데이터 병합)
- **목적**: 서로 다른 두 사용자의 ISF 데이터를 하나로 합쳐 통합 가계 자산 흐름을 시각화.
- **구현 위치**: `apps/step1/app.js` (handleMergeIsfCode)
- **병합 규칙**:
    - **항목 구분**: 병합된 각 항목의 이름 앞에 `[나]`, `[너]` 접두어를 추가하여 출처를 명확히 함.
    - **총액 합산**: 기초 현금, 저축, 투자, 부채 및 월 채무 상환액을 산술적으로 합산.
    - **통합 시각화**: 합산된 데이터를 기반으로 단일 Sankey Diagram 및 자산 성장 시뮬레이션 결과 도출.
- **진입점**: `DataHubModal`의 '공유 및 연동' 탭 내 [부부 데이터 병합] 버튼.

## 🛠️ 기술적 특징
- **Serverless Integration**: 별도의 서버 저장 없이 `ISF CODE`(해시 데이터)를 통해 클라이언트 사이드에서 즉시 병합 수행. (Privacy First)
- **Defensive Merging**: 병합 전 사용자 확인(`confirm`) 절차를 거치며, 기존 데이터가 유실되지 않도록 배열 결합(`concat`) 방식 사용.

## 🔗 관련 링크
- [[Architecture_Reference]]: 전반적인 모듈 구조 확인.
- [[Data_Model_Reference]]: 병합되는 데이터 스키마 상세.
- [[log.md]]: 구현 시점의 상세 변경 이력.

---
*Librarian Note: 이 기능은 단순한 편의 도구를 넘어, 개인 자산 관리 앱을 '가계 통합 허브'로 격상시키는 전략적 지점입니다.*
