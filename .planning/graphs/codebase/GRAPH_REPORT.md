# Graph Report - dist  (2026-05-08)

## Corpus Check
- 8 files · ~11,845 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 675 nodes · 2131 edges · 18 communities (17 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 41 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `da28496e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]

## God Nodes (most connected - your core abstractions)
1. `Js()` - 362 edges
2. `w0()` - 71 edges
3. `p()` - 54 edges
4. `bl()` - 30 edges
5. `Iv()` - 29 edges
6. `Z()` - 26 edges
7. `bi()` - 25 edges
8. `xt()` - 24 edges
9. `Ie()` - 23 edges
10. `t()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `g()` --calls--> `a()`  [INFERRED]
  assets/step4-Cr9eLCKT.js → workbox-8c29f6e4.js
- `_a()` --calls--> `a()`  [INFERRED]
  assets/step4-Cr9eLCKT.js → workbox-8c29f6e4.js
- `al()` --calls--> `a()`  [INFERRED]
  assets/step4-Cr9eLCKT.js → workbox-8c29f6e4.js
- `jc()` --calls--> `a()`  [INFERRED]
  assets/step4-Cr9eLCKT.js → workbox-8c29f6e4.js
- `Fc()` --calls--> `a()`  [INFERRED]
  assets/step4-Cr9eLCKT.js → workbox-8c29f6e4.js

## Communities (18 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (104): _(), $a(), aa(), ae(), An(), at(), b(), ba() (+96 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (20): ei(), x0(), a(), b, C, d(), e(), f() (+12 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (57): am(), cf(), Cn(), Cu(), Da(), Dc(), dm(), dt() (+49 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (36): a0(), aa(), ac(), al(), Be(), _c(), cm(), Di() (+28 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (15): d(), E(), g(), i(), k(), l(), P(), Q (+7 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (45): _a(), ad(), Af(), Cc(), Df(), Dn(), ds(), e() (+37 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (7): d(), p(), S, f(), S(), u(), x

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (41): bl(), bs(), By(), ce(), cy(), Dd(), du(), Ee() (+33 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (38): Bd(), bi(), Cd(), ci(), cs(), Ct(), d0(), Dv() (+30 more)

### Community 9 - "Community 9"
Cohesion: 0.17
Nodes (29): bc(), Et(), fa(), gs(), gt(), Gy(), hl(), hs() (+21 more)

### Community 10 - "Community 10"
Cohesion: 0.2
Nodes (26): At(), bt(), Ct(), dt(), et(), G(), gt(), H() (+18 more)

### Community 11 - "Community 11"
Cohesion: 0.14
Nodes (20): ai(), dy(), Eu(), fd(), is(), kl(), Kv(), ll() (+12 more)

### Community 12 - "Community 12"
Cohesion: 0.16
Nodes (17): ae(), em(), fe(), fy(), ga(), If(), iy(), lt() (+9 more)

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (18): $(), _0(), c0(), Dl(), Fi(), fv(), ht(), Hu() (+10 more)

### Community 14 - "Community 14"
Cohesion: 0.23
Nodes (14): bm(), Iv(), kd(), Ku(), li(), oa(), Ot(), Pv() (+6 more)

### Community 15 - "Community 15"
Cohesion: 0.19
Nodes (13): en(), Ft(), Km(), Le(), ne(), Pi(), sn(), Td() (+5 more)

### Community 16 - "Community 16"
Cohesion: 0.27
Nodes (11): as(), au(), bu(), g0(), Gc(), It(), Ki(), om() (+3 more)

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Js()` connect `Community 3` to `Community 1`, `Community 2`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 11`, `Community 12`, `Community 13`, `Community 14`, `Community 15`, `Community 16`?**
  _High betweenness centrality (0.666) - this node is a cross-community bridge._
- **Why does `t()` connect `Community 5` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 8`, `Community 9`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._
- **Why does `a()` connect `Community 1` to `Community 2`, `Community 3`, `Community 5`, `Community 7`, `Community 8`, `Community 9`, `Community 12`, `Community 13`, `Community 15`, `Community 16`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._