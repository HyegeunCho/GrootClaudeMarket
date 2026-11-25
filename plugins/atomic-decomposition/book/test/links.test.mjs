import test from 'node:test';
import assert from 'node:assert/strict';
import { splitCode, mapOutsideCode, outsideCode, relLink, rewriteOriginal, findLinks } from '../lib/links.mjs';
import { originalFingerprint } from '../lib/check.mjs';

const up = (s) => mapOutsideCode(s, (x) => x.toUpperCase());

test('백틱과 울타리 안은 건드리지 않는다', () => {
  assert.equal(up('a `b` c\n```js\nd\n```\ne'), 'A `b` C\n```js\nd\n```\nE');
  assert.equal(up('a ``b ` c`` d'), 'A ``b ` c`` D');
  assert.equal(up('~~~\na\n~~~\nb'), '~~~\na\n~~~\nB');
});

test('다 합치면 원래 글이다', () => {
  const s = '# 제목\n\n> ```\n> x\n> ```\n\n`a` b ``c`` `d\n';
  assert.equal(splitCode(s).map((p) => p.text).join(''), s);
});

test('닫히지 않은 울타리는 끝까지 코드다', () => {
  assert.equal(up('a\n```\nb\n'), 'A\n```\nb\n');
});

test('코드를 뺀 조각끼리 붙어 새 숫자가 생기지 않는다', () => {
  assert.equal(outsideCode('3`x`5'), '3 5');
});

test('상대 경로를 만들고 공백·한글·괄호를 인코딩한다', () => {
  assert.equal(relLink('chapters/loan/a.md', 'appendix/atoms/x.md'), '../../appendix/atoms/x.md');
  assert.equal(relLink('chapters/loan/a.md', 'chapters/loan/b.md', 'x_v1'), 'b.md#x_v1');
  assert.equal(relLink('a/b.md', 'a/b.md', 'x_v1'), '#x_v1');
  assert.equal(relLink('a/b.md', 'assets/내 그림 (1).png'), '../assets/%EB%82%B4%20%EA%B7%B8%EB%A6%BC%20%281%29.png');
});

const opt = {
  fromFile: 'appendix/context/p.md',
  resolveWiki: (n) => (n === 'in_v1' ? { file: 'appendix/atoms/in_v1.md' } : null),
  resolvePath: (p) => (p === 'docs/in.md' || p === '안내문 프롬프트 (초안).md' ? { file: 'appendix/context/in.md' } : null),
  copyAsset: (p) => (p === 'img/map.png' ? 'assets/ab-map.png' : null),
};
const rw = (s) => rewriteOriginal(s, opt);

test('책 안으로 가는 링크는 책 페이지로 바꾼다', () => {
  assert.equal(rw('[글](docs/in.md)'), '[글](in.md)');
  assert.equal(rw('[글](docs/in.md#절 "설명")'), '[글](in.md)');
  assert.equal(rw('[초안](<안내문 프롬프트 (초안).md>)'), '[초안](in.md)');
  assert.equal(rw('[초안](%EC%95%88%EB%82%B4%EB%AC%B8%20%ED%94%84%EB%A1%AC%ED%94%84%ED%8A%B8%20%28%EC%B4%88%EC%95%88%29.md)'), '[초안](in.md)');
  assert.equal(rw('[[in_v1]]'), '[in_v1](../atoms/in_v1.md)');
  assert.equal(rw('[[in_v1|이름]]'), '[이름](../atoms/in_v1.md)');
});

test('책에 없는 상대 경로와 절대 경로, 위험한 주소는 글자만 남긴다', () => {
  for (const d of ['../x/y.cs', 'C:\\Users\\me\\a.md', 'c:/a.md', '/Users/me/a.md', '\\\\srv\\a.md', 'file:///c:/a.md', 'javascript:alert(1)', '#절', '//srv/a']) {
    assert.equal(rw(`앞 [글](${d}) 뒤`), '앞 글 뒤', d);
  }
  assert.equal(rw('![그림](없음.png)'), '그림');
  assert.equal(rw('[[out_v1]]'), '[[out_v1]]');
});

test('웹 주소와 메일은 그대로 둔다', () => {
  for (const s of ['[글](https://a.b/c_(d))', '<https://a.b>', '[메일](mailto:a@b.c)', '![](https://a.b/c.png)']) assert.equal(rw(s), s);
});

test('링크 글에 코드나 대괄호가 있어도 바꾼다', () => {
  assert.equal(rw('[`Battle.cs`](../x/Battle.cs)'), '`Battle.cs`');
  assert.equal(rw('[[보류] 글](docs/in.md)'), '[[보류] 글](in.md)');
  assert.equal(rw('[a [b] c](../x.md)'), 'a [b] c');
});

test('그림은 복사한 파일을 가리킨다', () => {
  assert.equal(rw('![지도](img/map.png)'), '![지도](../../assets/ab-map.png)');
  assert.equal(rw('<img src="img/map.png" width="10">'), '<img src="../../assets/ab-map.png" width="10">');
  assert.equal(rw('<img src="C:\\a.png">'), '<img src="">');
  assert.equal(rw('<a href="/Users/a.md">x</a>'), '<a>x</a>');
});

test('[Review Focus 3] 코드와 이스케이프한 대괄호는 건드리지 않는다', () => {
  for (const s of ['`[[in_v1]]`', '```\n[x](C:\\a)\n```', '`[x](C:\\temp)`', '\\[x](y)', '<!-- rg "\\[\\[in_v1\\]\\]" -->']) assert.equal(rw(s), s);
});

test('참조 정의의 로컬 경로도 남기지 않는다', () => {
  assert.equal(rw('[글][a]\n\n[a]: C:\\x.md'), '[글][a]\n\n\\[a]: C:\\x.md');
  assert.equal(rw('[글][a]\n\n[a]: docs/in.md'), '[글][a]\n\n[a]: in.md');
  assert.equal(rw('[a]: https://x.y'), '[a]: https://x.y');
});

test('링크 표기를 걷어내면 원문과 같다', () => {
  for (const s of ['[글](docs/in.md)와 [[in_v1]]', '[[out_v1]]', '![지도](img/map.png)', '<img src="img/map.png">', '<a href="/x">x</a>', '[a]: C:\\x.md', '[`c`](../x.cs)']) assert.equal(originalFingerprint(rw(s)), originalFingerprint(s), s);
  assert.notEqual(originalFingerprint('값은 3이다'), originalFingerprint('값은 4다'));
});

test('글에서 링크를 찾는다', () => {
  assert.deepEqual(findLinks('[a](x.md#y) ![b](c.png) `[d](e)` [f](https://g) <img src="h.png"> [i]: j.md').map((l) => l.dest), ['x.md#y', 'c.png', 'https://g', 'h.png']);
  assert.deepEqual(findLinks('[i]: j.md').map((l) => l.dest), ['j.md']);
});
