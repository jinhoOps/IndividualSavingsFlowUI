# AI Agent Knowledge Base Index

이 파일은 `wiki-librarian` 스킬을 통해 관리되는 프로젝트 위키의 전체 대동여지도(최상위 목차 파일)입니다. 에이전트는 작업을 시작할 때 이 파일을 통해 전체 지식의 위상(Topology)을 파악하고 필요한 노드로 점프(Context Loading)해야 합니다.

## 🧭 코어 시스템 (Core Systems)
- [[Operating_Principles]] : 프로젝트 기본 운영 원칙
- [[Knowledge_Harness]] : 지식 하네스 운영 체계 (위키 라이프사이클, 작성 규칙)
- [[log]] : 프로젝트 연대기적 작업 로그 (LLM Wiki Audit Trail)

## 📐 서비스 / 아키텍처 기획 (Architecture & Plans)
- [[Plan_Step1]] : Step1 설계 계획
- [[Plan_Step2]] : Step2 설계 계획
- [[Project_History]] : 주요 마일스톤 및 업데이트 이력

## 📚 참조 문서 (Reference Documents)
- [[Architecture_Reference]] : 디렉토리 구조 및 No-build 모듈 로드 방식
- [[Data_Model_Reference]] : 금액 단위, IndexedDB 스키마, 저장/공유 로직
- [[UI_Standards_Reference]] : 테마 변수, 피드백 시스템, 시각화 가이드

## 🧠 패턴 및 패턴 해결록 (Dev Patterns & Resolutions)
에이전트가 개발 중 직면했던 문제 상황이나 일관되게 적용해야 하는 기계적 패턴들을 모아놓은 인덱스입니다.
- [[Data_Bridge_Import_Pattern]] : 통합 앱 간 데이터 브리지 가져오기 시 유실 방지 상태 관리 패턴

---
*새로운 위키 문서가 생성되면, 해당 카테고리 아래에 [ [ 노드이름 ] ] 형식으로 반드시 링크를 추가하세요!*
