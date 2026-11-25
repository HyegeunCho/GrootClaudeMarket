import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { write, edit, runCli, ATOMS } from './util.mjs';
import { makeBook, entryOf, MANUSCRIPTS, LIMITS, PLAN, BOOK } from './samplebook.mjs';
import { openBook } from '../lib/bookfile.mjs';
import { checkChapter, checkBook, numberTokens } from '../lib/check.mjs';

const KEY = 'loan/limits';
const run = (limits, key = KEY) => {
  const b = makeBook({ manuscripts: { ...MANUSCRIPTS, [key]: limits } });
  const ctx = openBook(b.dir);
  return checkChapter(entryOf(ctx, key), ctx);
};
const errors = (list) => list.filter((f) => f.level === 'error');
const codes = (list) => [...new Set(errors(list).map((f) => f.code))].sort();
const swap = (a, b) => { const t = LIMITS.replace(a, b); assert.notEqual(t, LIMITS); return t; };

test('바른 원고는 오류가 없다', () => {
  assert.deepEqual(errors(run(LIMITS)), []);
  assert.deepEqual(errors(run(PLAN, 'background/plan')), []);
});

const cases = [
  ['identifier', '없는 식별자', swap('`holdGap`', '`holdSize`')],
  ['number', '바뀐 숫자', swap('0이면 다시', '7이면 다시')],
  ['number', '다른 절에만 있는 숫자', swap('열람석은 자료가 아니다.', '열람석은 자료가 아니다. 3.5배다.')],
  ['number', '단위가 붙은 숫자', swap('8h', '9h')],
  ['number', '도입의 없는 숫자', swap('모았다.', '41건 모았다.')],
  ['number', '절 제목의 없는 숫자', swap('## 반납', '## 반납 77단계')],
  ['history-count', '빠진 이력', swap(/^2\. .*\n/m, '')],
  ['history-count', '이력 표식이 없음', swap('<!-- history: loan_return_rule_v2 -->\n', '')],
  ['history-count', '이력이 없는 결정의 이력', swap('## 아직', '### 과정\n<!-- history: loan_fee_values_rnd_v1 -->\n1. 하나\n\n## 아직')],
  ['open-missing', '미정 사항이 빠짐', swap('[[loan_fee_values_rnd_v1]]', '')],
  ['coverage', '표식 없는 절', swap('## 아직', '## 덧붙임\n말.\n\n## 아직')],
  ['coverage', '다른 장의 결정', swap('<!-- atoms: loan_return_rule_v2 -->', '<!-- atoms: loan_return_rule_v2, notice_feedback_v1 -->')],
  ['coverage', '두 절에 나온 결정', swap('<!-- atoms: loan_return_rule_v2 -->', '<!-- atoms: loan_return_rule_v2, loan_fee_values_rnd_v1 -->')],
  ['unknown-link', '없는 이름', swap('## 반납', '[[no_such_atom_v1]]\n\n## 반납')],
  ['leftover', '남은 자리표시자', swap('모았다.', '모았다. {{ROOT}}')],
];
for (const [code, why, text] of cases) test(`${code}: ${why}`, () => assert.deepEqual(codes(run(text)), [code]));

test('coverage: 절에서 빠진 결정', () => {
  const r = run(swap(', loan_fee_values_rnd_v1 -->', ' -->'));
  assert.ok(codes(r).includes('coverage'));
  assert.match(errors(r).find((f) => f.code === 'coverage').message, /loan_fee_values_rnd_v1/);
});

test('coverage: 배경 장의 컨텍스트 문서가 빠짐', () => {
  assert.ok(codes(run(PLAN.replace('<!-- context: plan -->', '<!-- layers: L0_vision -->'), 'background/plan')).includes('coverage'));
});

test('책 밖 이름은 경고만 한다', () => {
  const r = run(swap('## 반납', '[[outside_rule_v1]]\n\n## 반납'));
  assert.deepEqual(errors(r), []);
  assert.ok(r.some((f) => f.level === 'warn' && f.code === 'unknown-link'));
});

test('컨텍스트 문서는 id로 가리킬 수 있다', () => {
  assert.deepEqual(errors(run(swap('## 반납', '[[plan]]을 본다.\n\n## 반납'))), []);
});

