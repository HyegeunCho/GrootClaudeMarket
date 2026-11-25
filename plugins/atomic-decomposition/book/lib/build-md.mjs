// GitBook용 md를 만든다. 원고는 다듬어 싣고, 원문은 링크 표기만 바꿔 그대로 싣는다.
import fs from 'node:fs';
import path from 'node:path';
import { publishDir } from './fsutil.mjs';
import { hash, hasException } from './bundle.mjs';
import { BACKGROUND } from './bookfile.mjs';
import { escapeFakeLinks, mdText, relLink, replaceWiki, rewriteOriginal } from './links.mjs';
import { chapterGraph, toMermaid } from './graph.mjs';
import { APPENDIX, planSite, statusLabel, versionLabel } from './site.mjs';
import { MARK } from './manuscript.mjs';

export const ORIGINAL_BEGIN = '<!-- original:begin -->';
export const ORIGINAL_END = '<!-- original:end -->';
const IMAGE = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.avif']);

export function fenced(lang, text) {
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = '`'.repeat(longest + 1);
  return `${fence}${lang}\n${text.replace(/\n$/, '')}\n${fence}`;
}

const tidy = (s) => s.replace(/\n{3,}/g, '\n\n').trim() + '\n';
const anchorTag = (id) => ` <a href="#${id}" id="${id}"></a>`;

