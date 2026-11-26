import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { copyProject, rootOf, write, read, exists, hashTree, runCli, FIX } from './util.mjs';
import { loadStore } from '../lib/store.mjs';
import { readBook, chapters, entries, titles, chapterRef, validateOutline, openBook } from '../lib/bookfile.mjs';
import { loadContext } from '../lib/context.mjs';
import { BOOK, makeBook } from './samplebook.mjs';

const store = loadStore(rootOf(FIX));
const bookDir = path.join(FIX, 'docs', 'atomic-book');
const check = (book) => validateOutline(book, store, loadContext(book, bookDir).docs);
const change = (fn) => { const b = structuredClone(BOOK); fn(b); return b; };
const limits = (b) => b.parts[0].chapters[1];

test('책이 없으면 null이고 스키마가 다르면 알린다', () => {
  assert.equal(readBook(FIX), null);
  const p = copyProject((d) => write(d, 'x/book.json', '{"schema":"other"}'));
  assert.throws(() => readBook(path.join(p, 'x')), /atomic-book\/v1/);
  const q = copyProject((d) => write(d, 'x/book.json', '{ 깨짐'));
  assert.throws(() => readBook(path.join(q, 'x')), /book\.json/);
});

test('장을 순서대로 내놓고, 여는 글이 맨 앞이다', () => {
  assert.deepEqual([...chapters(BOOK)].map((e) => e.key), ['loan/plan', 'loan/limits', 'notice/channels']);
  assert.deepEqual([...entries(BOOK)].map((e) => e.key), ['opening', 'loan/plan', 'loan/limits', 'notice/channels']);
});

test('부·장 번호는 책 전체에서 이어지고 끌 수 있다', () => {
  const t = titles(BOOK);
  assert.deepEqual([...t.part.values()], ['1부 · 책을 빌리는 사람', '2부 · 알림을 받는 사람']);
  assert.deepEqual([...t.chapter.values()], ['1장. 기획서가 정한 것', '2장. 대출 한도', '3장. 알림 수단']);
  assert.deepEqual([...titles(change((b) => { b.numbering = false; })).chapter.values()], ['기획서가 정한 것', '대출 한도', '알림 수단']);
});

test('장 이름 링크는 부/장이나 하나뿐인 장 id로 찾는다', () => {
  assert.equal(chapterRef(BOOK, 'notice/channels').key, 'notice/channels');
  assert.equal(chapterRef(BOOK, 'limits').key, 'loan/limits');
  assert.equal(chapterRef(BOOK, 'nope'), null);
  assert.equal(chapterRef(change((b) => { b.parts[1].chapters.push({ id: 'limits', title: '또' }); }), 'limits'), null);
});

test('바른 목차는 문제가 없다', () => {
  assert.deepEqual(check(BOOK), { missing: [], duplicate: [], unknown: [], archived: [], problems: [] });
});

test('빠진 것, 한 장에 겹친 것, 없는 것, archived를 찾는다', () => {
  const r = check(change((b) => {
    limits(b).atoms = limits(b).atoms.filter((n) => n !== 'loan_return_rule_v2').concat('nope_v1', 'loan_limit_decision_v1', 'loan_fee_values_rnd_v1');
    limits(b).dropped = [];
  }));
  assert.deepEqual(r.missing, ['loan_return_rule_v2']);
  assert.deepEqual(r.duplicate, ['loan_fee_values_rnd_v1']);
  assert.deepEqual(r.unknown, ['nope_v1']);
  assert.deepEqual(r.archived, ['loan_limit_decision_v1']);
});

test('같은 결정은 여러 장에 나와도 되고, 후속 없는 폐기는 따로 두지 않아도 된다', () => {
  const r = check(change((b) => { limits(b).dropped = []; b.parts[1].chapters.push({ id: 'again', title: '또', atoms: ['notice_feedback_v1'] }); }));
  assert.deepEqual(r, { missing: [], duplicate: [], unknown: [], archived: [], problems: [] });
});

test('appendixOnly는 본문에 싣지 않는 결정이고 본문과 겹치면 알린다', () => {
  const r = check(change((b) => { b.parts[1].chapters[0].atoms = ['notice_time_rule_v1']; b.appendixOnly = ['notice_no_sms_rule_v1', 'notice_feedback_v1', 'notice_time_rule_v1', 'zzz_v1']; }));
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.duplicate, ['notice_time_rule_v1']);
  assert.deepEqual(r.unknown, ['zzz_v1']);
});

