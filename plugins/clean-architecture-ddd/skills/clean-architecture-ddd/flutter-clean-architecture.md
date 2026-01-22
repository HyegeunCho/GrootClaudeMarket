# Flutter 클린 아키텍처 & DDD 가이드

Flutter 프로젝트에서 클린 아키텍처와 도메인 주도 설계(DDD)를 적용하기 위한 개발 표준 가이드입니다.

> **참조**: 기본 CA/DDD 원칙, 체크리스트는 [SKILL.md](SKILL.md)를 참조하세요.
> 이 문서는 Flutter 환경에 특화된 구현 가이드입니다.

## 사용 시점

- Flutter 프로젝트에서 새 Feature를 구현할 때
- 앱 아키텍처를 설계하거나 리팩토링할 때
- UI와 비즈니스 로직 분리가 필요할 때
- 오프라인/온라인 동기화가 필요한 앱 개발 시

## 필수 패키지

```yaml
dependencies:
  dartz: ^0.10.1              # Either, Unit 등 함수형 프로그래밍
  equatable: ^2.0.5           # Entity 비교용
  json_annotation: ^4.9.0     # JSON 직렬화 어노테이션
  flutter_riverpod: ^2.0.0    # 상태 관리 및 DI
  riverpod_annotation: ^2.0.0 # Riverpod 코드 생성

dev_dependencies:
  build_runner: ^2.4.7
  json_serializable: ^6.7.1
  riverpod_generator: ^2.3.9
  mockito: ^5.4.0             # 테스트용 Mock
```

## 프로젝트 구조 (Feature-Based Packaging)

레이어별 폴더링이 아닌, **피쳐(Feature)별 폴더링**을 원칙으로 합니다.

```
lib/
├── core/                           # 공통 인프라
│   ├── error/
│   │   └── failures.dart          # Failure 타입 정의
│   └── di/
│       └── injection.dart         # 중앙화된 DI 설정
│
└── features/
    └── {feature_name}/            # 예: auth, user, product
        ├── domain/                # (Pure Dart) 순수 비즈니스 로직
        │   ├── entities/          # Entity 클래스
        │   ├── repositories/      # Repository Interface
        │   ├── usecases/          # UseCase 클래스
        │   └── services/          # Domain Service (필요시)
        │
        ├── data/                  # 외부 의존성 처리
        │   ├── models/            # Model (DTO)
        │   ├── mappers/           # Entity ↔ Model 변환
        │   ├── datasources/       # Remote/Local DataSource
        │   └── repositories/      # Repository Implementation
        │
        └── presentation/          # UI 레이어
            ├── providers/         # Riverpod Provider/Notifier
            ├── screens/           # Screen 위젯
            └── widgets/           # 재사용 위젯
```

## 레이어별 구현 규칙

### A. Domain Layer (순수 비즈니스 로직)

**절대 원칙: Flutter/외부 패키지 import 금지 (순수 Dart)**

허용되는 import:
- `dart:core`, `dart:async` 등 기본 Dart 라이브러리
- `package:equatable/equatable.dart`
- `package:dartz/dartz.dart`

금지되는 import:
- `package:flutter/*`
- `package:supabase_flutter/*`
- `package:json_annotation/*`
- 기타 모든 외부 패키지

### B. Data Layer (외부 의존성 처리)

- **Model (DTO)**: JSON 직렬화/역직렬화 담당
- **Mapper**: Entity ↔ Model 변환
- **DataSource**: Remote(API)/Local(DB) 데이터 접근
- **Repository Impl**: DataSource 조합, Either 변환, 에러 처리

### C. Presentation Layer (UI)

- **Provider**: Riverpod Provider/Notifier로 상태 관리
- **Screen**: 화면 단위 위젯
- **Widget**: 재사용 가능한 UI 컴포넌트

## Failure 타입 정의