function makeRenderer(ctx, site, assets) {
  const link = (from, label, place) => `[${mdText(label)}](${relLink(from, place.file, place.anchor)})`;
  const toOriginal = (from, name, label = '원문') => { const o = site.originalOf(name); return o ? link(from, label, o) : ''; };
  const toPlace = (from, name, label) => { const p = site.placeOf(name); return p ? link(from, label ?? site.titleOf(name), p) : mdText(label ?? site.titleOf(name)); };

  const stateLine = (from, doc) => [
    doc.type === 'feedback' ? '재발 방지' : '',
    versionLabel(doc.name) ? `현재 ${versionLabel(doc.name)}` : '',
    doc.date, statusLabel(doc.status), toOriginal(from, doc.name),
  ].filter(Boolean).join(' · ');

  const stateLines = (from, docs) => {
    if (docs.length < 2) return docs.map((d) => stateLine(from, d)).join('');
    return docs.map((d) => `- ${mdText(d.title)}: ${stateLine(from, d)}`).join('\n');
  };

  /** 폐기된 결정을 가리키면 그 사실과 지금의 결정을 함께 알린다. */
  const toRelated = (from, name) => {
    const d = ctx.store.docs.get(name);
    if (d.kind !== 'atom' || d.live) return toPlace(from, name);
    const now = ctx.lineage.current(name).map((n) => toPlace(from, n));
    return `${toOriginal(from, name, site.titleOf(name))} (폐기${now.length ? ` → 현재: ${now.join(', ')}` : ''})`;
  };

  function related(from, docs) {
    const own = new Set(docs.map((d) => d.name));
    const groups = { 전제: [], 영향: [], '이 결정을 참조': [], 충돌: [] };
    const add = (k, n) => { if (!own.has(n) && !groups[k].includes(n)) groups[k].push(n); };
    for (const d of docs) {
      const out = ctx.relations.out.get(d.name) ?? [];
      for (const [rel, group] of [['requires', '전제'], ['derives_from', '전제'], ['affects', '영향']]) {
        for (const e of out) if (e.rel === rel) add(group, e.to);
      }
      for (const { rel, from: other } of ctx.relations.in.get(d.name) ?? []) {
        const o = ctx.store.docs.get(other);
        if (rel !== 'part_of' && o.kind === 'atom' && o.live) add('이 결정을 참조', other);
      }
      for (const c of ctx.relations.clashes) {
        if (c.from === d.name) add('충돌', c.to);
        if (c.to === d.name) add('충돌', c.from);
      }
    }
    const lines = Object.entries(groups).filter(([, n]) => n.length).map(([k, n]) => `- ${k}: ${n.map((x) => toRelated(from, x)).join(', ')}`);
    return lines.length ? ['**이어진 결정**', '', ...lines].join('\n') : '';
  }

  const exceptions = (from, docs) => docs.filter(hasException)
    .map((d) => `예외 있음 → ${toOriginal(from, d.name, docs.length > 1 ? `${d.title} 원문` : '원문')}`).join('\n\n');

  const wiki = (from, text) => replaceWiki(escapeFakeLinks(text), (name, label) => {
    const p = site.placeOf(name);
    if (!p) return mdText(label ?? name);
    return label || !ctx.store.docs.has(name) ? link(from, label ?? site.titleOf(name), p) : toRelated(from, name);
  });

  /** 이력 항목 끝에 그 버전의 원문 링크를 붙이고 표식을 걷어낸다. */
  function body(from, text) {
    const lines = text.split('\n');
    const out = [];
    let names = null;
    let at = -1;
    let lastLine = -1;
    const close = () => {
      if (lastLine >= 0 && names?.[at]) out[lastLine] += ` ${toOriginal(from, names[at])}`;
      lastLine = -1;
    };
    for (const line of lines) {
      const mark = line.match(/<!--\s*history\s*:\s*([^>]*?)\s*-->/);
      if (mark) {
        close();
        const n = mark[1].trim();
        const c = ctx.context.find((x) => x.id === n);
        names = c ? c.versions.map((v) => v.name) : ctx.store.docs.has(n) ? ctx.lineage.thread(n).map((d) => d.name) : null;
        at = -1;
        continue;
      }
      if (names && /^\d+\.\s+/.test(line)) { close(); at++; out.push(line); lastLine = out.length - 1; continue; }
      if (names && lastLine >= 0 && /^\s+\S/.test(line)) { out.push(line); lastLine = out.length - 1; continue; }
      if (names && line.trim() !== '') { close(); names = null; }
      out.push(line);
    }
    close();
    return wiki(from, out.join('\n').replace(MARK, '').replace(/<!--[\s\S]*?-->/g, ''));
  }

  const copyAssetFrom = (dir) => (dest) => {
    const f = path.resolve(dir, dest.replaceAll('\\', '/'));
    if (!IMAGE.has(path.extname(f).toLowerCase()) || !fs.existsSync(f)) return null;
    const data = fs.readFileSync(f);
    const name = `assets/${hash(data).slice(0, 8)}-${path.basename(f)}`;
    assets.set(name, data);
    return name;
  };

  function originalPage(o) {
    const dir = path.dirname(o.source);
    const next = (ctx.lineage.next.get(o.name) ?? []).map((n) => toOriginal(o.file, n, site.titleOf(n)));
    const section = site.sectionOf(o.contextId && o.group === 'context' ? o.contextId : o.name);
    const note = [o.note, next.length ? `대체한 결정: ${next.join(', ')}` : '', section ? link(o.file, '본문에서 보기', section) : ''].filter(Boolean).join(' · ');
    const content = o.code ? fenced(o.code, o.body) : rewriteOriginal(o.body, {
      fromFile: o.file,
      resolveWiki: (n) => site.originalOf(n),
      resolvePath: (p) => site.originalOfFile(path.resolve(dir, p.replaceAll('\\', '/'))),
      copyAsset: copyAssetFrom(dir),
    });
    const parts = [`# ${mdText(o.title)}`];
    if (note) parts.push(`> ${note}`);
    if (o.raw !== null) parts.push(fenced('yaml', o.raw));
    parts.push(`${ORIGINAL_BEGIN}\n${content}\n${ORIGINAL_END}`);
    return parts.join('\n\n') + '\n';
  }

  return { link, toOriginal, toPlace, stateLines, related, exceptions, wiki, body, originalPage };
}

function contextLine(r, from, chapter, part, ctx) {
  if (part.id === BACKGROUND) return '';
  const list = (chapter.context ?? []).filter((id) => ctx.context.some((c) => c.id === id)).map((id) => r.toPlace(from, id));
  return list.length ? `관련 기획서: ${list.join(', ')}` : '';
}

