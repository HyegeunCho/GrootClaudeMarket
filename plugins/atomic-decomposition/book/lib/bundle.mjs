// 장마다 편집에 쓸 원문을 발췌하고, 그 장을 다시 써야 하는지 판단한다.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readText } from './fsutil.mjs';
import { outsideCode } from './links.mjs';
import { BACKGROUND } from './bookfile.mjs';

const KEEP = ['Why', 'Rule', 'Exceptions', 'Invalidation'];
const NO_EXCEPTION = /^[-*\s]*(없음|해당 없음|none)?[.\s]*$/i;
const OPEN = /\[(확인 필요|보류)/;

export const hash = (text) => crypto.createHash('sha256').update(text).digest('hex');
/** 발췌의 해시. 부·장 제목이 든 첫 줄은 빼서, 제목만 바꿔도 다시 쓰지 않게 한다. */
export const bundleHash = (text) => hash(text.slice(text.indexOf('\n') + 1));
export const manuscriptFile = (bookDir, key) => path.join(bookDir, 'manuscript', `${key}.md`);
export const hasException = (doc) => {
  const s = doc.sections.find((x) => x.key === 'Exceptions');
  return Boolean(s) && !NO_EXCEPTION.test(s.text);
};

const block = (s) => `## ${s.heading}\n${s.text}`;
const withoutTitle = (head) => head.replace(/^#\s.*(\n|$)/, '').trim();

/** 편집에 쓰는 핵심 섹션. 구현 지침·관계·담당자는 뺀다. */
export function keptText(doc) {
  if (doc.kind === 'layer') {
    const keep = doc.sections.filter((s) => (doc.layer === '0' ? s.key !== '소속' : ['목적', '범위'].includes(s.key)));
    return [`# ${doc.title}`, doc.layer === '0' ? withoutTitle(doc.head) : '', ...keep.map(block)].filter(Boolean).join('\n\n');
  }
  if (doc.type === 'concept') {
    return [`# ${doc.title}`, withoutTitle(doc.head), ...doc.sections.filter((s) => s.key !== 'Relations').map(block)].filter(Boolean).join('\n\n');
  }
  return [`# ${doc.title}`, `**한 문장 요약**: ${doc.summary}`, ...doc.sections.filter((s) => KEEP.includes(s.key)).map(block)].join('\n\n');
}

/** 본문에서 아직 정해지지 않았다고 적은 줄. */
export const openLines = (doc) => doc.body.split('\n').filter((l) => OPEN.test(outsideCode(l)));

const known = (names, ctx) => (names ?? []).map((n) => ctx.store.docs.get(n)).filter(Boolean);

function previousOf(docs, ctx) {
  const out = [];
  for (const d of docs) for (const p of ctx.lineage.thread(d.name).slice(0, -1)) if (!out.includes(p)) out.push(p);
  return out;
}

export function chapterSources({ part, chapter }, ctx) {
  const current = known(chapter.atoms, ctx);
  return {
    current,
    previous: previousOf(current, ctx),
    layers: known(chapter.layers, ctx),
    context: part.id === BACKGROUND ? ctx.context.filter((c) => (chapter.context ?? []).includes(c.id)) : [],
  };
}

function sourceText(section, ctx, ofDoc) {
  const atoms = known(section.atoms, ctx);
  const context = ctx.context.filter((c) => (section.context ?? []).includes(c.id));
  return [
    ...[...previousOf(atoms, ctx), ...atoms, ...known(section.layers, ctx)].map(ofDoc),
    ...context.flatMap((c) => [c.title, ...c.versions.flatMap((v) => [v.label, v.text])]),
  ].join('\n\n');
}

/** 검사에 쓰는 절의 원문 전문. 이력 전체를 포함한다. */
export const sectionSources = (section, ctx) => sourceText(section, ctx, (d) => d.text);
/** 숫자를 견줄 원문. 프론트매터의 layer 같은 숫자는 결정의 내용이 아니므로 날짜만 남긴다. */
export const sectionNumbers = (section, ctx) => sourceText(section, ctx, (d) => [d.title, d.decided, d.created, d.body].join('\n'));

/** 장 전체를 한 절로 본 것. 도입과 미정 절을 검사할 때 쓴다. */
export const wholeChapter = ({ part, chapter }) => ({ atoms: chapter.atoms, layers: chapter.layers, context: part.id === BACKGROUND ? chapter.context : [] });

const RELATION = [['requires', '전제'], ['derives_from', '근거'], ['affects', '영향']];

function atomBlock(doc, ctx) {
  const thread = ctx.lineage.thread(doc.name);
  const facts = [`종류 ${doc.type}`, `상태 ${doc.status}`, `날짜 ${doc.date}`, `Layer ${doc.layer}`];
  if (hasException(doc)) facts.push('예외 있음');
  const rel = RELATION.map(([r, label]) => {
    const names = doc.relations[r].filter((n) => ctx.store.docs.has(n));
    return names.length ? `${label}: ${names.join(', ')}` : '';
  }).filter(Boolean);
  const kept = keptText(doc);
  const open = openLines(doc).filter((l) => !kept.includes(l.trim()));
  const out = [`=== 현행: ${doc.name}`, facts.join(' · ')];
  if (rel.length) out.push(rel.join(' / '));
  if (thread.length > 1) out.push(`이력(${thread.length}건): ${thread.map((d) => `${d.name} (${d.date})`).join(' → ')}`);
  out.push('', kept, '');
  if (open.length) out.push('## 다른 섹션의 미정 (아직 정해지지 않은 것에만 쓴다)', ...open, '');
  for (const p of thread.slice(0, -1)) out.push(`--- 이전: ${p.name} (${p.date}) — ${doc.name}의 이력`, '', keptText(p), '');
  return out.join('\n');
}

export function renderBundle(entry, ctx) {
  const { part, chapter, key } = entry;
  const src = chapterSources(entry, ctx);
  const out = [`장 원문 발췌: ${part.title} / ${chapter.title} (${key})`, ''];
  for (const l of src.layers) out.push(`=== Layer 문서: ${l.name}`, '', keptText(l), '');
  for (const d of src.current) out.push(atomBlock(d, ctx));
  for (const c of src.context) {
    const many = c.versions.length > 1;
    for (const v of c.versions) out.push(`=== 컨텍스트 문서: ${c.id}${v.label ? ` ${v.label}` : ''}${many ? (v.current ? ' (현행)' : ' (이전)') : ''} — ${c.title}`, '', v.text.trim(), '');
  }
  return out.join('\n');
}

export function chapterStatus(entry, ctx) {
  const file = manuscriptFile(ctx.bookDir, entry.key);
  if (!fs.existsSync(file)) return 'write';
  const s = ctx.state.chapters[entry.key];
  const now = bundleHash(renderBundle(entry, ctx));
  if (s?.bundleHash !== now) return 'rewrite';
  if (s.review?.bundleHash !== now || s.review.manuscriptHash !== hash(readText(file))) return 'review';
  return s.review.unresolved.length ? 'unresolved' : 'done';
}

/** 두 글의 달라진 줄. 빠진 줄은 `- `, 새 줄은 `+ `로 시작한다. */
export function diffLines(before, after) {
  const a = before.split('\n');
  const b = after.split('\n');
  const len = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) len[i][j] = a[i] === b[j] ? len[i + 1][j + 1] + 1 : Math.max(len[i + 1][j], len[i][j + 1]);
  const out = [];
  let heading = '';
  let shown = '';
  const add = (line) => {
    if (heading && heading !== shown) { out.push('', heading); shown = heading; }
    out.push(line);
  };
  for (let i = 0, j = 0; i < a.length || j < b.length;) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      if (/^(===|---) /.test(b[j])) heading = b[j];
      i++;
      j++;
    } else if (j >= b.length || (i < a.length && len[i + 1][j] >= len[i][j + 1])) add(`- ${a[i++]}`);
    else add(`+ ${b[j++]}`);
  }
  return out.join('\n').trim() + '\n';
}
