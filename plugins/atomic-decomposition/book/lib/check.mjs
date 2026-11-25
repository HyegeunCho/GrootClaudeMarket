// 원고와 결과물을 검사한다. 뜻이 바뀌었는지는 여기서 알 수 없다 (대조가 맡는다).
import fs from 'node:fs';
import path from 'node:path';
import { readText, toPosix, walkFiles } from './fsutil.mjs';
import { wikiNames } from './store.mjs';
import { splitCode, outsideCode, findLinks, linkKind, localPath } from './links.mjs';
import { chapters, validateOutline, BACKGROUND } from './bookfile.mjs';
import { chapterStatus, hash, manuscriptFile, openLines, sectionNumbers, sectionSources, wholeChapter } from './bundle.mjs';
import { parseManuscript } from './manuscript.mjs';
import { planSite } from './site.mjs';
import { fenced, ORIGINAL_BEGIN, ORIGINAL_END } from './build-md.mjs';

const NUMBER = /(?<![\w.])(\d{4}-\d{2}-\d{2}|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)[A-Za-z%]{0,4}(?!\w)/g;

/** 글에서 검사할 숫자. 목록 번호, 버전 표기, 표식과 링크 이름 속 숫자는 뺀다. */
export function numberTokens(text) {
  const plain = text.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\[\[[^\]\n]*\]\]/g, ' ').replace(/^\s*\d+[.)]\s/gm, ' ');
  return new Set([...plain.matchAll(NUMBER)].map((m) => m[1].replaceAll(',', '')));
}

