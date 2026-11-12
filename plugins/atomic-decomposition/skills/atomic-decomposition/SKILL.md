---
name: atomic-decomposition
description: 기획서·회의 메모·기능 구현 요청·버그 수정 요청에 담긴 결정사항을 영구 보존하거나 코드·데이터에서 참조할 수 있도록 Layer(L0~L4)·Atom(1문서 1결정) 문서로 기록해야 할 때, 또는 새 프로젝트나 진행 중인 프로젝트에 Layer·Atom 문서 저장소를 처음 만들 때 사용합니다. "결정사항 정리", "Atom으로 쪼개줘", "Layer 분해", "기획 의도 문서화", "규칙 박제" 같은 요청에 해당합니다.
argument-hint: "init [저장소 경로] | <분해할 요청문 또는 문서 경로>"
---

# Atomic Decomposition

기획 의도(Why/What)와 구현 의도(How/Data)를 **Layer(L0~L4 추상 계층)** 와 **Atom(1문서 1결정)** 으로 분해해 프로젝트 안의 고정된 폴더 구조에 저장합니다. 결정마다 근거(Why), 버전 이력, 정방향 관계(`derives_from`/`affects`/`requires`…)를 남기고, 역참조는 `rg`로 계산합니다.

이 스킬 폴더(위에 표시된 "Base directory")의 파일:

| 파일 | 용도 | 언제 읽는가 |
| :--- | :--- | :--- |
| `init.md` | 저장소 초기화 절차 | `init` 모드 |
| `decompose.md` | 분해·문서화·저장 절차 | `decompose` 모드 |
| `reference.md` | 원본 규약 전문 (Layer 정의, Atom 5대 부위, 템플릿 원형) | 규칙 해석이 애매할 때 |
| `templates/` | 프로젝트에 복사되는 템플릿 원본 | `init` 시 복사, 프로젝트 사본이 없을 때 직접 사용 |

## 모드 선택

인자: `$ARGUMENTS`

1. 인자가 `init`으로 시작하면 → **`init.md`를 읽고** 그대로 수행합니다. `init` 뒤의 값은 저장소 경로입니다 (기본값 `docs/atomic`).
2. 그 외 (요청문, 문서 경로, 또는 대화 중 자동 활성화) → **`decompose.md`를 읽고** 그대로 수행합니다. 인자가 비어 있으면 직전 대화의 기획·결정 내용을 입력으로 삼고, 그것도 없으면 무엇을 분해할지 묻습니다.

두 절차 파일을 읽지 않고 기억에 의존해 진행하지 않습니다. 템플릿과 저장 경로가 거기에 정의되어 있습니다.

## 저장소 구조 (모든 모드 공통 좌표)

```
<root>/                         # 기본 docs/atomic
├── README.md                   # 저장소 규약 요약 (사람·에이전트용 진입점)
├── _jit_manifest.json          # {"schema": "atomic-decomposition/v1", "atoms": [...]}
├── _templates/                 # 프로젝트별 템플릿 (수정 가능, 스킬 원본보다 우선)
├── layers/                     # L0_~L4_ 접두사 Layer 마스터 문서
├── maps/                       # 요청 1건 = 분해 기록 1건 (YYYY-MM-DD_<topic>.md)
└── atoms/
    ├── rules/                  # type: rule, feedback
    ├── decisions/              # type: decision
    ├── concepts/               # type: concept
    └── rnd/                    # type: rnd (status: pending)
```

저장소 루트는 `_jit_manifest.json`의 `"schema": "atomic-decomposition/v1"` 표식으로 찾습니다.

## 절대 규칙 (두 모드 공통)

- **Zero Guessing**: 입력에 없는 `owner`, 수치, 연관 Atom은 지어내지 않고 `[MISSING]` / `[확인 필요]`로 남깁니다.
- **1 Atom = 1 결정**: 한 문장으로 요약되지 않으면 쪼갭니다.
- **Why 필수**: 근거 없는 할 일 목록은 Atom이 아닙니다.
- **정방향만 기록**: 관계는 발생·하위 문서 쪽에만 적습니다. 상대 문서에 역링크를 추가하지 않습니다.
- **L1 → L3 거꾸로참조 금지**: L1은 스키마와 제약만 규정하고 L3의 행 ID나 구체 수치를 참조하지 않습니다.
- **폴더 증식 금지**: 위 구조 밖에 새 카테고리 폴더를 만들지 않습니다.
- **덮어쓰기 금지**: 기존 Atom의 결정 내용을 수정하지 않습니다. 결정이 바뀌면 `_v<N+1>`을 새로 만들고 구버전은 `status: archived`로 바꿉니다.

## reference.md와의 차이 (이 스킬의 해석)

- JIT 매니페스트 `path`는 reference 5.4의 `atoms/<domain>/` 대신 3.2의 유형 폴더 라우팅을 따릅니다 (`atoms/rules/<name>.md`).
- `type: feedback`은 재발 방지 제약이므로 `atoms/rules/`에 저장합니다.
- Layer 마스터 문서는 `layers/`, 요청별 분해 기록(reference 5.1 매핑표 + 검수 결과)은 `maps/`에 저장합니다.
