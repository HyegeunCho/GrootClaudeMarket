# Unity 클린 아키텍처 & DDD 가이드

유니티 프로젝트에서 클린 아키텍처와 도메인 주도 설계(DDD)를 적용하기 위한 개발 표준 가이드입니다.

> **참조**: 기본 CA/DDD 원칙, 체크리스트는 [SKILL.md](SKILL.md)를 참조하세요.
> 이 문서는 Unity 환경에 특화된 구현 가이드입니다.

## 사용 시점

- Unity 프로젝트에서 새 Feature를 구현할 때
- 게임 시스템 아키텍처를 설계할 때
- UI와 비즈니스 로직 분리가 필요할 때

## 프로젝트 구조 (Feature-Based Packaging)

레이어별 폴더링이 아닌, **피쳐(Feature)별 폴더링**을 원칙으로 합니다.

```
Assets/
└── Features/
    └── {FeatureName}/          # 예: Inventory, PlayerStats
        ├── Domain/             # (Pure C#) 엔티티, 도메인 서비스, 리포지토리 인터페이스
        ├── Application/        # (Pure C#) 유즈 케이스 (Use Cases)
        ├── Presentation/       # (Unity) View, Presenter, UI 리소스, 애니메이션
        ├── Infrastructure/     # (Unity/C#) 리포지토리 구현, 외부 시스템 연동
        └── Data/               # (Unity) ScriptableObjects (데이터 컨테이너)
```

## 레이어별 구현 규칙

### A. Domain Layer (핵심 로직)

**절대 원칙: UnityEngine 네임스페이스 참조 금지 (순수 C#)**

- **Entity**: 데이터와 핵심 비즈니스 로직을 가진 POCO 객체
- **IRepository**: 데이터 접근을 위한 인터페이스 정의
- **리소스 처리**: Sprite, GameObject 등 유니티 타입 포함 금지. ID(int/string)나 Path(string) 같은 식별자만 사용

### B. Application Layer (유즈 케이스)

**원칙: UnityEngine 네임스페이스 참조 금지**

- **UseCase 클래스**: 사용자 요청(Input)을 받아 도메인 객체 조작 후 리포지토리에 저장하는 흐름 제어

### C. Presentation Layer (UI 및 표현)

**MVP (Model-View-Presenter) 패턴 사용**

#### View (MonoBehaviour)
- 로직을 포함하지 않는 '멍청한(Dumb)' 객체
- IView 인터페이스 구현으로 테스트 용이성 확보
- 유니티 리소스(Prefab, Sprite, Animation) 직접 참조

#### Presenter (Pure C#)
- View와 Model(Domain/UseCase)의 중개자
- View 이벤트 구독, UseCase 실행, View 갱신

#### Resource Provider
- 도메인 데이터(ID)를 유니티 리소스(Sprite)로 변환

### D. Infrastructure Layer & Data

- Domain Layer의 인터페이스(IRepository) 실제 구현
- ScriptableObject(SO)로 정적 데이터 관리
- SO 데이터를 도메인 Entity로 변환(Mapping)하여 반환

## 리포지토리 모킹 & 데이터 매핑

서버/실제 DB 없이 ScriptableObject를 데이터 소스로 활용:

1. **Data Layer**: ScriptableObject로 데이터 정의 (`ItemDataSO`)
2. **Infrastructure**: IRepository 구현 클래스 생성 (`SOItemRepository`)
3. **Mapping**: SO 데이터를 `new Entity(...)`로 변환하여 반환

**도메인은 SO의 존재를 몰라야 함**

```csharp
// Infrastructure 예시
public class SOInventoryRepository : IInventoryRepository
{
    private readonly ItemDatabaseSO _database;

    public ItemEntity GetItem(int id)
    {
        var so = _database.FindById(id);
        // Mapping: Unity SO -> Domain Entity
        return new ItemEntity(so.id, so.name, so.weight);
    }
}
```

## MVP 구현 템플릿

### View (Interface & MonoBehaviour)

```csharp
public interface IItemView
{
    void SetTitle(string title);
    void SetIcon(Sprite icon);
    event Action OnClick;
}

public class ItemView : MonoBehaviour, IItemView
{
    [SerializeField] private Image _icon;
    [SerializeField] private TMP_Text _title;
    public event Action OnClick;

    private void Start() => GetComponent<Button>().onClick.AddListener(() => OnClick?.Invoke());

    public void SetTitle(string title) => _title.text = title;
    public void SetIcon(Sprite icon) => _icon.sprite = icon;
}
```

### Presenter

```csharp
public class ItemPresenter
{
    private readonly IItemView _view;
    private readonly ItemEntity _model;
    private readonly IResourceProvider _resources;

    public void Initialize()
    {
        _view.SetTitle(_model.Name);
        _view.SetIcon(_resources.GetSprite(_model.Id));
        _view.OnClick += HandleClick;
    }
}
```

## 리소스(Assets) 관리 규칙

- **Prefabs**: `Features/{Name}/Presentation/Prefabs` (View 스크립트 부착)
- **Animations**: `Features/{Name}/Presentation/Animations`
- **Textures/Sprites**: 피쳐 전용은 Presentation 하위, 공용은 `Assets/Art/UI` 등 별도 관리
- **ScriptableObjects**: `Features/{Name}/Data` 폴더에 에셋 파일(.asset) 생성

## 체크리스트

코드 작성/리뷰 시 점검 사항:

- [ ] Domain 폴더의 스크립트에 `using UnityEngine;`이 없는가?
- [ ] View 클래스에 비즈니스 로직(if문, 계산식 등)이 없는가?
- [ ] Entity가 MonoBehaviour나 ScriptableObject를 상속받지 않았는가?
- [ ] Repository 구현체가 Entity를 직접 반환하도록 매핑 로직이 포함되었는가?
- [ ] UI 업데이트 로직이 Presenter에 위임되어 있는가?
