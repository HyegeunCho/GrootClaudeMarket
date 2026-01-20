---
description: 프로젝트 전체를 클린 아키텍처와 DDD 원칙에 따라 리팩토링합니다.
---

# /refactor-project 커맨드

프로젝트 전체를 클린 아키텍처와 DDD 원칙에 따라 리팩토링합니다.

> **참조**: CA/DDD 원칙 상세는 [`clean-architecture-ddd` 스킬의 SKILL.md](../skills/clean-architecture-ddd/SKILL.md) 를 참조하세요.

## 사용법

```
/refactor-project
```

## 설명

프로젝트 전체 구조를 분석하고, Feature 단위로 클린 아키텍처 및 DDD 원칙에 맞게 리팩토링 계획을 수립합니다.

## 실행 단계

### 1단계: 프로젝트 구조 스캔
- 전체 디렉토리 구조 분석
- Feature/모듈 단위 식별
- 공통 코드 및 공유 의존성 파악

### 2단계: Feature 목록 작성
발견된 Feature들의 목록을 작성합니다:
- Feature 이름
- 현재 위치
- 예상 복잡도 (파일 수, 의존성 수)
- 다른 Feature와의 의존 관계

### 3단계: 의존성 그래프 분석
- Feature 간 의존성 시각화
- 순환 의존성 탐지
- 공통 모듈 식별

### 4단계: 리팩토링 우선순위 결정
다음 기준으로 우선순위를 결정합니다:
1. **독립성**: 다른 Feature에 의존하지 않는 Feature 우선
2. **핵심 도메인**: 비즈니스 핵심 로직을 포함한 Feature 우선
3. **복잡도**: 복잡도가 낮은 Feature부터 시작 (학습 효과)

### 5단계: 목표 구조 제안
프로젝트 타입에 따른 목표 구조를 제안합니다:

#### 일반 백엔드 프로젝트
```
src/
├── features/
│   └── {FeatureName}/
│       ├── domain/
│       ├── application/
│       ├── infrastructure/
│       └── presentation/
└── shared/
    ├── domain/
    └── infrastructure/
```

#### Unity 프로젝트
```
Assets/
├── Features/
│   └── {FeatureName}/
│       ├── Domain/
│       ├── Application/
│       ├── Presentation/
│       ├── Infrastructure/
│       └── Data/
└── Shared/
```

### 6단계: 단계별 마이그레이션 계획
- Phase 1: 디렉토리 구조 생성
- Phase 2: 공통 모듈 분리
- Phase 3: Feature별 순차 리팩토링 (/refactor-feature 활용)
- Phase 4: 통합 테스트 및 검증

### 7단계: 사용자 승인
전체 계획을 검토하고 승인을 요청합니다.

### 8단계: 순차 실행
승인된 계획에 따라 Feature별로 `/refactor-feature` 커맨드를 순차 실행합니다.

## 출력 형식

```markdown
## 프로젝트 분석 결과

### 발견된 Feature (N개)
| # | Feature | 위치 | 파일 수 | 의존성 |
|---|---------|------|--------|--------|
| 1 | User    | /src/user | 12 | Auth, Common |
| 2 | Auth    | /src/auth | 8  | Common |

### 리팩토링 순서 (권장)
1. Common (공통 모듈)
2. Auth (독립적)
3. User (Auth 의존)

### 예상 작업량
- 총 이동 파일: N개
- 신규 생성 파일: N개
- 예상 단계: N개
```

## 주의사항

- 대규모 프로젝트의 경우 점진적 마이그레이션을 권장합니다
- 각 Feature 리팩토링 완료 후 동작 검증을 수행하세요
- CI/CD 파이프라인이 있다면 각 단계마다 빌드/테스트를 실행하세요
