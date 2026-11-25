// 예제 저장소로 만든 책. 원고는 검사를 통과하는 바른 원고다.
import fs from 'node:fs';
import path from 'node:path';
import { copyProject, write } from './util.mjs';
import { openBook, readState, writeState, chapters } from '../lib/bookfile.mjs';
import { renderBundle, bundleHash, hash, manuscriptFile } from '../lib/bundle.mjs';
import { readText } from '../lib/fsutil.mjs';

export const BOOK = {
  schema: 'atomic-book/v1',
  title: '예제 결정 책',
  atomicRoot: '../atomic',
  localNav: true,
  context: [
    { id: 'plan', title: '대출 기획서', kind: 'plan', mode: 'edit', versions: [{ label: 'v1', path: '../Plan_v1.md' }, { label: 'v2', path: '../Plan_v2.md' }] },
    { id: 'prompt', title: '안내문 프롬프트', kind: 'prompt', mode: 'appendix', versions: [{ path: '../안내문 프롬프트 (초안).md' }] },
  ],
  parts: [
    {
      id: 'background', title: '배경',
      chapters: [
        { id: 'vision', title: '비전', layers: ['L0_vision'] },
        { id: 'plan', title: '대출 기획서', context: ['plan'] },
      ],
    },
    {
      id: 'loan', title: '대출',
      chapters: [
        {
          id: 'limits', title: '대출 한도', layers: ['L1_loan_system'], context: ['plan'],
          atoms: ['concept_loan_item_v2', 'loan_limit_decision_v3', 'loan_fee_values_rnd_v1', 'loan_return_rule_v2'],
          dropped: ['loan_dropped_rnd_v1'],
        },
      ],
    },
    { id: 'notice', title: '알림', chapters: [{ id: 'channels', title: '알림 수단', atoms: ['notice_time_rule_v1', 'notice_no_sms_rule_v1', 'notice_feedback_v1'] }] },
  ],
};

export const LIMITS = `# 대출 한도

대출과 반납을 어떻게 다루는지 모았다.

## 자료
<!-- atoms: concept_loan_item_v2 -->
자료는 도서관에서 빌리거나 예약할 수 있는 것이다. 열람석은 자료가 아니다.

### 여기까지 온 과정
<!-- history: concept_loan_item_v2 -->
1. **v1 (2026-03-17)** 빌릴 수 있는 것이었다.
2. **v2 (2026-03-18)** 예약할 수 있는 것까지 넓혔다.

## 다시 빌리기
<!-- atoms: loan_limit_decision_v3, loan_fee_values_rnd_v1 -->
지난 날이 \`renewDays\`에 닿으면 빌린 권수를 다시 센다. 0이면 다시 세지 않는다. 예약한 책은 한도와 무관하게 빌리고, 빌리는 권수는 등급마다 정한 한도 안이다. 같은 책은 \`holdGap\`만큼 띄운다.

하루 연체료 3.5와 다시 세는 주기 8h는 시험값이다. 값을 확정하면 decision으로 올리고 이 문서를 폐기한다. 반납은 [[loan_return_rule_v2]]를 따른다.

### 여기까지 온 과정
<!-- history: loan_limit_decision_v3 -->
1. **v1 (2026-03-13)** 등급마다 고정하고 바꾸지 않았다. 등급표만으로 구현할 수 있어 단순했다.
2. **v2 (2026-03-17)** 고정 권수만으로는 빌릴 책이 너무 모자랐다. 정해진 시간이 지날 때마다 다시 세었다.
3. **v3 (2026-03-21)** 빌리고 돌려주기만 해도 권수가 끝없이 늘었다. 지난 날 주기와 등급별 한도로 바꿨다.

## 반납
<!-- atoms: loan_return_rule_v2 -->
반납은 빌린 순서대로다. 간행물은 한도와 무관하다.

### 여기까지 온 과정
<!-- history: loan_return_rule_v2 -->
1. **v1 (2026-03-17)** 빌린 순서대로 반납했다.
2. **v2 (2026-03-19)** 간행물이 생겨 한도와의 관계를 정했다.

## 아직 정해지지 않은 것
<!-- open -->
- 연체료의 판정 기준 ([[loan_fee_values_rnd_v1]])
- 간행물 상한 ([[loan_return_rule_v2]])
`;

export const PLAN = `# 대출 기획서

## 대출 권수
<!-- context: plan -->
v2는 한도 결정을 따로 둔다.

### 여기까지 온 과정
<!-- history: plan -->
1. **v1** 대출 권수를 고정했다.
2. **v2** 한도 결정을 따로 두었다.
`;

export const VISION = `# 비전

## 핵심
<!-- layers: L0_vision -->
누구나 책을 빌릴 수 있게 한다.
`;

export const MANUSCRIPTS = { 'loan/limits': LIMITS, 'background/plan': PLAN, 'background/vision': VISION };

export const bookDirOf = (project) => path.join(project, 'docs', 'atomic-book');

/** 책 설정과 원고를 넣은 임시 프로젝트. reviewed면 대조까지 마친 상태로 만든다. */
export function makeBook({ book = BOOK, manuscripts = MANUSCRIPTS, mutate, reviewed = true } = {}) {
  const project = copyProject(mutate);
  write(project, 'docs/atomic-book/book.json', JSON.stringify(book, null, 2) + '\n');
  for (const [key, text] of Object.entries(manuscripts)) write(project, `docs/atomic-book/manuscript/${key}.md`, text);
  const dir = bookDirOf(project);
  if (reviewed) markReviewed(dir);
  return { project, dir };
}

export function markReviewed(dir) {
  const ctx = openBook(dir);
  const state = readState(dir);
  for (const e of chapters(ctx.book)) {
    const f = manuscriptFile(dir, e.key);
    if (!fs.existsSync(f)) continue;
    const bundle = bundleHash(renderBundle(e, ctx));
    state.chapters[e.key] = { bundleHash: bundle, review: { bundleHash: bundle, manuscriptHash: hash(readText(f)), by: 'agent', rounds: 1, unresolved: [] } };
  }
  writeState(dir, state);
}

export const entryOf = (ctx, key) => [...chapters(ctx.book)].find((e) => e.key === key);
