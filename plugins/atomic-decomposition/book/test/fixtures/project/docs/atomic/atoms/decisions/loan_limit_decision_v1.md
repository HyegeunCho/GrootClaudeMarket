---
name: loan_limit_decision_v1
title: "대출 권수는 등급마다 고정되고 한 번 정하면 바뀌지 않는다"
type: decision
layer: 1
category: loan
milestone: m1
status: archived                   # draft | approved | active | archived
owner: "[MISSING]"
proposer: "[MISSING]"
approver: "[MISSING]"
decided: 2026-03-13
created: 2026-03-17
updated: 2026-03-17
evidence:
  - 1a2b3c4
affects:
  - src/loan/LoanService.cs
requires:
  - concept_loan_item_v1
derives_from:
  - L0_vision
---

# 대출 권수는 등급마다 고정되고 한 번 정하면 바뀌지 않는다

**한 문장 요약**: 대출 권수는 등급마다 고정하고, 빌린 책은 `lentItems`에 기록한다.

## Why (근거 및 의도)
- **배경**: 계획서의 등급 고정 방식.
- **검토한 대안**: [MISSING]
- **선택 근거**: 등급표만으로 구현할 수 있어 단순했다.

## Rule (규칙 및 결정 내용)
- 대출 권수는 등급표를 따른다. 빌리면 `lentItems`에 넣는다.

## How to apply (구현 및 검증 기준)
- **구현 지침**: `LoanService`
- **코드 주석 삽입**: 관련 로직 상단에 `// Decision: [[loan_limit_decision_v1]]`
- **L4 검증(Lint) 조건**: 없음

## Exceptions (예외 사항)
- 없음

## Relations (관계)
- derives_from: [[L0_vision]]
- affects: `src/loan/LoanService.cs`
- requires: [[concept_loan_item_v1]]
- is_a: decision
- part_of: [[L1_loan_system]]

<!-- 영향 범위: rg "\[\[loan_limit_decision_v1\]\]" -->
