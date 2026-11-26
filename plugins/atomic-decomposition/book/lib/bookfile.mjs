// book.json(목차)과 book.state.json(장별 진행 상태)을 읽고 쓰고 검사한다.
import fs from 'node:fs';
import path from 'node:path';
import { readText, writeText } from './fsutil.mjs';
import { loadStore } from './store.mjs';
import { buildLineage, buildRelations } from './lineage.mjs';
import { inside, loadContext } from './context.mjs';

export const BOOK_SCHEMA = 'atomic-book/v1';
export const STATE_SCHEMA = 'atomic-book-state/v1';
/** 여는 글. 장처럼 쓰고 대조하지만 표지(README.md)에 실린다. */
export const OPENING = 'opening';
export const OPENING_TITLE = '여는 글';
const ID = /^[a-z0-9][a-z0-9-]*$/;

function readJson(file, schema) {
  if (!fs.existsSync(file)) return null;
  const name = path.basename(file);
  let data;
  try { data = JSON.parse(readText(file)); } catch (e) { throw new Error(`${name}을 읽을 수 없습니다: ${e.message}`); }
  if (data?.schema !== schema) throw new Error(`${name}의 schema가 ${schema}가 아닙니다`);
  return data;
}

const toJson = (o) => JSON.stringify(o, null, 2) + '\n';