function droppedSection(r, from, chapter, ctx) {
  const docs = (chapter.dropped ?? []).map((n) => ctx.store.docs.get(n)).filter(Boolean);
  if (!docs.length) return '';
  return ['## 폐기된 결정', '', ...docs.map((d) => `- **${mdText(d.title)}** — ${r.wiki(from, d.summary)} ${r.toOriginal(from, d.name)}`)].join('\n');
}

function chapterPage(page, ctx, r) {
  const { file, part, chapter, manuscript } = page;
  const graph = chapterGraph(chapter.atoms ?? [], ctx);
  const docsOf = (names) => names.map((n) => ctx.store.docs.get(n)).filter((d) => d?.kind === 'atom');
  const out = [`# ${mdText(chapter.title)}`];
  const push = (...parts) => out.push(...parts.filter(Boolean));
  const figure = graph ? fenced('mermaid', toMermaid(graph)) : '';
  if (manuscript) {
    push(r.wiki(file, manuscript.intro), contextLine(r, file, chapter, part, ctx));
    const listed = manuscript.sections.filter((s) => docsOf(s.atoms).length);
    if (listed.length) push('**이 장의 결정**', listed.map((s) => `- [${mdText(s.title)}](#${s.atoms[0]}) — ${docsOf(s.atoms).map((d) => mdText(d.title)).join(' / ')}`).join('\n'));
    push(figure);
    for (const s of manuscript.sections) {
      const docs = docsOf(s.atoms);
      const id = [...s.atoms, ...s.layers, ...s.context][0];
      push(`## ${s.title}${id ? anchorTag(id) : ''}`, r.stateLines(file, docs));
      if (!docs.length && id) push([...s.layers, ...s.context].map((n) => r.toOriginal(file, n, `${ctx.store.docs.get(n)?.title ?? ctx.context.find((c) => c.id === n)?.title ?? n} 원문`)).filter(Boolean).join(' · '));
      push(r.body(file, s.text), r.exceptions(file, docs), r.related(file, docs));
    }
  } else {
    push(`> 아직 편집하지 않은 장입니다. ${part.id === BACKGROUND ? '원문으로 이어집니다.' : '결정마다 한 문장 요약을 원문 그대로 싣습니다.'}`, contextLine(r, file, chapter, part, ctx), figure);
    for (const d of docsOf(chapter.atoms ?? [])) {
      const past = ctx.lineage.thread(d.name).slice(0, -1);
      push(`## ${mdText(d.title)}${anchorTag(d.name)}`, r.stateLines(file, [d]), r.wiki(file, d.summary));
      if (past.length) push('**지난 결정**', past.map((p) => `- ${[versionLabel(p.name), p.date].filter(Boolean).join(' · ')} ${r.toOriginal(file, p.name, p.title)}`).join('\n'));
      push(r.exceptions(file, [d]), r.related(file, [d]));
    }
    if (part.id === BACKGROUND) {
      for (const n of [...(chapter.layers ?? []), ...(chapter.context ?? [])]) {
        const title = ctx.store.docs.get(n)?.title ?? ctx.context.find((c) => c.id === n)?.title ?? n;
        push(`## ${mdText(title)}${anchorTag(n)}`, r.toOriginal(file, n));
      }
    }
  }
  push(droppedSection(r, file, chapter, ctx));
  return out.join('\n\n');
}

const listItem = (r, from, d) => `- ${r.toPlace(from, d.name)} · ${statusLabel(d.status)}`;
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.name < b.name ? -1 : 1);

