---
type: node
created: 2026-04-16
tags: [knowledge_management, workflow, librarian]
---

# 지식 하네스 운영 체계 (Knowledge Harness)

이 문서는 프로젝트의 지식이 어떻게 생성되고, 분류되고, 인덱싱되는지를 정의하는 운영 체계입니다.

## 지식 관리 구조

프로젝트의 모든 영속적 지식은 `.gemini/knowledge/wiki/` 디렉토리에서 위키 노드 형태로 관리됩니다.

| 구성 요소 | 경로 | 역할 |
|---|---|---|
| 마스터 인덱스 | `wiki/INDEX.md` | 전체 지식의 위상(Topology) 지도 |
| 위키 노드 | `wiki/*.md` | 개별 지식 단위 (YAML 메타데이터 포함) |
| 아카이브 | `wiki/archive/` | 가치가 소진된 구식 노드 보관소 |

## 지식 생성 라이프사이클

```
[개발/리팩터링 작업 완료]
        |
        v
[지식 발굴] -- 새로운 패턴, 아키텍처 경험, 사용자 지시사항 식별
        |
        v
[위키 노드 작성] -- YAML 메타데이터 + 본문 + 백링크([[]])
        |
        v
[INDEX.md 갱신] -- 해당 카테고리에 새 노드 등록
```

## 위키 노드 작성 규칙

1. 최상단에 반드시 YAML 블록을 포함합니다:
   ```yaml
   ---
   type: node
   created: YYYY-MM-DD
   tags: [relevant_tags]
   ---
   ```
2. 모든 노드는 `[[다른_관련_노트]]` 형식으로 상호 참조를 달아야 합니다.
3. 완전히 해결된 작업이나 구식 노드는 삭제하지 말고 `archive/` 경로로 이동합니다.
4. 한국어(존댓말), UTF-8을 사용합니다.

## 담당 스킬

이 체계의 실행은 [[wiki-librarian]] 스킬이 담당합니다. 메인 하네스(GEMINI.md)의 3단계(Wiki Indexing & Post-processing)에서 호출됩니다.

---
*연결 노드:* [[Operating_Principles]], [[INDEX]]
