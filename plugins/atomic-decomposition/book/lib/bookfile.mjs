// book.json(목차)과 book.state.json(장별 진행 상태)을 읽고 쓰고 검사한다.
import fs from 'node:fs';
import path from 'node:path';
import { readText, writeText } from './fsutil.mjs';
import { loadStore } from './store.mjs';
import { buildLineage, buildRelations } from './lineage.mjs';
import { inside, loadContext } from './context.mjs';

export const BOOK_SCHEMA = 'atomic-book/v1';
export const STATE_SCHEMA = 'atomic-book-state/v1';
export const BACKGROUND = 'background';
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

/** 목차가 저장소를 빠짐없이 한 번씩 담는지 본다. */
export function validateOutline(book, store, context) {
  const lineage = buildLineage(store);
  const seen = new Map();
  const archived = new Set();
  const unknown = new Set();
  const problems = [];
  const keys = new Set();
  const contextIds = new Set(context.map((c) => c.id));
  const edited = new Map();
  const place = (name) => {
    seen.set(name, (seen.get(name) ?? 0) + 1);
    if (store.docs.get(name)?.kind !== 'atom') unknown.add(name);
  };
  if (!book.title) problems.push('책 제목이 없습니다');
  for (const part of book.parts ?? []) if (!part.title) problems.push(`부 제목이 없습니다: ${part.id}`);
  for (const { part, chapter, key } of chapters(book)) {
    if (!chapter.title) problems.push(`장 제목이 없습니다: ${key}`);
    if (!ID.test(part.id ?? '') || !ID.test(chapter.id ?? '')) problems.push(`id는 영문 소문자·숫자·-만 씁니다: ${key}`);
    if (keys.has(key)) problems.push(`장이 겹칩니다: ${key}`);
    keys.add(key);
    for (const n of chapter.atoms ?? []) {
      place(n);
      if (store.docs.get(n) && !store.docs.get(n).live) archived.add(n);
    }
    for (const n of chapter.dropped ?? []) place(n);
    for (const n of chapter.layers ?? []) if (store.docs.get(n)?.kind !== 'layer') problems.push(`Layer 문서가 없습니다: ${n} (${key})`);
    for (const id of chapter.context ?? []) {
      if (!contextIds.has(id)) problems.push(`컨텍스트 문서가 없습니다: ${id} (${key})`);
      else if (part.id === BACKGROUND) edited.set(id, (edited.get(id) ?? 0) + 1);
    }
  }
  const names = context.flatMap((c) => c.versions.map((v) => v.name));
  const repeated = (list) => new Set(list.filter((x, i) => list.indexOf(x) !== i));
  for (const n of repeated(names)) problems.push(`컨텍스트 문서의 이름이 겹칩니다. 버전마다 label을 다르게 적으세요: ${n}`);
  for (const id of repeated(context.map((c) => c.id))) problems.push(`컨텍스트 문서의 id가 겹칩니다: ${id}`);
  for (const c of context) {
    const n = edited.get(c.id) ?? 0;
    if (c.mode === 'edit' && n !== 1) problems.push(`편집할 컨텍스트 문서 ${c.id}는 ${BACKGROUND} 부의 장 하나에 있어야 합니다 (지금 ${n}곳)`);
  }
  const must = [...store.atoms.filter((d) => d.live), ...lineage.orphans].map((d) => d.name);
  return {
    missing: must.filter((n) => !seen.has(n)).sort(),
    duplicate: [...seen].filter(([, n]) => n > 1).map(([n]) => n).sort(),
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
