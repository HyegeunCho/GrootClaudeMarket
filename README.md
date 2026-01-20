# GrootClaudeMarket

개인용 Claude Code 플러그인 마켓플레이스입니다.

## 포함된 플러그인

| 플러그인 | 설명 | 카테고리 |
|---------|------|---------|
| `example-skill` | 예시 스킬 플러그인 | skill |
| `example-agent` | 예시 서브 에이전트 플러그인 | agent |
| `example-commands` | 예시 커스텀 커맨드 플러그인 | commands |

## 사용 방법

### 1. 마켓플레이스 추가

```bash
/plugin marketplace add <github-username>/GrootClaudeMarket
```

### 2. 플러그인 설치

```bash
# 개별 플러그인 설치
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
│   └── marketplace.json      # 마켓플레이스 정의
├── plugins/
│   ├── example-skill/        # 스킬 플러그인
│   ├── example-agent/        # 에이전트 플러그인
│   └── example-commands/     # 커맨드 플러그인
├── CLAUDE.md
└── README.md
```

## 새 플러그인 추가하기

1. `plugins/` 디렉토리에 새 플러그인 폴더 생성
2. `.claude-plugin/plugin.json` 파일 작성
3. 스킬/에이전트/커맨드 파일 추가
4. `.claude-plugin/marketplace.json`에 플러그인 등록
