---
name: notice_feedback_v1
title: "알림 시험은 받는 사람을 밝힌다"
type: feedback
layer: 1
category: notice
status: draft                   # draft | approved | active | archived
owner: "[MISSING]"
created: 2026-03-20
updated: 2026-03-20
derives_from:
  - L0_vision
---

# 알림 시험은 받는 사람을 밝힌다

**한 문장 요약**: 알림 시험은 받는 사람을 밝힌다.

## Why (근거 및 의도)
- 받는 사람을 빼먹어 시험이 틀렸다([[outside_rule_v1]]).

## Rule (규칙 및 결정 내용)
- 알림 시험은 받는 사람을 밝힌다.

## How to apply (구현 및 검증 기준)
- **구현 지침**: `LoanService`
- **코드 주석 삽입**: 관련 로직 상단에 `// Decision: [[notice_feedback_v1]]`
- **L4 검증(Lint) 조건**: 없음

## Exceptions (예외 사항)
- 없음

## Relations (관계)
- derives_from: [[L0_vision]]
- is_a: feedback
- part_of: [[L0_vision]]

<!-- 영향 범위: rg "\[\[notice_feedback_v1\]\]" -->
