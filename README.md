# GrootClaudeMarket

개인용 Claude Code 플러그인 마켓플레이스입니다.

## 포함된 플러그인

| 플러그인 | 설명 | 구성 요소 |
|---------|------|----------|
| `clean-architecture-ddd` | 클린 아키텍처와 DDD 기반 Feature 구현 지침 | skills, commands |
| `workflow-documenter` | 작업 워크플로우를 마크다운으로 문서화 | skills, agents |
| `example-skill` | 예시 스킬 플러그인 - 스킬 작성 방법 안내 | skills |
| `example-agent` | 예시 서브 에이전트 플러그인 - 에이전트 작성 방법 안내 | agents |
| `example-commands` | 예시 커스텀 커맨드 플러그인 - 커맨드 작성 방법 안내 | commands |

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
/plugin install example-skill@groot-claude-market
/plugin install example-agent@groot-claude-market
/plugin install example-commands@groot-claude-market
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
│   ├── example-skill/            # 스킬 예제 플러그인
│   ├── example-agent/            # 에이전트 예제 플러그인
│   └── example-commands/         # 커맨드 예제 플러그인
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
