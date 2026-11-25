// 최종 검토에서 나온 지적: 원문 보존, 링크·코드 인식, 저장소 읽기, 대조 상태
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { copyProject, read, write, edit, runCli, rootOf, ATOMS } from './util.mjs';
import { makeBook, entryOf, BOOK, MANUSCRIPTS, LIMITS, PLAN } from './samplebook.mjs';
import { loadStore, parseFrontmatter, splitSections, findStores, wikiNames } from '../lib/store.mjs';
import { buildLineage, buildRelations } from '../lib/lineage.mjs';
import { openBook, validateOutline } from '../lib/bookfile.mjs';
import { renderBundle, chapterStatus, bundleHash } from '../lib/bundle.mjs';
import { buildMd } from '../lib/build-md.mjs';
import { checkBuilt, checkChapter, originalFingerprint } from '../lib/check.mjs';
import { rewriteOriginal, splitCode, findLinks } from '../lib/links.mjs';
import { findCandidates } from '../lib/context.mjs';

const KEY = 'loan/limits';
const B = 'docs/atomic-book/';
const M = B + 'md/';
const LIMIT3 = ATOMS + 'decisions/loan_limit_decision_v3.md';
const errors = (list) => list.filter((f) => f.level === 'error');
const codes = (list) => [...new Set(errors(list).map((f) => f.code))].sort();
const change = (fn) => { const b = structuredClone(BOOK); fn(b); return b; };
const swap = (t, a, b) => { const u = t.replace(a, b); assert.notEqual(u, t, a); return u; };
const opt = {
  fromFile: 'appendix/context/p.md',
  resolveWiki: (n) => (n.startsWith('in_') ? { file: `appendix/atoms/${n}.md` } : null),
  resolvePath: (p) => (p === 'docs/in.md' ? { file: 'appendix/context/in.md' } : null),
  copyAsset: (p) => (p === 'img/map.png' ? 'assets/ab-map.png' : null),
};
const rw = (s) => rewriteOriginal(s, opt);

const CHANNELS = `# 알림 수단

## 시각
<!-- atoms: notice_time_rule_v1 -->
알림은 정한 시각에만 보낸다.

### 여기까지 온 과정
<!-- history: notice_time_rule_v1 -->
1. **이전 (2026-03-17)** 알림은 전자우편으로만 보냈다.
2. **v1 (2026-03-20)** 전자우편 제한을 없애며 알림 시각을 따로 정했다.

## 문자
<!-- atoms: notice_no_sms_rule_v1, notice_feedback_v1 -->
문자 알림을 쓰지 않는다. 알림 시험은 받는 사람을 밝힌다.

### 여기까지 온 과정
<!-- history: notice_no_sms_rule_v1 -->
1. **이전 (2026-03-17)** 알림은 전자우편으로만 보냈다.
2. **v1 (2026-03-20)** 문자 알림을 쓰지 않기로 했다.
`;
const checkOf = (key, text, o = {}) => { const b = makeBook({ ...o, manuscripts: { ...MANUSCRIPTS, [key]: text } }); const ctx = openBook(b.dir); return checkChapter(entryOf(ctx, key), ctx); };

// C1
test('[[이름]](글)의 글을 잃지 않는다', () => {
  assert.equal(rw('값은 [[in_a]]([[in_b]]).'), '값은 [in_a](../atoms/in_a.md)([in_b](../atoms/in_b.md)).');
  assert.equal(rw('[[in_a]](쉼)'), '[in_a](../atoms/in_a.md)(쉼)');
  for (const s of ['값은 [[in_a]]([[in_b]]).', '[[in_a]](빌리기·예약), [[out_v1]](목록)', '[[in_a]] (archived)', '[[in_a]](A-01)', '- [[in_a]](in_b.md)', '![[in_a]]', '[[out_v1]](C:\\a.md)']) assert.equal(originalFingerprint(rw(s)), originalFingerprint(s), s);
});

test('원문 검사는 변환기와 따로 판단해 사라지거나 바뀐 글자를 잡는다', () => {
  assert.notEqual(originalFingerprint('값은 [L3_x].'), originalFingerprint('값은 [[L3_x]]([[val_v1]]).'));
  assert.notEqual(originalFingerprint('[확인 필요]: 값은 999이다.'), originalFingerprint('[확인 필요]: 값은 3이다.'));
  assert.notEqual(originalFingerprint('[^1]: 각주 3'), originalFingerprint('[^1]: 각주 4'));
  assert.equal(originalFingerprint('[글](a.md "설명")과 [글](<b c.md>)'), originalFingerprint('글과 글'));
  assert.notEqual(originalFingerprint('값은 3이다'), originalFingerprint('값은 4다'));
});