function scopeView(file, ctx, r, site) {
  const live = ctx.store.atoms.filter((d) => d.live);
  const out = ['# 구현 범위별', '현행 결정을 구현 범위로 묶었습니다.'];
  if (live.some((d) => d.milestone)) {
    out.push('## 마일스톤');
    for (const m of [...new Set(live.map((d) => d.milestone))].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a < b ? -1 : 1))) {
      const docs = live.filter((d) => d.milestone === m).sort(byDate);
      out.push(`### ${m ? mdText(m) : '마일스톤 없음'}`, docs.map((d) => listItem(r, file, d)).join('\n'));
    }
  }
  out.push('## Layer 문서');
  const parts = [...new Set(live.flatMap((d) => d.relations.part_of))].sort();
  for (const p of parts) {
    const docs = live.filter((d) => d.relations.part_of.includes(p)).sort(byDate);
    out.push(`### ${site.originalOf(p) ? r.toOriginal(file, p, site.titleOf(p)) : mdText(p)}`, docs.map((d) => listItem(r, file, d)).join('\n'));
  }
  const none = live.filter((d) => !d.relations.part_of.length).sort(byDate);
  if (none.length) out.push('### 소속 없음', none.map((d) => listItem(r, file, d)).join('\n'));
  return out.join('\n\n');
}

function workView(file, ctx, r) {
  const item = (d) => {
    if (d.live) return listItem(r, file, d);
    const now = ctx.lineage.current(d.name).map((n) => r.toPlace(file, n));
    return `- ${r.toOriginal(file, d.name, d.title)} · ${statusLabel(d.status)}${now.length ? ` → 현재: ${now.join(', ')}` : ''}`;
  };
  const out = ['# 작업 순서별', '분해 기록의 날짜 순서로, 그때 만든 결정을 모았습니다.'];
  const seen = new Set();
  for (const m of [...ctx.store.maps].sort(byDate)) {
    const docs = m.atoms.map((n) => ctx.store.docs.get(n)).filter(Boolean);
    docs.forEach((d) => seen.add(d.name));
    out.push(`## ${m.date} ${mdText(m.title)}`, [m.source ? `출처: ${mdText(m.source)}` : '', r.toOriginal(file, m.name, '기록 원문')].filter(Boolean).join(' · '), docs.map(item).join('\n') || '결정 없음');
  }
  const rest = ctx.store.atoms.filter((d) => !seen.has(d.name)).sort(byDate);
  if (rest.length) out.push('## 분해 기록에 없는 결정', rest.map(item).join('\n'));
  return out.join('\n\n');
}

function changesView(file, ctx, r) {
  const threads = ctx.store.atoms.filter((d) => d.live).map((d) => ctx.lineage.thread(d.name)).filter((t) => t.length > 1)
    .sort((a, b) => -byDate(a.at(-1), b.at(-1)));
  const out = ['# 변경 이력 모아보기', '한 번 이상 바뀐 결정을 최근에 바뀐 순서로 모았습니다.'];
  for (const t of threads) {
    const now = t.at(-1);
    out.push(`## ${r.toPlace(file, now.name)}`, t.map((d, i) => `${i + 1}. ${[versionLabel(d.name), d.date].filter(Boolean).join(' · ')} ${r.toOriginal(file, d.name, d.title)}`).join('\n'));
  }
  if (!threads.length) out.push('바뀐 결정이 없습니다.');
  return out.join('\n\n');
}

function namesView(file, ctx, r, site) {
  const rows = [...ctx.store.atoms].sort((a, b) => (a.name < b.name ? -1 : 1))
    .map((d) => `| ${r.toOriginal(file, d.name, d.name)} | ${mdText(d.title)} | ${statusLabel(d.status)} | ${site.sectionOf(d.name) ? r.link(file, '본문', site.sectionOf(d.name)) : ''} |`);
  return ['# 이름 찾아보기', '코드 주석이나 문서에서 본 이름으로 찾습니다.', ['| 이름 | 제목 | 상태 | 본문 |', '|---|---|---|---|', ...rows].join('\n')].join('\n\n');
}

const VIEWS = [
  ['views/by-scope.md', '구현 범위별', scopeView],
  ['views/by-work.md', '작업 순서별', workView],
  ['views/changes.md', '변경 이력 모아보기', changesView],
  ['views/names.md', '이름 찾아보기', namesView],
];
const VIEW_GROUP = '다른 순서로 보기';
const APPENDIX_GROUP = '부록';

