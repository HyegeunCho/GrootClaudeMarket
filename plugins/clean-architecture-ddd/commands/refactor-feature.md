---
description: 특정 Feature를 클린 아키텍처와 DDD 원칙에 따라 리팩토링합니다.
argument-hint: "[경로]"
---

# /refactor-feature 커맨드

특정 Feature를 클린 아키텍처와 DDD 원칙에 따라 리팩토링합니다.

## 선행 작업 (필수)

이 커맨드를 실행하기 전에 **반드시** 다음 파일을 먼저 읽어야 합니다:

```
plugins/clean-architecture-ddd/skills/clean-architecture-ddd/SKILL.md
```

위 파일에 클린 아키텍처 체크리스트와 DDD 체크리스트의 상세 원칙이 정의되어 있습니다.

> **참조**: CA/DDD 원칙 상세는 [`clean-architecture-ddd` 스킬의 SKILL.md](../skills/clean-architecture-ddd/SKILL.md) 를 참조하세요.

## 사용법

```
/refactor-feature [경로]
```

## 설명

지정된 경로의 Feature 코드를 분석하고, 클린 아키텍처 및 DDD 원칙에 맞게 리팩토링 계획을 수립한 후 실행합니다.

## 실행 단계

### 1단계: 현재 구조 분석
- 대상 경로의 모든 파일 스캔
- 클래스/함수 의존성 분석
- 현재 레이어 구조 파악

### 2단계: 문제점 식별

[`clean-architecture-ddd` 스킬의 SKILL.md](../skills/clean-architecture-ddd/SKILL.md)의 **아키텍처 검증 체크리스트** 기준으로 문제점 파악

### 3단계: 리팩토링 계획 제안
발견된 문제점을 기반으로 리팩토링 계획을 제안합니다:
- 이동해야 할 클래스/메서드 목록
- 생성해야 할 인터페이스
- 분리해야 할 레이어
- 예상 변경 파일 수

### 4단계: 사용자 승인
계획을 검토하고 승인을 요청합니다.

### 5단계: 리팩토링 실행
승인 후 다음 순서로 진행:
1. Domain 레이어 정리 (Entity, Value Object, Domain Service)
2. Repository 인터페이스 추출
3. Application 레이어 정리 (Use Case)
4. Infrastructure 구현체 분리
5. Presentation 레이어 정리

### 6단계: 검증
- 기존 테스트 실행 (있는 경우)
- 의존성 방향 검증 (안쪽으로만 향하는지)

## 예시

```
/refactor-feature ./src/features/user-management
```

## 주의사항

- 리팩토링 전 반드시 코드를 커밋하거나 백업하세요
- 대규모 변경 시 단계별로 커밋을 권장합니다
- 테스트가 없는 코드는 리팩토링 전 테스트 추가를 권장합니다
