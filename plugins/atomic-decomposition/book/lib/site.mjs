// 책의 어느 이름이 어느 페이지에 있는지 정한다.
import fs from 'node:fs';
import path from 'node:path';
import { readText } from './fsutil.mjs';
import { parseFrontmatter } from './store.mjs';
import { chapters, BACKGROUND } from './bookfile.mjs';
import { manuscriptFile } from './bundle.mjs';
import { parseManuscript } from './manuscript.mjs';

export const APPENDIX = [
  ['history', '부록 A. 과거 결정 원문'],
  ['atoms', '부록 B. 현행 결정 원문'],
  ['layers', '부록 C. Layer 문서 원문'],
  ['maps', '부록 D. 분해 기록 원문'],
  ['context', '부록 E. 컨텍스트 문서 원문'],
];

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
      date: doc.date, source: doc.file, raw: doc.raw, body: doc.body, code: null,
    });
  }
  for (const c of ctx.context) {
    for (const v of c.versions) {
      const group = v.current ? 'context' : 'history';
      const isMd = TEXT_AS_MD.has(v.ext);
      const { raw, body } = isMd ? parseFrontmatter(v.text) : { raw: null, body: v.text };
      out.push({
        name: v.name, group, file: `appendix/${group}/${safe(v.name)}.md`, title: withVersion(c.title, v.label),
        note: v.current ? '' : '이전 판', date: '', source: v.file, raw, body, code: isMd ? null : LANG[v.ext] ?? 'text', contextId: c.id,
      });
    }
  }
  const rank = Object.fromEntries(APPENDIX.map(([g], i) => [g, i]));
  return out.sort((a, b) => rank[a.group] - rank[b.group] || (a.group === 'maps' ? (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) : 0) || (a.name < b.name ? -1 : 1));
}

export function planSite(ctx) {
  const originals = collectOriginals(ctx);
  const original = new Map(originals.map((o) => [o.name, o]));
  const bySource = new Map(originals.map((o) => [fileKey(o.source), o]));
  const sections = new Map();
  const chapterPages = [];
  for (const entry of chapters(ctx.book)) {
    const file = `chapters/${entry.key}.md`;
    const msFile = manuscriptFile(ctx.bookDir, entry.key);
    const manuscript = fs.existsSync(msFile) ? parseManuscript(readText(msFile)) : null;
    const put = (name, anchor) => { if (!sections.has(name)) sections.set(name, { file, anchor }); };
    if (manuscript) {
      for (const s of manuscript.sections) {
        const all = [...s.atoms, ...s.layers, ...s.context];
        for (const n of all) put(n, all[0]);
      }
    } else {
      for (const n of entry.chapter.atoms ?? []) put(n, n);
      if (entry.part.id === BACKGROUND) for (const n of [...(entry.chapter.layers ?? []), ...(entry.chapter.context ?? [])]) put(n, n);
    }
    chapterPages.push({ ...entry, file, manuscript });
  }
  const contextTitle = new Map(ctx.context.map((c) => [c.id, c.title]));
  const currentContext = new Map(ctx.context.map((c) => [c.id, c.versions.at(-1).name]));
  const originalOf = (name) => original.get(currentContext.get(name) ?? name) ?? null;
  return {
    originals,
    chapterPages,
    sectionOf: (name) => sections.get(name) ?? null,
    originalOf,
    originalOfFile: (file) => bySource.get(fileKey(file)) ?? null,
    /** 본문의 절이 있으면 절, 없으면 부록 원문 */
    placeOf: (name) => sections.get(name) ?? (originalOf(name) ? { file: originalOf(name).file } : null),
    titleOf: (name) => ctx.store.docs.get(name)?.title ?? contextTitle.get(name) ?? name,
  };
}
