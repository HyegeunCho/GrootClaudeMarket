---
name: notice_time_rule_v1
title: "알림 시각은 정한 때뿐이다"
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

# 알림 시각은 정한 때뿐이다

**한 문장 요약**: 알림은 정한 시각에만 보낸다.

## Why (근거 및 의도)
- 전자우편 제한을 없애며 알림 시각을 따로 정해야 했다.

## Rule (규칙 및 결정 내용)
- 알림은 정한 시각에만 보낸다.

## How to apply (구현 및 검증 기준)
- **구현 지침**: `LoanService`
- **코드 주석 삽입**: 관련 로직 상단에 `// Decision: [[notice_time_rule_v1]]`
- **L4 검증(Lint) 조건**: 없음

## Exceptions (예외 사항)
- 없음

## Relations (관계)
- derives_from: [[L0_vision]]
- conflicts_with: [[notice_mail_only_rule_v1]]
- is_a: rule
- part_of: [[L0_vision]]

<!-- 영향 범위: rg "\[\[notice_time_rule_v1\]\]" -->