export const readBook = (dir) => readJson(path.join(dir, 'book.json'), BOOK_SCHEMA);
export const writeBook = (dir, book) => writeText(path.join(dir, 'book.json'), toJson(book));
export const readState = (dir) => readJson(path.join(dir, 'book.state.json'), STATE_SCHEMA) ?? { schema: STATE_SCHEMA, chapters: {} };
export function writeState(dir, state) {
  const sorted = Object.fromEntries(Object.entries(state.chapters).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeText(path.join(dir, 'book.state.json'), toJson({ ...state, chapters: sorted }));
}

/** 부와 장을 순서대로 내놓는다. */
export function* chapters(book) {
  for (const part of book.parts ?? []) {
    for (const chapter of part.chapters ?? []) yield { part, chapter, key: `${part.id}/${chapter.id}` };
  }
}

/** 쓰고 대조할 것 전부: 여는 글과 장. */
export function* entries(book) {
  yield { part: { id: '', title: '' }, chapter: { id: OPENING, title: OPENING_TITLE }, key: OPENING, opening: true };
  yield* chapters(book);
}

/** 책에 보이는 부·장 제목. numbering이 false가 아니면 `1부 · `, `1장. `을 붙인다. 장 번호는 책 전체에서 이어진다. */
export function titles(book) {
  const numbered = book.numbering !== false;
  const part = new Map();
  const chapter = new Map();
  let p = 0;
  let c = 0;
  for (const x of book.parts ?? []) {
    p++;
    part.set(x.id, numbered ? `${p}부 · ${x.title ?? ''}` : x.title ?? '');
    for (const ch of x.chapters ?? []) {
      c++;
      chapter.set(`${x.id}/${ch.id}`, numbered ? `${c}장. ${ch.title ?? ''}` : ch.title ?? '');
    }
  }
  return { part, chapter };
}

/** 원고의 `[[부/장]]`이나 `[[장]]`(장 id가 책에서 하나뿐일 때)이 가리키는 장. */
export function chapterRef(book, name) {
  const list = [...chapters(book)];
  const exact = list.find((e) => e.key === name);
  if (exact) return exact;
  const same = list.filter((e) => e.chapter.id === name);
  return same.length === 1 ? same[0] : null;
}

/**
 * 목차를 검사한다.
 * - 현행 결정은 어느 장의 atoms에 한 번 이상 있거나 appendixOnly에 있어야 한다. 여러 장에 나와도 된다
 * - 후속 없는 폐기는 따로 둘 곳이 없어도 부록에 실린다. 장의 dropped에 넣으면 그 장의 근거 목록에도 나온다
 */
export function validateOutline(book, store, context) {
  const placed = new Set();
  const duplicate = new Set();
  const archived = new Set();
  const unknown = new Set();
  const problems = [];
  const keys = new Set();
  const contextIds = new Set(context.map((c) => c.id));
  const used = new Map();
  const isAtom = (n) => store.docs.get(n)?.kind === 'atom';
  if (!book.title) problems.push('책 제목이 없습니다');
  for (const part of book.parts ?? []) if (!part.title) problems.push(`부 제목이 없습니다: ${part.id}`);
  for (const { part, chapter, key } of chapters(book)) {
    if (!chapter.title) problems.push(`장 제목이 없습니다: ${key}`);
    if (!ID.test(part.id ?? '') || !ID.test(chapter.id ?? '')) problems.push(`id는 영문 소문자·숫자·-만 씁니다: ${key}`);
    if (keys.has(key)) problems.push(`장이 겹칩니다: ${key}`);
    keys.add(key);
    if (chapter.lead !== undefined && typeof chapter.lead !== 'string') problems.push(`lead는 한 문장 글로 씁니다: ${key}`);
    const here = new Set();
    for (const n of chapter.atoms ?? []) {
      if (here.has(n)) duplicate.add(n);
      here.add(n);
      placed.add(n);
      if (!isAtom(n)) unknown.add(n);
      else if (!store.docs.get(n).live) archived.add(n);
    }
    for (const n of chapter.dropped ?? []) {
      if (!isAtom(n)) unknown.add(n);
      else if (store.docs.get(n).live) problems.push(`dropped에는 폐기된 결정만 둡니다: ${n} (${key})`);
    }
    for (const n of chapter.layers ?? []) if (store.docs.get(n)?.kind !== 'layer') problems.push(`Layer 문서가 없습니다: ${n} (${key})`);
    for (const id of chapter.context ?? []) {
      if (!contextIds.has(id)) problems.push(`컨텍스트 문서가 없습니다: ${id} (${key})`);
      else used.set(id, (used.get(id) ?? 0) + 1);
    }
  }
  const names = context.flatMap((c) => c.versions.map((v) => v.name));
  const repeated = (list) => new Set(list.filter((x, i) => list.indexOf(x) !== i));
  for (const n of repeated(names)) problems.push(`컨텍스트 문서의 이름이 겹칩니다. 버전마다 label을 다르게 적으세요: ${n}`);
  for (const id of repeated(context.map((c) => c.id))) problems.push(`컨텍스트 문서의 id가 겹칩니다: ${id}`);
  for (const c of context) {
    const n = used.get(c.id) ?? 0;
    if (c.mode === 'edit' && n === 0) problems.push(`편집할 컨텍스트 문서 ${c.id}가 어느 장의 context에도 없습니다`);
    if (c.mode !== 'edit' && n > 0) problems.push(`원문만 싣는 컨텍스트 문서 ${c.id}는 장의 context에 넣지 않습니다. 본문에서 가리키려면 [[${c.id}]]로 씁니다`);
  }
  const only = book.appendixOnly ?? [];
  for (const n of only) {
    if (!isAtom(n)) unknown.add(n);
    else if (placed.has(n)) duplicate.add(n);
  }
  for (const [n, label] of Object.entries(book.labels ?? {})) {
    if (!store.docs.has(n) && !contextIds.has(n)) problems.push(`labels에 저장소에 없는 이름이 있습니다: ${n}`);
    else if (typeof label !== 'string' || !label.trim()) problems.push(`labels의 이름이 비었습니다: ${n}`);
  }
  return {
    missing: store.atoms.filter((d) => d.live && !placed.has(d.name) && !only.includes(d.name)).map((d) => d.name).sort(),
    duplicate: [...duplicate].sort(),
    unknown: [...unknown].sort(),
    archived: [...archived].sort(),
    problems,
  };
}

/** 책 하나를 다루는 데 필요한 것을 모두 연다. */
export function openBook(bookDir) {
  const book = readBook(bookDir);
  if (!book) throw new Error(`book.json이 없습니다: ${bookDir}`);
  for (const [what, id] of [...(book.parts ?? []).map((p) => ['부', p.id]), ...[...chapters(book)].map((e) => ['장', e.chapter.id]), ...(book.context ?? []).map((c) => ['컨텍스트', c.id])]) {
    if (!ID.test(id ?? '')) throw new Error(`book.json의 ${what} id는 영문 소문자·숫자·-만 씁니다: ${id}`);
  }
  const root = path.resolve(bookDir, book.atomicRoot ?? '');
  if (!book.atomicRoot || !fs.existsSync(path.join(root, '_jit_manifest.json'))) throw new Error(`book.json의 atomicRoot에 저장소가 없습니다: ${book.atomicRoot}`);
  if (inside(bookDir, root)) throw new Error(`책 폴더가 저장소 안에 있습니다. 저장소 밖으로 정하세요: ${bookDir}`);
  const store = loadStore(root);
  const lineage = buildLineage(store);
  const { docs: context, problems: contextProblems } = loadContext(book, bookDir);
  return { bookDir, book, store, lineage, relations: buildRelations(store, lineage), context, contextProblems, state: readState(bookDir) };
}
