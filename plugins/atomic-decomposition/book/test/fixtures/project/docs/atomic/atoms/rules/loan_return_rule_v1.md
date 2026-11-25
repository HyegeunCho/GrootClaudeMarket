---
name: loan_return_rule_v1
title: "반납은 빌린 순서대로다"
type: rule
layer: 1
category: loan
milestone: m1
status: archived                   # draft | approved | active | archived
owner: "[MISSING]"
created: 2026-03-17
updated: 2026-03-17
derives_from:
  - L0_vision
---

# 반납은 빌린 순서대로다

**한 문장 요약**: 반납은 빌린 순서대로다.

## Why (근거 및 의도)
- 순서를 고정한다.

## Rule (규칙 및 결정 내용)
- 반납은 빌린 순서대로다.

## How to apply (구현 및 검증 기준)
- **구현 지침**: `LoanService`
- **코드 주석 삽입**: 관련 로직 상단에 `// Decision: [[loan_return_rule_v1]]`
- **L4 검증(Lint) 조건**: 없음

## Exceptions (예외 사항)
- 없음

## Relations (관계)
- derives_from: [[L0_vision]]
- is_a: rule
- part_of: [[L1_loan_system]]

<!-- 영향 범위: rg "\[\[loan_return_rule_v1\]\]" -->
