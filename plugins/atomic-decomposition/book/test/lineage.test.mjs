import test from 'node:test';
import assert from 'node:assert/strict';
import { copyProject, rootOf, edit, write, read, ATOMS, FIX } from './util.mjs';
import { loadStore } from '../lib/store.mjs';
import { buildLineage, buildRelations } from '../lib/lineage.mjs';

const store = loadStore(rootOf(FIX));
const L = buildLineage(store);
const R = buildRelations(store, L);
const names = (docs) => docs.map((d) => d.name);

test('버전 사슬을 오래된 순으로 준다', () => {
  assert.deepEqual(names(L.thread('loan_limit_decision_v3')), ['loan_limit_decision_v1', 'loan_limit_decision_v2', 'loan_limit_decision_v3']);
});

test('이력이 없으면 자신뿐이다', () => {
  assert.deepEqual(names(L.thread('notice_feedback_v1')), ['notice_feedback_v1']);
});

test('Relations에만 적힌 대체도 이력이다', () => {
  assert.deepEqual(L.prev.get('concept_loan_item_v2'), ['concept_loan_item_v1']);
});

test('하나가 둘로 갈라진다', () => {
  assert.deepEqual([...L.next.get('notice_mail_only_rule_v1')].sort(), ['notice_no_sms_rule_v1', 'notice_time_rule_v1']);
});

test('둘이 하나로 합쳐진다', () => {
  const p = copyProject((d) => edit(d, ATOMS + 'rules/notice_time_rule_v1.md', (t) => t.replace('  - notice_mail_only_rule_v1\n', '  - notice_mail_only_rule_v1\n  - loan_return_rule_v1\n')));
  const l = buildLineage(loadStore(rootOf(p)));
  assert.deepEqual(names(l.thread('notice_time_rule_v1')), ['loan_return_rule_v1', 'notice_mail_only_rule_v1', 'notice_time_rule_v1']);
});

test('conflicts_with가 없으면 같은 이름의 다음 버전이 후속이다', () => {
  assert.deepEqual(L.next.get('loan_return_rule_v1'), ['loan_return_rule_v2']);
  assert.deepEqual(names(L.thread('loan_return_rule_v2')), ['loan_return_rule_v1', 'loan_return_rule_v2']);
});

test('후속 없는 폐기를 모은다', () => {
  assert.deepEqual(names(L.orphans), ['loan_dropped_rnd_v1']);
});

test('현행끼리의 충돌은 이력이 아니라 충돌이다', () => {
  const p = copyProject((d) => edit(d, ATOMS + 'rules/notice_feedback_v1.md', (t) => t.replace('- is_a:', '- conflicts_with: [[notice_time_rule_v1]]\n- is_a:')));
  const s = loadStore(rootOf(p));
  const l = buildLineage(s);
  assert.equal(l.prev.has('notice_feedback_v1'), false);
  assert.deepEqual(buildRelations(s, l).clashes, [{ from: 'notice_feedback_v1', to: 'notice_time_rule_v1' }]);
});

test('저장소 안 문서 사이의 관계와 역참조를 센다', () => {
  const out = R.out.get('loan_limit_decision_v3');
  assert.deepEqual(out.filter((e) => e.rel === 'requires'), [{ rel: 'requires', to: 'concept_loan_item_v2' }]);
  assert.deepEqual(out.filter((e) => e.rel === 'affects'), [{ rel: 'affects', to: 'loan_fee_values_rnd_v1' }]);
  assert.ok(R.in.get('concept_loan_item_v2').some((e) => e.rel === 'requires' && e.from === 'loan_limit_decision_v3'));
  assert.equal(out.some((e) => e.rel === 'conflicts_with'), false);
});

test('책 밖 이름만 external에 있고 코드 안의 이름은 세지 않는다', () => {
  assert.deepEqual([...R.external.entries()], [['outside_rule_v1', ['notice_feedback_v1']]]);
  const p = copyProject((d) => edit(d, ATOMS + 'rules/notice_feedback_v1.md', (t) => t + '\n`[[in_code_v1]]`\n\n```\n[[in_fence_v1]]\n```\n'));
  const s = loadStore(rootOf(p));
  assert.deepEqual([...buildRelations(s, buildLineage(s)).external.keys()], ['outside_rule_v1']);
});

test('[Review Focus 4] 서로를 가리켜도 끝난다', () => {
  const p = copyProject((d) => {
    const mk = (a, b) => read(d, ATOMS + 'rules/notice_time_rule_v1.md').replaceAll('notice_time_rule_v1', a).replaceAll('notice_mail_only_rule_v1', b).replace('status: draft', 'status: archived');
    write(d, ATOMS + 'rules/loop_a_rule_v1.md', mk('loop_a_rule_v1', 'loop_b_rule_v1'));
    write(d, ATOMS + 'rules/loop_b_rule_v1.md', mk('loop_b_rule_v1', 'loop_a_rule_v1'));
  });
  assert.equal(buildLineage(loadStore(rootOf(p))).thread('loop_a_rule_v1').length, 2);
});
