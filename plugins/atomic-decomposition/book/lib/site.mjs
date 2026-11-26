// 책의 어느 이름이 어느 페이지에 있는지 정한다.
import fs from 'node:fs';
import path from 'node:path';
import { readText } from './fsutil.mjs';
import { parseFrontmatter } from './store.mjs';
import { chapters, chapterRef, titles, OPENING } from './bookfile.mjs';
import { manuscriptFile } from './bundle.mjs';
import { parseManuscript } from './manuscript.mjs';
import { layerName } from './layers.mjs';

/** 부록 원문의 폴더. 순서는 정렬에만 쓴다. 차례(SUMMARY)는 Layer별로 따로 짠다. */
export const GROUPS = ['context', 'layers', 'atoms', 'history', 'maps'];

const STATUS = { draft: '초안', pending: '검증 중', approved: '승인', active: '시행', archived: '폐기' };
export const statusLabel = (s) => (STATUS[s] ? `${STATUS[s]}(${s})` : s || '상태 없음');
export const versionLabel = (name) => { const m = name.match(/_v(\d+)$/); return m ? `v${m[1]}` : ''; };
const withVersion = (title, v) => (v ? `${title} (${v})` : title);
const safe = (name) => name.replace(/[\\/:*?"<>|\s]/g, '-');
const fileKey = (f) => (process.platform === 'win32' ? path.resolve(f).toLowerCase() : path.resolve(f));

const TEXT_AS_MD = new Set(['.md', '.txt']);
const LANG = { '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.csv': 'csv' };

function atomGroup(doc) {
  if (doc.kind === 'layer') return 'layers';
  if (doc.kind === 'map') return 'maps';
  return doc.live ? 'atoms' : 'history';
}

/** 부록에 실을 원문 목록. */
function collectOriginals(ctx) {
  const out = [];
  for (const doc of ctx.store.docs.values()) {
    const group = atomGroup(doc);
    out.push({
      name: doc.name, group, file: `appendix/${group}/${safe(doc.name)}.md`,
      title: doc.kind === 'atom' ? withVersion(doc.title, versionLabel(doc.name)) : doc.title,
      note: [doc.status ? statusLabel(doc.status) : '', doc.date].filter(Boolean).join(' · '),
      date: doc.date, source: doc.file, raw: doc.raw, body: doc.body, code: null, doc,
    });
  }
  for (const c of ctx.context) {
    for (const v of c.versions) {
      const group = v.current ? 'context' : 'history';
      const isMd = TEXT_AS_MD.has(v.ext);
      const { raw, body } = isMd ? parseFrontmatter(v.text) : { raw: null, body: v.text };
      out.push({
        name: v.name, group, file: `appendix/${group}/${safe(v.name)}.md`, title: withVersion(c.title, v.label),
        note: v.current ? '' : '이전 판', date: '', source: v.file, raw, body, code: isMd ? null : LANG[v.ext] ?? 'text', contextId: c.id, label: v.label,
      });
    }
  }
  const rank = Object.fromEntries(GROUPS.map((g, i) => [g, i]));
  return out.sort((a, b) => rank[a.group] - rank[b.group] || (a.group === 'maps' ? (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) : 0) || (a.name < b.name ? -1 : 1));
}

const readManuscript = (ctx, key) => {
  const f = manuscriptFile(ctx.bookDir, key);
  return fs.existsSync(f) ? parseManuscript(readText(f)) : null;
};

/** 절마다 앵커를 정한다. 절의 첫 표식 이름을 쓰고, 그 장에서 이미 쓴 이름이면 다음 이름이나 번호를 붙인다. */
function anchorSections(manuscript) {
  const used = new Set();
  for (const s of manuscript.sections) {
    const names = [...s.atoms, ...s.layers, ...s.context];
    if (!names.length) continue;
    let anchor = names.find((n) => !used.has(n));
    for (let k = 2; !anchor; k++) if (!used.has(`${names[0]}-${k}`)) anchor = `${names[0]}-${k}`;
    used.add(anchor);
    s.anchor = anchor;
  }
}

export function planSite(ctx) {
  const t = titles(ctx.book);
  const originals = collectOriginals(ctx);
  const original = new Map(originals.map((o) => [o.name, o]));
  const bySource = new Map(originals.map((o) => [fileKey(o.source), o]));
  const sections = new Map();
  const cites = new Map();
  const chapterPages = [];
  for (const entry of chapters(ctx.book)) {
    const file = `chapters/${entry.key}.md`;
    const manuscript = readManuscript(ctx, entry.key);
    const page = { ...entry, file, title: t.chapter.get(entry.key), partTitle: t.part.get(entry.part.id), manuscript };
    const put = (name, anchor) => {
      if (!sections.has(name)) sections.set(name, { file, anchor });
      if (!cites.has(name)) cites.set(name, []);
      const list = cites.get(name);
      if (!list.some((x) => x.page === page)) list.push({ page, anchor });
    };
    if (manuscript) {
      anchorSections(manuscript);
      for (const s of manuscript.sections) for (const n of [...s.atoms, ...s.layers, ...s.context]) put(n, s.anchor);
    } else {
      for (const n of [...(entry.chapter.atoms ?? []), ...(entry.chapter.context ?? [])]) put(n, n);
    }
    chapterPages.push(page);
  }
  const contextTitle = new Map(ctx.context.map((c) => [c.id, c.title]));
  const currentContext = new Map(ctx.context.map((c) => [c.id, c.versions.at(-1).name]));
  const originalOf = (name) => original.get(currentContext.get(name) ?? name) ?? null;
  const titleOf = (name) => ctx.store.docs.get(name)?.title ?? contextTitle.get(name) ?? name;
  const labels = ctx.book.labels ?? {};
  /** 사람이 읽는 짧은 이름. book.json의 labels가 먼저이고, 없으면 제목이다. */
  const labelOf = (name) => {
    if (labels[name]) return labels[name].trim();
    const d = ctx.store.docs.get(name);
    return d?.kind === 'layer' ? layerName(d.title) : titleOf(name);
  };
  const pageOf = new Map(chapterPages.map((p) => [p.key, p]));
  return {
    originals,
    chapterPages,
    opening: readManuscript(ctx, OPENING),
    titles: t,
    sectionOf: (name) => sections.get(name) ?? null,
    /** 이 이름을 원문 표식으로 쓴 장들. 책 순서대로. */
    chaptersOf: (name) => cites.get(name) ?? [],
    originalOf,
    originalOfFile: (file) => bySource.get(fileKey(file)) ?? null,
    /** 본문의 절이 있으면 절, 없으면 부록 원문 */
    placeOf: (name) => sections.get(name) ?? (originalOf(name) ? { file: originalOf(name).file } : null),
    /** `[[부/장]]`이 가리키는 장 페이지 */
    chapterOf: (name) => { const e = chapterRef(ctx.book, name); return e ? pageOf.get(e.key) : null; },
    titleOf,
    labelOf,
  };
}
