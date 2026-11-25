---
name: loan_fee_values_rnd_v1
title: "[R&D] 연체료는 시험값이다"
type: rnd
layer: 3
category: loan
milestone: m3
status: pending                   # draft | approved | active | archived
owner: "[MISSING]"
created: 2026-03-21
updated: 2026-03-21
requires:
  - loan_limit_decision_v3
derives_from:
  - loan_limit_decision_v3
---

# [R&D] 연체료는 시험값이다

**한 문장 요약**: 하루 연체료 3.5와 다시 세는 주기 8h는 시험값이다.

## Why (근거 및 의도)
- 실제로 걷어 봐야 판정할 수 있다.

## Rule (임시 규칙 / 테스트 파라미터)
- 하루 연체료 3.5, `renewDays` 8. 판정 기준: [확인 필요: 판정 기준]

## How to apply (구현 및 검증 기준)
- **구현 지침**: `LoanService`
- **코드 주석 삽입**: 관련 로직 상단에 `// Decision: [[loan_fee_values_rnd_v1]]`
- **L4 검증(Lint) 조건**: 없음

## Invalidation (무효화 조건) — 필수
- 값을 확정하면 decision으로 올리고 이 문서를 archived 한다.

## Exceptions (예외 사항)
- 없음

## Relations (관계)
- derives_from: [[loan_limit_decision_v3]]
- requires: [[loan_limit_decision_v3]]
- is_a: rnd
- part_of: [[L1_loan_system]]

<!-- 영향 범위: rg "\[\[loan_fee_values_rnd_v1\]\]" -->