const sourceNumbers = (text) => new Set([...text.matchAll(NUMBER)].map((m) => m[1].replaceAll(',', '')));
const inlineCodes = (text) => splitCode(text).filter((p) => p.code && /^`/.test(p.text) && !/^`{3,}[^`\n]*\n/.test(p.text)).map((p) => p.text.replace(/^`+\s?|\s?`+$/g, ''));
const times = (list, x) => list.filter((y) => y === x).length;

// 이력 항목 머리의 버전과 날짜: `**v2 (2026-11-17)** …`
const HEAD = /^\*\*(.+?)\*\*/;
const VERSION = /\bv(\d+)\b/;
const DATE = /\d{4}-\d{2}-\d{2}/;
const versionOf = (name) => name.match(/_v(\d+)$/)?.[1] ?? '';

// 주소로 볼 것. 이 밖의 괄호 글은 내용이므로 남아 있어야 한다.
const ADDRESS = /^<.*>$|^\s*[a-z][a-z0-9+.-]*:|^\s*(?:\.\.?(?:[\\/]|$)|[\\/#])|\.[a-z][a-z0-9]{0,4}(?:[?#].*)?$|^[\x21-\x7e]*\/[\x21-\x7e]*$/i;

/**
 * 링크 표기를 뺀 글자열. 부록 원문이 원본과 같은지 볼 때 쓴다.
 * 변환기(links.mjs)가 틀렸을 때 함께 틀리지 않도록 일부러 다른 방법으로 만든다.
 */
export function originalFingerprint(text) {
  return text
    .replace(/^( {0,3})\\?\[(?!\^)([^\]\n]+)\]:[ \t]*(\S+)[ \t]*(?:"[^"\n]*"|'[^'\n]*')?[ \t]*$/gm, (raw, indent, id, dest) => (ADDRESS.test(dest) ? id : raw))
    .replace(/\\[[\]]/g, '')
    .replace(/\[\[([^[\]\n|]+)\|([^[\]\n]+)\]\]/g, '$2')
    .replace(/\[\[([^[\]\n|]+)\]\]/g, '$1')
    .replace(/\]\(\s*(<[^<>\n]*>|[^()\s]*(?:\([^()\s]*\)[^()\s]*)*)(?:\s+(?:"[^"\n]*"|'[^'\n]*'|\([^()\n]*\)))?\s*\)/g, (raw, dest) => (ADDRESS.test(dest) || dest === '' ? ']' : raw))
    .replace(/\s(?:href|src)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'<>]+)/gi, '')
    .replace(/[[\]!<>\\\s]/g, '');
}

export function checkChapter(entry, ctx) {
  const { key, chapter, part } = entry;
  const file = manuscriptFile(ctx.bookDir, key);
  const out = [];
  const add = (level, code, section, message) => out.push({ level, code, chapter: key, section, message });
  if (!fs.existsSync(file)) {
    add('warn', 'unwritten', '', '원고가 없어 요약만 싣습니다');
    return out;
  }
  const text = readText(file);
  const m = parseManuscript(text);
  const sourceOf = (section) => ({
    text: [chapter.title, sectionSources(section, ctx)].join('\n'),
    numbers: sourceNumbers([chapter.title, sectionNumbers(section, ctx)].join('\n')),
  });
  const wholeSource = sourceOf(wholeChapter(entry));

  // 빠짐
  const cover = (kind, wanted, required) => {
    const placed = m.sections.flatMap((s) => s[kind]);
    if (required) for (const n of wanted) if (!placed.includes(n)) add('error', 'coverage', '', `어느 절에도 없습니다: ${n}`);
    for (const n of new Set(placed)) {
      if (!wanted.includes(n)) add('error', 'coverage', '', `이 장의 목차에 없습니다: ${n}`);
      else if (times(placed, n) > 1) add('error', 'coverage', '', `두 절에 있습니다: ${n}`);
    }
  };
  cover('atoms', chapter.atoms ?? [], true);
  cover('layers', chapter.layers ?? [], part.id === BACKGROUND);
  cover('context', part.id === BACKGROUND ? chapter.context ?? [] : [], true);

  const facts = (sectionTitle, body, source) => {
    for (const c of inlineCodes(body)) if (!source.text.includes(c)) add('error', 'identifier', sectionTitle, `원문에 없는 식별자: \`${c}\``);
    for (const n of numberTokens(`${sectionTitle}\n\n${outsideCode(body)}`)) if (!source.numbers.has(n)) add('error', 'number', sectionTitle, `원문에 없는 숫자: ${n}`);
  };
  facts('', `${m.title}\n\n${m.intro}`, wholeSource);

  for (const s of m.sections) {
    const marked = s.atoms.length + s.layers.length + s.context.length > 0;
    if (!marked && !s.open) add('error', 'coverage', s.title, '원문 표식(<!-- atoms: … -->)이 없는 절입니다');
    facts(s.title, s.text, marked ? sourceOf(s) : wholeSource);

    // 이력
    const threads = new Map();
    for (const n of s.atoms) if (ctx.store.docs.has(n)) threads.set(n, ctx.lineage.thread(n).map((d) => ({ version: versionOf(d.name), date: d.date })));
    for (const id of s.context) threads.set(id, (ctx.context.find((c) => c.id === id)?.versions ?? []).map((v) => ({ version: versionOf(`_${v.label}`), date: '' })));
    for (const [n, thread] of threads) {
      const found = s.history.filter((h) => h.name === n);
      const bad = (code, message) => add('error', code, s.title, message);
      if (thread.length > 1 && found.length !== 1) bad('history-count', `${n}의 이력(${thread.length}건)이 ${found.length}번 나옵니다`);
      else if (thread.length > 1 && found[0].items.length !== thread.length) bad('history-count', `${n}의 이력은 ${thread.length}건인데 ${found[0].items.length}건만 있습니다`);
      else if (thread.length > 1) {
        found[0].items.forEach((item, i) => {
          const head = item.match(HEAD)?.[1] ?? '';
          const version = head.match(VERSION)?.[1];
          const date = head.match(DATE)?.[0];
          const t = thread[i];
          if ((version && t.version && version !== t.version) || (date && t.date && date !== t.date)) bad('history-order', `${n}의 이력 ${i + 1}번은 ${[t.version && `v${t.version}`, t.date].filter(Boolean).join(' · ')}인데 "${head}"로 적었습니다`);
        });
      } else if (found.length) bad('history-count', `${n}에는 이력이 없습니다`);
    }
    for (const h of s.history) if (!threads.has(h.name)) add('error', 'history-count', s.title, `이 절에 속하지 않은 이력입니다: ${h.name}`);
  }

  // 미정
  const openNames = new Set(m.sections.filter((s) => s.open).flatMap((s) => wikiNames(outsideCode(s.text))));
  for (const n of chapter.atoms ?? []) {
    const d = ctx.store.docs.get(n);
    if (d?.live && openLines(d).length && !openNames.has(n)) add('error', 'open-missing', '', `"아직 정해지지 않은 것"에 [[${n}]]이 없습니다`);
  }

  // 링크와 잔여
  const prose = outsideCode(text);
  for (const n of new Set(wikiNames(prose))) {
    if (ctx.store.docs.has(n) || ctx.context.some((c) => c.id === n)) continue;
    add(ctx.relations.external.has(n) ? 'warn' : 'error', 'unknown-link', '', ctx.relations.external.has(n) ? `책 밖의 이름이라 글자로 싣습니다: ${n}` : `저장소에 없는 이름입니다: ${n}`);
  }
  if (prose.includes('{{')) add('error', 'leftover', '', '자리표시자 {{가 남았습니다');

  // 대조
  const status = chapterStatus(entry, ctx);
  if (status === 'rewrite') add('error', 'review-missing', '', ctx.state.chapters[key] ? '원문이 바뀌었습니다. 원고를 고치고 다시 대조해야 합니다' : '아직 대조하지 않았습니다');
  if (status === 'review') {
    const review = ctx.state.chapters[key].review;
    add('error', 'review-missing', '', !review ? '아직 대조하지 않았습니다' : review.manuscriptHash !== hash(text) ? '원고가 바뀐 뒤 대조하지 않았습니다' : '원문이 바뀐 뒤 대조하지 않았습니다');
  }
  if (status === 'unresolved') for (const f of ctx.state.chapters[key].review.unresolved) add('error', 'review-unresolved', f.section ?? '', `${f.kind}: ${f.manuscript ?? ''} (고칠 방향: ${f.fix ?? ''})`);
  return out;
}

