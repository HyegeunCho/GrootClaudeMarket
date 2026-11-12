---
name: L{{n}}_{{subject}}
title: "{{한글 제목}}"
type: layer
layer: {{n}}
status: draft
owner: "[MISSING]"
created: {{YYYY-MM-DD}}
updated: {{YYYY-MM-DD}}
derives_from:                   # L0이면 이 키를 삭제
  - {{상위 Layer 문서, 예: L0_vision}}
---

# {{한글 제목}}

## 목적
- {{이 Layer 문서가 다루는 범위와 존재 이유. 입력에 없으면 [MISSING]}}

## 범위
- **포함**: {{이 문서에 속하는 규칙·흐름·데이터의 경계}}
- **제외**: {{다른 Layer 문서가 담당하는 것과 그 링크 [[L<n>_...]]}}

## 인터페이스
- {{L1: 추상 Intent·스키마 / L2: 연결 FK 키 / L3: 컬럼·유효 범위·약속값 / L4: 차단 조건}}

## 소속 Atom 조회
이 문서는 Atom 목록을 직접 나열하지 않습니다 (정방향 기록 원칙). 아래 명령으로 조회합니다.

```bash
rg -l "part_of:.*L{{n}}_{{subject}}" {{ROOT}}/atoms
```
