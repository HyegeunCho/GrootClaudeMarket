---
name: loan_return_rule_v2
title: "반납은 빌린 순서대로이고 간행물은 한도와 무관하다"
type: rule
layer: 1
category: loan
milestone: m3
status: draft                   # draft | approved | active | archived
owner: "[MISSING]"
created: 2026-03-19
updated: 2026-03-19
derives_from:
  - L0_vision
---

# 반납은 빌린 순서대로이고 간행물은 한도와 무관하다

**한 문장 요약**: 반납은 빌린 순서대로이고 간행물은 한도와 무관하다.

## Why (근거 및 의도)
- 간행물이 생겨 한도와의 관계를 정해야 했다.

## Rule (규칙 및 결정 내용)
- 반납은 빌린 순서대로다. 간행물은 한도와 무관하다. [보류] 간행물 상한은 정하지 않았다.

## How to apply (구현 및 검증 기준)
- **구현 지침**: `LoanService`
- **코드 주석 삽입**: 관련 로직 상단에 `// Decision: [[loan_return_rule_v2]]`
- **L4 검증(Lint) 조건**: 없음

## Exceptions (예외 사항)
- 없음

## Relations (관계)
- derives_from: [[L0_vision]]
- is_a: rule
- part_of: [[L1_loan_system]]

<!-- 영향 범위: rg "\[\[loan_return_rule_v2\]\]" -->
