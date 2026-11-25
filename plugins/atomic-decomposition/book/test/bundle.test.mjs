import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { read, write, edit, exists, runCli, hashTree, ATOMS } from './util.mjs';
import { makeBook, entryOf, LIMITS, BOOK } from './samplebook.mjs';
import { openBook, readState } from '../lib/bookfile.mjs';
import { keptText, renderBundle, sectionSources, hash, chapterStatus } from '../lib/bundle.mjs';

const KEY = 'loan/limits';
const V3 = ATOMS + 'decisions/loan_limit_decision_v3.md';
const open = (dir) => { const ctx = openBook(dir); return { ctx, entry: entryOf(ctx, KEY) }; };
const { project, dir } = makeBook();
const { ctx, entry } = open(dir);

test('핵심 섹션만 남긴다', () => {
  const t = keptText(ctx.store.docs.get('loan_limit_decision_v3'));
  assert.match(t, /## Why/);
  assert.match(t, /## Rule/);
  assert.match(t, /## Exceptions/);
  assert.match(t, /지난 날 주기로/);
  assert.doesNotMatch(t, /How to apply|Relations|owner|MISSING|Lint/);
});

test('rnd는 무효화 조건을, concept은 본문을 남긴다', () => {
  assert.match(keptText(ctx.store.docs.get('loan_fee_values_rnd_v1')), /## Invalidation/);
  const c = keptText(ctx.store.docs.get('concept_loan_item_v2'));
  assert.match(c, /Required Properties/);
  assert.doesNotMatch(c, /part_of/);
});

test('Layer 문서는 목적·범위만 남긴다', () => {
  const t = keptText(ctx.store.docs.get('L1_loan_system'));
  assert.match(t, /목적/);
  assert.match(t, /범위/);
  assert.doesNotMatch(t, /소속 Atom 조회/);
});

test('발췌에 현행과 이력이 오래된 순으로 있다', () => {
  const b = renderBundle(entry, ctx);
  const at = (s) => { const i = b.indexOf(s); assert.ok(i >= 0, s); return i; };
  assert.ok(at('이전: loan_limit_decision_v1') < at('이전: loan_limit_decision_v2'));
  at('현행: loan_fee_values_rnd_v1');
  at('예외 있음');
  at('L1_loan_system');
  assert.equal(b.includes('대출 기획서 v2'), false);
});

test('배경 장의 발췌에는 컨텍스트 문서의 모든 버전이 있다', () => {
  const b = renderBundle(entryOf(ctx, 'background/plan'), ctx);
  assert.match(b, /대출 기획서 v1/);
  assert.match(b, /대출 기획서 v2/);
});

test('절의 원문은 속한 문서와 이력 전체다', () => {
  const s = sectionSources({ atoms: ['loan_limit_decision_v3'], layers: [], context: [] }, ctx);
  assert.match(s, /2026-03-13/);
  assert.match(s, /renewHours/);
  assert.doesNotMatch(s, /하루 연체료/);
});

test('근거나 updated만 바뀌면 다시 쓰지 않는다', () => {
  const before = hash(renderBundle(entry, ctx));
  const b = makeBook({ mutate: (d) => edit(d, V3, (t) => t.replace('docs/Plan_v2.md', 'abc1234').replace('updated: 2026-03-21', 'updated: 2026-03-25')) });
  const o = open(b.dir);
  assert.equal(hash(renderBundle(o.entry, o.ctx)), before);
});

test('다른 문서가 이 결정을 새로 참조해도 다시 쓰지 않는다', () => {
  const b = makeBook({ mutate: (d) => edit(d, ATOMS + 'rules/notice_time_rule_v1.md', (t) => t.replace('derives_from:\n', 'requires:\n  - loan_limit_decision_v3\nderives_from:\n')) });
  const o = open(b.dir);
  assert.equal(hash(renderBundle(o.entry, o.ctx)), hash(renderBundle(entry, ctx)));
});

test('대조까지 마치면 done이다', () => assert.equal(chapterStatus(entry, ctx), 'done'));

test('원고가 없으면 write다', () => {
  const b = makeBook({ manuscripts: {} });
  const o = open(b.dir);
  assert.equal(chapterStatus(o.entry, o.ctx), 'write');
});

test('Rule이 바뀌면 rewrite다', () => {
  const b = makeBook();
  edit(b.project, V3, (t) => t.replace('띄운다', '벌린다'));
  const o = open(b.dir);
  assert.equal(chapterStatus(o.entry, o.ctx), 'rewrite');
  assert.equal(chapterStatus(entryOf(o.ctx, 'background/plan'), o.ctx), 'done');
});

test('장에 Atom이 늘면 rewrite다', () => {
  const b = makeBook();
  edit(b.project, 'docs/atomic-book/book.json', (t) => t.replace('"loan_return_rule_v2"', '"loan_return_rule_v2",\n "notice_feedback_v1"'));
  const o = open(b.dir);
  assert.equal(chapterStatus(o.entry, o.ctx), 'rewrite');
});

test('원고만 고치면 review다', () => {
  const b = makeBook();
  edit(b.project, 'docs/atomic-book/manuscript/loan/limits.md', (t) => t.replace('모았다.', '모은 장이다.'));
  const o = open(b.dir);
  assert.equal(chapterStatus(o.entry, o.ctx), 'review');
});

test('CRLF로 바뀌기만 한 원고는 다시 대조하지 않는다', () => {
  const b = makeBook();
  write(b.project, 'docs/atomic-book/manuscript/loan/limits.md', LIMITS.replace(/\n/g, '\r\n'));
  const o = open(b.dir);
  assert.equal(chapterStatus(o.entry, o.ctx), 'done');
});

test('남은 지적이 있으면 unresolved다', () => {
  const b = makeBook();
  const review = path.join(b.project, 'review.json');
  write(b.project, 'review.json', JSON.stringify({ by: 'agent', rounds: 2, unresolved: [{ kind: 'changed', section: '다시 빌리기', manuscript: 'a', source: 'b', fix: 'c' }] }));
  runCli('bundle', '--out', b.dir);
  const r = runCli('record', '--out', b.dir, '--chapter', KEY, '--review', review);
  assert.equal(r.code, 0, r.err);
  const o = open(b.dir);
  assert.equal(chapterStatus(o.entry, o.ctx), 'unresolved');
  assert.equal(readState(b.dir).chapters[KEY].review.rounds, 2);
});

test('record --written은 쓴 시점의 발췌를 기억하고 대조는 남는다', () => {
  const b = makeBook({ reviewed: false });
  runCli('bundle', '--out', b.dir);
  const r = runCli('record', '--out', b.dir, '--chapter', KEY, '--written');
  assert.equal(r.code, 0, r.err);
  const o = open(b.dir);
  assert.equal(chapterStatus(o.entry, o.ctx), 'review');
});

test('record는 원고가 없거나 기록이 잘못되면 2로 끝난다', () => {
  const b = makeBook({ manuscripts: {}, reviewed: false });
  assert.equal(runCli('record', '--out', b.dir, '--chapter', KEY, '--written').code, 2);
  assert.equal(runCli('record', '--out', b.dir, '--chapter', 'no/such', '--written').code, 2);
  const c = makeBook({ reviewed: false });
  runCli('bundle', '--out', c.dir);
  write(c.project, 'bad.json', '{"unresolved": "없음"}');
  const r = runCli('record', '--out', c.dir, '--chapter', KEY, '--review', path.join(c.project, 'bad.json'));
  assert.equal(r.code, 2);
  assert.match(r.err, /unresolved/);
});

test('bundle은 발췌를 쓰고 상태를 알려 주며 원본은 그대로다', () => {
  const b = makeBook({ reviewed: false });
  const before = hashTree(b.project, ['atomic-book']);
  const r = runCli('bundle', '--out', b.dir);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /write\s+notice\/channels/);
  assert.match(r.out, /rewrite\s+loan\/limits/);
  assert.match(read(b.project, 'docs/atomic-book/.work/bundles/loan/limits.md'), /현행: loan_limit_decision_v3/);
  assert.equal(hashTree(b.project, ['atomic-book']), before);
});

test('bundle --only는 부나 장의 이름으로 고른다', () => {
  const b = makeBook({ reviewed: false });
  for (const only of ['notice', '알림', 'notice/channels', '알림 수단']) {
    const r = runCli('bundle', '--out', b.dir, '--only', only);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /notice\/channels/);
    assert.doesNotMatch(r.out, /limits/);
  }
  const r = runCli('bundle', '--out', b.dir, '--only', '없는 부');
  assert.equal(r.code, 2);
  assert.match(r.err, /대출/);
});

test('목차에 없는 Atom 이름이 있어도 발췌를 만든다', () => {
  const book = structuredClone(BOOK);
  book.parts[1].chapters[0].atoms.push('nope_v1');
  const b = makeBook({ book, reviewed: false });
  const r = runCli('bundle', '--out', b.dir);
  assert.equal(r.code, 0, r.err);
  assert.match(r.err, /nope_v1/);
  assert.equal(exists(b.project, 'docs/atomic-book/.work/bundles/loan/limits.md'), true);
});
