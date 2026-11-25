import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { copyProject, rootOf, write, edit, FIX, ATOMS } from './util.mjs';
import { loadStore } from '../lib/store.mjs';
import { findCandidates, loadContext } from '../lib/context.mjs';

const cands = findCandidates(loadStore(rootOf(FIX)), FIX);
const byPath = (p, list = cands) => list.find((c) => c.versions.some((v) => v.path === p));

test('버전이 다른 기획서를 번호순으로 묶는다', () => {
  const c = byPath('docs/Plan_v2.md');
  assert.deepEqual(c.versions, [{ label: 'v1', path: 'docs/Plan_v1.md' }, { label: 'v2', path: 'docs/Plan_v2.md' }]);
  assert.equal(c.id, 'plan');
  assert.equal(c.title, '대출 기획서 v2');
  assert.equal(c.kind, 'plan');
  assert.equal(c.mode, 'edit');
  assert.ok(c.mentions >= 2);
  assert.ok(c.chars > 100);
});

test('다른 폴더에 있는 구버전도 묶는다', () => {
  const p = copyProject((d) => {
    write(d, 'docs/archive/Spec_v1.md', '# 스펙 v1\n');
    write(d, 'docs/Spec_v10.md', '# 스펙 v10\n');
    write(d, 'docs/Spec_v2.md', '# 스펙 v2\n');
  });
  const c = byPath('docs/Spec_v10.md', findCandidates(loadStore(rootOf(p)), p));
  assert.deepEqual(c.versions.map((v) => v.path), ['docs/archive/Spec_v1.md', 'docs/Spec_v2.md', 'docs/Spec_v10.md']);
});

test('프롬프트는 원문만, 지침은 편집이 기본이다', () => {
  const prompt = byPath('docs/안내문 프롬프트 (초안).md');
  assert.equal(prompt.kind, 'prompt');
  assert.equal(prompt.mode, 'appendix');
  assert.match(prompt.id, /^[a-z0-9][a-z0-9-]*$/);
  const guide = byPath('CLAUDE.md');
  assert.equal(guide.kind, 'guide');
  assert.equal(guide.mode, 'edit');
});

test('리뷰와 할 일 목록은 이름에 plan이 있어도 참고 자료다', () => {
  const p = copyProject((d) => { write(d, 'docs/SkillPlan_Review.md', '# 리뷰\n'); write(d, 'docs/Plan_TODO.md', '# 할 일\n'); });
  const list = findCandidates(loadStore(rootOf(p)), p);
  assert.equal(byPath('docs/SkillPlan_Review.md', list).mode, 'appendix');
  assert.equal(byPath('docs/Plan_TODO.md', list).kind, 'reference');
});

test('docx와 저장소 안의 문서는 후보가 아니다', () => {
  assert.equal(cands.some((c) => c.versions.some((v) => v.path.endsWith('.docx') || v.path.startsWith('docs/atomic/'))), false);
});

test('언급된 데이터 파일은 후보가 아니고 이름이 프롬프트인 json은 후보다', () => {
  const p = copyProject((d) => {
    write(d, 'src/notices.json', '{}');
    write(d, 'docs/prompts.json', '{"a":1}');
    edit(d, ATOMS + 'rules/notice_time_rule_v1.md', (t) => t + '\n`notices.json`과 `prompts.json`\n');
  });
  const list = findCandidates(loadStore(rootOf(p)), p);
  assert.equal(byPath('src/notices.json', list), undefined);
  assert.equal(byPath('docs/prompts.json', list).kind, 'prompt');
});

test('이미 만든 책 폴더는 후보를 찾지 않는다', () => {
  const p = copyProject((d) => {
    write(d, 'docs/atomic-book/book.json', '{"schema":"atomic-book/v1"}');
    write(d, 'docs/atomic-book/md/Plan_copy.md', '# 사본\n');
  });
  assert.equal(byPath('docs/atomic-book/md/Plan_copy.md', findCandidates(loadStore(rootOf(p)), p)), undefined);
});

test('컨텍스트 문서를 읽고 마지막 버전을 현행으로 본다', () => {
  const book = { context: [{ id: 'plan', title: '기획서', kind: 'plan', mode: 'edit', versions: [{ label: 'v1', path: '../Plan_v1.md' }, { label: 'v2', path: '../Plan_v2.md' }] }, { id: 'guide', title: '지침', kind: 'guide', mode: 'edit', versions: [{ path: '../../CLAUDE.md' }] }] };
  const { docs, problems } = loadContext(book, path.join(FIX, 'docs', 'atomic-book'));
  assert.deepEqual(problems, []);
  assert.deepEqual(docs[0].versions.map((v) => [v.name, v.current]), [['context_plan_v1', false], ['context_plan_v2', true]]);
  assert.equal(docs[1].versions[0].name, 'context_guide');
  assert.match(docs[0].versions[1].text, /대출 기획서 v2/);
});

test('없는 파일과 실을 수 없는 형식은 문제로 보고한다', () => {
  const book = { context: [{ id: 'a', title: 'a', kind: 'plan', mode: 'edit', versions: [{ path: '../nope.md' }] }, { id: 'b', title: 'b', kind: 'plan', mode: 'edit', versions: [{ path: '../Old_Plan.docx' }] }] };
  const { docs, problems } = loadContext(book, path.join(FIX, 'docs', 'atomic-book'));
  assert.deepEqual(problems.map((x) => x.code), ['context-missing', 'context-unsupported']);
  assert.equal(docs.length, 0);
});
