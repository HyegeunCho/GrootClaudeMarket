---
name: loan_dropped_rnd_v1
title: "[R&D] 밤에만 예약을 받는다"
type: rnd
layer: 3
category: loan
milestone: m1
status: archived                   # draft | approved | active | archived
owner: "[MISSING]"
created: 2026-03-17
updated: 2026-03-17
derives_from:
  - L0_vision
---

# [R&D] 밤에만 예약을 받는다

**한 문장 요약**: 밤에만 예약을 받는 가설을 시험한다.

## Why (근거 및 의도)
- 낮 시간 부하를 줄인다.

## Rule (임시 규칙 / 테스트 파라미터)
- 예약은 밤에만 받는다.

## How to apply (구현 및 검증 기준)
- **구현 지침**: `LoanService`
- **코드 주석 삽입**: 관련 로직 상단에 `// Decision: [[loan_dropped_rnd_v1]]`
- **L4 검증(Lint) 조건**: 없음

## Invalidation (무효화 조건) — 필수
- 부하가 줄지 않으면 폐기한다.

## Exceptions (예외 사항)
- 없음

## Relations (관계)
- derives_from: [[L0_vision]]
- is_a: rnd
- part_of: [[L1_loan_system]]

<!-- 영향 범위: rg "\[\[loan_dropped_rnd_v1\]\]" -->
