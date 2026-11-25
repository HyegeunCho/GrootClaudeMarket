import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { read, write, edit, exists, hashTree, runCli, tempDir, ATOMS } from './util.mjs';
import { makeBook, BOOK } from './samplebook.mjs';
import { openBook } from '../lib/bookfile.mjs';
import { buildMd } from '../lib/build-md.mjs';
import { publishDir, walkFiles, toPosix } from '../lib/fsutil.mjs';
import { checkBuilt, originalFingerprint } from '../lib/check.mjs';

const B = 'docs/atomic-book/';
const M = B + 'md/';
const built = makeBook();
buildMd(openBook(built.dir));
const page = (rel) => read(built.project, M + rel);
const limits = page('chapters/loan/limits.md');
const summary = page('SUMMARY.md');
const build = (o) => { const b = makeBook(o); buildMd(openBook(b.dir)); return { ...b, page: (rel) => read(b.project, M + rel) }; };
const change = (fn) => { const b = structuredClone(BOOK); fn(b); return b; };
const errors = (dir) => checkBuilt(openBook(dir)).filter((f) => f.level === 'error');

test('[Review Focus 1] 만든 책에는 깨진 링크와 절대 경로가 없다', () => {
  assert.deepEqual(errors(built.dir), []);
});

test('GitBook 설정과 표식을 쓴다', () => {
  assert.equal(page('.gitbook.yaml'), 'root: ./\nstructure:\n  readme: README.md\n  summary: SUMMARY.md\n');
  assert.equal(exists(built.project, M + '.atomic-book'), true);
});

test('SUMMARY에는 같은 파일이 한 번만 있고 모두 실제로 있다', () => {
  const files = [...summary.matchAll(/\]\(([^)]+)\)/g)].map((m) => decodeURIComponent(m[1]));
  assert.equal(new Set(files).size, files.length);
  for (const f of files) assert.ok(exists(built.project, M + f), f);
  const all = walkFiles(path.join(built.dir, 'md')).map((f) => toPosix(path.relative(path.join(built.dir, 'md'), f))).filter((f) => f.endsWith('.md') && f !== 'SUMMARY.md');
  assert.deepEqual([...files].sort(), all.sort());
});

