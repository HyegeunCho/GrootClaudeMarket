---
name: loan_limit_decision_v3
title: "대출 권수는 지난 날마다 늘고 한도 안에서만 다시 빌린다"
type: decision
layer: 1
category: loan
milestone: m3
status: draft                   # draft | approved | active | archived
owner: "[MISSING]"
proposer: "[MISSING]"
approver: "[MISSING]"
decided: 2026-03-21
created: 2026-03-21
updated: 2026-03-21
evidence:
  - docs/Plan_v2.md
affects:
  - src/loan/LoanService.cs
  - loan_fee_values_rnd_v1
requires:
  - concept_loan_item_v2
derives_from:
  - L0_vision
conflicts_with:
  - loan_limit_decision_v2
---

# 대출 권수는 지난 날마다 늘고 한도 안에서만 다시 빌린다

**한 문장 요약**: 다시 빌리기는 지난 날 주기로 일어나며 빌리는 권수는 등급마다 정한 한도 안이다.

## Why (근거 및 의도)
- **배경**: v2까지는 빌리고 돌려주기만 해도 권수가 끝없이 늘었다.
- **검토한 대안**: 다시 빌리기 폐지 — 연구 목적 대출이 막혀 기각.
- **선택 근거**: 끝없는 대출은 등급별 한도가 끊는다.

## Rule (규칙 및 결정 내용)
- 지난 날이 `renewDays`에 닿으면 다시 센다. 0이면 다시 세지 않는다.
- 예약한 책은 한도와 무관하게 빌린다.
- 같은 책은 `holdGap`만큼 띄운다.
- 값은 [[loan_fee_values_rnd_v1]]을 따른다.

## How to apply (구현 및 검증 기준)
- **구현 지침**: `LoanService`
- **코드 주석 삽입**: 관련 로직 상단에 `// Decision: [[loan_limit_decision_v3]]`
- **L4 검증(Lint) 조건**: 없음

## Exceptions (예외 사항)
- 정기 간행물은 이 한도와 무관하다([[loan_return_rule_v2]]).

## Relations (관계)
- derives_from: [[L0_vision]]
- affects: `src/loan/LoanService.cs`, [[loan_fee_values_rnd_v1]]
- requires: [[concept_loan_item_v2]]
- conflicts_with: [[loan_limit_decision_v2]]
- is_a: decision
- part_of: [[L1_loan_system]]

<!-- 영향 범위: rg "\[\[loan_limit_decision_v3\]\]" -->