test('대괄호 이름 뒤의 괄호 글을 링크 주소로 보지 않는다', () => {
  assert.equal(rw('[이름표](가칭)로'), '\\[이름표\\](가칭)로');
  assert.equal(rw('[항목]([[in_a]])으로'), '\\[항목\\]([in_a](../atoms/in_a.md))으로');
  assert.equal(rw('[항목](A-01), ![그림](가칭)'), '\\[항목\\](A-01), !\\[그림\\](가칭)');
  assert.equal(rw('[값](`a.json`)'), '\\[값\\](`a.json`)');
  for (const s of ['[이름표](가칭)로', '[항목]([[in_a]])으로', '[항목](A-01), ![그림](가칭)', '[값](`a.json`, 없으면 기본값)', '[글](docs/in.md)과 [이름](가칭)']) assert.equal(originalFingerprint(rw(s)), originalFingerprint(s), s);
  assert.notEqual(originalFingerprint('이름표로'), originalFingerprint('[이름표](가칭)로'));
  assert.notEqual(originalFingerprint('항목으로'), originalFingerprint('[항목]([[in_a]])으로'));
  assert.deepEqual(findLinks(rw('[이름표](가칭)로 [항목](A-01)')), []);
});

test('이름 링크 뒤에 괄호 글이 온 원문을 잃지 않는다', () => {
  const b = makeBook({ mutate: (d) => edit(d, LIMIT3, (t) => t.replace('- 값은 [[loan_fee_values_rnd_v1]]을 따른다.', '- 값은 [[L1_loan_system]]([[loan_fee_values_rnd_v1]]).\n- [[loan_return_rule_v2]](빌리기·예약), [[outside_rule_v1]](OtherDocs)')) });
  buildMd(openBook(b.dir));
  assert.deepEqual(errors(checkBuilt(openBook(b.dir))), []);
  const p = read(b.project, M + 'appendix/atoms/loan_limit_decision_v3.md');
  for (const s of ['(빌리기·예약)', '(OtherDocs)', 'loan_fee_values_rnd_v1.md))']) assert.ok(p.includes(s), s);
});

// M11
test('각주와 참조 정의처럼 보이는 글을 바꾸지 않는다', () => {
  for (const s of ['[^1]: 각주 글', '글[^1]', '[확인 필요]: 값은 3이다.', '[보류]: 나중에 정한다']) assert.equal(rw(s), s);
});

// I8
test('읽기 어려운 링크 표기도 바꾸거나 글자로 남긴다', () => {
  assert.equal(rw('![[in_a]]'), '[in_a](../atoms/in_a.md)');
  assert.equal(rw('![[out_v1]]'), '![[out_v1]]');
  assert.equal(rw('[글](docs/in.md (제목))'), '[글](in.md)');
  assert.equal(rw('[글](x.md (제목))'), '글');
  assert.equal(rw('<a href = "docs/in.md">x</a>'), '<a href="in.md">x</a>');
  assert.equal(rw('<a href=C:/x.md>x</a>'), '<a>x</a>');
  assert.equal(rw('<img src=img/map.png>'), '<img src="../../assets/ab-map.png">');
  assert.equal(rw('<img src=x.png>'), '<img src="">');
  assert.equal(rw('<file:///C:/a.md>'), 'file:///C:/a.md');
  assert.equal(rw('<https://a.b> <mailto:a@b.c>'), '<https://a.b> <mailto:a@b.c>');
  for (const s of ['[글](x.md (제목))', '<a href = "docs/in.md">x</a>', '<a href=C:/x.md>x</a>', '<img src=x.png>', '<file:///C:/a.md>']) assert.equal(originalFingerprint(rw(s)), originalFingerprint(s), s);
  assert.deepEqual(findLinks('<a href=C:/x.md>').map((l) => l.dest), ['C:/x.md']);
  assert.deepEqual(findLinks('<file:///C:/a.md>').map((l) => l.dest), ['file:///C:/a.md']);
});

test('책 밖 이름 뒤에 괄호가 와도 md에서 링크가 되지 않는다', () => {
  assert.deepEqual(findLinks(rw('[[out_v1]](C:/a.md)')), []);
});

