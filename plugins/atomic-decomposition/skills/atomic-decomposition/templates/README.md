# 결정사항 저장소 (Layer · Atom)

이 폴더는 기획 의도(Why/What)와 구현 의도(How/Data)를 **Layer(L0~L4)** 와 **Atom(1문서 1결정)** 으로 기록합니다.
생성·관리 도구: Claude Code `atomic-decomposition` 플러그인 (`/atomic-decomposition:atomic-decomposition <요청문>`). 책으로 읽기: `/atomic-decomposition:book`.

## 폴더 구조

| 경로 | 내용 |
| :--- | :--- |
| `layers/` | Layer 마스터 문서. 파일명은 `L0_`~`L4_` 접두사 필수 |
| `atoms/rules/` | `type: rule`, `feedback` — 지속 준수 규칙, 재발 방지 제약 |
| `atoms/decisions/` | `type: decision` — 특정 시점의 의사결정 (발의자·승인자·대체 이력) |
| `atoms/concepts/` | `type: concept` — 도메인 용어·객체 정의 |
| `atoms/rnd/` | `type: rnd` — 검증 전 가설, 임시 우회 (무효화 조건 필수) |
| `maps/` | 요청 1건의 분해 기록 (Layer 매핑표, 생성 Atom, 검수 결과) |
| `_templates/` | 문서 템플릿. 이 프로젝트에 맞게 수정해도 됩니다 |
| `_jit_manifest.json` | JIT 컨텍스트 주입용 Atom 색인 (`name`, `path`, `regex`, `score`) |

위 폴더 외의 카테고리 폴더는 만들지 않습니다.

## Layer

| Layer | 내용 | 변경 빈도 |
| :--- | :--- | :--- |
| L0 | 비전·핵심 가치, 최상위 원칙 | 거의 불변 |
| L1 | 플랫폼 무관 코어 규칙, 상태 정의, 데이터 스키마·제약 | 마일스톤 |
| L2 | 플로우, 시퀀스, UI·연출 타임라인 | 스프린트 |
| L3 | 구체 수치, 테이블, 파라미터, 약속값 | 일 단위 |
| L4 | 테스트, 무결성 Lint, QA 체크리스트 | 실시간 |

- 의존은 구체 → 추상(L3 → L1) 방향만 허용합니다. **L1이 L3의 행 ID나 수치를 참조하면 설계 결함입니다.**
- L2와 L3는 단일 FK(`skill_id` 같은 열 하나)로만 연결합니다.
- L1은 플랫폼 입력이 아닌 추상 Intent만 받습니다.

## Atom 규칙

- **1 Atom = 1 결정.** 한 문장으로 요약되지 않으면 쪼갭니다.
- **이름**: `<domain>_<decision_body>_v<N>` (snake_case, 파일명 = name). 개념은 `concept_<domain>_<term>_v<N>`.
- **본문**: Why / Rule / How to apply / Exceptions / Relations. Why 없는 문서는 Atom이 아닙니다.
- **모르는 값**은 지어내지 않고 `[MISSING]` 또는 `[확인 필요]`로 둡니다.
- **결정이 바뀌면** 기존 파일을 고치지 않고 `_v<N+1>`을 새로 만듭니다. 새 버전의 `conflicts_with`에 구버전을 적고, 구버전은 `status: archived`로 바꿉니다.
- **status**: `draft` → `approved` → `active` → `archived` (`pending`은 rnd 전용)

## 관계는 정방향으로만

관계(`derives_from`, `affects`, `requires`, `conflicts_with`, `is_a`, `part_of`)는 발생·하위 문서 쪽에만 적습니다. 역참조는 검색으로 계산합니다.

```bash
# 이 Atom을 참조하는 모든 문서·코드 (변경 영향 범위)
rg "\[\[combat_cooldown_rule_v1\]\]"

# 특정 Layer 문서에 속한 Atom
rg -l "part_of:.*L1_combat_system" {{ROOT}}/atoms

# 활성 규칙 목록
rg -l "^status: active" {{ROOT}}/atoms/rules
```

코드에서는 관련 함수·클래스 위에 `// See: [[<atom_name>]]` 주석으로 연결합니다.
