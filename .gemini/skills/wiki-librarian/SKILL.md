---
name: wiki-librarian
description: 프로젝트의 위키 문서 구조를 관리하고, 생성된 지식을 인덱싱(Indexing)하며 백링크를 갱신하는 특화 사서 스킬.
---

# `wiki-librarian` Skill

이 스킬은 프로젝트 내의 `.gemini/knowledge/` 디렉토리를 정리하고 영속적인 지식을 관리하는 사서(Librarian)의 워크플로우를 정의합니다. 메인 하네스(`GEMINI.md`)의 지시에 따라 개발 작업 종료 후, 혹은 문서 정리가 필요할 때 호출됩니다.

## 🔄 워크플로우 (Librarian Workflow)

1. **지식 발굴 (Refine):** 
   이번 과업(개발/리팩터링)에서 새롭게 배운 아키텍처 경험, 데이터 브리지 주의사항, 혹은 사용자 지시사항이 있다면 `.gemini/knowledge/wiki/` 에 새로운 마크다운 파일(Node)로 생성하십시오.
2. **메타데이터 (Meta-data) 작성:** 
   새로운 위키 노트 최상단에는 반드시 YAML 블록을 추가하세요.
   ```yaml
   ---
   type: node
   created: YYYY-MM-DD
   tags: [relevant_tags]
   ---
   ```
3. **고립 방지 및 백링크 (Linking):** 
   모든 위키 노트는 `[[다른_관련_노트]]` 형식을 사용해 상호 참조를 달아야 합니다.
4. **엔트로피 청소 (Archive):** 
   TODO.md 나 raw/ 폴더에서 완전히 해결된 작업이나, 가치가 없어진 구식 위키는 삭제하지 말고 `archive/` 경로로 이동시켜 히스토리를 보존합니다.

## 🗺️ 마스터 인덱스 갱신 (Indexing Rule) - 가장 중요함!
단순히 위키를 추가하고 끝나는 것이 아니라, 프로젝트 지식의 대동여지도인 `INDEX.md`의 최신 상태를 유지하는 것이 당신의 핵심 의무입니다.

- 위키 하나를 쓰거나 구조를 바꾼 즉시, 반드시 `[[.gemini/knowledge/wiki/INDEX.md]]` 파일을 열어 해당 카테고리(예: Architecture, Active Bugs, Resolved Patterns) 아래에 새로운 위키 문서의 링크를 목록형태로 기록(Indexing) 하십시오.
- 인덱스 파일은 에이전트의 뇌 구조 그 자체이므로, 항상 컨텍스트를 깔끔하고 빠르게 찾을 수 있는 '목차(Map)' 형태를 유지하도록 가다듬어야 합니다.