// I7
test('코드를 마크다운 규칙대로 알아본다', () => {
  const code = (s) => splitCode(s).filter((p) => p.code).map((p) => p.text);
  assert.deepEqual(code('앞\n\n    [글](C:/x.md)\n    [[in_a]]\n\n뒤'), ['    [글](C:/x.md)\n    [[in_a]]\n']);
  assert.deepEqual(code('- 항목\n\n    이어진 글 [[in_a]]\n'), []);
  assert.deepEqual(code('글\n    이어진 줄\n'), []);
  assert.deepEqual(code('```code``` 뒤 [글](C:/x.md)\n'), ['```code```']);
  assert.deepEqual(code('가 `한\n줄` 나'), ['`한\n줄`']);
  assert.deepEqual(code('- 가 ` 나\n- 다 ` 라'), []);
  assert.deepEqual(code('가 ` 나\n\n다 ` 라'), []);
  assert.deepEqual(code('| a ` | b |\n| c ` | d |'), []);
  for (const s of ['앞\n\n    코드\n\n뒤\n', '- a\n\n    b\n\n\tc\n', '```code``` x\n\n```\ny\n```\n', '> ```\n> x\n> ```\n끝']) assert.equal(splitCode(s).map((p) => p.text).join(''), s);
});

test('한 줄짜리 백틱 셋은 울타리가 아니다', () => {
  assert.deepEqual(splitSections('## Why\n```code```\n\n## Rule\n- 값\n').sections.map((s) => s.key), ['Why', 'Rule']);
});

// I3
test('프론트매터의 [[이름]]과 낯선 값에 멈추지 않는다', () => {
  assert.deepEqual(parseFrontmatter('---\na: [[x_v1]]\nb: [[x_v1]], [[y_v1]]\nc:\n  - [[z_v1]]\nd:\n- 들여쓰지 않음\ne: [a, [b]]\nf: [[x_v1|이름]]\n---\n').data, { a: ['x_v1'], b: ['x_v1', 'y_v1'], c: ['z_v1'], d: ['들여쓰지 않음'], e: ['a', 'b'], f: ['x_v1'] });
  const p = copyProject((d) => edit(d, LIMIT3, (t) => t.replace('requires:\n  - concept_loan_item_v2', 'requires: [[concept_loan_item_v2]]')));
  assert.deepEqual(loadStore(rootOf(p)).docs.get('loan_limit_decision_v3').relations.requires, ['concept_loan_item_v2']);
});

test('읽지 못한 프론트매터 줄은 파일 이름과 함께 알린다', () => {
  const p = copyProject((d) => edit(d, LIMIT3, (t) => t.replace('type: decision', 'type: decision\n이건 무슨 줄인가')));
  const s = loadStore(rootOf(p));
  assert.equal(s.atoms.length, 13);
  assert.deepEqual(s.problems.map((x) => [x.code, x.file]), [['bad-frontmatter', 'atoms/decisions/loan_limit_decision_v3.md']]);
});

// I9
test('제목에 공백이 없어도 섹션을 읽고, Rule이 없으면 알린다', () => {
  const p = copyProject((d) => edit(d, LIMIT3, (t) => t.replace('## Rule (규칙', '## Rule(규칙').replace('## Why (근거', '## Why(근거').replace('## Relations (', '## Relations(')));
  const s = loadStore(rootOf(p));
  assert.deepEqual(s.docs.get('loan_limit_decision_v3').sections.map((x) => x.key), ['Why', 'Rule', 'How', 'Exceptions', 'Relations']);
  assert.deepEqual(s.problems, []);
  const q = loadStore(rootOf(copyProject((d) => edit(d, LIMIT3, (t) => t.replace('## Rule (규칙 및 결정 내용)', '## 규칙')))));
  assert.deepEqual(q.problems.map((x) => x.code), ['missing-section']);
  assert.equal(q.atoms.length, 13);
});

// I4
test('핵심 섹션 밖의 미정도 발췌에 싣고 검사한다', () => {
  const mutate = (d) => edit(d, ATOMS + 'rules/notice_time_rule_v1.md', (t) => t.replace('- **구현 지침**: ', '- **구현 지침**: [확인 필요: 상한 값] '));
  const b = makeBook({ mutate });
  const ctx = openBook(b.dir);
  assert.match(renderBundle(entryOf(ctx, 'notice/channels'), ctx), /다른 섹션의 미정[\s\S]*\[확인 필요: 상한 값\]/);
  const found = errors(checkOf('notice/channels', CHANNELS, { mutate }));
  assert.deepEqual(found.map((f) => f.code), ['open-missing']);
  assert.match(found[0].message, /notice_time_rule_v1/);
});