```dart
// lib/core/error/failures.dart
import 'package:equatable/equatable.dart';

abstract class Failure extends Equatable {
  final String message;
  const Failure(this.message);

  @override
  List<Object> get props => [message];
}

class ServerFailure extends Failure {
  const ServerFailure([String message = '서버 오류가 발생했습니다'])
      : super(message);
}

class ValidationFailure extends Failure {
  const ValidationFailure([String message = '입력 값이 올바르지 않습니다'])
      : super(message);
}

class NetworkFailure extends Failure {
  const NetworkFailure([String message = '네트워크 오류가 발생했습니다'])
      : super(message);
}

class CacheFailure extends Failure {
  const CacheFailure([String message = '로컬 저장소 오류가 발생했습니다'])
      : super(message);
}

class AuthFailure extends Failure {
  const AuthFailure([String message = '인증에 실패했습니다'])
      : super(message);
}
```

## 구현 템플릿

### 1. Entity (Domain Layer)

```dart
// lib/features/user/domain/entities/user_entity.dart
import 'package:equatable/equatable.dart';

/// 사용자 Entity
///
/// 책임:
/// - 사용자 데이터 표현
/// - 사용자 관련 비즈니스 로직
class UserEntity extends Equatable {
  final String id;
  final String email;
  final String name;
  final DateTime createdAt;
  final bool isActive;

  const UserEntity({
    required this.id,
    required this.email,
    required this.name,
    required this.createdAt,
    required this.isActive,
  });

  /// 비즈니스 로직: 계정 활성 상태 확인
  bool get isValidAccount => isActive && email.isNotEmpty;

  /// 비즈니스 로직: 신규 사용자 여부 (7일 이내)
  bool get isNewUser {
    final daysSinceCreation = DateTime.now().difference(createdAt).inDays;
    return daysSinceCreation <= 7;
  }

  /// 복사본 생성 (불변성 유지)
  UserEntity copyWith({
    String? id,
    String? email,
    String? name,
    DateTime? createdAt,
    bool? isActive,
  }) {
    return UserEntity(
      id: id ?? this.id,
      email: email ?? this.email,
      name: name ?? this.name,
      createdAt: createdAt ?? this.createdAt,
      isActive: isActive ?? this.isActive,
    );
  }

  @override
  List<Object?> get props => [id, email, name, createdAt, isActive];
}
```

**핵심 원칙:**
- Equatable 상속 (값 비교)
- 모든 필드 `final` (불변성)
- JSON 직렬화 로직 없음
- 비즈니스 로직 포함 (getter, 메서드)
- 외부 의존성 없음

### 2. Repository Interface (Domain Layer)

```dart
// lib/features/user/domain/repositories/user_repository.dart
import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/user_entity.dart';

/// 사용자 Repository Interface
///
/// 책임:
/// - 사용자 데이터 접근 메서드 정의
/// - 구현은 Data Layer에서 담당
abstract class UserRepository {
  /// 사용자 정보 스트림 (실시간 업데이트)
  Stream<Either<Failure, UserEntity>> watchUser(String userId);

  /// 사용자 정보 조회
  Future<Either<Failure, UserEntity>> getUser(String userId);

  /// 사용자 생성
  Future<Either<Failure, UserEntity>> createUser(UserEntity user);

  /// 사용자 정보 수정
  Future<Either<Failure, UserEntity>> updateUser(UserEntity user);

  /// 사용자 삭제
  Future<Either<Failure, Unit>> deleteUser(String userId);
}
```

**핵심 원칙:**
- `abstract class`로 정의
- 모든 메서드가 `Either<Failure, Success>` 반환
- 비동기 작업은 `Future` 사용
- 실시간 데이터는 `Stream` 사용
- 삭제/업데이트 성공 시 `Unit` 반환

### 3. UseCase (Domain Layer)

```dart
// lib/features/user/domain/usecases/create_user_usecase.dart
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import '../../../../core/error/failures.dart';
import '../entities/user_entity.dart';
import '../repositories/user_repository.dart';

/// 사용자 생성 UseCase
///
/// 책임:
/// - 사용자 생성 비즈니스 로직
/// - 유효성 검증
/// - Repository 호출
class CreateUserUseCase {
  final UserRepository repository;

  CreateUserUseCase(this.repository);

  Future<Either<Failure, UserEntity>> call(CreateUserParams params) async {
    // 1. 유효성 검증
    final validation = _validate(params);
    if (validation != null) {
      return Left(ValidationFailure(validation));
    }

    // 2. Entity 생성
    final user = UserEntity(
      id: params.id,
      email: params.email,
      name: params.name,
      createdAt: DateTime.now(),
      isActive: true,
    );

    // 3. Repository 호출
    return await repository.createUser(user);
  }

  String? _validate(CreateUserParams params) {
    if (params.email.trim().isEmpty) {
      return '이메일을 입력해주세요';
    }

    if (!params.email.contains('@')) {
      return '올바른 이메일 형식이 아닙니다';
    }

    if (params.name.trim().isEmpty) {
      return '이름을 입력해주세요';
    }

    return null;
  }
}

/// CreateUserUseCase 파라미터
class CreateUserParams extends Equatable {
  final String id;
  final String email;
  final String name;

  const CreateUserParams({
    required this.id,
    required this.email,
    required this.name,
  });

  @override
  List<Object?> get props => [id, email, name];
}
```

