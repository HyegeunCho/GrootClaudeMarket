// Layer·Atom 저장소를 읽는다. 원본에는 아무것도 쓰지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { readText, toPosix, walkFiles } from './fsutil.mjs';
import { fenceOpen } from './links.mjs';

export const SCHEMA = 'atomic-decomposition/v1';
export const RELS = ['derives_from', 'affects', 'requires', 'conflicts_with', 'is_a', 'part_of'];
export const SKIP_DIRS = ['node_modules', '.git', '.work', '.worktrees', 'worktrees', 'Library', 'Temp', 'Logs', 'build', 'dist', 'obj', 'bin'];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TAG = /^\[(MISSING|확인 필요|보류)/;

export const wikiNames = (s) => [...s.matchAll(/\[\[([^[\]\n|]+)(?:\|[^[\]\n]+)?\]\]/g)].map((m) => m[1].trim());

function scalar(raw) {
  const s = raw.trim();
  const q = s[0];
  if (q === '"' || q === "'") {
    const end = s.indexOf(q, 1);
    if (end > 0) return s.slice(1, end);
  }
  const value = s.replace(/(^|\s+)#.*$/, '').trim();
  if (value.startsWith('[[')) return wikiNames(value);
  if (value.startsWith('[') && value.endsWith(']') && !TAG.test(value)) {
    return value.slice(1, -1).split(',').flatMap((x) => scalar(x.trim().replace(/^\[+|\]+$/g, ''))).filter((x) => x !== '');
  }
  return value;
}

/** 이 플러그인이 쓰는 YAML만 읽는다: 스칼라, 따옴표, 줄 끝 주석, 목록, 접은 글. 읽지 못한 줄은 bad에 모은다. */
export function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!m) return { data: {}, body: text, raw: null, bad: [] };
  const data = {};
  const bad = [];
  let key = null;
  let folding = false;
  for (const line of m[1].split('\n')) {
    if (folding && /^\s+\S/.test(line)) { data[key] = `${data[key]} ${line.trim()}`.trim(); continue; }
    if (/^\s*(#.*)?$/.test(line)) continue;
    const kv = line.match(/^([A-Za-z_][\w-]*):(?:\s+(.*)|)$/);
    const item = line.match(/^\s*-\s+(.*)$/);
    if (kv) {
      key = kv[1];
      folding = /^[|>][-+]?$/.test((kv[2] ?? '').trim());
      data[key] = folding ? '' : scalar(kv[2] ?? '');
    } else if (item && key) {
      if (!Array.isArray(data[key])) data[key] = [];
      data[key].push(...[scalar(item[1])].flat());
    } else bad.push(line.trim());
  }
  return { data, body: text.slice(m[0].length), raw: m[1], bad };
}

/** 본문을 `## ` 섹션으로 나눈다. 코드 블록 안의 `## `는 제목이 아니다. key는 제목의 첫 낱말이다. */
export function splitSections(body) {
  let fence = null;
  let current = null;
  const head = [];
  const sections = [];
  for (const line of body.split('\n')) {
    const closes = fence && line.match(/^\s*(?:>\s?)*\s*(`{3,}|~{3,})\s*$/);
    if (closes && closes[1][0] === fence[0] && closes[1].length >= fence.length) fence = null;
    else if (!fence && fenceOpen(line)) fence = fenceOpen(line);
    else if (!fence && line.startsWith('## ')) {
      const heading = line.slice(3).trim();
      current = { heading, key: heading.match(/^(?:[A-Za-z]+|[^\s(（:]+)/)?.[0] ?? '', lines: [] };
      sections.push(current);
      continue;
    }
    (current ? current.lines : head).push(line);
  }
  return {
    head: head.join('\n').trim(),
    sections: sections.map(({ heading, key, lines }) => ({ heading, key, text: lines.join('\n').trim() })),
  };
}

const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []).map(String);

function readRelations(data, sections) {
  const rel = Object.fromEntries(RELS.map((r) => [r, []]));
  const add = (r, name) => { if (name && !rel[r].includes(name)) rel[r].push(name); };
  for (const r of RELS) for (const v of asList(data[r])) add(r, wikiNames(v)[0] ?? v);
  const body = sections.find((s) => s.key === 'Relations')?.text ?? '';
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*-\s*([a-z_]+)\s*:(.*)$/);
    if (m && RELS.includes(m[1])) for (const n of wikiNames(m[2])) add(m[1], n);
  }
  return rel;
}

function readSummary(type, head) {
  const m = type === 'concept'
    ? head.match(/^-\s*\*\*Definition[^*]*\*\*\s*:\s*(.*)$/m)
    : head.match(/^\*\*한 문장 요약\*\*\s*:\s*(.*)$/m);
  return m ? m[1].trim() : '';
}

function makeDoc(file, root, kind) {
  const text = readText(file);
  const { data, body, raw, bad } = parseFrontmatter(text);
  const { head, sections } = splitSections(body);
  const str = (k) => (typeof data[k] === 'string' ? data[k] : '');
  const status = str('status');
  return {
    kind, file, rel: toPosix(path.relative(root, file)), text, body, data, raw, bad, head, sections, status,
    name: str('name'),
    title: str('title') || str('name'),
    type: str('type'),
    layer: str('layer'),
    category: str('category'),
    milestone: str('milestone'),
    created: str('created'),
    updated: str('updated'),
    decided: str('decided'),
    date: ISO.test(str('decided')) ? str('decided') : str('created'),
    live: status !== 'archived',
    summary: readSummary(str('type'), head),
    relations: readRelations(data, sections),
    source: str('source'),
    atoms: kind === 'map' ? asList(data.atoms) : [],
  };
}

const KINDS = [['atoms', 'atom'], ['layers', 'layer'], ['maps', 'map']];

export function loadStore(root) {
  const docs = new Map();
  const problems = [];
  for (const [dir, kind] of KINDS) {
    const base = path.join(root, dir);
    if (!fs.existsSync(base)) continue;
    for (const file of walkFiles(base)) {
      if (!file.endsWith('.md')) continue;
      const report = (code, message) => problems.push({ code, file: toPosix(path.relative(root, file)), message });
      let doc;
      try { doc = makeDoc(file, root, kind); } catch (e) { report('unreadable', `읽을 수 없어 건너뜁니다: ${e.message}`); continue; }
      if (doc.raw === null) { report('no-frontmatter', '프론트매터가 없어 건너뜁니다'); continue; }
      if (!doc.name) { report('no-name', 'name이 없어 건너뜁니다'); continue; }
      if (docs.has(doc.name)) { report('dup-name', `name이 ${docs.get(doc.name).rel}와 겹쳐 건너뜁니다`); continue; }
      docs.set(doc.name, doc);
      if (doc.bad.length) report('bad-frontmatter', `프론트매터에 읽지 못한 줄이 있습니다: ${doc.bad.join(' / ')}`);
      const missing = kind === 'atom' && doc.live && doc.type !== 'concept' ? ['Why', 'Rule'].filter((k) => !doc.sections.some((s) => s.key === k)) : [];
      if (missing.length) report('missing-section', `${missing.join(', ')} 섹션을 찾지 못해 발췌에서 빠집니다`);
    }
  }
  const of = (kind) => [...docs.values()].filter((d) => d.kind === kind);
  return { root, docs, atoms: of('atom'), layers: of('layer'), maps: of('map'), problems };
}

/** 프로젝트에서 표식이 있는 저장소 폴더를 찾는다. */
export function findStores(projectRoot) {
  return walkFiles(projectRoot, SKIP_DIRS)
    .filter((f) => path.basename(f) === '_jit_manifest.json')
    .filter((f) => { try { return JSON.parse(readText(f)).schema === SCHEMA; } catch { return false; } })
    .map((f) => path.dirname(f));
}
