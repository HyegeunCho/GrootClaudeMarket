---
name: notice_mail_only_rule_v1
title: "알림은 전자우편으로만 보낸다"
type: rule
layer: 1
category: notice
status: archived                   # draft | approved | active | archived
owner: "[MISSING]"
created: 2026-03-17
updated: 2026-03-20
derives_from:
  - L0_vision
---

# 알림은 전자우편으로만 보낸다

**한 문장 요약**: 알림은 전자우편으로만 보낸다.

## Why (근거 및 의도)
- 알림 수단을 좁힌다.

## Rule (규칙 및 결정 내용)
- 알림 수단은 전자우편이다.

## How to apply (구현 및 검증 기준)
- **구현 지침**: `LoanService`
- **코드 주석 삽입**: 관련 로직 상단에 `// Decision: [[notice_mail_only_rule_v1]]`
- **L4 검증(Lint) 조건**: 없음

## Exceptions (예외 사항)
- 없음

## Relations (관계)
- derives_from: [[L0_vision]]
- is_a: rule
- part_of: [[L0_vision]]

<!-- 영향 범위: rg "\[\[notice_mail_only_rule_v1\]\]" -->
