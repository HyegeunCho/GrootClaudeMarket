import test from 'node:test';
import assert from 'node:assert/strict';
import { parseManuscript } from '../lib/manuscript.mjs';
import { LIMITS, PLAN, VISION } from './samplebook.mjs';

const m = parseManuscript(LIMITS);

test('제목·도입·절을 읽는다', () => {
  assert.equal(m.title, '대출 한도');
  assert.equal(m.intro, '대출과 반납을 어떻게 다루는지 모았다.');
  assert.deepEqual(m.sections.map((s) => s.title), ['자료', '다시 빌리기', '반납', '아직 정해지지 않은 것']);
});

test('절의 원문 표식을 읽는다', () => {
  assert.deepEqual(m.sections[1].atoms, ['loan_limit_decision_v3', 'loan_fee_values_rnd_v1']);
  assert.deepEqual(parseManuscript(PLAN).sections[0].context, ['plan']);
  assert.deepEqual(parseManuscript(VISION).sections[0].layers, ['L0_vision']);
  assert.equal(m.sections[3].open, true);
  assert.equal(m.sections[0].open, false);
});

test('이력 항목을 읽는다', () => {
  assert.deepEqual(m.sections[1].history.map((h) => [h.name, h.items.length]), [['loan_limit_decision_v3', 3]]);
  assert.match(m.sections[1].history[0].items[2], /^\*\*v3 \(2026-03-21\)\*\*/);
});

test('이어지는 줄은 같은 항목이고 목록이 끝나면 멈춘다', () => {
  const t = '# 장\n\n## 절\n<!-- atoms: a_v2 -->\n\n### 과정\n<!-- history: a_v2 -->\n1. **v1** 하나\n   이어짐\n\n2. **v2** 둘\n\n끝말 1. 아님\n';
  const h = parseManuscript(t).sections[0].history[0];
  assert.equal(h.items.length, 2);
  assert.match(h.items[0], /이어짐/);
});

test('한 절에 이력이 둘이면 따로 읽는다', () => {
  const t = '# 장\n\n## 절\n<!-- atoms: a_v2, b_v2 -->\n<!-- history: a_v2 -->\n1. 하나\n2. 둘\n\n<!-- history: b_v2 -->\n1. 셋\n';
  assert.deepEqual(parseManuscript(t).sections[0].history.map((h) => [h.name, h.items.length]), [['a_v2', 2], ['b_v2', 1]]);
});

test('표식이 없는 글도 읽는다', () => {
  const e = parseManuscript('본문만 있다.\n');
  assert.equal(e.title, '');
  assert.equal(e.intro, '본문만 있다.');
  assert.deepEqual(e.sections, []);
});
