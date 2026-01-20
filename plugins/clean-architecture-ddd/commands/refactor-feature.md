---
description: 특정 Feature를 클린 아키텍처와 DDD 원칙에 따라 리팩토링합니다.
argument-hint: "[경로]"
---

# /refactor-feature 커맨드

특정 Feature를 클린 아키텍처와 DDD 원칙에 따라 리팩토링합니다.

## 사용법

```
/refactor-feature [경로]
```

## 설명

지정된 경로의 Feature 코드를 분석하고, 클린 아키텍처 및 DDD 원칙에 맞게 리팩토링 계획을 수립한 후 실행합니다.

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

### 1단계: 현재 구조 분석
- 대상 경로의 모든 파일 스캔
- 클래스/함수 의존성 분석
- 현재 레이어 구조 파악

### 2단계: 문제점 식별

위 **아키텍처 검증 기준** 체크리스트 기준으로 문제점 파악

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
