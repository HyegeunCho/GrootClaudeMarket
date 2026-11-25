---
name: notice_no_sms_rule_v1
title: "문자 알림을 쓰지 않는다"
type: rule
layer: 1
category: notice
status: draft                   # draft | approved | active | archived
owner: "[MISSING]"
created: 2026-03-20
updated: 2026-03-20
derives_from:
  - L0_vision
conflicts_with:
  - notice_mail_only_rule_v1
---

# 문자 알림을 쓰지 않는다

**한 문장 요약**: 문자 알림을 쓰지 않는다.

## Why (근거 및 의도)
- 통신비를 줄인다.

## Rule (규칙 및 결정 내용)
- 문자 알림을 쓰지 않는다.

## How to apply (구현 및 검증 기준)
- **구현 지침**: `LoanService`
- **코드 주석 삽입**: 관련 로직 상단에 `// Decision: [[notice_no_sms_rule_v1]]`
- **L4 검증(Lint) 조건**: 없음

## Exceptions (예외 사항)
- 없음

## Relations (관계)
- derives_from: [[L0_vision]]
- conflicts_with: [[notice_mail_only_rule_v1]]
- is_a: rule
- part_of: [[L0_vision]]

<!-- 영향 범위: rg "\[\[notice_no_sms_rule_v1\]\]" -->