test('편집할 기획서가 어느 장에도 없거나, 원문만 실을 문서를 장에 넣거나, id가 잘못되면 알린다', () => {
  const r = check(change((b) => { b.parts[0].chapters[0].context = ['prompt']; limits(b).id = '한도'; limits(b).context = ['zzz']; }));
  assert.equal(r.problems.length, 4, r.problems.join('\n'));
  assert.ok(r.problems.some((x) => /편집할 컨텍스트 문서 plan/.test(x)));
  assert.ok(r.problems.some((x) => /원문만 싣는 컨텍스트 문서 prompt/.test(x)));
  assert.ok(r.problems.some((x) => /한도/.test(x)));
  assert.ok(r.problems.some((x) => /zzz/.test(x)));
});

test('labels와 dropped, lead가 잘못되면 알린다', () => {
  const r = check(change((b) => { b.labels.nope_v1 = '없음'; b.labels.loan_return_rule_v2 = ' '; limits(b).dropped = ['loan_return_rule_v2']; limits(b).lead = ['목록']; }));
  assert.equal(r.problems.length, 4, r.problems.join('\n'));
});

test('장 key가 겹치면 알린다', () => {
  const r = check(change((b) => { b.parts[1].chapters.push({ id: 'channels', title: '겹침', atoms: [] }); }));
  assert.ok(r.problems.some((x) => /notice\/channels/.test(x)));
});

test('openBook은 저장소·이력·컨텍스트를 함께 연다', () => {
  const { dir } = makeBook({ reviewed: false });
  const ctx = openBook(dir);
  assert.equal(ctx.store.atoms.length, 13);
  assert.equal(ctx.context.length, 2);
  assert.deepEqual(ctx.state, { schema: 'atomic-book-state/v1', chapters: {} });
});

test('저장소 경로가 틀리면 알린다', () => {
  const { dir } = makeBook({ book: change((b) => { b.atomicRoot = '../nowhere'; }), reviewed: false });
  assert.throws(() => openBook(dir), /atomicRoot/);
});

test('scan은 목록을 만들고 원본을 건드리지 않는다', () => {
  const p = copyProject();
  const before = hashTree(p);
  const r = runCli('scan', '--root', rootOf(p), '--project', p, '--out', path.join(p, 'docs', 'atomic-book'));
  assert.equal(r.code, 0, r.err);
  assert.equal(hashTree(p, ['atomic-book']), before);
  const inv = JSON.parse(read(p, 'docs/atomic-book/.work/inventory.json'));
  assert.equal(inv.counts.live, 7);
  assert.equal(inv.counts.archived, 6);
  assert.deepEqual(inv.orphans, ['loan_dropped_rnd_v1']);
  assert.deepEqual(inv.external, { outside_rule_v1: ['notice_feedback_v1'] });
  const md = read(p, 'docs/atomic-book/.work/inventory.md');
  assert.match(md, /loan_limit_decision_v1 → loan_limit_decision_v2 → loan_limit_decision_v3/);
  assert.match(md, /docs\/Plan_v2\.md/);
  assert.equal(read(p, 'docs/atomic-book/.gitignore').trim(), '.work/');
});

test('책이 있으면 scan은 새 후보와 목차 차이만 따로 보여 준다', () => {
  const book = change((b) => { b.contextIgnored = ['CLAUDE.md']; limits(b).atoms.pop(); });
  const { project, dir } = makeBook({ book, reviewed: false });
  write(project, 'docs/New_Plan.md', '# 새 기획\n');
  const r = runCli('scan', '--root', rootOf(project), '--project', project, '--out', dir);
  assert.equal(r.code, 0, r.err);
  const inv = JSON.parse(read(project, 'docs/atomic-book/.work/inventory.json'));
  assert.deepEqual(inv.newCandidates.map((c) => c.versions.at(-1).path), ['docs/New_Plan.md']);
  assert.deepEqual(inv.outline.missing, ['loan_return_rule_v2']);
});

test('stores는 저장소를 모두 알려 준다', () => {
  const p = copyProject();
  const r = runCli('stores', '--project', p);
  assert.equal(r.code, 0, r.err);
  assert.equal(r.out.trim(), path.join(p, 'docs', 'atomic').replaceAll('\\', '/'));
});

test('사용법이 틀리면 2로 끝난다', () => {
  assert.equal(runCli().code, 2);
  assert.equal(runCli('scan').code, 2);
  assert.equal(runCli('scan', '--root', path.join(FIX, 'nowhere'), '--project', FIX, '--out', path.join(FIX, 'x')).code, 2);
  assert.equal(exists(FIX, 'x'), false);
  assert.equal(fs.existsSync(bookDir), false);
});
