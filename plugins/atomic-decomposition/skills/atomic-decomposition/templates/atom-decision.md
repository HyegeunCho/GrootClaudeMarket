---
name: {{domain}}_{{decision_body}}_v{{N}}
title: "{{한글 제목}}"
type: decision
layer: {{0-4}}
category: {{domain}}
status: draft                   # draft | approved | active | archived
owner: "[MISSING]"              # 입력에 명시된 경우에만 채움
proposer: "[MISSING]"           # 발의자
approver: "[MISSING]"           # 승인자
decided: {{YYYY-MM-DD 또는 [MISSING]}}
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
conflicts_with:                 # 이 결정으로 대체되는 이전 결정. 없으면 이 키를 삭제
  - {{대체되는 Atom}}
---

# {{한글 제목}}

**한 문장 요약**: {{이 Atom의 결정을 압축한 단 한 문장}}

## Why (근거 및 의도)
- **배경**: {{결정이 필요했던 상황}}
- **검토한 대안**: {{대안 A — 기각 이유}} / {{대안 B — 기각 이유}} (입력에 없으면 [MISSING])
- **선택 근거**: {{트레이드오프와 이 선택의 이유}}

## Rule (규칙 및 결정 내용)
- {{측정·검증 가능한 단일 결정. 값이 없으면 [확인 필요]}}

## How to apply (구현 및 검증 기준)
- **구현 지침**: {{코드·데이터 시트에 적용하는 구체 방법}}
- **코드 주석 삽입**: 관련 로직 상단에 `// Decision: [[{{name}}]]`
- **L4 검증(Lint) 조건**: {{어떤 상태를 위반으로 자동 검출할 것인가}}

## Exceptions (예외 사항)
- {{예외 케이스와 그 케이스가 따르는 Atom [[...]]. 없으면 "없음"}}

## Relations (관계)
- derives_from: [[{{상위 원칙 Atom}}]]
- affects: [[{{영향받는 Atom}}]], `{{영향받는 코드 또는 시트}}`
- requires: [[{{선행 Atom}}]]
- conflicts_with: [[{{대체되는 Atom}}]]
- is_a: decision
- part_of: [[{{L<n>_소속 Layer 문서}}]]

<!-- 영향 범위: rg "\[\[{{name}}\]\]" -->
