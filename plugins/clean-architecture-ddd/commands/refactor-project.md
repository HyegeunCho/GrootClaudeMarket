---
description: 프로젝트 전체를 클린 아키텍처와 DDD 원칙에 따라 리팩토링합니다.
---

# /refactor-project 커맨드

프로젝트 전체를 클린 아키텍처와 DDD 원칙에 따라 리팩토링합니다.

## 사용법

```
/refactor-project
```

## 설명

프로젝트 전체 구조를 분석하고, Feature 단위로 클린 아키텍처 및 DDD 원칙에 맞게 리팩토링 계획을 수립합니다.

## DDD 아키텍처 레이어

의존성은 항상 **위에서 아래로(또는 안쪽으로)** 향해야 합니다.

```
1. Presentation Layer (Interfaces)
   └── API 엔드포인트, 컨트롤러

2. Application Layer
   └── 유스케이스(Use Cases), 트랜잭션 관리, 도메인 객체 조율
   └── 비즈니스 로직을 직접 포함하지 않음

3. Domain Layer (Core)
   └── 핵심 비즈니스 로직, Entity, Value Object, Domain Event
   └── **외부 의존성이 전혀 없어야 함**

4. Infrastructure Layer
   └── DB 구현체, 외부 API 호출, 프레임워크 설정
```

## 아키텍처 검증 기준

### 클린 아키텍처 체크리스트

| 항목 | 검증 질문 |
|-----|----------|
| 의존성 방향 | 모든 의존성이 안쪽(Domain)으로만 향하는가? |
| Domain 독립성 | Domain에 프레임워크/DB/외부 라이브러리 의존성이 없는가? |
| 레이어 분리 | 각 레이어의 책임이 명확히 구분되어 있는가? |
| 인터페이스 분리 | Repository 등이 Domain에 인터페이스로 정의되어 있는가? |
| Use Case 분리 | 각 Use Case가 단일 책임을 가지고 있는가? |

### DDD 체크리스트

| 항목 | 검증 질문 |
|-----|----------|
| Rich Domain Model | Entity가 비즈니스 로직을 포함하는가? (빈약한 모델 아닌지) |
| Value Object | 불변성 보장, 생성자 내 유효성 검증이 있는가? |
| Aggregate | 트랜잭션 경계가 적절히 정의되어 있는가? |
| Aggregate Root | 외부에서 내부 객체에 직접 접근하지 않는가? |
| Domain Service | 여러 Entity 걸친 로직이 분리되어 있는가? |
| Repository | 컬렉션 추상화 관점의 인터페이스인가? |
| Domain Event | 도메인 간 결합도를 낮추는 이벤트가 활용되는가? |
| Ubiquitous Language | 도메인 용어가 일관되게 사용되는가? |

## 도메인 모델링 규칙

### Entity
- 식별자(ID)를 가지며 생명주기 존재
- **빈약한 도메인 모델(Anemic Domain Model) 금지**
- Setter 남발 금지, 의미 있는 비즈니스 메서드 작성
  - `setStatus(CANCEL)` ❌ → `cancelOrder()` ✅

### Value Object (VO)
- 불변성(Immutability) 보장
- 유효성 검증 로직은 VO 생성자 내부에 위치 (예: Money, Email, Address)

### Aggregate
- 트랜잭션의 일관성을 보장하는 단위
- Aggregate Root를 통해서만 내부 객체 상태 변경

### Domain Service
- 여러 Entity에 걸친 비즈니스 로직 담당
- 상태를 가지지 않음 (Stateless)

### Repository
- 도메인 관점의 컬렉션 추상화
- 인터페이스는 Domain에, 구현체는 Infrastructure에 위치

### Domain Event
- 도메인 내 중요한 변화를 나타내는 이벤트
- 도메인 간 결합도를 낮추는 데 활용

### Ubiquitous Language (보편 언어)
- 기획서/요구사항 용어를 그대로 클래스명과 변수명으로 사용
- 모호한 용어(Manager, Processor 등) 피하기

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