test('묶음 없는 링크는 표지 하나이고 첫 묶음보다 앞에 있다', () => {
  const before = summary.slice(0, summary.indexOf('\n## '));
  assert.deepEqual([...before.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]), ['README.md']);
  assert.deepEqual([...summary.matchAll(/^## (.*)$/gm)].map((m) => m[1]), ['배경', '대출', '알림', '다른 순서로 보기', '부록']);
});

test('제목의 대괄호를 이스케이프한다', () => {
  assert.match(summary, /\[\\\[R&D\\\] 연체료는 시험값이다 \(v1\)\]\(appendix\/atoms\/loan_fee_values_rnd_v1\.md\)/);
});

test('표지에 기준 날짜와 전체 목차가 있다', () => {
  const r = page('README.md');
  assert.match(r, /^# 예제 결정 책/);
  assert.match(r, /2026-03-21/);
  assert.match(r, /\[대출 한도\]\(chapters\/loan\/limits\.md\)/);
  assert.match(r, /\[부록 A[^\]]*\]\(appendix\/history\/README\.md\)/);
});

test('절마다 앵커, 상태 줄, 원문 링크가 있다', () => {
  assert.match(limits, /## 다시 빌리기 <a href="#loan_limit_decision_v3" id="loan_limit_decision_v3"><\/a>/);
  assert.match(limits, /v3 · 2026-03-21 · 초안\(draft\) · \[원문\]\(\.\.\/\.\.\/appendix\/atoms\/loan_limit_decision_v3\.md\)/);
  assert.match(limits, /v1 · 2026-03-21 · 검증 중\(pending\)/);
  assert.match(page('chapters/notice/channels.md'), /재발 방지 · /);
});

test('예외가 있는 결정만 예외를 알린다', () => {
  assert.equal([...limits.matchAll(/예외 있음/g)].length, 1);
});

test('이력 항목마다 그 버전의 원문으로 이어진다', () => {
  assert.match(limits, /\*\*v1 \(2026-03-13\)\*\* .* \[원문\]\(\.\.\/\.\.\/appendix\/history\/loan_limit_decision_v1\.md\)/);
  assert.match(limits, /\*\*v3 \(2026-03-21\)\*\* .* \[원문\]\(\.\.\/\.\.\/appendix\/atoms\/loan_limit_decision_v3\.md\)/);
  assert.match(page('chapters/background/plan.md'), /\*\*v1\*\* .* \[원문\]\(\.\.\/\.\.\/appendix\/history\/context_plan_v1\.md\)/);
});

test('이름 링크는 절로, 표식은 사라진다', () => {
  assert.match(limits, /\[반납은 빌린 순서대로이고 간행물은 한도와 무관하다\]\(#loan_return_rule_v2\)를 따른다/);
  assert.doesNotMatch(limits, /<!--|\[\[/);
});

test('절 끝에 전제·영향·역참조가 있다', () => {
  const s = limits.slice(limits.indexOf('## 다시 빌리기'), limits.indexOf('## 반납'));
  assert.match(s, /전제: \[개념 정의: 자료\]\(#concept_loan_item_v2\)/);
  assert.match(s, /\[L0 비전·핵심 가치\]\(\.\.\/background\/vision\.md#L0_vision\)/);
  const place = limits.slice(limits.indexOf('## 자료'), limits.indexOf('## 다시 빌리기'));
  assert.match(place, /이 결정을 참조: \[대출 권수는 지난 날마다 늘고 한도 안에서만 다시 빌린다\]\(#loan_limit_decision_v3\)/);
  assert.doesNotMatch(place, /바뀌지 않는다\]/); // archived의 참조는 세지 않는다
});

test('같은 절 안의 결정끼리는 이어진 결정에 적지 않는다', () => {
  const s = limits.slice(limits.indexOf('## 다시 빌리기'), limits.indexOf('## 반납'));
  assert.doesNotMatch(s.slice(s.indexOf('**이어진 결정**')), /연체료는 시험값/);
});

test('현행끼리의 충돌을 알린다', () => {
  const b = build({ mutate: (d) => edit(d, ATOMS + 'rules/notice_feedback_v1.md', (t) => t.replace('- is_a:', '- conflicts_with: [[notice_time_rule_v1]]\n- is_a:')) });
  const t = b.page('chapters/notice/channels.md');
  assert.equal([...t.matchAll(/충돌: /g)].length, 2);
});

test('관련 기획서로 이어진다', () => {
  assert.match(limits, /관련 기획서: \[대출 기획서\]\(\.\.\/background\/plan\.md#plan\)/);
});

test('관계 그림은 장 안의 관계만 그린다', () => {
  const g = limits.match(/```mermaid\n([\s\S]*?)```/)[1];
  assert.equal([...g.matchAll(/^\s+n\d+\["/gm)].length, 4);
  assert.match(g, /전제/);
  assert.doesNotMatch(page('chapters/notice/channels.md'), /mermaid/);
});

test('후속 없는 폐기는 "폐기된 결정" 절에 한 번 나온다', () => {
  const s = limits.slice(limits.indexOf('## 폐기된 결정'));
  assert.equal([...limits.matchAll(/밤에만 예약을 받는 가설을 시험한다\./g)].length, 1);
  assert.match(s, /appendix\/history\/loan_dropped_rnd_v1\.md/);
});

test('원고가 없는 장은 요약 원문과 지난 결정을 싣는다', () => {
  const t = page('chapters/notice/channels.md');
  assert.match(t, /아직 편집하지 않은 장/);
  assert.match(t, /알림은 정한 시각에만 보낸다\./);
  assert.match(t, /appendix\/history\/notice_mail_only_rule_v1\.md/);
  assert.match(t, /id="notice_time_rule_v1"/);
});

test('원문은 링크 표기 말고는 같다', () => {
  for (const [rel, src] of [['appendix/atoms/loan_limit_decision_v3.md', ATOMS + 'decisions/loan_limit_decision_v3.md'], ['appendix/context/context_plan_v2.md', 'docs/Plan_v2.md']]) {
    const block = page(rel).match(/<!-- original:begin -->\n([\s\S]*)\n<!-- original:end -->/)[1];
    const source = read(built.project, src).replace(/^---\n[\s\S]*?\n---\n/, '');
    assert.equal(originalFingerprint(block), originalFingerprint(source));
  }
  const p = page('appendix/atoms/loan_limit_decision_v3.md');
  assert.match(p, /```yaml\nname: loan_limit_decision_v3\n/);
  assert.match(p, /`\/\/ Decision: \[\[loan_limit_decision_v3\]\]`/);
});

test('원문의 링크는 원문으로, 이력 원문은 대체한 결정으로 이어진다', () => {
  assert.match(page('appendix/atoms/loan_limit_decision_v3.md'), /\[loan_fee_values_rnd_v1\]\(loan_fee_values_rnd_v1\.md\)/);
  assert.match(page('appendix/history/notice_mail_only_rule_v1.md'), /대체한 결정: .*notice_no_sms_rule_v1.*notice_time_rule_v1/);
  assert.match(page('appendix/context/context_plan_v2.md'), /\[초안\]\(context_prompt\.md\)/);
  assert.match(page('appendix/context/context_plan_v2.md'), /\[한도 결정\]\(\.\.\/atoms\/loan_limit_decision_v3\.md\)/);
});

test('이미지를 assets로 복사한다', () => {
  const dest = page('appendix/context/context_plan_v2.md').match(/!\[지도\]\(([^)]+)\)/)[1];
  assert.ok(fs.existsSync(path.join(built.dir, 'md', 'appendix', 'context', decodeURIComponent(dest))));
});

test('원문이 코드인 문서는 코드 블록으로 싣는다', () => {
  const b = build({ book: change((x) => { x.context.push({ id: 'data', title: '자료', kind: 'reference', mode: 'appendix', versions: [{ path: '../data.json' }] }); }), mutate: (d) => write(d, 'docs/data.json', '{"a": "```"}\n') });
  assert.match(b.page('appendix/context/context_data.md'), /````json\n\{"a": "```"\}\n````/);
  assert.deepEqual(errors(b.dir), []);
});

test('구현 범위별: milestone과 Layer 문서로 묶는다', () => {
  const v = page('views/by-scope.md');
  assert.match(v, /### m1/);
  assert.match(v, /### m3/);
  assert.match(v, /### 마일스톤 없음/);
  assert.match(v, /### \[L1 대출 시스템\]\(\.\.\/appendix\/layers\/L1_loan_system\.md\)/);
  assert.doesNotMatch(v, /한 번 정하면 바뀌지 않는다/);
});

test('milestone이 하나도 없으면 그 묶음을 만들지 않는다', () => {
  const b = build({ mutate: (d) => { for (const f of walkFiles(path.join(d, 'docs/atomic/atoms'))) fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/^milestone:.*\r?\n/m, '')); }, reviewed: false });
  assert.doesNotMatch(b.page('views/by-scope.md'), /마일스톤/);
});

test('작업 순서별: 분해 기록 날짜순이고 과거 결정에는 현재 결정을 잇는다', () => {
  const v = page('views/by-work.md');
  assert.ok(v.indexOf('분해 기록: 기준선') < v.indexOf('분해 기록: 대출 한도'));
  assert.match(v, /출처: docs\/Plan_v2\.md/);
  const line = v.split('\n').find((l) => l.includes('loan_limit_decision_v1.md'));
  assert.match(line, /현재: \[.*\]\(\.\.\/chapters\/loan\/limits\.md#loan_limit_decision_v3\)/);
  assert.doesNotMatch(v, /분해 기록에 없는 결정/);
});

test('분해 기록에 없는 결정도 빠뜨리지 않는다', () => {
  const b = build({ mutate: (d) => edit(d, 'docs/atomic/maps/2026-03-21_fees.md', (t) => t.replace('  - notice_feedback_v1\n', '')) });
  assert.match(b.page('views/by-work.md'), /분해 기록에 없는 결정[\s\S]*notice_feedback_v1/);
});

test('변경 이력 모아보기는 최근에 바뀐 순이고 버전을 차례로 보인다', () => {
  const v = page('views/changes.md');
  const at = (s) => { const i = v.indexOf(s); assert.ok(i >= 0, s); return i; };
  assert.ok(at('대출 권수는 지난 날마다') < at('개념 정의: 자료'));
  assert.ok(at('loan_limit_decision_v1.md') < at('loan_limit_decision_v2.md'));
});

test('이름 찾아보기에는 현행과 과거가 모두 있다', () => {
  const v = page('views/names.md');
  assert.equal([...v.matchAll(/^\| \[/gm)].length, 13);
  assert.match(v, /폐기\(archived\)/);
});

test('아래쪽 이전·목차·다음은 SUMMARY 순서이고 끌 수 있다', () => {
  assert.match(limits, /\[← 대출 기획서\]\(\.\.\/background\/plan\.md\) · \[목차\]\(\.\.\/\.\.\/README\.md\) · \[알림 수단 →\]\(\.\.\/notice\/channels\.md\)/);
  const b = build({ book: change((x) => { x.localNav = false; }) });
  assert.doesNotMatch(b.page('chapters/loan/limits.md'), /\[목차\]/);
});

test('컨텍스트가 없으면 부록 E를 만들지 않는다', () => {
  const b = build({ book: change((x) => { x.context = []; x.parts[0].chapters.pop(); x.parts[1].chapters[0].context = []; }) });
  assert.doesNotMatch(b.page('SUMMARY.md'), /부록 E/);
  assert.deepEqual(errors(b.dir), []);
});

test('두 번 만들면 같은 결과다', () => {
  const b = makeBook();
  buildMd(openBook(b.dir));
  const h = hashTree(path.join(b.dir, 'md'));
  buildMd(openBook(b.dir));
  assert.equal(hashTree(path.join(b.dir, 'md')), h);
});

test('원본은 바뀌지 않는다', () => {
  const b = makeBook();
  const h = hashTree(b.project, ['atomic-book']);
  buildMd(openBook(b.dir));
  assert.equal(hashTree(b.project, ['atomic-book']), h);
});

test('지운 장은 다음 build에서 사라진다', () => {
  const b = makeBook();
  buildMd(openBook(b.dir));
  edit(b.project, B + 'book.json', (t) => t.replace('"id": "channels"', '"id": "times"'));
  buildMd(openBook(b.dir));
  assert.equal(exists(b.project, M + 'chapters/notice/channels.md'), false);
});

test('[Review Focus 5] 표식 없는 폴더는 지우지 않고 멈춘다', () => {
  const b = makeBook();
  write(b.project, M + 'mine.md', '내 글');
  const r = runCli('build', '--out', b.dir);
  assert.equal(r.code, 2);
  assert.match(r.err, /만들지 않은 파일/);
  assert.equal(read(b.project, M + 'mine.md'), '내 글');
});

test('빈 폴더와 없는 폴더는 그냥 쓴다', () => {
  const d = tempDir();
  publishDir(d, new Map([['x.md', '1']]));
  publishDir(path.join(d, 'a', 'b'), new Map());
  assert.ok(fs.existsSync(path.join(d, 'a', 'b', '.atomic-book')));
});

test('checkBuilt는 바뀐 원문, 깨진 링크, 없는 앵커, 절대 경로를 잡는다', () => {
  const broke = (rel, fn) => { const b = makeBook(); buildMd(openBook(b.dir)); edit(b.project, M + rel, fn); return [...new Set(errors(b.dir).map((f) => f.code))]; };
  const A3 = 'appendix/atoms/loan_limit_decision_v3.md';
  const C = 'chapters/loan/limits.md';
  assert.deepEqual(broke(A3, (t) => t.replace('holdGap', 'holdGab')), ['original-changed']);
  assert.deepEqual(broke(A3, (t) => t.replace('status: draft', 'status: active')), ['original-changed']);
  assert.deepEqual(broke(A3, (t) => t.replace('<!-- original:end -->', '')), ['original-changed']);
  assert.deepEqual(broke(C, (t) => t + '\n[x](nope.md)\n'), ['link-broken']);
  assert.deepEqual(broke(C, (t) => t + '\n[x](../../readme.md)\n'), ['link-broken']); // 대소문자가 다르면 GitBook에서 깨진다
  assert.deepEqual(broke(C, (t) => t + '\n[x](#nope)\n'), ['anchor-missing']);
  assert.deepEqual(broke(C, (t) => t + '\n[x](C:/a.md)\n'), ['absolute-link']);
  assert.deepEqual(broke(C, (t) => t + '\n[x](/a.md)\n'), ['absolute-link']);
});

test('GitBook 문법과 겹치는 글은 경고한다', () => {
  const w = checkBuilt(openBook(built.dir)).filter((f) => f.level === 'warn');
  assert.deepEqual(w.map((f) => f.code), ['liquid']);
  assert.match(w[0].message, /context_plan_v2/);
});

test('build 명령은 md를 만들고 검사 결과를 알린다', () => {
  const b = makeBook();
  const r = runCli('build', '--out', b.dir);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /md/);
  assert.equal(exists(b.project, M + 'SUMMARY.md'), true);
});
