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

## Flutter 프로젝트 지원

이 스킬이 실행되는 프로젝트가 **Flutter 프로젝트**인 경우:
- 프로젝트 루트에 `pubspec.yaml` 파일이 있거나
- `lib/`, `android/`, `ios/` 등 Flutter 관련 폴더가 존재하면

→ **반드시 [flutter-clean-architecture.md](flutter-clean-architecture.md)를 함께 참조**하여 Flutter 특화 규칙을 적용하세요.

Flutter 특화 규칙 요약:
- Domain Layer에서 Flutter/외부 패키지 import 금지 (순수 Dart)
- Riverpod 기반 상태 관리 및 DI
- Either<Failure, Success> 기반 에러 처리
- Model(DTO) + Mapper 패턴으로 Entity 분리
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

### 레이어별 개발 순서

기능 구현 시 다음 순서를 따릅니다:

```
1. Domain Layer (순수 비즈니스 로직)
   - Entity, Value Object 정의
   - Repository Interface 정의
   - UseCase 작성
   ↓
2. Data Layer (외부 의존성 처리)
   - Model (DTO) 작성
   - Mapper 작성
   - DataSource 작성
   - Repository Implementation 작성
   ↓
3. DI 설정 (의존성 주입)
   - DataSource Provider/Module 등록
   - Repository Provider/Module 등록
   ↓
4. Presentation Layer (UI)
   - Provider/Controller/Presenter 작성
   - Screen/View 작성
   - Widget/Component 작성
   ↓
5. 테스트 작성
   - UseCase 단위 테스트
   - Repository 단위 테스트
   - Widget/UI 테스트
```

### 상세 프로세스

1. **도메인 파악**: 어떤 Aggregate와 관련? 어떤 Value Object 필요?
2. **인터페이스 정의**: 구현할 클래스와 메서드 시그니처 먼저 설계
3. **테스트 시나리오**: 정상 케이스 1개 + 예외 케이스 2개 이상 제안
4. **구현**: TDD 사이클 시작

## 코드 컨벤션

- **Early Return**: 들여쓰기 줄이기 위해 빠른 반환 사용
- **명시적 예외**: 포괄적인 `Exception` 대신 구체적인 커스텀 예외 정의 (예: `InsufficientFundsException`)
- **불변성 선호**: 가능한 모든 변수는 `final`, `readonly`, `const` 등으로 불변성 유지

## Either 타입 에러 처리

예외(Exception)를 throw하는 대신 `Either<Failure, Success>` 타입을 반환하여 에러를 명시적으로 처리합니다.

### 장점
- 컴파일 타임에 에러 처리 강제
- 예외 전파 방지로 예측 가능한 흐름
- 함수형 프로그래밍 패턴 적용 가능

### 기본 패턴

```
// Repository Interface
Future<Either<Failure, User>> getUser(String id);

// UseCase에서 처리
final result = await repository.getUser(id);
return result.fold(
  (failure) => Left(failure),  // 에러 전파
  (user) => Right(user),       // 성공 처리
);

// Presentation에서 처리
result.fold(
  (failure) => showError(failure.message),
  (data) => updateUI(data),
);
```

### Failure 타입 정의

```
abstract class Failure {
  final String message;
  const Failure(this.message);
}

class ServerFailure extends Failure { ... }
class ValidationFailure extends Failure { ... }
class NetworkFailure extends Failure { ... }
class CacheFailure extends Failure { ... }
```

## Model(DTO) vs Entity 구분

### Entity
- **위치**: Domain Layer
- **목적**: 비즈니스 로직과 도메인 규칙 표현
- **특징**:
  - 순수 언어만 사용 (프레임워크 의존성 금지)
  - 불변성 (Immutable)
  - JSON 직렬화 로직 포함 금지
  - 비즈니스 메서드 포함 가능

### Model (DTO)
- **위치**: Data Layer
- **목적**: 외부 시스템과 데이터 교환
- **특징**:
  - JSON 직렬화/역직렬화 담당
  - DB 스키마나 API 응답 구조에 맞춤
  - 비즈니스 로직 포함 금지

### Mapper
- **위치**: Data Layer
- **목적**: Entity ↔ Model 양방향 변환
- **특징**:
  - static 메서드로 구성
  - `toEntity()`, `toModel()` 메서드 제공
  - 리스트 변환 헬퍼 제공

```
// Mapper 예시
class UserMapper {
  static UserEntity toEntity(UserModel model) { ... }
  static UserModel toModel(UserEntity entity) { ... }
  static List<UserEntity> toEntityList(List<UserModel> models) { ... }
}
```

## UseCase 직접 인스턴스화 패턴

UseCase는 DI 컨테이너에 등록하지 않고, 필요한 곳에서 직접 인스턴스화합니다.

### 올바른 패턴

```
// DI에는 Repository만 등록
@riverpod
UserRepository userRepository(ref) => UserRepositoryImpl(...);

// Presentation에서 UseCase 직접 생성
Future<void> createUser(UserParams params) async {
  final repository = ref.read(userRepositoryProvider);
  final useCase = CreateUserUseCase(repository);  // 직접 인스턴스화
  final result = await useCase(params);
  // ...
}
```

### 잘못된 패턴

```
// ❌ UseCase를 Provider로 등록하지 않음
@riverpod
CreateUserUseCase createUserUseCase(ref) => ...;
```

### 이유
- UseCase는 상태를 가지지 않는 단순 로직 컨테이너
- DI 그래프 복잡도 감소
- 테스트 시 Repository만 Mock하면 됨

## 일반적인 실수와 해결책

### ❌ Entity에 JSON 직렬화 로직 추가

```
// 잘못된 예
class UserEntity {
  factory UserEntity.fromJson(Map<String, dynamic> json) => ...
}
```

**해결책**: JSON 로직은 Model에만, Mapper로 변환

### ❌ Repository에서 비즈니스 로직 처리

```
// 잘못된 예
class UserRepositoryImpl {
  Future<User> createUser(User user) async {
    if (user.email.isEmpty) return Left(ValidationFailure(...));  // ❌
    // ...
  }
}
```

**해결책**: 유효성 검증은 UseCase에서 처리

### ❌ DataSource가 Entity 직접 사용

```
// 잘못된 예
class UserRemoteDataSource {
  Future<UserEntity> getUser(String id) async { ... }  // ❌
}
```

**해결책**: DataSource는 Model만 사용, Repository에서 Mapper로 변환

### ❌ Domain Layer에 프레임워크 import

```
// 잘못된 예
import 'package:flutter/material.dart';  // ❌
import 'package:supabase/supabase.dart'; // ❌

class UserEntity {
  final Color favoriteColor;  // ❌ Flutter 타입
}
```

**해결책**: Domain Layer는 순수 언어 타입만 사용

### ❌ UseCase를 DI Provider로 등록

```
// 잘못된 예
@riverpod
CreateUserUseCase createUserUseCase(ref) {
  return CreateUserUseCase(ref.watch(userRepositoryProvider));
}
```

**해결책**: Repository만 DI 등록, UseCase는 직접 인스턴스화

## 주의사항

사용자의 요청이 TDD, DDD 계층 분리 원칙을 위반하려 한다면, 정중하게 제동을 걸고 올바른 방향을 제안해야 합니다.
