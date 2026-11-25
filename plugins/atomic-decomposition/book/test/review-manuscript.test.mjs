// 최종 검토 뒤 찾은 것: 원고 속 괄호 글
import test from 'node:test';
import assert from 'node:assert/strict';
import { read } from './util.mjs';
import { makeBook, MANUSCRIPTS, LIMITS } from './samplebook.mjs';
import { openBook } from '../lib/bookfile.mjs';
import { buildMd } from '../lib/build-md.mjs';
import { checkBuilt } from '../lib/check.mjs';

test('원고의 이름 링크나 대괄호 이름 뒤에 괄호 글이 와도 잃지 않는다', () => {
  const text = LIMITS.replace('모았다.', '모았다. [[loan_return_rule_v2]](반납)과 [이름표](가칭)과 [항목]([[notice_feedback_v1]]).');
  assert.notEqual(text, LIMITS);
  const b = makeBook({ manuscripts: { ...MANUSCRIPTS, 'loan/limits': text } });
  buildMd(openBook(b.dir));
  const line = read(b.project, 'docs/atomic-book/md/chapters/loan/limits.md').split('\n').find((l) => l.includes('모았다.'));
  assert.ok(line.includes('(#loan_return_rule_v2)(반납)과'), line);
  assert.ok(line.includes('\\[이름표\\](가칭)과'), line);
  assert.ok(line.includes('\\[항목\\]([알림 시험') && line.includes('#notice_feedback_v1))'), line);
  assert.deepEqual(checkBuilt(openBook(b.dir)).filter((f) => f.level === 'error'), []);
});
