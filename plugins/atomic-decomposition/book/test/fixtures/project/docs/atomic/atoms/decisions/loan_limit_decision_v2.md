---
name: loan_limit_decision_v2
title: "대출 권수는 달마다 다시 세어 남은 만큼 빌린다"
type: decision
layer: 1
category: loan
milestone: m1
status: archived                   # draft | approved | active | archived
owner: "[MISSING]"
proposer: "[MISSING]"
approver: "[MISSING]"
decided: 2026-03-17
created: 2026-03-17
updated: 2026-03-21
evidence:
  - 90ab12c
affects:
  - src/loan/LoanService.cs
requires:
  - concept_loan_item_v1
derives_from:
  - L0_vision
conflicts_with:
  - loan_limit_decision_v1
---

# 대출 권수는 달마다 다시 세어 남은 만큼 빌린다

**한 문장 요약**: 정해진 시간이 지날 때마다 빌린 권수를 다시 세고 남은 만큼 빌린다.

## Why (근거 및 의도)
- **배경**: 고정 권수(v1)만으로는 빌릴 책이 너무 모자랐다(90ab12c).
- **선택 근거**: 한 번에 많이 빌리지 않아도 된다.

## Rule (규칙 및 결정 내용)
- 다시 세는 주기는 `renewHours`다. 주기 0이면 다시 세지 않는다.

## How to apply (구현 및 검증 기준)
- **구현 지침**: `LoanService`
- **코드 주석 삽입**: 관련 로직 상단에 `// Decision: [[loan_limit_decision_v2]]`
- **L4 검증(Lint) 조건**: 없음

## Exceptions (예외 사항)
- 없음

## Relations (관계)
- derives_from: [[L0_vision]]
- affects: `src/loan/LoanService.cs`
- requires: [[concept_loan_item_v1]]
- conflicts_with: [[loan_limit_decision_v1]]
- is_a: decision
- part_of: [[L1_loan_system]]

<!-- 영향 범위: rg "\[\[loan_limit_decision_v2\]\]" -->
