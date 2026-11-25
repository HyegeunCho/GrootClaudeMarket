# 목차 정하기

`.work/inventory.md`를 읽고 `book.json`을 씁니다. 읽는 사람은 개발자와 기획자이고, 관련된 결정을 한자리에서 보려고 이 책을 폅니다.

## 부와 장

1. **첫 부는 `background`(배경)** 입니다. 저장소의 결정이 아니라 그 바탕을 싣습니다.
   - 첫 장: L0 비전 (`"layers": ["L0_vision"]`)
   - 방식이 `edit`인 컨텍스트 문서마다 한 장 (`"context": ["<id>"]`)
2. **나머지 부는 `category`마다 하나**입니다. 순서는 읽는 사람이 먼저 알아야 하는 것부터입니다. `category`가 없는 Atom은 `etc`(기타) 부에 둡니다. 현행이 3건 이하인 category는 가까운 부에 합쳐도 됩니다.
3. **장은 주제**입니다. 한 장에 현행 Atom 5~15건을 둡니다. 함께 읽어야 뜻이 통하는 것끼리 묶습니다. 판단 근거는 다음 순서입니다.
   - 서로 전제·영향으로 이어진 것
   - 같은 분해 기록(작업)에서 나온 것
   - 이름의 앞부분이나 다루는 대상이 같은 것
4. **장 안의 순서**는 전제가 먼저, 그다음 날짜순입니다. 개념(`concept`)은 그 개념을 쓰는 결정보다 앞에 둡니다.
5. **rnd는 관련 결정과 같은 장**에 둡니다. 시험값만 모은 장을 만들지 않습니다.
6. **후속 없는 폐기**는 관련 장의 `dropped`에 둡니다.
7. 장의 `layers`에는 그 장의 도입에 쓸 Layer 문서(대개 `part_of`)를, `context`에는 관련 기획서의 id를 적습니다. 주제 장의 `context`는 링크로만 쓰입니다.

장과 부의 제목은 짧은 명사구로 짓습니다. 저장소에 없는 판단("핵심", "완성된" 등)을 제목에 넣지 않습니다.

## book.json

```json
{
  "schema": "atomic-book/v1",
  "title": "책 이름",
  "atomicRoot": "../atomic",
  "localNav": true,
  "context": [
    {
      "id": "base-spec",
      "title": "기본 기획서",
      "kind": "plan",
      "mode": "edit",
      "versions": [
        { "label": "v1", "path": "../archive/Base_Spec_v1.md" },
        { "label": "v2", "path": "../Base_Spec_v2.md" }
      ]
    }
  ],
  "contextIgnored": ["docs/meeting-notes.md"],
  "parts": [
    {
      "id": "background",
      "title": "배경",
      "chapters": [
        { "id": "vision", "title": "비전", "layers": ["L0_vision"] },
        { "id": "base-spec", "title": "기본 기획서", "context": ["base-spec"] }
      ]
    },
    {
      "id": "combat",
      "title": "전투",
      "chapters": [
        {
          "id": "cooldown",
          "title": "재사용 대기",
          "atoms": ["concept_combat_skill_v1", "combat_cooldown_rule_v2"],
          "dropped": [],
          "layers": ["L1_combat_system"],
          "context": ["base-spec"]
        }
      ]
    }
  ]
}
```

| 항목 | 규칙 |
| :--- | :--- |
| `atomicRoot`, `context[].versions[].path` | `book.json`이 있는 폴더 기준 상대 경로. `/`로 쓴다 |
| `contextIgnored` | 프로젝트 루트 기준 경로 (목록에 보인 그대로) |
| `versions` | 오래된 것부터. 마지막이 현행이고 앞의 것은 부록 A로 간다 |
| `id` | 영문 소문자, 숫자, `-`. 한 번 정하면 바꾸지 않는다 (원고 파일 이름이 된다) |
| `atoms` | 현행만. 저장소의 현행 Atom이 책 전체에서 정확히 한 번씩 나와야 한다 |
| `localNav` | md 쪽 아래의 이전·목차·다음 줄. GitBook에만 쓸 거면 `false` |

책 이름은 프로젝트 README의 제목이나 폴더 이름으로 제안하고 확인받습니다.
