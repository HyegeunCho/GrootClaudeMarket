import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { copyProject, rootOf, write, read, edit, ATOMS, FIX } from './util.mjs';
import { loadStore, parseFrontmatter, splitSections, findStores } from '../lib/store.mjs';

const store = loadStore(rootOf(FIX));

test('유형별로 읽고 템플릿은 뺀다', () => {
  assert.equal(store.atoms.length, 13);
  assert.equal(store.layers.length, 2);
  assert.equal(store.maps.length, 2);
  assert.equal(store.docs.has('map_20260317_baseline'), true);
  assert.deepEqual(store.problems, []);
});

test('CRLF 파일도 LF로 읽는다', () => {
  const rel = ATOMS + 'decisions/loan_limit_decision_v3.md';
  const p = copyProject((d) => write(d, rel, read(d, rel).replace(/\n/g, '\r\n')));
  const d = loadStore(rootOf(p)).docs.get('loan_limit_decision_v3');
  assert.equal(d.text.includes('\r'), false);
  assert.equal(d.status, 'draft');
  assert.equal(d.date, '2026-03-21');
  assert.equal(d.sections.length, 5);
});

test('줄 끝 주석과 따옴표를 걷어낸다', () => {
  const { data } = parseFrontmatter('---\nstatus: draft    # draft | archived\ntitle: "a # b"\ndecided: [MISSING]\ntags: [x, y]\nlist:\n  - "하나: 둘"\n  - 셋   # 주석\n---\n본문\n');
  assert.equal(data.status, 'draft');
  assert.equal(data.title, 'a # b');
  assert.equal(data.decided, '[MISSING]');
  assert.deepEqual(data.tags, ['x', 'y']);
  assert.deepEqual(data.list, ['하나: 둘', '셋']);
});

test('프론트매터가 없으면 raw가 null이고 본문은 그대로다', () => {
  const r = parseFrontmatter('# 제목\n\n---\n');
  assert.equal(r.raw, null);
  assert.equal(r.body, '# 제목\n\n---\n');
});

test('코드 블록 안의 ## 는 섹션이 아니다', () => {
  const r = splitSections('# 제목\n\n## Why (근거)\n```\n## 가짜\n```\n끝\n\n## Rule (규칙)\n- 값\n');
  assert.deepEqual(r.sections.map((s) => s.key), ['Why', 'Rule']);
  assert.match(r.sections[0].text, /## 가짜/);
});

test('결정일이 날짜가 아니면 작성일을 쓴다', () => {
  const p = copyProject((d) => edit(d, ATOMS + 'decisions/loan_limit_decision_v3.md', (t) => t.replace('decided: 2026-03-21', 'decided: [MISSING]').replace('created: 2026-03-21', 'created: 2026-03-20')));
  assert.equal(loadStore(rootOf(p)).docs.get('loan_limit_decision_v3').date, '2026-03-20');
});

test('관계는 프론트매터와 Relations의 합집합이고 중복이 없다', () => {
  assert.deepEqual(store.docs.get('concept_loan_item_v2').relations.conflicts_with, ['concept_loan_item_v1']);
  assert.deepEqual(store.docs.get('loan_limit_decision_v3').relations.requires, ['concept_loan_item_v2']);
  assert.deepEqual(store.docs.get('loan_limit_decision_v3').relations.part_of, ['L1_loan_system']);
});

test('요약은 한 문장 요약 줄이고 concept은 정의 줄이다', () => {
  assert.equal(store.docs.get('notice_no_sms_rule_v1').summary, '문자 알림을 쓰지 않는다.');
  assert.equal(store.docs.get('concept_loan_item_v2').summary, '도서관에서 빌리거나 예약할 수 있는 것.');
});

test('분해 기록의 source와 atoms를 읽는다', () => {
  const m = store.docs.get('map_20260321_fees');
  assert.equal(m.source, 'docs/Plan_v2.md');
  assert.equal(m.atoms.length, 7);
});

test('archived는 현행이 아니다', () => {
  assert.equal(store.docs.get('loan_limit_decision_v2').live, false);
  assert.equal(store.docs.get('loan_fee_values_rnd_v1').live, true);
});

test('표식이 있는 저장소만 찾는다', () => {
  const p = copyProject((d) => {
    write(d, 'other/_jit_manifest.json', '[]');
    write(d, 'bad/_jit_manifest.json', '{ 깨짐');
    write(d, 'node_modules/x/_jit_manifest.json', '{"schema":"atomic-decomposition/v1"}');
  });
  assert.deepEqual(findStores(p), [path.join(p, 'docs', 'atomic')]);
});

test('[Review Focus 4] 깨진 파일은 문제로 보고하고 나머지를 읽는다', () => {
  const p = copyProject((d) => {
    write(d, ATOMS + 'rules/zz_broken_rule_v1.md', '# 프론트매터 없음\n');
    write(d, ATOMS + 'rules/zz_noname_rule_v1.md', '---\ntitle: "이름 없음"\n---\n\n# x\n');
    write(d, ATOMS + 'rules/zz_copy_rule_v1.md', read(d, ATOMS + 'rules/notice_time_rule_v1.md').replace('알림 시각은', '겹친 알림 시각은'));
  });
  const s = loadStore(rootOf(p));
  assert.deepEqual(s.problems.map((x) => x.code).sort(), ['dup-name', 'no-frontmatter', 'no-name']);
  assert.equal(s.atoms.length, 13);
  assert.match(s.docs.get('notice_time_rule_v1').title, /^알림 시각은/);
});
