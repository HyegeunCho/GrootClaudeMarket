import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { read, write, edit, exists, hashTree, runCli, tempDir, ATOMS } from './util.mjs';
import { makeBook, BOOK, LIMITS, MANUSCRIPTS } from './samplebook.mjs';
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
  assert.match(before, /\* \[여는 글\]\(README\.md\)/);
  assert.deepEqual([...summary.matchAll(/^## (.*)$/gm)].map((m) => m[1]), ['1부 · 책을 빌리는 사람', '2부 · 알림을 받는 사람', '부록 · 원문 찾아보기', '다른 순서로 보기']);
});

test('장과 부에는 책 전체에서 이어지는 번호가 붙고 끌 수 있다', () => {
  assert.match(summary, /^\* \[2장\. 대출 한도\]\(chapters\/loan\/limits\.md\)$/m);
  assert.match(limits, /^# 2장\. 대출 한도\n/);
  const b = build({ book: change((x) => { x.numbering = false; }) });
  assert.match(b.page('SUMMARY.md'), /^## 책을 빌리는 사람$/m);
  assert.match(b.page('chapters/loan/limits.md'), /^# 대출 한도\n/);
});

test('제목의 대괄호를 이스케이프한다', () => {
  assert.match(summary, /\[\\\[R&D\\\] 연체료는 시험값이다\]\(appendix\/atoms\/loan_fee_values_rnd_v1\.md\)/);
});

test('표지는 여는 글, 읽는 순서 표, 첫 장 링크, 기준 날짜다', () => {
  const r = page('README.md');
  assert.match(r, /^# 예제 결정 책\n\n책을 빌리러 온 사람을 따라갑니다\./);
  assert.match(r, /\[도서관의 비전\]\(appendix\/layers\/L0_vision\.md\)/);
  assert.match(r, /### 1부 · 책을 빌리는 사람\n\n\| 장 \| 이 장에서 만나는 장면 \|/);
  assert.match(r, /\| \[2장\. 대출 한도\]\(chapters\/loan\/limits\.md\) \| 책을 빌리러 왔습니다\. 몇 권까지 빌릴 수 있을까요\? \|/);
  assert.match(r, /\*\*\[첫 장 읽기 → 1장\. 기획서가 정한 것\]\(chapters\/loan\/plan\.md\)\*\*/);
  assert.match(r, /기준 날짜: 2026-03-21/);
  assert.match(r, /\[부록 · 원문 찾아보기\]\(appendix\/README\.md\)/);
});

test('여는 글이 없어도 읽는 순서 표는 싣는다', () => {
  const b = build({ manuscripts: { 'loan/limits': LIMITS }, reviewed: false });
  const r = b.page('README.md');
  assert.match(r, /^# 예제 결정 책\n\n## 읽는 순서/);
  assert.match(r, /\[3장\. 알림 수단\]\(chapters\/notice\/channels\.md\)/);
  assert.deepEqual(errors(b.dir), []);
});

test('절마다 앵커가 있고, 본문에는 상태 줄·관계 목록·그림을 넣지 않는다', () => {
  assert.match(limits, /## 다시 빌리기 <a href="#loan_limit_decision_v3" id="loan_limit_decision_v3"><\/a>\n\n지난 날이/);
  const body = limits.slice(0, limits.indexOf('<details>'));
  assert.doesNotMatch(body, /초안\(draft\)|이어진 결정|이 장의 결정|mermaid|관련 기획서/);
});

test('같은 결정이 두 절에 나와도 앵커가 겹치지 않는다', () => {
  const b = build({ manuscripts: { ...MANUSCRIPTS, 'loan/limits': LIMITS.replace('<!-- atoms: loan_return_rule_v2 -->', '<!-- atoms: loan_limit_decision_v3 -->\n<!-- atoms: loan_return_rule_v2 -->') }, reviewed: false });
  const t = b.page('chapters/loan/limits.md');
  assert.match(t, /## 반납 <a href="#loan_return_rule_v2" id="loan_return_rule_v2">/);
  assert.equal([...t.matchAll(/id="loan_limit_decision_v3"/g)].length, 1);
  assert.deepEqual(errors(b.dir), []);
});

test('장 끝에 근거 문서를 접어 두고 상태·버전·예외·이력을 알린다', () => {
  const box = limits.slice(limits.indexOf('<details>'), limits.indexOf('</details>'));
  assert.match(box, /<summary>이 장의 근거 문서 6편<\/summary>/);
  assert.match(box, /- \[다시 빌리는 주기\]\(\.\.\/\.\.\/appendix\/atoms\/loan_limit_decision_v3\.md\) · 초안\(draft\) · v3 · 2026-03-21 · 예외 있음 · 이력 3건/);
  assert.match(box, /연체료는 시험값이다\]\([^)]+\) · 검증 중\(pending\)/);
  assert.match(box, /\[\\\[R&D\\\] 밤에만 예약을 받는다\]\(\.\.\/\.\.\/appendix\/history\/loan_dropped_rnd_v1\.md\) · 폐기\(archived\) · v1 · 2026-03-17 · 후속 결정 없음/);
  assert.match(box, /\[L1 · 대출의 규칙\]\(\.\.\/\.\.\/appendix\/layers\/L1_loan_system\.md\) · Layer 문서/);
  assert.match(page('chapters/notice/channels.md'), /· 재발 방지 · 초안\(draft\)/);
  assert.match(page('chapters/loan/plan.md'), /- \[대출 기획서\]\(\.\.\/\.\.\/appendix\/context\/context_plan_v2\.md\) · 기획서/);
});

test('예외가 있는 결정만 예외를 알린다', () => {
  assert.equal([...limits.matchAll(/예외 있음/g)].length, 1);
});

test('이력 항목마다 그 버전의 원문으로 이어진다', () => {
  assert.match(limits, /\*\*v1 \(2026-03-13\)\*\* .* \[원문\]\(\.\.\/\.\.\/appendix\/history\/loan_limit_decision_v1\.md\)/);
  assert.match(limits, /\*\*v3 \(2026-03-21\)\*\* .* \[원문\]\(\.\.\/\.\.\/appendix\/atoms\/loan_limit_decision_v3\.md\)/);
  assert.match(page('chapters/loan/plan.md'), /\*\*v1\*\* .* \[원문\]\(\.\.\/\.\.\/appendix\/history\/context_plan_v1\.md\)/);
});

test('이름 링크는 근거 원문으로, 장 이름은 그 장으로 잇고 표식은 사라진다', () => {
  assert.match(limits, /반납은 \[반납 순서\]\(\.\.\/\.\.\/appendix\/atoms\/loan_return_rule_v2\.md\)를 따른다/);
  assert.match(limits, /\(\[\\\[R&D\\\] 연체료는 시험값이다\]\(\.\.\/\.\.\/appendix\/atoms\/loan_fee_values_rnd_v1\.md\)\)/);
  const plan = page('chapters/loan/plan.md');
  assert.match(plan, /\[대출 기획서\]\(\.\.\/\.\.\/appendix\/context\/context_plan_v2\.md\)/);
  assert.match(plan, /이제 한도를 봅니다\. \[2장\. 대출 한도\]\(limits\.md\)/);
  assert.doesNotMatch(limits, /<!--|\[\[/);
});

test('원문 쪽 맨 위에는 그 원문을 근거로 쓴 장으로 돌아가는 줄이 있다', () => {
  const c = page('appendix/atoms/concept_loan_item_v2.md');
  assert.match(c, /^← 본문으로 돌아가기 · \[2장\. 대출 한도\]\(\.\.\/\.\.\/chapters\/loan\/limits\.md#concept_loan_item_v2\)\n\n# 개념 정의: 자료 \(v2\)/);
  assert.match(page('appendix/context/context_plan_v2.md'), /^← 본문으로 돌아가기 · \[1장\. 기획서가 정한 것\]\(\.\.\/\.\.\/chapters\/loan\/plan\.md#plan\)/);
  assert.doesNotMatch(page('appendix/history/loan_limit_decision_v1.md'), /본문으로 돌아가기/);
});

test('원문 쪽 아래에는 이 결정을 참조하는 결정과 문서 정보가 있다', () => {
  const c = page('appendix/atoms/concept_loan_item_v2.md');
  assert.match(c, /<!-- original:end -->\n\n\*\*이어진 결정\*\*\n\n- 이 결정을 참조: \[다시 빌리는 주기\]\(loan_limit_decision_v3\.md\)/);
  assert.match(c, /<details>\n<summary>문서 정보<\/summary>\n\n```yaml\nname: concept_loan_item_v2\n/);
  assert.doesNotMatch(page('appendix/atoms/loan_limit_decision_v3.md'), /바뀌지 않는다\]/); // archived의 참조는 세지 않는다
});

test('현행끼리의 충돌을 원문 쪽에 알린다', () => {
  const b = build({ mutate: (d) => edit(d, ATOMS + 'rules/notice_feedback_v1.md', (t) => t.replace('- is_a:', '- conflicts_with: [[notice_time_rule_v1]]\n- is_a:')) });
  assert.match(b.page('appendix/atoms/notice_feedback_v1.md'), /- 충돌: \[알림 시각은 정한 때뿐이다\]\(notice_time_rule_v1\.md\)/);
  assert.match(b.page('appendix/atoms/notice_time_rule_v1.md'), /- 충돌: \[알림 시험은 받는 사람을 밝힌다\]\(notice_feedback_v1\.md\)/);
});

test('부록은 Layer별로 결정을 묶고, 지난 버전은 지금의 결정 아래에 둔다', () => {
  const block = summary.slice(summary.indexOf('## 부록'), summary.indexOf('## 다른 순서로 보기'));
  assert.match(block, /^\* \[원문을 읽는 법\]\(appendix\/README\.md\)\n  \* \[대출 기획서\]\(appendix\/context\/context_plan_v2\.md\)\n    \* \[대출 기획서 v1\]\(appendix\/history\/context_plan_v1\.md\)\n  \* \[안내문 프롬프트\]/m);
  assert.match(block, /^  \* \[분해 기록: 기준선\]\(appendix\/maps\/map_20260317_baseline\.md\)$/m);
  assert.match(block, /^\* \[L0 · 비전·핵심 가치\]\(appendix\/layers\/L0_vision\.md\)\n  \* \[알림 시각은 정한 때뿐이다\]\(appendix\/atoms\/notice_time_rule_v1\.md\)\n    \* \[알림은 전자우편으로만 보낸다 \(이전 결정\) · 2026-03-17\]\(appendix\/history\/notice_mail_only_rule_v1\.md\)$/m);
  assert.match(block, /^\* \[L1 · 대출의 규칙\]\(appendix\/layers\/L1_loan_system\.md\)\n  \* \[개념 정의: 자료\]\(appendix\/atoms\/concept_loan_item_v2\.md\)\n    \* \[v1 · 2026-03-17\]\(appendix\/history\/concept_loan_item_v1\.md\)\n  \* \[다시 빌리는 주기\]\(appendix\/atoms\/loan_limit_decision_v3\.md\)\n    \* \[v1 · 2026-03-13\]/m);
  assert.match(block, /^  \* \[\\\[R&D\\\] 밤에만 예약을 받는다 \(폐기\)\]\(appendix\/history\/loan_dropped_rnd_v1\.md\)$/m);
  assert.ok(block.indexOf('L0 · 비전') < block.indexOf('L1 · 대출의 규칙'));
});

test('Layer 문서 쪽에는 원문 뒤에 그 Layer의 결정 목록이 있다', () => {
  const l = page('appendix/layers/L1_loan_system.md');
  const list = l.slice(l.indexOf('## 이 Layer의 결정'));
  assert.ok(l.indexOf('<!-- original:end -->') < l.indexOf('## 이 Layer의 결정'));
  assert.match(list, /- \[개념 정의: 자료\]\(\.\.\/atoms\/concept_loan_item_v2\.md\) · 초안\(draft\)/);
  assert.match(list, /밤에만 예약을 받는다\]\(\.\.\/history\/loan_dropped_rnd_v1\.md\) · 폐기\(archived\) · v1 · 2026-03-17 · 후속 결정 없음/);
});

test('원문을 읽는 법 쪽에는 Layer 표, 상태 표, 관련 문서가 있다', () => {
  const a = page('appendix/README.md');
  assert.match(a, /\| \[L1 · 대출의 규칙\]\(layers\/L1_loan_system\.md\) \| 대출과 반납의 규칙을 다룬다\. \| 4편 \|/);
  assert.match(a, /\| \[L0 · 비전·핵심 가치\]\(layers\/L0_vision\.md\) \| 누구나 책을 빌릴 수 있게 한다\. \| 3편 \|/);
  assert.match(a, /\| 검증 중\(pending\) \| /);
  assert.match(a, /- \[대출 기획서\]\(context\/context_plan_v2\.md\) · 기획서 · v2 · 이전 판 1편/);
  assert.match(a, /- \[분해 기록: 대출 한도\]\(maps\/map_20260321_fees\.md\) · 분해 기록 · 2026-03-21/);
});

test('Layer 문서를 적지 않은 결정은 층별 묶음에, 층도 없으면 맨 뒤 묶음에 둔다', () => {
  const b = build({ mutate: (d) => {
    edit(d, ATOMS + 'rules/notice_feedback_v1.md', (t) => t.replace(/part_of:\n  - \[\[L0_vision\]\]\n/, '').replace('- part_of: [[L0_vision]]\n', ''));
    edit(d, ATOMS + 'rules/notice_no_sms_rule_v1.md', (t) => t.replace(/part_of:\n  - \[\[L0_vision\]\]\n/, '').replace('- part_of: [[L0_vision]]\n', '').replace('layer: 1', 'layer: 없음'));
  } });
  const s = b.page('SUMMARY.md');
  assert.match(s, /^\* \[L1 · 소속 Layer 문서가 없는 결정\]\(appendix\/layers\/L1-others\.md\)\n  \* \[알림 시험은 받는 사람을 밝힌다\]/m);
  assert.match(s, /^\* \[Layer를 정하지 않은 결정\]\(appendix\/layers\/no-layer\.md\)\n  \* \[문자 알림을 쓰지 않는다\]/m);
  assert.ok(s.indexOf('L1 · 대출의 규칙') < s.indexOf('L1 · 소속 Layer') && s.indexOf('L1 · 소속 Layer') < s.indexOf('Layer를 정하지 않은'));
  assert.match(b.page('appendix/layers/L1-others.md'), /## 결정\n\n- \[알림 시험은 받는 사람을 밝힌다\]/);
  assert.deepEqual(errors(b.dir), []);
});

test('labels가 없으면 제목을 쓰고, Layer 제목의 L 표기는 뗀다', () => {
  const b = build({ book: change((x) => { delete x.labels; }) });
  const s = b.page('SUMMARY.md');
  assert.match(s, /\[L1 · 대출 시스템\]\(appendix\/layers\/L1_loan_system\.md\)/);
  assert.match(s, /\[대출 권수는 지난 날마다 늘고 한도 안에서만 다시 빌린다\]\(appendix\/atoms\/loan_limit_decision_v3\.md\)/);
  assert.match(b.page('chapters/loan/limits.md'), /반납은 \[반납은 빌린 순서대로이고 간행물은 한도와 무관하다\]\(/);
});

test('원고가 없는 장은 요약 원문과 지난 결정을 싣는다', () => {
  const t = page('chapters/notice/channels.md');
  assert.match(t, /아직 편집하지 않았습니다/);
  assert.match(t, /알림은 정한 시각에만 보낸다\./);
  assert.match(t, /지난 결정: \[알림은 전자우편으로만 보낸다 \(이전 결정\) · 2026-03-17\]\(\.\.\/\.\.\/appendix\/history\/notice_mail_only_rule_v1\.md\)/);
  assert.match(t, /id="notice_time_rule_v1"/);
  assert.match(t, /<summary>이 장의 근거 문서 3편<\/summary>/);
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

test('마일스톤별: milestone으로 묶는다', () => {
  const v = page('views/by-scope.md');
  assert.match(v, /^# 마일스톤별/);
  assert.match(v, /## m1/);
  assert.match(v, /## m3/);
  assert.match(v, /## 마일스톤 없음/);
  assert.doesNotMatch(v, /L1|한 번 정하면 바뀌지 않는다/);
});

test('milestone이 하나도 없으면 마일스톤별 쪽을 만들지 않는다', () => {
  const b = build({ mutate: (d) => { for (const f of walkFiles(path.join(d, 'docs/atomic/atoms'))) fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/^milestone:.*\r?\n/m, '')); }, reviewed: false });
  assert.equal(exists(b.project, M + 'views/by-scope.md'), false);
  assert.doesNotMatch(b.page('SUMMARY.md'), /마일스톤/);
  assert.deepEqual(errors(b.dir), []);
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
  assert.match(limits, /\[← 1장\. 기획서가 정한 것\]\(plan\.md\) · \[목차\]\(\.\.\/\.\.\/README\.md\) · \[3장\. 알림 수단 →\]\(\.\.\/notice\/channels\.md\)/);
  const b = build({ book: change((x) => { x.localNav = false; }) });
  assert.doesNotMatch(b.page('chapters/loan/limits.md'), /\[목차\]/);
});

test('컨텍스트가 없으면 관련 문서에 기획서가 없다', () => {
  const b = build({ book: change((x) => { x.context = []; x.parts[0].chapters.shift(); }), manuscripts: { 'loan/limits': LIMITS } });
  assert.doesNotMatch(b.page('SUMMARY.md'), /appendix\/context/);
  assert.match(b.page('appendix/README.md'), /## 관련 문서[\s\S]*분해 기록: 기준선/);
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