export function checkBook(ctx) {
  const out = [];
  const add = (level, code, message) => out.push({ level, code, chapter: '', section: '', message });
  const r = validateOutline(ctx.book, ctx.store, ctx.context);
  for (const n of r.missing) add('error', 'outline', `목차에 없는 결정: ${n}`);
  for (const n of r.duplicate) add('error', 'outline', `두 번 나오는 결정: ${n}`);
  for (const n of r.unknown) add('error', 'outline', `저장소에 없는 이름: ${n}`);
  for (const n of r.archived) add('error', 'outline', `archived인데 현행 자리에 있는 결정: ${n}`);
  for (const p of r.problems) add('error', 'outline', p);
  for (const p of ctx.contextProblems) add('error', 'context', `${p.file}: ${p.message}`);
  for (const p of ctx.store.problems) add('warn', 'store', `${p.file}: ${p.message}`);
  for (const e of chapters(ctx.book)) out.push(...checkChapter(e, ctx));
  return out;
}

/** 만든 md를 검사한다. 만들지 않았으면 빈 목록이다. */
export function checkBuilt(ctx) {
  const dir = path.join(ctx.bookDir, 'md');
  if (!fs.existsSync(path.join(dir, 'SUMMARY.md'))) return [];
  const out = [];
  const add = (level, code, file, message) => out.push({ level, code, chapter: file, section: '', message });

  for (const o of planSite(ctx).originals) {
    const file = path.join(dir, o.file);
    const text = fs.existsSync(file) ? readText(file) : '';
    const from = text.indexOf(ORIGINAL_BEGIN);
    const to = text.lastIndexOf(ORIGINAL_END);
    const block = from >= 0 && to > from ? text.slice(from + ORIGINAL_BEGIN.length, to) : null;
    const same = block !== null && (o.code ? block.trim() === fenced(o.code, o.body).trim() : originalFingerprint(block) === originalFingerprint(o.body));
    const rawKept = o.raw === null || text.slice(0, Math.max(from, 0)).includes(fenced('yaml', o.raw));
    if (!same || !rawKept) add('error', 'original-changed', `md/${o.file}`, '부록 원문이 원본과 다릅니다. 다시 build하고, 그래도 나오면 링크 표기를 옮기지 못한 것이니 사용자에게 알리세요');
  }

  const anchors = new Map();
  const anchorsOf = (file) => {
    if (!anchors.has(file)) anchors.set(file, new Set([...readText(file).matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])));
    return anchors.get(file);
  };
  const files = new Set(walkFiles(dir));
  const checkLink = (dest, file, rel) => {
    const kind = linkKind(dest);
    if (kind === 'web' || dest === '') return;
    if (kind === 'none' && !dest.startsWith('#')) { add('error', 'absolute-link', rel, `절대 경로 링크: ${dest}`); return; }
    const [target, anchor] = dest.split('#');
    const to = target ? path.resolve(path.dirname(file), localPath(target)) : file;
    if (!files.has(to)) add('error', 'link-broken', rel, `없는 파일: ${dest}`); // 대소문자까지 맞아야 한다
    else if (anchor && !anchorsOf(to).has(anchor)) add('error', 'anchor-missing', rel, `없는 자리: ${dest}`);
  };

  for (const file of walkFiles(dir).filter((f) => f.endsWith('.md'))) {
    const rel = `md/${toPosix(path.relative(dir, file))}`;
    const text = readText(file);
    for (const { dest } of findLinks(text)) checkLink(dest, file, rel);
    if (outsideCode(text).includes('{%')) add('warn', 'liquid', rel, `GitBook 문법과 겹치는 글 {% 가 있습니다: ${rel}`);
  }
  return out;
}

export function formatFindings(list) {
  const lines = list.map((f) => `[${f.level === 'error' ? '오류' : '경고'}] ${f.code}${f.chapter ? ` · ${f.chapter}` : ''}${f.section ? ` · ${f.section}` : ''} — ${f.message}`);
  const n = (level) => list.filter((f) => f.level === level).length;
  return [...lines, `오류 ${n('error')}건, 경고 ${n('warn')}건`].join('\n');
}
