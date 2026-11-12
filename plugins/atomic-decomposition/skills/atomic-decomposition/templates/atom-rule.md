---
name: {{domain}}_{{decision_body}}_v{{N}}
title: "{{한글 제목}}"
type: rule                      # rule | feedback
layer: {{0-4}}
category: {{domain}}
status: draft                   # draft | approved | active | archived
owner: "[MISSING]"              # 입력에 명시된 경우에만 채움
created: {{YYYY-MM-DD}}
updated: {{YYYY-MM-DD}}
applies_to:
  - {{대상 시스템 또는 모듈}}
affects:
  - {{영향받는 Atom, L3 시트, 소스 파일}}
requires:
  - {{선행 Atom 또는 모듈}}
derives_from:
  - {{상위 원칙 Atom 또는 L0_vision}}
conflicts_with:                 # 버전업 시 구버전. 없으면 이 키를 삭제
  - {{충돌 또는 대체되는 Atom}}
---

# {{한글 제목}}

**한 문장 요약**: {{이 Atom의 결정을 압축한 단 한 문장}}

## Why (근거 및 의도)
- {{기획적 의도 또는 기술적 트레이드오프. 어떤 대안 대신 왜 이것을 택했는가}}

## Rule (규칙 및 결정 내용)
- {{측정·검증 가능한 단일 결정: ms, 프레임, %, Enum, 상태 전이 조건. 값이 없으면 [확인 필요]}}

## How to apply (구현 및 검증 기준)
- **구현 지침**: {{코드·데이터 시트에 적용하는 구체 방법}}
- **코드 주석 삽입**: 관련 로직 상단에 `// See: [[{{name}}]]`
- **L4 검증(Lint) 조건**: {{어떤 상태를 위반으로 자동 검출할 것인가}}

## Exceptions (예외 사항)
- {{예외 케이스와 그 케이스가 따르는 Atom [[...]]. 없으면 "없음"}}

## Relations (관계)
- derives_from: [[{{상위 원칙 Atom}}]]
- affects: [[{{영향받는 Atom}}]], `{{영향받는 코드 또는 시트}}`
- requires: [[{{선행 Atom}}]]
- conflicts_with: [[{{구버전 Atom}}]]
- is_a: rule
- part_of: [[{{L<n>_소속 Layer 문서}}]]

<!-- 영향 범위: rg "\[\[{{name}}\]\]" -->