function coverPage(ctx, pages) {
  const dates = [...ctx.store.docs.values()].map((d) => d.updated || d.created).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const toc = [];
  let group = null;
  for (const p of pages) {
    if (p.parent) continue;
    if (p.group !== group) { toc.push(`\n### ${mdText(p.group)}\n`); group = p.group; }
    toc.push(`- [${mdText(p.title)}](${relLink('README.md', p.file)})`);
  }
  return [
    `# ${mdText(ctx.book.title)}`,
    `${dates.length ? `기준 날짜: ${dates.at(-1)}\n\n` : ''}## 읽는 법`,
    ['- 본문은 주제별로 편집한 글입니다. 원문은 절마다 있는 "원문" 링크로 확인합니다.',
      '- 여러 번 바뀐 결정은 "여기까지 온 과정"에 순서대로 적었고, 과거 결정 원문은 부록 A에 있습니다.',
      '- 상태가 초안(draft)이나 검증 중(pending)인 결정은 확정된 것이 아닙니다.',
      '- 구현 범위, 작업 순서, 이름으로 찾으려면 "다른 순서로 보기"를 봅니다.'].join('\n'),
    '## 목차',
    toc.join('\n').trim(),
  ].join('\n\n');
}

function summaryPage(ctx, pages) {
  const out = ['# 목차', '', `* [${mdText(ctx.book.title)}](README.md)`];
  let group = null;
  for (const p of pages) {
    if (p.group !== group) { out.push('', `## ${mdText(p.group)}`, ''); group = p.group; }
    out.push(`${p.parent ? '  ' : ''}* [${mdText(p.title)}](${relLink('SUMMARY.md', p.file)})`);
  }
  return out.join('\n') + '\n';
}

export function buildMd(ctx) {
  const site = planSite(ctx);
  const assets = new Map();
  const r = makeRenderer(ctx, site, assets);
  const pages = [];
  for (const p of site.chapterPages) pages.push({ file: p.file, title: p.chapter.title, group: p.part.title, parent: null, md: chapterPage(p, ctx, r) });
  for (const [file, title, render] of VIEWS) pages.push({ file, title, group: VIEW_GROUP, parent: null, md: render(file, ctx, r, site) });
  for (const [g, title] of APPENDIX) {
    const list = site.originals.filter((o) => o.group === g);
    if (!list.length) continue;
    const index = `appendix/${g}/README.md`;
    pages.push({ file: index, title, group: APPENDIX_GROUP, parent: null, md: [`# ${title}`, list.map((o) => `- ${r.link(index, o.title, o)}${o.note ? ` · ${o.note}` : ''}`).join('\n')].join('\n\n') });
    for (const o of list) pages.push({ file: o.file, title: o.title, group: APPENDIX_GROUP, parent: index, md: r.originalPage(o), original: true });
  }
  const cover = { file: 'README.md', title: ctx.book.title, group: null, parent: null, md: coverPage(ctx, pages) };
  const all = [cover, ...pages];
  if (ctx.book.localNav !== false) {
    all.forEach((p, i) => {
      if (p === cover) return;
      const to = (q, label) => (q ? `[${mdText(label)}](${relLink(p.file, q.file)})` : '');
      const prev = all[i - 1];
      const next = all[i + 1];
      p.md = `${p.md.trimEnd()}\n\n---\n\n${[to(prev, `← ${prev.title}`), to(cover, '목차'), next ? to(next, `${next.title} →`) : ''].filter(Boolean).join(' · ')}\n`;
    });
  }
  const files = new Map(assets);
  for (const p of all) files.set(p.file, p.original ? p.md : tidy(p.md));
  files.set('SUMMARY.md', summaryPage(ctx, pages));
  files.set('.gitbook.yaml', 'root: ./\nstructure:\n  readme: README.md\n  summary: SUMMARY.md\n');
  publishDir(path.join(ctx.bookDir, 'md'), files);
  return all;
}
