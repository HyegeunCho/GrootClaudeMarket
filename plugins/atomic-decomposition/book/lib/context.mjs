// 컨텍스트 문서(기획서·지침·프롬프트·참고 자료)를 찾고 읽는다.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readText, toPosix, walkFiles } from './fsutil.mjs';
import { SKIP_DIRS } from './store.mjs';

export const TEXT_EXT = ['.md', '.txt'];
export const CODE_EXT = ['.json', '.yaml', '.yml', '.csv'];
const OTHER_EXT = ['.docx', '.doc', '.pdf', '.hwp', '.hwpx', '.pptx', '.ppt', '.xlsx', '.xls'];
const KEYWORD = /기획|스펙|명세|계획|지침|프롬프트|plan|spec|guide|prompt/i;
const ROOT_DOCS = ['CLAUDE.md', 'AGENTS.md', 'README.md'];

function kindOf(base) {
  if (/todo|review|리뷰/i.test(base)) return 'reference';
  if (/prompt|프롬프트/i.test(base)) return 'prompt';
  if (/^(CLAUDE|AGENTS)$/.test(base) || /지침|guide/i.test(base)) return 'guide';
  if (/plan|spec|기획|스펙|명세|계획/i.test(base)) return 'plan';
  return 'reference';
}

export const defaultMode = (kind) => (kind === 'plan' || kind === 'guide' ? 'edit' : 'appendix');

const splitVersion = (base) => {
  const m = base.match(/^(.*?)[_-]v(\d+)$/i);
  return m ? { stem: m[1], version: Number(m[2]) } : { stem: base, version: null };
};

function slug(stem, seed) {
  const s = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return /[^\x00-\x7F]/.test(stem) || !s ? `doc-${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 8)}` : s;
}

export const inside = (file, dir) => { const r = path.relative(dir, file); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };

/** 프로젝트 문서. 저장소와 이미 만든 책 안의 것은 뺀다. */
function projectFiles(projectRoot, storeRoot, exts) {
  const files = walkFiles(projectRoot, SKIP_DIRS);
  const bookDirs = files
    .filter((f) => path.basename(f) === 'book.json')
    .filter((f) => { try { return JSON.parse(readText(f)).schema === 'atomic-book/v1'; } catch { return false; } })
    .map((f) => path.dirname(f));
  return files
    .filter((f) => exts.includes(path.extname(f).toLowerCase()))
    .filter((f) => !inside(f, storeRoot) && !bookDirs.some((d) => inside(f, d)))
    .map((f) => ({ file: f, rel: toPosix(path.relative(projectRoot, f)), base: path.basename(f, path.extname(f)), ext: path.extname(f).toLowerCase() }));
}

/** 저장소 문서가 언급한 파일을 센다. 경로가 맞거나, 이름이 하나뿐이면 같은 파일로 본다. */
function countMentions(store, files) {
  const counts = new Map();
  const byName = new Map();
  for (const f of files) {
    const n = path.posix.basename(f.rel);
    byName.set(n, byName.has(n) ? null : f);
  }
  const byRel = new Map(files.map((f) => [f.rel, f]));
  for (const doc of store.docs.values()) {
    for (const m of doc.text.matchAll(/[^\s`"'()<>[\]|,]+\.(?:md|txt|json|ya?ml|csv|docx?|pdf|hwpx?|pptx?|xlsx?)\b/gi)) {
      const p = toPosix(m[0]).replace(/^(\.\.?\/)+/, '');
      const hit = byRel.get(p) ?? files.find((f) => p.includes('/') && f.rel.endsWith('/' + p)) ?? byName.get(path.posix.basename(p));
      if (hit) counts.set(hit.rel, (counts.get(hit.rel) ?? 0) + 1);
    }
  }
  return counts;
}

/** 이름 끝의 버전만 다른 문서를 묶는다. 같은 버전이 여럿이면(사본) 폴더마다 따로 묶는다. */
function groupVersions(files) {
  const collect = (list, keyOf) => {
    const groups = new Map();
    for (const f of list) {
      const key = f.version === null ? f.rel : keyOf(f);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(f);
    }
    return [...groups.values()];
  };
  const items = files.map((f) => ({ ...f, ...splitVersion(f.base) }));
  const byStem = (f) => `${f.stem}|${f.ext}`;
  return collect(items, byStem).flatMap((g) => {
    if (new Set(g.map((f) => f.version)).size === g.length) return [g];
    return collect(g, (f) => `${path.posix.dirname(f.rel)}|${byStem(f)}`);
  });
}

const plainTitle = (s) => s.replace(/\\([\\`*_{}[\]()#+\-.!~|<>])/g, '$1').replace(/[`*]/g, '').trim();

export function findCandidates(store, projectRoot) {
  const files = projectFiles(projectRoot, store.root, [...TEXT_EXT, ...CODE_EXT]);
  const mentions = countMentions(store, files);
  const near = path.dirname(store.root);
  const wanted = (f) =>
    (TEXT_EXT.includes(f.ext) && mentions.has(f.rel)) ||
    ROOT_DOCS.includes(f.rel) ||
    (KEYWORD.test(f.base) && (inside(f.file, near) || mentions.has(f.rel)));
  const used = new Set();
  const out = [];
  for (const g of groupVersions(files)) {
    if (!g.some(wanted)) continue;
    g.sort((a, b) => (a.version ?? 0) - (b.version ?? 0));
    const last = g.at(-1);
    const texts = g.map((f) => readText(f.file));
    const kind = kindOf(last.base);
    const base = slug(last.stem, last.rel);
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    const title = texts.at(-1).match(/^#\s+(.+)$/m)?.[1];
    out.push({
      id,
      title: title ? plainTitle(title) : last.base,
      kind,
      mode: defaultMode(kind),
      chars: texts.reduce((n, t) => n + t.length, 0),
      mentions: g.reduce((n, f) => n + (mentions.get(f.rel) ?? 0), 0),
      versions: g.map((f) => ({ ...(f.version === null ? {} : { label: `v${f.version}` }), path: f.rel })),
    });
  }
  return out.sort((a, b) => b.mentions - a.mentions || (a.id < b.id ? -1 : 1));
}

/** 컨텍스트 문서로 보이지만 실을 수 없는 형식의 파일. */
export function findUnsupported(store, projectRoot) {
  const files = projectFiles(projectRoot, store.root, OTHER_EXT);
  const mentions = countMentions(store, files);
  const near = path.dirname(store.root);
  return files.filter((f) => mentions.has(f.rel) || (KEYWORD.test(f.base) && inside(f.file, near))).map((f) => f.rel);
}

export function loadContext(book, bookDir) {
  const docs = [];
  const problems = [];
  for (const c of book.context ?? []) {
    const versions = [];
    for (const [i, v] of c.versions.entries()) {
      const file = path.resolve(bookDir, v.path);
      const ext = path.extname(file).toLowerCase();
      const report = (code, message) => problems.push({ code, file: v.path, message });
      if (![...TEXT_EXT, ...CODE_EXT].includes(ext)) { report('context-unsupported', `실을 수 없는 형식입니다 (${ext || '확장자 없음'})`); continue; }
      if (!fs.existsSync(file)) { report('context-missing', '파일이 없습니다'); continue; }
      const label = v.label ?? '';
      versions.push({ label, name: `context_${c.id}${label ? `_${label}` : ''}`, file, ext, text: readText(file), current: i === c.versions.length - 1 });
    }
    if (versions.length) docs.push({ id: c.id, title: c.title, kind: c.kind, mode: c.mode ?? defaultMode(c.kind), versions });
  }
  return { docs, problems };
}