**핵심 원칙:**
- 하나의 UseCase는 하나의 비즈니스 행위만
- `call` 메서드로 실행
- Params 클래스는 `Equatable` 상속
- 유효성 검증 로직 포함
- Repository에 의존

### 4. Model (Data Layer)

```dart
// lib/features/user/data/models/user_model.dart
import 'package:json_annotation/json_annotation.dart';

part 'user_model.g.dart';

/// 사용자 Model (DTO)
///
/// 책임:
/// - JSON 직렬화/역직렬화
/// - 외부 시스템과 데이터 교환
@JsonSerializable(fieldRename: FieldRename.snake)
class UserModel {
  final String id;
  final String email;
  final String name;

  @JsonKey(includeFromJson: true, includeToJson: false)
  final DateTime createdAt;

  final bool isActive;

  const UserModel({
    required this.id,
    required this.email,
    required this.name,
    required this.createdAt,
    required this.isActive,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) =>
      _$UserModelFromJson(json);

  Map<String, dynamic> toJson() => _$UserModelToJson(this);
}
```

코드 생성 실행:
```bash
flutter pub run build_runner build --delete-conflicting-outputs
```

**핵심 원칙:**
- `@JsonSerializable` 어노테이션 사용
- `fieldRename: FieldRename.snake` (DB는 snake_case)
- 읽기 전용 필드는 `@JsonKey(includeFromJson: true, includeToJson: false)`
- 비즈니스 로직 없음

### 5. Mapper (Data Layer)

```dart
// lib/features/user/data/mappers/user_mapper.dart
import '../../domain/entities/user_entity.dart';
import '../models/user_model.dart';

/// User Entity ↔ Model 변환 Mapper
class UserMapper {
  /// Model → Entity 변환
  static UserEntity toEntity(UserModel model) {
    return UserEntity(
      id: model.id,
      email: model.email,
      name: model.name,
      createdAt: model.createdAt,
      isActive: model.isActive,
    );
  }

  /// Entity → Model 변환
  static UserModel toModel(UserEntity entity) {
    return UserModel(
      id: entity.id,
      email: entity.email,
      name: entity.name,
      createdAt: entity.createdAt,
      isActive: entity.isActive,
    );
  }

  /// 리스트 변환 헬퍼
  static List<UserEntity> toEntityList(List<UserModel> models) {
    return models.map((model) => toEntity(model)).toList();
  }

  static List<UserModel> toModelList(List<UserEntity> entities) {
    return entities.map((entity) => toModel(entity)).toList();
  }
}
```

### 6. DataSource (Data Layer)

```dart
// lib/features/user/data/datasources/user_remote_datasource.dart
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/user_model.dart';

/// 사용자 Remote DataSource Interface
abstract class UserRemoteDataSource {
  Stream<UserModel> watchUser(String userId);
  Future<UserModel> getUser(String userId);
  Future<UserModel> createUser(UserModel user);
  Future<UserModel> updateUser(UserModel user);
  Future<void> deleteUser(String userId);
}

/// 사용자 Remote DataSource 구현 (Supabase)
class UserRemoteDataSourceImpl implements UserRemoteDataSource {
  final SupabaseClient client;

  UserRemoteDataSourceImpl(this.client);

  @override
  Stream<UserModel> watchUser(String userId) {
    return client
        .from('users')
        .stream(primaryKey: ['id'])
        .eq('id', userId)
        .map((data) => UserModel.fromJson(data.first));
  }

  @override
  Future<UserModel> getUser(String userId) async {
    final data = await client
        .from('users')
        .select()
        .eq('id', userId)
        .single();

    return UserModel.fromJson(data);
  }

  @override
  Future<UserModel> createUser(UserModel user) async {
    final data = await client
        .from('users')
        .insert(user.toJson())
        .select()
        .single();

    return UserModel.fromJson(data);
  }

  @override
  Future<UserModel> updateUser(UserModel user) async {
    final data = await client
        .from('users')
        .update(user.toJson())
        .eq('id', user.id)
        .select()
        .single();

    return UserModel.fromJson(data);
  }

  @override
  Future<void> deleteUser(String userId) async {
    await client
        .from('users')
        .delete()
        .eq('id', userId);
  }
}
```

