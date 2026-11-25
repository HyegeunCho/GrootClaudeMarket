import test from 'node:test';
import assert from 'node:assert/strict';
import { copyProject, rootOf, edit, ATOMS, FIX } from './util.mjs';
import { loadStore } from '../lib/store.mjs';
import { buildLineage, buildRelations } from '../lib/lineage.mjs';
import { chapterGraph, toMermaid, wrap, textWidth } from '../lib/graph.mjs';

const ctxOf = (project) => { const store = loadStore(rootOf(project)); return { store, relations: buildRelations(store, buildLineage(store)) }; };
const NAMES = ['concept_loan_item_v2', 'loan_limit_decision_v3', 'loan_fee_values_rnd_v1'];

test('같은 두 결정 사이의 관계는 한 선으로 합치고 앞선 결정에서 시작한다', () => {
  const g = chapterGraph(NAMES, ctxOf(FIX));
  assert.deepEqual(g.edges, [
    { from: 'concept_loan_item_v2', to: 'loan_limit_decision_v3', rels: ['전제'] },
    { from: 'loan_limit_decision_v3', to: 'loan_fee_values_rnd_v1', rels: ['전제', '근거', '영향'] },
  ]);
});

test('관계가 하나도 없으면 그림이 없다', () => {
  assert.equal(chapterGraph(['notice_time_rule_v1', 'notice_feedback_v1'], ctxOf(FIX)), null);
});

test('Mermaid 제목의 특수문자를 바꾼다', () => {
  const p = copyProject((d) => edit(d, ATOMS + 'concepts/concept_loan_item_v2.md', (t) => t.replace('title: "개념 정의: 자료"', 'title: \'<b> # "따옴표" `코드`\'')));
  const m = toMermaid(chapterGraph(NAMES, ctxOf(p)));
  assert.match(m, /n0\["#lt;b#gt; #35; #quot;따옴표#quot; '코드'"\]/);
});

test('긴 글을 너비에 맞춰 나눈다', () => {
  for (const l of wrap('가나다라마바사 아자차카타파하 abcdefghijklmnop', 10)) assert.ok(textWidth(l) <= 10, l);
  assert.equal(wrap('가나다라마바사 아자차', 10).join('').replaceAll(' ', ''), '가나다라마바사아자차');
});
