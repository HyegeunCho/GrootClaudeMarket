---
name: {{domain}}_{{decision_body}}_v{{N}}
title: "[R&D] {{한글 제목}}"
type: rnd
layer: {{0-4}}
category: {{domain}}
status: pending                 # pending | approved(→ rule/decision으로 승격) | archived
owner: "[MISSING]"
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
---

# [R&D] {{한글 제목}}

**한 문장 요약**: {{검증하려는 가설 또는 임시 조치를 한 문장으로}}

## Why (근거 및 의도)
- {{왜 이 가설·우회가 필요한가}}

## Rule (임시 규칙 / 테스트 파라미터)
- {{지금 적용 중인 값·방법. 값이 없으면 [확인 필요]}}

## How to apply (구현 및 검증 기준)
- **구현 지침**: {{적용 방법}}
- **코드 주석 삽입**: 관련 로직 상단에 `// RnD: [[{{name}}]]`
- **검증 방법**: {{무엇을 측정해 가설을 판정하는가}}

## Invalidation (무효화 조건) — 필수
- {{이 조건이 충족되면 폐기하거나 rule/decision으로 승격한다: 측정값, 기한, 이벤트}}

## Exceptions (예외 사항)
- {{없으면 "없음"}}

## Relations (관계)
- derives_from: [[{{상위 원칙 Atom}}]]
- affects: [[{{영향받는 Atom}}]], `{{영향받는 코드 또는 시트}}`
- requires: [[{{선행 Atom}}]]
- is_a: rnd
- part_of: [[{{L<n>_소속 Layer 문서}}]]