test('[Review Focus 3] 코드 안의 {{ 와 [[ 는 자리표시자나 링크가 아니다', () => {
  assert.deepEqual(codes(run(swap('모았다.', '모았다. `{{x}}` `[[y]]`'))), ['identifier']);
});

test('목록 번호, 버전 표기, 표식 속 숫자는 숫자로 세지 않는다', () => {
  assert.deepEqual([...numberTokens('1. 하나\n2) 둘\n v17과 spec_v3, [[a_2_v9]] <!-- atoms: b_44 -->')], []);
});

test('숫자는 단위·쉼표·커밋 해시를 구분해 센다', () => {
  assert.deepEqual([...numberTokens('0.6s와 250ms, 1,000개, 15~20, 50%, 3.5·8, 90ab12c, 2026-03-21')], ['0.6', '250', '1000', '15', '20', '50', '3.5', '8', '2026-03-21']);
});

test('원고가 없으면 경고만 한다', () => {
  const b = makeBook();
  const ctx = openBook(b.dir);
  assert.deepEqual(checkChapter(entryOf(ctx, 'notice/channels'), ctx).map((f) => [f.level, f.code]), [['warn', 'unwritten']]);
});

test('대조하지 않았거나 원문이 바뀌면 review-missing이다', () => {
  const b = makeBook({ reviewed: false });
  const ctx = openBook(b.dir);
  assert.deepEqual(codes(checkChapter(entryOf(ctx, KEY), ctx)), ['review-missing']);
  const c = makeBook();
  edit(c.project, ATOMS + 'rules/loan_return_rule_v2.md', (t) => t.replace('- 간행물이 생겨', '- 간행물이 새로 생겨'));
  const ctx2 = openBook(c.dir);
  const r = errors(checkChapter(entryOf(ctx2, KEY), ctx2));
  assert.deepEqual(r.map((f) => f.code), ['review-missing']);
  assert.match(r[0].message, /원문이 바뀌/);
});

test('남은 지적은 review-unresolved다', () => {
  const b = makeBook();
  write(b.project, 'r.json', JSON.stringify({ by: 'agent', rounds: 2, unresolved: [{ kind: 'changed', section: '반납', manuscript: 'm', source: 's', fix: 'f' }] }));
  runCli('bundle', '--out', b.dir);
  runCli('record', '--out', b.dir, '--chapter', KEY, '--review', path.join(b.project, 'r.json'));
  const ctx = openBook(b.dir);
  assert.deepEqual(codes(checkChapter(entryOf(ctx, KEY), ctx)), ['review-unresolved']);
});

test('목차 문제는 책 검사에서 오류다', () => {
  const book = structuredClone(BOOK);
  book.parts[1].chapters[0].atoms.push('nope_v1');
  const ctx = openBook(makeBook({ book }).dir);
  assert.ok(codes(checkBook(ctx)).includes('outline'));
});

test('check 명령은 오류가 있으면 1, 없으면 0으로 끝난다', () => {
  const ok = runCli('check', '--out', makeBook().dir);
  assert.equal(ok.code, 0, ok.out + ok.err);
  assert.match(ok.out, /오류 0건/);
  const bad = runCli('check', '--out', makeBook({ manuscripts: { [KEY]: swap('8h', '9h') } }).dir);
  assert.equal(bad.code, 1);
  assert.match(bad.out, /number.*loan\/limits.*다시 빌리기/);
});

test('대조한 뒤 원고를 고치면 review-missing이다', () => {
  const b = makeBook();
  edit(b.project, 'docs/atomic-book/manuscript/loan/limits.md', (t) => t.replace('모았다.', '모은 장이다.'));
  const ctx = openBook(b.dir);
  const r = errors(checkChapter(entryOf(ctx, KEY), ctx));
  assert.deepEqual(r.map((f) => f.code), ['review-missing']);
  assert.match(r[0].message, /원고가 바뀐 뒤/);
});

test('이력의 바뀐 날짜는 숫자와 이력 검사 모두 잡는다', () => {
  assert.deepEqual(codes(run(swap('2026-03-21', '2026-03-22'))), ['history-order', 'number']);
});
