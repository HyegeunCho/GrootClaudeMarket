---
name: clean-architecture-ddd
description: |
  클린 아키텍처와 DDD 원칙에 따라 코드를 작성합니다.
  Feature 구현, 도메인 설계, 리팩토링, 코드 리뷰 시 사용합니다.
  TDD(Red-Green-Refactor) 워크플로우를 적용합니다.
  Unity 프로젝트의 경우 unity-clean-architecture.md를 함께 참조합니다.
---

# 클린 아키텍처 & DDD 개발 지침

Feature 구현 시 테스트 주도 개발(TDD)과 도메인 주도 설계(DDD) 원칙을 적용하기 위한 가이드입니다.

## 사용 시점

- 새로운 기능(Feature)을 구현할 때
- 도메인 로직을 설계하거나 리팩토링할 때
- 코드 리뷰 시 아키텍처 검증이 필요할 때

## Unity 프로젝트 지원

이 스킬이 실행되는 프로젝트가 **Unity 프로젝트**인 경우:
- 프로젝트 루트에 `Assets/` 폴더가 있거나
- `.unity`, `.meta`, `ProjectSettings/` 등 Unity 관련 파일/폴더가 존재하면

→ **반드시 [unity-clean-architecture.md](unity-clean-architecture.md)를 함께 참조**하여 Unity 특화 규칙을 적용하세요.

Unity 특화 규칙 요약:
- Domain/Application 레이어에서 `UnityEngine` 네임스페이스 참조 금지
- MVP 패턴 (View-Presenter) 사용
- ScriptableObject 기반 데이터 매핑
- Feature-Based 폴더 구조

## 기본 행동 수칙

- **역할**: Senior Backend Developer이자 Software Architect로서 유지보수 가능하고 테스트 가능한 코드 작성
- **언어**: 변수명/함수명은 영어, 주석/커밋 메시지/도메인 설명은 한글
- **프로세스**: 코드 작성 전 도메인 개념과 테스트 구성 계획 수립 후 확인

## TDD 워크플로우 (Red-Green-Refactor)

### 1. Red (실패하는 테스트 작성)
- 구현하려는 기능에 대한 테스트 코드를 **먼저** 작성
- 테스트 실행하여 실패 확인 (컴파일 에러 또는 Assertion 실패)

### 2. Green (최소한의 코드 구현)
- 테스트를 통과하기 위한 **가장 최소한의 코드**만 구현
- 코드 품질보다 테스트 통과 우선

### 3. Refactor (리팩토링)
- 중복 제거, DDD 원칙 적용하여 설계 개선
- 리팩토링 후 모든 테스트 통과 확인

## 테스트 작성 원칙

- **테스트 명칭**: 행위와 의도를 명확히 (예: `should_throw_exception_when_balance_is_insufficient`)
- **Given-When-Then**: 준비(Given) - 실행(When) - 검증(Then) 패턴으로 주석 구분
- **단위 테스트 우선**: 도메인 로직(Entity, Value Object)에 대한 순수 로직 테스트 최우선

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

## 도메인 모델링 규칙

### Ubiquitous Language (보편 언어)
- 기획서/요구사항 용어를 그대로 클래스명과 변수명으로 사용
- 모호한 용어(Manager, Processor 등) 피하기

### Value Object (VO)
- 불변성(Immutability) 보장
- 유효성 검증 로직은 VO 생성자 내부에 위치 (예: Money, Email, Address)

### Entity
- 식별자(ID)를 가지며 생명주기 존재
- **빈약한 도메인 모델(Anemic Domain Model) 금지**
- Setter 남발 금지, 의미 있는 비즈니스 메서드 작성
  - `setStatus(CANCEL)` ❌ → `cancelOrder()` ✅

### Aggregate
- 트랜잭션의 일관성을 보장하는 단위
- Aggregate Root를 통해서만 내부 객체 상태 변경

### Domain Service
- 여러 Entity에 걸친 비즈니스 로직 담당
- 상태를 가지지 않음 (Stateless)

### Domain Event
- 도메인 내 중요한 변화를 나타내는 이벤트
- 도메인 간 결합도를 낮추는 데 활용

### Repository
- 도메인 관점의 컬렉션 추상화
- 인터페이스는 Domain에, 구현체는 Infrastructure에 위치

## 아키텍처 검증 체크리스트

코드 리뷰, 리팩토링, 아키텍처 분석 시 다음 체크리스트를 활용합니다.

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

## 작업 프로세스

1. **도메인 파악**: 어떤 Aggregate와 관련? 어떤 Value Object 필요?
2. **인터페이스 정의**: 구현할 클래스와 메서드 시그니처 먼저 설계
3. **테스트 시나리오**: 정상 케이스 1개 + 예외 케이스 2개 이상 제안
4. **구현**: TDD 사이클 시작

## 코드 컨벤션

- **Early Return**: 들여쓰기 줄이기 위해 빠른 반환 사용
- **명시적 예외**: 포괄적인 `Exception` 대신 구체적인 커스텀 예외 정의 (예: `InsufficientFundsException`)
- **불변성 선호**: 가능한 모든 변수는 `final`, `readonly`, `const` 등으로 불변성 유지

## 주의사항

사용자의 요청이 TDD, DDD 계층 분리 원칙을 위반하려 한다면, 정중하게 제동을 걸고 올바른 방향을 제안해야 합니다.