**핵심 원칙:**
- Interface + Implementation 패턴
- Model만 사용 (Entity 모름)
- 예외 처리는 Repository에서 담당

### 7. Repository Implementation (Data Layer)

```dart
// lib/features/user/data/repositories/user_repository_impl.dart
import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/user_repository.dart';
import '../datasources/user_remote_datasource.dart';
import '../mappers/user_mapper.dart';

/// 사용자 Repository 구현
class UserRepositoryImpl implements UserRepository {
  final UserRemoteDataSource remoteDataSource;

  UserRepositoryImpl({required this.remoteDataSource});

  @override
  Stream<Either<Failure, UserEntity>> watchUser(String userId) async* {
    try {
      yield* remoteDataSource.watchUser(userId).map(
        (model) => Right(UserMapper.toEntity(model)),
      );
    } catch (e) {
      yield Left(ServerFailure('사용자 정보를 가져오는데 실패했습니다: $e'));
    }
  }

  @override
  Future<Either<Failure, UserEntity>> getUser(String userId) async {
    try {
      final model = await remoteDataSource.getUser(userId);
      return Right(UserMapper.toEntity(model));
    } catch (e) {
      return Left(ServerFailure('사용자 정보를 가져오는데 실패했습니다: $e'));
    }
  }

  @override
  Future<Either<Failure, UserEntity>> createUser(UserEntity user) async {
    try {
      final model = UserMapper.toModel(user);
      final created = await remoteDataSource.createUser(model);
      return Right(UserMapper.toEntity(created));
    } catch (e) {
      return Left(ServerFailure('사용자 생성에 실패했습니다: $e'));
    }
  }

  @override
  Future<Either<Failure, UserEntity>> updateUser(UserEntity user) async {
    try {
      final model = UserMapper.toModel(user);
      final updated = await remoteDataSource.updateUser(model);
      return Right(UserMapper.toEntity(updated));
    } catch (e) {
      return Left(ServerFailure('사용자 정보 수정에 실패했습니다: $e'));
    }
  }

  @override
  Future<Either<Failure, Unit>> deleteUser(String userId) async {
    try {
      await remoteDataSource.deleteUser(userId);
      return const Right(unit);
    } catch (e) {
      return Left(ServerFailure('사용자 삭제에 실패했습니다: $e'));
    }
  }
}
```

**핵심 원칙:**
- Repository Interface 구현
- try-catch로 예외 처리
- 모든 예외를 Failure로 변환
- Model ↔ Entity 변환
- 비즈니스 로직 없음

### 8. DI 설정 (Core Layer)

```dart
// lib/core/di/injection.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../features/user/data/datasources/user_remote_datasource.dart';
import '../../features/user/data/repositories/user_repository_impl.dart';
import '../../features/user/domain/repositories/user_repository.dart';

part 'injection.g.dart';

/// ============================================
/// Infrastructure
/// ============================================

@riverpod
SupabaseClient supabaseClient(SupabaseClientRef ref) {
  return Supabase.instance.client;
}

/// ============================================
/// User Feature
/// ============================================

@riverpod
UserRemoteDataSource userRemoteDataSource(UserRemoteDataSourceRef ref) {
  final client = ref.watch(supabaseClientProvider);
  return UserRemoteDataSourceImpl(client);
}

@riverpod
UserRepository userRepository(UserRepositoryRef ref) {
  final remoteDataSource = ref.watch(userRemoteDataSourceProvider);
  return UserRepositoryImpl(remoteDataSource: remoteDataSource);
}
```

