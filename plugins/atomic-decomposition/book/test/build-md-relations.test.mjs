import test from 'node:test';
import assert from 'node:assert/strict';
import { read, edit, ATOMS } from './util.mjs';
import { makeBook } from './samplebook.mjs';
import { openBook } from '../lib/bookfile.mjs';
import { buildMd } from '../lib/build-md.mjs';
import { checkBuilt } from '../lib/check.mjs';

const build = (o) => { const b = makeBook(o); buildMd(openBook(b.dir)); return { ...b, page: (rel) => read(b.project, 'docs/atomic-book/md/' + rel) }; };
const errors = (dir) => checkBuilt(openBook(dir)).filter((f) => f.level === 'error');
const addRequires = (rel, ...names) => (d) => edit(d, ATOMS + rel, (t) => t.replace('derives_from:\n', `requires:\n${names.map((n) => `  - ${n}\n`).join('')}derives_from:\n`));

test('폐기된 결정의 참조는 역참조로 세지 않는다', () => {
  const b = build({ mutate: addRequires('rules/notice_mail_only_rule_v1.md', 'notice_feedback_v1') });
  assert.doesNotMatch(b.page('chapters/notice/channels.md'), /이 결정을 참조/);
});

test('이미 폐기된 결정을 전제로 하면 폐기됐음과 현재 결정을 알린다', () => {
  const b = build({ mutate: addRequires('rules/notice_feedback_v1.md', 'loan_limit_decision_v1', 'loan_dropped_rnd_v1') });
  const line = b.page('chapters/notice/channels.md').split('\n').find((l) => l.startsWith('- 전제: ') && l.includes('loan_limit_decision_v1.md'));
  assert.match(line, /loan_limit_decision_v1\.md\) \(폐기 → 현재: \[[^\]]+\]\(\.\.\/loan\/limits\.md#loan_limit_decision_v3\)\)/);
  assert.match(line, /loan_dropped_rnd_v1\.md\) \(폐기\)/);
  assert.deepEqual(errors(b.dir), []);
});

test('쓰지 않은 배경 장은 원문으로 이어진다고 알린다', () => {
  const b = build({ manuscripts: {}, reviewed: false });
  const t = b.page('chapters/background/vision.md');
  assert.match(t, /아직 편집하지 않은 장입니다\. 원문으로 이어집니다\./);
  assert.match(t, /appendix\/layers\/L0_vision\.md/);
  assert.match(b.page('chapters/background/plan.md'), /appendix\/context\/context_plan_v2\.md/);
  assert.deepEqual(errors(b.dir), []);
});

test('원고가 폐기된 결정을 가리키면 폐기됐음과 현재 결정을 알린다', () => {
  const b = makeBook();
  edit(b.project, 'docs/atomic-book/manuscript/loan/limits.md', (t) => t.replace('모았다.', '모았다. [[loan_limit_decision_v1]]'));
  buildMd(openBook(b.dir));
  const t = read(b.project, 'docs/atomic-book/md/chapters/loan/limits.md');
  assert.match(t.split('\n').find((l) => l.includes('모았다.')), /loan_limit_decision_v1.md. .폐기 → 현재: .+#loan_limit_decision_v3/);
});