// I6
test('이력 항목의 순서와 날짜가 원문과 맞아야 한다', () => {
  assert.deepEqual(codes(checkOf('notice/channels', CHANNELS)), []);
  const one = LIMITS.match(/^1\. \*\*v1 \(2026-03-13\).*$/m)[0];
  const three = LIMITS.match(/^3\. \*\*v3 .*$/m)[0];
  const swapped = LIMITS.replace(one, '@@').replace(three, one.replace('1.', '3.')).replace('@@', three.replace('3.', '1.'));
  assert.deepEqual(codes(checkOf(KEY, swapped)), ['history-order']);
  assert.deepEqual(codes(checkOf(KEY, swap(LIMITS, '2. **v2 (2026-03-17)**', '2. **v2 (2026-03-13)**'))), ['history-order']);
  assert.deepEqual(codes(checkOf('background/plan', swap(PLAN, '1. **v1**', '1. **v2**'))), ['history-order']);
});

// I1
test('원문이 바뀌면 원고를 그대로 두고 기록해도 done이 되지 않는다', () => {
  const b = makeBook();
  edit(b.project, LIMIT3, (t) => t.replace('만큼 띄운다', '만큼 띄우지 않는다'));
  runCli('bundle', '--out', b.dir);
  assert.match(runCli('record', '--out', b.dir, '--chapter', KEY, '--written').out, /^review /);
  const ctx = openBook(b.dir);
  assert.deepEqual(codes(checkChapter(entryOf(ctx, KEY), ctx)), ['review-missing']);
});

test('쓰는 도중 원문이 바뀌면 옛 발췌로 한 기록은 rewrite다', () => {
  const b = makeBook({ reviewed: false });
  runCli('bundle', '--out', b.dir);
  edit(b.project, LIMIT3, (t) => t.replace('만큼 띄운다', '만큼 띄우지 않는다'));
  write(b.project, 'r.json', JSON.stringify({ by: 'agent', rounds: 1, unresolved: [] }));
  assert.match(runCli('record', '--out', b.dir, '--chapter', KEY, '--written').out, /^rewrite /);
  assert.match(runCli('record', '--out', b.dir, '--chapter', KEY, '--review', path.join(b.project, 'r.json')).out, /^rewrite /);
});

test('발췌를 만들지 않았으면 기록할 수 없다', () => {
  const b = makeBook({ reviewed: false });
  const run = runCli('record', '--out', b.dir, '--chapter', KEY, '--written');
  assert.equal(run.code, 2);
  assert.match(run.err, /bundle/);
});

test('rewrite면 무엇이 바뀌었는지 보여 준다', () => {
  const b = makeBook({ reviewed: false });
  runCli('bundle', '--out', b.dir);
  runCli('record', '--out', b.dir, '--chapter', KEY, '--written');
  edit(b.project, LIMIT3, (t) => t.replace('만큼 띄운다', '만큼 띄우지 않는다'));
  const run = runCli('bundle', '--out', b.dir);
  assert.match(run.out, /바뀐 곳: .*changes\/loan\/limits\.md/);
  const diff = read(b.project, B + '.work/changes/loan/limits.md');
  assert.match(diff, /^- .*만큼 띄운다/m);
  assert.match(diff, /^\+ .*만큼 띄우지 않는다/m);
  assert.doesNotMatch(diff, /^[-+] .*(renew|하루 연체료)/m);
});

// M2
test('부·장 제목만 바꾸면 다시 쓰지 않는다', () => {
  const b = makeBook();
  edit(b.project, B + 'book.json', (t) => t.replace('"title": "대출"', '"title": "빌리기"').replace('"title": "대출 한도"', '"title": "한도"'));
  const ctx = openBook(b.dir);
  assert.equal(chapterStatus(entryOf(ctx, KEY), ctx), 'done');
  assert.equal(bundleHash('가\n나\n'), bundleHash('다\n나\n'));
  assert.notEqual(bundleHash('가\n나\n'), bundleHash('가\n라\n'));
});

