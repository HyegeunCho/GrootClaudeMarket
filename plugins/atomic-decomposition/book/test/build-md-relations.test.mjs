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
  assert.doesNotMatch(b.page('appendix/atoms/notice_feedback_v1.md'), /이 결정을 참조/);
});

test('현행 결정의 전제는 상대 원문 쪽에 역참조로 나온다', () => {
  const b = build({ mutate: addRequires('rules/notice_feedback_v1.md', 'notice_time_rule_v1') });
  assert.match(b.page('appendix/atoms/notice_time_rule_v1.md'), /- 이 결정을 참조: \[알림 시험은 받는 사람을 밝힌다\]\(notice_feedback_v1\.md\)/);
  assert.deepEqual(errors(b.dir), []);
});

test('쓰지 않은 장은 컨텍스트 문서의 원문으로 잇는다', () => {
  const b = build({ manuscripts: {}, reviewed: false });
  const t = b.page('chapters/loan/plan.md');
  assert.match(t, /아직 편집하지 않았습니다/);
  assert.match(t, /## 대출 기획서 <a href="#plan" id="plan"><\/a>\n\n\[원문\]\(\.\.\/\.\.\/appendix\/context\/context_plan_v2\.md\)/);
  assert.deepEqual(errors(b.dir), []);
});

test('원고가 폐기된 결정을 가리키면 그 원문으로 잇는다', () => {
  const b = makeBook();
  edit(b.project, 'docs/atomic-book/manuscript/loan/limits.md', (t) => t.replace('모았다.', '모았다. [[loan_limit_decision_v1]]'));
  buildMd(openBook(b.dir));
  const t = read(b.project, 'docs/atomic-book/md/chapters/loan/limits.md');
  assert.match(t.split('\n').find((l) => l.includes('모았다.')), /\[대출 권수는 등급마다 고정되고 한 번 정하면 바뀌지 않는다\]\(\.\.\/\.\.\/appendix\/history\/loan_limit_decision_v1\.md\)/);
});
