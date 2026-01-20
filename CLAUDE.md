# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 참고할 가이드를 제공합니다.

## 프로젝트 개요

GrootClaudeMarket은 Claude Code 플러그인 마켓플레이스입니다. 스킬, 서브 에이전트, 커스텀 커맨드를 배포합니다.

## 디렉토리 구조

```
.claude-plugin/marketplace.json  # 마켓플레이스 정의 (필수)
plugins/                         # 플러그인 저장 디렉토리
├── <plugin-name>/
│   ├── .claude-plugin/plugin.json
│   ├── skills/                  # 스킬 파일 (.md)
│   ├── agents/                  # 에이전트 파일 (.md)
│   └── commands/                # 커맨드 파일 (.md)
```

## 플러그인 추가 방법

### 1. marketplace.json에 플러그인 등록

```json
{
  "plugins": [
    {
      "name": "plugin-name",
      "source": "./plugins/plugin-name",
      "description": "플러그인 설명",
      "category": "skill|agent|commands",
      "keywords": ["keyword1", "keyword2"]
    }
  ]
}
```

### 2. plugin.json 작성

```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "description": "플러그인 설명",
  "skills": ["./skills/"],      // 스킬 플러그인
  "agents": ["./agents/"],      // 에이전트 플러그인
  "commands": ["./commands/"]   // 커맨드 플러그인
}
```

## 검증

```bash
claude plugin validate .
```