// I5
test('컨텍스트의 id나 버전 이름이 겹치면 알린다', () => {
  const store = loadStore(rootOf(copyProject()));
  const run = (book) => { const b = makeBook({ book, reviewed: false }); return validateOutline(book, store, openBook(b.dir).context).problems; };
  assert.ok(run(change((x) => { x.context[0].versions = [{ path: '../Plan_v1.md' }, { path: '../Plan_v2.md' }]; })).some((m) => /겹칩니다/.test(m)));
  assert.ok(run(change((x) => { x.context[1].id = 'plan'; })).some((m) => /겹칩니다/.test(m)));
});

test('같은 버전의 사본이 다른 폴더에 있으면 섞지 않는다', () => {
  const p = copyProject((d) => {
    for (const v of [1, 2]) { write(d, `docs/copy/Plan_v${v}.md`, '# 사본\n'); write(d, `.worktrees/w/docs/Plan_v${v}.md`, '# 사본\n'); }
    write(d, '.worktrees/w/docs/atomic/_jit_manifest.json', '{"schema":"atomic-decomposition/v1"}');
  });
  const list = findCandidates(loadStore(rootOf(p)), p);
  for (const c of list) assert.equal(new Set(c.versions.map((v) => v.label)).size, c.versions.length, JSON.stringify(c.versions));
  assert.equal(list.some((c) => c.versions.some((v) => v.path.startsWith('.worktrees'))), false);
  assert.ok(list.some((c) => c.versions.map((v) => v.path).join() === 'docs/Plan_v1.md,docs/Plan_v2.md'));
  assert.equal(findStores(p).length, 1);
});

// M1
test('서로 conflicts_with로 적은 구버전과 신버전은 충돌이 아니다', () => {
  const s = loadStore(rootOf(copyProject((d) => edit(d, ATOMS + 'decisions/loan_limit_decision_v2.md', (t) => t.replace('- is_a:', '- conflicts_with: [[loan_limit_decision_v3]]\n- is_a:')))));
  assert.deepEqual(buildRelations(s, buildLineage(s)).clashes, []);
});

// M4
test('실을 수 없는 형식은 목록에 알린다', () => {
  const b = makeBook({ reviewed: false });
  const run = runCli('scan', '--root', rootOf(b.project), '--project', b.project, '--out', b.dir);
  assert.equal(run.code, 0, run.err);
  assert.match(read(b.project, B + '.work/inventory.md'), /실을 수 없는 형식[\s\S]*docs\/Old_Plan\.docx/);
});

// M5 일부
test('책·부·장 제목이 없으면 알린다', () => {
  const r = validateOutline(change((x) => { delete x.title; delete x.parts[1].title; delete x.parts[1].chapters[0].title; }), loadStore(rootOf(copyProject())), []);
  assert.equal(r.problems.filter((m) => /제목/.test(m)).length, 3);
});

// M6
test('txt 문서는 글로 싣는다', () => {
  const b = makeBook({ book: change((x) => { x.context.push({ id: 'memo', title: '메모', kind: 'reference', mode: 'appendix', versions: [{ path: '../memo.txt' }] }); }), mutate: (d) => write(d, 'docs/memo.txt', '메모 첫 줄\n\n[[loan_return_rule_v2]]를 본다\n') });
  buildMd(openBook(b.dir));
  const p = read(b.project, M + 'appendix/context/context_memo.md');
  assert.doesNotMatch(p, /```/);
  assert.match(p, /\[loan_return_rule_v2\]\(\.\.\/atoms\/loan_return_rule_v2\.md\)를 본다/);
  assert.deepEqual(errors(checkBuilt(openBook(b.dir))), []);
});

// M7
test('별칭을 붙인 이름 링크를 알아본다', () => {
  assert.deepEqual(wikiNames('[[a_v1|이름]] [[b_v1]]'), ['a_v1', 'b_v1']);
  assert.deepEqual(errors(checkOf(KEY, swap(LIMITS, '[[loan_return_rule_v2]]를', '[[loan_return_rule_v2|반납]]을'))), []);
});

// M9 일부
test('프론트매터의 숫자는 원문 숫자로 치지 않는다', () => {
  assert.deepEqual(codes(checkOf('notice/channels', swap(CHANNELS, '문자 알림을 쓰지 않는다. 알림 시험', '문자 알림을 1번도 쓰지 않는다. 알림 시험'))), ['number']);
});