**핵심 원칙:**
- DataSource와 Repository만 DI 등록
- UseCase는 DI에 등록하지 않음
- 중앙화된 의존성 관리

### 9. Provider/Notifier (Presentation Layer)

```dart
// lib/features/user/presentation/providers/user_provider.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../../core/di/injection.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/usecases/create_user_usecase.dart';
import '../../domain/usecases/update_user_usecase.dart';
import '../../domain/usecases/delete_user_usecase.dart';

part 'user_provider.g.dart';

/// 사용자 정보 스트림 Provider
@riverpod
Stream<UserEntity> userStream(UserStreamRef ref, String userId) async* {
  final repository = ref.watch(userRepositoryProvider);

  await for (final result in repository.watchUser(userId)) {
    yield result.fold(
      (failure) => throw Exception(failure.message),
      (user) => user,
    );
  }
}

/// 사용자 관리 Notifier
@riverpod
class UserNotifier extends _$UserNotifier {
  @override
  Future<void> build() async {}

  /// 사용자 생성
  Future<void> createUser({
    required String email,
    required String name,
  }) async {
    // Repository를 DI에서 가져오기
    final repository = ref.read(userRepositoryProvider);

    // UseCase 직접 인스턴스화
    final useCase = CreateUserUseCase(repository);

    final params = CreateUserParams(
      id: '', // 서버에서 생성
      email: email,
      name: name,
    );

    final result = await useCase(params);

    result.fold(
      (failure) => throw Exception(failure.message),
      (_) {}, // 성공 시 스트림이 자동 갱신
    );
  }

  /// 사용자 정보 수정
  Future<void> updateUser({
    required UserEntity currentUser,
    String? email,
    String? name,
  }) async {
    final repository = ref.read(userRepositoryProvider);
    final useCase = UpdateUserUseCase(repository);

    final params = UpdateUserParams(
      currentUser: currentUser,
      email: email,
      name: name,
    );

    final result = await useCase(params);

    result.fold(
      (failure) => throw Exception(failure.message),
      (_) {},
    );
  }

  /// 사용자 삭제
  Future<void> deleteUser(String userId) async {
    final repository = ref.read(userRepositoryProvider);
    final useCase = DeleteUserUseCase(repository);

    final result = await useCase(userId);

    result.fold(
      (failure) => throw Exception(failure.message),
      (_) {},
    );
  }
}
```

**핵심 원칙:**
- Stream Provider로 실시간 데이터 제공
- Notifier에서 UseCase 직접 인스턴스화
- Either의 fold()로 에러/성공 처리
- Repository만 DI에서 가져옴

### 10. Screen (Presentation Layer)

```dart
// lib/features/user/presentation/screens/user_profile_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/user_provider.dart';

class UserProfileScreen extends ConsumerWidget {
  final String userId;

  const UserProfileScreen({super.key, required this.userId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userAsync = ref.watch(userStreamProvider(userId));

    return Scaffold(
      appBar: AppBar(title: const Text('프로필')),
      body: userAsync.when(
        data: (user) => Column(
          children: [
            Text('이름: ${user.name}'),
            Text('이메일: ${user.email}'),
            if (user.isNewUser)
              const Chip(label: Text('신규 사용자')),
          ],
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => Center(
          child: Text('오류: $error', style: const TextStyle(color: Colors.red)),
        ),
      ),
    );
  }
}
```

## 오프라인/온라인 동기화 패턴

```dart
// Repository에서 모드에 따른 DataSource 선택
class UserRepositoryImpl implements UserRepository {
  final UserRemoteDataSource remoteDataSource;
  final UserLocalDataSource localDataSource;
  final String Function() getCurrentMode;

  @override
  Future<Either<Failure, UserEntity>> getUser(String userId) async {
    try {
      final mode = getCurrentMode();

      if (mode == 'offline') {
        final model = await localDataSource.getUser(userId);
        return Right(UserMapper.toEntity(model));
      } else {
        final model = await remoteDataSource.getUser(userId);
        // 온라인 데이터를 로컬에 캐싱
        await localDataSource.cacheUser(model);
        return Right(UserMapper.toEntity(model));
      }
    } catch (e) {
      return Left(ServerFailure('사용자 정보를 가져오는데 실패했습니다: $e'));
    }
  }
}
```

## 체크리스트

