---
name: core-developer
description: ISF 프로젝트의 기술적 구현(Generator/Evaluator)을 담당하는 전문 스킬. 코드 구현 시 반드시 지켜야 할 아키텍처 원칙과 스프린트 계약 체결 방식을 정의합니다.
---

# `core-developer` Skill

이 스킬은 IndividualSavingsFlowUI의 앱 기능 구현, 리팩터링, 컴포넌트 작성 시 반드시 준수해야 하는 개발 헌장(Development Rulebook)입니다. 지식 인덱싱(Wiki)에 관한 내용은 이 스킬에서 신경쓰지 마십시오.

## 🏛️ 아키텍처 원칙 강제 (Invariants)
에이전트는 코드 작성 시 아래의 불변량(Invariants)을 절대적으로 지켜야 합니다.

1. **No-build 환경 (ES6 + Vanilla JS)**
   - 빌드 도구 도입 불가. 브라우저에서 즉시 실행 가능한 형태 유지.
2. **스타일 및 반응형 무결성 (Style & Responsive Integrity) - 중요!**
   - **물리적 무결성**: CSS/HTML 수정 시 파일 하단의 `@media` 쿼리나 유틸리티 클래스가 절삭(Truncate)되지 않았는지 수정 전후의 파일 크기와 구조를 반드시 대조하십시오.
   - **반응형 보존**: 기능을 추가하거나 리팩터링할 때, 모바일 레이아웃(760px 이하)이 파손되지 않도록 주의하십시오.
3. **Shared 우선 재활용 (Don't Repeat Yourself)**
   - 앱 고유 로직을 짜기 전에 `shared/core/`, `shared/storage/`, `shared/components/` (예: FeedbackManager) 등을 먼저 탐색하여 기존 유틸리티를 재활용 하십시오.
   - 데이터는 로컬 `IndexedDB (isf-hub-db-v1)` 기반으로 저장 및 브리징 됩니다.
4. **PWA 동작 우선**
   - 개발에 의해 Service Worker (`sw.js`) 캐싱이나 오프라인 가용성이 깨지지 않게 보수적으로 접근하세요.

## 🔍 레퍼런스 탐색(Progressive Disclosure) 지침
개발에 필요한 세부 지식(UI 표준, 특정 기능의 작동 방식)을 모두 외우거나 추측하지 마십시오.
모르는 도메인(예: 데이터 브리지, UI 명세)을 마주했다면, 반드시 즉시 **[[.gemini/knowledge/wiki/INDEX.md]]** 를 열어 해당 도메인에 대한 문제 해결록이나 기획 문서를 먼저 탐색(Read)한 후 구현에 착수하십시오.

## 🤝 스프린트 계약 (Sprint Contract) 및 평가 (Evaluation)
복잡한 작업을 한 번에 끝내려 하기 전에, 기획 및 개발(진행) 전에 "검증 가능한 기준"을 세우는 것이 이 스킬의 핵심입니다. 당신은 코딩 작업을 제안할 때, 스스로 **Generator(작성자)**와 **Evaluator(평가자)**의 역할을 명시적으로 구분해야 합니다.

1. **계약 수립 (Contract Creation):**
   - 사용자에게 코드를 제시하기 전에 "이 요구사항을 구현하기 위한 테스트 및 완료 기준은 1, 2, 3 입니다" 라고 명시하세요.
2. **평가 가능성:**
   - 구현 후, 해당 계약 기준을 바탕으로 평가(Evaluator 모드)를 시뮬레이션하거나 동작 방식을 체크리스트로 확인하십시오.

*여기까지가 개발/구현에 대한 가이드라인입니다. 파일 작성, 버그 수정 등을 마치면 메인 하네스(`GEMINI.md`)의 라우팅 룰에 따라 "위키 정리" 단계로 넘어가십시오.*
