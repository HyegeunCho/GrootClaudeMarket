# GrootClaudeMarket

개인용 Claude Code 플러그인 마켓플레이스입니다.

## 포함된 플러그인

| 플러그인 | 설명 | 구성 요소 |
|---------|------|----------|
| `clean-architecture-ddd` | 클린 아키텍처와 DDD 기반 Feature 구현 지침 | skills, commands |
| `workflow-documenter` | 작업 워크플로우를 마크다운으로 문서화 | skills, agents |
| `atomic-decomposition` | 기획·구현 의도를 Layer(L0~L4)와 Atom(1문서 1결정) 단위로 분해하여 문서화하고 책으로 엮음 | skills, commands |

### clean-architecture-ddd

클린 아키텍처와 도메인 주도 설계(DDD) 원칙에 따른 코드 구현을 지원합니다.

**Commands:**
- `/refactor-feature` - Feature 단위 리팩토링
- `/refactor-project` - 프로젝트 전체 리팩토링
- `/review-architecture` - 아키텍처 리뷰

**Skills:**
- 클린 아키텍처 원칙 적용
- Unity 프로젝트용 클린 아키텍처 가이드

### workflow-documenter

완료된 작업의 워크플로우를 마크다운 문서로 자동 기록합니다.

**사용 시점:**
- 다단계 구현이 완료되었을 때
- 복잡한 문제가 해결되었을 때
- 코드베이스에 중요한 변경이 있었을 때

### atomic-decomposition

기획서·회의 메모·기능/버그 요청에 담긴 결정사항을 Layer(L0~L4 추상 계층)와 Atom(1문서 1결정) 문서로 분해해 저장합니다.

**사용법:**
- `/atomic-decomposition:atomic-decomposition init [저장소 경로]` - Layer·Atom 문서 저장소 초기화
- `/atomic-decomposition:atomic-decomposition <요청문 또는 문서 경로>` - 결정사항 분해·문서화
- `/atomic-decomposition:book [outline | build | <부·장 이름>]` - 저장소와 컨텍스트 문서(기획서·지침·프롬프트)를 책으로 엮기

**책 만들기:**
- 여러 Atom을 주제별 장으로 묶어 편집하고, 바뀐 결정은 변화 과정을 순서대로 소개합니다. 과거 결정과 현행 결정의 원문은 부록에 그대로 싣습니다.
- 결과물은 상대 링크로만 이어진 GitBook용 md(`md/`)입니다. GitBook 빌드나 HTML 만들기는 각자 하도록 방법을 안내합니다.
- Node 20 이상이 필요하고 따로 설치할 것은 없습니다.

## 사용 방법

### 1. 마켓플레이스 추가

```bash
/plugin marketplace add <github-username>/GrootClaudeMarket
```

### 2. 플러그인 설치

```bash
# 개별 플러그인 설치
/plugin install clean-architecture-ddd@groot-claude-market
/plugin install workflow-documenter@groot-claude-market
/plugin install atomic-decomposition@groot-claude-market
```

### 3. 설치된 플러그인 확인

```bash
/plugin list
```

## 디렉토리 구조

```
GrootClaudeMarket/
├── .claude-plugin/
│   └── marketplace.json          # 마켓플레이스 정의
├── plugins/
│   ├── clean-architecture-ddd/   # 클린 아키텍처 + DDD 플러그인
│   │   ├── skills/
│   │   └── commands/
│   ├── workflow-documenter/      # 워크플로우 문서화 플러그인
│   │   ├── skills/
│   │   └── agents/
│   └── atomic-decomposition/     # Layer·Atom 분해 문서화 플러그인
│       ├── skills/
│       ├── commands/
│       └── book/                 # 책 만들기 도구 (Node 스크립트, 지침, 테스트)
├── CLAUDE.md
└── README.md
```

## 새 플러그인 추가하기

1. `plugins/` 디렉토리에 새 플러그인 폴더 생성
2. `.claude-plugin/plugin.json` 파일 작성
3. 스킬/에이전트/커맨드 파일 추가
4. `.claude-plugin/marketplace.json`에 플러그인 등록

## 참고 문서

- [Claude Code 플러그인 만들기](https://code.claude.com/docs/ko/plugins)
- [서브에이전트 만들기](https://code.claude.com/docs/ko/sub-agents)
- [스킬 만들기](https://code.claude.com/docs/ko/skills)
