# init 모드: Layer·Atom 저장소 초기화

새 프로젝트 또는 진행 중인 프로젝트에 Atom 저장소를 만듭니다. 기존 파일은 **절대 덮어쓰지 않습니다**. 빠진 것만 추가합니다.

경로 표기:
- `<skill>` = 이 스킬의 Base directory
- `<root>` = 저장소 경로 (`init` 뒤 인자, 없으면 `docs/atomic`, 프로젝트 루트 기준 상대경로)

## 1단계: 현황 확인

1. 프로젝트 루트를 확인합니다 (git 저장소면 `git rev-parse --show-toplevel`, 아니면 현재 작업 디렉토리).
2. 기존 저장소가 있는지 찾습니다: 프로젝트에서 `_jit_manifest.json`을 Glob으로 검색하고(`node_modules`, `.git` 등 의존성·빌드 폴더 제외), 내용에 `"schema": "atomic-decomposition/v1"`이 있는지 확인합니다.
   - **다른 경로에 이미 있으면**: 새로 만들지 말고 그 경로를 알린 뒤, 사용자가 원할 때만 진행합니다.
   - **`<root>`에 이미 있으면**: 아래 단계를 "빠진 항목만 보충"으로 수행합니다.
3. 진행 중인 프로젝트라면 기존 결정 문서 후보(`docs/`, `adr/`, `decisions/`, 기획서 폴더, `CLAUDE.md` 등)가 있는지 훑어 목록만 기록해 둡니다. 이 단계에서 내용을 옮기지 않습니다.

## 2단계: 폴더·파일 생성

아래 표대로 만듭니다. 대상 파일이 이미 있으면 건너뛰고 "기존 유지"로 기록합니다.

| 생성 대상 | 원본 | 처리 |
| :--- | :--- | :--- |
| `<root>/atoms/rules/`, `decisions/`, `concepts/`, `rnd/` | — | 빈 폴더. git이 추적하도록 각 폴더에 `.gitkeep` 생성 |
| `<root>/maps/` | — | 빈 폴더 + `.gitkeep` |
| `<root>/layers/` | — | 폴더 |
| `<root>/_templates/*` | `<skill>/templates/` 안의 `README.md`, `_jit_manifest.json`을 **제외한** 모든 파일 | 그대로 복사 |
| `<root>/README.md` | `<skill>/templates/README.md` | `{{ROOT}}`를 `<root>`로 치환 후 저장 |
| `<root>/_jit_manifest.json` | `<skill>/templates/_jit_manifest.json` | 그대로 복사 |
| `<root>/layers/L0_vision.md` | `<skill>/templates/layer.md` | 아래 L0 작성 규칙에 따라 작성 |

복사는 셸 명령(`mkdir -p`, `cp -n`)을 사용해도 됩니다. `cp -n`은 기존 파일을 덮어쓰지 않습니다.

### L0 작성 규칙

`layer.md` 템플릿을 채워 `L0_vision.md`를 만듭니다.
- `name: L0_vision`, `layer: 0`, `title: "L0 비전·핵심 가치"`
- 프로젝트의 비전·핵심 경험이 사용자 입력이나 기존 문서(README, 기획서)에 **명시되어 있으면** 출처를 적고 인용합니다.
- 명시된 것이 없으면 본문을 `[MISSING: 핵심 경험 1문장]`으로 남깁니다. 프로젝트 이름이나 코드에서 비전을 추측해 쓰지 않습니다.

## 3단계: 에이전트 진입점 등록 (선택, 확인 필수)

프로젝트에 `CLAUDE.md`(또는 `AGENTS.md`)가 있으면, 아래 블록을 추가해도 되는지 **사용자에게 먼저 묻고** 승인받은 경우에만 파일 끝에 추가합니다. 같은 제목의 섹션이 이미 있으면 추가하지 않습니다.

```markdown
## 결정사항 저장소 (Layer·Atom)

기획·구현 결정은 `<root>/`에 1문서 1결정(Atom)으로 기록한다. 규약은 `<root>/README.md`.
- 작업 전: 관련 규칙 검색 `rg -l "<키워드>" <root>/atoms`
- 결정 추가: `/atomic-decomposition:atomic-decomposition <요청문>`
- 영향 범위: `rg "\[\[<atom_name>\]\]"`
```

## 4단계: 결과 보고

다음을 짧게 보고합니다.
1. 생성된 트리 (`find <root> -type f | sort` 결과)
2. "새로 생성" / "기존 유지" 항목 구분
3. `L0_vision.md`의 `[MISSING]` 여부, 채우려면 무엇이 필요한지
4. 1단계에서 찾은 기존 결정 문서 후보. 이관을 원하면 `/atomic-decomposition:atomic-decomposition <문서 경로>`로 하나씩 분해할 수 있다고 안내합니다.

커밋은 사용자가 요청할 때만 합니다.