### Domain Layer
- [ ] Entity 작성 (Equatable 상속, 불변, 비즈니스 로직)
- [ ] Repository Interface 작성 (Either 반환)
- [ ] 모든 UseCase 작성 (단일 책임, Params 클래스)
- [ ] Flutter/외부 패키지 import 없음 확인

### Data Layer
- [ ] Model 작성 (json_serializable, snake_case)
- [ ] Mapper 작성 (toEntity, toModel)
- [ ] Remote DataSource 작성 (Interface + Impl)
- [ ] Local DataSource 작성 (필요 시)
- [ ] Repository Implementation 작성
- [ ] build_runner 실행

### DI 설정
- [ ] DataSource Provider 추가
- [ ] Repository Provider 추가
- [ ] UseCase Provider는 추가하지 않음
- [ ] build_runner 실행

### Presentation Layer
- [ ] Stream Provider 작성
- [ ] Notifier 작성 (UseCase 직접 인스턴스화)
- [ ] Screen 작성
- [ ] Widget 작성
- [ ] build_runner 실행

### 최종 확인
- [ ] `flutter analyze` 통과
- [ ] 빌드 성공
- [ ] 실제 동작 테스트

## 일반적인 실수와 해결책

### ❌ Entity에 JSON 직렬화 로직 추가

```dart
// 잘못된 예
class UserEntity {
  factory UserEntity.fromJson(Map<String, dynamic> json) => ...
}
```

**해결책**: JSON 로직은 Model에만, Mapper로 변환

### ❌ UseCase Provider 생성

```dart
// 잘못된 예
@riverpod
CreateUserUseCase createUserUseCase(ref) {
  return CreateUserUseCase(ref.watch(userRepositoryProvider));
}
```

**해결책**: Notifier에서 UseCase 직접 인스턴스화

### ❌ Repository에서 비즈니스 로직 처리

```dart
// 잘못된 예
class UserRepositoryImpl {
  Future<Either<Failure, UserEntity>> createUser(UserEntity user) async {
    if (user.email.isEmpty) {
      return Left(ValidationFailure('이메일을 입력하세요'));  // ❌
    }
    // ...
  }
}
```

**해결책**: 유효성 검증은 UseCase에서 처리

### ❌ DataSource가 Entity 직접 사용

```dart
// 잘못된 예
class UserRemoteDataSourceImpl {
  Future<UserEntity> getUser(String id) async { ... }  // ❌
}
```

**해결책**: DataSource는 Model만 사용, Repository에서 Mapper로 변환

### ❌ Domain Layer에 Flutter import

```dart
// 잘못된 예
import 'package:flutter/material.dart';  // ❌

class UserEntity {
  final Color favoriteColor;  // ❌ Flutter 타입
}
```

**해결책**: Domain Layer는 순수 Dart 타입만 사용

## 테스트 작성

### UseCase 테스트 예시

```dart
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';

@GenerateMocks([UserRepository])
import 'create_user_usecase_test.mocks.dart';

void main() {
  late CreateUserUseCase useCase;
  late MockUserRepository mockRepository;

  setUp(() {
    mockRepository = MockUserRepository();
    useCase = CreateUserUseCase(mockRepository);
  });

  group('CreateUserUseCase', () {
    test('이메일이 비어있으면 ValidationFailure 반환', () async {
      final params = CreateUserParams(
        id: '1',
        email: '',
        name: '홍길동',
      );

      final result = await useCase(params);

      expect(result.isLeft(), true);
      result.fold(
        (failure) => expect(failure, isA<ValidationFailure>()),
        (_) => fail('Should return failure'),
      );
    });

    test('유효한 파라미터로 사용자 생성 성공', () async {
      final params = CreateUserParams(
        id: '1',
        email: 'test@example.com',
        name: '홍길동',
      );

      final user = UserEntity(
        id: '1',
        email: 'test@example.com',
        name: '홍길동',
        createdAt: DateTime.now(),
        isActive: true,
      );

      when(mockRepository.createUser(any))
          .thenAnswer((_) async => Right(user));

      final result = await useCase(params);

      expect(result.isRight(), true);
      verify(mockRepository.createUser(any)).called(1);
    });
  });
}
```

Mock 생성:
```bash
flutter pub run build_runner build --delete-conflicting-outputs
```
