import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { copyProject, rootOf, write, read, exists, hashTree, runCli, FIX } from './util.mjs';
import { loadStore } from '../lib/store.mjs';
import { readBook, chapters, validateOutline, openBook } from '../lib/bookfile.mjs';
import { loadContext } from '../lib/context.mjs';
import { BOOK, makeBook } from './samplebook.mjs';

const store = loadStore(rootOf(FIX));
const bookDir = path.join(FIX, 'docs', 'atomic-book');
const check = (book) => validateOutline(book, store, loadContext(book, bookDir).docs);
const change = (fn) => { const b = structuredClone(BOOK); fn(b); return b; };
const limits = (b) => b.parts[1].chapters[0];

test('책이 없으면 null이고 스키마가 다르면 알린다', () => {
  assert.equal(readBook(FIX), null);
  const p = copyProject((d) => write(d, 'x/book.json', '{"schema":"other"}'));
  assert.throws(() => readBook(path.join(p, 'x')), /atomic-book\/v1/);
  const q = copyProject((d) => write(d, 'x/book.json', '{ 깨짐'));
  assert.throws(() => readBook(path.join(q, 'x')), /book\.json/);
});

test('장을 순서대로 내놓는다', () => {
  assert.deepEqual([...chapters(BOOK)].map((e) => e.key), ['background/vision', 'background/plan', 'loan/limits', 'notice/channels']);
});

test('바른 목차는 문제가 없다', () => {
  assert.deepEqual(check(BOOK), { missing: [], duplicate: [], unknown: [], archived: [], problems: [] });
});

test('빠진 것, 겹친 것, 없는 것, archived를 찾는다', () => {
  const r = check(change((b) => {
    limits(b).atoms = limits(b).atoms.filter((n) => n !== 'loan_return_rule_v2').concat('nope_v1', 'loan_limit_decision_v1');
    limits(b).dropped = [];
    b.parts[2].chapters.push({ id: 'again', title: '또', atoms: ['notice_feedback_v1'] });
  }));
  assert.deepEqual(r.missing, ['loan_dropped_rnd_v1', 'loan_return_rule_v2']);
  assert.deepEqual(r.duplicate, ['notice_feedback_v1']);
  assert.deepEqual(r.unknown, ['nope_v1']);
  assert.deepEqual(r.archived, ['loan_limit_decision_v1']);
});

test('편집할 기획서가 배경 부에 없거나 id가 잘못되면 알린다', () => {
  const r = check(change((b) => { b.parts[0].chapters.pop(); limits(b).id = '한도'; limits(b).context = ['zzz']; }));
  assert.equal(r.problems.length, 3);
  assert.ok(r.problems.some((x) => /plan/.test(x)));
  assert.ok(r.problems.some((x) => /한도/.test(x)));
  assert.ok(r.problems.some((x) => /zzz/.test(x)));
});

test('장 key가 겹치면 알린다', () => {
  const r = check(change((b) => { b.parts[2].chapters.push({ id: 'channels', title: '겹침', atoms: [] }); }));
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
