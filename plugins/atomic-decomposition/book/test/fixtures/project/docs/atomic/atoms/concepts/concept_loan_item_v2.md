---
name: concept_loan_item_v2
title: "개념 정의: 자료"
type: concept
layer: 1
category: loan
milestone: m1
status: draft                   # draft | approved | active | archived
owner: "[MISSING]"
created: 2026-03-18
updated: 2026-03-18
---

# 자료 (Item)

- **Definition (정의)**: 도서관에서 빌리거나 예약할 수 있는 것.
- **Required Properties (필수 속성)**: `itemId` / `shelfId`
- **Subtypes (하위 분류, is_a)**: 없음
- **Not a 자료 (비해당 경계)**: 열람석

## Relations (관계)
- conflicts_with: [[concept_loan_item_v1]]
- is_a: concept
- part_of: [[L1_loan_system]]
