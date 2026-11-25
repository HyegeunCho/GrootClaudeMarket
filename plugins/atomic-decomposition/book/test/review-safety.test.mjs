// 최종 검토에서 나온 지적: 파일 안전과 경로
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { write, edit, exists, runCli, tempDir, copyTo, hashTree, FIX, rootOf } from './util.mjs';
import { makeBook, BOOK, MANUSCRIPTS } from './samplebook.mjs';
import { linkKind } from '../lib/links.mjs';
import { publishDir } from '../lib/fsutil.mjs';

const B = 'docs/atomic-book/';

// C2
test('책 경로에 한글과 공백, 괄호가 있어도 다시 만들 수 있다', () => {
  const project = path.join(tempDir(), '내 프로젝트 (시험)');
  copyTo(FIX, project);
  write(project, B + 'book.json', JSON.stringify(BOOK));
  for (const [k, t] of Object.entries(MANUSCRIPTS)) write(project, `${B}manuscript/${k}.md`, t);
  for (let i = 1; i <= 2; i++) {
    const run = runCli('build', '--out', path.join(project, B));
    assert.equal(run.code, 0, `${i}번째: ${run.out}${run.err}`);
  }
  assert.ok(exists(project, B + 'md/SUMMARY.md'));
  edit(project, B + 'book.json', (t) => t.replace('"id":"channels"', '"id":"times"'));
  assert.equal(runCli('build', '--out', path.join(project, B)).code, 0);
  assert.equal(exists(project, B + 'md/chapters/notice/channels.md'), false);
  assert.equal(exists(project, B + 'md/chapters/notice/times.md'), true);
});

// C4
test('만든 뒤에 사용자가 넣은 파일이 있으면 지우지 않고 이름을 알린다', () => {
  for (const f of ['md/CNAME', 'md/.git/HEAD', 'md/chapters/notice/memo.md']) {
    const b = makeBook();
    assert.equal(runCli('build', '--out', b.dir).code, 0);
    write(b.project, B + f, '내 것');
    const before = hashTree(b.dir);
    const run = runCli('build', '--out', b.dir);
    assert.equal(run.code, 2, f);
    assert.match(run.err, /만들지 않은 파일/);
    assert.ok(run.err.includes(f.slice(3)), run.err);
    assert.equal(hashTree(b.dir), before, f);
  }
});

// I2
test('쓰다가 실패해도 다시 만들 수 있다', () => {
  const d = path.join(tempDir(), 'md');
  publishDir(d, new Map([['a.md', '1'], ['b/c.md', '2']]));
  const original = fs.writeFileSync;
  let n = 0;
  fs.writeFileSync = (f, ...rest) => { if (String(f).endsWith('e.md') && n++ === 0) throw Object.assign(new Error('EPERM'), { code: 'EPERM' }); return original(f, ...rest); };
  try { assert.throws(() => publishDir(d, new Map([['a.md', '3'], ['d.md', '4'], ['e.md', '5']])), /EPERM/); } finally { fs.writeFileSync = original; }
  publishDir(d, new Map([['a.md', '3'], ['d.md', '4']]));
  assert.deepEqual(fs.readdirSync(d).sort(), ['.atomic-book', 'a.md', 'd.md']);
});

test('내용이 같은 파일은 다시 쓰지 않는다', () => {
  const d = path.join(tempDir(), 'md');
  publishDir(d, new Map([['a.md', '1'], ['b.md', '2']]));
  fs.utimesSync(path.join(d, 'a.md'), new Date(0), new Date(0));
  publishDir(d, new Map([['a.md', '1'], ['b.md', '3']]));
  assert.equal(fs.statSync(path.join(d, 'a.md')).mtimeMs, 0);
  assert.equal(fs.readFileSync(path.join(d, 'b.md'), 'utf8'), '3');
});

test('사용자 파일이 있던 폴더는 표식이 없으면 건드리지 않는다', () => {
  const d = tempDir();
  write(d, 'mine.md', '내 글');
  assert.throws(() => publishDir(d, new Map([['a.md', '1']])), /만들지 않은 파일.*mine\.md/);
  assert.deepEqual(fs.readdirSync(d), ['mine.md']);
});

// M3
test('책 폴더가 저장소 안이면 아무것도 쓰지 않고 멈춘다', () => {
  const b = makeBook({ reviewed: false });
  const before = hashTree(b.project);
  for (const out of [rootOf(b.project), path.join(rootOf(b.project), 'book')]) {
    const run = runCli('scan', '--root', rootOf(b.project), '--project', b.project, '--out', out);
    assert.equal(run.code, 2);
    assert.match(run.err, /저장소 안/);
  }
  assert.equal(hashTree(b.project), before);
});

test('부·장·컨텍스트 id가 잘못되면 책 밖에 쓰지 않고 멈춘다', () => {
  for (const change of [(x) => { x.parts[1].id = '../../../escape'; }, (x) => { x.parts[1].chapters[0].id = '../x'; }, (x) => { x.context[0].id = '../y'; }]) {
    const book = structuredClone(BOOK);
    change(book);
    const b = makeBook({ book, reviewed: false });
    const before = hashTree(b.project);
    for (const cmd of ['bundle', 'build', 'check']) {
      const run = runCli(cmd, '--out', b.dir);
      assert.equal(run.code, 2, cmd + run.out);
      assert.match(run.err, /id/);
    }
    assert.equal(hashTree(b.project), before);
  }
});

// C3 중 md 링크에도 해당하는 부분
test('주소의 공백과 제어 문자로 절대 경로 검사를 피할 수 없다', () => {
  for (const u of [' javascript:alert(1)', 'java\tscript:alert(1)', 'java\nscript:alert(1)', '\u0001javascript:x', 'JAVASCRIPT:x', ' file:///c:/a', '\tC:/a.md', ' /a']) assert.equal(linkKind(u), 'none', JSON.stringify(u));
  assert.equal(linkKind(' https://a.b'), 'web');
  assert.equal(linkKind('내 글 (1).md'), 'local');
});
